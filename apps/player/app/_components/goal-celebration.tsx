"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { resolveGoalIntroAsset, transitionGoalPlayback, type GoalOverlayEvent, type GoalPlaybackAction, type GoalPlaybackPhase } from "@veyocast/contracts";
import { GoalOverlay, resolveThemeMode, royalCurrentDefaultStyle } from "@veyocast/content-templates";
import { playGoalIntroVideo } from "../_lib/goal-video-runtime";
import { goalVideoTelemetry } from "../_lib/goal-video-telemetry";
import { goalMediaCache } from "../_lib/goal-media-cache";
import type { ActiveLedScoresGoal } from "./ledscores-goal-overlay";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

export function logGoal(event: string, eventId: string, detail?: string) {
  console.info(JSON.stringify({ event, eventId, ...(detail ? { detail } : {}) }));
}

export function goalEventForRenderer(goal: ActiveLedScoresGoal): GoalOverlayEvent {
  const scoreboardSide = goal.homeScore > goal.previousHomeScore ? "home" : "away";
  return {
    eventId: goal.eventId, homeTeam: goal.homeTeam, awayTeam: goal.awayTeam,
    homeScore: goal.homeScore, awayScore: goal.awayScore, scoreboardSide,
    scorer: goal.player?.name ?? goal.scorerName, playerPhoto: goal.player?.photoUrl ?? null,
    shirtNumber: goal.player?.number ?? null, minute: goal.matchClock,
    homeLogo: goal.homeLogo ? goal.assets.get(goal.homeLogo)?.url ?? null : null,
    awayLogo: goal.awayLogo ? goal.assets.get(goal.awayLogo)?.url ?? null : null,
    competition: goal.competition, matchName: goal.matchName, round: goal.round, venue: goal.venue,
    test: goal.eventKind === "synthetic_test"
  };
}

/** A temporary interrupt; the playlist component and its release remain mounted. */
export function GoalCelebration({ goal, theme, onComplete }: {
  goal: ActiveLedScoresGoal;
  theme: FrozenPlayerTheme | null;
  onComplete: (deliveryId: string) => void;
}) {
  const config = goal.configuration!;
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth ? "portrait" : "landscape");
  const [phase, setPhase] = useState<GoalPlaybackPhase>("IDLE");
  const phaseRef = useRef<GoalPlaybackPhase>("IDLE");
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [resolvedGoal, setResolvedGoal] = useState(goal);
  const [reduced, setReduced] = useState(false);
  const selection = useRef<ReturnType<typeof resolveGoalIntroAsset> | null>(null);
  const introSource = useRef<"cache_blob" | "https">("cache_blob");
  const introActive = phase === "IDLE" || phase === "GOAL_INTRO_LOADING" || phase === "GOAL_INTRO_PLAYING";
  const report = (code: string, mediaErrorCode?: number | null) => {
    const selected = selection.current;
    if (!selected) return;
    const rect = root.current?.getBoundingClientRect();
    goalVideoTelemetry({ code, eventId: goal.eventId, deliveryId: goal.deliveryId,
      alertVersionId: goal.alertVersionId ?? null, assetId: selected.requestedAssetId,
      orientation: selected.orientation, mimeType: selected.mimeType,
      at: new Date().toISOString(), width: Math.round(rect?.width ?? 0), height: Math.round(rect?.height ?? 0),
      source: introSource.current, mediaErrorCode: mediaErrorCode ?? video.current?.error?.code ?? null });
  };
  const advance = (action: GoalPlaybackAction) => {
    const next = transitionGoalPlayback(phaseRef.current, action);
    phaseRef.current = next;
    setPhase(next);
  };
  useLayoutEffect(() => {
    const resize = () => {
      const rect = root.current?.getBoundingClientRect();
      if (rect) setOrientation(goal.screenOrientation ?? (rect.height > rect.width ? "portrait" : "landscape"));
    };
    resize();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (root.current) observer?.observe(root.current);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motion.matches);
    window.addEventListener("resize", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const rect = root.current?.getBoundingClientRect();
    const probe = document.createElement("video");
    const selected = resolveGoalIntroAsset({ configuration: config,
      screenOrientation: goal.screenOrientation, width: rect?.width ?? window.innerWidth,
      height: rect?.height ?? window.innerHeight, assets: [...goal.assets.values()],
      canPlayType: (type) => probe.canPlayType(type) });
    selection.current = selected;
    setOrientation(selected.orientation);
    const introId = selected.assetId;
    if (selected.code) report(selected.code);
    advance(introId ? "start_intro" : "start_overlay");
    const cacheWatchdog = window.setTimeout(() => {
      if (!cancelled && phaseRef.current === "GOAL_INTRO_LOADING") {
        report("GOAL_VIDEO_CACHE_TIMEOUT"); advance("intro_failed");
      }
    }, 2000);
    // Resolve each optional asset independently; photos cannot delay a cached intro.
    for (const asset of goal.assets.values()) {
      void goalMediaCache.localUrl(asset).then((url) => {
        if (cancelled) { if (url) URL.revokeObjectURL(url); return; }
        if (url) {
          urls.push(url);
          setResolvedGoal((current) => ({ ...current, assets: new Map(current.assets).set(asset.mediaAssetId, { ...asset, url }) }));
        }
        if (asset.mediaAssetId !== introId || phaseRef.current !== "GOAL_INTRO_LOADING") return;
        window.clearTimeout(cacheWatchdog);
        if (url) setIntroUrl(url);
        else { report("GOAL_VIDEO_CACHE_MISSING"); advance("intro_failed"); }
      }).catch(() => {
        if (!cancelled && asset.mediaAssetId === introId && phaseRef.current === "GOAL_INTRO_LOADING") {
          window.clearTimeout(cacheWatchdog); report("GOAL_VIDEO_CACHE_MISSING"); advance("intro_failed");
        }
      });
    }
    return () => { cancelled = true; window.clearTimeout(cacheWatchdog); urls.forEach((url) => URL.revokeObjectURL(url)); };
    // An enrichment updates content only; it must never restart a running decoder.
  }, [goal.deliveryId]);
  useEffect(() => { setResolvedGoal((current) => ({ ...goal, assets: current.assets })); }, [goal]);
  useEffect(() => {
    if (!introActive || !introUrl || !video.current) return;
    return playGoalIntroVideo(video.current, introUrl, {
      fallbackUrl: navigator.onLine ? goal.assets.get(selection.current?.assetId ?? "")?.url : undefined,
      onFallback: (code, nativeCode) => { report("GOAL_VIDEO_SOURCE_FALLBACK", nativeCode); logGoal("goal_intro_source_fallback", goal.eventId, code); introSource.current = "https"; },
      onPlaying: () => { report("GOAL_VIDEO_STARTED"); logGoal("goal_intro_started", goal.eventId); advance("intro_playing"); },
      onComplete: () => { report("GOAL_VIDEO_COMPLETED"); logGoal("goal_intro_finished", goal.eventId); advance("intro_ended"); },
      onFailure: (code) => { report(code); logGoal("goal_event_failed", goal.eventId, code); advance("intro_failed"); }
    });
  }, [introActive, introUrl, goal.deliveryId]);
  const transitionMs = reduced ? 0 : config.transitionDurationMs;
  useEffect(() => {
    let timer: number | undefined;
    if (phase === "GOAL_OVERLAY_ENTERING") {
      logGoal("goal_overlay_started", goal.eventId);
      timer = window.setTimeout(() => advance("entered"), config.enterAnimation === "none" ? 0 : transitionMs);
    } else if (phase === "GOAL_OVERLAY_VISIBLE") {
      timer = window.setTimeout(() => advance("duration_elapsed"), config.overlayDurationMs);
    } else if (phase === "GOAL_OVERLAY_EXITING") {
      timer = window.setTimeout(() => advance("exited"), config.exitAnimation === "none" ? 0 : transitionMs);
    } else if (phase === "RESUMING_PLAYLIST") {
      logGoal("goal_overlay_finished", goal.eventId);
      complete.current(goal.deliveryId);
    }
    return () => window.clearTimeout(timer);
  }, [phase, goal.eventId, goal.deliveryId, config.overlayDurationMs, config.enterAnimation, config.exitAnimation, transitionMs]);
  const appearance = config.themeMode !== "auto" ? config.themeMode : config.defaults
    ? resolveThemeMode(config.defaults.modePolicy, { instant: new Date().toISOString(), timezone: config.defaults.timezone, prefersDark: matchMedia("(prefers-color-scheme: dark)").matches })
    : theme?.mode ?? "light";
  const intro = phase === "GOAL_INTRO_LOADING" || phase === "GOAL_INTRO_PLAYING" || phase === "IDLE";
  const exiting = phase === "GOAL_OVERLAY_EXITING" || phase === "RESUMING_PLAYLIST";
  return <div ref={root} data-testid="goal-celebration" data-phase={phase} style={{ position: "absolute", inset: 0, zIndex: 70, overflow: "hidden", background: (appearance === "dark" ? config.darkOuterColor : config.lightOuterColor) ?? config.defaults?.primary ?? royalCurrentDefaultStyle.primary }}>
    <style>{`@keyframes vc-goal-enter{from{opacity:0;transform:translateY(1.5%)}to{opacity:1;transform:translateY(0)}}@keyframes vc-goal-fade{from{opacity:0}to{opacity:1}}`}</style>
    <div style={{ position: "absolute", inset: 0, visibility: intro ? "hidden" : "visible", opacity: exiting && config.exitAnimation === "fade" ? 0 : 1, transition: `opacity ${transitionMs}ms ease`, animation: phase === "GOAL_OVERLAY_ENTERING" && !reduced && config.enterAnimation !== "none" ? `${config.enterAnimation === "rise" ? "vc-goal-enter" : "vc-goal-fade"} ${transitionMs}ms both` : undefined }}>
      <GoalOverlay event={goalEventForRenderer(resolvedGoal)} configuration={config} orientation={orientation} appearance={appearance} />
    </div>
    {intro && introUrl ? <video ref={video} muted autoPlay playsInline controls={false} disablePictureInPicture preload="auto"
      style={{ width: "100%", height: "100%", objectFit: "contain", visibility: phase === "GOAL_INTRO_PLAYING" ? "visible" : "hidden" }} /> : null}
  </div>;
}
