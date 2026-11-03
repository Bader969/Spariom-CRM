import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Home, Users, Link2, Gift, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import { HouseholdDialog, type HouseholdRecord } from "@/components/HouseholdDialog";
import { HouseholdMemberDialog, HOUSEHOLD_ROLES, type HouseholdRole } from "@/components/HouseholdMemberDialog";
import { RelationDialog, RELATION_TYPES, relationLabel, type RelationType } from "@/components/RelationDialog";
import { CustomerCombobox } from "@/components/CustomerCombobox";

type CustomerLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
};

const customerLabel = (c: { first_name: string | null; last_name: string | null } | null | undefined) =>
  c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "— ohne Name —" : "—";

export function VerknuepfungenPanel({ customer }: { customer: CustomerLite }) {
  const qc = useQueryClient();
  const customerId = customer.id;

  // ============ Household ============
  const { data: myMembership } = useQuery({
    queryKey: ["customer-household", customerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("household_members")
        .select("id, role, is_primary, household:households(id, name, street, house_no, postal_code, city, notes)")
        .eq("customer_id", customerId)
        .maybeSingle();
      return data ?? null;
    },
  });

  const household = myMembership?.household as HouseholdRecord | null | undefined;

  const { data: householdMembers } = useQuery({
    queryKey: ["household", household?.id, "members"],
    enabled: !!household?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("household_members")
        .select("id, role, is_primary, customer:customers(id, first_name, last_name)")
        .eq("household_id", household!.id);
      return data ?? [];
    },
  });

  // ============ Relations ============
  const { data: relations } = useQuery({
    queryKey: ["customer-relations", customerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customer_relations")
        .select("id, relation_type, notes, related:customers!customer_relations_related_customer_id_fkey(id, first_name, last_name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // ============ Referrals ============
  const { data: referrer } = useQuery({
    queryKey: ["customer-referrer", (customer as any).referred_by_customer_id ?? null],
    enabled: !!(customer as any).referred_by_customer_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, first_name, last_name")
        .eq("id", (customer as any).referred_by_customer_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: referredCustomers } = useQuery({
    queryKey: ["customer-referred-by-this", customerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customers")
        .select("id, first_name, last_name, referral_status, referral_bonus_amount")
        .eq("referred_by_customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // ============ Dialogs ============
  const [householdDlg, setHouseholdDlg] = useState<{ open: boolean; edit: HouseholdRecord | null }>({ open: false, edit: null });
  const [memberDlg, setMemberDlg] = useState(false);
  const [relationDlg, setRelationDlg] = useState(false);
  const [joinPickerOpen, setJoinPickerOpen] = useState(false);
  const [joinHouseholdId, setJoinHouseholdId] = useState<string | null>(null);

  const existingMemberIds = useMemo(
    () => (householdMembers ?? []).map((m: any) => m.customer?.id).filter(Boolean) as string[],
    [householdMembers]
  );

  const leaveHousehold = async () => {
    if (!myMembership?.id) return;
    if (!confirm("Diesen Kunden aus dem Haushalt entfernen?")) return;
    const { error } = await (supabase as any).from("household_members").delete().eq("id", myMembership.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aus Haushalt entfernt");
    qc.invalidateQueries({ queryKey: ["customer-household", customerId] });
    qc.invalidateQueries({ queryKey: ["household"] });
  };

  const removeMember = async (mid: string) => {
    if (!confirm("Mitglied entfernen?")) return;
    const { error } = await (supabase as any).from("household_members").delete().eq("id", mid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["household"] });
    qc.invalidateQueries({ queryKey: ["customer-household"] });
  };

  const updateMemberRole = async (mid: string, role: HouseholdRole) => {
    const { error } = await (supabase as any).from("household_members").update({ role }).eq("id", mid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["household"] });
  };

  const setPrimaryMember = async (mid: string) => {
    if (!household?.id) return;
    // Clear existing primary, then set this one (two-step to satisfy partial-unique idx)
    await (supabase as any).from("household_members").update({ is_primary: false }).eq("household_id", household.id);
    const { error } = await (supabase as any).from("household_members").update({ is_primary: true }).eq("id", mid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["household"] });
  };

  const removeRelation = async (rid: string, relType: RelationType, relatedId: string) => {
    if (!confirm("Beziehung entfernen?")) return;
    const { error } = await (supabase as any).from("customer_relations").delete().eq("id", rid);
    if (error) { toast.error(error.message); return; }
    // Trigger spiegelt Löschung automatisch
    qc.invalidateQueries({ queryKey: ["customer-relations"] });
  };

  const joinExistingHousehold = async () => {
    if (!joinHouseholdId) return;
    const { error } = await (supabase as any).from("household_members").insert({
      household_id: joinHouseholdId,
      customer_id: customerId,
      role: "sonstiges",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Haushalt beigetreten");
    setJoinPickerOpen(false); setJoinHouseholdId(null);
    qc.invalidateQueries({ queryKey: ["customer-household", customerId] });
    qc.invalidateQueries({ queryKey: ["household"] });
  };

  const updateReferralStatus = async (status: string) => {
    const { error } = await supabase
      .from("customers")
      .update({
        referral_status: status as any,
        referral_paid_at: status === "ausgezahlt" ? new Date().toISOString().slice(0, 10) : null,
      } as any)
      .eq("id", customerId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["customer", customerId] });
  };

  const householdRoleLabel = (r: HouseholdRole) => HOUSEHOLD_ROLES.find((x) => x.value === r)?.label ?? r;

  return (
    <div className="space-y-4">
      {/* ============ HOUSEHOLD ============ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" /> Haushalt</CardTitle>
          {!household && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setJoinPickerOpen((v) => !v)}>Beitreten</Button>
              <Button size="sm" onClick={() => setHouseholdDlg({ open: true, edit: null })}>
                <Plus className="h-4 w-4 mr-1" />Haushalt anlegen
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!household && joinPickerOpen && (
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <div className="text-sm font-medium">Existierendem Haushalt beitreten</div>
              <ExistingHouseholdPicker value={joinHouseholdId} onChange={setJoinHouseholdId} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setJoinPickerOpen(false); setJoinHouseholdId(null); }}>Abbrechen</Button>
                <Button size="sm" onClick={joinExistingHousehold} disabled={!joinHouseholdId}>Beitreten</Button>
              </div>
            </div>
          )}

          {!household && !joinPickerOpen && (
            <p className="text-sm text-muted-foreground">Dieser Kunde ist keinem Haushalt zugeordnet.</p>
          )}

          {household && (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{household.name}</div>
                  {(household.street || household.city) && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[household.street, household.house_no].filter(Boolean).join(" ")}
                      {(household.street || household.house_no) && (household.postal_code || household.city) && ", "}
                      {[household.postal_code, household.city].filter(Boolean).join(" ")}
                    </div>
                  )}
                  {household.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{household.notes}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setHouseholdDlg({ open: true, edit: household })}>
                    <Pencil className="h-4 w-4 mr-1" />Bearbeiten
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMemberDlg(true)}>
                    <Plus className="h-4 w-4 mr-1" />Mitglied
                  </Button>
                  <Button size="sm" variant="ghost" onClick={leaveHousehold}>
                    <LogOut className="h-4 w-4 mr-1" />Verlassen
                  </Button>
                </div>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mitglieder</div>
                {(householdMembers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Keine Mitglieder.</p>
                )}
                {(householdMembers ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {m.customer?.id === customerId ? (
                        <span className="font-medium truncate">{customerLabel(m.customer)}</span>
                      ) : (
                        <Link
                          to="/kunden/$id" params={{ id: m.customer?.id }}
                          className="font-medium hover:underline truncate"
                        >
                          {customerLabel(m.customer)}
                        </Link>
                      )}
                      {m.is_primary && <Badge variant="outline" className="text-xs">Hauptkontakt</Badge>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Select value={m.role} onValueChange={(v) => updateMemberRole(m.id, v as HouseholdRole)}>
                        <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOUSEHOLD_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!m.is_primary && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPrimaryMember(m.id)}>
                          Zum Hauptkontakt
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ RELATIONS ============ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Beziehungen</CardTitle>
          <Button size="sm" onClick={() => setRelationDlg(true)}>
            <Plus className="h-4 w-4 mr-1" />Beziehung
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(relations ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Beziehungen erfasst.</p>
          )}
          {(relations ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{relationLabel(r.relation_type as RelationType)}</Badge>
                  <Link to="/kunden/$id" params={{ id: r.related?.id }} className="font-medium hover:underline truncate">
                    {customerLabel(r.related)}
                  </Link>
                </div>
                {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRelation(r.id, r.relation_type, r.related?.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ============ REFERRAL ============ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Empfehlung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Geworben durch</div>
            {referrer ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Link to="/kunden/$id" params={{ id: referrer.id }} className="font-medium hover:underline">
                  {customerLabel(referrer)}
                </Link>
                {(customer as any).referral_bonus_amount != null && (
                  <Badge variant="outline">Prämie: {Number((customer as any).referral_bonus_amount).toFixed(2)} €</Badge>
                )}
                {(customer as any).referral_status && (
                  <Select value={(customer as any).referral_status} onValueChange={updateReferralStatus}>
                    <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offen">Offen</SelectItem>
                      <SelectItem value="zugesagt">Zugesagt</SelectItem>
                      <SelectItem value="ausgezahlt">Ausgezahlt</SelectItem>
                      <SelectItem value="storniert">Storniert</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {(customer as any).referral_paid_at && (
                  <span className="text-xs text-muted-foreground">ausgezahlt am {(customer as any).referral_paid_at}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nicht über eine Empfehlung gewonnen. (Beim Bearbeiten festlegen.)</p>
            )}
            {(customer as any).referral_notes && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{(customer as any).referral_notes}</p>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
              <Users className="h-3 w-3" /> Von diesem Kunden geworben
            </div>
            {(referredCustomers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Empfehlungen.</p>
            ) : (
              <div className="space-y-1">
                {(referredCustomers ?? []).map((rc: any) => (
                  <div key={rc.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                    <Link to="/kunden/$id" params={{ id: rc.id }} className="font-medium hover:underline truncate">
                      {customerLabel(rc)}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {rc.referral_bonus_amount != null && (
                        <span className="text-xs text-muted-foreground">{Number(rc.referral_bonus_amount).toFixed(2)} €</span>
                      )}
                      {rc.referral_status && (
                        <Badge variant={rc.referral_status === "ausgezahlt" ? "default" : "outline"} className="text-xs">
                          {rc.referral_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <HouseholdDialog
        open={householdDlg.open}
        onOpenChange={(o) => setHouseholdDlg({ open: o, edit: o ? householdDlg.edit : null })}
        household={householdDlg.edit}
        initialFromCustomer={!householdDlg.edit ? customer : undefined}
        onSaved={async (hid) => {
          if (!householdDlg.edit && !household) {
            // Auto-add this customer as primary
            await (supabase as any).from("household_members").insert({
              household_id: hid,
              customer_id: customerId,
              role: "hauptperson",
              is_primary: true,
            });
            qc.invalidateQueries({ queryKey: ["customer-household", customerId] });
            qc.invalidateQueries({ queryKey: ["household"] });
          }
        }}
      />
      {household && (
        <HouseholdMemberDialog
          open={memberDlg}
          onOpenChange={setMemberDlg}
          householdId={household.id}
          existingMemberIds={existingMemberIds}
        />
      )}
      <RelationDialog
        open={relationDlg}
        onOpenChange={setRelationDlg}
        customerId={customerId}
        excludeIds={(relations ?? []).map((r: any) => r.related?.id).filter(Boolean)}
      />
    </div>
  );
}

function ExistingHouseholdPicker({
  value, onChange,
}: { value: string | null; onChange: (id: string | null) => void }) {
  const { data: households } = useQuery({
    queryKey: ["households-list"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("households")
        .select("id, name, postal_code, city")
        .order("name", { ascending: true });
      return data ?? [];
    },
  });
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Haushalt wählen…" /></SelectTrigger>
      <SelectContent>
        {(households ?? []).map((h: any) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name} {(h.postal_code || h.city) && <span className="text-muted-foreground">— {h.postal_code} {h.city}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
