import { describe, expect, it } from "vitest";

import { renderLgProbeHtml } from "../../_lib/lg-probe-page";
import { GET } from "./route";

describe("zelfstandige LG compatibiliteitsprobe", () => {
  it("rendert zonder React-hydration, Next-clientchunks of module-JavaScript", async () => {
    const response = GET();
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "media-src 'self' blob: data: https:"
    );
    expect(html).toContain("LG compatibiliteitsprobe");
    expect(html).toContain("Bekende referentievideo");
    expect(html).toContain("Bestaande Player-cache");
    expect(html).not.toContain("/_next/");
    expect(html).not.toContain("__next");
    expect(html).not.toContain('type="module"');
  });

  it("test de directe, Blob- en cachepaden zonder playerdata te verwijderen", () => {
    const html = renderLgProbeHtml();

    expect(html).toContain("testReferenceVideo");
    expect(html).toContain("testDirect");
    expect(html).toContain("testBlob");
    expect(html).toContain("testCache");
    expect(html).toContain("Range");
    expect(html).toContain("/__veyocast-player-cache/");
    expect(html).toContain("veyocast-player-assets-v1");
    expect(html).not.toContain("localStorage.clear");
    expect(html).toContain("window.caches.keys");
    expect(html).not.toContain(
      'window.caches.delete("veyocast-player-assets-v1")'
    );
  });

  it("gebruikt conservatieve syntax en bewaart alleen een veilig rapport", () => {
    const html = renderLgProbeHtml();
    const inlineScript = html.slice(
      html.indexOf("<script>"),
      html.indexOf("</script>")
    );

    expect(inlineScript).toContain("(function ()");
    expect(inlineScript).not.toContain("=>");
    expect(inlineScript).not.toContain("?.");
    expect(inlineScript).not.toContain("??");
    expect(html).toContain("veyocast.player.lgProbe.v1");
    expect(html).toContain("results.map");
    expect(html).toContain("De probe wist geen installatie-ID");
  });
});
