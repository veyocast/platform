"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hasCapability } from "@veyocast/auth";
import {
  playerDynamicTemplatePayloadSchema, sportlinkSeasonApplyRequestSchema, sportlinkSeasonApplyResultSchema,
  sportlinkSeasonPreviewRequestSchema, sportlinkSeasonPreviewSchema, syncDynamicConfigurationSchema, syncSlideAssets
} from "@veyocast/contracts";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { collectPreviewMediaAssetIds, loadPreviewAssets } from "../../../../../../lib/dynamic-preview-assets";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import type { DynamicSlidePreviewResult } from "../../../slides/actions";

const denied = "Deze bronopdracht is niet toegestaan in je huidige sessie. Je ontwerpen blijven behouden.";
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }

async function authorized(actorScope: string, kind: string) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  if (!session.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active"
    || actorScope !== `${session.tenantId}:${session.userId}`
    || !hasCapability(session.capabilities, kind === "matchday_runbook" ? "tenant.playlist.write" : "tenant.dynamic_slide.write")) return null;
  return session;
}

export async function previewSeasonSwitchAction(input: unknown, actorScope: string) {
  const parsed = sportlinkSeasonPreviewRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Kies een volledige nieuwe broncontext voordat je controleert." };
  const session = await authorized(actorScope, parsed.data.resourceKind);
  if (!session) return { ok: false as const, error: denied };
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { ok: false as const, error: "De beveiligde verbinding ontbreekt. Er is niets gewijzigd; probeer opnieuw." };
    const response = await client.rpc("preview_sportlink_season_switch_v1", { p_tenant_id: session.tenantId, p_input: parsed.data });
    const review = sportlinkSeasonPreviewSchema.safeParse(response.data);
    if (response.error || !review.success || review.data.resourceKind !== parsed.data.resourceKind || review.data.resourceId !== parsed.data.resourceId
      || review.data.oldBindingHash !== parsed.data.oldBindingHash || review.data.contextHash !== parsed.data.contextHash
      || review.data.expectedRevision !== parsed.data.expectedRevision || review.data.basisVersionId !== parsed.data.basisVersionId
      || JSON.stringify(review.data.newSelection) !== JSON.stringify(parsed.data.newSelection)) return { ok: false as const, error: "De gecontroleerde selectie of bron is gewijzigd. Lees deze rij opnieuw voordat je bevestigt." };
    let screenPreview: DynamicSlidePreviewResult | null = null;
    const canonical = review.data.preview.data;
    if (record(canonical) && record(canonical.data)) {
      const configuration = syncDynamicConfigurationSchema.safeParse(canonical.data.syncConfiguration);
      const ids = [...new Set([...collectPreviewMediaAssetIds(canonical.data), ...(configuration.success ? syncSlideAssets(configuration.data.seed).flatMap(asset => asset.kind === "tenant" ? [asset.mediaAssetId] : []) : [])])];
      const assets = await loadPreviewAssets(client, session.tenantId!, ids);
      const payload = playerDynamicTemplatePayloadSchema.safeParse({
        schemaVersion: 1, slideType: canonical.slideType, orientation: canonical.orientation,
        snapshotId: canonical.previewId, snapshotHash: createHash("sha256").update(JSON.stringify(canonical.data)).digest("hex"),
        templateVersionId: canonical.templateVersionId, templateSlug: canonical.templateSlug,
        data: canonical.data, assets: Object.fromEntries(assets)
      });
      if (payload.success) screenPreview = { ok: true, payload: payload.data, itemCount: previewItemCount(canonical.data), missingAssetCount: Math.max(0, ids.length - assets.size), source: {
        providerStatus: record(canonical.source) && typeof canonical.source.providerStatus === "string" ? canonical.source.providerStatus : "unknown",
        lastSuccessfulSyncAt: record(canonical.source) && typeof canonical.source.lastSuccessfulSyncAt === "string" ? canonical.source.lastSuccessfulSyncAt : null,
        lastErrorCode: null
      } };
    }
    return { ok: true as const, review: review.data, screenPreview };
  } catch { return { ok: false as const, error: "Het inhoudsvoorbeeld is niet bevestigd. Er is niets opgeslagen. Controleer de bron en probeer opnieuw." }; }
}

function previewItemCount(data: Record<string, unknown>) {
  const sport = record(data.sport) ? data.sport : null;
  if (!sport) return 0;
  return ["items", "matches", "results", "fixtures", "standings"].reduce((count, key) => count + (Array.isArray(sport[key]) ? sport[key].length : 0), 0);
}

export async function applySeasonSwitchAction(input: unknown, actorScope: string) {
  const parsed = sportlinkSeasonApplyRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Het opdrachtbewijs is ongeldig. Er is niets verstuurd." };
  const session = await authorized(actorScope, parsed.data.resourceKind);
  if (!session) return { ok: false as const, error: denied };
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { ok: false as const, error: "De verbinding ontbreekt. Controleer later dezelfde opdracht; het oorspronkelijke bewijs blijft behouden." };
    const response = await client.rpc("apply_sportlink_season_switch_draft_v1", { p_tenant_id: session.tenantId, p_input: parsed.data });
    const receipt = sportlinkSeasonApplyResultSchema.safeParse(response.data);
    if (response.error || !receipt.success || receipt.data.requestId !== parsed.data.requestId || receipt.data.correlationId !== parsed.data.correlationId
      || receipt.data.resourceKind !== parsed.data.resourceKind || receipt.data.resourceId !== parsed.data.resourceId) return { ok: false as const, error: "Er is geen volledig ontvangstbewijs. Controleer dezelfde opdracht opnieuw; maak geen nieuwe opdracht aan." };
    if (receipt.data.status === "applied") {
      revalidatePath("/dashboard/content"); revalidatePath("/dashboard/slides");
      revalidatePath("/dashboard/sources/sportlink/season-switch");
      if (receipt.data.links.edit) revalidatePath(receipt.data.links.edit.split("?")[0]!);
    }
    return { ok: true as const, receipt: receipt.data };
  } catch { return { ok: false as const, error: "Het antwoord is niet ontvangen. Je oorspronkelijke opdracht blijft behouden; controleer dezelfde opdracht opnieuw." }; }
}
