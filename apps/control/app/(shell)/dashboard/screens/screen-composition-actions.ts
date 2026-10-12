"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { compositionZoneIds, screenCompositionDraftSchema, screenCompositionLayoutSchema } from "@veyocast/contracts";
import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

type CompositionRequest = {
  commandId: string;
  targets: Array<{ screenId: string; expectedDraftRevision: number }>;
  configuration: { layout: "full" | "sidebar" | "bottom" | "three"; orientation: "landscape" | "portrait"; mainWidthPercent: number; bottomHeightPercent: number; zones: Array<{ id: "main" | "side" | "bottom"; content: string }> };
  seriesRevisions: Record<string, number>;
};
function parseRequest(input: unknown): CompositionRequest | null {
  const value = record(input);
  const config = record(value?.configuration);
  const revisions = record(value?.seriesRevisions);
  if (!value || !config || !revisions || !uuid(value.commandId) || Object.keys(value).some((key) => !["commandId", "targets", "configuration", "seriesRevisions"].includes(key)) || !Array.isArray(value.targets) || value.targets.length < 1 || value.targets.length > 100 || !Array.isArray(config.zones) || config.zones.length < 1 || config.zones.length > 3 || Object.keys(config).some((key) => !["layout", "orientation", "mainWidthPercent", "bottomHeightPercent", "zones"].includes(key))) return null;
  const layout = screenCompositionLayoutSchema.safeParse(config.layout);
  if (!layout.success || !["landscape", "portrait"].includes(String(config.orientation))) return null;
  if (Object.entries(revisions).some(([id, revision]) => !uuid(id) || !Number.isSafeInteger(revision) || Number(revision) < 1) || Object.keys(revisions).length > 1000) return null;
  const targets: CompositionRequest["targets"] = [];
  for (const item of value.targets) { const target = record(item); if (!target || !uuid(target.screenId) || !Number.isSafeInteger(target.expectedDraftRevision) || Number(target.expectedDraftRevision) < 0 || Object.keys(target).some((key) => !["screenId", "expectedDraftRevision"].includes(key))) return null; targets.push({ screenId: String(target.screenId), expectedDraftRevision: Number(target.expectedDraftRevision) }); }
  const zones: CompositionRequest["configuration"]["zones"] = [];
  for (const item of config.zones) { const zone = record(item); if (!zone || !["main", "side", "bottom"].includes(String(zone.id)) || typeof zone.content !== "string" || !["playlist", "series"].includes(zone.content.split(":")[0]!) || !uuid(zone.content.split(":")[1]) || zone.content.split(":").length !== 2 || Object.keys(zone).some((key) => !["id", "content"].includes(key))) return null; zones.push({ id: zone.id as "main" | "side" | "bottom", content: zone.content }); }
  const parsed = screenCompositionDraftSchema.safeParse({ schemaVersion: 1, layout: layout.data, orientation: config.orientation, mainWidthPercent: config.mainWidthPercent, bottomHeightPercent: config.bottomHeightPercent, zones: zones.map((zone) => ({ id: zone.id, playlistId: zone.content.split(":")[1] })) });
  if (!parsed.success) return null;
  return { commandId: String(value.commandId), targets, configuration: { ...parsed.data, zones }, seriesRevisions: revisions as Record<string, number> };
}
function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export type CompositionSaveResult = { status: "published" | "conflict" | "error"; message: string; publishedCount: number };
export async function saveScreenComposition(input: unknown): Promise<CompositionSaveResult> {
  const parsed = parseRequest(input);
  if (!parsed) return failure("De indeling of schermselectie is onvolledig. Controleer iedere zone en probeer opnieuw.");
  const request = parsed;
  if (new Set(request.targets.map((target) => target.screenId)).size !== request.targets.length) return failure("Er staan dubbele schermen in de selectie. Selecteer de doelen opnieuw.");
  const expectedZones = compositionZoneIds(request.configuration.layout);
  if (request.configuration.zones.length !== expectedZones.length || expectedZones.some((zone) => request.configuration.zones.filter(({ id }) => id === zone).length !== 1)) return failure("Kies precies de contentzones van de gekozen indeling.");
  const session = await requireTenantCapability("tenant.screen.manage");
  await requireTenantCapability("tenant.playlist.publish");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) return failure("De beveiligde datasessie ontbreekt. Log opnieuw in voordat je publiceert.");
  // A member may have rights in several clubs. The active Control context must
  // scope every input before the first Studio RPC can create a publication.
  const screenIds = request.targets.map(({ screenId }) => screenId).sort();
  const seriesIds = [...new Set(request.configuration.zones.filter(({ content }) => content.startsWith("series:")).map(({ content }) => content.split(":")[1]!))].sort();
  const playlistIds = [...new Set(request.configuration.zones.filter(({ content }) => content.startsWith("playlist:")).map(({ content }) => content.split(":")[1]!))].sort();
  if (seriesIds.some((id) => !request.seriesRevisions[id])) return failure("Het Studio-ontwerp heeft geen actuele revisie. Vernieuw de contentkeuze.");
  const [screens, series, playlists] = await Promise.all([
    supabase.from("screens").select("id").eq("tenant_id", session.tenantId).eq("status", "active").is("deleted_at", null).in("id", screenIds).order("id").limit(100),
    seriesIds.length ? supabase.from("studio_series").select("id, revision").eq("tenant_id", session.tenantId).eq("status", "active").in("id", seriesIds).order("id").limit(3) : Promise.resolve({ data: [], error: null }),
    playlistIds.length ? supabase.from("playlists").select("id").eq("tenant_id", session.tenantId).in("status", ["draft", "published"]).is("archived_at", null).in("id", playlistIds).order("id").limit(3) : Promise.resolve({ data: [], error: null })
  ]);
  const exactIds = (rows: Array<{ id: string }> | null, expected: string[]) => rows !== null && rows.length === expected.length && rows.map(({ id }) => id).sort().every((id, index) => id === expected[index]);
  if (screens.error || series.error || playlists.error || !exactIds(screens.data, screenIds) || !exactIds(series.data, seriesIds) || !exactIds(playlists.data, playlistIds)) return failure("Een scherm of contentbron is niet beschikbaar in de actieve vereniging. Controleer je selectie en vernieuw de pagina; er is niets gepubliceerd.");
  if (series.data.some(({ id, revision }) => Number(revision) !== request.seriesRevisions[id])) return { status: "conflict", publishedCount: 0, message: "Een Studio-ontwerp is intussen gewijzigd. Vernieuw de contentkeuze; er is niets gepubliceerd." };
  const resolved = new Map<string, string>();
  let createdSeriesPlaylists = 0;
  for (const zone of request.configuration.zones) {
    if (resolved.has(zone.content)) continue;
    const [kind, id] = zone.content.split(":");
    if (kind === "playlist") { resolved.set(zone.content, id!); continue; }
    const revision = request.seriesRevisions[id!];
    if (!revision) return failure("Het Studio-ontwerp heeft geen actuele revisie. Vernieuw de contentkeuze.");
    const { data, error } = await supabase.rpc("create_studio_series_zone_playlist_v1", {
      p_series_id: id!, p_expected_series_revision: revision, p_idempotency_key: commandKey(request.commandId, `series:${id}`)
    });
    const result = record(data);
    if (error || result?.outcome !== "created" || !uuid(result.playlistId)) {
      console.error("Studio-zoneplaylist niet bevestigd", { code: error?.code ?? "INVALID_RESULT" });
      return failure("Het Studio-ontwerp kon niet veilig worden gepubliceerd. Controleer of alle exports gereed zijn en vernieuw de pagina.");
    }
    resolved.set(zone.content, String(result.playlistId));
    createdSeriesPlaylists += 1;
  }
  const configuration = screenCompositionDraftSchema.safeParse({
    schemaVersion: 1, layout: request.configuration.layout, orientation: request.configuration.orientation,
    mainWidthPercent: request.configuration.mainWidthPercent, bottomHeightPercent: request.configuration.bottomHeightPercent,
    zones: request.configuration.zones.map((zone) => ({ id: zone.id, playlistId: resolved.get(zone.content) }))
  });
  if (!configuration.success) return failure("De percentages of zonecontent zijn ongeldig. Controleer de indeling en probeer opnieuw.");
  const { data, error } = await supabase.rpc("save_publish_screen_composition_batch_v1", {
    p_tenant_id: session.tenantId,
    p_targets: request.targets.map((target) => ({ ...target, configuration: configuration.data })),
    p_idempotency_key: commandKey(request.commandId, "composition")
  });
  const result = record(data);
  const bridgeMessage = createdSeriesPlaylists ? " De Studio-ontwerpen zijn wel als playlists beschikbaar." : "";
  if (error?.code === "40001" || result?.outcome === "conflict") return { status: "conflict", message: `Een schermindeling is intussen gewijzigd. Vernieuw de pagina en controleer de selectie; er is geen nieuwe schermindeling gepubliceerd.${bridgeMessage}`, publishedCount: 0 };
  if (error || !result) {
    console.error("Schermindeling niet gepubliceerd", { code: error?.code ?? "INVALID_RESULT" });
    return failure(`De indeling kon niet veilig worden gepubliceerd. De vorige schermindeling blijft actief. Controleer de playlistpublicaties en probeer opnieuw.${bridgeMessage}`);
  }
  if (result.outcome === "conflict") return { status: "conflict", message: `Een schermindeling is intussen gewijzigd. Vernieuw de pagina en controleer de selectie; er is geen nieuwe schermindeling gepubliceerd.${bridgeMessage}`, publishedCount: 0 };
  if (result.outcome !== "published") return failure(`De server gaf geen volledige publicatiebevestiging. Vernieuw de pagina voordat je opnieuw opslaat.${bridgeMessage}`);
  revalidatePath("/dashboard/screens");
  for (const target of request.targets) revalidatePath(`/dashboard/screens/${target.screenId}`);
  revalidatePath("/dashboard/playlists");
  return { status: "published", publishedCount: request.targets.length, message: `Indeling gepubliceerd voor ${request.targets.length} ${request.targets.length === 1 ? "scherm" : "schermen"}. Schermen schakelen over nadat alle content is gecontroleerd.` };
}
function failure(message: string): CompositionSaveResult { return { status: "error", message, publishedCount: 0 }; }
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function commandKey(commandId: string, operation: string) { const hash = createHash("sha256").update(`${commandId}:${operation}`).digest("hex"); return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`; }
