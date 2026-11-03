import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Copy, MoreHorizontal, RefreshCw, UserPlus } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/crm-types";
import {
  adminCreateUser, adminSetUserActive, adminRemoveAllowlistEmail, adminDeleteUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_app/benutzer")({
  component: UsersPage,
});

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

type Row = {
  email: string;
  profile_id: string | null;
  full_name: string | null;
  role: AppRole | null;
  on_allowlist: boolean;
  has_account: boolean;
  active: boolean;
  allowlist_note: string | null;
};

function UsersPage() {
  const { role, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setActiveFn = useServerFn(adminSetUserActive);
  const removeAllowlistFn = useServerFn(adminRemoveAllowlistEmail);
  const deleteUserFn = useServerFn(adminDeleteUser);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "orphan" | "inactive" | "pending">("all");
  const [prefillEmail, setPrefillEmail] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // remove-allowlist confirm
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null);
  // delete-user confirm
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  useEffect(() => {
    if (!loading && role !== null && role !== "admin") navigate({ to: "/dashboard" });
  }, [role, loading, navigate]);

  const { data: rows } = useQuery<Row[]>({
    queryKey: ["users-access", "merged"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: allow }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
        supabase.from("auth_email_allowlist").select("*"),
      ]);

      const map = new Map<string, Row>();
      for (const p of profiles ?? []) {
        const em = (p.email ?? "").toLowerCase();
        if (!em) continue;
        map.set(em, {
          email: em,
          profile_id: p.id,
          full_name: p.full_name ?? null,
          role: ((roles ?? []).find((r) => r.user_id === p.id)?.role as AppRole) ?? "mitarbeiter",
          on_allowlist: false,
          has_account: true,
          active: !!p.active,
          allowlist_note: null,
        });
      }
      for (const a of allow ?? []) {
        const em = (a.email ?? "").toLowerCase();
        const existing = map.get(em);
        if (existing) {
          existing.on_allowlist = true;
          existing.allowlist_note = a.note ?? null;
        } else {
          map.set(em, {
            email: em,
            profile_id: null,
            full_name: null,
            role: null,
            on_allowlist: true,
            has_account: false,
            active: false,
            allowlist_note: a.note ?? null,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (q && !r.email.includes(q) && !(r.full_name ?? "").toLowerCase().includes(q)) return false;
      if (filter === "orphan") return r.has_account && !r.on_allowlist;
      if (filter === "inactive") return r.has_account && !r.active;
      if (filter === "pending") return r.on_allowlist && !r.has_account;
      return true;
    });
  }, [rows, search, filter]);

  if (loading || role === null) {
    return <div className="p-6 text-muted-foreground">Wird geladen…</div>;
  }
  if (role !== "admin") return null;

  const changeRole = async (userId: string, newRole: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["users-access"] }); toast.success("Rolle aktualisiert"); }
  };

  const toggleActive = async (userId: string, active: boolean) => {
    try {
      await setActiveFn({ data: { user_id: userId, active } });
      qc.invalidateQueries({ queryKey: ["users-access"] });
      toast.success(active ? "Benutzer aktiviert" : "Benutzer deaktiviert");
    } catch (e: any) {
      toast.error(e?.message ?? "Aktion fehlgeschlagen");
    }
  };

  const addAllowlist = async (em: string, note?: string) => {
    const { error } = await supabase
      .from("auth_email_allowlist")
      .insert({ email: em.toLowerCase(), note: note ?? null });
    if (error) throw new Error(error.message);
  };

  const reactivate = async (r: Row) => {
    try {
      if (!r.on_allowlist) await addAllowlist(r.email, "Auto: bei Reaktivierung");
      if (r.profile_id) await setActiveFn({ data: { user_id: r.profile_id, active: true } });
      qc.invalidateQueries({ queryKey: ["users-access"] });
      toast.success("Account reaktiviert");
    } catch (e: any) {
      toast.error(e?.message ?? "Reaktivieren fehlgeschlagen");
    }
  };

  const confirmRemoveAllowlist = async () => {
    if (!removeTarget) return;
    try {
      await removeAllowlistFn({ data: { email: removeTarget.email } });
      qc.invalidateQueries({ queryKey: ["users-access"] });
      toast.success(
        removeTarget.has_account
          ? "E-Mail entfernt — Account deaktiviert"
          : "E-Mail entfernt",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Entfernen fehlgeschlagen");
    } finally {
      setRemoveTarget(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget?.profile_id) return;
    try {
      await deleteUserFn({ data: { user_id: deleteTarget.profile_id } });
      qc.invalidateQueries({ queryKey: ["users-access"] });
      toast.success("Account endgültig gelöscht");
    } catch (e: any) {
      toast.error(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benutzer &amp; Zugang</h1>
          <p className="text-sm text-muted-foreground">
            Erlaubt-Liste und Accounts in einer Übersicht · Self-Registrierung deaktiviert
          </p>
        </div>
        <Button onClick={() => { setPrefillEmail(null); setCreateOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" /> Neuen Benutzer anlegen
        </Button>
      </div>

      <AddAllowlistForm
        onAdded={() => qc.invalidateQueries({ queryKey: ["users-access"] })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche E-Mail oder Name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="pending">Nur vorgemerkt (kein Account)</SelectItem>
            <SelectItem value="inactive">Nur deaktivierte Accounts</SelectItem>
            <SelectItem value="orphan">Nur verwaiste Accounts (nicht auf Liste)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">E-Mail</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Rolle</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aktiv</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const isSelf = r.profile_id === user?.id;
                const orphan = r.has_account && !r.on_allowlist;
                return (
                  <tr key={r.email} className={orphan ? "bg-destructive/5" : undefined}>
                    <td className="px-4 py-3 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-3">
                      {r.full_name ?? <span className="text-muted-foreground">—</span>}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.has_account && r.profile_id ? (
                        <Select
                          value={r.role ?? "mitarbeiter"}
                          onValueChange={(v) => changeRole(r.profile_id!, v as AppRole)}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.on_allowlist ? (
                          <Badge variant="secondary">Allowlist</Badge>
                        ) : (
                          <Badge variant="destructive">Nicht auf Liste</Badge>
                        )}
                        {r.has_account ? (
                          <Badge variant="outline">Account</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Kein Account</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.has_account && r.profile_id ? (
                        <Switch
                          checked={r.active}
                          onCheckedChange={(c) => toggleActive(r.profile_id!, c)}
                          disabled={isSelf}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!r.has_account && r.on_allowlist && (
                            <DropdownMenuItem onClick={() => { setPrefillEmail(r.email); setCreateOpen(true); }}>
                              Account anlegen
                            </DropdownMenuItem>
                          )}
                          {r.has_account && (!r.active || orphan) && !isSelf && (
                            <DropdownMenuItem onClick={() => reactivate(r)}>
                              Reaktivieren
                            </DropdownMenuItem>
                          )}
                          {r.on_allowlist && (
                            <DropdownMenuItem
                              onClick={() => setRemoveTarget(r)}
                              disabled={isSelf}
                            >
                              Aus Erlaubt-Liste entfernen
                            </DropdownMenuItem>
                          )}
                          {r.has_account && !isSelf && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(r)}
                              >
                                Account endgültig löschen
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Keine Einträge.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillEmail={prefillEmail}
        onCreated={() => qc.invalidateQueries({ queryKey: ["users-access"] })}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail aus Erlaubt-Liste entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.has_account ? (
                <>
                  <strong className="font-mono">{removeTarget?.email}</strong> gehört zum Account
                  {" "}<strong>{removeTarget?.full_name ?? "(ohne Namen)"}</strong>. Beim Entfernen
                  wird der Account <strong>automatisch deaktiviert</strong> (Login gesperrt,
                  bestehende Sitzungen ungültig). Zugewiesene Kunden und Verträge bleiben erhalten.
                </>
              ) : (
                <>
                  <strong className="font-mono">{removeTarget?.email}</strong> wird aus der
                  Erlaubt-Liste entfernt.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAllowlist}>
              {removeTarget?.has_account ? "Entfernen & deaktivieren" : "Entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.full_name ?? deleteTarget?.email}</strong> wird unwiderruflich
              gelöscht. Falls dem Account noch Kunden zugewiesen sind, müssen diese vorher
              übertragen werden — sonst bricht der Vorgang ab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddAllowlistForm({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    const { error } = await supabase
      .from("auth_email_allowlist")
      .insert({ email: clean, note: note.trim() || null });
    if (error) toast.error(error.message);
    else {
      toast.success("E-Mail zur Erlaubt-Liste hinzugefügt");
      setEmail(""); setNote("");
      onAdded();
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label htmlFor="allow-email" className="text-xs">E-Mail zur Erlaubt-Liste hinzufügen</Label>
            <Input id="allow-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.de" required />
          </div>
          <div className="flex-1 min-w-[180px] space-y-1">
            <Label htmlFor="allow-note" className="text-xs">Notiz (optional)</Label>
            <Input id="allow-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Mitarbeiter Vertrieb" />
          </div>
          <Button type="submit">Hinzufügen</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({
  open, onOpenChange, prefillEmail, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefillEmail: string | null;
  onCreated: () => void;
}) {
  const createFn = useServerFn(adminCreateUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("mitarbeiter");
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(prefillEmail ?? "");
      setFullName("");
      setRole("mitarbeiter");
      setPassword(generatePassword());
      setCreated(null);
    }
  }, [open, prefillEmail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFn({ data: { email, full_name: fullName, role, password } });
      setCreated({ email, password });
      toast.success("Benutzer angelegt");
      onCreated();
    } catch (err: any) {
      toast.error("Erstellung fehlgeschlagen", { description: err?.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopiert");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Nur Administratoren können Benutzer anlegen. Self-Registrierung ist deaktiviert.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
              Benutzer wurde erstellt. Bitte die Zugangsdaten <strong>jetzt</strong> sicher an den Mitarbeiter weitergeben – sie werden nicht erneut angezeigt.
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <div className="flex gap-2">
                <Input value={created.email} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(created.email)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Initial-Passwort</Label>
              <div className="flex gap-2">
                <Input value={created.password} readOnly className="font-mono" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(created.password)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fertig</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Vollständiger Name</Label>
              <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">E-Mail</Label>
              <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Initial-Passwort</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  minLength={10}
                  required
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Neues Passwort generieren">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Mindestens 10 Zeichen. Wird geprüft gegen geleakte Passwörter (HIBP).</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Lege an…" : "Anlegen"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
