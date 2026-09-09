import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "../../apps/player/app/_lib/player-manifest";
import {
  buildRoyalCurrentImplementationPayload,
  buildRoyalCurrentLiveMatchPayload,
  buildRoyalCurrentThemeCarrier,
  fixtureMarker,
  isThumbnailReferenceCase,
  referenceMode,
  type RoyalCurrentReferenceCase
} from "./royal-current-implementation-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const handoverRoot = process.env.ROYAL_CURRENT_HANDOVER_ROOT;
const engagePublicId = "71000000-0000-4000-8000-000000000081";
const runtimeKinds = [
  "engage_poll",
  "led_goal_own",
  "ledscores_live_match"
] as const;

type RuntimeKind = (typeof runtimeKinds)[number];
type ActiveRuntimeCase = {
  kind: RuntimeKind;
  manifest: PlayerManifestEnvelope;
  reference: RoyalCurrentReferenceCase;
};

test.use({ serviceWorkers: "block" });

/**
 * This is deliberately an implementation-coverage matrix, not a prototype
 * pixelmatch or ref/new/diff claim. The immutable handover fixture cannot be
 * reused byte-for-byte by the React production renderer.
 *
 * 80 cases use the production `/thumbnail` + `EditorialArenaRenderer` path.
 * The remaining 12 have no valid `/thumbnail` representation by design:
 * `ledscores_live_match` is rendered by `DynamicTemplateMedia`, while Engage
 * and a goal moment are respectively an online binding and a realtime event,
 * not DynamicTemplate slideTypes. Those cases use the normal production Player
 * route and their actual rendering components instead of a dishonest alias.
 */
test("exacte 92-case Royal Current implementation coverage (geen pixelmatch)", async ({
  page
}) => {
  test.skip(
    !handoverRoot,
    "Zet ROYAL_CURRENT_HANDOVER_ROOT om de immutable 92-case index tegen de productie-implementatie te toetsen."
  );
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const references = readReferenceCases(handoverRoot!);
  assertExactReferenceMatrix(references);
  expect(references.filter(isThumbnailReferenceCase)).toHaveLength(80);
  for (const runtimeKind of runtimeKinds) {
    expect(references.filter((entry) => entry.slide_id === runtimeKind)).toHaveLength(4);
  }

  const baselineResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  expect(baselineResponse.ok()).toBe(true);
  const baseline = await baselineResponse.json() as PlayerManifestEnvelope;
  const qrBytes = readFileSync(resolve(
    process.cwd(),
    "apps/player/public/royal-current-news-qr.svg"
  ), "utf8");
  let activeRuntime: ActiveRuntimeCase | null = null;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installRuntimeRoutes(page, () => activeRuntime, qrBytes);

  for (const [index, reference] of references.entries()) {
    await test.step(reference.id, async () => {
      pageErrors.length = 0;
      await page.setViewportSize({
        height: reference.height,
        width: reference.width
      });

      const target = isThumbnailReferenceCase(reference)
        ? await renderThumbnailCase(page, reference)
        : await renderRuntimeCase(page, reference, index, baseline, (value) => {
            activeRuntime = value;
          });

      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }"
      });
      await assertProductionSurface(page, target, reference);
      expect(pageErrors, `browserfouten voor ${reference.id}`).toEqual([]);
    });
  }
});

async function renderThumbnailCase(
  page: Page,
  reference: RoyalCurrentReferenceCase
) {
  const payload = buildRoyalCurrentImplementationPayload(reference);
  expect(playerDynamicTemplatePayloadSchema.safeParse(payload).success).toBe(true);
  await page.goto("about:blank");
  const response = await page.goto(
    `${playerURL}/thumbnail#payload=${encodePayload(payload)}`
  );
  expect(response?.ok()).toBe(true);
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => ({
        error: document.documentElement.dataset.thumbnailError ?? null,
        ready: document.documentElement.dataset.thumbnailReady === "true"
      }));
    } catch (error) {
      if (String(error).includes("Execution context was destroyed")) {
        return { error: null, ready: false };
      }
      throw error;
    }
  }, { message: `Thumbnail ${reference.id} werd niet gereed.` })
    .toEqual({ error: null, ready: true });

  const slide = page.locator("[data-slide-type]");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-slide-type", reference.slide_id);
  await expect(slide).toHaveAttribute("data-orientation", reference.orientation);
  await expect(slide).toHaveAttribute("data-theme", referenceMode(reference));
  await expect(slide).toHaveAttribute("data-theme-id", "fieldflow");
  await expect(slide).toHaveAttribute("data-design-revision", "royal-current-v8");
  await expect(slide).toHaveAttribute("data-motion-state", "off");
  await expect(slide).toHaveAttribute("data-canvas-width", String(reference.width));
  await expect(slide).toHaveAttribute("data-canvas-height", String(reference.height));
  const marker = fixtureMarker(reference);
  expect(marker, `ontbrekende markerconfiguratie voor ${reference.slide_id}`).not.toBe("");
  await expect(slide.locator(marker)).toBeVisible();

  if (reference.slide_id === "sport_visitor_arrivals") {
    await expect(slide.locator('article[data-arrival-kind="visitor"]')).toHaveCount(
      Number(reference.variant)
    );
    await expect(slide).toContainText("Duindorp sv");
    await expect(slide).toContainText("Quick");
  }
  if (reference.slide_id === "news") {
    await expect(slide).toContainText("Duindorp opent het vernieuwde hoofdveld");
  }
  await expect(slide).not.toContainText("Dit schermtype kan niet veilig worden weergegeven");
  return slide;
}

async function renderRuntimeCase(
  page: Page,
  reference: RoyalCurrentReferenceCase,
  index: number,
  baseline: PlayerManifestEnvelope,
  activate: (value: ActiveRuntimeCase) => void
) {
  if (!isRuntimeKind(reference.slide_id)) {
    throw new Error(`Onbekend productieruntime-op ${reference.slide_id}.`);
  }
  const item = runtimeItem(reference, baseline.manifest.items[0]!);
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: baseline.manifest.releaseId,
      desiredReleaseId: baseline.manifest.releaseId
    },
    manifest: {
      ...baseline.manifest,
      items: [item],
      label: `Royal Current implementation ${reference.id}`,
      totalDurationSeconds: item.durationSeconds
    }
  };
  activate({ kind: reference.slide_id, manifest, reference });
  await page.goto("about:blank");
  const tokenCharacter = "abcdefghijklmnopqrstuvwxyz"[index % 26]!;
  const response = await page.goto(
    `${playerURL}/?deviceToken=${tokenCharacter.repeat(48)}&durationMs=60000`
  );
  expect(response?.ok()).toBe(true);

  const target = reference.slide_id === "ledscores_live_match"
    ? page.getByTestId("ledscores-live-match-slide")
    : reference.slide_id === "engage_poll"
      ? page.locator('[data-campaign-kind="poll"]')
      : page.getByTestId("ledscores-goal-overlay");
  await expect(target).toBeVisible({ timeout: 8_000 });
  await expect(target).toHaveAttribute("data-design-revision", "royal-current-v8");
  await expect(target).toHaveAttribute("data-theme-mode", referenceMode(reference));
  await expect(target).toHaveAttribute("data-motion-state", "off");

  if (reference.slide_id === "ledscores_live_match") {
    await expect(target).toHaveAttribute("data-orientation", reference.orientation);
    await expect(target).toContainText("Duindorp sv O23-1");
    await expect(target).toContainText("Quick O23-1");
  } else if (reference.slide_id === "engage_poll") {
    await expect(target).toHaveAttribute("data-campaign-kind", "poll");
    await expect(target).toContainText("Welk clubmoment verdient een vervolg?");
    await expect(target.locator('[role="progressbar"]')).toHaveCount(3);
  } else {
    await expect(target).toHaveAttribute("data-scoring-side", "own");
    await expect(target).toContainText("GOAL!");
    await expect(target).toContainText("2–1");
  }
  return target;
}

async function assertProductionSurface(
  page: Page,
  target: Locator,
  reference: RoyalCurrentReferenceCase
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect.poll(async () => page.evaluate(() => Array.from(document.images)
    .filter((image) => !image.complete || image.naturalWidth === 0).length), {
    message: `Afbeeldingen voor ${reference.id} werden niet volledig geladen.`
  }).toBe(0);

  const evidence = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const root = document.documentElement;
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      boxHeight: box.height,
      boxWidth: box.width,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      fontFamily: style.fontFamily,
      imageFailures: Array.from(document.images).filter(
        (image) => !image.complete || image.naturalWidth === 0
      ).length,
      interactiveControls: document.querySelectorAll(
        "button, input, select, textarea, [contenteditable='true'], video[controls], audio[controls]"
      ).length,
      primary: style.getPropertyValue("--brand-primary").trim().toLowerCase(),
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      textLength: element.textContent?.replace(/\s+/gu, " ").trim().length ?? 0,
      viewportOverflow:
        root.scrollWidth > window.innerWidth + 1 ||
        root.scrollHeight > window.innerHeight + 1
    };
  });

  expect(evidence.boxWidth).toBeCloseTo(reference.width, 0);
  expect(evidence.boxHeight).toBeCloseTo(reference.height, 0);
  if (evidence.scrollWidth > evidence.clientWidth + 1) {
    expect(["clip", "hidden"]).toContain(evidence.overflowX);
  }
  if (evidence.scrollHeight > evidence.clientHeight + 1) {
    expect(["clip", "hidden"]).toContain(evidence.overflowY);
  }
  expect(evidence.viewportOverflow).toBe(false);
  expect(evidence.imageFailures).toBe(0);
  expect(evidence.interactiveControls).toBe(0);
  expect(evidence.fontFamily.toLowerCase()).toContain(reference.font.toLowerCase());
  expect(evidence.primary).toBe(reference.primary);
  expect(evidence.textLength).toBeGreaterThan(20);
  expect(
    evidence.backgroundImage !== "none" ||
    evidence.backgroundColor !== "rgba(0, 0, 0, 0)"
  ).toBe(true);

  const screenshot = await target.screenshot({
    animations: "disabled",
    caret: "hide"
  });
  expect(screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(screenshot.byteLength).toBeGreaterThan(8_000);
}

async function installRuntimeRoutes(
  page: Page,
  active: () => ActiveRuntimeCase | null,
  qrBytes: string
) {
  await page.route("**/api/player/manifest**", async (route) => {
    const runtime = active();
    if (!runtime) return route.continue();
    await route.fulfill({
      body: JSON.stringify(runtime.manifest),
      contentType: "application/json"
    });
  });
  await page.route("**/api/player/installation", (route) => route.fulfill({
    body: JSON.stringify({
      bound: true,
      installationCredential: "i".repeat(48),
      ok: true
    }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    body: JSON.stringify({ automation: null, ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime/ack", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime", async (route) => {
    const runtime = active();
    if (runtime?.kind !== "led_goal_own") {
      await route.fulfill({ status: 204 });
      return;
    }
    const now = Date.now();
    await route.fulfill({
      body: sse("goal", {
        alertVersionId: "71000000-0000-4000-8000-000000000082",
        assets: [],
        executeAt: new Date(now + 100).toISOString(),
        expiresAt: new Date(now + 10_000).toISOString(),
        id: "71000000-0000-4000-8000-000000000083",
        kind: "goal",
        payload: {
          awayScore: 1,
          awayTeam: "Quick O23-1",
          design: {
            animation: "none",
            headline: "GOAL!",
            logoPosition: "left",
            logoScale: "large",
            palette: "ink-black",
            scorerFallback: "Doelpunt!",
            secondaryText: "Voor Duindorp",
            showClock: true,
            showPreviousScore: true,
            showScorer: true,
            templateId: "score-focus",
            typography: "display"
          },
          durationMs: 6_000,
          eventId: "71000000-0000-4000-8000-000000000084",
          eventKind: "live",
          homeScore: 2,
          homeTeam: "Duindorp sv O23-1",
          matchClock: "46:12",
          player: { id: null, name: "M. de Jong", number: "9", photoUrl: null },
          previousAwayScore: 1,
          previousHomeScore: 1,
          scoringSide: "own",
          underlayPolicy: "continue"
        },
        screenId: "71000000-0000-4000-8000-000000000085",
        serverTime: new Date(now).toISOString()
      }),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });
  await page.route("**/api/player/engage/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/qr")) {
      await route.fulfill({ body: qrBytes, contentType: "image/svg+xml" });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({
        closesAt: null,
        id: engagePublicId,
        kind: "poll",
        options: [
          { id: "71000000-0000-4000-8000-000000000091", label: "Jeugdclinic", sortOrder: 0, voteCount: 18 },
          { id: "71000000-0000-4000-8000-000000000092", label: "Familietoernooi", sortOrder: 1, voteCount: 12 },
          { id: "71000000-0000-4000-8000-000000000093", label: "Vrijwilligersavond", sortOrder: 2, voteCount: 6 }
        ],
        privacyNotice: "Er worden geen namen of ruwe IP-adressen opgeslagen.",
        question: "Welk clubmoment verdient een vervolg?",
        resultVisibility: "live",
        resultsVisible: true,
        status: "live",
        tenantName: "Duindorp SV",
        title: "Laat je stem horen",
        totalVotes: 36
      }),
      contentType: "application/json"
    });
  });
}

function runtimeItem(
  reference: RoyalCurrentReferenceCase,
  baselineItem: PlayerManifestItem
): PlayerManifestItem {
  const dynamicTemplate = reference.slide_id === "ledscores_live_match"
    ? buildRoyalCurrentLiveMatchPayload(reference)
    : buildRoyalCurrentThemeCarrier(reference);
  expect(playerDynamicTemplatePayloadSchema.safeParse(dynamicTemplate).success).toBe(true);
  return {
    ...baselineItem,
    durationSeconds: 60,
    dynamicTemplate,
    id: `royal-current-${reference.slide_id}-${reference.mode}-${reference.orientation}`,
    onlinePlayback: reference.slide_id === "engage_poll"
      ? {
          kind: "engage",
          publicId: engagePublicId,
          question: "Welk clubmoment verdient een vervolg?",
          title: "Laat je stem horen"
        }
      : undefined,
    title: reference.title
  };
}

function readReferenceCases(root: string) {
  return JSON.parse(readFileSync(
    resolve(root, "referentie/REFERENTIECASES.json"),
    "utf8"
  )) as RoyalCurrentReferenceCase[];
}

function assertExactReferenceMatrix(references: RoyalCurrentReferenceCase[]) {
  expect(references).toHaveLength(92);
  expect(new Set(references.map((entry) => entry.id)).size).toBe(92);
  const variants = new Map<string, Set<string>>();
  for (const reference of references) {
    expect(reference.font).toBe("Roboto");
    expect(reference.motion).toBe(false);
    expect(reference.primary).toBe("#2459ed");
    expect(reference.type_scale).toBe(1);
    expect({ height: reference.height, width: reference.width }).toEqual(
      reference.orientation === "landscape"
        ? { height: 1080, width: 1920 }
        : { height: 1920, width: 1080 }
    );
    const key = `${reference.slide_id}:${reference.variant}`;
    const combination = `${reference.mode}:${reference.orientation}`;
    const combinations = variants.get(key) ?? new Set<string>();
    combinations.add(combination);
    variants.set(key, combinations);
  }
  expect(variants.size).toBe(23);
  const exactCombinations = new Set([
    "glass:landscape",
    "glass:portrait",
    "royal:landscape",
    "royal:portrait"
  ]);
  for (const combinations of variants.values()) {
    expect(combinations).toEqual(exactCombinations);
  }
}

function isRuntimeKind(value: string): value is RuntimeKind {
  return (runtimeKinds as readonly string[]).includes(value);
}

function encodePayload(payload: unknown) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sse(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}
