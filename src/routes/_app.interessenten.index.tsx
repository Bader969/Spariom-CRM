import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { formatDate, leadSourceLabel, LEAD_SOURCES, whatsappLink, getPersonalityMeta, PERSONALITY_TYPES } from "@/lib/crm-types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/interessenten/")({
  component: InteressentenList,
});

const getSavedInteressentenFilter = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem("crm-filters-interessenten");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[key] !== undefined) return parsed[key];
    }
  } catch {}
  return fallback;
};

function InteressentenList() {
  const { user } = useAuth();
  const [q, setQ] = useState<string>(() => getSavedInteressentenFilter("q", ""));
  const [source, setSource] = useState<string>(() => getSavedInteressentenFilter("source", "__all"));
  const [besitzer, setBesitzer] = useState<string>(() => getSavedInteressentenFilter("besitzer", "__all"));
  const [erfasser, setErfasser] = useState<string>(() => getSavedInteressentenFilter("erfasser", "__all"));
  const [personalityFilter, setPersonalityFilter] = useState<string>(() => getSavedInteressentenFilter("personalityFilter", "__all"));
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Save filter changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("crm-filters-interessenten", JSON.stringify({
      q, source, besitzer, erfasser, personalityFilter
    }));
  }, [q, source, besitzer, erfasser, personalityFilter]);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("interessenten-scroll");
    if (savedScroll && tableContainerRef.current) {
      tableContainerRef.current.scrollTop = parseInt(savedScroll);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["interessenten", "list"],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone, email, lead_source, lead_source_detail, created_at, assigned_to, created_by, notes, personality_type")
        .eq("status", "interessent")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const cs = customers ?? [];
      const ids = Array.from(
        new Set(cs.flatMap((c: any) => [c.assigned_to, c.created_by]).filter(Boolean)),
      ) as string[];
      let pmap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        pmap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? p.email ?? "—"]));
      }
      return cs.map((c: any) => ({
        ...c,
        assigned_name: c.assigned_to ? pmap.get(c.assigned_to) ?? null : null,
        creator_name: c.created_by ? pmap.get(c.created_by) ?? null : null,
      }));
    },
  });

  const besitzerOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((c: any) => {
      if (c.assigned_to && c.assigned_name) map.set(c.assigned_to, c.assigned_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const erfasserOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((c: any) => {
      if (c.created_by && c.creator_name) map.set(c.created_by, c.creator_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtered = (data ?? []).filter((c: any) => {
    if (source !== "__all" && c.lead_source !== source) return false;
    if (besitzer === "__me" && c.assigned_to !== user?.id) return false;
    if (besitzer !== "__all" && besitzer !== "__me" && c.assigned_to !== besitzer) return false;
    if (erfasser === "__me" && c.created_by !== user?.id) return false;
    if (erfasser !== "__all" && erfasser !== "__me" && c.created_by !== erfasser) return false;
    if (personalityFilter !== "__all" && c.personality_type !== personalityFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(s) ||
      c.last_name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s) ||
      c.notes?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:px-8 space-y-4 max-w-[1600px] w-full">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Interessenten
            </h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"} — werden bei erstem Vertrag automatisch zu Kunden
            </p>
          </div>
          <Link to="/interessenten/neu">
            <Button><Plus className="h-4 w-4 mr-2" />Interessent erfassen</Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suche nach Name, Telefon, E-Mail…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Quellen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Alle Quellen</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={besitzer} onValueChange={setBesitzer}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Besitzer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Alle Besitzer</SelectItem>
              <SelectItem value="__me">Nur meine</SelectItem>
              {besitzerOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={erfasser} onValueChange={setErfasser}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Erfasser" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Alle Erfasser</SelectItem>
              <SelectItem value="__me">Von mir erfasst</SelectItem>
              {erfasserOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={personalityFilter} onValueChange={setPersonalityFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="DISG Typ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Alle DISG Typen</SelectItem>
              {PERSONALITY_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading && <p className="text-sm text-muted-foreground p-2">Wird geladen…</p>}

        {!isLoading && filtered.length === 0 && (
          <Card className="p-10 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">Noch keine Interessenten</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Erfasse einen Lead mit nur einer Handynummer — z. B. aus einer WhatsApp-Nachricht.
            </p>
            <Link to="/interessenten/neu">
              <Button><Plus className="h-4 w-4 mr-2" />Interessent erfassen</Button>
            </Link>
          </Card>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch h-full min-h-0">
            {/* Left Column: Leads Table */}
            <div className="xl:col-span-2 h-full min-h-0 flex flex-col">
              <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm">
                <div 
                  ref={tableContainerRef}
                  onScroll={(e) => sessionStorage.setItem("interessenten-scroll", String(e.currentTarget.scrollTop))}
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar"
                >
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-md border-b border-border/50 shadow-sm">
                      <tr className="text-left">
                        <th className="px-4 py-3.5 font-semibold">Name</th>
                        <th className="px-4 py-3.5 font-semibold">Kontakt</th>
                        <th className="px-4 py-3.5 font-semibold">Quelle</th>
                        <th className="px-4 py-3.5 font-semibold">Besitzer</th>
                        <th className="px-4 py-3.5 font-semibold">Erfasser</th>
                        <th className="px-4 py-3.5 font-semibold">Erfasst</th>
                        <th className="px-4 py-3.5 font-semibold text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filtered.map((c: any) => {
                        const hasName = c.first_name || c.last_name;
                        const pMeta = getPersonalityMeta(c.personality_type);
                        return (
                          <tr 
                            key={c.id} 
                            onClick={() => setSelectedLead(c)}
                            className={`cursor-pointer transition-colors ${selectedLead?.id === c.id ? "bg-primary/20 hover:bg-primary/30" : "hover:bg-accent/30"}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link 
                                  to="/kunden/$id" 
                                  params={{ id: c.id }} 
                                  search={{ from: "/interessenten" }}
                                  onClick={() => sessionStorage.setItem("last-list-origin", "/interessenten")}
                                  className="font-medium hover:underline"
                                >
                                  {hasName ? `${c.last_name ?? ""}${c.last_name && c.first_name ? ", " : ""}${c.first_name ?? ""}` : <span className="italic text-muted-foreground">— ohne Name —</span>}
                                </Link>
                                {pMeta && (
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${pMeta.badgeClass}`}>
                                    {pMeta.icon} {pMeta.label}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                                {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                                {!c.phone && !c.email && <span className="italic">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {c.lead_source ? (
                                <Badge variant="outline">{leadSourceLabel(c.lead_source)}</Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                              {c.lead_source_detail && (
                                <div className="text-xs text-muted-foreground mt-0.5">{c.lead_source_detail}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{c.assigned_name ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.creator_name ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} title="Anrufen">
                                    <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
                                  </a>
                                )}
                                {c.phone && (
                                  <a href={whatsappLink(c.phone, c.first_name ?? "")} target="_blank" rel="noreferrer" title="WhatsApp">
                                    <Button variant="ghost" size="icon"><MessageCircle className="h-4 w-4 text-green-600" /></Button>
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Right Sidebar - Quick Preview Pane */}
            <div className="xl:col-span-1 h-full min-h-0 flex flex-col">
              <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-primary/20 shadow-sm">
                <div className="p-3.5 px-4 border-b border-border/50 bg-muted/50 backdrop-blur-md shrink-0 flex items-center justify-between">
                  <h2 className="font-semibold text-base">Schnellansicht</h2>
                  <Badge variant="outline" className="border-primary/40 text-primary">Interessent</Badge>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {!selectedLead ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                      <Search className="h-8 w-8 opacity-20" />
                      <p className="text-sm">Wählen Sie einen Interessenten aus der Liste,<br/>um Details anzuzeigen.</p>
                    </div>
                  ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold">
                      {selectedLead.first_name || selectedLead.last_name 
                        ? `${selectedLead.first_name ?? ""} ${selectedLead.last_name ?? ""}`.trim()
                        : "— ohne Name —"}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {selectedLead.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedLead.phone}</div>}
                      {selectedLead.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {selectedLead.email}</div>}
                      {selectedLead.personality_type && (
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/40">
                          <span className="opacity-70 text-xs">DISG Typ:</span>
                          {(() => {
                            const pm = getPersonalityMeta(selectedLead.personality_type);
                            return pm ? (
                              <Badge variant="outline" className={`text-xs border ${pm.badgeClass}`}>
                                {pm.icon} {pm.label}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                        <span className="opacity-70">Quelle:</span> 
                        {selectedLead.lead_source ? leadSourceLabel(selectedLead.lead_source) : "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Besitzer:</span> {selectedLead.assigned_name ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedLead.phone && (
                      <a href={`tel:${selectedLead.phone}`} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm"><Phone className="h-4 w-4 mr-2" /> Anrufen</Button>
                      </a>
                    )}
                    {selectedLead.phone && (
                      <a href={whatsappLink(selectedLead.phone, selectedLead.first_name ?? "")} target="_blank" rel="noreferrer" className="flex-1">
                        <Button variant="outline" className="w-full" size="sm"><MessageCircle className="h-4 w-4 mr-2 text-green-600" /> WhatsApp</Button>
                      </a>
                    )}
                  </div>

                  <div className="pt-4 mt-auto">
                    <Link 
                      to="/kunden/$id" 
                      params={{ id: selectedLead.id }} 
                      search={{ from: "/interessenten" }}
                      onClick={() => sessionStorage.setItem("last-list-origin", "/interessenten")}
                      className="block"
                    >
                      <Button className="w-full">Zum vollständigen Profil</Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
