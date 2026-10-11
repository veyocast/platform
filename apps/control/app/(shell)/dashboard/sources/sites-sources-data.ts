import "server-only";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { deriveLedScoresFeatureAvailability, parseLedScoresEffectiveState } from "../../../../lib/ledscores-feature-state";
import { loadLatestSportlinkRuns } from "../data-sources/sportlink/sportlink-status";
import {
  sourceOverviewLedHealth, sourceOverviewSportlinkHealth, sourceOverviewHealth,
  worstSourceOverviewHealth, type SourceOverviewData, type SourceOverviewRow
} from "./sites-sources-model";

export async function loadSourcesOverview(tenantId: string): Promise<SourceOverviewData> {
  const client = await createControlSupabaseClient();
  if (!client) return unavailableSourcesOverview();
  try {
    const [sources, connection, ledFeature, flags] = await Promise.all([
      client.from("dynamic_data_sources").select("id,name,kind,status,provider_status,last_successful_sync_at,last_error_code,config_json").eq("tenant_id", tenantId).neq("status", "archived").order("name").limit(500),
      client.from("sportlink_connections").select("id,status,last_error_code").eq("tenant_id", tenantId).neq("status", "revoked").maybeSingle(),
      client.rpc("get_ledscores_feature_effective_state_v1", { p_tenant_id: tenantId }),
      client.from("tenant_feature_flags").select("flag_key,enabled").eq("tenant_id", tenantId).eq("flag_key", "youtube_integration").maybeSingle()
    ]);
    const policies = connection.data ? await client.from("sportlink_sync_policies").select("dataset_group,frequency,enabled,last_success_at").eq("tenant_id", tenantId).eq("connection_id", connection.data.id).order("dataset_group") : { data: [], error: null };
    const latestRuns = connection.data ? await loadLatestSportlinkRuns(client, tenantId, connection.data.id, (policies.data ?? []).map(policy => policy.dataset_group)) : new Map();
    const ledAvailability = ledFeature.error ? "unavailable" : deriveLedScoresFeatureAvailability(parseLedScoresEffectiveState(ledFeature.data, tenantId));
    const [led, youtube] = await Promise.all([
      ledAvailability === "available" ? client.from("ledscores_connections").select("status,health_status,last_connected_at,last_source_message_at,lease_expires_at").eq("tenant_id", tenantId).limit(100) : Promise.resolve({ data: [], error: null }),
      flags.data?.enabled ? client.from("youtube_sources").select("status,validation_status,embeddable").eq("tenant_id", tenantId).in("status", ["active", "paused"]).limit(500) : Promise.resolve({ data: [], error: null })
    ]);
    const rows: SourceOverviewRow[] = (sources.data ?? []).map(source => {
      const refresh = source.config_json && typeof source.config_json === "object" && !Array.isArray(source.config_json) ? (source.config_json as Record<string, unknown>).refreshMinutes : null;
      return { id: source.id, name: source.name, kind: source.kind, status: source.status, provider_status: source.provider_status, last_successful_sync_at: source.last_successful_sync_at, last_error_code: source.last_error_code, refreshMinutes: typeof refresh === "number" && Number.isFinite(refresh) && refresh >= 1 && refresh <= 1_440 ? refresh : null };
    });
    const products = rows.filter(source => ["manual_products", "twelve_excel"].includes(source.kind));
    const youtubeHealth = flags.error || youtube.error ? { label: "Status onbekend", tone: "warning" as const }
      : !flags.data?.enabled ? { label: "Niet vrijgegeven", tone: "neutral" as const }
      : worstSourceOverviewHealth((youtube.data ?? []).map(source => source.status === "paused" ? { label: "Gepauzeerd", tone: "neutral" as const }
        : source.validation_status !== "verified" || !source.embeddable ? { label: "Validatie nodig", tone: "warning" as const }
        : { label: "Gevalideerd · online", tone: "success" as const }));
    const sportHealth = sourceOverviewSportlinkHealth(connection.data, (policies.data ?? []).map(policy => {
      const latest = latestRuns.get(policy.dataset_group);
      return { ...policy, last_error_code: latest?.errorCode ?? null, last_run_status: latest?.status ?? null, run_status_unavailable: latest?.unavailable ?? false };
    }), Boolean(connection.error || policies.error));
    const ledHealth = ledFeature.error || led.error || ledAvailability === "unavailable" ? { label: "Status onbekend", tone: "warning" as const }
      : ledAvailability !== "available" ? { label: ledAvailability === "globally_blocked" || ledAvailability === "tenant_blocked" ? "Gepauzeerd" : "Niet vrijgegeven", tone: "neutral" as const }
      : sourceOverviewLedHealth(led.data ?? []);
    return {
      sources: rows, failed: Boolean(sources.error || connection.error || policies.error || flags.error || ledFeature.error || led.error || youtube.error),
      cards: [
        { id: "sportlink", health: sportHealth, connectionCount: connection.data ? 1 : 0, detail: connection.data ? "De meest recente poging en versheid per dataset bepalen deze status." : "Koppel je club om gegevens veilig te synchroniseren." },
        { id: "youtube", health: youtubeHealth, connectionCount: youtube.data?.length ?? 0, detail: "Officiële online playback met lokale fallback; geen offline videovoorraad." },
        { id: "twelve", health: sources.error ? { label: "Status onbekend", tone: "warning" } : worstSourceOverviewHealth(products.map(source => sourceOverviewHealth(source))), connectionCount: products.length, detail: "Handmatige catalogus of gecontroleerde Excel-import. Automatische Twelve-API-sync is niet actief." },
        { id: "led", health: ledHealth, connectionCount: led.data?.length ?? 0, detail: "De serververbinding en actuele workerlease bepalen de status." }
      ]
    };
  } catch { return unavailableSourcesOverview(); }
}
export function unavailableSourcesOverview(): SourceOverviewData {
  return { failed: true, sources: [], cards: (["sportlink", "youtube", "twelve", "led"] as const).map(id => ({ id, health: { label: "Status onbekend", tone: "warning" }, connectionCount: 0, detail: "Bronstatus kon niet worden gelezen. Je opgeslagen gegevens blijven behouden. Vernieuw de pagina." })) };
}
