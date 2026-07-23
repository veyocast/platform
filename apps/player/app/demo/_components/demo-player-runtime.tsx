"use client";

/* eslint-disable @next/next/no-img-element -- Player media and locked brand assets render directly. */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  activateRelease,
  hydrateCachedRelease,
  hydratePreparedRelease,
  preparePendingRelease,
  readActiveRelease,
  revokeHydratedRelease,
  type HydratedPlayerRelease
} from "../../_lib/player-cache";
import {
  getPlaybackDurationMs,
  type PlayerManifestEnvelope
} from "../../_lib/player-manifest";
import { PlaybackMedia } from "../../_components/player-runtime";

const demoCacheIdentity = "veyocast-staging-review-demo";
const watchdogTimeoutMs = 12_000;
const demoNavigationEventName = "veyocast:demo-navigate";

type DemoRuntimeState =
  | { state: "LOADING" }
  | { state: "ERROR"; message: string }
  | {
      activeIndex: number;
      playbackAttempt: number;
      release: HydratedPlayerRelease;
      state: "PLAYING";
    };

export function DemoPlayerRuntime() {
  const [runtime, setRuntime] = useState<DemoRuntimeState>({ state: "LOADING" });
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const hydratedReleasesRef = useRef<HydratedPlayerRelease[]>([]);
  const itemClockRef = useRef<{
    itemKey: string;
    remainingMs: number;
    startedAt: number | null;
  } | null>(null);

  const navigate = useCallback((direction: -1 | 1) => {
    setPlaybackPaused(false);
    setRuntime((current) => {
      if (current.state !== "PLAYING") return current;
      const itemCount = current.release.envelope.manifest.items.length;
      if (itemCount === 0) return current;
      return {
        ...current,
        activeIndex: (current.activeIndex + direction + itemCount) % itemCount,
        playbackAttempt: current.playbackAttempt + 1
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function showCachedRelease() {
      const cached = await readActiveRelease(demoCacheIdentity);
      if (!cached || cancelled) return false;
      const hydrated = await hydrateCachedRelease(cached);
      if (cancelled) {
        revokeHydratedRelease(hydrated);
        return false;
      }
      hydratedReleasesRef.current.push(hydrated);
      setRuntime({
        activeIndex: 0,
        playbackAttempt: 0,
        release: hydrated,
        state: "PLAYING"
      });
      return true;
    }

    async function syncDemoRelease(hadCachedRelease: boolean) {
      try {
        const response = await fetch("/api/player/demo/manifest", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("manifest unavailable");
        const envelope = (await response.json()) as PlayerManifestEnvelope;
        if (!envelope.manifest?.items.length) {
          throw new Error("manifest has no playable items");
        }

        const prepared = await preparePendingRelease({ envelope });
        if (!prepared.ok) throw new Error(prepared.error);
        await activateRelease({
          assets: prepared.assets,
          deviceToken: demoCacheIdentity,
          envelope
        });
        const hydrated = await hydratePreparedRelease({
          assets: prepared.assets,
          envelope
        });
        if (cancelled) {
          revokeHydratedRelease(hydrated);
          return;
        }
        hydratedReleasesRef.current.push(hydrated);
        setRuntime({
          activeIndex: 0,
          playbackAttempt: 0,
          release: hydrated,
          state: "PLAYING"
        });
      } catch {
        if (!cancelled && !hadCachedRelease) {
          setRuntime({
            message:
              "De reviewplaylist kon nog niet worden geladen. Controleer de verbinding en kies Player vernieuwen in het menu.",
            state: "ERROR"
          });
        }
      }
    }

    void showCachedRelease()
      .catch(() => false)
      .then((hadCachedRelease) => {
        if (!cancelled) void syncDemoRelease(hadCachedRelease);
      });

    return () => {
      cancelled = true;
      hydratedReleasesRef.current.splice(0).forEach(revokeHydratedRelease);
    };
  }, []);

  useEffect(() => {
    function handleDemoNavigation(event: Event) {
      const direction = (event as CustomEvent<{ direction?: unknown }>).detail
        ?.direction;
      if (direction === "previous") navigate(-1);
      if (direction === "next") navigate(1);
    }

    window.addEventListener(demoNavigationEventName, handleDemoNavigation);
    return () =>
      window.removeEventListener(demoNavigationEventName, handleDemoNavigation);
  }, [navigate]);

  useEffect(() => {
    if (runtime.state !== "ERROR") return;
    const retryWhenOnline = () => window.location.reload();
    window.addEventListener("online", retryWhenOnline, { once: true });
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [runtime.state]);

  const activeItem =
    runtime.state === "PLAYING"
      ? runtime.release.envelope.manifest.items[runtime.activeIndex]
      : null;

  useEffect(() => {
    if (!activeItem) return;
    const itemKey = `${activeItem.id}:${runtime.state === "PLAYING" ? runtime.playbackAttempt : 0}`;
    let clock = itemClockRef.current;
    if (!clock || clock.itemKey !== itemKey) {
      clock = {
        itemKey,
        remainingMs: getPlaybackDurationMs(activeItem),
        startedAt: null
      };
      itemClockRef.current = clock;
    }
    if (playbackPaused) return;

    clock.startedAt = performance.now();
    const timer = window.setTimeout(() => {
      if (itemClockRef.current === clock) {
        clock.startedAt = null;
        clock.remainingMs = 0;
      }
      navigate(1);
    }, clock.remainingMs);

    return () => {
      window.clearTimeout(timer);
      if (clock.startedAt !== null) {
        clock.remainingMs = Math.max(
          0,
          clock.remainingMs - (performance.now() - clock.startedAt)
        );
        clock.startedAt = null;
      }
    };
  }, [activeItem, navigate, playbackPaused, runtime]);

  if (runtime.state === "LOADING") {
    return <DemoStatus title="Reviewplaylist voorbereiden" />;
  }

  if (runtime.state === "ERROR") {
    return <DemoStatus detail={runtime.message} title="Reviewdemo wacht" />;
  }

  if (!activeItem) {
    return (
      <DemoStatus
        detail="Publiceer minimaal één gereed media-item en vernieuw daarna de Player."
        title="Geen afspeelbare demo-inhoud"
      />
    );
  }

  const handleEnded = () => navigate(1);
  const handleFailure = () => {
    window.setTimeout(() => navigate(1), 750);
  };

  return (
    <main
      aria-label="VeyoCast reviewdemo"
      className="playback-shell"
      data-veyocast-demo-player="true"
    >
      <section className="playback-stage" aria-label="Reviewplaylist">
        <PlaybackMedia
          key={`${activeItem.id}:${runtime.playbackAttempt}:${runtime.activeIndex}`}
          item={activeItem}
          onEnded={handleEnded}
          onFailure={handleFailure}
          onPlaybackStateChange={(state) =>
            setPlaybackPaused(state === "paused")
          }
          onReady={() => undefined}
          watchdogTimeoutMs={watchdogTimeoutMs}
        />
        <img
          alt=""
          aria-hidden="true"
          className="playback-brand-mark"
          src="/brand/veyocast-logo-inverse.svg"
        />
      </section>
    </main>
  );
}

function DemoStatus({
  detail = "De veilige staging-release wordt gedownload en gecontroleerd.",
  title
}: {
  detail?: string;
  title: string;
}) {
  return (
    <main className="runtime-shell runtime-shell--setup" aria-label="VeyoCast reviewdemo status">
      <div className="setup-backdrop" aria-hidden="true" />
      <section className="runtime-panel runtime-panel--branded">
        <img
          alt="VeyoCast"
          className="pairing-logo"
          src="/brand/veyocast-logo-inverse.svg"
        />
        <p className="runtime-kicker">Staging reviewdemo</p>
        <h1 className="runtime-title">{title}</h1>
        <p className="runtime-copy">{detail}</p>
      </section>
    </main>
  );
}
