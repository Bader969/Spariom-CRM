import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CLARIFICATION_CATEGORIES, contractTypeLabel } from "@/lib/crm-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCustomerId?: string | null;
  defaultContractId?: string | null;
  clarification?: any | null;
};

export function ClarificationDialog({ open, onOpenChange, defaultCustomerId, defaultContractId, clarification }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!clarification;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("sonstiges");
  const [dueDate, setDueDate] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(clarification?.title ?? "");
    setDescription(clarification?.description ?? "");
    setCategory(clarification?.category ?? "sonstiges");
    setDueDate(clarification?.due_date ?? "");
    setCustomerId(clarification?.customer_id ?? defaultCustomerId ?? "");
    setContractId(clarification?.contract_id ?? defaultContractId ?? "");
  }, [open, clarification, defaultCustomerId, defaultContractId]);

  const { data: customers } = useQuery({
    queryKey: ["customers", "minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, first_name, last_name").order("last_name");
      return data ?? [];
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts", "for-customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, type, provider")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      due_date: dueDate || null,
      customer_id: customerId || null,
      contract_id: contractId || null,
    };
    let error;
    if (isEdit) {
      ({ error } = await supabase.from("clarifications").update(payload).eq("id", clarification.id));
    } else {
      payload.created_by = user.id;
      payload.assigned_to = user.id;
      ({ error } = await supabase.from("clarifications").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Klärfall aktualisiert" : "Klärfall angelegt");
    qc.invalidateQueries({ queryKey: ["clarifications"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Klärfall bearbeiten" : "Neuer Klärfall"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titel *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Zählerstand nachreichen" />
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLARIFICATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fällig bis</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Kunde</Label>
            <Select value={customerId || "_none"} onValueChange={(v) => { setCustomerId(v === "_none" ? "" : v); setContractId(""); }}>
              <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Kein Kunde —</SelectItem>
                {(customers ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.last_name}, {c.first_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {customerId && (
            <div>
              <Label>Vertrag (optional)</Label>
              <Select value={contractId || "_none"} onValueChange={(v) => setContractId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Vertrag wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Kein Vertrag —</SelectItem>
                  {(contracts ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contractTypeLabel(c.type)}{c.provider ? ` – ${c.provider}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving ? "Speichern…" : isEdit ? "Speichern" : "Anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
