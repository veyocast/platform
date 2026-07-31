import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
    expect(html).toContain("VeyoCast-videoreferentie");
    expect(html).toContain("Bestaande Player-cache");
    expect(html).not.toContain("/_next/");
    expect(html).not.toContain("__next");
    expect(html).not.toContain('type="module"');
  });

  it("levert een kleine, fast-start H.264 Baseline/AAC-LC-referentie vanaf dezelfde origin", () => {
    const media = readFileSync(
      new URL(
        "../../../public/lg-probe/h264-baseline-aac.mp4",
        import.meta.url
      )
    );
    const atoms = media.toString("latin1");

    expect(media.byteLength).toBeLessThan(250_000);
    expect(atoms).toContain("ftyp");
    expect(atoms).toContain("avc1");
    expect(atoms).toContain("mp4a");
    expect(atoms.indexOf("moov")).toBeGreaterThan(0);
    expect(atoms.indexOf("moov")).toBeLessThan(atoms.indexOf("mdat"));
    expect(createHash("sha256").update(media).digest("hex")).toBe(
      "1206c13617943221a29eec03ec30e5357a811d8ea323f9bd75fa9ecd2aea5767"
    );

    const html = renderLgProbeHtml();
    expect(html).toContain("/lg-probe/h264-baseline-aac.mp4");
    expect(html).toContain("avc1.42E01E, mp4a.40.2");
    expect(html).not.toContain("media.w3.org");
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

  it("kan een afbeeldingsrelease niet als volledige videoplayback rapporteren", () => {
    const html = renderLgProbeHtml();

    expect(html.indexOf('reference.status === "fail"')).toBeLessThan(
      html.indexOf('code: "LG-PLAYBACK-READY"')
    );
    expect(html).toContain('activeItem.kind === "video"');
    expect(html).toContain('code: "LG-IMAGE-PLAYBACK-READY"');
  });
});
