import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { fakerDE as faker } from "@faker-js/faker";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pgClient = new Client({ connectionString: dbUrl });
await pgClient.connect();

console.log("🚀 Starting Spariom CRM Mockup Data Seed...");

// 1. Ensure Allowlist & Create Users
const DEMO_USERS = [
  {
    email: "sarah.weber@spariom.de",
    password: "Spariom2026!Demo",
    full_name: "Sarah Weber",
    role: "haupt_vertriebler",
  },
  {
    email: "maximilian.koch@spariom.de",
    password: "Spariom2026!Demo",
    full_name: "Maximilian Koch",
    role: "haupt_vertriebler",
  },
  {
    email: "laura.schmidt@spariom.de",
    password: "Spariom2026!Demo",
    full_name: "Laura Schmidt",
    role: "mitarbeiter",
  },
  {
    email: "jonas.wagner@spariom.de",
    password: "Spariom2026!Demo",
    full_name: "Jonas Wagner",
    role: "mitarbeiter",
  },
  {
    email: "elena.mueller@spariom.de",
    password: "Spariom2026!Demo",
    full_name: "Elena Müller",
    role: "mitarbeiter",
  },
];

// Query existing users in auth.users
const existingUsersRes = await pgClient.query("SELECT id, email FROM auth.users");
const existingEmailMap = new Map(existingUsersRes.rows.map((r) => [r.email.toLowerCase(), r.id]));

const userIds = [];
// Find or collect bader969@gmx.de
const adminId = existingEmailMap.get("bader969@gmx.de");
if (adminId) {
  userIds.push({ id: adminId, name: "Bader Admin", role: "admin" });
}

for (const u of DEMO_USERS) {
  const emailLower = u.email.toLowerCase();
  // Allowlist
  await pgClient.query(
    "INSERT INTO public.auth_email_allowlist (email, note) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
    [emailLower, "Demo User"]
  );

  let uid = existingEmailMap.get(emailLower);
  if (!uid) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    if (error) {
      console.warn(`Could not create ${u.email}:`, error.message);
    } else if (created.user) {
      uid = created.user.id;
    }
  }

  if (uid) {
    // Ensure profile
    await pgClient.query(
      `INSERT INTO public.profiles (id, full_name, email, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      [uid, u.full_name, u.email]
    );

    // Set role
    await pgClient.query("DELETE FROM public.user_roles WHERE user_id = $1", [uid]);
    await pgClient.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)",
      [uid, u.role]
    );

    userIds.push({ id: uid, name: u.full_name, role: u.role });
  }
}

console.log(`✅ ${userIds.length} Users ready.`);

// 2. Setup Teams
const sarah = userIds.find((u) => u.name === "Sarah Weber") || userIds[0];
const maxK = userIds.find((u) => u.name === "Maximilian Koch") || userIds[0];
const laura = userIds.find((u) => u.name === "Laura Schmidt");
const elena = userIds.find((u) => u.name === "Elena Müller");
const jonas = userIds.find((u) => u.name === "Jonas Wagner");

let teamNordId, teamSuedId;

const tNordRes = await pgClient.query(
  `INSERT INTO public.teams (name, leader_id) VALUES ('Team Nord – Direktvertrieb', $1)
   ON CONFLICT DO NOTHING RETURNING id`,
  [sarah.id]
);
if (tNordRes.rows.length > 0) {
  teamNordId = tNordRes.rows[0].id;
} else {
  const existing = await pgClient.query("SELECT id FROM public.teams WHERE name = 'Team Nord – Direktvertrieb'");
  teamNordId = existing.rows[0]?.id;
}

const tSuedRes = await pgClient.query(
  `INSERT INTO public.teams (name, leader_id) VALUES ('Team Süd – Großkunden & KMU', $1)
   ON CONFLICT DO NOTHING RETURNING id`,
  [maxK.id]
);
if (tSuedRes.rows.length > 0) {
  teamSuedId = tSuedRes.rows[0].id;
} else {
  const existing = await pgClient.query("SELECT id FROM public.teams WHERE name = 'Team Süd – Großkunden & KMU'");
  teamSuedId = existing.rows[0]?.id;
}

if (teamNordId) {
  if (laura) await pgClient.query("INSERT INTO public.team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [teamNordId, laura.id]);
  if (elena) await pgClient.query("INSERT INTO public.team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [teamNordId, elena.id]);
}
if (teamSuedId) {
  if (jonas) await pgClient.query("INSERT INTO public.team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [teamSuedId, jonas.id]);
}

console.log("✅ Teams configured.");

// 3. Clear existing demo data if any, or append
const existingCustCount = (await pgClient.query("SELECT count(*) FROM public.customers")).rows[0].count;
console.log(`Current customers in DB: ${existingCustCount}`);

const GERMAN_CITIES = [
  { city: "Berlin", zip: "10115", street: "Friedrichstraße" },
  { city: "Berlin", zip: "10437", street: "Kastanienallee" },
  { city: "München", zip: "80331", street: "Maximilianstraße" },
  { city: "München", zip: "80802", street: "Leopoldstraße" },
  { city: "Hamburg", zip: "20354", street: "Neuer Wall" },
  { city: "Hamburg", zip: "22765", street: "Ottenser Hauptstraße" },
  { city: "Köln", zip: "50667", street: "Schildergasse" },
  { city: "Köln", zip: "50672", street: "Friesenstraße" },
  { city: "Frankfurt am Main", zip: "60313", street: "Zeil" },
  { city: "Frankfurt am Main", zip: "60594", street: "Schweizer Straße" },
  { city: "Stuttgart", zip: "70173", street: "Königstraße" },
  { city: "Düsseldorf", zip: "40212", street: "Königsallee" },
  { city: "Leipzig", zip: "04109", street: "Grimmaische Straße" },
  { city: "Dresden", zip: "01067", street: "Prager Straße" },
  { city: "Nürnberg", zip: "90403", street: "Karolinenstraße" },
  { city: "Hannover", zip: "30159", street: "Georgstraße" },
  { city: "Bremen", zip: "28195", street: "Obernstraße" },
  { city: "Dortmund", zip: "44135", street: "Westenhellweg" },
  { city: "Essen", zip: "45127", street: "Kettwiger Straße" },
  { city: "Bonn", zip: "53111", street: "Poststraße" },
];

const CUSTOMER_NOTES_SAMPLES = [
  "Erstgespräch sehr positiv verlaufen. Interessiert an Optimierung der Strom- und Gaskosten für Ein- und Zweifamilienhaus.",
  "Kunde wünscht jährliche Überprüfung vor Ablauf der Kündigungsfrist. Bevorzugt Ökostrom-Tarife ohne Vorkasse.",
  "Telefonisch erreicht. Zählerstände für beide Wohneinheiten wurden telefonisch durchgegeben und hinterlegt.",
  "Empfehlung durch bestehenden Kunden erhalten. Großes Interesse an Tarifwechsel für Gewerbeeinheit.",
  "Kunde prüft aktuell noch die Unterlagen der bisherigen Krankenkasse. Rückruf für nächste Woche vereinbart.",
  "Rückrufbitte bezüglich Wechselbonus und Preisgarantie für 24 Monate. Angebot per E-Mail zugestellt.",
  "Termin vor Ort wahrgenommen. Alle Zählernummern abfotografiert und digital archiviert.",
  "Möchte KFZ-Versicherung zum 01.01. wechseln. Aktuelle SF-Klasse 14 liegt vor.",
  "Sehr zufriedener Kunde im Bestand. Vertrag wurde erfolgreich verlängert.",
  "Interesse an PKV-Zusatzbausteinen für Zahnersatz und Chefarztbehandlung.",
];

// Generate 100 Customers
const customerIds = [];
const customerRows = [];

for (let i = 0; i < 100; i++) {
  const isFemale = faker.datatype.boolean();
  const salutation = isFemale ? "Frau" : "Herr";
  const firstName = faker.person.firstName(isFemale ? "female" : "male");
  const lastName = faker.person.lastName();
  const loc = GERMAN_CITIES[i % GERMAN_CITIES.length];
  const streetNumber = faker.number.int({ min: 1, max: 145 });
  const street = `${loc.street} ${streetNumber}`;
  const zip = loc.zip;
  const city = loc.city;
  const phone = `+49 1${faker.helpers.arrayElement(["51", "60", "70", "71", "72", "75", "76"])} ${faker.number.int({ min: 1000000, max: 9999999 })}`;
  const email = faker.internet.email({ firstName, lastName }).toLowerCase();
  const birthdate = faker.date.birthdate({ min: 21, max: 72, mode: "age" }).toISOString().split("T")[0];
  
  // 75% Kunden, 25% Interessenten (Leads)
  const status = i < 75 ? "kunde" : "interessent";
  const assigned = userIds[i % userIds.length];
  const teamId = (i % 2 === 0) ? teamNordId : teamSuedId;
  const notes = faker.helpers.arrayElement(CUSTOMER_NOTES_SAMPLES);
  const createdAt = faker.date.recent({ days: 320 });

  const res = await pgClient.query(
    `INSERT INTO public.customers (
      salutation, first_name, last_name, phone, email,
      street, zip, city, birthdate, notes,
      status, assigned_to, team_id, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
    RETURNING id, first_name, last_name, status, assigned_to`,
    [
      salutation, firstName, lastName, phone, email,
      street, zip, city, birthdate, notes,
      status, assigned.id, teamId, adminId || assigned.id, createdAt
    ]
  );

  customerIds.push(res.rows[0]);
}

console.log(`✅ 100 Customers & Leads created.`);

// 4. Generate 200 Contracts (Verträge)
const PROVIDERS_BY_TYPE = {
  energie_strom: [
    { name: "Vattenfall Europe", portal: "Check24 Profi" },
    { name: "E.ON Energie", portal: "Verivox Partner" },
    { name: "Yello Strom", portal: "Direktanbindung" },
    { name: "EnBW Energie", portal: "Check24 Profi" },
    { name: "RheinEnergie", portal: "Maklerpool BCA" },
    { name: "Lekker Energie", portal: "Verivox Partner" },
    { name: "Maingau Energie", portal: "Direktanbindung" },
  ],
  energie_gas: [
    { name: "E.ON Gas", portal: "Verivox Partner" },
    { name: "Vattenfall Gas", portal: "Check24 Profi" },
    { name: "GASAG Berlin", portal: "Direktanbindung" },
    { name: "Montana Energie", portal: "Verivox Partner" },
    { name: "Süwag Energie", portal: "Maklerpool BCA" },
  ],
  gkv: [
    { name: "Techniker Krankenkasse (TK)", portal: "Direktanbindung" },
    { name: "Barmer Ersatzkasse", portal: "Direktanbindung" },
    { name: "DAK Gesundheit", portal: "Maklerpool BCA" },
    { name: "AOK Bayern", portal: "Direktanbindung" },
    { name: "SBK Siemens-Betriebskrankenkasse", portal: "Direktanbindung" },
  ],
  pkv: [
    { name: "Allianz Private Krankenversicherung", portal: "Maklerpool BCA" },
    { name: "DKV Deutsche Krankenversicherung", portal: "Maklerpool BCA" },
    { name: "Barmenia Krankenversicherung", portal: "Direktanbindung" },
    { name: "Signal Iduna Krankenversicherung", portal: "Maklerpool BCA" },
    { name: "Ottonova Krankenversicherung", portal: "Direktanbindung" },
  ],
  telekommunikation: [
    { name: "Deutsche Telekom", portal: "Telekom Partnernetz" },
    { name: "Vodafone Deutschland", portal: "Direktanbindung" },
    { name: "O2 Telefónica", portal: "Check24 Profi" },
    { name: "1&1 Telecom", portal: "Direktanbindung" },
  ],
  kfz: [
    { name: "HUK-Coburg", portal: "Direktanbindung" },
    { name: "VHV Versicherungen", portal: "Check24 Profi" },
    { name: "Allianz Kfz", portal: "Maklerpool BCA" },
    { name: "DEVK Versicherungen", portal: "Direktanbindung" },
    { name: "ERGO Versicherung", portal: "Maklerpool BCA" },
  ],
};

const contractTypes = [
  "energie_strom", "energie_strom", "energie_strom", // ~35%
  "energie_gas", "energie_gas",                     // ~20%
  "gkv", "gkv",                                     // ~18%
  "telekommunikation",                              // ~12%
  "pkv",                                            // ~8%
  "kfz"                                             // ~7%
];

// Status weights: aktiv (60%), in_pruefung (18%), gekuendigt_wartet_neuabschluss (12%), abgelaufen (6%), storniert (4%)
const statusPool = [
  ...Array(12).fill("aktiv"),
  ...Array(4).fill("in_pruefung"),
  ...Array(3).fill("gekuendigt_wartet_neuabschluss"),
  ...Array(1).fill("abgelaufen"),
  ...Array(1).fill("storniert"),
];

const contractIds = [];
const now = new Date();

for (let i = 0; i < 200; i++) {
  // Give customers contracts (favoring 'kunde' over 'interessent', but some leads might have past contracts)
  const cust = i < 150 
    ? customerIds[i % 75] // first 75 are 'kunde'
    : customerIds[faker.number.int({ min: 0, max: customerIds.length - 1 })];

  const type = faker.helpers.arrayElement(contractTypes);
  const providerList = PROVIDERS_BY_TYPE[type];
  const prov = faker.helpers.arrayElement(providerList);
  const status = faker.helpers.arrayElement(statusPool);

  let monthlyAmount, commission;
  let details = {};

  if (type === "energie_strom") {
    monthlyAmount = faker.number.int({ min: 55, max: 185 });
    commission = faker.number.int({ min: 70, max: 190 });
    details = {
      zaehlernummer: `1EMH${faker.number.int({ min: 10000000, max: 99999999 })}`,
      vorversorger: faker.helpers.arrayElement(["Grundversorger", "E.ON", "Vattenfall", "Stadtwerke"]),
      verbrauch_kwh: faker.number.int({ min: 1800, max: 5500 }),
      preisgarantie_monate: faker.helpers.arrayElement([12, 24]),
      arbeitspreis_ct: faker.number.float({ min: 26.5, max: 34.0, fractionDigits: 2 }),
      grundpreis_euro: 12.50,
    };
  } else if (type === "energie_gas") {
    monthlyAmount = faker.number.int({ min: 85, max: 280 });
    commission = faker.number.int({ min: 80, max: 240 });
    details = {
      zaehlernummer: `7G${faker.number.int({ min: 10000000, max: 99999999 })}`,
      vorversorger: faker.helpers.arrayElement(["Lokale Stadtwerke", "E.ON", "Gasag"]),
      verbrauch_kwh: faker.number.int({ min: 12000, max: 32000 }),
      arbeitspreis_ct: faker.number.float({ min: 8.2, max: 12.8, fractionDigits: 2 }),
      grundpreis_euro: 14.00,
    };
  } else if (type === "gkv") {
    monthlyAmount = faker.number.int({ min: 380, max: 890 });
    commission = faker.number.int({ min: 150, max: 350 });
    details = {
      versichertennummer: `A${faker.number.int({ min: 100000000, max: 999999999 })}`,
      zusatzbeitrag_prozent: faker.helpers.arrayElement([0.9, 1.2, 1.6, 2.1]),
      familienangehoerige: faker.number.int({ min: 0, max: 3 }),
      bonusprogramm_aktiv: faker.datatype.boolean(),
    };
  } else if (type === "pkv") {
    monthlyAmount = faker.number.int({ min: 450, max: 980 });
    commission = faker.number.int({ min: 400, max: 950 });
    details = {
      tarifname: faker.helpers.arrayElement(["Premium Comfort Plus", "Exklusiv Vital 100", "Top Med Pro"]),
      selbstbehalt_euro: faker.helpers.arrayElement([300, 600, 1200]),
      stationaer_chefarzt: true,
      zahnersatz_prozent: 85,
    };
  } else if (type === "telekommunikation") {
    monthlyAmount = faker.number.float({ min: 29.99, max: 89.99, fractionDigits: 2 });
    commission = faker.number.int({ min: 45, max: 140 });
    details = {
      anschluss_art: faker.helpers.arrayElement(["Glasfaser 500", "VDSL 250", "Kabel Gigabit", "5G Business"]),
      rufnummernmitnahme: faker.datatype.boolean(),
      hardware_router: "AVM FRITZ!Box 7590 AX",
    };
  } else {
    // kfz
    monthlyAmount = faker.number.int({ min: 35, max: 130 });
    commission = faker.number.int({ min: 40, max: 90 });
    details = {
      kennzeichen: `${faker.helpers.arrayElement(["B", "M", "HH", "K", "F", "S"])}-${faker.string.alpha({ length: 2, casing: "upper" })} ${faker.number.int({ min: 100, max: 9999 })}`,
      fahrzeug_modell: faker.helpers.arrayElement(["VW Golf VIII", "BMW 320d", "Audi A4 Avant", "Mercedes C 220", "Tesla Model 3"]),
      sf_klasse: `SF ${faker.number.int({ min: 4, max: 25 })}`,
      deckung: faker.helpers.arrayElement(["Vollkasko 300/150", "Teilkasko 150", "Haftpflicht"]),
    };
  }

  // Contract dates
  // distribute start date in the past 18 months
  const startOffsetMonths = faker.number.int({ min: 1, max: 18 });
  const startDate = new Date();
  startDate.setMonth(now.getMonth() - startOffsetMonths);

  // end date:
  // some expiring in the next 1-3 months (renewal candidates!)
  // some active for 1-2 more years
  const endDate = new Date(startDate);
  if (status === "abgelaufen") {
    endDate.setMonth(now.getMonth() - faker.number.int({ min: 1, max: 6 }));
  } else if (status === "gekuendigt_wartet_neuabschluss") {
    // expires in 15 to 60 days
    endDate.setDate(now.getDate() + faker.number.int({ min: 10, max: 60 }));
  } else {
    endDate.setMonth(startDate.getMonth() + faker.helpers.arrayElement([12, 24]));
  }

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const refId = `SP-${type.substring(0, 3).toUpperCase()}-${startDate.getFullYear()}-${String(i + 1).padStart(4, "0")}`;
  const paymentMethod = faker.datatype.boolean({ probability: 0.85 }) ? "lastschrift" : "selbstzahler";

  const res = await pgClient.query(
    `INSERT INTO public.contracts (
      customer_id, type, status, provider, vermittlungsportal,
      referenz_id, start_date, end_date, monthly_amount, commission,
      details, kanban_position, payment_method, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
    RETURNING id, customer_id, type, status, provider, referenz_id`,
    [
      cust.id,
      type,
      status,
      prov.name,
      prov.portal,
      refId,
      startDateStr,
      endDateStr,
      monthlyAmount,
      commission,
      JSON.stringify(details),
      i % 10,
      paymentMethod,
      cust.assigned_to || adminId,
      startDate,
    ]
  );

  contractIds.push(res.rows[0]);
}

console.log(`✅ 200 Contracts created across all 6 categories.`);

// 5. Generate 40 Tasks (Aufgaben)
const TASK_TEMPLATES = [
  { title: "Zählerstand nachreichen für Stromtarif", desc: "Kunde muss Zählerstand für den Wechsel bestätigen." },
  { title: "Kündigungsbestätigung vom Vorversorger anfordern", desc: "Vorversorger hat Kündigungseingang noch nicht final bestätigt." },
  { title: "GKV-Mitgliedsbescheinigung weiterleiten", desc: "Neue Krankenkasse benötigt Mitgliedsbescheinigung des Vorversicherers." },
  { title: "Verlängerungsangebot Strom 2026/2027 vorbereiten", desc: "Vertrag läuft in 45 Tagen aus, Bestpreis-Tarifvergleich anfertigen." },
  { title: "Rücksprache wegen SEPA-Mandat & IBAN", desc: "Bankverbindung auf Lastschriftmandat unleserlich, telefonisch abstimmen." },
  { title: "Beratungstermin für PKV-Upgrade vereinbaren", desc: "Kunde möchte Chefarztbehandlung und 1-Bett-Zimmer einbinden." },
  { title: "KFZ-Versicherungsschein digital archivieren", desc: "Police von HUK-Coburg eingegangen, in Kundenakte hochladen." },
  { title: "Tarifvergleich für Gewerbegas präsentieren", desc: "Gewerbekunde wartet auf verbindliches Angebot für 2 Filialen." },
  { title: "Willkommensanruf nach Wechsel", desc: "Prüfen ob erste Abschlagszahlung reibungslos funktioniert hat." },
  { title: "Bonitätsprüfung Rückfrage beantworten", desc: "Portal fordert zusätzliche Adressbestätigung an." },
  { title: "Vertragsablauf Erinnerung senden", desc: "Kunde per WhatsApp / Mail an automatische Verlängerung erinnern." },
  { title: "Bonusauszahlung nach 12 Monaten prüfen", desc: "Prüfen ob Sofortbonus durch Versorger gutgeschrieben wurde." },
];

for (let i = 0; i < 40; i++) {
  const tmpl = TASK_TEMPLATES[i % TASK_TEMPLATES.length];
  const cust = customerIds[i % customerIds.length];
  const contract = contractIds[i % contractIds.length];
  const assigned = userIds[i % userIds.length];
  const status = i < 25 ? "offen" : "erledigt";

  // Due date: some overdue, some today, some future
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + (i < 8 ? -faker.number.int({ min: 1, max: 10 }) : faker.number.int({ min: 1, max: 21 })));
  const dueDateStr = dueDate.toISOString().split("T")[0];

  await pgClient.query(
    `INSERT INTO public.tasks (
      customer_id, contract_id, assigned_to, title, description,
      due_date, status, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
    [
      cust.id,
      contract.id,
      assigned.id,
      `${tmpl.title} (${cust.last_name})`,
      tmpl.desc,
      dueDateStr,
      status,
      adminId || assigned.id,
    ]
  );
}

console.log("✅ 40 Tasks created.");

// 6. Generate 25 Clarifications (Klärfälle)
const CLARIFICATION_TEMPLATES = [
  { cat: "zaehlerstand", title: "Zählerstandsfoto fehlt oder unscharf", desc: "Versorger moniert unplausiblen Anfangszählerstand. Foto vom Zählerkasten anfordern." },
  { cat: "km_stand", title: "Kilometerstand Nachweis für KFZ-Tarif", desc: "Aktueller Tacho-Stand weicht um > 15.000 km von Angabe ab." },
  { cat: "familienversicherung", title: "Nachweis Familienversicherung Kind", desc: "Geburtsurkunde und Schulbescheinigung für Mitversicherung fehlen." },
  { cat: "unterlagen", title: "Gewerbeanmeldung für Tarifkondition erforderlich", desc: "Gewerbetarif benötigt Kopie des Gewerbescheins." },
  { cat: "bankdaten", title: "SEPA-Lastschrift Rückläufer / falsche IBAN", desc: "Erste Abbuchung konnte nicht ausgeführt werden. Neue Bankverbindung erfragen." },
  { cat: "widerruf", title: "Kunde fragt nach Widerrufsfrist für Altvertrag", desc: "Prüfung ob Kündigung oder Widerruf des vorherigen Vertrags greift." },
  { cat: "sonstiges", title: "Doppelversorgung / Netznutzungsstreit", desc: "Netzbetreiber meldet bestehende Anmeldung eines Drittanbieters." },
];

const clarStatusPool = ["offen", "offen", "wartend", "wartend", "erledigt"];

for (let i = 0; i < 25; i++) {
  const tmpl = CLARIFICATION_TEMPLATES[i % CLARIFICATION_TEMPLATES.length];
  const cust = customerIds[i % customerIds.length];
  const contract = contractIds[i % contractIds.length];
  const assigned = userIds[i % userIds.length];
  const status = clarStatusPool[i % clarStatusPool.length];

  const dueDate = new Date();
  dueDate.setDate(now.getDate() + faker.number.int({ min: 1, max: 14 }));
  const dueDateStr = dueDate.toISOString().split("T")[0];

  await pgClient.query(
    `INSERT INTO public.clarifications (
      title, description, category, status, customer_id, contract_id,
      due_date, assigned_to, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
    [
      `${tmpl.title} – ${cust.first_name} ${cust.last_name}`,
      tmpl.desc,
      tmpl.cat,
      status,
      cust.id,
      contract.id,
      dueDateStr,
      assigned.id,
      adminId || assigned.id,
    ]
  );
}

console.log("✅ 25 Clarifications created.");

// 7. Generate 50 Customer Notes (Notizen & Anrufprotokolle)
const NOTE_SNIPPETS = [
  { type: "anruf", text: "Telefonat geführt: Kunde sehr zufrieden mit Einsparung von ca. 320 € / Jahr beim Stromwechsel." },
  { type: "anruf", text: "Rückrufversuch: Mailbox besprochen mit Bitte um Rückmeldung bzgl. Zählerstand." },
  { type: "notiz", text: "Persönliche Beratung im Büro: Unterlagen vollständig entgegengenommen und digitalisiert." },
  { type: "notiz", text: "Kunde möchte zum Jahresende auch seine KFZ-Versicherung überprüfen lassen." },
  { type: "system", text: "Automatische Erinnerung: Kündigungsfrist für Gasvertrag endet in 60 Tagen." },
  { type: "anruf", text: "Beratung Krankenversicherung: Vergleich zwischen TK und Barmer durchgesprochen." },
  { type: "notiz", text: "Kunde zieht zum nächsten Monat um. Neue Adresse erfasst und Übernahme des Vertrags geprüft." },
  { type: "anruf", text: "Zählerstand telefonisch abgeglichen: 48.912 kWh. An Versorger übermittelt." },
];

for (let i = 0; i < 50; i++) {
  const cust = customerIds[i % customerIds.length];
  const note = NOTE_SNIPPETS[i % NOTE_SNIPPETS.length];
  const author = userIds[i % userIds.length];
  const createdAt = faker.date.recent({ days: 120 });

  await pgClient.query(
    `INSERT INTO public.customer_notes (
      customer_id, author_id, content, note_type, created_at
    ) VALUES ($1, $2, $3, $4, $5)`,
    [cust.id, author.id, note.text, note.type, createdAt]
  );
}

console.log("✅ 50 Customer Notes created.");

await pgClient.end();
console.log("🎉 Seed finished successfully! All demo data is live in database.");
