import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";
import { buildRoyalCurrentImplementationPayload, type RoyalCurrentReferenceCase, type ThumbnailReferenceSlideId } from "./royal-current-implementation-fixture";

export const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
export function incidentPayload(slideType: ThumbnailReferenceSlideId, orientation: "portrait" | "landscape") {
  const reference: RoyalCurrentReferenceCase = {
    background: "club", font: "Roboto", height: orientation === "portrait" ? 1920 : 1080,
    id: `s180-${slideType}-${orientation}`, mode: "royal", motion: false, orientation,
    path: "", primary: "#2459ed", secondary: null, slide_id: slideType, slide_index: "1",
    source: "fixture", title: "Sport", type_scale: 1, variant: "default", width: orientation === "portrait" ? 1080 : 1920
  };
  return buildRoyalCurrentImplementationPayload(reference);
}
export async function playIncidentPayload(page: Page, payload: PlayerDynamicTemplatePayload, legacy: boolean, durationSeconds = 60) {
  for (const asset of Object.values(payload.assets ?? {})) {
    const response = await page.request.get(asset.url);
    if (!response.ok()) throw new Error("Fixture asset unavailable");
    const bytes = await response.body();
    asset.bytes = bytes.length;
    asset.checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  }
  const response = await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`);
  const envelope = await response.json();
  const image = envelope.manifest.items.find((item: { kind: string }) => item.kind === "image");
  envelope.manifest.items = [{ ...image, id: "birthday-test-item", durationSeconds, dynamicTemplate: payload }, { ...image, id: "after-birthday", title: "Normale vervolgslide", durationSeconds: 60 }];
  envelope.manifest.totalDurationSeconds = durationSeconds + 60;
  await page.route(/\/api\/player\/manifest(?:\?.*)?$/, (route) => route.fulfill({ json: envelope }));
  for (const endpoint of ["installation", "heartbeat", "commands", "realtime/ack"]) {
    await page.route(`**/api/player/${endpoint}`, (route) => route.fulfill({ json: { ok: true, bound: true, installationCredential: "i".repeat(48), commands: [], automation: null } }));
  }
  await page.route("**/api/player/realtime", (route) => route.fulfill({ body: ": keepalive\n\n", contentType: "text/event-stream" }));
  await page.addInitScript(() => {
    localStorage.setItem("veyocast.player.deviceToken", "b".repeat(48));
    localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
    localStorage.setItem("veyocast.player.instanceId", "s180-browser-fixture");
  });
  await page.goto(`${playerURL}/${legacy ? "lg/legacy" : "?deviceToken=" + "b".repeat(48)}`);
}
