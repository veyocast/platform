"use client";

/* eslint-disable @next/next/no-img-element -- Signed Player media is rendered directly and expires quickly. */

import React, { useCallback, useEffect, useRef, useState } from "react";

import { goalOverlayConfigurationSchema, type GoalOverlayConfiguration } from "@veyocast/contracts";
import { GoalCelebration, logGoal } from "./goal-celebration";
import { goalMediaCache } from "../_lib/goal-media-cache";

import { localStorageDeviceTokenKey } from "../_lib/player-manifest";
import {
  chooseLatestLedScoresMatchState,
  parseLedScoresCanvasScenePair,
  parseLedScoresGoalEnrichmentMessage,
  parseLedScoresMatchOverlayMessage,
  parseLedScoresMatchStateMessage,
  parseLedScoresOverlayAssets,
  readStoredLedScoresMatchStates,
  writeStoredLedScoresMatchStates,
  type ActiveLedScoresMatchOverlay,
  type LedScoresCanvasScenePair,
  type LedScoresGoalEnrichment,
  type LedScoresMatchState,
  type LedScoresOverlayAsset,
  type LedScoresPlayerViewModel
} from "../_lib/ledscores-match-experience";
import {
  LedScoresCanvasSceneRenderer,
  type LedScoresCanvasRendererValues
} from "./ledscores-canvas-scene";
import { LedScoresMatchOverlay } from "./ledscores-match-experience";
import type { FrozenPlayerTheme } from "./player-presentation-theme";
import styles from "./ledscores-goal-overlay.module.css";

const dedupeStorageKey = "veyocast-player-ledscores-dedupe-v1";
const maximumDedupeEntries = 200;
const maximumEnrichmentSequences = 200;
const maximumTerminalAcknowledgements = 200;
const maximumTerminalAcknowledgementRetries = 6;
const terminalAcknowledgementRetentionMs = 7 * 24 * 60 * 60 * 1_000;
const terminalAcknowledgementStorageKey = "veyocast-player-ledscores-terminal-acks-v1";

type OverlayAsset = LedScoresOverlayAsset;
type OverlayDesign = {
  animation: "impact" | "none" | "pulse" | "slide";
  headline: string;
  logoPosition: "center" | "left";
  logoScale: "large" | "medium" | "small";
  palette: "electric-orange" | "ink-black" | "signal-red" | "white";
  scorerFallback: string;
  secondaryText: string;
  showClock: boolean;
  showPreviousScore: boolean;
  showScorer: boolean;
  typography: "body" | "display";
};
export type ActiveLedScoresGoal = {
  competition?: string | null;
  matchName?: string | null;
  round?: string | null;
  venue?: string | null;
  configuration?: GoalOverlayConfiguration | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  assets: Map<string, OverlayAsset>;
  awayScore: number;
  awayTeam: string;
  deliveryId: string;
  design: OverlayDesign;
  durationMs: number;
  eventKind: "live" | "synthetic_test";
  eventId: string;
  homeScore: number;
  homeTeam: string;
  kind: "goal";
  logoMediaAssetId: string | null;
  matchClock: string | null;
  mediaAssetId: string | null;
  previousAwayScore: number;
  previousHomeScore: number;
  player: LedScoresPlayerViewModel | null;
  scene: LedScoresCanvasScenePair | null;
  scorerName: string | null;
  scoringSide: "opponent" | "own" | "unknown";
  soundMediaAssetId: string | null;
  soundVolume: number;
  sponsorMediaAssetId: string | null;
  underlayPolicy: "continue" | "pause";
};

export type ActiveLedScoresOverlay =
  | ActiveLedScoresGoal
  | ActiveLedScoresMatchOverlay;

type ScheduledGoalIdentity = Pick<ActiveLedScoresGoal, "deliveryId" | "eventId">;
type ScheduledOverlayDelivery = ScheduledGoalIdentity & {
  expiresAt: number;
  kind: ActiveLedScoresOverlay["kind"];
  priority: number;
};
type TerminalAcknowledgementStatus = "failed" | "rendered" | "skipped";
export type TerminalAcknowledgement = {
  createdAt: number;
  deliveryId: string;
  detail: string | null;
  eventId: string;
  expiresAt: number;
  status: TerminalAcknowledgementStatus;
};
type TerminalAcknowledgementDeliveryResult = "credential" | "done" | "retry";

export async function drainTerminalAcknowledgementQueue({
  deliver,
  maximumBatchSize = 25,
  maximumRetries = maximumTerminalAcknowledgementRetries,
  read,
  shouldStop = () => false,
  waitForRetry = async () => undefined
}: {
  deliver: (entry: TerminalAcknowledgement) => Promise<TerminalAcknowledgementDeliveryResult>;
  maximumBatchSize?: number;
  maximumRetries?: number;
  read: () => TerminalAcknowledgement[];
  shouldStop?: () => boolean;
  waitForRetry?: (attempt: number) => Promise<void>;
}) {
  let retryAttempt = 0;
  while (!shouldStop()) {
    const pending = read();
    if (!pending.length) return "done" as const;
    const outcomes = await Promise.all(
      pending.slice(0, maximumBatchSize).map((entry) => deliver(entry))
    );
    if (shouldStop()) return "cancelled" as const;
    if (outcomes.some((outcome) => outcome === "credential")) {
      return "credential" as const;
    }
    if (outcomes.some((outcome) => outcome === "retry")) {
      retryAttempt += 1;
      if (retryAttempt > maximumRetries) return "retry_exhausted" as const;
      await waitForRetry(retryAttempt);
      continue;
    }
    retryAttempt = 0;
  }
  return "cancelled" as const;
}

export function classifyScheduledGoal(
  current: ScheduledGoalIdentity | null,
  next: ScheduledGoalIdentity
) {
  if (!current) return "schedule" as const;
  if (current.deliveryId === next.deliveryId) return "same_delivery" as const;
  if (current.eventId === next.eventId) return "same_event" as const;
  return "replace" as const;
}

export function shouldApplyGoalEnrichmentSequence(
  latestSequence: number | null,
  nextSequence: number
) {
  return latestSequence === null || nextSequence > latestSequence;
}

export function isGoalEnrichmentExpiredAtServerTime(
  enrichment: Pick<LedScoresGoalEnrichment, "expiresAt" | "serverTime">,
  clientNow = Date.now()
) {
  const serverOffsetMs = Date.parse(enrichment.serverTime) - clientNow;
  return Date.parse(enrichment.expiresAt) <= clientNow + serverOffsetMs;
}

export function scheduledGoalEnrichmentCompletion(
  enrichment: LedScoresGoalEnrichment
) {
  return {
    delivery: enrichment,
    detail: "scheduled_goal_enriched",
    expiresAt: Date.parse(enrichment.expiresAt),
    status: "rendered" as const
  };
}

type RealtimeConnectionLoopOptions = {
  fetchStream?: typeof fetch;
  onEvent: (event: string, value: unknown) => void;
  random?: () => number;
  signal: AbortSignal;
  token: string;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

export async function runLedScoresRealtimeConnectionLoop({
  fetchStream = fetch,
  onEvent,
  random = Math.random,
  signal,
  token,
  wait = waitForReconnect
}: RealtimeConnectionLoopOptions) {
  let reconnectAttempt = 0;
  while (!signal.aborted) {
    try {
      const response = await fetchStream("/api/player/realtime", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal
      });
      if (response.status === 401 || response.status === 403) return;
      if (response.status !== 204) {
        if (!response.ok || !response.body) throw new Error("REALTIME_STREAM_UNAVAILABLE");
        reconnectAttempt = 0;
        await consumeSseStream(response.body, onEvent, () => signal.aborted);
      }
    } catch {
      if (signal.aborted) return;
    }
    if (signal.aborted) return;
    reconnectAttempt += 1;
    await wait(reconnectDelayMs(reconnectAttempt, random), signal);
  }
}

export function useLedScoresRealtime(enabled: boolean, subscriptionKey = "") {
  const [active, setActive] = useState<ActiveLedScoresOverlay | null>(null);
  const [matchStates, setMatchStates] = useState<ReadonlyMap<string, LedScoresMatchState>>(
    () => {
      if (typeof window === "undefined") return new Map();
      return new Map(readStoredLedScoresMatchStates(window.localStorage).map(
        (state) => [state.connectionId, state]
      ));
    }
  );
  const activeRef = useRef<ActiveLedScoresOverlay | null>(null);
  const activationTimerRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<number | null>(null);
  const scheduledRef = useRef<ScheduledOverlayDelivery | null>(null);
  const pendingEnrichmentsRef = useRef(
    new Map<string, LedScoresGoalEnrichment>()
  );
  const enrichmentSequencesRef = useRef(new Map<string, number>());
  const finishRef = useRef<(deliveryId: string) => void>(() => undefined);
  const complete = useCallback((deliveryId: string) => finishRef.current(deliveryId), []);

  useEffect(() => {
    if (!enabled) {
      setActive(null);
      return;
    }
    const token = readDeviceToken() ?? "";
    if (!token) return;
    let cancelled = false;
    let terminalRetryTimer: number | null = null;
    let terminalFlushInFlight = false;
    const connectionController = new AbortController();
    function scheduleTerminalFlush(delayMs: number) {
      if (cancelled) return;
      if (terminalRetryTimer !== null) window.clearTimeout(terminalRetryTimer);
      terminalRetryTimer = window.setTimeout(() => {
        terminalRetryTimer = null;
        void flushTerminalAcknowledgements();
      }, Math.max(0, delayMs));
    }
    async function flushTerminalAcknowledgements() {
      if (cancelled || terminalFlushInFlight) return;
      terminalFlushInFlight = true;
      try {
        await drainTerminalAcknowledgementQueue({
          deliver: (entry) => deliverTerminalAcknowledgement(token, entry),
          read: () => readTerminalAcknowledgements(Date.now()),
          shouldStop: () => cancelled,
          waitForRetry: (attempt) => waitForReconnect(
            reconnectDelayMs(attempt, Math.random),
            connectionController.signal
          )
        });
      } finally {
        terminalFlushInFlight = false;
      }
    }
    function acknowledgeTerminal(
      delivery: ScheduledGoalIdentity,
      status: TerminalAcknowledgementStatus,
      detail: string | null,
      expiresAt: number
    ) {
      const entry = {
        createdAt: Date.now(),
        deliveryId: delivery.deliveryId,
        detail,
        eventId: delivery.eventId,
        expiresAt,
        status
      } satisfies TerminalAcknowledgement;
      if (!enqueueTerminalAcknowledgement(entry)) {
        void acknowledge(token, entry.deliveryId, entry.status, entry.detail);
      }
      scheduleTerminalFlush(0);
    }
    function skipPendingEnrichment(eventId: string, detail: string) {
      const pending = pendingEnrichmentsRef.current.get(eventId);
      if (!pending) return;
      pendingEnrichmentsRef.current.delete(eventId);
      acknowledgeTerminal(
        pending,
        "skipped",
        detail,
        Date.parse(pending.expiresAt)
      );
    }
    function rememberEnrichmentSequence(eventId: string, sequence: number) {
      enrichmentSequencesRef.current.delete(eventId);
      enrichmentSequencesRef.current.set(eventId, sequence);
      while (enrichmentSequencesRef.current.size > maximumEnrichmentSequences) {
        const oldest = enrichmentSequencesRef.current.keys().next().value;
        if (typeof oldest !== "string") break;
        enrichmentSequencesRef.current.delete(oldest);
      }
    }
    const handleOnline = () => {
      scheduleTerminalFlush(0);
    };
    window.addEventListener("online", handleOnline);
    scheduleTerminalFlush(0);
    const clearOverlayTimers = () => {
      if (activationTimerRef.current !== null) window.clearTimeout(activationTimerRef.current);
      if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
      activationTimerRef.current = null;
      expiryTimerRef.current = null;
    };
    const storeMatchState = (value: unknown, serverTime?: unknown) => {
      const state = parseLedScoresMatchStateMessage(
        isRecord(value) && serverTime !== undefined
          ? { ...value, serverTime }
          : value
      );
      if (!state) return;
      setMatchStates((current) => {
        const previous = current.get(state.connectionId) ?? null;
        const selected = chooseLatestLedScoresMatchState(previous, state);
        if (selected === previous) return current;
        const next = new Map(current);
        next.set(state.connectionId, selected);
        writeStoredLedScoresMatchStates(window.localStorage, [...next.values()]);
        return next;
      });
    };
    type QueuedOverlay = { executeAt: string; expiresAt: string; overlay: ActiveLedScoresOverlay; serverTime: string; receivedAt: number };
    const goalQueue: QueuedOverlay[] = [];
    let continuingQueue = false;
    const drainGoals = () => {
      const next = goalQueue.shift();
      if (!next) { continuingQueue = false; activeRef.current = null; setActive(null); return; }
      continuingQueue = true;
      scheduleOverlay({ ...next, expiresAt: new Date(Date.parse(next.serverTime) + Date.now() - next.receivedAt + 120_000).toISOString(), serverTime: new Date(Date.parse(next.serverTime) + Date.now() - next.receivedAt).toISOString() });
    };
    finishRef.current = (deliveryId) => {
      if (activeRef.current?.deliveryId !== deliveryId) return;
      enrichmentSequencesRef.current.delete(activeRef.current.eventId);
      activeRef.current = null;
      drainGoals();
    };
    const scheduleOverlay = ({
      executeAt,
      expiresAt: expiresAtValue,
      overlay,
      serverTime
    }: {
      executeAt: string;
      expiresAt: string;
      overlay: ActiveLedScoresOverlay;
      serverTime: string;
    }) => {
      const serverOffsetMs = Date.parse(serverTime) - Date.now();
      const serverNow = Date.now() + serverOffsetMs;
      const expiresAt = Date.parse(expiresAtValue);
      const priority = overlayPriority(overlay.kind);
      if (findTerminalAcknowledgement(
        overlay.deliveryId,
        overlay.eventId,
        Date.now()
      )) {
        scheduleTerminalFlush(0);
        if (continuingQueue && !activeRef.current) drainGoals();
        return;
      }
      if (
        activeRef.current?.eventId === overlay.eventId &&
        activeRef.current.kind === overlay.kind
      ) return;
      if (
        expiresAt <= serverNow ||
        (overlay.kind === "goal" && hasSeenGoal(overlay.eventId, serverNow))
      ) {
        logGoal("goal_event_duplicate", overlay.eventId, "expired_or_duplicate");
        acknowledgeTerminal(overlay, "skipped", "expired_or_duplicate", expiresAt);
        if (continuingQueue && !activeRef.current) drainGoals();
        return;
      }
      const activateIn = Math.max(0, Date.parse(executeAt) - serverNow);
      if (activateIn > 30_000) {
        acknowledgeTerminal(overlay, "skipped", "execute_time_too_far", expiresAt);
        if (continuingQueue && !activeRef.current) drainGoals();
        return;
      }
      if (overlay.kind === "goal" && (activeRef.current?.kind === "goal" || scheduledRef.current?.kind === "goal")) {
        const duplicate = goalQueue.some((entry) => entry.overlay.eventId === overlay.eventId)
          || scheduledRef.current?.eventId === overlay.eventId;
        if (duplicate) {
          if (scheduledRef.current?.deliveryId !== overlay.deliveryId && !goalQueue.some((entry) => entry.overlay.deliveryId === overlay.deliveryId)) acknowledgeTerminal(overlay, "skipped", "duplicate_queued_event", expiresAt);
          logGoal("goal_event_duplicate", overlay.eventId);
        } else if (goalQueue.length >= 20) {
          acknowledgeTerminal(overlay, "skipped", "goal_queue_full", expiresAt);
          logGoal("goal_event_failed", overlay.eventId, "queue_full");
        } else goalQueue.push({ executeAt, expiresAt: expiresAtValue, overlay, serverTime, receivedAt: Date.now() });
        return;
      }
      if (activeRef.current && overlayPriority(activeRef.current.kind) > priority) {
        acknowledgeTerminal(overlay, "skipped", "higher_priority_overlay_active", expiresAt);
        return;
      }
      const scheduling = classifyScheduledGoal(scheduledRef.current, overlay);
      if (scheduling === "same_delivery") return;
      if (scheduling === "same_event") {
        acknowledgeTerminal(overlay, "skipped", "duplicate_event_before_activation", expiresAt);
        return;
      }
      if (
        scheduling === "replace" && scheduledRef.current &&
        scheduledRef.current.priority > priority
      ) {
        acknowledgeTerminal(overlay, "skipped", "higher_priority_overlay_scheduled", expiresAt);
        return;
      }
      if (scheduling === "replace" && scheduledRef.current) {
        if (scheduledRef.current.kind === "goal") {
          skipPendingEnrichment(
            scheduledRef.current.eventId,
            "goal_replaced_before_enrichment_render"
          );
          enrichmentSequencesRef.current.delete(scheduledRef.current.eventId);
        }
        acknowledgeTerminal(
          scheduledRef.current,
          "skipped",
          "replaced_before_activation",
          scheduledRef.current.expiresAt
        );
      }
      clearOverlayTimers();
      if (activeRef.current?.eventId !== overlay.eventId) {
        if (activeRef.current?.kind === "goal") {
          enrichmentSequencesRef.current.delete(activeRef.current.eventId);
        }
        activeRef.current = null;
        if (!continuingQueue) setActive(null);
      }
      scheduledRef.current = {
        deliveryId: overlay.deliveryId,
        eventId: overlay.eventId,
        expiresAt,
        kind: overlay.kind,
        priority
      };
      activationTimerRef.current = window.setTimeout(() => {
        if (scheduledRef.current?.deliveryId === overlay.deliveryId) {
          scheduledRef.current = null;
        }
        if (cancelled) return;
        const currentServerNow = Date.now() + serverOffsetMs;
        if (expiresAt <= currentServerNow) {
          if (overlay.kind === "goal") {
            skipPendingEnrichment(overlay.eventId, "goal_execute_window_expired");
            enrichmentSequencesRef.current.delete(overlay.eventId);
          }
          acknowledgeTerminal(overlay, "skipped", "execute_window_expired", expiresAt);
          drainGoals();
          return;
        }
        if (overlay.kind === "lineup_clear") {
          if (activeRef.current?.kind === "lineup") {
            activeRef.current = null;
            setActive(null);
          }
          window.requestAnimationFrame(() => acknowledgeTerminal(
            overlay,
            "rendered",
            "lineup_closed",
            expiresAt
          ));
          return;
        }
        let activated = overlay;
        let appliedEnrichment: LedScoresGoalEnrichment | null = null;
        if (overlay.kind === "goal") {
          const pending = pendingEnrichmentsRef.current.get(overlay.eventId);
          if (pending) {
            activated = enrichGoal(overlay, pending.player);
            appliedEnrichment = pending;
            pendingEnrichmentsRef.current.delete(overlay.eventId);
          }
        }
        activeRef.current = activated;
        setActive(activated);
        window.requestAnimationFrame(() => {
          acknowledgeTerminal(
            overlay,
            "rendered",
            `render_latency_ms:${Math.max(0, Date.now() + serverOffsetMs - Date.parse(executeAt))}`,
            expiresAt
          );
          if (appliedEnrichment) {
            const completion = scheduledGoalEnrichmentCompletion(appliedEnrichment);
            acknowledgeTerminal(
              completion.delivery,
              completion.status,
              completion.detail,
              completion.expiresAt
            );
          }
          if (overlay.kind === "goal") rememberGoal(overlay.eventId, expiresAt);
        });
        if (overlay.kind !== "goal" || !overlay.configuration) {
          expiryTimerRef.current = window.setTimeout(() => {
            finishRef.current(overlay.deliveryId);
          }, Math.max(1, Math.min(overlay.durationMs, expiresAt - currentServerNow)));
        }
      }, activateIn);
    };
    const handleGoal = (value: unknown) => {
      const possibleDeliveryId = isRecord(value) ? safeUuid(value.id) : null;
      const message = parseGoalMessage(value);
      if (!message) {
        if (possibleDeliveryId) void acknowledge(
          token,
          possibleDeliveryId,
          "failed",
          "invalid_goal_payload"
        );
        return;
      }
      logGoal("goal_event_received", message.goal.eventId);
      void acknowledge(token, message.goal.deliveryId, "received", null);
      scheduleOverlay({ ...message, overlay: message.goal });
    };
    const handleMatchOverlay = (value: unknown) => {
      const possibleDeliveryId = isRecord(value) ? safeUuid(value.id) : null;
      const message = parseLedScoresMatchOverlayMessage(value);
      if (!message) {
        if (possibleDeliveryId) void acknowledge(
          token,
          possibleDeliveryId,
          "failed",
          "invalid_match_overlay_payload"
        );
        return;
      }
      void acknowledge(token, message.overlay.deliveryId, "received", null);
      scheduleOverlay(message);
    };
    const handleGoalEnrichment = (value: unknown) => {
      const possibleDeliveryId = isRecord(value) ? safeUuid(value.id) : null;
      const enrichment = parseLedScoresGoalEnrichmentMessage(value);
      if (!enrichment) {
        if (possibleDeliveryId) void acknowledge(
          token,
          possibleDeliveryId,
          "failed",
          "invalid_goal_enrichment_payload"
        );
        return;
      }
      void acknowledge(token, enrichment.deliveryId, "received", null);
      const expiresAt = Date.parse(enrichment.expiresAt);
      if (isGoalEnrichmentExpiredAtServerTime(enrichment, Date.now())) {
        acknowledgeTerminal(enrichment, "skipped", "enrichment_expired", expiresAt);
        return;
      }
      const latestSequence = enrichmentSequencesRef.current.get(
        enrichment.eventId
      ) ?? null;
      if (!shouldApplyGoalEnrichmentSequence(latestSequence, enrichment.sequence)) {
        acknowledgeTerminal(
          enrichment,
          "skipped",
          "superseded_enrichment",
          expiresAt
        );
        return;
      }
      if (activeRef.current?.kind === "goal" &&
        activeRef.current.eventId === enrichment.eventId) {
        rememberEnrichmentSequence(enrichment.eventId, enrichment.sequence);
        const updated = enrichGoal(activeRef.current, enrichment.player);
        activeRef.current = updated;
        setActive(updated);
        window.requestAnimationFrame(() => acknowledgeTerminal(
          enrichment,
          "rendered",
          "active_goal_enriched",
          expiresAt
        ));
        return;
      }
      if ((scheduledRef.current?.kind === "goal" &&
        scheduledRef.current.eventId === enrichment.eventId) || goalQueue.some((entry) => entry.overlay.eventId === enrichment.eventId)) {
        skipPendingEnrichment(enrichment.eventId, "superseded_enrichment");
        rememberEnrichmentSequence(enrichment.eventId, enrichment.sequence);
        pendingEnrichmentsRef.current.set(enrichment.eventId, enrichment);
        return;
      }
      acknowledgeTerminal(enrichment, "skipped", "goal_not_active", expiresAt);
    };
    const handleStreamEvent = (event: string, value: unknown) => {
      if (!isRecord(value)) return;
      if (event === "bootstrap" || event === "configuration") {
        const prepared = preloadAssets(Array.isArray(value.configs) ? value.configs : []);
        if (Array.isArray(value.matchBindings)) {
          for (const binding of value.matchBindings) {
            storeMatchState(binding, value.serverTime);
          }
        }
        if (event === "configuration" && typeof value.deliveryId === "string") {
          const deliveryId = value.deliveryId;
          void prepared.then((ready) => {
            if (!connectionController.signal.aborted) void acknowledge(token, deliveryId, "received", ready ? "configuration_prefetched" : "configuration_prefetch_incomplete");
          });
        }
      } else if (event === "goal") {
        handleGoal(value);
      } else if (event === "goal_enrichment") {
        handleGoalEnrichment(value);
      } else if (event === "match_overlay") {
        handleMatchOverlay(value);
      } else if (event === "match_state") {
        storeMatchState(value);
      }
    };
    void runLedScoresRealtimeConnectionLoop({
      onEvent: handleStreamEvent,
      signal: connectionController.signal,
      token
    });
    return () => {
      cancelled = true;
      connectionController.abort();
      window.removeEventListener("online", handleOnline);
      if (terminalRetryTimer !== null) window.clearTimeout(terminalRetryTimer);
      clearOverlayTimers();
      goalQueue.length = 0;
      finishRef.current = () => undefined;
      goalMediaCache.dispose();
      scheduledRef.current = null;
      pendingEnrichmentsRef.current.clear();
      enrichmentSequencesRef.current.clear();
      activeRef.current = null;
    };
  }, [enabled, subscriptionKey]);

  return {
    active,
    complete,
    matchStates,
    pauseUnderlay: active?.underlayPolicy === "pause"
  };
}

function overlayPriority(kind: ActiveLedScoresOverlay["kind"]) {
  if (kind === "goal") return 100;
  if (kind === "lineup_clear") return 90;
  if (kind === "lineup") return 50;
  return 40;
}

export function enrichGoal(
  goal: ActiveLedScoresGoal,
  player: LedScoresPlayerViewModel
): ActiveLedScoresGoal {
  return { ...goal, player, scorerName: player.name };
}

export function LedScoresGoalOverlay({
  goal,
  theme = null
}: {
  goal: ActiveLedScoresGoal | null;
  theme?: FrozenPlayerTheme | null;
}) {
  const [failedCanvasDeliveryId, setFailedCanvasDeliveryId] = useState<string | null>(null);
  return <LedScoresGoalOverlayContent
    canvasBackgroundFailed={failedCanvasDeliveryId === goal?.deliveryId}
    goal={goal}
    onCanvasBackgroundError={() => {
      if (!goal) return;
      setFailedCanvasDeliveryId((current) => current === goal.deliveryId
        ? current
        : goal.deliveryId);
    }}
    theme={theme}
  />;
}

export function LedScoresGoalOverlayContent({
  canvasBackgroundFailed,
  goal,
  onCanvasBackgroundError,
  theme = null
}: {
  canvasBackgroundFailed: boolean;
  goal: ActiveLedScoresGoal | null;
  onCanvasBackgroundError: () => void;
  theme?: FrozenPlayerTheme | null;
}) {
  if (!goal) return null;
  const scoringTeam = ledScoresScoringTeam(goal);
  const media = assetFor(goal.assets, goal.mediaAssetId);
  const logo = assetFor(goal.assets, goal.logoMediaAssetId);
  const sound = assetFor(goal.assets, goal.soundMediaAssetId);
  const sponsor = assetFor(goal.assets, goal.sponsorMediaAssetId);
  const renderCanvas = Boolean(goal.scene) && !canvasBackgroundFailed;
  return <>
    {renderCanvas && goal.scene ? (
      <LedScoresCanvasSceneRenderer
        ariaLabel={goal.scoringSide === "own"
          ? "Doelpunt voor eigen team"
          : goal.scoringSide === "opponent"
            ? "Doelpunt tegenstander"
            : "Doelpunt van onbekend team"}
        assets={goal.assets}
        onBackgroundMediaError={onCanvasBackgroundError}
        scene={goal.scene}
        testId="ledscores-goal-canvas"
        theme={theme}
        values={goalCanvasValues(goal, scoringTeam, logo?.url ?? null)}
      />
    ) : (
      <section
        aria-label={goal.scoringSide === "own" ? "Doelpunt voor eigen team" : goal.scoringSide === "opponent" ? "Doelpunt tegenstander" : "Doelpunt van onbekend team"}
        className={styles.overlay}
        data-animation={goal.design.animation}
        data-design-revision={theme?.designRevision ?? "player-fallback"}
        data-motion-state={theme?.motionEnabled === false ? "off" : "on"}
        data-palette={goal.design.palette}
        data-scoring-side={goal.scoringSide}
        data-theme-mode={theme?.mode ?? "dark"}
        data-testid="ledscores-goal-overlay"
        style={theme?.style}
      >
        {media ? <div className={styles.media} aria-hidden="true">
          {media.mimeType.startsWith("video/")
            ? <video autoPlay controls={false} disablePictureInPicture loop muted playsInline preload="auto" src={media.url} />
            : <img alt="" src={media.url} />}
        </div> : <div aria-hidden="true" className={styles.fallbackMotion}><span /><span /><span /></div>}
        <div className={styles.scrim} aria-hidden="true" />
        <div className={styles.content} data-logo-position={goal.design.logoPosition} data-logo-scale={goal.design.logoScale}>
          <div className={styles.identity}>
            {logo ? <img alt="" aria-hidden="true" className={styles.logo} src={logo.url} /> : null}
            <span>{scoringTeam}</span>
          </div>
          <strong className={goal.design.typography === "body" ? styles.bodyHeadline : styles.displayHeadline}>{goal.design.headline}</strong>
          <div className={styles.score} aria-label={`Score ${goal.homeScore} tegen ${goal.awayScore}`}><span>{goal.homeScore}</span><small>–</small><span>{goal.awayScore}</span></div>
          {goal.design.showPreviousScore ? <p className={styles.previous}>Vorige stand {goal.previousHomeScore}–{goal.previousAwayScore}</p> : null}
          {goal.design.secondaryText ? <p className={styles.secondary}>{goal.design.secondaryText}</p> : null}
          <div className={styles.metadata}>
            {goal.design.showScorer ? <span>{goal.scorerName ?? goal.design.scorerFallback}</span> : null}
            {goal.design.showClock && goal.matchClock ? <span>{goal.matchClock}</span> : null}
            {goal.eventKind === "synthetic_test" ? <span>LIVE-TEST</span> : null}
          </div>
        </div>
        {goal.design.showScorer && goal.player ? <aside className={styles.playerReveal}>
          <div className={styles.playerPortrait}>
            {goal.player.photoUrl
              ? <img alt="" aria-hidden="true" src={goal.player.photoUrl} />
              : <span aria-hidden="true">{initials(goal.player.name)}</span>}
          </div>
          <div>
            {goal.player.number ? <span>#{goal.player.number}</span> : null}
            <strong>{goal.player.name}</strong>
            <small>Doelpuntenmaker</small>
          </div>
        </aside> : null}
      </section>
    )}
    {sponsor ? <GoalSponsor asset={sponsor} aboveCanvas /> : null}
    {sound ? <GoalSound asset={sound} volume={goal.soundVolume} /> : null}
  </>;
}

export function LedScoresExperienceOverlay({
  overlay,
  theme = null,
  onComplete = () => undefined
}: {
  overlay: ActiveLedScoresOverlay | null;
  theme?: FrozenPlayerTheme | null;
  onComplete?: (deliveryId: string) => void;
}) {
  if (overlay?.kind === "goal" && overlay.configuration) return <GoalCelebration key={overlay.deliveryId} goal={overlay} theme={theme} onComplete={onComplete} />;
  return overlay?.kind === "goal"
    ? <LedScoresGoalOverlay goal={overlay} theme={theme} />
    : <LedScoresMatchOverlay overlay={overlay} theme={theme} />;
}

export function ledScoresScoringTeam(goal: Pick<
  ActiveLedScoresGoal,
  "awayScore" | "awayTeam" | "homeScore" | "homeTeam" | "previousAwayScore" | "previousHomeScore" | "scoringSide"
>) {
  if (goal.homeScore === goal.previousHomeScore + 1) return goal.homeTeam;
  if (goal.awayScore === goal.previousAwayScore + 1) return goal.awayTeam;
  return goal.scoringSide === "own"
    ? "Eigen team"
    : goal.scoringSide === "opponent"
      ? "Tegenstander"
      : "Doelpunt";
}

export function goalCanvasValues(
  goal: ActiveLedScoresGoal,
  scoringTeam = ledScoresScoringTeam(goal),
  ownTeamLogo: string | null = null
): LedScoresCanvasRendererValues {
  const homeScored = goal.homeScore === goal.previousHomeScore + 1;
  const awayScored = goal.awayScore === goal.previousAwayScore + 1;
  const ownTeamIsHome = goal.scoringSide === "own"
    ? homeScored
    : goal.scoringSide === "opponent"
      ? awayScored
      : false;
  const ownTeamIsAway = goal.scoringSide === "own"
    ? awayScored
    : goal.scoringSide === "opponent"
      ? homeScored
      : false;
  const homeLogo = ownTeamIsHome ? ownTeamLogo : null;
  const awayLogo = ownTeamIsAway ? ownTeamLogo : null;
  const eventLabel = goal.scoringSide === "opponent"
    ? "TEGENDOELPUNT"
    : "DOELPUNT";
  return {
    images: {
      awayLogo,
      homeLogo,
      scorerPhoto: goal.player?.photoUrl ?? null,
      scoringTeamLogo: homeScored ? homeLogo : awayScored ? awayLogo : null
    },
    lineup: [],
    text: {
      awayScore: String(goal.awayScore),
      awayTeam: goal.awayTeam,
      clock: goal.matchClock ?? undefined,
      eventLabel: goal.eventKind === "synthetic_test"
        ? `LIVE-TEST · ${eventLabel}`
        : eventLabel,
      homeScore: String(goal.homeScore),
      homeTeam: goal.homeTeam,
      previousScore: `${goal.previousHomeScore} – ${goal.previousAwayScore}`,
      score: `${goal.homeScore} – ${goal.awayScore}`,
      scorerName: goal.player?.name ?? goal.scorerName ?? undefined,
      scorerNumber: goal.player?.number
        ? `#${goal.player.number}`
        : undefined,
      scoringTeam
    }
  };
}

export function parseGoalMessage(value: unknown) {
  if (!isRecord(value) || !isRecord(value.payload) || !Array.isArray(value.assets)) return null;
  const payload = value.payload;
  const deliveryId = safeUuid(value.id);
  const executeAt = safeTimestamp(value.executeAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  const serverTime = safeTimestamp(value.serverTime);
  const eventId = safeUuid(payload.eventId);
  const scoringSide: ActiveLedScoresGoal["scoringSide"] | null =
    payload.scoringSide === "own" || payload.scoringSide === "opponent" || payload.scoringSide === "unknown"
      ? payload.scoringSide
      : null;
  const design = parseDesign(payload.design);
  const durationMs = boundedInteger(payload.durationMs, 2_000, 30_000);
  const homeScore = boundedInteger(payload.homeScore, 0, 999);
  const awayScore = boundedInteger(payload.awayScore, 0, 999);
  const previousHomeScore = boundedInteger(payload.previousHomeScore, 0, 999);
  const previousAwayScore = boundedInteger(payload.previousAwayScore, 0, 999);
  const player = parseGoalPlayer(payload.player ?? payload.scorer);
  if (!deliveryId || !executeAt || !expiresAt || !serverTime || !eventId || !scoringSide || !design || durationMs === null || homeScore === null || awayScore === null || previousHomeScore === null || previousAwayScore === null) return null;
  const assets = parseLedScoresOverlayAssets(value.assets);
  return {
    executeAt,
    expiresAt,
    goal: {
      assets,
      competition: safeText(payload.competition, 160),
      matchName: safeText(payload.matchName, 240),
      round: safeText(payload.round, 80),
      venue: safeText(payload.venue, 160),
      configuration: goalOverlayConfigurationSchema.safeParse(payload.goalOverlay).success ? goalOverlayConfigurationSchema.parse(payload.goalOverlay) : null,
      homeLogo: safeOptionalUuid(payload.homeLogo),
      awayLogo: safeOptionalUuid(payload.awayLogo),
      awayScore,
      awayTeam: safeText(payload.awayTeam, 160) ?? "Uitteam",
      deliveryId,
      design,
      durationMs,
      eventId,
      eventKind: payload.eventKind === "synthetic_test" ? "synthetic_test" as const : "live" as const,
      homeScore,
      homeTeam: safeText(payload.homeTeam, 160) ?? "Thuisteam",
      kind: "goal" as const,
      logoMediaAssetId: safeOptionalUuid(payload.logoMediaAssetId),
      matchClock: safeText(payload.matchClock, 40),
      mediaAssetId: safeOptionalUuid(payload.mediaAssetId),
      previousAwayScore,
      previousHomeScore,
      player,
      scene: parseLedScoresCanvasScenePair(payload.scene, assets),
      scorerName: player?.name ?? safeText(payload.scorerName, 160),
      scoringSide,
      soundMediaAssetId: safeOptionalUuid(payload.soundMediaAssetId),
      soundVolume: boundedInteger(payload.soundVolume, 0, 100) ?? 70,
      sponsorMediaAssetId: safeOptionalUuid(payload.sponsorMediaAssetId),
      underlayPolicy: payload.underlayPolicy === "pause" ? "pause" as const : "continue" as const
    },
    serverTime
  };
}

function GoalSound({ asset, volume }: { asset: OverlayAsset; volume: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);
  return <audio autoPlay preload="auto" ref={audioRef} src={asset.url} />;
}

function GoalSponsor({
  aboveCanvas = false,
  asset
}: {
  aboveCanvas?: boolean;
  asset: OverlayAsset;
}) {
  return <aside
    className={aboveCanvas
      ? `${styles.sponsor} ${styles.canvasSponsor}`
      : styles.sponsor}
    data-testid="ledscores-goal-sponsor"
  >
    <span>Mede mogelijk gemaakt door</span>
    <img alt="Sponsor" src={asset.url} />
  </aside>;
}

async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, value: unknown) => void,
  cancelled: () => boolean
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!cancelled()) {
      const chunk = await reader.read();
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseSseBlock(block);
        if (parsed) onEvent(parsed.event, parsed.value);
        boundary = buffer.indexOf("\n\n");
      }
      if (buffer.length > 4 * 1024 * 1024) buffer = "";
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export function parseSseBlock(value: string) {
  if (!value || value.startsWith(":")) return null;
  let event = "message";
  const data: string[] = [];
  for (const line of value.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) data.push(line.slice(6));
  }
  if (!data.length || !/^[a-z][a-z_]{0,39}$/.test(event)) return null;
  try { return { event, value: JSON.parse(data.join("\n")) as unknown }; }
  catch { return null; }
}

async function preloadAssets(configs: unknown[]) {
  const pending: Promise<boolean>[] = [];
  goalMediaCache.setRequiredAssets(configs.flatMap((c) => isRecord(c) && isRecord(c.config) && c.config.goalOverlay ? [...parseLedScoresOverlayAssets(c.assets).values()] : []));
  for (const config of configs.slice(0, 50)) {
    if (!isRecord(config) || !Array.isArray(config.assets)) continue;
    const catalog = Array.isArray(config.teamAssets) ? config.teamAssets : [];
    const assets = [...parseLedScoresOverlayAssets(config.assets).values(), ...catalog.slice(0, 1000).flatMap((asset) => [...parseLedScoresOverlayAssets([asset]).values()])];
    pending.push(goalMediaCache.preload(assets));
    if (isRecord(config.config) && config.config.goalOverlay) continue;
    for (const asset of parseLedScoresOverlayAssets(config.assets).values()) {
      if (asset.mimeType.startsWith("image/")) {
        const image = new Image();
        image.decoding = "async";
        image.src = asset.url;
      } else {
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "auto";
        video.src = asset.url;
        video.load();
      }
    }
  }
  return (await Promise.all(pending)).every(Boolean);
}
async function acknowledge(token: string, deliveryId: string, status: string, detail: string | null) {
  try {
    return await fetch("/api/player/realtime/ack", {
      body: JSON.stringify({ deliveryId, detail, status }),
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      method: "POST"
    });
  } catch {
    return null;
  }
}
async function deliverTerminalAcknowledgement(
  token: string,
  entry: TerminalAcknowledgement
): Promise<TerminalAcknowledgementDeliveryResult> {
  const response = await acknowledge(
    token,
    entry.deliveryId,
    entry.status,
    entry.detail
  );
  if (
    response?.ok || response?.status === 400 || response?.status === 404
    || response?.status === 413 || response?.status === 422
  ) {
    removeTerminalAcknowledgement(entry.deliveryId);
    return "done";
  }
  if (response?.status === 401 || response?.status === 403) return "credential";
  return "retry";
}
function enqueueTerminalAcknowledgement(entry: TerminalAcknowledgement) {
  const now = Date.now();
  const entries = readTerminalAcknowledgements(now);
  if (entries.some((value) => value.deliveryId === entry.deliveryId)) return true;
  entries.push({
    ...entry,
    detail: typeof entry.detail === "string"
      ? entry.detail.replace(/[\r\n]+/g, " ").slice(0, 300)
      : null
  });
  return writeTerminalAcknowledgements(entries);
}
function findTerminalAcknowledgement(deliveryId: string, eventId: string, now: number) {
  return readTerminalAcknowledgements(now).find((entry) =>
    entry.deliveryId === deliveryId && entry.eventId === eventId
  ) ?? null;
}
function removeTerminalAcknowledgement(deliveryId: string) {
  const entries = readTerminalAcknowledgements(Date.now()).filter((entry) =>
    entry.deliveryId !== deliveryId
  );
  writeTerminalAcknowledgements(entries);
}
function readTerminalAcknowledgements(now: number) {
  try {
    return parseTerminalAcknowledgements(
      JSON.parse(window.localStorage.getItem(terminalAcknowledgementStorageKey) ?? "[]") as unknown,
      now
    );
  } catch {
    return [];
  }
}
function writeTerminalAcknowledgements(entries: TerminalAcknowledgement[]) {
  try {
    window.localStorage.setItem(
      terminalAcknowledgementStorageKey,
      JSON.stringify(entries.slice(-maximumTerminalAcknowledgements))
    );
    return true;
  } catch {
    return false;
  }
}
export function parseTerminalAcknowledgements(value: unknown, now = Date.now()) {
  if (!Array.isArray(value)) return [] as TerminalAcknowledgement[];
  const seen = new Set<string>();
  const parsed: TerminalAcknowledgement[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const deliveryId = safeUuid(candidate.deliveryId);
    const eventId = safeUuid(candidate.eventId);
    const status = candidate.status === "rendered"
      || candidate.status === "skipped"
      || candidate.status === "failed"
      ? candidate.status
      : null;
    const detail = candidate.detail === null
      ? null
      : typeof candidate.detail === "string" && candidate.detail.length <= 300
        ? candidate.detail
        : null;
    const expiresAt = Number(candidate.expiresAt);
    const createdAt = Number(candidate.createdAt);
    if (
      !deliveryId || !eventId || !status || seen.has(deliveryId)
      || !Number.isFinite(expiresAt) || !Number.isFinite(createdAt)
      || createdAt < now - terminalAcknowledgementRetentionMs
      || createdAt > now + terminalAcknowledgementRetentionMs
    ) continue;
    seen.add(deliveryId);
    parsed.push({ createdAt, deliveryId, detail, eventId, expiresAt, status });
  }
  return parsed.slice(-maximumTerminalAcknowledgements);
}
function readDeviceToken() { try { const value = window.localStorage.getItem(localStorageDeviceTokenKey); return value && /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null; } catch { return null; } }
function hasSeenGoal(eventId: string, now: number) { return readDedupeEntries(now).some((entry) => entry.eventId === eventId); }
function rememberGoal(eventId: string, expiresAt: number) { try { const entries = readDedupeEntries(Date.now()).filter((entry) => entry.eventId !== eventId); entries.push({ eventId, expiresAt }); window.localStorage.setItem(dedupeStorageKey, JSON.stringify(entries.slice(-maximumDedupeEntries))); } catch { /* in-memory delivery replacement still prevents current-session repeats */ } }
function readDedupeEntries(now: number): Array<{ eventId: string; expiresAt: number }> { try { const parsed = JSON.parse(window.localStorage.getItem(dedupeStorageKey) ?? "[]") as unknown; return Array.isArray(parsed) ? parsed.flatMap((entry) => isRecord(entry) && safeUuid(entry.eventId) && typeof entry.expiresAt === "number" && entry.expiresAt > now ? [{ eventId: String(entry.eventId), expiresAt: entry.expiresAt }] : []).slice(-maximumDedupeEntries) : []; } catch { return []; } }
function assetFor(assets: Map<string, OverlayAsset>, id: string | null) { return id ? assets.get(id) ?? null : null; }
function parseGoalPlayer(value: unknown): LedScoresPlayerViewModel | null { if (!isRecord(value)) return null; const name = safeText(value.name, 160); if (!name) return null; const rawNumber = typeof value.number === "number" ? String(value.number) : value.number; return { id: safeText(value.id ?? value.providerPlayerId, 200), name, number: safeText(rawNumber, 16), photoUrl: safeWebUrl(value.photoUrl) }; }
function safeWebUrl(value: unknown) { return typeof value === "string" && value.length <= 2_000 && /^https?:\/\//.test(value) ? value : null; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "VC"; }
function parseDesign(value: unknown): OverlayDesign | null { if (!isRecord(value)) return null; const headline = safeText(value.headline, 80); const secondaryText = safeText(value.secondaryText, 160) ?? ""; const scorerFallback = safeText(value.scorerFallback, 120) ?? "Doelpunt!"; const palette = ["electric-orange", "ink-black", "signal-red", "white"].includes(String(value.palette)) ? String(value.palette) as OverlayDesign["palette"] : null; const animation = ["impact", "pulse", "slide", "none"].includes(String(value.animation)) ? String(value.animation) as OverlayDesign["animation"] : null; const logoScale = ["small", "medium", "large"].includes(String(value.logoScale)) ? String(value.logoScale) as OverlayDesign["logoScale"] : "medium"; if (!headline || !palette || !animation) return null; return { animation, headline, logoPosition: value.logoPosition === "center" ? "center" : "left", logoScale, palette, scorerFallback, secondaryText, showClock: value.showClock === true, showPreviousScore: value.showPreviousScore === true, showScorer: value.showScorer !== false, typography: value.typography === "body" ? "body" : "display" }; }
function safeUuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
function safeOptionalUuid(value: unknown) { return value === null || value === undefined || value === "" ? null : safeUuid(value); }
function safeTimestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function safeText(value: unknown, maximum: number) { return typeof value === "string" && value.trim() && value.length <= maximum ? value.trim() : null; }
function boundedInteger(value: unknown, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function reconnectDelayMs(attempt: number, random: () => number) {
  const exponentialDelay = 1_000 * 2 ** Math.min(5, Math.max(0, attempt - 1));
  return Math.max(1_000, Math.min(30_000, exponentialDelay) - Math.floor(random() * 500));
}
async function waitForReconnect(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(finish, milliseconds);
    const onAbort = () => finish();
    function finish() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) finish();
  });
}
