"use server";

import { hasCapability } from "@veyocast/auth";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { syncPlaybackEvidence } from "../../../../../lib/sync-playback-evidence";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import {
  menuPriceCandidatesSchema, menuPriceImpactRequestSchema, menuPriceImpactSchema,
  prepareMenuPriceCandidatesSchema, publishMenuPriceCandidatesSchema, readMenuPriceCandidatesSchema,
  type MenuPriceActionResult, type MenuPriceCandidates, type MenuPriceImpact,
  type PrepareMenuPriceCandidates, type PublishMenuPriceCandidates,
} from "./menu-price-model";

const unavailable = "De prijscontrole kon niet worden bevestigd. Bestaande publicaties blijven behouden; probeer dezelfde opdracht opnieuw bij verbindingsverlies.";
const fullRead = ["tenant.dynamic_slide.read", "tenant.playlist.read", "tenant.screen.read"] as const;
async function priceSession(write: boolean) {
  const session = await requireTenantControlSession("tenant.product.read");
  if (!session.isLive || !session.tenantId || !fullRead.every(capability => hasCapability(session.capabilities, capability)) ||
      write && (session.tenantStatus !== "active" || !hasCapability(session.capabilities, "tenant.dynamic_slide.write"))) return null;
  return session;
}
function failure(error?: { code?: string } | null): MenuPriceActionResult<never> {
  if (error?.code === "40001") return { ok: false, rejected: true, conflict: true, error: "De bron, prijscontrole of conceptversie is gewijzigd. Lees de volledige impact opnieuw en bevestig bewust de nieuwe selectie." };
  return { ok: false, rejected: !!error?.code && ["22023", "23514", "42501", "23503", "23505", "P0002", "55000"].includes(error.code), error: unavailable };
}
function invalid(): MenuPriceActionResult<never> {
  return { ok: false, rejected: true, error: "Controleer je sessie, rechten en expliciete menuselectie. Er is geen nieuwe prijsopdracht verstuurd." };
}
export async function readMenuPriceImpactAction(input: { offset?: number; limit?: number } = {}): Promise<MenuPriceActionResult<MenuPriceImpact>> {
  const parsed = menuPriceImpactRequestSchema.safeParse(input), session = await priceSession(false);
  if (!parsed.success || !session) return invalid();
  const client = await createControlSupabaseClient(); if (!client) return failure();
  try {
    const result = await client.rpc("read_menu_price_impact_v1", { p_tenant_id: session.tenantId, p_offset: parsed.data.offset, p_limit: parsed.data.limit });
    const raw = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? { ...result.data } as Record<string, unknown> : null;
    if (raw) {
      const releases = new Set(Array.isArray(raw.affectedReleaseIds) ? raw.affectedReleaseIds.filter((id: unknown): id is string => typeof id === "string") : []);
      const devices = Array.isArray(raw.screenEvidence) && raw.screenEvidence.length <= 1000 ? raw.screenEvidence : [];
      const confirmed = devices.filter((device: unknown) => {
        if (!device || typeof device !== "object" || Array.isArray(device)) return false;
        const row = device as Record<string, unknown>;
        if (typeof row.status !== "string") return false;
        const proof = syncPlaybackEvidence({ status: row.status,
          active_release_id: typeof row.active_release_id === "string" ? row.active_release_id : null,
          desired_release_id: typeof row.desired_release_id === "string" ? row.desired_release_id : null,
          last_seen_at: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
          last_error_code: typeof row.last_error_code === "string" ? row.last_error_code : null,
          current_sync_detail: row.current_sync_detail });
        return Boolean(proof.confirmedReleaseId && releases.has(proof.confirmedReleaseId));
      }).length;
      if (Object.hasOwn(raw, "screenEvidence")) {
        raw.confirmedScreens = confirmed;
        raw.unknownScreens = Math.max(0, Number(raw.unknownScreens) - confirmed);
      }
      delete raw.screenEvidence; delete raw.affectedReleaseIds;
    }
    const data = menuPriceImpactSchema.safeParse(raw);
    return result.error || !data.success ? failure(result.error) : { ok: true, data: data.data };
  } catch { return failure(); }
}
export async function prepareMenuPriceCandidatesAction(input: PrepareMenuPriceCandidates): Promise<MenuPriceActionResult<MenuPriceCandidates>> {
  const parsed = prepareMenuPriceCandidatesSchema.safeParse(input), session = await priceSession(true);
  if (!parsed.success || !session) return invalid();
  const client = await createControlSupabaseClient(); if (!client) return failure();
  try {
    const value = parsed.data, result = await client.rpc("prepare_menu_price_candidates_v1", {
      p_tenant_id: session.tenantId, p_review_hash: value.reviewHash, p_selections: value.selections, p_idempotency_key: value.idempotencyKey,
    });
    const data = menuPriceCandidatesSchema.safeParse(result.data);
    if (result.error || !data.success) return failure(result.error);
    revalidatePath("/dashboard/slides"); revalidatePath("/dashboard/integrations/twelve-products");
    return { ok: true, data: data.data };
  } catch { return failure(); }
}
export async function publishMenuPriceCandidatesAction(input: PublishMenuPriceCandidates): Promise<MenuPriceActionResult<MenuPriceCandidates>> {
  const parsed = publishMenuPriceCandidatesSchema.safeParse(input), session = await priceSession(true);
  if (!parsed.success || !session) return invalid();
  const client = await createControlSupabaseClient(); if (!client) return failure();
  try {
    const value = parsed.data, result = await client.rpc("publish_menu_price_candidates_v1", {
      p_tenant_id: session.tenantId, p_capture_actor_id: value.captureActorId, p_capture_key: value.captureKey,
      p_candidates: value.candidates, p_idempotency_key: value.idempotencyKey,
    });
    const data = menuPriceCandidatesSchema.safeParse(result.data);
    if (result.error || !data.success) return failure(result.error);
    revalidatePath("/dashboard/slides");
    for (const candidate of data.data.candidates) revalidatePath(`/dashboard/slides/${candidate.slideId}`);
    return { ok: true, data: data.data };
  } catch { return failure(); }
}
export async function readMenuPriceCandidatesAction(input: { captureActorId: string; captureKey: string }): Promise<MenuPriceActionResult<MenuPriceCandidates>> {
  const parsed = readMenuPriceCandidatesSchema.safeParse(input), session = await priceSession(false);
  if (!parsed.success || !session) return invalid();
  const client = await createControlSupabaseClient(); if (!client) return failure();
  try {
    const value = parsed.data, result = await client.rpc("read_menu_price_candidates_v1", {
      p_tenant_id: session.tenantId, p_capture_actor_id: value.captureActorId, p_capture_key: value.captureKey,
    });
    const data = menuPriceCandidatesSchema.safeParse(result.data);
    return result.error || !data.success ? failure(result.error) : { ok: true, data: data.data };
  } catch { return failure(); }
}
