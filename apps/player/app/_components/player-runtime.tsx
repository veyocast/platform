"use client";

/* eslint-disable @next/next/no-img-element -- Player media URLs come from release manifests and must render directly. */

import { VEYOCAST_APPS } from "@veyocast/config";
import { useCallback, useEffect, useRef, useState } from "react";

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
  getPlaybackDurationMs,
  localStorageDeviceTokenKey,
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
import { reportPlayerConnectivity } from "../_lib/player-connectivity";

const demoPairingCode = "VYO 482";
const localStoragePairingCodeKey = "veyocast.player.pairingCode";
const localStoragePairingExpiryKey = "veyocast.player.pairingExpiresAt";
const localStorageReloadTimestampsKey = "veyocast.player.reloadTimestamps";
const defaultWatchdogTimeoutMs = 12_000;
const defaultManifestSyncIntervalMs = 60_000;
const waitingContentSyncIntervalMs = 5_000;
const maximumManifestSyncBackoffMs = 5 * 60_000;
const pairingClaimPollIntervalMs = 2_000;

type PlaybackFailureCode =
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
  | { state: "UNPAIRED"; pairingCode?: string; expiresAt?: string }
  | { state: "SYNCING"; deviceToken: string }
  | WaitingContentRuntime
  | PlaybackRuntime
  | { state: "ERROR_RECOVERABLE" | "DISABLED"; error: PlayerManifestProblem["error"] };

export function PlayerRuntime() {
  const [runtime, setRuntime] = useState<RuntimeView>({ state: "BOOTING" });
  const [durationOverrideMs, setDurationOverrideMs] = useState<number | null>(null);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
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

    advancingRef.current = true;
    try {
      const itemCount = snapshot.release.envelope.manifest.items.length;
      const nextIndex = (snapshot.activeIndex + 1) % itemCount;
      const deviceToken = readStoredDeviceToken();

      if (
        snapshot.state === "SWITCH_PENDING" &&
        snapshot.pendingRelease &&
        deviceToken &&
        nextIndex === 0 &&
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

      setPlaybackAttempt(0);
      playbackReadyRef.current = false;
      setRuntime((currentRuntime) => {
        if (!isPlaybackRuntime(currentRuntime)) return currentRuntime;
        const currentItem =
          currentRuntime.release.envelope.manifest.items[currentRuntime.activeIndex];
        if (!currentItem || currentItem.id !== itemId) return currentRuntime;

        const currentNextIndex =
          (currentRuntime.activeIndex + 1) %
          currentRuntime.release.envelope.manifest.items.length;
        if (
          currentRuntime.state === "SWITCH_PENDING" &&
          currentRuntime.pendingRelease &&
          currentNextIndex === 0
        ) {
          return {
            activeIndex: 0,
            release: currentRuntime.pendingRelease,
            state: "PLAYING",
            syncMessage: "Nieuwe release is op loopgrens actief gemaakt."
          };
        }

        return {
          ...currentRuntime,
          activeIndex: currentNextIndex,
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
        activeIndex: 0,
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
  }, []);

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

  const handlePlaybackEnded = useCallback((itemId: string) => {
    consecutiveFailuresRef.current = 0;
    void advancePlayback(itemId);
  }, [advancePlayback]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get("deviceToken");
    const queryDurationMs = Number(searchParams.get("durationMs"));
    const queryWatchdogMs = Number(searchParams.get("watchdogMs"));
    const querySyncMs = Number(searchParams.get("syncMs"));
    const manifestSyncIntervalMs =
      searchParams.has("syncMs") && Number.isFinite(querySyncMs)
        ? Math.max(250, Math.min(querySyncMs, defaultManifestSyncIntervalMs))
        : defaultManifestSyncIntervalMs;

    setDurationOverrideMs(Number.isFinite(queryDurationMs) ? queryDurationMs : null);
    setWatchdogTimeoutMs(
      Number.isFinite(queryWatchdogMs)
        ? Math.max(250, Math.min(queryWatchdogMs, 60_000))
        : defaultWatchdogTimeoutMs
    );

    const deviceToken = queryToken ?? readStoredDeviceToken();

    if (!deviceToken) {
      let cancelled = false;
      let expiryTimer: number | undefined;
      let pollTimer: number | undefined;

      async function provisionPairing() {
        try {
          const response = await fetch("/api/player/pairing", {
            cache: "no-store",
            method: "POST"
          });
          reportPlayerConnectivity(true);
          const body = (await response.json()) as PairingResponse;

          if (cancelled) {
            return;
          }

          if (!response.ok) {
            setRuntime({
              state: "ERROR_RECOVERABLE",
              error: {
                cause: "Er kon geen veilige koppelcode worden gemaakt.",
                effect: "De Player kan nog niet aan een scherm worden gekoppeld.",
                recovery: "Controleer de verbinding en vernieuw daarna de Player."
              }
            });
            return;
          }

          if (!body.live || !body.deviceToken) {
            setRuntime({ pairingCode: demoPairingCode, state: "UNPAIRED" });
            return;
          }

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
          reportPlayerConnectivity(false);
          setRuntime({
            state: "ERROR_RECOVERABLE",
            error: {
              cause: "De koppelservice is niet bereikbaar.",
              effect: "De Player kan nog niet aan een scherm worden gekoppeld.",
              recovery: "Herstel de verbinding en vernieuw daarna de Player."
            }
          });
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

      void provisionPairing();

      return () => {
        cancelled = true;
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
          activeIndex: 0,
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
        const response = await fetch(
          "/api/player/manifest",
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${activeDeviceToken}`
            }
          }
        );
        reportPlayerConnectivity(true);
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
            activeIndex: 0,
            release: hydratedRelease,
            state: "PLAYING",
            syncMessage: "Release online geverifieerd en actief."
          };
        });
        syncSucceeded = true;
      } catch (error) {
        if (!cancelled) {
          reportPlayerConnectivity(false);
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

  useEffect(() => {
    if (!isPlaybackRuntime(runtime)) {
      return;
    }

    const activeItem = runtime.release.envelope.manifest.items[runtime.activeIndex];

    if (!activeItem) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (activeItem.kind === "video" && !playbackReadyRef.current) {
        void handlePlaybackFailure(activeItem.id, "VIDEO_START_TIMEOUT");
        return;
      }
      void advancePlayback(activeItem.id);
    }, getPlaybackDurationMs(activeItem, durationOverrideMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    advancePlayback,
    durationOverrideMs,
    handlePlaybackFailure,
    playbackAttempt,
    runtime
  ]);

  useEffect(() => {
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
        await fetch("/api/player/heartbeat", {
          body: JSON.stringify({
            activeReleaseId: playbackRuntime?.release.envelope.manifest.releaseId ?? null,
            currentItemId: activeItem?.id ?? null,
            desiredReleaseId: playbackRuntime
              ? playbackRuntime.pendingRelease?.envelope.manifest.releaseId ??
                playbackRuntime.release.envelope.device.desiredReleaseId ??
                playbackRuntime.release.envelope.manifest.releaseId
              : null,
            lastPlaybackError: lastPlaybackErrorRef.current,
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
        reportPlayerConnectivity(true);
      } catch {
        reportPlayerConnectivity(false);
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
    };
  }, []);

  if (isPlaybackRuntime(runtime)) {
    return (
      <PlaybackView
        onEnded={handlePlaybackEnded}
        onFailure={handlePlaybackFailure}
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
  onEnded,
  onFailure,
  onReady,
  playbackAttempt,
  runtime,
  watchdogTimeoutMs
}: {
  onEnded: (itemId: string) => void;
  onFailure: (itemId: string, code: PlaybackFailureCode) => void;
  onReady: (itemId: string) => void;
  playbackAttempt: number;
  runtime: PlaybackRuntime;
  watchdogTimeoutMs: number;
}) {
  const manifest = runtime.release.envelope.manifest;
  const activeItem = manifest.items[runtime.activeIndex] ?? manifest.items[0];

  if (!activeItem) {
    return (
      <ProblemPanel
        problem={{
          state: "ERROR_RECOVERABLE",
          error: {
            cause: "Het release manifest bevat geen afspeelbare items.",
            effect: "De player kan geen online loop starten.",
            recovery: "Publiceer een release met minimaal een ready image- of video-item."
          }
        }}
      />
    );
  }

  return (
    <main className="playback-shell" aria-label="VeyoCast player">
      <section className="playback-stage" aria-label="Release playback">
        <PlaybackMedia
          key={`${activeItem.id}:${playbackAttempt}`}
          item={activeItem}
          onEnded={onEnded}
          onFailure={onFailure}
          onReady={onReady}
          watchdogTimeoutMs={watchdogTimeoutMs}
        />
        <div className="playback-scrim" aria-hidden="true" />
        <div className="playback-now">
          <p>{runtime.release.envelope.device.screenName}</p>
          <h1>{activeItem.title}</h1>
          <span>{manifest.label}</span>
        </div>
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

function PlaybackMedia({
  item,
  onEnded,
  onFailure,
  onReady,
  watchdogTimeoutMs
}: {
  item: PlayerManifestItem;
  onEnded: (itemId: string) => void;
  onFailure: (itemId: string, code: PlaybackFailureCode) => void;
  onReady: (itemId: string) => void;
  watchdogTimeoutMs: number;
}) {
  const className = `playback-media playback-media--${item.fitMode}`;
  const failureReportedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const lastCurrentTimeRef = useRef(0);
  const lastProgressAtRef = useRef(Date.now());
  const lastSignalRef = useRef<"stalled" | "waiting" | null>(null);

  const reportFailure = useCallback((code: PlaybackFailureCode) => {
    if (failureReportedRef.current) return;
    failureReportedRef.current = true;
    onFailure(item.id, code);
  }, [item.id, onFailure]);

  useEffect(() => {
    if (item.kind !== "video") return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
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
  }, [item.kind, reportFailure, watchdogTimeoutMs]);

  if (item.kind === "video") {
    return (
      <video
        aria-label={item.title}
        autoPlay
        className={className}
        data-testid="player-video"
        muted={item.muted}
        onEnded={() => onEnded(item.id)}
        onError={() => reportFailure("VIDEO_ERROR")}
        onPlaying={() => {
          hasStartedRef.current = true;
          lastProgressAtRef.current = Date.now();
          lastSignalRef.current = null;
          onReady(item.id);
        }}
        onStalled={() => {
          lastSignalRef.current = "stalled";
        }}
        onTimeUpdate={(event) => {
          const currentTime = event.currentTarget.currentTime;
          if (currentTime > lastCurrentTimeRef.current + 0.01) {
            lastCurrentTimeRef.current = currentTime;
            lastProgressAtRef.current = Date.now();
            lastSignalRef.current = null;
          }
        }}
        onWaiting={() => {
          lastSignalRef.current = "waiting";
        }}
        playsInline
        poster={item.source.posterUrl}
        preload="metadata"
      >
        {item.source.url ? (
          <source key={item.source.url} src={item.source.url} type={item.source.mimeType} />
        ) : null}
      </video>
    );
  }

  return (
    <img
      alt={item.title}
      className={className}
      onError={() => reportFailure("IMAGE_ERROR")}
      onLoad={() => onReady(item.id)}
      src={item.source.url}
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
    const updateConnection = () => setConnectionLabel(navigator.onLine ? "Verbonden" : "Geen internetverbinding");
    setDeviceLabel(detectDeviceLabel(navigator.userAgent));
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
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
  stateLabel,
  title
}: {
  stateLabel: "BOOTING" | "SYNCING";
  title: string;
}) {
  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast player sync">
      <SetupBackdrop />
      <section className="runtime-panel runtime-panel--branded" aria-labelledby="player-title">
        <img alt="VeyoCast" className="pairing-logo" src="/brand/veyocast-logo-inverse.svg" />
        <p className="runtime-kicker">{stateLabel}</p>
        <h1 className="runtime-title" id="player-title">
          {title}
        </h1>
        <p className="runtime-copy">
          {stateLabel === "BOOTING"
            ? "De player vraagt een tijdelijke, veilige koppelcode aan. Het geheime device-token blijft op dit apparaat."
            : "De player haalt het toegewezen release manifest op. Playback start zodra de online release compleet is gelezen."}
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
  live: boolean;
  pairingCode: string;
};

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
  if (!pairing.deviceToken || !pairing.expiresAt) {
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
    const response = await fetch("/api/player/heartbeat", {
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
    reportPlayerConnectivity(true);
    return response.ok;
  } catch {
    reportPlayerConnectivity(false);
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
