"use client";

import React,{ useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import {
  createDynamicTemplateView,
  EditorialArenaRenderer
} from "@veyocast/content-templates";
import { Button } from "@veyocast/ui";
import {syncDynamicConfigurationSchema,syncSlidePageCount} from '@veyocast/contracts';
import {projectSyncDynamicSnapshot} from '@veyocast/content-templates/sync-dynamic-projector';
import {SyncSlideStaticView} from '@veyocast/content-templates/sync-slide-static-view';

import styles from "../../dynamic-content.module.css";
import type { DynamicSlidePreviewResult } from "../actions";

export function DynamicSlideLivePreview({
  dualOrientation = false,
  loading,
  result
}: {
  dualOrientation?: boolean;
  loading: boolean;
  result: DynamicSlidePreviewResult | null;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const source=useMemo(()=>{
    if(!result?.ok||!Object.hasOwn(result.payload.data,'syncConfiguration'))return null;
    const cfg=syncDynamicConfigurationSchema.safeParse(result.payload.data.syncConfiguration);
    return cfg.success?projectSyncDynamicSnapshot(result.payload,cfg.data.seed):{ok:false}as const;
  },[result]);
  const view = useMemo(
    () => result?.ok&&!source ? createDynamicTemplateView(result.payload) : null,
    [result,source]
  );
  const pageCount = source?.ok?syncSlidePageCount(source.presentation):view?.pages.length ?? 0;

  useEffect(() => {
    setPageIndex(0);
  }, [result?.ok ? result.payload.snapshotHash : null]);

  return (
    <section
      aria-busy={loading}
      aria-labelledby="dynamic-live-preview-title"
      className={styles.livePreview}
    >
      <header className={styles.livePreviewHeader}>
        <div>
          <span>Echte Player-weergave</span>
          <h3 id="dynamic-live-preview-title">Live HTML/CSS-preview</h3>
        </div>
        {loading ? (
          <span className={styles.livePreviewLoading} role="status">
            <RefreshCw aria-hidden="true" /> Preview bijwerken
          </span>
        ) : null}
      </header>

      {result?.ok && (view||source?.ok) ? (
        <>
          <div className={dualOrientation ? styles.livePreviewOrientations : undefined}>
            {(dualOrientation
              ? (["landscape", "portrait"] as const)
              : [result.payload.orientation]
            ).map((orientation) => (
              <div key={orientation}>
                {dualOrientation ? <strong>{orientation === "landscape" ? "Landscape" : "Portrait"}</strong> : null}
                <div
                  className={styles.livePreviewStage}
                  data-orientation={orientation}
                >
                  {source?.ok?<SyncSlideStaticView presentation={{...source.presentation,orientation}} page={pageIndex} resolveAsset={asset=>asset.kind==='system'?asset.path:result.payload.assets?.[asset.mediaAssetId]?.url}/>:view?<EditorialArenaRenderer
                    embedded
                    item={{
                      accessibilityName: `Preview ${view.title} ${orientation}`,
                      durationSeconds: Math.max(5, view.pages.length * 5),
                      dynamicTemplate: {
                        ...result.payload,
                        orientation
                      },
                      id: `preview-${result.payload.snapshotId}-${orientation}`,
                      title: view.title
                    }}
                    pageIndex={pageIndex}
                    passive
                  />:null}
                </div>
              </div>
            ))}
          </div>
          <footer className={styles.livePreviewFooter}>
            <div>
              <strong>
                {result.itemCount} {result.itemCount === 1 ? "item" : "items"}
              </strong>
              <span>
                {pageCount} {pageCount === 1 ? "pagina" : "pagina’s"}
                {result.missingAssetCount
                  ? ` · ${result.missingAssetCount} afbeelding(en) ontbreken`
                  : " · alle afbeeldingen beschikbaar"}
              </span>
            </div>
            {pageCount > 1 ? (
              <div aria-label="Previewpagina kiezen" className={styles.livePreviewPager}>
                <Button
                  aria-label="Vorige previewpagina"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span>{pageIndex + 1} / {pageCount}</span>
                <Button
                  aria-label="Volgende previewpagina"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </footer>
        </>
      ) : source&&!source.ok?<div className={styles.livePreviewMessage}role="status"><strong>Bronvoorbeeld niet beschikbaar</strong><span>De Source-gegevens konden niet volledig worden gecontroleerd. Controleer de bronselectie en open het ontwerp opnieuw.</span></div>:result && !result.ok ? (
        <div className={styles.livePreviewMessage} role="status">
          <strong>Preview niet beschikbaar</strong>
          <span>{result.message}</span>
        </div>
      ) : (
        <div className={styles.livePreviewMessage} role="status">
          <strong>Kies eerst bron en inhoud</strong>
          <span>Daarna toont VeyoCast hier dezelfde renderer als op de Player.</span>
        </div>
      )}
    </section>
  );
}
