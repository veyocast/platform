"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from "react";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import {
  createDynamicTemplateView,
  dynamicTemplatePageDurationMs,
  formatMatchCentreClock,
  formatMatchCentrePageCounter,
  formatVisitorArrivalDate,
  formatVisitorVenueWelcome,
  royalStandingPlaybackPages,
  royalStandingScrollMetrics,
  royalStandingScrollOffset,
  resolveWelcomeMotionPreset,
  type DynamicTemplateBirthdayItem,
  type DynamicTemplateArrivalConfig,
  type DynamicTemplateListItem,
  type DynamicTemplateMenuItem,
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
import { startBirthdayConfetti } from "./birthday-confetti";
import { resolveSportListLayout } from "./sport-list-layout";
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

const defaultArrivalConfig = {
  dutyDeskText: "",
  showArrivalTime: true,
  showClubLogo: true,
  showCompetition: false,
  showDressingRoom: true,
  showField: true,
  showKickoffTime: true,
  showSponsor: false,
  showWelcome: true,
  welcomeText: "Welkom bij {{club}}"
} satisfies DynamicTemplateArrivalConfig;

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
  now,
  onReady = () => undefined,
  onBoundary,
  pageIndex: controlledPageIndex,
  passive = false,
  runtimeEffects = false,
  paused = false
}: {
  embedded?: boolean;
  item: EditorialArenaItem;
  now?: Date;
  onReady?: (itemId: string) => void;
  onBoundary?: (itemId: string) => void;
  pageIndex?: number;
  passive?: boolean;
  runtimeEffects?: boolean;
  paused?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();
  const view = useMemo(
    () => createDynamicTemplateView(item.dynamicTemplate, now, contentHeight),
    [item.dynamicTemplate, now, contentHeight]
  );
  const readyRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [viewportFit, setViewportFit] = useState<EditorialArenaViewportFit | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const effectiveMotionEnabled = Boolean(
    view?.motionEnabled && !prefersReducedMotion && !passive && !paused
  );
  const birthdayCelebration = Boolean(runtimeEffects && effectiveMotionEnabled &&
    view?.birthday?.configuration.presentation.motion &&
    view.birthday.configuration.presentation.confetti &&
    view.pages.some((page) => page.kind === "birthday" && page.items.some((person) => person.isToday)));
  const confettiColors = view ? [view.accentColor, view.themeTokens.text, view.themeTokens.accentSoft] : [];
  const confettiPalette = confettiColors.join("|");
  const birthdayPage = view?.pages[Math.min(Math.max(0, controlledPageIndex ?? internalPageIndex), Math.max(0, (view?.pages.length ?? 1) - 1))];
  const celebratingIds = birthdayPage?.kind === "birthday" ? birthdayPage.items.filter((person) => person.isToday).map((person) => person.id).join("|") : "";
  const viewportReady = viewportFit !== null;
  useEffect(() => {
    const host = viewportRef.current;
    if (!host || !birthdayCelebration || !viewportReady) return;
    const cards = Array.from(host.querySelectorAll<HTMLElement>('[data-birthday-card][data-today="true"]')).slice(0, 6);
    const cleanups = cards.map((card) => startBirthdayConfetti(card, {
      colors: confettiPalette.split("|"), particleLimit: Math.floor(40 / cards.length)
    }));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [birthdayCelebration, celebratingIds, confettiPalette, item.id, viewportReady]);
  const standingAutoScroll = Boolean(
    view &&
    view.designRevision === "royal-current-v8" &&
    (view.slideType === "sport_standing" ||
      view.slideType === "sport_period_standing") &&
    effectiveMotionEnabled
  );
  const playbackPages = useMemo<DynamicTemplatePage[]>(() => {
    if (!view) return [];
    return royalStandingPlaybackPages(view.pages, standingAutoScroll);
  }, [standingAutoScroll, view]);
  const pageCount = playbackPages.length;
  const canvas = editorialArenaCanvas[view?.orientation ?? "landscape"];
  const ContentElement = embedded ? "div" : "main";
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const list = content.querySelector<HTMLElement>("[data-standing-window]") ||
      content.querySelector<HTMLElement>("[data-columns]");
    const measure = () => {
      const height = list?.clientHeight || content.clientHeight;
      if (height > 0) setContentHeight((current) => current === height ? current : height);
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(content);
    if (list) observer?.observe(list);
    return () => observer?.disconnect();
  }, [item.id, view?.orientation]);

  useEffect(() => {
    setInternalPageIndex(0);
  }, [item.id, standingAutoScroll, view?.snapshotId]);

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
      passive || paused ||
      controlledPageIndex !== undefined
    ) return;
    const interval = window.setInterval(
      () => {
        onBoundary?.(item.id);
        setInternalPageIndex((current) => (current + 1) % pageCount);
      },
      dynamicTemplatePageDurationMs(
        item.durationSeconds,
        pageCount,
        view.pageDurationMs
      )
    );
    return () => window.clearInterval(interval);
  }, [controlledPageIndex, item.id, item.durationSeconds, onBoundary, pageCount, passive, paused, view?.pageDurationMs]);

  if (!view || playbackPages.length === 0) return null;
  const pageIndex = Math.min(
    Math.max(0, controlledPageIndex ?? internalPageIndex),
    Math.max(pageCount - 1, 0)
  );
  const page = playbackPages[pageIndex] ?? playbackPages[0]!;
  const pageDurationMs = dynamicTemplatePageDurationMs(
    item.durationSeconds,
    pageCount,
    view.pageDurationMs
  );
  const transition = resolveThemeTransition(
    view.themePresentation,
    page.kind,
    view.designRevision === "royal-current-v8"
      ? !effectiveMotionEnabled
      : false
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
        data-design-revision={view.designRevision}
        data-orientation={view.orientation}
        data-logo-position={view.birthday?.configuration.presentation.logoPosition}
        data-motion-state={effectiveMotionEnabled ? "on" : "off"}
        data-passive={passive || undefined}
        data-slide-type={view.slideType}
        data-theme={view.theme}
        data-theme-id={view.themeId}
        data-transition={transition.key}
        data-viewport-fit={viewportFit?.mode}
        style={style}
      >
        {page.kind === "menu-v2" ? (
          <MenuSceneCanvas
            assets={page.assets}
            document={page.document}
            orientation={view.orientation}
            page={page.page}
            style={{ height: canvas.height, left: 0, top: 0, transform: "none", width: canvas.width }}
            themeMode={view.theme}
            themeOverrideStyle={view.themeRuntimeVersion >= 2
              ? themeCssVariables(view.themePresentation, view.themeTokens)
              : undefined}
          />
        ) : (
          <>
            {view.designRevision === "royal-current-v8" ? (
              <RoyalCurrentHeader
                pageIndex={pageIndex}
                view={view}
              />
            ) : (
              <ArenaHeader
                pageCount={pageCount}
                pageIndex={pageIndex}
                view={view}
              />
            )}
            <ContentElement
              ref={contentRef}
              className={styles.arenaContent}
              data-page-count={pageCount}
              data-page-index={pageIndex}
            >
              <ArenaPage
                key={`${view.snapshotId}-${pageIndex}`}
                page={page}
                pageIndex={pageIndex}
                standingAutoScroll={standingAutoScroll}
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

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function RoyalCurrentHeader({
  pageIndex,
  view
}: {
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  const initials = initialsFor(view.clubName);
  const clock = useArenaClock(view);
  const contextLabel = royalCurrentContextLabel(view, pageIndex);
  const title = view.title;
  const titleDensity = royalCurrentTitleDensity(title);
  return (
    <>
      <div aria-hidden="true" className={styles.royalFlowDecoration} data-legacy-label="Onze club. Ons verhaal.">
        <i /><i /><i />
      </div>
      <header className={styles.royalTitle}>
        <div aria-hidden="true" className={styles.royalTitleCrest}>
          {view.clubLogoUrl ? <img alt="" src={view.clubLogoUrl} /> : initials}
        </div>
        <div className={styles.royalTitleCopy} data-title-density={titleDensity}>
          <span>{contextLabel}</span>
          <h1>{title}</h1>
        </div>
        <div className={styles.royalTitleStat}>
          <strong>{view.clubName}</strong>
          <time dateTime={clock.instant}>{clock.label}</time>
        </div>
      </header>
    </>
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
  const matchCentre = view.designRevision !== "royal-current-v8" &&
    isMatchCentreSlide(view);
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

function royalCurrentContextLabel(
  view: DynamicTemplateView,
  pageIndex: number
) {
  if (view.slideType === "sport_visitor_arrivals") {
    return arenaContextLabel(view, pageIndex);
  }
  const labels: Partial<Record<DynamicTemplateView["slideType"], string>> = {
    menu: "Onze kantine",
    news: "Clubnieuws",
    price_list: "In de kantine",
    sport_activities: "Bij de vereniging",
    sport_birthdays: "Van harte gefeliciteerd",
    sport_cancellations: "Programmawijziging",
    sport_dressing_rooms: "Wedstrijdinformatie",
    sport_match_of_the_day: "Wedstrijd van de dag",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Wedstrijdinformatie",
    sport_program: "Wedstrijddag",
    sport_referee_arrivals: "Scheidsrechters",
    sport_results: "Teamoverzicht",
    sport_standing: "Competitie"
  };
  return labels[view.slideType] ?? view.sourceLabel;
}

function royalCurrentTitleDensity(title: string) {
  const normalizedLength = title.trim().length;
  if (normalizedLength > 64) return "dense";
  if (normalizedLength > 42) return "compact";
  return "default";
}

function ArenaNewsQr({
  article,
  label = true
}: {
  article: DynamicTemplateNewsItem;
  label?: boolean;
}) {
  if (!article.qrUrl) return null;
  return (
    <div className={styles.arenaNewsQr} data-testid="news-qr">
      <img alt={`QR-code naar ${article.title}`} src={article.qrUrl} />
      {label ? <span>Scan voor het artikel</span> : null}
    </div>
  );
}

function ArenaPage({
  page,
  pageIndex,
  standingAutoScroll,
  view
}: {
  page: DynamicTemplatePage;
  pageIndex: number;
  standingAutoScroll: boolean;
  view: DynamicTemplateView;
}) {
  if (page.kind === "menu-v2") return null;
  if (page.kind === "menu") {
    if (view.designRevision === "royal-current-v8") {
      return <RoyalMenuPage columns={page.columns} />;
    }
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
    return <ArenaPriceList page={page.page} view={view} />;
  }

  if (page.kind === "news") {
    const article = page.item;
    return (
      <div
        className={styles.arenaNewsLayout}
        data-news-variant={view.newsVariant}
        data-render-family="news"
      >
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
          {article && view.designRevision === "royal-current-v8" ? (
            <>
              <h2 className={newsTitleClassName(article.title)}>{article.title}</h2>
              {article.intro ? <p>{article.intro}</p> : null}
              {view.newsVariant !== "fullscreen_gradient"
                ? <ArenaNewsQr article={article} label={false} />
                : null}
            </>
          ) : article ? (
            <>
              <span>Laatste nieuws</span>
              <h2 className={newsTitleClassName(article.title)}>{article.title}</h2>
              {article.intro ? <p>{article.intro}</p> : null}
              <div className={styles.arenaNewsMeta} data-testid="news-meta">
                {article.date ? <small><b>Datum</b>{article.date}</small> : null}
                <small><b>Door</b>{article.author || article.source}</small>
              </div>
              {view.newsVariant !== "fullscreen_gradient"
                ? <ArenaNewsQr
                    article={article}
                    label={view.designRevision !== "royal-current-v8"}
                  />
                : null}
            </>
          ) : null}
        </article>
        {article && view.newsVariant === "fullscreen_gradient"
          ? <ArenaNewsQr
              article={article}
              label={view.designRevision !== "royal-current-v8"}
            />
          : null}
        {page.secondaryItems.length ? (
          <aside className={styles.arenaNewsGrid}>
            {page.secondaryItems.map((secondary) => (
              <article
                className={styles.arenaPanel}
                data-image={secondary.heroUrl ? "visible" : "missing"}
                key={secondary.id}
              >
                {view.designRevision === "royal-current-v8" &&
                view.newsVariant === "news_grid" ? (
                  <>
                    {secondary.heroUrl ? (
                      <img
                        alt=""
                        src={secondary.heroUrl}
                        style={{
                          objectPosition: `${secondary.imageFocalPoint.x * 100}% ${secondary.imageFocalPoint.y * 100}%`
                        }}
                      />
                    ) : null}
                    <div>
                      <span>{secondary.source}</span>
                      <h2>{secondary.title}</h2>
                      {secondary.intro ? <p>{secondary.intro}</p> : null}
                    </div>
                  </>
                ) : (
                  <>
                    <span>{secondary.source}</span>
                    <h3>{secondary.title}</h3>
                    <small>{secondary.date}</small>
                  </>
                )}
              </article>
            ))}
          </aside>
        ) : null}
      </div>
    );
  }

  if (page.kind === "standing") {
    return (
      <ArenaStanding
        autoScroll={standingAutoScroll}
        items={page.items}
        view={view}
      />
    );
  }

  if (page.kind === "birthday") {
    return <BirthdayPage
      items={page.items}
      layout={page.layout}
      pageSize={page.pageSize}
      view={view}
    />;
  }

  if (page.kind === "arrivals") {
    const visitorArrivals = view.slideType === "sport_visitor_arrivals";
    const arrivalConfig = view.arrivalConfig ?? defaultArrivalConfig;
    const fixedSlots = visitorArrivals && view.designRevision === "royal-current-v8"
      ? view.arrivalSlots ?? 3
      : page.items.length;
    const pageSize = Math.max(fixedSlots, ...view.pages.map((candidate) =>
      candidate.kind === "arrivals" ? candidate.items.length : 0));
    const emptySlots = Math.max(0, fixedSlots - page.items.length);
    return (
      <div
        className={styles.arenaArrivalGrid}
        data-arrival-kind={visitorArrivals ? "visitor" : "referee"}
        data-cards={fixedSlots}
        data-render-family={visitorArrivals ? "visitor-arrivals" : "referee-arrivals"}
        data-slots={fixedSlots}
        style={{ "--arrival-slots": fixedSlots } as CSSProperties}
      >
        {page.items.map((entry, index) => {
          const visitorLogo = arrivalConfig.showClubLogo
            ? entry.awayLogoUrl || entry.logoUrl
            : "";
          const refereeLogo = arrivalConfig.showClubLogo ? entry.logoUrl : "";
          return (
          <article
            className={styles.arenaArrivalCard}
            data-arrival-kind={visitorArrivals ? "visitor" : "referee"}
            data-logo={(visitorArrivals ? visitorLogo : refereeLogo) ? "visible" : "missing"}
            data-show-logo={arrivalConfig.showClubLogo ? "yes" : "no"}
            data-sponsor={view.arrivalSponsorUrl ? "visible" : undefined}
            data-motion={view.motionEnabled && visitorArrivals
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
            {visitorArrivals && view.designRevision === "royal-current-v8" ? (
              <RoyalVisitorArrival
                config={arrivalConfig}
                entry={entry}
                logoUrl={visitorLogo}
                view={view}
              />
            ) : !visitorArrivals && view.designRevision === "royal-current-v8" ? (
              <RoyalRefereeArrival
                config={arrivalConfig}
                entry={entry}
                index={index}
                logoUrl={refereeLogo}
                view={view}
              />
            ) : entry.logoUrl ? (
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
            {visitorArrivals && view.designRevision !== "royal-current-v8" ? (
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
                      <span>Thuis: {entry.homeRoom || "-"}</span>
                      <i aria-hidden="true">|</i>
                      <span>Uit: {entry.awayRoom || entry.dressingRoom || "-"}</span>
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
            ) : !visitorArrivals && view.designRevision !== "royal-current-v8" ? (
              <>
                <span>{entry.status
                  .replaceAll("{{club}}", view.clubName)
                  .replaceAll("{{team}}", entry.primary) || "Wedstrijdofficial"}</span>
                {!entry.logoUrl ? <b>{String(index + 1).padStart(2, "0")}</b> : null}
                <h2>{entry.primary}</h2>
                <p>{entry.secondary}</p>
                <strong>{entry.meta}</strong>
              </>
            ) : null}
            {view.arrivalSponsorUrl ? (
              <img
                alt="Sponsor"
                className={styles.arenaArrivalSponsor}
                src={view.arrivalSponsorUrl}
              />
            ) : null}
          </article>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <article
            aria-hidden="true"
            className={`${styles.arenaArrivalCard} ${styles.royalArrivalEmpty}`}
            data-arrival-kind="visitor"
            data-empty-slot="true"
            data-logo="missing"
            data-show-logo={arrivalConfig.showClubLogo ? "yes" : "no"}
            data-slot={page.items.length + index + 1}
            key={`empty-${page.items.length + index}`}
          />
        ))}
      </div>
    );
  }

  if (page.kind === "match") {
    return view.designRevision === "royal-current-v8"
      ? <RoyalMatchHero item={page.item} view={view} />
      : <ArenaNextMatch item={page.item} view={view} />;
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
    if (view.designRevision === "royal-current-v8") {
      return (
        <div className={styles.royalAgenda} data-render-family="activities">
          {page.items.map((entry, index) => (
            <RoyalActivityCard entry={entry} index={index} key={entry.id} />
          ))}
        </div>
      );
    }
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
    if (view.designRevision === "royal-current-v8") {
      return (
        <div className={styles.royalCancellation} data-render-family="cancellations">
          <header className={styles.royalCancellationBanner}>
            <span aria-hidden="true">!</span>
            <div>
              <h2>Deze wedstrijden gaan niet door</h2>
              <p>Bekijk de bevestigde wedstrijdstatus en neem bij vragen contact op met je team.</p>
            </div>
          </header>
          <SportListColumns
            items={page.items}
            renderRow={(entry, index, forceTimeColumn) => (
              <ProgramRow
                display={view.sportDisplay}
                forceTimeColumn={forceTimeColumn}
                item={entry}
                key={entry.id}
                rowIndex={index}
                variant="cancellation"
              />
            )}
            view={view}
          />
          <footer><span>Programmawijziging</span><strong>{page.items.length} bevestigd</strong></footer>
        </div>
      );
    }
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
    if (view.designRevision === "royal-current-v8") {
      return (
        <div className={styles.royalOperationalFixtures} data-render-family="dressing-rooms">
          <SportListColumns
            items={page.items}
            renderRow={(entry, index, forceTimeColumn) => (
              <ProgramRow
                display={view.sportDisplay}
                forceTimeColumn={forceTimeColumn}
                item={entry}
                key={entry.id}
                rowIndex={index}
                variant="dressing"
              />
            )}
            view={view}
          />
        </div>
      );
    }
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
      <div className={styles.royalOperationalFixtures} data-render-family="results">
        <SportListColumns
          items={page.items}
          renderRow={(entry, index, forceTimeColumn) => (
            <ResultRow
              display={view.sportDisplay}
              forceTimeColumn={forceTimeColumn}
              item={entry}
              key={entry.id}
              rowIndex={index}
            />
          )}
          view={view}
        />
      </div>
    );
  }

  if (view.slideType === "sport_officials") {
    if (view.designRevision === "royal-current-v8") {
      return (
        <div className={styles.royalOperationalFixtures} data-render-family="officials">
          <SportListColumns
            items={page.items}
            renderRow={(entry, index, forceTimeColumn) => (
              <ProgramRow
                display={view.sportDisplay}
                forceTimeColumn={forceTimeColumn}
                item={entry}
                key={entry.id}
                rowIndex={index}
                variant="official"
              />
            )}
            view={view}
          />
        </div>
      );
    }
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
      <div className={styles.royalOperationalFixtures} data-render-family="program">
        <SportListColumns
          items={page.items}
          renderRow={(entry, index, forceTimeColumn) => (
            <ProgramRow
              display={view.sportDisplay}
              forceTimeColumn={forceTimeColumn}
              item={entry}
              key={entry.id}
              rowIndex={index}
            />
          )}
          view={view}
        />
      </div>
    );
  }

  return <div className={styles.arenaUnsupported}>Dit schermtype kan niet veilig worden weergegeven.</div>;
}

function RoyalActivityCard({
  entry,
  index
}: {
  entry: DynamicTemplateListItem;
  index: number;
}) {
  const date = activityDateParts(entry.date || entry.secondary);
  return (
    <article
      className={styles.royalActivity}
      style={{ "--arena-row-delay": `${index * 90}ms` } as CSSProperties}
    >
      {entry.photoUrl ? (
        <img alt="" aria-hidden="true" className={styles.royalActivityImage} src={entry.photoUrl} />
      ) : null}
      <div aria-hidden="true" className={styles.royalActivityOverlay} />
      <div className={styles.royalActivityTop}>
        <time className={styles.royalActivityDate} dateTime={entry.date}>
          <b>{date.day}</b><span>{date.month}</span>
        </time>
        <span className={styles.royalActivityTime}>
          {entry.time || entry.kickoffTime || "Tijd volgt"}
          {(entry.time || entry.kickoffTime) ? <small>uur</small> : null}
        </span>
      </div>
      <div className={styles.royalActivityCopy}>
        <h2>{entry.primary}</h2>
        {entry.secondary && entry.secondary !== entry.date ? <p>{entry.secondary}</p> : null}
        <span>{entry.venueName || entry.venue || entry.meta || "Locatie volgt"}</span>
      </div>
    </article>
  );
}

function RoyalMenuPage({
  columns
}: {
  columns: [DynamicTemplatePriceEntry[], DynamicTemplatePriceEntry[]];
}) {
  const groups = columns.flatMap((column) => groupMenuEntries(column));
  return (
    <div
      className={styles.royalMenuCategories}
      data-panels={groups.length}
      data-render-family="menu"
    >
      {groups.map((group, index) => (
        <section className={styles.royalMenuCategory} key={`${group.id}-${index}`}>
          <header>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <span>{group.name}</span>
          </header>
          <h2>{group.name}</h2>
          <div>
            {group.products.map((product) => (
              <article className={styles.royalPriceRail} key={product.id}>
                <strong title={product.name}>{product.name}</strong>
                <i aria-hidden="true" />
                <b>{product.price}</b>
              </article>
            ))}
          </div>
          <footer>{group.products.length} {group.products.length === 1 ? "product" : "producten"}</footer>
        </section>
      ))}
    </div>
  );
}

function groupMenuEntries(entries: DynamicTemplatePriceEntry[]) {
  const groups: Array<{
    id: string;
    name: string;
    products: DynamicTemplateMenuItem[];
  }> = [];
  let active: (typeof groups)[number] | undefined;
  for (const entry of entries) {
    if (entry.kind === "category") {
      active = { id: entry.id, name: entry.name, products: [] };
      groups.push(active);
      continue;
    }
    const category = entry.item.category || "Overig";
    if (!active || active.name !== category) {
      active = {
        id: `category-${category.toLocaleLowerCase("nl-NL")}`,
        name: category,
        products: []
      };
      groups.push(active);
    }
    active.products.push(entry.item);
  }
  return groups.filter((group) => group.products.length > 0);
}

function RoyalVisitorArrival({
  config,
  entry,
  logoUrl,
  view
}: {
  config: DynamicTemplateArrivalConfig;
  entry: DynamicTemplateListItem;
  logoUrl: string;
  view: DynamicTemplateView;
}) {
  const homeTeam = entry.homeTeam || view.clubName;
  const awayTeam = entry.awayTeam || entry.primary;
  const date = arrivalDateLabel(entry, view);
  return (
    <>
      {logoUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className={styles.royalArrivalWatermark}
          src={logoUrl}
        />
      ) : null}
      <div aria-hidden="true" className={styles.royalArrivalGradient} />
      <div className={styles.royalArrivalCrest}>
        <div className={styles.royalArrivalTop}>
          {config.showWelcome ? (
            <span>Welkom bij {view.clubName}</span>
          ) : <span aria-hidden="true" />}
          <span aria-hidden="true" />
        </div>
        {config.showClubLogo ? (
          <div className={styles.royalArrivalLogo}>
            {logoUrl ? (
              <img alt={`Logo ${awayTeam}`} src={logoUrl} />
            ) : (
              <span aria-hidden="true">{initialsFor(awayTeam)}</span>
            )}
          </div>
        ) : null}
      </div>
      <div className={styles.royalArrivalBody}>
        <dl className={styles.royalArrivalSchedule}>
          <div data-emphasis="primary">
            <dt>Datum</dt>
            <dd><time dateTime={entry.kickoffAt}>{date || "-"}</time></dd>
          </div>
          {config.showKickoffTime ? (
            <div data-emphasis="primary">
              <dt>Aanvang</dt>
            <dd>{entry.kickoffTime || entry.time || "-"}</dd>
            </div>
          ) : null}
        </dl>
        <div className={styles.royalArrivalIdentity}>
          <h2>{awayTeam}</h2>
          <span>Welkom bij {view.clubName}</span>
          <p aria-label={`${homeTeam} tegen ${awayTeam}`}>
            {homeTeam} <i>-</i> {awayTeam}
          </p>
        </div>
        <dl className={styles.royalArrivalInfo}>
          {/* Legacy field contract retained for older snapshots: <dt>Scheidsrechter</dt> */}
          {config.showDressingRoom ? (
            <>
              <div><dt>Kleedkamer thuis</dt><dd>{entry.homeRoom || "-"}</dd></div>
              <div><dt>Kleedkamer uit</dt><dd>{entry.awayRoom || entry.dressingRoom || "-"}</dd></div>
            </>
          ) : null}
          {config.showField ? (
            <div><dt>Veld</dt><dd>{entry.field || "-"}</dd></div>
          ) : null}
        </dl>
      </div>
    </>
  );
}

function RoyalRefereeArrival({
  config,
  entry,
  index,
  logoUrl,
  view
}: {
  config: DynamicTemplateArrivalConfig;
  entry: DynamicTemplateListItem;
  index: number;
  logoUrl: string;
  view: DynamicTemplateView;
}) {
  const match = refereeMatchLabel(entry);
  const role = entry.officialAssignments[0]?.role || "Wedstrijdofficial";
  const arrivalTime = arrivalClockLabel(entry, view);
  const date = arrivalDateLabel(entry, view);
  return (
    <>
      <div className={styles.royalRefereeTop}>
        {config.showWelcome ? (
          <span>{arrivalWelcomeLabel(config, view, entry.primary)}</span>
        ) : <span aria-hidden="true" />}
        <b>{String(index + 1).padStart(2, "0")}</b>
      </div>
      <div className={styles.royalRefereeIdentity}>
        {config.showClubLogo ? (
          <TeamMini large logoUrl={logoUrl} name={entry.primary} />
        ) : null}
        <div>
          <span>{role}</span>
          <h2>{entry.primary}</h2>
        </div>
      </div>
      {match ? <p className={styles.royalRefereeMatch}>{match}</p> : null}
      <dl className={styles.royalArrivalSchedule}>
        <div data-emphasis="primary">
          <dt>Datum</dt>
          <dd><time dateTime={entry.kickoffAt}>{date || "volgt"}</time></dd>
        </div>
        {config.showArrivalTime ? (
          <div><dt>Aankomst</dt><dd>{arrivalTime || "volgt"}</dd></div>
        ) : null}
        {config.showKickoffTime ? (
          <div data-emphasis="primary">
            <dt>Aanvang</dt><dd>{entry.kickoffTime || entry.time || "volgt"}</dd>
          </div>
        ) : null}
      </dl>
      <dl className={styles.royalRefereeInfo}>
        {config.showCompetition ? (
          <div><dt>Competitie</dt><dd>{entry.competition || "volgt"}</dd></div>
        ) : null}
        {config.showField ? (
          <div><dt>Veld</dt><dd>{entry.field || "volgt"}</dd></div>
        ) : null}
        {config.showDressingRoom ? (
          <div><dt>Kleedkamer</dt><dd>{entry.dressingRoom || "-"}</dd></div>
        ) : null}
        {config.dutyDeskText ? (
          <div><dt>Melden</dt><dd>{config.dutyDeskText}</dd></div>
        ) : null}
      </dl>
    </>
  );
}

function arrivalWelcomeLabel(
  config: DynamicTemplateArrivalConfig,
  view: DynamicTemplateView,
  team: string
) {
  return config.welcomeText
    .replaceAll("{{club}}", view.clubName)
    .replaceAll("{{team}}", team);
}

function arrivalDateLabel(
  entry: DynamicTemplateListItem,
  view: DynamicTemplateView
) {
  return entry.date || formatVisitorArrivalDate(
    entry.kickoffAt,
    view.themePresentation.resolvedMode.timezone
  );
}

function arrivalClockLabel(
  entry: DynamicTemplateListItem,
  view: DynamicTemplateView
) {
  const value = entry.arrivalAt.trim();
  if (value) {
    const instant = new Date(value);
    if (Number.isFinite(instant.valueOf())) {
      try {
        return new Intl.DateTimeFormat("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: view.themePresentation.resolvedMode.timezone
        }).format(instant);
      } catch {
        return `${String(instant.getUTCHours()).padStart(2, "0")}:${String(
          instant.getUTCMinutes()
        ).padStart(2, "0")}`;
      }
    }
    const clock = value.match(/(?:^|\s)([0-2]?\d:[0-5]\d)(?:\s|$)/u)?.[1];
    if (clock) return clock.padStart(5, "0");
  }
  return entry.secondary.match(
    /\b(?:aankomst|arrival|melden)\s*:?\s*([0-2]?\d:[0-5]\d)\b/iu
  )?.[1]?.padStart(5, "0") ?? "";
}

function refereeMatchLabel(entry: DynamicTemplateListItem) {
  return entry.homeTeam || entry.awayTeam
    ? [entry.homeTeam, entry.awayTeam].filter(Boolean).join(" – ")
    : "";
}

function RoyalMatchHero({
  item,
  view
}: {
  item: DynamicTemplateListItem | null;
  view: DynamicTemplateView;
}) {
  const [fallbackHome, fallbackAway] = splitTeamsExact(item?.primary ?? "");
  const home = item?.homeTeam || fallbackHome;
  const away = item?.awayTeam || fallbackAway;
  const kickoff = item?.kickoffTime || item?.time || "volgt";
  const family = view.slideType === "sport_match_of_the_day"
    ? "match-of-the-day"
    : "next-match";
  const venue = item?.venueName || item?.venue || item?.meta || "Locatie volgt";
  return (
    <section className={styles.royalMatch} data-render-family={family}>
      <header className={styles.royalMatchKicker}>
        <span>{item?.competition || view.sourceLabel}</span>
        <strong>{[item?.date, venue].filter(Boolean).join(" · ")}</strong>
      </header>
      <div className={styles.royalMatchClubs}>
        <RoyalMatchClub label="Thuis" logoUrl={item?.homeLogoUrl} name={home} />
        <i aria-label="tegen">vs.</i>
        <RoyalMatchClub label="Uit" logoUrl={item?.awayLogoUrl} name={away} />
      </div>
      <div className={styles.royalMatchFeature}>
        <time dateTime={item?.kickoffAt}>{kickoff}</time>
        <span>Aftrap</span>
      </div>
      <footer className={styles.royalMatchLocation}>
        <span>Hier spelen we</span>
        <strong>{venue}</strong>
        <div>
          {item?.field ? <span>Veld {matchDetailValue(item.field)}</span> : null}
          {home || away ? <span>{[home, away].filter(Boolean).join(" – ")}</span> : null}
        </div>
      </footer>
    </section>
  );
}

function RoyalMatchClub({
  label,
  logoUrl,
  name
}: {
  label: string;
  logoUrl?: string;
  name: string;
}) {
  return (
    <div className={styles.royalMatchClub}>
      <TeamMini large logoUrl={logoUrl} name={name} />
      <h2>{name || "Team volgt"}</h2>
      <span>{label}</span>
    </div>
  );
}

function BirthdayPage({
  items,
  layout,
  pageSize,
  view
}: {
  items: DynamicTemplateBirthdayItem[];
  layout: "birthday_roll" | "celebration_grid" | "spotlight";
  pageSize: number;
  view: DynamicTemplateView;
}) {
  const configuration = view.birthday?.configuration;
  if (!items.length) return null;
  return (
    <div
      className={styles.birthdayLayout}
      data-align={configuration?.presentation.textAlign ?? "left"}
      data-card-style={configuration?.presentation.cardStyle ?? "glass"}
      data-count={pageSize}
      data-layout={layout}
      data-motion={configuration?.presentation.motion || undefined}
      data-page-size={pageSize}
      data-render-family="birthdays"
    >
      {items.map((birthday, index) => (
        <article
          className={styles.birthdayCard}
          data-birthday-card="true"
          data-today={birthday.isToday || undefined}
          data-emphasize-today={birthday.isToday && configuration?.selection.emphasizeToday || undefined}
          key={birthday.id}
          style={{ "--birthday-delay": `${index * 90}ms` } as CSSProperties}
        >
          <div
            aria-hidden="true"
            className={styles.birthdayCardPhoto}
            style={{
              "--birthday-image": view.birthday?.backgroundUrl
                ? `url(${view.birthday.backgroundUrl})`
                : "none"
            } as CSSProperties}
          />
          <div className={styles.birthdayCopy}>
            <span className={styles.birthdayEyebrow}>Gefeliciteerd</span>
            <h2>{birthday.displayName}</h2>
            {birthday.meta ? <p>{birthday.meta}</p> : null}
            <strong>{birthday.isToday ? "Vandaag jarig" : birthday.dateLabel || "Binnenkort jarig"}
              {birthday.age !== null ? ` · ${birthday.age} jaar` : ""}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function SportListColumns({
  items,
  renderRow,
  view
}: {
  items: DynamicTemplateListItem[];
  renderRow: (
    item: DynamicTemplateListItem,
    index: number,
    forceTimeColumn: boolean
  ) => ReactNode;
  view: DynamicTemplateView;
}) {
  const forceTimeColumn = matchListForcesTimeColumn(
    items,
    view.sportDisplay?.showTime !== false,
    view.slideType === "sport_cancellations"
  );
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
            style={{ "--arena-row-height": `${resolveSportListLayout({
              orientation: view.orientation, slideType: view.slideType, itemCount: column.length,
              contentHeight: view.sportListContentHeight
            }).rowHeight}px` } as CSSProperties}
          >
            {column.map((item, index) => renderRow(
              item,
              rowOffset + index,
              forceTimeColumn
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ArenaPriceList({
  page,
  view
}: {
  page: PriceListRenderPage;
  view: DynamicTemplateView;
}) {
  if (view.designRevision === "royal-current-v8") {
    const products = [...page.columns.left, ...page.columns.right].flatMap((row) =>
      row.kind === "product" ? [row.item] : []
    );
    const feature = products.find((product) => product.image.kind === "image");
    return (
      <div className={styles.royalPriceLayout} data-render-family="price-list">
        <section className={styles.royalPriceTable}>
          <PriceListColumn label="Linkerkolom" rows={page.columns.left} />
          <PriceListColumn label="Rechterkolom" rows={page.columns.right} />
        </section>
        <aside className={styles.royalPriceAside} data-image={feature ? "visible" : "missing"}>
          {feature?.image.kind === "image" ? (
            <img
              alt=""
              src={feature.image.url}
              style={{ objectPosition: feature.image.objectPosition }}
            />
          ) : view.clubLogoUrl ? (
            <img alt="" src={view.clubLogoUrl} />
          ) : null}
          <div>
            <span>{view.clubName}</span>
            <h2>{view.title}</h2>
            <p>{feature?.description || view.sourceLabel}</p>
          </div>
        </aside>
      </div>
    );
  }
  return (
    <div className={styles.arenaPriceListGrid} data-render-family="price-list">
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
      <i aria-hidden="true" className={styles.royalPriceDots} />
      <b>{item.formattedPrice}</b>
    </article>
  );
}

function newsTitleClassName(title: string) {
  if (title.length > 64) return styles.arenaNewsTitleDense;
  return undefined;
}

function ArenaStanding({
  autoScroll,
  items,
  view
}: {
  autoScroll: boolean;
  items: DynamicTemplateStandingItem[];
  view: DynamicTemplateView;
}) {
  const royalCurrent = view.designRevision === "royal-current-v8";
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  useRoyalStandingScroll(scrollViewportRef, royalCurrent && autoScroll);
  const columns = royalCurrent
    ? [items]
    : splitIntoColumns(items, view.orientation, view.sportDisplay?.columns);
  const totalTeams = view.pages.reduce((total, candidate) =>
    candidate.kind === "standing" ? total + candidate.items.length : total,
  0);
  return (
    <section
      className={styles.arenaStandingLayout}
      data-columns={columns.length}
      data-render-family="standing"
    >
      {columns.map((column, columnIndex) => (
        <div
          className={`${styles.arenaPanel} ${styles.arenaStanding}`}
          data-has-pinned-team={Boolean(view.standingPinnedTeam) || undefined}
          key={columnIndex}
        >
          {royalCurrent ? (
            <div className={styles.royalStandingSummary} data-testid="standing-summary">
              <span>Jouw team</span>
              <strong>Volledige stand · {totalTeams} teams</strong>
            </div>
          ) : null}
          <div
            className={styles.arenaStandingHead}
            aria-hidden="true"
            data-testid="standing-head"
          >
            {royalCurrent ? (
              <>
                <span>#</span><span>Logo</span><span>Club + team</span>
                <span>G</span><span>W</span><span>GL</span><span>V</span>
                <span>P</span><span>DV</span><span>DT</span><span>+/−</span>
                <span>Vorm</span>
              </>
            ) : (
              <>
                <span>#</span><span>Team</span><span>GS</span><span>W</span>
                <span>G</span><span>V</span><span>DV</span><span>DT</span>
                <span>+/−</span><span>Vorm</span><span>PT</span><span>Zone</span>
              </>
            )}
          </div>
          {royalCurrent && columnIndex === 0 && view.standingPinnedTeam ? (
            <div className={styles.royalStandingPinned} data-testid="standing-pinned-team">
              <StandingRow
                highlighted
                royalOrientation={view.orientation}
                team={view.standingPinnedTeam}
              />
            </div>
          ) : null}
          <div
            aria-label={autoScroll ? "Volledige stand, automatisch scrollend" : undefined}
            className={styles.arenaStandingRows}
            data-auto-scroll={autoScroll || undefined}
            data-standing-window=""
            ref={royalCurrent && columnIndex === 0 ? scrollViewportRef : undefined}
          >
            {column.map((team) => (
              <StandingRow
                highlighted={!royalCurrent && team.selected}
                key={team.id}
                royalOrientation={royalCurrent ? view.orientation : undefined}
                team={team}
              />
            ))}
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

function useRoyalStandingScroll(
  viewportRef: RefObject<HTMLDivElement | null>,
  enabled: boolean
) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame = 0;
    let startedAt: number | null = null;
    viewport.scrollTop = 0;
    delete viewport.dataset.scrollComplete;
    viewport.dataset.scrollPhase = enabled ? "start-hold" : "paged";

    if (!enabled) return;

    const renderFrame = (now: number) => {
      startedAt ??= now;
      const elapsedMs = now - startedAt;
      const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const travelDurationMs = maximum /
        royalStandingScrollMetrics.speedPxPerSecond * 1_000;
      const endHoldStartsAt = royalStandingScrollMetrics.startHoldMs +
        travelDurationMs;
      const completesAt = endHoldStartsAt + royalStandingScrollMetrics.endHoldMs;

      viewport.scrollTop = royalStandingScrollOffset(elapsedMs, maximum);
      viewport.dataset.scrollPhase = elapsedMs < royalStandingScrollMetrics.startHoldMs
        ? "start-hold"
        : elapsedMs < endHoldStartsAt
          ? "moving"
          : "end-hold";

      if (elapsedMs < completesAt) {
        frame = window.requestAnimationFrame(renderFrame);
        return;
      }

      viewport.scrollTop = maximum;
      viewport.dataset.scrollComplete = "true";
    };

    frame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, viewportRef]);
}

function StandingRow({
  highlighted = false,
  royalOrientation,
  team
}: {
  highlighted?: boolean;
  royalOrientation?: DynamicTemplateView["orientation"];
  team: DynamicTemplateStandingItem;
}) {
  if (royalOrientation === "portrait") {
    return (
      <article
        className={styles.royalStandingCard}
        data-own-team={team.selected || undefined}
        data-selected={highlighted || undefined}
        data-standing-row=""
        data-zone={team.zone || undefined}
      >
        <div className={styles.royalStandingIdentity}>
          <strong>{team.position ?? "–"}</strong>
          <span className={styles.arenaStandingTeam}>
            {team.logoUrl ? <img alt="" src={team.logoUrl} /> : (
              <i aria-hidden="true">{initialsFor(team.teamName)}</i>
            )}
            <b>{team.teamName}</b>
          </span>
          <StandingForm team={team} />
        </div>
        <dl className={styles.royalStandingStatistics}>
          <div><dt>G</dt><dd data-standing-played="">{team.played ?? "–"}</dd></div>
          <div><dt>W</dt><dd>{team.won ?? "–"}</dd></div>
          <div><dt>GL</dt><dd>{team.drawn ?? "–"}</dd></div>
          <div><dt>V</dt><dd>{team.lost ?? "–"}</dd></div>
          <div><dt>P</dt><dd>{team.points ?? "–"}</dd></div>
          <div><dt>DV</dt><dd>{team.goalsFor ?? "–"}</dd></div>
          <div><dt>DT</dt><dd>{team.goalsAgainst ?? "–"}</dd></div>
          <div><dt>+/−</dt><dd>{signed(team.goalDifference)}</dd></div>
        </dl>
      </article>
    );
  }
  if (royalOrientation === "landscape") {
    return (
      <article
        data-own-team={team.selected || undefined}
        data-selected={highlighted || undefined}
        data-standing-row=""
        data-zone={team.zone || undefined}
      >
        <strong>{team.position ?? "–"}</strong>
        <span aria-hidden="true" className={styles.royalStandingLogo}>
          {team.logoUrl ? <img alt="" src={team.logoUrl} /> : (
            <i>{initialsFor(team.teamName)}</i>
          )}
        </span>
        <b className={styles.royalStandingName}>{team.teamName}</b>
        <span data-standing-played="">{team.played ?? "–"}</span>
        <span>{team.won ?? "–"}</span>
        <span>{team.drawn ?? "–"}</span>
        <span>{team.lost ?? "–"}</span>
        <strong>{team.points ?? "–"}</strong>
        <span>{team.goalsFor ?? "–"}</span>
        <span>{team.goalsAgainst ?? "–"}</span>
        <span>{signed(team.goalDifference)}</span>
        <StandingForm team={team} />
      </article>
    );
  }
  return (
    <article
      data-standing-row=""
      data-own-team={team.selected || undefined}
      data-selected={highlighted || undefined}
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
      <span data-standing-played="">{team.played ?? "–"}</span>
      <span>{team.won ?? "–"}</span>
      <span>{team.drawn ?? "–"}</span>
      <span>{team.lost ?? "–"}</span>
      <span>{team.goalsFor ?? "–"}</span>
      <span>{team.goalsAgainst ?? "–"}</span>
      <span>{signed(team.goalDifference)}</span>
      <StandingForm team={team} />
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

function StandingForm({ team }: { team: DynamicTemplateStandingItem }) {
  return (
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
  forceTimeColumn = false,
  item,
  rowIndex,
  variant = "program"
}: {
  display: DynamicTemplateView["sportDisplay"];
  forceTimeColumn?: boolean;
  item: DynamicTemplateListItem;
  rowIndex: number;
  variant?: "cancellation" | "dressing" | "official" | "program";
}) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  const cancelled = isCancelledMatch(item) || variant === "cancellation";
  const timeCell = matchTimeCellKind(
    cancelled,
    display?.showTime !== false,
    forceTimeColumn
  );
  return (
    <article
      className={styles.arenaProgramRow}
      data-fixture-variant={variant}
      style={{ "--arena-row-delay": `${360 + rowIndex * 110}ms` } as CSSProperties}
    >
      <div
        className={styles.arenaMatchPrimary}
        style={{
          gridTemplateColumns: programPrimaryColumns(
            display,
            timeCell !== "hidden"
          )
        }}
      >
        {display?.showDate !== false ? (
          <strong className={styles.arenaMatchDate} data-field="date">
            {item.date || item.secondary || "Datum volgt"}
          </strong>
        ) : null}
        {timeCell === "cancelled" ? (
          <b className={styles.arenaCancelledKickoff} data-field="time" data-status="cancelled">
            Afgelast
          </b>
        ) : timeCell === "time" ? (
          <b className={styles.arenaKickoff} data-field="time">
            {item.time || item.kickoffTime || "Tijd volgt"}
          </b>
        ) : timeCell === "placeholder" ? (
          <span
            aria-hidden="true"
            className={styles.arenaKickoff}
            data-field="time"
            data-time-placeholder=""
          />
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
  forceTimeColumn = false,
  item,
  rowIndex
}: {
  display: DynamicTemplateView["sportDisplay"];
  forceTimeColumn?: boolean;
  item: DynamicTemplateListItem;
  rowIndex: number;
}) {
  const [fallbackHome, fallbackAway] = splitTeams(item.primary);
  const home = item.homeTeam || fallbackHome;
  const away = item.awayTeam || fallbackAway;
  const cancelled = isCancelledMatch(item);
  const timeCell = matchTimeCellKind(
    cancelled,
    display?.showTime !== false,
    forceTimeColumn
  );
  const scoreKnown = !cancelled && Number.isInteger(item.homeScore) &&
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
          gridTemplateColumns: resultPrimaryColumns(
            display,
            timeCell !== "hidden"
          )
        }}
      >
        {display?.showDate !== false ? (
          <strong className={styles.arenaMatchDate} data-field="date">
            {item.date || item.secondary || "Datum volgt"}
          </strong>
        ) : null}
        {timeCell === "cancelled" ? (
          <b className={styles.arenaCancelledKickoff} data-field="time" data-status="cancelled">
            Afgelast
          </b>
        ) : timeCell === "time" ? (
          <b className={styles.arenaKickoff} data-field="time">
            {item.time || item.kickoffTime || "Tijd volgt"}
          </b>
        ) : timeCell === "placeholder" ? (
          <span
            aria-hidden="true"
            className={styles.arenaKickoff}
            data-field="time"
            data-time-placeholder=""
          />
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
    ? item.officialAssignments.map(formatMatchOfficial)
      .filter(Boolean).join(" · ") || "volgt"
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

function formatMatchOfficial(official: { name: string; role: string }) {
  const role = official.role.trim();
  return role && !/^(?:scheidsrechter|referee)$/iu.test(role)
    ? `${role}: ${official.name}`
    : official.name;
}

function programPrimaryColumns(
  display: DynamicTemplateView["sportDisplay"],
  showTimeColumn = false
) {
  const tracks: string[] = [];
  if (display?.showDate !== false) {
    tracks.push("minmax(var(--arena-match-date-min, 140px), .72fr)");
  }
  if (showTimeColumn) {
    tracks.push("minmax(var(--arena-match-time-min, 78px), .48fr)");
  }
  if (display?.showHomeLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, var(--arena-match-team-fr, 1.55fr))");
  if (display?.showHomeDressingRoom) {
    tracks.push("minmax(0, var(--arena-match-room-fr, .88fr))");
  }
  tracks.push("var(--arena-match-vs-min, 36px)");
  if (display?.showAwayLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, var(--arena-match-team-fr, 1.55fr))");
  if (display?.showAwayDressingRoom) {
    tracks.push("minmax(0, var(--arena-match-room-fr, .88fr))");
  }
  return tracks.join(" ");
}

function resultPrimaryColumns(
  display: DynamicTemplateView["sportDisplay"],
  showTimeColumn = false
) {
  const tracks: string[] = [];
  if (display?.showDate !== false) {
    tracks.push("minmax(var(--arena-result-date-min, 190px), .82fr)");
  }
  if (showTimeColumn) {
    tracks.push("minmax(var(--arena-result-time-min, 70px), .48fr)");
  }
  if (display?.showHomeLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, var(--arena-match-team-fr, 1.55fr))");
  if (display?.showAwayLogo !== false) tracks.push("var(--arena-match-logo-size)");
  tracks.push("minmax(0, var(--arena-match-team-fr, 1.55fr))");
  tracks.push("minmax(var(--arena-result-score-min, 112px), .68fr)");
  return tracks.join(" ");
}

function matchDetailValue(value: string) {
  return value
    .replace(/^(?:kleedkamer|veld|field|sportpark)\s*:?\s*/iu, "")
    .trim() || "-";
}

function ArenaRow({
  item,
  kind
}: {
  item: DynamicTemplateListItem;
  kind: "agenda" | "cancellation" | "dressing" | "official";
}) {
  const cancelled = kind === "cancellation" || isCancelledMatch(item);
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
      <span className={styles.arenaRowWhen}>
        {item.date ? <small>{item.date}</small> : null}
        <strong data-status={cancelled ? "cancelled" : undefined}>
          {cancelled ? "Afgelast" : item.time || item.kickoffTime || item.secondary}
        </strong>
      </span>
      <div><h3>{item.primary}</h3><p>{meta}</p></div>
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
  if (
    page.kind === "standing" &&
    view.designRevision === "royal-current-v8" &&
    view.sportListContentHeight
  ) {
    return resolveSportListLayout({
      contentHeight: view.sportListContentHeight,
      itemCount: page.items.length,
      orientation: view.orientation,
      slideType: view.slideType
    }).rowHeight;
  }
  if (page.kind === "sport-list" && view.sportListContentHeight) {
    return resolveSportListLayout({ orientation: view.orientation, slideType: view.slideType,
      contentHeight: view.sportListContentHeight, itemCount: page.items.length,
      columns: view.sportDisplay?.columns === "two" ? 2 : 1 }).rowHeight;
  }
  if (
    view.designRevision === "royal-current-v8" &&
    page.kind === "sport-list" &&
    [
      "sport_cancellations",
      "sport_dressing_rooms",
      "sport_officials",
      "sport_program",
      "sport_results"
    ].includes(view.slideType)
  ) {
    return view.orientation === "portrait" ? 148 : 96;
  }
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

function splitTeamsExact(value: string) {
  const parts = value.split(/\s+[–—-]\s+/).map((part) => part.trim()).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" – ")] as const;
}

export function matchListForcesTimeColumn(
  items: readonly DynamicTemplateListItem[],
  showTime: boolean,
  forceAllCancelled = false
) {
  return !showTime && (forceAllCancelled || items.some(isCancelledMatch));
}

export function matchTimeCellKind(
  cancelled: boolean,
  showTime: boolean,
  forceTimeColumn: boolean
) {
  if (cancelled) return "cancelled" as const;
  if (showTime) return "time" as const;
  return forceTimeColumn ? "placeholder" as const : "hidden" as const;
}

function isCancelledMatch(item: DynamicTemplateListItem) {
  return /(?:afgelast|annul|cancel(?:led|ed)?)/iu.test(item.status);
}

function activityDateParts(value: string) {
  const normalized = value.trim();
  const numeric = normalized.match(/(?:^|\D)(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?(?:\D|$)/u);
  if (numeric) {
    const monthIndex = Number(numeric[2]) - 1;
    return {
      day: numeric[1]!.padStart(2, "0"),
      month: [
        "JAN", "FEB", "MRT", "APR", "MEI", "JUN",
        "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"
      ][monthIndex] ?? ""
    };
  }
  const [day = "—", month = ""] = normalized.split(/\s+/u);
  return { day, month: month.slice(0, 3).toUpperCase() };
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
