"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import {
  createDynamicTemplateView,
  dynamicTemplatePageDurationMs,
  type DynamicTemplateListItem,
  type DynamicTemplatePage,
  type DynamicTemplateStandingItem,
  type DynamicTemplateView
} from "./dynamic-template-view";
import styles from "./editorial-arena-renderer.module.css";

type ArenaStyle = CSSProperties & {
  "--arena-accent": string;
  "--arena-page-duration": string;
  "--arena-viewport-inset-x": string;
};

const arenaCanvasSize = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 }
} as const;

export type EditorialArenaItem = {
  accessibilityName?: string;
  durationSeconds: number;
  dynamicTemplate?: PlayerDynamicTemplatePayload;
  id: string;
  title: string;
};

export function EditorialArenaRenderer({
  item,
  onReady = () => undefined,
  pageIndex: controlledPageIndex,
  passive = false
}: {
  item: EditorialArenaItem;
  onReady?: (itemId: string) => void;
  pageIndex?: number;
  passive?: boolean;
}) {
  const view = useMemo(
    () => createDynamicTemplateView(item.dynamicTemplate),
    [item.dynamicTemplate]
  );
  const readyRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [canvasScale, setCanvasScale] = useState<number | null>(null);
  const [canvasInsetX, setCanvasInsetX] = useState(0);
  const pageCount = view?.pages.length ?? 0;
  const canvas = arenaCanvasSize[view?.orientation ?? "landscape"];

  useEffect(() => {
    setInternalPageIndex(0);
  }, [item.id, view?.snapshotId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !view) return;
    const updateScale = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width < 1 || height < 1) return;
      const fillsPortraitViewport = view.orientation === "portrait" && height >= width;
      const scale = fillsPortraitViewport
        ? Math.max(width / canvas.width, height / canvas.height)
        : Math.min(width / canvas.width, height / canvas.height);
      setCanvasScale(scale);
      setCanvasInsetX(
        fillsPortraitViewport
          ? Math.max(0, (canvas.width - width / scale) / 2)
          : 0
      );
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateScale)
      : null;
    observer?.observe(viewport);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [canvas.height, canvas.width, view]);

  useEffect(() => {
    if (!view || canvasScale === null || passive || readyRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      readyRef.current = true;
      onReady(item.id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canvasScale, item.id, onReady, passive, view]);

  useEffect(() => {
    if (
      !view ||
      pageCount <= 1 ||
      passive ||
      controlledPageIndex !== undefined
    ) return;
    const interval = window.setInterval(
      () => setInternalPageIndex((current) => (current + 1) % pageCount),
      dynamicTemplatePageDurationMs(
        item.durationSeconds,
        pageCount,
        view.pageDurationMs
      )
    );
    return () => window.clearInterval(interval);
  }, [controlledPageIndex, item.durationSeconds, pageCount, passive, view]);

  if (!view) return null;
  const pageIndex = controlledPageIndex === undefined
    ? internalPageIndex
    : Math.min(Math.max(0, controlledPageIndex), Math.max(pageCount - 1, 0));
  const page = view.pages[pageIndex] ?? view.pages[0]!;
  const pageDurationMs = dynamicTemplatePageDurationMs(
    item.durationSeconds,
    pageCount,
    view.pageDurationMs
  );
  const style: ArenaStyle = {
    "--arena-accent": view.accentColor,
    "--arena-page-duration": `${pageDurationMs}ms`,
    "--arena-viewport-inset-x": `${canvasInsetX}px`,
    height: canvas.height,
    opacity: canvasScale === null ? 0 : 1,
    transform: `translate(-50%, -50%) scale(${canvasScale ?? 1})`,
    width: canvas.width
  };

  return (
    <div className={styles.arenaViewport} ref={viewportRef}>
      <section
        aria-label={item.accessibilityName ?? item.title}
        className={styles.arenaRoot}
        data-canvas-height={canvas.height}
        data-canvas-width={canvas.width}
        data-orientation={view.orientation}
        data-passive={passive || undefined}
        data-slide-type={view.slideType}
        data-theme={view.theme}
        style={style}
      >
        <ArenaHeader view={view} />
        <main
          className={styles.arenaContent}
          data-page-count={pageCount}
          data-page-index={pageIndex}
        >
          <ArenaPage
            key={`${view.snapshotId}-${pageIndex}`}
            page={page}
            view={view}
          />
          {view.emptyState && pageIsEmpty(page) ? (
            <div className={styles.arenaEmpty}>{view.emptyState}</div>
          ) : null}
        </main>
        <ArenaFooter
          pageCount={pageCount}
          pageIndex={pageIndex}
          view={view}
        />
      </section>
    </div>
  );
}

function ArenaHeader({ view }: { view: DynamicTemplateView }) {
  const initials = initialsFor(view.clubName);
  return (
    <header className={styles.arenaMasthead}>
      <div aria-hidden="true" className={styles.arenaCrest}>
        {view.clubLogoUrl ? (
          // Verified release-cache/blob URL; never use the online optimizer.
          <img alt="" src={view.clubLogoUrl} />
        ) : (
          <>
            <span>{initials}</span>
            <i />
          </>
        )}
      </div>
      <div className={styles.arenaHeading}>
        <h1>{view.title}</h1>
      </div>
      <div className={styles.arenaContext}>
        <strong>{view.sourceLabel}</strong>
        <span><i aria-hidden="true" /> VeyoCast</span>
      </div>
    </header>
  );
}

function ArenaFooter({
  pageCount,
  pageIndex,
  view
}: {
  pageCount: number;
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  return (
    <footer className={styles.arenaFooter}>
      <span><i aria-hidden="true" /> {view.sourceLabel}</span>
      <span>
        {pageCount > 1
          ? `${pageIndex + 1} / ${pageCount}`
          : "Actuele clubinformatie"}
      </span>
    </footer>
  );
}

function ArenaPage({
  page,
  view
}: {
  page: DynamicTemplatePage;
  view: DynamicTemplateView;
}) {
  if (page.kind === "menu") {
    return (
      <div className={styles.arenaMenuLayout}>
        <section className={`${styles.arenaPanel} ${styles.arenaMenuHero}`}>
          <PanelTitle label="Kantine" title="Vandaag op het menu" />
          <h2>Lekker voor, tijdens &amp; <em>na de wedstrijd</em></h2>
          <p>Vers uit de clubkantine. Prijzen en beschikbaarheid zijn actueel.</p>
        </section>
        <section className={styles.arenaMenuItems}>
          {page.items.map((product) => (
            <article className={`${styles.arenaPanel} ${styles.arenaMenuCard}`} key={product.id}>
              <div aria-hidden="true" className={styles.arenaProductImage}>
                {product.imageUrl ? (
                  <img alt="" src={product.imageUrl} />
                ) : <span>{initialsFor(product.name)}</span>}
              </div>
              <div>
                <h3>{product.name}</h3>
                {product.variant ? <em>{product.variant}</em> : null}
                {product.description ? <p>{product.description}</p> : null}
              </div>
              <strong>{product.price}</strong>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (page.kind === "news") {
    const article = page.item;
    return (
      <div className={styles.arenaNewsLayout}>
        <section className={`${styles.arenaPanel} ${styles.arenaNewsHero}`}>
          {article?.heroUrl ? (
            <img alt="" src={article.heroUrl} />
          ) : <span aria-hidden="true">{initialsFor(view.sourceLabel)}</span>}
          <div className={styles.arenaNewsSource}>
            {view.providerLogoUrl ? (
              <img alt={view.sourceLabel} src={view.providerLogoUrl} />
            ) : <strong>{view.sourceLabel}</strong>}
          </div>
        </section>
        <article className={`${styles.arenaPanel} ${styles.arenaNewsStory}`}>
          {article ? (
            <>
              <span>Laatste nieuws</span>
              <h2 className={newsTitleClassName(article.title)}>{article.title}</h2>
              {article.intro ? <p>{article.intro}</p> : null}
              <div className={styles.arenaNewsMeta} data-testid="news-meta">
                {article.date ? <small><b>Datum</b>{article.date}</small> : null}
                <small><b>Door</b>{article.author || article.source}</small>
              </div>
              {article.qrUrl ? (
                <div className={styles.arenaNewsQr} data-testid="news-qr">
                  <img alt={`QR-code naar ${article.title}`} src={article.qrUrl} />
                  <span>Scan voor het artikel</span>
                </div>
              ) : null}
            </>
          ) : null}
        </article>
      </div>
    );
  }

  if (page.kind === "standing") {
    return <ArenaStanding items={page.items} view={view} />;
  }

  if (page.kind === "match") {
    return <ArenaNextMatch item={page.item} view={view} />;
  }

  if (view.slideType === "sport_activities") {
    return (
      <div className={styles.arenaAgendaLayout}>
        <section className={`${styles.arenaPanel} ${styles.arenaListPanel}`}>
          <PanelTitle label="Binnenkort" title="Clubagenda" />
          {page.items.map((entry) => (
            <ArenaRow item={entry} key={entry.id} kind="agenda" />
          ))}
        </section>
        <aside className={`${styles.arenaPanel} ${styles.arenaStatPanel}`}>
          <span>Op de club</span>
          <strong>{page.items.length}</strong>
          <p>activiteiten in deze selectie</p>
        </aside>
      </div>
    );
  }

  if (view.slideType === "sport_cancellations") {
    return (
      <div className={styles.arenaAlertLayout}>
        <section className={`${styles.arenaPanel} ${styles.arenaListPanel}`}>
          <PanelTitle label="Wedstrijddag" title="Actuele meldingen" />
          {page.items.map((entry) => (
            <ArenaRow item={entry} key={entry.id} kind="cancellation" />
          ))}
        </section>
        <aside className={`${styles.arenaPanel} ${styles.arenaStatPanel}`}>
          <span>Afgelast</span>
          <strong>{page.items.length}</strong>
          <p>De laatste bevestigde Sportlink-status blijft zichtbaar.</p>
        </aside>
      </div>
    );
  }

  if (view.slideType === "sport_dressing_rooms") {
    const midpoint = Math.ceil(page.items.length / 2);
    return (
      <div className={styles.arenaGroundLayout}>
        {[page.items.slice(0, midpoint), page.items.slice(midpoint)].map(
          (items, index) => (
            <section className={`${styles.arenaPanel} ${styles.arenaListPanel}`} key={index}>
              <PanelTitle label={`Indeling ${index + 1}`} title="Veld & kleedkamers" />
              {items.map((entry) => (
                <ArenaRow item={entry} key={entry.id} kind="dressing" />
              ))}
            </section>
          )
        )}
      </div>
    );
  }

  if (view.slideType === "sport_results") {
    return (
      <section className={`${styles.arenaPanel} ${styles.arenaFixturePanel}`}>
        <PanelTitle label="Laatste speelronde" title="Uitslagen" />
        {page.items.map((entry) => (
          <ResultRow item={entry} key={entry.id} />
        ))}
      </section>
    );
  }

  if (view.slideType === "sport_officials") {
    return (
      <div className={styles.arenaAlertLayout}>
        <section className={`${styles.arenaPanel} ${styles.arenaListPanel}`}>
          <PanelTitle label="Wedstrijddag" title="Aanstellingen" />
          {page.items.map((entry) => (
            <ArenaRow item={entry} key={entry.id} kind="official" />
          ))}
        </section>
        <aside className={`${styles.arenaPanel} ${styles.arenaStatPanel}`}>
          <span>Vandaag actief</span>
          <strong>{page.items.reduce((count, item) => count + Math.max(item.officials.length, 1), 0)}</strong>
          <p>officials op ons complex</p>
        </aside>
      </div>
    );
  }

  return (
    <section className={`${styles.arenaPanel} ${styles.arenaFixturePanel}`}>
      <PanelTitle label="Aankomende wedstrijden" title="Programma" />
      {page.items.map((entry) => (
        <ProgramRow item={entry} key={entry.id} />
      ))}
    </section>
  );
}

function newsTitleClassName(title: string) {
  if (title.length > 64) return styles.arenaNewsTitleDense;
  return undefined;
}

function ArenaStanding({
  items,
  view
}: {
  items: DynamicTemplateStandingItem[];
  view: DynamicTemplateView;
}) {
  return (
    <section className={`${styles.arenaPanel} ${styles.arenaStanding}`}>
      <div className={styles.arenaStandingHead} aria-hidden="true">
        <span>#</span><span>Team</span><span>G</span><span>W</span>
        <span>GL</span><span>V</span><span>PT</span><span>+/−</span><span>Vorm</span>
      </div>
      <div className={styles.arenaStandingRows}>
        {items.map((team) => (
          <article data-selected={team.selected || undefined} key={team.id}>
            <strong>{team.position ?? "–"}</strong>
            <span className={styles.arenaStandingTeam}>
              {team.logoUrl ? (
                <img alt="" src={team.logoUrl} />
              ) : (
                <i aria-hidden="true">{initialsFor(team.teamName)}</i>
              )}
              <b>{team.teamName}</b>
            </span>
            <span>{team.played ?? "–"}</span>
            <span>{team.won ?? "–"}</span>
            <span>{team.drawn ?? "–"}</span>
            <span>{team.lost ?? "–"}</span>
            <strong>{team.points ?? "–"}</strong>
            <span>{signed(team.goalDifference)}</span>
            <span
              aria-label={`Vorm ${team.teamName}: ${
                team.form.length
                  ? team.form.map(resultLabel).join(", ")
                  : "niet beschikbaar"
              }`}
              className={styles.arenaForm}
            >
              {team.form.length ? team.form.map((result, index) => (
                <i data-result={result} key={`${result}-${index}`}>
                  {result === "win" ? "W" : result === "draw" ? "G" : "V"}
                </i>
              )) : "–"}
            </span>
          </article>
        ))}
      </div>
      {view.standingContext ? (
        <p className={styles.arenaStandingContext}>
          {[view.standingContext.competition, view.standingContext.pool, view.standingContext.season]
            .filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function ArenaNextMatch({
  item,
  view
}: {
  item: DynamicTemplateListItem | null;
  view: DynamicTemplateView;
}) {
  const home = item?.homeTeam || splitTeams(item?.primary ?? "")[0];
  const away = item?.awayTeam || splitTeams(item?.primary ?? "")[1];
  return (
    <div className={styles.arenaMatchLayout}>
      <section className={`${styles.arenaPanel} ${styles.arenaMatchMain}`}>
        <div className={styles.arenaMatchMeta}>{item?.competition || view.sourceLabel}</div>
        <div className={styles.arenaVersus}>
          <TeamBadge name={home} />
          <div>
            <span>{item?.date || item?.secondary}</span>
            <strong>{item?.time || "Tijd volgt"}</strong>
            <i>VS</i>
            <small>{item?.venue || item?.meta || "Locatie volgt"}</small>
          </div>
          <TeamBadge name={away} />
        </div>
      </section>
      <aside className={`${styles.arenaPanel} ${styles.arenaMatchSide}`}>
        <PanelTitle label="Wedstrijdinformatie" title="Volgende wedstrijd" />
        <dl>
          <div><dt>Datum</dt><dd>{item?.date || item?.secondary || "Volgt"}</dd></div>
          <div><dt>Aftrap</dt><dd>{item?.time || "Volgt"}</dd></div>
          <div><dt>Locatie</dt><dd>{item?.venue || item?.meta || "Volgt"}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function ProgramRow({ item }: { item: DynamicTemplateListItem }) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  return (
    <article className={styles.arenaProgramRow}>
      <strong>{item.date || item.secondary}</strong>
      <span><TeamMini name={home} /> {home} <i>VS</i> <TeamMini name={away} /> {away}</span>
      <small>{item.venue || item.meta}</small>
      <b>{item.time}</b>
    </article>
  );
}

function ResultRow({ item }: { item: DynamicTemplateListItem }) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  return (
    <article className={styles.arenaResultRow}>
      <span>{home} <TeamMini name={home} /></span>
      <strong>
        <i>{item.homeScore ?? "–"}</i><b>–</b><i>{item.awayScore ?? "–"}</i>
      </strong>
      <span><TeamMini name={away} /> {away}</span>
      <small>{item.date || item.secondary}</small>
    </article>
  );
}

function ArenaRow({
  item,
  kind
}: {
  item: DynamicTemplateListItem;
  kind: "agenda" | "cancellation" | "dressing" | "official";
}) {
  let meta: ReactNode = item.venue || item.meta;
  if (kind === "dressing") {
    meta = (
      <span className={styles.arenaRoom}>
        {[item.homeRoom && `Thuis ${item.homeRoom}`, item.awayRoom && `Uit ${item.awayRoom}`]
          .filter(Boolean).join(" · ") || item.meta}
      </span>
    );
  } else if (kind === "official") {
    meta = item.officials.join(" · ") || item.meta || "Nog niet bekend";
  }
  return (
    <article className={styles.arenaRow} data-kind={kind}>
      <strong>{item.time || item.date || item.secondary}</strong>
      <div><h3>{item.primary}</h3><p>{meta}</p></div>
      {kind === "cancellation" ? <b>{item.status || "Afgelast"}</b> : null}
    </article>
  );
}

function PanelTitle({ label, title }: { label: string; title: string }) {
  return (
    <header className={styles.arenaPanelTitle}>
      <span>{label}</span>
      <h2>{title}</h2>
    </header>
  );
}

function TeamBadge({ name }: { name: string }) {
  return (
    <article className={styles.arenaTeamBadge}>
      <TeamMini name={name} large />
      <h2>{name}</h2>
    </article>
  );
}

function TeamMini({ large = false, name }: { large?: boolean; name: string }) {
  return (
    <i aria-hidden="true" className={large ? styles.arenaTeamLarge : styles.arenaTeamMini}>
      {initialsFor(name)}
    </i>
  );
}

function pageIsEmpty(page: DynamicTemplatePage) {
  if (page.kind === "news" || page.kind === "match") return !page.item;
  return page.items.length === 0;
}

function initialsFor(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase()).join("") || "VC";
}

function splitTeams(value: string) {
  const parts = value.split(/\s+[–—-]\s+/).map((part) => part.trim());
  return [parts[0] || "Thuisteam", parts.slice(1).join(" – ") || "Uitteam"] as const;
}

function signed(value: number | null) {
  if (value === null) return "–";
  return value > 0 ? `+${value}` : String(value);
}

function resultLabel(result: string) {
  if (result === "win") return "winst";
  if (result === "draw") return "gelijk";
  return "verlies";
}
