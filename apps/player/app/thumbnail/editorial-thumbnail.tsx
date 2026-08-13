"use client";

import { useCallback, useEffect, useState } from "react";

import {
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { EditorialArenaRenderer } from "@veyocast/content-templates";

import styles from "./editorial-thumbnail.module.css";

export function EditorialThumbnail() {
  const [payload, setPayload] = useState<PlayerDynamicTemplatePayload | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    try {
      const parameters = new URLSearchParams(window.location.hash.slice(1));
      const encoded = parameters.get("payload");
      if (!encoded || encoded.length > 1_500_000) throw new Error("invalid");
      const parsed = playerDynamicTemplatePayloadSchema.safeParse(
        JSON.parse(decodeBase64Url(encoded))
      );
      if (!parsed.success) throw new Error("invalid");
      setPayload(parsed.data);
    } catch {
      setInvalid(true);
      document.documentElement.dataset.thumbnailError = "invalid_payload";
    }
  }, []);

  const handleReady = useCallback(async () => {
    await waitForAssets();
    await nextFrame();
    await nextFrame();
    document.documentElement.dataset.thumbnailReady = "true";
  }, []);

  if (invalid) return <main className={styles.error}>Ongeldige thumbnailpayload</main>;
  if (!payload) return null;
  return (
    <main className={styles.page}>
      <EditorialArenaRenderer
        item={{
          accessibilityName: "Editorial Arena-thumbnail",
          durationSeconds: 10,
          dynamicTemplate: payload,
          id: payload.snapshotId,
          title: "Thumbnail"
        }}
        onReady={handleReady}
        pageIndex={0}
      />
    </main>
  );
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return decodeURIComponent(
    Array.from(atob(padded), (character) => (
      `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
    )).join("")
  );
}

async function waitForAssets() {
  if ("fonts" in document) await document.fonts.ready;
  const images = Array.from(document.images);
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  }));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
