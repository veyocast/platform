import { describe, expect, it } from "vitest";

import { marketingClaims } from "./claims";
import {
  marketingPageByPath,
  marketingPages,
  sitemapPages
} from "./pages";
import {
  publishedBlogPosts,
  publishedCases
} from "./published-details";

const requiredRoutes = [
  "/product",
  "/publisher",
  "/functies",
  "/functies/playlists",
  "/functies/schermen",
  "/functies/media",
  "/functies/planning",
  "/functies/offline-afspelen",
  "/functies/monitoring",
  "/functies/templates",
  "/clubtv",
  "/oplossingen",
  "/oplossingen/sportverenigingen",
  "/oplossingen/voetbalclubs",
  "/oplossingen/hockeyclubs",
  "/oplossingen/tennis-en-padel",
  "/oplossingen/zwemverenigingen",
  "/oplossingen/sportscholen",
  "/oplossingen/horeca-en-kantines",
  "/oplossingen/bedrijven",
  "/oplossingen/onderwijs",
  "/oplossingen/retail",
  "/integraties",
  "/prijzen",
  "/demo",
  "/over-ons",
  "/contact",
  "/cases",
  "/kennisbank",
  "/kennisbank/wat-is-narrowcasting",
  "/kennisbank/wat-is-clubtv",
  "/kennisbank/narrowcasting-sportvereniging",
  "/kennisbank/contentkalender-sportclub",
  "/kennisbank/sponsors-zichtbaar-op-clubtv",
  "/blog",
  "/veelgestelde-vragen",
  "/support",
  "/status",
  "/cookies",
  "/algemene-voorwaarden",
  "/verwerkersovereenkomst",
  "/toegankelijkheid"
] as const;

describe("marketing content canon", () => {
  it("implements every required static canon route", () => {
    for (const pathname of requiredRoutes) {
      expect(marketingPageByPath.has(pathname), pathname).toBe(true);
    }
  });

  it("keeps titles, descriptions and pathnames unique", () => {
    expect(new Set(marketingPages.map(({ pathname }) => pathname)).size).toBe(
      marketingPages.length
    );
    expect(new Set(marketingPages.map(({ title }) => title)).size).toBe(
      marketingPages.length
    );
    expect(
      new Set(marketingPages.map(({ description }) => description))
        .size
    ).toBe(marketingPages.length);
  });

  it("gives every route useful body content and internal routes", () => {
    const knownRoutes = new Set([
      "/",
      "/data-verwijderen",
      "/inloggen",
      "/privacy",
      ...marketingPages.map(({ pathname }) => pathname)
    ]);

    for (const page of marketingPages) {
      expect(page.description.length, page.pathname).toBeGreaterThan(70);
      expect(page.benefits.length, page.pathname).toBeGreaterThanOrEqual(3);
      expect(page.steps.length, page.pathname).toBeGreaterThanOrEqual(3);
      expect(page.faqs.length, page.pathname).toBeGreaterThanOrEqual(3);
      expect(page.related.length, page.pathname).toBeGreaterThanOrEqual(2);

      const links = [
        ...page.related,
        ...(page.primaryCta ? [page.primaryCta] : []),
        ...(page.secondaryCta ? [page.secondaryCta] : [])
      ];
      for (const link of links) {
        if (link.href.startsWith("/")) {
          expect(knownRoutes.has(link.href), `${page.pathname} → ${link.href}`).toBe(
            true
          );
        }
      }
    }
  });

  it("only includes explicitly indexable routes in the sitemap registry", () => {
    expect(sitemapPages.every(({ index }) => index)).toBe(true);
    expect(sitemapPages.some(({ pathname }) => pathname === "/status")).toBe(false);
    expect(sitemapPages.some(({ pathname }) => pathname === "/cases")).toBe(false);
    expect(sitemapPages.some(({ pathname }) => pathname === "/blog")).toBe(false);
  });

  it("publishes no unapproved customer case or blog post", () => {
    expect(publishedCases).toEqual([]);
    expect(publishedBlogPosts).toEqual([]);
  });

  it("keeps unsupported pricing and uptime claims blocked", () => {
    expect(marketingClaims.pricing.status).toBe("blocked");
    expect(marketingClaims.uptime.status).toBe("blocked");
    expect(marketingClaims.pricing.allowedCopy).toBe("");
    expect(marketingClaims.uptime.allowedCopy).toBe("");
  });
});
