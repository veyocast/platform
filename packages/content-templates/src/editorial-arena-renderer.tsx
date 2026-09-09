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
  formatMatchCentreClock,
  formatMatchCentrePageCounter,
  formatVisitorVenueWelcome,
  resolveWelcomeMotionPreset,
  type DynamicTemplateBirthdayItem,
  type DynamicTemplateListItem,
  type DynamicTemplateNewsItem,
  type DynamicTemplatePage,
  type DynamicTemplatePriceEntry,
  type DynamicTemplateStandingItem,
  type DynamicTemplateView
} from "./dynamic-template-view";
import {
  editorialArenaCanvas,
  resolveEditorialArenaViewportFit,
  sportMatchRowHeight,
  sportColumnCount,
  sportRowHeight,
  type EditorialArenaViewportFit
} from "./editorial-arena-layout";
import { editorialThemeCssVariables } from "./editorial-arena-theme";
import type {
  PriceListRenderPage,
  ResolvedPriceListItem,
  ResolvedPriceListRow
} from "./price-list";
import { MenuSceneCanvas, resolveProductTitleDensity } from "./menu-scene";
import styles from "./editorial-arena-renderer.module.css";
import {
  resolveThemeTransition,
  themeCssVariables
} from "./theme-catalog";

type ArenaStyle = CSSProperties & {
  "--arena-accent": string;
  "--arena-page-duration": string;
  "--arena-row-height": string;
  "--arena-viewport-inset-x": string;
  "--arena-viewport-inset-y": string;
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
  embedded = false,
  item,
  onReady = () => undefined,
  pageIndex: controlledPageIndex,
  passive = false
}: {
  embedded?: boolean;
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
  const [viewportFit, setViewportFit] = useState<EditorialArenaViewportFit | null>(null);
  const pageCount = view?.pages.length ?? 0;
  const canvas = editorialArenaCanvas[view?.orientation ?? "landscape"];
  const ContentElement = embedded ? "div" : "main";

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
      setViewportFit(resolveEditorialArenaViewportFit(
        { height, width },
        view.orientation
      ));
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
    if (!view || viewportFit === null || passive || readyRef.current) return;
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
  }, [item.id, onReady, passive, view, viewportFit]);

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

  if (!view || view.pages.length === 0) return null;
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
    ...themeCssVariables(view.themePresentation, view.themeTokens),
    "--arena-accent": view.accentColor,
    "--arena-page-duration": `${pageDurationMs}ms`,
    "--arena-row-height": `${pageRowHeight(page, view)}px`,
    "--arena-viewport-inset-x": `${viewportFit?.insetX ?? 0}px`,
    "--arena-viewport-inset-y": `${viewportFit?.insetY ?? 0}px`,
    "--vc-motion-duration": `${transition.durationMs}ms`,
    "--vc-motion-easing": transition.easing,
    "--vc-motion-translate": `${transition.translatePercent}%`,
    height: canvas.height,
    opacity: viewportFit === null ? 0 : 1,
    transform: `translate(-50%, -50%) scale(${viewportFit?.scale ?? 1})`,
    width: canvas.width
  };

  return (
    <div className={styles.arenaViewport} ref={viewportRef}>
      <section
        aria-label={item.accessibilityName ?? item.title}
        className={styles.arenaRoot}
        data-birthday-radius={view.birthday?.configuration.presentation.radius}
        data-canvas-height={canvas.height}
        data-canvas-width={canvas.width}
        data-orientation={view.orientation}
        data-logo-position={view.birthday?.configuration.presentation.logoPosition}
        data-passive={passive || undefined}
        data-slide-type={view.slideType}
        data-theme={view.theme}
        data-theme-id={view.themeId}
        data-transition={transition.key}
        data-viewport-fit={viewportFit?.mode}
        style={style}
      >
        {view.birthday ? <BirthdayBackdrop view={view} /> : null}
        {page.kind === "menu-v2" ? (
          <MenuSceneCanvas
            assets={page.assets}
            document={page.document}
            orientation={view.orientation}
            page={page.page}
            style={{ height: canvas.height, left: 0, top: 0, transform: "none", width: canvas.width }}
            themeOverrideStyle={view.themeRuntimeVersion >= 2
              ? themeCssVariables(view.themePresentation, view.themeTokens)
              : undefined}
          />
        ) : (
          <>
            <ArenaHeader
              pageCount={pageCount}
              pageIndex={pageIndex}
              view={view}
            />
            <ContentElement
              className={styles.arenaContent}
              data-page-count={pageCount}
              data-page-index={pageIndex}
            >
              <ArenaPage
                key={`${view.snapshotId}-${pageIndex}`}
                page={page}
                pageIndex={pageIndex}
                view={view}
              />
              {view.emptyState && pageIsEmpty(page) ? (
                <div className={styles.arenaEmpty}>{view.emptyState}</div>
              ) : null}
            </ContentElement>
            <ArenaFooter
              pageCount={pageCount}
              pageIndex={pageIndex}
              view={view}
            />
          </>
        )}
      </section>
    </div>
  );
}

function ArenaHeader({
  pageCount,
  pageIndex,
  view
}: {
  pageCount: number;
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  const initials = initialsFor(view.clubName);
  const matchCentre = isMatchCentreSlide(view);
  const clock = useArenaClock(view);
  const contextLabel = arenaContextLabel(view, pageIndex);
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
      <div className={styles.arenaContext} data-match-centre={matchCentre || undefined}>
        {matchCentre ? (
          <>
            <span className={styles.arenaMatchCentreLabel}>
              <strong>MATCHCENTRE</strong>
              <b>{formatMatchCentrePageCounter(pageIndex, pageCount)}</b>
            </span>
            <time dateTime={clock.instant}>{clock.label}</time>
          </>
        ) : (
          <>
            <strong>{contextLabel}</strong>
            <time dateTime={clock.instant}>{clock.label}</time>
          </>
        )}
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
  const matchCentre = isMatchCentreSlide(view);
  return (
    <footer className={styles.arenaFooter} data-match-centre={matchCentre || undefined}>
      <span className={styles.arenaFooterLine}><i aria-hidden="true" /></span>
      {!matchCentre ? <span>{view.sourceLabel}</span> : null}
      {!matchCentre ? (
        <span className={styles.arenaPageDots} aria-label={`Pagina ${pageIndex + 1} van ${pageCount}`}>
          <b>{pageIndex + 1} / {pageCount}</b>
          {Array.from({ length: Math.max(1, pageCount) }, (_, index) => (
            <i data-active={index === pageIndex || undefined} key={index} />
          ))}
        </span>
      ) : null}
    </footer>
  );
}

function useArenaClock(view: DynamicTemplateView) {
  const timezone = view.themePresentation.resolvedMode.timezone;
  const frozenInstant = view.themePresentation.resolvedMode.resolvedAt;
  const [instant, setInstant] = useState(frozenInstant);
  useEffect(() => {
    const update = () => setInstant(new Date().toISOString());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [frozenInstant, timezone]);
  return {
    instant,
    label: formatMatchCentreClock(instant, timezone)
  };
}


function isMatchCentreSlide(view: DynamicTemplateView) {
  return view.slideType === "sport_program" || view.slideType === "sport_results";
}

function arenaContextLabel(view: DynamicTemplateView, pageIndex: number) {
  if (view.slideType !== "sport_visitor_arrivals") return view.sourceLabel;
  const page = view.pages[pageIndex];
  if (page?.kind !== "arrivals") return formatVisitorVenueWelcome("");
  const venueNames = page.items.map((item) => item.venueName).filter(Boolean);
  const venues = [...new Set(venueNames)];
  return formatVisitorVenueWelcome(
    venueNames.length === page.items.length && venues.length === 1
      ? venues[0]!
      : ""
  );
}

function ArenaNewsQr({ article }: { article: DynamicTemplateNewsItem }) {
  if (!article.qrUrl) return null;
  return (
    <div className={styles.arenaNewsQr} data-testid="news-qr">
      <img alt={`QR-code naar ${article.title}`} src={article.qrUrl} />
      <span>Scan voor het artikel</span>
    </div>
  );
}

function ArenaPage({
  page,
  pageIndex,
  view
}: {
  page: DynamicTemplatePage;
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  if (page.kind === "menu-v2") return null;
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
              {view.newsVariant !== "fullscreen_gradient"
                ? <ArenaNewsQr article={article} />
                : null}
            </>
          ) : null}
        </article>
        {article && view.newsVariant === "fullscreen_gradient"
          ? <ArenaNewsQr article={article} />
          : null}
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

  if (page.kind === "birthday") {
    return <BirthdayPage items={page.items} layout={page.layout} view={view} />;
  }

  if (page.kind === "arrivals") {
    const visitorArrivals = view.slideType === "sport_visitor_arrivals";
    const pageSize = Math.max(1, ...view.pages.map((candidate) =>
      candidate.kind === "arrivals" ? candidate.items.length : 0));
    return (
      <div
        className={styles.arenaArrivalGrid}
        data-arrival-kind={visitorArrivals ? "visitor" : "referee"}
        data-cards={page.items.length}
      >
        {page.items.map((entry, index) => (
          <article
            className={styles.arenaArrivalCard}
            data-arrival-kind={visitorArrivals ? "visitor" : "referee"}
            data-logo={entry.logoUrl ? "visible" : "missing"}
            data-sponsor={view.arrivalSponsorUrl ? "visible" : undefined}
            data-motion={visitorArrivals
              ? resolveWelcomeMotionPreset(
                view.arrivalMotionPreset,
                pageIndex,
                index,
                pageSize
              )
              : undefined}
            key={entry.id}
            style={{ "--arrival-delay": `${index * 110}ms` } as CSSProperties}
          >
            {entry.logoUrl ? (
              <>
                <img
                  alt=""
                  aria-hidden="true"
                  className={styles.arenaArrivalLogoBackdrop}
                  src={entry.logoUrl}
                />
                <div className={styles.arenaArrivalLogoMark}>
                  <img alt={`Logo ${entry.awayTeam || entry.primary}`} src={entry.logoUrl} />
                </div>
              </>
            ) : null}
            {visitorArrivals ? (
              <div className={styles.arenaVisitorArrivalCopy}>
                <div className={styles.arenaVisitorSchedule}>
                  <time dateTime={entry.kickoffAt}>{entry.date || "Datum volgt"}</time>
                  <span>Aanvang: {entry.kickoffTime || "volgt"}</span>
                </div>
                <div className={styles.arenaVisitorTeams}>
                  <h2 aria-label={`${entry.homeTeam || view.clubName} tegen ${entry.awayTeam || entry.primary}`}>
                    <span>{entry.homeTeam || view.clubName}</span>
                    <span>{entry.awayTeam || entry.primary}</span>
                  </h2>
                </div>
                <dl className={styles.arenaVisitorDetails}>
                  <div>
                    <dt>Kleedkamers:</dt>
                    <dd className={styles.arenaVisitorRoomLine}>
                      <span>Thuis: {entry.homeRoom || "volgt"}</span>
                      <i aria-hidden="true">|</i>
                      <span>Uit: {entry.awayRoom || entry.dressingRoom || "volgt"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Veld:</dt>
                    <dd>{entry.field || "volgt"}</dd>
                  </div>
                  <div>
                    <dt>Scheidsrechter:</dt>
                    <dd>{entry.officials.join(", ") || "volgt"}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <>
                <span>{entry.status
                  .replaceAll("{{club}}", view.clubName)
                  .replaceAll("{{team}}", entry.primary) || "Wedstrijdofficial"}</span>
                {!entry.logoUrl ? <b>{String(index + 1).padStart(2, "0")}</b> : null}
                <h2>{entry.primary}</h2>
                <p>{entry.secondary}</p>
                <strong>{entry.meta}</strong>
              </>
            )}
            {view.arrivalSponsorUrl ? (
              <img
                alt="Sponsor"
                className={styles.arenaArrivalSponsor}
                src={view.arrivalSponsorUrl}
              />
            ) : null}
          </article>
        ))}
      </div>
    );
  }

  if (page.kind === "match") {
    return <ArenaNextMatch item={page.item} view={view} />;
  }

  if (page.kind === "team") {
    return (
      <div className={styles.arenaTeamRoster} data-render-family="team-roster">
        {page.items.map((entry) => (
          <article className={`${styles.arenaPanel} ${styles.arenaTeamCard}`} key={entry.id}>
            <div className={styles.arenaTeamPortrait}>
              {entry.photoUrl || entry.logoUrl ? (
                <img
                  alt=""
                  src={entry.photoUrl || entry.logoUrl}
                />
              ) : <span aria-hidden="true">{initialsFor(entry.primary)}</span>}
            </div>
            <div>
              <span>{entry.status || "Team"}</span>
              <h2>{entry.primary}</h2>
              {entry.secondary ? <p>{entry.secondary}</p> : null}
              {entry.meta ? <strong>{entry.meta}</strong> : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (page.kind === "sponsor") {
    return (
      <div
        className={styles.arenaSponsorLayout}
        data-items={page.items.length}
        data-render-family="sponsor-spotlight"
      >
        {page.items.map((entry) => (
          <article className={`${styles.arenaPanel} ${styles.arenaSponsorCard}`} key={entry.id}>
            <div className={styles.arenaSponsorPlate}>
              {entry.photoUrl || entry.logoUrl ? (
                <img alt={`Logo ${entry.primary}`} src={entry.photoUrl || entry.logoUrl} />
              ) : <span aria-hidden="true">{initialsFor(entry.primary)}</span>}
            </div>
            <div className={styles.arenaSponsorCopy}>
              <span>Partner van de club</span>
              <h2>{entry.primary}</h2>
              {entry.meta ? <p>{entry.meta}</p> : null}
              {entry.secondary ? <strong>{entry.secondary}</strong> : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (page.kind === "trainings") {
    return (
      <div className={styles.arenaTrainingSchedule} data-render-family="training-schedule">
        {page.items.map((entry, index) => (
          <article className={`${styles.arenaPanel} ${styles.arenaTrainingRow}`} key={entry.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <div>
              <span>{entry.status || "Training"}</span>
              <h2>{entry.primary}</h2>
              {entry.secondary ? <p>{entry.secondary}</p> : null}
            </div>
            <strong>{entry.time || entry.meta || entry.venue}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (page.kind === "volunteers") {
    return (
      <div className={styles.arenaVolunteerLayout} data-render-family="volunteer-call">
        <aside className={`${styles.arenaPanel} ${styles.arenaVolunteerCallout}`}>
          <span>Samen maken we de club</span>
          <strong>{page.items.length}</strong>
          <p>vrijwilligersrollen in deze selectie</p>
        </aside>
        <section className={styles.arenaVolunteerCards}>
          {page.items.map((entry) => (
            <article className={`${styles.arenaPanel} ${styles.arenaVolunteerCard}`} key={entry.id}>
              <span>{entry.status || "Vrijwilliger"}</span>
              <h2>{entry.primary}</h2>
              {entry.secondary ? <p>{entry.secondary}</p> : null}
              {entry.meta ? <strong>{entry.meta}</strong> : null}
            </article>
          ))}
        </section>
      </div>
    );
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
        {(view.sportDisplay?.columns === "one"
          ? [page.items]
          : [page.items.slice(0, midpoint), page.items.slice(midpoint)]).map(
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
        renderRow={(entry, index) => <ResultRow display={view.sportDisplay} item={entry} key={entry.id} rowIndex={index} />}
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

  if (view.slideType === "sport_program") {
    return (
      <SportListColumns
        items={page.items}
        renderRow={(entry, index) => <ProgramRow display={view.sportDisplay} item={entry} key={entry.id} rowIndex={index} />}
        view={view}
      />
    );
  }

  return <div className={styles.arenaUnsupported}>Dit schermtype kan niet veilig worden weergegeven.</div>;
}

function BirthdayBackdrop({ view }: { view: DynamicTemplateView }) {
  const configuration = view.birthday?.configuration;
  return (
    <div
      aria-hidden="true"
      className={styles.birthdayBackdrop}
      data-gradient={configuration?.presentation.gradientOverlay || undefined}
      style={{
        backgroundColor: configuration?.presentation.backgroundColor,
        backgroundImage: view.birthday?.backgroundUrl
          ? `url(${view.birthday.backgroundUrl})`
          : undefined
      }}
    >
      {configuration?.presentation.confetti ? (
        <span className={styles.birthdayParticles}>
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </span>
      ) : null}
      {configuration?.presentation.logoPosition === "bottom_left" ? (
        <span className={styles.birthdayPlacedLogo}>
          {view.clubLogoUrl
            ? <img alt="" src={view.clubLogoUrl} />
            : initialsFor(view.clubName)}
        </span>
      ) : null}
    </div>
  );
}

function BirthdayPage({
  items,
  layout,
  view
}: {
  items: DynamicTemplateBirthdayItem[];
  layout: "birthday_roll" | "celebration_grid" | "spotlight";
  view: DynamicTemplateView;
}) {
  const configuration = view.birthday?.configuration;
  if (!items.length) return null;
  return (
    <div
      className={styles.birthdayLayout}
      data-align={configuration?.presentation.textAlign ?? "left"}
      data-card-style={configuration?.presentation.cardStyle ?? "glass"}
      data-layout={layout}
      data-motion={configuration?.presentation.motion || undefined}
    >
      {items.map((birthday, index) => (
        <article
          className={styles.birthdayCard}
          data-today={birthday.isToday || undefined}
          key={birthday.id}
          style={{ "--birthday-delay": `${index * 90}ms` } as CSSProperties}
        >
          <BirthdayPortrait birthday={birthday} />
          <div className={styles.birthdayCopy}>
            <span className={styles.birthdayEyebrow}>
              {birthday.isToday ? "Vandaag jarig" : birthday.dateLabel || "Binnenkort jarig"}
            </span>
            <h2>{birthday.displayName}</h2>
            {birthday.dateLabel && !birthday.isToday ? <time>{birthday.dateLabel}</time> : null}
            <p>
              {birthday.age !== null
                ? `${firstName(birthday.displayName)} wordt ${birthday.isToday ? "vandaag " : ""}${birthday.age} jaar`
                : `${firstName(birthday.displayName)} is ${birthday.isToday ? "vandaag " : "binnenkort "}jarig`}
            </p>
            {birthday.meta ? <strong>{birthday.meta}</strong> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function BirthdayPortrait({ birthday }: { birthday: DynamicTemplateBirthdayItem }) {
  return (
    <div aria-hidden="true" className={styles.birthdayPortrait}>
      {birthday.photoUrl ? (
        <img alt="" src={birthday.photoUrl} />
      ) : (
        <span>{initialsFor(birthday.displayName)}</span>
      )}
    </div>
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/u)[0] || value;
}

function SportListColumns({
  items,
  renderRow,
  view
}: {
  items: DynamicTemplateListItem[];
  renderRow: (item: DynamicTemplateListItem, index: number) => ReactNode;
  view: DynamicTemplateView;
}) {
  const columns = splitIntoColumns(
    items,
    view.orientation,
    view.sportDisplay?.columns
  );
  return (
    <div className={styles.arenaSportColumns} data-columns={columns.length}>
      {columns.map((column, columnIndex) => {
        const rowOffset = columns.slice(0, columnIndex)
          .reduce((count, preceding) => count + preceding.length, 0);
        return (
          <section
            aria-label={`${view.title} kolom ${columnIndex + 1}`}
            className={styles.arenaFixtureList}
            key={columnIndex}
          >
            {column.map((item, index) => renderRow(item, rowOffset + index))}
          </section>
        );
      })}
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
        <strong
          data-title-density={resolveProductTitleDensity(item.name)}
          title={item.name}
        >
          {item.name}
        </strong>
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
  const columns = splitIntoColumns(
    items,
    view.orientation,
    view.sportDisplay?.columns
  );
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
          <TeamBadge logoUrl={item?.homeLogoUrl} name={home} />
          <div>
            <span>{item?.date || item?.secondary}</span>
            <strong>{item?.time || "Tijd volgt"}</strong>
            <i>VS</i>
            <small>{item?.venue || item?.meta || "Locatie volgt"}</small>
          </div>
          <TeamBadge logoUrl={item?.awayLogoUrl} name={away} />
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

function ProgramRow({
  display,
  item,
  rowIndex
}: {
  display: DynamicTemplateView["sportDisplay"];
  item: DynamicTemplateListItem;
  rowIndex: number;
}) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  return (
    <article
      className={styles.arenaProgramRow}
      style={{ "--arena-row-delay": `${360 + rowIndex * 110}ms` } as CSSProperties}
    >
      <div
        className={styles.arenaMatchPrimary}
        style={{
          gridTemplateColumns: programPrimaryColumns(display)
        }}
      >
        {display?.showDate !== false ? (
          <strong className={styles.arenaMatchDate} data-field="date">
            {item.date || item.secondary || "Datum volgt"}
          </strong>
        ) : null}
        {display?.showTime !== false ? (
          <b className={styles.arenaKickoff} data-field="time">
            {item.time || item.kickoffTime || "Tijd volgt"}
          </b>
        ) : null}
        {display?.showHomeLogo !== false ? (
          <span className={styles.arenaMatchLogo} data-field="home-logo">
            <TeamMini homePlate logoUrl={item.homeLogoUrl} name={home} />
          </span>
        ) : null}
        <strong className={styles.arenaMatchTeam} data-field="home-team" title={home}>
          {home}
        </strong>
        {display?.showHomeDressingRoom ? (
          <span className={styles.arenaMatchRoom} data-field="home-room">
            Kleedkamer {matchDetailValue(item.homeRoom)}
          </span>
        ) : null}
        <i className={styles.arenaVersusMark} data-field="versus">vs.</i>
        {display?.showAwayLogo !== false ? (
          <span className={styles.arenaMatchLogo} data-field="away-logo">
            <TeamMini logoUrl={item.awayLogoUrl} name={away} />
          </span>
        ) : null}
        <strong className={styles.arenaMatchTeam} data-field="away-team" title={away}>
          {away}
        </strong>
        {display?.showAwayDressingRoom ? (
          <span className={styles.arenaMatchRoom} data-field="away-room">
            Kleedkamer {matchDetailValue(item.awayRoom)}
          </span>
        ) : null}
      </div>
      <MatchSecondaryLine display={display} item={item} />
    </article>
  );
}

function ResultRow({
  display,
  item,
  rowIndex
}: {
  display: DynamicTemplateView["sportDisplay"];
  item: DynamicTemplateListItem;
  rowIndex: number;
}) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  const scoreKnown = Number.isInteger(item.homeScore) &&
    Number.isInteger(item.awayScore);
  return (
    <article
      className={styles.arenaResultRow}
      data-result-row=""
      style={{ "--arena-row-delay": `${360 + rowIndex * 110}ms` } as CSSProperties}
    >
      <div
        className={styles.arenaMatchPrimary}
        style={{
          gridTemplateColumns: resultPrimaryColumns(display)
        }}
      >
        {display?.showDate !== false ? (
          <strong className={styles.arenaMatchDate} data-field="date">
            {item.date || item.secondary || "Datum volgt"}
          </strong>
        ) : null}
        {display?.showTime !== false ? (
          <b className={styles.arenaKickoff} data-field="time">
            {item.time || item.kickoffTime || "Tijd volgt"}
          </b>
        ) : null}
        {display?.showHomeLogo !== false ? (
          <span className={styles.arenaMatchLogo} data-field="home-logo">
            <TeamMini homePlate logoUrl={item.homeLogoUrl} name={home} />
          </span>
        ) : null}
        <strong className={styles.arenaMatchTeam} data-field="home-team" title={home}>
          {home}
        </strong>
        <i
          aria-label={scoreKnown
            ? `Uitslag ${item.homeScore} tegen ${item.awayScore}`
            : "Uitslag nog niet bekend"}
          className={styles.arenaResultScore}
          data-field="score"
        >
          {scoreKnown ? <>
            <b>{item.homeScore}</b><span>–</span><b>{item.awayScore}</b>
          </> : null}
        </i>
        {display?.showAwayLogo !== false ? (
          <span className={styles.arenaMatchLogo} data-field="away-logo">
            <TeamMini logoUrl={item.awayLogoUrl} name={away} />
          </span>
        ) : null}
        <strong className={styles.arenaMatchTeam} data-field="away-team" title={away}>
          {away}
        </strong>
      </div>
    </article>
  );
}

function MatchSecondaryLine({
  display,
  item,
}: {
  display: DynamicTemplateView["sportDisplay"];
  item: DynamicTemplateListItem;
}) {
  const referee = display?.showReferee
    ? item.officials.filter(Boolean).join(" · ") || "volgt"
    : "";
  const field = display?.showField
    ? matchDetailValue(item.field || item.venue || item.meta)
    : "";
  const sportpark = display?.showSportpark
    ? matchDetailValue(item.venueName)
    : "";
  if (!referee && !field && !sportpark) return null;
  return (
    <div className={styles.arenaMatchSecondary}>
      {referee ? <span data-field="referee"><b>Scheidsrechter:</b> {referee}</span> : null}
      {field ? <span data-field="field"><b>Veld:</b> {field}</span> : null}
      {sportpark ? <span data-field="sportpark"><b>Sportpark:</b> {sportpark}</span> : null}
    </div>
  );
}

function programPrimaryColumns(display: DynamicTemplateView["sportDisplay"]) {
  const tracks: string[] = [];
  if (display?.showDate !== false) tracks.push("minmax(140px, .72fr)");
  if (display?.showTime !== false) tracks.push("minmax(60px, .48fr)");
  if (display?.showHomeLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, 1.55fr)");
  if (display?.showHomeDressingRoom) tracks.push("minmax(0, .88fr)");
  tracks.push("36px");
  if (display?.showAwayLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, 1.55fr)");
  if (display?.showAwayDressingRoom) tracks.push("minmax(0, .88fr)");
  return tracks.join(" ");
}

function resultPrimaryColumns(display: DynamicTemplateView["sportDisplay"]) {
  const tracks: string[] = [];
  if (display?.showDate !== false) tracks.push("minmax(190px, .82fr)");
  if (display?.showTime !== false) tracks.push("minmax(70px, .48fr)");
  if (display?.showHomeLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, 1.55fr)", "minmax(112px, .68fr)");
  if (display?.showAwayLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, 1.55fr)");
  return tracks.join(" ");
}

function matchDetailValue(value: string) {
  return value
    .replace(/^(?:kleedkamer|veld|field|sportpark)\s*:?\s*/iu, "")
    .trim() || "volgt";
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

function TeamBadge({ logoUrl = "", name }: { logoUrl?: string; name: string }) {
  return (
    <article className={styles.arenaTeamBadge}>
      <TeamMini logoUrl={logoUrl} name={name} large />
      <h2>{name}</h2>
    </article>
  );
}

function TeamMini({
  homePlate = false,
  large = false,
  logoUrl = "",
  name
}: {
  homePlate?: boolean;
  large?: boolean;
  logoUrl?: string;
  name: string;
}) {
  return (
    <i
      aria-hidden="true"
      className={large ? styles.arenaTeamLarge : styles.arenaTeamMini}
      data-home-plate={homePlate || undefined}
    >
      {logoUrl ? <img alt="" src={logoUrl} /> : initialsFor(name)}
    </i>
  );
}

function pageIsEmpty(page: DynamicTemplatePage) {
  if (page.kind === "menu-v2") {
    return page.page.columns.left.length + page.page.columns.right.length === 0 &&
      page.page.floatingBlocks.length === 0;
  }
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
  orientation: DynamicTemplateView["orientation"],
  configuredColumns?: "one" | "two"
) {
  const columns = configuredColumns === "one"
    ? 1
    : configuredColumns === "two" && orientation === "landscape"
      ? Math.min(2, items.length || 1)
      : sportColumnCount(orientation, items.length);
  if (columns === 1) return [items];
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
}

function pageRowHeight(
  page: DynamicTemplatePage,
  view: DynamicTemplateView
) {
  if (page.kind === "sport-list" && (
    view.slideType === "sport_program" || view.slideType === "sport_results"
  )) {
    return sportMatchRowHeight[
      view.slideType === "sport_results" ? "results" : "program"
    ][view.orientation];
  }
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
