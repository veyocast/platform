(function exposeVeyoCastLgPlatformAdapter(global) {
  "use strict";

  var APP_ID = "nl.veyocast.player.webos";
  var APP_VERSION = "1.0.1";
  var PROTOCOL_VERSION = 1;

  function hasProperty(object, property) {
    try {
      return Boolean(object && property in object);
    } catch (_error) {
      return false;
    }
  }

  function detectCapabilities() {
    var navigatorValue = global.navigator || {};
    var scapDetected =
      hasProperty(global, "scap") || hasProperty(global, "SCAP");
    var idcapDetected =
      hasProperty(global, "idcap") || hasProperty(global, "IDCAP");

    return {
      adapter: scapDetected || idcapDetected ? "webos-signage" : "web-standard",
      appId: APP_ID,
      appVersion: APP_VERSION,
      features: {
        idcapDetected: idcapDetected,
        indexedDb: hasProperty(global, "indexedDB"),
        mediaCapabilities: hasProperty(navigatorValue, "mediaCapabilities"),
        networkEvents: hasProperty(global, "ononline"),
        pageVisibility: hasProperty(global.document, "visibilityState"),
        scapDetected: scapDetected,
        serviceWorker: hasProperty(navigatorValue, "serviceWorker"),
        storageEstimate: Boolean(
          navigatorValue.storage &&
          typeof navigatorValue.storage.estimate === "function"
        )
      },
      platform: "lg-webos-signage",
      platformInfo: readPlatformInformation(),
      protocolVersion: PROTOCOL_VERSION
    };
  }

  function readPlatformInformation() {
    var navigatorValue = global.navigator || {};
    var screenValue = global.screen || {};
    var userAgent = String(navigatorValue.userAgent || "").toLowerCase();

    return {
      displayHeight: toBoundedInteger(
        Number(screenValue.height || global.innerHeight || 0)
      ),
      displayWidth: toBoundedInteger(
        Number(screenValue.width || global.innerWidth || 0)
      ),
      firmwareVersion: null,
      language:
        typeof navigatorValue.language === "string"
          ? navigatorValue.language.slice(0, 16)
          : null,
      orientation: describeOrientation(),
      webOsDetected:
        userAgent.indexOf("webos") !== -1 ||
        userAgent.indexOf("web0s") !== -1,
      webOsVersion: null
    };
  }

  function readNetworkInformation() {
    var navigatorValue = global.navigator || {};
    var connection =
      navigatorValue.connection ||
      navigatorValue.mozConnection ||
      navigatorValue.webkitConnection;

    return {
      effectiveType:
        connection && typeof connection.effectiveType === "string"
          ? connection.effectiveType.slice(0, 24)
          : null,
      online: navigatorValue.onLine !== false
    };
  }

  function readStorageInformation(callback) {
    var navigatorValue = global.navigator || {};
    if (
      !navigatorValue.storage ||
      typeof navigatorValue.storage.estimate !== "function"
    ) {
      callback({
        available: false,
        quotaBytes: null,
        usageBytes: null
      });
      return;
    }

    navigatorValue.storage.estimate().then(
      function storageResolved(estimate) {
        callback({
          available: true,
          quotaBytes: toBoundedInteger(Number(estimate.quota || 0)),
          usageBytes: toBoundedInteger(Number(estimate.usage || 0))
        });
      },
      function storageRejected() {
        callback({
          available: false,
          quotaBytes: null,
          usageBytes: null
        });
      }
    );
  }

  function normalizeRemoteInput(event) {
    var key = event.key || "";
    var code = event.code || "";
    var keyCode = event.keyCode || 0;

    if (
      key === "GoBack" ||
      key === "BrowserBack" ||
      code === "BrowserBack" ||
      keyCode === 461
    ) {
      return "back";
    }
    if (key === "Enter" || code === "Enter" || keyCode === 13) return "enter";
    if (key === "ArrowLeft" || keyCode === 37) return "left";
    if (key === "ArrowUp" || keyCode === 38) return "up";
    if (key === "ArrowRight" || keyCode === 39) return "right";
    if (key === "ArrowDown" || keyCode === 40) return "down";
    if (key === "MediaPlayPause" || keyCode === 179) return "play-pause";
    if (key === "MediaPlay" || keyCode === 415) return "play";
    return null;
  }

  function subscribeLifecycle(onResume) {
    function handleFocus() {
      onResume("app-resume");
    }

    function handleVisibility() {
      if (global.document.visibilityState === "visible") {
        onResume("app-resume");
      }
    }

    global.addEventListener("focus", handleFocus);
    global.document.addEventListener("visibilitychange", handleVisibility);
    return function unsubscribeLifecycle() {
      global.removeEventListener("focus", handleFocus);
      global.document.removeEventListener("visibilitychange", handleVisibility);
    };
  }

  function subscribeNetwork(onChange) {
    function handleOnline() {
      onChange(true);
    }

    function handleOffline() {
      onChange(false);
    }

    global.addEventListener("online", handleOnline);
    global.addEventListener("offline", handleOffline);
    return function unsubscribeNetwork() {
      global.removeEventListener("online", handleOnline);
      global.removeEventListener("offline", handleOffline);
    };
  }

  function unsupportedControl(operation) {
    return {
      operation: operation,
      reason:
        "Niet aangeroepen zonder officiële LG Signage-partnerdocumentatie en fysieke validatie.",
      supported: false
    };
  }

  function toBoundedInteger(value) {
    if (typeof value !== "number" || !isFinite(value) || value < 0) return 0;
    return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER || 9007199254740991);
  }

  function describeOrientation() {
    var screenValue = global.screen || {};
    var width = Number(screenValue.width || global.innerWidth || 0);
    var height = Number(screenValue.height || global.innerHeight || 0);
    if (!width || !height) return "unknown";
    return height > width ? "portrait" : "landscape";
  }

  function readSafeDiagnostics() {
    var capabilities = detectCapabilities();
    return {
      adapter: capabilities.adapter,
      appVersion: APP_VERSION,
      lgApiStatus:
        capabilities.features.scapDetected || capabilities.features.idcapDetected
          ? "Gedetecteerd; partnerdocumentatie en hardwarevalidatie vereist"
          : "Niet beschikbaar via de publieke webstandaard",
      online:
        typeof global.navigator === "object"
          ? global.navigator.onLine !== false
          : true,
      orientation: describeOrientation(),
      platformInfo: capabilities.platformInfo
    };
  }

  /*
   * SCAP en IDCAP worden hier uitsluitend feature-detected. Concrete methoden,
   * permissions en lifecyclecalls worden pas toegevoegd na officiële
   * model-/firmwaredocumentatie en fysieke validatie.
   */
  global.VeyoCastLgPlatformAdapter = Object.freeze({
    detectCapabilities: detectCapabilities,
    normalizeRemoteInput: normalizeRemoteInput,
    readNetworkInformation: readNetworkInformation,
    readPlatformInformation: readPlatformInformation,
    readSafeDiagnostics: readSafeDiagnostics,
    readStorageInformation: readStorageInformation,
    requestApplicationRestart: function requestApplicationRestart() {
      return unsupportedControl("application-restart");
    },
    requestControlledReboot: function requestControlledReboot() {
      return unsupportedControl("controlled-reboot");
    },
    subscribeLifecycle: subscribeLifecycle,
    subscribeNetwork: subscribeNetwork
  });
})(window);
