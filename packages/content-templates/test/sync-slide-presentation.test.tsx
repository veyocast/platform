import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  syncContentFamilies,
  syncSlidePresentationSchema,
  syncSlideRendererVersion,
  syncSlideSourceRevision,
} from "@veyocast/contracts";
import {
  SyncSlideStaticView,
  syncSlidePages,
} from "../src/sync-slide-static-view";

const base = () =>
  syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: syncSlideRendererVersion,
    sourceRevision: syncSlideSourceRevision,
    family: "fixtures",
    orientation: "landscape",
    theme: "fieldflow",
    name: "Eigen programma",
    title: "Vandaag op het veld",
    club: { name: "Club A", tagline: "Samen spelen" },
    style: {},
  });
it('keeps an RSS QR inside a linked preview without nested anchors or a second navigation target',()=>{
 const presentation=syncSlidePresentationSchema.parse({...base(),family:'rss',news:[{title:'Eigen artikel',intro:'Eigen tekst',source:'Eigen bron',url:'https://example.invalid/own-article'}]});
 const markup=renderToStaticMarkup(<a href="/owned-preview"><SyncSlideStaticView presentation={presentation}/></a>);
 expect(markup.match(/<a\b/g)).toHaveLength(1);expect(markup).toContain('role="img"');expect(markup).toContain('class="sync-qr-svg"');expect(markup).not.toContain('href="https://example.invalid');
});
const render = (change: Record<string, unknown> = {}, page = 0) =>
  renderToStaticMarkup(
    <SyncSlideStaticView
      presentation={syncSlidePresentationSchema.parse({ ...base(), ...change })}
      page={page}
      includeStyles={false}
    />,
  );
describe("Source renderer with actual content", () => {
  it("renders every family with validated data and preserves orientation/theme classes", () => {
    for (const family of syncContentFamilies)
      for (const orientation of ["landscape", "portrait"])
        for (const theme of ["fieldflow", "onzetrots-tv"]) {
          const html = render({
            family: family.id,
            orientation,
            theme,
            rows: [["1", "Club A", "6", "16"]],
            home: { name: "Club A" },
            away: { name: "Club B" },
            lineup: [[9], [1]],
            news: [
              {
                title: "Echt nieuws",
                intro: "Uit de opgeslagen bron",
                source: "Club A",
              },
            ],
          });
          expect(html).toContain(
            orientation === "portrait" ? "is-portrait" : "vc-slide-preview",
          );
          expect(html).toContain(
            theme === "fieldflow" ? "is-fieldflow" : "is-trots",
          );
          expect(html).not.toMatch(
            /Duindorp|Houtrust|1950|HEREN 1|€ 2,20|Marco de Groot|Lokale demo/,
          );
        }
  });
  it("shows an honest empty state instead of invented matches, prices or people", () => {
    for (const family of [
      "fixtures",
      "menu",
      "volunteers",
      "standings",
      "scoreboard",
      "lineup",
      "rss",
    ])
      expect(render({ family })).toContain("NOG GEEN GEGEVENS.");
    expect(render({ family: "cancellations" })).toContain("NOG GEEN GEGEVENS.");
    expect(render({ family: "cancellations", state: "empty" })).toContain(
      "ALLES GAAT DOOR.",
    );
    expect(render({ state: "error" })).toContain("BRON NIET BESCHIKBAAR");
  });
  it("escapes authored text and uses only an uploaded club logo", () => {
    const html = render({
      title: "<img onerror=bad()>",
      rows: [["Club A", "Club B", "11:00", "2"]],
    });
    expect(html).toContain("&lt;img onerror=bad()&gt;");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain('class="vc-mini-crest">CA</span>');
  });
  it("paginates source rows and wraps negative or oversized page positions", () => {
    const slide = {
      ...base(),
      rows: Array.from(
        { length: 9 },
        (_, index): [string, string, string, string] => [
          `Thuis ${index}`,
          "Club B",
          "11:00",
          "2",
        ],
      ),
    };
    expect(syncSlidePages(slide)).toBe(3);
    expect(render(slide, 2)).toContain("Thuis 8");
    expect(render(slide, 2)).not.toContain("Thuis 0");
    expect(render(slide, -1)).toContain("Thuis 8");
    expect(render(slide, 3)).toContain("Thuis 0");
  });
  it("highlights only explicitly marked rows, never a club-name substring", () => {
    const rows = [
      ["1", "Club A", "6", "16"],
      ["2", "Club A reserves", "6", "15"],
    ];
    const html = render({ family: "standings", rows, ownRowIndexes: [1] });
    expect(html.match(/vc-stand-row our-team/g)).toHaveLength(1);
  });
  it("renders actual special prices and safe QR geometry without external navigation", () => {
    const html = render({
      family: "rss",
      news: [
        {
          title: "Nieuws",
          intro: "Lees meer",
          source: "Club A",
          url: "https://example.org/nieuws/1",
        },
      ],
    });
    expect(html).toContain('class="sync-qr-svg"');
    expect(html).not.toMatch(/href=|data:image|<script/);
    const menu = render({
      family: "menu",
      rows: [["Koffie", "€ 2,35", "", ""]],
      special: { label: "Vandaag", title: "Koffie", priceCents: 235 },
    });
    expect(menu).toContain("2,35");
    expect(menu).not.toContain("2,20");
  });
});
