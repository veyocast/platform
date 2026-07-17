"use client";

/* eslint-disable @next/next/no-img-element -- Player media URLs come from release manifests and must render directly. */

import { CASTIVO_APPS } from "@castivo/config";
import { useEffect, useState } from "react";

import {
  activateRelease,
  hydrateCachedRelease,
  preparePendingRelease,
  readActiveRelease,
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

const pairingCode = "CTV 482";

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
  | { state: "UNPAIRED" }
  | { state: "SYNCING"; deviceToken: string }
  | PlaybackRuntime
  | { state: "ERROR_RECOVERABLE" | "DISABLED"; error: PlayerManifestProblem["error"] };

export function PlayerRuntime() {
  const [runtime, setRuntime] = useState<RuntimeView>({ state: "BOOTING" });
  const [durationOverrideMs, setDurationOverrideMs] = useState<number | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get("deviceToken");
    const queryDurationMs = Number(searchParams.get("durationMs"));

    setDurationOverrideMs(Number.isFinite(queryDurationMs) ? queryDurationMs : null);

    const deviceToken = queryToken ?? readStoredDeviceToken();

    if (!deviceToken) {
      setRuntime({ state: "UNPAIRED" });
      return undefined;
    }

    const activeDeviceToken = deviceToken;
    const hydratedReleases: HydratedPlayerRelease[] = [];
    let cancelled = false;

    if (queryToken) {
      writeStoredDeviceToken(queryToken);
    }

    setRuntime({ state: "SYNCING", deviceToken: activeDeviceToken });

    async function restoreLastKnownGood() {
      const cachedRelease = await readActiveRelease(activeDeviceToken);

      if (!cachedRelease || cancelled) {
        return false;
      }

      const offlineRelease = await hydrateCachedRelease({
        ...cachedRelease,
        envelope: withSyncDiagnostics(
          cachedRelease.envelope,
          "offline",
          "last-known-good release actief"
        )
      });

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
          `/api/player/manifest?deviceToken=${encodeURIComponent(activeDeviceToken)}`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json"
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

        const activatedRelease = await activateRelease({
          assets: preparedRelease.assets,
          deviceToken: activeDeviceToken,
          envelope: withSyncDiagnostics(body, "online", "release verified")
        });
        const hydratedRelease = await hydrateCachedRelease(activatedRelease);
        hydratedReleases.push(hydratedRelease);

        if (cancelled) {
          return;
        }

        setRuntime((currentRuntime) => {
          if (
            isPlaybackRuntime(currentRuntime)
            && currentRuntime.release.envelope.manifest.releaseId
              !== hydratedRelease.envelope.manifest.releaseId
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

    const timer = window.setTimeout(() => {
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

  if (isPlaybackRuntime(runtime)) {
    return <PlaybackView runtime={runtime} />;
  }

  if (runtime.state === "SYNCING") {
    return <SetupPanel stateLabel="SYNCING" title="Release ophalen" />;
  }

  if (runtime.state === "ERROR_RECOVERABLE" || runtime.state === "DISABLED") {
    return <ProblemPanel problem={runtime} />;
  }

  return <PairingPanel />;
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

function PairingPanel() {
  return (
    <main className="runtime-shell">
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
          {pairingCode}
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
            <dd>Wachten op `claim_pairing_session`</dd>
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
  stateLabel: "SYNCING";
  title: string;
}) {
  return (
    <main className="runtime-shell">
      <section className="runtime-panel" aria-labelledby="player-title">
        <p className="runtime-kicker">{stateLabel}</p>
        <h1 className="runtime-title" id="player-title">
          {title}
        </h1>
        <p className="runtime-copy">
          De player haalt het toegewezen release manifest op. Playback start
          zodra de online release compleet is gelezen.
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
    <main className="runtime-shell">
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
