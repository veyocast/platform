import {
  playerDynamicTemplatePayloadSchema,
  type dynamicSlideOrientations,
  type dynamicTemplateSlideTypes,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { createHash } from "node:crypto";
import { playerDynamicDataSchema } from "./player-manifest";

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
  slide_type: (typeof dynamicTemplateSlideTypes)[number];
  slug: string;
};

/** Frozen publication identity and live source facts have independent clocks.
 * Access URLs and provider observation times never enter this metadata. */
export function buildDynamicTemplateDataMetadata({ snapshot, configuration, live }: {
  snapshot: DynamicSnapshotPayloadRow & { dynamic_slide_version_id: string };
  configuration: unknown;
  live?: { data_revision: unknown; content_hash: unknown };
}) {
  return playerDynamicDataSchema.parse({
    schemaVersion: 1,
    configurationSnapshotId: snapshot.id,
    snapshotId: snapshot.id,
    templateVersionId: snapshot.template_version_id,
    configurationHash: createHash("sha256").update(JSON.stringify([
      "legacy-dynamic-v1", snapshot.id, snapshot.dynamic_slide_version_id,
      snapshot.template_version_id, configuration
    ])).digest("hex"),
    contentHash: live ? live.content_hash : snapshot.source_revision_hash,
    dataRevision: live ? live.data_revision : 1
  });
}

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
    // This is the historical dynamic DOM profile. A Source configuration
    // cannot borrow a Sites template identity: unsupported clients play its
    // complete, checksum-verified PNG/MP4 through the normal binary path.
    if(Object.hasOwn(snapshot.snapshot_data_json,'syncConfiguration'))continue;
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
