export type PublishedAlertTarget = {
  currentPublishedVersionId: string | null;
  status: string;
};

export type PublishedVersionGroup = {
  alert_version_id: string;
  screen_group_id: string;
};

export function publishedGroupIds(
  currentPublishedVersionId: string | null,
  versionGroups: PublishedVersionGroup[]
) {
  if (!currentPublishedVersionId) return [];
  return [...new Set(versionGroups
    .filter((target) => target.alert_version_id === currentPublishedVersionId)
    .map((target) => target.screen_group_id))];
}

export function activePublishedGroupIds(
  alerts: PublishedAlertTarget[],
  versionGroups: PublishedVersionGroup[]
) {
  return [...new Set(alerts.flatMap((alert) => alert.status === "published"
    ? publishedGroupIds(alert.currentPublishedVersionId, versionGroups)
    : []))];
}
