"use server";
import { SportlinkClient, encryptSportlinkClientId, mapSportlinkClub, mapSportlinkTeams } from "@veyocast/integrations/server";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { registerSitesSourceProviderProof } from "./sites-source-provider-proof";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export async function validateSitesSportlinkConnection(input: { clientId: string; clubName: string }) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  if (!session.tenantId || !session.userId || session.tenantStatus !== "active") return { ok: false as const, code: "SOURCE_PERMISSION_REQUIRED" };
  const encryptionKey = process.env.SPORTLINK_CONFIG_ENCRYPTION_KEY;
  if (!encryptionKey) return { ok: false as const, code: "SOURCE_CONFIGURATION_UNAVAILABLE" };
  if (!input || typeof input.clubName !== "string" || typeof input.clientId !== "string" || input.clientId.trim().length < 1 || input.clientId.length > 512 || input.clubName.trim().length < 1 || input.clubName.length > 200) return { ok: false as const, code: "SOURCE_INPUT_INVALID" };
  try {
    const clientId = input.clientId.trim(); const result = await new SportlinkClient(clientId).testConnection();
    const club = mapSportlinkClub(result.club.payload); const teams = mapSportlinkTeams(result.teams.payload);
    if (!club || club.name.localeCompare(input.clubName.trim(), "nl", { sensitivity: "base" }) !== 0 || !teams.length || teams.length > 250) return { ok: false as const, code: "SOURCE_CLUB_OR_TEAMS_UNCONFIRMED" };
    const encrypted = encryptSportlinkClientId(clientId, encryptionKey);
    const safeTeams = teams.map(team => ({ code: team.externalId, name: team.name }));
    const validationId = await registerSitesSourceProviderProof(session.tenantId, session.userId, "sportlink", { clubName: club.name, clientSuffix: clientId.slice(-4), ciphertext: encrypted.ciphertext, iv: encrypted.iv, tag: encrypted.tag, teams: safeTeams });
    return { ok: true as const, validationId, clubName: club.name, clientSuffix: clientId.slice(-4), teams: safeTeams };
  } catch { return { ok: false as const, code: "SOURCE_PROVIDER_UNAVAILABLE" }; }
}
export async function saveSitesSportlinkConnection(input: { connectionId: string | null; expectedRevision: number; validationId: string; teamCodes: string[]; birthdaysEnabled: boolean; idempotencyKey: string }) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  if (!session.tenantId || session.tenantStatus !== "active") return { ok: false as const, code: "SOURCE_PERMISSION_REQUIRED" };
  if (!input || !uuid.test(input.validationId) || !uuid.test(input.idempotencyKey) || (input.connectionId !== null && !uuid.test(input.connectionId)) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !Array.isArray(input.teamCodes) || input.teamCodes.length < 1 || input.teamCodes.length > 250 || new Set(input.teamCodes).size !== input.teamCodes.length || input.teamCodes.some(code => typeof code !== "string" || code.length < 1 || code.length > 200) || typeof input.birthdaysEnabled !== "boolean") return { ok: false as const, code: "SOURCE_INPUT_INVALID" };
  try {
    const db = await createControlSupabaseClient(); if (!db) return { ok: false as const, code: "SOURCE_CONFIGURATION_UNAVAILABLE" };
    const { data, error } = await db.rpc("save_sportlink_connection_v2", { p_tenant_id: session.tenantId, p_connection_id: input.connectionId, p_expected_revision: input.expectedRevision, p_validation_id: input.validationId, p_selected_team_codes: input.teamCodes, p_birthdays_enabled: input.birthdaysEnabled, p_idempotency_key: input.idempotencyKey });
    if (error) return { ok: false as const, code: error.code === "23514" ? "SOURCE_VALIDATION_EXPIRED" : "SOURCE_SAVE_UNCONFIRMED" };
    if (data?.outcome === "conflict") return { ok: false as const, code: "SOURCE_REVISION_CONFLICT" };
    if (data?.outcome !== "saved" || !uuid.test(data.connectionId ?? "") || !Number.isSafeInteger(data.actualRevision) || !Array.isArray(data.selectedTeamCodes)) return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" };
    revalidatePath("/dashboard/data-sources/sportlink"); revalidatePath("/dashboard/sources");
    return { ok: true as const, connectionId: data.connectionId as string, revision: data.actualRevision as number, teamCodes: data.selectedTeamCodes as string[] };
  } catch { return { ok: false as const, code: "SOURCE_SAVE_UNCONFIRMED" }; }
}
