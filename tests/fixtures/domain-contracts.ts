/**
 * Authoritative Domain Specification & Contracts for Spariom-CRM
 * Derived from PROJECT.md, ORIGINAL_REQUEST.md, and Technical Survey Reports.
 */

export type ContractType =
  | "energie_strom"
  | "energie_gas"
  | "gkv"
  | "pkv"
  | "telekommunikation"
  | "kfz";

export type ContractStatus =
  | "in_pruefung"
  | "aktiv"
  | "gekuendigt_wartet_neuabschluss"
  | "abgelaufen"
  | "storniert";

export type AppRole = "admin" | "haupt_vertriebler" | "mitarbeiter";

export type TaskStatus = "offen" | "erledigt";

export type NoteType = "anruf" | "notiz" | "system";

export type ClarificationStatus = "offen" | "wartend" | "erledigt";

export type ClarificationCategory =
  | "zaehlerstand"
  | "km_stand"
  | "familienversicherung"
  | "unterlagen"
  | "bankdaten"
  | "widerruf"
  | "sonstiges";

export type PersonalityType = "dominant" | "initiativ" | "gewissenhaft" | "stetig";

export type ExpiryBucket = "abgelaufen" | "rot" | "orange" | "gelb" | "gruen" | "neutral";

export type UrgencyKey = "ueberfaellig" | "hoch" | "mittel" | "niedrig";

export interface DuplicateInfo {
  isDuplicate: boolean;
  severity: "high" | "medium";
  primaryReason: string;
  allReasons: string[];
  partnerIds: string[];
  partnerContracts: any[];
}

export const LEAD_SOURCES = [
  "whatsapp",
  "empfehlung",
  "tiktok",
  "instagram",
  "facebook",
  "google",
  "messe",
  "kaltakquise",
  "telefon_eingang",
  "website",
  "email_kampagne",
  "flyer",
  "sonstiges",
] as const;

export const CONTRACT_TYPES = [
  { value: "energie_strom", label: "Energie – Strom", icon: "⚡" },
  { value: "energie_gas", label: "Energie – Gas", icon: "🔥" },
  { value: "gkv", label: "GKV (Gesetzliche Krankenversicherung)", icon: "🏥" },
  { value: "pkv", label: "PKV (Private Krankenversicherung)", icon: "🩺" },
  { value: "telekommunikation", label: "Telekommunikation", icon: "📡" },
  { value: "kfz", label: "KFZ-Versicherung", icon: "🚗" },
] as const;

export const CONTRACT_STATUSES = [
  { value: "in_pruefung", label: "In Prüfung" },
  { value: "aktiv", label: "Aktiv" },
  { value: "gekuendigt_wartet_neuabschluss", label: "Gekündigt – wartet auf Neuabschluss" },
  { value: "abgelaufen", label: "Abgelaufen" },
  { value: "storniert", label: "Storniert" },
] as const;

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  admin: 3,
  haupt_vertriebler: 2,
  mitarbeiter: 1,
};

export const PERSONALITY_TYPES_METADATA = [
  {
    value: "dominant",
    label: "Dominant",
    icon: "⚡",
    salesTip:
      "Komme kurz & bündig auf den Punkt. Zeige klare Optionen auf und ermögliche eine schnelle Entscheidung ohne Umschweife.",
  },
  {
    value: "initiativ",
    label: "Initiativ",
    icon: "🌟",
    salesTip:
      "Baue eine persönliche Beziehung auf. Wecke Begeisterung, zeige Visionen auf und suche das persönliche Gespräch.",
  },
  {
    value: "gewissenhaft",
    label: "Gewissenhaft",
    icon: "📊",
    salesTip:
      "Liefer präzise Zahlen, Fakten und schriftliche Vergleiche. Gib dem Kunden Zeit zur gründlichen Prüfung.",
  },
  {
    value: "stetig",
    label: "Stetig",
    icon: "🌿",
    salesTip:
      "Biete Vertrauen & Sicherheit. Erkläre Abläufe Schritt für Schritt und vermeide Druck oder Hektik.",
  },
] as const;

export const CLARIFICATION_CATEGORIES = [
  { value: "zaehlerstand", label: "Zählerstand", icon: "🔢" },
  { value: "km_stand", label: "KM-Stand", icon: "🚗" },
  { value: "familienversicherung", label: "Familienversicherung", icon: "👨‍👩‍👧" },
  { value: "unterlagen", label: "Fehlende Unterlagen", icon: "📎" },
  { value: "bankdaten", label: "Bankdaten / IBAN", icon: "🏦" },
  { value: "widerruf", label: "Widerruf / Stornierung", icon: "↩️" },
  { value: "sonstiges", label: "Sonstiges", icon: "❓" },
] as const;

export const SPARIOM_BRAND = {
  name: "Spariom",
  primaryColor: "#d2953c",
  primaryDarkColor: "#df9f43",
  accentHi: "#dfa44e",
  accentHiDark: "#f0b55b",
  accentSoft: "rgba(210, 149, 60, 0.15)",
  accentSoftSolid: "#faedd9",
  accentText: "#8f5713",
  accentInk: "#1a0f02",
  brandGlow: "rgba(210, 149, 60, 0.35)",
  backdropFilter: "blur(26px) saturate(170%)",
  sidebarWidthExpanded: 256,
  sidebarWidthRail: 84,
  headerHeight: 64,
  maxHeaderWidth: "calc(1480px - 28px)",
  mobileBreakpoint: 768,
} as const;

export const EXPECTED_DATABASE_TABLES = [
  "profiles",
  "user_roles",
  "auth_email_allowlist",
  "auth_login_attempts",
  "teams",
  "team_members",
  "customers",
  "contracts",
  "contract_kv_details",
  "contract_family_members",
  "contract_documents",
  "customer_documents",
  "customer_notes",
  "customer_relations",
  "households",
  "household_members",
  "tasks",
  "clarifications",
] as const;

/* ================= Logic Functions ================= */

export function normalizeStr(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str).trim().toLowerCase();
}

export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  if (cleaned.startsWith("0")) return "49" + cleaned.slice(1);
  return cleaned;
}

export function whatsappLink(phone: string, firstName: string): string {
  const num = formatPhoneForWhatsApp(phone);
  const msg = `Hallo ${firstName}, ich melde mich bezüglich Ihres Vertrags. Haben Sie kurz Zeit?`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function daysUntil(date: string | null, referenceNow?: Date): number | null {
  if (!date) return null;
  const now = referenceNow ? referenceNow.getTime() : Date.now();
  const ms = new Date(date).getTime() - now;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function getZaehlernummer(contract: any): string {
  if (!contract || !contract.details) return "";
  const d = contract.details;
  const num = d.zaehlernummer || d.zaehler_nummer || d.zaehlerNummer || "";
  return normalizeStr(num);
}

export function detectDuplicates(contracts: any[]): Map<string, DuplicateInfo> {
  const result = new Map<string, DuplicateInfo>();
  if (!contracts || contracts.length < 2) return result;

  const byCustomer: Record<string, any[]> = {};
  for (const c of contracts) {
    if (!c.customer_id) continue;
    if (!byCustomer[c.customer_id]) byCustomer[c.customer_id] = [];
    byCustomer[c.customer_id].push(c);
  }

  for (const list of Object.values(byCustomer)) {
    if (list.length < 2) continue;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const c1 = list[i];
        const c2 = list[j];

        const ref1 = normalizeStr(c1.referenz_id);
        const ref2 = normalizeStr(c2.referenz_id);
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
          reason = `Identische Zählernummer (${z1}) in Sparte ${
            c1.type === "energie_strom" ? "Strom" : c1.type === "energie_gas" ? "Gas" : c1.type
          }`;
          severity = "high";
        } else if (sameType && sameProvider && sameStart) {
          reason = `Gleicher Anbieter (${c1.provider || ""}) & gleicher Vertragsbeginn (${c1.start_date})`;
          severity = "medium";
        } else if (sameType && sameProvider && bothActive) {
          reason = `Zwei zeitgleich aktive Verträge beim selben Anbieter (${c1.provider || ""})`;
          severity = "medium";
        }

        if (reason) {
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

export function getExpiryBucket(
  end_date: string | null,
  status: ContractStatus | null | undefined,
  referenceNow?: Date,
): { key: ExpiryBucket; rank: number; label: string } {
  if (status === "abgelaufen") {
    return { key: "abgelaufen", rank: 5, label: "Abgelaufen" };
  }
  const days = daysUntil(end_date, referenceNow);
  if (days === null) {
    return { key: "neutral", rank: 0, label: "Ohne Datum" };
  }
  if (days < 0) {
    return { key: "abgelaufen", rank: 5, label: `Abgelaufen (${Math.abs(days)} T)` };
  }
  if (days <= 30) {
    return { key: "rot", rank: 4, label: `≤ 1 Monat (${days} T)` };
  }
  if (days <= 90) {
    return { key: "orange", rank: 3, label: `≤ 3 Monate (${days} T)` };
  }
  if (days <= 180) {
    return { key: "gelb", rank: 2, label: `≤ 6 Monate (${days} T)` };
  }
  if (days <= 365) {
    return { key: "gruen", rank: 1, label: `≤ 1 Jahr (${days} T)` };
  }
  return { key: "neutral", rank: 0, label: `${days} T` };
}

export function getClarificationUrgency(
  due_date: string | null,
  status: ClarificationStatus,
  referenceNow?: Date,
): { key: UrgencyKey; rank: number; label: string } {
  if (status === "erledigt") {
    return { key: "niedrig", rank: 0, label: "Erledigt" };
  }
  const days = due_date ? daysUntil(due_date, referenceNow) : null;
  if (days === null) {
    return { key: "niedrig", rank: 1, label: "Ohne Datum" };
  }
  if (days < 0) {
    return { key: "ueberfaellig", rank: 4, label: `Überfällig (${Math.abs(days)} T)` };
  }
  if (days <= 2) {
    return { key: "hoch", rank: 3, label: `Hoch (${days} T)` };
  }
  if (days <= 7) {
    return { key: "mittel", rank: 2, label: `Mittel (${days} T)` };
  }
  return { key: "niedrig", rank: 1, label: `Niedrig (${days} T)` };
}

export function getTaskUrgency(
  due_date: string | null,
  status: TaskStatus,
  referenceNow?: Date,
): { key: "erledigt" | "ueberfaellig" | "hoch" | "mittel" | "niedrig"; rank: number } {
  if (status === "erledigt") {
    return { key: "erledigt", rank: 0 };
  }
  const days = due_date ? daysUntil(due_date, referenceNow) : null;
  if (days === null) return { key: "niedrig", rank: 1 };
  if (days < 0) return { key: "ueberfaellig", rank: 4 };
  if (days <= 3) return { key: "hoch", rank: 3 };
  return { key: "niedrig", rank: 1 };
}

export function isValidIBAN(iban: string): boolean {
  const v = iban.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v);
}
