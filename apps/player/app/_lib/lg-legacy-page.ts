const legacyConfig = {
  activeReleaseStore: "activeReleases",
  cacheName: "veyocast-player-assets-v1",
  cachePathPrefix: "/__veyocast-player-cache/",
  commandIntervalMs: 10_000,
  databaseName: "veyocast-player-cache-v1",
  deviceTokenKey: "veyocast.player.deviceToken",
  executedCommandsKey: "veyocast.player.executedCommands.v1",
  heartbeatIntervalMs: 30_000,
  installationCredentialKey: "veyocast.player.installationCredential",
  installationIdKey: "veyocast.player.instanceId",
  legacyDiagnosticsKey: "veyocast.player.lgLegacyDiagnostics.v1",
  manifestIntervalMs: 30_000,
  pairingCodeKey: "veyocast.player.pairingCode",
  pairingExpiryKey: "veyocast.player.pairingExpiresAt",
  pairingNonceKey: "veyocast.player.pairingRequestNonce",
  previousReleaseStore: "previousReleases",
  previousDeviceTokenKey: "castivo.player.deviceToken",
  requestTimeoutMs: 12_000,
  videoProgressTimeoutMs: 10_000,
  videoStartTimeoutMs: 15_000
} as const;

export function renderLgLegacyHtml() {
  const config = JSON.stringify(legacyConfig).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="color-scheme" content="dark">
  <title>VeyoCast LG Legacy Player</title>
  <style>
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#050505;color:#f7f5f0;font-family:Arial,Helvetica,sans-serif}
    body{position:relative}
    #media-root{position:absolute;inset:0;background:#050505;overflow:hidden}
    #media-root img,#media-root video{display:block;width:100%;height:100%;border:0;background:#050505}
    #status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:5vh 5vw;background:#080908}
    #status[hidden]{display:none}
    .panel{width:min(860px,90vw);padding:clamp(28px,4vw,58px);border:1px solid rgba(255,255,255,.22);border-radius:24px;background:#101110}
    .logo{display:block;width:min(290px,48vw);height:auto;margin:0 0 42px}
    .kicker{margin:0 0 14px;color:#ff5a1f;font-size:clamp(15px,1.5vw,22px);font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(42px,6vw,82px);line-height:.98;letter-spacing:-.045em}
    #detail{max-width:720px;margin:24px 0 0;color:#d6d3cc;font-size:clamp(18px,2vw,28px);line-height:1.45}
    #pairing{display:none;margin:32px 0 0}
    #pairing.visible{display:block}
    #pairing-code{display:inline-block;padding:18px 26px;border:2px solid #ff5a1f;border-radius:14px;color:#fff;font-size:clamp(42px,7vw,84px);font-weight:800;letter-spacing:.12em}
    #error-code{margin:18px 0 0;color:#ffb28f;font:700 clamp(14px,1.4vw,20px)/1.4 monospace}
    #diagnostics{margin:18px 0 0;color:#aaa69d;font:400 clamp(12px,1.2vw,17px)/1.45 monospace;white-space:pre-wrap}
    #watermark{position:absolute;left:2.2vw;bottom:2.2vh;display:none;width:clamp(100px,9vw,180px);height:auto;opacity:.4;pointer-events:none}
    #watermark.visible{display:block}
    #offline{position:absolute;right:2vw;bottom:2vh;display:none;padding:8px 12px;border-radius:999px;background:rgba(7,7,7,.76);color:#f4c15d;font-size:16px;font-weight:700}
    #offline.visible{display:block}
    .dynamic-template{--accent:#f15a24;position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;padding:5vh 5vw 4vh;background:#f4efe6;color:#11110f;font-family:Arial,Helvetica,sans-serif}
    .dynamic-template.dark{background:#080908;color:#fffdf7}
    .dynamic-template header{border-bottom:2px solid rgba(98,95,87,.3);padding:1.8vh 0 2.8vh}
    .dynamic-template header p,.dynamic-news-meta{margin:0 0 1vh;color:var(--accent);font-size:clamp(17px,1.45vw,30px);font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .dynamic-template h1{margin:0;max-width:90%;font-size:clamp(44px,5vw,96px);line-height:.94;letter-spacing:-.045em}
    .dynamic-body{align-self:stretch;display:grid;align-content:center;min-height:0;padding:2.5vh 0}
    .dynamic-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2vh 2.2vw}
    .dynamic-menu-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2vw;min-height:10vh;padding:1.5vh 1.5vw;border-left:8px solid var(--accent);background:#fffdf7}
    .dark .dynamic-menu-item{background:#141512}
    .dynamic-menu-item small{display:block;margin:0 0 .4vh;color:var(--accent);font-size:clamp(13px,1vw,21px);font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .dynamic-menu-item h2{margin:0;font-size:clamp(24px,2.2vw,44px);line-height:1.05}
    .dynamic-menu-item p{margin:.7vh 0 0;color:#625f57;font-size:clamp(14px,1.05vw,23px);line-height:1.3}
    .dark .dynamic-menu-item p{color:#c9c4b9}
    .dynamic-menu-item strong{color:var(--accent);font-size:clamp(27px,2.5vw,50px);white-space:nowrap}
    .dynamic-news{max-width:84%;padding:4vh 0}
    .dynamic-news h2{margin:1.8vh 0 2.6vh;font-size:clamp(62px,7.2vw,138px);line-height:.92;letter-spacing:-.055em}
    .dynamic-news p:last-child{margin:0;max-width:80%;color:#625f57;font-size:clamp(24px,2.35vw,47px);line-height:1.35}
    .dark .dynamic-news p:last-child{color:#c9c4b9}
    .dynamic-match{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:3vw;padding:4vh 1vw;text-align:center}
    .dynamic-team{display:grid;justify-items:center;gap:2vh;min-width:0}
    .dynamic-team-mark{display:flex;align-items:center;justify-content:center;width:min(25vw,32vh);height:min(25vw,32vh);border:9px solid var(--accent);background:#fffdf7;color:#11110f;font-size:clamp(52px,7vw,126px);font-weight:900}
    .dark .dynamic-team-mark{background:#141512;color:#fffdf7}
    .dynamic-team h2{margin:0;font-size:clamp(34px,3.5vw,70px);line-height:1}
    .dynamic-match-meta{display:grid;justify-items:center;gap:1.3vh;min-width:18vw}
    .dynamic-match-meta small{color:var(--accent);font-size:clamp(15px,1.2vw,25px);font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .dynamic-match-meta strong{font-size:clamp(36px,4vw,76px)}
    .dynamic-match-meta p{margin:0;color:#625f57;font-size:clamp(18px,1.5vw,29px)}
    .dark .dynamic-match-meta p{color:#c9c4b9}
    .dynamic-list{display:grid}
    .dynamic-row{display:grid;grid-template-columns:50px minmax(0,1fr) minmax(130px,1.15fr);align-items:center;gap:1.4vw;min-height:8.5vh;padding:1vh 1vw;border-top:1px solid rgba(98,95,87,.3)}
    .dynamic-row>span{color:var(--accent);font-size:clamp(19px,1.6vw,31px);font-weight:900}
    .dynamic-row h2{margin:0;font-size:clamp(23px,2vw,39px);line-height:1.05}
    .dynamic-row p{margin:.4vh 0 0;color:#625f57;font-size:clamp(14px,1.1vw,22px)}
    .dark .dynamic-row p{color:#c9c4b9}
    .dynamic-row strong{justify-self:end;font-size:clamp(19px,1.4vw,29px);text-align:right}
    .dynamic-empty{padding:3vh 3vw;border-left:8px solid var(--accent);background:#fffdf7;font-size:clamp(25px,2.4vw,47px);font-weight:800}
    .dark .dynamic-empty{background:#141512}
    .dynamic-template footer{display:flex;justify-content:space-between;padding-top:1.7vh;border-top:1px solid rgba(98,95,87,.3);color:#625f57;font-size:clamp(12px,.95vw,19px);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .dark footer{color:#c9c4b9}
    .dynamic-template.portrait{padding:5vh 6vw 4vh}
    .portrait .dynamic-menu-grid{grid-template-columns:1fr;gap:1vh}
    .portrait .dynamic-menu-item{min-height:7.2vh;padding:1.1vh 2.6vw}
    .portrait .dynamic-news{max-width:100%}
    .portrait .dynamic-news h2{font-size:clamp(60px,11.5vw,130px)}
    .portrait .dynamic-news p:last-child{max-width:100%;font-size:clamp(26px,4vw,47px)}
    .portrait .dynamic-match{grid-template-columns:1fr;gap:2.5vh}
    .portrait .dynamic-team{grid-template-columns:auto minmax(0,1fr);align-items:center;justify-items:start;width:100%;text-align:left}
    .portrait .dynamic-team-mark{width:min(24vw,17vh);height:min(24vw,17vh);font-size:clamp(42px,9vw,90px)}
    .portrait .dynamic-match-meta{width:100%;padding:2vh 0;border-top:1px solid rgba(98,95,87,.3);border-bottom:1px solid rgba(98,95,87,.3)}
    .portrait .dynamic-row{grid-template-columns:44px minmax(0,1fr);min-height:10.5vh}
    .portrait .dynamic-row strong{grid-column:2;justify-self:start;text-align:left}
    @media(max-height:650px){.panel{padding:24px}.logo{width:210px;margin-bottom:24px}#detail{margin-top:14px}#pairing{margin-top:18px}}
  </style>
</head>
<body>
  <main id="media-root" aria-label="VeyoCast afspeeloppervlak"></main>
  <img id="watermark" src="/brand/veyocast-logo-inverse.svg" alt="">
  <div id="offline" role="status">Offline · lokale release</div>
  <section id="status" aria-live="polite">
    <div class="panel">
      <img class="logo" src="/brand/veyocast-logo-inverse.svg" alt="VeyoCast">
      <p class="kicker" id="kicker">LG Legacy Player</p>
      <h1 id="title">Player starten</h1>
      <p id="detail">De eenvoudige LG-runtime controleert de installatie en de laatste geldige release.</p>
      <div id="pairing">
        <p class="kicker">Koppelcode</p>
        <div id="pairing-code"></div>
      </div>
      <p id="error-code"></p>
      <pre id="diagnostics"></pre>
    </div>
  </section>
  <script>
  (function () {
    "use strict";
    var CONFIG = ${config};
    var runtime = {
      activeIndex: 0,
      bootGeneration: 0,
      cachedRelease: null,
      currentElement: null,
      currentItem: null,
      deviceToken: null,
      envelope: null,
      installationCredential: null,
      installationId: null,
      itemFailures: {},
      lastClockSkewLoggedAt: 0,
      lastProgressAt: 0,
      objectUrl: null,
      offline: false,
      playbackTimer: null,
      progressTimer: null,
      releaseSource: "online",
      retryTimer: null,
      state: "BOOTING",
      syncFailures: 0,
      templateTimer: null,
      watchdogTimer: null
    };
    var definitiveCredentialCodes = {
      BINDING_EXPIRED: true,
      DEVICE_REVOKED: true,
      INSTALLATION_NOT_FOUND: true,
      INVALID_DEVICE_TOKEN: true
    };

    function byId(id) { return document.getElementById(id); }
    function now() { return new Date().getTime(); }
    function safeRead(key) {
      try { return window.localStorage.getItem(key); } catch (error) { return null; }
    }
    function safeWrite(key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
    }
    function safeRemove(key) {
      try { window.localStorage.removeItem(key); } catch (error) {}
    }
    function validCredential(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(value);
    }
    function validIdentifier(value) {
      return typeof value === "string" && /^[a-f0-9-]{20,80}$/.test(value);
    }
    function parseJson(value) {
      try { return JSON.parse(value || "null"); } catch (error) { return null; }
    }
    function parsePlayerTimestamp(value) {
      var normalized = String(value || "")
        .replace(/(\\.\\d{3})\\d+(?=(?:z|[+-]\\d{2}:?\\d{2})$)/i, "$1")
        .replace(/\\+00:00$/, "Z");
      var timestamp = new Date(normalized).getTime();
      return isFinite(timestamp) ? timestamp : null;
    }
    function errorCode(body, fallback) {
      return body && body.error && typeof body.error.code === "string"
        ? body.error.code
        : fallback;
    }
    function errorCause(body, fallback) {
      return body && body.error && typeof body.error.cause === "string"
        ? body.error.cause
        : fallback;
    }
    function setText(id, value) { byId(id).textContent = value || ""; }
    function log(code, detail) {
      var entries = parseJson(safeRead(CONFIG.legacyDiagnosticsKey));
      if (!Array.isArray(entries)) entries = [];
      entries.push({
        at: new Date().toISOString(),
        code: String(code || "LEGACY_EVENT").slice(0, 80),
        detail: String(detail || "").slice(0, 240)
      });
      if (entries.length > 12) entries = entries.slice(entries.length - 12);
      safeWrite(CONFIG.legacyDiagnosticsKey, JSON.stringify(entries));
      setText("diagnostics", entries.slice(-3).map(function (entry) {
        return entry.at.slice(11, 19) + " · " + entry.code + " · " + entry.detail;
      }).join("\\n"));
    }
    function showStatus(kicker, title, detail, code) {
      byId("status").hidden = false;
      byId("watermark").className = "";
      setText("kicker", kicker);
      setText("title", title);
      setText("detail", detail);
      setText("error-code", code ? "Foutcode: " + code : "");
    }
    function showPairing(code, detail) {
      showStatus(
        "Klaar om te koppelen",
        "Koppel dit scherm aan VeyoCast",
        detail || "Open Schermen in VeyoCast Control en voer deze tijdelijke code in.",
        ""
      );
      byId("pairing").className = "visible";
      setText("pairing-code", code);
    }
    function hidePairing() {
      byId("pairing").className = "";
      setText("pairing-code", "");
    }
    function setState(state) {
      runtime.state = state;
    }
    function request(method, path, headers, body, callback) {
      var xhr = new XMLHttpRequest();
      var key;
      var completed = false;
      xhr.open(method, path, true);
      xhr.timeout = CONFIG.requestTimeoutMs;
      xhr.setRequestHeader("Accept", "application/json");
      for (key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key) && headers[key]) {
          xhr.setRequestHeader(key, headers[key]);
        }
      }
      function finish(transportCode) {
        var responseBody;
        if (completed) return;
        completed = true;
        responseBody = parseJson(xhr.responseText);
        log(
          transportCode || "HTTP_" + String(xhr.status),
          method + " " + path
        );
        callback(
          transportCode,
          xhr.status || 0,
          responseBody,
          xhr.getResponseHeader("Retry-After")
        );
      }
      xhr.onload = function () { finish(null); };
      xhr.onerror = function () { finish("NETWORK_ERROR"); };
      xhr.ontimeout = function () { finish("TIMEOUT"); };
      try { xhr.send(body || null); } catch (error) { finish("XHR_EXCEPTION"); }
    }
    function createIdentifier() {
      var bytes = [];
      var index;
      if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        var random = new Uint8Array(16);
        window.crypto.getRandomValues(random);
        for (index = 0; index < random.length; index += 1) bytes.push(random[index]);
      } else {
        for (index = 0; index < 16; index += 1) {
          bytes.push(Math.floor(Math.random() * 256));
        }
      }
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      return bytes.map(function (byte) {
        return ("0" + byte.toString(16)).slice(-2);
      }).join("").replace(
        /^(........)(....)(....)(....)(............)$/,
        "$1-$2-$3-$4-$5"
      );
    }
    function ensureInstallationId() {
      var stored = safeRead(CONFIG.installationIdKey);
      if (validIdentifier(stored)) return stored;
      stored = createIdentifier();
      safeWrite(CONFIG.installationIdKey, stored);
      return stored;
    }
    function clearTemporaryPairing() {
      safeRemove(CONFIG.pairingCodeKey);
      safeRemove(CONFIG.pairingExpiryKey);
      safeRemove(CONFIG.pairingNonceKey);
      hidePairing();
    }
    function clearInvalidDeviceCredential() {
      runtime.deviceToken = null;
      safeRemove(CONFIG.deviceTokenKey);
      safeRemove(CONFIG.previousDeviceTokenKey);
      clearTemporaryPairing();
    }
    function readDeviceToken() {
      var current = safeRead(CONFIG.deviceTokenKey);
      if (validCredential(current)) return current;
      current = safeRead(CONFIG.previousDeviceTokenKey);
      return validCredential(current) ? current : null;
    }
    function persistDeviceToken(value) {
      if (!validCredential(value)) return false;
      runtime.deviceToken = value;
      return safeWrite(CONFIG.deviceTokenKey, value);
    }
    function retryDelay(attempt, retryAfter) {
      var serverSeconds = Number(retryAfter);
      if (isFinite(serverSeconds) && serverSeconds > 0) {
        return Math.min(600000, Math.max(1000, Math.ceil(serverSeconds * 1000)));
      }
      return Math.min(60000, 2000 * Math.pow(2, Math.min(attempt, 5)));
    }
    function scheduleBoot(code, detail, retryAfter) {
      var delay = retryDelay(runtime.syncFailures, retryAfter);
      runtime.syncFailures = Math.min(runtime.syncFailures + 1, 8);
      window.clearTimeout(runtime.retryTimer);
      showStatus(
        "Automatisch herstellen",
        "VeyoCast tijdelijk niet bereikbaar",
        detail + " Nieuwe gecontroleerde poging over " + Math.ceil(delay / 1000) + " seconden.",
        code
      );
      runtime.retryTimer = window.setTimeout(boot, delay);
    }
    function registerInstallation(callback) {
      var headers = { "Content-Type": "application/json" };
      if (runtime.installationCredential) {
        headers["X-VeyoCast-Installation-Credential"] =
          runtime.installationCredential;
      }
      if (runtime.deviceToken) {
        headers.Authorization = "Bearer " + runtime.deviceToken;
      }
      request(
        "POST",
        "/api/player/installation",
        headers,
        JSON.stringify({ installationId: runtime.installationId }),
        function (transport, status, body, retryAfter) {
          if (
            !transport &&
            status >= 200 &&
            status < 300 &&
            body &&
            body.ok === true
          ) {
            if (validCredential(body.installationCredential)) {
              runtime.installationCredential = body.installationCredential;
              safeWrite(
                CONFIG.installationCredentialKey,
                runtime.installationCredential
              );
            }
            if (validCredential(body.deviceCredential)) {
              persistDeviceToken(body.deviceCredential);
            }
            callback(true, null, null);
            return;
          }
          if (runtime.deviceToken && (transport || status >= 500)) {
            callback(true, null, null);
            return;
          }
          callback(
            false,
            errorCode(body, transport || "INSTALLATION_API_UNAVAILABLE"),
            retryAfter
          );
        }
      );
    }
    function requestPairing() {
      var nonce = safeRead(CONFIG.pairingNonceKey);
      if (!validIdentifier(nonce)) {
        nonce = createIdentifier();
        safeWrite(CONFIG.pairingNonceKey, nonce);
      }
      setState("PAIRING_REQUESTING");
      showStatus(
        "LG Legacy Player",
        "Nieuwe koppelcode voorbereiden",
        "De Player vraagt één idempotente koppelcode aan.",
        ""
      );
      request(
        "POST",
        "/api/player/pairing",
        {
          "X-VeyoCast-Installation-Credential":
            runtime.installationCredential,
          "X-VeyoCast-Pairing-Request": nonce,
          "X-VeyoCast-Player-Instance": runtime.installationId
        },
        null,
        function (transport, status, body, retryAfter) {
          var code = errorCode(body, transport || "PAIRING_API_UNAVAILABLE");
          if (
            !transport &&
            status >= 200 &&
            status < 300 &&
            body &&
            validCredential(body.deviceToken) &&
            typeof body.pairingCode === "string" &&
            typeof body.expiresAt === "string"
          ) {
            persistDeviceToken(body.deviceToken);
            safeWrite(CONFIG.pairingCodeKey, body.pairingCode);
            safeWrite(CONFIG.pairingExpiryKey, body.expiresAt);
            runtime.syncFailures = 0;
            showPairing(body.pairingCode);
            setState("PAIRING_CODE_ACTIVE");
            window.setTimeout(pollPairingClaim, 1000);
            return;
          }
          scheduleBoot(
            code,
            errorCause(body, "De koppelservice reageert tijdelijk niet."),
            retryAfter
          );
        }
      );
    }
    function ensurePairing() {
      var code = safeRead(CONFIG.pairingCodeKey);
      var expiresAt = new Date(safeRead(CONFIG.pairingExpiryKey) || "").getTime();
      if (code && isFinite(expiresAt) && expiresAt > now() + 1000 && runtime.deviceToken) {
        showPairing(code);
        setState("PAIRING_CODE_ACTIVE");
        pollPairingClaim();
        return;
      }
      clearTemporaryPairing();
      requestPairing();
    }
    function pollPairingClaim() {
      var pairingCode = safeRead(CONFIG.pairingCodeKey);
      var expiresAt = new Date(safeRead(CONFIG.pairingExpiryKey) || "").getTime();
      if (!runtime.deviceToken || !pairingCode) {
        clearInvalidDeviceCredential();
        requestPairing();
        return;
      }
      if (!isFinite(expiresAt) || expiresAt <= now()) {
        clearInvalidDeviceCredential();
        requestPairing();
        return;
      }
      request(
        "POST",
        "/api/player/heartbeat",
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Content-Type": "application/json"
        },
        JSON.stringify({
          activeReleaseId: null,
          currentItemId: null,
          desiredReleaseId: null,
          networkState: "online",
          runtimeState: "READY",
          syncPhase: null
        }),
        function (transport, status, body) {
          var code = errorCode(body, transport || "PAIRING_API_UNAVAILABLE");
          if (!transport && status >= 200 && status < 300 && body && body.ok === true) {
            clearTemporaryPairing();
            setState("SYNCING");
            syncManifest();
            return;
          }
          if (status === 409 && code === "PAIRING_PENDING") {
            showPairing(
              pairingCode,
              "Nog niet gekoppeld. Voer de zichtbare code in bij het gewenste scherm in Control."
            );
            runtime.retryTimer = window.setTimeout(pollPairingClaim, 3000);
            return;
          }
          if (transport || status >= 500) {
            showPairing(
              pairingCode,
              "Control kon tijdelijk niet worden gecontroleerd. De code blijft geldig; de Player probeert opnieuw."
            );
            runtime.retryTimer = window.setTimeout(pollPairingClaim, 5000);
            return;
          }
          clearInvalidDeviceCredential();
          requestPairing();
        }
      );
    }
    function isManifestEnvelope(value) {
      return Boolean(
        value &&
        value.manifest &&
        Array.isArray(value.manifest.items) &&
        typeof value.manifest.releaseId === "string" &&
        value.device &&
        typeof value.device.id === "string"
      );
    }
    function isWaitingEnvelope(value) {
      return Boolean(value && value.device && !value.manifest && value.state === "READY");
    }
    function syncManifest() {
      if (!runtime.deviceToken) {
        ensurePairing();
        return;
      }
      request(
        "GET",
        "/api/player/manifest?legacy=" + String(now()),
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Cache-Control": "no-store"
        },
        null,
        function (transport, status, body) {
          var code = errorCode(body, transport || "PLAYER_API_UNAVAILABLE");
          if (!transport && status >= 200 && status < 300 && isWaitingEnvelope(body)) {
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            setState("READY");
            showStatus(
              "Player gekoppeld",
              "Wachten op content",
              "Publiceer een playlist naar dit scherm. De Player controleert automatisch opnieuw.",
              ""
            );
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            sendHeartbeat();
            return;
          }
          if (!transport && status >= 200 && status < 300 && isManifestEnvelope(body)) {
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            runtime.envelope = body;
            runtime.releaseSource = "online";
            runtime.offline = false;
            byId("offline").className = "";
            readCachedRelease(runtime.deviceToken, function (cached) {
              runtime.cachedRelease = cached;
              startRelease(body, "online");
            });
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            sendHeartbeat();
            return;
          }
          if (code === "PAIRING_PENDING" && runtime.state === "PAIRING_CODE_ACTIVE") {
            showPairing(
              safeRead(CONFIG.pairingCodeKey) || "",
              "Voer de code in Control in. De Player controleert de koppeling automatisch."
            );
            scheduleManifestSync(3000);
            return;
          }
          if (definitiveCredentialCodes[code] || status === 403 || status === 410) {
            clearInvalidDeviceCredential();
            setState("UNPAIRED");
            ensurePairing();
            return;
          }
          if (runtime.state === "PAIRING_CODE_ACTIVE") {
            showPairing(
              safeRead(CONFIG.pairingCodeKey) || "",
              "Voer de code in Control in. De Player controleert de koppeling automatisch."
            );
            scheduleManifestSync(3000);
            return;
          }
          restoreLastKnownGood(function (restored) {
            if (!restored) {
              scheduleBoot(
                code,
                errorCause(body, "Online synchronisatie is tijdelijk mislukt."),
                null
              );
            } else {
              scheduleManifestSync(retryDelay(runtime.syncFailures, null));
            }
          });
        }
      );
    }
    function scheduleManifestSync(delay) {
      window.clearTimeout(runtime.retryTimer);
      runtime.retryTimer = window.setTimeout(syncManifest, delay);
    }
    function readCachedRelease(deviceToken, callback) {
      var open;
      if (!window.indexedDB) { callback(null); return; }
      try { open = window.indexedDB.open(CONFIG.databaseName); } catch (error) {
        callback(null);
        return;
      }
      open.onerror = function () { callback(null); };
      open.onsuccess = function () {
        var database = open.result;
        var transaction;
        var requestResult;
        if (!database.objectStoreNames.contains(CONFIG.activeReleaseStore)) {
          database.close();
          callback(null);
          return;
        }
        try {
          transaction = database.transaction(CONFIG.activeReleaseStore, "readonly");
          requestResult = transaction.objectStore(CONFIG.activeReleaseStore).get(deviceToken);
        } catch (error) {
          database.close();
          callback(null);
          return;
        }
        requestResult.onerror = function () {
          database.close();
          callback(null);
        };
        requestResult.onsuccess = function () {
          var cached = requestResult.result;
          database.close();
          callback(
            cached && cached.envelope && isManifestEnvelope(cached.envelope)
              ? cached
              : null
          );
        };
      };
    }
    function restoreLastKnownGood(callback) {
      if (!runtime.deviceToken) { callback(false); return; }
      readCachedRelease(runtime.deviceToken, function (cached) {
        if (!cached) {
          callback(false);
          return;
        }
        runtime.cachedRelease = cached;
        runtime.envelope = cached.envelope;
        runtime.releaseSource = "cache";
        runtime.offline = true;
        byId("offline").className = "visible";
        startRelease(cached.envelope, "cache");
        callback(true);
      });
    }
    function playableItems(envelope) {
      var items = envelope && envelope.manifest && envelope.manifest.items;
      if (!Array.isArray(items)) return [];
      return items.filter(function (item) {
        return item &&
          item.enabled !== false &&
          (item.kind === "image" || item.kind === "video") &&
          item.source &&
          typeof item.source.url === "string";
      });
    }
    function startRelease(envelope, source) {
      var items = playableItems(envelope);
      if (!items.length) {
        showStatus(
          "Release geweigerd",
          "Geen afspeelbare content",
          "De immutable release bevat geen afbeelding of video die deze eenvoudige Player kan tonen.",
          "LEGACY_RELEASE_EMPTY"
        );
        setState("ERROR_RECOVERABLE");
        return;
      }
      runtime.envelope = envelope;
      runtime.releaseSource = source;
      runtime.activeIndex = runtime.activeIndex % items.length;
      runtime.itemFailures = {};
      playCurrent();
    }
    function clearMedia() {
      window.clearTimeout(runtime.playbackTimer);
      window.clearTimeout(runtime.watchdogTimer);
      window.clearInterval(runtime.progressTimer);
      window.clearInterval(runtime.templateTimer);
      runtime.playbackTimer = null;
      runtime.watchdogTimer = null;
      runtime.progressTimer = null;
      runtime.templateTimer = null;
      if (runtime.currentElement && runtime.currentElement.tagName === "VIDEO") {
        try { runtime.currentElement.pause(); } catch (error) {}
        runtime.currentElement.removeAttribute("src");
        try { runtime.currentElement.load(); } catch (error) {}
      }
      byId("media-root").innerHTML = "";
      runtime.currentElement = null;
      if (runtime.objectUrl && window.URL && typeof window.URL.revokeObjectURL === "function") {
        window.URL.revokeObjectURL(runtime.objectUrl);
      }
      runtime.objectUrl = null;
    }
    function mediaStyle(item, element) {
      var defaults = runtime.envelope.manifest.presentationDefaults || {};
      var fit = item.fitMode || defaults.fitMode || "contain";
      element.style.objectFit = fit === "cover" ? "cover" : "contain";
      element.style.objectPosition = item.cropFocus
        ? String(Number(item.cropFocus.x) * 100) + "% " + String(Number(item.cropFocus.y) * 100) + "%"
        : "50% 50%";
      byId("media-root").style.backgroundColor =
        item.backgroundColor || defaults.backgroundColor || "#050505";
    }
    function cachedItemUrl(item, callback) {
      var cacheKey;
      if (
        !item ||
        !item.source ||
        typeof item.source.checksumSha256 !== "string" ||
        !window.caches
      ) {
        callback(null);
        return;
      }
      cacheKey = CONFIG.cachePathPrefix + item.source.checksumSha256;
      window.caches.open(CONFIG.cacheName).then(function (cache) {
        return cache.match(cacheKey);
      }).then(function (response) {
        if (!response) { callback(null); return; }
        if (
          window.URL &&
          typeof window.URL.createObjectURL === "function" &&
          typeof response.blob === "function"
        ) {
          response.blob().then(function (blob) {
            runtime.objectUrl = window.URL.createObjectURL(blob);
            callback(runtime.objectUrl);
          }, function () { callback(cacheKey); });
          return;
        }
        callback(cacheKey);
      }, function () { callback(null); });
    }
    function sourceForItem(item, callback) {
      if (runtime.releaseSource === "online" && item.source.url) {
        callback(item.source.url);
        return;
      }
      cachedItemUrl(item, callback);
    }
    function playCurrent() {
      var items = playableItems(runtime.envelope);
      var item;
      if (!items.length) return;
      runtime.activeIndex = runtime.activeIndex % items.length;
      item = items[runtime.activeIndex];
      runtime.currentItem = item;
      setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
      clearMedia();
      sourceForItem(item, function (sourceUrl) {
        if (item !== runtime.currentItem) return;
        if (!sourceUrl) {
          failItem("LEGACY_CACHE_MISSING");
          return;
        }
        if (validDynamicTemplate(item.dynamicTemplate)) {
          try {
            playDynamicTemplate(item, sourceUrl);
          } catch (error) {
            log("LEGACY_TEMPLATE_ERROR", String(error && error.message || error));
            if (item.kind === "video") playVideo(item, sourceUrl);
            else playImage(item, sourceUrl);
          }
        } else if (item.kind === "video") playVideo(item, sourceUrl);
        else playImage(item, sourceUrl);
      });
    }
    function mediaReady() {
      byId("status").hidden = true;
      byId("watermark").className = "visible";
      hidePairing();
      sendHeartbeat();
    }
    function itemDurationMs(item) {
      var defaults = runtime.envelope.manifest.presentationDefaults || {};
      var seconds = Number(item.durationSeconds || defaults.imageDurationSeconds || 10);
      if (!isFinite(seconds) || seconds < 1) seconds = 10;
      return Math.min(3600000, Math.max(1000, Math.round(seconds * 1000)));
    }
    function validDynamicTemplate(value) {
      return value &&
        value.schemaVersion === 1 &&
        typeof value.templateSlug === "string" &&
        /^[a-z0-9][a-z0-9-]{0,119}$/.test(value.templateSlug) &&
        typeof value.slideType === "string" &&
        (value.orientation === "portrait" || value.orientation === "landscape") &&
        value.data &&
        typeof value.data === "object";
    }
    function templateRecord(value) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    }
    function templateArray(value) {
      return Array.isArray(value) ? value.slice(0, 40) : [];
    }
    function templateText(value, fallback) {
      var normalized;
      if (typeof value !== "string") return fallback || "";
      normalized = value.replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "");
      return normalized ? normalized.slice(0, 500) : fallback || "";
    }
    function templateNode(tagName, className, text) {
      var element = document.createElement(tagName);
      if (className) element.className = className;
      if (typeof text === "string") element.textContent = text;
      return element;
    }
    function templatePrice(value, currency) {
      var amount = Number(value);
      var rendered;
      if (!isFinite(amount)) return "";
      rendered = (amount / 100).toFixed(2).replace(".", ",");
      return (currency === "EUR" || !currency ? "€ " : currency + " ") + rendered;
    }
    function templatePages(items, perPage) {
      var pages = [];
      var index;
      if (!items.length) return [[]];
      for (index = 0; index < items.length; index += perPage) {
        pages.push(items.slice(index, index + perPage));
      }
      return pages;
    }
    function templateInitials(value) {
      return templateText(value, "VC").split(/\\s+/).slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase();
      }).join("");
    }
    function sportTemplateTitle(slideType) {
      var titles = {
        sport_activities: "Clubagenda",
        sport_birthdays: "Verjaardagen",
        sport_cancellations: "Afgelastingen",
        sport_dressing_rooms: "Veld- en kleedkamerindeling",
        sport_match_of_the_day: "Wedstrijd van de dag",
        sport_next_match: "Volgende wedstrijd",
        sport_officials: "Wedstrijdofficials",
        sport_period_standing: "Periodestand",
        sport_program: "Programma van vandaag",
        sport_results: "Uitslagen",
        sport_sponsor: "Partner van de week",
        sport_standing: "Stand",
        sport_team: "Team",
        sport_trainings: "Trainingen",
        sport_volunteers: "Vrijwilligers"
      };
      return titles[slideType] || "Clubinformatie";
    }
    function renderMenuTemplate(body, snapshot, orientation) {
      var menu = templateRecord(snapshot.data) || templateRecord(snapshot.menu) || {};
      var products = templateArray(menu.products);
      var pages = templatePages(products, orientation === "portrait" ? 10 : 8);
      return {
        pages: pages,
        render: function (page) {
          var grid = templateNode("div", "dynamic-menu-grid");
          var index;
          var product;
          var item;
          var copy;
          var price;
          body.innerHTML = "";
          if (!page.length) {
            body.appendChild(templateNode("div", "dynamic-empty", "Er zijn nu geen beschikbare producten."));
            return;
          }
          for (index = 0; index < page.length; index += 1) {
            product = templateRecord(page[index]) || {};
            if (!templateText(product.name, "")) continue;
            item = templateNode("article", "dynamic-menu-item");
            copy = templateNode("div", "");
            if (product.category) copy.appendChild(templateNode("small", "", templateText(product.category, "")));
            copy.appendChild(templateNode("h2", "", templateText(product.name, "Product")));
            if (product.description) copy.appendChild(templateNode("p", "", templateText(product.description, "")));
            price = templateNode("strong", "", templatePrice(product.priceMinor, templateText(product.currency, "EUR")));
            item.appendChild(copy);
            item.appendChild(price);
            grid.appendChild(item);
          }
          body.appendChild(grid);
        }
      };
    }
    function renderNewsTemplate(body, snapshot) {
      var news = templateRecord(snapshot.data) || templateRecord(snapshot.news) || {};
      var articles = templateArray(news.articles);
      return {
        pages: articles.length ? articles : [null],
        render: function (articleValue) {
          var article = templateRecord(articleValue);
          var wrapper;
          body.innerHTML = "";
          if (!article) {
            body.appendChild(templateNode("div", "dynamic-empty", "Er zijn nu geen nieuwsberichten."));
            return;
          }
          wrapper = templateNode("article", "dynamic-news");
          wrapper.appendChild(templateNode("p", "dynamic-news-meta", templateText(article.sourceName, templateText(news.sourceName, "Clubnieuws"))));
          wrapper.appendChild(templateNode("h2", "", templateText(article.title, "Clubnieuws")));
          if (article.intro) wrapper.appendChild(templateNode("p", "", templateText(article.intro, "")));
          body.appendChild(wrapper);
        }
      };
    }
    function splitTemplateTeams(value) {
      var parts = templateText(value, "").split(/\\s+[–—-]\\s+/);
      return [parts[0] || "Thuisteam", parts.slice(1).join(" – ") || "Uitteam"];
    }
    function renderMatchTeam(name) {
      var team = templateNode("article", "dynamic-team");
      team.appendChild(templateNode("div", "dynamic-team-mark", templateInitials(name)));
      team.appendChild(templateNode("h2", "", name));
      return team;
    }
    function renderSportTemplate(body, snapshot, slideType, orientation) {
      var sport = templateRecord(snapshot.sport) || {};
      var items = templateArray(sport.items);
      var match = slideType === "sport_match_of_the_day" || slideType === "sport_next_match";
      var pages = match ? [items.length ? items[0] : null] : templatePages(items, orientation === "portrait" ? 6 : 8);
      return {
        pages: pages,
        render: function (page) {
          var item;
          var teams;
          var centre;
          var meta;
          var list;
          var index;
          var row;
          var copy;
          body.innerHTML = "";
          if (match) {
            item = templateRecord(page);
            if (!item) {
              body.appendChild(templateNode("div", "dynamic-empty", "Deze wedstrijdinformatie is nog niet beschikbaar."));
              return;
            }
            teams = splitTemplateTeams(templateText(item.primary, ""));
            centre = templateNode("div", "dynamic-match");
            centre.appendChild(renderMatchTeam(teams[0]));
            meta = templateNode("div", "dynamic-match-meta");
            meta.appendChild(templateNode("small", "", templateText(item.status, "Programma")));
            meta.appendChild(templateNode("strong", "", templateText(item.secondary, "Tijd volgt")));
            meta.appendChild(templateNode("p", "", templateText(item.meta, "Locatie volgt")));
            centre.appendChild(meta);
            centre.appendChild(renderMatchTeam(teams[1]));
            body.appendChild(centre);
            return;
          }
          if (!page.length) {
            body.appendChild(templateNode("div", "dynamic-empty", "Deze clubinformatie is nu niet beschikbaar."));
            return;
          }
          list = templateNode("div", "dynamic-list");
          for (index = 0; index < page.length; index += 1) {
            item = templateRecord(page[index]) || {};
            if (!templateText(item.primary, "")) continue;
            row = templateNode("article", "dynamic-row");
            row.appendChild(templateNode("span", "", String(index + 1)));
            copy = templateNode("div", "");
            copy.appendChild(templateNode("h2", "", templateText(item.primary, "Clubinformatie")));
            if (item.secondary) copy.appendChild(templateNode("p", "", templateText(item.secondary, "")));
            row.appendChild(copy);
            row.appendChild(templateNode("strong", "", templateText(item.meta, templateText(item.status, ""))));
            list.appendChild(row);
          }
          body.appendChild(list);
        }
      };
    }
    function playDynamicTemplate(item, fallbackUrl) {
      var payload = item.dynamicTemplate;
      var snapshot = templateRecord(payload.data) || {};
      var root = templateNode("section", "dynamic-template");
      var header = templateNode("header", "");
      var body = templateNode("div", "dynamic-body");
      var footer = templateNode("footer", "");
      var sourceLabel = "VeyoCast ClubTV";
      var title = "Clubinformatie";
      var renderer;
      var pageIndex = 0;
      var accent = "#f15a24";
      var templateDuration;
      var brand = templateRecord(snapshot.brand);
      if (brand && typeof brand.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(brand.primaryColor)) {
        accent = brand.primaryColor;
      }
      root.className += payload.templateSlug.indexOf("dark") !== -1 ? " dark" : "";
      root.className += payload.orientation === "portrait" ? " portrait" : "";
      root.style.setProperty("--accent", accent);
      if (payload.slideType === "menu") {
        sourceLabel = "Clubkantine";
        title = templateText((templateRecord(snapshot.data) || {}).title, "Menu vandaag");
        renderer = renderMenuTemplate(body, snapshot, payload.orientation);
      } else if (payload.slideType === "news") {
        sourceLabel = "Clubnieuws";
        title = "Het laatste nieuws";
        renderer = renderNewsTemplate(body, snapshot);
      } else {
        sourceLabel = payload.slideType.indexOf("standing") !== -1 ? "Competitie" : "Match centre";
        title = templateText((templateRecord(snapshot.sport) || {}).title, sportTemplateTitle(payload.slideType));
        renderer = renderSportTemplate(body, snapshot, payload.slideType, payload.orientation);
      }
      header.appendChild(templateNode("p", "", sourceLabel));
      header.appendChild(templateNode("h1", "", title));
      footer.appendChild(templateNode("span", "", "VeyoCast ClubTV"));
      footer.appendChild(templateNode("span", "dynamic-page-number", renderer.pages.length > 1 ? "1 / " + String(renderer.pages.length) : "Live clubinformatie"));
      root.appendChild(header);
      root.appendChild(body);
      root.appendChild(footer);
      byId("media-root").appendChild(root);
      runtime.currentElement = root;
      renderer.render(renderer.pages[0]);
      templateDuration = Math.max(
        itemDurationMs(item),
        renderer.pages.length * 5000
      );
      if (renderer.pages.length > 1) {
        runtime.templateTimer = window.setInterval(function () {
          var number;
          if (runtime.currentElement !== root) return;
          pageIndex = (pageIndex + 1) % renderer.pages.length;
          renderer.render(renderer.pages[pageIndex]);
          number = root.querySelector(".dynamic-page-number");
          if (number) number.textContent = String(pageIndex + 1) + " / " + String(renderer.pages.length);
        }, Math.floor(templateDuration / renderer.pages.length));
      }
      mediaReady();
      runtime.playbackTimer = window.setTimeout(nextItem, templateDuration);
      log("LEGACY_TEMPLATE_READY", payload.slideType + " " + payload.templateSlug);
    }
    function playImage(item, sourceUrl) {
      var image;
      image = document.createElement("img");
      image.alt = item.accessibilityName || item.displayTitle || item.title || "";
      mediaStyle(item, image);
      image.onload = function () {
        mediaReady();
        runtime.playbackTimer = window.setTimeout(nextItem, itemDurationMs(item));
      };
      image.onerror = function () { failItem("LEGACY_IMAGE_ERROR"); };
      runtime.currentElement = image;
      byId("media-root").appendChild(image);
      runtime.watchdogTimer = window.setTimeout(function () {
        failItem("LEGACY_IMAGE_TIMEOUT");
      }, 12000);
      image.src = sourceUrl;
    }
    function playVideo(item, sourceUrl) {
      var video;
      video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.autoplay = false;
      video.controls = false;
      video.muted = true;
      video.defaultMuted = true;
      mediaStyle(item, video);
      video.onloadedmetadata = function () {
        var start = item.trim && Number(item.trim.startSeconds);
        if (isFinite(start) && start > 0) {
          try { video.currentTime = start; } catch (error) {}
        }
        startVideo(video);
      };
      video.oncanplay = function () { startVideo(video); };
      video.onplaying = function () {
        runtime.lastProgressAt = now();
        mediaReady();
      };
      video.ontimeupdate = function () {
        runtime.lastProgressAt = now();
        if (
          item.trim &&
          isFinite(Number(item.trim.endSeconds)) &&
          video.currentTime >= Number(item.trim.endSeconds)
        ) {
          nextItem();
        }
      };
      video.onended = nextItem;
      video.onerror = function () { failItem("LEGACY_VIDEO_ERROR"); };
      runtime.currentElement = video;
      byId("media-root").appendChild(video);
      runtime.watchdogTimer = window.setTimeout(function () {
        if (!video || video.paused || video.readyState < 2) {
          failItem("LEGACY_VIDEO_START_TIMEOUT");
        }
      }, CONFIG.videoStartTimeoutMs);
      runtime.progressTimer = window.setInterval(function () {
        if (
          runtime.currentElement === video &&
          !video.paused &&
          runtime.lastProgressAt &&
          now() - runtime.lastProgressAt > CONFIG.videoProgressTimeoutMs
        ) {
          failItem("LEGACY_VIDEO_STALLED");
        }
      }, 2000);
      video.src = sourceUrl;
      try { video.load(); } catch (error) {}
      startVideo(video);
    }
    function startVideo(video) {
      var result;
      if (runtime.currentElement !== video) return;
      try {
        video.muted = true;
        result = video.play();
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {}
    }
    function failItem(code) {
      var item = runtime.currentItem;
      var key = item ? item.id : "missing";
      var attempts = runtime.itemFailures[key] || 0;
      runtime.itemFailures[key] = attempts + 1;
      log(code, key);
      if (attempts === 0 && runtime.releaseSource === "online") {
        clearMedia();
        cachedItemUrl(item, function (cachedUrl) {
          if (!cachedUrl) {
            nextItem();
            return;
          }
          runtime.releaseSource = "cache";
          runtime.offline = true;
          byId("offline").className = "visible";
          if (item.kind === "video") playVideo(item, cachedUrl);
          else playImage(item, cachedUrl);
        });
        return;
      }
      nextItem();
    }
    function nextItem() {
      var items = playableItems(runtime.envelope);
      clearMedia();
      if (!items.length) return;
      runtime.activeIndex = (runtime.activeIndex + 1) % items.length;
      if (Object.keys(runtime.itemFailures).length >= items.length) {
        showStatus(
          "Playback herstelt",
          "Content kon niet veilig starten",
          "De Player blijft het manifest controleren en toont geen leeg wit scherm.",
          "LEGACY_RELEASE_UNPLAYABLE"
        );
        setState("ERROR_RECOVERABLE");
        scheduleManifestSync(15000);
        return;
      }
      playCurrent();
    }
    function heartbeatBody() {
      var manifest = runtime.envelope && runtime.envelope.manifest;
      var device = runtime.envelope && runtime.envelope.device;
      return {
        activeReleaseId: manifest ? manifest.releaseId : null,
        currentItemId: runtime.currentItem ? runtime.currentItem.id : null,
        desiredReleaseId: device ? device.desiredReleaseId : null,
        networkState: runtime.offline ? "offline" : "online",
        runtimeState:
          runtime.state === "OFFLINE_PLAYING"
            ? "OFFLINE_PLAYING"
            : runtime.state === "PLAYING"
              ? "PLAYING"
              : runtime.state === "ERROR_RECOVERABLE"
                ? "ERROR_RECOVERABLE"
                : "READY",
        syncPhase: manifest ? "active" : null
      };
    }
    function sendHeartbeat() {
      if (!runtime.deviceToken) return;
      request(
        "POST",
        "/api/player/heartbeat",
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Content-Type": "application/json"
        },
        JSON.stringify(heartbeatBody()),
        function (transport, status, body) {
          var code = errorCode(body, transport || "PLAYER_API_UNAVAILABLE");
          if (
            !transport &&
            (status === 401 || status === 403 || status === 410) &&
            definitiveCredentialCodes[code]
          ) {
            clearInvalidDeviceCredential();
            ensurePairing();
          }
        }
      );
    }
    function readExecutedCommands() {
      var values = parseJson(safeRead(CONFIG.executedCommandsKey));
      return Array.isArray(values) ? values : [];
    }
    function rememberCommand(nonce) {
      var values = readExecutedCommands().filter(function (value) {
        return typeof value === "string" && value !== nonce;
      });
      values.push(nonce);
      safeWrite(CONFIG.executedCommandsKey, JSON.stringify(values.slice(-80)));
    }
    function commandRequest(command, phase, failureCode, callback) {
      request(
        "POST",
        "/api/player/commands",
        {
          Authorization: "Bearer " + runtime.installationCredential,
          "Content-Type": "application/json"
        },
        JSON.stringify({
          commandId: command.id,
          commandType: command.commandType,
          failureCode: failureCode || undefined,
          phase: phase
        }),
        function (transport, status, body) {
          callback(!transport && status >= 200 && status < 300, body);
        }
      );
    }
    function executeCommand(command, serverNow) {
      var executed = readExecutedCommands();
      var alreadyExecuted;
      var expiresAt;
      if (
        !command ||
        typeof command.id !== "string" ||
        typeof command.nonce !== "string"
      ) return;
      expiresAt = parsePlayerTimestamp(command.expiresAt);
      if (
        serverNow === null ||
        expiresAt === null ||
        expiresAt <= serverNow
      ) return;
      alreadyExecuted = executed.indexOf(command.nonce) !== -1;
      commandRequest(command, "acknowledged", null, function (acknowledged) {
        if (!acknowledged) return;
        if (!alreadyExecuted) rememberCommand(command.nonce);
        commandRequest(command, "completed", null, function (completed, body) {
          if (!completed) return;
          if (command.commandType === "RECOVER_PAIRING" && validCredential(body && body.deviceToken)) {
            persistDeviceToken(body.deviceToken);
            clearTemporaryPairing();
            syncManifest();
          } else if (command.commandType === "FORCE_UNPAIR") {
            clearInvalidDeviceCredential();
            ensurePairing();
          } else if (command.commandType === "RELOAD_PLAYER") {
            window.location.reload();
          }
        });
      });
    }
    function pollCommands() {
      if (!runtime.installationCredential) return;
      request(
        "GET",
        "/api/player/commands",
        { Authorization: "Bearer " + runtime.installationCredential },
        null,
        function (transport, status, body) {
          var commands;
          var index;
          var serverNow;
          if (transport || status < 200 || status >= 300 || !body) return;
          serverNow = parsePlayerTimestamp(body.serverTime);
          if (serverNow === null) {
            log(
              "LEGACY_COMMAND_TIME_INVALID",
              "De commandresponse bevat geen geldige servertijd."
            );
            return;
          }
          if (
            Math.abs(now() - serverNow) > 60000 &&
            now() - runtime.lastClockSkewLoggedAt > 600000
          ) {
            runtime.lastClockSkewLoggedAt = now();
            log(
              "LEGACY_CLOCK_SKEW",
              "Tv-klok wijkt " +
                String(Math.round((now() - serverNow) / 1000)) +
                " seconden af; servertijd wordt gebruikt."
            );
          }
          commands = Array.isArray(body.commands) ? body.commands : [];
          for (index = 0; index < commands.length; index += 1) {
            executeCommand(commands[index], serverNow);
          }
        }
      );
    }
    function recoverCachedDeviceToken(callback) {
      var open;
      var stores = [CONFIG.activeReleaseStore, CONFIG.previousReleaseStore];
      var storeIndex = 0;
      var latestToken = null;
      var latestActivatedAt = 0;
      var finished = false;

      function finish(value) {
        if (finished) return;
        finished = true;
        callback(value);
      }
      if (!window.indexedDB) {
        finish(null);
        return;
      }
      try {
        open = window.indexedDB.open(CONFIG.databaseName);
      } catch (error) {
        finish(null);
        return;
      }
      open.onerror = function () { finish(null); };
      open.onsuccess = function () {
        var database = open.result;

        function scanNextStore() {
          var transaction;
          var requestResult;
          var storeName;
          if (storeIndex >= stores.length) {
            database.close();
            finish(latestToken);
            return;
          }
          storeName = stores[storeIndex];
          storeIndex += 1;
          if (!database.objectStoreNames.contains(storeName)) {
            scanNextStore();
            return;
          }
          try {
            transaction = database.transaction(storeName, "readonly");
            requestResult = transaction.objectStore(storeName).openCursor();
          } catch (error) {
            scanNextStore();
            return;
          }
          requestResult.onerror = function () { scanNextStore(); };
          requestResult.onsuccess = function () {
            var cursor = requestResult.result;
            var candidate;
            var activatedAt;
            if (!cursor) {
              scanNextStore();
              return;
            }
            candidate = cursor.value;
            activatedAt = new Date(
              candidate && candidate.activatedAt || ""
            ).getTime();
            if (
              candidate &&
              validCredential(candidate.deviceToken) &&
              candidate.envelope &&
              isManifestEnvelope(candidate.envelope) &&
              (!latestToken ||
                (isFinite(activatedAt) && activatedAt > latestActivatedAt))
            ) {
              latestToken = candidate.deviceToken;
              latestActivatedAt = isFinite(activatedAt) ? activatedAt : 0;
            }
            cursor.continue();
          };
        }
        scanNextStore();
      };
    }
    function boot() {
      var generation;
      runtime.bootGeneration += 1;
      generation = runtime.bootGeneration;
      runtime.installationId = ensureInstallationId();
      runtime.installationCredential = safeRead(CONFIG.installationCredentialKey);
      if (!validCredential(runtime.installationCredential)) {
        runtime.installationCredential = null;
      }
      runtime.deviceToken = readDeviceToken();
      setState("INSTALLATION_REGISTERING");
      showStatus(
        "LG Legacy Player",
        "Player starten",
        "Installatie, koppeling en laatste geldige release worden gecontroleerd.",
        ""
      );
      function continueBoot() {
        if (generation !== runtime.bootGeneration) return;
        registerInstallation(function (ok, code, retryAfter) {
          if (generation !== runtime.bootGeneration) return;
          if (!ok) {
            scheduleBoot(
              code || "INSTALLATION_API_UNAVAILABLE",
              "De installatie kon tijdelijk niet worden gecontroleerd.",
              retryAfter
            );
            return;
          }
          runtime.syncFailures = 0;
          if (runtime.deviceToken) syncManifest();
          else ensurePairing();
        });
      }
      if (runtime.deviceToken) {
        continueBoot();
        return;
      }
      recoverCachedDeviceToken(function (recoveredToken) {
        if (generation !== runtime.bootGeneration) return;
        if (recoveredToken && persistDeviceToken(recoveredToken)) {
          log(
            "LEGACY_DEVICE_CREDENTIAL_RECOVERED",
            "Credential hersteld uit geverifieerde lokale release."
          );
        }
        continueBoot();
      });
    }
    window.onerror = function (message) {
      log("LEGACY_CLIENT_EXCEPTION", String(message || "onbekende fout"));
      showStatus(
        "Playerherstel",
        "De eenvoudige Player herstelt",
        "Een lokale JavaScript-fout is opgevangen. De Player probeert gecontroleerd opnieuw.",
        "LEGACY_CLIENT_EXCEPTION"
      );
      window.setTimeout(boot, 5000);
      return true;
    };
    window.onunhandledrejection = function () {
      log("LEGACY_PROMISE_REJECTION", "onafgehandelde browserbelofte");
    };
    window.setInterval(sendHeartbeat, CONFIG.heartbeatIntervalMs);
    window.setInterval(pollCommands, CONFIG.commandIntervalMs);
    window.addEventListener("online", function () {
      runtime.offline = false;
      syncManifest();
    });
    window.addEventListener("offline", function () {
      restoreLastKnownGood(function () {});
    });
    boot();
  }());
  </script>
</body>
</html>`;
}
