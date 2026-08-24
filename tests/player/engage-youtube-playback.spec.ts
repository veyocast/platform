import { expect, test, type Page } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const publicId = "11111111-1111-4111-8111-111111111111";

async function demoRelease(page: Page) {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  return await response.json() as PlayerManifestEnvelope;
}

test("toont een live Engage-scherm en behoudt de laatste projection bij netwerkverlies", async ({ context, page }) => {
  const release = await demoRelease(page);
  release.manifest.items = [{
    ...release.manifest.items[0]!,
    durationSeconds: 60,
    onlinePlayback: {
      kind: "engage",
      publicId,
      question: "Wie was vandaag de uitblinker?",
      title: "Man van de wedstrijd"
    }
  }];
  await page.route("**/api/player/manifest**", (route) => route.fulfill({ body: JSON.stringify(release), contentType: "application/json" }));
  await page.route(`**/api/player/engage/${publicId}`, (route) => route.fulfill({
    body: JSON.stringify({
      closesAt: null,
      id: publicId,
      kind: "motm",
      options: [
        { id: "22222222-2222-4222-8222-222222222222", label: "Speler 1", sortOrder: 0, voteCount: 4 },
        { id: "33333333-3333-4333-8333-333333333333", label: "Speler 2", sortOrder: 1, voteCount: 7 }
      ],
      privacyNotice: "Er worden geen namen of ruwe IP-adressen opgeslagen.",
      question: "Wie was vandaag de uitblinker?",
      resultVisibility: "live",
      resultsVisible: true,
      status: "live",
      tenantName: "VeyoCast testvereniging",
      title: "Man van de wedstrijd",
      totalVotes: 11
    }),
    contentType: "application/json"
  }));
  await page.route(`**/api/player/engage/${publicId}/qr`, (route) => route.fulfill({
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="white"/><path d="M40 40h240v240H40zM360 40h240v240H360zM40 360h240v240H40z" fill="black"/></svg>',
    contentType: "image/svg+xml"
  }));

  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  await expect(page.getByRole("heading", { name: "Wie was vandaag de uitblinker?" })).toBeVisible();
  await expect(page.getByText("Speler 2", { exact: true })).toBeVisible();
  await expect(page.getByText("11 geldige stemmen", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR-code voor Man van de wedstrijd" })).toBeVisible();
  await context.setOffline(true);
  try {
    await expect(page.getByRole("heading", { name: "Wie was vandaag de uitblinker?" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("gebruikt uitsluitend de officiële privacy-enhanced YouTube iframegrens", async ({ page }) => {
  const release = await demoRelease(page);
  release.manifest.items = [{
    ...release.manifest.items[0]!,
    durationSeconds: 60,
    onlinePlayback: {
      kind: "youtube",
      privacyEnhanced: true,
      title: "Clubvideo",
      videoId: "dQw4w9WgXcQ"
    }
  }];
  await page.route("**/api/player/manifest**", (route) => route.fulfill({ body: JSON.stringify(release), contentType: "application/json" }));
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
    body: `window.YT={PlayerState:{ENDED:0,PLAYING:1},Player:function(element,options){var frame=document.createElement('iframe');frame.title=options.videoId;frame.src='https://www.youtube-nocookie.com/embed/'+options.videoId;element.replaceChildren(frame);this.destroy=function(){};setTimeout(function(){options.events.onReady({target:{mute:function(){},playVideo:function(){}}});options.events.onStateChange({data:1});},0);}};window.onYouTubeIframeAPIReady();`,
    contentType: "application/javascript"
  }));
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ body: "<!doctype html><title>official iframe</title>", contentType: "text/html" }));

  const response = await page.goto(`${playerURL}/?deviceToken=demo-online`);
  expect(response?.headers()["content-security-policy"]).toContain("frame-src https://www.youtube-nocookie.com");
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self' 'unsafe-inline' https://www.youtube.com");
  const frame = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]');
  await expect(frame).toBeVisible();
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(0);
});
