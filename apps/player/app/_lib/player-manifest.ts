import type {
  PlayerDynamicTemplatePayload,
  PlayerEngagePlayback,
  PlayerPlaybackItem,
  PlayerSponsorPlan,
  SignedPlayerEntitlement,
  PlayerYouTubePlayback
} from "@veyocast/contracts";

import { localStorageDeviceTokenKey } from "./player-storage";
import {
  evaluateDynamicTemplateEligibility,
  dynamicTemplateMinimumPlaybackMs,
} from "./dynamic-template-view";

export const demoOnlineDeviceToken = "demo-online";
export { localStorageDeviceTokenKey };

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
export type PlayerManifestTransition = "cut" | "crossfade" | "wipe";

export type ResolvedPlayerItemPresentation = {
  accessibilityName: string;
  backgroundColor: string | null;
  cropFocusX: number;
  cropFocusY: number;
  displayTitle: string;
  enabled: boolean;
  transition: PlayerManifestTransition;
  trimEndSeconds: number | null;
  trimStartSeconds: number;
  visibleFrom: number | null;
  visibleUntil: number | null;
  volumePercent: number;
};

export type PlayerManifestItemSelection = {
  index: number;
  wrapped: boolean;
};

export type PlayerManifestPresentationDefaults = {
  backgroundColor?: string;
  fitMode: PlayerManifestFitMode;
  imageDurationSeconds: number;
  loopEnabled: boolean;
  transition: PlayerManifestTransition;
  videoMuted: boolean;
};

export type PlayerManifestItem = PlayerPlaybackItem & {
  dynamicTemplate?: PlayerDynamicTemplatePayload;
  onlinePlayback?: PlayerEngagePlayback | PlayerYouTubePlayback;
  source: {
    url: string;
    fallbackUrl?: string;
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
  presentationDefaults?: PlayerManifestPresentationDefaults;
  sponsorPlan?: PlayerSponsorPlan;
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
  branding?: PlayerWaitingBranding;
  entitlement?: SignedPlayerEntitlement;
  entitlementVerified?: boolean;
};

export type PlayerWaitingBranding = {
  sportparkName: string;
  tenantLogoUrl: string | null;
  tenantName: string;
  themeMode: "dark" | "light";
  timezone: string;
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
  branding?: PlayerWaitingBranding;
};

export type PlayerManifestProblem = {
  state: "UNPAIRED" | "DISABLED" | "ERROR_RECOVERABLE";
  error: {
    cause: string;
    code?: string;
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
          code: "INVALID_DEVICE_TOKEN",
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
          code: "DEVICE_REVOKED",
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
          code: "INVALID_DEVICE_TOKEN",
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

export function resolvePlayerItemPresentation(
  item: PlayerManifestItem
): ResolvedPlayerItemPresentation {
  const cropFocusX = resolveBoundedNumber(item.cropFocus?.x, 0, 1, 0.5);
  const cropFocusY = resolveBoundedNumber(item.cropFocus?.y, 0, 1, 0.5);
  const trimStartSeconds = resolveBoundedNumber(
    item.trim?.startSeconds,
    0,
    86_400,
    0
  );
  const trimEndCandidate = resolveBoundedNumber(
    item.trim?.endSeconds,
    0,
    86_400,
    null
  );
  const trimEndSeconds =
    trimEndCandidate !== null && trimEndCandidate > trimStartSeconds
      ? trimEndCandidate
      : null;
  const visibleFrom = parseOptionalTimestamp(item.visibility?.from);
  const visibleUntil = parseOptionalTimestamp(item.visibility?.until);

  return {
    accessibilityName:
      resolveOptionalLabel(item.accessibilityName) ??
      resolveOptionalLabel(item.displayTitle) ??
      item.title,
    backgroundColor:
      typeof item.backgroundColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(item.backgroundColor)
        ? item.backgroundColor
        : null,
    cropFocusX,
    cropFocusY,
    displayTitle: resolveOptionalLabel(item.displayTitle) ?? item.title,
    enabled: item.enabled !== false,
    transition: ["cut", "crossfade", "wipe"].includes(
      String(item.transition)
    )
      ? (item.transition as PlayerManifestTransition)
      : "cut",
    trimEndSeconds,
    trimStartSeconds,
    visibleFrom,
    visibleUntil:
      visibleUntil !== null &&
      (visibleFrom === null || visibleUntil > visibleFrom)
        ? visibleUntil
        : null,
    volumePercent: resolveBoundedNumber(
      item.volumePercent,
      0,
      100,
      100
    )
  };
}

export function isPlayerManifestItemPlayable(
  item: PlayerManifestItem,
  at = Date.now()
) {
  const presentation = resolvePlayerItemPresentation(item);
  if (!presentation.enabled) return false;
  if (
    item.dynamicTemplate &&
    evaluateDynamicTemplateEligibility(item.dynamicTemplate, new Date(at)) !== "eligible"
  ) {
    return false;
  }
  if (presentation.visibleFrom !== null && at < presentation.visibleFrom) {
    return false;
  }
  if (presentation.visibleUntil !== null && at >= presentation.visibleUntil) {
    return false;
  }
  return true;
}

export function findFirstPlayableItemIndex(
  items: PlayerManifestItem[],
  at = Date.now()
) {
  return items.findIndex((item) => isPlayerManifestItemPlayable(item, at));
}

export function findNextPlayableItem(
  items: PlayerManifestItem[],
  currentIndex: number,
  at = Date.now()
): PlayerManifestItemSelection | null {
  if (items.length === 0) return null;

  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (currentIndex + offset) % items.length;
    const item = items[index];
    if (item && isPlayerManifestItemPlayable(item, at)) {
      return {
        index,
        wrapped: currentIndex + offset >= items.length
      };
    }
  }

  return null;
}

export function getPlayerItemPlaybackDurationMs(
  item: PlayerManifestItem,
  overrideMs?: number | null,
  at = Date.now()
) {
  const durationMs = Math.max(
    getPlaybackDurationMs(item, overrideMs),
    item.dynamicTemplate
      ? dynamicTemplateMinimumPlaybackMs(item.dynamicTemplate)
      : 0
  );
  const { visibleUntil } = resolvePlayerItemPresentation(item);
  if (visibleUntil === null) return durationMs;
  return Math.max(0, Math.min(durationMs, visibleUntil - at));
}

export function getNextPlayerVisibilityChangeDelayMs(
  items: PlayerManifestItem[],
  at = Date.now()
) {
  const nextChangeAt = items.reduce<number | null>((nearest, item) => {
    const { enabled, visibleFrom, visibleUntil } =
      resolvePlayerItemPresentation(item);
    if (!enabled) return nearest;

    return [visibleFrom, visibleUntil].reduce<number | null>(
      (candidate, timestamp) =>
        timestamp !== null &&
        timestamp > at &&
        (candidate === null || timestamp < candidate)
          ? timestamp
          : candidate,
      nearest
    );
  }, null);

  return nextChangeAt === null ? null : Math.max(0, nextChangeAt - at);
}

function resolveBoundedNumber<TFallback extends number | null>(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: TFallback
): number | TFallback {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fallback;
}

function parseOptionalTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resolveOptionalLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const label = value.trim();
  return label ? label.slice(0, 240) : null;
}
