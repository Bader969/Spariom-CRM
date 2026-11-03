/**
 * Intelligente Dubletten- und Konflikt-Erkennung für Verträge
 */

export interface DuplicateInfo {
  isDuplicate: boolean;
  severity: "high" | "medium";
  primaryReason: string;
  allReasons: string[];
  partnerIds: string[];
  partnerContracts: any[];
}

/**
 * Normalisiert Zeichenketten (Trim, Lowercase, Leerzeichen bereinigen)
 */
function normalizeStr(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str).trim().toLowerCase();
}

/**
 * Extrahiert die Zählernummer aus den Vertragsdetails
 */
function getZaehlernummer(contract: any): string {
  if (!contract || !contract.details) return "";
  const d = contract.details;
  const num = d.zaehlernummer || d.zaehler_nummer || d.zaehlerNummer || "";
  return normalizeStr(num);
}

/**
 * Prüft eine Liste von Verträgen und gibt eine Zuordnung der Dubletten zurück.
 */
export function detectDuplicates(contracts: any[]): Map<string, DuplicateInfo> {
  const result = new Map<string, DuplicateInfo>();
  if (!contracts || contracts.length < 2) return result;

  // 1. Nach Kunde gruppieren
  const byCustomer: Record<string, any[]> = {};
  for (const c of contracts) {
    if (!c.customer_id) continue;
    if (!byCustomer[c.customer_id]) byCustomer[c.customer_id] = [];
    byCustomer[c.customer_id].push(c);
  }

  // 2. Dubletten-Paare innerhalb desselben Kunden suchen
  for (const list of Object.values(byCustomer)) {
    if (list.length < 2) continue;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const c1 = list[i];
        const c2 = list[j];

        const ref1 = normalizeStr(c1.referenz_id);
        const ref2 = normalizeStr(c2.referenz_id);
        // Gültige Referenznummer (kein wissenschaftliches Format wie 9,00034e+11)
        const validRef1 = ref1.length > 2 && !ref1.includes("e+");
        const validRef2 = ref2.length > 2 && !ref2.includes("e+");
        const sameRef = validRef1 && validRef2 && ref1 === ref2;

        const z1 = getZaehlernummer(c1);
        const z2 = getZaehlernummer(c2);
        const validZaehler1 = z1.length > 3;
        const validZaehler2 = z2.length > 3;
        const sameZaehler = validZaehler1 && validZaehler2 && z1 === z2;

        const sameType = c1.type === c2.type;
        const p1 = normalizeStr(c1.provider);
        const p2 = normalizeStr(c2.provider);
        const sameProvider = p1.length > 1 && p1 === p2;
        const sameStart = Boolean(c1.start_date && c2.start_date && c1.start_date === c2.start_date);
        const bothActive = c1.status === "aktiv" && c2.status === "aktiv";

        let reason = "";
        let severity: "high" | "medium" = "medium";

        if (sameRef) {
          reason = `Identische Auftrags-/Referenz-ID: "${c1.referenz_id}"`;
          severity = "high";
        } else if (sameZaehler && sameType) {
          reason = `Identische Zählernummer (${z1}) in Sparte ${c1.type === "energie_strom" ? "Strom" : c1.type === "energie_gas" ? "Gas" : c1.type}`;
          severity = "high";
        } else if (sameType && sameProvider && sameStart) {
          reason = `Gleicher Anbieter (${c1.provider || ""}) & gleicher Vertragsbeginn (${c1.start_date})`;
          severity = "medium";
        } else if (sameType && sameProvider && bothActive) {
          reason = `Zwei zeitgleich aktive Verträge beim selben Anbieter (${c1.provider || ""})`;
          severity = "medium";
        }

        if (reason) {
          // Add to c1
          const info1 = result.get(c1.id) || {
            isDuplicate: true,
            severity,
            primaryReason: reason,
            allReasons: [],
            partnerIds: [],
            partnerContracts: [],
          };
          if (!info1.partnerIds.includes(c2.id)) {
            info1.partnerIds.push(c2.id);
            info1.partnerContracts.push(c2);
            info1.allReasons.push(reason);
            if (severity === "high") info1.severity = "high";
          }
          result.set(c1.id, info1);

          // Add to c2
          const info2 = result.get(c2.id) || {
            isDuplicate: true,
            severity,
            primaryReason: reason,
            allReasons: [],
            partnerIds: [],
            partnerContracts: [],
          };
          if (!info2.partnerIds.includes(c1.id)) {
            info2.partnerIds.push(c1.id);
            info2.partnerContracts.push(c1);
            info2.allReasons.push(reason);
            if (severity === "high") info2.severity = "high";
          }
          result.set(c2.id, info2);
        }
      }
    }
  }

  return result;
}
