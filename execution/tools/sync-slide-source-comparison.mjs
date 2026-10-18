import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
if (process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE !== "1")
  throw Error("Set the explicit isolated S226 acceptance gate");
if (realpathSync(root) !== "/home/codex/repos/castivo-s226")
  throw Error("Only the isolated S226 worktree is allowed");
const referenceRoot = "/tmp/veyocast-s226-sync-reference";
const referenceOrigin = "http://127.0.0.1:3230";
const source = join(
  root,
  "docs/sync-v1-rebuild/handoff/reference/sites-sync/src",
);
for (const name of [
  "modules/Content.tsx",
  "modules/content.css",
  "styles.css",
]) {
  if (
    !readFileSync(join(source, name)).equals(
      readFileSync(join(referenceRoot, "src", name)),
    )
  )
    throw Error(`Mutable Source reference: ${name}`);
}
const require = createRequire(join(root, "package.json"));
const { chromium } = require("@playwright/test");
const compiler = require.resolve("esbuild", {
  paths: [require.resolve("tsx")],
});
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{SyncSlideStaticView}from'./packages/content-templates/src/sync-slide-static-view';globalThis.mountSlide=(presentation,page)=>createRoot(document.getElementById('root')).render(React.createElement(SyncSlideStaticView,{presentation,page}));`;
const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:${JSON.stringify(root)},loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[${JSON.stringify(join(root, "apps/control/node_modules"))}]});process.stdout.write(result.outputFiles[0].text);`;
const bundle = execFileSync(
  process.execPath,
  [
    "-e",
    `(async()=>{${code}})().catch(e=>{console.error(e.message);process.exitCode=1})`,
  ],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
const familyFile = readFileSync(
  join(root, "packages/contracts/src/sync-content-families.ts"),
  "utf8",
);
const families = [...familyFile.matchAll(/id:\s*["']([^"']+)["']/g)].map(
  (match) => match[1],
);
if (families.length !== 36)
  throw Error("The Source family inventory is incomplete");
const browser = await chromium.launch({ headless: true });
writeFileSync(
  join(referenceRoot, "sync-slide-reference.tsx"),
  "// S226 comparison entry; immutable Source files are untouched.\nimport React from 'react';import{createRoot}from'react-dom/client';import{SlidePreview}from'./src/modules/Content';globalThis.mountSource=(item,page)=>createRoot(document.getElementById('root')).render(React.createElement(SlidePreview,{item,page}));\n",
);
const results = [],
  evidence = join(root, "execution/evidence/sync-slide-source-comparison.json");
const inspect = async (page) =>
  page.evaluate(() => {
    const slide = document.querySelector(".vc-slide-preview"),
      base = slide.getBoundingClientRect();
    const selectors = [
      ".vc-slide-safe",
      ".vc-slide-top",
      ".vc-slide-brand",
      ".vc-slide-top-meta",
      ".vc-slide-content",
      ".vc-slide-eyebrow",
      ".vc-slide-content h2",
      ".vc-fixture",
      ".vc-stand-row",
      ".vc-menu-row",
      ".vc-person-grid>div",
      ".vc-partner-grid>div",
      ".vc-agenda-rows>div",
      ".vc-news-art",
      ".vc-news-copy",
      ".vc-match-stage",
      ".vc-welcome-content",
      ".vc-slide-footer",
    ];
    return Object.fromEntries(
      selectors.map((selector) => [
        selector,
        [...slide.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect(),
            style = getComputedStyle(element);
          return {
            x: rect.x - base.x,
            y: rect.y - base.y,
            width: rect.width,
            height: rect.height,
            font: style.fontFamily,
            size: style.fontSize,
            weight: style.fontWeight,
            lineHeight: style.lineHeight,
            spacing: style.letterSpacing,
          };
        }),
      ]),
    );
  });
try {
  for (const orientation of ["landscape", "portrait"])
    for (const theme of ["fieldflow", "onzetrots-tv"]) {
      const viewport =
        orientation === "portrait"
          ? { width: 1080, height: 1920 }
          : { width: 1920, height: 1080 };
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
      });
      context.setDefaultTimeout(15000);
      await context.route(`${referenceOrigin}/__sync-port`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html lang="nl"><head></head><body style="margin:0"><div id="root"></div><script>${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
        }),
      );
      await context.route(`${referenceOrigin}/__sync-source`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html lang="nl"><head><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/modules/content.css"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/sync-slide-reference.tsx');</script></body></html>`,
        }),
      );
      const actual = await context.newPage(),
        expected = await context.newPage();
      for (const page of [actual, expected])
        page.on("pageerror", (error) =>
          process.stderr.write(`Comparison browser: ${error.message}\n`),
        );
      for (const family of families) {
        const rows = [
          ["1", "Club A", "6", "16"],
          ["2", "Club B", "6", "15"],
          ["3", "Club C", "6", "12"],
          ["4", "Club D", "6", "10"],
        ];
        const settings = {
          title: "Onze informatie",
          headline: "VANDAAG OP DE CLUB",
          body: "Samen maken we de club.",
          subtitle: "De kantine",
          home: "Duindorp SV",
          away: "Club B",
          homeTeam: "HEREN 1",
          awayTeam: "HEREN 1",
          homeScore: "2",
          awayScore: "1",
          clock: "67:24",
          date: "ZONDAG 18 OKTOBER",
          time: "14:30",
          footer: "ONZE WIJK. ONZE CLUB. ONZE TROTS.",
          footerRight: "SINDS 1950",
          rows,
          category: "DE FAVORIETEN",
          rowsPerPage: 4,
          background: theme === "onzetrots-tv" ? "clubmuur" : "stadium",
          news: [
            {
              title: "Onze informatie",
              intro: "Samen maken we de club.",
              source: "Duindorp SV",
            },
          ],
        };
        const presentation = {
          schemaVersion: 1,
          rendererVersion: "sync-v1",
          sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
          family,
          orientation,
          theme,
          name: "Onze informatie",
          club: { name: "Duindorp SV", tagline: "ONZE CLUB. ONZE TROTS." },
          ...settings,
          home: { name: "Duindorp SV", team: "HEREN 1" },
          away: { name: "Club B", team: "HEREN 1" },
          match: {
            homeScore: "2",
            awayScore: "1",
            clock: "67:24",
            date: "ZONDAG 18 OKTOBER",
            time: "14:30",
          },
          lineup: [[9], [7, 10, 11], [6, 8], [2, 3, 4, 5], [1]],
          special: {
            label: "LEKKER LANGS DE LIJN",
            title: "Koffie & een goed verhaal.",
            priceCents: 220,
          },
          style: { background: settings.background },
        };
        // Source settings are a different transport. Do not leak their extra keys into the strict production contract.
        for (const key of [
          "homeTeam",
          "awayTeam",
          "homeScore",
          "awayScore",
          "clock",
          "date",
          "time",
          "background",
        ])
          delete presentation[key];
        await Promise.all([
          actual.goto(`${referenceOrigin}/__sync-port`),
          expected.goto(`${referenceOrigin}/__sync-source`),
        ]);
        await Promise.all([
          actual.waitForFunction(
            () => typeof globalThis.mountSlide === "function",
          ),
          expected.waitForFunction(
            () => typeof globalThis.mountSource === "function",
          ),
        ]);
        await Promise.all([
          actual.evaluate(
            (value) => globalThis.mountSlide(value, 0),
            presentation,
          ),
          expected.evaluate((item) => globalThis.mountSource(item, 0), {
            id: family,
            title: "Onze informatie",
            family,
            orientation,
            theme,
            settings,
          }),
        ]);
        await Promise.all([
          actual.locator(".vc-slide-preview").waitFor(),
          expected.locator(".vc-slide-preview").waitFor(),
        ]);
        for (const page of [actual, expected])
          await page.evaluate(async () => {
            await Promise.all([...document.fonts].map((font) => font.load()));
            await document.fonts.ready;
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
          });
        const [a, b] = await Promise.all([inspect(actual), inspect(expected)]),
          differences = [];
        for (const selector of Object.keys(b)) {
          if (a[selector].length !== b[selector].length) {
            differences.push({
              selector,
              actualCount: a[selector].length,
              sourceCount: b[selector].length,
            });
            continue;
          }
          for (let i = 0; i < b[selector].length; i++)
            for (const key of Object.keys(b[selector][i])) {
              const av = a[selector][i][key],
                bv = b[selector][i][key];
              if (typeof bv === "number" ? Math.abs(av - bv) > 0.15 : av !== bv)
                differences.push({
                  selector,
                  index: i,
                  key,
                  actual: av,
                  source: bv,
                });
            }
        }
        results.push({
          family,
          orientation,
          theme,
          status: differences.length ? "FAIL" : "PASS",
          differences,
        });
        if (family === "fixtures" && theme === "fieldflow")
          await actual.screenshot({
            path: join(
              root,
              `execution/evidence/sync-slide-${orientation}.png`,
            ),
          });
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(
    evidence,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
        scope:
          "144 actual Source/port geometry and typography comparisons. Generic initials replace fabricated club crests; QR pixel comparison and end-to-end publication are separate gates.",
        bundleSha256: createHash("sha256").update(bundle).digest("hex"),
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
const failed = results.filter((result) => result.status === "FAIL");
process.stdout.write(
  JSON.stringify({
    comparisons: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    evidence,
  }) + "\n",
);
if (failed.length) process.exitCode = 1;
