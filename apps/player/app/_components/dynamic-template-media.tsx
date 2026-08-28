"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  createDynamicTemplateView,
  EditorialArenaRenderer,
  type EditorialArenaItem
} from "@veyocast/content-templates";

export function DynamicTemplateMedia({
  item,
  onEnded,
  onReady,
  passive = false
}: {
  item: EditorialArenaItem;
  onEnded: (itemId: string) => void;
  onReady: (itemId: string) => void;
  passive?: boolean;
}) {
  const skippedRef = useRef("");
  const view = useMemo(
    () => createDynamicTemplateView(item.dynamicTemplate),
    [item.dynamicTemplate]
  );
  const shouldSkip = view?.slideType === "sport_birthdays" && view.pages.length === 0;

  useEffect(() => {
    if (!shouldSkip || passive || skippedRef.current === item.id) return;
    skippedRef.current = item.id;
    onReady(item.id);
    const frame = window.requestAnimationFrame(() => onEnded(item.id));
    return () => window.cancelAnimationFrame(frame);
  }, [item.id, onEnded, onReady, passive, shouldSkip]);

  if (shouldSkip) return null;
  return <EditorialArenaRenderer item={item} onReady={onReady} passive={passive} />;
}
