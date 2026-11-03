import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, FileText, Clock, AlertTriangle, TrendingUp, CalendarClock, AlertCircle, Sparkles, Briefcase, AlarmClock, BarChart3, PieChartIcon, LineChartIcon, FileClock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie, Legend } from "recharts";
import {
  formatDate, daysUntil, contractTypeIcon, contractTypeLabel,
  getRenewalState, getUrgency,
  clarificationCategoryMeta, expireOverdueContracts, formatDuration,
  getExpiryBucket, contractStatusMeta
} from "@/lib/crm-types";
import { useEffect, useState } from "react";
import { Activity, Target } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function buildDistributionData(categories: any[]) {
  const typeCounts = categories.reduce((acc: any, curr: any) => {
    const t = contractTypeLabel(curr.type);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => (b.value as number) - (a.value as number));
}

function buildFunnelData(categories: any[]) {
  const statusCounts = categories.reduce((acc: any, curr: any) => {
    const s = contractStatusMeta(curr.status).label;
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(statusCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => (b.count as number) - (a.count as number));
}

function buildGrowthData(categories: any[]) {
  const monthlyCounts: Record<string, number> = {};
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + i);
    const key = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    monthlyCounts[key] = 0;
  }
  categories.forEach((c: any) => {
    if (c.created_at) {
      const d = new Date(c.created_at);
      if (d >= sixMonthsAgo) {
        const key = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
        if (monthlyCounts[key] !== undefined) monthlyCounts[key]++;
      }
    }
  });
  return Object.entries(monthlyCounts).map(([month, contracts]) => ({ month, contracts }));
}

function Dashboard() {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Monatsziel State (Persist in localStorage, default 20)
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("crm-monthly-target");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 20;
  });

  const [isCustomTargetOpen, setIsCustomTargetOpen] = useState<boolean>(false);
  const [customTargetInput, setCustomTargetInput] = useState<string>("");

  const handleSaveCustomTarget = () => {
    const val = parseInt(customTargetInput.trim(), 10);
    if (!isNaN(val) && val > 0) {
      setMonthlyTarget(val);
      localStorage.setItem("crm-monthly-target", String(val));
      setIsCustomTargetOpen(false);
      setCustomTargetInput("");
    }
  };

  // Auto-expire contracts past their end_date on each visit (RLS guards writes).
  useEffect(() => { expireOverdueContracts(supabase); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const in370 = new Date(now); in370.setDate(in370.getDate() + 370);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const results = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "kunde"),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "interessent"),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "aktiv"),
        supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "in_pruefung"),
        supabase.from("contracts").select("id, end_date, type, status, customer_id, is_fremdvertrag, customers(first_name,last_name)")
          .gte("end_date", today).lte("end_date", in370.toISOString().slice(0, 10))
          .neq("status", "storniert").neq("status", "abgelaufen").order("end_date").limit(50),
        supabase.from("tasks").select("id, title, due_date, customer_id, customers(first_name,last_name)")
          .eq("status", "offen").order("due_date", { nullsFirst: false }).limit(10),
        supabase.from("contracts").select("id, type, status, created_at, customer_id, customers(first_name,last_name)")
          .gte("created_at", startOfMonth).order("created_at", { ascending: false }).limit(10),
        supabase.from("clarifications")
          .select("id, title, category, status, due_date, customer_id, customers(first_name,last_name)")
          .neq("status", "erledigt")
          .order("due_date", { nullsFirst: false }),
        supabase.from("contracts").select("id", { count: "exact", head: true }).eq("is_fremdvertrag", true),
        supabase.from("customer_notes").select("id, content, created_at, customer_id, customers(first_name,last_name)").order("created_at", { ascending: false }).limit(15),
        (supabase as any).from("contract_family_members").select("id", { count: "exact", head: true }),
        // Neue präzise Monatszählungen
        supabase.from("contracts").select("id", { count: "exact", head: true })
          .gte("created_at", startOfMonth).lte("created_at", endOfMonth).eq("status", "in_pruefung"),
        supabase.from("contracts").select("id", { count: "exact", head: true })
          .gte("created_at", startOfMonth).lte("created_at", endOfMonth).eq("status", "aktiv"),
      ]);

      for (const res of results) {
        if (res.error) {
          console.error("[Dashboard Query Error]:", res.error);
        }
      }

      const [
        customers, leads, totalContracts, activeContracts, inReviewContracts, 
        expiring, tasks, recent, clarifications, fremdCount, recentNotes, 
        familyMembers, monthOrders, monthClosings
      ] = results;

      // Paginated fetch for complete diagram statistics (distribution, funnel, growth)
      let allContractMetas: any[] = [];
      let page = 0;
      while (true) {
        const { data: cChunk, error: cErr } = await supabase
          .from("contracts")
          .select("id, type, status, created_at")
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (cErr) break;
        if (!cChunk || cChunk.length === 0) break;
        allContractMetas = allContractMetas.concat(cChunk);
        if (cChunk.length < 1000) break;
        page++;
      }

      const expiringFiltered = (expiring.data ?? [])
        .filter((c: any) => getRenewalState({ type: c.type, end_date: c.end_date, status: c.status }).due)
        .sort((a: any, b: any) => {
          const ra = getExpiryBucket(a.end_date, a.status).rank;
          const rb = getExpiryBucket(b.end_date, b.status).rank;
          if (ra !== rb) return rb - ra;
          return (a.end_date ?? "").localeCompare(b.end_date ?? "");
        })
        .slice(0, 10);

      const clarList = (clarifications.data ?? []).sort((a: any, b: any) => {
        const ua = getUrgency(a.due_date, a.status).rank;
        const ub = getUrgency(b.due_date, b.status).rank;
        if (ua !== ub) return ub - ua;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });

      const overdueClar = clarList.filter((c: any) => getUrgency(c.due_date, c.status).key === "ueberfaellig").length;
      const openClar = clarList.filter((c: any) => c.status === "offen").length;

      const distributionData = buildDistributionData(allContractMetas);
      const funnelData = buildFunnelData(allContractMetas);
      const growthData = buildGrowthData(allContractMetas);

      return {
        customerCount: customers.count ?? 0,
        leadCount: leads.count ?? 0,
        contractCount: totalContracts.count ?? 0,
        active: activeContracts.count ?? 0,
        inReview: inReviewContracts.count ?? 0,
        monthOrders: monthOrders?.count ?? 0,
        monthClosings: monthClosings?.count ?? 0,
        thisMonth: monthClosings?.count ?? 0, // Fallback
        expiring: expiringFiltered,
        tasks: tasks.data ?? [],
        openTasks: tasks.data?.length ?? 0,
        recent: recent.data ?? [],
        clarifications: clarList.slice(0, 10),
        openClar,
        overdueClar,
        fremdCount: fremdCount.count ?? 0,
        distributionData,
        funnelData,
        growthData,
        recentNotes: recentNotes?.data ?? [],
      };
    },
  });

  const PIPELINE_COLORS: Record<string, string> = {
    "In Prüfung": "#d2953c",
    "Aktiv": "#10b981",
    "Warten auf Neuabschluss": "#f59e0b",
    "Gekündigt": "#f97316",
    "Abgelaufen": "#f43f5e",
    "Storniert": "#64748b",
  };

  const DISTRIBUTION_COLORS = [
    "#3b82f6",
    "#06b6d4",
    "#8b5cf6",
    "#ec4899",
    "#10b981",
    "#f59e0b",
    "#6366f1",
    "#14b8a6",
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border/80 text-popover-foreground px-3 py-2 rounded-xl shadow-lg text-xs space-y-1">
          <p className="font-semibold">{data.name || data.payload?.month || data.payload?.name}</p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.fill || data.color || "var(--color-primary)" }} />
            <span className="font-bold text-foreground">
              {data.value ?? data.payload?.count} {data.dataKey === "contracts" ? "Verträge" : "Stück"}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-[1920px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-base text-muted-foreground font-medium">Überblick über Kunden, Verträge, Statistiken und anstehende Aufgaben</p>
      </motion.div>

      {/* 1. Top KPI Metrics Cards */}
      <motion.div 
        variants={container} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3.5"
      >
        <motion.div variants={item}><Stat to="/interessenten" icon={Sparkles} label="Interessenten" value={data?.leadCount ?? 0} loading={isLoading} accent /></motion.div>
        <motion.div variants={item}><Stat to="/kunden" icon={Users} label="Kunden" value={data?.customerCount ?? 0} loading={isLoading} /></motion.div>
        <motion.div variants={item}><Stat to="/vertraege" icon={FileText} label="Aktive Verträge" value={data?.active ?? 0} loading={isLoading} search={{ status: "aktiv" } as any} accent /></motion.div>
        <motion.div variants={item}><Stat to="/vertraege" icon={Clock} label="In Prüfung" value={data?.inReview ?? 0} loading={isLoading} search={{ status: "in_pruefung" } as any} /></motion.div>
        <motion.div variants={item}><Stat to="/vertraege" icon={FileClock} label="Aufträge / Monat" value={data?.monthOrders ?? 0} loading={isLoading} search={{ status: "in_pruefung", period: "this_month" } as any} accent /></motion.div>
        <motion.div variants={item}><Stat to="/vertraege" icon={TrendingUp} label="Abschlüsse / Monat" value={data?.monthClosings ?? 0} loading={isLoading} search={{ status: "aktiv", period: "this_month" } as any} accent /></motion.div>
        <motion.div variants={item}><Stat to="/vertragsablauf" icon={AlarmClock} label="Vertragsablauf" value={data?.expiring?.length ?? 0} loading={isLoading} /></motion.div>
        <motion.div variants={item}><Stat to="/vertraege" icon={Briefcase} label="Fremdverträge" value={data?.fremdCount ?? 0} loading={isLoading} search={{ herkunft: "fremd" } as any} /></motion.div>
        <motion.div variants={item}><Stat to="/klaerfaelle" icon={AlertCircle} label="Offene Klärfälle" value={data?.openClar ?? 0} loading={isLoading} highlight={(data?.overdueClar ?? 0) > 0} /></motion.div>
        <motion.div variants={item}><Stat to="/aufgaben" icon={CalendarClock} label="Offene Aufgaben" value={data?.openTasks ?? 0} loading={isLoading} /></motion.div>
      </motion.div>

      {/* 2. Statistics & Analytics Section (Directly under Top KPI Cards) */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 24 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span>Statistiken &amp; Analysen</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Card 1: Vertragsverteilung */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Vertragsverteilung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Pie 
                      data={data?.distributionData || []} 
                      cx="50%" 
                      cy="42%" 
                      innerRadius={55} 
                      outerRadius={75} 
                      paddingAngle={4} 
                      dataKey="value"
                    >
                      {(data?.distributionData || []).map((entry: any, index: number) => (
                        <Cell key={`cell-dist-${index}`} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pipeline-Status */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Pipeline-Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.funnelData || []} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} width={110} />
                    <RechartsTooltip cursor={false} content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                      {(data?.funnelData || []).map((entry: any, index: number) => {
                        const baseColor = PIPELINE_COLORS[entry.name] || DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length];
                        const isHovered = typeof hoveredBarIndex === "number" && hoveredBarIndex === index;
                        const isOtherHovered = typeof hoveredBarIndex === "number" && hoveredBarIndex !== index;
                        return (
                          <Cell 
                            key={`cell-funnel-${index}`} 
                            fill={baseColor} 
                            onMouseEnter={() => setHoveredBarIndex(index)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            style={{
                              filter: isHovered 
                                ? `brightness(1.25) drop-shadow(0 0 8px ${baseColor})` 
                                : "none",
                              opacity: isOtherHovered ? 0.6 : 1,
                              transition: "filter 0.2s ease, opacity 0.2s ease",
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Vertragsabschlüsse (Letzte 6 Monate) */}
          <Card className="hover:shadow-md transition-shadow md:col-span-2 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChartIcon className="h-4 w-4 text-primary" />
                Vertragsabschlüsse (Letzte 6 Monate)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.growthData || []} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGrowthModern" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#df9f43" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#d2953c" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="contracts" stroke="#d2953c" strokeWidth={3} fillOpacity={1} fill="url(#colorGrowthModern)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* 3. Operative Übersicht & Live Activity Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 24 }}
        className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start"
      >
        {/* Main Operational Area */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card: Verlängerung / Wechselfenster */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Verlängerung / Wechselfenster
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.expiring ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aktuell keine Verträge im Verlängerungsfenster.</p>
                )}
                {data?.expiring.map((c: any) => {
                  const bucket = getExpiryBucket(c.end_date, c.status);
                  const days = daysUntil(c.end_date);
                  return (
                    <Link
                      to="/kunden/$id"
                      params={{ id: c.customer_id }}
                      key={c.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded-md hover:bg-accent/50 border-l-4 ${bucket.borderClass} ${bucket.bgClass}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{contractTypeIcon(c.type)}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1">
                            {c.customers?.first_name} {c.customers?.last_name}
                            {c.is_fremdvertrag && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-dashed">Fremd</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{contractTypeLabel(c.type)}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium">{formatDate(c.end_date)}</div>
                        {days !== null && (
                          <Badge className={`text-xs ${bucket.badgeClass}`}>in {formatDuration(days)}</Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            {/* Card: Offene Klärfälle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    Offene Klärfälle
                  </span>
                  {(data?.overdueClar ?? 0) > 0 && (
                    <Badge variant="destructive">{data?.overdueClar} überfällig</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.clarifications ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Keine offenen Klärfälle.</p>
                )}
                {data?.clarifications.map((c: any) => {
                  const u = getUrgency(c.due_date, c.status);
                  const cat = clarificationCategoryMeta(c.category);
                  return (
                    <Link
                      to="/klaerfaelle"
                      key={c.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded-md hover:bg-accent/50 border-l-4 ${u.borderClass}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{cat.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={`text-xs ${u.badgeClass}`}>{u.label}</Badge>
                        {c.due_date && <div className="text-xs text-muted-foreground mt-1">{formatDate(c.due_date)}</div>}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Card: Offene Aufgaben */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-info" />
                Offene Aufgaben
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.tasks ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>
              )}
              {data?.tasks.map((t: any) => (
                <Link
                  to={t.customer_id ? "/kunden/$id" : "/aufgaben"}
                  params={t.customer_id ? { id: t.customer_id } : (undefined as any)}
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.customers ? `${t.customers.first_name} ${t.customers.last_name}` : "Allgemein"}
                    </div>
                  </div>
                  <div className="text-xs">{formatDate(t.due_date)}</div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          {/* Performance Widget */}
          {(() => {
            const closings = data?.monthClosings ?? 0;
            const targetPct = Math.min(Math.round((closings / monthlyTarget) * 100), 100);
            const isTargetReached = closings >= monthlyTarget && monthlyTarget > 0;
            const remaining = Math.max(monthlyTarget - closings, 0);
            const excess = Math.max(closings - monthlyTarget, 0);

            return (
              <Card className="overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4 text-primary" />
                      <span>Monatsziel (Abschlüsse)</span>
                    </CardTitle>

                    {/* Target Dropdown Selector */}
                    <Select
                      value={
                        [10, 20, 30, 50, 75, 100, 150, 200].includes(monthlyTarget)
                          ? String(monthlyTarget)
                          : "custom"
                      }
                      onValueChange={(val) => {
                        if (val === "custom") {
                          setCustomTargetInput(String(monthlyTarget));
                          setIsCustomTargetOpen(true);
                        } else {
                          const num = parseInt(val, 10);
                          setMonthlyTarget(num);
                          localStorage.setItem("crm-monthly-target", String(num));
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-[125px] text-xs font-semibold px-2 py-0 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                        <div className="flex items-center gap-1.5 truncate">
                          <Target className="h-3 w-3 text-primary shrink-0" />
                          <SelectValue placeholder="Ziel">Ziel: {monthlyTarget}</SelectValue>
                        </div>
                      </SelectTrigger>
                      <SelectContent align="end" className="text-xs">
                        <SelectItem value="10">🎯 10 Abschlüsse</SelectItem>
                        <SelectItem value="20">🎯 20 Abschlüsse</SelectItem>
                        <SelectItem value="30">🎯 30 Abschlüsse</SelectItem>
                        <SelectItem value="50">🎯 50 Abschlüsse</SelectItem>
                        <SelectItem value="75">🎯 75 Abschlüsse</SelectItem>
                        <SelectItem value="100">🎯 100 Abschlüsse</SelectItem>
                        <SelectItem value="150">🎯 150 Abschlüsse</SelectItem>
                        <SelectItem value="200">🎯 200 Abschlüsse</SelectItem>
                        <SelectItem value="custom">✏️ Eigenes Ziel anpassen…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">{closings}</span>
                      <span className="text-xs text-muted-foreground font-medium">von {monthlyTarget} erreicht</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold px-2 py-0.5 ${
                        isTargetReached
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {targetPct}% {isTargetReached ? "🎉 Erreicht!" : ""}
                    </Badge>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full bg-secondary h-3 rounded-full overflow-hidden shadow-soft-inset">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        isTargetReached
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : "bg-primary"
                      }`} 
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>

                  <div className="text-xs text-muted-foreground flex justify-between items-center flex-wrap gap-1 pt-0.5">
                    <span>
                      {isTargetReached ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          +{excess} über dem Ziel! 🏆
                        </span>
                      ) : (
                        <span>{remaining} bis zum Ziel</span>
                      )}
                    </span>
                    <span className="text-right">
                      <strong className="text-foreground font-semibold">{data?.monthOrders ?? 0}</strong> Aufträge in Prüfung
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Live Pulse Activity Feed */}
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Live Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {data?.recentNotes?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Keine kürzliche Aktivität.</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {data?.recentNotes?.map((note: any) => (
                    <div key={note.id} className="p-4 hover:bg-accent/30 transition-colors group">
                      <div className="flex items-start justify-between mb-1">
                        <Link 
                          to="/kunden/$id" 
                          params={{ id: note.customer_id }} 
                          className="text-sm font-medium hover:text-primary transition-colors truncate pr-2"
                        >
                          {note.customers?.first_name} {note.customers?.last_name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 group-hover:text-foreground/90 transition-colors">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Dialog for Custom Monatsziel */}
      <Dialog open={isCustomTargetOpen} onOpenChange={setIsCustomTargetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Monatsziel anpassen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Legen Sie eine individuelle Anzahl an Abschlüssen als Ziel für diesen Monat fest:
            </p>
            <Input
              type="number"
              min="1"
              max="10000"
              placeholder="z. B. 45"
              value={customTargetInput}
              onChange={(e) => setCustomTargetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCustomTarget();
              }}
              autoFocus
              className="text-sm font-semibold"
            />
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCustomTargetOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCustomTarget}
            >
              Ziel speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, loading, accent, highlight, to, search }: any) {
  const card = (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card className={`transition-all duration-300 border ${highlight ? "border-destructive/60 bg-destructive/5 shadow-destructive/10" : accent ? "border-primary/40 bg-primary/5 shadow-primary/10" : "border-border/60"} ${to ? "cursor-pointer hover:border-primary/60 hover:shadow-xl hover:shadow-primary/15" : ""}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-semibold text-muted-foreground truncate">{label}</div>
              <div className={`text-3xl font-extrabold tracking-tight ${highlight ? "text-destructive" : "text-foreground"}`}>{loading ? "…" : value}</div>
            </div>
            <div className={`p-2.5 rounded-xl shrink-0 ${highlight ? "bg-destructive/15 text-destructive" : accent ? "bg-primary/15 text-primary" : "bg-muted/80 text-muted-foreground"}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
  if (to) return <Link to={to} search={search} className="block focus:outline-none">{card}</Link>;
  return card;
}
