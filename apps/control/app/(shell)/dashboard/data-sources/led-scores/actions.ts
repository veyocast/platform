"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  LedScoresProtocolError,
  testLedScoresConnection
} from "@veyocast/integrations/server";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

const returnPath = "/dashboard/data-sources/led-scores";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveLedScoresConnection(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = optionalUuid(formData, "connectionId");
  const name = String(formData.get("name") ?? "").trim();
  const clubSlug = String(formData.get("clubSlug") ?? "").trim().toLowerCase();
  const status = String(formData.get("status") ?? "active");
  const expectedRevision = Number.parseInt(
    String(formData.get("expectedRevision") ?? "0"),
    10
  );
  const supabase = await createControlSupabaseClient();
  if (
    !supabase
    || name.length < 2
    || name.length > 120
    || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(clubSlug)
    || !["active", "paused"].includes(status)
    || !Number.isInteger(expectedRevision)
    || expectedRevision < 0
  ) fail("Controleer naam, clubslug en status. Er is niets gewijzigd.");
  const result = await supabase.rpc("save_ledscores_connection_v1", {
    p_club_slug: clubSlug,
    p_connection_id: connectionId,
    p_expected_revision: expectedRevision,
    p_name: name,
    p_status: status,
    p_tenant_id: session.tenantId!
  });
  if (result.error) {
    fail(connectionError(result.error.code));
  }
  if (isRecord(result.data) && result.data.outcome === "conflict") {
    fail("Iemand anders wijzigde deze verbinding. Vernieuw de pagina en probeer opnieuw.");
  }
  complete(connectionId
    ? "LED Scores-verbinding is bijgewerkt."
    : "LED Scores-verbinding is veilig toegevoegd.");
}

export async function testLedScoresSource(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = requiredUuid(formData, "connectionId");
  const clubSlug = String(formData.get("clubSlug") ?? "").trim().toLowerCase();
  const supabase = await createControlSupabaseClient();
  if (!supabase) fail("De beveiligde datasessie ontbreekt. Er is niets getest.");
  const reservation = await supabase.rpc("reserve_ledscores_connection_test_v1", {
    p_connection_id: connectionId,
    p_tenant_id: session.tenantId!
  });
  if (reservation.error) fail(connectionError(reservation.error.code));
  if (reservation.data !== true) {
    fail("Een verbindingstest is net uitgevoerd. Wacht 30 seconden en probeer opnieuw.");
  }
  try {
    const result = await testLedScoresConnection(clubSlug);
    const detail = [
      `Team ${result.homeTeamId} ${result.homeScore}`,
      `Team ${result.awayTeamId} ${result.awayScore}`,
      result.period ? `periode ${result.period}` : "periode onbekend",
      `${result.responseTimeMs} ms`
    ].join(" · ");
    const finishResult = await supabase.rpc("finish_ledscores_connection_test_v1", {
      p_connection_id: connectionId,
      p_detail: detail,
      p_status: "success",
      p_tenant_id: session.tenantId!
    });
    if (finishResult.error) fail("De test slaagde, maar het resultaat kon niet worden geaudit.");
    complete(`Read-only verbinding geslaagd. ${detail}.`);
  } catch (error) {
    const detail = error instanceof LedScoresProtocolError
      ? error.message
      : "LED Scores was tijdelijk niet bereikbaar.";
    await supabase.rpc("finish_ledscores_connection_test_v1", {
      p_connection_id: connectionId,
      p_detail: detail,
      p_status: "failed",
      p_tenant_id: session.tenantId!
    });
    fail(`${detail} De opgeslagen verbinding en bestaande alerts zijn ongewijzigd.`);
  }
}

export async function saveLedScoresMappings(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = requiredUuid(formData, "connectionId");
  const keys = formData.getAll("teamKey").map((value) => String(value).trim().toLowerCase());
  const names = formData.getAll("teamName").map((value) => String(value).trim());
  const sides = formData.getAll("side").map(String);
  const sportsTeamIds = formData.getAll("sportsTeamId").map((value) => String(value));
  if (
    keys.length !== names.length
    || keys.length !== sides.length
    || keys.length !== sportsTeamIds.length
    || keys.length > 50
  ) {
    fail("De teammapping is onvolledig. Er is niets gewijzigd.");
  }
  const mappings = keys.flatMap((teamKey, index) => {
    const teamName = names[index] ?? "";
    const side = sides[index] ?? "";
    const sportsTeamId = sportsTeamIds[index] ?? "";
    if (!teamKey && !teamName && !sportsTeamId) return [];
    if (
      teamKey.length < 1
      || teamKey.length > 200
      || teamName.length > 160
      || (!teamName && !uuidPattern.test(sportsTeamId))
      || (sportsTeamId && !uuidPattern.test(sportsTeamId))
      || !["own", "opponent"].includes(side)
    ) fail("Vul per team een ID, herkenbare naam en classificatie in.");
    return [{ side, sportsTeamId: sportsTeamId || null, teamKey, teamName }];
  });
  const supabase = await createControlSupabaseClient();
  const result = supabase
    ? await supabase.rpc("save_ledscores_team_mappings_v1", {
        p_connection_id: connectionId,
        p_mappings: mappings,
        p_tenant_id: session.tenantId!
      })
    : null;
  if (!result || result.error) fail(connectionError(result?.error?.code));
  complete(`${mappings.length} teammapping${mappings.length === 1 ? "" : "s"} opgeslagen.`);
}

export async function linkLedScoresClub(formData: FormData) {
  const session = await requireTenantControlSession("tenant.data_source.manage");
  const connectionId = requiredUuid(formData, "connectionId");
  const clubId = optionalUuid(formData, "sportsClubId");
  const revision = Number(formData.get("expectedRevision"));
  if (!Number.isInteger(revision) || revision < 1) fail("Vernieuw de verbinding voordat je een club koppelt.");
  const db = await createControlSupabaseClient();
  const result = db ? await db.rpc("link_ledscores_club_v2", { p_tenant_id: session.tenantId, p_connection_id: connectionId, p_sports_club_id: clubId, p_expected_revision: revision }) : null;
  if (!result || result.error) fail(connectionError(result?.error?.code));
  if (isRecord(result.data) && result.data.outcome === "conflict") fail("De verbinding is gewijzigd. Vernieuw de pagina.");
  complete("Clubkoppeling opgeslagen. De volgende catalogusverversing koppelt teams met een overeenkomende Sportlink-teamcode.");
}

function connectionError(code: string | undefined) {
  if (code === "42501") return "Deze tenant of rol mag LED Scores niet beheren.";
  if (code === "23505") return "Deze clubslug of interne naam bestaat al binnen de tenant.";
  if (code === "P0002") return "De verbinding bestaat niet meer. Vernieuw de pagina.";
  if (code === "23514") return "De verbinding bevat ongeldige of niet-toegestane waarden.";
  return "De LED Scores-verbinding kon niet veilig worden opgeslagen.";
}

function requiredUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail("De gekozen verbinding is ongeldig.");
  return value;
}

function optionalUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!value) return null;
  if (!uuidPattern.test(value)) fail("De gekozen verbinding is ongeldig.");
  return value;
}

function complete(message: string): never {
  revalidatePath(returnPath);
  revalidatePath("/dashboard/data-sources");
  revalidatePath("/dashboard/studio/led-scores");
  redirect(`${returnPath}?succes=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`${returnPath}?fout=${encodeURIComponent(message)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
