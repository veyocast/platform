import Link from "next/link";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  PageHeader,
  StatusPill,
  Timeline
} from "../../_components/shell-primitives";
import {
  claimPilotPairing,
  createPilotPlaylist,
  ingestPilotImage,
  publishPilotPlaylist
} from "./actions";

type PilotPageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type PilotAsset = {
  id: string;
  status: string;
  title: string;
};

type PilotPlaylist = {
  id: string;
  name: string;
  status: string;
};

type PilotScreen = {
  assigned_release_id: string | null;
  id: string;
  name: string;
};

type PilotDevice = {
  active_release_id: string | null;
  device_name: string | null;
  desired_release_id: string | null;
  id: string;
  last_seen_at: string | null;
  screen_id: string;
  status: string;
};

export default async function PilotPage({ searchParams }: PilotPageProps) {
  const session = await requireControlSession();
  const { fout, succes } = await searchParams;
  const data = await loadPilotData(session.tenantId, session.isLive);
  const readyAssets = data.assets.filter((asset) => asset.status === "ready");
  const draftPlaylists = data.playlists.filter((playlist) => playlist.status === "draft");
  const canPublish = readyAssets.length > 0 && draftPlaylists.length > 0 && data.screens.length > 0;

  return (
    <>
      <PageHeader
        actions={
          <Link className="button-link button-link--secondary" href="http://localhost:3001">
            Player openen
          </Link>
        }
        description="Doorloop de kleinste echte Castivo-keten: upload een afbeelding, maak een concept, publiceer een immutable release en koppel een Player zonder het device-token in Control te tonen."
        eyebrow={session.tenant}
        status={{
          label: session.isLive ? "Live Supabase" : "Demomodus",
          tone: session.isLive ? "success" : "warning"
        }}
        title="Pilotflow"
      />

      {fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Actie mislukt.</strong> {fout} Controleer de invoer en probeer opnieuw.
        </p>
      ) : null}
      {succes ? (
        <p className="notice notice--success" role="status">
          {succes}
        </p>
      ) : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Deze pagina doet bewust geen schijnmutaties. Start de lokale Supabase-stack en log in
          als <strong>pilot-admin@castivo.test</strong> om de keten echt uit te voeren.
        </p>
      ) : null}

      <section className="work-grid" aria-label="Pilotstappen">
        <PilotStep
          description="JPEG, PNG of WebP · maximaal 20 MB · inhoud wordt server-side gecontroleerd."
          number="1"
          status={readyAssets.length > 0 ? "Gereed" : "Nog nodig"}
          tone={readyAssets.length > 0 ? "success" : "warning"}
          title="Media uploaden"
        >
          <form action={ingestPilotImage} className="playlist-form">
            <div className="field">
              <label htmlFor="pilot-media-title">Titel</label>
              <input
                disabled={!session.isLive}
                id="pilot-media-title"
                name="title"
                placeholder="Welkom bij de vereniging"
                required
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="pilot-media-file">Afbeelding</label>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={!session.isLive}
                id="pilot-media-file"
                name="media"
                required
                type="file"
              />
            </div>
            <button
              className="button-link button-link--primary"
              disabled={!session.isLive}
              type="submit"
            >
              Uploaden en verifiëren
            </button>
          </form>
        </PilotStep>

        <PilotStep
          description="De pilot maakt één item van tien seconden. Het concept blijft bewerkbaar."
          number="2"
          status={draftPlaylists.length > 0 ? "Concept aanwezig" : "Nog nodig"}
          tone={draftPlaylists.length > 0 ? "success" : "warning"}
          title="Playlist maken"
        >
          <form action={createPilotPlaylist} className="playlist-form">
            <div className="field">
              <label htmlFor="pilot-playlist-name">Playlistnaam</label>
              <input
                disabled={!session.isLive || readyAssets.length === 0}
                id="pilot-playlist-name"
                name="name"
                placeholder="Pilot hoofdscherm"
                required
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="pilot-media-asset">Gereedstaande media</label>
              <select
                disabled={!session.isLive || readyAssets.length === 0}
                id="pilot-media-asset"
                name="mediaAssetId"
                required
              >
                <option value="">Kies media</option>
                {readyAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="button-link button-link--primary"
              disabled={!session.isLive || readyAssets.length === 0}
              type="submit"
            >
              Concept maken
            </button>
          </form>
        </PilotStep>

        <PilotStep
          description="Publiceren maakt een immutable release en wijst die atomair toe aan het scherm."
          number="3"
          status={data.screens.some((screen) => screen.assigned_release_id) ? "Toegewezen" : "Nog nodig"}
          tone={data.screens.some((screen) => screen.assigned_release_id) ? "success" : "warning"}
          title="Publiceren"
        >
          <form action={publishPilotPlaylist} className="playlist-form">
            <div className="field">
              <label htmlFor="pilot-playlist">Conceptplaylist</label>
              <select
                disabled={!session.isLive || draftPlaylists.length === 0}
                id="pilot-playlist"
                name="playlistId"
                required
              >
                <option value="">Kies een concept</option>
                {draftPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            </div>
            <ScreenSelect disabled={!session.isLive} screens={data.screens} suffix="publish" />
            <button
              className="button-link button-link--primary"
              disabled={!session.isLive || !canPublish}
              type="submit"
            >
              Release publiceren
            </button>
          </form>
        </PilotStep>

        <PilotStep
          description="Neem de zes tekens over van de Player. Control ontvangt nooit het geheime device-token."
          number="4"
          status={data.devices.length > 0 ? "Player gekoppeld" : "Nog nodig"}
          tone={data.devices.length > 0 ? "success" : "warning"}
          title="Player koppelen"
        >
          <form action={claimPilotPairing} className="playlist-form">
            <div className="field">
              <label htmlFor="pilot-pairing-code">Koppelcode</label>
              <input
                autoCapitalize="characters"
                autoComplete="one-time-code"
                disabled={!session.isLive}
                id="pilot-pairing-code"
                maxLength={7}
                name="pairingCode"
                pattern="[A-Za-z0-9 -]{6,7}"
                placeholder="AB12CD"
                required
                type="text"
              />
            </div>
            <ScreenSelect disabled={!session.isLive} screens={data.screens} suffix="pairing" />
            <button
              className="button-link button-link--primary"
              disabled={!session.isLive || data.screens.length === 0}
              type="submit"
            >
              Player koppelen
            </button>
          </form>
        </PilotStep>
      </section>

      <section className="data-surface" aria-labelledby="pilot-device-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="pilot-device-title">
              Playerstatus
            </h2>
            <p className="work-panel__meta">
              Gewenste en actieve release blijven apart zichtbaar tijdens downloaden en activeren.
            </p>
          </div>
          <StatusPill
            label={data.devices.length > 0 ? `${data.devices.length} gekoppeld` : "Geen device"}
            tone={data.devices.length > 0 ? "success" : "neutral"}
          />
        </div>
        {data.devices.length > 0 ? (
          <div className="data-table-frame">
            <table className="data-table data-table--responsive">
              <caption>Gekoppelde pilotplayers en hun releases.</caption>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Status</th>
                  <th scope="col">Gewenste release</th>
                  <th scope="col">Actieve release</th>
                  <th scope="col">Laatst gezien</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device) => (
                  <tr key={device.id}>
                    <td data-label="Player">
                      <span className="table-primary">{device.device_name ?? "Castivo Player"}</span>
                      <span className="table-secondary">{screenName(data.screens, device.screen_id)}</span>
                    </td>
                    <td data-label="Status">
                      <StatusPill
                        label={device.status === "paired" ? "Gekoppeld" : device.status}
                        tone={device.status === "paired" ? "success" : "warning"}
                      />
                    </td>
                    <td data-label="Gewenste release">
                      {shortId(device.desired_release_id)}
                    </td>
                    <td data-label="Actieve release">{shortId(device.active_release_id)}</td>
                    <td data-label="Laatst gezien">{formatLastSeen(device.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice" role="status">
            Open de Player, neem de tijdelijke code over en koppel hem aan het pilotscherm.
          </p>
        )}
      </section>

      <section className="data-surface" aria-labelledby="pilot-guarantees-title">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="pilot-guarantees-title">
              Wat deze keten bewaakt
            </h2>
            <p className="work-panel__meta">De kernregels zijn onderdeel van de implementatie, niet alleen UI-copy.</p>
          </div>
          <StatusPill label="Canon" tone="info" />
        </div>
        <Timeline
          ariaLabel="Technische garanties van de pilotflow"
          items={[
            {
              detail: "RLS en server-side rolcontrole begrenzen iedere tenantmutatie.",
              label: "Tenantisolatie",
              meta: "Default deny",
              tone: "success"
            },
            {
              detail: "De Player krijgt een eigen token; dit is geen Supabase Auth-gebruiker.",
              label: "Device-identiteit",
              meta: "Tokenhash",
              tone: "success"
            },
            {
              detail: "Een nieuwe release wordt pas actief nadat alle assets lokaal zijn geverifieerd.",
              label: "Offline activering",
              meta: "Last-known-good",
              tone: "success"
            }
          ]}
        />
      </section>
    </>
  );
}

function PilotStep({
  children,
  description,
  number,
  status,
  title,
  tone
}: {
  children: React.ReactNode;
  description: string;
  number: string;
  status: string;
  title: string;
  tone: "success" | "warning";
}) {
  return (
    <section className="data-surface" aria-labelledby={`pilot-step-${number}`}>
      <div className="work-panel__header">
        <div>
          <p className="work-panel__meta">Stap {number}</p>
          <h2 className="work-panel__title" id={`pilot-step-${number}`}>
            {title}
          </h2>
          <p className="work-panel__meta">{description}</p>
        </div>
        <StatusPill label={status} tone={tone} />
      </div>
      {children}
    </section>
  );
}

function ScreenSelect({
  disabled,
  screens,
  suffix
}: {
  disabled: boolean;
  screens: PilotScreen[];
  suffix: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`pilot-screen-${suffix}`}>Doelscherm</label>
      <select
        disabled={disabled || screens.length === 0}
        id={`pilot-screen-${suffix}`}
        name="screenId"
        required
      >
        <option value="">Kies een scherm</option>
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </select>
    </div>
  );
}

async function loadPilotData(tenantId: string | null, isLive: boolean) {
  const empty = {
    assets: [] as PilotAsset[],
    devices: [] as PilotDevice[],
    playlists: [] as PilotPlaylist[],
    screens: [] as PilotScreen[]
  };

  if (!isLive || !tenantId) {
    return empty;
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return empty;
  }

  const [assets, playlists, screens, devices] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, title, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("screens")
      .select("id, name, assigned_release_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("player_devices")
      .select("id, screen_id, device_name, status, desired_release_id, active_release_id, last_seen_at")
      .eq("tenant_id", tenantId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
  ]);

  const failed = [assets.error, playlists.error, screens.error, devices.error].find(Boolean);
  if (failed) {
    throw new Error(`Pilotgegevens konden niet worden geladen: ${failed.message}`);
  }

  return {
    assets: (assets.data ?? []) as PilotAsset[],
    devices: (devices.data ?? []) as PilotDevice[],
    playlists: (playlists.data ?? []) as PilotPlaylist[],
    screens: (screens.data ?? []) as PilotScreen[]
  };
}

function screenName(screens: PilotScreen[], screenId: string) {
  return screens.find((screen) => screen.id === screenId)?.name ?? "Onbekend scherm";
}

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "Nog niet";
}

function formatLastSeen(value: string | null) {
  if (!value) {
    return "Nog niet";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
