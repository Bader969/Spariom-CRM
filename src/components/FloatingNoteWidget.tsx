import { useState, useEffect } from "react";
import { StickyNote, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function FloatingNoteWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<"notiz" | "anruf">("anruf");
  const [submitting, setSubmitting] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers", "minimal"],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name")
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!customerId || !content.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("customer_notes").insert({
      customer_id: customerId,
      author_id: user.id,
      content: content.trim(),
      note_type: noteType,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Notiz konnte nicht gespeichert werden", { description: error.message });
      return;
    }
    toast.success("Notiz gespeichert");
    setContent("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all grid place-items-center"
        title="Schnellnotiz"
      >
        {open ? <X className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
      </button>

      {open && (
        <Card className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-[340px] z-40 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Schnellnotiz</h3>
            <span className="text-xs text-muted-foreground">Aktiver Anruf</span>
          </div>
          <div className="space-y-3">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.last_name}, {c.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={noteType} onValueChange={(v) => setNoteType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anruf">Anruf</SelectItem>
                <SelectItem value="notiz">Notiz</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Was wurde besprochen? Nächste Schritte?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <Button onClick={submit} disabled={!customerId || !content.trim() || submitting} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
