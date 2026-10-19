"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { MediaFrameCardPreview } from "./media-frame-card-preview";
import type { ContentFilmstripPage, ContentFilmstripResult } from "./media-frame-series-types";
import styles from "./media-frame-filmstrip.module.css";

export function MediaFrameFilmstrip({ currentKey, currentName, currentOrientation, currentPreview, initialPage, busy, beforeNavigate, loadMore }: {
  currentKey: string; currentName: string; currentOrientation: string; currentPreview: ReactNode;
  initialPage: ContentFilmstripPage; busy: boolean; beforeNavigate: () => boolean;
  loadMore: (offset: number) => Promise<ContentFilmstripResult>;
}) {
  const [pages, setPages] = useState([initialPage]);
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useRef(true), loadingRef = useRef(false), generation = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { generation.current++; setPages([initialPage]); loadingRef.current = false; setLoading(false); setError(null); }, [initialPage]);
  const items = [...new Map(pages.flatMap(page => page.items).map(item => [item.key, item])).values()];
  const last = pages.at(-1)!;
  const currentCard = <button type="button" className={`${styles.card} active`} aria-current="page" aria-label={`Huidig ontwerp: ${currentName}`}><span className={`${styles.thumbnail} ${currentOrientation === "portrait" ? styles.portrait : ""}`}>{currentPreview}</span><span className={styles.name}>{currentName}</span></button>;
  async function more() {
    if (loadingRef.current || busy || !last.hasMore) return;
    const requestedGeneration = generation.current;
    loadingRef.current = true; setLoading(true); setError(null);
    try {
      const result = await loadMore(last.offset + last.items.length);
      if (!alive.current || requestedGeneration !== generation.current) return;
      if (!result.ok) { setError(result.message); return; }
      if (result.page.offset !== last.offset + last.items.length || !result.page.items.length) { setError("De volgende ontwerpen konden niet veilig worden gelezen. Je huidige selectie blijft behouden; probeer opnieuw."); return; }
      setPages(previous => [...previous, result.page]);
    } catch { if (alive.current && requestedGeneration === generation.current) setError("De bibliotheek kon niet verder worden gelezen. Je ontwerpen blijven behouden; probeer opnieuw zodra je verbinding hebt."); }
    finally { if (alive.current && requestedGeneration === generation.current) { loadingRef.current = false; setLoading(false); } }
  }
  return <>
    {!items.some(item => item.key === currentKey) && currentCard}
    {items.map(item => item.key === currentKey ? <div className={styles.current} key={item.key}>{currentCard}</div> : <Link key={item.key} className={styles.card} href={item.href} aria-label={`Ontwerp openen: ${item.title}`} aria-disabled={busy || undefined} onClick={event => { if (busy || !beforeNavigate()) event.preventDefault(); }}>
      <span className={`${styles.thumbnail} ${item.orientation === "portrait" ? styles.portrait : ""}`}>
        {item.preview.kind === "media-frame" ? <MediaFrameCardPreview value={item.preview.value} title="" /> : item.preview.kind === "image" ? <Image src={item.preview.url} alt="" fill unoptimized sizes="119px" style={{ objectFit: "contain" }} /> : <span className={styles.unavailable}>{item.preview.message}</span>}
      </span><span className={styles.name}>{item.title}</span>
    </Link>)}
    {last.hasMore && <button type="button" className={styles.more} disabled={busy || loading} onClick={() => void more()}>{loading ? "Ontwerpen laden…" : "Meer ontwerpen laden"}<span>{items.length} van {Math.max(last.total, items.length)} geladen</span></button>}
    {error && <span className={styles.error} role="alert">{error}<button type="button" disabled={busy || loading} onClick={() => void more()}>Opnieuw proberen</button></span>}
  </>;
}
