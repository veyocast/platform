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

export type OperationalSource = {
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

  return {
    activePlaybackCount,
    onboarding: [
      step("organization", "Organisatie actief", true, "/dashboard/settings"),
      step("team", "Team ingericht", source.memberCount > 1, "/dashboard/team"),
      step("media", "Eerste media gereed", readyMediaCount > 0, "/dashboard/media"),
      step("playlist", "Playlist met content", playlistsWithItems.size > 0, "/dashboard/playlists"),
      step("release", "Eerste release gepubliceerd", source.releases.length > 0, "/dashboard/releases"),
      step("screen", "Eerste scherm aangemaakt", source.screens.length > 0, "/dashboard/screens/new"),
      step("paired", "Player gekoppeld", pairedDevices.length > 0, "/dashboard/screens"),
      step("playback", "Actieve playback bevestigd", activePlaybackCount > 0, "/dashboard/screens")
    ],
    onlineScreenCount: source.screens.filter((screen) => {
      const device = devicesByScreen.get(screen.id);
      return screen.status === "active" && Boolean(device?.last_seen_at) && nowMs - timestamp(device?.last_seen_at ?? null) < offlineAfterMs;
    }).length,
    processingMediaCount: source.media.filter((asset) => ["uploading", "processing"].includes(asset.status)).length,
    readyMediaCount,
    signals: signals.sort(compareSignals)
  };
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
