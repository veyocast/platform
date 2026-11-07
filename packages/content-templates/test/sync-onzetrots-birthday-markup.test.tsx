import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  syncOnzeTrotsRendererVersion,
  syncOnzeTrotsSourceRevision,
  syncOnzeTrotsV9RendererVersion,
  syncOnzeTrotsV9SourceRevision,
  syncSlidePageCount,
  syncSlidePresentationSchema,
  type SyncOnzeTrotsRich,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import { SyncSlideStaticView } from "../src/sync-slide-static-view";

const renderers = [
  { rendererVersion: syncOnzeTrotsRendererVersion, sourceRevision: syncOnzeTrotsSourceRevision },
  { rendererVersion: syncOnzeTrotsV9RendererVersion, sourceRevision: syncOnzeTrotsV9SourceRevision },
] as const;
type Renderer = (typeof renderers)[number];
type Birthday = NonNullable<SyncOnzeTrotsRich["birthdays"]>[number];

const person = (changes: Partial<Birthday> = {}): Birthday => ({
  id: "authorized-person",
  displayName: "Noor van Dijk",
  age: null,
  dateLabel: "7 nov",
  meta: "",
  ...changes,
});

const presentation = (renderer: Renderer, people: Birthday[]) =>
  syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    ...renderer,
    family: "birthdays",
    orientation: "landscape",
    theme: "onzetrots-tv",
    name: "Eigen verjaardagen",
    title: "Onze jarigen",
    club: { name: "Eigen club" },
    style: { motion: "rustig", showLogo: false },
    visual: { schemaVersion: 1, mode: "light" },
    rich: { birthdays: people },
  });

const render = (slide: SyncSlidePresentation, page = 0) =>
  renderToStaticMarkup(<SyncSlideStaticView presentation={slide} page={page} includeStyles={false}/>);
const cards = (html: string) =>
  html.match(/<article\b[^>]*class="[^"]*\bbirthday-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/g) ?? [];
const emptySlots = (html: string) =>
  html.match(/<div\b[^>]*data-empty-slot="\d+"[^>]*><\/div>/g) ?? [];
const headingText = (card: string) => {
  const heading = card.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/)?.[0];
  expect(heading, "Each real birthday card has one native accessible heading").toBeDefined();
  expect(card.match(/<h3\b/g)).toHaveLength(1);
  expect(heading).not.toMatch(/aria-hidden|aria-label|\bhidden(?:=|\s|>)/);
  return heading!.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
};

describe.each(renderers)("$rendererVersion birthday SSR", (renderer) => {
  it("omits an unknown age instead of displaying an age block or placeholder dash", () => {
    const [card] = cards(render(presentation(renderer, [person()])));
    expect(card).toBeDefined();
    expect(card).not.toContain("birthday-age");
    expect(card).not.toContain("JAAR");
    expect(card).not.toMatch(/>\s*[–—−-]\s*</u);
  });

  it("keeps a genuine age zero visible with its year label", () => {
    const [card] = cards(render(presentation(renderer, [person({ age: 0 })])));
    expect(card).toContain('data-has-age="true"');
    const ageBlock = card!.match(/<div\b[^>]*class="birthday-age-block"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    expect(ageBlock).toBeDefined();
    expect(ageBlock).toMatch(/<b\b[^>]*>0<\/b>/);
    expect(ageBlock).toMatch(/<span\b[^>]*>JAAR<\/span>/);
  });

  it.each(["", " \t\n "])("omits empty metadata without leaving an empty paragraph (%j)", (meta) => {
    const [card] = cards(render(presentation(renderer, [person({ meta })])));
    expect(card).not.toContain("birthday-meta");
    expect(card).not.toMatch(/<p\b/);
    expect(headingText(card!)).toContain("Gefeliciteerd,");
  });

  it("preserves authorized nonempty team and role metadata", () => {
    const [card] = cards(render(presentation(renderer, [person({ meta: "JO13-1 · Vrijwilliger" })])));
    expect(card).toMatch(/<p\b[^>]*class="birthday-meta"[^>]*>JO13-1 · Vrijwilliger<\/p>/);
  });

  it("renders five people and an aria-hidden sixth slot without inventing a sixth person", () => {
    const people = Array.from({ length: 5 }, (_, i) => person({ id: `person-${i}`, displayName: `Jarige${i + 1}` }));
    const html = render(presentation(renderer, people));
    expect(cards(html)).toHaveLength(5);
    expect(cards(html).map(headingText)).toEqual(people.map(({ displayName }) => `Gefeliciteerd, ${displayName}!`));
    expect(emptySlots(html)).toHaveLength(1);
    expect(emptySlots(html)[0]).toContain('data-empty-slot="6"');
    expect(emptySlots(html)[0]).toContain('aria-hidden="true"');
    expect(html).toContain('data-slot-count="6"');
    expect(html).toContain('data-filled-count="5"');
  });

  it("preserves all thirteen people exactly once over three six-slot pages without mutating their facts", () => {
    const people = Array.from({ length: 13 }, (_, i) => person({
      id: `person-${i}`,
      displayName: `Jarige${String(i + 1).padStart(2, "0")}`,
      age: i === 0 ? null : i,
    }));
    const slide = presentation(renderer, people), before = JSON.stringify(slide), headings: string[] = [];
    expect(syncSlidePageCount(slide)).toBe(3);
    for (let page = 0; page < syncSlidePageCount(slide); page++) {
      const html = render(slide, page), actualCards = cards(html), blanks = emptySlots(html);
      expect(actualCards).toHaveLength(page === 2 ? 1 : 6);
      expect(actualCards.length + blanks.length).toBe(6);
      for (const blank of blanks) expect(blank).toContain('aria-hidden="true"');
      headings.push(...actualCards.map(headingText));
    }
    expect(headings).toEqual(people.map(({ displayName }) => `Gefeliciteerd, ${displayName}!`));
    expect(new Set(headings).size).toBe(13);
    expect(JSON.stringify(slide)).toBe(before);
  });

  it("keeps all six slots empty when no authorized people exist", () => {
    const html = render(presentation(renderer, []));
    expect(cards(html)).toHaveLength(0);
    expect(emptySlots(html)).toHaveLength(6);
    expect(html).toContain('data-filled-count="0"');
    expect(html).not.toContain("Gefeliciteerd,");
    expect(html).not.toContain("birthday-age-block");
  });

  it("keeps manual names and metadata authoritative while leaving their unknown age absent", () => {
    const slide = syncSlidePresentationSchema.parse({
      ...presentation(renderer, []),
      rich: undefined,
      rows: [["7", "nov", "Lotte van den Berg", "JO13-1"]],
    });
    const [card] = cards(render(slide));
    expect(headingText(card!)).toBe(renderer.rendererVersion === "sync-onzetrots-v9"
      ? "Gefeliciteerd, Lotte B.!"
      : "Gefeliciteerd, Lotte van den Berg!");
    expect(card).toContain("JO13-1");
    expect(card).not.toContain("birthday-age");
    expect(card).not.toContain("JAAR");
  });
});

describe("authorized birthday name headings", () => {
  it.each([
    ["Milan B.", "Milan B."],
    ["Milan Bakker", "Milan B."],
    ["Fleur de Vries", "Fleur V."],
    ["Éloïse Özdemir", "Éloïse Ö."],
    ["Noor", "Noor"],
  ])("preserves v9 first-name plus initial semantics for %s", (displayName, expected) => {
    const [card] = cards(render(presentation(renderers[1], [person({ displayName })])));
    expect(headingText(card!)).toBe(`Gefeliciteerd, ${expected}!`);
  });

  it("keeps the full authorized v1 name in the same heading as its greeting", () => {
    const [card] = cards(render(presentation(renderers[0], [person({ displayName: "Fleur de Vries" })])));
    expect(headingText(card!)).toBe("Gefeliciteerd, Fleur de Vries!");
  });
});
