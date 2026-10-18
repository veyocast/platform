"use server";

import { hasCapability } from "@veyocast/auth";
import { syncDynamicCommandSchema, syncDynamicRequestSchema } from "@veyocast/contracts";
import { safeParseStudioDocument } from "@veyocast/studio";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadSyncSportlinkOptions } from "../slides/sync-sportlink-data";
import { mutateSyncDynamicAuthoringAction, previewSyncDynamicAuthoringAction } from "../slides/sync-dynamic-actions";
import type { SyncDynamicRequest } from "../slides/sync-dynamic-command";
import { createSyncStudioProjectAction } from "./sync-studio-actions";
import type { SyncCreateWizardCommand, SyncCreateWizardResult } from "./sync-create-wizard-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const denied = "Je account, vereniging of rechten zijn gewijzigd. Je invoer is behouden; open de wizard opnieuw binnen het juiste account.";

export async function createSyncDesignWizardAction(input: SyncCreateWizardCommand, expectedActorScope: string): Promise<SyncCreateWizardResult> {
  const session = await requireTenantControlSession();
  if (!session.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active" || expectedActorScope !== `${session.tenantId}:${session.userId}`) return { ok: false, rejected: true, error: denied };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, rejected: true, error: "De oorspronkelijke opdracht is niet geldig. Je invoer blijft behouden; controleer de wizard." };
  let writerStarted = false;
  try {
    if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 700_000) throw Error("bounds");
    if (input.kind === "manual") {
      if (Object.keys(input).sort().join(",") !== "document,idempotencyKey,kind" || !hasCapability(session.capabilities, "tenant.studio.create") || !uuid.test(input.idempotencyKey)) throw Error("manual");
      const document = safeParseStudioDocument(input.document);
      if (!document.success || !document.data.syncPresentation) throw Error("document");
      writerStarted = true;
      const result = await createSyncStudioProjectAction({ document: document.data, idempotencyKey: input.idempotencyKey });
      if (!result.ok) return result;
      return uuid.test(result.projectId) ? { ok: true, href: `/dashboard/studio/${result.projectId}` } : { ok: false, error: "Het ontvangstbewijs is onvolledig. Bevestig dezelfde oorspronkelijke opdracht opnieuw." };
    }
    if (input.kind !== "connected" || Object.keys(input).sort().join(",") !== "command,kind" || !hasCapability(session.capabilities, "tenant.dynamic_slide.write")) throw Error("connected");
    const parsed = syncDynamicCommandSchema.safeParse(input.command);
    if (!parsed.success || parsed.data.action !== "create" || parsed.data.slideId !== null || parsed.data.versionId !== null || parsed.data.expectedRevision !== 0) throw Error("command");
    writerStarted = true;
    const result = await mutateSyncDynamicAuthoringAction(parsed.data);
    if (!result.ok) return result;
    return uuid.test(result.slideId) ? { ok: true, href: `/dashboard/slides/${result.slideId}` } : { ok: false, error: "Het ontvangstbewijs is onvolledig. Bevestig dezelfde oorspronkelijke opdracht opnieuw." };
  } catch {
    return writerStarted
      ? { ok: false, error: "De serverbevestiging ontbreekt. Je invoer en oorspronkelijke opdracht blijven behouden; bevestig dezelfde opdracht opnieuw." }
      : { ok: false, rejected: true, error: "De keuze of je rechten voldoen niet aan de veilige invoergrenzen. Er is geen nieuwe opdracht gestart; controleer je invoer en account." };
  }
}

export async function loadSyncWizardSportlinkOptionsAction(input: { sourceId: string }, expectedActorScope: string) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  if (!session.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active" || expectedActorScope !== `${session.tenantId}:${session.userId}` || !input || Object.keys(input).join(",") !== "sourceId" || !uuid.test(input.sourceId)) return { ok: false, error: denied } as const;
  const client = await createControlSupabaseClient();
  if (!client) return { ok: false, error: "De veilige gegevensverbinding ontbreekt. Je selectie blijft behouden; probeer opnieuw." } as const;
  try { return { ok: true, options: await loadSyncSportlinkOptions(client, session.tenantId, input.sourceId) } as const; }
  catch { return { ok: false, error: "De teams, competitie of datasetrechten konden niet worden bevestigd. Je keuze blijft behouden; controleer de bron bij Bronnen en laad opnieuw." } as const; }
}

export async function previewSyncWizardAction(input: SyncDynamicRequest, expectedActorScope: string) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  if (!session.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active" || expectedActorScope !== `${session.tenantId}:${session.userId}` || !syncDynamicRequestSchema.safeParse(input).success) return { ok: false, error: denied } as const;
  return previewSyncDynamicAuthoringAction(input);
}

/** Old chooser journals were not actor-bound. Only inspect an already committed
 * receipt owned by this actor; never execute that old command as a new actor. */
export async function resolveSyncCreationReceiptAction(input: { idempotencyKey: string }, expectedActorScope: string): Promise<{ ok: true; href: string | null } | { ok: false; error: string }> {
  const session = await requireTenantControlSession("tenant.studio.read");
  if (!session.isLive || !session.tenantId || !session.userId || expectedActorScope !== `${session.tenantId}:${session.userId}` || !input || Object.keys(input).join(",") !== "idempotencyKey" || !uuid.test(input.idempotencyKey)) return { ok: false, error: denied };
  const client = await createControlSupabaseClient();
  if (!client) return { ok: false, error: "Het eerdere ontvangstbewijs kan nu niet worden gelezen. De oorspronkelijke opdracht blijft bewaard; probeer opnieuw zodra je verbinding terug is." };
  try {
    const result = await client.from("studio_command_receipts").select("command_type,target_type,target_id,outcome_json").eq("tenant_id", session.tenantId).eq("actor_user_id", session.userId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (result.error) throw Error("read");
    if (!result.data) return { ok: true, href: null };
    const receipt = result.data, outcome = receipt.outcome_json as Record<string, unknown> | null;
    if (receipt.command_type !== "studio.project.create" || receipt.target_type !== "studio_projects" || !uuid.test(String(receipt.target_id)) || !outcome || outcome.projectId !== receipt.target_id || outcome.outcome !== "created") throw Error("receipt");
    return { ok: true, href: `/dashboard/studio/${receipt.target_id}` };
  } catch {
    return { ok: false, error: "Het eerdere ontvangstbewijs is niet volledig bevestigd. De oorspronkelijke opdracht blijft bewaard; controleer de bibliotheek of probeer opnieuw." };
  }
}
