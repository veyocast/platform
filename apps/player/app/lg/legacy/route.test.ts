import { Script } from "node:vm";

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

  it("speelt LG-video online via HTTPS/Range en valt terug op de geverifieerde cache", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('document.createElement("img")');
    expect(html).toContain('document.createElement("video")');
    expect(html).toContain("preparePendingRelease");
    expect(html).toContain('window.crypto.subtle.digest("SHA-256", bytes)');
    expect(html).toContain("cache.put(asset.cacheKey, response)");
    expect(html).toContain("persistRelease(envelope, assets");
    expect(html).toContain("window.URL.createObjectURL(blob)");
    expect(html).toContain('item.kind === "video"');
    expect(html).toContain('item.source.url.toLowerCase().indexOf("https://") === 0');
    expect(html).toContain("callback(item.source.url, null, true)");
    expect(html).toContain("LEGACY_VIDEO_NETWORK_FALLBACK");
    expect(html).toContain("LEGACY_VIDEO_CACHE_FALLBACK_MISSING");
    expect(html).toContain("video.muted = true");
    expect(html).toContain("video.play()");
    expect(html).toContain("LEGACY_VIDEO_START_TIMEOUT");
    expect(html).toContain("LEGACY_VIDEO_STALLED");
  });

  it("laat ongewijzigde releases en het huidige beeld onaangeraakt", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('headers["If-None-Match"] = releaseEtag(knownReleaseId)');
    expect(html).toContain("status === 304 && knownReleaseId");
    expect(html).toContain("runtime.pendingRelease");
    expect(html).toContain("LEGACY_RELEASE_SWITCH_PENDING");
    expect(html).toContain("activatePendingRelease");
    expect(html).toContain("commitPendingMedia");
    expect(html).toContain("image.decode()");
    expect(html).toContain("legacy-media-layer");
  });

  it("rendert vertrouwde menu-, prijslijst-, nieuws- en sporttemplates zonder injecteerbare HTML", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('templateNode("section", "dynamic-template")');
    expect(html).toContain("renderMenuTemplate");
    expect(html).toContain("renderNewsTemplate");
    expect(html).toContain("renderPriceListTemplate");
    expect(html).toContain("renderMenuStudioTemplate");
    expect(html).toContain("menu-studio-v2");
    expect(html).toContain(".menu-studio-v2 .legacy-price-product>b{color:currentColor");
    expect(html).toContain("legacy-price-grid-two");
    expect(html).toContain("portraitTwoColumns");
    expect(html).toContain('snapshot.menuDocument');
    expect(html).toContain('orientation === "portrait" ? 14 : 8');
    expect(html).toContain("renderSportTemplate");
    expect(html).toContain("renderEditorialStandingTemplate");
    expect(html).toContain("legacy-standing-card");
    expect(html).toContain("var pages = templatePages(items, 10)");
    expect(html).toContain('slideType === "sport_results" ? (orientation === "portrait" ? 5 : 6)');
    expect(html).toContain("font-size:42px");
    expect(html).toContain("font-size:clamp(34.5px,3vw,58.5px)");
    expect(html).not.toContain("standing-club-edition");
    expect(html).not.toContain("legacy-standing-header");
    expect(html).toContain("#media-root>img,#media-root>video");
    expect(html).not.toContain("#media-root img,#media-root video");
    expect(html).toContain("editorial-arena-");
    expect(html).toContain("editorialArenaSlideTypes");
    expect(html).toContain("editorial-news");
    expect(html).toContain("editorial-news-qr");
    expect(html).toContain("legacy-price-grid");
    expect(html).toContain("legacy-price-media");
    expect(html).toContain('payload.slideType === "price_list"');
    expect(html).toContain("templateUniqueNewsArticles");
    expect(html).toContain("fitDynamicTemplateCanvas(root, payload.orientation)");
    expect(html).toContain('orientation === "portrait" ? 1080 : 1920');
    expect(html).toContain('orientation === "portrait" ? 1920 : 1080');
    expect(html).toContain('data-viewport-fit", orientationMatches ? "cover" : "contain"');
    expect(html).toContain('var orientationMatches = orientation === "portrait"');
    expect(html).toContain("Math.max(viewportWidth / logicalWidth, viewportHeight / logicalHeight)");
    expect(html).toContain('root.style.setProperty("--viewport-inset-y"');
    expect(html).toContain("padding-top:56.25%");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("justify-content:flex-start");
    expect(html).toContain("margin-top:auto");
    expect(html).not.toContain(".editorial-news-copy h2.compact");
    expect(html).not.toContain('arenaTitle.className = "compact"');
    expect(html).toContain("@keyframes editorial-photo-in");
    expect(html).toContain("@keyframes legacy-arrival-aurora");
    expect(html).toContain("@keyframes legacy-arrival-spotlight");
    expect(html).toContain("@keyframes legacy-arrival-kinetic");
    expect(html).toContain("@keyframes legacy-arrival-prism");
    expect(html).toContain("@keyframes legacy-arrival-flip");
    expect(html).toContain('"sport_visitor_arrivals"');
    expect(html).toContain('"sport_referee_arrivals"');
    expect(html).toContain('templateNode("div", "legacy-arrival-grid")');
    expect(html).toContain("LEGACY_TEMPLATE_READY");
    expect(html).toContain('"sport_match_of_the_day"');
    expect(html).toContain("element.textContent = text");
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("new Function(");
  });

  it("resolveert exact de tien goedgekeurde Theme Engine v2-thema's in Legacy", () => {
    const html = renderLgLegacyHtml();
    const ids = [
      "editorial",
      "obsidian",
      "atelier",
      "velocity",
      "heritage",
      "halo",
      "swiss",
      "pavilion",
      "tactical",
      "terrace"
    ];

    expect(html).toContain('themeManifestVersion":"1.0.0"');
    expect(html).toContain("snapshot.themePresentation");
    expect(html).toContain('root.setAttribute("data-theme-id"');
    ids.forEach((id) => {
      expect(html).toContain(`data-theme-id="${id}"`);
      expect(html).toContain(`"${id}":{`);
    });
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
    expect(html).toContain('appVersion');
    expect(html).toContain('X-VeyoCast-Player-Version');
    expect(html).toContain('runtime.applicationReloadPending = true');
    expect(html).toContain('"/api/player/commands"');
    expect(html).toContain("veyocast-player-cache-v1");
    expect(html).toContain("veyocast-player-assets-v1");
    expect(html).toContain("LEGACY_DEVICE_CREDENTIAL_RECOVERED");
    expect(html).toContain("VEYOCAST_LG_PLAYER_READY");
    expect(html).toContain('path: "/lg"');
    expect(html).toContain("syncPhase: runtime.syncPhase");
    expect(html).not.toContain('syncPhase: "lg-legacy"');
    expect(html).not.toContain('syncPhase: "lg-legacy-pairing"');
    expect(html).toContain("@keyframes legacy-rss-photo-in");
    expect(html).toContain("animation:legacy-rss-title-in 620ms 380ms");
    expect(html).toContain("animation:legacy-rss-copy-in 560ms 820ms");
    expect(html).toContain("@media(prefers-reduced-motion:reduce)");
    expect(html).not.toContain("expiresAt <= now()");
    expect(html).not.toContain("expiresAt > now() + 1000");
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

  it("ontvangt Goal Alerts via geauthenticeerde XHR-SSE zonder de LKG-scene te wissen", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('id="goal-overlay"');
    expect(html).toContain(
      'xhr.open("GET", "/api/player/realtime", true)'
    );
    expect(html).toContain(
      'xhr.setRequestHeader("Authorization", "Bearer " + token)'
    );
    expect(html).toContain('xhr.setRequestHeader("Accept", "text/event-stream")');
    expect(html).toContain("xhr.onprogress = function ()");
    expect(html).toContain("responseText.slice(runtime.goalStreamOffset)");
    expect(html).toContain(
      "runtime.goalStreamOffset >= CONFIG.goalStreamRecycleCharacters"
    );
    expect(html).toContain("armGoalStreamWatchdog(xhr, generation)");
    expect(html).toContain('"goalStreamSilenceMs":45000');
    expect(html).toContain("parseGoalSseBlock");
    expect(html).toContain('status === 204');
    expect(html).toContain(
      "scheduleGoalReconnect(CONFIG.goalDisabledRetryMs, generation)"
    );
    expect(html).toContain("goalReconnectDelay(runtime.goalReconnectAttempt)");
    expect(html).not.toContain("new EventSource(");

    expect(html).toContain(
      'xhr.open("POST", "/api/player/realtime/ack", true)'
    );
    expect(html).toContain(
      '["received", "rendered", "skipped", "failed"].indexOf(status)'
    );
    expect(html).toContain('"configuration_prefetched"');
    expect(html).toContain('"expired_or_duplicate"');
    expect(html).toContain('"replaced_before_activation"');
    expect(html).toContain('"legacy_overlay_render_failed"');
    expect(html).toContain('"render_latency_ms:"');
    expect(html).toContain(
      '"goalTerminalAckOutboxKey":"veyocast-player-ledscores-terminal-acks-v1"'
    );
    expect(html).toContain('"goalTerminalAckRetentionMs":604800000');
    expect(html).toContain("findGoalTerminalOutcome(");
    expect(html).toContain("flushGoalTerminalOutbox(token)");
    expect(html).toContain("responseStatus === 400 || responseStatus === 404");
    expect(html).toContain("attempts <= CONFIG.goalTerminalAckMaximumRetries");
    expect(html).toContain("goalTerminalAcknowledge(");
    const renderedCompletion = html.slice(
      html.indexOf('renderDetail = "render_latency_ms:"'),
      html.indexOf("visibleFor =", html.indexOf('renderDetail = "render_latency_ms:"'))
    );
    expect(renderedCompletion.indexOf("goalTerminalAcknowledge(")).toBeLessThan(
      renderedCompletion.indexOf("rememberGoal(")
    );

    expect(html).toContain("goalMaximumDedupeEntries");
    expect(html).toContain(
      '"goalDedupeKey":"veyocast-player-ledscores-dedupe-v1"'
    );
    expect(html).toContain("CONFIG.goalReconnectMaximumMs + 500");
    expect(html).toContain("runtime.goalPendingDeliveryId");
    expect(html).toContain("cancelPendingGoal(\"replaced_before_activation\")");
    expect(html).toContain("rememberGoal(");
    expect(html).toContain('node.textContent = value || ""');
    expect(html).toContain('metadata.appendChild(goalTextNode("span", "", "LIVE-TEST"))');
    expect(html).toContain("clearGoalElement()");
    expect(html).toContain(
      '#goal-overlay[data-palette="electric-orange"] .goal-scrim'
    );
    expect(html).toContain("byId(\"media-root\").innerHTML = \"\"");
    expect(html).not.toContain(
      'byId("media-root").innerHTML = renderGoalOverlay'
    );
  });

  it("ankert Legacy live match stale en wedstrijdklok op de gevalideerde SSE-servertijd", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain(
      "storeLedScoresMatchState(record.matchBindings[bindingIndex],"
    );
    expect(html).toContain("record.serverTime");
    expect(html).toContain("serverTimeOffsetMs: serverTimeOffsetMs");
    expect(html).toContain(
      "effectiveNow = Math.min(ledScoresMatchServerNow(state), state.staleAfter)"
    );
    expect(html).toContain(
      "stale = state.staleAfter <= ledScoresMatchServerNow(state)"
    );
    expect(html).toContain("Math.abs(state.serverTimeOffsetMs) <= 3162240000000");
    expect(html).not.toContain("stale = state.staleAfter <= now()");
  });

  it("pauzeert en hervat de legacy-onderlaag met resterende itemtijd", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain(
      "remaining = Math.max(1, runtime.playbackDeadlineAt - now())"
    );
    expect(html).toContain("runtime.playbackRemainingMs = remaining");
    expect(html).toContain('element.tagName === "VIDEO" && !element.paused');
    expect(html).toContain("schedulePlaybackAdvance(remaining)");
    expect(html).toContain(
      "remaining = Math.max(1, runtime.templateDeadlineAt - now())"
    );
    expect(html).toContain(
      "scheduleTemplateAdvance(templateCallback, templateRemaining)"
    );
    expect(html).toContain(
      "scheduleTemplateAdvance(advanceTemplatePage, templatePageDuration)"
    );
    expect(html).toContain("if (runtime.goalPauseApplied) return");
    expect(html).toContain("schedulePlaybackAdvance(templateDuration)");
    expect(html).toContain("schedulePlaybackAdvance(itemDurationMs(item))");
    expect(html).toContain("hideGoalOverlay(true)");
  });

  it("rendert LED Scores wedstrijdmomenten en live slides met Legacy-LKG", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('event === "goal_enrichment"');
    expect(html).toContain('event === "match_overlay"');
    expect(html).toContain('event === "match_state"');
    expect(html).toContain('"lineup_clear"');
    expect(html).toContain("updateActiveGoalPlayer");
    expect(html).toContain("renderMatchOverlay");
    expect(html).toContain("playLedScoresLiveMatchTemplate");
    expect(html).toContain('payload.slideType === "ledscores_live_match"');
    expect(html).toContain("veyocast-player-ledscores-match-states-v1");
    expect(html).toContain("runtime.ledScoresMatchStates");
    expect(html).toContain(
      "state.staleAfter <= ledScoresMatchServerNow(state)"
    );
    expect(html).toContain("window.clearInterval(runtime.ledScoresLiveMatchTimer)");
    expect(html).toContain("higher_priority_overlay_active");
    expect(html).toContain("scheduled_goal_enriched");
    expect(html).toContain("currentTime = enrichment.serverTime");
    expect(html).toContain("enrichment.sequence <= latestSequence");
    expect(html).toContain("runtime.goalEnrichmentSequences");
    expect(html).toContain("goalText(candidate.matchKey, 300)");
    expect(html).toContain("match-lineup-grid");
    expect(html).toContain("lineupPageDurationMs");
    expect(html).toContain("? 8 : 11");
    expect(html).toContain("runtime.goalLineupPageTimer");
    expect(html).toContain("live-match-timeline");
    expect(html).toContain('root.setAttribute("data-accent", config.accentMode)');
    expect(html).toContain('overlay.setAttribute("data-logo-scale", match.design.logoScale)');
    expect(html).toContain("payload.ownTeamKeys");
    expect(html).toContain("logoMediaAssetId = goalUuid(payload.logoMediaAssetId)");
    expect(html).toContain("home.logoUrl = logoUrl");
    expect(html).toContain("away.logoUrl = logoUrl");
    expect(html).toContain('match.design.showPreviousScore');
    expect(html).toContain('match.design.showScorer');

    const enrichmentHandler = html.slice(
      html.indexOf("function handleGoalEnrichmentDelivery"),
      html.indexOf("function parseGoalSseBlock")
    );
    expect(enrichmentHandler).toContain('"superseded_enrichment"');
    expect(enrichmentHandler.indexOf('"superseded_enrichment"')).toBeLessThan(
      enrichmentHandler.indexOf("runtime.goalPendingEnrichment = enrichment")
    );
  });

  it("rendert strikte S142-sceneparen met 24 assets en veilige webOS-fallback", () => {
    const html = renderLgLegacyHtml();
    const inlineScript = html.slice(
      html.indexOf("<script>") + "<script>".length,
      html.indexOf("</script>")
    );

    expect(html).toContain("parseGoalCanvasScenePair(payload.scene)");
    expect(html).toContain('record.assets.slice(0, 24)');
    expect(html).toContain("Math.min(24, values.length)");
    expect(html).toContain("goalCanvasSceneForViewport");
    expect(html).toContain('orientation === "portrait" ? 1080 : 1920');
    expect(html).toContain("goalCanvasScenePairAssetsReady(model.scenePair, model)");
    expect(html).toContain("createGoalCanvasBackground");
    expect(html).toContain('media.autoplay = true');
    expect(html).toContain("media.muted = true");
    expect(html).toContain("media.loop = true");
    expect(html).toContain('media.setAttribute("playsinline", "")');
    expect(html).toContain("createGoalCanvasLineup");
    expect(html).toContain('content.setAttribute("data-canvas-shape", layer.shape)');
    expect(html).toContain('content.style.top = "50%"');
    expect(html).toContain('content.style.backgroundColor = "transparent"');
    expect(html).toContain("Math.max(2, layer.strokeWidth)");
    expect(html).toContain("startGoalCanvasLineupPagination");
    expect(html).toContain('data-canvas-lineup-page-count');
    const canvasValues = html.slice(
      html.indexOf("function goalCanvasValues"),
      html.indexOf("function goalCanvasTextValue")
    );
    expect(canvasValues).not.toContain("headline: model.design.headline");
    expect(canvasValues).not.toContain("text.secondaryText");
    expect(canvasValues).not.toContain("model.design.scorerFallback");
    expect(html).toContain(
      "if (goal.scenePair && renderGoalCanvasOverlay(goal)) return true"
    );
    expect(html).toContain(
      "if (match.scenePair && renderGoalCanvasOverlay(match)) return true"
    );
    expect(html).toContain("#watermark{position:absolute;z-index:90");
    expect(html).not.toContain("aspect-ratio");
    expect(() => new Script(inlineScript)).not.toThrow();
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
