import "server-only";
import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadSportlinkSourceData } from "../data-sources/sportlink/source-data.server";
import { loadLedSourceData } from "../data-sources/led-scores/source-data.server";
import { loadYouTubeWorkspace } from "../integrations/youtube/data";
import { sourceOverviewErrorCopy, sourceOverviewHealth, sourceOverviewLedHealth, sourceOverviewSportlinkHealth, parseSourceSelection, type SourceDetail, type SourceSelection } from "./sites-sources-model";

export type SourceDetailLoad = {
  selection: SourceSelection; detail: SourceDetail | null; failed: boolean;
  sportlink?: Awaited<ReturnType<typeof loadSportlinkSourceData>>;
  led?: Awaited<ReturnType<typeof loadLedSourceData>>;
  youtube?: Awaited<ReturnType<typeof loadYouTubeWorkspace>>;
};

/** No provider request, secret config or write belongs to opening a source. */
export async function loadSourceDetail(selection: SourceSelection | null): Promise<SourceDetailLoad | null> {
  if (!selection || !parseSourceSelection(selection.mode === "detail" ? { source: `${selection.provider}:${selection.id}` } : { connect: selection.provider })) return null;
  const session = await requireTenantControlSession("tenant.data_source.read");
  const unavailable: SourceDetailLoad = { selection, detail: null, failed: true };
  if (!session.isLive || !session.tenantId) return unavailable;
  const tenantId = session.tenantId;
  try {
    if (selection.provider === "sportlink") {
      const sportlink = await loadSportlinkSourceData(tenantId, selection.mode === "detail" ? selection.id : undefined);
      if (selection.mode === "create") return { selection, detail: null, failed: false, sportlink };
      if (!sportlink || sportlink.connection.id !== selection.id) return unavailable;
      const connection = sportlink.connection;
      return { selection, sportlink, failed: false, detail: {
        id: connection.id, provider: "sportlink", name: connection.detected_club_name ?? "Sportlink", status: connection.status,
        health: sourceOverviewSportlinkHealth(connection, sportlink.policies, sportlink.policiesUnavailable),
        lastSuccessAt: connection.last_success_at, lastAttemptAt: connection.last_tested_at,
        itemCount: null, truncated: false,
        fields: [{ label: "Vereniging", value: connection.detected_club_name ?? "Nog onbekend" }, { label: "Client ID", value: `•••• ${connection.client_id_suffix}` }, { label: "Geselecteerde teams", value: String(connection.selected_team_codes.length) }],
        items: sportlink.policies.map(policy => ({ id: policy.id, title: datasetName(policy.dataset_group), detail: policy.enabled ? "Synchronisatiebeleid ingeschakeld" : "Synchronisatiebeleid gepauzeerd" }))
      } };
    }
    if (selection.provider === "led") {
      const led = await loadLedSourceData(tenantId, selection.mode === "detail" ? selection.id : null);
      if (selection.mode === "create") return { selection, detail: null, failed: led.loadError, led };
      const connection = led.connections.find(item => item.id === selection.id);
      if (!connection) return unavailable;
      return { selection, led, failed: led.loadError, detail: {
        id: connection.id, provider: "led", name: connection.name, status: connection.status,
        health: sourceOverviewLedHealth([connection]), lastSuccessAt: connection.last_source_message_at,
        lastAttemptAt: connection.last_test_at, itemCount: led.eventCount, truncated: led.deliveriesTruncated,
        fields: [{ label: "Scorebord / veld", value: connection.scoreboard_label }, { label: "Clubslug", value: connection.club_slug }],
        items: led.events.map(event => ({ id: event.id, title: `${event.home_team} ${event.home_score}–${event.away_score} ${event.away_team}`, detail: event.event_kind === "synthetic_test" ? "Expliciete verbindingstest" : "Geregistreerd goal-event" }))
      } };
    }
    if (selection.provider === "youtube") {
      const youtube = await loadYouTubeWorkspace(tenantId, selection.mode === "detail" ? selection.id : null);
      if (selection.mode === "create") return { selection, detail: null, failed: youtube.failed, youtube };
      const source = youtube.sources.find(item => item.id === selection.id);
      if (!source) return unavailable;
      const videoCount = source.playlist_id ? (Array.isArray(source.playlist_video_ids) ? source.playlist_video_ids.length : null) : 1;
      return { selection, youtube, failed: youtube.failed, detail: {
        id: source.id, provider: "youtube", name: source.title, status: source.status,
        health: source.status === "paused" ? { label: "Gepauzeerd", tone: "neutral" } : source.validation_status === "verified" && source.embeddable ? { label: "Gevalideerd · online", tone: "success" } : { label: "Validatie nodig", tone: "warning" },
        lastSuccessAt: null, lastAttemptAt: null, itemCount: videoCount, truncated: false,
        fields: [{ label: "Type", value: source.playlist_id ? "YouTube-playlist" : "Losse video" }, { label: "Kanaal", value: source.channel_title ?? "Onbekend" }, { label: "Lokale back-up", value: youtube.assets.find(asset => asset.id === source.fallback_media_asset_id)?.title ?? "Niet beschikbaar" }],
        items: [{ id: source.id, title: source.title, detail: source.playlist_id ? videoCount === null ? "De opgeslagen playlistsamenstelling is niet beschikbaar." : `${videoCount} beschikbare video’s · ${source.playlist_unavailable_count} niet beschikbaar` : "Officiële online playback met gekozen lokale back-up" }]
      } };
    }
    if (selection.mode === "create") return { selection, detail: null, failed: false };
    const client = await createControlSupabaseClient();
    if (!client) return unavailable;
    const result = await client.from("dynamic_data_sources")
      .select("id,name,kind,status,provider_status,last_successful_sync_at,last_error_code,config_json")
      .eq("tenant_id", tenantId).eq("id", selection.id).neq("status", "archived").maybeSingle();
    const source = result.data;
    if (result.error || !source || (selection.provider === "rss" ? source.kind !== "rss" : !["manual_products", "twelve_excel"].includes(source.kind))) return unavailable;
    const config = source.config_json && typeof source.config_json === "object" && !Array.isArray(source.config_json) ? source.config_json as Record<string, unknown> : {};
    const refreshMinutes = typeof config.refreshMinutes === "number" && Number.isFinite(config.refreshMinutes) && config.refreshMinutes >= 1 && config.refreshMinutes <= 1440 ? config.refreshMinutes : null;
    const detail: SourceDetail = {
      id: source.id, name: source.name, provider: selection.provider, status: source.status,
      health: sourceOverviewHealth({ ...source, refreshMinutes }),
      issue: source.last_error_code ? sourceOverviewErrorCopy(source.last_error_code) : null,
      lastSuccessAt: source.last_successful_sync_at, lastAttemptAt: null, itemCount: null,
      items: [], truncated: false, fields: [{ label: "Bronnaam", value: source.name }]
    };
    if (selection.provider === "rss") {
      const [articles, run] = await Promise.all([
        client.from("dynamic_news_articles").select("id,title,intro,canonical_link,link,published_at", { count: "exact" }).eq("tenant_id", tenantId).eq("data_source_id", source.id).order("published_at", { ascending: false }).order("id").limit(100),
        client.from("dynamic_sync_runs").select("started_at").eq("tenant_id", tenantId).eq("data_source_id", source.id).order("started_at", { ascending: false }).limit(1).maybeSingle()
      ]);
      detail.lastAttemptAt = run.data?.started_at ?? null;
      detail.itemCount = articles.error ? null : articles.count;
      detail.items = (articles.data ?? []).map(article => ({ id: article.id, title: article.title, detail: article.intro ?? "Opgeslagen nieuwsartikel", ...(safeLink(article.canonical_link || article.link) ? { href: safeLink(article.canonical_link || article.link)! } : {}) }));
      detail.truncated = (articles.count ?? 0) > detail.items.length;
      const feed = safeLink(config.url);
      if (feed) { const url = new URL(feed); url.search = ""; url.hash = ""; detail.fields.push({ label: "Publieke feed-URL", value: url.href }); }
      detail.fields.push({ label: "Automatisch verversen", value: refreshMinutes ? `Elke ${refreshMinutes} minuten` : "Frequentie niet beschikbaar" });
      return { selection, detail, failed: Boolean(articles.error || run.error) };
    }
    detail.fields.push({ label: "Bronsoort", value: source.kind === "twelve_excel" ? "Twelve Excel-export" : "Handmatige producten" });
    if (hasCapability(session.capabilities, "tenant.product.read")) {
      const products = await client.from("tenant_products").select("id,name,category,price_cents,currency,available", { count: "exact" }).eq("tenant_id", tenantId).eq("data_source_id", source.id).eq("active", true).order("name").limit(100);
      detail.itemCount = products.error ? null : products.count;
      detail.items = (products.data ?? []).map(product => ({ id: product.id, title: product.name, detail: `${product.category ?? "Zonder categorie"} · ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: product.currency }).format(product.price_cents / 100)} · ${product.available ? "Beschikbaar" : "Niet beschikbaar"}` }));
      detail.truncated = (products.count ?? 0) > detail.items.length;
      return { selection, detail, failed: Boolean(products.error) };
    }
    return { selection, detail, failed: false };
  } catch { return unavailable; }
}

function safeLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function datasetName(group: string) {
  const names: Record<string, string> = { matches: "Programma en uitslagen", match_details: "Wedstrijddetails", competitions: "Competities en standen", teams: "Teams", club_profile: "Clubprofiel", activities: "Clubactiviteiten", public_people: "Publieke personen", volunteers: "Vrijwilligers", birthdays: "Verjaardagen" };
  return names[group] ?? "Overige clubgegevens";
}
