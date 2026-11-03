export const BERATER_PROFILES = {
  GH: {
    id: "89d3c8a8-7972-4cac-8316-4524e55e335d",
    name: "Gheith",
    email: "geith.abojamil@gmail.com",
    prefixes: ["GH", "GHEITH"],
  },
  MO: {
    id: "1504fd8f-4573-458b-91b0-306f73f1cea3",
    name: "Mohamad",
    email: "latakiaa20@gmail.com",
    prefixes: ["MO", "MOHAMAD", "MOHAMMED"],
  },
  AD: {
    id: "5c32399f-31c1-4bb8-bc6b-f7167a7222ee",
    name: "Adam",
    email: "adamalsheik@gmail.com",
    prefixes: ["AD", "ADAM"],
  },
  BA: {
    id: "bd40e26b-8f7f-4444-9a09-8c7e3baa54aa",
    name: "Bashar Yahia",
    email: "alibashar1991@gmail.com",
    prefixes: ["BA", "BASHAR"],
  },
  AM: {
    id: "9cd508f0-5cea-4b3f-a6c1-d6005ec358e3",
    name: "Ammar",
    email: "ammaryahia935@gmail.com",
    prefixes: ["AM", "AMMAR"],
  },
  YA: {
    id: "f4fc734d-f051-42d0-a3ba-6e510a07980e",
    name: "Yasser",
    email: "yasseryahia@gmail.com",
    prefixes: ["YA", "YASSER"],
  },
  HA: {
    id: "21949832-05ee-41d7-a7e2-9b26651ab3c3",
    name: "Hamza",
    email: "revofc1@gmail.com",
    prefixes: ["HA", "HAMZA"],
  },
  JA: {
    id: "cfa1ff0c-145b-4058-b74b-a07b909c71ff",
    name: "Jamil",
    email: "jamilblitzvox@gmail.com",
    prefixes: ["JA", "JAMIL"],
  },
  BLITZ_VOX: {
    id: "437a3c5c-a1a7-4ff1-b102-72300f646100",
    name: "Blitz Vox",
    email: "blitzvox@gmail.com",
    prefixes: ["BV", "BLITZVOX"],
  },
};

export const DEFAULT_ADVISOR_ID = BERATER_PROFILES.BLITZ_VOX.id;

export function resolveAdvisorId(refNum: string | null | undefined): string {
  if (!refNum || typeof refNum !== "string") return DEFAULT_ADVISOR_ID;
  const s = refNum.trim().toUpperCase();
  
  if (s.startsWith("GH")) return BERATER_PROFILES.GH.id;
  if (s.startsWith("MO")) return BERATER_PROFILES.MO.id;
  if (s.startsWith("AD")) return BERATER_PROFILES.AD.id;
  if (s.startsWith("BA")) return BERATER_PROFILES.BA.id;
  if (s.startsWith("AM")) return BERATER_PROFILES.AM.id;
  if (s.startsWith("YA")) return BERATER_PROFILES.YA.id;
  if (s.startsWith("HA")) return BERATER_PROFILES.HA.id;
  if (s.startsWith("JA")) return BERATER_PROFILES.JA.id;
  
  return DEFAULT_ADVISOR_ID;
}
