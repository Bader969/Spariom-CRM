import type { Database } from "@/integrations/supabase/types";

export type ContractType = Database["public"]["Enums"]["contract_type"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type NoteType = Database["public"]["Enums"]["note_type"];

export const CONTRACT_TYPES: { value: ContractType; label: string; icon: string }[] = [
  { value: "energie_strom", label: "Energie – Strom", icon: "⚡" },
  { value: "energie_gas", label: "Energie – Gas", icon: "🔥" },
  { value: "gkv", label: "GKV (Gesetzliche Krankenversicherung)", icon: "🏥" },
  { value: "pkv", label: "PKV (Private Krankenversicherung)", icon: "🩺" },
  { value: "telekommunikation", label: "Telekommunikation", icon: "📡" },
  { value: "kfz", label: "KFZ-Versicherung", icon: "🚗" },
];

export const CONTRACT_STATUSES: { value: ContractStatus; label: string; color: string }[] = [
  { value: "in_pruefung", label: "In Prüfung", color: "bg-info text-info-foreground" },
  { value: "aktiv", label: "Aktiv", color: "bg-success text-success-foreground" },
  { value: "gekuendigt_wartet_neuabschluss", label: "Gekündigt – wartet auf Neuabschluss", color: "bg-warning text-warning-foreground" },
  { value: "abgelaufen", label: "Abgelaufen", color: "bg-muted text-muted-foreground" },
  { value: "storniert", label: "Storniert", color: "bg-destructive text-destructive-foreground" },
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  haupt_vertriebler: "Haupt-Vertriebler",
  mitarbeiter: "Mitarbeiter",
  user: "Benutzer",
};

export const AVATAR_PRESETS = [
  // Aliens & Space Creatures
  { id: "alien_1", label: "Alien Cosmo", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Cosmo&backgroundColor=c0aede" },
  { id: "alien_2", label: "Alien Zog", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Zog&backgroundColor=b6e3f4" },
  { id: "alien_3", label: "Alien Nebula", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Nebula&backgroundColor=ffd5dc" },
  { id: "alien_4", label: "Alien Orion", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Orion&backgroundColor=d1d4f9" },

  // Animals & Fun Creatures
  { id: "animal_fox", label: "Clever Fox", url: "https://api.dicebear.com/7.x/identicon/svg?seed=Fox&backgroundColor=ffdfbf" },
  { id: "animal_lion", label: "Brave Lion", url: "https://api.dicebear.com/7.x/identicon/svg?seed=Lion&backgroundColor=ffdfbf" },
  { id: "animal_panda", label: "Cute Panda", url: "https://api.dicebear.com/7.x/identicon/svg?seed=Panda&backgroundColor=c0aede" },
  { id: "animal_owl", label: "Wise Owl", url: "https://api.dicebear.com/7.x/identicon/svg?seed=Owl&backgroundColor=b6e3f4" },

  // Friendly Monsters & Icons
  { id: "monster_1", label: "Happy Monster", url: "https://api.dicebear.com/7.x/icons/svg?seed=Monster1&backgroundColor=ffd5dc" },
  { id: "monster_2", label: "Charming Monster", url: "https://api.dicebear.com/7.x/icons/svg?seed=Monster2&backgroundColor=d1d4f9" },
  { id: "monster_3", label: "Friendly Monster", url: "https://api.dicebear.com/7.x/icons/svg?seed=Monster3&backgroundColor=ffdfbf" },
  { id: "monster_4", label: "Cool Monster", url: "https://api.dicebear.com/7.x/icons/svg?seed=Monster4&backgroundColor=b6e3f4" },

  // Robots & Tech Creatures
  { id: "robot_cyber", label: "Cyber Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=CyberBot&backgroundColor=b6e3f4" },
  { id: "robot_pixel", label: "Pixel Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=PixelBot&backgroundColor=ffd5dc" },
  { id: "robot_spark", label: "Spark Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=SparkBot&backgroundColor=d1d4f9" },
  { id: "robot_turbo", label: "Turbo Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=TurboBot&backgroundColor=c0aede" },
];

export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "US";
}

export function getAvatarUrl(avatarUrl?: string | null, name?: string | null, email?: string | null): string {
  if (avatarUrl && avatarUrl.trim()) return avatarUrl.trim();
  const seed = encodeURIComponent(name?.trim() || email?.trim() || "User");
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=b6e3f4`;
}

export type PersonalityType = "dominant" | "initiativ" | "gewissenhaft" | "stetig";

export interface PersonalityMeta {
  value: PersonalityType;
  label: string;
  badgeClass: string;
  bgLight: string;
  borderColor: string;
  icon: string;
  summary: string;
  salesTip: string;
}

export const PERSONALITY_TYPES: PersonalityMeta[] = [
  {
    value: "dominant",
    label: "Dominant",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    bgLight: "bg-red-500/5",
    borderColor: "border-red-500/30",
    icon: "⚡",
    summary: "Entschlussfreudig, ergebnisorientiert, wettbewerbsorientiert, macht sein Ding.",
    salesTip: "Komme kurz & bündig auf den Punkt. Zeige klare Optionen auf und ermögliche eine schnelle Entscheidung ohne Umschweife.",
  },
  {
    value: "initiativ",
    label: "Initiativ",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    bgLight: "bg-amber-500/5",
    borderColor: "border-amber-500/30",
    icon: "🌟",
    summary: "Knüpft leicht Kontakte, teilt Gefühle, verbindet Menschen, steht gerne im Mittelpunkt.",
    salesTip: "Baue eine persönliche Beziehung auf. Wecke Begeisterung, zeige Visionen auf und suche das persönliche Gespräch.",
  },
  {
    value: "gewissenhaft",
    label: "Gewissenhaft",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    bgLight: "bg-blue-500/5",
    borderColor: "border-blue-500/30",
    icon: "📊",
    summary: "Sehr zuverlässig, denkt Dinge zu Ende, hoher eigener Anspruch, datenaffin.",
    salesTip: "Liefer präzise Zahlen, Fakten und schriftliche Vergleiche. Gib dem Kunden Zeit zur gründlichen Prüfung.",
  },
  {
    value: "stetig",
    label: "Stetig",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    bgLight: "bg-emerald-500/5",
    borderColor: "border-emerald-500/30",
    icon: "🌿",
    summary: "Mag gewohnte Abläufe, hört gut zu, sorgt sich um andere, harmonieorientiert.",
    salesTip: "Biete Vertrauen & Sicherheit. Erkläre Abläufe Schritt für Schritt und vermeide Druck oder Hektik.",
  },
];

export const getPersonalityMeta = (type?: string | null): PersonalityMeta | null => {
  if (!type) return null;
  return PERSONALITY_TYPES.find((p) => p.value === type) ?? null;
};

export const contractTypeLabel = (t: ContractType) =>
  CONTRACT_TYPES.find((x) => x.value === t)?.label ?? t;
export const contractTypeIcon = (t: ContractType) =>
  CONTRACT_TYPES.find((x) => x.value === t)?.icon ?? "📄";
export const contractStatusMeta = (s: ContractStatus) =>
  CONTRACT_STATUSES.find((x) => x.value === s) ?? { value: s, label: s, color: "" };

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

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "empfehlung", label: "Empfehlung (Bestandskunde / Bekannte)" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram / Meta Ads" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google / Suchanzeige" },
  { value: "messe", label: "Messe / Event" },
  { value: "kaltakquise", label: "Kaltakquise" },
  { value: "telefon_eingang", label: "Telefon-Eingang" },
  { value: "website", label: "Eigene Website" },
  { value: "email_kampagne", label: "E-Mail-Kampagne" },
  { value: "flyer", label: "Flyer / Print" },
  { value: "sonstiges", label: "Sonstiges" },
];
export const leadSourceLabel = (v?: string | null) =>
  LEAD_SOURCES.find((s) => s.value === v)?.label ?? v ?? "—";

/** Renewal window per contract type (days before end_date). */
export function renewalWindowDays(type: ContractType): number {
  if (type === "energie_strom" || type === "energie_gas") return 365;
  if (type === "gkv") return 90;
  return 30;
}

/** Format a number of days as "X T" / "X M, Y T" / "X J, Y M, Z T". */
export function formatDuration(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `${days} T`;
  if (days < 30) return `${days} T`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    const restDays = days % 30;
    return restDays > 0 ? `${months} M, ${restDays} T` : `${months} M`;
  }
  const years = Math.floor(days / 365);
  const rest = days % 365;
  const months = Math.floor(rest / 30);
  const restDays = rest % 30;
  const parts = [`${years} J`];
  if (months > 0) parts.push(`${months} M`);
  if (restDays > 0) parts.push(`${restDays} T`);
  return parts.join(", ");
}

export function getRenewalState(contract: { type: ContractType; end_date: string | null; status: ContractStatus }):
  { due: boolean; daysLeft: number | null; label: string } {
  const days = daysUntil(contract.end_date);
  if (days === null || contract.status === "storniert" || contract.status === "abgelaufen") {
    return { due: false, daysLeft: days, label: "" };
  }
  const window = renewalWindowDays(contract.type);
  const due = days <= window && days >= 0;
  let label = "";
  if (due) {
    if (contract.type === "gkv") label = "Wechselfenster GKV";
    else if (contract.type === "energie_strom" || contract.type === "energie_gas") label = "Verlängerung fällig";
    else label = "Bald fällig";
  }
  return { due, daysLeft: days, label };
}

export function isValidIBAN(iban: string): boolean {
  const v = iban.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v);
}

/* ============================ Klärfälle ============================ */

export type ClarificationStatus = "offen" | "wartend" | "erledigt";
export type ClarificationCategory =
  | "zaehlerstand" | "km_stand" | "familienversicherung"
  | "unterlagen" | "bankdaten" | "widerruf" | "sonstiges";

export const CLARIFICATION_CATEGORIES: { value: ClarificationCategory; label: string; icon: string }[] = [
  { value: "zaehlerstand", label: "Zählerstand", icon: "🔢" },
  { value: "km_stand", label: "KM-Stand", icon: "🚗" },
  { value: "familienversicherung", label: "Familienversicherung", icon: "👨‍👩‍👧" },
  { value: "unterlagen", label: "Fehlende Unterlagen", icon: "📎" },
  { value: "bankdaten", label: "Bankdaten / IBAN", icon: "🏦" },
  { value: "widerruf", label: "Widerruf / Stornierung", icon: "↩️" },
  { value: "sonstiges", label: "Sonstiges", icon: "❓" },
];

export const clarificationCategoryMeta = (c: ClarificationCategory) =>
  CLARIFICATION_CATEGORIES.find((x) => x.value === c) ?? { value: c, label: c, icon: "❓" };

export function clarificationStatusMeta(s: ClarificationStatus): {
  value: ClarificationStatus; label: string; bgClass: string; activeClass: string;
} {
  switch (s) {
    case "offen":
      return { value: s, label: "Offen", bgClass: "bg-card", activeClass: "bg-warning text-warning-foreground hover:bg-warning/90" };
    case "wartend":
      return { value: s, label: "Wartend", bgClass: "bg-info/10", activeClass: "bg-info text-info-foreground hover:bg-info/90" };
    case "erledigt":
      return { value: s, label: "Erledigt", bgClass: "bg-success/10", activeClass: "bg-success text-success-foreground hover:bg-success/90" };
  }
}

export type UrgencyKey = "ueberfaellig" | "hoch" | "mittel" | "niedrig";

export function getUrgency(due_date: string | null, status: ClarificationStatus): {
  key: UrgencyKey; label: string; rank: number; borderClass: string; badgeClass: string;
} {
  if (status === "erledigt") {
    return { key: "niedrig", label: "Erledigt", rank: 0, borderClass: "border-l-success", badgeClass: "bg-success/20 text-success-foreground" };
  }
  const days = due_date ? daysUntil(due_date) : null;
  if (days === null) {
    return { key: "niedrig", label: "Ohne Datum", rank: 1, borderClass: "border-l-muted", badgeClass: "bg-muted text-muted-foreground" };
  }
  if (days < 0) {
    return { key: "ueberfaellig", label: `Überfällig (${Math.abs(days)} T)`, rank: 4, borderClass: "border-l-destructive", badgeClass: "bg-destructive text-destructive-foreground" };
  }
  if (days <= 2) {
    return { key: "hoch", label: `Hoch (${days} T)`, rank: 3, borderClass: "border-l-warning", badgeClass: "bg-warning text-warning-foreground" };
  }
  if (days <= 7) {
    return { key: "mittel", label: `Mittel (${days} T)`, rank: 2, borderClass: "border-l-info", badgeClass: "bg-info/30 text-foreground" };
  }
  return { key: "niedrig", label: `Niedrig (${days} T)`, rank: 1, borderClass: "border-l-muted", badgeClass: "bg-muted text-muted-foreground" };
}

/* ============================ Contract status backgrounds ============================ */

export const CONTRACT_STATUS_BG: Record<ContractStatus, string> = {
  in_pruefung: "bg-info/10 border-info/30",
  aktiv: "bg-success/10 border-success/30",
  gekuendigt_wartet_neuabschluss: "bg-warning/10 border-warning/30",
  abgelaufen: "bg-muted border-muted-foreground/20 opacity-80",
  storniert: "bg-destructive/10 border-destructive/30",
};

/** Auto-expire contracts whose end_date is in the past. Returns true if any row was updated. */
export async function expireOverdueContracts(supabase: any): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase
      .from("contracts")
      .update({ status: "abgelaufen" })
      .lt("end_date", today)
      .not("status", "in", '("abgelaufen","storniert")')
      .select("id");
    if (error) return false;
    return Boolean(data && data.length > 0);
  } catch {
    /* silently ignore — RLS or transient errors */
    return false;
  }
}

/* ============================ Task priority, automation & urgency ============================ */

export type TaskPriority = "hoch" | "mittel" | "niedrig";
export type TaskTriggerEvent = "contract_created" | "contract_activated" | "contract_cancelled";
export type TaskAssigneeMode = "contract_creator" | "customer_advisor" | "specific_user";

export const TASK_PRIORITIES: { value: TaskPriority; label: string; badgeClass: string; dotClass: string }[] = [
  { value: "hoch", label: "Hoch", badgeClass: "bg-warning/20 text-warning-foreground border-warning/40", dotClass: "bg-warning" },
  { value: "mittel", label: "Mittel", badgeClass: "bg-info/15 text-foreground border-info/30", dotClass: "bg-info" },
  { value: "niedrig", label: "Niedrig", badgeClass: "bg-muted text-muted-foreground border-border", dotClass: "bg-muted-foreground" },
];

export const taskPriorityMeta = (p?: TaskPriority | string | null) =>
  TASK_PRIORITIES.find((x) => x.value === p) ?? TASK_PRIORITIES[1];

export const TASK_TRIGGER_EVENTS: { value: TaskTriggerEvent; label: string; description: string }[] = [
  { value: "contract_created", label: "Bei Vertragseintrag", description: "Sofort beim Anlegen eines neuen Vertrags im System" },
  { value: "contract_activated", label: "Bei Aktivierung", description: "Sobald der Vertragsstatus auf Aktiv gesetzt wird" },
  { value: "contract_cancelled", label: "Bei Kündigung", description: "Sobald der Vertrag auf Gekündigt gesetzt wird" },
];

export const TASK_ASSIGNEE_MODES: { value: TaskAssigneeMode; label: string }[] = [
  { value: "contract_creator", label: "Vertrags-Ersteller" },
  { value: "customer_advisor", label: "Zuständiger Kundenbetreuer" },
  { value: "specific_user", label: "Fester Mitarbeiter" },
];

export function getTaskUrgency(
  due_date: string | null,
  status: TaskStatus,
  priority?: TaskPriority | string | null,
): {
  key: "erledigt" | "ueberfaellig" | "hoch" | "mittel" | "niedrig";
  label: string;
  rank: number;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
} {
  if (status === "erledigt") {
    return {
      key: "erledigt",
      label: "Erledigt",
      rank: 0,
      bgClass: "bg-success/5 opacity-70",
      borderClass: "border-l-success",
      badgeClass: "bg-success/20 text-success-foreground",
    };
  }
  const days = due_date ? daysUntil(due_date) : null;
  if (days !== null && days < 0) {
    return {
      key: "ueberfaellig",
      label: `Überfällig (${Math.abs(days)} T)`,
      rank: 4,
      bgClass: "bg-destructive/10",
      borderClass: "border-l-destructive",
      badgeClass: "bg-destructive text-destructive-foreground",
    };
  }
  if ((days !== null && days <= 2) || (priority === "hoch" && (days === null || days <= 5))) {
    return {
      key: "hoch",
      label: days === 0 ? "Heute fällig" : days === 1 ? "Morgen fällig" : days !== null ? `Hoch (${days} T)` : "Dringend (Prio Hoch)",
      rank: 3,
      bgClass: "bg-warning/10",
      borderClass: "border-l-warning",
      badgeClass: "bg-warning text-warning-foreground",
    };
  }
  if ((days !== null && days <= 7) || priority === "mittel") {
    return {
      key: "mittel",
      label: days !== null ? `Mittel (${days} T)` : "Mittel",
      rank: 2,
      bgClass: "bg-info/5",
      borderClass: "border-l-info",
      badgeClass: "bg-info/25 text-foreground",
    };
  }
  return {
    key: "niedrig",
    label: days !== null ? `Niedrig (${days} T)` : "Ohne Datum",
    rank: 1,
    bgClass: "bg-card",
    borderClass: "border-l-muted",
    badgeClass: "bg-muted text-muted-foreground",
  };
}

/* ============================ Expiry bucket (Ampel) ============================ */

export type ExpiryBucket = "abgelaufen" | "rot" | "orange" | "gelb" | "gruen" | "neutral";

export type ExpiryBucketMeta = {
  key: ExpiryBucket;
  label: string;
  rank: number; // higher = more urgent
  bgClass: string;
  borderClass: string;
  badgeClass: string;
};

export const EXPIRY_BUCKETS: { key: ExpiryBucket; label: string }[] = [
  { key: "rot", label: "≤ 1 Monat" },
  { key: "orange", label: "≤ 3 Monate" },
  { key: "gelb", label: "≤ 6 Monate" },
  { key: "gruen", label: "≤ 1 Jahr" },
  { key: "abgelaufen", label: "Abgelaufen" },
  { key: "neutral", label: "Später / Ohne Datum" },
];

export function getExpiryBucket(
  end_date: string | null,
  status: ContractStatus | null | undefined,
): ExpiryBucketMeta {
  if (status === "abgelaufen") {
    return {
      key: "abgelaufen",
      label: "Abgelaufen",
      rank: 5,
      bgClass: "bg-muted/60",
      borderClass: "border-l-foreground/40",
      badgeClass: "bg-foreground/70 text-background",
    };
  }
  const days = daysUntil(end_date);
  if (days === null) {
    return {
      key: "neutral",
      label: "Ohne Datum",
      rank: 0,
      bgClass: "bg-card",
      borderClass: "border-l-muted",
      badgeClass: "bg-muted text-muted-foreground",
    };
  }
  if (days < 0) {
    return {
      key: "abgelaufen",
      label: `Abgelaufen (${Math.abs(days)} T)`,
      rank: 5,
      bgClass: "bg-muted/60",
      borderClass: "border-l-foreground/40",
      badgeClass: "bg-foreground/70 text-background",
    };
  }
  if (days <= 30) {
    return {
      key: "rot",
      label: `≤ 1 Monat (${formatDuration(days)})`,
      rank: 4,
      bgClass: "bg-destructive/10",
      borderClass: "border-l-destructive",
      badgeClass: "bg-destructive text-destructive-foreground",
    };
  }
  if (days <= 90) {
    return {
      key: "orange",
      label: `≤ 3 Monate (${formatDuration(days)})`,
      rank: 3,
      bgClass: "bg-warning/15",
      borderClass: "border-l-warning",
      badgeClass: "bg-warning text-warning-foreground",
    };
  }
  if (days <= 180) {
    return {
      key: "gelb",
      label: `≤ 6 Monate (${formatDuration(days)})`,
      rank: 2,
      bgClass: "bg-yellow-100 dark:bg-yellow-500/15",
      borderClass: "border-l-yellow-500",
      badgeClass: "bg-yellow-400 text-yellow-950",
    };
  }
  if (days <= 365) {
    return {
      key: "gruen",
      label: `≤ 1 Jahr (${formatDuration(days)})`,
      rank: 1,
      bgClass: "bg-success/10",
      borderClass: "border-l-success",
      badgeClass: "bg-success text-success-foreground",
    };
  }
  return {
    key: "neutral",
    label: formatDuration(days),
    rank: 0,
    bgClass: "bg-card",
    borderClass: "border-l-muted",
    badgeClass: "bg-muted text-muted-foreground",
  };
}
