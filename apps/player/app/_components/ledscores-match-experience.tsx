"use client";

/* eslint-disable @next/next/no-img-element -- Signed Player media is short lived and rendered directly. */

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  formatLedScoresClock,
  isLedScoresMatchStateStale,
  ledScoresMatchServerNow,
  resolveLedScoresClockSeconds,
  type ActiveLedScoresMatchOverlay,
  type LedScoresLiveMatchConfig,
  type LedScoresMatchState,
  type LedScoresMatchStatus,
  type LedScoresPlayerViewModel,
  type LedScoresSide,
  type LedScoresTeamViewModel
} from "../_lib/ledscores-match-experience";
import {
  LedScoresCanvasSceneRenderer,
  type LedScoresCanvasRendererValues
} from "./ledscores-canvas-scene";
import styles from "./ledscores-match-experience.module.css";

export function LedScoresMatchOverlay({
  overlay
}: {
  overlay: ActiveLedScoresMatchOverlay | null;
}) {
  const lineupPagination = useLineupPagination(overlay);
  const [failedCanvasDeliveryId, setFailedCanvasDeliveryId] = useState<string | null>(null);
  return <LedScoresMatchOverlayContent
    canvasBackgroundFailed={failedCanvasDeliveryId === overlay?.deliveryId}
    lineupPagination={lineupPagination}
    onCanvasBackgroundError={() => {
      if (!overlay) return;
      setFailedCanvasDeliveryId((current) => current === overlay.deliveryId
        ? current
        : overlay.deliveryId);
    }}
    overlay={overlay}
  />;
}

export function LedScoresMatchOverlayContent({
  canvasBackgroundFailed,
  lineupPagination,
  onCanvasBackgroundError,
  overlay
}: {
  canvasBackgroundFailed: boolean;
  lineupPagination: {
    pageCount: number;
    pageIndex: number;
    players: readonly LedScoresPlayerViewModel[];
  };
  onCanvasBackgroundError: () => void;
  overlay: ActiveLedScoresMatchOverlay | null;
}) {
  if (!overlay) return null;
  if (overlay.kind === "lineup_clear") return null;
  if (overlay.scene && !canvasBackgroundFailed) {
    return (
      <LedScoresCanvasSceneRenderer
        ariaLabel={overlay.kind === "lineup"
          ? `Opstelling ${overlay.side === "away"
            ? overlay.away.name
            : overlay.home.name}`
          : overlayAccessibilityLabel(overlay.kind)}
        assets={overlay.assets}
        onBackgroundMediaError={onCanvasBackgroundError}
        scene={overlay.scene}
        testId="ledscores-match-canvas"
        values={matchOverlayCanvasValues(overlay, lineupPagination.players)}
      />
    );
  }
  if (overlay.kind === "lineup") {
    const team = overlay.side === "away" ? overlay.away : overlay.home;
    return (
      <section
        aria-label={`Opstelling ${team.name}`}
        className={`${styles.overlay} ${styles.lineupOverlay}`}
        data-animation={overlay.design.animation}
        data-logo-position={overlay.design.logoPosition}
        data-logo-scale={overlay.design.logoScale}
        data-palette={overlay.design.palette}
        data-template={overlay.design.templateId}
        data-testid="ledscores-match-overlay"
        data-typography={overlay.design.typography}
      >
        <OverlayBackdrop />
        <header className={styles.lineupHeader}>
          <TeamMark team={team} />
          <div>
            <p>{overlay.side === "home" ? "Thuisteam" : "Uitteam"}</p>
            <h1>{overlay.design.headline}</h1>
            <strong>{team.name}</strong>
            {overlay.design.secondaryText ? <span className={styles.lineupLead}>{overlay.design.secondaryText}</span> : null}
          </div>
          <div className={styles.lineupHeaderMeta}>
            {overlay.design.showPreviousScore ? (
              <span aria-label={`Stand ${overlay.home.score} tegen ${overlay.away.score}`} className={styles.lineupScore}>
                {overlay.home.score}–{overlay.away.score}
              </span>
            ) : null}
            {overlay.design.showClock && overlay.matchClock ? <time>{overlay.matchClock}</time> : null}
            {lineupPagination.pageCount > 1 ? (
              <span className={styles.lineupPage} aria-label={
                `Pagina ${lineupPagination.pageIndex + 1} van ${lineupPagination.pageCount}`
              }>
                {lineupPagination.pageIndex + 1} / {lineupPagination.pageCount}
              </span>
            ) : null}
          </div>
        </header>
        <div className={styles.lineupGrid} data-page={lineupPagination.pageIndex + 1}>
          {lineupPagination.players.map((player, index) => (
            <LineupPlayer
              index={index}
              key={player.id ?? `${player.name}:${player.number ?? index}`}
              player={player}
            />
          ))}
        </div>
        <OverlayFooter overlay={overlay} />
      </section>
    );
  }

  return (
    <section
      aria-label={overlayAccessibilityLabel(overlay.kind)}
      className={`${styles.overlay} ${styles.momentOverlay}`}
      data-animation={overlay.design.animation}
      data-logo-position={overlay.design.logoPosition}
      data-logo-scale={overlay.design.logoScale}
      data-palette={overlay.design.palette}
      data-template={overlay.design.templateId}
      data-testid="ledscores-match-overlay"
      data-typography={overlay.design.typography}
    >
      <OverlayBackdrop />
      <div className={styles.momentContent}>
        <p className={styles.kicker}>{overlay.periodLabel ?? momentKicker(overlay.kind)}</p>
        <h1>{overlay.design.headline}</h1>
        {overlay.design.secondaryText ? <p className={styles.lead}>{overlay.design.secondaryText}</p> : null}
        <ScoreBoard
          away={overlay.away}
          home={overlay.home}
          showScore={overlay.design.showPreviousScore}
        />
        {overlay.design.showClock && overlay.matchClock ? (
          <div className={styles.overlayClock}>{overlay.matchClock}</div>
        ) : null}
      </div>
      <OverlayFooter overlay={overlay} />
    </section>
  );
}

export function matchOverlayCanvasValues(
  overlay: ActiveLedScoresMatchOverlay,
  lineup: readonly LedScoresPlayerViewModel[] = overlay.lineup
): LedScoresCanvasRendererValues {
  const selectedTeam = overlay.side === "away"
    ? overlay.away
    : overlay.side === "home"
      ? overlay.home
      : null;
  return {
    images: {
      awayLogo: overlay.away.logoUrl,
      homeLogo: overlay.home.logoUrl,
      scorerPhoto: null,
      scoringTeamLogo: selectedTeam?.logoUrl ?? null
    },
    lineup,
    text: {
      awayScore: String(overlay.away.score),
      awayTeam: overlay.away.name,
      clock: overlay.matchClock ?? undefined,
      eventLabel: overlay.kind === "lineup"
        ? overlay.side === "away" ? "UITTEAM" : "THUISTEAM"
        : overlay.kind === "half_time"
          ? "RUST"
        : overlay.kind === "match_end"
            ? "EINDSTAND"
            : "AFTRAP",
      homeScore: String(overlay.home.score),
      homeTeam: overlay.home.name,
      period: overlay.periodLabel ?? momentKicker(overlay.kind),
      previousScore: `${overlay.home.score} – ${overlay.away.score}`,
      score: `${overlay.home.score} – ${overlay.away.score}`,
      scoringTeam: selectedTeam?.name ?? undefined
    }
  };
}

function useLineupPagination(overlay: ActiveLedScoresMatchOverlay | null) {
  const portrait = usePortraitOrientation();
  const pageSize = portrait ? 8 : 11;
  const lineup = overlay?.kind === "lineup" ? overlay.lineup : [];
  const pageCount = Math.max(1, Math.ceil(lineup.length / pageSize));
  const [page, setPage] = useState({ eventId: "", index: 0 });
  const pageIndex = page.eventId === overlay?.eventId
    ? page.index % pageCount
    : 0;

  useEffect(() => {
    if (!overlay || overlay.kind !== "lineup" || pageCount <= 1) return;
    const timer = window.setInterval(() => {
      setPage((current) => ({
        eventId: overlay.eventId,
        index: current.eventId === overlay.eventId
          ? (current.index + 1) % pageCount
          : 1 % pageCount
      }));
    }, overlay.lineupPageDurationMs);
    return () => window.clearInterval(timer);
  }, [overlay, pageCount]);

  return {
    pageCount,
    pageIndex,
    players: lineup.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  };
}

function usePortraitOrientation() {
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" &&
    window.matchMedia("(orientation: portrait)").matches);
  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const handleChange = (event: MediaQueryListEvent) => setPortrait(event.matches);
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    }
    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);
  return portrait;
}

export function LedScoresLiveMatchSlide({
  config,
  now: fixedNow,
  onReady,
  orientation,
  state
}: {
  config: LedScoresLiveMatchConfig;
  now?: number;
  onReady?: () => void;
  orientation: "landscape" | "portrait";
  state: LedScoresMatchState;
}) {
  const readyRef = useRef(false);
  const tickingNow = useLedScoresNow(true, fixedNow);
  const serverNow = ledScoresMatchServerNow(state, tickingNow);
  const stale = isLedScoresMatchStateStale(state, tickingNow);
  const clock = formatLedScoresClock(
    resolveLedScoresClockSeconds(state.clock, serverNow, state.staleAfter)
  );
  const timeline = useMemo(
    () => state.timeline.slice(-config.timelineLimit).reverse(),
    [config.timelineLimit, state.timeline]
  );

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.();
  }, [onReady]);

  return (
    <section
      aria-label={`${config.title}: ${state.home.name} tegen ${state.away.name}`}
      className={styles.liveSlide}
      data-accent={config.accentMode}
      data-has-timeline={config.template === "match_center" &&
        config.showTimeline && timeline.length ? "true" : "false"}
      data-orientation={orientation}
      data-stale={stale ? "true" : "false"}
      data-template={config.template}
      data-testid="ledscores-live-match-slide"
    >
      <div className={styles.liveBackdrop} aria-hidden="true"><span /><span /></div>
      <header className={styles.liveHeader}>
        <div>
          <p>{config.title}</p>
          <h1>{matchStatusLabel(state.status)}</h1>
        </div>
        {config.showStatus ? (
          <div className={styles.liveStatus} data-status={stale ? "stale" : state.status}>
            <span aria-hidden="true" />
            {stale ? "Laatste stand" : matchStatusDetail(state.status)}
          </div>
        ) : null}
      </header>
      <div className={styles.liveBody}>
        <section className={styles.liveScorePanel} aria-label="Actuele tussenstand">
          <ScoreBoard away={state.away} home={state.home} live />
          <div className={styles.liveMeta}>
            {config.showClock ? <time>{clock}</time> : null}
            {state.periodLabel ? <span>{state.periodLabel}</span> : null}
          </div>
        </section>
        {config.template === "match_center" && config.showTimeline && timeline.length ? (
          <aside className={styles.timeline} aria-label="Wedstrijdverloop">
            <header>
              <p>Wedstrijdverloop</p>
              <span>{timeline.length} momenten</span>
            </header>
            <ol>
              {timeline.map((item) => (
                <li data-kind={item.kind} key={item.id}>
                  <time>{item.clockLabel ?? "•"}</time>
                  <span aria-hidden="true" className={styles.timelineMark} />
                  <div>
                    <strong>{item.playerName ?? item.label}</strong>
                    {item.playerName ? <span>{item.label}</span> : null}
                  </div>
                  {item.homeScore !== null && item.awayScore !== null ? (
                    <b>{item.homeScore}–{item.awayScore}</b>
                  ) : null}
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
      </div>
      <footer className={styles.liveFooter}>
        <span>{state.home.name}</span>
        <span>{stale ? "De klok is veilig bevroren" : "Live wedstrijdinformatie"}</span>
        <span>{state.away.name}</span>
      </footer>
    </section>
  );
}

function ScoreBoard({
  away,
  home,
  live = false,
  showScore = true
}: {
  away: LedScoresTeamViewModel;
  home: LedScoresTeamViewModel;
  live?: boolean;
  showScore?: boolean;
}) {
  return (
    <div
      aria-label={showScore
        ? `Stand ${home.name} ${home.score}, ${away.name} ${away.score}`
        : `${home.name} tegen ${away.name}`}
      className={`${styles.scoreBoard} ${live ? styles.liveScoreBoard : ""}`}
      data-show-score={showScore ? "true" : "false"}
    >
      <TeamScore side="home" team={home} />
      {showScore ? (
        <div className={styles.scoreNumbers}>
          <span>{home.score}</span><small>–</small><span>{away.score}</span>
        </div>
      ) : null}
      <TeamScore side="away" team={away} />
    </div>
  );
}

function TeamScore({ side, team }: { side: LedScoresSide; team: LedScoresTeamViewModel }) {
  return (
    <div className={styles.teamScore} data-side={side}>
      <TeamMark team={team} />
      <strong>{team.name}</strong>
      <span>{side === "home" ? "Thuis" : "Uit"}</span>
    </div>
  );
}

function TeamMark({ team }: { team: LedScoresTeamViewModel }) {
  return team.logoUrl ? (
    <img alt="" aria-hidden="true" className={styles.teamMark} src={team.logoUrl} />
  ) : (
    <span aria-hidden="true" className={`${styles.teamMark} ${styles.teamInitials}`}>
      {teamInitials(team.name)}
    </span>
  );
}

function LineupPlayer({
  index,
  player
}: {
  index: number;
  player: LedScoresPlayerViewModel;
}) {
  return (
    <article className={styles.playerCard} style={{ "--player-order": index } as React.CSSProperties}>
      <div className={styles.playerPhoto}>
        {player.photoUrl ? <img alt="" aria-hidden="true" src={player.photoUrl} /> : <span aria-hidden="true">{teamInitials(player.name)}</span>}
      </div>
      <div>
        <span>{player.number ?? "—"}</span>
        <strong>{player.name}</strong>
      </div>
    </article>
  );
}

function OverlayBackdrop() {
  return <div aria-hidden="true" className={styles.overlayBackdrop}><span /><span /><span /></div>;
}

function OverlayFooter({ overlay }: { overlay: ActiveLedScoresMatchOverlay }) {
  return (
    <footer className={styles.overlayFooter}>
      <span>{overlay.home.name}</span>
      {overlay.eventKind === "synthetic_test" ? <strong>LIVE-TEST</strong> : <strong>{overlay.periodLabel ?? "Wedstrijd"}</strong>}
      <span>{overlay.away.name}</span>
    </footer>
  );
}

function useLedScoresNow(running: boolean, fixedNow?: number) {
  const [now, setNow] = useState(() => fixedNow ?? Date.now());
  useEffect(() => {
    if (fixedNow !== undefined || !running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [fixedNow, running]);
  return fixedNow ?? now;
}

function matchStatusLabel(status: LedScoresMatchStatus) {
  return {
    finished: "Eindstand",
    half_time: "Ruststand",
    live: "Live wedstrijd",
    paused: "Wedstrijd onderbroken",
    pre_match: "Wedstrijd staat klaar",
    unknown: "Laatste wedstrijdstand"
  }[status];
}

function matchStatusDetail(status: LedScoresMatchStatus) {
  return {
    finished: "Afgelopen",
    half_time: "Rust",
    live: "Live",
    paused: "Gepauzeerd",
    pre_match: "Voor de aftrap",
    unknown: "Status onbekend"
  }[status];
}

function momentKicker(kind: ActiveLedScoresMatchOverlay["kind"]) {
  return {
    half_time: "Halverwege",
    lineup: "Team",
    lineup_clear: "Team",
    match_end: "Afgelopen",
    match_start: "Aftrap"
  }[kind];
}

function overlayAccessibilityLabel(kind: ActiveLedScoresMatchOverlay["kind"]) {
  return {
    half_time: "Ruststand",
    lineup: "Opstelling",
    lineup_clear: "Opstelling sluiten",
    match_end: "Eindstand",
    match_start: "Start van de wedstrijd"
  }[kind];
}

function teamInitials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("") || "VC";
}
