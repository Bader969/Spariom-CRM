import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clarificationCategoryMeta,
  clarificationStatusMeta,
  getUrgency,
  formatDate,
  type ClarificationStatus,
} from "@/lib/crm-types";
import { useAuth } from "@/lib/auth-context";
import { FileText, User, Pencil, Trash2, Clock } from "lucide-react";

type Props = {
  c: any;
  onEdit: (c: any) => void;
};

export function ClarificationCard({ c, onEdit }: Props) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const canEdit = role === "admin" || role === "haupt_vertriebler";
  const canDelete = role === "admin";

  const urgency = getUrgency(c.due_date, c.status);
  const statusMeta = clarificationStatusMeta(c.status);
  const catMeta = clarificationCategoryMeta(c.category);

  const setStatus = async (newStatus: ClarificationStatus) => {
    if (!canEdit) {
      toast.error("Nur Hauptvertriebler / Admin dürfen den Status ändern");
      return;
    }
    const patch: any = { status: newStatus };
    if (newStatus === "erledigt") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = user?.id ?? null;
    } else {
      patch.resolved_at = null;
      patch.resolved_by = null;
    }
    const { error } = await supabase.from("clarifications").update(patch).eq("id", c.id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["clarifications"] }); toast.success("Status aktualisiert"); }
  };

  const del = async () => {
    if (!confirm("Klärfall wirklich löschen?")) return;
    const { error } = await supabase.from("clarifications").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["clarifications"] }); toast.success("Gelöscht"); }
  };

  return (
    <Card
      className={`border-l-4 ${urgency.borderClass} ${statusMeta.bgClass} transition-colors ${
        c.status === "erledigt" ? "opacity-70" : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">{catMeta.icon} {catMeta.label}</Badge>
              <Badge className={`text-xs ${urgency.badgeClass}`}>
                <Clock className="h-3 w-3 mr-1" />{urgency.label}
              </Badge>
            </div>
            <div className={`font-semibold ${c.status === "erledigt" ? "line-through" : ""}`}>{c.title}</div>
            {c.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.description}</p>}
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={del}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {c.customers && (
            <Link
              to="/kunden/$id"
              params={{ id: c.customer_id }}
              search={{ from: "/klaerfaelle" }}
              onClick={() => sessionStorage.setItem("last-list-origin", "/klaerfaelle")}
              className="inline-flex items-center gap-1 hover:underline hover:text-foreground"
            >
              <User className="h-3 w-3" />
              {c.customers.first_name} {c.customers.last_name}
            </Link>
          )}
          {c.contracts && c.customer_id && (
            <Link
              to="/kunden/$id"
              params={{ id: c.customer_id }}
              search={{ contract: c.contract_id, from: "/klaerfaelle" }}
              onClick={() => sessionStorage.setItem("last-list-origin", "/klaerfaelle")}
              className="inline-flex items-center gap-1 hover:underline hover:text-foreground"
            >
              <FileText className="h-3 w-3" />
              {c.contracts.provider || c.contracts.type}
            </Link>
          )}
          {c.due_date && (
            <span className="inline-flex items-center gap-1">
              Fällig: {formatDate(c.due_date)}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1 border-t">
          {(["offen", "wartend", "erledigt"] as ClarificationStatus[]).map((s) => {
            const meta = clarificationStatusMeta(s);
            const active = c.status === s;
            return (
              <Button
                key={s}
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={!canEdit}
                onClick={() => setStatus(s)}
                className={active ? meta.activeClass : ""}
                title={canEdit ? `Status auf "${meta.label}" setzen` : "Nur Hauptvertriebler / Admin"}
              >
                {meta.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
