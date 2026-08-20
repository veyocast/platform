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
  type DynamicTemplatePriceEntry,
  type DynamicTemplateStandingItem,
  type DynamicTemplateView
} from "./dynamic-template-view";
import {
  editorialArenaCanvas,
  sportColumnCount,
  sportRowHeight
} from "./editorial-arena-layout";
import { editorialThemeCssVariables } from "./editorial-arena-theme";
import type {
  PriceListRenderPage,
  ResolvedPriceListItem,
  ResolvedPriceListRow
} from "./price-list";
import styles from "./editorial-arena-renderer.module.css";
import {
  resolveThemeTransition,
  themeCssVariables
} from "./theme-catalog";

type ArenaStyle = CSSProperties & {
  "--arena-accent": string;
  "--arena-page-duration": string;
  "--arena-row-height": string;
  "--vc-motion-duration": string;
  "--vc-motion-easing": string;
  "--vc-motion-translate": string;
};

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
  const pageCount = view?.pages.length ?? 0;
  const canvas = editorialArenaCanvas[view?.orientation ?? "landscape"];

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
      const scale = Math.min(width / canvas.width, height / canvas.height);
      setCanvasScale(scale);
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
    let active = true;
    let frame = 0;
    const fontsReady = "fonts" in document
      ? document.fonts.ready
      : Promise.resolve();
    void fontsReady.then(() => {
      if (!active) return;
      frame = window.requestAnimationFrame(() => {
        if (!active) return;
        readyRef.current = true;
        onReady(item.id);
      });
    });
    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
    };
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
  const transition = resolveThemeTransition(
    view.themePresentation,
    page.kind,
    false
  );
  const style: ArenaStyle = {
    ...editorialThemeCssVariables(view.themeTokens),
    ...themeCssVariables(view.themePresentation),
    "--arena-accent": view.accentColor,
    "--arena-page-duration": `${pageDurationMs}ms`,
    "--arena-row-height": `${pageRowHeight(page, view)}px`,
    "--vc-motion-duration": `${transition.durationMs}ms`,
    "--vc-motion-easing": transition.easing,
    "--vc-motion-translate": `${transition.translatePercent}%`,
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
        data-theme-id={view.themeId}
        data-transition={transition.key}
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
        <VerticalSlideIndex pageIndex={pageIndex} view={view} />
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
      <span className={styles.arenaFooterLine}><i aria-hidden="true" /></span>
      <span>{view.sourceLabel}</span>
      <span className={styles.arenaPageDots} aria-label={`Pagina ${pageIndex + 1} van ${pageCount}`}>
        <b>{pageIndex + 1} / {pageCount}</b>
        {Array.from({ length: Math.max(1, pageCount) }, (_, index) => (
          <i data-active={index === pageIndex || undefined} key={index} />
        ))}
      </span>
    </footer>
  );
}

function VerticalSlideIndex({
  pageIndex,
  view
}: {
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  const label = view.slideType === "news"
    ? "EDITORIAL"
    : view.slideType === "menu"
      ? "PRIJSLIJST"
      : "MATCHCENTRE";
  return (
    <span aria-hidden="true" className={styles.arenaVerticalIndex}>
      {label} / {String(pageIndex + 1).padStart(2, "0")}
    </span>
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
      <div className={styles.arenaPriceColumns}>
        {page.columns.map((entries, index) => (
          <section
            aria-label={`Prijslijst kolom ${index + 1}`}
            className={`${styles.arenaPanel} ${styles.arenaPriceColumn}`}
            key={index}
          >
            {entries.map((entry) => (
              <PriceEntry
                categoryPhotoModes={view.priceCategoryPhotoModes}
                entry={entry}
                key={entry.kind === "category" ? entry.id : entry.item.id}
                photoMode={view.pricePhotoMode}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }

  if (page.kind === "price-list") {
    return <ArenaPriceList page={page.page} />;
  }

  if (page.kind === "news") {
    const article = page.item;
    return (
      <div className={styles.arenaNewsLayout} data-news-variant={view.newsVariant}>
        <section className={`${styles.arenaPanel} ${styles.arenaNewsHero}`}>
          {article?.heroUrl ? (
            <img
              alt=""
              src={article.heroUrl}
              style={{
                objectPosition: `${article.imageFocalPoint.x * 100}% ${article.imageFocalPoint.y * 100}%`
              }}
            />
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
        {page.secondaryItems.length ? (
          <aside className={styles.arenaNewsGrid}>
            {page.secondaryItems.map((secondary) => (
              <article className={styles.arenaPanel} key={secondary.id}>
                <span>{secondary.source}</span>
                <h3>{secondary.title}</h3>
                <small>{secondary.date}</small>
              </article>
            ))}
          </aside>
        ) : null}
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
      <SportListColumns
        items={page.items}
        label="Laatste speelronde"
        renderRow={(entry) => <ResultRow item={entry} key={entry.id} />}
        title="Uitslagen"
        view={view}
      />
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
    <SportListColumns
      items={page.items}
      label="Aankomende wedstrijden"
      renderRow={(entry) => <ProgramRow item={entry} key={entry.id} />}
      title="Programma"
      view={view}
    />
  );
}

function SportListColumns({
  items,
  label,
  renderRow,
  title,
  view
}: {
  items: DynamicTemplateListItem[];
  label: string;
  renderRow: (item: DynamicTemplateListItem) => ReactNode;
  title: string;
  view: DynamicTemplateView;
}) {
  const columns = splitIntoColumns(items, view.orientation);
  return (
    <div className={styles.arenaSportColumns} data-columns={columns.length}>
      {columns.map((column, index) => (
        <section
          className={`${styles.arenaPanel} ${styles.arenaFixturePanel}`}
          key={index}
        >
          <PanelTitle
            label={columns.length > 1 ? `${label} · ${index + 1}` : label}
            title={title}
          />
          {column.map(renderRow)}
        </section>
      ))}
    </div>
  );
}

function ArenaPriceList({ page }: { page: PriceListRenderPage }) {
  return (
    <div className={styles.arenaPriceListGrid}>
      <PriceListColumn label="Linkerkolom" rows={page.columns.left} />
      <PriceListColumn label="Rechterkolom" rows={page.columns.right} />
    </div>
  );
}

function PriceListColumn({
  label,
  rows
}: {
  label: string;
  rows: ResolvedPriceListRow[];
}) {
  return (
    <section aria-label={label} className={styles.arenaPriceListColumn}>
      {rows.map((row) => row.kind === "category" ? (
        <h2 className={styles.arenaPriceListCategory} key={row.id} title={row.name}>
          <i aria-hidden="true" />
          <span>{row.name}</span>
          {row.continuation ? <small>vervolg</small> : null}
        </h2>
      ) : (
        <PriceListProduct item={row.item} key={row.item.id} />
      ))}
    </section>
  );
}

function PriceListProduct({ item }: { item: ResolvedPriceListItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = item.image.kind === "image" && !imageFailed;
  return (
    <article className={styles.arenaPriceListProduct}>
      <span aria-hidden="true" className={styles.arenaPriceListMedia}>
        {hasImage && item.image.kind === "image" ? (
          <img
            alt=""
            onError={() => setImageFailed(true)}
            src={item.image.url}
            style={{ objectPosition: item.image.objectPosition }}
          />
        ) : null}
      </span>
      <span className={styles.arenaPriceListCopy}>
        <strong title={item.name}>{item.name}</strong>
        <small title={item.description}>{item.description || "\u00a0"}</small>
      </span>
      <b>{item.formattedPrice}</b>
    </article>
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
  const columns = splitIntoColumns(items, view.orientation);
  return (
    <section className={styles.arenaStandingLayout} data-columns={columns.length}>
      {columns.map((column, columnIndex) => (
        <div className={`${styles.arenaPanel} ${styles.arenaStanding}`} key={columnIndex}>
          <div
            className={styles.arenaStandingHead}
            aria-hidden="true"
            data-testid="standing-head"
          >
            <span>#</span><span>Team</span><span>GS</span><span>W</span>
            <span>G</span><span>V</span><span>DV</span><span>DT</span>
            <span>+/−</span><span>Vorm</span><span>PT</span><span>Zone</span>
          </div>
          <div className={styles.arenaStandingRows}>
            {column.map((team) => <StandingRow key={team.id} team={team} />)}
          </div>
        </div>
      ))}
      {view.standingContext ? (
        <p className={styles.arenaStandingContext}>
          {[view.standingContext.competition, view.standingContext.pool, view.standingContext.season]
            .filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function StandingRow({ team }: { team: DynamicTemplateStandingItem }) {
  return (
    <article
      data-standing-row=""
      data-selected={team.selected || undefined}
      data-zone={team.zone || undefined}
    >
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
      <span>{team.goalsFor ?? "–"}</span>
      <span>{team.goalsAgainst ?? "–"}</span>
      <span>{signed(team.goalDifference)}</span>
      <span
        aria-label={`Vorm ${team.teamName}: ${team.form.length
          ? team.form.map(resultLabel).join(", ")
          : "niet beschikbaar"}`}
        className={styles.arenaForm}
      >
        {team.form.length ? team.form.map((result, index) => (
          <i data-result={result} key={`${result}-${index}`}>
            {result === "win" ? "W" : result === "draw" ? "G" : "V"}
          </i>
        )) : "–"}
      </span>
      <strong>{team.points ?? "–"}</strong>
      <span className={styles.arenaStandingZone}>
        {team.zone === "promotion"
          ? "Prom."
          : team.zone === "relegation"
            ? "Degr."
            : team.zone === "playoff"
              ? "Play-off"
              : "–"}
      </span>
    </article>
  );
}

function PriceEntry({
  entry,
  photoMode,
  categoryPhotoModes
}: {
  entry: DynamicTemplatePriceEntry;
  photoMode: DynamicTemplateView["pricePhotoMode"];
  categoryPhotoModes: DynamicTemplateView["priceCategoryPhotoModes"];
}) {
  if (entry.kind === "category") {
    return <h2 className={styles.arenaPriceCategory}>{entry.name}</h2>;
  }
  const product = entry.item;
  const categoryMode = categoryPhotoModes[product.category] ?? "inherit";
  const resolvedPhotoMode = categoryMode === "inherit"
    ? photoMode
    : categoryMode;
  return (
    <article className={styles.arenaPriceRow}>
      <div aria-hidden="true" className={styles.arenaProductImage}>
        {resolvedPhotoMode === "show" && product.imageUrl ? (
          <img
            alt=""
            src={product.imageUrl}
            style={{
              objectPosition: `${product.imageFocalPoint.x * 100}% ${product.imageFocalPoint.y * 100}%`
            }}
          />
        ) : null}
      </div>
      <div>
        <h3>{product.name}</h3>
        {product.description || product.variant ? (
          <p>{product.description || product.variant}</p>
        ) : null}
      </div>
      <strong>{product.price}</strong>
    </article>
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
  if (page.kind === "menu") {
    return page.columns.every((column) => column.length === 0);
  }
  if (page.kind === "price-list") {
    return page.page.columns.left.length + page.page.columns.right.length === 0;
  }
  return page.items.length === 0;
}

function splitIntoColumns<T>(
  items: T[],
  orientation: DynamicTemplateView["orientation"]
) {
  const columns = sportColumnCount(orientation, items.length);
  if (columns === 1) return [items];
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
}

function pageRowHeight(
  page: DynamicTemplatePage,
  view: DynamicTemplateView
) {
  if (page.kind === "standing" || page.kind === "sport-list") {
    return sportRowHeight(view.orientation, page.items.length);
  }
  return 82;
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
