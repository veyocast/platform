import { syncContentFamilies, type SyncContentFamily } from "@veyocast/contracts";

const scopedFamilies: SyncContentFamily[] = ["club-program", "team-program", "pool-program", "club-results", "team-results", "pool-results"];
/** Presentation only: all canonical family IDs and deep links remain unchanged. */
export const contentCreateTasks = syncContentFamilies.filter(family => !scopedFamilies.includes(family.id));
export function contentTaskScopes(task: "fixtures" | "results") {
  return task === "results"
    ? [{ family: "club-results", label: "Hele club" }, { family: "team-results", label: "Eén team" }, { family: "pool-results", label: "Eén poule" }] as const
    : [{ family: "club-program", label: "Hele club" }, { family: "team-program", label: "Eén team" }, { family: "pool-program", label: "Eén poule" }] as const;
}
export function contentWizardHref(family: SyncContentFamily, mode?: "manual" | "connected") {
  const params = new URLSearchParams({ family });
  if (mode) params.set("mode", mode);
  return `/dashboard/studio/new?${params}`;
}
