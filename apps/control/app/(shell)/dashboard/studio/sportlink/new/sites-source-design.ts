import { sitesDynamicConfigurationSchema, sitesPresentationSourceRevision, sitesPresentationVersion, sitesSystemImageChecksums, type SitesDynamicConfiguration } from "@veyocast/contracts";

export function createSitesSourceDesign(provider: SitesDynamicConfiguration["provider"], title: string, orientation: SitesDynamicConfiguration["orientation"] = "landscape"): SitesDynamicConfiguration {
  return sitesDynamicConfigurationSchema.parse({ schemaVersion: 1, rendererVersion: sitesPresentationVersion, sourceRevision: sitesPresentationSourceRevision, provider, title, themeId: "fieldflow", orientation, overlay: 65, accent: "#ff8127", scale: 100, safeArea: 6, seconds: 15, rowsPerPage: provider === "menu" ? 12 : 4 });
}

export function sitesSystemBackground(path: string) {
  if (!Object.hasOwn(sitesSystemImageChecksums, path)) return undefined;
  const knownPath = path as keyof typeof sitesSystemImageChecksums;
  return { kind: "system" as const, path: knownPath, checksumSha256: sitesSystemImageChecksums[knownPath] };
}

export function updateSitesSourceDesign(current: SitesDynamicConfiguration, patch: Partial<SitesDynamicConfiguration>) {
  return sitesDynamicConfigurationSchema.parse({ ...current, ...patch });
}
