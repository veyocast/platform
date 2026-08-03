const probeConfiguration = {
  assetCacheNames: [
    "veyocast-player-assets-v1",
    "castivo-player-assets-v1"
  ],
  cachedAssetPrefix: "/__veyocast-player-cache/",
  deviceTokenKeys: [
    "veyocast.player.deviceToken",
    "castivo.player.deviceToken"
  ],
  installationKeys: [
    "veyocast.player.instanceId",
    "castivo.player.instanceId"
  ],
  legacyDiagnosticsKey: "veyocast.player.lgLegacyDiagnostics.v1",
  probeDatabaseName: "veyocast-lg-probe-v1",
  probeResultKey: "veyocast.player.lgProbe.v1",
  probeStorageKey: "veyocast.player.lgProbe.storageCheck",
  referenceVideoMimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  referenceVideoUrl: "/lg-probe/h264-baseline-aac.mp4"
};

export function renderLgProbeHtml() {
  const configuration = JSON.stringify(probeConfiguration).replaceAll(
    "<",
    "\\u003c"
  );

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>VeyoCast LG diagnose</title>
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; background: #090a0c; color: #f8f6f1; font-family: Arial, Helvetica, sans-serif; }
    body { padding: 4vh 4vw; }
    button, a { font: inherit; }
    .shell { width: 100%; max-width: 1500px; margin: 0 auto; }
    .brand { display: block; width: 230px; max-width: 40vw; height: auto; margin-bottom: 3vh; }
    .eyebrow { margin: 0 0 10px; color: #ff5a1f; font-size: 16px; font-weight: bold; letter-spacing: .11em; text-transform: uppercase; }
    h1 { max-width: 920px; margin: 0; font-size: clamp(38px, 5vw, 76px); line-height: .98; letter-spacing: -.045em; }
    .lead { max-width: 1050px; margin: 18px 0 0; color: #c8c8c4; font-size: clamp(18px, 1.65vw, 28px); line-height: 1.45; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(360px, .75fr); gap: 24px; margin-top: 4vh; }
    .panel { overflow: hidden; border: 1px solid #383b41; border-radius: 20px; background: #14161a; box-shadow: 0 20px 70px rgba(0,0,0,.25); }
    .panel-heading { padding: 22px 26px; border-bottom: 1px solid #34373c; }
    .panel-heading h2 { margin: 0; font-size: 25px; }
    .panel-heading p { margin: 7px 0 0; color: #aeb0b3; font-size: 16px; line-height: 1.45; }
    .steps { margin: 0; padding: 0; list-style: none; }
    .step { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 14px; min-height: 92px; padding: 18px 26px; border-bottom: 1px solid #2f3237; }
    .step:last-child { border-bottom: 0; }
    .mark { padding-top: 2px; color: #aeb0b3; font-size: 17px; font-weight: bold; letter-spacing: .04em; }
    .step-running .mark { color: #6daaff; }
    .step-pass .mark { color: #48dc86; }
    .step-warn .mark { color: #ffc04b; }
    .step-fail .mark { color: #ff6f69; }
    .step h3 { margin: 0; font-size: 20px; line-height: 1.25; }
    .step p { margin: 6px 0 0; color: #b8b9bc; font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; }
    .media-stage { position: relative; min-height: 310px; padding: 22px; display: flex; align-items: center; justify-content: center; background: #050607; border-bottom: 1px solid #34373c; }
    .media-stage img, .media-stage video { display: none; width: 100%; max-height: 42vh; object-fit: contain; background: #000; }
    .media-stage .visible { display: block; }
    .stage-placeholder { max-width: 420px; color: #8f9296; text-align: center; font-size: 17px; line-height: 1.5; }
    .result { padding: 22px 26px; }
    .result-label { margin: 0 0 7px; color: #aeb0b3; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; }
    .result-code { margin: 0; font-family: monospace; font-size: 21px; font-weight: bold; overflow-wrap: anywhere; }
    .summary { margin: 12px 0 0; color: #d9dad7; font-size: 16px; line-height: 1.5; }
    details { border-top: 1px solid #34373c; padding: 18px 26px; }
    summary { cursor: pointer; font-size: 16px; font-weight: bold; }
    pre { max-height: 280px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; margin: 14px 0 0; padding: 16px; border-radius: 10px; background: #08090b; color: #bfc5cd; font: 13px/1.5 monospace; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
    .button { min-height: 48px; padding: 13px 19px; border: 1px solid #51545a; border-radius: 10px; color: #f8f6f1; background: #191b20; text-decoration: none; cursor: pointer; }
    .button-primary { border-color: #ff5a1f; background: #ff5a1f; color: #090a0c; font-weight: bold; }
    .button:focus { outline: 3px solid #74a9ff; outline-offset: 3px; }
    .note { margin: 18px 0 0; color: #9fa2a5; font-size: 14px; line-height: 1.5; }
    @media (max-width: 900px) {
      body { padding: 24px 18px 40px; }
      .layout { grid-template-columns: 1fr; }
      .step { grid-template-columns: 58px minmax(0, 1fr); padding: 16px 18px; }
      .panel-heading, .result, details { padding-left: 18px; padding-right: 18px; }
      .media-stage { min-height: 230px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <img class="brand" src="/brand/veyocast-logo-inverse.svg" alt="VeyoCast">
    <p class="eyebrow">LG compatibiliteitsprobe</p>
    <h1>We meten wat deze televisie werkelijk kan</h1>
    <p class="lead">Deze zelfstandige pagina verandert geen koppeling of release. Iedere laag wordt apart getest, zodat een codec-, netwerk-, geheugen-, cache- of serviceworkerprobleem zichtbaar wordt.</p>

    <div class="layout">
      <section class="panel" aria-labelledby="checks-heading">
        <div class="panel-heading">
          <h2 id="checks-heading">Diagnose wordt uitgevoerd</h2>
          <p>Laat deze pagina open tot onderaan een diagnosecode verschijnt.</p>
        </div>
        <ol class="steps">
          <li class="step" id="step-platform"><div class="mark">WACHT</div><div><h3>Browser en opslag</h3><p>Browserfuncties en geïsoleerde opslagproeven.</p></div></li>
          <li class="step" id="step-origin"><div class="mark">WACHT</div><div><h3>VeyoCast-origin</h3><p>De Player-server en een ingebouwde afbeelding.</p></div></li>
          <li class="step" id="step-reference"><div class="mark">WACHT</div><div><h3>VeyoCast-videoreferentie</h3><p>Een kleine H.264 Baseline/AAC-LC-video op dezelfde VeyoCast-origin test de LG-videodecoder.</p></div></li>
          <li class="step" id="step-manifest"><div class="mark">WACHT</div><div><h3>Koppeling en actieve release</h3><p>Alleen lezen; de bestaande schermkoppeling blijft behouden.</p></div></li>
          <li class="step" id="step-template"><div class="mark">WACHT</div><div><h3>Dynamische HTML/CSS-slide</h3><p>Controleert het Editorial Arena-contract en het laatste lokale renderresultaat van de legacy Player.</p></div></li>
          <li class="step" id="step-direct"><div class="mark">WACHT</div><div><h3>Actief bestand rechtstreeks</h3><p>Test de eerste actieve video, of anders het eerste afspeelbare item, buiten de VeyoCast-cache.</p></div></li>
          <li class="step" id="step-blob"><div class="mark">WACHT</div><div><h3>Actief bestand als Blob</h3><p>Test de huidige geheugenroute zonder serviceworker.</p></div></li>
          <li class="step" id="step-cache"><div class="mark">WACHT</div><div><h3>Bestaande Player-cache</h3><p>Test exact het serviceworker- en byte-rangepad van normale playback.</p></div></li>
        </ol>
      </section>

      <aside class="panel" aria-labelledby="surface-heading">
        <div class="panel-heading">
          <h2 id="surface-heading">Zichtbare renderproef</h2>
          <p>Video en beeld worden hier echt door de LG gerenderd.</p>
        </div>
        <div class="media-stage" id="media-stage">
          <div class="stage-placeholder" id="stage-placeholder">De renderproef start na de basiscontrole.</div>
          <img id="probe-image" alt="VeyoCast afbeeldingstest">
          <video id="probe-video" muted playsinline preload="auto"></video>
        </div>
        <div class="result" aria-live="polite">
          <p class="result-label">Diagnosecode</p>
          <p class="result-code" id="result-code">WORDT GEMAAKT</p>
          <p class="summary" id="result-summary">De controles zijn nog bezig.</p>
        </div>
        <details>
          <summary>Technische details</summary>
          <pre id="technical-log">Probe gestart…</pre>
        </details>
      </aside>
    </div>

    <div class="actions">
      <button class="button button-primary" id="run-again" type="button">Probe opnieuw uitvoeren</button>
      <a class="button" href="/lg">Player openen</a>
      <a class="button" href="/lg/recover">Player herstellen</a>
    </div>
    <p class="note">De probe wist geen installatie-ID, devicecredential, release of VeyoCast-cache. Alleen eigen tijdelijke testrecords worden na de controle opgeruimd. Deel de diagnosecode met VeyoCast Support.</p>
  </main>

  <script>
  (function () {
    "use strict";
    var CONFIG = ${configuration};
    var results = [];
    var manifest = null;
    var activeItem = null;
    var deviceToken = null;
    var objectUrl = null;
    var runId = 0;
    var stopped = false;

    function byId(id) {
      return document.getElementById(id);
    }

    function nowIso() {
      try { return new Date().toISOString(); } catch (error) { return String(new Date()); }
    }

    function safeText(value) {
      var text = "";
      try { text = String(value == null ? "" : value); } catch (error) { text = "onleesbare fout"; }
      text = text.replace(/https?:\\/\\/[^\\s"'<>]+/gi, "[url]");
      text = text.replace(/[A-Za-z0-9_-]{32,}/g, "[id]");
      return text.slice(0, 240);
    }

    function log(message) {
      var current = byId("technical-log").textContent;
      var line = nowIso() + " | " + safeText(message);
      byId("technical-log").textContent = current === "Probe gestart…" ? line : current + "\\n" + line;
    }

    function record(id, status, code, detail) {
      var entry = { id: id, status: status, code: safeText(code), detail: safeText(detail) };
      results.push(entry);
      log(id + " | " + status + " | " + code + " | " + detail);
    }

    function setStep(id, status, detail) {
      var row = byId("step-" + id);
      if (!row) return;
      row.className = "step step-" + status;
      row.getElementsByClassName("mark")[0].textContent =
        status === "running" ? "TEST" :
        status === "pass" ? "OK" :
        status === "warn" ? "LET OP" :
        status === "fail" ? "FOUT" : "WACHT";
      if (detail) row.getElementsByTagName("p")[0].textContent = safeText(detail);
    }

    function wait(milliseconds) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, milliseconds);
      });
    }

    function withTimeout(promise, milliseconds, code) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = window.setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(new Error(code || "PROBE_TIMEOUT"));
        }, milliseconds);
        promise.then(function (value) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        }, function (error) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          reject(error);
        });
      });
    }

    function xhr(method, url, options) {
      options = options || {};
      return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        var finished = false;
        var timer = window.setTimeout(function () {
          if (finished) return;
          finished = true;
          try { request.abort(); } catch (error) {}
          reject(new Error("XHR_TIMEOUT"));
        }, options.timeout || 15000);
        request.open(method, url, true);
        if (options.responseType) request.responseType = options.responseType;
        if (options.headers) {
          Object.keys(options.headers).forEach(function (name) {
            request.setRequestHeader(name, options.headers[name]);
          });
        }
        request.onload = function () {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          resolve(request);
        };
        request.onerror = function () {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          reject(new Error("XHR_NETWORK_ERROR"));
        };
        request.onabort = function () {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          reject(new Error("XHR_ABORTED"));
        };
        request.send(options.body || null);
      });
    }

    function firstStored(keys) {
      var index;
      for (index = 0; index < keys.length; index += 1) {
        try {
          var value = window.localStorage.getItem(keys[index]);
          if (value) return value;
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    function testLocalStorage() {
      try {
        var value = "ok-" + String(Date.now());
        window.localStorage.setItem(CONFIG.probeStorageKey, value);
        var read = window.localStorage.getItem(CONFIG.probeStorageKey);
        window.localStorage.removeItem(CONFIG.probeStorageKey);
        return Promise.resolve(read === value);
      } catch (error) {
        return Promise.reject(error);
      }
    }

    function testCacheStorage() {
      if (!window.caches || !window.caches.open) return Promise.resolve("unsupported");
      var cacheName = CONFIG.probeDatabaseName;
      var key = "/lg/probe/cache-check-" + String(Date.now());
      return window.caches.open(cacheName).then(function (cache) {
        return cache.put(key, new Response("ok", { headers: { "Content-Type": "text/plain" } })).then(function () {
          return cache.match(key);
        });
      }).then(function (response) {
        if (!response) throw new Error("CACHE_READ_EMPTY");
        return response.text();
      }).then(function (value) {
        return window.caches.delete(cacheName).then(function () { return value === "ok"; });
      }, function (error) {
        return window.caches.delete(cacheName).then(function () { throw error; }, function () { throw error; });
      });
    }

    function testIndexedDb() {
      if (!window.indexedDB) return Promise.resolve("unsupported");
      return new Promise(function (resolve, reject) {
        var open;
        try { open = window.indexedDB.open(CONFIG.probeDatabaseName, 1); } catch (error) { reject(error); return; }
        open.onupgradeneeded = function () {
          var database = open.result;
          if (!database.objectStoreNames.contains("checks")) database.createObjectStore("checks");
        };
        open.onerror = function () { reject(open.error || new Error("IDB_OPEN_FAILED")); };
        open.onsuccess = function () {
          var database = open.result;
          var transaction;
          try {
            transaction = database.transaction("checks", "readwrite");
            transaction.objectStore("checks").put("ok", "latest");
          } catch (error) {
            database.close();
            reject(error);
            return;
          }
          transaction.oncomplete = function () {
            var readTransaction;
            try {
              readTransaction = database.transaction("checks", "readonly");
              var read = readTransaction.objectStore("checks").get("latest");
              read.onsuccess = function () {
                var ok = read.result === "ok";
                database.close();
                try { window.indexedDB.deleteDatabase(CONFIG.probeDatabaseName); } catch (error) {}
                resolve(ok);
              };
              read.onerror = function () {
                database.close();
                reject(read.error || new Error("IDB_READ_FAILED"));
              };
            } catch (error) {
              database.close();
              reject(error);
            }
          };
          transaction.onerror = function () {
            database.close();
            reject(transaction.error || new Error("IDB_WRITE_FAILED"));
          };
        };
      });
    }

    function testCrypto() {
      if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === "undefined") {
        return Promise.resolve("unsupported");
      }
      try {
        return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode("veyocast-lg-probe")).then(function (hash) {
          return hash && hash.byteLength === 32;
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }

    function testPlatform(currentRun) {
      setStep("platform", "running", "Browserfuncties en opslag worden gecontroleerd.");
      var serviceWorkerState = navigator.serviceWorker && navigator.serviceWorker.controller ? "controller-actief" : "geen-controller";
      var identity = firstStored(CONFIG.installationKeys) ? "installatie-id-aanwezig" : "geen-installatie-id";
      log("platform | ua=" + safeText(navigator.userAgent));
      log("platform | viewport=" + window.innerWidth + "x" + window.innerHeight + " | online=" + String(navigator.onLine) + " | sw=" + serviceWorkerState + " | " + identity);
      return Promise.all([
        testLocalStorage(),
        testCacheStorage(),
        testIndexedDb(),
        testCrypto()
      ]).then(function (checks) {
        if (currentRun !== runId) return;
        var failed = checks.some(function (value) { return value === false; });
        var unsupported = checks.filter(function (value) { return value === "unsupported"; }).length;
        var status = failed ? "fail" : unsupported ? "warn" : "pass";
        var detail = "localStorage=" + String(checks[0]) + ", Cache API=" + String(checks[1]) + ", IndexedDB=" + String(checks[2]) + ", SHA-256=" + String(checks[3]) + ", SW=" + serviceWorkerState + ".";
        setStep("platform", status, detail);
        record("platform", status, failed ? "PLATFORM_STORAGE_FAILED" : unsupported ? "PLATFORM_PARTIAL" : "PLATFORM_OK", detail);
      }).catch(function (error) {
        setStep("platform", "fail", "Een browser- of opslagproef stopte: " + safeText(error && error.message));
        record("platform", "fail", "PLATFORM_EXCEPTION", error && error.message);
      });
    }

    function showImage(url) {
      return new Promise(function (resolve, reject) {
        var image = byId("probe-image");
        var video = byId("probe-video");
        var preservedObjectUrl = objectUrl && url === objectUrl ? objectUrl : null;
        if (preservedObjectUrl) objectUrl = null;
        stopVideo();
        if (preservedObjectUrl) objectUrl = preservedObjectUrl;
        byId("stage-placeholder").style.display = "none";
        video.className = "";
        image.className = "visible";
        var timer = window.setTimeout(function () {
          image.onload = null;
          image.onerror = null;
          reject(new Error("IMAGE_TIMEOUT"));
        }, 10000);
        image.onload = function () {
          window.clearTimeout(timer);
          resolve({ height: image.naturalHeight, width: image.naturalWidth });
        };
        image.onerror = function () {
          window.clearTimeout(timer);
          reject(new Error("IMAGE_DECODE_FAILED"));
        };
        image.src = url;
      });
    }

    function stopVideo() {
      var video = byId("probe-video");
      try { video.pause(); } catch (error) {}
      try {
        video.removeAttribute("src");
        video.load();
      } catch (error) {}
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (error) {}
        objectUrl = null;
      }
    }

    function mediaErrorDetail(video) {
      var mediaError = video.error;
      return "mediaError=" + (mediaError ? String(mediaError.code) : "geen") +
        ", readyState=" + String(video.readyState) +
        ", networkState=" + String(video.networkState);
    }

    function playVideo(url, timeoutMilliseconds) {
      return new Promise(function (resolve, reject) {
        var video = byId("probe-video");
        var image = byId("probe-image");
        var finished = false;
        var metadataSeen = false;
        var startedAt = 0;
        var preservedObjectUrl = objectUrl && url === objectUrl ? objectUrl : null;
        if (preservedObjectUrl) objectUrl = null;
        stopVideo();
        if (preservedObjectUrl) objectUrl = preservedObjectUrl;
        image.className = "";
        byId("stage-placeholder").style.display = "none";
        video.className = "visible";
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("muted", "muted");
        video.setAttribute("playsinline", "playsinline");

        function finish(ok, code) {
          if (finished) return;
          finished = true;
          window.clearInterval(progressTimer);
          window.clearTimeout(timeoutTimer);
          video.onloadedmetadata = null;
          video.onplaying = null;
          video.onerror = null;
          video.onstalled = null;
          video.onabort = null;
          var detail = {
            code: code,
            currentTime: Number(video.currentTime || 0).toFixed(2),
            duration: isFinite(video.duration) ? Number(video.duration).toFixed(2) : "onbekend",
            height: Number(video.videoHeight || 0),
            media: mediaErrorDetail(video),
            metadataSeen: metadataSeen,
            width: Number(video.videoWidth || 0)
          };
          if (ok) resolve(detail);
          else reject(new Error(code + " | " + detail.media + " | t=" + detail.currentTime + " | " + detail.width + "x" + detail.height));
        }

        var progressTimer = window.setInterval(function () {
          if (video.currentTime > 0.75) finish(true, "VIDEO_ADVANCED");
          else if (startedAt && Date.now() - startedAt > 5000) finish(false, "VIDEO_NO_PROGRESS");
        }, 250);
        var timeoutTimer = window.setTimeout(function () {
          finish(false, metadataSeen ? "VIDEO_START_TIMEOUT" : "VIDEO_METADATA_TIMEOUT");
        }, timeoutMilliseconds || 15000);
        video.onloadedmetadata = function () {
          metadataSeen = true;
          if (!video.videoWidth || !video.videoHeight) finish(false, "VIDEO_ZERO_DIMENSIONS");
        };
        video.onplaying = function () {
          startedAt = Date.now();
        };
        video.onerror = function () { finish(false, "VIDEO_ELEMENT_ERROR"); };
        video.onstalled = function () { log("video | stalled | " + mediaErrorDetail(video)); };
        video.onabort = function () { if (!finished) finish(false, "VIDEO_ABORTED"); };
        try {
          video.src = url;
          video.load();
          var playResult = video.play();
          if (playResult && playResult.catch) {
            playResult.catch(function (error) {
              finish(false, "VIDEO_PLAY_REJECTED_" + safeText(error && error.name));
            });
          }
        } catch (error) {
          finish(false, "VIDEO_SETUP_EXCEPTION_" + safeText(error && error.name));
        }
      });
    }

    function testOrigin(currentRun) {
      setStep("origin", "running", "Server en ingebouwde afbeelding worden gecontroleerd.");
      var healthCheck = xhr("GET", "/api/health?probe=" + String(Date.now()), { timeout: 10000 }).then(function (request) {
        return { ok: request.status >= 200 && request.status < 300, status: request.status };
      }, function (error) {
        return { error: safeText(error && error.message), ok: false, status: 0 };
      });
      var imageCheck = showImage("/brand/veyocast-icon-maskable-512.png?probe=" + String(Date.now())).then(function (image) {
        return { image: image, ok: true };
      }, function (error) {
        return { error: safeText(error && error.message), ok: false };
      });
      return Promise.all([healthCheck, imageCheck]).then(function (checks) {
        if (currentRun !== runId) return;
        var health = checks[0];
        var rendered = checks[1];
        if (health.ok && rendered.ok) {
          var passed = "VeyoCast API gezond; PNG gerenderd op " + rendered.image.width + "x" + rendered.image.height + ".";
          setStep("origin", "pass", passed);
          record("origin", "pass", "ORIGIN_OK", passed);
          return;
        }
        if (rendered.ok) {
          var apiUnavailable = "Player-origin en PNG werken, maar de API-healthcheck antwoordt HTTP " + health.status + ".";
          setStep("origin", "warn", apiUnavailable);
          record("origin", "warn", "PLAYER_API_UNHEALTHY", apiUnavailable);
          return;
        }
        var detail = "PNG-rendering faalde (" + rendered.error + "); API-health HTTP " + health.status + ".";
        setStep("origin", "fail", detail);
        record("origin", "fail", "ORIGIN_RENDER_FAILED", detail);
      });
    }

    function testReferenceVideo(currentRun) {
      var capability = "";
      try {
        capability = document.createElement("video").canPlayType(CONFIG.referenceVideoMimeType) || "leeg";
      } catch (error) {
        capability = "exception";
      }
      setStep("reference", "running", "Same-origin H.264 Baseline/AAC-LC-referentievideo wordt zichtbaar afgespeeld.");
      return playVideo(CONFIG.referenceVideoUrl + "?probe=" + String(Date.now()), 18000).then(function (video) {
        if (currentRun !== runId) return;
        var detail = "Same-origin referentievideo speelt: " + video.width + "x" + video.height + ", duur " + video.duration + " sec, canPlayType=" + capability + ".";
        setStep("reference", "pass", detail);
        record("reference", "pass", "REFERENCE_VIDEO_OK", detail);
      }).catch(function (error) {
        if (currentRun !== runId) return;
        var detail = "Same-origin referentievideo startte niet: " + safeText(error && error.message) + ", canPlayType=" + capability + ".";
        setStep("reference", "fail", detail);
        record("reference", "fail", "REFERENCE_VIDEO_FAILED", detail);
      });
    }

    function findActiveItem(body) {
      if (!body || !body.manifest || !body.manifest.items || !body.manifest.items.length) return null;
      var index;
      var firstPlayable = null;
      var firstVideo = null;
      for (index = 0; index < body.manifest.items.length; index += 1) {
        var item = body.manifest.items[index];
        if (item && item.enabled !== false && item.source && item.source.url) {
          if (!firstPlayable) firstPlayable = item;
          if (item.dynamicTemplate) return item;
          if (!firstVideo && item.kind === "video") firstVideo = item;
        }
      }
      return firstVideo || firstPlayable;
    }

    function testManifest(currentRun) {
      setStep("manifest", "running", "Lokale devicecredential en manifest worden alleen-lezen gecontroleerd.");
      deviceToken = firstStored(CONFIG.deviceTokenKeys);
      if (!deviceToken) {
        var missing = "Geen lokale devicecredential. Koppel de Player eerst of open /lg/recover.";
        setStep("manifest", "warn", missing);
        record("manifest", "warn", "PROBE_UNPAIRED", missing);
        return Promise.resolve();
      }
      return xhr("GET", "/api/player/manifest?probe=" + String(Date.now()), {
        headers: { "Authorization": "Bearer " + deviceToken, "Cache-Control": "no-store" },
        timeout: 15000
      }).then(function (request) {
        var body = null;
        try { body = JSON.parse(request.responseText || "null"); } catch (error) {}
        if (request.status < 200 || request.status >= 300) {
          var serverCode = body && body.error && body.error.code ? body.error.code : "HTTP_" + request.status;
          throw new Error(serverCode);
        }
        manifest = body;
        activeItem = findActiveItem(body);
        if (!activeItem) {
          var waiting = body && body.device && body.device.desiredReleaseId === null;
          var detail = waiting ? "Koppeling geldig; het scherm wacht op de eerste publicatie." : "Manifest bevat geen actief afspeelbaar item.";
          setStep("manifest", "warn", detail);
          record("manifest", "warn", waiting ? "WAITING_FOR_CONTENT" : "MANIFEST_EMPTY", detail);
          return;
        }
        var source = activeItem.source || {};
        var releaseId = body.manifest && body.manifest.releaseId ? "release aanwezig" : "release-id ontbreekt";
        var template = activeItem.dynamicTemplate;
        var templateDetail = template
          ? ", dynamisch=" + safeText(template.slideType) + "/" + safeText(template.templateSlug)
          : "";
        var detail = "Koppeling geldig; " + releaseId + "; eerste item=" + activeItem.kind + ", MIME=" + safeText(source.mimeType) + ", bytes=" + String(source.bytes || 0) + templateDetail + ".";
        setStep("manifest", "pass", detail);
        record("manifest", "pass", "MANIFEST_OK", detail);
      }).catch(function (error) {
        var detail = "Manifestcontrole faalde: " + safeText(error && error.message);
        setStep("manifest", "fail", detail);
        record("manifest", "fail", "MANIFEST_FAILED", detail);
      });
    }

    function readLegacyDiagnostics() {
      var entries = null;
      try {
        entries = JSON.parse(
          window.localStorage.getItem(CONFIG.legacyDiagnosticsKey) || "null"
        );
      } catch (error) {}
      return Array.isArray(entries) ? entries : [];
    }

    function testDynamicTemplate() {
      var supportedTypes = [
        "menu",
        "news",
        "sport_activities",
        "sport_cancellations",
        "sport_dressing_rooms",
        "sport_next_match",
        "sport_officials",
        "sport_program",
        "sport_results",
        "sport_standing"
      ];
      var template = activeItem && activeItem.dynamicTemplate;
      if (!template) {
        var missing = "Geen dynamische slide als eerste relevant release-item; HTML/CSS-rendering is overgeslagen.";
        setStep("template", "warn", missing);
        record("template", "warn", "NO_DYNAMIC_TEMPLATE", missing);
        return Promise.resolve();
      }
      setStep("template", "running", "Editorial Arena-contract en legacy-renderdiagnose worden gecontroleerd.");
      if (
        template.schemaVersion !== 1 ||
        typeof template.templateSlug !== "string" ||
        template.templateSlug.indexOf("editorial-arena-") !== 0 ||
        supportedTypes.indexOf(template.slideType) === -1 ||
        (template.orientation !== "portrait" && template.orientation !== "landscape") ||
        !template.data ||
        typeof template.data !== "object"
      ) {
        var invalid = "De actieve dynamische slide voldoet niet aan het ondersteunde Editorial Arena-contract.";
        setStep("template", "fail", invalid);
        record("template", "fail", "DYNAMIC_TEMPLATE_INVALID", invalid);
        return Promise.resolve();
      }
      var diagnostics = readLegacyDiagnostics();
      var lastTemplateEvent = null;
      var index;
      for (index = diagnostics.length - 1; index >= 0; index -= 1) {
        if (
          diagnostics[index] &&
          (
            diagnostics[index].code === "LEGACY_TEMPLATE_READY" ||
            diagnostics[index].code === "LEGACY_TEMPLATE_ERROR" ||
            diagnostics[index].code === "LEGACY_TEMPLATE_CACHE_MISSING" ||
            diagnostics[index].code === "LEGACY_CLIENT_EXCEPTION"
          )
        ) {
          lastTemplateEvent = diagnostics[index];
          break;
        }
      }
      if (
        lastTemplateEvent &&
        lastTemplateEvent.code !== "LEGACY_TEMPLATE_READY"
      ) {
        var failed = "Contract geldig, maar de laatste legacy-render meldde " +
          safeText(lastTemplateEvent.code) + ": " +
          safeText(lastTemplateEvent.detail) + ".";
        setStep("template", "fail", failed);
        record("template", "fail", "DYNAMIC_TEMPLATE_RUNTIME_FAILED", failed);
        return Promise.resolve();
      }
      var ready = "HTML/CSS-contract geldig: " + safeText(template.slideType) +
        ", " + safeText(template.orientation) + ", " +
        safeText(template.templateSlug) + ".";
      if (lastTemplateEvent) {
        ready += " De legacy Player heeft lokaal LEGACY_TEMPLATE_READY vastgelegd.";
        setStep("template", "pass", ready);
        record("template", "pass", "DYNAMIC_TEMPLATE_READY", ready);
      } else {
        ready += " Er is nog geen lokale renderdiagnose; open eerst de Player en voer de probe opnieuw uit.";
        setStep("template", "warn", ready);
        record("template", "warn", "DYNAMIC_TEMPLATE_NOT_YET_RENDERED", ready);
      }
      return Promise.resolve();
    }

    function markNoActiveItem(step) {
      var detail = "Overgeslagen: er is geen actief release-item beschikbaar.";
      setStep(step, "warn", detail);
      record(step, "warn", "NO_ACTIVE_ITEM", detail);
    }

    function testRange(url) {
      return xhr("GET", url, {
        headers: { "Range": "bytes=0-1023", "Cache-Control": "no-store" },
        responseType: "arraybuffer",
        timeout: 15000
      }).then(function (request) {
        if (request.status !== 200 && request.status !== 206) throw new Error("RANGE_HTTP_" + request.status);
        var length = request.response ? request.response.byteLength : 0;
        if (!length) throw new Error("RANGE_EMPTY");
        return {
          acceptRanges: request.getResponseHeader("Accept-Ranges") || "onbekend",
          contentRange: request.getResponseHeader("Content-Range") || "geen",
          length: length,
          status: request.status
        };
      });
    }

    function testDirect(currentRun) {
      if (!activeItem) {
        markNoActiveItem("direct");
        return Promise.resolve();
      }
      setStep("direct", "running", "Signed bron-URL en zichtbare directe rendering worden getest.");
      var source = activeItem.source;
      var rangeCheck = testRange(source.url).then(function (range) {
        return { ok: true, range: range };
      }, function (error) {
        return { error: safeText(error && error.message), ok: false };
      });
      var renderCheck = (activeItem.kind === "video" ? playVideo(source.url, 18000) : showImage(source.url)).then(function (media) {
        return { media: media, ok: true };
      }, function (error) {
        return { error: safeText(error && error.message), ok: false };
      });
      return Promise.all([rangeCheck, renderCheck]).then(function (checks) {
        if (currentRun !== runId) return;
        var range = checks[0];
        var rendered = checks[1];
        if (rendered.ok && range.ok) {
          var dimensions = rendered.media.width + "x" + rendered.media.height;
          var passed = "Directe bron werkt; HTTP " + range.range.status + ", " + range.range.length + " bytes gelezen, render=" + dimensions + ".";
          setStep("direct", "pass", passed);
          record("direct", "pass", "ACTIVE_DIRECT_OK", passed);
          return;
        }
        if (rendered.ok) {
          var mediaOnly = "Media-element rendert op " + rendered.media.width + "x" + rendered.media.height + ", maar ranged download faalt: " + range.error + ".";
          setStep("direct", "warn", mediaOnly);
          record("direct", "warn", "ACTIVE_DIRECT_MEDIA_ONLY", mediaOnly);
          return;
        }
        var failed = "Actief bestand rendert niet rechtstreeks: " + rendered.error + "; range=" + (range.ok ? "HTTP " + range.range.status : range.error) + ".";
        setStep("direct", "fail", failed);
        record("direct", "fail", "ACTIVE_DIRECT_FAILED", failed);
      });
    }

    function downloadBlob(url, expectedBytes) {
      return xhr("GET", url, { responseType: "blob", timeout: 45000 }).then(function (request) {
        if (request.status < 200 || request.status >= 300) throw new Error("BLOB_HTTP_" + request.status);
        var blob = request.response;
        if (!blob || !blob.size) throw new Error("BLOB_EMPTY");
        if (expectedBytes && Math.abs(blob.size - expectedBytes) > 1) throw new Error("BLOB_SIZE_MISMATCH");
        return blob;
      });
    }

    function testBlob(currentRun) {
      if (!activeItem) {
        markNoActiveItem("blob");
        return Promise.resolve();
      }
      var source = activeItem.source || {};
      if (Number(source.bytes || 0) > 40 * 1024 * 1024) {
        var tooLarge = "Veilig overgeslagen: actief bestand is groter dan 40 MB; volledige Blob kan oude LG-processen uitputten.";
        setStep("blob", "warn", tooLarge);
        record("blob", "warn", "BLOB_TOO_LARGE", tooLarge);
        return Promise.resolve();
      }
      if (!window.URL || !window.URL.createObjectURL) {
        var unsupported = "Overgeslagen: Blob/object-URL wordt niet ondersteund.";
        setStep("blob", "warn", unsupported);
        record("blob", "warn", "BLOB_UNSUPPORTED", unsupported);
        return Promise.resolve();
      }
      setStep("blob", "running", "Actief bestand wordt volledig in geheugen geladen en gerenderd.");
      return downloadBlob(source.url, Number(source.bytes || 0)).then(function (blob) {
        objectUrl = URL.createObjectURL(blob);
        if (activeItem.kind === "video") return playVideo(objectUrl, 18000).then(function (media) {
          return { bytes: blob.size, media: media };
        });
        return showImage(objectUrl).then(function (media) {
          return { bytes: blob.size, media: media };
        });
      }).then(function (outcome) {
        if (currentRun !== runId) return;
        var detail = "Blob-route werkt; " + outcome.bytes + " bytes, render=" + outcome.media.width + "x" + outcome.media.height + ".";
        setStep("blob", "pass", detail);
        record("blob", "pass", "ACTIVE_BLOB_OK", detail);
      }).catch(function (error) {
        var detail = "Blob-route faalde: " + safeText(error && error.message);
        setStep("blob", "fail", detail);
        record("blob", "fail", "ACTIVE_BLOB_FAILED", detail);
      });
    }

    function findCachedResponse(cacheKey) {
      if (!window.caches || !window.caches.open || !window.caches.keys) return Promise.resolve(null);
      return window.caches.keys().then(function (names) {
        var existingNames = CONFIG.assetCacheNames.filter(function (name) {
          return names.indexOf(name) >= 0;
        });
        var index = 0;
        function next() {
          if (index >= existingNames.length) return Promise.resolve(null);
          var cacheName = existingNames[index];
          index += 1;
          return window.caches.open(cacheName).then(function (cache) {
            return cache.match(cacheKey);
          }).then(function (response) {
            return response || next();
          }, function () {
            return next();
          });
        }
        return next();
      });
    }

    function testCache(currentRun) {
      if (!activeItem) {
        markNoActiveItem("cache");
        return Promise.resolve();
      }
      var checksum = activeItem.source && activeItem.source.checksumSha256;
      if (!checksum) {
        var missing = "Overgeslagen: manifest bevat geen checksum voor het actieve item.";
        setStep("cache", "warn", missing);
        record("cache", "warn", "CACHE_KEY_MISSING", missing);
        return Promise.resolve();
      }
      var cacheKey = CONFIG.cachedAssetPrefix + checksum;
      setStep("cache", "running", "Bestaande Cache Storage en serviceworker-rangeroute worden getest.");
      return findCachedResponse(cacheKey).then(function (cached) {
        if (!cached) throw new Error("CACHE_ENTRY_MISSING");
        var headerDetail = "type=" + (cached.headers.get("Content-Type") || "onbekend") + ", lengte=" + (cached.headers.get("Content-Length") || "onbekend");
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
          var noController = "Cache-entry bestaat (" + headerDetail + "), maar deze probe heeft geen actieve serviceworkercontroller.";
          setStep("cache", "warn", noController);
          record("cache", "warn", "CACHE_NO_SW_CONTROLLER", noController);
          return;
        }
        return testRange(cacheKey).then(function (range) {
          if (activeItem.kind === "video") return playVideo(cacheKey, 18000).then(function (media) {
            return { media: media, range: range };
          });
          return showImage(cacheKey).then(function (media) {
            return { media: media, range: range };
          });
        }).then(function (outcome) {
          var detail = "Normaal cachepad werkt; HTTP " + outcome.range.status + ", range=" + outcome.range.contentRange + ", render=" + outcome.media.width + "x" + outcome.media.height + ".";
          setStep("cache", "pass", detail);
          record("cache", "pass", "ACTIVE_CACHE_OK", detail);
        });
      }).catch(function (error) {
        var detail = "Bestaand cachepad faalde: " + safeText(error && error.message);
        var missing = String(error && error.message).indexOf("CACHE_ENTRY_MISSING") >= 0;
        setStep("cache", missing ? "warn" : "fail", detail);
        record("cache", missing ? "warn" : "fail", missing ? "CACHE_ENTRY_MISSING" : "ACTIVE_CACHE_FAILED", detail);
      });
    }

    function resultFor(id) {
      var index;
      for (index = results.length - 1; index >= 0; index -= 1) {
        if (results[index].id === id) return results[index];
      }
      return null;
    }

    function diagnose() {
      var reference = resultFor("reference");
      var direct = resultFor("direct");
      var blob = resultFor("blob");
      var cache = resultFor("cache");
      var manifestResult = resultFor("manifest");
      var templateResult = resultFor("template");
      var activeVideo = activeItem && activeItem.kind === "video";
      if (manifestResult && manifestResult.code === "PROBE_UNPAIRED") {
        return { code: "LG-UNPAIRED", summary: "De browser werkt, maar er is geen geldige lokale koppeling om content te testen." };
      }
      if (manifestResult && manifestResult.code === "WAITING_FOR_CONTENT") {
        return { code: "LG-WAITING-CONTENT", summary: "De koppeling werkt. Publiceer eerst een release en voer daarna de probe opnieuw uit." };
      }
      if (reference && reference.status === "fail") {
        return { code: "LG-VIDEO-REFERENCE", summary: "De ingebouwde same-origin H.264 Baseline/AAC-LC-video startte niet. De afbeeldingsuitslagen blijven geldig, maar video is niet gereed verklaard." };
      }
      if (templateResult && templateResult.status === "fail") {
        return { code: "LG-HTML-CSS-RENDER", summary: "Het Editorial Arena-contract of de laatste legacy-render faalde. Open de technische details voor de precieze rendercode." };
      }
      if (direct && direct.code === "ACTIVE_DIRECT_MEDIA_ONLY") {
        return { code: "LG-DIRECT-FETCH", summary: "Het actieve bestand rendert rechtstreeks, maar ranged download faalt. Dit wijst op CORS, signed URL of het downloadpad vóór de Player-cache." };
      }
      if (direct && direct.status === "fail" && reference && reference.status === "pass") {
        return { code: "LG-ACTIVE-ASSET", summary: "De LG kan video afspelen, maar het actieve VeyoCast-bestand niet. Controleer codecprofiel, bestand of signed URL." };
      }
      if (direct && direct.status === "pass" && blob && blob.status === "fail") {
        return { code: "LG-BLOB-MEMORY", summary: "Rechtstreeks afspelen werkt, maar de volledige Blob-route niet. Dit wijst op geheugen- of object-URL-problemen." };
      }
      if (direct && direct.status === "pass" && cache && cache.status === "fail") {
        return { code: "LG-CACHE-RANGE", summary: "Rechtstreeks afspelen werkt, maar het normale cache/serviceworkerpad niet. De Player moet dit pad op LG omzeilen." };
      }
      if (direct && direct.status === "pass" && (!cache || cache.status === "warn")) {
        return activeVideo
          ? { code: "LG-DIRECT-READY", summary: "De actieve VeyoCast-video speelt rechtstreeks. De cacheproef kon nog niet beslissend worden uitgevoerd." }
          : { code: "LG-IMAGE-DIRECT-READY", summary: "De actieve VeyoCast-afbeelding rendert rechtstreeks. De cacheproef kon nog niet beslissend worden uitgevoerd." };
      }
      if (direct && direct.status === "pass" && cache && cache.status === "pass") {
        if (templateResult && templateResult.code === "DYNAMIC_TEMPLATE_READY") {
          return { code: "LG-HTML-CSS-READY", summary: "De dynamische Editorial Arena-slide, bronmedia en lokale cache zijn op deze LG gereed." };
        }
        return activeVideo
          ? { code: "LG-PLAYBACK-READY", summary: "De actieve VeyoCast-video speelt zowel rechtstreeks als via het bestaande Player-cachepad." }
          : { code: "LG-IMAGE-PLAYBACK-READY", summary: "De actieve VeyoCast-afbeelding werkt rechtstreeks, als Blob en via het bestaande Player-cachepad. De same-origin videoreferentie werkt ook; publiceer een testvideo voor een volledige videoketenproef." };
      }
      var failures = results.filter(function (entry) { return entry.status === "fail"; });
      if (failures.length) {
        return { code: "LG-PROBE-FAILED", summary: "Een of meer basiscontroles faalden. Open de technische details en deel deze diagnosecode." };
      }
      return { code: "LG-PROBE-PARTIAL", summary: "De probe is afgerond, maar had onvoldoende actieve content voor een definitieve uitspraak." };
    }

    function safeReport(diagnosis) {
      return {
        code: diagnosis.code,
        createdAt: nowIso(),
        resultCount: results.length,
        results: results.map(function (entry) {
          return { code: entry.code, id: entry.id, status: entry.status };
        }),
        userAgent: safeText(navigator.userAgent),
        viewport: String(window.innerWidth) + "x" + String(window.innerHeight)
      };
    }

    function storeReport(report) {
      try {
        window.localStorage.setItem(CONFIG.probeResultKey, JSON.stringify(report));
        return true;
      } catch (error) {
        log("rapport | lokale opslag mislukt | " + safeText(error && error.message));
        return false;
      }
    }

    function sendHeartbeat(diagnosis) {
      if (!deviceToken || !manifest || !manifest.device) return Promise.resolve(false);
      var body = {
        activeReleaseId: manifest.device.activeReleaseId || null,
        currentItemId: activeItem ? activeItem.id : null,
        desiredReleaseId: manifest.device.desiredReleaseId || null,
        lastPlaybackError: {
          action: "Voer /lg/probe uit en deel code " + diagnosis.code,
          code: diagnosis.code,
          itemId: activeItem ? activeItem.id : undefined,
          occurredAt: nowIso()
        },
        networkState: navigator.onLine ? "online" : "offline",
        runtimeState: diagnosis.code === "LG-PLAYBACK-READY" || diagnosis.code === "LG-IMAGE-PLAYBACK-READY" || diagnosis.code === "LG-HTML-CSS-READY" ? "PLAYING" : "ERROR_RECOVERABLE",
        syncPhase: "lg_probe"
      };
      return xhr("POST", "/api/player/heartbeat", {
        body: JSON.stringify(body),
        headers: {
          "Authorization": "Bearer " + deviceToken,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }).then(function (request) {
        var ok = request.status >= 200 && request.status < 300;
        log("heartbeat | HTTP " + request.status + " | " + (ok ? "diagnose verzonden" : "diagnose niet verzonden"));
        return ok;
      }, function (error) {
        log("heartbeat | diagnose niet verzonden | " + safeText(error && error.message));
        return false;
      });
    }

    function finish(currentRun) {
      if (currentRun !== runId || stopped) return;
      try { byId("probe-video").pause(); } catch (error) {}
      var diagnosis = diagnose();
      var report = safeReport(diagnosis);
      var stored = storeReport(report);
      byId("result-code").textContent = diagnosis.code;
      byId("result-summary").textContent = diagnosis.summary + (stored ? " Het rapport staat ook lokaal opgeslagen." : "");
      log("einddiagnose | " + diagnosis.code + " | " + diagnosis.summary);
      sendHeartbeat(diagnosis).then(function (sent) {
        if (sent) {
          byId("result-summary").textContent = diagnosis.summary + " De diagnose is veilig naar Control verzonden.";
        }
      });
    }

    function runProbe() {
      runId += 1;
      var currentRun = runId;
      stopped = false;
      results = [];
      manifest = null;
      activeItem = null;
      deviceToken = null;
      stopVideo();
      byId("technical-log").textContent = "Probe gestart…";
      byId("result-code").textContent = "WORDT GEMAAKT";
      byId("result-summary").textContent = "De controles zijn nog bezig.";
      ["platform", "origin", "reference", "manifest", "template", "direct", "blob", "cache"].forEach(function (id) {
        setStep(id, "waiting", null);
      });
      testPlatform(currentRun)
        .then(function () { return testOrigin(currentRun); })
        .then(function () { return testReferenceVideo(currentRun); })
        .then(function () { return testManifest(currentRun); })
        .then(function () { return testDynamicTemplate(currentRun); })
        .then(function () { return testDirect(currentRun); })
        .then(function () { return testBlob(currentRun); })
        .then(function () { return testCache(currentRun); })
        .then(function () { finish(currentRun); })
        .catch(function (error) {
          record("runner", "fail", "PROBE_RUNNER_EXCEPTION", error && error.message);
          finish(currentRun);
        });
    }

    window.onerror = function (message, source, line, column) {
      log("window.onerror | " + safeText(message) + " | regel=" + String(line || 0) + ":" + String(column || 0));
      return true;
    };
    window.onunhandledrejection = function (event) {
      var reason = event && event.reason;
      log("unhandledrejection | " + safeText(reason && reason.message ? reason.message : reason));
    };
    byId("run-again").onclick = runProbe;
    runProbe();
  }());
  </script>
</body>
</html>`;
}
