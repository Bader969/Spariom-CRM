import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertCircle } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { ClarificationDialog } from "@/components/ClarificationDialog";
import { ClarificationCard } from "@/components/ClarificationCard";
import {
  CLARIFICATION_CATEGORIES,
  getUrgency,
  type ClarificationStatus,
} from "@/lib/crm-types";

type SearchParams = {
  status?: "alle" | "offen" | "wartend" | "erledigt" | "aktiv";
  urgency?: "alle" | "ueberfaellig" | "hoch" | "mittel" | "niedrig";
  category?: string;
  q?: string;
};

export const Route = createFileRoute("/_app/klaerfaelle")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    status: (typeof s.status === "string" ? s.status : "aktiv") as SearchParams["status"],
    urgency: (typeof s.urgency === "string" ? s.urgency : "alle") as SearchParams["urgency"],
    category: typeof s.category === "string" ? s.category : "alle",
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: ClarificationsPage,
});

function ClarificationsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<{ open: boolean; clarification: any | null }>({ open: false, clarification: null });
  const listRef = useRef<HTMLDivElement>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["clarifications", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clarifications")
        .select(`
          *,
          customers(id, first_name, last_name),
          contracts(id, type, provider)
        `)
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!isLoading && listRef.current) {
      const saved = sessionStorage.getItem("scroll-pos-klaerfaelle");
      if (saved) {
        const pos = parseInt(saved, 10);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = pos;
        });
      }
    }
  }, [isLoading]);

  const filtered = useMemo(() => {
    const list = items ?? [];
    return list
      .filter((c: any) => {
        if (search.status === "aktiv") return c.status !== "erledigt";
        if (search.status && search.status !== "alle") return c.status === search.status;
        return true;
      })
      .filter((c: any) => {
        if (!search.urgency || search.urgency === "alle") return true;
        const u = getUrgency(c.due_date, c.status);
        return u.key === search.urgency;
      })
      .filter((c: any) => {
        if (!search.category || search.category === "alle") return true;
        return c.category === search.category;
      })
      .filter((c: any) => {
        if (!search.q) return true;
        const q = search.q.toLowerCase();
        const name = c.customers ? `${c.customers.first_name} ${c.customers.last_name}`.toLowerCase() : "";
        return c.title.toLowerCase().includes(q) || name.includes(q);
      })
      .sort((a: any, b: any) => {
        const ua = getUrgency(a.due_date, a.status).rank;
        const ub = getUrgency(b.due_date, b.status).rank;
        if (ua !== ub) return ub - ua;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
  }, [items, search]);

  const setSearch = (patch: Partial<SearchParams>) => {
    navigate({ to: "/klaerfaelle", search: (prev: any) => ({ ...prev, ...patch }), replace: true });
  };

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      offen: list.filter((c: any) => c.status === "offen").length,
      wartend: list.filter((c: any) => c.status === "wartend").length,
      erledigt: list.filter((c: any) => c.status === "erledigt").length,
      ueberfaellig: list.filter((c: any) => getUrgency(c.due_date, c.status).key === "ueberfaellig").length,
    };
  }, [items]);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4 w-full max-w-[1920px]">
      <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-warning" />
            Klärfälle
          </h1>
          <p className="text-sm text-muted-foreground">
            Offene Rückfragen von Anbietern/Versicherungen — sortiert nach Dringlichkeit
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, clarification: null })}>
          <Plus className="h-4 w-4 mr-2" />Neuer Klärfall
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <StatChip label="Offen" value={counts.offen} />
        <StatChip label="Wartend" value={counts.wartend} />
        <StatChip label="Erledigt" value={counts.erledigt} />
        <StatChip label="Überfällig" value={counts.ueberfaellig} highlight />
      </div>

      <Card className="shrink-0">
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-4">
            <Input
              placeholder="Suchen (Titel / Kunde)…"
              value={search.q ?? ""}
              onChange={(e) => setSearch({ q: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Select value={search.status} onValueChange={(v) => setSearch({ status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aktiv">Aktiv (Offen + Wartend)</SelectItem>
                <SelectItem value="offen">Nur Offen</SelectItem>
                <SelectItem value="wartend">Nur Wartend</SelectItem>
                <SelectItem value="erledigt">Erledigt</SelectItem>
                <SelectItem value="alle">Alle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={search.urgency} onValueChange={(v) => setSearch({ urgency: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Dringlichkeiten</SelectItem>
                <SelectItem value="ueberfaellig">Überfällig</SelectItem>
                <SelectItem value="hoch">Hoch (0–2 T)</SelectItem>
                <SelectItem value="mittel">Mittel (3–7 T)</SelectItem>
                <SelectItem value="niedrig">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={search.category} onValueChange={(v) => setSearch({ category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {CLARIFICATION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div 
        ref={listRef}
        onScroll={(e) => sessionStorage.setItem("scroll-pos-klaerfaelle", String(e.currentTarget.scrollTop))}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-4"
      >
        {isLoading && <div className="p-6 text-muted-foreground">Wird geladen…</div>}
        {!isLoading && filtered.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">Keine Klärfälle gefunden.</CardContent></Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c: any) => (
            <ClarificationCard key={c.id} c={c} onEdit={(cl) => setDialog({ open: true, clarification: cl })} />
          ))}
        </div>
      </div>

      <ClarificationDialog
        key={dialog.clarification?.id ?? "new"}
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o, clarification: o ? dialog.clarification : null })}
        clarification={dialog.clarification}
      />
    </div>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight && value > 0 ? "border-destructive/50" : ""}>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${highlight && value > 0 ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
