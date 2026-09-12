"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { goalOverlayConfigurationSchema, goalOverlayTeamSelectionSchema, goalOverlayActionIdentitySchema, goalOverlayGroupSelectionSchema, goalOverlayStatusSchema, goalOverlayTestInputSchema } from "@veyocast/contracts";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { loadTenantStyleData } from "../../../../../../lib/tenant-style-data";

const path = "/dashboard/studio/led-scores/goal-overlay";

function finish(message: string, error = false): never {
  revalidatePath(path);
  revalidatePath("/dashboard/studio/led-scores");
  redirect(`${path}?${error ? "fout" : "succes"}=${encodeURIComponent(message)}`);
}
function json(form: FormData, name: string): unknown {
  try { return JSON.parse(String(form.get(name) ?? "")); }
  catch { finish("De instellingen zijn ongeldig. Vernieuw de pagina en probeer opnieuw.", true); }
}
function identity(form: FormData) {
  const result = goalOverlayActionIdentitySchema.safeParse({ alertId: form.get("alertId") || null, revision: form.get("revision") });
  if (!result.success) finish("Het concept is niet meer geldig. Vernieuw de pagina.", true);
  return result.data;
}
async function call(name: string, args: Record<string, unknown>) {
  const db = await createControlSupabaseClient();
  if (!db) finish("Geen verbinding met Studio. Probeer het opnieuw zodra de verbinding is hersteld.", true);
  const result = await db.rpc(name, args);
  if (result.error) {
    console.error("goal_overlay_action_failed", { action: name, code: result.error.code });
    finish(result.error.code === "P0004" ? "Er is net een test gestart. Wacht 15 seconden en probeer opnieuw." : "De actie kon niet worden uitgevoerd. Controleer je rechten, actieve teams, schermgroepen en verwerkte media en vernieuw de pagina.", true);
  }
  if (result.data?.outcome === "conflict") finish("Een collega heeft dit concept gewijzigd. Vernieuw de pagina voordat je verdergaat.", true);
  return result.data as { deliveryCount?: number; outcome?: string };
}
export async function saveGoalOverlay(form: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const id = identity(form);
  const config = goalOverlayConfigurationSchema.safeParse(json(form, "configuration"));
  const teams = goalOverlayTeamSelectionSchema.safeParse(json(form, "teams"));
  const groups = goalOverlayGroupSelectionSchema.safeParse(form.getAll("groupIds"));
  if (!config.success || !teams.success || !groups.success) finish("Controleer de teksten, instellingen en selectie van teams en schermgroepen. Gebruik alleen de getoonde tekstvariabelen.", true);
  const style = await loadTenantStyleData(session.tenantId, session.isLive);
  if (style.error) finish("De clubstijl kon niet volledig worden geladen. Vernieuw de pagina en sla daarna opnieuw op.", true);
  const configuration = { ...config.data, defaults: { primary: style.appearance.schemaVersion === 2 ? style.appearance.palette.primary : style.selection.accent ?? style.light.accent, darkSurface: style.dark.surface, modePolicy: style.selection.modePolicy, timezone: session.timezoneName } };
  await call("save_ledscores_goal_overlay_v2", { p_tenant_id: session.tenantId, p_alert_id: id.alertId, p_expected_revision: id.revision, p_config: configuration, p_teams: teams.data, p_group_ids: groups.data });
  finish("Concept opgeslagen. Publiceer de versie om deze op de schermen te gebruiken.");
}
export async function publishGoalOverlay(form: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.publish");
  const id = identity(form);
  await call("publish_ledscores_goal_alert_v1", { p_tenant_id: session.tenantId, p_alert_id: id.alertId, p_expected_revision: id.revision, p_idempotency_key: randomUUID() });
  finish("Goal Overlay gepubliceerd. De players ontvangen de configuratie en laden de introvideo’s vooraf.");
}
export async function toggleGoalOverlay(form: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const id = identity(form);
  const status = goalOverlayStatusSchema.safeParse(form.get("status"));
  if (!status.success) finish("Kies een geldige status.", true);
  await call("set_ledscores_goal_alert_status_v1", { p_tenant_id: session.tenantId, p_alert_id: id.alertId, p_expected_revision: id.revision, p_status: status.data });
  finish(status.data === "paused" ? "Goal Overlay staat uit." : "Goal Overlay is actief.");
}
export async function testGoalOverlay(form: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.publish");
  const id = identity(form);
  const team = goalOverlayTeamSelectionSchema.element.safeParse(json(form, "testTeam"));
  const fields = goalOverlayTestInputSchema.safeParse({ group: form.get("testGroup"), side: form.get("testSide"), home: form.get("homeScore"), away: form.get("awayScore"), scorerId: form.get("scorerId") || null, scorerName: form.get("scorerName") ?? "", minute: form.get("minute") ?? "" });
  if (!team.success || !fields.success) finish("Controleer het testteam, de schermgroep en de testscore.", true);
  const f = fields.data;
  const result = await call("run_ledscores_synthetic_goal_v2", { p_tenant_id: session.tenantId, p_alert_id: id.alertId, p_connection_id: team.data.connectionId, p_team_key: team.data.teamKey, p_group_id: f.group, p_scoreboard_side: f.side, p_home_score: f.home, p_away_score: f.away, p_scorer_id: f.scorerId, p_scorer_name: f.scorerName || null, p_minute: f.minute || null });
  finish(`Test Goal Alert klaargezet voor ${result.deliveryCount ?? 0} schermen. Dit testevent wijzigt geen wedstrijdstatistieken.`);
}

export async function savePlayerPhoto(form: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const ids = goalOverlayGroupSelectionSchema.safeParse([form.get("playerId"), ...(form.get("mediaId") ? [form.get("mediaId")] : [])]);
  if (!ids.success) finish("Kies een geldige speler en foto.", true);
  await call("set_ledscores_player_photo_v2", { p_tenant_id: session.tenantId, p_player_id: ids.data[0], p_media_asset_id: ids.data[1] ?? null });
  finish("Spelersfoto gekoppeld. Nieuwe Goal Alerts gebruiken deze foto zodra de speler is herkend.");
}
