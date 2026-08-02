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
      dynamicTemplatePageDurationMs(item.durationSeconds, pageCount)
    );
    return () => window.clearInterval(interval);
  }, [item.durationSeconds, pageCount, passive, view]);

  if (!view) return null;
  const page = view.pages[pageIndex] ?? view.pages[0]!;
  const style: TemplateStyle = {
    "--template-accent": view.accentColor
  };

  return (
    <section
      aria-label={item.accessibilityName ?? item.title}
      className={styles.root}
      data-orientation={view.orientation}
      data-slide-type={view.slideType}
      data-theme={view.theme}
      style={style}
    >
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
        <span>VeyoCast ClubTV</span>
        {pageCount > 1 ? (
          <span>
            {pageIndex + 1} / {pageCount}
          </span>
        ) : (
          <span>Live clubinformatie</span>
        )}
      </footer>
    </section>
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
