import "server-only";
import { hasCapability } from "@veyocast/auth";
import { syncContentFamilies, type SyncContentFamily } from "@veyocast/contracts";
import { createSyncStudioStarter } from "@veyocast/studio";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { applySyncThemeCreationDefaults, syncThemeCreationStarterDefaults } from "../../../../lib/sync-theme-creation-defaults";
import { loadSyncThemeCreationDefaults } from "../themes/sync-theme-defaults-data.server";
import { syncConnectedAuthoringType } from "../slides/sync-sportlink-binding";
import { loadStudioMediaAssets } from "./data";
import type { SyncCreateWizardData, SyncCreateWizardMode } from "./sync-create-wizard-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** A new wizard only reads. The original canonical writers create its final draft. */
export async function loadSyncCreateWizardData(family: SyncContentFamily, requestedMode?: SyncCreateWizardMode): Promise<SyncCreateWizardData | null> {
  if (!syncContentFamilies.some(value => value.id === family)) return null;
  const session = await requireTenantControlSession();
  if (!session.isLive || !session.tenantId || !session.userId) return null;
  const slideType = (syncConnectedAuthoringType(family)??syncConnectedAuthoringType(family,'sync-onzetrots-v1')) ?? null;
  const active = session.tenantStatus === "active";
  const canCreateManual = active && hasCapability(session.capabilities, "tenant.studio.create");
  const canCreateConnected = active && Boolean(slideType) && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const data: SyncCreateWizardData = {
    tenantId: session.tenantId, actorScope: `${session.tenantId}:${session.userId}`, tenantName: session.tenant,
    family, initialPresentation: createSyncStudioStarter({ family, tenantName: session.tenant, theme: "fieldflow" }).syncPresentation!,
    canCreateManual, canCreateConnected, initialMode: canCreateManual ? "manual" : "connected", slideType,
    sources: [], templates: [], images: [], loadError: null,
    themeDefaultsError: "De voorkeuren voor nieuwe ontwerpen zijn nog niet bevestigd. Je invoer blijft behouden; laad opnieuw voordat je een nieuw ontwerp maakt.",
  };
  if (!canCreateManual && !canCreateConnected) {
    data.loadError = "Je kunt dit ontwerp bekijken, maar niet maken met je huidige rechten. Vraag een beheerder om toegang tot ontwerpen of automatische slides.";
    return data;
  }
  const client = await createControlSupabaseClient();
  if (!client) { data.loadError = "De veilige gegevensverbinding ontbreekt. Je keuze is behouden; laad opnieuw zodra je verbinding terug is."; return data; }
  try {
    const kinds = slideType === "menu" ? ["manual_products", "twelve_excel"] : slideType === "news" ? ["rss"] : slideType === "ledscores_live_match" ? ["ledscores"] : ["sportlink"];
    const [sources, templates, media, connections, themeDefaults] = await Promise.all([
      canCreateConnected ? client.from("dynamic_data_sources").select("id,name,kind,provider_status,last_successful_sync_at,last_error_code").eq("tenant_id", session.tenantId).in("kind", kinds).eq("status", "active").order("name").limit(201) : null,
      canCreateConnected ? client.from("dynamic_templates").select("current_published_version_id,orientation,slug").eq("slide_type", slideType!).eq("status", "published").order("slug").limit(101) : null,
      hasCapability(session.capabilities, "tenant.media.read") ? loadStudioMediaAssets(client, session.tenantId, []) : null,
      canCreateConnected && slideType === "ledscores_live_match" ? client.from("ledscores_connections").select("data_source_id").eq("tenant_id", session.tenantId).eq("status", "active").limit(201) : null,
      loadSyncThemeCreationDefaults(client, session.tenantId),
    ]);
    if (themeDefaults.ok) {
      data.themeDefaults = themeDefaults.value;
      data.themeDefaultsError = null;
      const themeId = themeDefaults.value.defaultThemeId ?? "fieldflow";
      const profile = themeDefaults.value.profiles.find(value => value.themeId === themeId)!;
      data.initialPresentation = applySyncThemeCreationDefaults(data.initialPresentation, themeId, profile.defaults ?? syncThemeCreationStarterDefaults(themeId));
    } else data.themeDefaultsError = themeDefaults.message;
    if (sources?.error || templates?.error || connections?.error || (sources?.data?.length ?? 0) > 200 || (templates?.data?.length ?? 0) > 100 || (connections?.data?.length ?? 0) > 200) throw Error("read");
    const sourceRows = sources?.data ?? [], templateRows = templates?.data ?? [];
    if (sourceRows.some(source => !uuid.test(source.id) || typeof source.name !== "string" || source.name.length > 200 || !kinds.includes(source.kind)) || templateRows.some(template => !uuid.test(String(template.current_published_version_id)) || !["landscape", "portrait"].includes(template.orientation) || typeof template.slug !== "string")) throw Error("shape");
    data.sources = sourceRows.filter(source => !connections || connections.data.some(connection => connection.data_source_id === source.id)).map(source => ({ id: source.id, name: source.name, kind: source.kind, providerStatus: source.provider_status, lastSuccessfulSyncAt: source.last_successful_sync_at, lastErrorCode: source.last_error_code }));
    data.templates = templateRows.map(template => ({ versionId: template.current_published_version_id!, orientation: template.orientation, slug: template.slug }));
    data.images = (media?.assets ?? []).flatMap(asset => asset.kind === "image" && uuid.test(asset.id) && asset.sourceUrl && /^[a-f0-9]{64}$/.test(asset.checksumSha256 ?? "") ? [{ id: asset.id, title: asset.title, checksumSha256: asset.checksumSha256!, url: asset.sourceUrl }] : []);
    if (media?.error) data.loadError = "Je foto's konden niet worden geladen. De vaste achtergronden blijven beschikbaar; laad opnieuw voor je eigen foto's.";
    if(family==='welcome'&&requestedMode==='connected'&&data.initialPresentation.rendererVersion==='sync-v1'){
      const profile=themeDefaults.ok?themeDefaults.value.profiles.find(value=>value.themeId==='onzetrots-tv'):null;
      data.initialPresentation=applySyncThemeCreationDefaults(data.initialPresentation,'onzetrots-tv',profile?.defaults??syncThemeCreationStarterDefaults('onzetrots-tv'));
    }
    data.initialMode = requestedMode === "manual" && canCreateManual ? "manual" : requestedMode === "connected" && canCreateConnected || canCreateConnected && (!canCreateManual || data.sources.length > 0) ? "connected" : "manual";
    if(family==='welcome'&&data.initialPresentation.rendererVersion==='sync-v1')data.initialMode='manual';
    return data;
  } catch {
    data.loadError = "De beschikbare bronnen, templates of foto's konden niet volledig worden bevestigd. Er is niets aangemaakt; laad opnieuw of kies waar toegestaan handmatige invoer.";
    return data;
  }
}
