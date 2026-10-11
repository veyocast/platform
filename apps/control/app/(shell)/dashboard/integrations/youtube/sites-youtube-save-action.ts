"use server";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export async function saveSitesYouTubeSource(input: { sourceId: string | null; expectedRevision: number; validationId: string; fallbackMediaAssetId: string; kind: "video" | "playlist"; repeat: boolean; idempotencyKey: string }) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  if (!session.tenantId || session.tenantStatus !== "active") return { ok: false as const, code: "SOURCE_PERMISSION_REQUIRED" };
  if (!input || !["video", "playlist"].includes(input.kind) || !uuid.test(input.idempotencyKey) || !uuid.test(input.validationId) || !uuid.test(input.fallbackMediaAssetId) || (input.sourceId !== null && !uuid.test(input.sourceId)) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || typeof input.repeat !== "boolean") return { ok: false as const, code: "SOURCE_INPUT_INVALID" };
  try {
    const db = await createControlSupabaseClient(); if (!db) return { ok: false as const, code: "SOURCE_CONFIGURATION_UNAVAILABLE" };
    const args = { p_tenant_id: session.tenantId, p_source_id: input.sourceId, p_expected_revision: input.expectedRevision, p_validation_id: input.validationId, p_fallback_media_asset_id: input.fallbackMediaAssetId, p_idempotency_key: input.idempotencyKey };
    const { data, error } = input.kind === "playlist" ? await db.rpc("save_youtube_playlist_source_v1", { ...args, p_repeat: input.repeat }) : await db.rpc("save_youtube_video_source_v2", args);
    if (error) return { ok: false as const, code: error.code === "23514" ? "SOURCE_VALIDATION_EXPIRED" : "SOURCE_SAVE_UNCONFIRMED" };
    if (data?.outcome === "conflict") return { ok: false as const, code: "SOURCE_REVISION_CONFLICT" };
    if (data?.outcome !== "saved" || !uuid.test(data.sourceId ?? "") || !Number.isSafeInteger(data.actualRevision)) return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" };
    revalidatePath("/dashboard/integrations/youtube"); revalidatePath("/dashboard/sources");
    return { ok: true as const, sourceId: data.sourceId as string, revision: data.actualRevision as number };
  } catch { return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" }; }
}
