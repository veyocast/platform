import {
  playerAssetCacheName,
  playerDatabaseName
} from "./player-cache";
import { previousPlayerStorageKey } from "./brand-transition";
import {
  localStorageDeviceTokenKey,
  localStorageExecutedCommandsKey,
  localStorageInstallationCredentialKey,
  localStoragePairingCodeKey,
  localStoragePairingExpiryKey,
  localStoragePairingMachineKey,
  localStoragePairingProvisionAfterKey,
  localStoragePairingRequestNonceKey,
  localStoragePlayerInstanceKey,
  localStorageRecoveryMarkerKey,
  playerRecoveryMarkerTtlMs,
  temporaryPairingCookieNames
} from "./player-storage";

const legacyNamespace = previousPlayerStorageKey("").split(".player.")[0]!;
const recoveryScriptConfiguration = {
  assetCacheNames: [
    playerAssetCacheName,
    `${legacyNamespace}-player-assets-v1`
  ],
  databaseNames: [
    playerDatabaseName,
    `${legacyNamespace}-player-cache-v1`
  ],
  deviceTokenKeys: [
    localStorageDeviceTokenKey,
    previousPlayerStorageKey("deviceToken")
  ],
  installationKeys: [
    localStoragePlayerInstanceKey,
    previousPlayerStorageKey("instanceId")
  ],
  hardResetKeys: [
    localStorageInstallationCredentialKey,
    localStorageExecutedCommandsKey
  ],
  pairingKeys: [
    localStoragePairingCodeKey,
    localStoragePairingExpiryKey,
    localStoragePairingMachineKey,
    localStoragePairingProvisionAfterKey,
    localStoragePairingRequestNonceKey,
    previousPlayerStorageKey("pairingCode"),
    previousPlayerStorageKey("pairingExpiresAt"),
    previousPlayerStorageKey("pairingProvisionAfter")
  ],
  recoveryMarkerKey: localStorageRecoveryMarkerKey,
  recoveryMarkerTtlMs: playerRecoveryMarkerTtlMs,
  shellCachePrefixes: [
    "veyocast-player-shell-",
    `${legacyNamespace}-player-shell-`
  ],
  temporaryPairingCookieNames
};

export function renderLgRecoveryHtml() {
  const configuration = JSON.stringify(recoveryScriptConfiguration).replaceAll(
    "<",
    "\\u003c"
  );

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <title>VeyoCast Player herstellen</title>
  <style>
    :root {
      --vc-ink: #0a0a0a;
      --vc-paper: #fafaf7;
      --vc-orange: #ff5c20;
      --vc-blue: #315cff;
      --vc-muted: #c9c9c4;
      --vc-surface: #171717;
      --vc-border: #3d3d39;
      --vc-success: #46d18c;
      --vc-warning: #ffad66;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; }
    body {
      background: var(--vc-ink);
      color: var(--vc-paper);
      font-family: Inter, Arial, sans-serif;
      font-size: 20px;
      line-height: 1.45;
    }
    main {
      width: 88%;
      max-width: 1080px;
      margin: 0 auto;
      padding: 7vh 0 6vh;
    }
    .brand {
      display: block;
      width: 250px;
      max-width: 42vw;
      height: auto;
      margin: 0 0 42px;
    }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--vc-warning);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: 54px;
      line-height: 1.04;
      letter-spacing: -.035em;
    }
    .intro {
      max-width: 780px;
      margin: 20px 0 36px;
      color: var(--vc-muted);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--vc-border);
    }
    li {
      display: table;
      width: 100%;
      min-height: 72px;
      padding: 18px 0;
      border-bottom: 1px solid var(--vc-border);
    }
    .step-icon,
    .step-copy {
      display: table-cell;
      vertical-align: middle;
    }
    .step-icon {
      width: 58px;
      color: var(--vc-muted);
      font-family: "Courier New", monospace;
      font-size: 26px;
      font-weight: 700;
    }
    .step-title {
      display: block;
      font-size: 22px;
      font-weight: 700;
    }
    .step-detail {
      display: block;
      margin-top: 2px;
      color: var(--vc-muted);
      font-size: 16px;
    }
    li[data-status="running"] .step-icon { color: var(--vc-blue); }
    li[data-status="done"] .step-icon { color: var(--vc-success); }
    li[data-status="warning"] .step-icon { color: var(--vc-warning); }
    .actions {
      margin-top: 34px;
    }
    button {
      min-height: 48px;
      margin: 0 12px 12px 0;
      padding: 11px 20px;
      border: 1px solid var(--vc-border);
      border-radius: 6px;
      background: transparent;
      color: var(--vc-paper);
      font: inherit;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
    }
    button.primary {
      border-color: var(--vc-orange);
      background: var(--vc-orange);
      color: var(--vc-ink);
    }
    button:focus {
      outline: 3px solid var(--vc-blue);
      outline-offset: 3px;
    }
    button:disabled { cursor: default; opacity: .55; }
    .footer-copy {
      max-width: 850px;
      margin-top: 18px;
      color: var(--vc-muted);
      font-size: 15px;
    }
    .summary {
      min-height: 25px;
      margin-top: 24px;
      color: var(--vc-success);
      font-weight: 700;
    }
    noscript {
      display: block;
      margin-top: 24px;
      padding: 16px;
      border: 1px solid var(--vc-warning);
      color: var(--vc-warning);
    }
    @media (max-height: 720px) {
      body { font-size: 16px; }
      main { padding: 18px 0 12px; }
      .brand { width: 170px; margin-bottom: 12px; }
      .eyebrow { margin-bottom: 4px; font-size: 13px; }
      h1 { font-size: 34px; }
      .intro { margin: 8px 0 12px; font-size: 15px; line-height: 1.45; }
      li { min-height: 52px; padding: 7px 0; }
      .step-title { font-size: 18px; }
      .step-detail { font-size: 13px; }
      .summary { margin-top: 10px; }
      .actions { margin-top: 12px; gap: 8px; }
      button { min-height: 44px; padding: 8px 18px; }
      footer { margin-top: 5px; font-size: 12px; }
    }
  </style>
</head>
<body>
  <main>
    <img class="brand" src="/brand/veyocast-logo-inverse.svg" alt="VeyoCast">
    <p class="eyebrow">Veilig lokaal herstel</p>
    <h1>VeyoCast Player herstellen</h1>
    <p class="intro">De installatie-identiteit blijft standaard behouden. Iedere herstelstap gaat door wanneer een browserfunctie niet beschikbaar is.</p>
    <ol aria-label="Herstelvoortgang">
      <li id="step-1" data-status="pending">
        <span class="step-icon" aria-hidden="true">1</span>
        <span class="step-copy"><span class="step-title">Playerstatus controleren</span><span class="step-detail">Wachten op herstelstart</span></span>
      </li>
      <li id="step-2" data-status="pending">
        <span class="step-icon" aria-hidden="true">2</span>
        <span class="step-copy"><span class="step-title">Oude koppelpoging verwijderen</span><span class="step-detail">Wachten op statuscontrole</span></span>
      </li>
      <li id="step-3" data-status="pending">
        <span class="step-icon" aria-hidden="true">3</span>
        <span class="step-copy"><span class="step-title">Lokale cache herstellen</span><span class="step-detail">Wachten op pairingherstel</span></span>
      </li>
      <li id="step-4" data-status="pending">
        <span class="step-icon" aria-hidden="true">4</span>
        <span class="step-copy"><span class="step-title">Nieuwe koppeling voorbereiden</span><span class="step-detail">Wachten op cacheherstel</span></span>
      </li>
    </ol>
    <p class="summary" id="summary" role="status" aria-live="polite">Soft recovery start automatisch.</p>
    <div class="actions">
      <button class="primary" id="soft-recovery" type="button">Nu herstellen</button>
      <button id="hard-recovery" type="button">Volledige playerreset</button>
    </div>
    <p class="footer-copy">Volledige playerreset vernieuwt ook de installatie-ID. Gebruik die alleen wanneer soft recovery niet helpt; er volgt altijd eerst een bevestiging.</p>
    <noscript>JavaScript is op dit scherm uitgeschakeld. Open de herstelroute opnieuw in een browserprofiel waarin JavaScript is toegestaan.</noscript>
  </main>
  <script>
  (function () {
    "use strict";
    var CONFIG = ${configuration};
    var mode = "soft";
    var running = false;
    var autoTimer = null;
    var deviceToken = null;
    var installationId = null;
    var credentialStatus = "missing";
    var cacheNotes = [];

    function byId(id) {
      return document.getElementById(id);
    }

    function safeGet(key) {
      try { return window.localStorage.getItem(key); } catch (error) { return null; }
    }

    function safeSet(key, value) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        return false;
      }
    }

    function safeRemove(key) {
      try { window.localStorage.removeItem(key); } catch (error) {}
    }

    function firstStored(keys) {
      var index;
      var value;
      for (index = 0; index < keys.length; index += 1) {
        value = safeGet(keys[index]);
        if (value) { return value; }
      }
      return null;
    }

    function createInstallationId() {
      var bytes;
      var hex = "";
      var index;
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
          bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          for (index = 0; index < bytes.length; index += 1) {
            hex += ("0" + bytes[index].toString(16)).slice(-2);
          }
          return hex;
        }
      } catch (error) {}
      return String(new Date().getTime()) +
        String(Math.random()).replace(/[^0-9]/g, "") +
        String(Math.random()).replace(/[^0-9]/g, "");
    }

    function validInstallationId(value) {
      return typeof value === "string" && /^[a-f0-9-]{20,80}$/i.test(value);
    }

    function ensureInstallationId() {
      var stored = firstStored(CONFIG.installationKeys);
      if (!validInstallationId(stored)) {
        stored = createInstallationId();
      }
      installationId = stored.toLowerCase();
      safeSet(CONFIG.installationKeys[0], installationId);
      return installationId;
    }

    function setStep(number, status, detail) {
      var row = byId("step-" + number);
      var icon = row.getElementsByClassName("step-icon")[0];
      var detailNode = row.getElementsByClassName("step-detail")[0];
      row.setAttribute("data-status", status);
      if (status === "running") { icon.textContent = "..."; }
      if (status === "done") { icon.textContent = "OK"; }
      if (status === "warning") { icon.textContent = "!"; }
      detailNode.textContent = detail;
    }

    function guardedStep(number, task, next) {
      var finished = false;
      var timeout = window.setTimeout(function () {
        finish("warning", "Deze stap duurde te lang en is veilig overgeslagen.");
      }, 12000);
      setStep(number, "running", "Bezig...");

      function finish(status, detail) {
        if (finished) { return; }
        finished = true;
        window.clearTimeout(timeout);
        setStep(number, status, detail);
        window.setTimeout(next, 120);
      }

      try {
        task(finish);
      } catch (error) {
        finish("warning", "Niet beschikbaar op deze browser; herstel gaat verder.");
      }
    }

    function checkPlayerStatus(done) {
      var xhr;
      ensureInstallationId();
      deviceToken = firstStored(CONFIG.deviceTokenKeys);
      if (!deviceToken) {
        credentialStatus = "missing";
        done("done", "Installatie-ID gevonden; er is geen actief devicecredential.");
        return;
      }
      if (!/^[A-Za-z0-9_-]{20,200}$/.test(deviceToken)) {
        credentialStatus = "invalid";
        done("warning", "Het lokale devicecredential is beschadigd en wordt verwijderd.");
        return;
      }

      xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/player/manifest", true);
      xhr.timeout = 8000;
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + deviceToken);
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          credentialStatus = "valid";
          done("done", "De bestaande schermkoppeling is geldig en blijft behouden.");
          return;
        }
        if (
          xhr.status === 401 ||
          xhr.status === 403 ||
          xhr.status === 404 ||
          xhr.status === 410 ||
          xhr.status === 423
        ) {
          credentialStatus = "invalid";
          done("warning", "Het devicecredential is ingetrokken, verlopen of ongeldig.");
          return;
        }
        credentialStatus = "unknown";
        done("warning", "De serverstatus is tijdelijk onbekend; een mogelijk geldige koppeling blijft behouden.");
      };
      xhr.onerror = function () {
        credentialStatus = "unknown";
        done("warning", "VeyoCast is niet bereikbaar; een mogelijk geldige koppeling blijft behouden.");
      };
      xhr.ontimeout = function () {
        credentialStatus = "unknown";
        done("warning", "De statuscontrole duurde te lang; een mogelijk geldige koppeling blijft behouden.");
      };
      xhr.send();
    }

    function notifyPendingRecovery(callback) {
      var xhr;
      if (!deviceToken) {
        callback(false);
        return;
      }
      xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/player/pairing/recover", true);
      xhr.timeout = 6000;
      xhr.setRequestHeader("Authorization", "Bearer " + deviceToken);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onload = function () { callback(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = function () { callback(false); };
      xhr.ontimeout = function () { callback(false); };
      xhr.send(JSON.stringify({
        installationId: installationId,
        mode: mode
      }));
    }

    function expireTemporaryPairingCookies() {
      var index;
      for (index = 0; index < CONFIG.temporaryPairingCookieNames.length; index += 1) {
        document.cookie = CONFIG.temporaryPairingCookieNames[index] +
          "=; Max-Age=0; Path=/; SameSite=Strict";
      }
    }

    function clearPairingAttempt(done) {
      notifyPendingRecovery(function (serverNotified) {
        var index;
        for (index = 0; index < CONFIG.pairingKeys.length; index += 1) {
          safeRemove(CONFIG.pairingKeys[index]);
        }
        expireTemporaryPairingCookies();

        if (mode === "hard" || credentialStatus === "invalid") {
          for (index = 0; index < CONFIG.deviceTokenKeys.length; index += 1) {
            safeRemove(CONFIG.deviceTokenKeys[index]);
          }
        }

        if (mode === "hard") {
          for (index = 0; index < CONFIG.hardResetKeys.length; index += 1) {
            safeRemove(CONFIG.hardResetKeys[index]);
          }
          for (index = 0; index < CONFIG.installationKeys.length; index += 1) {
            safeRemove(CONFIG.installationKeys[index]);
          }
          installationId = createInstallationId().toLowerCase();
          safeSet(CONFIG.installationKeys[0], installationId);
        }

        if (!serverNotified && deviceToken) {
          done("warning", "Lokale pairingstate is verwijderd; servermelding volgt bij de volgende verbinding.");
          return;
        }
        done(
          "done",
          mode === "hard"
            ? "Pairingstate verwijderd en installatie-ID vernieuwd."
            : credentialStatus === "valid" || credentialStatus === "unknown"
              ? "Tijdelijke pairingstate verwijderd; geldige of onbekende binding behouden."
              : "Ongeldige pairingstate en devicecredential verwijderd."
        );
      });
    }

    function cacheNameMatches(name) {
      var index;
      if (CONFIG.assetCacheNames.indexOf(name) !== -1) { return true; }
      for (index = 0; index < CONFIG.shellCachePrefixes.length; index += 1) {
        if (name.indexOf(CONFIG.shellCachePrefixes[index]) === 0) { return true; }
      }
      return false;
    }

    function clearCacheStorage(callback) {
      if (!window.caches || typeof window.caches.keys !== "function") {
        cacheNotes.push("Cache Storage niet beschikbaar");
        callback();
        return;
      }
      window.caches.keys().then(function (names) {
        var removals = [];
        var index;
        for (index = 0; index < names.length; index += 1) {
          if (cacheNameMatches(names[index])) {
            removals.push(window.caches.delete(names[index]));
          }
        }
        return Promise.all(removals);
      }).then(function () {
        cacheNotes.push("VeyoCast-caches verwijderd");
        callback();
      }, function () {
        cacheNotes.push("Cache Storage gaf een fout");
        callback();
      });
    }

    function deleteDatabase(name, callback) {
      var request;
      var settled = false;
      var blockedTimer;
      function finish(note) {
        if (settled) { return; }
        settled = true;
        if (blockedTimer) { window.clearTimeout(blockedTimer); }
        if (note) { cacheNotes.push(note); }
        callback();
      }
      try {
        request = window.indexedDB.deleteDatabase(name);
        request.onsuccess = function () { finish(null); };
        request.onerror = function () { finish("IndexedDB " + name + " gaf een fout"); };
        request.onblocked = function () {
          blockedTimer = window.setTimeout(function () {
            finish("IndexedDB " + name + " was tijdelijk geblokkeerd");
          }, 1200);
        };
      } catch (error) {
        finish("IndexedDB " + name + " kon niet worden geopend");
      }
    }

    function clearIndexedDatabases(callback) {
      var index = 0;
      if (!window.indexedDB || typeof window.indexedDB.deleteDatabase !== "function") {
        cacheNotes.push("IndexedDB niet beschikbaar");
        callback();
        return;
      }
      function next() {
        if (index >= CONFIG.databaseNames.length) {
          cacheNotes.push("Player-releasegegevens verwijderd");
          callback();
          return;
        }
        deleteDatabase(CONFIG.databaseNames[index], function () {
          index += 1;
          next();
        });
      }
      next();
    }

    function unregisterServiceWorkers(callback) {
      var serviceWorker = window.navigator && window.navigator.serviceWorker;
      if (!serviceWorker) {
        cacheNotes.push("Service workers niet beschikbaar");
        callback();
        return;
      }
      if (typeof serviceWorker.getRegistrations === "function") {
        serviceWorker.getRegistrations().then(function (registrations) {
          var removals = [];
          var index;
          for (index = 0; index < registrations.length; index += 1) {
            removals.push(registrations[index].unregister());
          }
          return Promise.all(removals);
        }).then(function () {
          cacheNotes.push("VeyoCast-serviceworker uitgeschreven");
          callback();
        }, function () {
          cacheNotes.push("Serviceworker uitschrijven gaf een fout");
          callback();
        });
        return;
      }
      if (typeof serviceWorker.getRegistration === "function") {
        serviceWorker.getRegistration().then(function (registration) {
          return registration ? registration.unregister() : false;
        }).then(function () {
          cacheNotes.push("VeyoCast-serviceworker uitgeschreven");
          callback();
        }, function () {
          cacheNotes.push("Serviceworker uitschrijven gaf een fout");
          callback();
        });
        return;
      }
      cacheNotes.push("Serviceworkerbeheer niet beschikbaar");
      callback();
    }

    function repairLocalCache(done) {
      cacheNotes = [];
      clearCacheStorage(function () {
        clearIndexedDatabases(function () {
          unregisterServiceWorkers(function () {
            var hasWarning = false;
            var index;
            for (index = 0; index < cacheNotes.length; index += 1) {
              if (
                cacheNotes[index].indexOf("fout") !== -1 ||
                cacheNotes[index].indexOf("geblokkeerd") !== -1
              ) {
                hasWarning = true;
              }
            }
            done(hasWarning ? "warning" : "done", cacheNotes.join("; ") + ".");
          });
        });
      });
    }

    function prepareNewPairing(done) {
      var now = new Date().getTime();
      var marker = {
        completedAt: now,
        expiresAt: now + CONFIG.recoveryMarkerTtlMs,
        mode: mode,
        version: 1
      };
      safeSet(CONFIG.recoveryMarkerKey, JSON.stringify(marker));
      done(
        "done",
        credentialStatus === "valid" && mode === "soft"
          ? "Herstel voltooid; de bestaande koppeling wordt opnieuw geladen."
          : "Herstel voltooid; de Player vraagt op /lg een nieuwe code aan."
      );
    }

    function finishRecovery() {
      byId("summary").textContent =
        "Herstel voltooid. De Player wordt veilig opnieuw geopend.";
      window.setTimeout(function () {
        window.location.replace("/lg");
      }, 1200);
    }

    function startRecovery(requestedMode) {
      if (running) { return; }
      if (
        requestedMode === "hard" &&
        !window.confirm(
          "Volledige playerreset vernieuwt de installatie-ID en verwijdert de lokale koppeling en cache. Doorgaan?"
        )
      ) {
        return;
      }
      running = true;
      mode = requestedMode;
      if (autoTimer) { window.clearTimeout(autoTimer); }
      byId("soft-recovery").disabled = true;
      byId("hard-recovery").disabled = true;
      byId("summary").textContent =
        mode === "hard" ? "Volledige playerreset wordt uitgevoerd." : "Soft recovery wordt uitgevoerd.";

      guardedStep(1, checkPlayerStatus, function () {
        guardedStep(2, clearPairingAttempt, function () {
          guardedStep(3, repairLocalCache, function () {
            guardedStep(4, prepareNewPairing, finishRecovery);
          });
        });
      });
    }

    byId("soft-recovery").onclick = function () { startRecovery("soft"); };
    byId("hard-recovery").onclick = function () { startRecovery("hard"); };
    autoTimer = window.setTimeout(function () { startRecovery("soft"); }, 2500);
  }());
  </script>
</body>
</html>`;
}
