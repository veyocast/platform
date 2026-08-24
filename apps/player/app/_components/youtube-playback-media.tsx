"use client";

import { useEffect, useRef, useState } from "react";

import type { PlayerManifestItem } from "../_lib/player-manifest";

type YouTubePlayer = {
  destroy(): void;
  mute(): void;
  playVideo(): void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onError: () => void;
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: { data: number }) => void;
      };
      height: string;
      host: string;
      playerVars: Record<string, number | string>;
      videoId: string;
      width: string;
    }
  ) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API unavailable"));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existing) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => reject(new Error("YouTube IFrame API failed"));
      document.head.append(script);
    }
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

export function YouTubePlaybackMedia({
  item,
  onEnded,
  onFailure,
  onReady,
  passive
}: {
  item: PlayerManifestItem;
  onEnded: (itemId: string) => void;
  onFailure: (itemId: string, code: "VIDEO_ERROR") => void;
  onReady: (itemId: string) => void;
  passive: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const binding = item.onlinePlayback?.kind === "youtube"
    ? item.onlinePlayback
    : null;
  const [fallback, setFallback] = useState(
    passive || typeof navigator !== "undefined" && !navigator.onLine
  );

  useEffect(() => {
    if (fallback || passive || !hostRef.current || !binding) return;
    let disposed = false;
    let player: YouTubePlayer | null = null;
    const timeout = window.setTimeout(() => {
      if (!disposed) setFallback(true);
    }, 10_000);
    void loadYouTubeApi()
      .then((YT) => {
        if (disposed || !hostRef.current || !binding) return;
        player = new YT.Player(hostRef.current, {
          events: {
            onError: () => {
              if (!disposed) setFallback(true);
            },
            onReady: ({ target }) => {
              target.mute();
              target.playVideo();
            },
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.PLAYING) {
                window.clearTimeout(timeout);
                onReady(item.id);
              } else if (data === YT.PlayerState.ENDED) {
                onEnded(item.id);
              }
            }
          },
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0
          },
          videoId: binding.videoId,
          width: "100%"
        });
      })
      .catch(() => setFallback(true));
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      player?.destroy();
    };
  }, [binding, fallback, item.id, onEnded, onReady, passive]);

  useEffect(() => {
    const offline = () => setFallback(true);
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []);

  if (fallback) {
    if (item.kind === "video") {
      return (
        <video
          aria-label={item.accessibilityName ?? item.title}
          autoPlay={!passive}
          className={`playback-media playback-media--${item.fitMode}`}
          controls={false}
          disablePictureInPicture
          muted
          onEnded={() => onEnded(item.id)}
          onError={() => onFailure(item.id, "VIDEO_ERROR")}
          onPlaying={() => onReady(item.id)}
          src={item.source.url}
        />
      );
    }
    return (
      // Player sources may be verified blob/cache URLs and must bypass image
      // transformation so offline integrity remains checksum-addressed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={item.accessibilityName ?? item.title}
        className={`playback-media playback-media--${item.fitMode}`}
        onError={() => onFailure(item.id, "VIDEO_ERROR")}
        onLoad={() => onReady(item.id)}
        src={item.source.url}
      />
    );
  }

  return (
    <div
      aria-label={binding?.title ?? item.title}
      className="playback-media playback-media--cover playback-youtube"
      ref={hostRef}
    />
  );
}
