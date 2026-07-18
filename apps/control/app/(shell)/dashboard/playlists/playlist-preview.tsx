"use client";

import { useEffect, useRef, useState } from "react";

export type PlaylistPreviewItem = {
  durationSeconds: number;
  fitMode: "contain" | "cover";
  id: string;
  kind: "image" | "video";
  muted: boolean;
  title: string;
  url: string;
};

export function PlaylistPreview({ items }: { items: PlaylistPreviewItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeItem = items[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [activeIndex, items.length]);

  useEffect(() => {
    if (!playing || !activeItem) return;
    const timeout = window.setTimeout(() => setActiveIndex((index) => (index + 1) % items.length), activeItem.durationSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [activeItem, items.length, playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video") return;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [activeItem, playing]);

  if (!activeItem) return <p className="notice">Voeg gereedstaande media toe om een 16:9-voorbeeld te bekijken.</p>;

  const previous = () => setActiveIndex((index) => (index - 1 + items.length) % items.length);
  const next = () => setActiveIndex((index) => (index + 1) % items.length);

  return (
    <div className="player-preview">
      <div className="player-preview__stage" data-fit={activeItem.fitMode}>
        {activeItem.kind === "video" ? (
          <video
            aria-label={`Voorbeeldvideo ${activeItem.title}`}
            className="player-preview__media"
            key={activeItem.id}
            muted={activeItem.muted}
            onEnded={next}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={activeItem.url}
          ><track kind="captions" /></video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`Voorbeeld van ${activeItem.title}`} className="player-preview__media" src={activeItem.url} />
        )}
        <span className="player-preview__safe-zone" aria-hidden="true" />
      </div>
      <div className="player-preview__controls">
        <button className="button-link button-link--secondary" onClick={previous} type="button">Vorige</button>
        <button className="button-link button-link--primary" onClick={() => setPlaying((value) => !value)} type="button">{playing ? "Pauzeren" : "Voorbeeld afspelen"}</button>
        <button className="button-link button-link--secondary" onClick={next} type="button">Volgende</button>
        <p aria-live="polite" className="work-panel__meta">{activeIndex + 1} van {items.length} · {activeItem.title} · {activeItem.durationSeconds} s</p>
      </div>
    </div>
  );
}
