import { describe, expect, it } from "vitest";

import { renderLgHtmlDebugHtml } from "../../_lib/lg-html-debug-page";
import { GET } from "./route";

describe("LG HTML/CSS-renderdiagnose", () => {
  it("is een zelfstandige statische route zonder Next-clientcode", async () => {
    const response = GET();
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self'"
    );
    expect(html).toContain("LG HTML/CSS-renderdiagnose");
    expect(html).toContain("LG-HTML-CSS-NO-SCRIPT");
    expect(html).toContain("LG-HTML-CSS-READY");
    expect(html).toContain("INSET_FALLBACK_ACTIVE");
    expect(html).toContain("MOTION_READY");
    expect(html).toContain("production-fixture");
    expect(html).not.toContain("/_next/");
    expect(html).not.toContain("__next");
    expect(html).not.toContain('type="module"');
  });

  it("gebruikt de echte legacy renderer-CSS met een compatibele fullscreenfallback", () => {
    const html = renderLgHtmlDebugHtml();

    expect(html).toContain(".dynamic-template.editorial-arena");
    expect(html).toContain(".editorial-news-copy h2");
    expect(html).toContain(
      ".dynamic-template{--accent:#ff5c20;position:absolute;top:0;right:0;bottom:0;left:0"
    );
    expect(html).not.toContain(
      ".dynamic-template{--accent:#ff5c20;position:absolute;inset:0"
    );
  });

  it("wijzigt geen koppeling, release of Player-cache en bewaart alleen een eigen rapport", () => {
    const html = renderLgHtmlDebugHtml();

    expect(html).toContain("veyocast.player.lgHtmlDebug.v1");
    expect(html).not.toContain("veyocast.player.deviceToken");
    expect(html).not.toContain("veyocast.player.instanceId");
    expect(html).not.toContain("caches.delete");
    expect(html).not.toContain("indexedDB.deleteDatabase");
    expect(html).not.toContain("localStorage.clear");
  });

  it("houdt de inline runtime compatibel met de legacy LG-browser", () => {
    const html = renderLgHtmlDebugHtml();
    const inlineScript = html.slice(
      html.lastIndexOf("<script>"),
      html.lastIndexOf("</script>")
    );

    expect(inlineScript).toContain("(function ()");
    expect(inlineScript).not.toContain("=>");
    expect(inlineScript).not.toContain("?.");
    expect(inlineScript).not.toContain("??");
    expect(inlineScript).not.toContain("fetch(");
    expect(inlineScript).not.toContain("async ");
  });
});
