import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type RelationType =
  | "ehepartner" | "elternteil" | "kind" | "geschwister"
  | "verwandt" | "wg" | "freund" | "empfehlung_quelle" | "sonstiges";

export const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: "ehepartner", label: "Ehepartner/in" },
  { value: "elternteil", label: "Elternteil" },
  { value: "kind", label: "Kind" },
  { value: "geschwister", label: "Geschwister" },
  { value: "verwandt", label: "Verwandt" },
  { value: "wg", label: "WG-Mitbewohner/in" },
  { value: "freund", label: "Freund/Bekannte" },
  { value: "empfehlung_quelle", label: "Empfehlung" },
  { value: "sonstiges", label: "Sonstiges" },
];

export const relationLabel = (t: RelationType) =>
  RELATION_TYPES.find((r) => r.value === t)?.label ?? t;

export function RelationDialog({
  open,
  onOpenChange,
  customerId,
  excludeIds = [],
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  customerId: string;
  excludeIds?: string[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [related, setRelated] = useState<string | null>(null);
  const [type, setType] = useState<RelationType>("verwandt");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setRelated(null); setType("verwandt"); setNotes(""); }
  }, [open]);

  const submit = async () => {
    if (!user) return;
    if (!related) { toast.error("Bitte einen Kunden auswählen."); return; }
    setSubmitting(true);
    const res = await (supabase as any).from("customer_relations").insert({
      customer_id: customerId,
      related_customer_id: related,
      relation_type: type,
      notes: notes || null,
      created_by: user.id,
    });
    setSubmitting(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Beziehung angelegt");
    qc.invalidateQueries({ queryKey: ["customer-relations"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Beziehung hinzufügen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Verknüpfter Kunde *</Label>
            <CustomerCombobox value={related} onChange={setRelated} excludeIds={[customerId, ...excludeIds]} />
          </div>
          <div className="space-y-1">
            <Label>Art der Beziehung</Label>
            <Select value={type} onValueChange={(v) => setType(v as RelationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notiz (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Die Beziehung wird automatisch auf beiden Kundenseiten angezeigt.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Speichern…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
