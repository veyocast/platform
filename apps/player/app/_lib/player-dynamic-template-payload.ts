import {
  dynamicSlideOrientations,
  dynamicSlideTypes,
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

export type DynamicSnapshotPayloadRow = {
  id: string;
  snapshot_data_json: Record<string, unknown>;
  source_revision_hash: string;
  template_version_id: string;
};

export type DynamicTemplatePayloadVersionRow = {
  id: string;
  template_id: string;
};

export type DynamicTemplatePayloadRow = {
  id: string;
  orientation: (typeof dynamicSlideOrientations)[number];
  slide_type: (typeof dynamicSlideTypes)[number];
  slug: string;
};

export function buildDynamicTemplatePayloadMap({
  snapshots,
  templates,
  versions
}: {
  snapshots: DynamicSnapshotPayloadRow[];
  templates: DynamicTemplatePayloadRow[];
  versions: DynamicTemplatePayloadVersionRow[];
}) {
  const templateById = new Map(
    templates.map((template) => [template.id, template])
  );
  const versionById = new Map(
    versions.map((version) => [version.id, version])
  );
  const result = new Map<string, PlayerDynamicTemplatePayload>();

  for (const snapshot of snapshots) {
    const version = versionById.get(snapshot.template_version_id);
    const template = version ? templateById.get(version.template_id) : null;
    if (!version || !template) continue;
    const parsed = playerDynamicTemplatePayloadSchema.safeParse({
      data: snapshot.snapshot_data_json,
      orientation: template.orientation,
      schemaVersion: 1,
      slideType: template.slide_type,
      snapshotHash: snapshot.source_revision_hash,
      snapshotId: snapshot.id,
      templateSlug: template.slug,
      templateVersionId: snapshot.template_version_id
    });
    if (parsed.success) result.set(snapshot.id, parsed.data);
  }
  return result;
}
