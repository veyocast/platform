"use client";

/* eslint-disable @next/next/no-img-element -- Player media URLs come from release manifests and must render directly. */

import { CASTIVO_APPS } from "@castivo/config";
import { useEffect, useRef, useState } from "react";

import {
  activateRelease,
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
  getPlaybackDurationMs,
  localStorageDeviceTokenKey,
  type PlayerManifestEnvelope,
  type PlayerManifestItem,
  type PlayerManifestProblem,
  type PlayerRuntimeState
} from "../_lib/player-manifest";

const demoPairingCode = "CTV 482";
const localStoragePairingCodeKey = "castivo.player.pairingCode";
const localStoragePairingExpiryKey = "castivo.player.pairingExpiresAt";

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

type RuntimeView =
  | { state: "BOOTING" }
  | { state: "UNPAIRED"; pairingCode?: string; expiresAt?: string }
  | { state: "SYNCING"; deviceToken: string }
  | PlaybackRuntime
  | { state: "ERROR_RECOVERABLE" | "DISABLED"; error: PlayerManifestProblem["error"] };

export function PlayerRuntime() {
  const [runtime, setRuntime] = useState<RuntimeView>({ state: "BOOTING" });
  const [durationOverrideMs, setDurationOverrideMs] = useState<number | null>(null);
  const runtimeRef = useRef<RuntimeView>(runtime);
  runtimeRef.current = runtime;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get("deviceToken");
    const queryDurationMs = Number(searchParams.get("durationMs"));

    setDurationOverrideMs(Number.isFinite(queryDurationMs) ? queryDurationMs : null);

    const deviceToken = queryToken ?? readStoredDeviceToken();

    if (!deviceToken) {
      let cancelled = false;
      let pollTimer: number | undefined;

      async function provisionPairing() {
        try {
          const response = await fetch("/api/player/pairing", {
            cache: "no-store",
            method: "POST"
          });
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

          writeStoredPairing(body);
          setRuntime({
            expiresAt: body.expiresAt,
            pairingCode: body.pairingCode,
            state: "UNPAIRED"
          });

          pollTimer = window.setInterval(() => {
            void pollPairingClaim(body.deviceToken as string);
          }, 2_000);
        } catch {
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
        const response = await fetch("/api/player/manifest", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${pendingToken}`
          }
        });

        if (response.ok && !cancelled) {
          clearStoredPairing();
          window.location.reload();
        }
      }

      void provisionPairing();

      return () => {
        cancelled = true;
        if (pollTimer) {
          window.clearInterval(pollTimer);
        }
      };
    }

    const pendingPairing = readStoredPairing();
    if (pendingPairing) {
      let cancelled = false;
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

      const pollTimer = window.setInterval(async () => {
        const response = await fetch("/api/player/manifest", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${deviceToken}`
          }
        });

        if (response.ok && !cancelled) {
          clearStoredPairing();
          window.location.reload();
        }
      }, 2_000);

      return () => {
        cancelled = true;
        window.clearInterval(pollTimer);
      };
    }

    const activeDeviceToken = deviceToken;
    const hydratedReleases: HydratedPlayerRelease[] = [];
    let cancelled = false;

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

      hydratedReleases.push(offlineRelease);

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
        const body = (await response.json()) as
          | PlayerManifestEnvelope
          | PlayerManifestProblem;

        if (cancelled) {
          return;
        }

        if (!response.ok || !("manifest" in body)) {
          handleManifestProblem(body as PlayerManifestProblem);
          return;
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
        hydratedReleases.push(hydratedRelease);

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
      } catch (error) {
        if (!cancelled) {
          keepCachedPlaybackOrShowProblem(
            "Online sync faalde; cached playback blijft actief.",
            error instanceof Error ? error.message : "manifest fetch failed"
          );
        }
      }
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
        setRuntime({ state: "UNPAIRED" });
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

    void restoreLastKnownGood()
      .catch(() => false)
      .then(() => {
        if (!cancelled) {
          void syncOnlineManifest();
        }
      });

    return () => {
      cancelled = true;
      hydratedReleases.forEach(revokeHydratedRelease);
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

    const timer = window.setTimeout(async () => {
      const deviceToken = readStoredDeviceToken();
      if (
        runtime.state === "SWITCH_PENDING" &&
        runtime.pendingRelease &&
        deviceToken &&
        (runtime.activeIndex + 1) % runtime.release.envelope.manifest.items.length === 0
      ) {
        try {
          await activateRelease({
            assets: runtime.pendingRelease.assets,
            deviceToken,
            envelope: runtime.pendingRelease.envelope
          });
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

      setRuntime((currentRuntime) => {
        if (!isPlaybackRuntime(currentRuntime)) {
          return currentRuntime;
        }

        const itemCount = currentRuntime.release.envelope.manifest.items.length;
        const nextIndex = (currentRuntime.activeIndex + 1) % itemCount;

        if (
          currentRuntime.state === "SWITCH_PENDING"
          && nextIndex === 0
          && currentRuntime.pendingRelease
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
          activeIndex: nextIndex
        };
      });
    }, getPlaybackDurationMs(activeItem, durationOverrideMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [durationOverrideMs, runtime]);

  useEffect(() => {
    async function sendHeartbeat() {
      const currentRuntime = runtimeRef.current;
      const deviceToken = readStoredDeviceToken();
      if (!deviceToken || !isPlaybackRuntime(currentRuntime)) return;

      const storage = await readStorageEstimate();
      const activeItem =
        currentRuntime.release.envelope.manifest.items[currentRuntime.activeIndex];
      const syncPhase =
        currentRuntime.state === "DOWNLOADING"
          ? "downloading"
          : currentRuntime.state === "VERIFYING"
            ? "verifying"
            : currentRuntime.state === "SWITCH_PENDING"
              ? "switch_pending"
              : "active";

      await fetch("/api/player/heartbeat", {
        body: JSON.stringify({
          activeReleaseId: currentRuntime.release.envelope.manifest.releaseId,
          currentItemId: activeItem?.id ?? null,
          networkState: navigator.onLine ? "online" : "offline",
          runtimeState: currentRuntime.state,
          storageQuotaBytes: storage.quota,
          storageUsedBytes: storage.usage,
          syncPhase
        }),
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      }).catch(() => undefined);
    }

    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, 30_000);

    return () => {
      window.clearInterval(heartbeatTimer);
    };
  }, []);

  if (isPlaybackRuntime(runtime)) {
    return <PlaybackView runtime={runtime} />;
  }

  if (runtime.state === "SYNCING") {
    return <SetupPanel stateLabel="SYNCING" title="Release ophalen" />;
  }

  if (runtime.state === "BOOTING") {
    return <SetupPanel stateLabel="BOOTING" title="Koppelcode maken" />;
  }

  if (runtime.state === "ERROR_RECOVERABLE" || runtime.state === "DISABLED") {
    return <ProblemPanel problem={runtime} />;
  }

  return (
    <PairingPanel
      expiresAt={runtime.state === "UNPAIRED" ? runtime.expiresAt : undefined}
      pairingCode={runtime.state === "UNPAIRED" ? runtime.pairingCode : undefined}
    />
  );
}

function PlaybackView({ runtime }: { runtime: PlaybackRuntime }) {
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
    <main className="playback-shell" aria-label="Castivo player">
      <section className="playback-stage" aria-label="Release playback">
        <PlaybackMedia item={activeItem} />
        <div className="playback-scrim" aria-hidden="true" />
        <div className="playback-now">
          <p>{runtime.release.envelope.device.screenName}</p>
          <h1>{activeItem.title}</h1>
          <span>{manifest.label}</span>
        </div>
      </section>
      <aside className="player-status-panel" aria-label="Player diagnostics">
        <span className="player-state" aria-live="polite">
          {runtime.state}
        </span>
        <span>{manifest.label}</span>
        <span>Item {runtime.activeIndex + 1} van {manifest.items.length}</span>
        <span>{runtime.release.envelope.diagnostics.syncStatus}</span>
        <span>{runtime.syncMessage}</span>
      </aside>
    </main>
  );
}

function PlaybackMedia({ item }: { item: PlayerManifestItem }) {
  const className = `playback-media playback-media--${item.fitMode}`;

  if (item.kind === "video") {
    return (
      <video
        aria-label={item.title}
        autoPlay
        className={className}
        data-testid="player-video"
        muted={item.muted}
        playsInline
        poster={item.source.posterUrl}
        preload="metadata"
      >
        {item.source.url ? <source src={item.source.url} type={item.source.mimeType} /> : null}
      </video>
    );
  }

  return <img alt={item.title} className={className} src={item.source.url} />;
}

function PairingPanel({
  expiresAt,
  pairingCode
}: {
  expiresAt?: string;
  pairingCode?: string;
}) {
  return (
    <main className="runtime-shell" aria-label="Castivo player setup">
      <section className="runtime-panel" aria-labelledby="player-title">
        <p className="runtime-kicker">Device boot shell</p>
        <h1 className="runtime-title" id="player-title">
          {CASTIVO_APPS.player.name} pairing
        </h1>
        <p className="runtime-copy">
          Deze player is nog niet gekoppeld. Voer de pairingcode in Castivo
          Control in om een revocable device session aan dit scherm te koppelen.
        </p>
        <div className="player-pairing-code" aria-label="Pairingcode">
          {pairingCode ?? demoPairingCode}
        </div>
        <dl className="player-diagnostics" aria-label="Device setupstatus">
          <div>
            <dt>State</dt>
            <dd>UNPAIRED</dd>
          </div>
          <div>
            <dt>Sessie</dt>
            <dd>Geen Supabase Auth-user</dd>
          </div>
          <div>
            <dt>Volgende stap</dt>
            <dd>
              {expiresAt
                ? `Geldig tot ${new Intl.DateTimeFormat("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(expiresAt))}`
                : "Wachten op veilige live configuratie"}
            </dd>
          </div>
        </dl>
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
    <main className="runtime-shell" aria-label="Castivo player sync">
      <section className="runtime-panel" aria-labelledby="player-title">
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
    <main className="runtime-shell" aria-label="Castivo player status">
      <section className="runtime-panel" aria-labelledby="player-title">
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

function isPlaybackRuntime(runtime: RuntimeView): runtime is PlaybackRuntime {
  return [
    "PLAYING",
    "DOWNLOADING",
    "VERIFYING",
    "SWITCH_PENDING",
    "OFFLINE_PLAYING"
  ].includes(runtime.state);
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
    return window.localStorage.getItem(localStorageDeviceTokenKey);
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
    const pairingCode = window.localStorage.getItem(localStoragePairingCodeKey);
    const expiresAt = window.localStorage.getItem(localStoragePairingExpiryKey);

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
    window.localStorage.removeItem(localStoragePairingCodeKey);
    window.localStorage.removeItem(localStoragePairingExpiryKey);
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
  }
}

function clearStoredPlayerIdentity() {
  try {
    window.localStorage.removeItem(localStorageDeviceTokenKey);
    clearStoredPairing();
  } catch {
    // Storage can be unavailable in locked-down kiosk contexts.
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
