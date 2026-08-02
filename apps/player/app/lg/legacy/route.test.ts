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

  it("gebruikt één dynamisch media-element met direct-online playback", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('document.createElement("img")');
    expect(html).toContain('document.createElement("video")');
    expect(html).toContain('byId("media-root").innerHTML = ""');
    expect(html).toContain("video.muted = true");
    expect(html).toContain("video.play()");
    expect(html).toContain("LEGACY_VIDEO_START_TIMEOUT");
    expect(html).toContain("LEGACY_VIDEO_STALLED");
    expect(html).not.toContain("crossfade");
  });

  it("rendert vertrouwde menu-, nieuws- en sporttemplates zonder injecteerbare HTML", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('templateNode("section", "dynamic-template")');
    expect(html).toContain("renderMenuTemplate");
    expect(html).toContain("renderNewsTemplate");
    expect(html).toContain("renderSportTemplate");
    expect(html).toContain("LEGACY_TEMPLATE_READY");
    expect(html).toContain("element.textContent = text");
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("new Function(");
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
    expect(html).toContain('"/api/player/commands"');
    expect(html).toContain("veyocast-player-cache-v1");
    expect(html).toContain("veyocast-player-assets-v1");
    expect(html).toContain("LEGACY_DEVICE_CREDENTIAL_RECOVERED");
    expect(html).toContain('syncPhase: manifest ? "active" : null');
    expect(html).not.toContain('syncPhase: "lg-legacy"');
    expect(html).not.toContain('syncPhase: "lg-legacy-pairing"');
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
