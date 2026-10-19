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

describe("complete readable Engage pages",()=>{
 it.each([2,12,13,24])("renders every option once across all pages with the campaign-wide denominator (%i choices)",count=>{
  const options=Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:`Keuze ${i+1}`,votes:1}));
  const slide=syncSlidePresentationSchema.parse({...base(),family:"engage",poll:{id:"26200000-0000-4000-8000-000000000100",title:"Welke activiteit?",status:"live",visibility:"live",optionsPerPage:4,options}});
  const pages=syncSlidePages(slide),seen:string[]=[];
  for(let page=0;page<pages;page++){
   const html=render(slide,page),ids=[...html.matchAll(/data-option-id="([^"]+)"/g)].map(x=>x[1]!);
   expect(ids).toEqual(options.slice(page*4,(page+1)*4).map(x=>x.id));seen.push(...ids);
   expect(html).toContain(`${count} stemmen`);
   expect(html).toContain(`${Math.round(100/count)}%`);
   if(pages>1)expect(html).toContain(`aria-label="Pagina ${page+1} van ${pages}"`);
  }
  expect(seen).toEqual(options.map(x=>x.id));
  expect(render(slide,-1)).toContain(options.at(-1)!.id);
  expect(render(slide,pages)).toContain(options[0]!.id);
 });
 it("never displays hidden totals, percentages or per-option counts on any page",()=>{
  for(const visibility of["after_vote","after_close"]){
   const options=Array.from({length:24},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:`Keuze ${i+1}`,votes:0}));
   const slide=syncSlidePresentationSchema.parse({...base(),family:"engage",poll:{id:"26200000-0000-4000-8000-000000000100",title:"Welke activiteit?",status:"live",visibility,optionsPerPage:4,options}});
   for(let page=0;page<syncSlidePages(slide);page++){
    const html=render(slide,page);
    expect(html).not.toMatch(/[0-9]+%<|[0-9]+ stemmen/);
    expect(html).toContain(visibility==="after_vote"?"Resultaten zichtbaar op je telefoon":"De uitslag verschijnt zodra de stemming sluit.");
   }
  }
 });
});

it("keeps the compact portrait layout exclusive to marked polls and uses the explicit long-question boundary",()=>{
 const options=Array.from({length:4},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:"Z".repeat(160),votes:1}));
 const poll={id:"26200000-0000-4000-8000-000000000100",title:"W".repeat(160),status:"live",visibility:"live",options};
 const legacy=render({family:"engage",orientation:"portrait",poll});
 expect(legacy).not.toContain("is-engage-paged");expect(legacy).not.toContain("has-long-question");
 const marked=render({family:"engage",orientation:"portrait",poll:{...poll,optionsPerPage:4}});
 expect(marked).toContain("is-engage-paged");expect(marked).toContain("has-long-question");expect(marked).toContain(`<h2>${poll.title}</h2>`);expect(marked.match(/Z{160}/g)).toHaveLength(4);
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(24),optionsPerPage:4}})).not.toContain("has-medium-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(25),optionsPerPage:4}})).toContain("has-medium-question");
 const medium=render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(80),optionsPerPage:4}});expect(medium).toContain("has-medium-question");expect(medium).not.toContain("has-long-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(81),optionsPerPage:4}})).toContain("has-long-question");
});

it.each([13,14,15])("keeps metadata after every last-page answer in the explicit two-column grid (%i answers)",count=>{
 const options=Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:`Keuze ${i+1}`,votes:1}));
 const poll={id:"26200000-0000-4000-8000-000000000100",title:"W".repeat(160),status:"live",visibility:"live",optionsPerPage:4,options};
 const html=render({family:"engage",poll},Math.ceil(count/4)-1);
 expect(html).toContain(`--engage-meta-row:${Math.ceil((count%4)/2)+1}`);
 expect(html.indexOf(`data-option-id="${options.at(-1)!.id}"`)).toBeLessThan(html.indexOf('class="vc-engage-total"'));
 expect(html.indexOf('class="vc-engage-total"')).toBeLessThan(html.indexOf('class="vc-engage-pages"'));
});

it("gives only explicitly marked wide short questions their portrait variant",()=>{
 const options=Array.from({length:4},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:"Z".repeat(160),votes:1}));
 const poll={id:"26200000-0000-4000-8000-000000000100",title:"W".repeat(24),status:"live",visibility:"live",options};
 expect(render({family:"engage",orientation:"portrait",poll})).not.toContain("has-wide-short-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,optionsPerPage:4}})).toContain("has-wide-short-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(16),optionsPerPage:4}})).not.toContain("has-wide-short-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"W".repeat(17),optionsPerPage:4}})).toContain("has-wide-short-question");
 expect(render({family:"engage",orientation:"portrait",poll:{...poll,title:"Wie was de uitblinker?",optionsPerPage:4}})).not.toContain("has-wide-short-question");
});
