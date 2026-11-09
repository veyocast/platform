"use client";

import { useEffect, useRef, useState } from "react";
import { SyncPlayerStatus } from "./sync-player-status";
import styles from "./verified-empty-zone.module.css";

export function hasVisibleEmptyZoneFrame(root: HTMLElement | null): boolean {
  const heading = root?.querySelector("h1");
  if (!root || !heading?.textContent?.trim()) return false;
  const bounds = root.getBoundingClientRect(), text = heading.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0 || text.width <= 0 || text.height <= 0 ||
    text.right <= bounds.left || text.left >= bounds.right || text.bottom <= bounds.top || text.top >= bounds.bottom) return false;
  for (let element: HTMLElement | null = heading; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) return false;
  }
  return true;
}

/** An empty dataset is a visible idle state, never a fictitious item turn.
 * Its small loop supplies a natural boundary for subsequently verified facts. */
export function VerifiedEmptyZone({ identity, screenName, paused, onFrame, onBoundary, fullscreen = false }: {
  identity: string;
  screenName: string;
  paused: boolean;
  onFrame: () => void;
  onBoundary: () => void;
  fullscreen?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onFrame, onBoundary });
  callbacks.current = { onFrame, onBoundary };
  const requested = useRef({ identity, paused });
  requested.current = { identity, paused };
  const [visibleIdentity, setVisibleIdentity] = useState<string | null>(null);
  useEffect(() => {
    if (paused) return;
    let disposed = false, first = 0, second = 0;
    const report = () => {
      if (disposed || requested.current.identity !== identity || requested.current.paused) return;
      if (!hasVisibleEmptyZoneFrame(root.current)) { second = requestAnimationFrame(report); return; }
      setVisibleIdentity(identity);
      callbacks.current.onFrame();
    };
    void Promise.resolve(document.fonts?.ready).then(() => {
      if (!disposed) first = requestAnimationFrame(() => { second = requestAnimationFrame(report); });
    });
    return () => { disposed = true; cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [identity, paused]);
  useEffect(() => {
    if (paused || visibleIdentity !== identity) return;
    const timer = window.setInterval(() => {
      if (requested.current.identity === identity && !requested.current.paused) callbacks.current.onBoundary();
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [identity, paused, visibleIdentity]);
  return <div ref={root} className={styles.root} data-player-empty-zone={identity} data-player-handoff={visibleIdentity === identity ? "first-frame-ready" : "waiting-for-first-frame"}>
    <SyncPlayerStatus embedded={!fullscreen} stage="no-content" landmark={fullscreen ? "VeyoCast player gereed" : "Contentzone gereed"} title={fullscreen ? undefined : "Geen gegevens"} detail={fullscreen ? undefined : "Er zijn nog geen gegevens beschikbaar."} screenName={screenName} footer="Wachten op afspeelbare inhoud" />
  </div>;
}
