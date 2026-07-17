export const demoOnlineDeviceToken = "demo-online";
export const localStorageDeviceTokenKey = "castivo.player.deviceToken";

export type PlayerRuntimeState =
  | "UNPAIRED"
  | "SYNCING"
  | "READY"
  | "PLAYING"
  | "ERROR_RECOVERABLE"
  | "DISABLED";

export type PlayerManifestItemKind = "image" | "video";
export type PlayerManifestFitMode = "contain" | "cover";

export type PlayerManifestItem = {
  id: string;
  kind: PlayerManifestItemKind;
  title: string;
  durationSeconds: number;
  fitMode: PlayerManifestFitMode;
  muted: boolean;
  source: {
    url: string;
    posterUrl?: string;
    mimeType: string;
    bytes: number;
    checksumSha256: string;
  };
};

export type PlayerReleaseManifest = {
  schemaVersion: 1;
  tenantId: string;
  playlistId: string;
  releaseId: string;
  version: number;
  label: string;
  manifestHash: string;
  publishedAt: string;
  totalDurationSeconds: number;
  totalBytes: number;
  items: PlayerManifestItem[];
};

export type PlayerManifestEnvelope = {
  state: "READY" | "PLAYING";
  fetchedAt: string;
  device: {
    id: string;
    screenId: string;
    screenName: string;
    activeReleaseId: string;
    desiredReleaseId: string;
  };
  manifest: PlayerReleaseManifest;
  diagnostics: {
    syncStatus: "online";
    lastSuccessfulSyncAt: string;
    nextSyncReason: string;
  };
};

export type PlayerManifestProblem = {
  state: "UNPAIRED" | "DISABLED" | "ERROR_RECOVERABLE";
  error: {
    cause: string;
    effect: string;
    recovery: string;
  };
};

export type PlayerManifestLookup =
  | {
      ok: true;
      status: 200;
      body: PlayerManifestEnvelope;
    }
  | {
      ok: false;
      status: 401 | 404 | 423;
      body: PlayerManifestProblem;
    };

const demoTenantId = "11111111-1111-4111-8111-111111111111";
const demoPlaylistId = "22222222-2222-4222-8222-222222222222";
const demoReleaseId = "33333333-3333-4333-8333-333333333333";
const demoScreenId = "44444444-4444-4444-8444-444444444444";
const demoDeviceId = "55555555-5555-4555-8555-555555555555";
const demoChecksum = "a".repeat(64);

export function normalizeDeviceToken(token: string | null | undefined) {
  return token?.trim() ?? "";
}

export function getPlayerManifestForToken(
  token: string | null | undefined,
  fetchedAt = new Date().toISOString()
): PlayerManifestLookup {
  const normalizedToken = normalizeDeviceToken(token);

  if (!normalizedToken) {
    return {
      ok: false,
      status: 401,
      body: {
        state: "UNPAIRED",
        error: {
          cause: "Er is nog geen device token aanwezig.",
          effect: "Deze player kan geen release manifest ophalen.",
          recovery: "Koppel de player eerst via de pairingcode in Castivo Control."
        }
      }
    };
  }

  if (normalizedToken === "demo-disabled") {
    return {
      ok: false,
      status: 423,
      body: {
        state: "DISABLED",
        error: {
          cause: "Deze demo-device session is uitgeschakeld.",
          effect: "Playback blijft gestopt en er wordt geen nieuwe release geladen.",
          recovery: "Maak een nieuwe pairing aan of herstel de device status in Control."
        }
      }
    };
  }

  if (normalizedToken !== demoOnlineDeviceToken) {
    return {
      ok: false,
      status: 404,
      body: {
        state: "ERROR_RECOVERABLE",
        error: {
          cause: "De device token hoort niet bij een actief scherm.",
          effect: "Zonder last-known-good release blijft de player in herstelstatus.",
          recovery: "Controleer de pairing of koppel het scherm opnieuw."
        }
      }
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      state: "PLAYING",
      fetchedAt,
      device: {
        id: demoDeviceId,
        screenId: demoScreenId,
        screenName: "Entree links",
        activeReleaseId: demoReleaseId,
        desiredReleaseId: demoReleaseId
      },
      manifest: {
        schemaVersion: 1,
        tenantId: demoTenantId,
        playlistId: demoPlaylistId,
        releaseId: demoReleaseId,
        version: 3,
        label: "Zomerroute v3",
        manifestHash: "b".repeat(64),
        publishedAt: "2026-07-17T09:00:00.000Z",
        totalDurationSeconds: 15,
        totalBytes: 486_400,
        items: [
          {
            id: "screen-entree",
            kind: "image",
            title: "Clubhuis entree",
            durationSeconds: 5,
            fitMode: "cover",
            muted: true,
            source: {
              url: "/player-demo/clubhuis-entree.svg",
              mimeType: "image/svg+xml",
              bytes: 142_000,
              checksumSha256: demoChecksum
            }
          },
          {
            id: "match-preview",
            kind: "video",
            title: "Wedstrijdvoorbeschouwing",
            durationSeconds: 5,
            fitMode: "cover",
            muted: true,
            source: {
              url: "",
              posterUrl: "/player-demo/wedstrijd-poster.svg",
              mimeType: "video/mp4",
              bytes: 204_800,
              checksumSha256: demoChecksum
            }
          },
          {
            id: "canteen-news",
            kind: "image",
            title: "Kantine nieuws",
            durationSeconds: 5,
            fitMode: "contain",
            muted: true,
            source: {
              url: "/player-demo/kantine-nieuws.svg",
              mimeType: "image/svg+xml",
              bytes: 139_600,
              checksumSha256: demoChecksum
            }
          }
        ]
      },
      diagnostics: {
        syncStatus: "online",
        lastSuccessfulSyncAt: fetchedAt,
        nextSyncReason: "desired release already active"
      }
    }
  };
}

export function getPlaybackDurationMs(
  item: Pick<PlayerManifestItem, "durationSeconds">,
  overrideMs?: number | null
) {
  if (overrideMs && Number.isFinite(overrideMs)) {
    return Math.max(250, Math.min(overrideMs, 10_000));
  }

  return item.durationSeconds * 1000;
}
