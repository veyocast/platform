import { describe, expect, it } from "vitest";

import { renderLgLegacyHtml } from "../../_lib/lg-legacy-page";
import { GET } from "./route";

describe("zelfstandige LG Legacy Player", () => {
  it("rendert als no-store HTML zonder React, clientchunks of modules", async () => {
    const response = GET();
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("LG Legacy Player");
    expect(html).not.toContain("/_next/");
    expect(html).not.toContain("__next");
    expect(html).not.toContain('type="module"');
  });

  it("speelt LG-video online via HTTPS/Range en valt terug op de geverifieerde cache", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('document.createElement("img")');
    expect(html).toContain('document.createElement("video")');
    expect(html).toContain("preparePendingRelease");
    expect(html).toContain('window.crypto.subtle.digest("SHA-256", bytes)');
    expect(html).toContain("cache.put(asset.cacheKey, response)");
    expect(html).toContain("persistRelease(envelope, assets");
    expect(html).toContain("window.URL.createObjectURL(blob)");
    expect(html).toContain('item.kind === "video"');
    expect(html).toContain('item.source.url.toLowerCase().indexOf("https://") === 0');
    expect(html).toContain("callback(item.source.url, null, true)");
    expect(html).toContain("LEGACY_VIDEO_NETWORK_FALLBACK");
    expect(html).toContain("LEGACY_VIDEO_CACHE_FALLBACK_MISSING");
    expect(html).toContain("video.muted = true");
    expect(html).toContain("video.play()");
    expect(html).toContain("LEGACY_VIDEO_START_TIMEOUT");
    expect(html).toContain("LEGACY_VIDEO_STALLED");
  });

  it("laat ongewijzigde releases en het huidige beeld onaangeraakt", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('headers["If-None-Match"] = releaseEtag(knownReleaseId)');
    expect(html).toContain("status === 304 && knownReleaseId");
    expect(html).toContain("runtime.pendingRelease");
    expect(html).toContain("LEGACY_RELEASE_SWITCH_PENDING");
    expect(html).toContain("activatePendingRelease");
    expect(html).toContain("commitPendingMedia");
    expect(html).toContain("image.decode()");
    expect(html).toContain("legacy-media-layer");
  });

  it("rendert vertrouwde menu-, prijslijst-, nieuws- en sporttemplates zonder injecteerbare HTML", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('templateNode("section", "dynamic-template")');
    expect(html).toContain("renderMenuTemplate");
    expect(html).toContain("renderNewsTemplate");
    expect(html).toContain("renderPriceListTemplate");
    expect(html).toContain("renderMenuStudioTemplate");
    expect(html).toContain("menu-studio-v2");
    expect(html).toContain(".menu-studio-v2 .legacy-price-product>b{color:currentColor");
    expect(html).toContain("legacy-price-grid-two");
    expect(html).toContain("portraitTwoColumns");
    expect(html).toContain('snapshot.menuDocument');
    expect(html).toContain('orientation === "portrait" ? 14 : 8');
    expect(html).toContain("renderSportTemplate");
    expect(html).toContain("renderEditorialStandingTemplate");
    expect(html).toContain("legacy-standing-card");
    expect(html).not.toContain("standing-club-edition");
    expect(html).not.toContain("legacy-standing-header");
    expect(html).toContain("#media-root>img,#media-root>video");
    expect(html).not.toContain("#media-root img,#media-root video");
    expect(html).toContain("editorial-arena-");
    expect(html).toContain("editorialArenaSlideTypes");
    expect(html).toContain("editorial-news");
    expect(html).toContain("editorial-news-qr");
    expect(html).toContain("legacy-price-grid");
    expect(html).toContain("legacy-price-media");
    expect(html).toContain('payload.slideType === "price_list"');
    expect(html).toContain("templateUniqueNewsArticles");
    expect(html).toContain("fitDynamicTemplateCanvas(root, payload.orientation)");
    expect(html).toContain('orientation === "portrait" ? 1080 : 1920');
    expect(html).toContain('orientation === "portrait" ? 1920 : 1080');
    expect(html).toContain("padding-top:56.25%");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain('orientation === "portrait" && viewportHeight >= viewportWidth');
    expect(html).toContain("justify-content:flex-start");
    expect(html).toContain("margin-top:auto");
    expect(html).not.toContain(".editorial-news-copy h2.compact");
    expect(html).not.toContain('arenaTitle.className = "compact"');
    expect(html).toContain("@keyframes editorial-photo-in");
    expect(html).toContain("@keyframes legacy-arrival-aurora");
    expect(html).toContain("@keyframes legacy-arrival-spotlight");
    expect(html).toContain("@keyframes legacy-arrival-kinetic");
    expect(html).toContain("@keyframes legacy-arrival-prism");
    expect(html).toContain("@keyframes legacy-arrival-flip");
    expect(html).toContain('"sport_visitor_arrivals"');
    expect(html).toContain('"sport_referee_arrivals"');
    expect(html).toContain('templateNode("div", "legacy-arrival-grid")');
    expect(html).toContain("LEGACY_TEMPLATE_READY");
    expect(html).toContain('"sport_match_of_the_day"');
    expect(html).toContain("element.textContent = text");
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("new Function(");
  });

  it("resolveert exact de tien goedgekeurde Theme Engine v2-thema's in Legacy", () => {
    const html = renderLgLegacyHtml();
    const ids = [
      "editorial",
      "obsidian",
      "atelier",
      "velocity",
      "heritage",
      "halo",
      "swiss",
      "pavilion",
      "tactical",
      "terrace"
    ];

    expect(html).toContain('themeManifestVersion":"1.0.0"');
    expect(html).toContain("snapshot.themePresentation");
    expect(html).toContain('root.setAttribute("data-theme-id"');
    ids.forEach((id) => {
      expect(html).toContain(`data-theme-id="${id}"`);
      expect(html).toContain(`"${id}":{`);
    });
  });

  it("deelt identiteit en API-contracten met de gewone Player", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("veyocast.player.deviceToken");
    expect(html).toContain("veyocast.player.installationCredential");
    expect(html).toContain("veyocast.player.instanceId");
    expect(html).toContain('"/api/player/installation"');
    expect(html).toContain('"/api/player/pairing"');
    expect(html).toContain('"/api/player/manifest?legacy="');
    expect(html).toContain('"/api/player/heartbeat"');
    expect(html).toContain('appVersion');
    expect(html).toContain('X-VeyoCast-Player-Version');
    expect(html).toContain('runtime.applicationReloadPending = true');
    expect(html).toContain('"/api/player/commands"');
    expect(html).toContain("veyocast-player-cache-v1");
    expect(html).toContain("veyocast-player-assets-v1");
    expect(html).toContain("LEGACY_DEVICE_CREDENTIAL_RECOVERED");
    expect(html).toContain("VEYOCAST_LG_PLAYER_READY");
    expect(html).toContain('path: "/lg"');
    expect(html).toContain("syncPhase: runtime.syncPhase");
    expect(html).not.toContain('syncPhase: "lg-legacy"');
    expect(html).not.toContain('syncPhase: "lg-legacy-pairing"');
    expect(html).toContain("@keyframes legacy-rss-photo-in");
    expect(html).toContain("animation:legacy-rss-title-in 620ms 380ms");
    expect(html).toContain("animation:legacy-rss-copy-in 560ms 820ms");
    expect(html).toContain("@media(prefers-reduced-motion:reduce)");
    expect(html).not.toContain("expiresAt <= now()");
    expect(html).not.toContain("expiresAt > now() + 1000");
  });

  it("verwerkt remote commands op servertijd en hervat een ontbrekende completion", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("serverNow = parsePlayerTimestamp(body.serverTime)");
    expect(html).toContain("executeCommand(commands[index], serverNow)");
    expect(html).toContain("expiresAt <= serverNow");
    expect(html).toContain("LEGACY_CLOCK_SKEW");
    expect(html).toContain("if (!alreadyExecuted) rememberCommand(command.nonce)");
    expect(html).not.toContain(
      'new Date(command.expiresAt || "").getTime() <= now()'
    );
  });

  it("houdt de inline runtime compatibel met oude webOS syntax", () => {
    const html = renderLgLegacyHtml();
    const inlineScript = html.slice(
      html.indexOf("<script>"),
      html.indexOf("</script>")
    );

    expect(inlineScript).toContain("(function ()");
    expect(inlineScript).not.toContain("=>");
    expect(inlineScript).not.toContain("?.");
    expect(inlineScript).not.toContain("??");
    expect(inlineScript).not.toContain("async ");
    expect(inlineScript).not.toContain("await ");
    expect(inlineScript).not.toContain("fetch(");
  });
});
