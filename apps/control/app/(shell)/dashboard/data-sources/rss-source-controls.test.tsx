import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ syncRssSource: async () => {} }));
import { RssSourceActions } from "./rss-source-controls";

const sourceId = "20000000-0000-4000-8000-000000000288";
describe("RSS source to explicit design creation", () => {
  it("links an authorized source to the connected RSS wizard without creating content", () => {
    const html = renderToStaticMarkup(<RssSourceActions sourceId={sourceId} canDesign canManage={false} paused={false} />);
    expect(html).toContain("Nieuwsslide maken");
    expect(html).toContain(`family=rss&amp;mode=connected&amp;source=${sourceId}`);
    expect(html).not.toContain("Synchroniseren");
  });
  it("does not offer creation or mutation to a viewer or a paused source", () => {
    expect(renderToStaticMarkup(<RssSourceActions sourceId={sourceId} canDesign={false} canManage={false} paused={false} />)).not.toContain("href");
    expect(renderToStaticMarkup(<RssSourceActions sourceId={sourceId} canDesign canManage paused />)).toBe("");
  });
});
