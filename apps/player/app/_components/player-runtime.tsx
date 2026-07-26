"use client";

/* eslint-disable @next/next/no-img-element -- Player media URLs come from release manifests and must render directly. */

import { VEYOCAST_APPS } from "@veyocast/config";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";

import {
  activateRelease,
  garbageCollectPersistedPlayerMedia,
  hydrateCachedRelease,
  hydratePreparedRelease,
  preparePendingRelease,
  readActiveRelease,
  readPreviousRelease,
  revokeHydratedRelease,
  type HydratedPlayerRelease,
  type PlayerCachePhase
} from "../_lib/player-cache";
import {
  previousPlayerStorageKey,
  readAndMigrateStorageValue,
  removeCurrentAndPreviousStorageValues
} from "../_lib/brand-transition";
import {
  findFirstPlayableItemIndex,
  findNextPlayableItem,
  getNextPlayerVisibilityChangeDelayMs,
  getPlayerItemPlaybackDurationMs,
  isPlayerManifestItemPlayable,
  localStorageDeviceTokenKey,
  resolvePlayerItemPresentation,
  type PlayerManifestEnvelope,
  type PlayerManifestItem,
  type PlayerManifestProblem,
  type PlayerRuntimeState,
  type PlayerWaitingContentEnvelope
} from "../_lib/player-manifest";
import {
  planPlayerRecovery,
  playerReloadCooldownMs,
  type PlayerRecoveryAction
} from "../_lib/player-recovery";
import {
  fetchPlayerOrigin,
  playerConnectivityEventName,
  readPlayerConnectivity,
  reportPlayerConnectivity,
  type PlayerConnectivityEvent
} from "../_lib/player-connectivity";
import { resolvePersistedPairingDelay } from "../_lib/player-pairing-recovery";
import {
  clearAutomationReport,
  queueAutomationHeartbeatConfirmation,
  readAutomationCapabilities,
  readAutomationReport,
  storeAutomationSync
} from "../_lib/player-automation";
import {
  defaultWatchdogTimeoutMs,
  resolvePlayerRuntimeTiming
} from "../_lib/player-runtime-config";
import styles from "./player-playback.module.css";

const demoPairingCode = "VYO 482";
const localStoragePairingCodeKey = "veyocast.player.pairingCode";
const localStoragePairingExpiryKey = "veyocast.player.pairingExpiresAt";
const localStoragePairingProvisionAfterKey = "veyocast.player.pairingProvisionAfter";
const localStoragePlayerInstanceKey = "veyocast.player.instanceId";
const localStorageReloadTimestampsKey = "veyocast.player.reloadTimestamps";
const waitingContentSyncIntervalMs = 5_000;
const maximumManifestSyncBackoffMs = 5 * 60_000;
const pairingClaimPollIntervalMs = 2_000;
const pairingProvisionCooldownMs = 5_000;
let volatilePlayerInstanceId: string | null = null;

export type PlaybackFailureCode =
  | "IMAGE_ERROR"
  | "VIDEO_ERROR"
  | "VIDEO_PROGRESS_TIMEOUT"
  | "VIDEO_STALLED_TIMEOUT"
  | "VIDEO_START_TIMEOUT";

type PlaybackErrorReport = {
  action: PlayerRecoveryAction;
  code: PlaybackFailureCode;
  itemId: string;
  occurredAt: string;
  recoveredAt?: string;
};

type PlaybackRuntimeState = Extract<
  PlayerRuntimeState,
  "PLAYING" | "DOWNLOADING" | "VERIFYING" | "SWITCH_PENDING" | "OFFLINE_PLAYING"
>;

type PlaybackRuntime = {
  activeIndex: number;
  pendingRelease?: HydratedPlayerRelease;
  release: HydratedPlayerRelease;
  state: PlaybackRuntimeState;
  syncMessage: string;
};

type WaitingContentRuntime = {
  device: PlayerWaitingContentEnvelope["device"];
  deviceToken: string;
  state: "READY";
  syncMessage: string;
};

type RuntimeView =
  | { state: "BOOTING" }
  | { state: "PAIRING_RETRY"; reason: string; retryAt: string }
  | { state: "UNPAIRED"; pairingCode?: string; expiresAt?: string }
  | { state: "SYNCING"; deviceToken: string }
  | WaitingContentRuntime
  | PlaybackRuntime
  | { state: "ERROR_RECOVERABLE" | "DISABLED"; error: PlayerManifestProblem["error"] };

export function PlayerRuntime() {
  const [runtime, setRuntime] = useState<RuntimeView>({ state: "BOOTING" });
  const [durationOverrideMs, setDurationOverrideMs] = useState<number | null>(null);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [visibilityRevision, setVisibilityRevision] = useState(0);
  const [watchdogTimeoutMs, setWatchdogTimeoutMs] = useState(defaultWatchdogTimeoutMs);
  const runtimeRef = useRef<RuntimeView>(runtime);
  const advancingRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const desiredReleaseIdRef = useRef<string | null>(null);
  const hydratedReleasesRef = useRef<HydratedPlayerRelease[]>([]);
  const lastPlaybackErrorRef = useRef<PlaybackErrorReport | null>(null);
  const playbackReadyRef = useRef(false);
  runtimeRef.current = runtime;

  const advancePlayback = useCallback(async (itemId: string, recoveryMessage?: string) => {
    if (advancingRef.current) return;
    const snapshot = runtimeRef.current;
    if (!isPlaybackRuntime(snapshot)) return;
    const activeItem = snapshot.release.envelope.manifest.items[snapshot.activeIndex];
    if (!activeItem || activeItem.id !== itemId) return;
    const nextSelection = findNextPlayableItem(
      snapshot.release.envelope.manifest.items,
      snapshot.activeIndex
    );
    if (!nextSelection) {
      setRuntime((currentRuntime) =>
        isPlaybackRuntime(currentRuntime)
          ? {
              ...currentRuntime,
              syncMessage:
                "Geen playlistitem is binnen het huidige zichtbaarheidsvenster actief."
            }
          : currentRuntime
      );
      return;
    }

    advancingRef.current = true;
    try {
      const deviceToken = readStoredDeviceToken();
      const pendingFirstIndex = snapshot.pendingRelease
        ? findFirstPlayableItemIndex(
            snapshot.pendingRelease.envelope.manifest.items
          )
        : -1;

      if (
        snapshot.state === "SWITCH_PENDING" &&
        snapshot.pendingRelease &&
        deviceToken &&
        nextSelection.wrapped &&
        pendingFirstIndex >= 0 &&
        desiredReleaseIdRef.current ===
          snapshot.pendingRelease.envelope.manifest.releaseId
      ) {
        try {
          await activateRelease({
            assets: snapshot.pendingRelease.assets,
            deviceToken,
            envelope: snapshot.pendingRelease.envelope
          });
          await garbageCollectPersistedPlayerMedia(deviceToken).catch(() => undefined);
        } catch {
          setRuntime((currentRuntime) =>
            isPlaybackRuntime(currentRuntime)
              ? {
                  ...currentRuntime,
                  pendingRelease: undefined,
                  state: "OFFLINE_PLAYING",
                  syncMessage: "Nieuwe release kon niet atomair worden geactiveerd; last-known-good blijft actief."
                }
              : currentRuntime
          );
          return;
        }
      }

      setPlaybackAttempt((attempt) => attempt + 1);
      playbackReadyRef.current = false;
      setRuntime((currentRuntime) => {
        if (!isPlaybackRuntime(currentRuntime)) return currentRuntime;
        const currentItem =
          currentRuntime.release.envelope.manifest.items[currentRuntime.activeIndex];
        if (!currentItem || currentItem.id !== itemId) return currentRuntime;

        const currentNextSelection = findNextPlayableItem(
          currentRuntime.release.envelope.manifest.items,
          currentRuntime.activeIndex
        );
        if (!currentNextSelection) {
          return {
            ...currentRuntime,
            syncMessage:
              "Geen playlistitem is binnen het huidige zichtbaarheidsvenster actief."
          };
        }
        if (
          currentRuntime.state === "SWITCH_PENDING" &&
          currentRuntime.pendingRelease &&
          currentNextSelection.wrapped
        ) {
          const nextReleaseIndex = findFirstPlayableItemIndex(
            currentRuntime.pendingRelease.envelope.manifest.items
          );
          if (nextReleaseIndex < 0) {
            return {
              ...currentRuntime,
              syncMessage:
                "Nieuwe release wacht op het eerstvolgende zichtbare item; actieve release blijft spelen."
            };
          }
          return {
            activeIndex: nextReleaseIndex,
            release: currentRuntime.pendingRelease,
            state: "PLAYING",
            syncMessage: "Nieuwe release is op loopgrens actief gemaakt."
          };
        }

        return {
          ...currentRuntime,
          activeIndex: currentNextSelection.index,
          syncMessage: recoveryMessage ?? currentRuntime.syncMessage
        };
      });
    } finally {
      advancingRef.current = false;
    }
  }, []);

  const restorePersistedLastKnownGood = useCallback(async () => {
    const deviceToken = readStoredDeviceToken();
    if (!deviceToken) return false;
    const cachedRelease = await readActiveRelease(deviceToken);
    if (!cachedRelease) return false;

    try {
      const hydratedRelease = await hydrateCachedRelease({
        ...cachedRelease,
        envelope: withSyncDiagnostics(
          cachedRelease.envelope,
          "offline",
          "watchdog herstelde last-known-good release"
        )
      });
      hydratedReleasesRef.current.push(hydratedRelease);
      playbackReadyRef.current = false;
      setPlaybackAttempt((attempt) => attempt + 1);
      setRuntime({
        activeIndex: resolveInitialPlaybackIndex(hydratedRelease),
        release: hydratedRelease,
        state: "OFFLINE_PLAYING",
        syncMessage: "Playbackfout: last-known-good release is opnieuw geladen."
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const enterReloadCooldown = useCallback((message: string) => {
    setRuntime((currentRuntime) =>
      isPlaybackRuntime(currentRuntime)
        ? { ...currentRuntime, state: "OFFLINE_PLAYING", syncMessage: message }
        : currentRuntime
    );
  }, []);

  const performControlledReload = useCallback(() => {
    const now = Date.now();
    const timestamps = readReloadTimestamps(now);
    const action = planPlayerRecovery({
      consecutiveFailures: 5,
      now,
      reloadTimestamps: timestamps
    });

    if (action !== "CONTROLLED_RELOAD") {
      enterReloadCooldown("Playbackherstel is afgekoeld om een oneindige reloadloop te voorkomen.");
      return;
    }

    writeReloadTimestamps([...timestamps, now]);
    window.location.reload();
  }, [enterReloadCooldown]);

  const handlePlaybackReady = useCallback((itemId: string) => {
    const currentRuntime = runtimeRef.current;
    if (!isPlaybackRuntime(currentRuntime)) return;
    const activeItem =
      currentRuntime.release.envelope.manifest.items[currentRuntime.activeIndex];
    if (activeItem?.id !== itemId) return;
    playbackReadyRef.current = true;
    consecutiveFailuresRef.current = 0;
    const lastError = lastPlaybackErrorRef.current;
    if (lastError && !lastError.recoveredAt) {
      lastPlaybackErrorRef.current = {
        ...lastError,
        recoveredAt: new Date().toISOString()
      };
    }
  }, []);

  const handlePlaybackEnded = useCallback((itemId: string) => {
    void advancePlayback(itemId);
  }, [advancePlayback]);

  const handlePlaybackFailure = useCallback(async (
    itemId: string,
    code: PlaybackFailureCode
  ) => {
    const currentRuntime = runtimeRef.current;
    if (!isPlaybackRuntime(currentRuntime)) return;
    const activeItem =
      currentRuntime.release.envelope.manifest.items[currentRuntime.activeIndex];
    if (activeItem?.id !== itemId) return;

    const now = Date.now();
    const action = planPlayerRecovery({
      consecutiveFailures: consecutiveFailuresRef.current,
      now,
      reloadTimestamps: readReloadTimestamps(now)
    });
    consecutiveFailuresRef.current += 1;
    lastPlaybackErrorRef.current = {
      action,
      code,
      itemId,
      occurredAt: new Date(now).toISOString()
    };

    if (action === "RETRY_ITEM") {
      playbackReadyRef.current = false;
      setPlaybackAttempt((attempt) => attempt + 1);
      setRuntime((value) =>
        isPlaybackRuntime(value)
          ? { ...value, syncMessage: `Playbackfout ${code}: huidig item wordt één keer opnieuw geprobeerd.` }
          : value
      );
      return;
    }
    if (action === "SKIP_ITEM") {
      setPlaybackAttempt((attempt) => attempt + 1);
      await advancePlayback(itemId, `Playbackfout ${code}: niet-speelbaar item is overgeslagen.`);
      return;
    }
    if (action === "RESTART_LOOP" || action === "REINITIALIZE_PLAYER") {
      playbackReadyRef.current = false;
      setPlaybackAttempt((attempt) => attempt + 1);
      setRuntime((value) =>
        isPlaybackRuntime(value)
          ? {
              ...value,
              activeIndex: 0,
              syncMessage:
                action === "RESTART_LOOP"
                  ? "Playbackherstel: playlistloop is opnieuw gestart."
                  : "Playbackherstel: media-renderer is opnieuw geïnitialiseerd."
            }
          : value
      );
      return;
    }
    if (action === "RESTORE_LAST_KNOWN_GOOD") {
      if (!(await restorePersistedLastKnownGood())) performControlledReload();
      return;
    }
    if (action === "CONTROLLED_RELOAD") {
      performControlledReload();
      return;
    }
    enterReloadCooldown("Playbackherstel is afgekoeld; de fout blijft via heartbeat zichtbaar.");
  }, [advancePlayback, enterReloadCooldown, performControlledReload, restorePersistedLastKnownGood]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get("deviceToken");
    const timing = resolvePlayerRuntimeTiming(
      searchParams,
      process.env.NODE_ENV !== "production"
    );
    const { manifestSyncIntervalMs } = timing;

    setDurationOverrideMs(timing.durationOverrideMs);
    setWatchdogTimeoutMs(timing.watchdogTimeoutMs);

    const deviceToken = queryToken ?? readStoredDeviceToken();

    if (!deviceToken) {
      let cancelled = false;
      let expiryTimer: number | undefined;
      let pollTimer: number | undefined;
      let provisionTimer: number | undefined;
      let retryAttempts = 0;

      function queuePairingProvision(delayMs: number, reason?: string) {
        if (cancelled) return;
        const boundedDelayMs = Math.max(0, delayMs);
        if (provisionTimer) window.clearTimeout(provisionTimer);
        if (boundedDelayMs > 0) {
          const retryAt = Date.now() + boundedDelayMs;
          writePairingProvisionAfter(retryAt);
          setRuntime({
            reason: reason ?? "Een eerdere aanvraag wordt nog veilig afgerond.",
            retryAt: new Date(retryAt).toISOString(),
            state: "PAIRING_RETRY"
          });
        }
        provisionTimer = window.setTimeout(() => {
          void provisionPairing();
        }, boundedDelayMs);
      }

      async function provisionPairing() {
        writePairingProvisionAfter(Date.now() + pairingProvisionCooldownMs);
        try {
          const response = await fetchPlayerOrigin("/api/player/pairing", {
            cache: "no-store",
            headers: {
              "X-VeyoCast-Player-Instance": readOrCreatePlayerInstanceId()
            },
            keepalive: true,
            method: "POST"
          });
          const body = (await response.json()) as PairingResponse;

          if (cancelled) {
            return;
          }

          if (!response.ok) {
            const delayMs = pairingRetryDelayMs(response, body, retryAttempts);
            retryAttempts += 1;
            queuePairingProvision(
              delayMs,
              body.error?.cause ?? "De koppelservice is tijdelijk niet beschikbaar."
            );
            return;
          }

          if (!body.live) {
            clearPairingProvisionAfter();
            setRuntime({ pairingCode: demoPairingCode, state: "UNPAIRED" });
            return;
          }

          if (!body.deviceToken || !body.expiresAt || !body.pairingCode) {
            const delayMs = transientPairingRetryDelayMs(retryAttempts);
            retryAttempts += 1;
            queuePairingProvision(
              delayMs,
              "De koppelservice gaf nog geen volledige veilige code terug."
            );
            return;
          }

          retryAttempts = 0;
          clearPairingProvisionAfter();
          const pendingToken = body.deviceToken;
          writeStoredPairing(body);
          setRuntime({
            expiresAt: body.expiresAt,
            pairingCode: body.pairingCode,
            state: "UNPAIRED"
          });
          schedulePairingExpiry(body.expiresAt);

          void pollPairingClaim(pendingToken);
          pollTimer = window.setInterval(() => {
            void pollPairingClaim(pendingToken);
          }, pairingClaimPollIntervalMs);
        } catch {
          const delayMs = transientPairingRetryDelayMs(retryAttempts);
          retryAttempts += 1;
          queuePairingProvision(
            delayMs,
            "De koppelservice is tijdelijk niet bereikbaar."
          );
        }
      }

      async function pollPairingClaim(pendingToken: string) {
        if (await confirmPairingClaim(pendingToken) && !cancelled) {
          clearStoredPairing();
          window.location.reload();
        }
      }

      function schedulePairingExpiry(expiresAt: string | undefined) {
        const expiry = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
        if (!Number.isFinite(expiry)) return;
        if (expiryTimer) window.clearTimeout(expiryTimer);
        expiryTimer = window.setTimeout(() => {
          if (cancelled) return;
          clearStoredPlayerIdentity();
          window.location.reload();
        }, Math.max(0, expiry - Date.now()));
      }

      const initialProvisionDelayMs = readPairingProvisionDelay();
      queuePairingProvision(
        initialProvisionDelayMs,
        initialProvisionDelayMs > 0
          ? "Een eerdere aanvraag wordt nog veilig afgerond."
          : undefined
      );

      return () => {
        cancelled = true;
        if (provisionTimer) {
          window.clearTimeout(provisionTimer);
        }
        if (pollTimer) {
          window.clearInterval(pollTimer);
        }
        if (expiryTimer) {
          window.clearTimeout(expiryTimer);
        }
      };
    }

    const pendingPairing = readStoredPairing();
    if (pendingPairing) {
      let cancelled = false;
      const pendingToken = deviceToken;
      const expiresAt = new Date(pendingPairing.expiresAt).getTime();

      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearStoredPlayerIdentity();
        window.location.reload();
        return undefined;
      }

      setRuntime({
        expiresAt: pendingPairing.expiresAt,
        pairingCode: pendingPairing.pairingCode,
        state: "UNPAIRED"
      });

      async function pollPairingClaim() {
        if (await confirmPairingClaim(pendingToken) && !cancelled) {
          clearStoredPairing();
          window.location.reload();
        }
      }

      void pollPairingClaim();
      const pollTimer = window.setInterval(() => {
        void pollPairingClaim();
      }, pairingClaimPollIntervalMs);
      const expiryTimer = window.setTimeout(() => {
        if (cancelled) return;
        clearStoredPlayerIdentity();
        window.location.reload();
      }, Math.max(0, expiresAt - Date.now()));

      return () => {
        cancelled = true;
        window.clearInterval(pollTimer);
        window.clearTimeout(expiryTimer);
      };
    }

    const activeDeviceToken = deviceToken;
    let cancelled = false;
    let consecutiveSyncFailures = 0;
    let syncInFlight = false;
    let syncTimer: number | undefined;

    if (queryToken) {
      writeStoredDeviceToken(queryToken);
      searchParams.delete("deviceToken");
      const cleanQuery = searchParams.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`
      );
    }

    setRuntime({ state: "SYNCING", deviceToken: activeDeviceToken });

    async function restoreLastKnownGood() {
      let cachedRelease = await readActiveRelease(activeDeviceToken);

      if (!cachedRelease || cancelled) {
        return false;
      }

      let offlineRelease: HydratedPlayerRelease;
      try {
        offlineRelease = await hydrateCachedRelease({
          ...cachedRelease,
          envelope: withSyncDiagnostics(
            cachedRelease.envelope,
            "offline",
            "last-known-good release actief"
          )
        });
      } catch {
        const previousRelease = await readPreviousRelease(activeDeviceToken);
        if (!previousRelease) return false;
        cachedRelease = previousRelease;
        offlineRelease = await hydrateCachedRelease({
          ...previousRelease,
          envelope: withSyncDiagnostics(
            previousRelease.envelope,
            "offline",
            "vorige geverifieerde release hersteld"
          )
        });
      }

      hydratedReleasesRef.current.push(offlineRelease);
      void garbageCollectPersistedPlayerMedia(activeDeviceToken).catch(() => undefined);

      if (!cancelled) {
        setRuntime({
          activeIndex: resolveInitialPlaybackIndex(offlineRelease),
          release: offlineRelease,
          state: "OFFLINE_PLAYING",
          syncMessage: "Last-known-good release actief terwijl online sync start."
        });
      }

      return true;
    }

    async function syncOnlineManifest() {
      if (cancelled || syncInFlight) return;
      syncInFlight = true;
      let syncSucceeded = false;
      let nextSyncBaseDelayMs = isWaitingContentRuntime(runtimeRef.current)
        ? waitingContentSyncIntervalMs
        : manifestSyncIntervalMs;

      try {
        const response = await fetchPlayerOrigin(
          "/api/player/manifest",
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${activeDeviceToken}`
            }
          }
        );
        const body = (await response.json()) as
          | PlayerManifestEnvelope
          | PlayerManifestProblem
          | PlayerWaitingContentEnvelope;

        if (cancelled) {
          return;
        }

        if (response.ok && isWaitingContentEnvelope(body)) {
          desiredReleaseIdRef.current = null;
          nextSyncBaseDelayMs = waitingContentSyncIntervalMs;
          setRuntime((currentRuntime) => {
            if (isPlaybackRuntime(currentRuntime)) {
              if (currentRuntime.pendingRelease) {
                releaseHydratedReference(currentRuntime.pendingRelease);
              }
              return {
                ...currentRuntime,
                pendingRelease: undefined,
                state: "PLAYING",
                syncMessage: "Geen nieuwe release toegewezen; last-known-good blijft actief."
              };
            }
            return {
              device: body.device,
              deviceToken: activeDeviceToken,
              state: "READY",
              syncMessage: "Player gekoppeld; wacht op de eerste publicatie."
            };
          });
          syncSucceeded = true;
          return;
        }

        if (!response.ok || !("manifest" in body)) {
          handleManifestProblem(body as PlayerManifestProblem);
          return;
        }

        const currentRuntime = runtimeRef.current;
        const releaseId = body.manifest.releaseId;
        desiredReleaseIdRef.current = releaseId;
        if (
          isPlaybackRuntime(currentRuntime) &&
          currentRuntime.release.envelope.manifest.releaseId === releaseId
        ) {
          if (currentRuntime.pendingRelease) {
            releaseHydratedReference(currentRuntime.pendingRelease);
          }
          setRuntime((value) =>
            isPlaybackRuntime(value)
              ? {
                  ...value,
                  pendingRelease: undefined,
                  release: {
                    ...value.release,
                    envelope: withSyncDiagnostics(
                      {
                        ...value.release.envelope,
                        device: body.device,
                        fetchedAt: body.fetchedAt
                      },
                      "online",
                      "release unchanged"
                    )
                  },
                  state:
                    value.state === "OFFLINE_PLAYING" ||
                    value.state === "SWITCH_PENDING"
                      ? "PLAYING"
                      : value.state,
                  syncMessage: "Manifest gecontroleerd; actieve release is ongewijzigd."
                }
              : value
          );
          syncSucceeded = true;
          return;
        }
        if (
          isPlaybackRuntime(currentRuntime) &&
          currentRuntime.pendingRelease?.envelope.manifest.releaseId === releaseId
        ) {
          syncSucceeded = true;
          return;
        }

        if (isPlaybackRuntime(currentRuntime) && currentRuntime.pendingRelease) {
          const obsoletePendingRelease = currentRuntime.pendingRelease;
          releaseHydratedReference(obsoletePendingRelease);
          setRuntime((value) =>
            isPlaybackRuntime(value) && value.pendingRelease === obsoletePendingRelease
              ? {
                  ...value,
                  pendingRelease: undefined,
                  state: "PLAYING",
                  syncMessage: "Eerdere pending release is ingetrokken; nieuwe sync start."
                }
              : value
          );
        }

        const preparedRelease = await preparePendingRelease({
          envelope: body,
          onPhase: (phase) => {
            updatePlaybackPhase(phase);
          }
        });

        if (cancelled) {
          return;
        }

        if (!preparedRelease.ok) {
          keepCachedPlaybackOrShowProblem(
            "Pending release is verworpen: asset verificatie faalde.",
            preparedRelease.error
          );
          return;
        }

        const preparedEnvelope = withSyncDiagnostics(body, "online", "release verified");
        const hydratedRelease = await hydratePreparedRelease({
          assets: preparedRelease.assets,
          envelope: preparedEnvelope
        });
        hydratedReleasesRef.current.push(hydratedRelease);

        if (cancelled) {
          return;
        }

        const persistedActive = await readActiveRelease(activeDeviceToken);
        const requiresDeferredActivation = Boolean(
          persistedActive &&
          persistedActive.envelope.manifest.releaseId !==
            hydratedRelease.envelope.manifest.releaseId
        );

        if (!requiresDeferredActivation) {
          await activateRelease({
            assets: preparedRelease.assets,
            deviceToken: activeDeviceToken,
            envelope: preparedEnvelope
          });
          await garbageCollectPersistedPlayerMedia(activeDeviceToken).catch(
            () => undefined
          );
        }

        setRuntime((currentRuntime) => {
          if (
            requiresDeferredActivation &&
            isPlaybackRuntime(currentRuntime)
          ) {
            return {
              ...currentRuntime,
              pendingRelease: hydratedRelease,
              state: "SWITCH_PENDING",
              syncMessage: "Nieuwe release geverifieerd; switch op loopgrens."
            };
          }

          return {
            activeIndex: resolveInitialPlaybackIndex(hydratedRelease),
            release: hydratedRelease,
            state: "PLAYING",
            syncMessage: "Release online geverifieerd en actief."
          };
        });
        syncSucceeded = true;
      } catch (error) {
        if (!cancelled) {
          keepCachedPlaybackOrShowProblem(
            "Online sync faalde; cached playback blijft actief.",
            error instanceof Error ? error.message : "manifest fetch failed"
          );
        }
      } finally {
        syncInFlight = false;
        consecutiveSyncFailures = syncSucceeded
          ? 0
          : Math.min(consecutiveSyncFailures + 1, 8);
        scheduleNextSync(nextSyncBaseDelayMs);
      }
    }

    function scheduleNextSync(baseDelayMs: number) {
      if (cancelled) return;
      if (syncTimer) window.clearTimeout(syncTimer);
      const delay = Math.min(
        maximumManifestSyncBackoffMs,
        baseDelayMs * 2 ** consecutiveSyncFailures
      );
      syncTimer = window.setTimeout(() => {
        void syncOnlineManifest();
      }, delay);
    }

    function releaseHydratedReference(release: HydratedPlayerRelease) {
      revokeHydratedRelease(release);
      hydratedReleasesRef.current = hydratedReleasesRef.current.filter(
        (candidate) => candidate !== release
      );
    }

    function updatePlaybackPhase(phase: PlayerCachePhase) {
      setRuntime((currentRuntime) => {
        if (!isPlaybackRuntime(currentRuntime)) {
          return currentRuntime;
        }

        return {
          ...currentRuntime,
          state: phase,
          syncMessage:
            phase === "DOWNLOADING"
              ? "Pending release wordt gedownload."
              : "Pending release wordt geverifieerd."
        };
      });
    }

    function handleManifestProblem(problem: PlayerManifestProblem) {
      if (problem.state === "UNPAIRED") {
        clearStoredPlayerIdentity();
        window.location.reload();
        return;
      }

      keepCachedPlaybackOrShowProblem(
        "Online manifest gaf geen speelbare release terug.",
        problem.error.cause,
        problem
      );
    }

    function keepCachedPlaybackOrShowProblem(
      syncMessage: string,
      cause: string,
      problem?: PlayerManifestProblem
    ) {
      setRuntime((currentRuntime) => {
        if (isPlaybackRuntime(currentRuntime)) {
          return {
            ...currentRuntime,
            release: {
              ...currentRuntime.release,
              envelope: withSyncDiagnostics(
                currentRuntime.release.envelope,
                "offline",
                cause
              )
            },
            state: "OFFLINE_PLAYING",
            syncMessage
          };
        }

        if (problem) {
          return {
            state: problem.state,
            error: problem.error
          };
        }

        return {
          state: "ERROR_RECOVERABLE",
          error: {
            cause,
            effect: "Zonder last-known-good release blijft de player in herstelstatus.",
            recovery: "Herstel netwerk of koppel het scherm opnieuw."
          }
        };
      });
    }

    function handleNetworkOffline() {
      setRuntime((currentRuntime) =>
        isPlaybackRuntime(currentRuntime)
          ? {
              ...currentRuntime,
              state: "OFFLINE_PLAYING",
              syncMessage: "Geen internetverbinding; last-known-good blijft lokaal spelen."
            }
          : currentRuntime
      );
    }

    function handleNetworkOnline() {
      consecutiveSyncFailures = 0;
      if (syncTimer) window.clearTimeout(syncTimer);
      void syncOnlineManifest();
    }

    window.addEventListener("offline", handleNetworkOffline);
    window.addEventListener("online", handleNetworkOnline);

    void restoreLastKnownGood()
      .catch(() => false)
      .then(() => {
        if (!cancelled) {
          void syncOnlineManifest();
        }
      });

    return () => {
      cancelled = true;
      if (syncTimer) window.clearTimeout(syncTimer);
      window.removeEventListener("offline", handleNetworkOffline);
      window.removeEventListener("online", handleNetworkOnline);
      hydratedReleasesRef.current.splice(0).forEach(revokeHydratedRelease);
    };
  }, []);

  const playbackScheduleKey = isPlaybackRuntime(runtime)
    ? [
        runtime.release.envelope.manifest.releaseId,
        runtime.activeIndex,
        runtime.release.envelope.manifest.items[runtime.activeIndex]?.id ?? "missing",
        runtime.release.envelope.manifest.items[runtime.activeIndex]?.durationSeconds ?? 0,
        runtime.release.envelope.manifest.items[runtime.activeIndex]?.visibility
          ?.from ??
          "always",
        runtime.release.envelope.manifest.items[runtime.activeIndex]?.visibility
          ?.until ??
          "always",
        runtime.release.envelope.manifest.items[runtime.activeIndex]?.enabled ?? true
      ].join(":")
    : null;

  const visibilityScheduleKey = isPlaybackRuntime(runtime)
    ? runtime.release.envelope.manifest.items
        .map((item) =>
          [
            item.id,
            item.enabled ?? true,
            item.visibility?.from ?? "",
            item.visibility?.until ?? ""
          ].join(":")
        )
        .join("|")
    : null;

  useEffect(() => {
    const playbackRuntime = runtimeRef.current;
    if (!isPlaybackRuntime(playbackRuntime)) return;

    const now = Date.now();
    const items = playbackRuntime.release.envelope.manifest.items;
    const activeItem = items[playbackRuntime.activeIndex];
    if (!activeItem || !isPlayerManifestItemPlayable(activeItem, now)) {
      const nextIndex = findFirstPlayableItemIndex(items, now);
      if (nextIndex >= 0 && nextIndex !== playbackRuntime.activeIndex) {
        playbackReadyRef.current = false;
        setPlaybackAttempt((attempt) => attempt + 1);
        setRuntime((currentRuntime) =>
          isPlaybackRuntime(currentRuntime) &&
          currentRuntime.release.envelope.manifest.releaseId ===
            playbackRuntime.release.envelope.manifest.releaseId
            ? {
                ...currentRuntime,
                activeIndex: nextIndex,
                syncMessage:
                  "Playlist is naar het actieve zichtbaarheidsvenster bijgewerkt."
              }
            : currentRuntime
        );
      }
    }

    const nextChangeDelayMs = getNextPlayerVisibilityChangeDelayMs(items, now);
    if (nextChangeDelayMs === null) return;
    const timer = window.setTimeout(
      () => setVisibilityRevision((revision) => revision + 1),
      Math.min(2_147_000_000, Math.max(50, nextChangeDelayMs))
    );
    return () => window.clearTimeout(timer);
  }, [visibilityRevision, visibilityScheduleKey]);

  useEffect(() => {
    const playbackRuntime = runtimeRef.current;
    if (!isPlaybackRuntime(playbackRuntime)) {
      return;
    }

    const activeItem =
      playbackRuntime.release.envelope.manifest.items[playbackRuntime.activeIndex];

    if (!activeItem) {
      return;
    }
    if (!isPlayerManifestItemPlayable(activeItem)) return;

    const timer = window.setTimeout(() => {
      if (activeItem.kind === "video" && !playbackReadyRef.current) {
        void handlePlaybackFailure(activeItem.id, "VIDEO_START_TIMEOUT");
        return;
      }
      void advancePlayback(activeItem.id);
    }, getPlayerItemPlaybackDurationMs(activeItem, durationOverrideMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    advancePlayback,
    durationOverrideMs,
    handlePlaybackFailure,
    playbackAttempt,
    playbackScheduleKey
  ]);

  useEffect(() => {
    let recoveryHeartbeatTimer: number | undefined;

    async function sendHeartbeat() {
      const currentRuntime = runtimeRef.current;
      const deviceToken = readStoredDeviceToken();
      if (
        !deviceToken ||
        (!isPlaybackRuntime(currentRuntime) && !isWaitingContentRuntime(currentRuntime))
      ) return;

      const storage = await readStorageEstimate();
      const playbackRuntime = isPlaybackRuntime(currentRuntime)
        ? currentRuntime
        : null;
      const activeItem = playbackRuntime
        ? playbackRuntime.release.envelope.manifest.items[playbackRuntime.activeIndex]
        : null;
      const reportedPlaybackError = lastPlaybackErrorRef.current;
      const automationReport = readAutomationReport(window.localStorage);
      const automationCapabilities = readAutomationCapabilities(window.localStorage);
      const syncPhase = !playbackRuntime
        ? null
        : playbackRuntime.state === "DOWNLOADING"
          ? "downloading"
          : playbackRuntime.state === "VERIFYING"
            ? "verifying"
            : playbackRuntime.state === "SWITCH_PENDING"
              ? "switch_pending"
              : "active";

      try {
        const response = await fetchPlayerOrigin("/api/player/heartbeat", {
          body: JSON.stringify({
            activeReleaseId: playbackRuntime?.release.envelope.manifest.releaseId ?? null,
            automationCapabilities,
            automationReport,
            currentItemId: activeItem?.id ?? null,
            desiredReleaseId: playbackRuntime
              ? playbackRuntime.pendingRelease?.envelope.manifest.releaseId ??
                playbackRuntime.release.envelope.device.desiredReleaseId ??
                playbackRuntime.release.envelope.manifest.releaseId
              : null,
            lastPlaybackError: reportedPlaybackError,
            networkState: navigator.onLine ? "online" : "offline",
            runtimeState: playbackRuntime?.state ?? "READY",
            storageQuotaBytes: storage.quota,
            storageUsedBytes: storage.usage,
            syncPhase
          }),
          headers: {
            Authorization: `Bearer ${deviceToken}`,
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        if (!response.ok) throw new Error("Heartbeat is geweigerd.");
        const heartbeat = await response.json().catch(() => null) as {
          automation?: unknown;
          ok?: boolean;
        } | null;
        if (heartbeat?.automation !== undefined) {
          storeAutomationSync(window.localStorage, heartbeat.automation);
        }
        if (automationReport) {
          clearAutomationReport(window.localStorage, automationReport);
          queueAutomationHeartbeatConfirmation(
            window.localStorage,
            automationReport,
            createAutomationEventId(),
            new Date().toISOString()
          );
        }
        if (
          reportedPlaybackError?.recoveredAt &&
          lastPlaybackErrorRef.current === reportedPlaybackError
        ) {
          lastPlaybackErrorRef.current = null;
          if (recoveryHeartbeatTimer) window.clearTimeout(recoveryHeartbeatTimer);
          recoveryHeartbeatTimer = window.setTimeout(() => {
            void sendHeartbeat();
          }, 1_000);
        }
      } catch {
        // Transport failures are reported by fetchPlayerOrigin; heartbeat retries continue.
      }
    }

    const initialHeartbeatTimer = window.setTimeout(() => {
      void sendHeartbeat();
    }, 1_000);
    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, 30_000);

    return () => {
      window.clearTimeout(initialHeartbeatTimer);
      window.clearInterval(heartbeatTimer);
      if (recoveryHeartbeatTimer) window.clearTimeout(recoveryHeartbeatTimer);
    };
  }, []);

  if (isPlaybackRuntime(runtime)) {
    return (
      <PlaybackView
        onFailure={handlePlaybackFailure}
        onEnded={handlePlaybackEnded}
        onReady={handlePlaybackReady}
        playbackAttempt={playbackAttempt}
        runtime={runtime}
        watchdogTimeoutMs={watchdogTimeoutMs}
      />
    );
  }

  if (runtime.state === "SYNCING") {
    return <SetupPanel stateLabel="SYNCING" title="Release ophalen" />;
  }

  if (runtime.state === "BOOTING") {
    return <SetupPanel stateLabel="BOOTING" title="Koppelcode maken" />;
  }

  if (runtime.state === "PAIRING_RETRY") {
    return (
      <SetupPanel
        detail={`${runtime.reason} De Player probeert het automatisch opnieuw; vernieuwen is niet nodig.`}
        stateLabel="PAIRING_RETRY"
        title="Nieuwe koppelcode voorbereiden"
      />
    );
  }

  if (runtime.state === "READY") {
    return <WaitingContentPanel runtime={runtime} />;
  }

  if (runtime.state === "ERROR_RECOVERABLE" || runtime.state === "DISABLED") {
    return <ProblemPanel problem={runtime} />;
  }

  return (
    <PairingPanel
      pairingCode={runtime.state === "UNPAIRED" ? runtime.pairingCode : undefined}
    />
  );
}

function PlaybackView({
  onFailure,
  onEnded,
  onReady,
  playbackAttempt,
  runtime,
  watchdogTimeoutMs
}: {
  onFailure: (itemId: string, code: PlaybackFailureCode) => void;
  onEnded: (itemId: string) => void;
  onReady: (itemId: string) => void;
  playbackAttempt: number;
  runtime: PlaybackRuntime;
  watchdogTimeoutMs: number;
}) {
  const manifest = runtime.release.envelope.manifest;
  const activeItem = manifest.items[runtime.activeIndex] ?? manifest.items[0];

  if (!activeItem || !isPlayerManifestItemPlayable(activeItem)) {
    return (
      <ProblemPanel
        problem={{
          state: "ERROR_RECOVERABLE",
          error: {
            cause:
              "Het release manifest bevat nu geen ingeschakeld item binnen het zichtbaarheidvenster.",
            effect:
              "De player toont geen uitgeschakelde of buiten het venster geplande content.",
            recovery:
              "Controleer de itemplanning of publiceer een release met minimaal één zichtbaar ready item."
          }
        }}
      />
    );
  }

  const presentation = resolvePlayerItemPresentation(activeItem);
  return (
    <main className="playback-shell" aria-label="VeyoCast player">
      <section
        className="playback-stage"
        aria-label="Release playback"
        style={
          presentation.backgroundColor
            ? { backgroundColor: presentation.backgroundColor }
            : undefined
        }
      >
        <PlaybackScene
          item={activeItem}
          onEnded={onEnded}
          onFailure={onFailure}
          onReady={onReady}
          playbackAttempt={playbackAttempt}
          watchdogTimeoutMs={watchdogTimeoutMs}
        />
        <img
          alt=""
          aria-hidden="true"
          className="playback-brand-mark"
          data-testid="player-brand-mark"
          src="/brand/veyocast-logo-inverse.svg"
        />
      </section>
      <aside hidden aria-label="Player diagnostics">
        <span>{runtime.state}</span>
        <span>{manifest.label}</span>
        <span>Item {runtime.activeIndex + 1} van {manifest.items.length}</span>
        <span>{runtime.release.envelope.diagnostics.syncStatus}</span>
        <span>{runtime.syncMessage}</span>
      </aside>
    </main>
  );
}

type PlaybackSceneEntry = {
  item: PlayerManifestItem;
  key: string;
};

function PlaybackScene({
  item,
  onEnded,
  onFailure,
  onReady,
  playbackAttempt,
  watchdogTimeoutMs
}: {
  item: PlayerManifestItem;
  onEnded: (itemId: string) => void;
  onFailure: (itemId: string, code: PlaybackFailureCode) => void;
  onReady: (itemId: string) => void;
  playbackAttempt: number;
  watchdogTimeoutMs: number;
}) {
  const requestedKey = `${item.id}:${playbackAttempt}`;
  const requestedSceneRef = useRef<PlaybackSceneEntry>({
    item,
    key: requestedKey
  });
  requestedSceneRef.current = { item, key: requestedKey };
  const transitionTimerRef = useRef<number | null>(null);
  const [scene, setScene] = useState<{
    current: PlaybackSceneEntry;
    outgoing?: PlaybackSceneEntry;
    transition: "cut" | "crossfade" | "wipe";
  }>(() => ({
    current: requestedSceneRef.current,
    transition: resolvePlayerItemPresentation(item).transition
  }));

  useLayoutEffect(() => {
    if (scene.current.key === requestedKey) return;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    const requestedScene = requestedSceneRef.current;
    const requestedTransition =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "cut"
        : resolvePlayerItemPresentation(requestedScene.item).transition;

    if (requestedTransition === "cut") {
      setScene({
        current: requestedScene,
        transition: "cut"
      });
      return;
    }

    setScene((currentScene) => ({
      current: requestedScene,
      outgoing: currentScene.current,
      transition: requestedTransition
    }));
    transitionTimerRef.current = window.setTimeout(
      () => {
        setScene((currentScene) => ({
          current: currentScene.current,
          transition: currentScene.transition
        }));
        transitionTimerRef.current = null;
      },
      requestedTransition === "crossfade" ? 480 : 520
    );
  }, [requestedKey, scene.current.key]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    []
  );

  const currentClassName = {
    crossfade: styles.crossfade,
    cut: styles.cut,
    wipe: styles.wipe
  }[scene.transition];

  return (
    <div className={styles.transitionStack}>
      {scene.outgoing ? (
        <div
          aria-hidden="true"
          className={`${styles.scene} ${
            scene.transition === "crossfade" ? styles.crossfadeOutgoing : ""
          }`}
          data-player-transition-outgoing={scene.transition}
          key={scene.outgoing.key}
        >
          <PlaybackMedia
            item={scene.outgoing.item}
            onEnded={onEnded}
            onFailure={onFailure}
            onReady={onReady}
            passive
            watchdogTimeoutMs={watchdogTimeoutMs}
          />
        </div>
      ) : null}
      <div
        className={`${styles.scene} ${styles.current} ${currentClassName}`}
        data-player-transition={scene.transition}
        key={scene.current.key}
      >
        <PlaybackMedia
          item={scene.current.item}
          onEnded={onEnded}
          onFailure={onFailure}
          onReady={onReady}
          watchdogTimeoutMs={watchdogTimeoutMs}
        />
      </div>
    </div>
  );
}

export function PlaybackMedia({
  item,
  onEnded,
  onFailure,
  onPlaybackStateChange,
  onReady,
  passive = false,
  watchdogTimeoutMs
}: {
  item: PlayerManifestItem;
  onEnded: (itemId: string) => void;
  onFailure: (itemId: string, code: PlaybackFailureCode) => void;
  onPlaybackStateChange?: (state: "ended" | "paused" | "playing") => void;
  onReady: (itemId: string) => void;
  passive?: boolean;
  watchdogTimeoutMs: number;
}) {
  const presentation = resolvePlayerItemPresentation(item);
  const className = `playback-media playback-media--${item.fitMode}`;
  const mediaStyle = {
    ...(presentation.backgroundColor
      ? { backgroundColor: presentation.backgroundColor }
      : {}),
    objectPosition: `${presentation.cropFocusX * 100}% ${presentation.cropFocusY * 100}%`
  };
  const failureReportedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const isPausedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const lastCurrentTimeRef = useRef(0);
  const lastProgressAtRef = useRef(Date.now());
  const lastSignalRef = useRef<"stalled" | "waiting" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const reportFailure = useCallback((code: PlaybackFailureCode) => {
    if (passive || failureReportedRef.current) return;
    failureReportedRef.current = true;
    onFailure(item.id, code);
  }, [item.id, onFailure, passive]);

  useEffect(() => {
    if (item.kind !== "video" || passive) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (hasEndedRef.current) return;
      if (isPausedRef.current) return;
      if (!hasStartedRef.current && now - startedAt >= watchdogTimeoutMs) {
        reportFailure("VIDEO_START_TIMEOUT");
        return;
      }
      if (hasStartedRef.current && now - lastProgressAtRef.current >= watchdogTimeoutMs) {
        reportFailure(
          lastSignalRef.current ? "VIDEO_STALLED_TIMEOUT" : "VIDEO_PROGRESS_TIMEOUT"
        );
      }
    }, Math.min(1_000, Math.max(125, Math.floor(watchdogTimeoutMs / 2))));
    return () => window.clearInterval(interval);
  }, [item.kind, passive, reportFailure, watchdogTimeoutMs]);

  const completeVideoPlayback = useCallback(() => {
    if (passive || hasEndedRef.current) return;
    hasEndedRef.current = true;
    isPausedRef.current = false;
    hasStartedRef.current = true;
    videoRef.current?.pause();
    onPlaybackStateChange?.("ended");
    onReady(item.id);
    onEnded(item.id);
  }, [item.id, onEnded, onPlaybackStateChange, onReady, passive]);

  useEffect(() => {
    const video = videoRef.current;
    if (item.kind !== "video" || !video) return;
    video.volume = presentation.volumePercent / 100;
    if (
      video.readyState >= HTMLMediaElement.HAVE_METADATA &&
      presentation.trimStartSeconds > 0
    ) {
      video.currentTime = presentation.trimStartSeconds;
    }
  }, [
    item.kind,
    presentation.trimStartSeconds,
    presentation.volumePercent
  ]);

  if (item.kind === "video") {
    return (
      <video
        aria-label={presentation.accessibilityName}
        autoPlay
        className={className}
        controls={false}
        controlsList="nodownload nofullscreen noplaybackrate"
        data-testid="player-video"
        disablePictureInPicture
        muted={item.muted}
        onEnded={completeVideoPlayback}
        onLoadedMetadata={(event) => {
          event.currentTarget.volume = presentation.volumePercent / 100;
          if (presentation.trimStartSeconds > 0) {
            event.currentTarget.currentTime = presentation.trimStartSeconds;
          }
        }}
        onError={() => reportFailure("VIDEO_ERROR")}
        onPause={() => {
          if (passive || hasEndedRef.current) return;
          isPausedRef.current = true;
          onPlaybackStateChange?.("paused");
        }}
        onPlaying={() => {
          if (passive) return;
          isPausedRef.current = false;
          hasStartedRef.current = true;
          lastProgressAtRef.current = Date.now();
          lastSignalRef.current = null;
          onPlaybackStateChange?.("playing");
          onReady(item.id);
        }}
        onStalled={() => {
          if (passive) return;
          lastSignalRef.current = "stalled";
        }}
        onTimeUpdate={(event) => {
          if (passive) return;
          const currentTime = event.currentTarget.currentTime;
          if (
            presentation.trimEndSeconds !== null &&
            currentTime >= presentation.trimEndSeconds
          ) {
            completeVideoPlayback();
            return;
          }
          if (currentTime > lastCurrentTimeRef.current + 0.01) {
            lastCurrentTimeRef.current = currentTime;
            lastProgressAtRef.current = Date.now();
            lastSignalRef.current = null;
          }
        }}
        onWaiting={() => {
          if (passive) return;
          lastSignalRef.current = "waiting";
        }}
        playsInline
        poster={item.source.posterUrl}
        preload="auto"
        ref={videoRef}
        style={mediaStyle}
        tabIndex={-1}
      >
        {item.source.url ? (
          <source key={item.source.url} src={item.source.url} type={item.source.mimeType} />
        ) : null}
      </video>
    );
  }

  return (
    <img
      alt={presentation.accessibilityName}
      className={className}
      onError={() => reportFailure("IMAGE_ERROR")}
      onLoad={() => {
        if (!passive) onReady(item.id);
      }}
      src={item.source.url}
      style={mediaStyle}
    />
  );
}

function PairingPanel({
  pairingCode
}: {
  pairingCode?: string;
}) {
  const [connectionLabel, setConnectionLabel] = useState("Internet controleren…");
  const [deviceLabel, setDeviceLabel] = useState("Web Player");

  useEffect(() => {
    const updateConnection = (online = readPlayerConnectivity()) =>
      setConnectionLabel(online ? "Verbonden" : "Geen internetverbinding");
    const updateBrowserConnection = () =>
      reportPlayerConnectivity(navigator.onLine);
    const updatePlayerConnection = (event: Event) =>
      updateConnection((event as PlayerConnectivityEvent).detail.online);
    setDeviceLabel(detectDeviceLabel(navigator.userAgent));
    updateConnection();
    window.addEventListener("online", updateBrowserConnection);
    window.addEventListener("offline", updateBrowserConnection);
    window.addEventListener(playerConnectivityEventName, updatePlayerConnection);
    return () => {
      window.removeEventListener("online", updateBrowserConnection);
      window.removeEventListener("offline", updateBrowserConnection);
      window.removeEventListener(
        playerConnectivityEventName,
        updatePlayerConnection
      );
    };
  }, []);

  return (
    <main className="runtime-shell runtime-shell--pairing" aria-label="VeyoCast player setup">
      <SetupBackdrop />
      <section className="pairing-stage" aria-labelledby="player-title">
        <PairingBrandScene />
        <div className="pairing-stage__primary">
          <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
          <div className="pairing-heading">
            <p className="runtime-kicker"><span className="pairing-live-dot" aria-hidden="true" /> Klaar om te koppelen</p>
            <h1 className="runtime-title" id="player-title">Koppel dit scherm aan VeyoCast</h1>
            <p className="runtime-copy">Open <strong>Schermen</strong> in VeyoCast Control, kies <strong>Scherm koppelen</strong> en voer deze code in.</p>
          </div>
          <div className="pairing-code-group">
            <span className="pairing-code-label">Koppelcode</span>
            <div className="player-pairing-code" aria-label="Pairingcode">{pairingCode ?? demoPairingCode}</div>
            <p>De code is tijdelijk en alleen bruikbaar voor dit scherm.</p>
          </div>
        </div>
        <aside className="pairing-stage__status" aria-label="Device setupstatus">
          <div className="pairing-signal" aria-hidden="true"><span /><span /><span /><i /></div>
          <div>
            <p className="pairing-status-eyebrow">Schermstatus</p>
            <h2>Wachten op VeyoCast Control</h2>
            <p>Zodra de code is bevestigd, haalt dit scherm veilig de toegewezen release op.</p>
          </div>
          <dl className="player-diagnostics">
            <div><dt>Apparaat</dt><dd>{deviceLabel}</dd></div>
            <div><dt>Internet</dt><dd><span className="pairing-live-dot" aria-hidden="true" /> {connectionLabel}</dd></div>
            <div><dt>Player</dt><dd>{VEYOCAST_APPS.player.name} · versie 1.0</dd></div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

function SetupPanel({
  detail,
  stateLabel,
  title
}: {
  detail?: string;
  stateLabel: "BOOTING" | "PAIRING_RETRY" | "SYNCING";
  title: string;
}) {
  const visibleStateLabel = {
    BOOTING: "Player starten",
    PAIRING_RETRY: "Automatisch herstellen",
    SYNCING: "Synchroniseren"
  }[stateLabel];

  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast player sync">
      <SetupBackdrop />
      <section className="runtime-panel runtime-panel--branded" aria-labelledby="player-title">
        <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
        <p className="runtime-kicker">{visibleStateLabel}</p>
        <h1 className="runtime-title" id="player-title">
          {title}
        </h1>
        <p className="runtime-copy">
          {detail ?? (stateLabel === "BOOTING"
            ? "De player vraagt een tijdelijke, veilige koppelcode aan. Het geheime device-token blijft op dit apparaat."
            : "De player haalt het toegewezen release manifest op. Playback start zodra de online release compleet is gelezen.")}
        </p>
      </section>
    </main>
  );
}

function ProblemPanel({
  problem
}: {
  problem: Extract<RuntimeView, { state: "ERROR_RECOVERABLE" | "DISABLED" }>;
}) {
  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast player status">
      <SetupBackdrop />
      <section className="runtime-panel runtime-panel--branded" aria-labelledby="player-title">
        <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
        <p className="runtime-kicker">{problem.state}</p>
        <h1 className="runtime-title" id="player-title">
          Playback wacht
        </h1>
        <div className="runtime-problem" role="status">
          <p>
            <strong>Oorzaak:</strong> {problem.error.cause}
          </p>
          <p>
            <strong>Effect:</strong> {problem.error.effect}
          </p>
          <p>
            <strong>Herstel:</strong> {problem.error.recovery}
          </p>
        </div>
      </section>
    </main>
  );
}

function WaitingContentPanel({ runtime }: { runtime: WaitingContentRuntime }) {
  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast player gereed">
      <SetupBackdrop />
      <section className="runtime-panel runtime-panel--branded" aria-labelledby="player-title">
        <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
        <p className="runtime-kicker"><span className="pairing-live-dot" aria-hidden="true" /> Player gekoppeld</p>
        <h1 className="runtime-title" id="player-title">Wachten op content</h1>
        <p className="runtime-copy">
          <strong>{runtime.device.screenName}</strong> is veilig gekoppeld. Publiceer een playlist vanuit VeyoCast Control; deze Player controleert automatisch op nieuwe content.
        </p>
        <div className="runtime-problem" role="status">
          <p><strong>Status:</strong> online en gereed</p>
          <p><strong>Synchronisatie:</strong> iedere vijf seconden totdat de eerste release beschikbaar is</p>
        </div>
      </section>
    </main>
  );
}

function PairingBrandScene() {
  return (
    <div className="pairing-brand-scene" aria-hidden="true">
      <span className="pairing-brand-scene__track pairing-brand-scene__track--outer" />
      <span className="pairing-brand-scene__track pairing-brand-scene__track--inner" />
      <img alt="" src="/brand/veyocast-icon-primary.svg" />
      <span className="pairing-brand-accent pairing-brand-accent--orange" />
      <span className="pairing-brand-accent pairing-brand-accent--blue" />
      <span className="pairing-brand-accent pairing-brand-accent--paper" />
    </div>
  );
}

function SetupBackdrop() {
  return (
    <div className="setup-backdrop" aria-hidden="true">
      <span className="setup-orbit setup-orbit--one" />
      <span className="setup-orbit setup-orbit--two" />
      <span className="setup-orbit setup-orbit--three" />
    </div>
  );
}

function detectDeviceLabel(userAgent: string) {
  if (/Web0S|WebOS/i.test(userAgent)) return "LG webOS signage";
  if (/Tizen/i.test(userAgent)) return "Tizen signage";
  if (/Android/i.test(userAgent)) return "Android signage";
  return "Web Player";
}

function isPlaybackRuntime(runtime: RuntimeView): runtime is PlaybackRuntime {
  return [
    "PLAYING",
    "DOWNLOADING",
    "VERIFYING",
    "SWITCH_PENDING",
    "OFFLINE_PLAYING"
  ].includes(runtime.state);
}

function resolveInitialPlaybackIndex(release: HydratedPlayerRelease) {
  return Math.max(
    0,
    findFirstPlayableItemIndex(release.envelope.manifest.items)
  );
}

function isWaitingContentRuntime(
  runtime: RuntimeView
): runtime is WaitingContentRuntime {
  return runtime.state === "READY";
}

function isWaitingContentEnvelope(
  body: PlayerManifestEnvelope | PlayerManifestProblem | PlayerWaitingContentEnvelope
): body is PlayerWaitingContentEnvelope {
  return body.state === "READY" && !("manifest" in body) && "device" in body;
}

function withSyncDiagnostics(
  envelope: PlayerManifestEnvelope,
  syncStatus: PlayerManifestEnvelope["diagnostics"]["syncStatus"],
  nextSyncReason: string
): PlayerManifestEnvelope {
  return {
    ...envelope,
    diagnostics: {
      ...envelope.diagnostics,
      syncStatus,
      nextSyncReason
    }
  };
}

function readStoredDeviceToken() {
  try {
    return readAndMigrateStorageValue(
      window.localStorage,
      localStorageDeviceTokenKey,
      previousPlayerStorageKey("deviceToken")
    );
  } catch {
    return null;
  }
}

function writeStoredDeviceToken(deviceToken: string) {
  try {
    window.localStorage.setItem(localStorageDeviceTokenKey, deviceToken);
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

type PairingResponse = {
  deviceToken?: string;
  expiresAt?: string;
  error?: PlayerManifestProblem["error"];
  live?: boolean;
  pairingCode?: string;
  retryAfterSeconds?: number;
};

function readOrCreatePlayerInstanceId() {
  if (volatilePlayerInstanceId) return volatilePlayerInstanceId;
  try {
    const stored = window.localStorage.getItem(localStoragePlayerInstanceKey);
    if (stored && /^[a-f0-9-]{20,80}$/i.test(stored)) {
      volatilePlayerInstanceId = stored.toLowerCase();
      return volatilePlayerInstanceId;
    }
  } catch {
    // Continue with a volatile identifier in locked-down kiosk contexts.
  }

  const instanceId = createPlayerInstanceId();
  volatilePlayerInstanceId = instanceId;
  try {
    window.localStorage.setItem(localStoragePlayerInstanceKey, instanceId);
  } catch {
    // The volatile identifier still prevents repeated requests in this page session.
  }
  return instanceId;
}

function createPlayerInstanceId() {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function createAutomationEventId() {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function readPairingProvisionDelay() {
  try {
    const stored = Number(
      window.localStorage.getItem(localStoragePairingProvisionAfterKey)
    );
    return resolvePersistedPairingDelay(stored);
  } catch {
    return 0;
  }
}

function writePairingProvisionAfter(timestamp: number) {
  try {
    window.localStorage.setItem(
      localStoragePairingProvisionAfterKey,
      String(Math.ceil(timestamp))
    );
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

function clearPairingProvisionAfter() {
  try {
    window.localStorage.removeItem(localStoragePairingProvisionAfterKey);
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

function pairingRetryDelayMs(
  response: Response,
  body: PairingResponse,
  retryAttempt: number
) {
  if (response.status !== 429) {
    return transientPairingRetryDelayMs(retryAttempt);
  }
  const headerSeconds = Number(response.headers.get("Retry-After"));
  const bodySeconds = Number(body.retryAfterSeconds);
  const seconds = Number.isFinite(headerSeconds) && headerSeconds > 0
    ? headerSeconds
    : Number.isFinite(bodySeconds) && bodySeconds > 0
      ? bodySeconds
      : 600;
  return Math.min(600_000, Math.max(1_000, Math.ceil(seconds * 1_000)));
}

function transientPairingRetryDelayMs(retryAttempt: number) {
  return Math.min(60_000, 5_000 * 2 ** Math.min(4, retryAttempt));
}

function readStoredPairing() {
  try {
    const pairingCode = readAndMigrateStorageValue(
      window.localStorage,
      localStoragePairingCodeKey,
      previousPlayerStorageKey("pairingCode")
    );
    const expiresAt = readAndMigrateStorageValue(
      window.localStorage,
      localStoragePairingExpiryKey,
      previousPlayerStorageKey("pairingExpiresAt")
    );

    return pairingCode && expiresAt ? { expiresAt, pairingCode } : null;
  } catch {
    return null;
  }
}

function writeStoredPairing(pairing: PairingResponse) {
  if (!pairing.deviceToken || !pairing.expiresAt || !pairing.pairingCode) {
    return;
  }

  try {
    window.localStorage.setItem(localStorageDeviceTokenKey, pairing.deviceToken);
    window.localStorage.setItem(localStoragePairingCodeKey, pairing.pairingCode);
    window.localStorage.setItem(localStoragePairingExpiryKey, pairing.expiresAt);
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

function clearStoredPairing() {
  try {
    removeCurrentAndPreviousStorageValues(
      window.localStorage,
      localStoragePairingCodeKey,
      previousPlayerStorageKey("pairingCode")
    );
    removeCurrentAndPreviousStorageValues(
      window.localStorage,
      localStoragePairingExpiryKey,
      previousPlayerStorageKey("pairingExpiresAt")
    );
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

function clearStoredPlayerIdentity() {
  try {
    removeCurrentAndPreviousStorageValues(
      window.localStorage,
      localStorageDeviceTokenKey,
      previousPlayerStorageKey("deviceToken")
    );
    clearStoredPairing();
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

async function confirmPairingClaim(deviceToken: string) {
  try {
    const response = await fetchPlayerOrigin("/api/player/heartbeat", {
      body: JSON.stringify({
        activeReleaseId: null,
        desiredReleaseId: null,
        networkState: navigator.onLine ? "online" : "offline",
        runtimeState: "READY",
        syncPhase: null
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readReloadTimestamps(now: number) {
  try {
    const parsed = JSON.parse(
      readAndMigrateStorageValue(
        window.localStorage,
        localStorageReloadTimestampsKey,
        previousPlayerStorageKey("reloadTimestamps")
      ) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is number =>
        Number.isFinite(value) &&
        value > now - playerReloadCooldownMs &&
        value <= now
    );
  } catch {
    return [];
  }
}

function writeReloadTimestamps(timestamps: number[]) {
  try {
    window.localStorage.setItem(
      localStorageReloadTimestampsKey,
      JSON.stringify(timestamps)
    );
  } catch {
    // Recovery still degrades safely when kiosk storage is unavailable.
  }
}

async function readStorageEstimate() {
  try {
    return navigator.storage?.estimate
      ? await navigator.storage.estimate()
      : { quota: undefined, usage: undefined };
  } catch {
    return { quota: undefined, usage: undefined };
  }
}
