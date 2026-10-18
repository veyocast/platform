"use server";

import { randomUUID } from "node:crypto";
import { mediaFrameCommandSchema, mediaFrameDefaultSettings, mediaFrameExpectedSourceSchema, type MediaFrameCommand } from "@veyocast/contracts";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import type { MediaFrameActionResult, MediaFrameSourceResult } from "./media-frame-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const unavailable = (): MediaFrameActionResult => ({ ok: false, code: "unavailable", uncertain: true, message: "De serverbevestiging ontbreekt. Het resultaat is nog onbekend; bevestig dezelfde actie opnieuw." });

export async function mutateMediaFrameAction(input: unknown, expectedActorScope: string): Promise<MediaFrameActionResult> {
  const parsed = mediaFrameCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", uncertain: false, message: "De invoer voldoet niet aan de veilige grenzen. Je ontwerp blijft hier; controleer de velden en probeer opnieuw." };
  const command = parsed.data;
  const session = await requireTenantControlSession("tenant.media.write");
  if (!session.isLive || !session.userId || expectedActorScope !== `${session.tenantId}:${session.userId}` || session.tenantId !== command.tenantId || session.tenantStatus !== "active") return { ok: false, code: "denied", uncertain: true, message: "Deze sessie kan het media-ontwerp niet wijzigen. Je invoer en een eventuele eerdere opdracht blijven bewaard; controleer vereniging, sessie en rechten." };
  try {
    const client = await createControlSupabaseClient();
    if (!client) return unavailable();
    const result = command.operation === "create"
      ? await client.rpc("create_media_frame_v1", { p_tenant_id: session.tenantId, p_frame_id: command.frameId, p_source_asset_id: command.sourceAssetId, p_expected_sources: command.expectedSources, p_settings: command.settings, p_idempotency_key: command.idempotencyKey, ...(command.isPrimary === false ? { p_is_primary: false } : {}) })
      : await client.rpc("mutate_media_frame_v1", { p_tenant_id: session.tenantId, p_frame_id: command.frameId, p_expected_revision: command.expectedRevision, p_operation: command.operation, p_payload: command.operation === "save" ? { settings: command.settings, expectedSources: command.expectedSources } : command.operation === "duplicate" ? { newFrameId: command.newFrameId } : {}, p_idempotency_key: command.idempotencyKey });
    if (result.error) {
      if (result.error.code === "PT409") return { ok: false, code: "conflict", uncertain: false, message: "Het media-ontwerp is intussen gewijzigd. Je invoer blijft behouden; laad de actuele versie voordat je opnieuw opslaat." };
      if (["42501", "P0002", "55000"].includes(result.error.code)) return { ok: false, code: "denied", uncertain: true, message: "De actie kan niet worden bevestigd met de huidige rechten of bronstatus. Je ontwerp en oorspronkelijke opdracht blijven bewaard; controleer ze en probeer dezelfde actie opnieuw." };
      if (["23514", "23503", "22023"].includes(result.error.code)) return { ok: false, code: "source_unavailable", uncertain: true, message: "Het ontwerp of een geverifieerde bron is niet meer beschikbaar zoals getoond. Je invoer en oorspronkelijke opdracht blijven bewaard; controleer de actuele versie en bestanden." };
      return unavailable();
    }
    const data = result.data as Record<string, unknown> | null;
    const expectedId = command.operation === "duplicate" ? command.newFrameId : command.frameId;
    const allowedOutcomes = command.operation === "create" ? ["created"] : command.operation === "save" ? ["saved"] : command.operation === "duplicate" ? ["duplicated"] : command.operation === "archive" ? ["archived", "noop"] : ["restored", "noop"];
    if (!data || data.frameId !== expectedId || typeof data.versionId !== "string" || !uuid.test(data.versionId) || !Number.isSafeInteger(data.frameRevision) || Number(data.frameRevision) < 1 || !Number.isSafeInteger(data.versionNumber) || Number(data.versionNumber) < 1 || !allowedOutcomes.includes(String(data.outcome))) return unavailable();
    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/media/${data.frameId}`);
    return { ok: true, frameId: expectedId, frameRevision: Number(data.frameRevision), versionId: data.versionId, versionNumber: Number(data.versionNumber), outcome: data.outcome as Extract<MediaFrameActionResult, { ok: true }>["outcome"] };
  } catch { return unavailable(); }
}

/** Explicit duplicate preparation is read-only; the browser journals the returned
 * complete command before it sends the separate create mutation. */
export async function prepareMediaFrameCopyAction(input: { tenantId: string; mediaAssetId: string }, expectedActorScope: string): Promise<{ ok: true; command: Extract<MediaFrameCommand, { operation: "create" }> } | { ok: false; message: string }> {
  const failure = { ok: false as const, message: "De kopie kan nu niet veilig worden voorbereid. Er is niets gewijzigd; controleer de bron, sessie en rechten en probeer opnieuw." };
  if (!input || !uuid.test(input.tenantId) || !uuid.test(input.mediaAssetId)) return failure;
  const session = await requireTenantControlSession("tenant.media.write");
  if (!session.isLive || !session.userId || session.tenantStatus !== "active" || session.tenantId !== input.tenantId || expectedActorScope !== `${session.tenantId}:${session.userId}`) return failure;
  const source = await readMediaFrameSourceAction({ ...input, role: "media" }, expectedActorScope);
  if (!source.ok) return failure;
  try {
    const settings = mediaFrameDefaultSettings(source.source);
    settings.name = `${settings.name.slice(0, 112)} (kopie)`;
    return { ok: true, command: { tenantId: input.tenantId, frameId: randomUUID(), idempotencyKey: randomUUID(), operation: "create", expectedRevision: 0, sourceAssetId: input.mediaAssetId, isPrimary: false, expectedSources: [source.source.expectedSource], settings } };
  } catch { return failure; }
}

export async function readMediaFrameUsageAction(input: { tenantId: string; frameId: string }, expectedActorScope: string): Promise<{ ok: true; draftCount: number; releaseCount: number; screenCount: number } | { ok: false; message: string }> {
  const failure = { ok: false as const, message: "Het volledige gebruik kan niet worden bevestigd. Er is niets gearchiveerd; controleer je sessie en probeer opnieuw." };
  if (!input || !uuid.test(input.tenantId) || !uuid.test(input.frameId)) return failure;
  const session = await requireTenantControlSession("tenant.media.write");
  if (!session.isLive || !session.userId || session.tenantStatus !== "active" || session.tenantId !== input.tenantId || expectedActorScope !== `${session.tenantId}:${session.userId}`) return failure;
  try {
    const client = await createControlSupabaseClient();
    if (!client) return failure;
    const result = await client.rpc("get_media_frame_usage_v1", { p_tenant_id: input.tenantId, p_frame_id: input.frameId }, { count: "exact" }).range(0, 999);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count !== result.data.length) return failure;
    const drafts = new Set<string>(), releases = new Set<string>(), screens = new Set<string>();
    let releaseScreens = 0;
    for (const value of result.data as Record<string, unknown>[]) {
      if (!value || typeof value.resource_id !== "string" || !["draft", "release", "screen"].includes(String(value.usage_type))) return failure;
      if (value.usage_type === "draft") drafts.add(value.resource_id);
      if (value.usage_type === "release") { releases.add(value.resource_id); if (Number.isSafeInteger(value.screen_count) && Number(value.screen_count) >= 0) releaseScreens = Math.max(releaseScreens, Number(value.screen_count)); }
      if (value.usage_type === "screen") screens.add(value.resource_id);
    }
    return { ok: true, draftCount: drafts.size, releaseCount: releases.size, screenCount: Math.max(screens.size, releaseScreens) };
  } catch { return failure; }
}

/** Explicit source read for a just-uploaded background or requested source refresh. */
export async function readMediaFrameSourceAction(input: { tenantId: string; mediaAssetId: string; role: "media" | "background" }, expectedActorScope: string): Promise<MediaFrameSourceResult> {
  const failure: MediaFrameSourceResult = { ok: false, message: "Het geverifieerde bestand kon niet worden gelezen. Je ontwerp blijft behouden; controleer je sessie en het bestand en probeer opnieuw." };
  if (!input || !uuid.test(input.tenantId) || !uuid.test(input.mediaAssetId) || !["media", "background"].includes(input.role)) return failure;
  const session = await requireTenantControlSession("tenant.media.read");
  if (!session.isLive || !session.userId || expectedActorScope !== `${session.tenantId}:${session.userId}` || session.tenantId !== input.tenantId) return failure;
  try {
    const client = await createControlSupabaseClient();
    if (!client) return failure;
    const result = await client.rpc("get_media_frame_source_v1", { p_tenant_id: session.tenantId, p_asset_id: input.mediaAssetId });
    const data = result.data as Record<string, unknown> | null;
    if (result.error || !data || data.mediaAssetId !== input.mediaAssetId || !["image", "video"].includes(String(data.kind)) || input.role === "background" && data.kind !== "image") return failure;
    const variant = data.variant as Record<string, unknown> | null;
    if (!variant) return failure;
    if (data.kind === "video" && (!Number.isSafeInteger(data.maximumDurationSeconds) || Number(data.maximumDurationSeconds) < 5 || Number(data.maximumDurationSeconds) > 3600)) return failure;
    const fingerprint = mediaFrameExpectedSourceSchema.safeParse({ role: input.role, mediaAssetId: input.mediaAssetId, variantId: variant.variantId, checksumSha256: variant.checksumSha256, byteSize: variant.byteSize });
    const validPath = (value: unknown) => typeof value === "string" && value.startsWith(`tenants/${session.tenantId}/assets/${input.mediaAssetId}/`) && !value.split("/").some(part => part === "." || part === "..") && !/[\\?#]/.test(value) && !Array.from(value).some(character => character.charCodeAt(0) < 32);
    if (!fingerprint.success || variant.storageBucket !== "tenant-media" || !validPath(variant.storagePath)) return failure;
    const signed = await client.storage.from("tenant-media").createSignedUrl(String(variant.storagePath), 900);
    if (signed.error || !signed.data?.signedUrl) return failure;
    let posterUrl: string | null = null;
    const poster = data.poster as Record<string, unknown> | null;
    if (poster?.storageBucket === "tenant-media" && validPath(poster.storagePath)) {
      const posterSigned = await client.storage.from("tenant-media").createSignedUrl(String(poster.storagePath), 900);
      if (!posterSigned.error) posterUrl = posterSigned.data?.signedUrl ?? null;
    }
    const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
    return { ok: true, source: { mediaAssetId: input.mediaAssetId, kind: data.kind as "image" | "video", title: typeof data.title === "string" ? data.title : "Media", fileName: typeof data.fileName === "string" ? data.fileName : "", byteSize: fingerprint.data.byteSize, width: positive(data.width), height: positive(data.height), durationSeconds: positive(data.durationSeconds), ...(data.kind === "video" ? { maximumDurationSeconds: Number(data.maximumDurationSeconds) } : {}), sourceUrl: signed.data.signedUrl, posterUrl, expectedSource: fingerprint.data } };
  } catch { return failure; }
}
