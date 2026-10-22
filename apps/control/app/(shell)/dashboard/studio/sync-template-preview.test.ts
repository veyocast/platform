import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  syncContentFamilies,
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncSlideSourceRevision,
  type SyncContentFamily,
} from "@veyocast/contracts";
import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { createSyncStudioStarter } from "@veyocast/studio";
import { createSyncTemplatePreview as createCurrentSyncTemplatePreview } from "./sync-template-preview";

const referenceRoot = new URL("../../../../../../docs/sync-v1-rebuild/handoff/", import.meta.url);
const sourceBytes = readFileSync(new URL("reference/sites-sync/src/modules/Content.tsx", referenceRoot));
const source = sourceBytes.toString("utf8");
const manifest = JSON.parse(readFileSync(new URL("manifests/sites-files.json", referenceRoot), "utf8")) as {
  files: Array<{ path: string; sha256: string }>;
};
function section(start: string, end: string) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  if (from < 0 || to < from) throw Error("The immutable Source preview boundary changed.");
  return source.slice(from, to);
}

// Test-only extraction of the immutable functions, not a second expected-data copy.
// No Source App/store is imported into production or connected to a real service.
const sourceProgram = [
  section("const families = [", "const clone="),
  "const clone=(value)=>structuredClone(value);",
  section("const fixtureSamples=[", "function ContentMedia("),
  section("const familyAliases:", "function Crest("),
  section("function Crest(", "/** Shared deterministic preview"),
  section("export function SlidePreview(", "export function ContentPage("),
  `export const sourceDefaults=defaults;
  export function sourceRows(item){const page=0,compact=true;
    ${section("  const app=useApp();", "  const fixtureRows=")}
    return rows;
  }`,
].join("\n");
const icon = () => React.createElement("svg");
const sourceModule = { exports: {} };
runInNewContext(ts.transpileModule(sourceProgram, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: sourceModule.exports,
  React,
  structuredClone,
  crypto: { randomUUID: () => "reference-only" },
  useApp: () => ({ data: { products: [], polls: [], settings: {} } }),
  Radio: icon, ArrowRight: icon, Play: icon, Film: icon, FileImage: icon,
  QRCode: icon,
}, { timeout: 1_000 });
const reference = sourceModule.exports as {
  sourceDefaults: (family: SyncContentFamily) => {
    title: string;
    settings: {
      body: string; subtitle: string; accent: string; font: string; background: string;
      news?: Array<{ title: string; intro: string; url: string }>;
    };
  };
  sourceRows: (item: unknown) => Array<Array<string | number>> | undefined;
  SlidePreview: React.ComponentType<{ item: unknown; compact: boolean; page: number }>;
};
const text = (value: string) => value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map(match => text(match[1]!));

describe("Chosen Source template layout examples", () => {
  it("uses the unchanged chosen Source as its independent reference", () => {
    const entry = manifest.files.find(file => file.path === "reference/sites-sync/src/modules/Content.tsx");
    expect(createHash("sha256").update(sourceBytes).digest("hex")).toBe(entry?.sha256);
    expect(syncContentFamilies).toHaveLength(36);
  });

  it.each(syncContentFamilies)("keeps $id filled with its Source layout and canonical identity", ({ id }) => {
    const preview = createSyncTemplatePreview(id), original = reference.sourceDefaults(id);
    expect(syncSlidePresentationSchema.parse(preview)).toEqual(preview);
    expect(preview.sourceRevision).toBe(syncSlideSourceRevision);
    expect(preview.theme).toBe("onzetrots-tv");
    expect(preview.orientation).toBe("landscape");
    expect(preview.name).toBe(original.title);
    expect(preview.body).toBe(original.settings.body);
    expect(preview.subtitle).toBe(original.settings.subtitle);
    expect(preview.style).toMatchObject({
      background: original.settings.background,
      font: original.settings.font,
      accent: original.settings.accent,
      fontChanged: false,
      scale: 100, alignment: "left", safeMargin: 5, showLogo: true, showFooter: true,
    });
    const rows = reference.sourceRows(original);
    if (rows) expect(preview.rows).toEqual(rows.map(row => [0, 1, 2, 3].map(index => String(row[index] ?? ""))));
    expect(preview.news).toEqual((original.settings.news ?? []).map(article => ({ ...article, source: original.settings.subtitle })));

    const expected = renderToStaticMarkup(React.createElement(reference.SlidePreview, { item: original, compact: true, page: 0 }));
    const actual = renderToStaticMarkup(React.createElement(SyncSlideStaticView, { presentation: preview, compact: true, includeStyles: false }));
    expect(headings(actual)).toEqual(headings(expected));
    expect(actual).toContain("is-trots");
    expect(actual).toContain("bg-stadium");
    expect(actual).not.toContain("NOG GEEN GEGEVENS.");
    for (const feature of ["vc-fixture", "vc-stand-row", "vc-person-grid", "vc-menu-row", "vc-menu-special", "vc-pitch-row", "vc-agenda-rows", "vc-partner-grid", "vc-news-copy", "vc-welcome-content", "vc-video-stage", "vc-match-stage", "vc-engage-empty"]) {
      const count = (html: string) => [...html.matchAll(/class="([^"]+)"/g)].filter(match => match[1]!.split(" ").includes(feature)).length;
      expect(count(actual), feature).toBe(count(expected));
    }
  });

  it("retains source-specific selection, room, score, people, menu, lineup and article examples", () => {
    expect(createSyncTemplatePreview("team-program").rows).toHaveLength(3);
    expect(createSyncTemplatePreview("fixtures").rows).toHaveLength(8);
    expect(createSyncTemplatePreview("cancellations").rows).toHaveLength(3);
    expect(createSyncTemplatePreview("dressing-rooms").rows[0]?.[3]).toBe("4");
    expect(createSyncTemplatePreview("results").rows[0]?.[2]).toBe("3 – 1");
    expect(createSyncTemplatePreview("team-info").rows[0]).toEqual(["Sam de Vries", "Aanvoerder · middenveld", "", ""]);
    expect(createSyncTemplatePreview("menu").rows[0]).toEqual(["Broodje kroket", "€ 3,50", "", ""]);
    expect(createSyncTemplatePreview("menu").special?.priceCents).toBe(220);
    expect(createSyncTemplatePreview("lineup").lineup.flat()).toHaveLength(11);
    expect(createSyncTemplatePreview("period-standings").rows[0]).toEqual(["1", "SV Loosduinen", "3", "9"]);
    const rss = createSyncTemplatePreview("rss");
    expect(rss.news).toHaveLength(6);
    expect(rss.news[5]?.title).toBe("Blauw en wit, op én naast het veld");
    expect(new Set(rss.news.map(article => article.url))).toEqual(new Set(["https://www.duindorpsv.nl/"]));
    expect(createSyncTemplatePreview("engage").poll).toBeUndefined();
  });

  it("never adds IDs, tenant media or external assets and cannot change real empty starts", () => {
    const before = syncContentFamilies.map(({ id }) => createSyncStudioStarter({ family: id, tenantName: "Mijn eigen vereniging" }));
    for (const { id } of syncContentFamilies) {
      const preview = createSyncTemplatePreview(id);
      expect(syncSlideAssets(preview)).toEqual([]);
      expect(JSON.stringify(preview)).not.toMatch(/"(?:id|mediaAssetId|idempotencyKey|tenantId|urlToken)":|sb_secret_|[?&]token=|https?:\/\/[^" ]+\.(?:png|webp|jpg|mp4)/);
    }
    const after = syncContentFamilies.map(({ id }) => createSyncStudioStarter({ family: id, tenantName: "Mijn eigen vereniging" }));
    expect(after).toEqual(before);
    for (const document of after) {
      const start = document.syncPresentation!;
      expect(start.theme).toBe("fieldflow");
      expect(start.club.name).toBe("Mijn eigen vereniging");
      expect(start.rows).toEqual([]);
      expect(start.news).toEqual([]);
      expect(start.lineup).toEqual([]);
      expect(start.home).toBeUndefined();
      expect(start.away).toBeUndefined();
      expect(start.poll).toBeUndefined();
      expect(start.special).toBeUndefined();
      expect(JSON.stringify(document)).not.toMatch(/Duindorp|Houtrust|Sanne|Marco|Broodje|1950/);
    }
  });

  it("returns independent examples without leaking edits to later cards", () => {
    const first = createSyncTemplatePreview("fixtures");
    first.rows[0]![0] = "Changed card";
    first.style.font = "Arial";
    expect(createSyncTemplatePreview("fixtures").rows[0]?.[0]).toBe("Duindorp SV JO13-1");
    expect(createSyncTemplatePreview("fixtures").style.font).toBe("Inter");
  });
});

// Frozen legacy Source fixture parity remains explicit after the additive new
// default catalogue. The approved catalogue has its own 144-combination tests.
function createSyncTemplatePreview(family:SyncContentFamily){return createCurrentSyncTemplatePreview(family,'sync-v1');}
