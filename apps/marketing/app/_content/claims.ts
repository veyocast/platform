export type MarketingClaim = {
  allowedCopy: string;
  routes: string[];
  source: string;
  status: "approved" | "provisional" | "blocked";
};

export const marketingClaims = {
  offlinePlayback: {
    allowedCopy:
      "Een geldige lokale release blijft spelen wanneer de internetverbinding tijdelijk wegvalt.",
    routes: ["/", "/product", "/functies/offline-afspelen", "/publisher"],
    source: "docs/player-offline-canon.md en apps/player",
    status: "approved"
  },
  immutableReleases: {
    allowedCopy:
      "Publiceren maakt een onveranderlijke release; een nieuwe versie wordt pas actief nadat alle bestanden zijn gecontroleerd.",
    routes: ["/", "/product", "/publisher", "/functies/playlists"],
    source: "docs/technical-canon.md en Supabase release-model",
    status: "approved"
  },
  remoteScreenManagement: {
    allowedCopy:
      "Beheer gekoppelde schermen, publicaties en status vanuit VeyoCast Publisher.",
    routes: ["/", "/product", "/functies/schermen", "/functies/monitoring"],
    source: "apps/control schermvloot en releasecenter",
    status: "approved"
  },
  roleBasedAccess: {
    allowedCopy:
      "Werk met beschermde standaardrollen en eigen werkrollen binnen de organisatie.",
    routes: ["/product", "/publisher", "/over-ons"],
    source: "packages/auth, apps/control teambeheer en RLS-tests",
    status: "approved"
  },
  integrations: {
    allowedCopy:
      "Gebruik Sportlink, een gecontroleerde Twelve XLSX-import, RSS/nieuws, eigen media en Sponsor Hub volgens de beschikbare tenantmodules.",
    routes: ["/integraties", "/oplossingen"],
    source: "apps/control integraties, packages/sports, XLSX-import en Sponsor Hub",
    status: "approved"
  },
  uptime: {
    allowedCopy: "",
    routes: [],
    source: "Geen production-meetperiode of publieke SLO-bewijslast",
    status: "blocked"
  },
  pricing: {
    allowedCopy:
      "14 dagen gratis, daarna € 5,95 inclusief btw per actief scherm per maand.",
    routes: ["/", "/prijzen"],
    source: "Vector v2 billingcanon en packages/domain/src/billing.ts",
    status: "approved"
  }
} as const satisfies Record<string, MarketingClaim>;
