import { chromium } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(repositoryRoot, "docs", "screenshots");
const origin = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");

const homepageViewports = [
  { height: 1_000, name: "1440", width: 1_440 },
  { height: 900, name: "1024", width: 1_024 },
  { height: 900, name: "768", width: 768 },
  { height: 900, name: "430", width: 430 },
  { height: 844, name: "390", width: 390 }
];

const templateCaptures = [
  { name: "product", pathname: "/product" },
  { name: "sector", pathname: "/oplossingen/sportverenigingen" },
  { name: "article", pathname: "/kennisbank/wat-is-narrowcasting" },
  { name: "pricing", pathname: "/prijzen" },
  { name: "demo", pathname: "/demo" }
];

async function settlePage(page, { scroll = false } = {}) {
  await page.waitForLoadState("load");

  if (scroll) {
    await page.evaluate(async () => {
      const step = Math.max(360, Math.floor(window.innerHeight * 0.75));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo({ behavior: "instant", top: y });
        await new Promise((resolve) => window.setTimeout(resolve, 90));
      }
      window.scrollTo({ behavior: "instant", top: 0 });
    });
  }

  await page.evaluate(async () => {
    const imageReady = Promise.all(
      [...document.images].map(
        (image) =>
          image.decode?.().catch(() => undefined) ?? Promise.resolve()
      )
    );
    await Promise.race([
      imageReady,
      new Promise((resolve) => window.setTimeout(resolve, 2_500))
    ]);
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of homepageViewports) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: viewport.height, width: viewport.width }
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await settlePage(page, { scroll: true });
    await page.screenshot({
      fullPage: true,
      path: join(
        outputDirectory,
        `marketing-s38-home-${viewport.name}.png`
      )
    });
    await page.close();
  }

  for (const capture of templateCaptures) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: 1_000, width: 1_440 }
    });
    await page.goto(`${origin}${capture.pathname}`, {
      waitUntil: "domcontentloaded"
    });
    await settlePage(page);
    await page.screenshot({
      path: join(
        outputDirectory,
        `marketing-s38-${capture.name}-1440.png`
      )
    });
    await page.close();
  }
} finally {
  await browser.close();
}
