"use server";

import { randomUUID } from "node:crypto";
import { fetchYouTubeMetadata, fetchYouTubePlaylistMetadata, parseYouTubePlaylistId, parseYouTubeVideoId } from "@veyocast/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { registerYouTubePlaylistValidation } from "../../../../../lib/supabase/youtube-provider-validation";
import { registerSitesSourceProviderProof } from "../../data-sources/sportlink/sites-source-provider-proof";
import type { YouTubeSelectionValidation } from "./types";

const path = "/dashboard/integrations/youtube";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function validateYouTubeSelection(input: { kind: "video" | "playlist"; url: string; name: string }): Promise<YouTubeSelectionValidation> {
  const session = await requireTenantCapability("tenant.data_source.manage");
  const supabase = await createControlSupabaseClient();
  if (!session.tenantId || !session.userId || !supabase) return { ok: false, code: "configuratie" };
  const { data: flag, error } = await supabase.from("tenant_feature_flags").select("enabled").eq("tenant_id", session.tenantId).eq("flag_key", "youtube_integration").maybeSingle();
  if (error || !flag?.enabled) return { ok: false, code: "niet-geactiveerd" };
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "api-configuratie" };
  if (input.kind !== "video" && input.kind !== "playlist") return { ok: false, code: "url" };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) return { ok: false, code: "naam" };
  try {
    if (input.kind === "playlist") {
      const playlistId = parseYouTubePlaylistId(input.url);
      if (!playlistId) return { ok: false, code: "url" };
      const metadata = await fetchYouTubePlaylistMetadata({ apiKey, playlistId });
      const validationId = await registerYouTubePlaylistValidation(session.tenantId, session.userId, { ...metadata, title: name });
      return { ok: true, kind: "playlist", validationId, title: name, channelTitle: metadata.channelTitle, providerTitle: metadata.title, videoCount: metadata.videoIds.length, unavailableItems: metadata.unavailableItems, providerItemCount: metadata.providerItemCount };
    }
    const videoId = parseYouTubeVideoId(input.url);
    if (!videoId) return { ok: false, code: "url" };
    const metadata = await fetchYouTubeMetadata({ apiKey, videoId });
    if (!metadata.embeddable || metadata.privacyStatus === "private") return { ok: false, code: "niet-insluitbaar" };
    const validationId = await registerSitesSourceProviderProof(session.tenantId, session.userId, "youtube-video", { videoId, title: name, channelTitle: metadata.channelTitle });
    return { ok: true, kind: "video", validationId, title: name, channelTitle: metadata.channelTitle, providerTitle: metadata.title, videoCount: 1, unavailableItems: 0, providerItemCount: 1 };
  } catch { return { ok: false, code: "validatie" }; }
}

export async function saveYouTubeSource(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.data_source.manage");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const fallbackId = String(formData.get("fallbackMediaAssetId") ?? "");
  if (!uuid.test(fallbackId)) fail("fallback");
  const sourceValue = String(formData.get("sourceId") ?? "");
  const sourceId = sourceValue ? uuid.test(sourceValue) ? sourceValue : fail("bron") : null;
  const kind = String(formData.get("kind") ?? "video");
  if (!["video", "playlist"].includes(kind)) fail("url");
  if (sourceId) {
    const { data: existing, error } = await supabase.from("youtube_sources").select("playlist_id").eq("tenant_id", tenantId).eq("id", sourceId).maybeSingle();
    if (error || !existing || Boolean(existing.playlist_id) !== (kind === "playlist")) fail("bron");
  }
  if (kind === "playlist") {
    const validationId = String(formData.get("validationId") ?? "");
    const expectedRevision = Number(formData.get("expectedRevision"));
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
    if (!uuid.test(validationId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail("validatie");
    const { data, error } = await supabase.rpc("save_youtube_playlist_source_v1", {
      p_tenant_id: tenantId, p_source_id: sourceId, p_expected_revision: expectedRevision,
      p_validation_id: validationId, p_fallback_media_asset_id: fallbackId,
      p_repeat: formData.get("repeat") === "true", p_idempotency_key: uuid.test(idempotencyKey) ? idempotencyKey : randomUUID()
    });
    if (error) fail("opslaan");
    if (data?.outcome === "conflict") fail("conflict");
    if (data?.outcome !== "saved") fail("opslaan");
  } else {
    const validation = await validateYouTubeSelection({ kind: "video", url: String(formData.get("url") ?? ""), name: String(formData.get("name") ?? "") });
    if (!validation.ok) fail(validation.code);
    const videoId = parseYouTubeVideoId(String(formData.get("url") ?? ""));
    if (!videoId) fail("url");
    const { error } = await supabase.rpc("save_youtube_source_v1", {
      p_channel_title: validation.channelTitle, p_embeddable: true,
      p_fallback_media_asset_id: fallbackId, p_source_id: sourceId, p_tenant_id: tenantId,
      p_title: validation.title, p_validation_error_code: null, p_validation_status: "verified", p_video_id: videoId
    });
    if (error) fail("opslaan");
  }
  revalidatePath(path);
  redirect(`${path}?succes=bron-opgeslagen`);
}

export async function manageYouTubeSource(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.data_source.manage");
  const supabase = await createControlSupabaseClient();
  const sourceId = String(formData.get("sourceId") ?? "");
  const action = String(formData.get("action") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));
  if (!tenantId || !supabase || !uuid.test(sourceId) || !["pause", "resume", "delete"].includes(action)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail("bron");
  const { data, error } = await supabase.rpc("manage_youtube_source_v1", {
    p_tenant_id: tenantId, p_source_id: sourceId, p_expected_revision: expectedRevision,
    p_action: action, p_idempotency_key: uuid.test(String(formData.get("idempotencyKey") ?? "")) ? String(formData.get("idempotencyKey")) : randomUUID()
  });
  if (error) fail("opslaan");
  if (data?.outcome === "conflict") fail("conflict");
  if (!["paused", "active", "deleted", "archived"].includes(data?.outcome)) fail("opslaan");
  revalidatePath(path);
  redirect(`${path}?succes=${data.outcome}`);
}

function fail(reason: string): never { redirect(`${path}?fout=${encodeURIComponent(reason)}`); }
