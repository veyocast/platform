"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  createDynamicTemplateView,
  dynamicTemplateHasRenderableContent,
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
import { themePresentationFromDynamicData } from "./player-presentation-theme";

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
  const [matchTime, setMatchTime] = useState(() => new Date());
  const liveMatch = item.dynamicTemplate?.slideType ===
    ledScoresLiveMatchSlideType;
  const liveConfig = useMemo(
    () => liveMatch
      ? parseLedScoresLiveMatchConfig(item.dynamicTemplate?.data)
      : null,
    [item.dynamicTemplate?.data, liveMatch]
  );
  const liveTheme = useMemo(
    () => liveMatch
      ? themePresentationFromDynamicData(item.dynamicTemplate?.data)
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
    () => liveMatch ? null : createDynamicTemplateView(item.dynamicTemplate, matchTime),
    [item.dynamicTemplate, liveMatch, matchTime]
  );
  // Re-project the same immutable payload at its next kickoff, including while
  // offline. Only the rendered rows change; the release and item timer stay put.
  useEffect(() => {
    if (passive || paused || !view ||
      (view.slideType !== "sport_program" && view.slideType !== "sport_results")) return;
    const kickoffs = view.pages.flatMap((page) => "items" in page
      ? page.items.flatMap((row) => "kickoffAt" in row ? [Date.parse(String(row.kickoffAt))] : [])
      : [])
      .filter((instant) => Number.isFinite(instant) && instant > matchTime.valueOf());
    if (!kickoffs.length) return;
    const nextKickoff = Math.min(...kickoffs);
    const timer = window.setTimeout(() => setMatchTime(new Date()),
      Math.min(2_147_483_647, Math.max(0, nextKickoff - Date.now() + 1)));
    return () => window.clearTimeout(timer);
  }, [matchTime, passive, paused, view]);

  const shouldSkip = (view &&
    (view.slideType === "sport_program" || view.slideType === "sport_results") &&
    !dynamicTemplateHasRenderableContent(view)) || (view?.slideType === "sport_birthdays" && view.pages.length === 0) ||
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
        theme={liveTheme}
      />
    );
  }
  return <EditorialArenaRenderer item={item} now={matchTime} onReady={onReady} passive={passive} />;
}
