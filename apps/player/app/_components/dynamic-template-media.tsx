"use client";

import React, { useEffect, useMemo, useRef } from "react";

import {
  createDynamicTemplateView,
  EditorialArenaRenderer,
  type EditorialArenaItem
} from "@veyocast/content-templates";
import {
  chooseLatestLedScoresMatchState,
  ledScoresLiveMatchSlideType,
  parseLedScoresLiveMatchConfig,
  type LedScoresMatchState
} from "../_lib/ledscores-match-experience";
import { LedScoresLiveMatchSlide } from "./ledscores-match-experience";

export function DynamicTemplateMedia({
  item,
  liveMatchStates = new Map(),
  onEnded,
  onReady,
  passive = false,
  paused = false
}: {
  item: EditorialArenaItem;
  liveMatchStates?: ReadonlyMap<string, LedScoresMatchState>;
  onEnded: (itemId: string) => void;
  onReady: (itemId: string) => void;
  passive?: boolean;
  paused?: boolean;
}) {
  const skippedRef = useRef("");
  const liveMatch = item.dynamicTemplate?.slideType ===
    ledScoresLiveMatchSlideType;
  const liveConfig = useMemo(
    () => liveMatch
      ? parseLedScoresLiveMatchConfig(item.dynamicTemplate?.data)
      : null,
    [item.dynamicTemplate?.data, liveMatch]
  );
  const realtimeState = liveConfig
    ? liveMatchStates.get(liveConfig.connectionId) ?? null
    : null;
  const liveState = liveConfig && realtimeState
    ? chooseLatestLedScoresMatchState(liveConfig.fallbackState, realtimeState)
    : liveConfig?.fallbackState ?? null;
  const view = useMemo(
    () => liveMatch ? null : createDynamicTemplateView(item.dynamicTemplate),
    [item.dynamicTemplate, liveMatch]
  );
  const shouldSkip = (view?.slideType === "sport_birthdays" && view.pages.length === 0) ||
    (liveMatch && (
      !liveConfig || !liveState ||
      (liveConfig.outsideMatchBehavior === "skip" &&
        ["finished", "pre_match", "unknown"].includes(liveState.status))
    ));

  useEffect(() => {
    if (!shouldSkip || passive || paused || skippedRef.current === item.id) return;
    skippedRef.current = item.id;
    onReady(item.id);
    const frame = window.requestAnimationFrame(() => onEnded(item.id));
    return () => window.cancelAnimationFrame(frame);
  }, [item.id, onEnded, onReady, passive, paused, shouldSkip]);

  if (shouldSkip) return null;
  if (liveMatch && liveConfig && liveState) {
    return (
      <LedScoresLiveMatchSlide
        config={liveConfig}
        onReady={() => onReady(item.id)}
        orientation={item.dynamicTemplate?.orientation ?? "landscape"}
        state={liveState}
      />
    );
  }
  return <EditorialArenaRenderer item={item} onReady={onReady} passive={passive} />;
}
