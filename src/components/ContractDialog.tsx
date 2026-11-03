import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CONTRACT_TYPES, CONTRACT_STATUSES, isValidIBAN, type ContractType, type ContractStatus } from "@/lib/crm-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

type FamilyRelation = "ehegatte" | "kind";
type Geschlecht = "" | "m" | "w" | "d";
type Verwandtschaft = "" | "leiblich" | "stief" | "enkel" | "pflege";
type BisherigArt = "" | "mitgliedschaft" | "familienversicherung" | "nicht_gesetzlich";
type Familienstand = "" | "ledig" | "verheiratet" | "getrennt" | "geschieden" | "verwitwet";

type FamilyMember = {
  id?: string;
  relation: FamilyRelation;
  first_name: string;
  last_name: string;
  birthdate: string;
  versicherungsnummer: string;
  geschlecht: Geschlecht;
  verwandtschaft: Verwandtschaft;
  geburtsname: string;
  geburtsort: string;
  geburtsland: string;
  staatsangehoerigkeit: string;
  bisherig_kasse: string;
  bisherig_ende: string;
  bisherig_art: BisherigArt;
  abweichende_anschrift: string;
};

type KvDetails = {
  geschlecht: Geschlecht;
  familienstand: Familienstand;
  geburtsort: string;
  geburtsland: string;
  staatsangehoerigkeit: string;
  kv_nummer: string;
  vorherige_kasse: string;
  vorherige_kasse_ende: string;
};

const emptyKvDetails = (): KvDetails => ({
  geschlecht: "",
  familienstand: "",
  geburtsort: "",
  geburtsland: "",
  staatsangehoerigkeit: "",
  kv_nummer: "",
  vorherige_kasse: "",
  vorherige_kasse_ende: "",
});

const emptyMember = (relation: FamilyRelation): FamilyMember => ({
  relation,
  first_name: "",
  last_name: "",
  birthdate: "",
  versicherungsnummer: "",
  geschlecht: "",
  verwandtschaft: "",
  geburtsname: "",
  geburtsort: "",
  geburtsland: "",
  staatsangehoerigkeit: "",
  bisherig_kasse: "",
  bisherig_ende: "",
  bisherig_art: "",
  abweichende_anschrift: "",
});

export function ContractDialog({
  customerId, open, onOpenChange, contract,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  contract?: any | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!contract;

  const [type, setType] = useState<ContractType>(contract?.type ?? "energie_strom");
  const [status, setStatus] = useState<ContractStatus>(contract?.status ?? "in_pruefung");
  const [isFremd, setIsFremd] = useState<boolean>(contract?.is_fremdvertrag ?? false);
  const [fremdQuelle, setFremdQuelle] = useState(contract?.fremd_quelle ?? "");
  const [provider, setProvider] = useState(contract?.provider ?? "");
  const [vermittlungsportal, setVermittlungsportal] = useState(contract?.vermittlungsportal ?? "");
  const [referenz, setReferenz] = useState(contract?.referenz_id ?? "");
  const [startDate, setStartDate] = useState(contract?.start_date ?? "");
  const [endDate, setEndDate] = useState(contract?.end_date ?? "");
  const [monthly, setMonthly] = useState(contract?.monthly_amount ?? "");
  const [commission, setCommission] = useState(contract?.commission ?? "");
  const [iban, setIban] = useState(contract?.iban ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"selbstzahler" | "lastschrift">(
    contract?.payment_method ?? "lastschrift"
  );
  const [details, setDetails] = useState<Record<string, string>>(() => {
    const d = { ...(contract?.details ?? {}) } as Record<string, string>;
    if (!d.tarif && d.tarif_name) d.tarif = d.tarif_name;
    return d;
  });
  const [householdId, setHouseholdId] = useState<string | null>(contract?.household_id ?? null);
  const [submitting, setSubmitting] = useState(false);

  // Haushalt des Kunden laden (für optionalen Haushaltsvertrag)
  const { data: customerHousehold } = useQuery({
    queryKey: ["contract-dialog-household", customerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("household_members")
        .select("household:households(id, name)")
        .eq("customer_id", customerId)
        .maybeSingle();
      return (data?.household ?? null) as { id: string; name: string } | null;
    },
  });

  // Familienversicherung
  const [hasFamily, setHasFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // KV-Stammdaten Hauptmitglied
  const [kv, setKv] = useState<KvDetails>(emptyKvDetails());

  const isKV = type === "gkv" || type === "pkv";

  // Bestehende Familienmitglieder + KV-Details laden
  useEffect(() => {
    if (!open || !isEdit || !contract?.id || !isKV) return;
    (async () => {
      const [famRes, kvRes] = await Promise.all([
        (supabase as any)
          .from("contract_family_members")
          .select("*")
          .eq("contract_id", contract.id)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("contract_kv_details")
          .select("*")
          .eq("contract_id", contract.id)
          .maybeSingle(),
      ]);
      if (famRes.data && famRes.data.length > 0) {
        setHasFamily(true);
        setFamilyMembers(
          famRes.data.map((m: any) => ({
            id: m.id,
            relation: m.relation,
            first_name: m.first_name ?? "",
            last_name: m.last_name ?? "",
            birthdate: m.birthdate ?? "",
            versicherungsnummer: m.versicherungsnummer ?? "",
            geschlecht: m.geschlecht ?? "",
            verwandtschaft: m.verwandtschaft ?? "",
            geburtsname: m.geburtsname ?? "",
            geburtsort: m.geburtsort ?? "",
            geburtsland: m.geburtsland ?? "",
            staatsangehoerigkeit: m.staatsangehoerigkeit ?? "",
            bisherig_kasse: m.bisherig_kasse ?? "",
            bisherig_ende: m.bisherig_ende ?? "",
            bisherig_art: m.bisherig_art ?? "",
            abweichende_anschrift: m.abweichende_anschrift ?? "",
          }))
        );
      }
      if (kvRes.data) {
        setKv({
          geschlecht: kvRes.data.geschlecht ?? "",
          familienstand: kvRes.data.familienstand ?? "",
          geburtsort: kvRes.data.geburtsort ?? "",
          geburtsland: kvRes.data.geburtsland ?? "",
          staatsangehoerigkeit: kvRes.data.staatsangehoerigkeit ?? "",
          kv_nummer: kvRes.data.kv_nummer ?? "",
          vorherige_kasse: kvRes.data.vorherige_kasse ?? "",
          vorherige_kasse_ende: kvRes.data.vorherige_kasse_ende ?? "",
        });
      }
    })();
  }, [open, isEdit, contract?.id, isKV]);

  const updateDetail = (k: string, v: string) => setDetails((d) => ({ ...d, [k]: v }));
  const updateKv = (patch: Partial<KvDetails>) => setKv((k) => ({ ...k, ...patch }));

  const addMember = (relation: FamilyRelation) =>
    setFamilyMembers((m) => [...m, emptyMember(relation)]);
  const removeMember = (i: number) => setFamilyMembers((m) => m.filter((_, idx) => idx !== i));
  const updateMember = (i: number, patch: Partial<FamilyMember>) =>
    setFamilyMembers((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!user) return;
    const isEnergieLocal = type === "energie_strom" || type === "energie_gas";
    if (isEnergieLocal && !referenz.trim()) {
      toast.error("Referenz-ID / Auftragsnummer ist bei Energieverträgen Pflicht.");
      return;
    }
    if (isEnergieLocal && paymentMethod === "lastschrift" && !iban.trim()) {
      toast.error("IBAN ist bei Lastschrift Pflicht.");
      return;
    }
    if (iban && !isValidIBAN(iban)) {
      toast.error("IBAN ist nicht gültig");
      return;
    }
    if (isKV && hasFamily) {
      for (const m of familyMembers) {
        if (!m.first_name.trim() || !m.last_name.trim()) {
          toast.error("Bitte Vor- und Nachname für alle Familienmitglieder angeben.");
          return;
        }
      }
    }
    setSubmitting(true);
    const effectiveIban =
      isEnergieLocal && paymentMethod === "selbstzahler"
        ? null
        : iban
          ? iban.replace(/\s+/g, "").toUpperCase()
          : null;
    const payload: any = {
      customer_id: customerId,
      type, status,
      is_fremdvertrag: isFremd,
      fremd_quelle: isFremd ? (fremdQuelle || null) : null,
      provider: provider || null,
      vermittlungsportal: isKV ? null : (isFremd ? null : (vermittlungsportal || null)),
      referenz_id: isKV ? null : (referenz || null),
      start_date: startDate || null,
      end_date: endDate || null,
      monthly_amount: monthly ? Number(monthly) : null,
      commission: isFremd ? null : (commission ? Number(commission) : null),
      iban: effectiveIban,
      payment_method: isEnergieLocal ? paymentMethod : null,
      details: { ...details, ...(details.tarif ? { tarif_name: details.tarif } : {}) },
      household_id: householdId,
      created_by: user.id,
    };
    const res = isEdit
      ? await supabase.from("contracts").update(payload).eq("id", contract.id).select("id").maybeSingle()
      : await supabase.from("contracts").insert(payload).select("id").maybeSingle();
    if (res.error) {
      setSubmitting(false);
      toast.error("Speichern fehlgeschlagen", { description: res.error.message });
      return;
    }
    const contractId = (res.data as any)?.id ?? contract?.id;

    if (isKV && contractId) {
      // KV-Stammdaten upsert
      const kvHasAny = Object.values(kv).some((v) => v !== "" && v !== null);
      if (kvHasAny) {
        const kvPayload = {
          contract_id: contractId,
          geschlecht: kv.geschlecht || null,
          familienstand: kv.familienstand || null,
          geburtsort: kv.geburtsort || null,
          geburtsland: kv.geburtsland || null,
          staatsangehoerigkeit: kv.staatsangehoerigkeit || null,
          kv_nummer: kv.kv_nummer || null,
          vorherige_kasse: kv.vorherige_kasse || null,
          vorherige_kasse_ende: kv.vorherige_kasse_ende || null,
        };
        const { error: kvErr } = await (supabase as any)
          .from("contract_kv_details")
          .upsert(kvPayload, { onConflict: "contract_id" });
        if (kvErr) {
          setSubmitting(false);
          toast.error("KV-Stammdaten konnten nicht gespeichert werden", { description: kvErr.message });
          return;
        }
      } else {
        await (supabase as any).from("contract_kv_details").delete().eq("contract_id", contractId);
      }

      // Familienmitglieder sync
      await (supabase as any).from("contract_family_members").delete().eq("contract_id", contractId);
      if (hasFamily && familyMembers.length > 0) {
        const rows = familyMembers.map((m) => ({
          contract_id: contractId,
          relation: m.relation,
          first_name: m.first_name.trim(),
          last_name: m.last_name.trim(),
          birthdate: m.birthdate || null,
          versicherungsnummer: m.versicherungsnummer || null,
          geschlecht: m.geschlecht || null,
          verwandtschaft: m.relation === "kind" ? (m.verwandtschaft || null) : null,
          geburtsname: m.geburtsname || null,
          geburtsort: m.geburtsort || null,
          geburtsland: m.geburtsland || null,
          staatsangehoerigkeit: m.staatsangehoerigkeit || null,
          bisherig_kasse: m.bisherig_kasse || null,
          bisherig_ende: m.bisherig_ende || null,
          bisherig_art: m.bisherig_art || null,
          abweichende_anschrift: m.abweichende_anschrift || null,
        }));
        const { error: famErr } = await (supabase as any).from("contract_family_members").insert(rows);
        if (famErr) {
          setSubmitting(false);
          toast.error("Familienmitglieder konnten nicht gespeichert werden", { description: famErr.message });
          return;
        }
      }
    }

    setSubmitting(false);
    toast.success(isEdit ? "Vertrag aktualisiert" : "Vertrag angelegt");
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["customer", customerId] });
    qc.invalidateQueries({ queryKey: ["customers", "list"] });
    qc.invalidateQueries({ queryKey: ["family_members"] });
    qc.invalidateQueries({ queryKey: ["kv_details"] });
    onOpenChange(false);
  };

  const isEnergie = type === "energie_strom" || type === "energie_gas";
  const providerLabel = isKV ? "Krankenkasse" : "Anbieter";
  const providerPlaceholder = isKV ? "z. B. TK, AOK, Barmer…" : "z. B. E.ON, Vodafone…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Vertrag bearbeiten" : "Neuer Vertrag"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-md border p-3 bg-muted/30">
            <div>
              <Label htmlFor="fremd-switch" className="font-medium">Fremdvertrag</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Aktivieren, wenn dieser Vertrag nicht von uns vermittelt wurde (kein Abschluss, keine Provision).
              </p>
            </div>
            <Switch id="fremd-switch" checked={isFremd} onCheckedChange={setIsFremd} />
          </div>

          {isFremd && (
            <div className="space-y-2">
              <Label>Quelle des Fremdvertrags</Label>
              <Input
                value={fremdQuelle}
                onChange={(e) => setFremdQuelle(e.target.value)}
                placeholder="z. B. Mitgebracht vom Kunden, Altvertrag…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vertragsart *</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContractType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{providerLabel}</Label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={providerPlaceholder} />
            </div>
            {!isFremd && !isKV && (
              <div className="space-y-2">
                <Label>Vermittlungsportal</Label>
                <Input value={vermittlungsportal} onChange={(e) => setVermittlungsportal(e.target.value)} placeholder="z. B. Stromkreis, Teleson" />
              </div>
            )}
          </div>

          {!isKV && (
            <div className="space-y-2">
              <Label>
                Referenz-ID / Auftragsnummer{isEnergie ? " *" : ""}
              </Label>
              <Input
                value={referenz}
                onChange={(e) => setReferenz(e.target.value)}
                className={isEnergie && !referenz.trim() ? "border-destructive" : ""}
              />
              {isEnergie && !referenz.trim() && (
                <p className="text-xs text-destructive">Pflichtfeld bei Energieverträgen.</p>
              )}
            </div>
          )}

          {customerHousehold && (
            <div className="flex items-center justify-between gap-3 rounded-md border p-3 bg-muted/30">
              <div>
                <Label className="cursor-pointer">Als Haushaltsvertrag markieren</Label>
                <p className="text-xs text-muted-foreground">
                  Sichtbar für alle Mitglieder des Haushalts „{customerHousehold.name}" (z. B. DSL, Kabel, Strom-Hausanschluss).
                </p>
              </div>
              <Switch
                checked={householdId === customerHousehold.id}
                onCheckedChange={(b) => setHouseholdId(b ? customerHousehold.id : null)}
              />
            </div>
          )}


          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vertragsbeginn</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vertragsende</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monatl. Betrag (€)</Label>
              <Input type="number" step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            {!isFremd && (
              <div className="space-y-2">
                <Label>Provision (€)</Label>
                <Input type="number" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} />
              </div>
            )}
          </div>

          {isEnergie && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                <Label>Zahlweise *</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "selbstzahler" | "lastschrift")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selbstzahler">Selbstzahler (Kunde überweist selbst — keine IBAN nötig)</SelectItem>
                    <SelectItem value="lastschrift">SEPA-Lastschriftmandat (IBAN erforderlich)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "lastschrift" && (
                <div className="space-y-2">
                  <Label>IBAN *</Label>
                  <Input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    className={iban && !isValidIBAN(iban) ? "border-destructive" : ""}
                  />
                  {iban && !isValidIBAN(iban) && (
                    <p className="text-xs text-destructive">IBAN-Format ungültig.</p>
                  )}
                  {!iban.trim() && (
                    <p className="text-xs text-muted-foreground">Pflicht bei Lastschrift.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Spezifische Daten</h4>
            <TypeSpecificFields type={type} details={details} update={updateDetail} />
          </div>

          {isKV && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">Stammdaten Hauptmitglied (KV)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Geschlecht</Label>
                  <Select value={kv.geschlecht || undefined} onValueChange={(v) => updateKv({ geschlecht: v as Geschlecht })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Männlich</SelectItem>
                      <SelectItem value="w">Weiblich</SelectItem>
                      <SelectItem value="d">Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Familienstand</Label>
                  <Select value={kv.familienstand || undefined} onValueChange={(v) => updateKv({ familienstand: v as Familienstand })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ledig">Ledig</SelectItem>
                      <SelectItem value="verheiratet">Verheiratet</SelectItem>
                      <SelectItem value="getrennt">Getrennt</SelectItem>
                      <SelectItem value="geschieden">Geschieden</SelectItem>
                      <SelectItem value="verwitwet">Verwitwet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Geburtsort" v={kv.geburtsort} on={(v) => updateKv({ geburtsort: v })} />
                <Field label="Geburtsland" v={kv.geburtsland} on={(v) => updateKv({ geburtsland: v })} />
                <Field label="Staatsangehörigkeit" v={kv.staatsangehoerigkeit} on={(v) => updateKv({ staatsangehoerigkeit: v })} />
                <Field label="KV-Nummer (Versichertennr.)" v={kv.kv_nummer} on={(v) => updateKv({ kv_nummer: v })} />
                <Field label="Vorherige Krankenkasse" v={kv.vorherige_kasse} on={(v) => updateKv({ vorherige_kasse: v })} />
                <Field label="Ende vorherige Versicherung" v={kv.vorherige_kasse_ende} on={(v) => updateKv({ vorherige_kasse_ende: v })} type="date" />
              </div>
            </div>
          )}

          {isKV && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-start justify-between gap-3 rounded-md border p-3 bg-muted/30">
                <div>
                  <Label htmlFor="family-switch" className="font-medium">Familienversicherung</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasFamily
                      ? "Familienangehörige (Ehegatte, Kinder) werden mit erfasst."
                      : "Nein, es reicht mit den angegebenen Daten."}
                  </p>
                </div>
                <Switch
                  id="family-switch"
                  checked={hasFamily}
                  onCheckedChange={(v) => {
                    setHasFamily(v);
                    if (!v) setFamilyMembers([]);
                  }}
                />
              </div>

              {hasFamily && (
                <div className="space-y-3">
                  {familyMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground">Noch keine Mitglieder hinzugefügt.</p>
                  )}

                  {familyMembers.length > 0 && (
                    <Accordion type="multiple" className="space-y-2">
                      {familyMembers.map((m, i) => {
                        const title = `${m.relation === "ehegatte" ? "Ehegatte/-in" : "Kind"} — ${m.first_name || "—"} ${m.last_name || ""}`.trim();
                        return (
                          <AccordionItem key={i} value={`m-${i}`} className="rounded-md border px-3">
                            <AccordionTrigger className="hover:no-underline">
                              <span className="text-sm font-medium">{title}</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-3 space-y-2">
                              <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(i)}>
                                  <Trash2 className="h-4 w-4 mr-1" /> Entfernen
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Beziehung</Label>
                                  <Select value={m.relation} onValueChange={(v) => updateMember(i, { relation: v as FamilyRelation })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ehegatte">Ehegatte/-in</SelectItem>
                                      <SelectItem value="kind">Kind</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Geschlecht</Label>
                                  <Select value={m.geschlecht || undefined} onValueChange={(v) => updateMember(i, { geschlecht: v as Geschlecht })}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="m">Männlich</SelectItem>
                                      <SelectItem value="w">Weiblich</SelectItem>
                                      <SelectItem value="d">Divers</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Vorname</Label>
                                  <Input value={m.first_name} onChange={(e) => updateMember(i, { first_name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Nachname</Label>
                                  <Input value={m.last_name} onChange={(e) => updateMember(i, { last_name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Geburtsdatum</Label>
                                  <Input type="date" value={m.birthdate} onChange={(e) => updateMember(i, { birthdate: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Versicherungsnummer (optional)</Label>
                                  <Input value={m.versicherungsnummer} onChange={(e) => updateMember(i, { versicherungsnummer: e.target.value })} />
                                </div>

                                {m.relation === "kind" && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Verwandtschaft</Label>
                                    <Select value={m.verwandtschaft || undefined} onValueChange={(v) => updateMember(i, { verwandtschaft: v as Verwandtschaft })}>
                                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="leiblich">Leiblich</SelectItem>
                                        <SelectItem value="stief">Stiefkind</SelectItem>
                                        <SelectItem value="enkel">Enkelkind</SelectItem>
                                        <SelectItem value="pflege">Pflegekind</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                <div className="space-y-1">
                                  <Label className="text-xs">Geburtsname</Label>
                                  <Input value={m.geburtsname} onChange={(e) => updateMember(i, { geburtsname: e.target.value })} placeholder="Geburtsname" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Geburtsort</Label>
                                  <Input value={m.geburtsort} onChange={(e) => updateMember(i, { geburtsort: e.target.value })} placeholder="z. B. Berlin" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Geburtsland</Label>
                                  <Input value={m.geburtsland} onChange={(e) => updateMember(i, { geburtsland: e.target.value })} placeholder="z. B. DE" />
                                </div>
                                <div className={`space-y-1 ${m.relation === "kind" ? "col-span-2" : ""}`}>
                                  <Label className="text-xs">Staatsangehörigkeit</Label>
                                  <Input value={m.staatsangehoerigkeit} onChange={(e) => updateMember(i, { staatsangehoerigkeit: e.target.value })} placeholder="z. B. DE" />
                                </div>

                                <div className="col-span-2 pt-2 border-t">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Bisherige Versicherung</p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Art</Label>
                                  <Select value={m.bisherig_art || undefined} onValueChange={(v) => updateMember(i, { bisherig_art: v as BisherigArt })}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="mitgliedschaft">Mitgliedschaft</SelectItem>
                                      <SelectItem value="familienversicherung">Familienversicherung</SelectItem>
                                      <SelectItem value="nicht_gesetzlich">Nicht gesetzlich</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Bisherige Kasse</Label>
                                  <Input value={m.bisherig_kasse} onChange={(e) => updateMember(i, { bisherig_kasse: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Endete am</Label>
                                  <Input type="date" value={m.bisherig_ende} onChange={(e) => updateMember(i, { bisherig_ende: e.target.value })} />
                                </div>

                                <div className="space-y-1 col-span-2">
                                  <Label className="text-xs">Abweichende Anschrift (optional)</Label>
                                  <Textarea
                                    value={m.abweichende_anschrift}
                                    onChange={(e) => updateMember(i, { abweichende_anschrift: e.target.value })}
                                    placeholder="Nur ausfüllen, wenn abweichend zum Hauptmitglied"
                                    rows={2}
                                  />
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addMember("ehegatte")}>
                      <Plus className="h-4 w-4 mr-1" /> Ehegatte/-in
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addMember("kind")}>
                      <Plus className="h-4 w-4 mr-1" /> Kind
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Speichern…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeSpecificFields({
  type, details, update,
}: { type: ContractType; details: Record<string, string>; update: (k: string, v: string) => void }) {
  if (type === "energie_strom" || type === "energie_gas") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marktlokationsnummer (MaLo, 11-stellig)" v={details.marktlokationsnummer} on={(v) => update("marktlokationsnummer", v)} />
        <Field label="Zählpunktbezeichnung" v={details.zaehlpunkt} on={(v) => update("zaehlpunkt", v)} />
        <Field label="Zählernummer" v={details.zaehlernummer} on={(v) => update("zaehlernummer", v)} />
        <Field label="Aktueller Zählerstand" v={details.zaehlerstand} on={(v) => update("zaehlerstand", v)} />
        <Field label="Jahresverbrauch (kWh)" v={details.verbrauch_kwh} on={(v) => update("verbrauch_kwh", v)} type="number" />
        <Field label="Tarifname" v={details.tarif} on={(v) => update("tarif", v)} />
        <Field label="Kontoinhaber" v={details.kontoinhaber} on={(v) => update("kontoinhaber", v)} />
        <Field label="Notiz / Status-Hinweis" v={details.statustext ?? details.notiz} on={(v) => { update("statustext", v); update("notiz", v); }} />
      </div>
    );
  }
  if (type === "gkv" || type === "pkv") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {type === "pkv" && (
          <Field label="Selbstbeteiligung (€)" v={details.selbstbeteiligung} on={(v) => update("selbstbeteiligung", v)} type="number" />
        )}
        <Field label="Notiz / Status-Hinweis" v={details.statustext ?? details.notiz} on={(v) => { update("statustext", v); update("notiz", v); }} />
      </div>
    );
  }
  if (type === "telekommunikation") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anschlussart (DSL / Kabel / Mobil)" v={details.anschlussart} on={(v) => update("anschlussart", v)} />
        <Field label="Bandbreite (Mbit/s)" v={details.bandbreite} on={(v) => update("bandbreite", v)} type="number" />
        <Field label="Rufnummer-Mitnahme" v={details.rufnummer_mitnahme} on={(v) => update("rufnummer_mitnahme", v)} />
        <Field label="Rufnummer" v={details.rufnummer} on={(v) => update("rufnummer", v)} />
        <Field label="Notiz / Status-Hinweis" v={details.statustext ?? details.notiz} on={(v) => { update("statustext", v); update("notiz", v); }} />
      </div>
    );
  }
  if (type === "kfz") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kennzeichen" v={details.kennzeichen} on={(v) => update("kennzeichen", v)} />
        <Field label="Fahrzeugtyp / Modell" v={details.fahrzeugtyp} on={(v) => update("fahrzeugtyp", v)} />
        <Field label="HSN" v={details.hsn} on={(v) => update("hsn", v)} />
        <Field label="TSN" v={details.tsn} on={(v) => update("tsn", v)} />
        <Field label="SF-Klasse" v={details.sf_klasse} on={(v) => update("sf_klasse", v)} />
        <Field label="Erstzulassung" v={details.erstzulassung} on={(v) => update("erstzulassung", v)} type="date" />
        <Field label="Notiz / Status-Hinweis" v={details.statustext ?? details.notiz} on={(v) => { update("statustext", v); update("notiz", v); }} />
      </div>
    );
  }
  return null;
}

function Field({ label, v, on, type = "text" }: { label: string; v?: string; on: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
