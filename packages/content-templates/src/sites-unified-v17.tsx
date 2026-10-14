"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SitesPresentation } from "@veyocast/contracts";
import { SitesUnifiedV17Markup } from "./sites-unified-v17-markup";
import type { SitesAssetResolver } from "./sites-presentation-model";

export function fitSitesUnifiedViewport(containerWidth: number, containerHeight: number, orientation: "landscape" | "portrait") {
  const canvasWidth = orientation === "portrait" ? 1080 : 1920;
  const canvasHeight = orientation === "portrait" ? 1920 : 1080;
  const width = Math.max(0, Number.isFinite(containerWidth) ? containerWidth : 0);
  const height = Math.max(0, Number.isFinite(containerHeight) ? containerHeight : 0);
  return height > 0 ? Math.min(width, height * canvasWidth / canvasHeight) : width;
}

const useMeasuredLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SitesUnifiedV17({ presentation, resolveAsset, active = false, fitViewport = false }: { presentation: SitesPresentation; resolveAsset: SitesAssetResolver; active?: boolean; fitViewport?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const orientation = presentation.kind === "studio" ? presentation.slide.orientation : presentation.configuration.orientation;

  useMeasuredLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setFrameWidth(fitSitesUnifiedViewport(element.clientWidth, element.clientHeight, orientation));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitViewport, orientation]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scrollables = [...element.querySelectorAll<HTMLElement>(".ucs-standing-scroll,.ucs-fixture-scroll,.ucs-training-scroll,.ucs-extra-scroll")];
    if (!scrollables.length) return;
    let frame = 0;
    let last = 0;
    let direction = 1;
    let holdUntil = performance.now() + 2400;
    const tick = (now: number) => {
      const elapsed = last ? Math.min(60, now - last) : 0;
      last = now;
      for (const scroller of scrollables) {
        const end = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        if (end > 0 && now > holdUntil) {
          scroller.scrollTop = Math.min(end, Math.max(0, scroller.scrollTop + direction * 25 * elapsed / 1000));
          if (scroller.scrollTop <= 0 || scroller.scrollTop >= end) {
            direction = scroller.scrollTop <= 0 ? 1 : -1;
            holdUntil = now + 2400;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, presentation]);

  const nativeWidth = orientation === "portrait" ? 1080 : 1920;
  return <div ref={ref} style={{ width: "100%", ...(fitViewport ? { height: "100%" } : { aspectRatio: orientation === "portrait" ? "9 / 16" : "16 / 9" }), minWidth: 0, minHeight: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
    <SitesUnifiedV17Markup presentation={presentation} resolveAsset={resolveAsset} active={active} frameWidth={frameWidth || undefined} width={frameWidth || nativeWidth}/>
  </div>;
}
