import "server-only";
import { randomUUID } from "node:crypto";
import { hasCapability } from "@veyocast/auth";
import { mediaFrameDefaultSettings, mediaFrameExpectedSourceSchema, mediaFrameSettingsSchema } from "@veyocast/contracts";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { readMediaFrameSourceAction } from "./media-frame-actions";
import { loadContentFilmstripPage, loadMediaFrameSeriesBinding } from "./media-frame-filmstrip-data.server";
import type { MediaFrameEditorProps, MediaFrameSource, MediaFrameVersion } from "./media-frame-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
type Client = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
type Row = Record<string, unknown>;
type Result = { ok: true; props: MediaFrameEditorProps; archived: boolean } | { ok: false; missing: boolean; message: string };
const failure = (missing = false): Result => ({ ok: false, missing, message: "Het media-ontwerp of een geverifieerde bron kan nu niet veilig worden gelezen. Er is niets gewijzigd; probeer opnieuw of ga terug naar Content." });
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

async function imageOptions(client: Client, tenantId: string, actorScope: string): Promise<MediaFrameSource[]> {
  const result = await client.from("media_assets").select("id").eq("tenant_id", tenantId).eq("kind", "image").eq("status", "ready").eq("source_kind", "user").is("deleted_at", null).order("created_at", { ascending: false }).limit(24);
  if (result.error) return [];
  const results = await Promise.all((result.data ?? []).map(row => readMediaFrameSourceAction({ tenantId, mediaAssetId: String(row.id), role: "background" }, actorScope)));
  return results.flatMap(result => result.ok ? [result.source] : []);
}

/** GET only reads tenant-scoped immutable versions and transient signed URLs. */
export async function loadMediaFrameEditor(identity: { frameId: string } | { assetId: string }): Promise<Result> {
  const identifier = "frameId" in identity ? identity.frameId : identity.assetId;
  if (!uuid.test(identifier)) return failure(true);
  const session = await requireTenantControlSession("tenant.media.read");
  if (!session.isLive || !session.tenantId || !session.userId) return failure();
  const tenantId = session.tenantId, actorScope = `${tenantId}:${session.userId}`;
  const client = await createControlSupabaseClient();
  if (!client) return failure();
  try {
    let query = client.from("media_frames").select("id,source_asset_id,is_primary,status,revision,current_version_id").eq("tenant_id", tenantId);
    query = "frameId" in identity ? query.eq("id", identity.frameId) : query.eq("source_asset_id", identity.assetId).eq("is_primary", true);
    const result = await query.maybeSingle();
    if (result.error) return failure();
    const frame = result.data;
    const canWrite = session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.media.write");
    if (!frame) {
      if ("frameId" in identity) return failure(true);
      const source = await readMediaFrameSourceAction({ tenantId, mediaAssetId: identity.assetId, role: "media" }, actorScope);
      if (!source.ok) return failure();
      const filmstrip = await loadContentFilmstripPage(client, tenantId);
      if (!filmstrip) return failure();
      return { ok: true, archived: false, props: { tenantId, actorScope, mediaSeries: { contentKey: `media:${identity.assetId}`, membership: null, series: null, filmstrip }, frameId: randomUUID(), isPrimary: true, isNew: true, frameRevision: 0, versionId: null, versionNumber: 0,
        settings: mediaFrameDefaultSettings(source.source), mainSource: source.source, imageSources: await imageOptions(client, tenantId, actorScope), versions: [], canWrite, canReplayPending: canWrite } };
    }
    if (!uuid.test(String(frame.id)) || !uuid.test(String(frame.source_asset_id)) || !uuid.test(String(frame.current_version_id)) || !Number.isSafeInteger(frame.revision) || Number(frame.revision) < 1 || !["active", "archived"].includes(String(frame.status))) return failure();
    const versions = await client.from("media_frame_versions").select("id,version_number,settings_json,created_at").eq("tenant_id", tenantId).eq("frame_id", frame.id).order("version_number", { ascending: false }).limit(20);
    if (versions.error || !versions.data?.length || !versions.data.some(version => version.id === frame.current_version_id)) return failure();
    const versionIds = versions.data.map(version => String(version.id));
    if (versionIds.some(id => !uuid.test(id))) return failure();
    const refs = await client.from("media_frame_version_assets").select("version_id,role,media_asset_id,variant_id,checksum_sha256,byte_size,storage_bucket,storage_path,mime_type,width,height,duration_seconds").eq("tenant_id", tenantId).in("version_id", versionIds);
    if (refs.error || !refs.data || refs.data.length > 40) return failure();
    const assetIds = [...new Set(refs.data.map(ref => String(ref.media_asset_id)))], variantIds = [...new Set(refs.data.map(ref => String(ref.variant_id)))];
    if (!assetIds.length || assetIds.some(id => !uuid.test(id)) || variantIds.some(id => !uuid.test(id))) return failure();
    const [assets, variants] = await Promise.all([
      client.from("media_assets").select("id,kind,title,original_file_name,duration_seconds").eq("tenant_id", tenantId).in("id", assetIds),
      client.from("media_variants").select("id,asset_id,checksum_sha256,file_size_bytes,storage_bucket,storage_path,mime_type").eq("tenant_id", tenantId).in("id", variantIds),
    ]);
    if (assets.error || variants.error) return failure();
    const assetById = new Map((assets.data ?? []).map(asset => [String(asset.id), asset as Row])), variantById = new Map((variants.data ?? []).map(variant => [String(variant.id), variant as Row]));
    const signed = new Map<string, Promise<string | null>>();
    async function source(ref: Row): Promise<MediaFrameSource | null> {
      const fingerprint = mediaFrameExpectedSourceSchema.safeParse({ role: ref.role, mediaAssetId: ref.media_asset_id, variantId: ref.variant_id, checksumSha256: ref.checksum_sha256, byteSize: Number(ref.byte_size) });
      if (!fingerprint.success) return null;
      const asset = assetById.get(fingerprint.data.mediaAssetId), variant = variantById.get(fingerprint.data.variantId), path = ref.storage_path;
      if (!asset || !variant || !["image", "video"].includes(String(asset.kind)) || ref.role === "background" && asset.kind !== "image" || variant.asset_id !== ref.media_asset_id || variant.checksum_sha256 !== ref.checksum_sha256 || Number(variant.file_size_bytes) !== fingerprint.data.byteSize || variant.storage_bucket !== ref.storage_bucket || variant.storage_path !== path || variant.mime_type !== ref.mime_type || ref.storage_bucket !== "tenant-media" || typeof path !== "string" || !path.startsWith(`tenants/${tenantId}/assets/${ref.media_asset_id}/`) || path.split("/").some(part => part === "." || part === "..") || (/[\\?#]/.test(path) || Array.from(path).some(character => character.charCodeAt(0) < 32))) return null;
      if (!signed.has(path)) signed.set(path, client!.storage.from("tenant-media").createSignedUrl(path, 900).then(result => result.error ? null : result.data?.signedUrl ?? null));
      const url = await signed.get(path)!;
      if (!url) return null;
      if (asset.kind === "video" && !positive(Number(asset.duration_seconds))) return null;
      return { mediaAssetId: fingerprint.data.mediaAssetId, kind: asset.kind as "image" | "video", title: String(asset.title), fileName: String(asset.original_file_name), byteSize: fingerprint.data.byteSize, width: positive(ref.width), height: positive(ref.height), durationSeconds: positive(Number(ref.duration_seconds)), ...(asset.kind === "video" ? { maximumDurationSeconds: Math.max(5, Math.min(3600, Math.ceil(Number(asset.duration_seconds)))) } : {}), sourceUrl: url, posterUrl: null, expectedSource: fingerprint.data };
    }
    const history: MediaFrameVersion[] = [];
    for (const version of versions.data) {
      const settings = mediaFrameSettingsSchema.safeParse(version.settings_json);
      if (!settings.success || !Number.isSafeInteger(version.version_number) || Number(version.version_number) < 1) return failure();
      const versionRefs = refs.data.filter(ref => ref.version_id === version.id);
      const sources = await Promise.all(versionRefs.map(ref => source(ref)));
      // Never replace a historical variant with today's preferred variant.
      history.push({ id: String(version.id), number: Number(version.version_number), createdAt: String(version.created_at), settings: settings.data, sources: sources.flatMap(source => source ? [source] : []) });
    }
    const current = history.find(version => version.id === frame.current_version_id)!;
    const main = current.sources.find(source => source.expectedSource.role === "media" && source.mediaAssetId === frame.source_asset_id);
    const background = current.settings.appearance.background;
    if (!main || current.sources.length !== (background.kind === "image" ? 2 : 1) || background.kind === "image" && !current.sources.some(source => source.expectedSource.role === "background" && source.mediaAssetId === background.mediaAssetId)) return failure();
    const [binding, filmstrip] = await Promise.all([
      loadMediaFrameSeriesBinding(client, tenantId, { frameId: String(frame.id), frameRevision: Number(frame.revision), versionId: current.id, versionNumber: current.number }),
      loadContentFilmstripPage(client, tenantId),
    ]);
    if (!binding) return { ok: false, missing: false, message: "De actuele frameversie en reeks konden niet samen worden bevestigd. Je bewaarde invoer blijft behouden; vernieuw de pagina om verder te gaan." };
    if (!filmstrip) return failure();
    const frozenBackground = current.sources.filter(source => source.expectedSource.role === "background");
    const recentImages = await imageOptions(client, tenantId, actorScope);
    const imageSources = [...frozenBackground, ...recentImages.filter(source => !frozenBackground.some(frozen => frozen.mediaAssetId === source.mediaAssetId))];
    return { ok: true, archived: frame.status === "archived", props: { tenantId, actorScope, mediaSeries: { contentKey: frame.is_primary === true ? `media:${frame.source_asset_id}` : `media-frame:${frame.id}`, ...binding, filmstrip }, frameId: String(frame.id), isPrimary: frame.is_primary === true, isNew: false, frameRevision: Number(frame.revision), versionId: current.id, versionNumber: current.number, settings: current.settings, mainSource: main, imageSources, versions: history, canWrite: canWrite && frame.status === "active", canReplayPending: canWrite } };
  } catch { return failure(); }
}
