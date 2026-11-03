import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { LEAD_SOURCES, PERSONALITY_TYPES } from "@/lib/crm-types";
import { toast } from "sonner";
import { CustomerCombobox } from "@/components/CustomerCombobox";

export type CustomerFormValues = {
  salutation: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  phone: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  assigned_to: string;
  team_id: string;
  recorded_by: string;
  advisor_id: string;
  lead_source: string;
  lead_source_detail: string;
  notes: string;
  referred_by_customer_id: string;
  referral_bonus_amount: string;
  referral_status: string;
  referral_paid_at: string;
  referral_notes: string;
  personality_type: string;
};

export const emptyCustomerForm = (userId?: string): CustomerFormValues => ({
  salutation: "", first_name: "", last_name: "", birthdate: "",
  phone: "", email: "",
  street: "", zip: "", city: "",
  assigned_to: userId ?? "", team_id: "",
  recorded_by: userId ?? "", advisor_id: userId ?? "",
  lead_source: "", lead_source_detail: "",
  notes: "",
  referred_by_customer_id: "",
  referral_bonus_amount: "",
  referral_status: "",
  referral_paid_at: "",
  referral_notes: "",
  personality_type: "",
});

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel = "Speichern",
  submitting = false,
  requireName = true,
}: {
  initial: CustomerFormValues;
  onSubmit: (v: CustomerFormValues) => void | Promise<void>;
  submitLabel?: string;
  submitting?: boolean;
  requireName?: boolean;
}) {
  const [f, setF] = useState<CustomerFormValues>(initial);
  const set = <K extends keyof CustomerFormValues>(k: K, v: CustomerFormValues[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const { data: staff } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("active", true);
      return data ?? [];
    },
  });
  const { data: owners } = useQuery({
    queryKey: ["owners-admin-haupt"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "haupt_vertriebler"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [] as any[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return profs ?? [];
    },
  });
  const { data: teams } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => (await supabase.from("teams").select("id, name")).data ?? [],
  });

  const submit = async () => {
    if (requireName && (!f.first_name || !f.last_name)) {
      toast.error("Vorname und Nachname sind Pflicht");
      return;
    }
    if (!requireName && !f.first_name && !f.last_name && !f.phone && !f.email) {
      toast.error("Mindestens Telefon, E-Mail oder Name angeben");
      return;
    }
    if (!f.assigned_to) {
      toast.error("Bitte einen Besitzer (Hauptvertriebler/Admin) auswählen");
      return;
    }
    await onSubmit(f);
  };


  return (
    <div className="space-y-6">
      <Section title="Persönlich">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Anrede</Label>
            <Select value={f.salutation} onValueChange={(v) => set("salutation", v)}>
              <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Herr">Herr</SelectItem>
                <SelectItem value="Frau">Frau</SelectItem>
                <SelectItem value="Divers">Divers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Geburtsdatum</Label>
            <Input type="date" value={f.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Vorname {requireName && "*"}</Label>
            <Input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nachname {requireName && "*"}</Label>
            <Input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </div>
        </div>

      </Section>

      <Section title="Kontakt">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 170 …" />
          </div>
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Adresse">
        <div className="space-y-2">
          <Label>Straße und Hausnummer</Label>
          <Input value={f.street} onChange={(e) => set("street", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>PLZ</Label>
            <Input value={f.zip} onChange={(e) => set("zip", e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Ort</Label>
            <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Zuweisung & Herkunft">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Erfasser</Label>
            <Select value={f.recorded_by} onValueChange={(v) => set("recorded_by", v)}>
              <SelectTrigger><SelectValue placeholder="Wer hat den Kunden angelegt?" /></SelectTrigger>
              <SelectContent>
                {(staff ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Berater</Label>
            <Select value={f.advisor_id} onValueChange={(v) => set("advisor_id", v)}>
              <SelectTrigger><SelectValue placeholder="Wer berät den Kunden?" /></SelectTrigger>
              <SelectContent>
                {(staff ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Besitzer (Hauptvertriebler/Admin) *</Label>
            <Select value={f.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
              <SelectTrigger><SelectValue placeholder="Besitzer auswählen…" /></SelectTrigger>
              <SelectContent>
                {(owners ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Der Kunde gehört diesem Hauptvertriebler/Admin.</p>
          </div>
          <div className="space-y-2">
            <Label>Team (optional)</Label>
            <Select value={f.team_id || "__none"} onValueChange={(v) => set("team_id", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Kein Team" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Kein Team</SelectItem>
                {(teams ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Wie auf uns aufmerksam geworden?</Label>
            <Select value={f.lead_source} onValueChange={(v) => set("lead_source", v)}>
              <SelectTrigger><SelectValue placeholder="Quelle auswählen…" /></SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Detail zur Quelle (z. B. Empfehler, Kampagne)</Label>
            <Input value={f.lead_source_detail} onChange={(e) => set("lead_source_detail", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notizen</Label>
          <Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </Section>

      <Section title="DISG-Persönlichkeitstyp">
        <div className="space-y-2">
          <Label>Verhaltenstyp im Kundenkontakt</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PERSONALITY_TYPES.map((p) => {
              const selected = f.personality_type === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("personality_type", selected ? "" : p.value)}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                    selected
                      ? `${p.bgLight} ${p.borderColor} ring-2 ring-primary font-medium`
                      : "border-border hover:bg-accent/40 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-base">{p.icon}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${p.badgeClass}`}>
                      {p.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                    {p.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Empfehlung">
        <div className="space-y-2">
          <Label>Geworben durch (Bestandskunde)</Label>
          <CustomerCombobox
            value={f.referred_by_customer_id || null}
            onChange={(id) => set("referred_by_customer_id", id ?? "")}
            allowClear
            placeholder="Kunden suchen, der empfohlen hat…"
          />
        </div>
        {f.referred_by_customer_id && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prämie (€)</Label>
                <Input type="number" step="0.01" value={f.referral_bonus_amount} onChange={(e) => set("referral_bonus_amount", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={f.referral_status || undefined} onValueChange={(v) => set("referral_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offen">Offen</SelectItem>
                    <SelectItem value="zugesagt">Zugesagt</SelectItem>
                    <SelectItem value="ausgezahlt">Ausgezahlt</SelectItem>
                    <SelectItem value="storniert">Storniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ausgezahlt am</Label>
                <Input type="date" value={f.referral_paid_at} onChange={(e) => set("referral_paid_at", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notiz zur Empfehlung</Label>
              <Textarea rows={2} value={f.referral_notes} onChange={(e) => set("referral_notes", e.target.value)} />
            </div>
          </>
        )}
      </Section>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting}>{submitting ? "Speichern…" : submitLabel}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function buildCustomerPayload(f: CustomerFormValues, currentUserId: string) {
  return {
    salutation: f.salutation || null,
    first_name: f.first_name,
    last_name: f.last_name,
    birthdate: f.birthdate || null,
    phone: f.phone || null,
    email: f.email || null,
    street: f.street || null,
    zip: f.zip || null,
    city: f.city || null,
    assigned_to: f.assigned_to || currentUserId,
    team_id: f.team_id || null,
    recorded_by: f.recorded_by || currentUserId,
    advisor_id: f.advisor_id || null,
    lead_source: f.lead_source || null,
    lead_source_detail: f.lead_source_detail || null,
    notes: f.notes || null,
    referred_by_customer_id: f.referred_by_customer_id || null,
    referral_bonus_amount: f.referral_bonus_amount ? Number(f.referral_bonus_amount) : null,
    referral_status: f.referral_status || null,
    referral_paid_at: f.referral_paid_at || null,
    referral_notes: f.referral_notes || null,
    personality_type: f.personality_type || null,
  };
}
