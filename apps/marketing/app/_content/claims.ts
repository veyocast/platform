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
      "Bespreek welke databron voor jouw organisatie onderzocht of voorbereid kan worden.",
    routes: ["/integraties", "/oplossingen"],
    source: "docs/canon-alignment-product-roadmap.md S33-S34",
    status: "provisional"
  },
  uptime: {
    allowedCopy: "",
    routes: [],
    source: "Geen production-meetperiode of publieke SLO-bewijslast",
    status: "blocked"
  },
  pricing: {
    allowedCopy: "",
    routes: ["/prijzen"],
    source: "Definitieve prijsstructuur nog niet goedgekeurd",
    status: "blocked"
  }
} as const satisfies Record<string, MarketingClaim>;
