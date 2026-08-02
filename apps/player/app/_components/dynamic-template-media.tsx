"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";

import {
  createDynamicTemplateView,
  dynamicTemplatePageDurationMs,
  type DynamicTemplateListItem,
  type DynamicTemplatePage,
  type DynamicTemplateView
} from "../_lib/dynamic-template-view";
import type { PlayerManifestItem } from "../_lib/player-manifest";
import styles from "./dynamic-template-media.module.css";

type TemplateStyle = CSSProperties & {
  "--template-accent": string;
  "--template-page-duration": string;
};

export function DynamicTemplateMedia({
  item,
  onReady,
  passive = false
}: {
  item: PlayerManifestItem;
  onReady: (itemId: string) => void;
  passive?: boolean;
}) {
  const view = createDynamicTemplateView(item.dynamicTemplate);
  const readyRef = useRef(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = view?.pages.length ?? 0;

  useEffect(() => {
    setPageIndex(0);
  }, [item.id, view?.snapshotId]);

  useEffect(() => {
    if (!view || passive || readyRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      readyRef.current = true;
      onReady(item.id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [item.id, onReady, passive, view]);

  useEffect(() => {
    if (!view || pageCount <= 1 || passive) return;
    const interval = window.setInterval(
      () => setPageIndex((current) => (current + 1) % pageCount),
      dynamicTemplatePageDurationMs(
        item.durationSeconds,
        pageCount,
        view.pageDurationMs
      )
    );
    return () => window.clearInterval(interval);
  }, [item.durationSeconds, pageCount, passive, view]);

  if (!view) return null;
  const page = view.pages[pageIndex] ?? view.pages[0]!;
  const pageDurationMs = dynamicTemplatePageDurationMs(
    item.durationSeconds,
    pageCount,
    view.pageDurationMs
  );
  const style: TemplateStyle = {
    "--template-accent": view.accentColor,
    "--template-page-duration": `${pageDurationMs}ms`
  };
  const isPortraitNews =
    view.slideType === "news" && view.orientation === "portrait";

  return (
    <section
      aria-label={item.accessibilityName ?? item.title}
      className={`${styles.root} ${isPortraitNews ? styles.rssPortrait : ""}`}
      data-orientation={view.orientation}
      data-slide-type={view.slideType}
      data-theme={view.theme}
      style={style}
    >
      {isPortraitNews ? (
        <PortraitNewsPage
          page={page}
          pageCount={pageCount}
          pageIndex={pageIndex}
          view={view}
        />
      ) : (
        <>
          <div aria-hidden="true" className={styles.atmosphere}>
            <span />
            <span />
            <span />
          </div>
          <header className={styles.header}>
            <p>{view.sourceLabel}</p>
            <h1>{view.title}</h1>
          </header>
          <TemplatePage page={page} view={view} />
          {view.emptyState ? (
            <div className={styles.emptyState}>{view.emptyState}</div>
          ) : null}
          <footer className={styles.footer}>
            {pageCount > 1 ? (
              <span>
                Pagina {pageIndex + 1} van {pageCount}
              </span>
            ) : (
              <span>Live clubinformatie</span>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

function PortraitNewsPage({
  page,
  pageCount,
  pageIndex,
  view
}: {
  page: DynamicTemplatePage;
  pageCount: number;
  pageIndex: number;
  view: DynamicTemplateView;
}) {
  const article = page.kind === "news" ? page.item : null;
  const providerInitial = view.sourceLabel.charAt(0).toUpperCase() || "N";

  return (
    <div
      className={styles.rssPage}
      data-page-index={pageIndex}
      key={article?.id ?? `empty-${pageIndex}`}
    >
      <div aria-hidden="true" className={styles.rssHero}>
        <span className={styles.rssHeroInitial}>{providerInitial}</span>
        {article?.heroUrl ? (
          // The Player must render verified blob/cache URLs without Next's
          // online image optimizer so offline playback remains self-contained.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className={styles.rssHeroImage}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
            src={article.heroUrl}
          />
        ) : null}
        <span className={styles.rssHeroGrade} />
      </div>

      <header className={styles.rssProviderHeader}>
        {view.providerLogoUrl ? (
          // Supplier logos use the same checksum-verified local cache path.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={view.sourceLabel}
            className={styles.rssProviderLogo}
            onError={(event) => {
              event.currentTarget.hidden = true;
              event.currentTarget.nextElementSibling?.removeAttribute("hidden");
            }}
            src={view.providerLogoUrl}
          />
        ) : null}
        <span
          className={styles.rssProviderWordmark}
          hidden={Boolean(view.providerLogoUrl)}
        >
          <RssIcon />
          <strong>{view.sourceLabel}</strong>
        </span>
        <p className={styles.rssSectionTitle}>{view.title}</p>
      </header>

      {article ? (
        <>
          <article className={styles.rssStory}>
            <h1 data-compact={article.title.length > 88}>
              {article.title}
            </h1>
            <span aria-hidden="true" className={styles.rssTitleAccent} />
            {article.intro ? <p>{article.intro}</p> : null}
          </article>
          <div className={styles.rssMetadata}>
            {article.date ? (
              <NewsMeta icon="calendar" label="Datum" value={article.date} />
            ) : null}
            <NewsMeta
              icon="source"
              label="Door"
              value={article.author || article.source}
            />
          </div>
        </>
      ) : (
        <div className={styles.rssEmpty}>{view.emptyState}</div>
      )}

      <footer className={styles.rssFooter}>
        <span
          aria-hidden="true"
          className={styles.rssProgress}
          key={`${article?.id ?? "empty"}-${pageIndex}`}
        >
          <span />
        </span>
        <span className={styles.rssCounter}>
          <strong>{pageIndex + 1}</strong>
          <span>/</span>
          <span>{Math.max(pageCount, 1)}</span>
        </span>
      </footer>
    </div>
  );
}

function NewsMeta({
  icon,
  label,
  value
}: {
  icon: "calendar" | "source";
  label: string;
  value: string;
}) {
  return (
    <span className={styles.rssMetaItem}>
      <span aria-hidden="true" className={styles.rssMetaIcon}>
        {icon === "calendar" ? (
          <svg viewBox="0 0 32 32">
            <rect height="19" rx="4" width="21" x="5.5" y="7.5" />
            <path d="M10 4.5v6M22 4.5v6M6 13h20" />
          </svg>
        ) : (
          <svg viewBox="0 0 32 32">
            <path d="m12.8 19.2 6.4-6.4M10.2 22.4l-1.7 1.7A5.3 5.3 0 0 1 1 16.6l5.3-5.3a5.3 5.3 0 0 1 7.5 0M21.8 9.6l1.7-1.7a5.3 5.3 0 1 1 7.5 7.5l-5.3 5.3a5.3 5.3 0 0 1-7.5 0" />
          </svg>
        )}
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </span>
  );
}

function RssIcon() {
  return (
    <span aria-hidden="true" className={styles.rssGlyph}>
      <svg viewBox="0 0 48 48">
        <circle cx="11" cy="37" r="4.5" />
        <path d="M7 21.5c10.8 0 19.5 8.7 19.5 19.5M7 8c18.2 0 33 14.8 33 33" />
      </svg>
    </span>
  );
}

function TemplatePage({
  page,
  view
}: {
  page: DynamicTemplatePage;
  view: DynamicTemplateView;
}) {
  if (page.kind === "menu") {
    return (
      <div className={styles.menuGrid}>
        {page.items.map((item) => (
          <article className={styles.menuItem} key={item.id}>
            <div>
              {item.category ? <p>{item.category}</p> : null}
              <h2>{item.name}</h2>
              {item.description ? <span>{item.description}</span> : null}
            </div>
            <strong>{item.price}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (page.kind === "news") {
    return page.item ? (
      <article className={styles.newsArticle}>
        <p className={styles.newsMeta}>
          {page.item.source}
          {page.item.date ? ` · ${page.item.date}` : ""}
        </p>
        <h2>{page.item.title}</h2>
        {page.item.intro ? <p>{page.item.intro}</p> : null}
      </article>
    ) : null;
  }

  if (page.kind === "match") {
    return (
      <div className={styles.matchCentre}>
        <TeamMark name={page.homeTeam} />
        <div className={styles.matchMeta}>
          <span>{page.item?.status || "Programma"}</span>
          <strong>{page.item?.secondary || "Tijd volgt"}</strong>
          <p>{page.item?.meta || "Locatie volgt"}</p>
        </div>
        <TeamMark name={page.awayTeam} />
      </div>
    );
  }

  return (
    <div className={styles.sportList}>
      <div className={styles.listHeading}>
        <span>{view.slideType.includes("standing") ? "#" : "Wedstrijd"}</span>
        <span>Datum / informatie</span>
        <span>{view.slideType.includes("standing") ? "Punten" : "Locatie"}</span>
      </div>
      {page.items.map((item, index) => (
        <SportRow index={index} item={item} key={item.id} />
      ))}
    </div>
  );
}

function TeamMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <article className={styles.team}>
      <div aria-hidden="true">{initials || "VC"}</div>
      <h2>{name}</h2>
    </article>
  );
}

function SportRow({
  index,
  item
}: {
  index: number;
  item: DynamicTemplateListItem;
}) {
  return (
    <article className={styles.sportRow}>
      <span>{index + 1}</span>
      <div>
        <h2>{item.primary}</h2>
        {item.secondary ? <p>{item.secondary}</p> : null}
      </div>
      <strong>{item.meta || item.status}</strong>
    </article>
  );
}
