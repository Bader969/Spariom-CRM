import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  contractTypeIcon, contractTypeLabel, contractStatusMeta,
  formatDate, getRenewalState, formatDuration,
  type ContractType,
} from "@/lib/crm-types";
import { ContractDocumentsPanel } from "./ContractDocumentsPanel";

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);

const familienstandLabel: Record<string, string> = {
  ledig: "Ledig", verheiratet: "Verheiratet", getrennt: "Getrennt",
  geschieden: "Geschieden", verwitwet: "Verwitwet",
};
const geschlechtLabel: Record<string, string> = { m: "Männlich", w: "Weiblich", d: "Divers" };
const relationLabel: Record<string, string> = { ehegatte: "Ehegatte/-in", kind: "Kind" };
const verwandtschaftLabel: Record<string, string> = {
  leiblich: "Leiblich", stief: "Stiefkind", enkel: "Enkelkind", pflege: "Pflegekind",
};
const bisherigArtLabel: Record<string, string> = {
  mitgliedschaft: "Mitgliedschaft",
  familienversicherung: "Familienversicherung",
  nicht_gesetzlich: "Nicht gesetzlich",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const displayVal = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{displayVal}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold border-b pb-1">{title}</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function TypeSpecific({ type, details }: { type: ContractType; details: Record<string, any> }) {
  const d = details ?? {};
  if (type === "energie_strom" || type === "energie_gas") {
    return (
      <Section title="Spezifische Daten">
        <Row label="Marktlokationsnummer (MaLo)" value={d.marktlokationsnummer} />
        <Row label="Zählpunktbezeichnung" value={d.zaehlpunkt} />
        <Row label="Zählernummer" value={d.zaehlernummer} />
        <Row label="Aktueller Zählerstand" value={d.zaehlerstand} />
        <Row label="Jahresverbrauch (kWh)" value={d.verbrauch_kwh} />
        <Row label="Tarifname" value={d.tarif ?? d.tarif_name} />
        <Row label="Kontoinhaber" value={d.kontoinhaber} />
      </Section>
    );
  }
  if (type === "pkv") {
    return (
      <Section title="Spezifische Daten">
        <Row label="Selbstbeteiligung (€)" value={d.selbstbeteiligung} />
      </Section>
    );
  }
  if (type === "telekommunikation") {
    return (
      <Section title="Spezifische Daten">
        <Row label="Anschlussart" value={d.anschlussart} />
        <Row label="Bandbreite (Mbit/s)" value={d.bandbreite} />
        <Row label="Rufnummer-Mitnahme" value={d.rufnummer_mitnahme} />
        <Row label="Rufnummer" value={d.rufnummer} />
      </Section>
    );
  }
  if (type === "kfz") {
    return (
      <Section title="Spezifische Daten">
        <Row label="Kennzeichen" value={d.kennzeichen} />
        <Row label="Fahrzeugtyp / Modell" value={d.fahrzeugtyp} />
        <Row label="HSN" value={d.hsn} />
        <Row label="TSN" value={d.tsn} />
        <Row label="SF-Klasse" value={d.sf_klasse} />
        <Row label="Erstzulassung" value={d.erstzulassung ? formatDate(d.erstzulassung) : null} />
      </Section>
    );
  }
  return null;
}

export function ContractDetailDialog({
  open, onOpenChange, contract, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  contract: any | null;
  onEdit: (c: any) => void;
  onDelete?: (contractId: string) => Promise<void> | void;
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isKV = contract && (contract.type === "gkv" || contract.type === "pkv");

  const { data: kv } = useQuery({
    queryKey: ["kv_details", "contract", contract?.id],
    enabled: !!contract?.id && !!isKV && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contract_kv_details").select("*").eq("contract_id", contract.id).maybeSingle();
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["family_members", "contract", contract?.id],
    enabled: !!contract?.id && !!isKV && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contract_family_members").select("*")
        .eq("contract_id", contract.id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  if (!contract) return null;

  const meta = contractStatusMeta(contract.status);
  const renewal = getRenewalState({ type: contract.type, end_date: contract.end_date, status: contract.status });
  const providerLabel = isKV ? "Krankenkasse" : "Anbieter";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">{contractTypeIcon(contract.type)}</span>
              <span>{contractTypeLabel(contract.type)}</span>
              <Badge className={meta.color}>{meta.label}</Badge>
              {contract.is_fremdvertrag && <Badge variant="outline">Fremdvertrag</Badge>}
              {renewal.due && (
                <Badge className="bg-warning text-warning-foreground">
                  {renewal.label}{renewal.daysLeft !== null && ` · ${formatDuration(renewal.daysLeft)}`}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

        <div className="space-y-5">
          <Section title="Allgemein">
            <Row label={providerLabel} value={contract.provider} />
            {!isKV && <Row label="Vermittlungsportal" value={contract.vermittlungsportal} />}
            {!isKV && <Row label="Referenz / Auftragsnummer" value={contract.referenz_id} />}
            {contract.is_fremdvertrag && <Row label="Quelle (Fremdvertrag)" value={contract.fremd_quelle} />}
            <Row label="Vertragsbeginn" value={contract.start_date ? formatDate(contract.start_date) : null} />
            <Row label="Vertragsende" value={contract.end_date ? formatDate(contract.end_date) : null} />
            {(() => {
              const noteVal = contract.details?.statustext || contract.details?.auftrag_statustext || contract.details?.notiz || contract.details?.note;
              if (!noteVal) return null;
              return (
                <Row
                  label="Status-Hinweis / Notiz"
                  value={
                    <span className={
                      contract.status === "storniert"
                        ? "text-destructive font-medium"
                        : "text-foreground font-medium"
                    }>
                      📌 {noteVal}
                    </span>
                  }
                />
              );
            })()}
            <Row label="Anlagedatum (Erfasst am)" value={contract.created_at ? formatDate(contract.created_at) : null} />
            <Row label="Monatlicher Betrag (€)" value={contract.monthly_amount} />
            {!contract.is_fremdvertrag && <Row label="Provision (€)" value={contract.commission} />}
            {(contract.type === "energie_strom" || contract.type === "energie_gas") && (
              <Row
                label="Zahlweise"
                value={
                  contract.payment_method === "selbstzahler"
                    ? "Selbstzahler"
                    : contract.payment_method === "lastschrift"
                      ? "SEPA-Lastschrift"
                      : null
                }
              />
            )}
            {contract.iban && <Row label="IBAN" value={contract.iban} />}
          </Section>

          <TypeSpecific type={contract.type} details={contract.details ?? {}} />

          {isKV && (
            <Section title="Stammdaten Hauptmitglied (KV)">
              <Row label="Geschlecht" value={kv?.geschlecht ? geschlechtLabel[kv.geschlecht] : null} />
              <Row label="Familienstand" value={kv?.familienstand ? familienstandLabel[kv.familienstand] : null} />
              <Row label="Geburtsort" value={kv?.geburtsort} />
              <Row label="Geburtsland" value={kv?.geburtsland} />
              <Row label="Staatsangehörigkeit" value={kv?.staatsangehoerigkeit} />
              <Row label="KV-Nummer" value={kv?.kv_nummer} />
              <Row label="Vorherige Krankenkasse" value={kv?.vorherige_kasse} />
              <Row label="Ende vorherige Versicherung" value={kv?.vorherige_kasse_ende ? formatDate(kv.vorherige_kasse_ende) : null} />
            </Section>
          )}

          {isKV && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span>👨‍👩‍👧</span> Mitversicherte Angehörige &amp; Eigenmitgliedschaften
                  {members && members.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{members.length}</Badge>}
                </h4>
              </div>
              {(!members || members.length === 0) ? (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-center bg-muted/20 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Für diesen GKV-Vertrag sind aktuell keine mitversicherten Familienmitglieder oder Eigenmitgliedschaften hinterlegt.
                  </p>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { onOpenChange(false); onEdit(contract); }}>
                    ➕ Familienmitglied hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((m: any, i: number) => (
                    <div key={m.id ?? i} className="rounded-lg border border-border/60 bg-card p-3.5 space-y-2 shadow-sm">
                      <div className="text-sm font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-accent/40 font-medium">
                            {relationLabel[m.relation] ?? m.relation}
                          </Badge>
                          {m.bisherig_art === "mitgliedschaft" ? (
                            <Badge variant="secondary" className="bg-info/10 text-info border-info/20 font-medium text-[10px]">
                              Eigenmitgliedschaft
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground font-normal text-[10px]">
                              Familienversicherung
                            </Badge>
                          )}
                          {dash(m.first_name)} {dash(m.last_name)}
                        </span>
                        {m.birthdate && <span className="text-xs text-muted-foreground">Geb. {formatDate(m.birthdate)}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-1">
                        <Row label="Geschlecht" value={m.geschlecht ? geschlechtLabel[m.geschlecht] : null} />
                        <Row label="Geburtsdatum" value={m.birthdate ? formatDate(m.birthdate) : null} />
                        <Row label="KV-Nummer" value={m.versicherungsnummer} />
                        {m.relation === "kind" && (
                          <Row label="Verwandtschaft" value={m.verwandtschaft ? verwandtschaftLabel[m.verwandtschaft] : null} />
                        )}
                        <Row label="Geburtsname" value={m.geburtsname} />
                        <Row label="Geburtsort" value={m.geburtsort} />
                        <Row label="Geburtsland" value={m.geburtsland} />
                        <Row label="Staatsangehörigkeit" value={m.staatsangehoerigkeit} />
                        <Row label="Bisherige Art" value={m.bisherig_art ? bisherigArtLabel[m.bisherig_art] : null} />
                        <Row label="Bisherige Kasse" value={m.bisherig_kasse} />
                        <Row label="Endete am" value={m.bisherig_ende ? formatDate(m.bisherig_ende) : null} />
                      </div>
                      {m.abweichende_anschrift && (
                        <div className="pt-1 border-t border-border/30 mt-2">
                          <div className="text-xs text-muted-foreground font-medium">Abweichende Anschrift:</div>
                          <div className="text-xs whitespace-pre-wrap">{m.abweichende_anschrift}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dokumente & Dateien Bereich */}
          <div className="pt-2 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3">Dokumente &amp; Dateien</h4>
            <ContractDocumentsPanel contractId={contract.id} />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full gap-2">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Vertrag löschen
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
            <Button onClick={() => { onOpenChange(false); onEdit(contract); }}>Bearbeiten</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Vertrag unwiderruflich löschen?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie diesen Vertrag ({contract?.provider || "Vertrag"} – Ref: {contract?.referenz_id || contract?.id?.slice(0, 8)}) wirklich endgültig löschen?
            <br /><br />
            Alle verknüpften Unterlagen und Daten werden dabei entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={isDeleting}
            onClick={async () => {
              if (onDelete && contract?.id) {
                setIsDeleting(true);
                try {
                  await onDelete(contract.id);
                  setConfirmDeleteOpen(false);
                  onOpenChange(false);
                } catch (err) {
                  console.error("Error deleting contract:", err);
                } finally {
                  setIsDeleting(false);
                }
              }
            }}
          >
            {isDeleting ? "Wird gelöscht…" : "Ja, Vertrag endgültig löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
