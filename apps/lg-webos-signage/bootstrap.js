(function startVeyoCastLgWrapper(global, documentValue) {
  "use strict";

  var APP_ID = "nl.veyocast.player.webos";
  var APP_VERSION = "1.0.1";
  var PLAYER_ORIGIN = "https://player.veyocast.nl";
  var PLAYER_URL = PLAYER_ORIGIN + "/lg";
  var HEALTH_URL = PLAYER_ORIGIN + "/healthz";
  var ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
  var HANDSHAKE_TIMEOUT_MS = 20000;
  var MAX_AUTOMATIC_ATTEMPTS = 8;
  var RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000, 60000];
  var ATTEMPT_STORAGE_KEY = "veyocast.lg.wrapper.attempts";
  var STATUS_STORAGE_KEY = "veyocast.lg.wrapper.last-status";
  var ERROR_LABELS = {
    DNS_HOST_UNREACHABLE: "DNS/host niet bereikbaar",
    HOSTED_PAGE_NOT_LOADED: "Hosted pagina niet geladen",
    IFRAME_BLOCKED: "Iframe geblokkeerd",
    JAVASCRIPT_ERROR: "JavaScript-fout",
    NO_NETWORK: "Geen netwerk",
    READY_TIMEOUT: "Geen READY-bericht ontvangen",
    TLS_ERROR: "TLS-fout",
    UNEXPECTED_MESSAGE_ORIGIN: "Onverwachte message-origin"
  };
  var adapter = global.VeyoCastLgPlatformAdapter;
  var frame = documentValue.getElementById("player-frame");
  var status = documentValue.getElementById("local-status");
  var statusLabel = documentValue.getElementById("status-label");
  var statusTitle = documentValue.getElementById("status-title");
  var statusCopy = documentValue.getElementById("status-copy");
  var retryButton = documentValue.getElementById("retry-button");
  var management = documentValue.getElementById("management");
  var resumeButton = documentValue.getElementById("resume-button");
  var reloadButton = documentValue.getElementById("reload-button");
  var stepNetwork = documentValue.getElementById("step-network");
  var stepHosted = documentValue.getElementById("step-hosted");
  var diagnosticAdapter = documentValue.getElementById("diagnostic-adapter");
  var diagnosticLgApi = documentValue.getElementById("diagnostic-lg-api");
  var previousSession = readStoredStatus();
  var handshakeTimer = null;
  var retryTimer = null;
  var playerReady = false;
  var manualRetryAvailableAt = 0;
  var runtime = {
    currentUrl: PLAYER_URL,
    errorCode: null,
    errorMessage: null,
    iframeError: null,
    iframeLoaded: false,
    lastChange: new Date().toISOString(),
    lastMessageOrigin: null,
    messageCount: 0,
    online: readOnline(),
    retryCount: readAttemptState().timestamps.length,
    statusCode: "LOCAL_STARTED",
    timedOut: false
  };
  var hostProbe = {
    complete: false,
    error: null,
    reachable: false
  };

  if (!adapter || !frame || !status) {
    global.location.replace("offline.html");
    return;
  }

  updateDiagnostics();
  addEventListeners();
  beginAttempt(false);

  function addEventListeners() {
    global.addEventListener("message", handlePlayerMessage);
    global.addEventListener("error", handleJavascriptError);
    global.addEventListener("unhandledrejection", handleJavascriptError);
    frame.addEventListener("load", handleFrameLoad);
    frame.addEventListener("error", handleFrameError);
    adapter.subscribeNetwork(handleNetworkChange);
    adapter.subscribeLifecycle(handleResume);
    documentValue.addEventListener("keydown", handleLocalRemoteInput, true);
    retryButton.addEventListener("click", function retryManually() {
      if (Date.now() < manualRetryAvailableAt) return;
      manualRetryAvailableAt = Date.now() + 5000;
      beginAttempt(true);
    });
    resumeButton.addEventListener("click", closeManagement);
    reloadButton.addEventListener("click", function reloadHostedPlayer() {
      closeManagement();
      beginAttempt(true);
    });
  }

  function beginAttempt(manual) {
    clearTimers();
    playerReady = false;
    runtime.online = readOnline();
    runtime.iframeLoaded = false;
    runtime.iframeError = null;
    runtime.timedOut = false;
    runtime.errorCode = null;
    runtime.errorMessage = null;
    hostProbe = { complete: false, error: null, reachable: false };

    if (!runtime.online) {
      failAttempt(
        "NO_NETWORK",
        "Dit apparaat meldt dat er geen netwerkverbinding beschikbaar is."
      );
      scheduleAutomaticRetry();
      return;
    }

    if (!manual && !reserveAutomaticAttempt()) {
      showFailure(
        "Automatisch herstel gepauzeerd",
        "De veilige limiet van acht pogingen in vijftien minuten is bereikt. Controleer de verbinding en kies daarna Opnieuw proberen."
      );
      return;
    }

    runtime.retryCount = readAttemptState().timestamps.length;
    setStep(stepNetwork, "done", "Netwerk beschikbaar");
    setStep(stepHosted, "active", "Hosted Player openen");
    setRuntimeStatus("HOSTED_LOADING");
    showStarting();
    probeHostedOrigin();
    frame.src = PLAYER_URL;
    handshakeTimer = global.setTimeout(handleHandshakeTimeout, HANDSHAKE_TIMEOUT_MS);
  }

  function probeHostedOrigin() {
    if (typeof global.fetch !== "function") {
      hostProbe.complete = true;
      return;
    }
    global
      .fetch(HEALTH_URL, {
        cache: "no-store",
        method: "GET",
        mode: "no-cors"
      })
      .then(function probeSucceeded() {
        hostProbe.complete = true;
        hostProbe.reachable = true;
      })
      .catch(function probeFailed(error) {
        hostProbe.complete = true;
        hostProbe.error = safeErrorText(error);
      });
  }

  function handleFrameLoad() {
    runtime.iframeLoaded = true;
    runtime.iframeError = null;
    setRuntimeStatus("IFRAME_LOADED");
    setStep(stepHosted, "active", "Pagina geladen; wachten op READY");
  }

  function handleFrameError() {
    runtime.iframeError = "load-event";
    failAttempt(
      hostProbe.reachable ? "HOSTED_PAGE_NOT_LOADED" : classifyConnectionFailure(hostProbe.error),
      "De browser kon de hosted Player niet als pagina laden."
    );
    scheduleAutomaticRetry();
  }

  function handleHandshakeTimeout() {
    handshakeTimer = null;
    if (playerReady) return;
    runtime.timedOut = true;

    if (runtime.iframeError) {
      failAttempt(
        "HOSTED_PAGE_NOT_LOADED",
        "De iframe rapporteerde een laadfout voordat de Player gereed was."
      );
    } else if (runtime.iframeLoaded) {
      failAttempt(
        "READY_TIMEOUT",
        "De pagina laadde, maar stuurde niet binnen twintig seconden het verwachte READY-bericht."
      );
    } else if (hostProbe.reachable) {
      failAttempt(
        "IFRAME_BLOCKED",
        "De host is bereikbaar, maar de iframe-load of framingbeveiliging werd niet voltooid."
      );
    } else {
      failAttempt(
        classifyConnectionFailure(hostProbe.error),
        "Het apparaat is online, maar de VeyoCast-host kon niet aantoonbaar worden bereikt."
      );
    }
    scheduleAutomaticRetry();
  }

  function failAttempt(code, message) {
    clearHandshakeTimer();
    runtime.errorCode = code;
    runtime.errorMessage = message;
    setRuntimeStatus("ERROR");
    setStep(
      stepNetwork,
      code === "NO_NETWORK" ? "error" : "done",
      code === "NO_NETWORK" ? "Geen netwerk" : "Netwerk beschikbaar"
    );
    setStep(stepHosted, "error", ERROR_LABELS[code] || "Start mislukt");
    showFailure(ERROR_LABELS[code] || "Playerstart mislukt", message);
  }

  function classifyConnectionFailure(errorText) {
    if (/certificate|cert_|ssl|tls|net::err_cert/iu.test(String(errorText || ""))) {
      return "TLS_ERROR";
    }
    return "DNS_HOST_UNREACHABLE";
  }

  function scheduleAutomaticRetry() {
    var attemptState = readAttemptState();
    if (attemptState.timestamps.length >= MAX_AUTOMATIC_ATTEMPTS) return;
    var delayIndex = Math.max(0, attemptState.timestamps.length - 1);
    var delay =
      RETRY_DELAYS_MS[Math.min(delayIndex, RETRY_DELAYS_MS.length - 1)];
    retryTimer = global.setTimeout(function retryAfterBackoff() {
      retryTimer = null;
      beginAttempt(false);
    }, delay);
  }

  function reserveAutomaticAttempt() {
    var attemptState = readAttemptState();
    if (attemptState.timestamps.length >= MAX_AUTOMATIC_ATTEMPTS) return false;
    attemptState.timestamps.push(Date.now());
    writeAttemptState(attemptState);
    return true;
  }

  function readAttemptState() {
    var now = Date.now();
    try {
      var stored = JSON.parse(
        global.localStorage.getItem(ATTEMPT_STORAGE_KEY) || "{}"
      );
      var timestamps = Array.isArray(stored.timestamps)
        ? stored.timestamps.filter(function keepRecent(timestamp) {
            return (
              typeof timestamp === "number" &&
              timestamp <= now &&
              timestamp > now - ATTEMPT_WINDOW_MS
            );
          })
        : [];
      return { timestamps: timestamps };
    } catch (_error) {
      return { timestamps: [] };
    }
  }

  function writeAttemptState(attemptState) {
    try {
      global.localStorage.setItem(
        ATTEMPT_STORAGE_KEY,
        JSON.stringify(attemptState)
      );
    } catch (_error) {
      // De in-memory timers blijven een snelle herlaadlus voorkomen.
    }
  }

  function handlePlayerMessage(event) {
    if (event.source !== frame.contentWindow) return;

    runtime.messageCount += 1;
    runtime.lastMessageOrigin = safeOrigin(event.origin);
    updateDiagnostics();

    if (event.origin !== PLAYER_ORIGIN) {
      failAttempt(
        "UNEXPECTED_MESSAGE_ORIGIN",
        "Een iframebericht kwam niet van de vaste VeyoCast Player-origin."
      );
      return;
    }
    if (!event.data || typeof event.data.type !== "string") return;

    if (
      event.data.type === "VEYOCAST_LG_PLAYER_READY" &&
      event.data.protocolVersion === 1 &&
      event.data.path === "/lg"
    ) {
      playerReady = true;
      clearHandshakeTimer();
      runtime.errorCode = null;
      runtime.errorMessage = null;
      runtime.timedOut = false;
      setRuntimeStatus("READY");
      setStep(stepHosted, "done", "Hosted Player gereed");
      status.hidden = true;
      postCapabilities();
      frame.focus();
      return;
    }

    if (event.data.type === "VEYOCAST_LG_PLAYER_CONNECTIVITY") {
      runtime.online = event.data.online === true;
      updateDiagnostics();
      return;
    }

    if (
      event.data.type === "VEYOCAST_LG_REMOTE_INPUT" &&
      event.data.command === "back"
    ) {
      if (management.hidden) openManagement();
      else closeManagement();
    }
  }

  function handleJavascriptError(event) {
    var message =
      event && typeof event.message === "string"
        ? event.message
        : event && event.reason
          ? safeErrorText(event.reason)
          : "Onbekende JavaScript-fout";
    failAttempt(
      "JAVASCRIPT_ERROR",
      "De lokale wrapper rapporteerde een JavaScript-fout: " +
        truncate(message, 160)
    );
  }

  function postCapabilities() {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage(
      {
        capabilities: adapter.detectCapabilities(),
        type: "VEYOCAST_LG_CAPABILITIES"
      },
      PLAYER_ORIGIN
    );
  }

  function postResume(reason) {
    if (!playerReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { reason: reason, type: "VEYOCAST_LG_RESUME" },
      PLAYER_ORIGIN
    );
  }

  function handleNetworkChange(online) {
    runtime.online = online === true;
    updateDiagnostics();
    if (!runtime.online) {
      if (!playerReady) {
        failAttempt(
          "NO_NETWORK",
          "De netwerkverbinding viel weg voordat de Player gereed was."
        );
      }
      return;
    }
    if (playerReady) {
      postResume("network-recovery");
      return;
    }
    beginAttempt(false);
  }

  function handleResume(reason) {
    runtime.online = readOnline();
    updateDiagnostics();
    postResume(reason);
    if (playerReady) frame.focus();
  }

  function handleLocalRemoteInput(event) {
    var command = adapter.normalizeRemoteInput(event);
    var back = command === "back";

    if (back) {
      event.preventDefault();
      if (management.hidden) openManagement();
      else closeManagement();
      return;
    }

    if (management.hidden) return;
    if (command === "up" || command === "down") {
      event.preventDefault();
      var buttons = [resumeButton, reloadButton];
      var currentIndex = buttons.indexOf(documentValue.activeElement);
      var direction = command === "up" ? -1 : 1;
      buttons[
        (currentIndex + direction + buttons.length) % buttons.length
      ].focus();
    }
  }

  function openManagement() {
    updateDiagnostics();
    management.hidden = false;
    resumeButton.focus();
  }

  function closeManagement() {
    management.hidden = true;
    frame.focus();
  }

  function updateDiagnostics() {
    var details = adapter.readSafeDiagnostics();
    var values = {
      "current-url": sanitizeUrl(runtime.currentUrl),
      "iframe-error": runtime.iframeError || "Geen",
      "iframe-load": runtime.iframeLoaded ? "Ja" : "Nee",
      identity: APP_ID + " · " + APP_VERSION,
      "last-change": formatTimestamp(runtime.lastChange),
      "last-error": runtime.errorCode
        ? runtime.errorCode + " · " + (runtime.errorMessage || ERROR_LABELS[runtime.errorCode])
        : "Geen",
      "message-origin": runtime.lastMessageOrigin || "Geen",
      messages: String(runtime.messageCount),
      online: runtime.online ? "Verbonden" : "Geen netwerk",
      "previous-session": describePreviousSession(),
      ready: playerReady ? "Ja" : "Nee",
      retries: String(runtime.retryCount),
      timeout: runtime.timedOut ? "Ja" : "Nee",
      "user-agent": truncate(String(global.navigator.userAgent || "Onbekend"), 220)
    };

    Object.keys(values).forEach(function updateDiagnostic(key) {
      var nodes = documentValue.querySelectorAll(
        '[data-diagnostic="' + key + '"]'
      );
      Array.prototype.forEach.call(nodes, function setText(node) {
        node.textContent = values[key];
      });
    });

    diagnosticAdapter.textContent =
      details.adapter === "webos-signage"
        ? "Optionele LG-adapter gedetecteerd"
        : "Webstandaard";
    diagnosticLgApi.textContent = details.lgApiStatus;
  }

  function setRuntimeStatus(statusCode) {
    runtime.statusCode = statusCode;
    runtime.lastChange = new Date().toISOString();
    persistStatus();
    updateDiagnostics();
  }

  function persistStatus() {
    try {
      global.localStorage.setItem(
        STATUS_STORAGE_KEY,
        JSON.stringify({
          errorCode: runtime.errorCode,
          lastChange: runtime.lastChange,
          retryCount: runtime.retryCount,
          statusCode: runtime.statusCode
        })
      );
    } catch (_error) {
      // Diagnose blijft tijdens deze sessie zichtbaar.
    }
  }

  function readStoredStatus() {
    try {
      var value = JSON.parse(global.localStorage.getItem(STATUS_STORAGE_KEY) || "null");
      if (!value || typeof value !== "object") return null;
      return {
        errorCode:
          typeof value.errorCode === "string" ? value.errorCode : null,
        lastChange:
          typeof value.lastChange === "string" ? value.lastChange : null,
        statusCode:
          typeof value.statusCode === "string" ? value.statusCode : "ONBEKEND"
      };
    } catch (_error) {
      return null;
    }
  }

  function describePreviousSession() {
    if (!previousSession) return "Geen opgeslagen status";
    return (
      previousSession.statusCode +
      (previousSession.errorCode ? " · " + previousSession.errorCode : "") +
      (previousSession.lastChange
        ? " · " + formatTimestamp(previousSession.lastChange)
        : "")
    );
  }

  function showStarting() {
    status.hidden = false;
    statusLabel.textContent = "Lokale wrapper actief";
    statusTitle.textContent = "VeyoCast Player wordt gestart";
    statusCopy.textContent =
      "De netwerkcontrole is geslaagd. De hosted Player wordt geopend en moet daarna de beveiligde READY-handshake bevestigen.";
    retryButton.hidden = true;
  }

  function showFailure(title, copy) {
    status.hidden = false;
    statusLabel.textContent = "Startdiagnose";
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
    retryButton.hidden = false;
    retryButton.focus();
    updateDiagnostics();
  }

  function setStep(node, state, text) {
    node.setAttribute("data-state", state);
    node.getElementsByTagName("span")[0].textContent = text;
  }

  function clearHandshakeTimer() {
    if (handshakeTimer) global.clearTimeout(handshakeTimer);
    handshakeTimer = null;
  }

  function clearTimers() {
    clearHandshakeTimer();
    if (retryTimer) global.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function readOnline() {
    return !global.navigator || global.navigator.onLine !== false;
  }

  function safeOrigin(origin) {
    if (origin === "null") return "null";
    try {
      return new URL(origin).origin;
    } catch (_error) {
      return "ongeldige origin";
    }
  }

  function sanitizeUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.origin + parsed.pathname;
    } catch (_error) {
      return "ongeldige URL";
    }
  }

  function safeErrorText(error) {
    if (error && typeof error.message === "string") return error.message;
    return String(error || "Onbekende fout");
  }

  function truncate(value, maximum) {
    return value.length > maximum ? value.slice(0, maximum) + "…" : value;
  }

  function formatTimestamp(value) {
    try {
      return new Date(value).toLocaleString("nl-NL");
    } catch (_error) {
      return value;
    }
  }
})(window, document);
