export const playerClientFallbackCode = "PLAYER_CLIENT_EXCEPTION";

export const playerClientFallbackScript = `
(function () {
  "use strict";
  var shown = false;
  var retryKey = "veyocast.player.clientFallbackRetry.v1";
  var diagnosticsKey = "veyocast.player.transportDiagnostics.v1";
  function text(value) {
    return String(value || "").replace(/[<>&"]/g, "");
  }
  function classify(event) {
    var reason = event && (event.error || event.reason);
    var name = reason && reason.name ? String(reason.name) : "";
    var message = reason && reason.message
      ? String(reason.message)
      : event && event.message
        ? String(event.message)
        : "";
    var searchable = name + " " + message;
    if (/chunkloaderror|loading chunk|dynamically imported module/i.test(searchable)) {
      return "PLAYER_CHUNK_LOAD_FAILED";
    }
    if (/hydration/i.test(searchable)) {
      return "PLAYER_HYDRATION_FAILED";
    }
    if (/quota|storage/i.test(searchable)) {
      return "PLAYER_STORAGE_ERROR";
    }
    if (name === "SyntaxError") {
      return "PLAYER_SYNTAX_ERROR";
    }
    if (name === "TypeError") {
      return "PLAYER_RUNTIME_TYPE_ERROR";
    }
    if (event && event.type === "unhandledrejection") {
      return "PLAYER_PROMISE_REJECTION";
    }
    return "PLAYER_RUNTIME_ERROR";
  }
  function stage() {
    try {
      return document.documentElement.getAttribute(
        "data-veyocast-player-stage"
      ) || "document";
    } catch (error) {
      return "document";
    }
  }
  function recordDiagnostic(code, bootStage) {
    var diagnostics = [];
    try {
      diagnostics = JSON.parse(
        window.localStorage.getItem(diagnosticsKey) || "[]"
      );
      if (Object.prototype.toString.call(diagnostics) !== "[object Array]") {
        diagnostics = [];
      }
      diagnostics.unshift({
        at: new Date().toISOString(),
        code: code,
        method: "CLIENT",
        onlineHint:
          window.navigator && typeof window.navigator.onLine === "boolean"
            ? window.navigator.onLine
            : null,
        outcome: "exception",
        path: window.location.pathname,
        stage: bootStage,
        status: null,
        transport: "browser"
      });
      window.localStorage.setItem(
        diagnosticsKey,
        JSON.stringify(diagnostics.slice(0, 20))
      );
    } catch (error) {}
  }
  function scheduleBoundedRetry() {
    var lastAttempt = 0;
    var now = new Date().getTime();
    try {
      lastAttempt = Number(window.sessionStorage.getItem(retryKey) || "0");
      if (isFinite(lastAttempt) && now - lastAttempt < 120000) {
        return false;
      }
      window.sessionStorage.setItem(retryKey, String(now));
    } catch (error) {
      return false;
    }
    window.setTimeout(function () {
      window.location.reload();
    }, 3000);
    return true;
  }
  function showFallback(event) {
    var body;
    var bootStage;
    var code;
    var retryScheduled;
    var version;
    if (shown || !document || !document.body) { return; }
    if (event && event.type === "error" && !event.error && !event.message) {
      return;
    }
    shown = true;
    bootStage = stage();
    code = classify(event);
    recordDiagnostic(code, bootStage);
    retryScheduled = scheduleBoundedRetry();
    version = ${JSON.stringify(
      process.env.NEXT_PUBLIC_APP_VERSION ?? "development"
    )};
    body = document.body;
    body.innerHTML =
      '<main id="veyocast-client-fallback" aria-labelledby="veyocast-client-fallback-title" style="box-sizing:border-box;background:var(--vc-brand-ink-black,Canvas);color:var(--vc-brand-paper-white,CanvasText);display:flex;min-height:100vh;align-items:center;justify-content:center;padding:6vw;font-family:system-ui,sans-serif">' +
      '<section style="max-width:760px;width:100%">' +
      '<img alt="VeyoCast" src="/brand/veyocast-logo-inverse.svg" style="display:block;max-width:230px;width:46%;margin-bottom:32px">' +
      '<p style="font-size:16px;letter-spacing:.08em;text-transform:uppercase">Playerherstel</p>' +
      '<h1 id="veyocast-client-fallback-title" style="font-size:clamp(34px,6vw,64px);line-height:1.05;margin:8px 0 20px">De Player kon niet veilig starten</h1>' +
      '<p style="font-size:clamp(18px,2.4vw,25px);line-height:1.5">Er is een onverwachte client-side fout opgetreden. Een geldige lokale release en koppeling zijn niet verwijderd.</p>' +
      '<p style="font-family:ui-monospace,monospace">Foutcode: ${playerClientFallbackCode}<br>Diagnose: ' + text(code) + '<br>Opstartfase: ' + text(bootStage) + '<br>Player-versie: ' + text(version) + '</p>' +
      (retryScheduled
        ? '<p style="font-size:18px;line-height:1.5">De Player probeert over enkele seconden één keer gecontroleerd opnieuw.</p>'
        : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:28px">' +
      '<button id="veyocast-client-retry" type="button" style="background:var(--vc-brand-electric-orange);border:0;border-radius:6px;color:var(--vc-brand-ink-black);font:inherit;font-weight:700;min-height:52px;padding:12px 20px">Opnieuw proberen</button>' +
      '<a href="/lg/recover" style="background:var(--vc-brand-paper-white);border-radius:6px;color:var(--vc-brand-ink-black);display:inline-flex;align-items:center;font-weight:700;min-height:52px;padding:0 20px;text-decoration:none">Player herstellen</a>' +
      '</div></section></main>';
    document.getElementById("veyocast-client-retry").onclick = function () {
      window.location.reload();
    };
  }
  window.addEventListener("error", showFallback);
  window.addEventListener("unhandledrejection", showFallback);
}());
`;
