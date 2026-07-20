import type { PlayerPlaybackItem } from "@veyocast/contracts";

export const demoOnlineDeviceToken = "demo-online";
export const localStorageDeviceTokenKey = "veyocast.player.deviceToken";

export type PlayerRuntimeState =
  | "UNPAIRED"
  | "SYNCING"
  | "READY"
  | "PLAYING"
  | "DOWNLOADING"
  | "VERIFYING"
  | "SWITCH_PENDING"
  | "OFFLINE_PLAYING"
  | "ERROR_RECOVERABLE"
  | "DISABLED";

export type PlayerManifestItemKind = "image" | "video";
export type PlayerManifestFitMode = "contain" | "cover";

export type PlayerManifestItem = PlayerPlaybackItem & {
  source: {
    url: string;
    posterUrl?: string;
    posterBytes?: number;
    posterChecksumSha256?: string;
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
    syncStatus: "online" | "offline";
    lastSuccessfulSyncAt: string;
    nextSyncReason: string;
  };
};

export type PlayerWaitingContentEnvelope = {
  state: "READY";
  fetchedAt: string;
  device: {
    id: string;
    screenId: string;
    screenName: string;
    activeReleaseId: string | null;
    desiredReleaseId: null;
  };
  diagnostics: {
    syncStatus: "online";
    lastSuccessfulSyncAt: string;
    nextSyncReason: "waiting for first release";
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
const demoEntreeChecksum = "67ca5eafb9902da217ba9ae461d851f94c916a46db3ffddc824dc674f12f425c";
const demoPosterChecksum = "8a0614c748e10941deaed166fe9b9318f54c8d362152286091eb9e0b3ed43b7d";
const demoCanteenChecksum = "b65be753a723dd4398f37bded1c5b8239be1b96e00b490647db1e5a3ea80190a";

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
          recovery: "Koppel de player eerst via de pairingcode in VeyoCast Control."
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
        totalBytes: 3_760,
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
              bytes: 1_729,
              checksumSha256: demoEntreeChecksum
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
              posterBytes: 711,
              posterChecksumSha256: demoPosterChecksum,
              mimeType: "video/mp4",
              bytes: 0,
              checksumSha256: "0".repeat(64)
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
              bytes: 1_320,
              checksumSha256: demoCanteenChecksum
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
