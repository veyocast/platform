import "server-only";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { deriveLedScoresFeatureAvailability, parseLedScoresEffectiveState, type LedScoresFeatureAvailability } from "../../../../../lib/ledscores-feature-state";
import type { GoalDeliveryRow } from "./delivery-visibility";
export type LedScoresDelivery = GoalDeliveryRow & {
  created_at: string;
  goal_event_id: string;
  id: string;
  screen_id: string;
};

export type LedScoresScreen = {
  deleted_at: string | null;
  id: string;
  name: string;
  status: string;
};

export type LedScoresDevice = {
  app_version: string | null;
  last_seen_at: string | null;
  platform: string | null;
  screen_id: string;
  status: string;
};


export async function loadLedSourceData(tenantId: string, connectionId?: string | null) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyLedSourceData();
  const featureStateResult = await supabase.rpc(
    "get_ledscores_feature_effective_state_v1",
    { p_tenant_id: tenantId }
  );
  const featureState = parseLedScoresEffectiveState(
    featureStateResult.data,
    tenantId
  );
  const availability = featureStateResult.error
    ? "unavailable" as const
    : deriveLedScoresFeatureAvailability(featureState);
  if (featureStateResult.error || availability === "unavailable") {
    console.error("LED Scores-vrijgavestatus laden mislukt", {
      code: featureStateResult.error?.code ?? "invalid_response"
    });
  }
  if (availability !== "available") return { ...emptyLedSourceData(), availability };
  const creating = connectionId === null;
  let connectionQuery = supabase.from("ledscores_connections").select("id,name,club_slug,scoreboard_label,provider_club_id,provider_club_name,sports_club_id,catalog_synced_at,status,health_status,health_detail,revision,baseline_json,last_source_message_at,last_connected_at,last_disconnected_at,lease_expires_at,last_test_at,last_test_status,last_test_detail,reconnect_count,invalid_message_count").eq("tenant_id", tenantId).order("created_at");
  if (connectionId) connectionQuery = connectionQuery.eq("id", connectionId);
  const connections = creating ? { data: [], error: null } : await connectionQuery;
  if (connectionId && (connections.error || !connections.data?.some(item => item.id === connectionId))) return { ...emptyLedSourceData(), enabled: true, loadError: true };
  let mappingQuery = supabase.from("ledscores_team_mappings").select("id,connection_id,provider_team_key,provider_team_name,sports_team_id,scoring_side").eq("tenant_id", tenantId).order("created_at");
  let eventQuery = supabase.from("ledscores_goal_events").select("id,connection_id,event_kind,source_observed_at,detected_at,home_team,away_team,home_score,away_score,scoring_side,dispatch_status").eq("tenant_id", tenantId).order("detected_at", { ascending: false }).limit(25);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  let countQuery = supabase.from("ledscores_goal_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("detected_at", since);
  if (connectionId) { mappingQuery = mappingQuery.eq("connection_id", connectionId); eventQuery = eventQuery.eq("connection_id", connectionId); countQuery = countQuery.eq("connection_id", connectionId); }
  const [mappings, sportsTeams, events, eventCount, screens, devices, sportsClubs] = await Promise.all([
    creating ? Promise.resolve({ data: [], error: null }) : mappingQuery,
    supabase.from("sports_teams").select("id,name").eq("tenant_id", tenantId).eq("active", true).order("name").limit(250),
    creating ? Promise.resolve({ data: [], error: null }) : eventQuery,
    creating ? Promise.resolve({ data: [], count: 0, error: null }) : countQuery,
    creating ? Promise.resolve({ data: [], error: null }) : supabase.from("screens").select("id,name,status,deleted_at").eq("tenant_id", tenantId).order("name").limit(500),
    creating ? Promise.resolve({ data: [], error: null }) : supabase.from("player_devices").select("screen_id,status,platform,app_version,last_seen_at").eq("tenant_id", tenantId).order("last_seen_at", { ascending: false }).limit(500),
    supabase.from("sports_clubs").select("id,name").eq("tenant_id", tenantId).eq("active", true).order("name")
  ]);
  const coreError = [connections.error, mappings.error, sportsTeams.error, sportsClubs.error, events.error, eventCount.error].find(Boolean);
  if (coreError) {
    console.error("LED Scores-beheer laden mislukt", { code: coreError.code });
    return { ...emptyLedSourceData(), enabled: true, loadError: true };
  }
  const diagnosticsError = [screens.error, devices.error].find(Boolean);
  if (diagnosticsError) {
    console.error("LED Scores-schermdiagnostiek laden mislukt", { code: diagnosticsError.code });
  }

  const eventIds = (events.data ?? []).map((event) => event.id);
  const deliveryLimit = 2_500;
  const deliveries = eventIds.length
    ? await supabase
      .from("ledscores_player_deliveries")
      .select("id,goal_event_id,screen_id,status,execute_at,expires_at,dispatched_at,received_at,rendered_at,skipped_at,failed_at,outcome_detail,created_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("message_kind", "goal")
      .in("goal_event_id", eventIds)
      .order("created_at", { ascending: false })
      .limit(deliveryLimit)
    : { count: 0, data: [] as LedScoresDelivery[], error: null };
  if (deliveries.error) {
    console.error("LED Scores-afleverdetails laden mislukt", { code: deliveries.error.code });
  }
  const deliveryRows = deliveries.error
    ? []
    : (deliveries.data ?? []) as LedScoresDelivery[];
  return {
    availability: "available" as const,
    sportsClubs: sportsClubs.data ?? [], connections: connections.data ?? [], deliveries: deliveryRows,
    deliveriesTruncated: (deliveries.count ?? 0) > deliveryRows.length,
    devices: (devices.error ? [] : devices.data ?? []) as LedScoresDevice[],
    enabled: true, eventCount: eventCount.count ?? 0, events: events.data ?? [],
    loadError: Boolean(diagnosticsError || deliveries.error),
    mappings: mappings.data ?? [],
    screens: (screens.error ? [] : screens.data ?? []) as LedScoresScreen[],
    sportsTeams: sportsTeams.data ?? []
  };
}

export function emptyLedSourceData() { return { availability: "not_released" as LedScoresFeatureAvailability, connections: [], deliveries: [] as LedScoresDelivery[], deliveriesTruncated: false, devices: [] as LedScoresDevice[], enabled: false, eventCount: 0, events: [], loadError: false, mappings: [], screens: [] as LedScoresScreen[], sportsTeams: [], sportsClubs: [] as { id: string; name: string }[] }; }
