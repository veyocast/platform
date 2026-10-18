import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("LG Legacy Player heeft een leesbaar semantisch statusscherm", async ({
  page
}) => {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INSTALLATION_API_UNAVAILABLE"
        }
      })
    });
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.getByRole("main")).toHaveAttribute(
    "aria-label",
    "VeyoCast afspeeloppervlak"
  );
  await expect(page.getByRole("heading", { name: /Dit scherm wacht even\.|Je verhaal komt tot leven\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opnieuw proberen", exact: true })).toBeVisible();
  await expect(page.locator("#status")).toHaveAttribute("aria-live", "polite");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
  test(`LG tijdelijke koppeling behoudt Source-geometrie op ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/player/installation", route => route.fulfill({
      json: { bound: false, installationCredential: "i".repeat(43), live: true, ok: true }
    }));
    await page.route("**/api/player/pairing", route => route.fulfill({
      json: { deviceToken: "p".repeat(43), pairingCode: "ABC 123", expiresAt: new Date(Date.now() + 120000).toISOString(), live: true }
    }));
    await page.route("**/api/player/heartbeat", route => route.fulfill({
      status: 409, json: { error: { code: "PAIRING_PENDING" } }
    }));
    await page.goto(`${playerURL}/lg/legacy`);
    await expect(page.getByRole("heading", { name: "Geef dit scherm een verhaal.", exact: true })).toBeVisible();
    await expect(page.getByLabel("Pairingcode", { exact: true })).toHaveText("ABC 123");
    await expect(page.locator("#pairing-expiry")).toContainText("Code geldig tot");
    await page.evaluate(async () => { await document.fonts.ready; });
    const measured = await page.locator("#status .px-splash-hero").evaluate(element => {
      const box = element.getBoundingClientRect();
      const image = element.querySelector("img")!;
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        loaded: image.complete && image.naturalWidth > 0, fit: getComputedStyle(image).objectFit,
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
    });
    expect(measured.x).toBe(0);
    expect(measured.y).toBe(0);
    expect(measured.width).toBeCloseTo(viewport.width * (viewport.width > viewport.height ? .55 : 1), 1);
    expect(measured.height).toBeCloseTo(viewport.height * (viewport.width > viewport.height ? 1 : .51), 1);
    expect(measured.loaded).toBe(true);
    expect(measured.fit).toBe("contain");
    expect(measured.overflow).toBe(0);
    const codeStyle = await page.getByLabel("Pairingcode", { exact: true }).evaluate(element => {
      const style = getComputedStyle(element);
      return { fontSize: parseFloat(style.fontSize), borderWidth: parseFloat(style.borderTopWidth),
        paddingLeft: parseFloat(style.paddingLeft), suffixWeight: getComputedStyle(element.querySelector("b")!).fontWeight };
    });
    expect(codeStyle.fontSize).toBeCloseTo(viewport.width * (viewport.width > viewport.height ? .03 : .07), 1);
    expect(codeStyle.borderWidth).toBe(1);
    expect(codeStyle.paddingLeft).toBeCloseTo(viewport.width * (viewport.width > viewport.height ? .018 : .05), 1);
    expect(codeStyle.suffixWeight).toBe("700");
  });
}

test("LG toont de eerste werkelijke download en verificatie vóór zichtbare activatie", async ({ page }) => {
  const image = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#147a6d"/></svg>';
  const bytes = Buffer.byteLength(image);
  const checksum = createHash("sha256").update(image).digest("hex");
  const id = (n: number) => `23000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let releaseDownload!: () => void;
  const downloadHeld = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.addInitScript(({ bytes }) => {
    localStorage.setItem("veyocast.player.deviceToken", "d".repeat(48));
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let held = false;
    Object.defineProperty(crypto.subtle, "digest", { configurable: true, value: (algorithm: AlgorithmIdentifier, input: BufferSource) => {
      if (input.byteLength !== bytes || held) return digest(algorithm, input);
      held = true;
      return new Promise<ArrayBuffer>((resolve, reject) => {
        (window as Window & { releaseStatusVerification?: () => void }).releaseStatusVerification = () => { void digest(algorithm, input).then(resolve, reject); };
      });
    } });
  }, { bytes });
  await page.route("**/api/player/installation", route => route.fulfill({
    json: { bound: true, installationCredential: "i".repeat(48), ok: true }
  }));
  await page.route("**/api/player/heartbeat", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/player/releases/*/ack", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/player/commands*", route => route.fulfill({ json: { commands: [] } }));
  await page.route("**/api/player/goal-events*", route => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/player/manifest*", route => route.fulfill({ json: {
    state: "PLAYING", fetchedAt: new Date().toISOString(),
    target: { revision: "1", publicationId: id(900), configRevision: "1", assignmentSource: "default", committedAt: new Date().toISOString() },
    device: { id: id(100), screenId: id(200), screenName: "Eigen LG-statusfixture", activeReleaseId: id(1), desiredReleaseId: id(1) },
    manifest: { schemaVersion: 1, tenantId: id(300), playlistId: id(10), releaseId: id(1), version: 1, label: "Eerste veilige publicatie", manifestHash: checksum,
      publishedAt: new Date().toISOString(), totalDurationSeconds: 12, totalBytes: bytes,
      items: [{ id: id(20), kind: "image", title: "Eigen lokaal beeld", durationSeconds: 12, fitMode: "contain", muted: true,
        source: { url: "/__lg-status/first.svg", bytes, mimeType: "image/svg+xml", checksumSha256: checksum } }] },
    diagnostics: { syncStatus: "online", lastSuccessfulSyncAt: new Date().toISOString(), nextSyncReason: "controlled first-release acceptance" }
  } }));
  await page.route("**/__lg-status/first.svg", async route => { await downloadHeld; await route.fulfill({ contentType: "image/svg+xml", body: image }); });
  await page.goto(`${playerURL}/lg/legacy`);
  await expect(page.locator("#status")).toHaveAttribute("data-stage", "download");
  await expect(page.getByRole("heading", { name: "We zetten alles klaar.", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Publicatie voorbereiden", exact: true })).not.toHaveAttribute("aria-valuenow");
  releaseDownload();
  await expect(page.locator("#status")).toHaveAttribute("data-stage", "verify");
  await expect(page.getByRole("heading", { name: "Nog één laatste controle.", exact: true })).toBeVisible();
  await expect(page.locator("#media-root > img.visible")).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { releaseStatusVerification?: () => void }).releaseStatusVerification?.(); });
  await expect(page.locator("#media-root > img.visible")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#status")).toBeHidden();
});
