import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type HouseholdRole = "hauptperson" | "partner" | "kind" | "elternteil" | "wg_mitbewohner" | "sonstiges";

export const HOUSEHOLD_ROLES: { value: HouseholdRole; label: string }[] = [
  { value: "hauptperson", label: "Hauptperson" },
  { value: "partner", label: "Partner/in" },
  { value: "kind", label: "Kind" },
  { value: "elternteil", label: "Elternteil" },
  { value: "wg_mitbewohner", label: "WG-Mitbewohner/in" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function HouseholdMemberDialog({
  open,
  onOpenChange,
  householdId,
  existingMemberIds = [],
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  householdId: string;
  existingMemberIds?: string[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [role, setRole] = useState<HouseholdRole>("sonstiges");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerId(null);
      setRole("sonstiges");
      setIsPrimary(false);
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!user) return;
    if (!customerId) { toast.error("Bitte einen Kunden auswählen."); return; }
    setSubmitting(true);
    const res = await (supabase as any).from("household_members").insert({
      household_id: householdId,
      customer_id: customerId,
      role,
      is_primary: isPrimary,
    });
    setSubmitting(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Mitglied hinzugefügt");
    qc.invalidateQueries({ queryKey: ["household"] });
    qc.invalidateQueries({ queryKey: ["customer-household"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mitglied hinzufügen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Kunde *</Label>
            <CustomerCombobox value={customerId} onChange={setCustomerId} excludeIds={existingMemberIds} />
          </div>
          <div className="space-y-1">
            <Label>Rolle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as HouseholdRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOUSEHOLD_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Hauptkontakt</Label>
              <p className="text-xs text-muted-foreground">Nur eine Person pro Haushalt.</p>
            </div>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
          {notes && (
            <div className="space-y-1">
              <Label>Notizen</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Speichern…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
