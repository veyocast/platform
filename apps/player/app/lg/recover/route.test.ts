import { describe, expect, it } from "vitest";

import { renderLgRecoveryHtml } from "../../_lib/lg-recovery-page";
import { GET } from "./route";

describe("zelfstandige LG recoveryroute", () => {
  it("rendert zonder React-hydration of Next-clientchunks", async () => {
    const response = GET();
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("VeyoCast Player herstellen");
    expect(html).toContain("Playerstatus controleren");
    expect(html).toContain("Oude koppelpoging verwijderen");
    expect(html).toContain("Lokale cache herstellen");
    expect(html).toContain("Nieuwe koppeling voorbereiden");
    expect(html).not.toContain("/_next/");
    expect(html).not.toContain("__next");
  });

  it("bevat soft recovery, expliciet bevestigde hard recovery en begrensde redirect", () => {
    const html = renderLgRecoveryHtml();

    expect(html).toContain('startRecovery("soft")');
    expect(html).toContain('startRecovery("hard")');
    expect(html).toContain("window.confirm");
    expect(html).toContain('window.location.replace("/lg")');
    expect(html).toContain("Technische diagnose");
    expect(html).toContain("transportDiagnosticsKey");
    expect(html).toContain(
      "veyocast.player.transportDiagnostics.v1"
    );
    expect(html).toContain("veyocast.player.recovery.v1");
    expect(html).toContain("veyocast.player.instanceId");
    expect(html).toContain("veyocast-player-cache-v1");
    expect(html).toContain("veyocast-player-assets-v1");
    expect(html).toContain('"/api/player/installation"');
    expect(html).toContain('"/api/player/pairing"');
    expect(html).toContain("Nieuwe koppelcode ");
    expect(html).toContain("maximumAttempts = 4");
    expect(html).toContain("stopRecovery(detail)");
  });

  it("gebruikt conservatieve functies in plaats van moderne modulechunks", () => {
    const html = renderLgRecoveryHtml();
    const inlineScript = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));

    expect(inlineScript).toContain("(function ()");
    expect(inlineScript).not.toContain("=>");
    expect(inlineScript).not.toContain("type=\"module\"");
  });
});
