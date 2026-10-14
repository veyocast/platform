import { sitesCurrentPresentationSourceRevision, sitesCurrentPresentationVersion, sitesDynamicConfigurationSchema, sitesSystemImageChecksums, type SitesDynamicConfiguration, type SitesUnifiedKind } from "@veyocast/contracts";

const sportlinkKinds: Record<string, { unifiedKind: SitesUnifiedKind; extraType?: string }> = {
  sport_program: { unifiedKind: "programma" }, sport_results: { unifiedKind: "uitslagen" }, sport_standing: { unifiedKind: "competitie" },
  sport_period_standing: { unifiedKind: "sportlink-extra", extraType: "periodestand" }, sport_match_of_the_day: { unifiedKind: "matchday" }, sport_next_match: { unifiedKind: "matchday" },
  sport_cancellations: { unifiedKind: "sportlink-extra", extraType: "afgelastingen" }, sport_dressing_rooms: { unifiedKind: "sportlink-extra", extraType: "kleedkamers" },
  sport_officials: { unifiedKind: "sportlink-extra", extraType: "officials" }, sport_team: { unifiedKind: "sportlink-extra", extraType: "teaminfo" },
  sport_sponsor: { unifiedKind: "partners" }, sport_activities: { unifiedKind: "agenda" }, sport_trainings: { unifiedKind: "trainingen" },
  sport_volunteers: { unifiedKind: "vacatures" }, sport_birthdays: { unifiedKind: "verjaardagen" },
  sport_visitor_arrivals: { unifiedKind: "bezoekers", extraType: "welkom-bezoekers" }, sport_referee_arrivals: { unifiedKind: "sportlink-extra", extraType: "welkom-scheidsrechters" },
  news: { unifiedKind: "rss" }, menu: { unifiedKind: "kantine" }, price_list: { unifiedKind: "kantine" }, ledscores_live_match: { unifiedKind: "led" }
};

export function sitesUnifiedOptionsForDynamicSlide(slideType: string) {
  return sportlinkKinds[slideType] ?? { unifiedKind: "sportlink-extra" as const, extraType: slideType.replace(/^sport_/, "").replaceAll("_", "-") };
}

export function createSitesSourceDesign(provider: SitesDynamicConfiguration["provider"], title: string, orientation: SitesDynamicConfiguration["orientation"] = "landscape", unifiedKind: SitesUnifiedKind = provider === "led-scores" ? "led" : provider === "menu" ? "kantine" : "sportlink-extra"): SitesDynamicConfiguration {
  return sitesDynamicConfigurationSchema.parse({ schemaVersion: 1, rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesCurrentPresentationSourceRevision, provider, title, unifiedKind, themeId: "fieldflow", orientation, overlay: 65, accent: "#ff8127", scale: 100, safeArea: 6, seconds: 15, rowsPerPage: provider === "menu" ? 12 : 4 });
}

export function sitesSystemBackground(path: string) {
  if (!Object.hasOwn(sitesSystemImageChecksums, path)) return undefined;
  const knownPath = path as keyof typeof sitesSystemImageChecksums;
  return { kind: "system" as const, path: knownPath, checksumSha256: sitesSystemImageChecksums[knownPath] };
}

export function updateSitesSourceDesign(current: SitesDynamicConfiguration, patch: Partial<SitesDynamicConfiguration>) {
  return sitesDynamicConfigurationSchema.parse({ ...current, ...patch });
}
