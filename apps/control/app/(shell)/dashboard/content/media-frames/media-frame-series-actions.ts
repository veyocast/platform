"use server";

import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { parseMediaFrameSeriesCommand, parseMediaFrameSeriesReceipt } from "./media-frame-series-contract";
import { loadContentFilmstripPage, validContentFilmstripOffset } from "./media-frame-filmstrip-data.server";
import type { ContentFilmstripResult, MediaFrameSeriesResult } from "./media-frame-series-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const unavailable = (): MediaFrameSeriesResult => ({ ok: false, code: "unavailable", uncertain: true, message: "De serverbevestiging ontbreekt. Bewaar je invoer en bevestig dezelfde oorspronkelijke reeksopdracht opnieuw; maak nog geen nieuwe kopie." });

export async function mutateMediaFrameSeriesAction(input: unknown, expectedActorScope: string): Promise<MediaFrameSeriesResult> {
  const command = parseMediaFrameSeriesCommand(input);
  if (!command) return { ok: false, code: "invalid", uncertain: false, message: "De reeksopdracht voldoet niet aan de veilige grenzen. Je invoer blijft behouden; controleer de velden voordat je opnieuw bevestigt." };
  const session = await requireTenantControlSession("tenant.media.write");
  if (!session.isLive || !session.userId || session.tenantId !== command.tenantId || session.tenantStatus !== "active" || expectedActorScope !== `${session.tenantId}:${session.userId}`) return { ok: false, code: "denied", uncertain: true, message: "Deze sessie kan de reeks niet wijzigen. Je invoer en eventuele eerdere opdracht blijven behouden; controleer account, vereniging en rechten." };
  try {
    const client = await createControlSupabaseClient();
    if (!client) return unavailable();
    const payload = { sourceAssetId: command.sourceAssetId, settings: command.settings, expectedSources: command.expectedSources, seriesTitle: command.seriesTitle, ...(command.operation === "append" ? { newFrameId: command.newFrameId } : {}) };
    const result = await client.rpc("mutate_media_frame_series_v1", {
      p_tenant_id: command.tenantId, p_frame_id: command.frameId, p_expected_revision: command.expectedFrameRevision,
      p_series_id: command.seriesId, p_expected_series_revision: command.expectedSeriesRevision,
      p_operation: command.operation === "append" ? "append_series" : "save_series", p_payload: payload, p_idempotency_key: command.idempotencyKey,
    });
    if (result.error) {
      if (result.error.code === "PT409") return { ok: false, code: "conflict", uncertain: false, message: "Dit media-ontwerp of deze reeks is intussen gewijzigd. Je invoer blijft behouden; laad de actuele versie voordat je een nieuwe opdracht bevestigt." };
      if (["42501", "P0002", "55000"].includes(result.error.code)) return { ok: false, code: "denied", uncertain: true, message: "De reeksopdracht kan niet worden bevestigd met de huidige rechten of bronstatus. Bewaar de oorspronkelijke opdracht, controleer ze en probeer dezelfde opdracht opnieuw." };
      if (["22023", "23514", "23503"].includes(result.error.code)) return { ok: false, code: "source_unavailable", uncertain: true, message: "De instellingen of geverifieerde bronnen zijn niet meer beschikbaar zoals getoond. Je invoer en oorspronkelijke opdracht blijven behouden; controleer de actuele versie en bestanden." };
      return unavailable();
    }
    const parsed = parseMediaFrameSeriesReceipt(result.data, command);
    if (!parsed) return unavailable();
    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/media/${parsed.current.frameId}`);
    revalidatePath(`/dashboard/content/media/source/${command.sourceAssetId}`);
    if (parsed.appended) revalidatePath(parsed.appended.href);
    return parsed;
  } catch { return unavailable(); }
}

export async function readContentFilmstripAction(input: { tenantId: string; offset: number }, expectedActorScope: string): Promise<ContentFilmstripResult> {
  const failure: ContentFilmstripResult = { ok: false, message: "De volledige filmstrip kan nu niet worden geladen. Je invoer blijft behouden; controleer je sessie en probeer opnieuw." };
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join(",") !== "offset,tenantId" || !uuid.test(input.tenantId) || !validContentFilmstripOffset(input.offset)) return failure;
  const session = await requireTenantControlSession("tenant.media.read");
  if (!session.isLive || !session.userId || session.tenantId !== input.tenantId || session.tenantStatus === "archived" || expectedActorScope !== `${session.tenantId}:${session.userId}`) return failure;
  try {
    const client = await createControlSupabaseClient();
    if (!client) return failure;
    const page = await loadContentFilmstripPage(client, input.tenantId, input.offset);
    return page ? { ok: true, page } : failure;
  } catch { return failure; }
}
