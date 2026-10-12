"use server";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export type SitesLedConnectionDraft = { connectionId: string | null; expectedRevision: number; idempotencyKey: string; name: string; scoreboardLabel: string; clubSlug: string; status: "active" | "paused"; sportsClubId: string | null; mappings: Array<{ teamKey: string; teamName: string; side: "own" | "opponent"; sportsTeamId: string | null }> };
export async function saveSitesLedConnection(input: SitesLedConnectionDraft) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  if (!session.tenantId || session.tenantStatus !== "active") return { ok: false as const, code: "SOURCE_PERMISSION_REQUIRED" };
  if (!input || typeof input.name !== "string" || typeof input.scoreboardLabel !== "string" || input.scoreboardLabel.trim().length < 1 || input.scoreboardLabel.length > 80 || !uuid.test(input.idempotencyKey) || (input.connectionId !== null && !uuid.test(input.connectionId)) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.name.trim().length < 2 || input.name.length > 120 || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/u.test(input.clubSlug) || !["active", "paused"].includes(input.status) || (input.sportsClubId !== null && !uuid.test(input.sportsClubId)) || !Array.isArray(input.mappings) || input.mappings.length < 1 || input.mappings.length > 50 || input.mappings.some(mapping => !mapping || typeof mapping.teamKey !== "string" || typeof mapping.teamName !== "string" || mapping.teamKey.trim().length < 1 || mapping.teamKey.length > 200 || mapping.teamName.trim().length < 1 || mapping.teamName.length > 160 || !["own", "opponent"].includes(mapping.side) || (mapping.sportsTeamId !== null && !uuid.test(mapping.sportsTeamId)))) return { ok: false as const, code: "SOURCE_INPUT_INVALID" };
  try {
    const db = await createControlSupabaseClient(); if (!db) return { ok: false as const, code: "SOURCE_CONFIGURATION_UNAVAILABLE" };
    const { data, error } = await db.rpc("save_ledscores_connection_v2", { p_tenant_id: session.tenantId, p_connection_id: input.connectionId, p_expected_revision: input.expectedRevision, p_idempotency_key: input.idempotencyKey, p_values: { name: input.name, scoreboardLabel: input.scoreboardLabel, clubSlug: input.clubSlug, status: input.status, sportsClubId: input.sportsClubId }, p_mappings: input.mappings });
    if (error) return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" };
    if (data?.outcome === "conflict") return { ok: false as const, code: "SOURCE_REVISION_CONFLICT" };
    if (data?.outcome !== "saved" || !uuid.test(data.connectionId ?? "") || !Number.isSafeInteger(data.actualRevision) || data.mappingCount !== input.mappings.length) return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" };
    revalidatePath("/dashboard/data-sources/led-scores"); revalidatePath("/dashboard/sources");
    return { ok: true as const, connectionId: data.connectionId as string, revision: data.actualRevision as number };
  } catch { return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" }; }
}
