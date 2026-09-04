export type OperationalSignal = {
  ageLabel: string;
  cause: string;
  effect: string;
  href: string;
  id: string;
  label: string;
  occurredAt: string;
  recovery: string;
  resource: string;
  severity: "critical" | "warning" | "info";
};

export type OnboardingStep = {
  complete: boolean;
  href: string;
  id: string;
  label: string;
};

export type OperationalStateId =
  | "loading"
  | "empty-unconfigured"
  | "healthy"
  | "degraded"
  | "partial-error"
  | "full-error"
  | "stale"
  | "offline"
  | "unknown";

export type OperationalState = Readonly<{
  cause: string | null;
  effect: string;
  id: OperationalStateId;
  label: string;
  recovery: string;
  title: string;
  tone: "critical" | "info" | "neutral" | "success" | "warning";
  unavailable: readonly string[];
}>;

export type OperationalDataAvailability = Readonly<{
  audit: boolean;
  devices: boolean;
  integrations: boolean;
  media: boolean;
  members: boolean;
  playlists: boolean;
  screens: boolean;
  telemetry: boolean;
  tenant: boolean;
}>;

export type OperationalSource = {
  availability?: OperationalDataAvailability;
  devices: Array<{
    active_release_id: string | null;
    desired_release_id: string | null;
    id: string;
    last_error_at: string | null;
    last_error_code: string | null;
    last_seen_at: string | null;
    screen_id: string;
    status: string;
    storage_quota_bytes: number | string | null;
    storage_used_bytes: number | string | null;
  }>;
  heartbeats: Array<{
    active_release_id: string | null;
    created_at: string;
    runtime_state: string;
    screen_id: string;
  }>;
  integrations: {
    dynamicSources: Array<{
      id: string;
      kind: string;
      last_attempt_at: string | null;
      last_error_code: string | null;
      last_successful_sync_at: string | null;
      name: string;
      provider_status: string;
      status: string;
    }>;
    sportlinkConnections: Array<{
      detected_club_name: string | null;
      id: string;
      last_attempt_at: string | null;
      last_error_code: string | null;
      last_success_at: string | null;
      stale_after: string | null;
      status: string;
    }>;
  };
  invitations: Array<{
    email: string;
    expires_at: string;
    id: string;
    status: string;
  }>;
  media: Array<{
    created_at: string;
    id: string;
    status: string;
    title: string;
    validation_error: string | null;
  }>;
  memberCount: number;
  playlistItems: Array<{ media_asset_id: string; playlist_id: string }>;
  playlists: Array<{
    id: string;
    name: string;
    status: string;
    updated_at: string;
  }>;
  releases: Array<{
    id: string;
    playlist_id: string;
    published_at: string;
    version: number;
  }>;
  screenLimit: number;
  screens: Array<{
    assigned_release_id: string | null;
    created_at: string;
    id: string;
    name: string;
    status: string;
  }>;
};

const offlineAfterMs = 5 * 60_000;
const syncTimeoutMs = 15 * 60_000;
const invitationWarningMs = 72 * 60 * 60_000;
const completeAvailability = {
  audit: true,
  devices: true,
  integrations: true,
  media: true,
  members: true,
  playlists: true,
  screens: true,
  telemetry: true,
  tenant: true
} satisfies OperationalDataAvailability;

export function deriveOperationalDashboard(
  source: OperationalSource,
  now = new Date()
) {
  const nowMs = now.getTime();
  const devicesByScreen = new Map(
    source.devices
      .filter((device) => device.status === "paired")
      .map((device) => [device.screen_id, device])
  );
  const mediaById = new Map(source.media.map((asset) => [asset.id, asset]));
  const signals: OperationalSignal[] = [];

  for (const screen of source.screens.filter((item) => item.status === "active")) {
    const device = devicesByScreen.get(screen.id);
    if (!device) continue;
    const lastSeenMs = timestamp(device.last_seen_at);
    const offline = !lastSeenMs || nowMs - lastSeenMs >= offlineAfterMs;

    if (offline) {
      signals.push(signal({
        cause: device.last_seen_at
          ? `De laatste heartbeat van ${screen.name} is ouder dan vijf minuten.`
          : `${screen.name} heeft nog geen heartbeat verzonden.`,
        effect: "Nieuwe publicaties en actuele playerstatus kunnen niet worden bevestigd; een geldige lokale release blijft spelen.",
        href: `/dashboard/screens/${screen.id}`,
        id: `screen-offline:${screen.id}`,
        label: "Scherm offline",
        occurredAt: device.last_seen_at ?? screen.created_at,
        recovery: "Controleer voeding en netwerk op locatie en open daarna de schermdiagnose.",
        resource: screen.name,
        severity: nowMs - (lastSeenMs || timestamp(screen.created_at)) >= 60 * 60_000 ? "critical" : "warning"
      }, nowMs));
    }

    if (
      device.desired_release_id &&
      device.desired_release_id !== device.active_release_id &&
      (!lastSeenMs || nowMs - lastSeenMs >= syncTimeoutMs)
    ) {
      signals.push(signal({
        cause: `${screen.name} heeft de gewenste release na vijftien minuten nog niet actief gemeld.`,
        effect: "De last-known-good release blijft actief en de nieuwe release wordt niet voortijdig geschakeld.",
        href: `/dashboard/screens/${screen.id}`,
        id: `sync-timeout:${screen.id}`,
        label: "Synchronisatie duurt te lang",
        occurredAt: device.last_seen_at ?? screen.created_at,
        recovery: "Bekijk de synchronisatiegebeurtenissen en vraag alleen na diagnose een veilige retry aan.",
        resource: screen.name,
        severity: "warning"
      }, nowMs));
    }

    if (device.last_error_code) {
      signals.push(signal({
        cause: `De Player rapporteerde foutcode ${device.last_error_code}.`,
        effect: "Playback kan op de geldige lokale release doorgaan, maar de gewenste toestand is niet bevestigd.",
        href: `/dashboard/screens/${screen.id}`,
        id: `player-error:${screen.id}:${device.last_error_code}`,
        label: "Playerfout onderzoeken",
        occurredAt: device.last_error_at ?? device.last_seen_at ?? screen.created_at,
        recovery: "Open de schermdiagnose, controleer oorzaak en herstelactie en verifieer daarna een nieuwe heartbeat.",
        resource: screen.name,
        severity: "critical"
      }, nowMs));
    }

    const used = Number(device.storage_used_bytes ?? 0);
    const quota = Number(device.storage_quota_bytes ?? 0);
    if (quota > 0 && used / quota >= 0.85) {
      signals.push(signal({
        cause: `${screen.name} gebruikt ${Math.round((used / quota) * 100)}% van de gemelde lokale opslag.`,
        effect: "Een volgende complete release kan mogelijk niet veilig naast de actieve release worden gedownload.",
        href: `/dashboard/screens/${screen.id}`,
        id: `storage-pressure:${screen.id}`,
        label: "Lokale opslag bijna vol",
        occurredAt: device.last_seen_at ?? screen.created_at,
        recovery: "Controleer de playeropslag en verklein de volgende release voordat je opnieuw publiceert.",
        resource: screen.name,
        severity: used / quota >= 0.95 ? "critical" : "warning"
      }, nowMs));
    }
  }

  for (const asset of source.media.filter((item) => item.status === "validation_failed")) {
    signals.push(signal({
      cause: asset.validation_error
        ? `De uploadvalidatie stopte met reden ${asset.validation_error}.`
        : "Het mediabestand kon niet veilig worden gevalideerd.",
      effect: "Het bestand is niet inzetbaar in een publiceerbare playlist.",
      href: `/dashboard/media?asset=${asset.id}&status=validation_failed`,
      id: `media-failed:${asset.id}`,
      label: "Mediaverwerking mislukt",
      occurredAt: asset.created_at,
      recovery: "Open het mediabestand, controleer formaat en limieten en upload een geldige bron of start een toegestane retry.",
      resource: asset.title,
      severity: "critical"
    }, nowMs));
  }

  for (const playlist of source.playlists.filter((item) => item.status !== "archived")) {
    const items = source.playlistItems.filter((item) => item.playlist_id === playlist.id);
    const blockedItems = items.filter((item) => mediaById.get(item.media_asset_id)?.status !== "ready");
    if (items.length === 0 || blockedItems.length > 0) {
      signals.push(signal({
        cause: items.length === 0
          ? "De playlist bevat nog geen items."
          : `${blockedItems.length} playlistitem${blockedItems.length === 1 ? "" : "s"} verwijst naar media die niet gereed is.`,
        effect: "Er kan geen volledige, immutable release voor deze playlist worden gepubliceerd.",
        href: `/dashboard/playlists/${playlist.id}`,
        id: `playlist-blocked:${playlist.id}`,
        label: "Playlist niet publiceerbaar",
        occurredAt: playlist.updated_at,
        recovery: "Open Playlist Studio, voeg gereed materiaal toe of vervang geblokkeerde items en voer de preflight opnieuw uit.",
        resource: playlist.name,
        severity: "warning"
      }, nowMs));
    }
  }

  for (const invitation of source.invitations.filter((item) => item.status === "pending")) {
    const expiresMs = timestamp(invitation.expires_at);
    if (expiresMs > nowMs && expiresMs - nowMs <= invitationWarningMs) {
      signals.push(signal({
        cause: `De uitnodiging verloopt ${relativeAge(invitation.expires_at, nowMs, true)}.`,
        effect: "De genodigde kan na het verloopmoment niet meer toetreden met deze link.",
        href: "/dashboard/team?status=pending",
        id: `invitation-expiry:${invitation.id}`,
        label: "Uitnodiging verloopt bijna",
        occurredAt: new Date(expiresMs - invitationWarningMs).toISOString(),
        recovery: "Controleer het e-mailadres en verstuur vanuit Team alleen indien nodig een nieuwe uitnodiging.",
        resource: invitation.email,
        severity: "info"
      }, nowMs));
    }
  }

  for (const integration of source.integrations.dynamicSources) {
    if (integration.status === "error" || integration.provider_status === "error") {
      signals.push(signal({
        cause: integration.last_error_code
          ? `${integration.name} meldt foutcode ${integration.last_error_code}.`
          : `${integration.name} meldt een providerfout.`,
        effect: "Bestaande snapshots blijven beschikbaar, maar nieuwe brondata is niet bevestigd.",
        href: "/dashboard/sources",
        id: `integration-error:${integration.id}`,
        label: "Integratie vraagt aandacht",
        occurredAt: integration.last_attempt_at ?? integration.last_successful_sync_at ?? now.toISOString(),
        recovery: "Open de databron, controleer de oorzaak en start pas daarna een toegestane retry.",
        resource: integration.name,
        severity: "critical"
      }, nowMs));
    }
  }
  for (const connection of source.integrations.sportlinkConnections) {
    const staleAt = timestamp(connection.stale_after);
    const stale = staleAt > 0 && staleAt <= nowMs;
    if (connection.status === "error" || connection.last_error_code || stale) {
      signals.push(signal({
        cause: connection.last_error_code
          ? `Sportlink meldt foutcode ${connection.last_error_code}.`
          : stale
            ? "De laatste succesvolle Sportlink-sync is ouder dan de ingestelde versheidsgrens."
            : "De Sportlink-verbinding staat in foutstatus.",
        effect: "Schermen gebruiken de laatst geldige snapshot; actuele programma- of uitslagdata kan ontbreken.",
        href: "/dashboard/sources/sportlink",
        id: `sportlink-health:${connection.id}`,
        label: stale ? "Sportlink-data is verouderd" : "Sportlink-sync mislukt",
        occurredAt: connection.last_attempt_at ?? connection.last_success_at ?? now.toISOString(),
        recovery: "Controleer de verbinding en syncstatus, herstel de oorzaak en verifieer een nieuwe succesvolle sync.",
        resource: connection.detected_club_name ?? "Sportlink",
        severity: connection.status === "error" || connection.last_error_code ? "critical" : "warning"
      }, nowMs));
    }
  }

  if (source.screenLimit > 0 && source.screens.length / source.screenLimit >= 0.8) {
    signals.push(signal({
      cause: `${source.screens.length} van de ${source.screenLimit} beschikbare schermplaatsen zijn in gebruik.`,
      effect: source.screens.length >= source.screenLimit
        ? "Er kan geen extra scherm worden toegevoegd binnen de huidige limiet."
        : "De resterende ruimte voor nieuwe schermen is beperkt.",
      href: "/dashboard/settings",
      id: "tenant-screen-quota",
      label: "Schermlimiet nadert",
      occurredAt: source.screens.at(-1)?.created_at ?? now.toISOString(),
      recovery: "Controleer ongebruikte schermen of bespreek een passende limiet voordat je verder uitrolt.",
      resource: "Verenigingslimiet",
      severity: source.screens.length >= source.screenLimit ? "critical" : "info"
    }, nowMs));
  }

  const latestHeartbeats = new Map<string, OperationalSource["heartbeats"][number]>();
  for (const heartbeat of source.heartbeats) {
    if (!latestHeartbeats.has(heartbeat.screen_id)) latestHeartbeats.set(heartbeat.screen_id, heartbeat);
  }
  const pairedDevices = source.devices.filter((device) => device.status === "paired");
  const activePlaybackCount = [...latestHeartbeats.values()].filter((heartbeat) =>
    heartbeat.active_release_id &&
    ["PLAYING", "OFFLINE_PLAYING", "READY"].includes(heartbeat.runtime_state) &&
    nowMs - timestamp(heartbeat.created_at) < offlineAfterMs
  ).length;
  const readyMediaCount = source.media.filter((asset) => asset.status === "ready").length;
  const playlistsWithItems = new Set(source.playlistItems.map((item) => item.playlist_id));
  const integrationHealth = deriveIntegrationHealth(source.integrations, nowMs);
  const onlineScreenCount = source.screens.filter((screen) => {
    const device = devicesByScreen.get(screen.id);
    return screen.status === "active" && Boolean(device?.last_seen_at) && nowMs - timestamp(device?.last_seen_at ?? null) < offlineAfterMs;
  }).length;
  const sortedSignals = signals.sort(compareSignals);
  const status = deriveOperationalState({
    activePlaybackCount,
    availability: source.availability ?? completeAvailability,
    integrationHealth,
    onlineScreenCount,
    pairedDeviceCount: pairedDevices.length,
    signals: sortedSignals,
    source
  });

  return {
    activePlaybackCount,
    integrationHealth,
    onboarding: [
      step("organization", "Organisatie actief", true, "/dashboard/settings"),
      step("team", "Team ingericht", source.memberCount > 1, "/dashboard/team"),
      step("media", "Eerste media gereed", readyMediaCount > 0, "/dashboard/media"),
      step("playlist", "Playlist met content", playlistsWithItems.size > 0, "/dashboard/playlists"),
      step("release", "Eerste release gepubliceerd", source.releases.length > 0, "/dashboard/publications"),
      step("screen", "Eerste scherm aangemaakt", source.screens.length > 0, "/dashboard/screens/new"),
      step("paired", "Player gekoppeld", pairedDevices.length > 0, "/dashboard/screens"),
      step("playback", "Actieve playback bevestigd", activePlaybackCount > 0, "/dashboard/screens")
    ],
    onlineScreenCount,
    processingMediaCount: source.media.filter((asset) => ["uploading", "processing"].includes(asset.status)).length,
    readyMediaCount,
    signals: sortedSignals,
    status
  };
}

function deriveIntegrationHealth(
  integrations: OperationalSource["integrations"],
  nowMs: number
) {
  const sourceErrors = integrations.dynamicSources.filter((source) =>
    source.status === "error" || source.provider_status === "error"
  ).length;
  const sportlinkErrors = integrations.sportlinkConnections.filter((connection) =>
    connection.status === "error" || Boolean(connection.last_error_code)
  ).length;
  const stale = integrations.sportlinkConnections.filter((connection) => {
    const staleAt = timestamp(connection.stale_after);
    return staleAt > 0 && staleAt <= nowMs;
  }).length;
  const total = integrations.dynamicSources.length + integrations.sportlinkConnections.length;
  return {
    errorCount: sourceErrors + sportlinkErrors,
    staleCount: stale,
    status: sourceErrors + sportlinkErrors > 0
      ? "error" as const
      : stale > 0
        ? "stale" as const
        : total > 0
          ? "fresh" as const
          : "disabled" as const,
    total
  };
}


function deriveOperationalState({
  activePlaybackCount,
  availability,
  integrationHealth,
  onlineScreenCount,
  pairedDeviceCount,
  signals,
  source
}: {
  activePlaybackCount: number;
  availability: OperationalDataAvailability;
  integrationHealth: ReturnType<typeof deriveIntegrationHealth>;
  onlineScreenCount: number;
  pairedDeviceCount: number;
  signals: readonly OperationalSignal[];
  source: OperationalSource;
}): OperationalState {
  const unavailable = Object.entries(availability)
    .filter(([, available]) => !available)
    .map(([domain]) => domain);

  if (unavailable.length === Object.keys(availability).length) {
    return operationalState(
      "full-error",
      "critical",
      "Niet beschikbaar",
      "De actuele status kan niet worden vastgesteld",
      "Geen operationele waarde kan nu veilig worden bevestigd.",
      "Vernieuw de pagina of meld je opnieuw aan. Blijft dit zo, open dan Support.",
      unavailable,
      "Alle statusbronnen konden niet worden geladen."
    );
  }

  if (unavailable.length > 0) {
    return operationalState(
      "partial-error",
      "critical",
      "Deels beschikbaar",
      "Een deel van de actuele status ontbreekt",
      "Getroffen waarden staan op —; geldige deeldata blijft zichtbaar.",
      "Vernieuw de pagina. Blijft een bron ontbreken, open dan Support met de genoemde onderdelen.",
      unavailable,
      `Niet geladen: ${unavailable.map(domainLabel).join(", ")}.`
    );
  }

  if (source.screens.length === 0) {
    return operationalState(
      "empty-unconfigured",
      "info",
      "Nog inrichten",
      "Koppel je eerste scherm",
      "Zonder scherm kan geen live playback of bereikbaarheid worden bevestigd.",
      "Maak een scherm aan, koppel de Player en publiceer daarna de eerste release.",
      unavailable
    );
  }

  if (pairedDeviceCount > 0 && onlineScreenCount === 0) {
    return operationalState(
      "offline",
      "critical",
      "Offline",
      "Geen gekoppeld scherm meldt zich online",
      "De laatst geldige lokale release kan blijven spelen, maar nieuwe publicaties zijn niet bevestigd.",
      "Controleer voeding en netwerk op locatie en open daarna Schermgezondheid.",
      unavailable
    );
  }

  if (integrationHealth.status === "stale") {
    return operationalState(
      "stale",
      "warning",
      "Verouderde data",
      "Een bron is niet meer actueel",
      "Schermen kunnen de laatst geldige snapshot tonen terwijl nieuwe brondata ontbreekt.",
      "Open Bronnen, herstel de sync en controleer het tijdstip van de volgende bevestiging.",
      unavailable
    );
  }

  if (signals.some((item) => item.severity === "critical" || item.severity === "warning")) {
    return operationalState(
      "degraded",
      "warning",
      "Aandacht nodig",
      "De omgeving werkt met aandachtspunten",
      "Geldige playback blijft waar mogelijk actief; één of meer onderdelen vragen herstel.",
      "Open het belangrijkste signaal en volg de genoemde herstelactie.",
      unavailable,
      signals[0]?.cause ?? null
    );
  }

  if (pairedDeviceCount === 0 || activePlaybackCount === 0) {
    return operationalState(
      "unknown",
      "neutral",
      "Nog niet bevestigd",
      "Playbackstatus is nog onbekend",
      pairedDeviceCount === 0
        ? "Er is wel een scherm ingericht, maar nog geen gekoppelde Player die actuele status kan melden."
        : "De Player is gekoppeld, maar actuele playback is nog niet bevestigd.",
      pairedDeviceCount === 0
        ? "Open Schermen en rond de veilige koppeling af."
        : "Open Schermgezondheid en controleer heartbeat, actieve release en runtime-status.",
      unavailable
    );
  }

  return operationalState(
    "healthy",
    "success",
    "Actueel",
    "De omgeving is operationeel",
    "Scherm-, publicatie- en bronstatus zijn met actuele gegevens bevestigd.",
    "Er is nu geen herstelactie nodig.",
    unavailable
  );
}

function operationalState(
  id: OperationalStateId,
  tone: OperationalState["tone"],
  label: string,
  title: string,
  effect: string,
  recovery: string,
  unavailable: readonly string[],
  cause: string | null = null
): OperationalState {
  return { cause, effect, id, label, recovery, title, tone, unavailable };
}

function domainLabel(domain: string) {
  return ({
    audit: "activiteit",
    devices: "Playerstatus",
    integrations: "bronnen",
    media: "media",
    members: "team",
    playlists: "playlists en publicaties",
    screens: "schermen",
    telemetry: "telemetrie",
    tenant: "organisatielimieten"
  } as Record<string, string>)[domain] ?? domain;
}
function signal(
  value: Omit<OperationalSignal, "ageLabel">,
  nowMs: number
): OperationalSignal {
  return { ...value, ageLabel: relativeAge(value.occurredAt, nowMs) };
}

function step(id: string, label: string, complete: boolean, href: string): OnboardingStep {
  return { complete, href, id, label };
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function relativeAge(value: string, nowMs: number, future = false) {
  const difference = Math.max(0, future ? timestamp(value) - nowMs : nowMs - timestamp(value));
  const minutes = Math.max(1, Math.round(difference / 60_000));
  if (minutes < 60) return future ? `over ${minutes} min` : `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `over ${hours} uur` : `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  return future ? `over ${days} dagen` : `${days} dagen geleden`;
}

function compareSignals(left: OperationalSignal, right: OperationalSignal) {
  const weight = { critical: 3, warning: 2, info: 1 } as const;
  return weight[right.severity] - weight[left.severity]
    || timestamp(left.occurredAt) - timestamp(right.occurredAt);
}
