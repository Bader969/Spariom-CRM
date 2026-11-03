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
import { formatDate, getTaskUrgency } from "@/lib/crm-types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock, AlertCircle, Calendar, User, TrendingUp, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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

function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"alle" | "offen" | "erledigt">(() => getSavedAufgabenFilter("filter", "offen"));
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [customerId, setCustomerId] = useState<string>("__none");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Save filter changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("crm-filters-aufgaben", JSON.stringify({ filter }));
  }, [filter]);

  // States for Task Details Sidebar editing
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editCustomer, setEditCustomer] = useState("__none");

  const listRef = useRef<HTMLDivElement>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, customers(id, first_name, last_name)")
        .order("due_date", { nullsFirst: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => (tasks ?? []).filter((t) => (filter === "alle" ? true : t.status === filter)),
    [tasks, filter]
  );

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

  const { data: customers } = useQuery({
    queryKey: ["customers", "minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, first_name, last_name").order("last_name");
      return data ?? [];
    },
  });

  const create = async () => {
    if (!title.trim() || !user) return;
    const cid = !customerId || customerId === "__none" ? null : customerId;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), due_date: due || null,
      customer_id: cid, created_by: user.id, assigned_to: user.id,
    });
    if (error) toast.error(error.message);
    else { setTitle(""); setDue(""); setCustomerId("__none"); qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Aufgabe angelegt"); }
  };

  const handleSelectTask = (t: any) => {
    if (!t) return;
    setSelectedTask(t);
    setEditTitle(t.title || "");
    setEditDesc(t.description || "");
    setEditDue(t.due_date || "");
    const cid = t.customer_id ? String(t.customer_id) : "__none";
    setEditCustomer(cid);
  };

  const saveTaskDetails = async () => {
    if (!selectedTask) return;
    const cid = !editCustomer || editCustomer === "__none" ? null : editCustomer;
    const { error } = await supabase.from("tasks").update({
      title: editTitle.trim(),
      description: editDesc.trim(),
      due_date: editDue || null,
      customer_id: cid,
    }).eq("id", selectedTask.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Aufgabe aktualisiert");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask({ ...selectedTask, title: editTitle, description: editDesc, due_date: editDue, customer_id: cid });
    }
  };

  // Productivity Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let openCount = 0;
    let overdueCount = 0;
    let completedCount = 0;
    let dueTodayCount = 0;

    (tasks ?? []).forEach(t => {
      if (t.status === "erledigt") {
        completedCount++;
      } else {
        openCount++;
        if (t.due_date && t.due_date < todayStr) overdueCount++;
        if (t.due_date === todayStr) dueTodayCount++;
      }
    });

    const completionRate = (completedCount + openCount) > 0 
      ? Math.round((completedCount / (completedCount + openCount)) * 100) 
      : 0;

    return { openCount, overdueCount, completedCount, dueTodayCount, completionRate };
  }, [tasks]);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4 w-full max-w-[1920px]">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Aufgaben</h1>
          <p className="text-base text-muted-foreground font-medium">Manuelle To-dos für Kunden oder allgemein</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch flex-1 min-h-0">
        {/* Left Column: Form & Tasks List */}
        <div className="xl:col-span-2 h-full min-h-0 flex flex-col space-y-3">
          <Card className="shrink-0 border-border/60 shadow-sm">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-2">
              <Input className="md:col-span-5" placeholder="Aufgabentitel…" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input className="md:col-span-2" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              <div className="md:col-span-4">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Kunde (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Allgemein (Kein Kunde)</SelectItem>
                    {customerId && customerId !== "__none" && !(customers ?? []).some((c: any) => c.id === customerId) && (
                      <SelectItem value={customerId}>Ausgewählter Kunde</SelectItem>
                    )}
                    {(customers ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.last_name}, {c.first_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="md:col-span-1" onClick={create} disabled={!title.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 shrink-0">
            {(["offen", "erledigt", "alle"] as const).map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
                {f === "offen" ? "Offen" : f === "erledigt" ? "Erledigt" : "Alle"}
              </Button>
            ))}
          </div>

          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm">
            <div 
              ref={listRef}
              onScroll={(e) => sessionStorage.setItem("scroll-pos-aufgaben", String(e.currentTarget.scrollTop))}
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-border/40"
            >
              {filtered.length === 0 && <div className="p-10 text-center text-muted-foreground">Keine Aufgaben.</div>}
              {filtered.map((t: any) => {
                const u = getTaskUrgency(t.due_date, t.status);
                return (
                  <div 
                    key={t.id} 
                    onClick={() => handleSelectTask(t)}
                    className={`p-4 flex items-start gap-4 transition-colors cursor-pointer border-l-4 ${u.borderClass} ${selectedTask?.id === t.id ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-accent/30"}`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={t.status === "erledigt"}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          await supabase.from("tasks").update({ status: e.target.checked ? "erledigt" : "offen" }).eq("id", t.id);
                          qc.invalidateQueries({ queryKey: ["tasks"] });
                          if (selectedTask?.id === t.id) {
                            setSelectedTask({ ...selectedTask, status: e.target.checked ? "erledigt" : "offen" });
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-base ${t.status === "erledigt" ? "line-through text-muted-foreground opacity-60" : "text-foreground"}`}>
                        {t.title}
                      </div>
                      <div className="text-sm mt-1 flex items-center gap-4 text-muted-foreground flex-wrap">
                        {t.customers && (
                          <span className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
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
                        {t.due_date && (
                          <span className={`flex items-center gap-1.5 ${u.borderClass.includes("red") ? "text-red-500 font-medium" : ""}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            Fällig {formatDate(t.due_date)}
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
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Produktivität
                    </h3>
                    
                    <div className="flex items-center gap-6 mb-8">
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-accent/30 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                        <div className="text-2xl font-bold mb-1">{metrics.openCount}</div>
                        <div className="text-xs text-muted-foreground">Offen</div>
                      </div>
                      <div className="bg-red-500/10 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                        <div className="text-2xl font-bold text-red-500 mb-1">{metrics.overdueCount}</div>
                        <div className="text-xs text-red-500/80 font-medium">Überfällig</div>
                      </div>
                    </div>
                {metrics.overdueCount > 0 && (
                  <Card className="border-red-500/30 shadow-none bg-red-500/5 mt-4">
                    <div className="p-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-medium text-red-500">Prioritäts-Warteschlange</h4>
                        <p className="text-sm text-red-500/80 mt-1">
                          Sie haben {metrics.overdueCount} überfällige Aufgabe{metrics.overdueCount !== 1 ? 'n' : ''}. 
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
                  <h2 className="font-semibold text-lg">Aufgabendetails</h2>
                  <Badge variant={selectedTask.status === "erledigt" ? "default" : "outline"} 
                         className={selectedTask.status === "erledigt" ? "bg-green-600" : "border-primary/40 text-primary"}>
                    {selectedTask.status === "erledigt" ? "Erledigt" : "Offen"}
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Titel</Label>
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-medium bg-accent/20 border-border/50" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Kunde</Label>
                    <Select value={editCustomer} onValueChange={setEditCustomer}>
                      <SelectTrigger className="bg-accent/20 border-border/50"><SelectValue placeholder="Allgemein (Kein Kunde)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Allgemein (Kein Kunde)</SelectItem>
                        {editCustomer && editCustomer !== "__none" && !(customers ?? []).some((c: any) => c.id === editCustomer) && (
                          <SelectItem value={editCustomer}>
                            {selectedTask.customers
                              ? `${selectedTask.customers.last_name ?? ""}, ${selectedTask.customers.first_name ?? ""}`.trim()
                              : "Zugewiesener Kunde"}
                          </SelectItem>
                        )}
                        {(customers ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.last_name}, {c.first_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fälligkeit</Label>
                    <Input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} className="bg-accent/20 border-border/50" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Beschreibung (Optional)</Label>
                    <Textarea 
                      value={editDesc} 
                      onChange={e => setEditDesc(e.target.value)} 
                      placeholder="Fügen Sie weitere Details oder Notizen hinzu..."
                      className="min-h-[150px] resize-none bg-accent/20 border-border/50" 
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
    </div>
  );
}
