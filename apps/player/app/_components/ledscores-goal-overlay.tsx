"use client";

/* eslint-disable @next/next/no-img-element -- Signed Player media is rendered directly and expires quickly. */

import { useEffect, useRef, useState } from "react";

import { localStorageDeviceTokenKey } from "../_lib/player-manifest";
import styles from "./ledscores-goal-overlay.module.css";

const dedupeStorageKey = "veyocast-player-ledscores-dedupe-v1";
const maximumDedupeEntries = 200;
const maximumTerminalAcknowledgements = 200;
const maximumTerminalAcknowledgementRetries = 6;
const terminalAcknowledgementRetentionMs = 7 * 24 * 60 * 60 * 1_000;
const terminalAcknowledgementStorageKey = "veyocast-player-ledscores-terminal-acks-v1";

type OverlayAsset = {
  checksum: string;
  mediaAssetId: string;
  mimeType: string;
  url: string;
};
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
  logoMediaAssetId: string | null;
  matchClock: string | null;
  mediaAssetId: string | null;
  previousAwayScore: number;
  previousHomeScore: number;
  scorerName: string | null;
  scoringSide: "opponent" | "own" | "unknown";
  soundMediaAssetId: string | null;
  soundVolume: number;
  sponsorMediaAssetId: string | null;
  underlayPolicy: "continue" | "pause";
};

type ScheduledGoalIdentity = Pick<ActiveLedScoresGoal, "deliveryId" | "eventId">;
type ScheduledGoalDelivery = ScheduledGoalIdentity & { expiresAt: number };
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

export function useLedScoresRealtime(enabled: boolean) {
  const [active, setActive] = useState<ActiveLedScoresGoal | null>(null);
  const activeRef = useRef<ActiveLedScoresGoal | null>(null);
  const activationTimerRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<number | null>(null);
  const scheduledRef = useRef<ScheduledGoalDelivery | null>(null);
  activeRef.current = active;

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
    const handleOnline = () => {
      scheduleTerminalFlush(0);
    };
    window.addEventListener("online", handleOnline);
    scheduleTerminalFlush(0);
    const clearGoalTimers = () => {
      if (activationTimerRef.current !== null) window.clearTimeout(activationTimerRef.current);
      if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
      activationTimerRef.current = null;
      expiryTimerRef.current = null;
    };
    const handleGoal = (value: unknown) => {
      const possibleDeliveryId = isRecord(value) ? safeUuid(value.id) : null;
      const message = parseGoalMessage(value);
      if (!message) {
        if (possibleDeliveryId) {
          void acknowledge(token, possibleDeliveryId, "failed", "invalid_goal_payload");
        }
        return;
      }
      void acknowledge(token, message.goal.deliveryId, "received", null);
      const serverOffsetMs = Date.parse(message.serverTime) - Date.now();
      const serverNow = Date.now() + serverOffsetMs;
      const expiresAt = Date.parse(message.expiresAt);
      if (findTerminalAcknowledgement(
        message.goal.deliveryId,
        message.goal.eventId,
        Date.now()
      )) {
        scheduleTerminalFlush(0);
        return;
      }
      if (activeRef.current?.eventId === message.goal.eventId) return;
      if (expiresAt <= serverNow || hasSeenGoal(message.goal.eventId, serverNow)) {
        acknowledgeTerminal(message.goal, "skipped", "expired_or_duplicate", expiresAt);
        return;
      }
      const activateIn = Math.max(0, Date.parse(message.executeAt) - serverNow);
      if (activateIn > 30_000) {
        acknowledgeTerminal(message.goal, "skipped", "execute_time_too_far", expiresAt);
        return;
      }
      const scheduling = classifyScheduledGoal(scheduledRef.current, message.goal);
      if (scheduling === "same_delivery") return;
      if (scheduling === "same_event") {
        acknowledgeTerminal(
          message.goal,
          "skipped",
          "duplicate_event_before_activation",
          expiresAt
        );
        return;
      }
      if (scheduling === "replace" && scheduledRef.current) {
        acknowledgeTerminal(
          scheduledRef.current,
          "skipped",
          "replaced_before_activation",
          scheduledRef.current.expiresAt
        );
      }
      clearGoalTimers();
      const replaced = activeRef.current;
      if (replaced && replaced.eventId !== message.goal.eventId) {
        setActive(null);
      }
      scheduledRef.current = {
        deliveryId: message.goal.deliveryId,
        eventId: message.goal.eventId,
        expiresAt
      };
      activationTimerRef.current = window.setTimeout(() => {
        if (scheduledRef.current?.deliveryId === message.goal.deliveryId) {
          scheduledRef.current = null;
        }
        if (cancelled) return;
        const currentServerNow = Date.now() + serverOffsetMs;
        if (expiresAt <= currentServerNow) {
          acknowledgeTerminal(
            message.goal,
            "skipped",
            "execute_window_expired",
            expiresAt
          );
          return;
        }
        activeRef.current = message.goal;
        setActive(message.goal);
        window.requestAnimationFrame(() => {
          acknowledgeTerminal(
            message.goal,
            "rendered",
            `render_latency_ms:${Math.max(0, Date.now() + serverOffsetMs - Date.parse(message.executeAt))}`,
            expiresAt
          );
          rememberGoal(message.goal.eventId, expiresAt);
        });
        expiryTimerRef.current = window.setTimeout(() => {
          if (activeRef.current?.eventId === message.goal.eventId) {
            activeRef.current = null;
            setActive(null);
          }
        }, Math.max(1, Math.min(message.goal.durationMs, expiresAt - currentServerNow)));
      }, activateIn);
    };
    const handleStreamEvent = (event: string, value: unknown) => {
      if (!isRecord(value)) return;
      if (event === "bootstrap" || event === "configuration") {
        if (Array.isArray(value.configs)) preloadAssets(value.configs);
        if (event === "configuration" && typeof value.deliveryId === "string") {
          void acknowledge(token, value.deliveryId, "received", "configuration_prefetched");
        }
      } else if (event === "goal") {
        handleGoal(value);
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
      clearGoalTimers();
      scheduledRef.current = null;
      activeRef.current = null;
    };
  }, [enabled]);

  return {
    active,
    pauseUnderlay: active?.underlayPolicy === "pause"
  };
}

export function LedScoresGoalOverlay({ goal }: { goal: ActiveLedScoresGoal | null }) {
  if (!goal) return null;
  const scoringTeam = ledScoresScoringTeam(goal);
  const media = assetFor(goal.assets, goal.mediaAssetId);
  const logo = assetFor(goal.assets, goal.logoMediaAssetId);
  const sound = assetFor(goal.assets, goal.soundMediaAssetId);
  const sponsor = assetFor(goal.assets, goal.sponsorMediaAssetId);
  return <section
    aria-label={goal.scoringSide === "own" ? "Doelpunt voor eigen team" : goal.scoringSide === "opponent" ? "Doelpunt tegenstander" : "Doelpunt van onbekend team"}
    className={styles.overlay}
    data-animation={goal.design.animation}
    data-palette={goal.design.palette}
    data-testid="ledscores-goal-overlay"
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
    {sponsor ? <aside className={styles.sponsor}><span>Mede mogelijk gemaakt door</span><img alt="Sponsor" src={sponsor.url} /></aside> : null}
    {sound ? <GoalSound asset={sound} volume={goal.soundVolume} /> : null}
  </section>;
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
  if (!deliveryId || !executeAt || !expiresAt || !serverTime || !eventId || !scoringSide || !design || durationMs === null || homeScore === null || awayScore === null || previousHomeScore === null || previousAwayScore === null) return null;
  const assets = new Map<string, OverlayAsset>();
  for (const asset of value.assets.slice(0, 10)) {
    const parsed = parseAsset(asset);
    if (parsed) assets.set(parsed.mediaAssetId, parsed);
  }
  return {
    executeAt,
    expiresAt,
    goal: {
      assets,
      awayScore,
      awayTeam: safeText(payload.awayTeam, 160) ?? "Uitteam",
      deliveryId,
      design,
      durationMs,
      eventId,
      eventKind: payload.eventKind === "synthetic_test" ? "synthetic_test" as const : "live" as const,
      homeScore,
      homeTeam: safeText(payload.homeTeam, 160) ?? "Thuisteam",
      logoMediaAssetId: safeOptionalUuid(payload.logoMediaAssetId),
      matchClock: safeText(payload.matchClock, 40),
      mediaAssetId: safeOptionalUuid(payload.mediaAssetId),
      previousAwayScore,
      previousHomeScore,
      scorerName: safeText(payload.scorerName, 160),
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
      if (buffer.length > 128 * 1024) buffer = "";
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
  if (!data.length || !/^[a-z]+$/.test(event)) return null;
  try { return { event, value: JSON.parse(data.join("\n")) as unknown }; }
  catch { return null; }
}

function preloadAssets(configs: unknown[]) {
  for (const config of configs.slice(0, 50)) {
    if (!isRecord(config) || !Array.isArray(config.assets)) continue;
    for (const value of config.assets.slice(0, 10)) {
      const asset = parseAsset(value);
      if (!asset) continue;
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
function parseAsset(value: unknown): OverlayAsset | null { if (!isRecord(value)) return null; const mediaAssetId = safeUuid(value.mediaAssetId); const checksum = typeof value.checksum === "string" && /^[a-f0-9]{64}$/.test(value.checksum) ? value.checksum : null; const mimeType = typeof value.mimeType === "string" && /^(image\/(jpeg|png|webp)|video\/mp4)$/.test(value.mimeType) ? value.mimeType : null; const url = typeof value.url === "string" && /^https?:\/\//.test(value.url) && value.url.length <= 2_000 ? value.url : null; return mediaAssetId && checksum && mimeType && url ? { checksum, mediaAssetId, mimeType, url } : null; }
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
