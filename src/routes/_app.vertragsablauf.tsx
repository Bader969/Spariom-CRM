import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  contractTypeIcon, contractTypeLabel, contractStatusMeta,
  formatDate, formatDuration, daysUntil, expireOverdueContracts,
  getExpiryBucket, EXPIRY_BUCKETS, type ExpiryBucket,
} from "@/lib/crm-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlarmClock, ShieldAlert, BarChart3, TrendingDown, Phone,
  Layers, AlertTriangle, CalendarClock, CheckCircle2, CalendarRange, History,
  Filter, Building2
} from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  bucket: fallback(
    z.enum(["alle", "rot", "orange", "gelb", "gruen", "abgelaufen", "neutral"]),
    "alle",
  ).default("alle"),
  herkunft: fallback(z.enum(["alle", "eigen", "fremd"]), "alle").default("alle"),
});

export const Route = createFileRoute("/_app/vertragsablauf")({
  validateSearch: zodValidator(searchSchema),
  component: VertragsablaufPage,
});

function VertragsablaufPage() {
  const { bucket, herkunft } = Route.useSearch();
  const navigate = Route.useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    expireOverdueContracts(supabase);
  }, []);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", "vertragsablauf"],
    queryFn: async () => {
      let allContracts: any[] = [];
      let page = 0;
      while (true) {
        const { data: chunk, error } = await supabase
          .from("contracts")
          .select("id, type, status, provider, end_date, customer_id, is_fremdvertrag, fremd_quelle, customers(first_name,last_name)")
          .order("end_date", { ascending: true, nullsFirst: false })
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        allContracts = allContracts.concat(chunk);
        if (chunk.length < 1000) break;
        page++;
      }
      return allContracts;
    },
  });

  const { data: familyMembers } = useQuery({
    queryKey: ["family_members", "vertragsablauf"],
    queryFn: async () => {
      let allFM: any[] = [];
      let page = 0;
      while (true) {
        const { data: chunk, error } = await (supabase as any)
          .from("contract_family_members")
          .select("id, contract_id, relation, first_name, last_name")
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) break;
        if (!chunk || chunk.length === 0) break;
        allFM = allFM.concat(chunk);
        if (chunk.length < 1000) break;
        page++;
      }
      return allFM;
    },
  });

  const familyMap = useMemo(() => {
    const map = new Map<string, any[]>();
    (familyMembers ?? []).forEach((m: any) => {
      if (!map.has(m.contract_id)) map.set(m.contract_id, []);
      map.get(m.contract_id)!.push(m);
    });
    return map;
  }, [familyMembers]);

  useEffect(() => {
    if (!isLoading && listRef.current) {
      const saved = sessionStorage.getItem("scroll-pos-vertragsablauf");
      if (saved) {
        const pos = parseInt(saved, 10);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = pos;
        });
      }
    }
  }, [isLoading]);

  const enriched = useMemo(
    () => (contracts ?? []).map((c: any) => ({
      ...c,
      _bucket: getExpiryBucket(c.end_date, c.status),
      _days: daysUntil(c.end_date),
    })),
    [contracts],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: enriched.length };
    EXPIRY_BUCKETS.forEach((b) => (c[b.key] = 0));
    enriched.forEach((row: any) => {
      c[row._bucket.key] = (c[row._bucket.key] ?? 0) + 1;
    });
    return c;
  }, [enriched]);

  const herkunftCounts = useMemo(() => ({
    alle: enriched.length,
    eigen: enriched.filter((c: any) => !c.is_fremdvertrag).length,
    fremd: enriched.filter((c: any) => c.is_fremdvertrag).length,
  }), [enriched]);

  // Command Center Metrics (Contracts expiring in <= 3 months - Red and Orange buckets)
  const commandCenterMetrics = useMemo(() => {
    let atRiskCount = 0;
    const providerMap = new Map<string, number>();
    const topPriorities: any[] = [];

    enriched.forEach(c => {
      if (c._bucket.id === "rot" || c._bucket.id === "orange") {
        atRiskCount++;
        if (c.provider) {
          providerMap.set(c.provider, (providerMap.get(c.provider) || 0) + 1);
        }
        if (topPriorities.length < 5) {
          topPriorities.push(c);
        }
      }
    });

    const topProviders = Array.from(providerMap, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { atRiskCount, topProviders, topPriorities };
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched
      .filter((c: any) => (bucket === "alle" ? true : c._bucket.key === bucket))
      .filter((c: any) =>
        herkunft === "alle"
          ? true
          : herkunft === "eigen"
            ? !c.is_fremdvertrag
            : !!c.is_fremdvertrag,
      )
      .sort((a: any, b: any) => {
        if (b._bucket.rank !== a._bucket.rank) return b._bucket.rank - a._bucket.rank;
        return (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
      });
  }, [enriched, bucket, herkunft]);

  const setBucket = (b: ExpiryBucket | "alle") =>
    navigate({ search: { bucket: b, herkunft }, replace: true });
  const setHerkunft = (h: "alle" | "eigen" | "fremd") =>
    navigate({ search: { bucket, herkunft: h }, replace: true });

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:px-8 space-y-4 max-w-[1920px] w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <AlarmClock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Vertragsablauf</h1>
            <p className="text-sm text-muted-foreground font-medium">
              Laufzeiten-Monitoring, Kündigungsfristen &amp; Kündigungsprävention
            </p>
          </div>
        </div>

        {/* Herkunft Filter Bar */}
        <div className="flex items-center gap-1.5 bg-card border border-border/60 p-1 rounded-xl shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground px-2 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Herkunft:
          </span>
          <Button
            size="sm"
            variant={herkunft === "alle" ? "default" : "ghost"}
            className="h-8 text-xs font-medium px-3 rounded-lg"
            onClick={() => setHerkunft("alle")}
          >
            Alle ({herkunftCounts.alle})
          </Button>
          <Button
            size="sm"
            variant={herkunft === "eigen" ? "default" : "ghost"}
            className="h-8 text-xs font-medium px-3 rounded-lg"
            onClick={() => setHerkunft("eigen")}
          >
            Eigen ({herkunftCounts.eigen})
          </Button>
          <Button
            size="sm"
            variant={herkunft === "fremd" ? "default" : "ghost"}
            className="h-8 text-xs font-medium px-3 rounded-lg"
            onClick={() => setHerkunft("fremd")}
          >
            Fremd ({herkunftCounts.fremd})
          </Button>
        </div>
      </div>

      {/* 1. Large Interactive Dashboard-Style KPI Cards for Expiry Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        <ExpiryFilterCard
          icon={Layers}
          label="Alle Verträge"
          sublabel="Gesamtbestand"
          count={counts.alle}
          active={bucket === "alle"}
          onClick={() => setBucket("alle")}
          colorScheme="all"
        />
        <ExpiryFilterCard
          icon={AlertTriangle}
          label="Rot (≤ 1 Mon.)"
          sublabel="Akut / Kündigung"
          count={counts.rot ?? 0}
          active={bucket === "rot"}
          onClick={() => setBucket("rot")}
          colorScheme="red"
        />
        <ExpiryFilterCard
          icon={AlarmClock}
          label="Orange (≤ 3 Mon.)"
          sublabel="Dringend ansprechen"
          count={counts.orange ?? 0}
          active={bucket === "orange"}
          onClick={() => setBucket("orange")}
          colorScheme="orange"
        />
        <ExpiryFilterCard
          icon={CalendarClock}
          label="Gelb (≤ 6 Mon.)"
          sublabel="Vorbereitung"
          count={counts.gelb ?? 0}
          active={bucket === "gelb"}
          onClick={() => setBucket("gelb")}
          colorScheme="yellow"
        />
        <ExpiryFilterCard
          icon={CheckCircle2}
          label="Grün (≤ 12 Mon.)"
          sublabel="Entspannter Vorlauf"
          count={counts.gruen ?? 0}
          active={bucket === "gruen"}
          onClick={() => setBucket("gruen")}
          colorScheme="green"
        />
        <ExpiryFilterCard
          icon={CalendarRange}
          label="Später / Ohne Datum"
          sublabel="Langfristig"
          count={counts.neutral ?? 0}
          active={bucket === "neutral"}
          onClick={() => setBucket("neutral")}
          colorScheme="neutral"
        />
        <ExpiryFilterCard
          icon={History}
          label="Abgelaufen"
          sublabel="Vertrag beendet"
          count={counts.abgelaufen ?? 0}
          active={bucket === "abgelaufen"}
          onClick={() => setBucket("abgelaufen")}
          colorScheme="gray"
        />
      </div>

      {/* 2. Main Content Grid (List on Left, Retention Command Center on Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch flex-1 min-h-0">
        {/* Left Column: Contracts List */}
        <div className="xl:col-span-2 h-full min-h-0 flex flex-col">
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Gefilterte Verträge ({filtered.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Sortiert nach Dringlichkeit &amp; Enddatum
              </span>
            </CardHeader>
            <CardContent 
              ref={listRef}
              onScroll={(e) => sessionStorage.setItem("scroll-pos-vertragsablauf", String(e.currentTarget.scrollTop))}
              className="p-0 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
            >
              {isLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Wird geladen…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Keine Verträge in dieser Auswahl gefunden.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((c: any) => {
                    const b = c._bucket;
                    const status = contractStatusMeta(c.status);
                    const fMembers = familyMap.get(c.id) ?? [];
                    return (
                      <Link
                        key={c.id}
                        to="/kunden/$id"
                        params={{ id: c.customer_id }}
                        search={{ contract: c.id, from: "/vertragsablauf" }}
                        onClick={() => sessionStorage.setItem("last-list-origin", "/vertragsablauf")}
                        className={`flex items-center gap-3 p-3.5 hover:bg-accent/50 border-l-4 transition-colors ${b.borderClass} ${b.bgClass}`}
                      >
                        <span className="text-2xl shrink-0">{contractTypeIcon(c.type)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate flex items-center gap-2 flex-wrap">
                            <span className="hover:underline font-semibold">
                              {c.customers?.last_name ? `${c.customers.last_name}, ${c.customers.first_name}` : "Unbenannter Kunde"}
                            </span>
                            {c.is_fremdvertrag && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-dashed">
                                Fremd{c.fremd_quelle ? ` · ${c.fremd_quelle}` : ""}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {contractTypeLabel(c.type)}
                            {c.provider ? ` · ${c.provider}` : ""}
                          </div>
                          {fMembers.length > 0 && (
                            <div className="text-[11px] font-normal text-muted-foreground mt-1 flex flex-wrap gap-1">
                              <span>👨‍👩‍👧 Mitversichert:</span>
                              {fMembers.map((m: any) => (
                                <Badge key={m.id} variant="outline" className="text-[10px] py-0 px-1 font-normal bg-accent/30">
                                  {m.relation === "kind" ? "Kind" : "Ehegatte"}: {m.first_name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="hidden sm:block text-xs">
                          <Badge variant="outline" className={status.color}>{status.label}</Badge>
                        </div>
                        <div className="text-right shrink-0 w-36">
                          <div className="text-xs font-semibold text-foreground">{formatDate(c.end_date)}</div>
                          <Badge className={`text-xs ${b.badgeClass} mt-1`}>
                            {c._days === null
                              ? "ohne Datum"
                              : c._days < 0
                                ? `abgelaufen · ${Math.abs(c._days)} T`
                                : `in ${formatDuration(c._days)}`}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Retention Command Center */}
        <div className="xl:col-span-1 h-full min-h-0 flex flex-col">
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                Kündigungsprävention
              </h3>
              
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{commandCenterMetrics.atRiskCount}</div>
                  <div className="text-sm font-medium text-warning/80">Verträge gefährdet (&lt; 3 Mon.)</div>
                </div>
              </div>

              {commandCenterMetrics.topProviders.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Gesellschaften im Risiko
                  </h4>
                  <div className="space-y-3">
                    {commandCenterMetrics.topProviders.map(p => (
                      <div key={p.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate pr-2">{p.name}</span>
                          <span className="text-muted-foreground font-semibold">{p.count}</span>
                        </div>
                        <div className="h-2 w-full bg-accent/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-warning/60 rounded-full" 
                            style={{ width: `${Math.min(100, (p.count / commandCenterMetrics.topProviders[0].count) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {commandCenterMetrics.topPriorities.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Top Prioritäten
                  </h4>
                  <div className="space-y-3">
                    {commandCenterMetrics.topPriorities.map(c => (
                      <div key={c.id} className="bg-accent/30 rounded-lg p-3 border border-border/40">
                        <div className="flex justify-between items-start mb-2">
                          <Link to="/kunden/$id" params={{ id: c.customer_id }} className="font-medium text-sm hover:underline truncate pr-2">
                            {c.customers?.first_name} {c.customers?.last_name}
                          </Link>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${c._bucket.badgeClass}`}>
                            {c._days < 0 ? 'Abgelaufen' : `in ${formatDuration(c._days)}`}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3 truncate">
                          {contractTypeLabel(c.type)} {c.provider ? `· ${c.provider}` : ''}
                        </div>
                        <Link to="/kunden/$id" params={{ id: c.customer_id }}>
                          <Button size="sm" variant="outline" className="w-full text-xs h-8 bg-background">
                            <Phone className="h-3 w-3 mr-2" /> Kontaktieren
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {commandCenterMetrics.atRiskCount === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-20 text-success" />
                  Keine akuten Kündigungsrisiken in den nächsten 3 Monaten.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExpiryFilterCard({
  icon: Icon,
  label,
  sublabel,
  count,
  active,
  onClick,
  colorScheme,
}: {
  icon: any;
  label: string;
  sublabel: string;
  count: number;
  active: boolean;
  onClick: () => void;
  colorScheme: "all" | "red" | "orange" | "yellow" | "green" | "gray" | "neutral";
}) {
  const getColors = () => {
    switch (colorScheme) {
      case "red":
        return {
          border: active
            ? "border-red-500 ring-2 ring-red-500/40 bg-red-500/15 shadow-red-500/10 shadow-lg"
            : "border-red-500/30 hover:border-red-500/60 bg-red-500/5",
          iconBg: "bg-red-500/20 text-red-600 dark:text-red-400",
          numColor: "text-red-600 dark:text-red-400",
        };
      case "orange":
        return {
          border: active
            ? "border-amber-500 ring-2 ring-amber-500/40 bg-amber-500/15 shadow-amber-500/10 shadow-lg"
            : "border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5",
          iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
          numColor: "text-amber-600 dark:text-amber-400",
        };
      case "yellow":
        return {
          border: active
            ? "border-yellow-400 ring-2 ring-yellow-400/40 bg-yellow-400/15 shadow-yellow-400/10 shadow-lg"
            : "border-yellow-400/30 hover:border-yellow-400/60 bg-yellow-400/5",
          iconBg: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300",
          numColor: "text-yellow-700 dark:text-yellow-300",
        };
      case "green":
        return {
          border: active
            ? "border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/15 shadow-emerald-500/10 shadow-lg"
            : "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5",
          iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
          numColor: "text-emerald-600 dark:text-emerald-400",
        };
      case "gray":
        return {
          border: active
            ? "border-slate-500 ring-2 ring-slate-500/40 bg-slate-500/15 shadow-slate-500/10 shadow-lg"
            : "border-slate-500/30 hover:border-slate-500/60 bg-slate-500/5",
          iconBg: "bg-slate-500/20 text-slate-600 dark:text-slate-400",
          numColor: "text-slate-600 dark:text-slate-400",
        };
      case "neutral":
        return {
          border: active
            ? "border-primary ring-2 ring-primary/40 bg-primary/10 shadow-primary/10 shadow-lg"
            : "border-border/60 hover:border-border bg-card",
          iconBg: "bg-muted text-muted-foreground",
          numColor: "text-foreground",
        };
      case "all":
      default:
        return {
          border: active
            ? "border-primary ring-2 ring-primary/40 bg-primary/10 shadow-primary/10 shadow-lg"
            : "border-border/60 hover:border-primary/40 bg-card",
          iconBg: "bg-primary/15 text-primary",
          numColor: "text-foreground",
        };
    }
  };

  const c = getColors();

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className={`transition-all duration-200 border relative overflow-hidden ${c.border}`}>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="text-xs font-semibold text-muted-foreground truncate">{label}</div>
              <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${c.numColor}`}>
                {count}
              </div>
              <div className="text-[11px] text-muted-foreground/80 truncate">{sublabel}</div>
            </div>
            <div className={`p-2 rounded-xl shrink-0 ${c.iconBg}`}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
