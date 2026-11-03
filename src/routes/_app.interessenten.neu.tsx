import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES } from "@/lib/crm-types";

export const Route = createFileRoute("/_app/interessenten/neu")({
  component: NewInteressent,
});

function NewInteressent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [leadSource, setLeadSource] = useState("whatsapp");
  const [leadSourceDetail, setLeadSourceDetail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!user) return;
    if (!phone.trim() && !email.trim() && !firstName.trim() && !lastName.trim()) {
      toast.error("Mindestens Telefon, E-Mail oder Name angeben");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        status: "interessent",
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        lead_source: leadSource || null,
        lead_source_detail: leadSourceDetail.trim() || null,
        notes: notes.trim() || null,
        assigned_to: user.id,
        created_by: user.id,
        recorded_by: user.id,
      } as any)
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error("Interessent konnte nicht angelegt werden", { description: error.message });
      return;
    }
    toast.success("Interessent angelegt");
    navigate({ to: "/kunden/$id", params: { id: data.id } });
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/interessenten" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Neuer Interessent
          </h1>
          <p className="text-sm text-muted-foreground">
            Schnellerfassung — eines von Telefon, E-Mail oder Name reicht.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Telefon / Handynummer</Label>
            <Input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 170 …"
              className="text-base h-11"
            />
            <p className="text-xs text-muted-foreground">Tipp: gleich mit Ländercode speichern (WhatsApp-tauglich).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vorname (optional)</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nachname (optional)</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>E-Mail (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quelle</Label>
              <Select value={leadSource} onValueChange={setLeadSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Detail (optional)</Label>
              <Input value={leadSourceDetail} onChange={(e) => setLeadSourceDetail(e.target.value)} placeholder="z. B. Empfehler-Name" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Was wurde besprochen? Worum geht es?"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/interessenten">
          <Button variant="outline">Abbrechen</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Speichern…" : "Interessent speichern"}
        </Button>
      </div>
    </div>
  );
}
