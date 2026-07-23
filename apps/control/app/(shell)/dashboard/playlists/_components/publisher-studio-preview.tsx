"use client";

import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Pause,
  Play
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { Button } from "@veyocast/ui";

import type { PlaylistPreviewItem } from "../playlist-preview";
import styles from "../[playlistId]/publisher-studio.module.css";
import {
  buildPreviewOffsets,
  resolvePreviewPosition
} from "./publisher-studio-preview-state";

export function PublisherStudioPreview({
  items
}: {
  items: PlaylistPreviewItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape"
  );
  const [playing, setPlaying] = useState(false);
  const [simulatedAt, setSimulatedAt] = useState("");
  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeItem = items[activeIndex] ?? null;
  const offsets = useMemo(() => buildPreviewOffsets(items), [items]);
  const totalDuration = offsets.at(-1)?.end ?? 0;
  const timelinePosition =
    (offsets[activeIndex]?.start ?? 0) + elapsedSeconds;

  useEffect(() => {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    setSimulatedAt(local.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0);
      setElapsedSeconds(0);
    }
  }, [activeIndex, items.length]);

  useEffect(() => {
    if (!playing || !activeItem) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 0.25 * speed;
        if (next < activeItem.durationSeconds) return next;
        setActiveIndex((index) =>
          items.length ? (index + 1) % items.length : 0
        );
        return 0;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [activeItem, items.length, playing, speed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video") return;
    video.playbackRate = speed;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [activeItem, playing, speed]);

  if (!activeItem) {
    return (
      <div className={styles.previewEmpty} role="status">
        Voeg gereedstaande media toe om de playlist te previewen.
      </div>
    );
  }

  function previous() {
    setActiveIndex((index) => (index - 1 + items.length) % items.length);
    setElapsedSeconds(0);
  }

  function next() {
    setActiveIndex((index) => (index + 1) % items.length);
    setElapsedSeconds(0);
  }

  function seek(value: number) {
    const position = resolvePreviewPosition(offsets, value);
    if (!position) return;
    setActiveIndex(position.index);
    setElapsedSeconds(position.elapsedSeconds);
  }

  async function enterFullscreen() {
    if (!stageRef.current?.requestFullscreen) return;
    await stageRef.current.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className={styles.fullPreview}>
      <div className={styles.previewToolbar}>
        <label>
          <span>Schermoriëntatie</span>
          <select
            onChange={(event) =>
              setOrientation(
                event.target.value === "portrait" ? "portrait" : "landscape"
              )
            }
            value={orientation}
          >
            <option value="landscape">16:9 liggend</option>
            <option value="portrait">9:16 staand</option>
          </select>
        </label>
        <label>
          <span>Datum en tijd</span>
          <input
            onChange={(event) => setSimulatedAt(event.target.value)}
            type="datetime-local"
            value={simulatedAt}
          />
        </label>
        <label>
          <span>Snelheid</span>
          <select
            onChange={(event) =>
              setSpeed(Number(event.target.value) as 0.5 | 1 | 2 | 4)
            }
            value={speed}
          >
            <option value="0.5">0,5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
        <Button onClick={enterFullscreen} size="sm" variant="secondary">
          <Expand aria-hidden="true" size={16} />
          Volledig scherm
        </Button>
      </div>

      <div
        className={styles.previewStage}
        data-fit={activeItem.fitMode}
        data-orientation={orientation}
        ref={stageRef}
      >
        {activeItem.kind === "video" ? (
          <video
            aria-label={`Voorbeeldvideo ${activeItem.title}`}
            className={styles.previewMedia}
            key={activeItem.id}
            muted={activeItem.muted}
            onEnded={next}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={activeItem.url}
          >
            <track kind="captions" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`Voorbeeld van ${activeItem.title}`}
            className={styles.previewMedia}
            src={activeItem.url}
          />
        )}
        <span className={styles.previewSafeArea} aria-hidden="true" />
        <span className={styles.previewContext}>
          {simulatedAt
            ? new Intl.DateTimeFormat("nl-NL", {
                dateStyle: "medium",
                timeStyle: "short"
              }).format(new Date(simulatedAt))
            : "Previewtijd laden…"}
        </span>
      </div>

      <div className={styles.previewTransport}>
        <Button
          aria-label="Vorig playlistitem"
          onClick={previous}
          size="sm"
          variant="secondary"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          aria-label={playing ? "Preview pauzeren" : "Preview afspelen"}
          onClick={() => setPlaying((current) => !current)}
          size="sm"
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? "Pauzeren" : "Afspelen"}
        </Button>
        <Button
          aria-label="Volgend playlistitem"
          onClick={next}
          size="sm"
          variant="secondary"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <p aria-live="polite">
          {activeIndex + 1} van {items.length} · {activeItem.title}
        </p>
      </div>

      <label className={styles.previewTimeline}>
        <span>
          <b>Tijdlijn</b>
          <output>
            {formatTime(timelinePosition)} / {formatTime(totalDuration)}
          </output>
        </span>
        <input
          aria-label="Positie in de playlist"
          max={Math.max(totalDuration, 1)}
          min={0}
          onChange={(event) => seek(Number(event.target.value))}
          step={0.25}
          type="range"
          value={Math.min(timelinePosition, Math.max(totalDuration, 1))}
        />
      </label>
    </div>
  );
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
