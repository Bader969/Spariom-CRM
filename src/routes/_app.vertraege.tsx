import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CONTRACT_STATUSES, CONTRACT_STATUS_BG, contractTypeIcon, contractTypeLabel,
  expireOverdueContracts, formatDate, CONTRACT_TYPES, contractStatusMeta, type ContractStatus
} from "@/lib/crm-types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useMemo, useDeferredValue } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { 
  Search, LayoutGrid, List as ListIcon, ArrowUpDown, RotateCcw, Calendar, 
  Building2, ChevronDown, UserCheck, PenTool, CalendarRange, Clock, User,
  AlertTriangle, Trash2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectDuplicates, type DuplicateInfo } from "@/lib/duplicate-detector";
import { ContractDuplicateDialog } from "@/components/ContractDuplicateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const searchSchema = z.object({
  herkunft: fallback(z.enum(["alle", "eigen", "fremd"]), "alle").default("alle"),
  view: fallback(z.enum(["kanban", "list"]), "list").default("list"),
  status: z.string().optional(),
  period: z.string().optional(),
});

export const Route = createFileRoute("/_app/vertraege")({
  validateSearch: zodValidator(searchSchema),
  component: KanbanBoard,
});

const getSavedVertraegeFilter = <T,>(key: string, fallbackVal: T): T => {
  try {
    const raw = sessionStorage.getItem("crm-filters-vertraege");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[key] !== undefined) return parsed[key];
    }
  } catch {}
  return fallbackVal;
};

function KanbanBoard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { herkunft, view, status: searchStatus, period: searchPeriod } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);

  const [q, setQ] = useState<string>(() => getSavedVertraegeFilter("q", ""));
  const deferredQ = useDeferredValue(q);

  const [contractType, setContractType] = useState<string>(() => getSavedVertraegeFilter("contractType", "__all"));
  const [statusFilter, setStatusFilter] = useState<string>(() => searchStatus || getSavedVertraegeFilter("statusFilter", "__all"));
  const [portalFilter, setPortalFilter] = useState<string>(() => getSavedVertraegeFilter("portalFilter", "__all"));
  const [beraterFilter, setBeraterFilter] = useState<string>(() => getSavedVertraegeFilter("beraterFilter", "__all"));
  const [erfasserFilter, setErfasserFilter] = useState<string>(() => getSavedVertraegeFilter("erfasserFilter", "__all"));
  const [periodFilter, setPeriodFilter] = useState<string>(() => searchPeriod || getSavedVertraegeFilter("periodFilter", "__all"));
  const [customFrom, setCustomFrom] = useState<string>(() => getSavedVertraegeFilter("customFrom", ""));
  const [customTo, setCustomTo] = useState<string>(() => getSavedVertraegeFilter("customTo", ""));
  const [dateBasis, setDateBasis] = useState<"created_at" | "start_date">(() => getSavedVertraegeFilter("dateBasis", "created_at"));
  const [sortBy, setSortBy] = useState<string>(() => getSavedVertraegeFilter("sortBy", "date_desc"));
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  // Sync search parameters from URL when navigating (e.g. from Dashboard KPIs)
  useEffect(() => {
    if (searchStatus && searchStatus !== statusFilter) {
      setStatusFilter(searchStatus);
    }
  }, [searchStatus]);

  useEffect(() => {
    if (searchPeriod && searchPeriod !== periodFilter) {
      setPeriodFilter(searchPeriod);
    }
  }, [searchPeriod]);

  const tableListRef = useRef<HTMLDivElement>(null);

  // Save filter changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("crm-filters-vertraege", JSON.stringify({
      q, contractType, statusFilter, portalFilter, beraterFilter, erfasserFilter, periodFilter, customFrom, customTo, dateBasis, sortBy
    }));
  }, [q, contractType, statusFilter, portalFilter, beraterFilter, erfasserFilter, periodFilter, customFrom, customTo, dateBasis, sortBy]);

  // Reset pagination limit when any filter changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [deferredQ, contractType, statusFilter, portalFilter, beraterFilter, erfasserFilter, periodFilter, customFrom, customTo, dateBasis, sortBy, herkunft]);

  // Fetch Profiles for Advisor & Creator names
  const { data: profiles } = useQuery({
    queryKey: ["profiles", "all"],
    staleTime: 300_000,
    gcTime: 900_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => {
      map.set(p.id, p.full_name ?? p.email ?? "—");
    });
    return map;
  }, [profiles]);

  const { data: rawContracts, isLoading } = useQuery({
    queryKey: ["contracts", "kanban"],
    staleTime: 120_000, // 2 minutes in-memory cache for silky smooth 0ms UI
    gcTime: 600_000, // Keep in memory for 10 minutes across page transitions
    queryFn: async () => {
      let all: any[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("contracts")
          .select("id, type, status, provider, vermittlungsportal, referenz_id, start_date, end_date, created_at, customer_id, is_fremdvertrag, fremd_quelle, created_by, details, customers(first_name, last_name, advisor_id, created_by, assigned_to)")
          .order("created_at", { ascending: false })
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        page++;
      }
      return all;
    },
  });

  // Pre-process contracts once for ultra-fast filtering & sorting
  const contracts = useMemo(() => {
    if (!rawContracts) return [];
    return rawContracts.map((c: any) => {
      const note = c.details?.statustext ?? c.details?.auftrag_statustext ?? c.details?.notiz ?? "";
      
      // Advisor resolution: details.berater_id -> details.berater_name -> customers.advisor_id
      const advId = c.details?.berater_id || c.customers?.advisor_id || null;
      const advName = c.details?.berater_name || (advId ? profileMap.get(advId) : null) || null;

      // Creator resolution: c.created_by -> details.erfasser_name -> customers.created_by -> customers.assigned_to
      const creatorId = c.created_by || c.customers?.created_by || c.customers?.assigned_to || null;
      const creatorName = c.details?.erfasser_name || (creatorId ? profileMap.get(creatorId) : null) || null;

      const createdDate = c.created_at ? String(c.created_at).slice(0, 10) : "";
      const startDate = c.start_date ? String(c.start_date).slice(0, 10) : "";

      return {
        ...c,
        _advisor_id: advId,
        _advisor_name: advName,
        _creator_id: creatorId,
        _creator_name: creatorName,
        _created_date: createdDate,
        _start_date: startDate,
        _created_ts: c.created_at ? new Date(c.created_at).getTime() : 0,
        _start_ts: c.start_date ? new Date(c.start_date).getTime() : 0,
        _end_ts: c.end_date ? new Date(c.end_date).getTime() : 0,
        _month_created: createdDate.slice(0, 7),
        _month_start: startDate.slice(0, 7),
        _search_str: `${c.customers?.first_name || ""} ${c.customers?.last_name || ""} ${c.provider || ""} ${c.referenz_id || ""} ${c.vermittlungsportal || ""} ${advName || ""} ${creatorName || ""} ${note}`.toLowerCase(),
        _display_note: note,
      };
    });
  }, [rawContracts, profileMap]);

  const { data: familyMembers } = useQuery({
    queryKey: ["family_members", "kanban"],
    staleTime: 120_000,
    gcTime: 600_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contract_family_members")
        .select("id, contract_id, relation, first_name, last_name");
      return data ?? [];
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

  // Portale Options (Memoized)
  const portalOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let noneCount = 0;
    (contracts ?? []).forEach((c: any) => {
      const p = c.vermittlungsportal?.trim();
      if (p) {
        counts.set(p, (counts.get(p) ?? 0) + 1);
      } else {
        noneCount++;
      }
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, cnt]) => ({ value: name, label: `${name} (${cnt})` }));
    if (noneCount > 0) {
      sorted.push({ value: "__none", label: `Ohne Portal (${noneCount})` });
    }
    return sorted;
  }, [contracts]);

  // Berater Options (Memoized with counts)
  const beraterOptions = useMemo(() => {
    const counts = new Map<string, { key: string; name: string; count: number }>();
    let noneCount = 0;

    (contracts ?? []).forEach((c: any) => {
      const key = c._advisor_id || c._advisor_name;
      const name = c._advisor_name || (c._advisor_id ? profileMap.get(c._advisor_id) : null);
      if (!key && !name) {
        noneCount++;
      } else {
        const id = key || name;
        const displayName = name || id;
        const existing = counts.get(id) || { key: id, name: displayName, count: 0 };
        existing.count++;
        counts.set(id, existing);
      }
    });

    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .map((b) => ({ value: b.key, label: `${b.name} (${b.count})` }));

    if (noneCount > 0) {
      sorted.push({ value: "__none", label: `Ohne Berater / Unbekannt (${noneCount})` });
    }
    return sorted;
  }, [contracts, profileMap]);

  // Erfasser Options (Memoized with counts)
  const erfasserOptions = useMemo(() => {
    const counts = new Map<string, { key: string; name: string; count: number }>();
    let noneCount = 0;

    (contracts ?? []).forEach((c: any) => {
      const key = c._creator_id || c._creator_name;
      const name = c._creator_name || (c._creator_id ? profileMap.get(c._creator_id) : null);
      if (!key && !name) {
        noneCount++;
      } else {
        const id = key || name;
        const displayName = name || id;
        const existing = counts.get(id) || { key: id, name: displayName, count: 0 };
        existing.count++;
        counts.set(id, existing);
      }
    });

    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .map((b) => ({ value: b.key, label: `${b.name} (${b.count})` }));

    if (noneCount > 0) {
      sorted.push({ value: "__none", label: `Ohne Erfasser (${noneCount})` });
    }
    return sorted;
  }, [contracts, profileMap]);

  // Dynamic Months List (Memoized)
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    (contracts ?? []).forEach((c: any) => {
      const ym = dateBasis === "start_date" ? c._month_start : c._month_created;
      if (ym && /^\d{4}-\d{2}$/.test(ym)) {
        months.add(ym);
      }
    });
    const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => {
        const [y, m] = ym.split("-");
        const monthIdx = parseInt(m, 10) - 1;
        const label = `${monthNames[monthIdx] ?? m} ${y}`;
        return { value: `month_${ym}`, label };
      });
  }, [contracts, dateBasis]);

  useEffect(() => {
    expireOverdueContracts(supabase).then((hasExpired) => {
      if (hasExpired) {
        qc.invalidateQueries({ queryKey: ["contracts", "kanban"] });
      }
    });
  }, [qc]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const contractId = e.active.id as string;
    const newStatus = e.over.id as ContractStatus;
    const c = contracts?.find((x) => x.id === contractId);
    if (!c || c.status === newStatus) return;

    qc.setQueryData<any>(["contracts", "kanban"], (old: any) =>
      (old ?? []).map((x: any) => (x.id === contractId ? { ...x, status: newStatus } : x))
    );

    const { error } = await supabase.from("contracts").update({ status: newStatus }).eq("id", contractId);
    if (error) {
      toast.error("Aktualisierung fehlgeschlagen", { description: error.message });
      qc.invalidateQueries({ queryKey: ["contracts", "kanban"] });
    } else {
      toast.success("Status aktualisiert");
    }
  };

  const all = contracts ?? [];
  const totalAll = all.length;
  const totalEigen = all.filter((c: any) => !c.is_fremdvertrag).length;
  const totalFremd = all.filter((c: any) => c.is_fremdvertrag).length;

  const duplicateMap = useMemo(() => detectDuplicates(all), [all]);

  const [onlyDuplicates, setOnlyDuplicates] = useState<boolean>(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    contract: any | null;
    partnerContract: any | null;
    reason: string;
  }>({ open: false, contract: null, partnerContract: null, reason: "" });

  const [contractToDelete, setContractToDelete] = useState<any | null>(null);
  const [isDeletingContract, setIsDeletingContract] = useState(false);

  const handleDeleteContract = async (contractId: string) => {
    setIsDeletingContract(true);
    try {
      const { error } = await supabase.from("contracts").delete().eq("id", contractId);
      if (error) {
        toast.error(`Fehler beim Löschen des Vertrags: ${error.message}`);
        throw error;
      }
      toast.success("Vertrag wurde erfolgreich gelöscht.");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setContractToDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingContract(false);
    }
  };

  const filtered = useMemo(() => {
    const s = deferredQ.trim().toLowerCase();
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed
    const curQuarter = Math.floor(curMonth / 3) + 1; // 1..4

    // Month strings
    const currentYm = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYearForMonth = curMonth === 0 ? curYear - 1 : curYear;
    const lastYm = `${prevYearForMonth}-${String(prevMonth + 1).padStart(2, "0")}`;

    // Quarter strings
    const prevQuarter = curQuarter === 1 ? 4 : curQuarter - 1;
    const prevYearForQuarter = curQuarter === 1 ? curYear - 1 : curYear;

    return all.filter((c: any) => {
      // Nur Dubletten Filter
      if (onlyDuplicates && !duplicateMap.has(c.id)) return false;

      // Herkunft
      if (herkunft === "eigen" && c.is_fremdvertrag) return false;
      if (herkunft === "fremd" && !c.is_fremdvertrag) return false;
      
      // Type & Status
      if (contractType !== "__all" && c.type !== contractType) return false;
      if (statusFilter !== "__all" && c.status !== statusFilter) return false;

      // Vermittlungsportal
      if (portalFilter === "__none") {
        if (c.vermittlungsportal?.trim()) return false;
      } else if (portalFilter !== "__all") {
        if (c.vermittlungsportal?.trim() !== portalFilter) return false;
      }

      // Berater Filter
      if (beraterFilter === "__me") {
        if (c._advisor_id !== user?.id) return false;
      } else if (beraterFilter === "__none") {
        if (c._advisor_id || c._advisor_name) return false;
      } else if (beraterFilter !== "__all") {
        if (c._advisor_id !== beraterFilter && c._advisor_name !== beraterFilter) return false;
      }

      // Erfasser Filter
      if (erfasserFilter === "__me") {
        if (c._creator_id !== user?.id) return false;
      } else if (erfasserFilter === "__none") {
        if (c._creator_id || c._creator_name) return false;
      } else if (erfasserFilter !== "__all") {
        if (c._creator_id !== erfasserFilter && c._creator_name !== erfasserFilter) return false;
      }

      // Zeitraum / Date Range Filter
      if (periodFilter !== "__all") {
        const dateStr = dateBasis === "start_date" ? c._start_date : c._created_date;
        const ym = dateBasis === "start_date" ? c._month_start : c._month_created;

        if (!dateStr) return false;

        if (periodFilter === "this_month") {
          if (ym !== currentYm) return false;
        } else if (periodFilter === "last_month") {
          if (ym !== lastYm) return false;
        } else if (periodFilter === "this_quarter") {
          const [y, m] = dateStr.split("-").map(Number);
          const q = Math.floor((m - 1) / 3) + 1;
          if (y !== curYear || q !== curQuarter) return false;
        } else if (periodFilter === "last_quarter") {
          const [y, m] = dateStr.split("-").map(Number);
          const q = Math.floor((m - 1) / 3) + 1;
          if (y !== prevYearForQuarter || q !== prevQuarter) return false;
        } else if (periodFilter === "this_year") {
          if (!dateStr.startsWith(`${curYear}-`)) return false;
        } else if (periodFilter === "last_year") {
          if (!dateStr.startsWith(`${curYear - 1}-`)) return false;
        } else if (periodFilter === "custom") {
          if (customFrom && dateStr < customFrom) return false;
          if (customTo && dateStr > customTo) return false;
        } else if (periodFilter.startsWith("month_")) {
          const targetYm = periodFilter.replace("month_", "");
          if (ym !== targetYm) return false;
        }
      }
      
      // Fulltext Search
      if (s) {
        if (!c._search_str.includes(s)) return false;
      }
      
      return true;
    }).sort((a: any, b: any) => {
      if (view === "kanban") return 0;
      switch (sortBy) {
        case "name_asc": return ((a.customers?.last_name || "") as string).localeCompare(b.customers?.last_name || "");
        case "name_desc": return ((b.customers?.last_name || "") as string).localeCompare(a.customers?.last_name || "");
        case "date_desc": return b._created_ts - a._created_ts;
        case "date_asc": return a._created_ts - b._created_ts;
        case "start_date_desc": return b._start_ts - a._start_ts;
        case "end_date": return a._end_ts - b._end_ts;
        default: return 0;
      }
    });
  }, [all, duplicateMap, onlyDuplicates, herkunft, contractType, statusFilter, portalFilter, beraterFilter, erfasserFilter, periodFilter, customFrom, customTo, dateBasis, deferredQ, sortBy, view, user]);

  const contractTypeOptions = CONTRACT_TYPES;
  const active = contracts?.find((c) => c.id === activeId);

  const hasActiveFilters = q !== "" || contractType !== "__all" || statusFilter !== "__all" || portalFilter !== "__all" || beraterFilter !== "__all" || erfasserFilter !== "__all" || periodFilter !== "__all" || customFrom !== "" || customTo !== "" || herkunft !== "alle" || onlyDuplicates;

  const resetFilters = () => {
    setQ("");
    setContractType("__all");
    setStatusFilter("__all");
    setPortalFilter("__all");
    setBeraterFilter("__all");
    setErfasserFilter("__all");
    setPeriodFilter("__all");
    setCustomFrom("");
    setCustomTo("");
    setHerkunft("alle");
    setOnlyDuplicates(false);
  };

  const setHerkunft = (v: "alle" | "eigen" | "fremd") =>
    navigate({ search: { herkunft: v, view }, replace: true });
    
  const setView = (v: "kanban" | "list") =>
    navigate({ search: { herkunft, view: v }, replace: true });

  const displayedList = useMemo(() => {
    return filtered.slice(0, visibleLimit);
  }, [filtered, visibleLimit]);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4 w-full max-w-[1920px]">
      <div className="shrink-0 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight">Vertrags-Pipeline</h1>
              <Badge variant="secondary" className="px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-xs">
                {filtered.length === totalAll ? (
                  <>Gesamt: {totalAll} Verträge</>
                ) : (
                  <>Gefiltert: {filtered.length} von {totalAll} Verträgen</>
                )}
              </Badge>
            </div>
            <p className="text-base text-muted-foreground font-medium mt-0.5">
              Verwaltung &amp; Übersicht aller Verträge ({filtered.length} von {totalAll} Verträgen gefunden)
            </p>
          </div>
          <div className="flex gap-1 rounded-md border p-1 bg-muted/30 ml-auto items-center">
            <FilterBtn active={view === "list"} onClick={() => setView("list")}>
              <ListIcon className="h-4 w-4 mr-1.5" /> Tabelle
            </FilterBtn>
            <FilterBtn active={view === "kanban"} onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4 mr-1.5" /> Kanban
            </FilterBtn>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suchen (Kunde, Anbieter, Ref, Berater, Notiz)..." className="pl-9 h-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] min-w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="w-[185px]">
              <SelectItem value="__all">Alle Status</SelectItem>
              {CONTRACT_STATUSES.map((st) => (
                <SelectItem key={st.value} value={st.value}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${
                      st.value === "aktiv" ? "bg-emerald-500" :
                      st.value === "in_pruefung" ? "bg-amber-500" :
                      st.value === "storniert" ? "bg-rose-500" :
                      st.value === "gekuendigt_wartet_neuabschluss" ? "bg-purple-500" : "bg-slate-400"
                    }`} />
                    <span>{st.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vermittlungsportal Filter */}
          <Select value={portalFilter} onValueChange={setPortalFilter}>
            <SelectTrigger className="w-[185px] min-w-[185px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Vermittlungsportal" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72 w-[240px]">
              <SelectItem value="__all">Alle Portale</SelectItem>
              {portalOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Berater Filter (NEU) */}
          <Select value={beraterFilter} onValueChange={setBeraterFilter}>
            <SelectTrigger className="w-[175px] min-w-[175px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                <SelectValue placeholder="Berater" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72 w-[230px]">
              <SelectItem value="__all">Alle Berater</SelectItem>
              <SelectItem value="__me">Nur meine Beratung</SelectItem>
              {beraterOptions.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Erfasser Filter (NEU) */}
          <Select value={erfasserFilter} onValueChange={setErfasserFilter}>
            <SelectTrigger className="w-[175px] min-w-[175px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <PenTool className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Erfasser" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72 w-[230px]">
              <SelectItem value="__all">Alle Erfasser</SelectItem>
              <SelectItem value="__me">Von mir erfasst</SelectItem>
              {erfasserOptions.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vertragsart Filter */}
          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="w-[160px] min-w-[160px] h-9"><SelectValue placeholder="Vertragsart" /></SelectTrigger>
            <SelectContent className="w-[190px]">
              <SelectItem value="__all">Alle Vertragsarten</SelectItem>
              {contractTypeOptions.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>{ct.icon} {ct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Zeitraum / Datumsbereich Filter */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[185px] min-w-[185px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Zeitraum" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-80 w-[240px]">
              <SelectItem value="__all">Gesamter Zeitraum</SelectItem>
              <SelectItem value="this_month">📅 Dieser Monat</SelectItem>
              <SelectItem value="last_month">📅 Letzter Monat</SelectItem>
              <SelectItem value="this_quarter">📅 Dieses Quartal</SelectItem>
              <SelectItem value="last_quarter">📅 Letztes Quartal</SelectItem>
              <SelectItem value="this_year">📅 Dieses Jahr</SelectItem>
              <SelectItem value="last_year">📅 Letztes Jahr</SelectItem>
              <SelectItem value="custom">📆 Eigener Datumsbereich…</SelectItem>
              {monthOptions.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Einzelne Monate</div>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Custom Date Range Inputs (wenn 'custom' gewählt) */}
          {periodFilter === "custom" && (
            <div className="flex items-center gap-1.5 bg-card border border-border/60 p-1 rounded-lg">
              <span className="text-xs text-muted-foreground pl-1">Von:</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 w-[130px] text-xs px-1.5"
              />
              <span className="text-xs text-muted-foreground">Bis:</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 w-[130px] text-xs px-1.5"
              />
            </div>
          )}

          {/* Datum-Basis Toggle (aktiv wenn Zeitraum gewählt) */}
          {periodFilter !== "__all" && (
            <Select value={dateBasis} onValueChange={(v: any) => setDateBasis(v)}>
              <SelectTrigger className="w-[170px] min-w-[170px] h-9 text-xs">
                <SelectValue placeholder="Datumsbezug" />
              </SelectTrigger>
              <SelectContent className="w-[195px]">
                <SelectItem value="created_at">Nach Erfassungsdatum</SelectItem>
                <SelectItem value="start_date">Nach Vertragsbeginn</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Sortierung (im Listenmodus) */}
          {view === "list" && (
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[215px] min-w-[215px] h-9">
                <div className="flex items-center gap-2 truncate">
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                  <SelectValue placeholder="Sortierung" />
                </div>
              </SelectTrigger>
              <SelectContent className="w-[240px]">
                <SelectItem value="date_desc">Neueste erfasst zuerst</SelectItem>
                <SelectItem value="date_asc">Älteste erfasst zuerst</SelectItem>
                <SelectItem value="start_date_desc">Vertragsbeginn (Neueste)</SelectItem>
                <SelectItem value="name_asc">Kundenname (A-Z)</SelectItem>
                <SelectItem value="name_desc">Kundenname (Z-A)</SelectItem>
                <SelectItem value="end_date">Ablaufdatum</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Herkunft Filters (Eigen / Fremd) */}
          <div className="flex gap-1 rounded-md border p-0.5 bg-muted/30">
            <FilterBtn active={herkunft === "alle"} onClick={() => setHerkunft("alle")}>
              Alle ({totalAll})
            </FilterBtn>
            <FilterBtn active={herkunft === "eigen"} onClick={() => setHerkunft("eigen")}>
              Eigen ({totalEigen})
            </FilterBtn>
            <FilterBtn active={herkunft === "fremd"} onClick={() => setHerkunft("fremd")}>
              Fremd ({totalFremd})
            </FilterBtn>
          </div>

          {/* Dubletten-Filter Button */}
          {duplicateMap.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant={onlyDuplicates ? "destructive" : "outline"}
              className={`h-9 text-xs font-semibold gap-1.5 transition-all ${
                onlyDuplicates
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs border-amber-600"
                  : "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-500/10 hover:bg-amber-500/20"
              }`}
              onClick={() => setOnlyDuplicates((prev) => !prev)}
              title="Nur Verträge mit Duplikaten oder Konflikten anzeigen"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Dubletten ({duplicateMap.size})
            </Button>
          )}

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-9 px-2.5 text-muted-foreground hover:text-foreground text-xs" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex-1 min-h-0 h-[calc(100vh-12rem)]">
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 h-full min-h-0">
              {CONTRACT_STATUSES.map((s) => {
                const items = filtered.filter((c) => c.status === s.value);
                return (
                  <Column
                    key={s.value}
                    status={s.value}
                    label={s.label}
                    items={items}
                    familyMap={familyMap}
                    duplicateMap={duplicateMap}
                    onOpenDuplicate={(contract, partnerContract, reason) => {
                      setDuplicateDialog({
                        open: true,
                        contract,
                        partnerContract,
                        reason,
                      });
                    }}
                    onDeleteContract={(c) => setContractToDelete(c)}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {active && <ContractCard contract={active} familyMembers={familyMap.get(active.id) ?? []} dragging />}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        <Card className="flex-1 min-h-0 h-[calc(100vh-12rem)] overflow-hidden flex flex-col">
          {/* Status- / Count-Leiste oberhalb der Tabelle */}
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">
                {filtered.length} {filtered.length === 1 ? "Vertrag" : "Verträge"}
              </span>
              {filtered.length !== totalAll ? (
                <Badge variant="outline" className="text-[11px] font-normal border-primary/30 text-primary bg-primary/5">
                  Gefiltert aus {totalAll} Verträgen
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">im System</span>
              )}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Zeige {Math.min(visibleLimit, filtered.length)} von {filtered.length}
            </div>
          </div>

          <div 
            ref={tableListRef}
            onScroll={(e) => {
              const target = e.currentTarget;
              sessionStorage.setItem("scroll-pos-vertraege-list", String(target.scrollTop));
              // Infinite progressive loading on scroll near bottom
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 300) {
                if (visibleLimit < filtered.length) {
                  setVisibleLimit((prev) => Math.min(prev + 100, filtered.length));
                }
              }
            }}
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10 border-b">
                <tr className="text-left">
                  <th className="px-3 py-3 font-semibold w-12 text-center text-muted-foreground">#</th>
                  <th className="px-4 py-3 font-semibold">Kunde</th>
                  <th className="px-4 py-3 font-semibold">Vertragsart</th>
                  <th className="px-4 py-3 font-semibold">Anbieter / Tarif</th>
                  <th className="px-4 py-3 font-semibold">Vermittlungsportal</th>
                  <th className="px-4 py-3 font-semibold">Berater &amp; Erfasser</th>
                  <th className="px-4 py-3 font-semibold">Status &amp; Notiz</th>
                  <th className="px-4 py-3 font-semibold">Beginn / Ablauf</th>
                  <th className="px-4 py-3 font-semibold">Herkunft</th>
                  <th className="px-3 py-3 font-semibold text-right w-16">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayedList.map((c: any, index: number) => {
                  const meta = contractStatusMeta(c.status);
                  const fMembers = familyMap.get(c.id) ?? [];
                  const note = c._display_note;
                  const dup = duplicateMap.get(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-accent/30 cursor-pointer transition-colors ${dup ? "bg-amber-500/5" : ""}`}
                      onClick={() => {
                        sessionStorage.setItem("last-list-origin", "/vertraege");
                        navigate({ to: "/kunden/$id", params: { id: c.customer_id }, search: { contract: c.id, from: "/vertraege" } as any });
                      }}
                    >
                      <td className="px-3 py-3 text-center text-xs font-mono font-medium text-muted-foreground/80">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium hover:underline">
                        <div className="font-semibold text-foreground">{c.customers?.last_name}, {c.customers?.first_name}</div>
                        {c.referenz_id && (
                          <div className="text-[11px] text-muted-foreground">Ref. {c.referenz_id}</div>
                        )}
                        {dup && (
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[11px] px-2 py-0.5 inline-flex items-center gap-1 font-semibold cursor-pointer hover:bg-amber-500/25 transition-colors shadow-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDuplicateDialog({
                                  open: true,
                                  contract: c,
                                  partnerContract: dup.partnerContracts[0] || null,
                                  reason: dup.primaryReason,
                                });
                              }}
                              title={dup.allReasons.join(" • ")}
                            >
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Dublette prüfen
                            </Badge>
                          </div>
                        )}
                        {fMembers.length > 0 && (
                          <div className="text-[11px] font-normal text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                            <span>👨‍👩‍👧 Mitversichert:</span>
                            {fMembers.map((m: any) => (
                              <Badge key={m.id} variant="outline" className="text-[10px] py-0 px-1 font-normal bg-accent/30">
                                {m.relation === "kind" ? "Kind" : "Ehegatte"}: {m.first_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{contractTypeIcon(c.type)}</span>
                          {fMembers.length > 0 && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-1.5 py-0.5 flex items-center gap-1 font-semibold">
                              👥 +{fMembers.length}
                            </Badge>
                          )}
                          <span>{contractTypeLabel(c.type)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.provider || "—"}</div>
                        {c.details?.tarif_name && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={c.details.tarif_name}>
                            {c.details.tarif_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.vermittlungsportal ? (
                          <Badge variant="outline" className="bg-muted/60 font-medium text-xs">
                            {c.vermittlungsportal}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      {/* Berater & Erfasser Spalte */}
                      <td className="px-4 py-3 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground text-[11px]">Berater:</span>
                          <span className="truncate">{c._advisor_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
                          <PenTool className="h-3 w-3 shrink-0" />
                          <span>Erfasser:</span>
                          <span className="truncate">{c._creator_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${meta.color} font-normal`} variant="secondary">
                          {meta.label}
                        </Badge>
                        {note && (
                          <div className="text-[11px] text-muted-foreground mt-1 max-w-[200px] truncate" title={note}>
                            📌 {note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.start_date && <div><span className="text-muted-foreground">Ab:</span> {formatDate(c.start_date)}</div>}
                        {c.end_date && <div><span className="text-muted-foreground">Bis:</span> {formatDate(c.end_date)}</div>}
                        {!c.start_date && !c.end_date && <span className="text-muted-foreground">Erfasst: {formatDate(c.created_at)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.is_fremdvertrag ? (
                          <Badge variant="outline" className="text-[10px] py-0 border-dashed">
                            Fremd{c.fremd_quelle ? ` · ${c.fremd_quelle}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0">Eigen</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Vertrag löschen"
                          onClick={() => setContractToDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Keine Verträge für die gewählten Filter gefunden</td></tr>
                )}
              </tbody>
            </table>

            {/* Load more button if not all rows are rendered */}
            {visibleLimit < filtered.length && (
              <div className="p-3 text-center border-t bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setVisibleLimit((prev) => Math.min(prev + 100, filtered.length))}
                >
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  Weitere 100 von {filtered.length - visibleLimit} Verträgen laden (Zeige {visibleLimit} von {filtered.length})
                </Button>
              </div>
            )}
          </div>

          {/* Footer mit Gesamtanzahl und Zähler */}
          <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span>
              Gesamtanzahl: <strong className="text-foreground">{filtered.length}</strong> {filtered.length === 1 ? "Vertrag" : "Verträge"} {filtered.length !== totalAll && <span className="text-muted-foreground font-normal">(gefiltert von {totalAll})</span>}
            </span>
            <span>
              Angezeigt: <strong>{Math.min(visibleLimit, filtered.length)}</strong> von <strong>{filtered.length}</strong>
            </span>
          </div>
        </Card>
      )}

      {/* Side-by-Side Dubletten Prüfungs-Dialog */}
      <ContractDuplicateDialog
        open={duplicateDialog.open}
        onOpenChange={(o) => setDuplicateDialog((prev) => ({ ...prev, open: o }))}
        contract={duplicateDialog.contract}
        partnerContract={duplicateDialog.partnerContract}
        reason={duplicateDialog.reason}
        onDeleteContract={handleDeleteContract}
      />

      {/* AlertDialog zum Löschen eines Vertrags */}
      <AlertDialog open={!!contractToDelete} onOpenChange={(val) => !val && setContractToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Vertrag unwiderruflich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diesen Vertrag ({contractToDelete?.provider || "Vertrag"} – Ref: {contractToDelete?.referenz_id || contractToDelete?.id?.slice(0, 8)}) wirklich endgültig löschen?
              <br /><br />
              Alle verknüpften Unterlagen und Daten zu diesem Vertrag werden dabei entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingContract}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isDeletingContract}
              onClick={() => {
                if (contractToDelete?.id) {
                  handleDeleteContract(contractToDelete.id);
                }
              }}
            >
              {isDeletingContract ? "Wird gelöscht…" : "Ja, Vertrag endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      className="h-8 text-xs font-medium"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Column({
  status,
  label,
  items,
  familyMap,
  duplicateMap,
  onOpenDuplicate,
  onDeleteContract,
}: {
  status: ContractStatus;
  label: string;
  items: any[];
  familyMap: Map<string, any[]>;
  duplicateMap: Map<string, DuplicateInfo>;
  onOpenDuplicate: (contract: any, partner: any, reason: string) => void;
  onDeleteContract: (contract: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [columnLimit, setColumnLimit] = useState<number>(40);

  const displayedItems = useMemo(() => {
    return items.slice(0, columnLimit);
  }, [items, columnLimit]);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg bg-muted/40 p-2 h-full flex flex-col min-h-0 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary" : ""}`}
    >
      <div className="px-2 py-2 flex items-center justify-between shrink-0 border-b border-border/40 mb-2">
        <h3 className="font-semibold text-sm tracking-tight">{label}</h3>
        <span className="text-xs font-medium text-muted-foreground bg-background border px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div 
        onScroll={(e) => {
          const target = e.currentTarget;
          if (target.scrollTop + target.clientHeight >= target.scrollHeight - 150) {
            if (columnLimit < items.length) {
              setColumnLimit((prev) => Math.min(prev + 40, items.length));
            }
          }
        }}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1 pb-1"
      >
        {displayedItems.map((c) => {
          const dup = duplicateMap.get(c.id);
          return (
            <ContractCard
              key={c.id}
              contract={c}
              familyMembers={familyMap.get(c.id) ?? []}
              duplicateInfo={dup}
              onOpenDuplicate={
                dup
                  ? () => onOpenDuplicate(c, dup.partnerContracts[0] || null, dup.primaryReason)
                  : undefined
              }
              onDelete={() => onDeleteContract(c)}
            />
          );
        })}

        {columnLimit < items.length && (
          <div className="pt-1 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-7 w-full text-muted-foreground"
              onClick={() => setColumnLimit((prev) => Math.min(prev + 40, items.length))}
            >
              + {items.length - columnLimit} weitere laden
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  familyMembers,
  dragging,
  duplicateInfo,
  onOpenDuplicate,
  onDelete,
}: {
  contract: any;
  familyMembers?: any[];
  dragging?: boolean;
  duplicateInfo?: DuplicateInfo;
  onOpenDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contract.id });
  const isFremd = !!contract.is_fremdvertrag;
  const fMembers = familyMembers ?? [];
  const note = contract._display_note;

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 cursor-grab active:cursor-grabbing border ${CONTRACT_STATUS_BG[contract.status as ContractStatus] ?? ""} ${
        duplicateInfo ? "border-amber-500/60 shadow-xs" : ""
      } ${isFremd ? "border-dashed border-2" : ""} ${isDragging ? "opacity-30" : ""} ${dragging ? "shadow-2xl rotate-2" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{contractTypeIcon(contract.type)}</span>
          {fMembers.length > 0 && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-1.5 py-0.5 flex items-center gap-1 font-semibold">
              👥 +{fMembers.length}
            </Badge>
          )}
        </div>
        <span className="text-xs font-medium">{contractTypeLabel(contract.type)}</span>
        {contract.vermittlungsportal && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-background/80 font-normal ml-auto">
            {contract.vermittlungsportal}
          </Badge>
        )}
        {isFremd && (
          <Badge variant="outline" className="text-[10px] py-0 px-1 border-dashed ml-auto">
            Fremd{contract.fremd_quelle ? ` · ${contract.fremd_quelle}` : ""}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        <Link
          to="/kunden/$id"
          params={{ id: contract.customer_id }}
          search={{ contract: contract.id, from: "/vertraege" }}
          onClick={(e) => {
            e.stopPropagation();
            sessionStorage.setItem("last-list-origin", "/vertraege");
          }}
          className="text-sm font-semibold hover:underline block truncate flex-1"
        >
          {contract.customers?.first_name} {contract.customers?.last_name}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {duplicateInfo && (
            <Badge
              variant="destructive"
              className="text-[10px] py-0 px-1.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDuplicate?.();
              }}
              title={duplicateInfo.primaryReason}
            >
              <AlertTriangle className="h-2.5 w-2.5" /> Dublette
            </Badge>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Vertrag löschen"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {contract.provider && (
        <div className="text-xs text-muted-foreground truncate font-medium">
          {contract.provider} {contract.details?.tarif_name ? `• ${contract.details.tarif_name}` : ""}
        </div>
      )}

      {/* Berater & Erfasser Badges auf Kanban Card */}
      {(contract._advisor_name || contract._creator_name) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
          {contract._advisor_name && (
            <Badge variant="outline" className="py-0 px-1 font-normal bg-primary/5 text-primary border-primary/20 flex items-center gap-0.5">
              <UserCheck className="h-2.5 w-2.5" /> {contract._advisor_name}
            </Badge>
          )}
          {contract._creator_name && contract._creator_name !== contract._advisor_name && (
            <Badge variant="outline" className="py-0 px-1 font-normal bg-muted/60 text-muted-foreground flex items-center gap-0.5">
              <PenTool className="h-2.5 w-2.5" /> {contract._creator_name}
            </Badge>
          )}
        </div>
      )}

      {fMembers.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40 space-y-1">
          <div className="font-medium text-foreground flex items-center gap-1">
            👨‍👩‍👧 Mitversichert ({fMembers.length}):
          </div>
          <div className="flex flex-wrap gap-1">
            {fMembers.map((m: any) => (
              <Badge key={m.id} variant="secondary" className="text-[10px] font-normal py-0 px-1.5 bg-accent/40 border border-border/40">
                {m.relation === "kind" ? "Kind" : "Ehegatte"}: {m.first_name} {m.last_name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {note && (
        <div className="mt-1.5 text-[11px] text-muted-foreground truncate" title={note}>
          📌 <span className="font-medium text-foreground/80">{note}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {contract.referenz_id && <span>Ref. {contract.referenz_id}</span>}
        {contract.start_date && <span>Ab {formatDate(contract.start_date)}</span>}
        {!contract.start_date && contract.end_date && <span>Bis {formatDate(contract.end_date)}</span>}
      </div>
    </Card>
  );
}
