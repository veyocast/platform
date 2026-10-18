import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { mediaFrameBackgroundStyle } from "../../packages/content-templates/src/media-frame-background";

// Actual component and CSS; the server's pinned identity/byte projection is
// exercised by publish-media-frame-preview.server.test.ts, without mock claims.
const origin = "http://127.0.0.1:3375", require = createRequire(join(process.cwd(), "package.json"));
let bundle: string;
test.beforeAll(() => {
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PlaylistPreview}from'./apps/control/app/(shell)/dashboard/playlists/playlist-preview';function App(){const[items,setItems]=useState(globalThis.fixtureItems);globalThis.replaceItems=setItems;return <main><h1>Eigen vaste publicatie</h1><PlaylistPreview items={items}/></main>}createRoot(document.getElementById('root')).render(<App/>);`;
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic'});process.stdout.write(result.outputFiles[0].text);`;
  bundle = execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
});

test("publication preview displays frozen private background/focus and suppresses cleared or solid placement overrides", async ({ page }) => {
  const errors: string[] = []; let backgroundRequests = 0;
  page.on("pageerror", error => errors.push(error.message));
  const sourceStyle = mediaFrameBackgroundStyle({ schemaVersion: 1, themeId: "fieldflow", accentColor: "#123332", background: { kind: "image", mediaAssetId: "19170000-0000-4000-8000-000000000031", checksumSha256: "b".repeat(64), position: "right" } }, { image: origin + "/frozen-background.svg" })!;
  const item = { id: "own-image", kind: "image", title: "Vast beeld", durationSeconds: 901, fitMode: "contain", muted: true, enabled: true, url: origin + "/frozen-main.svg", mediaFrameStyle: { ...sourceStyle, objectFit: "contain", objectPosition: "100% 50%" } };
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/frozen-*.svg`, route => { if (route.request().url().includes("background")) backgroundRequests++; return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="160" height="180" fill="#228866"/></svg>' }); });
  await page.route(`${origin}/fixture`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publicatievoorbeeld</title><style>${css}</style></head><body><div id="root"></div><script>globalThis.fixtureItems=${JSON.stringify([item])};${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/fixture`); const image = page.getByRole("img", { name: "Voorbeeld van Vast beeld", exact: true });
  await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true); await expect.poll(() => backgroundRequests).toBe(1);
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); await expect(image).toHaveCSS("object-fit", "contain"); await expect(image).toHaveCSS("object-position", "100% 50%"); await expect(image).toHaveCSS("background-image", /frozen-background\.svg/); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  for (const color of ["var(--vc-brand-ink-black)", "#ffffff"]) {
    await page.evaluate(value => Reflect.get(globalThis, "replaceItems")([value]), { ...item, mediaFrameStyle: { background: color, objectFit: "contain", objectPosition: "100% 50%" } }); await expect(image).toHaveCSS("background-image", "none"); expect(backgroundRequests).toBe(1);
  }
  await page.evaluate(value => Reflect.get(globalThis, "replaceItems")([value]), { ...item, mediaFrameStyle: undefined }); await expect.poll(() => image.evaluate(element => (element as HTMLElement).style.cssText)).toBe(""); expect(errors).toEqual([]);
});
