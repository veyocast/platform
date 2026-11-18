import "server-only";

import { hasCapability } from "@veyocast/auth";
import { agentResources } from "./catalog";
import { requireAgentActor } from "./access";
import { loadEffectivePlanning } from "../../app/(shell)/dashboard/planning/effective-planning-data.server";

export async function readAgentResources(input: { kind: string; query?: string; id?: string; offset?: number }) {
  if (!Object.hasOwn(agentResources, input.kind)) throw Error("Deze gegevensbron is niet beschikbaar.");
  const resource = agentResources[input.kind as keyof typeof agentResources];
  const { session, client } = await requireAgentActor(resource.capability);
  const offset = input.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw Error("De pagina is ongeldig.");
  let request = client.from(resource.table).select(resource.fields).eq("tenant_id", session.tenantId).order("id").range(offset, offset + 49);
  if (input.id) request = request.eq("id", input.id);
  if (input.query?.trim()) request = request.ilike(resource.label, `%${input.query.trim().replace(/[%_\\]/g, "").slice(0, 120)}%`);
  const result = await request;
  if (result.error) throw Error("Deze gegevens konden niet worden bevestigd. Controleer je rechten en probeer opnieuw; er is niets gewijzigd.");
  return { rows: result.data as unknown as Array<Record<string, unknown>>, offset, more: result.data.length === 50 };
}

export async function readAgentPlaylistItems(playlistId: string, offset = 0) {
  const { session, client } = await requireAgentActor("tenant.playlist.read");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw Error("De playlistpagina is ongeldig.");
  const result = await client.from("playlist_items").select("id,playlist_id,media_asset_id,dynamic_slide_id,sort_order,position_key,duration_seconds,fit_mode,muted,enabled,display_title,visible_from,visible_until,section_id").eq("tenant_id", session.tenantId).eq("playlist_id", playlistId).order("position_key").order("id").range(offset, offset + 99);
  if (result.error) throw Error("De playlistinhoud kon niet worden bevestigd. Er is niets gewijzigd.");
  return { items: result.data, offset, more: result.data.length === 100 };
}

export async function readAgentPlayerStatus(screenIds: string[]) {
  const { session, client } = await requireAgentActor("tenant.screen.read");
  if (!Array.isArray(screenIds) || !screenIds.length || screenIds.length > 50) throw Error("Kies één tot vijftig exacte schermen.");
  const screens = await client.from("screens").select("id,name,status,assigned_playlist_id,assigned_release_id,target_revision").eq("tenant_id", session.tenantId).in("id", screenIds);
  if (screens.error || screens.data.length !== new Set(screenIds).size) throw Error("De schermen zijn niet beschikbaar binnen deze vereniging.");
  const devices = await client.from("player_devices").select("id,screen_id,status,active_release_id,desired_release_id,last_seen_at,current_sync_phase,last_error_code").eq("tenant_id", session.tenantId).in("screen_id", screenIds).is("revoked_at", null).order("paired_at", { ascending: false }).limit(100);
  if (devices.error) throw Error("De daadwerkelijke playerbevestigingen konden niet worden gelezen. Publicatie is geen ontvangstbewijs.");
  return { observedAt: new Date().toISOString(), screens: screens.data, devices: devices.data, meaning: "active_release_id is de laatst door het device gemelde actieve release; last_seen_at bepaalt hoe actueel dat bewijs is. Een doeltoewijzing of desired_release_id bewijst geen ontvangst of zichtbare inhoud." };
}

export async function readAgentStudioDraft(projectId: string) {
  const { session, client } = await requireAgentActor("tenant.studio.read");
  const result = await client.from("studio_project_drafts").select("project_id,draft_revision,document_json,referenced_asset_ids,updated_at").eq("tenant_id", session.tenantId).eq("project_id", projectId).single();
  if (result.error) throw Error("Het actuele Studio-ontwerp is niet beschikbaar voor deze gebruiker en vereniging.");
  return result.data;
}

export async function readAgentPlanning(screenIds: string[], at?: string) {
  const { session } = await requireAgentActor("tenant.release.read");
  if (!hasCapability(session.capabilities, "tenant.screen.read")) throw Error("Je mag deze schermen niet inspecteren.");
  const result = await loadEffectivePlanning(session.tenantId, { screenIds, at, horizonDays: 2 });
  if (result.error || !result.report) throw Error(result.error ?? "De planning is niet beschikbaar.");
  return result.report;
}
