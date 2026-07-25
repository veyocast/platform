(function startVeyoCastLgWrapper(global, documentValue) {
  "use strict";

  var PLAYER_ORIGIN = "https://player.veyocast.nl";
  var PLAYER_URL = PLAYER_ORIGIN + "/lg";
  var ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
  var HANDSHAKE_TIMEOUT_MS = 20000;
  var MAX_AUTOMATIC_ATTEMPTS = 8;
  var RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000, 60000];
  var ATTEMPT_STORAGE_KEY = "veyocast.lg.wrapper.attempts";
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
  var diagnosticPlayer = documentValue.getElementById("diagnostic-player");
  var diagnosticNetwork = documentValue.getElementById("diagnostic-network");
  var diagnosticAdapter = documentValue.getElementById("diagnostic-adapter");
  var diagnosticLgApi = documentValue.getElementById("diagnostic-lg-api");
  var handshakeTimer = null;
  var retryTimer = null;
  var playerReady = false;
  var manualRetryAvailableAt = 0;

  if (!adapter || !frame || !status) {
    global.location.replace("offline.html");
    return;
  }

  updateDiagnostics();
  addEventListeners();
  beginAttempt(false);

  function addEventListeners() {
    global.addEventListener("message", handlePlayerMessage);
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
    updateDiagnostics();

    if (!manual && !reserveAutomaticAttempt()) {
      showOffline(
        "Automatisch herstel gepauzeerd",
        "Om een herlaadlus te voorkomen is automatisch opnieuw proberen tijdelijk gepauzeerd. Gebruik Probeer opnieuw nadat je de verbinding hebt gecontroleerd."
      );
      return;
    }

    showStarting();
    frame.src = "about:blank";
    global.setTimeout(function loadHostedPlayer() {
      frame.src = PLAYER_URL;
      handshakeTimer = global.setTimeout(handleHandshakeTimeout, HANDSHAKE_TIMEOUT_MS);
    }, 50);
  }

  function handleHandshakeTimeout() {
    handshakeTimer = null;
    if (playerReady) return;
    frame.src = "about:blank";
    showOffline(
      "Geen verbinding met VeyoCast",
      "De hosted Player kon niet veilig worden gestart. Er wordt met begrensde tussenpozen automatisch opnieuw geprobeerd."
    );
    scheduleAutomaticRetry();
  }

  function scheduleAutomaticRetry() {
    var state = readAttemptState();
    if (state.timestamps.length >= MAX_AUTOMATIC_ATTEMPTS) return;
    var delayIndex = Math.max(0, state.timestamps.length - 1);
    var delay =
      RETRY_DELAYS_MS[Math.min(delayIndex, RETRY_DELAYS_MS.length - 1)];
    retryTimer = global.setTimeout(function retryAfterBackoff() {
      retryTimer = null;
      beginAttempt(false);
    }, delay);
  }

  function reserveAutomaticAttempt() {
    var state = readAttemptState();
    if (state.timestamps.length >= MAX_AUTOMATIC_ATTEMPTS) return false;
    state.timestamps.push(Date.now());
    writeAttemptState(state);
    return true;
  }

  function readAttemptState() {
    var now = Date.now();
    try {
      var stored = JSON.parse(global.localStorage.getItem(ATTEMPT_STORAGE_KEY) || "{}");
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

  function writeAttemptState(state) {
    try {
      global.localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // The in-memory attempt and timer bounds still prevent a tight reload loop.
    }
  }

  function handlePlayerMessage(event) {
    if (
      event.origin !== PLAYER_ORIGIN ||
      event.source !== frame.contentWindow ||
      !event.data ||
      typeof event.data.type !== "string"
    ) {
      return;
    }

    if (
      event.data.type === "VEYOCAST_LG_PLAYER_READY" &&
      event.data.protocolVersion === 1 &&
      event.data.path === "/lg"
    ) {
      playerReady = true;
      if (handshakeTimer) global.clearTimeout(handshakeTimer);
      handshakeTimer = null;
      status.hidden = true;
      diagnosticPlayer.textContent = "Verbonden";
      postCapabilities();
      frame.focus();
      return;
    }

    if (event.data.type === "VEYOCAST_LG_PLAYER_CONNECTIVITY") {
      diagnosticNetwork.textContent = event.data.online
        ? "Verbonden"
        : "Geen internetverbinding";
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
    updateDiagnostics();
    if (!online) return;
    if (playerReady) {
      postResume("network-recovery");
      return;
    }
    beginAttempt(false);
  }

  function handleResume(reason) {
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
      buttons[(currentIndex + direction + buttons.length) % buttons.length].focus();
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
    diagnosticNetwork.textContent = details.online
      ? "Netwerk beschikbaar"
      : "Geen internetverbinding";
    diagnosticAdapter.textContent =
      details.adapter === "webos-signage"
        ? "Optionele LG-adapter gedetecteerd"
        : "Webstandaard";
    diagnosticLgApi.textContent = details.lgApiStatus;
  }

  function showStarting() {
    status.hidden = false;
    statusLabel.textContent = "Player starten";
    statusTitle.textContent = "Verbinding met VeyoCast maken";
    statusCopy.textContent =
      "De Player wordt veilig geladen. Als het netwerk tijdelijk niet beschikbaar is, proberen we het automatisch opnieuw.";
    retryButton.hidden = true;
  }

  function showOffline(title, copy) {
    status.hidden = false;
    statusLabel.textContent = "Automatisch herstellen";
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
    retryButton.hidden = false;
    retryButton.focus();
  }

  function clearTimers() {
    if (handshakeTimer) global.clearTimeout(handshakeTimer);
    if (retryTimer) global.clearTimeout(retryTimer);
    handshakeTimer = null;
    retryTimer = null;
  }
})(window, document);
