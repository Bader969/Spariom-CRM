import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type HouseholdRecord = {
  id: string;
  name: string;
  street: string | null;
  house_no: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
};

export function HouseholdDialog({
  open,
  onOpenChange,
  household,
  initialFromCustomer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  household?: HouseholdRecord | null;
  initialFromCustomer?: {
    first_name?: string | null;
    last_name?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
  };
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!household;

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (household) {
      setName(household.name ?? "");
      setStreet(household.street ?? "");
      setHouseNo(household.house_no ?? "");
      setZip(household.postal_code ?? "");
      setCity(household.city ?? "");
      setNotes(household.notes ?? "");
    } else {
      const lastName = initialFromCustomer?.last_name ?? "";
      const addr = initialFromCustomer?.street ?? "";
      setName(lastName ? `Haushalt ${lastName}${addr ? `, ${addr}` : ""}` : "");
      setStreet(addr ?? "");
      setHouseNo("");
      setZip(initialFromCustomer?.zip ?? "");
      setCity(initialFromCustomer?.city ?? "");
      setNotes("");
    }
  }, [open, household, initialFromCustomer]);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Bitte einen Namen für den Haushalt angeben.");
      return;
    }
    setSubmitting(true);
    const payload: any = {
      name: name.trim(),
      street: street || null,
      house_no: houseNo || null,
      postal_code: zip || null,
      city: city || null,
      notes: notes || null,
    };
    const res = isEdit
      ? await (supabase as any).from("households").update(payload).eq("id", household!.id).select("id").maybeSingle()
      : await (supabase as any).from("households").insert({ ...payload, created_by: user.id }).select("id").maybeSingle();
    setSubmitting(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(isEdit ? "Haushalt aktualisiert" : "Haushalt angelegt");
    qc.invalidateQueries({ queryKey: ["households"] });
    qc.invalidateQueries({ queryKey: ["household"] });
    onOpenChange(false);
    onSaved?.(res.data!.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Haushalt bearbeiten" : "Neuen Haushalt anlegen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Haushalt Müller, Hauptstr. 12" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label>Straße</Label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hausnr.</Label>
              <Input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>PLZ</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Ort</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notizen</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Speichern…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
