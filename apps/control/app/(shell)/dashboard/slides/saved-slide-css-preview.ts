import "server-only";

import {
  menuDocumentV2Schema,
  menuDomAssetRefs,
  menuDomPresentationSchema,
  playerDynamicTemplatePayloadSchema,
  sitesDynamicConfigurationSchema,
  syncDynamicConfigurationSchema,
  syncSlideAssets,
  syncSlideDurationMs,
  type PlayerDynamicTemplatePayload,
  type SitesPresentation,
  type SyncSlidePresentation
} from "@veyocast/contracts";
import { projectSyncDynamicSnapshot } from "@veyocast/content-templates/sync-dynamic-projector";
import { buildSitesPresentationFromDynamicPayload } from "@veyocast/content-templates/sites-dynamic-projector";
import type { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { collectPreviewMediaAssetIds, loadPreviewAssets } from "../../../../lib/dynamic-preview-assets";

type Client = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
type Slide = {
  id: string;
  tenant_id: string;
  current_snapshot_id: string | null;
  current_published_version_id: string | null;
  active_draft_version_id: string | null;
};
export type SavedSlideCssPreview =
  | { kind: "source"; payload: PlayerDynamicTemplatePayload; presentation: SyncSlidePresentation; assetUrls: Record<string, string>; durationSeconds: number; id: string }
  | { kind: "menu"; payload: PlayerDynamicTemplatePayload; presentation: SitesPresentation; assetUrls: Record<string, string> };

/** A read-only authoring preview never needs a render receipt. Prefer the pinned
 * published snapshot. Only an initial publication without a last-good snapshot
 * may preview its exact publishing version while the descriptor is queued.
 * This does not mark a snapshot ready or make it eligible for a playlist. */
export async function loadSavedSlideCssPreview(client: Client, tenantId: string, slide: Slide): Promise<SavedSlideCssPreview | null> {
  if (slide.tenant_id !== tenantId) return null;
  const versionId = slide.current_published_version_id ?? (!slide.current_snapshot_id ? slide.active_draft_version_id : null);
  if (!versionId) return null;
  // Completion can commit between the slide read and this version read. The
  // same initial version remains eligible after that transition; a new draft
  // never becomes a candidate while a pinned published snapshot exists.
  const versionStatuses = slide.current_published_version_id ? ["published"] : ["publishing", "published"];
  try {
    const versionResult = await client.from("dynamic_slide_versions")
      .select("id,tenant_id,dynamic_slide_id,status,orientation,slide_type,template_version_id,data_source_id,configuration_json")
      .eq("tenant_id", tenantId).eq("dynamic_slide_id", slide.id).eq("id", versionId)
      .in("status", versionStatuses).maybeSingle();
    const version = versionResult.data;
    if (versionResult.error || !version || version.tenant_id !== tenantId || version.dynamic_slide_id !== slide.id || version.id !== versionId || !versionStatuses.includes(version.status)) return null;

    let query = client.from("dynamic_slide_snapshots")
      .select("id,tenant_id,dynamic_slide_id,dynamic_slide_version_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status")
      .eq("tenant_id", tenantId).eq("dynamic_slide_id", slide.id).eq("dynamic_slide_version_id", versionId)
      .eq("template_version_id", version.template_version_id).eq("data_source_id", version.data_source_id)
      .in("status", ["queued", "rendering", "ready"]);
    query = slide.current_snapshot_id ? query.eq("id", slide.current_snapshot_id)
      : query.order("snapshot_sequence", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
    const snapshotResult = await query.maybeSingle();
    const snapshot = snapshotResult.data;
    if (snapshotResult.error || !snapshot || snapshot.tenant_id !== tenantId || snapshot.dynamic_slide_id !== slide.id || snapshot.dynamic_slide_version_id !== versionId || snapshot.template_version_id !== version.template_version_id || snapshot.data_source_id !== version.data_source_id || !["queued", "rendering", "ready"].includes(snapshot.status) || (slide.current_snapshot_id && (snapshot.id !== slide.current_snapshot_id || snapshot.status !== "ready"))) return null;
    const data = record(snapshot.snapshot_data_json), configuration = record(version.configuration_json);
    if (!data || !configuration) return null;
    const source = Object.hasOwn(data, "syncConfiguration");
    const cfg = source ? syncDynamicConfigurationSchema.safeParse(data.syncConfiguration) : null;
    const savedCfg = source ? syncDynamicConfigurationSchema.safeParse(configuration.syncConfiguration) : null;
    const document = source ? null : menuDocumentV2Schema.safeParse(data.menuDocument ?? record(data.priceList)?.menuDocument);
    const savedDocument = source ? null : menuDocumentV2Schema.safeParse(configuration);
    if (source) {
      if (!cfg?.success || !savedCfg?.success || JSON.stringify(cfg.data) !== JSON.stringify(savedCfg.data) || cfg.data.slideType !== version.slide_type || cfg.data.seed.orientation !== version.orientation) return null;
    } else if (!document?.success || !savedDocument?.success || document.data.id !== savedDocument.data.id || document.data.tenantId !== tenantId || savedDocument.data.tenantId !== tenantId || document.data.revision !== savedDocument.data.revision || JSON.stringify(document.data.sitesConfiguration) !== JSON.stringify(savedDocument.data.sitesConfiguration)) return null;

    const templateVersion = await client.from("dynamic_template_versions").select("id,template_id").eq("id", version.template_version_id).maybeSingle();
    if (templateVersion.error || !templateVersion.data || templateVersion.data.id !== version.template_version_id) return null;
    const template = await client.from("dynamic_templates").select("id,slug,orientation,slide_type").eq("id", templateVersion.data.template_id).maybeSingle();
    if (template.error || !template.data || template.data.id !== templateVersion.data.template_id || template.data.orientation !== version.orientation || template.data.slide_type !== version.slide_type) return null;

    const authoredRefs = source && cfg?.success ? syncSlideAssets(cfg.data.seed) : menuDomAssetRefs(data);
    const ids = [...new Set([...collectPreviewMediaAssetIds(data), ...authoredRefs.flatMap(ref => ref.kind === "tenant" ? [ref.mediaAssetId] : [])])];
    if (ids.length > 201) return null;
    const assets = await loadPreviewAssets(client, tenantId, ids);
    if (ids.some(id => !assets.has(id)) || authoredRefs.some(ref => ref.kind === "tenant" && assets.get(ref.mediaAssetId)?.checksumSha256 !== ref.checksumSha256)) return null;
    if (!source && document?.success && (document.data.assets.some(ref => ref.sha256 && assets.get(ref.assetId)?.checksumSha256 !== ref.sha256) || savedDocument?.success && savedDocument.data.assets.some(ref => ref.sha256 && assets.get(ref.assetId)?.checksumSha256 !== ref.sha256))) return null;
    const payload = playerDynamicTemplatePayloadSchema.safeParse({ schemaVersion: 1, data, assets: Object.fromEntries(assets),
      orientation: version.orientation, slideType: version.slide_type, snapshotId: snapshot.id, snapshotHash: snapshot.source_revision_hash,
      templateVersionId: snapshot.template_version_id, templateSlug: template.data.slug });
    if (!payload.success) return null;
    const assetUrls = Object.fromEntries([...assets].map(([id, asset]) => [id, asset.url]));
    if (source && cfg?.success) {
      const projected = projectSyncDynamicSnapshot(payload.data, cfg.data.seed);
      if (!projected.ok || !verifiedRefs(syncSlideAssets(projected.presentation), assets)) return null;
      return { kind: "source", payload: payload.data, presentation: projected.presentation, assetUrls, durationSeconds: syncSlideDurationMs(projected.presentation, cfg.data.secondsPerPage) / 1000, id: snapshot.id };
    }
    const presentation = menuDomPresentationSchema.safeParse(buildSitesPresentationFromDynamicPayload(payload.data));
    const savedMenuConfiguration = savedDocument?.success ? sitesDynamicConfigurationSchema.safeParse(savedDocument.data.sitesConfiguration) : null;
    if (!presentation.success || presentation.data.kind !== "dynamic" || !savedMenuConfiguration?.success || JSON.stringify(presentation.data.configuration) !== JSON.stringify(savedMenuConfiguration.data) || !verifiedRefs(menuDomAssetRefs(presentation.data), assets)) return null;
    return { kind: "menu", payload: payload.data, presentation: presentation.data, assetUrls };
  } catch {
    // A failed read or unavailable asset must not replace the last-good preview.
    return null;
  }
}

function verifiedRefs(refs: ReturnType<typeof syncSlideAssets>, assets: Awaited<ReturnType<typeof loadPreviewAssets>>) {
  return refs.every(ref => ref.kind !== "tenant" || Boolean(assets.get(ref.mediaAssetId)?.mimeType.startsWith("image/") && assets.get(ref.mediaAssetId)?.checksumSha256 === ref.checksumSha256));
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
