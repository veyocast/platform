import {describe, expect, it} from "vitest";
import type {BlogEntry} from "@veyocast/blog";
import {articleStatus, emptyDraft, hasArticleContent, mediaUrl, ownImageUrl, toSlug} from "./blog-form";

describe("platform blog authoring", () => {
  it("keeps unpublished edits distinct from the published revision", () => {
    const entry = {draftRevision: 3, publishedRevision: null} as BlogEntry;
    expect(articleStatus(entry)).toBe("draft");
    expect(articleStatus({...entry, publishedRevision: 3})).toBe("live");
    expect(articleStatus({...entry, publishedRevision: 2})).toBe("revision");
  });

  it("only accepts exact internal media identities without credentials or parameters", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(mediaUrl(id)).toBe(`/api/blog/media/${id}`);
    for (const url of [`https://example.nl/api/blog/media/${id}`, `//example.nl/api/blog/media/${id}`, `/api/blog/media/${id}?token=x`, `/api/blog/media/${id}#image`, "/api/blog/media/../secret", "javascript:alert(1)", "data:image/png;base64,abc"]) {
      expect(ownImageUrl(url)).toBe("");
    }
    expect(mediaUrl(null)).toBe("");
  });

  it("distinguishes an empty document from meaningful text and controlled media", () => {
    expect(hasArticleContent(emptyDraft.content)).toBe(false);
    expect(hasArticleContent({type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "Een werkwijze."}]}]})).toBe(true);
    expect(hasArticleContent({type: "doc", content: [{type: "image", attrs: {assetId: "11111111-1111-4111-8111-111111111111", src: "/api/blog/media/11111111-1111-4111-8111-111111111111", alt: "Een scherm."}}]})).toBe(true);
    expect(toSlug("Schérmen voor je Club! ")).toBe("schermen-voor-je-club");
  });
});
