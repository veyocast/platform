import { renderLgLegacyHtml } from "./lg-legacy-page";

const debugReportKey = "veyocast.player.lgHtmlDebug.v1";

function getLegacyPlayerCss() {
  const match = renderLgLegacyHtml().match(/<style>([\s\S]*?)<\/style>/);
  if (!match?.[1]) {
    throw new Error("LG_LEGACY_STYLESHEET_MISSING");
  }
  return match[1];
}

export function renderLgHtmlDebugHtml() {
  const legacyPlayerCss = getLegacyPlayerCss();

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="dark">
  <title>VeyoCast LG HTML/CSS-renderdiagnose</title>
  <style>
${legacyPlayerCss}
    html,body{min-height:100%;height:auto;overflow:auto;background:#071c1b;color:#f4f7f5;font-family:Arial,Helvetica,sans-serif}
    body{padding:26px}
    .debug-shell{width:100%;max-width:1600px;margin:0 auto}
    .debug-brand{display:block;width:190px;height:auto;margin:0 0 18px}
    .debug-kicker{margin:0 0 8px;color:#ff5a1f;font-size:16px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase}
    .debug-title{margin:0;max-width:1100px;font-size:48px;line-height:1;letter-spacing:-.03em}
    .debug-lead{max-width:1050px;margin:14px 0 0;color:#c9d8d3;font-size:20px;line-height:1.4}
    .debug-code{margin:22px 0 0;padding:16px 20px;border:2px solid #ff5a1f;background:#123332;color:#f4f7f5;font:700 24px/1.2 monospace;overflow-wrap:anywhere}
    .debug-columns{margin-top:22px}
    .debug-checks,.debug-preview{display:inline-block;vertical-align:top;border:1px solid #47706a;border-radius:20px;background:#0d2927;overflow:hidden}
    .debug-checks{width:38%;margin-right:2%}
    .debug-preview{width:59%}
    .debug-panel-title{margin:0;padding:16px 18px;border-bottom:1px solid #2b4b47;font-size:22px}
    .debug-row{min-height:69px;padding:13px 18px;border-bottom:1px solid #2b4b47}
    .debug-row:last-child{border-bottom:0}
    .debug-mark{display:inline-block;width:76px;vertical-align:top;color:#abb1b9;font:700 14px/1.4 monospace}
    .debug-copy{display:inline-block;width:calc(100% - 84px);vertical-align:top}
    .debug-copy strong{display:block;font-size:17px}
    .debug-copy span{display:block;margin-top:4px;color:#adb3bc;font-size:14px;line-height:1.35;overflow-wrap:anywhere}
    .debug-row.pass .debug-mark{color:#47dd88}
    .debug-row.warn .debug-mark{color:#ffc04b}
    .debug-row.fail .debug-mark{color:#ff706b}
    .debug-stage{position:relative;width:100%;height:0;padding-bottom:56.25%;overflow:hidden;background:#000}
    .debug-stage>.dynamic-template{position:absolute;top:0;right:auto;bottom:auto;left:0;width:100vw;height:100vh;transform-origin:top left}
    .debug-stage-note{padding:13px 18px;color:#aeb4bd;font-size:14px;line-height:1.4}
    .debug-technical{margin-top:20px;padding:16px 18px;border:1px solid #47706a;border-radius:12px;background:#0d2927}
    .debug-technical summary{cursor:pointer;font-weight:bold}
    .debug-technical pre{max-height:220px;overflow:auto;margin:12px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#bdc5d0;font:13px/1.45 monospace}
    .debug-actions{margin-top:18px}
    .debug-button{display:inline-block;margin:0 10px 10px 0;padding:12px 16px;border:1px solid #47706a;border-radius:12px;background:#163a37;color:#f4f7f5;font-size:16px;text-decoration:none}
    .debug-button-primary{border-color:#ff5a1f;background:#ff5a1f;color:#090a0c;font-weight:bold}
    .debug-probe-parent{position:absolute;top:-10000px;left:-10000px;width:137px;height:91px}
    #inset-probe{position:absolute;inset:0}
    #edges-probe{position:absolute;top:0;right:0;bottom:0;left:0}
    #property-probe{--lg-debug-accent:rgb(255, 90, 31);color:var(--lg-debug-accent)}
    @media(max-width:950px){body{padding:18px}.debug-title{font-size:38px}.debug-checks,.debug-preview{display:block;width:100%;margin:0 0 18px}.debug-stage{min-height:360px;padding-bottom:0}}
  </style>
</head>
<body>
  <main class="debug-shell">
    <img class="debug-brand" src="/brand/veyocast-logo-inverse.svg" alt="VeyoCast">
    <p class="debug-kicker">Alleen LG web player</p>
    <h1 class="debug-title">HTML/CSS-renderdiagnose</h1>
    <p class="debug-lead">Deze pagina rendert een echte legacy Editorial Arena-slide en meet de browserlaag afzonderlijk. De schermkoppeling, actieve release en lokale mediacache worden niet gewijzigd.</p>
    <p class="debug-code" id="debug-code" aria-live="polite">LG-HTML-CSS-NO-SCRIPT</p>

    <div class="debug-columns">
      <section class="debug-checks" aria-labelledby="debug-checks-title">
        <h2 class="debug-panel-title" id="debug-checks-title">TV-controles</h2>
        <div class="debug-row" id="check-script"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>JavaScript</strong><span>De inline legacy-runtime moet kunnen starten.</span></span></div>
        <div class="debug-row" id="check-viewport"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Viewport</strong><span>De TV moet een bruikbaar renderoppervlak melden.</span></span></div>
        <div class="debug-row" id="check-inset"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Fullscreen CSS</strong><span>Meet inset-shorthand en de compatibele vier-randenfallback.</span></span></div>
        <div class="debug-row" id="check-grid"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Grid en CSS-variabelen</strong><span>Benodigd voor de Editorial Arena-layout en tenantkleur.</span></span></div>
        <div class="debug-row" id="check-layout"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Productierenderer</strong><span>Gebruikt dezelfde CSS-klassen als de HTML/CSS-slide in de player.</span></span></div>
        <div class="debug-row" id="check-motion"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Motion en zichtbaarheid</strong><span>Controleert of de gefaseerde titel na de animatie zichtbaar blijft.</span></span></div>
        <div class="debug-row" id="check-asset"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Zelfde-origin asset</strong><span>Controleert of een playerasset werkelijk decodeert.</span></span></div>
        <div class="debug-row" id="check-storage"><span class="debug-mark">WACHT</span><span class="debug-copy"><strong>Diagnoserapport</strong><span>Slaat alleen deze veilige testuitslag lokaal op.</span></span></div>
      </section>

      <section class="debug-preview" aria-labelledby="debug-preview-title">
        <h2 class="debug-panel-title" id="debug-preview-title">Zichtbare productierenderproef</h2>
        <div class="debug-stage" id="debug-stage">
          <article class="dynamic-template editorial-arena dark" id="production-fixture" style="--accent:#ff5a1f">
            <header>
              <div class="editorial-crest">VC</div>
              <div class="editorial-heading"><p>HTML/CSS live</p><h1>LG renderproef</h1><span>Editorial Arena</span></div>
              <div class="editorial-context"><strong>Staging diagnose</strong><span>08 · 08 · 2026</span></div>
            </header>
            <div class="dynamic-body">
              <div class="editorial-news">
                <div class="editorial-news-art"><img id="debug-image" src="/brand/veyocast-icon-maskable-512.png" alt="VeyoCast rendertest"></div>
                <div class="editorial-news-copy"><span>LG web player</span><h2 id="fixture-title">Deze titel hoort zichtbaar te zijn</h2><p>Eerst verschijnt de achtergrond, daarna titel, korte tekst en details. Als dit vlak zwart blijft, geeft de code links aan welke browserlaag faalt.</p><div class="editorial-news-meta"><small><b>Bron</b>VeyoCast</small><small><b>Modus</b>HTML/CSS</small></div></div>
              </div>
            </div>
            <footer><span>LG DEBUG · GEEN PLAYERDATA GEWIJZIGD</span><span id="fixture-size">METEN…</span></footer>
          </article>
        </div>
        <p class="debug-stage-note">Zie je deze slide volledig, dan werken DOM en basis-CSS op de TV. Deel de diagnosecode en technische details met VeyoCast als normale playback toch zwart blijft.</p>
      </section>
    </div>

    <details class="debug-technical" open><summary>Technische details voor support</summary><pre id="debug-log">JavaScript nog niet gestart.</pre></details>
    <div class="debug-actions"><a class="debug-button debug-button-primary" href="/lg/html-debug">Test opnieuw</a><a class="debug-button" href="/lg/legacy">Legacy player openen</a><a class="debug-button" href="/lg/probe">Volledige LG-probe openen</a></div>
    <div class="debug-probe-parent" aria-hidden="true"><i id="inset-probe"></i><i id="edges-probe"></i><i id="property-probe"></i></div>
  </main>

  <script>
  (function () {
    "use strict";
    var REPORT_KEY = ${JSON.stringify(debugReportKey)};
    var results = [];
    var failures = [];
    var warnings = [];

    function byId(id) { return document.getElementById(id); }
    function safe(value) {
      var text = "";
      try { text = String(value == null ? "" : value); } catch (error) { text = "onleesbaar"; }
      text = text.replace(/https?:\\/\\/[^\\s"'<>]+/gi, "[url]");
      text = text.replace(/[A-Za-z0-9_-]{32,}/g, "[id]");
      return text.slice(0, 260);
    }
    function rectText(rect) { return Math.round(rect.width) + "x" + Math.round(rect.height) + " @ " + Math.round(rect.left) + "," + Math.round(rect.top); }
    function setCheck(id, status, code, detail) {
      var row = byId("check-" + id);
      var mark = row.getElementsByClassName("debug-mark")[0];
      var detailNode = row.getElementsByClassName("debug-copy")[0].getElementsByTagName("span")[0];
      row.className = "debug-row " + status;
      mark.textContent = status === "pass" ? "OK" : status === "warn" ? "LET OP" : "FOUT";
      detailNode.textContent = safe(code + " · " + detail);
      results.push({ id: id, status: status, code: safe(code), detail: safe(detail) });
      if (status === "fail") failures.push(code);
      if (status === "warn") warnings.push(code);
    }
    function support(property, value) {
      try { return !!(window.CSS && CSS.supports && CSS.supports(property, value)); } catch (error) { return false; }
    }
    function fullRect(element, width, height) {
      var rect = element.getBoundingClientRect();
      return Math.abs(rect.width - width) < 2 && Math.abs(rect.height - height) < 2;
    }
    function writeReport(code) {
      try {
        localStorage.setItem(REPORT_KEY, "{}");
        setCheck("storage", "pass", "REPORT_SAVED", REPORT_KEY);
      } catch (error) {
        setCheck("storage", "warn", "REPORT_MEMORY_ONLY", safe(error && error.message));
      }
      var report = {
        code: code,
        createdAt: new Date().toISOString ? new Date().toISOString() : String(new Date()),
        viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0, dpr: window.devicePixelRatio || 1 },
        userAgent: safe(navigator.userAgent),
        warnings: warnings.slice(0, 8),
        results: results.slice(0, 12)
      };
      try { localStorage.setItem(REPORT_KEY, JSON.stringify(report)); } catch (error) {}
      return report;
    }
    function finish() {
      var code = failures.length ? failures[0] : "LG-HTML-CSS-READY";
      var report = writeReport(code);
      byId("debug-code").textContent = code;
      byId("debug-log").textContent = JSON.stringify(report, null, 2);
    }
    function testMotionAndFinish() {
      window.setTimeout(function () {
        var title = byId("fixture-title");
        var opacity = "";
        var animationName = "";
        try {
          opacity = window.getComputedStyle(title).opacity;
          animationName = window.getComputedStyle(title).animationName || "none";
        } catch (error) {}
        if (title.getBoundingClientRect().height > 0 && Number(opacity || 1) > 0.85) {
          setCheck("motion", "pass", animationName === "none" ? "STATIC_MOTION_READY" : "MOTION_READY", "opacity=" + opacity + "; animation=" + animationName);
        } else {
          setCheck("motion", "fail", "LG-HTML-CSS-MOTION", "opacity=" + opacity + "; animation=" + animationName);
        }
        finish();
      }, 1500);
    }
    function run() {
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var parent = byId("inset-probe").parentNode;
      var parentRect = parent.getBoundingClientRect();
      var insetRect = byId("inset-probe").getBoundingClientRect();
      var edgesRect = byId("edges-probe").getBoundingClientRect();
      var fixture = byId("production-fixture");
      var stage = byId("debug-stage");
      var fixtureScale = viewportWidth > 0 ? stage.getBoundingClientRect().width / viewportWidth : 1;
      stage.style.height = Math.round(viewportHeight * fixtureScale) + "px";
      stage.style.paddingBottom = "0";
      fixture.style.width = viewportWidth + "px";
      fixture.style.height = viewportHeight + "px";
      fixture.style.transform = "scale(" + fixtureScale + ")";
      var fixtureRect = fixture.getBoundingClientRect();
      var stageRect = stage.getBoundingClientRect();
      var gridDisplay = "";
      var propertyColor = "";
      var insetSupported = support("inset", "0px");
      var gridSupported = support("display", "grid");
      var variablesSupported = support("--lg-debug-accent", "rgb(255, 90, 31)");

      setCheck("script", "pass", "SCRIPT_READY", "inline runtime uitgevoerd");
      if (viewportWidth > 0 && viewportHeight > 0) {
        setCheck("viewport", "pass", "VIEWPORT_READY", viewportWidth + "x" + viewportHeight + " @" + (window.devicePixelRatio || 1));
      } else {
        setCheck("viewport", "fail", "LG-HTML-CSS-VIEWPORT", viewportWidth + "x" + viewportHeight);
      }

      if (!fullRect(byId("edges-probe"), parentRect.width, parentRect.height)) {
        setCheck("inset", "fail", "LG-HTML-CSS-EDGES", "vier-randenfallback " + rectText(edgesRect));
      } else if (!insetSupported || !fullRect(byId("inset-probe"), parentRect.width, parentRect.height)) {
        setCheck("inset", "warn", "INSET_FALLBACK_ACTIVE", "inset=" + insetSupported + "; fallback=" + rectText(edgesRect));
      } else {
        setCheck("inset", "pass", "INSET_READY", rectText(insetRect));
      }

      try {
        gridDisplay = window.getComputedStyle(byId("production-fixture").getElementsByClassName("editorial-news")[0]).display;
        propertyColor = window.getComputedStyle(byId("property-probe")).color;
      } catch (error) {}
      if (gridSupported && variablesSupported && gridDisplay === "grid" && propertyColor === "rgb(255, 90, 31)") {
        setCheck("grid", "pass", "CSS_FEATURES_READY", "grid + variabelen actief");
      } else {
        setCheck("grid", "fail", "LG-HTML-CSS-FEATURES", "grid=" + gridSupported + "/" + gridDisplay + "; vars=" + variablesSupported + "/" + propertyColor);
      }

      byId("fixture-size").textContent = rectText(fixtureRect);
      if (fixtureRect.width > 200 && fixtureRect.height > 150 && Math.abs(fixtureRect.width - stageRect.width) < 3 && Math.abs(fixtureRect.height - stageRect.height) < 3) {
        setCheck("layout", "pass", "PRODUCTION_LAYOUT_READY", rectText(fixtureRect));
      } else {
        setCheck("layout", "fail", "LG-HTML-CSS-LAYOUT", "fixture=" + rectText(fixtureRect) + "; stage=" + rectText(stageRect));
      }

      var image = byId("debug-image");
      if (image.complete && image.naturalWidth > 0) {
        setCheck("asset", "pass", "ASSET_READY", image.naturalWidth + "x" + image.naturalHeight);
        testMotionAndFinish();
      } else {
        image.onload = function () { setCheck("asset", "pass", "ASSET_READY", image.naturalWidth + "x" + image.naturalHeight); testMotionAndFinish(); };
        image.onerror = function () { setCheck("asset", "fail", "LG-HTML-CSS-ASSET", "same-origin afbeelding kon niet worden gedecodeerd"); testMotionAndFinish(); };
        window.setTimeout(function () {
          if (!results.some(function (result) { return result.id === "asset"; })) {
            setCheck("asset", "fail", "LG-HTML-CSS-ASSET", "timeout na 8 seconden");
            testMotionAndFinish();
          }
        }, 8000);
      }
    }

    try { run(); } catch (error) {
      failures.push("LG-HTML-CSS-RUNTIME");
      try { setCheck("script", "fail", "LG-HTML-CSS-RUNTIME", safe(error && error.message)); } catch (ignored) {}
      finish();
    }
  }());
  </script>
</body>
</html>`;
}
