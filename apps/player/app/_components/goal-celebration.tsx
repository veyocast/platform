"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chooseGoalIntro, transitionGoalPlayback, type GoalOverlayEvent, type GoalPlaybackAction, type GoalPlaybackPhase } from "@veyocast/contracts";
import { GoalOverlay, resolveThemeMode, royalCurrentDefaultStyle } from "@veyocast/content-templates";
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
  const advance = (action: GoalPlaybackAction) => {
    const next = transitionGoalPlayback(phaseRef.current, action);
    phaseRef.current = next;
    setPhase(next);
  };
  useLayoutEffect(() => {
    const resize = () => {
      const rect = root.current?.getBoundingClientRect();
      if (rect) setOrientation(rect.height > rect.width ? "portrait" : "landscape");
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (root.current) observer.observe(root.current);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motion.matches);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const introId = chooseGoalIntro(config, window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    advance(introId ? "start_intro" : "start_overlay");
    const localAssets = new Map(goal.assets);
    const cacheWatchdog = window.setTimeout(() => { if (!cancelled && phaseRef.current === "GOAL_INTRO_LOADING") { logGoal("goal_event_failed", goal.eventId, "intro_cache_unavailable"); advance("intro_failed"); } }, 2000);
    // Read already cached bytes only. Missing optional media never delays the goal.
    void Promise.all([...goal.assets.values()].map(async (asset) => {
      const url = await goalMediaCache.localUrl(asset);
      if (url) { urls.push(url); localAssets.set(asset.mediaAssetId, { ...asset, url }); }
      return { asset, url };
    })).then((assets) => {
      window.clearTimeout(cacheWatchdog);
      if (cancelled) { urls.forEach((url) => URL.revokeObjectURL(url)); return; }
      setResolvedGoal((current) => ({ ...current, assets: localAssets }));
      if (introId && phaseRef.current === "GOAL_INTRO_LOADING") {
        const intro = assets.find(({ asset }) => asset.mediaAssetId === introId && asset.mimeType.startsWith("video/"));
        if (intro?.url) setIntroUrl(intro.url);
        else { logGoal("goal_event_failed", goal.eventId, "intro_not_cached"); advance("intro_failed"); }
      }
    }).catch(() => { if (!cancelled) advance("intro_failed"); });
    return () => { cancelled = true; window.clearTimeout(cacheWatchdog); urls.forEach((url) => URL.revokeObjectURL(url)); };
    // An enrichment updates the content below, never the running intro/state machine.
  }, [goal.deliveryId]);
  useEffect(() => { setResolvedGoal((current) => ({ ...goal, assets: current.assets })); }, [goal]);
  useEffect(() => {
    if (!introUrl || !video.current) return;
    const element = video.current;
    let lastProgress = element.currentTime;
    let progressedAt = Date.now();
    const fail = () => { logGoal("goal_event_failed", goal.eventId, "intro_playback_failed"); advance("intro_failed"); };
    try { void element.play().catch(fail); } catch { fail(); }
    // A stalled decoder is a failure, not a substitute for the video's ended event.
    const watchdog = window.setInterval(() => {
      if (phaseRef.current !== "GOAL_INTRO_LOADING" && phaseRef.current !== "GOAL_INTRO_PLAYING") return;
      if (element.currentTime > lastProgress) { progressedAt = Date.now(); lastProgress = element.currentTime; }
      else if (Date.now() - progressedAt > 8000) fail();
    }, 1000);
    return () => window.clearInterval(watchdog);
  }, [introUrl, goal.eventId]);
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
    {intro && introUrl ? <video ref={video} src={introUrl} muted playsInline controls={false} disablePictureInPicture preload="auto"
      onPlaying={() => { logGoal("goal_intro_started", goal.eventId); advance("intro_playing"); }}
      onEnded={() => { logGoal("goal_intro_finished", goal.eventId); advance("intro_ended"); }}
      onError={() => { logGoal("goal_event_failed", goal.eventId, "intro_load_error"); advance("intro_failed"); }}
      style={{ width: "100%", height: "100%", objectFit: "contain", visibility: phase === "GOAL_INTRO_PLAYING" ? "visible" : "hidden" }} /> : null}
  </div>;
}
