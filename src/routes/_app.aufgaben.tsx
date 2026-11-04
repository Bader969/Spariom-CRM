import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useRef, useEffect, Component } from "react";
import {
  formatDate,
  getTaskUrgency,
  CONTRACT_TYPES,
  TASK_PRIORITIES,
  taskPriorityMeta,
  contractTypeIcon,
  contractTypeLabel,
  type TaskPriority,
} from "@/lib/crm-types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Plus,
  AlertCircle,
  Calendar,
  User,
  TrendingUp,
  Save,
  Zap,
  Search,
  Filter,
  RotateCcw,
  ArrowUpDown,
  FileText,
  UserCheck,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { TaskAutomationManagerDialog } from "@/components/TaskAutomationManagerDialog";

export const Route = createFileRoute("/_app/aufgaben")({
  component: TasksPage,
});

class TaskDetailsErrorBoundary extends Component<{ children: React.ReactNode; onReset: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[TaskDetailsErrorBoundary]:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="flex-1 min-h-0 flex flex-col justify-center items-center p-6 text-center border-red-500/30 bg-red-500/5">
          <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
          <h3 className="font-semibold text-lg text-red-500 mb-1">Details nicht verfügbar</h3>
          <p className="text-sm text-muted-foreground mb-4">Die Details dieser Aufgabe konnten nicht dargestellt werden.</p>
          <Button variant="outline" onClick={() => { this.setState({ hasError: false }); this.props.onReset(); }}>
            Zurück zur Übersicht
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

const getSavedAufgabenFilter = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem("crm-filters-aufgaben");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[key] !== undefined) return parsed[key];
    }
  } catch {}
  return fallback;
};

type UrgencyFilter = "alle" | "ueberfaellig" | "hoch" | "mittel" | "niedrig";
type DateFilter = "alle" | "ueberfaellig" | "heute" | "morgen" | "woche" | "monat" | "ohne_datum" | "zeitraum";
type SortOrder = "urgency" | "due_asc" | "priority" | "newest";

function TasksPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();

  // Filter states persisted in sessionStorage
  const [filter, setFilter] = useState<"alle" | "offen" | "erledigt">(() => getSavedAufgabenFilter("filter", "offen"));
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>(() => getSavedAufgabenFilter("urgencyFilter", "alle"));
  const [priorityFilter, setPriorityFilter] = useState<string>(() => getSavedAufgabenFilter("priorityFilter", "alle"));
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => getSavedAufgabenFilter("dateFilter", "alle"));
  const [dateFrom, setDateFrom] = useState<string>(() => getSavedAufgabenFilter("dateFrom", ""));
  const [dateTo, setDateTo] = useState<string>(() => getSavedAufgabenFilter("dateTo", ""));
  const [sourceFilter, setSourceFilter] = useState<string>(() => getSavedAufgabenFilter("sourceFilter", "alle"));
  const [assigneeFilter, setAssigneeFilter] = useState<string>(() => getSavedAufgabenFilter("assigneeFilter", "alle"));
  const [sortBy, setSortBy] = useState<SortOrder>(() => getSavedAufgabenFilter("sortBy", "urgency"));
  const [q, setQ] = useState<string>(() => getSavedAufgabenFilter("q", ""));

  // Quick-create states
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("mittel");
  const [customerId, setCustomerId] = useState<string>("__none");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);

  // Save filter changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(
      "crm-filters-aufgaben",
      JSON.stringify({
        filter,
        urgencyFilter,
        priorityFilter,
        dateFilter,
        dateFrom,
        dateTo,
        sourceFilter,
        assigneeFilter,
        sortBy,
        q,
      })
    );
  }, [filter, urgencyFilter, priorityFilter, dateFilter, dateFrom, dateTo, sourceFilter, assigneeFilter, sortBy, q]);

  // States for Task Details Sidebar editing
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("mittel");
  const [editCustomer, setEditCustomer] = useState("__none");
  const [editAssignee, setEditAssignee] = useState("__none");

  const listRef = useRef<HTMLDivElement>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, customers(id, first_name, last_name), contracts(id, type, provider, referenz_id)")
        .order("due_date", { nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: rulesCount = 0 } = useQuery({
    queryKey: ["task_automation_rules", "count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("task_automation_rules")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      return count ?? 0;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles as any[]) {
      m[p.id] = p.full_name || p.email || "Mitarbeiter";
    }
    return m;
  }, [profiles]);

  const { data: customers } = useQuery({
    queryKey: ["customers", "minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, first_name, last_name").order("last_name");
      return data ?? [];
    },
  });

  // Helper date strings
  const dateHelpers = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { todayStr, tomorrowStr, weekEndStr, monthStartStr, monthEndStr };
  }, []);

  // Live counts per urgency (for current status filter)
  const urgencyCounts = useMemo(() => {
    const counts = { alle: 0, ueberfaellig: 0, hoch: 0, mittel: 0, niedrig: 0 };
    for (const t of tasks ?? []) {
      if (filter !== "alle" && t.status !== filter) continue;
      counts.alle++;
      const u = getTaskUrgency(t.due_date, t.status, t.priority);
      if (u.key === "ueberfaellig") counts.ueberfaellig++;
      else if (u.key === "hoch") counts.hoch++;
      else if (u.key === "mittel") counts.mittel++;
      else if (u.key === "niedrig") counts.niedrig++;
    }
    return counts;
  }, [tasks, filter]);

  const hasActiveSubFilters =
    urgencyFilter !== "alle" ||
    priorityFilter !== "alle" ||
    dateFilter !== "alle" ||
    sourceFilter !== "alle" ||
    assigneeFilter !== "alle" ||
    q.trim().length > 0;

  const resetAllFilters = () => {
    setUrgencyFilter("alle");
    setPriorityFilter("alle");
    setDateFilter("alle");
    setDateFrom("");
    setDateTo("");
    setSourceFilter("alle");
    setAssigneeFilter("alle");
    setQ("");
  };

  const filtered = useMemo(() => {
    const { todayStr, tomorrowStr, weekEndStr, monthStartStr, monthEndStr } = dateHelpers;
    const searchLower = q.trim().toLowerCase();

    const list = (tasks ?? []).filter((t: any) => {
      // 1. Status filter
      if (filter !== "alle" && t.status !== filter) return false;

      // 2. Urgency filter
      const u = getTaskUrgency(t.due_date, t.status, t.priority);
      if (urgencyFilter !== "alle" && u.key !== urgencyFilter) return false;

      // 3. Priority filter
      if (priorityFilter !== "alle" && (t.priority ?? "mittel") !== priorityFilter) return false;

      // 4. Date filter
      if (dateFilter !== "alle") {
        const d = t.due_date;
        if (dateFilter === "ohne_datum") {
          if (d) return false;
        } else if (dateFilter === "ueberfaellig") {
          if (!d || d >= todayStr) return false;
        } else if (dateFilter === "heute") {
          if (d !== todayStr) return false;
        } else if (dateFilter === "morgen") {
          if (d !== tomorrowStr) return false;
        } else if (dateFilter === "woche") {
          if (!d || d < todayStr || d > weekEndStr) return false;
        } else if (dateFilter === "monat") {
          if (!d || d < monthStartStr || d > monthEndStr) return false;
        } else if (dateFilter === "zeitraum") {
          if (!d) return false;
          if (dateFrom && d < dateFrom) return false;
          if (dateTo && d > dateTo) return false;
        }
      }

      // 5. Source / Contract Type filter
      if (sourceFilter !== "alle") {
        if (sourceFilter === "auto") {
          if (!t.is_automated) return false;
        } else if (sourceFilter === "manuell") {
          if (t.is_automated) return false;
        } else {
          // Specific contract type
          if (t.contracts?.type !== sourceFilter) return false;
        }
      }

      // 6. Assignee filter
      if (assigneeFilter !== "alle") {
        if (assigneeFilter === "mir" && t.assigned_to !== user?.id) return false;
        if (assigneeFilter !== "mir" && t.assigned_to !== assigneeFilter) return false;
      }

      // 7. Full-text search
      if (searchLower) {
        const titleMatch = (t.title ?? "").toLowerCase().includes(searchLower);
        const descMatch = (t.description ?? "").toLowerCase().includes(searchLower);
        const custName = t.customers
          ? `${t.customers.first_name ?? ""} ${t.customers.last_name ?? ""}`.toLowerCase()
          : "";
        const providerMatch = (t.contracts?.provider ?? "").toLowerCase().includes(searchLower);
        if (!titleMatch && !descMatch && !custName.includes(searchLower) && !providerMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    const prioWeight: Record<string, number> = { hoch: 3, mittel: 2, niedrig: 1 };
    return [...list].sort((a: any, b: any) => {
      if (sortBy === "urgency") {
        const ua = getTaskUrgency(a.due_date, a.status, a.priority);
        const ub = getTaskUrgency(b.due_date, b.status, b.priority);
        if (ub.rank !== ua.rank) return ub.rank - ua.rank;
        const pa = prioWeight[a.priority ?? "mittel"] ?? 2;
        const pb = prioWeight[b.priority ?? "mittel"] ?? 2;
        if (pb !== pa) return pb - pa;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === "due_asc") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === "priority") {
        const pa = prioWeight[a.priority ?? "mittel"] ?? 2;
        const pb = prioWeight[b.priority ?? "mittel"] ?? 2;
        if (pb !== pa) return pb - pa;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      // newest
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [
    tasks,
    filter,
    urgencyFilter,
    priorityFilter,
    dateFilter,
    dateFrom,
    dateTo,
    sourceFilter,
    assigneeFilter,
    sortBy,
    q,
    dateHelpers,
    user?.id,
  ]);

  // Restore scroll position
  useEffect(() => {
    if (!isLoading && listRef.current) {
      const saved = sessionStorage.getItem("scroll-pos-aufgaben");
      if (saved) {
        const pos = parseInt(saved, 10);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = pos;
        });
      }
    }
  }, [isLoading, filtered.length]);

  const create = async () => {
    if (!title.trim() || !user) return;
    const cid = !customerId || customerId === "__none" ? null : customerId;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      due_date: due || null,
      priority,
      customer_id: cid,
      created_by: user.id,
      assigned_to: user.id,
      is_automated: false,
    });
    if (error) toast.error(error.message);
    else {
      setTitle("");
      setDue("");
      setPriority("mittel");
      setCustomerId("__none");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Aufgabe angelegt");
    }
  };

  const handleSelectTask = (t: any) => {
    if (!t) return;
    setSelectedTask(t);
    setEditTitle(t.title || "");
    setEditDesc(t.description || "");
    setEditDue(t.due_date || "");
    setEditPriority((t.priority as TaskPriority) || "mittel");
    const cid = t.customer_id ? String(t.customer_id) : "__none";
    setEditCustomer(cid);
    setEditAssignee(t.assigned_to ? String(t.assigned_to) : "__none");
  };

  const saveTaskDetails = async () => {
    if (!selectedTask) return;
    const cid = !editCustomer || editCustomer === "__none" ? null : editCustomer;
    const aid = !editAssignee || editAssignee === "__none" ? null : editAssignee;
    const { error } = await supabase
      .from("tasks")
      .update({
        title: editTitle.trim(),
        description: editDesc.trim(),
        due_date: editDue || null,
        priority: editPriority,
        customer_id: cid,
        assigned_to: aid,
      })
      .eq("id", selectedTask.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Aufgabe aktualisiert");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask({
        ...selectedTask,
        title: editTitle,
        description: editDesc,
        due_date: editDue,
        priority: editPriority,
        customer_id: cid,
        assigned_to: aid,
      });
    }
  };

  // Productivity Metrics
  const metrics = useMemo(() => {
    const todayStr = dateHelpers.todayStr;
    let openCount = 0;
    let overdueCount = 0;
    let completedCount = 0;
    let dueTodayCount = 0;
    let automatedCount = 0;

    (tasks ?? []).forEach((t: any) => {
      if (t.is_automated) automatedCount++;
      if (t.status === "erledigt") {
        completedCount++;
      } else {
        openCount++;
        if (t.due_date && t.due_date < todayStr) overdueCount++;
        if (t.due_date === todayStr) dueTodayCount++;
      }
    });

    const completionRate =
      completedCount + openCount > 0
        ? Math.round((completedCount / (completedCount + openCount)) * 100)
        : 0;

    return { openCount, overdueCount, completedCount, dueTodayCount, automatedCount, completionRate };
  }, [tasks, dateHelpers.todayStr]);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4 w-full max-w-[1920px]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Aufgaben & Workflow</h1>
          <p className="text-base text-muted-foreground font-medium">
            Automatische Vertrags-Checklisten & manuelle To-dos nach Dringlichkeit und Datum steuern
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setAutomationOpen(true)}
            className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/15 text-foreground font-semibold shadow-xs"
          >
            <Zap className="h-4 w-4 text-primary" />
            <span>Automations-Regeln</span>
            <Badge variant="secondary" className="ml-0.5 bg-primary/15 text-primary border-0">
              {rulesCount} aktiv
            </Badge>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch flex-1 min-h-0">
        {/* Left Column: Form, Filters & Tasks List */}
        <div className="xl:col-span-2 h-full min-h-0 flex flex-col space-y-3">
          {/* Quick-Create Bar */}
          <Card className="shrink-0 border-border/60 shadow-sm">
            <CardContent className="p-3.5 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <Input
                className="md:col-span-4"
                placeholder="Neue Aufgabe schnell anlegen…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) create();
                }}
              />
              <Input
                className="md:col-span-2"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <div className="md:col-span-2">
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Priorität" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        Prio: {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kunde (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Allgemein (Kein Kunde)</SelectItem>
                    {customerId &&
                      customerId !== "__none" &&
                      !(customers ?? []).some((c: any) => c.id === customerId) && (
                        <SelectItem value={customerId}>Ausgewählter Kunde</SelectItem>
                      )}
                    {(customers ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.last_name}, {c.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="md:col-span-1" onClick={create} disabled={!title.trim()} title="Aufgabe anlegen">
                <Plus className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Filter Panel */}
          <Card className="shrink-0 border-border/60 shadow-sm bg-card/80">
            <CardContent className="p-3.5 space-y-3">
              {/* Row 1: Status Tabs + Urgency Quick-Chips + Sort */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["offen", "erledigt", "alle"] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => setFilter(f)}
                    >
                      {f === "offen" ? "Offen" : f === "erledigt" ? "Erledigt" : "Alle"}
                    </Button>
                  ))}

                  <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

                  {/* Urgency Chips */}
                  {(
                    [
                      { key: "alle", label: "Alle Dringlichkeiten", dot: "" },
                      { key: "ueberfaellig", label: "Überfällig", dot: "bg-destructive" },
                      { key: "hoch", label: "Hoch", dot: "bg-warning" },
                      { key: "mittel", label: "Mittel", dot: "bg-info" },
                      { key: "niedrig", label: "Niedrig", dot: "bg-muted-foreground" },
                    ] as const
                  ).map((u) => {
                    const active = urgencyFilter === u.key;
                    const count = urgencyCounts[u.key];
                    return (
                      <Button
                        key={u.key}
                        variant={active ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setUrgencyFilter(u.key)}
                        className={`h-8 text-xs gap-1.5 px-2.5 ${
                          active
                            ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {u.dot && <span className={`h-2 w-2 rounded-full ${u.dot}`} />}
                        <span>{u.label}</span>
                        <span className="text-[11px] opacity-75">({count})</span>
                      </Button>
                    );
                  })}
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOrder)}>
                    <SelectTrigger className="h-8 text-xs w-[205px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgency">Sortierung: Dringlichkeit</SelectItem>
                      <SelectItem value="due_asc">Sortierung: Fälligkeitsdatum</SelectItem>
                      <SelectItem value="priority">Sortierung: Priorität (Hoch → Niedrig)</SelectItem>
                      <SelectItem value="newest">Sortierung: Neueste zuerst</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Date Filter, Priority, Source/Contract Type, Assignee, Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center pt-1 border-t border-border/40">
                {/* Date Quick Filter */}
                <div className="lg:col-span-3">
                  <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                    <SelectTrigger className="h-8 text-xs">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Zeitraum / Datum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Termine</SelectItem>
                      <SelectItem value="ueberfaellig">🔴 Überfällig</SelectItem>
                      <SelectItem value="heute">📅 Heute fällig</SelectItem>
                      <SelectItem value="morgen">🌤️ Morgen fällig</SelectItem>
                      <SelectItem value="woche">📆 Diese Woche (7 Tage)</SelectItem>
                      <SelectItem value="monat">🗓️ Diesen Monat</SelectItem>
                      <SelectItem value="ohne_datum">⚪ Ohne Fälligkeitsdatum</SelectItem>
                      <SelectItem value="zeitraum">🔍 Zeitraum (Von – Bis)…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Filter */}
                <div className="lg:col-span-2">
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Priorität" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Prioritäten</SelectItem>
                      <SelectItem value="hoch">Prio: Hoch</SelectItem>
                      <SelectItem value="mittel">Prio: Mittel</SelectItem>
                      <SelectItem value="niedrig">Prio: Niedrig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Source / Contract Type Filter */}
                <div className="lg:col-span-3">
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Herkunft / Vertragstyp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Quellen & Sparten</SelectItem>
                      <SelectItem value="auto">⚡ Nur Automatisch (Vertrag)</SelectItem>
                      <SelectItem value="manuell">✍️ Nur Manuell angelegt</SelectItem>
                      {CONTRACT_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {ct.icon} {ct.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee Filter */}
                <div className="lg:col-span-2">
                  <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <UserCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Zuständig" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Mitarbeiter</SelectItem>
                      <SelectItem value="mir">Nur meine Aufgaben</SelectItem>
                      {(profiles as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fulltext Search */}
                <div className="lg:col-span-2 relative flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Suchen…"
                      className="h-8 text-xs pl-8"
                    />
                  </div>
                  {hasActiveSubFilters && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={resetAllFilters}
                      title="Filter zurücksetzen"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Optional Custom Date Range Row */}
              {dateFilter === "zeitraum" && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40 text-xs">
                  <span className="font-medium text-muted-foreground">Zeitraum eingrenzen:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Von:</span>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-8 text-xs w-38"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Bis:</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-8 text-xs w-38"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      Datum löschen
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task List */}
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm">
            <div
              ref={listRef}
              onScroll={(e) => sessionStorage.setItem("scroll-pos-aufgaben", String(e.currentTarget.scrollTop))}
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-border/40"
            >
              {filtered.length === 0 && (
                <div className="p-10 text-center text-muted-foreground space-y-2">
                  <div>Keine Aufgaben für diese Filterauswahl gefunden.</div>
                  {hasActiveSubFilters && (
                    <Button variant="outline" size="sm" onClick={resetAllFilters}>
                      Alle Filter zurücksetzen
                    </Button>
                  )}
                </div>
              )}
              {filtered.map((t: any) => {
                const u = getTaskUrgency(t.due_date, t.status, t.priority);
                const prioMeta = taskPriorityMeta(t.priority);
                const assigneeName = t.assigned_to ? profileMap[t.assigned_to] : null;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTask(t)}
                    className={`p-4 flex items-start gap-4 transition-colors cursor-pointer border-l-4 ${u.borderClass} ${
                      selectedTask?.id === t.id ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-accent/30"
                    }`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={t.status === "erledigt"}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          await supabase
                            .from("tasks")
                            .update({ status: e.target.checked ? "erledigt" : "offen" })
                            .eq("id", t.id);
                          qc.invalidateQueries({ queryKey: ["tasks"] });
                          if (selectedTask?.id === t.id) {
                            setSelectedTask({ ...selectedTask, status: e.target.checked ? "erledigt" : "offen" });
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div
                          className={`font-semibold text-base ${
                            t.status === "erledigt"
                              ? "line-through text-muted-foreground opacity-60"
                              : "text-foreground"
                          }`}
                        >
                          {t.title}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {t.is_automated && (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-1.5 py-0 border-primary/40 text-primary bg-primary/10 gap-1"
                              title="Automatisch durch Vertrags-Regel erstellt"
                            >
                              <Zap className="h-3 w-3" />
                              Auto
                            </Badge>
                          )}
                          <Badge variant="outline" className={`text-[11px] px-2 py-0 ${prioMeta.badgeClass}`}>
                            Prio: {prioMeta.label}
                          </Badge>
                          <Badge className={`text-[11px] px-2 py-0 ${u.badgeClass}`}>
                            {u.label}
                          </Badge>
                        </div>
                      </div>

                      {t.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {t.description}
                        </div>
                      )}

                      <div className="text-xs mt-2 flex items-center gap-4 text-muted-foreground flex-wrap">
                        {t.customers && (
                          <span
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <User className="h-3.5 w-3.5" />
                            <Link
                              to="/kunden/$id"
                              params={{ id: t.customers.id }}
                              search={{ from: "/aufgaben" }}
                              onClick={() => sessionStorage.setItem("last-list-origin", "/aufgaben")}
                              className="hover:underline"
                            >
                              {t.customers.first_name} {t.customers.last_name}
                            </Link>
                          </span>
                        )}

                        {t.contracts && (
                          <span className="flex items-center gap-1 text-foreground/80 bg-accent/50 px-2 py-0.5 rounded-md">
                            <span>{contractTypeIcon(t.contracts.type)}</span>
                            <span>{t.contracts.provider}</span>
                            {t.contracts.referenz_id && (
                              <span className="text-muted-foreground">({t.contracts.referenz_id})</span>
                            )}
                          </span>
                        )}

                        {t.due_date && (
                          <span
                            className={`flex items-center gap-1.5 ${
                              u.key === "ueberfaellig" ? "text-destructive font-semibold" : ""
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Fällig {formatDate(t.due_date)}
                          </span>
                        )}

                        {assigneeName && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <UserCheck className="h-3.5 w-3.5" />
                            {assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 h-full min-h-0 flex flex-col">
          <TaskDetailsErrorBoundary onReset={() => setSelectedTask(null)}>
            {!selectedTask ? (
              /* Productivity Dashboard */
              <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Produktivität & Fokus
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {filtered.length} in Liste
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="relative h-24 w-24 shrink-0 flex items-center justify-center rounded-full border-8 border-primary/20">
                      <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-primary drop-shadow-[0_0_8px_oklch(var(--primary)/0.5)]"
                          strokeDasharray="289"
                          strokeDashoffset={289 - (289 * metrics.completionRate) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="text-xl font-bold">{metrics.completionRate}%</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold tracking-tight">{metrics.completedCount}</div>
                      <div className="text-sm text-muted-foreground">Erledigte Aufgaben</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("offen");
                        setUrgencyFilter("alle");
                        setDateFilter("alle");
                      }}
                      className="bg-accent/30 hover:bg-accent/50 transition-colors rounded-xl p-4 flex flex-col justify-center items-center text-center"
                    >
                      <div className="text-2xl font-bold mb-0.5">{metrics.openCount}</div>
                      <div className="text-xs text-muted-foreground">Offen gesamt</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("offen");
                        setUrgencyFilter("ueberfaellig");
                      }}
                      className="bg-red-500/10 hover:bg-red-500/15 transition-colors rounded-xl p-4 flex flex-col justify-center items-center text-center"
                    >
                      <div className="text-2xl font-bold text-red-500 mb-0.5">{metrics.overdueCount}</div>
                      <div className="text-xs text-red-500/80 font-medium">Überfällig</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("offen");
                        setDateFilter("heute");
                      }}
                      className="bg-warning/10 hover:bg-warning/20 transition-colors rounded-xl p-4 flex flex-col justify-center items-center text-center"
                    >
                      <div className="text-2xl font-bold text-warning-foreground mb-0.5">{metrics.dueTodayCount}</div>
                      <div className="text-xs text-muted-foreground font-medium">Heute fällig</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSourceFilter("auto");
                      }}
                      className="bg-primary/10 hover:bg-primary/15 transition-colors rounded-xl p-4 flex flex-col justify-center items-center text-center"
                    >
                      <div className="text-2xl font-bold text-primary mb-0.5">{metrics.automatedCount}</div>
                      <div className="text-xs text-muted-foreground font-medium">⚡ Automatisch</div>
                    </button>
                  </div>

                  {/* Automation Summary Card */}
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-primary" />
                        Vertrags-Automatisierung
                      </div>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        {rulesCount} Regeln aktiv
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Neue Verträge erzeugen je nach Sparte (Strom, Gas, GKV, PKV, Telekom, KFZ) automatisch die hinterlegten Checklisten-Aufgaben.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 border-primary/30 hover:bg-primary/10"
                      onClick={() => setAutomationOpen(true)}
                    >
                      Regeln verwalten & anpassen
                    </Button>
                  </div>

                  {metrics.overdueCount > 0 && (
                    <Card className="border-red-500/30 shadow-none bg-red-500/5">
                      <div className="p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-500">Prioritäts-Warteschlange</h4>
                          <p className="text-sm text-red-500/80 mt-1">
                            Sie haben {metrics.overdueCount} überfällige Aufgabe{metrics.overdueCount !== 1 ? "n" : ""}.
                            Bitte priorisieren Sie diese.
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </Card>
            ) : (
              /* Task Details Sidebar */
              <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-primary/20 shadow-sm">
                <div className="p-4 border-b border-border/40 bg-muted/30 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">Aufgabendetails</h2>
                    {selectedTask.is_automated && (
                      <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/10 gap-1">
                        <Zap className="h-3 w-3" /> Auto
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant={selectedTask.status === "erledigt" ? "default" : "outline"}
                    className={
                      selectedTask.status === "erledigt" ? "bg-green-600" : "border-primary/40 text-primary"
                    }
                  >
                    {selectedTask.status === "erledigt" ? "Erledigt" : "Offen"}
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Titel</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="font-medium bg-accent/20 border-border/50"
                    />
                  </div>

                  {selectedTask.contracts && (
                    <div className="rounded-lg border border-border/60 bg-accent/20 p-3 text-xs space-y-1">
                      <div className="text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        Verknüpfter Vertrag
                      </div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <span>{contractTypeIcon(selectedTask.contracts.type)}</span>
                        <span>{contractTypeLabel(selectedTask.contracts.type)}</span>
                        <span>– {selectedTask.contracts.provider}</span>
                      </div>
                      {selectedTask.contracts.referenz_id && (
                        <div className="text-muted-foreground">Referenz: {selectedTask.contracts.referenz_id}</div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fälligkeit</Label>
                      <Input
                        type="date"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        className="bg-accent/20 border-border/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Priorität</Label>
                      <Select value={editPriority} onValueChange={(v) => setEditPriority(v as TaskPriority)}>
                        <SelectTrigger className="bg-accent/20 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Kunde</Label>
                    <Select value={editCustomer} onValueChange={setEditCustomer}>
                      <SelectTrigger className="bg-accent/20 border-border/50">
                        <SelectValue placeholder="Allgemein (Kein Kunde)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Allgemein (Kein Kunde)</SelectItem>
                        {editCustomer &&
                          editCustomer !== "__none" &&
                          !(customers ?? []).some((c: any) => c.id === editCustomer) && (
                            <SelectItem value={editCustomer}>
                              {selectedTask.customers
                                ? `${selectedTask.customers.last_name ?? ""}, ${selectedTask.customers.first_name ?? ""}`.trim()
                                : "Zugewiesener Kunde"}
                            </SelectItem>
                          )}
                        {(customers ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.last_name}, {c.first_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Zuständiger Mitarbeiter</Label>
                    <Select value={editAssignee} onValueChange={setEditAssignee}>
                      <SelectTrigger className="bg-accent/20 border-border/50">
                        <SelectValue placeholder="Nicht zugewiesen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Nicht zugewiesen</SelectItem>
                        {(profiles as any[]).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Beschreibung (Optional)</Label>
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Fügen Sie weitere Details oder Notizen hinzu..."
                      className="min-h-[130px] resize-none bg-accent/20 border-border/50"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-border/40 bg-muted/10 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedTask(null)}>
                    Schließen
                  </Button>
                  <Button className="flex-1" onClick={saveTaskDetails}>
                    <Save className="h-4 w-4 mr-2" /> Speichern
                  </Button>
                </div>
              </Card>
            )}
          </TaskDetailsErrorBoundary>
        </div>
      </div>

      {/* Automation Rules Dialog */}
      <TaskAutomationManagerDialog open={automationOpen} onOpenChange={setAutomationOpen} />
    </div>
  );
}
