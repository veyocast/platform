import { createHash } from "node:crypto";

import { syncSlidePresentationSchema } from "@veyocast/contracts";
import sharp from "sharp";

import { createSyncSlideCapture } from "../src/sync-dom-capture";

// Run inside the deployed worker: inherits its real user, read-only root,
// resource limits and XDG paths. No Supabase, queue or provider access.
for (const orientation of ["landscape", "portrait"]) {
  const presentation = syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: "sync-v1",
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
    family: "visitors",
    orientation,
    theme: "onzetrots-tv",
    name: "Rendercontrole",
    title: "Welkom",
    club: { name: "Rendercontrole" },
    style: { motion: "geen" }
  });
  const capture = await createSyncSlideCapture({ presentation, durationMs: 3000 });
  try {
    const png = await capture.renderPng(1200);
    const metadata = await sharp(png).metadata();
    const [width, height] = orientation === "landscape" ? [1920, 1080] : [1080, 1920];
    if (metadata.format !== "png" || metadata.width !== width || metadata.height !== height) {
      throw new Error("Worker Chromium capture dimensions invalid");
    }
    console.log(JSON.stringify({
      event: "worker.chromium.capture_verified",
      revision: process.env.DEPLOYMENT_SHA,
      environment: process.env.VEYOCAST_ENVIRONMENT,
      orientation, width, height,
      bytes: png.byteLength,
      checksumSha256: createHash("sha256").update(png).digest("hex")
    }));
  } finally {
    await capture.close();
  }
}
