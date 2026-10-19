"use server";

import { revalidatePath } from "next/cache";
import { hasCapability } from "@veyocast/auth";
import { parseSyncThemeDefaultsAck, syncThemeDefaultsCommandSchema,
  type SyncThemeDefaultsAck, type SyncThemeDefaultsCommand, type SyncThemeDefaultsReadModel } from "@veyocast/contracts";
import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { canReadSyncThemeCreationDefaults, loadSyncThemeCreationDefaults } from "./sync-theme-defaults-data.server";

export type SyncThemeDefaultsActionResult<T> = { ok: true; value: T } | {
  ok: false; code: "invalid" | "denied" | "conflict" | "unavailable"; uncertain: boolean; message: string;
};
const denied = { ok: false, code: "denied", uncertain: false,
  message: "Je account, vereniging of rechten zijn gewijzigd. Je invoer en oorspronkelijke opdracht blijven behouden; open Thema’s opnieuw met het juiste account." } as const;
const unavailable = { ok: false, code: "unavailable", uncertain: true,
  message: "De opslagbevestiging ontbreekt. Je oorspronkelijke instellingen en opdracht blijven behouden; controleer dezelfde opdracht opnieuw." } as const;

export async function saveSyncThemeCreationDefaultsAction(input: unknown, expectedActorScope: string): Promise<SyncThemeDefaultsActionResult<SyncThemeDefaultsAck>> {
  const session = await requireControlSession();
  if (!session.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active"
    || expectedActorScope !== `${session.tenantId}:${session.userId}` || !hasCapability(session.capabilities, "tenant.settings.manage")) return denied;
  const parsed = syncThemeDefaultsCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", uncertain: false, message: "De thema-instellingen zijn onvolledig of ongeldig. Er is niets verstuurd; controleer de zeven velden." };
  // Validating must not rebuild or transform the exact JSON-stored first body.
  const command = input as SyncThemeDefaultsCommand;
  if (command.tenantId !== session.tenantId) return denied;
  let writerStarted = false;
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { ...unavailable, uncertain: false };
    writerStarted = true;
    const result = await client.rpc("save_sync_theme_creation_defaults_v1", {
      p_tenant_id: command.tenantId, p_theme_id: command.themeId,
      p_expected_revision: command.expectedRevision, p_defaults: command.defaults,
      p_idempotency_key: command.idempotencyKey,
    });
    if (result.error) {
      if (result.error.code === "PT409") return { ok: false, code: "conflict", uncertain: false,
        message: "Deze voorkeuren zijn intussen gewijzigd. Je invoer blijft behouden; haal de actuele instellingen op en vergelijk ze voordat je opnieuw bevestigt." };
      // A current permission/validation failure cannot disprove an earlier commit
      // for a replay. The caller always retains an already uncertain command.
      if (result.error.code === "42501") return denied;
      if (result.error.code === "22023") return { ok: false, code: "invalid", uncertain: false,
        message: "De opdracht kon niet worden toegepast. Je invoer blijft behouden; controleer de actuele versie en je zeven velden." };
      return unavailable;
    }
    const value = parseSyncThemeDefaultsAck(result.data, command);
    if (!value) return unavailable;
    // Revalidation is secondary to the already verified committed receipt.
    for (const path of ["/dashboard/themes", "/dashboard/studio/new", "/dashboard/slides/new/sync"]) {
      try { revalidatePath(path); } catch { /* The confirmed receipt remains valid. */ }
    }
    return { ok: true, value };
  } catch { return writerStarted ? unavailable : { ...unavailable, uncertain: false }; }
}

export async function readSyncThemeCreationDefaultsAction(expectedActorScope: string): Promise<SyncThemeDefaultsActionResult<SyncThemeDefaultsReadModel>> {
  const session = await requireControlSession();
  if (!session.isLive || !session.tenantId || !session.userId || !["active", "paused"].includes(session.tenantStatus ?? "")
    || expectedActorScope !== `${session.tenantId}:${session.userId}` || !canReadSyncThemeCreationDefaults(session.capabilities)) return denied;
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { ...unavailable, uncertain: false };
    return loadSyncThemeCreationDefaults(client, session.tenantId);
  } catch { return { ...unavailable, uncertain: false }; }
}
