import Link from "next/link";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  HealthList,
  MetricCard,
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";
import { claimScreenPairing, createScreen } from "./actions";

type ScreensPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type ScreenRow = {
  assigned_playlist_id: string | null;
  assigned_release_id: string | null;
  id: string;
  location: string | null;
  name: string;
  orientation: string;
  status: string;
};

type DeviceRow = {
  active_release_id: string | null;
  desired_release_id: string | null;
  device_name: string | null;
  id: string;
  last_seen_at: string | null;
  screen_id: string;
  storage_quota_bytes: number | null;
  storage_used_bytes: number | null;
};

type PlaylistRow = { id: string; name: string };

const pairingChecks = [
  {
    detail: "De code verloopt na tien minuten en wordt alleen als SHA-256-hash bewaard.",
    label: "Koppelcode",
    status: "Tijdelijk",
    tone: "info"
  },
  {
    detail: "Alleen tenant- of platformbeheerders kunnen een Player claimen.",
    label: "Bevestiging",
    status: "Server-side",
    tone: "success"
  },
  {
    detail: "Een nieuwe release wordt pas actief nadat alle assets zijn geverifieerd.",
    label: "Eerste synchronisatie",
    status: "Atomair",
    tone: "success"
  }
] as const;

const deviceLifecycle = [
  {
    detail: "Open de HTTPS Player-URL op het LG-scherm en neem de zes tekens over.",
    label: "Code tonen",
    meta: "10 min",
    tone: "info"
  },
  {
    detail: "Kies het vooraf aangemaakte scherm en bevestig de fysieke Player bewust.",
    label: "Player koppelen",
    meta: "Beheerder",
    tone: "success"
  },
  {
    detail: "Publiceer content; de Player wisselt pas na volledige download en verificatie.",
    label: "Release voorbereiden",
    meta: "Last-known-good",
    tone: "success"
  }
] as const;

export default async function ScreensPage({ searchParams }: ScreensPageProps) {
  const session = await requireControlSession();
  const { fout, succes } = await searchParams;
  const canManage = session.roles.some((role) =>
    ["platform_owner", "platform_admin", "tenant_owner", "tenant_admin"].includes(role)
  );
  const data = await loadScreens(session.tenantId, session.isLive);
  const devicesByScreen = new Map(data.devices.map((device) => [device.screen_id, device]));
  const playlistNames = new Map(data.playlists.map((playlist) => [playlist.id, playlist.name]));
  const statuses = data.screens.map((screen) => screenStatus(screen, devicesByScreen.get(screen.id)));
  const online = statuses.filter((status) => status.kind === "online").length;
  const syncing = statuses.filter((status) => status.kind === "syncing").length;
  const attention = statuses.filter((status) => !["online", "syncing"].includes(status.kind)).length;

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-link button-link--secondary" href="/dashboard/playlists">
              Releases bekijken
            </Link>
            <a className="button-link button-link--primary" href="#pairing-title">
              Player koppelen
            </a>
          </>
        }
        description="Beheer de echte schermvloot, volg actieve en gewenste releases en koppel LG-players met een tijdelijke code."
        eyebrow={session.tenant}
        status={{
          label: session.isLive ? "Live tenantdata" : "Demomodus zonder mutaties",
          tone: session.isLive ? "success" : "warning"
        }}
        title="Schermen"
      />

      {fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Actie mislukt.</strong> {fout}
        </p>
      ) : null}
      {succes ? <p className="notice notice--success" role="status">{succes}</p> : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Deze pagina toont bewust geen fictieve schermen. Configureer Supabase en log in om een
          scherm aan te maken of een Player te koppelen.
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Schermvloot niet beschikbaar.</strong> De actuele status kan niet veilig worden
          getoond. Controleer de Supabase-verbinding en vernieuw daarna deze pagina.
        </p>
      ) : null}

      <section className="metric-grid" aria-label="Schermoverzicht">
        <MetricCard detail="Players met een recente heartbeat." label="Online" tone="success" value={String(online)} />
        <MetricCard detail="Players die een nieuwe release voorbereiden." label="Synchroniseren" tone="info" value={String(syncing)} />
        <MetricCard detail="Niet gekoppeld, offline of uitgeschakeld." label="Aandacht nodig" tone="warning" value={String(attention)} />
      </section>

      <section className="screens-workspace">
        <section className="workspace-section" aria-labelledby="screen-fleet-title">
          <div className="workspace-section__header">
            <div>
              <h2 className="workspace-section__title" id="screen-fleet-title">Schermvloot</h2>
              <p className="work-panel__meta">Status, device en release per echt tenantscherm.</p>
            </div>
            <StatusPill label={`${data.screens.length} totaal`} tone="neutral" />
          </div>
          {data.screens.length ? (
            <div className="data-table-frame">
              <table className="data-table data-table--responsive">
                <caption>Operationele schermstatus binnen de actieve tenant.</caption>
                <thead>
                  <tr>
                    <th scope="col">Scherm</th>
                    <th scope="col">Status</th>
                    <th scope="col">Player</th>
                    <th scope="col">Playlist</th>
                    <th scope="col">Release</th>
                    <th scope="col">Laatst gezien</th>
                    <th scope="col">Opslag</th>
                  </tr>
                </thead>
                <tbody>
                  {data.screens.map((screen) => {
                    const device = devicesByScreen.get(screen.id);
                    const status = screenStatus(screen, device);
                    return (
                      <tr key={screen.id}>
                        <td data-label="Scherm">
                          <span className="table-primary">{screen.name}</span>
                          <span className="table-secondary">{screen.location || orientationLabel(screen.orientation)}</span>
                        </td>
                        <td data-label="Status"><StatusPill label={status.label} tone={status.tone} /></td>
                        <td data-label="Player">{device?.device_name || "Niet gekoppeld"}</td>
                        <td data-label="Playlist">{screen.assigned_playlist_id ? playlistNames.get(screen.assigned_playlist_id) || shortId(screen.assigned_playlist_id) : "Geen"}</td>
                        <td data-label="Release">{releaseLabel(device, screen.assigned_release_id)}</td>
                        <td data-label="Laatst gezien">{formatLastSeen(device?.last_seen_at)}</td>
                        <td data-label="Opslag">{formatStorage(device)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice" role="status">
              Er zijn nog geen schermen. Maak eerst een logisch scherm aan en koppel daarna de code
              die op de fysieke Player verschijnt.
            </p>
          )}
        </section>

        <aside className="workspace-aside" aria-label="Scherm- en Playerbeheer">
          <section className="inspector-panel" aria-labelledby="create-screen-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="create-screen-title">Scherm aanmaken</h2>
                <p className="work-panel__meta">Definieer eerst de fysieke plek binnen deze tenant.</p>
              </div>
              <StatusPill label="Beheerder" tone={canManage ? "success" : "warning"} />
            </div>
            <form action={createScreen} className="playlist-form">
              <div className="field">
                <label htmlFor="screen-name">Schermnaam</label>
                <input disabled={!session.isLive || !canManage} id="screen-name" maxLength={120} name="name" placeholder="Bijvoorbeeld entree links" required type="text" />
              </div>
              <div className="field">
                <label htmlFor="screen-location">Locatie</label>
                <input disabled={!session.isLive || !canManage} id="screen-location" maxLength={160} name="location" placeholder="Clubhuis entree" type="text" />
              </div>
              <div className="field">
                <label htmlFor="screen-orientation">Oriëntatie</label>
                <select defaultValue={data.settings.orientation} disabled={!session.isLive || !canManage} id="screen-orientation" name="orientation">
                  <option value="landscape">Liggend</option>
                  <option value="portrait">Staand</option>
                </select>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="screen-resolution-width">Breedte</label><input defaultValue={data.settings.width} disabled={!session.isLive || !canManage} id="screen-resolution-width" max={7680} min={320} name="resolutionWidth" required type="number" /></div>
                <div className="field"><label htmlFor="screen-resolution-height">Hoogte</label><input defaultValue={data.settings.height} disabled={!session.isLive || !canManage} id="screen-resolution-height" max={4320} min={240} name="resolutionHeight" required type="number" /></div>
              </div>
              <button className="button-link button-link--secondary" disabled={!session.isLive || !canManage} type="submit">Scherm opslaan</button>
            </form>
          </section>

          <section className="inspector-panel" aria-labelledby="pairing-title">
            <div className="work-panel__header">
              <div>
                <h2 className="work-panel__title" id="pairing-title">Player koppelen</h2>
                <p className="work-panel__meta">Neem de zes tekens van het Player-startscherm over.</p>
              </div>
              <StatusPill label="10 min" tone="info" />
            </div>
            <form action={claimScreenPairing} className="playlist-form">
              <div className="field">
                <label htmlFor="pairing-screen">Doelscherm</label>
                <select disabled={!session.isLive || !canManage || !data.screens.length} id="pairing-screen" name="screenId" required>
                  <option value="">Kies een scherm</option>
                  {data.screens.filter((screen) => screen.status !== "disabled").map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pairing-code">Koppelcode</label>
                <input autoCapitalize="characters" autoComplete="one-time-code" disabled={!session.isLive || !canManage || !data.screens.length} id="pairing-code" inputMode="text" maxLength={7} name="pairingCode" pattern="[A-Za-z2-9]{3}[ -]?[A-Za-z2-9]{3}" placeholder="ABC DEF" required type="text" />
              </div>
              <div className="field">
                <label htmlFor="device-name">Apparaatnaam</label>
                <input defaultValue="LG webOS Signage" disabled={!session.isLive || !canManage || !data.screens.length} id="device-name" maxLength={120} name="deviceName" type="text" />
              </div>
              <button className="button-link button-link--primary" disabled={!session.isLive || !canManage || !data.screens.length} type="submit">Player veilig koppelen</button>
            </form>
            <HealthList ariaLabel="Pairingcontroles" items={pairingChecks} />
          </section>
        </aside>
      </section>

      <section className="data-surface" aria-labelledby="device-lifecycle-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="device-lifecycle-title">LG-koppelproces</h2>
            <p className="work-panel__meta">Van HTTPS Player-URL naar een veilige eerste synchronisatie.</p>
          </div>
          <StatusPill label="Koppelklaar" tone="success" />
        </div>
        <Timeline ariaLabel="Device lifecycle stappen" items={deviceLifecycle} />
      </section>
    </>
  );
}

async function loadScreens(tenantId: string | null, isLive: boolean) {
  const defaultSettings = { height: 1080, orientation: "landscape", width: 1920 };
  if (!tenantId || !isLive) return { devices: [] as DeviceRow[], error: false, playlists: [] as PlaylistRow[], screens: [] as ScreenRow[], settings: defaultSettings };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { devices: [] as DeviceRow[], error: true, playlists: [] as PlaylistRow[], screens: [] as ScreenRow[], settings: defaultSettings };

  const [screens, devices, playlists, settings] = await Promise.all([
    supabase.from("screens").select("id, name, location, orientation, status, assigned_playlist_id, assigned_release_id").eq("tenant_id", tenantId).order("created_at", { ascending: true }),
    supabase.from("player_devices").select("id, screen_id, device_name, active_release_id, desired_release_id, last_seen_at, storage_quota_bytes, storage_used_bytes").eq("tenant_id", tenantId).eq("status", "paired").order("paired_at", { ascending: false }),
    supabase.from("playlists").select("id, name").eq("tenant_id", tenantId),
    supabase.from("tenant_settings").select("default_screen_orientation, default_resolution_width, default_resolution_height").eq("tenant_id", tenantId).maybeSingle()
  ]);
  const error = Boolean(screens.error || devices.error || playlists.error || settings.error);
  return {
    devices: error ? [] : (devices.data ?? []) as DeviceRow[],
    error,
    playlists: error ? [] : (playlists.data ?? []) as PlaylistRow[],
    screens: error ? [] : (screens.data ?? []) as ScreenRow[],
    settings: settings.data ? {
      height: settings.data.default_resolution_height,
      orientation: settings.data.default_screen_orientation,
      width: settings.data.default_resolution_width
    } : defaultSettings
  };
}

function screenStatus(screen: ScreenRow, device?: DeviceRow) {
  if (screen.status === "disabled") return { kind: "disabled", label: "Uitgeschakeld", tone: "critical" as const };
  if (!device) return { kind: "unpaired", label: "Niet gekoppeld", tone: "warning" as const };
  if (device.desired_release_id && device.desired_release_id !== device.active_release_id) return { kind: "syncing", label: "Synchroniseren", tone: "info" as const };
  if (device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60_000) return { kind: "online", label: "Online", tone: "success" as const };
  return { kind: "offline", label: "Offline", tone: "warning" as const };
}

function releaseLabel(device: DeviceRow | undefined, assignedReleaseId: string | null) {
  if (!assignedReleaseId) return "Geen";
  if (device?.desired_release_id && device.desired_release_id !== device.active_release_id) return `${shortId(device.active_release_id)} → ${shortId(device.desired_release_id)}`;
  return `${shortId(device?.active_release_id || assignedReleaseId)} actief`;
}

function formatLastSeen(value: string | null | undefined) {
  if (!value) return "Nog niet";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (elapsed < 60_000) return "Nu";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min geleden`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} uur geleden`;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatStorage(device: DeviceRow | undefined) {
  if (!device || device.storage_used_bytes === null || device.storage_quota_bytes === null) return "Onbekend";
  return `${formatBytes(device.storage_used_bytes)} / ${formatBytes(device.storage_quota_bytes)}`;
}

function formatBytes(value: number) {
  if (value < 1_000_000) return `${Math.round(value / 1_000)} kB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "Geen";
}

function orientationLabel(value: string) {
  return value === "portrait" ? "Staand scherm" : "Liggend scherm";
}
