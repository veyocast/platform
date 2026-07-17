"use client";

/* eslint-disable @next/next/no-img-element -- Player media URLs come from release manifests and must render directly. */

import { CASTIVO_APPS } from "@castivo/config";
import { useEffect, useState } from "react";

import {
  getPlaybackDurationMs,
  localStorageDeviceTokenKey,
  type PlayerManifestEnvelope,
  type PlayerManifestItem,
  type PlayerManifestProblem
} from "../_lib/player-manifest";

const pairingCode = "CTV 482";

type RuntimeView =
  | { state: "BOOTING" }
  | { state: "UNPAIRED" }
  | { state: "SYNCING"; deviceToken: string }
  | { state: "PLAYING"; activeIndex: number; envelope: PlayerManifestEnvelope }
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
      return;
    }

    const activeDeviceToken = deviceToken;

    if (queryToken) {
      writeStoredDeviceToken(queryToken);
    }

    let cancelled = false;
    setRuntime({ state: "SYNCING", deviceToken: activeDeviceToken });

    async function fetchManifest() {
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

        if (response.ok && "manifest" in body) {
          setRuntime({ state: "PLAYING", activeIndex: 0, envelope: body });
          return;
        }

        const problem = body as PlayerManifestProblem;
        if (problem.state === "UNPAIRED") {
          setRuntime({ state: "UNPAIRED" });
          return;
        }

        setRuntime({
          state: problem.state,
          error: problem.error
        });
      } catch {
        if (!cancelled) {
          setRuntime({
            state: "ERROR_RECOVERABLE",
            error: {
              cause: "Het manifest kon niet online worden opgehaald.",
              effect: "Zonder last-known-good release blijft de player in herstelstatus.",
              recovery: "Controleer netwerk en probeer opnieuw; S08 voegt lokale fallback toe."
            }
          });
        }
      }
    }

    void fetchManifest();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runtime.state !== "PLAYING") {
      return;
    }

    const activeItem = runtime.envelope.manifest.items[runtime.activeIndex];

    if (!activeItem) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRuntime((currentRuntime) => {
        if (currentRuntime.state !== "PLAYING") {
          return currentRuntime;
        }

        const itemCount = currentRuntime.envelope.manifest.items.length;
        return {
          ...currentRuntime,
          activeIndex: (currentRuntime.activeIndex + 1) % itemCount
        };
      });
    }, getPlaybackDurationMs(activeItem, durationOverrideMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [durationOverrideMs, runtime]);

  if (runtime.state === "PLAYING") {
    return <PlaybackView activeIndex={runtime.activeIndex} envelope={runtime.envelope} />;
  }

  if (runtime.state === "SYNCING") {
    return <SetupPanel stateLabel="SYNCING" title="Release ophalen" />;
  }

  if (runtime.state === "ERROR_RECOVERABLE" || runtime.state === "DISABLED") {
    return <ProblemPanel problem={runtime} />;
  }

  return <PairingPanel />;
}

function PlaybackView({
  activeIndex,
  envelope
}: {
  activeIndex: number;
  envelope: PlayerManifestEnvelope;
}) {
  const manifest = envelope.manifest;
  const activeItem = manifest.items[activeIndex] ?? manifest.items[0];

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
          <p>{envelope.device.screenName}</p>
          <h1>{activeItem.title}</h1>
          <span>{manifest.label}</span>
        </div>
      </section>
      <aside className="player-status-panel" aria-label="Player diagnostics">
        <span className="player-state" aria-live="polite">
          PLAYING
        </span>
        <span>{manifest.label}</span>
        <span>Item {activeIndex + 1} van {manifest.items.length}</span>
        <span>{envelope.diagnostics.syncStatus}</span>
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
