import { createFileRoute, Link, useNavigate, useSearch, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, MessageCircle, Plus, Edit, Trash2, Pencil, Users, Link2, HardDrive, AlertTriangle
} from "lucide-react";
import { CustomerDocumentManager } from "@/components/CustomerDocumentManager";
import { VerknuepfungenPanel } from "@/components/VerknuepfungenPanel";
import { useEffect, useRef, useState, useMemo } from "react";
import { formatDate, formatDateTime, whatsappLink, contractTypeIcon, contractTypeLabel, contractStatusMeta, leadSourceLabel, getRenewalState, formatDuration, getPersonalityMeta } from "@/lib/crm-types";
import { ContractDialog } from "@/components/ContractDialog";
import { ContractDetailDialog } from "@/components/ContractDetailDialog";
import { ContractDuplicateDialog } from "@/components/ContractDuplicateDialog";
import { detectDuplicates } from "@/lib/duplicate-detector";
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
import { ClarificationDialog } from "@/components/ClarificationDialog";
import { ClarificationCard } from "@/components/ClarificationCard";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kunden/$id")({
  validateSearch: (s: Record<string, unknown>): { contract?: string; from?: string } => ({
    contract: typeof s.contract === "string" ? s.contract : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: KundeDetail,
});

function KundeDetail() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== `/kunden/${id}`) {
    return <Outlet />;
  }
  return <KundeDetailView id={id} />;
}

function KundeDetailView({ id }: { id: string }) {
  const { contract: contractParam, from: fromParam } = useSearch({ from: "/_app/kunden/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const c = data as any;
      const userIds = Array.from(new Set([c.assigned_to, c.advisor_id, c.recorded_by].filter(Boolean))) as string[];
      let pmap = new Map<string, any>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      let team: any = null;
      if (c.team_id) {
        const { data: t } = await supabase.from("teams").select("name").eq("id", c.team_id).maybeSingle();
        team = t ?? null;
      }
      return {
        ...c,
        profiles: c.assigned_to ? pmap.get(c.assigned_to) ?? null : null,
        advisor: c.advisor_id ? pmap.get(c.advisor_id) ?? null : null,
        recorder: c.recorded_by ? pmap.get(c.recorded_by) ?? null : null,
        teams: team,
      };
    },
  });

  const { data: ownContracts } = useQuery({
    queryKey: ["contracts", "customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").eq("customer_id", id).order("created_at", { ascending: false });
      if (error) console.error("[Contracts Query Error]:", error);
      return data ?? [];
    },
  });

  // Household-Verträge (falls Kunde in einem Haushalt ist) ergänzen
  const { data: householdContracts } = useQuery({
    queryKey: ["contracts", "household-for-customer", id],
    queryFn: async () => {
      const { data: mem, error: memError } = await (supabase as any)
        .from("household_members")
        .select("household_id")
        .eq("customer_id", id)
        .maybeSingle();
      if (memError || !mem?.household_id) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*, customers!contracts_customer_id_fkey(id, first_name, last_name)")
        .eq("household_id", mem.household_id)
        .neq("customer_id", id);
      if (error) console.error("[Household Contracts Error]:", error);
      return data ?? [];
    },
  });

  const contracts = useMemo(() => {
    return [...(ownContracts ?? []), ...(householdContracts ?? [])];
  }, [ownContracts, householdContracts]);

  const contractIds = useMemo(() => (contracts ?? []).map((c: any) => c.id), [contracts]);
  const { data: familyMembers } = useQuery({
    queryKey: ["family_members", "customer", id, contractIds.join(",")],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_family_members")
        .select("*")
        .in("contract_id", contractIds);
      if (error) console.error("[Family Members Error]:", error);
      return data ?? [];
    },
  });

  const { data: kvDetails } = useQuery({
    queryKey: ["kv_details", "customer", id, contractIds.join(",")],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_kv_details")
        .select("*")
        .in("contract_id", contractIds);
      if (error) console.error("[KV Details Error]:", error);
      return data ?? [];
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) console.error("[Customer Notes Error]:", error);
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((n: any) => n.author_id).filter(Boolean))) as string[];
      let map = new Map<string, string>();
      if (ids.length) {
        const { data: profs, error: profsError } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        if (profsError) console.error("[Profiles Error]:", profsError);
        map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return rows.map((n: any) => ({ ...n, profiles: { full_name: map.get(n.author_id) ?? null } }));
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("customer_id", id)
        .order("due_date", { nullsFirst: false });
      if (error) console.error("[Tasks Error]:", error);
      return data ?? [];
    },
  });

  const { data: clarifications } = useQuery({
    queryKey: ["clarifications", "customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clarifications")
        .select("*, customers(id, first_name, last_name), contracts(id, type, provider)")
        .eq("customer_id", id)
        .order("due_date", { nullsFirst: false });
      if (error) console.error("[Clarifications Error]:", error);
      return data ?? [];
    },
  });

  const duplicateMap = useMemo(() => detectDuplicates(contracts ?? []), [contracts]);
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
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setContractToDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingContract(false);
    }
  };

  const [contractDialog, setContractDialog] = useState<{ open: boolean; contract: any | null }>({ open: false, contract: null });
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; contract: any | null }>({ open: false, contract: null });
  const [clarDialog, setClarDialog] = useState<{ open: boolean; clarification: any | null }>({ open: false, clarification: null });
  const [tab, setTab] = useState<string>("contracts");
  const contractRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const handledContractParamRef = useRef<string | null>(null);

  // Deeplink ?contract=<id>: Einmalig Tab "Verträge" öffnen und fokussieren
  useEffect(() => {
    if (!contractParam || contracts.length === 0) return;
    if (handledContractParamRef.current === contractParam) return;

    handledContractParamRef.current = contractParam;
    setTab("contracts");
    const t = setTimeout(() => {
      const el = contractRefs.current.get(contractParam);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2200);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [contractParam, contracts.length]);

  const deleteCustomer = async () => {
    if (!confirm("Diesen Kunden wirklich löschen? Alle Verträge und Notizen werden mitgelöscht.")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Kunde gelöscht"); navigate({ to: "/kunden" }); }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Wird geladen…</div>;
  if (!customer) return <div className="p-6 text-muted-foreground">Kunde nicht gefunden</div>;

  const isLead = customer.status === "interessent";
  const displayName = customer.first_name || customer.last_name
    ? `${customer.salutation ? customer.salutation + " " : ""}${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
    : "— ohne Name —";

  const convertToCustomer = async () => {
    if (!customer.first_name || !customer.last_name) {
      toast.error("Vorname und Nachname sind für Kunden Pflicht — bitte zuerst bearbeiten.");
      navigate({ to: "/kunden/$id/bearbeiten", params: { id } });
      return;
    }
    const { error } = await supabase
      .from("customers")
      .update({ status: "kunde" } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (user) {
      await supabase.from("customer_notes").insert({
        customer_id: id,
        author_id: user.id,
        content: "Interessent zu Kunde konvertiert.",
        note_type: "system",
      } as any);
    }
    toast.success("Zu Kunde konvertiert");
    qc.invalidateQueries({ queryKey: ["customer", id] });
    qc.invalidateQueries({ queryKey: ["interessenten"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const pMeta = getPersonalityMeta(customer.personality_type);
  const storedOrigin = typeof window !== "undefined" ? sessionStorage.getItem("last-list-origin") : null;
  const returnTarget = fromParam || storedOrigin || (isLead ? "/interessenten" : "/kunden");

  return (
    <div className="p-4 sm:p-6 lg:px-8 space-y-6 max-w-[1600px] w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link to={returnTarget} className="text-muted-foreground hover:text-foreground shrink-0" title="Zurück zur Liste"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {displayName}
              </h1>
              {isLead && (
                <Badge variant="outline" className="border-primary/40 text-primary">Interessent</Badge>
              )}
              {pMeta && (
                <Badge variant="outline" className={`border ${pMeta.badgeClass}`}>
                  <span className="mr-1">{pMeta.icon}</span> {pMeta.label}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isLead ? "Erfasst" : "Kunde seit"} {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLead && (
            <Button size="sm" onClick={convertToCustomer}>
              <Users className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Zu Kunde konvertieren</span>
            </Button>
          )}
          <Link to="/kunden/$id/bearbeiten" params={{ id }}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Bearbeiten</span></Button>
          </Link>
          {role === "admin" && (
            <Button variant="destructive" size="sm" onClick={deleteCustomer}>
              <Trash2 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Löschen</span>
            </Button>
          )}
        </div>
      </div>

      {pMeta && (
        <Card className={`border ${pMeta.borderColor} ${pMeta.bgLight} overflow-hidden shadow-sm`}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{pMeta.icon}</span>
                <h3 className="font-semibold text-sm">DISG-Verhaltenstyp: {pMeta.label}</h3>
                <span className="text-xs text-muted-foreground">• {pMeta.summary}</span>
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed pt-0.5">
                💡 <strong className="font-semibold">Vertriebs- &amp; Gesprächstipp:</strong> {pMeta.salesTip}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Kontakt</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer.phone && (
              <div className="flex items-center justify-between gap-2">
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 hover:underline">
                  <Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}
                </a>
                <a
                  href={whatsappLink(customer.phone, customer.first_name)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-success text-success-foreground hover:opacity-90"
                  title="WhatsApp Web öffnen"
                >
                  <MessageCircle className="h-3 w-3" />WhatsApp
                </a>
              </div>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 hover:underline">
                <Mail className="h-4 w-4 text-muted-foreground" />{customer.email}
              </a>
            )}
            {(customer.street || customer.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {customer.street && <div>{customer.street}</div>}
                  {(customer.zip || customer.city) && <div>{customer.zip} {customer.city}</div>}
                </div>
              </div>
            )}
            {customer.birthdate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />{formatDate(customer.birthdate)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Zuweisung & Herkunft</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Anlagedatum:</span> {formatDate(customer.created_at)}</div>
            <div><span className="text-muted-foreground">Mitarbeiter:</span> {(customer as any).profiles?.full_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Berater:</span> {(customer as any).advisor?.full_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Erfasser:</span> {(customer as any).recorder?.full_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Team:</span> {(customer as any).teams?.name ?? "—"}</div>
            <div>
              <span className="text-muted-foreground">Quelle:</span>{" "}
              {leadSourceLabel((customer as any).lead_source)}
              {(customer as any).lead_source_detail && <span className="text-muted-foreground"> · {(customer as any).lead_source_detail}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Verträge</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const ownContractsCount = contracts?.length ?? 0;
              const familyMembersCount = familyMembers?.length ?? 0;
              const totalUnits = ownContractsCount + familyMembersCount;
              const activeContractsCount = contracts?.filter((c) => c.status === "aktiv").length ?? 0;
              return (
                <>
                  <div className="text-2xl font-bold">{totalUnits}</div>
                  <div className="text-xs text-muted-foreground">
                    {ownContractsCount} {ownContractsCount === 1 ? "Vertrag" : "Verträge"}
                    {familyMembersCount > 0 && ` + ${familyMembersCount} Familienmitglieder`}
                    {` · ${activeContractsCount} aktiv`}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Allgemeine Notiz</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-glass flex-wrap">
            <TabsTrigger value="contracts">Verträge ({contracts?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 font-semibold text-primary">
              <HardDrive className="h-4 w-4" /> Dokumente
            </TabsTrigger>
            <TabsTrigger value="clarifications">Klärfälle ({(clarifications ?? []).length})</TabsTrigger>
            <TabsTrigger value="tasks">Aufgaben ({(tasks ?? []).length})</TabsTrigger>
            <TabsTrigger value="links">Verknüpfungen ({(customer as any)?.relations?.length ?? 0})</TabsTrigger>
          </TabsList>

        <TabsContent value="documents" className="mt-4">
          <CustomerDocumentManager 
            customerId={customer.id} 
            customerName={`${customer.last_name || ""}_${customer.first_name || ""}`} 
          />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">
              Gesamt: <strong className="text-foreground">{contracts?.length ?? 0}</strong> {contracts?.length === 1 ? "Vertrag" : "Verträge"}
            </span>
            <Button size="sm" onClick={() => setContractDialog({ open: true, contract: null })}>
              <Plus className="h-4 w-4 mr-2" />Neuer Vertrag
            </Button>
          </div>

          {duplicateMap.size > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Achtung:</strong> Es wurden <strong>{duplicateMap.size}</strong> Verträge mit identischen oder stark ähnlichen Merkmalen (z. B. gleiche Zählernummer oder Referenz-ID) erkannt.
                </span>
              </div>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium shrink-0">
                Klicken Sie auf „Dublette prüfen“ zum Bereinigen
              </span>
            </div>
          )}

          {(contracts ?? []).length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Noch keine Verträge erfasst.</CardContent></Card>
          )}
          {contracts?.map((c: any, index: number) => {
            const meta = contractStatusMeta(c.status);
            const renewal = getRenewalState({ type: c.type, end_date: c.end_date, status: c.status });
            const cMembers = (familyMembers ?? []).filter((m: any) => m.contract_id === c.id);
            const dup = duplicateMap.get(c.id);

            return (
              <Card key={c.id} className={`cursor-pointer hover:shadow-md transition-shadow ${dup?.isDuplicate ? "border-amber-500/40 bg-amber-500/5" : ""}`} onClick={() => setDetailDialog({ open: true, contract: c })}>
                <CardContent
                  ref={(el) => { contractRefs.current.set(c.id, el as HTMLDivElement | null); }}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md transition-shadow"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-muted-foreground/70 self-center px-1.5 py-0.5 rounded bg-muted/60">
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-2xl">{contractTypeIcon(c.type)}</span>
                      {cMembers.length > 0 && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-2 py-0.5 flex items-center gap-1 font-semibold">
                          👥 +{cMembers.length}
                        </Badge>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {contractTypeLabel(c.type)}
                        {c.is_fremdvertrag && (
                          <Badge variant="outline" className="text-xs">Fremdvertrag</Badge>
                        )}
                        {c.customer_id !== id && (
                          <Badge className="text-xs bg-info text-info-foreground">
                            Haushaltsvertrag · {(c as any).customers?.first_name ?? ""} {(c as any).customers?.last_name ?? ""}
                          </Badge>
                        )}
                        {dup?.isDuplicate && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-xs px-2 py-0.5 flex items-center gap-1 font-semibold cursor-pointer hover:bg-amber-500/25 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDuplicateDialog({
                                open: true,
                                contract: c,
                                partnerContract: dup.partnerContracts[0],
                                reason: dup.primaryReason,
                              });
                            }}
                            title={dup.primaryReason}
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            Dublette prüfen
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground break-words">
                        {c.provider ?? "—"}
                        {c.details?.tarif_name && ` – ${c.details.tarif_name}`}
                        {c.is_fremdvertrag && c.fremd_quelle && ` • Quelle: ${c.fremd_quelle}`}
                        {!c.is_fremdvertrag && c.vermittlungsportal && ` • ${c.vermittlungsportal}`}
                        {c.referenz_id && ` • Ref. ${c.referenz_id}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.start_date && `${formatDate(c.start_date)} – `}{formatDate(c.end_date)}
                        <span className="mx-2 opacity-50">|</span> Angelegt: {formatDate(c.created_at)}
                      </div>
                      {(c.details?.statustext || c.details?.notiz) && (
                        <div className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-muted-foreground">📌 Notiz / Status:</span>
                          <span className={
                            c.status === "storniert"
                              ? "text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded text-[11px]"
                              : "text-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded text-[11px]"
                          }>
                            {c.details.statustext ?? c.details.notiz}
                          </span>
                        </div>
                      )}
                      {(c.type === "gkv" || c.type === "pkv") && (() => {
                        const members = (familyMembers ?? []).filter((m: any) => m.contract_id === c.id);
                        const kv = (kvDetails ?? []).find((k: any) => k.contract_id === c.id);
                        const relLabel: Record<string, string> = { ehegatte: "Ehegatte/-in", kind: "Kind", sonstig: "Sonstige" };
                        return (
                          <>
                            {kv && (kv.kv_nummer || kv.familienstand) && (
                              <div className="text-xs text-muted-foreground mt-1">
                                📋 KV-Daten{kv.kv_nummer ? ` • Nr. ${kv.kv_nummer}` : ""}{kv.familienstand ? ` • ${kv.familienstand}` : ""}
                              </div>
                            )}
                            {members.length === 0 ? (
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                                <span>👨‍👩‍👧 Keine Familienangehörigen (z. B. Kinder) hinterlegt</span>
                                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); setContractDialog({ open: true, contract: c }); }}>
                                  + Kind/Angehörigen hinzufügen
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40 space-y-1.5">
                                <div className="font-medium text-foreground flex items-center justify-between gap-1.5 flex-wrap">
                                  <span>👨‍👩‍👧 Familienversicherung ({members.length} Mitglied{members.length === 1 ? "" : "er"}):</span>
                                  <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); setContractDialog({ open: true, contract: c }); }}>
                                    + Bearbeiten / Hinzufügen
                                  </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {members.map((m: any, idx: number) => (
                                    <Badge key={m.id ?? idx} variant="secondary" className="text-[11px] font-normal py-0.5 px-2 bg-accent/40 border border-border/50">
                                      <span className="font-medium text-foreground">{relLabel[m.relation] ?? m.relation}:</span>
                                      <span className="ml-1 font-medium">{m.first_name} {m.last_name}</span>
                                      {m.birthdate && <span className="ml-1 text-muted-foreground">(*{formatDate(m.birthdate)})</span>}
                                      {m.bisherig_art === "mitgliedschaft" ? (
                                        <span className="ml-1 text-[10px] text-info font-medium">· eigene Mitgliedschaft</span>
                                      ) : (
                                        <span className="ml-1 text-[10px] text-muted-foreground">· familienversichert</span>
                                      )}
                                      {m.versicherungsnummer && <span className="ml-1 text-[10px] text-muted-foreground">• KV-Nr: {m.versicherungsnummer}</span>}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                    {renewal.due && (
                      <Badge className="bg-warning text-warning-foreground">
                        {renewal.label}{renewal.daysLeft !== null && ` · ${formatDuration(renewal.daysLeft)}`}
                      </Badge>
                    )}
                    <Badge className={meta.color}>{meta.label}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setContractDialog({ open: true, contract: c }); }}
                      title="Vertrag bearbeiten"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContractToDelete(c);
                      }}
                      title="Vertrag löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <ContractDialog
            customerId={id}
            open={contractDialog.open}
            onOpenChange={(o) => setContractDialog({ open: o, contract: o ? contractDialog.contract : null })}
            contract={contractDialog.contract}
            key={contractDialog.contract?.id ?? "new"}
          />
          <ContractDetailDialog
            open={detailDialog.open}
            onOpenChange={(o) => setDetailDialog({ open: o, contract: o ? detailDialog.contract : null })}
            contract={detailDialog.contract}
            onEdit={(c) => setContractDialog({ open: true, contract: c })}
            onDelete={handleDeleteContract}
          />

          <ContractDuplicateDialog
            open={duplicateDialog.open}
            onOpenChange={(o) => setDuplicateDialog((prev) => ({ ...prev, open: o }))}
            contract={duplicateDialog.contract}
            partnerContract={duplicateDialog.partnerContract}
            reason={duplicateDialog.reason}
            onDeleteContract={handleDeleteContract}
          />

          {/* AlertDialog for deleting a contract from card */}
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

        </TabsContent>

        <TabsContent value="clarifications" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setClarDialog({ open: true, clarification: null })}>
              <Plus className="h-4 w-4 mr-2" />Neuer Klärfall
            </Button>
          </div>
          {(clarifications ?? []).length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Klärfälle.</CardContent></Card>
          )}
          <div className="grid grid-cols-1 gap-3">
            {clarifications?.map((c: any) => (
              <ClarificationCard key={c.id} c={c} onEdit={(cl) => setClarDialog({ open: true, clarification: cl })} />
            ))}
          </div>
          <ClarificationDialog
            key={clarDialog.clarification?.id ?? "new-cl"}
            open={clarDialog.open}
            onOpenChange={(o) => setClarDialog({ open: o, clarification: o ? clarDialog.clarification : null })}
            clarification={clarDialog.clarification}
            defaultCustomerId={id}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <TaskForm customerId={id} />
          {(tasks ?? []).length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Aufgaben.</CardContent></Card>
          )}
          {tasks?.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={t.status === "erledigt"}
                    onChange={async (e) => {
                      await supabase.from("tasks").update({ status: e.target.checked ? "erledigt" : "offen" }).eq("id", t.id);
                      qc.invalidateQueries({ queryKey: ["tasks"] });
                    }}
                  />
                  <div>
                    <div className={`font-medium ${t.status === "erledigt" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                    {t.due_date && <div className="text-xs text-muted-foreground">Fällig: {formatDate(t.due_date)}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="links" className="space-y-3">
          <VerknuepfungenPanel customer={customer as any} />
        </TabsContent>
        </Tabs>
        </div>

        {/* Right Sidebar - Sticky Contextual Timeline */}
        <div className="xl:col-span-1 xl:sticky top-20">
          <Card className="h-[calc(100vh-120px)] flex flex-col border-primary/20">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/30">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Engagement Historie</span>
                <Badge variant="secondary" className="text-xs">
                  {notes?.length ?? 0} Einträge
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              <NoteForm customerId={id} />
              
              <div className="relative border-l-2 border-muted pl-4 ml-2 space-y-6 mt-6">
                {(notes ?? []).length === 0 && (
                  <div className="text-sm text-muted-foreground">Noch keine Einträge vorhanden.</div>
                )}
                {notes?.map((n: any) => (
                  <div key={n.id} className="relative">
                    <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={n.note_type === "anruf" ? "default" : n.note_type === "system" ? "outline" : "secondary"} className="text-[10px] px-1 py-0 h-4">
                        {n.note_type === "anruf" ? "Anruf" : n.note_type === "system" ? "System" : "Notiz"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {n.profiles?.full_name ?? "Unbekannt"} • {formatDateTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90 bg-accent/20 p-3 rounded-md rounded-tl-none border border-border/50">
                      {n.content}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NoteForm({ customerId }: { customerId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const submit = async () => {
    if (!content.trim() || !user) return;
    const { error } = await supabase.from("customer_notes").insert({
      customer_id: customerId, author_id: user.id, content: content.trim(), note_type: "notiz",
    });
    if (error) toast.error(error.message);
    else { setContent(""); qc.invalidateQueries({ queryKey: ["notes", customerId] }); toast.success("Notiz hinzugefügt"); }
  };
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Textarea placeholder="Neue Notiz hinzufügen…" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!content.trim()}>
            <Plus className="h-4 w-4 mr-1" />Hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({ customerId }: { customerId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const submit = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("tasks").insert({
      customer_id: customerId, created_by: user.id, assigned_to: user.id,
      title: title.trim(), due_date: due || null,
    });
    if (error) toast.error(error.message);
    else { setTitle(""); setDue(""); qc.invalidateQueries({ queryKey: ["tasks", customerId] }); toast.success("Aufgabe angelegt"); }
  };
  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
        <Input placeholder="Neue Aufgabe…" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" />
        <Button size="sm" onClick={submit} disabled={!title.trim()}>Hinzufügen</Button>
      </CardContent>
    </Card>
  );
}
