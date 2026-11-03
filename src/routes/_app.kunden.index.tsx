import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CONTRACT_TYPES, contractTypeLabel, contractStatusMeta, formatDate } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Phone, Mail, ArrowUpDown, Building2, RotateCcw, ChevronDown, UserCheck, Sparkles, User, PenTool, Users, FileText } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";

export const Route = createFileRoute("/_app/kunden/")({
  component: KundenList,
});

const getSavedKundenFilter = <T,>(key: string, fallbackVal: T): T => {
  try {
    const raw = sessionStorage.getItem("crm-filters-kunden");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[key] !== undefined) return parsed[key];
    }
  } catch {}
  return fallbackVal;
};

function KundenList() {
  const { user } = useAuth();
  const [q, setQ] = useState<string>(() => getSavedKundenFilter("q", ""));
  const deferredQ = useDeferredValue(q);

  const [portalFilter, setPortalFilter] = useState<string>(() => getSavedKundenFilter("portalFilter", "__all"));
  const [beraterFilter, setBeraterFilter] = useState<string>(() => getSavedKundenFilter("beraterFilter", "__all"));
  const [personalityFilter, setPersonalityFilter] = useState<string>(() => getSavedKundenFilter("personalityFilter", "__all"));
  const [besitzer, setBesitzer] = useState<string>(() => getSavedKundenFilter("besitzer", "__all"));
  const [erfasser, setErfasser] = useState<string>(() => getSavedKundenFilter("erfasser", "__all"));
  const [contractType, setContractType] = useState<string>(() => getSavedKundenFilter("contractType", "__all"));
  const [sortBy, setSortBy] = useState<string>(() => getSavedKundenFilter("sortBy", "name_asc"));
  const [memberRole, setMemberRole] = useState<string>(() => getSavedKundenFilter("memberRole", "hauptmitglieder"));
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  // Save filter changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("crm-filters-kunden", JSON.stringify({
      q, portalFilter, beraterFilter, personalityFilter, besitzer, erfasser, contractType, sortBy, memberRole
    }));
  }, [q, portalFilter, beraterFilter, personalityFilter, besitzer, erfasser, contractType, sortBy, memberRole]);

  // Reset pagination limit on filter changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [deferredQ, portalFilter, beraterFilter, personalityFilter, besitzer, erfasser, contractType, sortBy, memberRole]);

  // Save and restore scroll position manually since explicit links (like the back arrow) create new history entries
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("scroll-kunden-list", window.scrollY.toString());
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", "list"],
    staleTime: 60_000,
    queryFn: async () => {
      // Paginated customers fetch to bypass PostgREST 1,000 limit (supports 5,000+ customers)
      let allCustomers: any[] = [];
      let cPage = 0;
      while (true) {
        const { data: chunk, error: custErr } = await supabase
          .from("customers")
          .select("id, first_name, last_name, phone, email, city, created_at, assigned_to, created_by, advisor_id, personality_type")
          .eq("status", "kunde")
          .order("created_at", { ascending: false })
          .range(cPage * 1000, (cPage + 1) * 1000 - 1);
        if (custErr) throw custErr;
        if (!chunk || chunk.length === 0) break;
        allCustomers = allCustomers.concat(chunk);
        if (chunk.length < 1000) break;
        cPage++;
      }
      const cs = allCustomers;

      const profileIds = Array.from(
        new Set(
          cs
            .flatMap((c) => [c.assigned_to, c.created_by, c.advisor_id])
            .filter((x): x is string => Boolean(x)),
        ),
      );
      const profileMap = new Map<string, string>();
      if (profileIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);
        (profs ?? []).forEach((p: any) =>
          profileMap.set(p.id, p.full_name ?? p.email ?? "—"),
        );
      }

      // Paginated family members fetch
      let allFamilyMembers: any[] = [];
      let fmPage = 0;
      while (true) {
        const { data: fmChunk, error: fmErr } = await (supabase as any)
          .from("contract_family_members")
          .select("first_name, last_name, contract_id")
          .range(fmPage * 1000, (fmPage + 1) * 1000 - 1);
        if (fmErr) break;
        if (!fmChunk || fmChunk.length === 0) break;
        allFamilyMembers = allFamilyMembers.concat(fmChunk);
        if (fmChunk.length < 1000) break;
        fmPage++;
      }

      const familyCountByContract = new Map<string, number>();
      allFamilyMembers.forEach((fm: any) => {
        if (fm.contract_id) {
          familyCountByContract.set(fm.contract_id, (familyCountByContract.get(fm.contract_id) ?? 0) + 1);
        }
      });

      const familyNameSet = new Set(
        allFamilyMembers.map((fm: any) => `${(fm.first_name || '').trim().toLowerCase()} ${(fm.last_name || '').trim().toLowerCase()}`)
      );

      const contractsByCustomer = new Map<string, any[]>();
      let allContracts: any[] = [];
      let page = 0;
      while (true) {
        const { data: contractsChunk, error: contractsError } = await supabase
          .from("contracts")
          .select("id, customer_id, type, status, provider, vermittlungsportal, details")
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (contractsError) {
          console.error("[Contracts Fetch Error in KundenList]:", contractsError);
          break;
        }
        if (!contractsChunk || contractsChunk.length === 0) break;
        allContracts = allContracts.concat(contractsChunk);
        if (contractsChunk.length < 1000) break;
        page++;
      }

      allContracts.forEach((ct: any) => {
        const arr = contractsByCustomer.get(ct.customer_id) ?? [];
        arr.push({
          ...ct,
          family_count: familyCountByContract.get(ct.id) ?? 0,
        });
        contractsByCustomer.set(ct.customer_id, arr);
      });
      return cs.map((c: any) => {
        const fName = (c.first_name || '').trim().toLowerCase();
        const lName = (c.last_name || '').trim().toLowerCase();
        const fullName = `${fName} ${lName}`;
        const cContracts = contractsByCustomer.get(c.id) ?? [];
        const isFamilyMemberOnly = familyNameSet.has(fullName) && cContracts.length === 0;
        const contractsSearchStr = cContracts.map((ct: any) => `${ct.provider || ""} ${ct.vermittlungsportal || ""} ${ct.details?.tarif_name || ""}`).join(" ").toLowerCase();

        return {
          ...c,
          _created_ts: c.created_at ? new Date(c.created_at).getTime() : 0,
          _search_str: `${c.first_name || ""} ${c.last_name || ""} ${c.city || ""} ${c.email || ""} ${c.phone || ""} ${contractsSearchStr}`.toLowerCase(),
          assigned_name: c.assigned_to ? profileMap.get(c.assigned_to) ?? null : null,
          creator_name: c.created_by ? profileMap.get(c.created_by) ?? null : null,
          advisor_name: c.advisor_id ? profileMap.get(c.advisor_id) ?? null : null,
          contracts: cContracts,
          is_family_member_only: isFamilyMemberOnly,
        };
      });
    },
  });

  const portalOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let noneCount = 0;
    (data ?? []).forEach((c: any) => {
      const portalsForCust = new Set<string>();
      (c.contracts ?? []).forEach((ct: any) => {
        if (ct.vermittlungsportal?.trim()) portalsForCust.add(ct.vermittlungsportal.trim());
      });
      if (portalsForCust.size === 0) {
        noneCount++;
      } else {
        portalsForCust.forEach((p) => {
          counts.set(p, (counts.get(p) ?? 0) + 1);
        });
      }
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, cnt]) => ({ value: name, label: `${name} (${cnt})` }));
    if (noneCount > 0) {
      sorted.push({ value: "__none", label: `Ohne Portal / Verträge (${noneCount})` });
    }
    return sorted;
  }, [data]);

  const beraterOptions = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    let noneCount = 0;
    (data ?? []).forEach((c: any) => {
      const advId = c.advisor_id || c.contracts?.find((ct: any) => ct.details?.berater_id)?.details?.berater_id;
      const advName = c.advisor_name || c.contracts?.find((ct: any) => ct.details?.berater_name)?.details?.berater_name;
      if (!advId && !advName) {
        noneCount++;
      } else {
        const key = advId || advName;
        const name = advName || "Berater";
        const existing = counts.get(key) || { id: key, name, count: 0 };
        existing.count++;
        counts.set(key, existing);
      }
    });
    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .map((b) => ({ id: b.id, label: `${b.name} (${b.count})` }));
    if (noneCount > 0) {
      sorted.push({ id: "__none", label: `Ohne Berater (${noneCount})` });
    }
    return sorted;
  }, [data]);

  const personalityOptions = useMemo(() => {
    const counts: Record<string, number> = { dominant: 0, initiativ: 0, gewissenhaft: 0, stetig: 0, none: 0 };
    (data ?? []).forEach((c: any) => {
      if (c.personality_type && counts[c.personality_type] !== undefined) {
        counts[c.personality_type]++;
      } else {
        counts.none++;
      }
    });
    return [
      { value: "dominant", label: `⚡ Dominant (${counts.dominant})` },
      { value: "initiativ", label: `🌟 Initiativ (${counts.initiativ})` },
      { value: "gewissenhaft", label: `📊 Gewissenhaft (${counts.gewissenhaft})` },
      { value: "stetig", label: `🌿 Stetig (${counts.stetig})` },
      { value: "__none", label: `Ohne Typ (${counts.none})` },
    ];
  }, [data]);

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

  const contractTypeOptions = CONTRACT_TYPES;

  const filtered = useMemo(() => {
    let result = data || [];
    if (memberRole === "hauptmitglieder") {
      result = result.filter((c: any) => !c.is_family_member_only);
    }
    const lower = deferredQ.trim().toLowerCase();
    if (lower) {
      result = result.filter((c: any) => c._search_str.includes(lower));
    }

    // Vermittlungsportal Filter
    if (portalFilter === "__none") {
      result = result.filter((c: any) => !c.contracts?.some((ct: any) => !!ct.vermittlungsportal?.trim()));
    } else if (portalFilter !== "__all") {
      result = result.filter((c: any) => c.contracts?.some((ct: any) => ct.vermittlungsportal?.trim() === portalFilter));
    }

    // Berater Filter
    if (beraterFilter === "__me") {
      result = result.filter((c: any) => c.advisor_id === user?.id || c.contracts?.some((ct: any) => ct.details?.berater_id === user?.id));
    } else if (beraterFilter === "__none") {
      result = result.filter((c: any) => !c.advisor_id && !c.contracts?.some((ct: any) => !!ct.details?.berater_id || !!ct.details?.berater_name));
    } else if (beraterFilter !== "__all") {
      result = result.filter((c: any) => c.advisor_id === beraterFilter || c.contracts?.some((ct: any) => ct.details?.berater_id === beraterFilter || ct.details?.berater_name === beraterFilter));
    }

    // Persönlichkeits Filter
    if (personalityFilter === "__none") {
      result = result.filter((c: any) => !c.personality_type);
    } else if (personalityFilter !== "__all") {
      result = result.filter((c: any) => c.personality_type === personalityFilter);
    }

    // Besitzer Filter
    if (besitzer === "__me") result = result.filter((c: any) => c.assigned_to === user?.id);
    else if (besitzer !== "__all") result = result.filter((c: any) => c.assigned_to === besitzer);
    
    // Erfasser Filter
    if (erfasser === "__me") result = result.filter((c: any) => c.created_by === user?.id);
    else if (erfasser !== "__all") result = result.filter((c: any) => c.created_by === erfasser);
    
    // Vertragsart Filter
    if (contractType !== "__all") {
      result = result.filter((c: any) => c.contracts?.some((ct: any) => ct.type === contractType));
    }

    const PERSONALITY_ORDER: Record<string, number> = {
      dominant: 1,
      initiativ: 2,
      gewissenhaft: 3,
      stetig: 4,
    };

    result.sort((a: any, b: any) => {
      if (sortBy === "name_asc") return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      if (sortBy === "name_desc") return (b.last_name ?? "").localeCompare(a.last_name ?? "");
      if (sortBy === "date_asc") return a._created_ts - b._created_ts;
      if (sortBy === "date_desc") return b._created_ts - a._created_ts;
      if (sortBy === "city_asc") return (a.city ?? "").localeCompare(b.city ?? "");
      if (sortBy === "personality_asc") {
        const rankA = PERSONALITY_ORDER[a.personality_type] ?? 99;
        const rankB = PERSONALITY_ORDER[b.personality_type] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      }
      if (sortBy === "personality_desc") {
        const rankA = PERSONALITY_ORDER[a.personality_type] ?? 99;
        const rankB = PERSONALITY_ORDER[b.personality_type] ?? 99;
        if (rankA !== rankB) {
          if (rankA === 99) return 1;
          if (rankB === 99) return -1;
          return rankB - rankA;
        }
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      }
      return 0;
    });
    return result;
  }, [data, memberRole, deferredQ, portalFilter, beraterFilter, personalityFilter, besitzer, erfasser, contractType, sortBy, user]);

  const hasActiveFilters = q !== "" || portalFilter !== "__all" || beraterFilter !== "__all" || personalityFilter !== "__all" || besitzer !== "__all" || erfasser !== "__all" || contractType !== "__all" || memberRole !== "hauptmitglieder";

  const resetFilters = () => {
    setQ("");
    setPortalFilter("__all");
    setBeraterFilter("__all");
    setPersonalityFilter("__all");
    setBesitzer("__all");
    setErfasser("__all");
    setContractType("__all");
    setMemberRole("hauptmitglieder");
  };

  const displayedCustomers = useMemo(() => {
    return filtered.slice(0, visibleLimit);
  }, [filtered, visibleLimit]);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Restore scroll position manually after data renders
  useEffect(() => {
    if (!isLoading && filtered.length > 0 && tableContainerRef.current) {
      const saved = sessionStorage.getItem("scroll-kunden-list");
      if (saved) {
        const pos = parseInt(saved, 10);
        requestAnimationFrame(() => {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = pos;
          }
        });
      }
    }
  }, [isLoading, filtered.length]);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8 space-y-4 w-full max-w-[1920px]">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">Kunden</h1>
            <p className="text-base text-muted-foreground font-medium">
              Verwaltung aller Kundenkontakte, Verträge und Details ({filtered.length} von {data?.length ?? 0} Kunden gefunden)
            </p>
          </div>
          <Link to="/kunden/neu">
            <Button size="lg" className="h-10 text-base px-5 font-semibold"><Plus className="h-5 w-5 mr-2" />Neuer Kunde</Button>
          </Link>
        </div>

        {/* Filter Toolbar with generous widths and clean overflow handling */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suche nach Name, E-Mail, Ort, Vertrag…" className="pl-9 h-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

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
            <SelectTrigger className="w-[180px] min-w-[180px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                <SelectValue placeholder="Berater" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72 w-[230px]">
              <SelectItem value="__all">Alle Berater</SelectItem>
              <SelectItem value="__me">Nur meine Beratung</SelectItem>
              {beraterOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Persönlichkeit Filter (NEU) */}
          <Select value={personalityFilter} onValueChange={setPersonalityFilter}>
            <SelectTrigger className="w-[180px] min-w-[180px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <SelectValue placeholder="Persönlichkeit" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[210px]">
              <SelectItem value="__all">Alle Persönlichkeiten</SelectItem>
              {personalityOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Besitzer */}
          <Select value={besitzer} onValueChange={setBesitzer}>
            <SelectTrigger className="w-[160px] min-w-[160px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Besitzer" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[190px]">
              <SelectItem value="__all">Alle Besitzer</SelectItem>
              <SelectItem value="__me">Nur meine</SelectItem>
              {besitzerOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Erfasser */}
          <Select value={erfasser} onValueChange={setErfasser}>
            <SelectTrigger className="w-[160px] min-w-[160px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <PenTool className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Erfasser" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[190px]">
              <SelectItem value="__all">Alle Erfasser</SelectItem>
              <SelectItem value="__me">Von mir erfasst</SelectItem>
              {erfasserOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vertragsart */}
          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="w-[160px] min-w-[160px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Vertragsart" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[185px]">
              <SelectItem value="__all">Alle Vertragsarten</SelectItem>
              {contractTypeOptions.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>{ct.icon} {ct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Kunden-Rolle */}
          <Select value={memberRole} onValueChange={setMemberRole}>
            <SelectTrigger className="w-[175px] min-w-[175px] h-9">
              <div className="flex items-center gap-1.5 truncate">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Kunden-Rolle" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[200px]">
              <SelectItem value="hauptmitglieder">Nur Hauptmitglieder</SelectItem>
              <SelectItem value="alle">Alle Kunden &amp; Angehörige</SelectItem>
            </SelectContent>
          </Select>

          {/* Sortierung */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[215px] min-w-[215px] h-9">
              <div className="flex items-center gap-2 truncate">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                <SelectValue placeholder="Sortierung" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-[230px]">
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="personality_asc">⚡🌟📊🌿 Persönlichkeit (A-Z)</SelectItem>
              <SelectItem value="personality_desc">🌿📊🌟⚡ Persönlichkeit (Z-A)</SelectItem>
              <SelectItem value="date_desc">Neuere zuerst</SelectItem>
              <SelectItem value="date_asc">Ältere zuerst</SelectItem>
              <SelectItem value="city_asc">Ort (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-9 px-2.5 text-muted-foreground hover:text-foreground text-xs" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading && <p className="text-sm text-muted-foreground p-2">Wird geladen…</p>}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch h-full min-h-0">
          {/* Left Column: Kunden Table */}
          <div className="xl:col-span-2 h-full min-h-0 flex flex-col">
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-border/60 shadow-sm">
              <div 
                ref={tableContainerRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  sessionStorage.setItem("scroll-kunden-list", String(target.scrollTop));
                  // Infinite progressive loading on scroll near bottom
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 300) {
                    if (visibleLimit < filtered.length) {
                      setVisibleLimit((prev) => Math.min(prev + 100, filtered.length));
                    }
                  }
                }}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar"
              >
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-md border-b border-border/50 shadow-sm">
                    <tr className="text-left">
                      <th className="px-4 py-3.5 font-semibold w-12 text-center">#</th>
                      <th className="px-4 py-3.5 font-semibold">Name</th>
                      <th className="px-4 py-3.5 font-semibold">Kontakt</th>
                      <th className="px-4 py-3.5 font-semibold">Verträge</th>
                      <th className="px-4 py-3.5 font-semibold">Ort</th>
                      <th className="px-4 py-3.5 font-semibold">Besitzer</th>
                      <th className="px-4 py-3.5 font-semibold">Erfasser</th>
                      <th className="px-4 py-3.5 font-semibold">Erstellt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {displayedCustomers.map((c: any, index: number) => {
                      const pMeta = getPersonalityMeta(c.personality_type);
                      const isSelected = selectedCustomer?.id === c.id;
                      
                      // Dynamic personality row styling
                      let rowStyleClass = "hover:bg-accent/30 border-l-4 border-l-transparent";
                      if (isSelected) {
                        rowStyleClass = "bg-primary/20 hover:bg-primary/30 border-l-4 border-l-primary shadow-sm";
                      } else if (c.personality_type === "dominant") {
                        rowStyleClass = "bg-red-500/10 hover:bg-red-500/20 border-l-4 border-l-red-500 dark:bg-red-950/25";
                      } else if (c.personality_type === "initiativ") {
                        rowStyleClass = "bg-amber-500/10 hover:bg-amber-500/20 border-l-4 border-l-amber-500 dark:bg-amber-950/25";
                      } else if (c.personality_type === "gewissenhaft") {
                        rowStyleClass = "bg-blue-500/10 hover:bg-blue-500/20 border-l-4 border-l-blue-500 dark:bg-blue-950/25";
                      } else if (c.personality_type === "stetig") {
                        rowStyleClass = "bg-emerald-500/10 hover:bg-emerald-500/20 border-l-4 border-l-emerald-500 dark:bg-emerald-950/25";
                      }

                      return (
                        <tr 
                          key={c.id} 
                          onClick={() => setSelectedCustomer(c)}
                          className={`cursor-pointer transition-colors duration-150 ${rowStyleClass}`}
                        >
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground tabular-nums">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link 
                                to="/kunden/$id" 
                                params={{ id: c.id }} 
                                search={{ from: "/kunden" }}
                                onClick={() => sessionStorage.setItem("last-list-origin", "/kunden")}
                                className="font-medium hover:underline"
                              >
                                {c.last_name}, {c.first_name}
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
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ContractIcons customerId={c.id} contracts={c.contracts} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.city ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.assigned_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.creator_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                        </tr>
                      );
                    })}
                    {!isLoading && filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Keine Kunden für die gewählten Filter gefunden</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Progressive load more button */}
                {visibleLimit < filtered.length && (
                  <div className="p-3 text-center border-t bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setVisibleLimit((prev) => Math.min(prev + 100, filtered.length))}
                    >
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      Weitere 100 von {filtered.length - visibleLimit} Kunden laden (Zeige {visibleLimit} von {filtered.length})
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Quick Preview Pane */}
          <div className="xl:col-span-1 h-full min-h-0 flex flex-col">
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-primary/20 shadow-sm">
              <div className="p-3.5 px-4 border-b border-border/50 bg-muted/50 backdrop-blur-md shrink-0 flex items-center justify-between">
                <h2 className="font-semibold text-base">Schnellansicht</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {!selectedCustomer ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                    <Search className="h-8 w-8 opacity-20" />
                    <p className="text-sm">Wählen Sie einen Kunden aus der Liste,<br/>um Details anzuzeigen.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold">
                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                      </h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {selectedCustomer.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedCustomer.phone}</div>}
                      {selectedCustomer.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {selectedCustomer.email}</div>}
                      {selectedCustomer.personality_type && (
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/40">
                          <span className="opacity-70 text-xs">DISG Typ:</span>
                          {(() => {
                            const pm = getPersonalityMeta(selectedCustomer.personality_type);
                            return pm ? (
                              <Badge variant="outline" className={`text-xs border ${pm.badgeClass}`}>
                                {pm.icon} {pm.label}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/40">
                        <span className="opacity-70">Ort:</span> {selectedCustomer.city ?? "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Besitzer:</span> {selectedCustomer.assigned_name ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Verträge</h4>
                    <div className="bg-accent/20 border border-border/50 rounded-md p-3">
                      <ContractIcons customerId={selectedCustomer.id} contracts={selectedCustomer.contracts} />
                      {(!selectedCustomer.contracts || selectedCustomer.contracts.length === 0) && (
                        <p className="text-xs text-muted-foreground">Keine Verträge gefunden.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-auto">
                    <Link 
                      to="/kunden/$id" 
                      params={{ id: selectedCustomer.id }} 
                      search={{ from: "/kunden" }}
                      onClick={() => sessionStorage.setItem("last-list-origin", "/kunden")}
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
      </div>
    </div>
  );
}

function ContractIcons({ customerId, contracts }: { customerId: string; contracts: any[] }) {
  if (!contracts || contracts.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const rank = (s: string) =>
    s === "aktiv" ? 0 : s === "in_pruefung" ? 1 : s === "gekuendigt_wartet_neuabschluss" ? 2 : 3;
  const sorted = [...contracts].sort((a, b) => rank(a.status) - rank(b.status));
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap gap-1">
        {sorted.map((ct) => {
          const cfg = CONTRACT_TYPES.find((x) => x.value === ct.type);
          const meta = contractStatusMeta(ct.status);
          const dim = ct.status === "storniert" || ct.status === "abgelaufen";
          const statustext = ct.details?.statustext ?? ct.details?.auftrag_statustext ?? ct.details?.notiz;
          return (
            <Tooltip key={ct.id}>
              <TooltipTrigger asChild>
                <Link
                  to="/kunden/$id"
                  params={{ id: customerId }}
                  search={{ contract: ct.id } as any}
                  className={`inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-md border bg-background hover:bg-accent text-sm leading-none ${dim ? "opacity-40" : ""}`}
                  aria-label={contractTypeLabel(ct.type)}
                >
                  <span className="text-base">{cfg?.icon ?? "📄"}</span>
                  {ct.family_count > 0 && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1 py-0 font-semibold leading-tight">
                      👥 +{ct.family_count}
                    </Badge>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-medium">{contractTypeLabel(ct.type)}</div>
                  <div className="text-muted-foreground">
                    {meta.label}{ct.provider ? ` • ${ct.provider}` : ""}
                    {ct.vermittlungsportal ? ` • ${ct.vermittlungsportal}` : ""}
                    {statustext ? ` • ${statustext}` : ""}
                    {ct.family_count > 0 && ` • ${ct.family_count} Familienmitglieder`}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function getPersonalityMeta(type: string | null) {
  switch (type) {
    case "D":
      return { label: "Dominant", icon: "🔴", badgeClass: "bg-red-500/10 text-red-700 border-red-200 dark:border-red-900/50" };
    case "I":
      return { label: "Initiativ", icon: "🟡", badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:border-yellow-900/50" };
    case "S":
      return { label: "Stetig", icon: "🟢", badgeClass: "bg-green-500/10 text-green-700 border-green-200 dark:border-green-900/50" };
    case "G":
      return { label: "Gewissenhaft", icon: "🔵", badgeClass: "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-900/50" };
    default:
      return null;
  }
}
