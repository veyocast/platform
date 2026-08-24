"use server";

import { fetchYouTubeMetadata, parseYouTubeVideoId } from "@veyocast/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

const path = "/dashboard/integrations/youtube";

export async function saveYouTubeSource(formData: FormData) {
  const { tenantId } = await requireTenantCapability("tenant.data_source.manage");
  const supabase = await createControlSupabaseClient();
  if (!tenantId || !supabase) fail("configuratie");
  const videoId = parseYouTubeVideoId(String(formData.get("url") ?? ""));
  if (!videoId) fail("url");
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!apiKey) fail("api-configuratie");
  let metadata;
  try {
    metadata = await fetchYouTubeMetadata({ apiKey, videoId });
  } catch {
    fail("validatie");
  }
  if (!metadata.embeddable || metadata.privacyStatus === "private") fail("niet-insluitbaar");
  const fallbackId = String(formData.get("fallbackMediaAssetId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(fallbackId)) fail("fallback");
  const { error } = await supabase.rpc("save_youtube_source_v1", {
    p_channel_title: metadata.channelTitle,
    p_embeddable: metadata.embeddable,
    p_fallback_media_asset_id: fallbackId,
    p_source_id: null,
    p_tenant_id: tenantId,
    p_title: metadata.title.slice(0, 160),
    p_validation_error_code: null,
    p_validation_status: "verified",
    p_video_id: videoId
  });
  if (error) fail("opslaan");
  revalidatePath(path);
  redirect(`${path}?succes=bron-opgeslagen`);
}

function fail(reason: string): never { redirect(`${path}?fout=${encodeURIComponent(reason)}`); }
