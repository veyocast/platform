import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import type {BlogEntry} from "@veyocast/blog";

vi.mock("./blog-editor", () => ({BlogEditor: () => null}));

import {BlogAdmin} from "./blog-admin";
import {emptyDraft} from "./blog-form";

describe("platform blog interface", () => {
  it("starts with the existing empty destination and disables creation for a reader", () => {
    const html = renderToStaticMarkup(<BlogAdmin canonicalOrigin="http://localhost:3002" canWrite={false} canPublish={false} />);
    expect(html).toContain('href="http://localhost:3002/blog"');
    expect(html).toMatch(/disabled=""[^>]*>.*Nieuw artikel/s);
    expect(html).toContain("Er zijn nog geen artikelen.");
    expect(html).toContain("afzonderlijke redactierechten");
    expect(html).not.toContain("Voorbeeldconcept ophalen");
  });

  it("keeps the published URL while a new revision has an unpublished slug", () => {
    const entry: BlogEntry = {
      id: "article", externalId: "sh_content_article", draftRevision: 3, publishedRevision: 2,
      draft: {...emptyDraft, title: "Een nieuwe titel", slug: "nieuw-concept", tags: []},
      publishedAt: "2026-11-12T12:00:00.000Z", updatedAt: "2026-11-13T12:00:00.000Z",
      publishedSlug: "bestaand-artikel", publicUrl: "http://localhost:3002/blog/bestaand-artikel"
    };
    const html = renderToStaticMarkup(<BlogAdmin initialEntries={[entry]} canonicalOrigin="http://localhost:3002" canWrite canPublish />);
    expect(html).toContain("Revisie open");
    expect(html).toContain('href="http://localhost:3002/blog/bestaand-artikel"');
    expect(html).not.toContain('href="http://localhost:3002/blog/nieuw-concept"');
    expect(html).toContain("SocialHero");
    expect(html).toContain('aria-label="Zoek artikelen"');
  });
});
