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
    expect(html).toContain("appendFloatingBlock");
    expect(html).toContain("legacy-menu-floating");
    expect(html).toContain('block.type === "video"');
    expect(html).toContain('block.type === "logo"');
    expect(html).toContain('block.type === "promo"');
    expect(html).toContain('block.type === "text"');
    expect(html).toContain(".menu-studio-v2 .legacy-price-product>b{color:currentColor");
    expect(html).toContain("legacy-price-grid-two");
    expect(html).toContain("portraitTwoColumns");
    expect(html).toContain('snapshot.menuDocument');
    expect(html).toContain('orientation === "portrait" ? 20 : 8');
    expect(html).toContain("firstPageCapacity(floatingBlocks");
    expect(html).toContain("renderSportTemplate");
    expect(html).toContain("item.homeLogoMediaAssetId");
    expect(html).toContain("item.awayLogoMediaAssetId");
    expect(html).toContain("renderEditorialStandingTemplate");
    expect(html).toContain("legacy-standing-card");
    expect(html).toContain("var pages = templatePages(items, 10)");
    expect(html).toContain('slideType === "sport_results" ? (orientation === "portrait" ? 5 : 6)');
    expect(html).toContain("font-size:var(--vc-theme-font-42,42px)");
    expect(html).toContain("font-size:var(--vc-theme-font-57-6,57.6px)");
    expect(html).not.toContain("standing-club-edition");
    expect(html).not.toContain("legacy-standing-header");
    expect(html).toContain("#media-root>img,#media-root>video");
    expect(html).not.toContain("#media-root img,#media-root video");
    expect(html).toContain("editorial-arena-");
    expect(html).toContain("editorialArenaSlideTypes");
    expect(html).toContain("editorial-news");
    expect(html).toContain("editorial-news-qr");
    expect(html).toContain("width:220px;height:220px");
    expect(html).not.toContain("templateReadableNewsUrl");
    expect(html).toContain('data-news-variant", newsVariant');
    expect(html).toContain('"hero_split", "fullscreen_gradient", "news_grid", "text_only"');
    expect(html).toContain("editorial-news-grid");
    expect(html).toContain("Scan voor het artikel");
    expect(html).toContain("if (fullscreenQr) arenaPage.appendChild(fullscreenQr)");
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
    expect(html).toContain('templateNode("div", "legacy-visitor-schedule")');
    expect(html).toContain('templateNode("div", "legacy-visitor-teams")');
    expect(html).toContain('templateNode("dl", "legacy-visitor-details")');
    expect(html).toContain("templateVisitorArrivalDate");
    expect(html).toContain("templateVisitorVenueWelcome");
    expect(html).toContain('"Kleedkamers:"');
    expect(html).toContain('"Scheidsrechter:"');
    expect(html).toContain("--vc-visitor-title-size-portrait");
    expect(html).toContain("--vc-theme-font-46,46px");
    expect(html).toContain("--vc-theme-font-52,52px");
    expect(html).toContain("--vc-theme-font-23,23px");
    expect(html).toContain("--vc-theme-font-26,26px");
    expect(html).not.toContain("calc(var(--vc-title-size-portrait,49px) * .86)");
    expect(html).not.toContain(".legacy-visitor-schedule{display:flex;flex-direction:column;gap:");
    expect(html).not.toContain(".legacy-visitor-teams h2 span{overflow-wrap:anywhere");
    expect(html).toContain("legacy-arrival-sponsor");
    expect(html).toContain("arrivalConfiguration.sponsorMediaAssetId");
    expect(html).toContain('list.setAttribute("data-columns", columns)');
    expect(html).toContain("configureLegacyMatchColumns(");
    expect(html).toContain("templateSportDisplayConfiguration(sport.displayConfig)");
    expect(html).toContain("renderLegacyProgramPrimary(");
    expect(html).toContain("renderLegacyProgramSecondary(");
    expect(html).toContain("renderLegacyResultPrimary(");
    expect(html).toContain('templateNode("i", "legacy-result-score")');
    expect(html).toContain(
      '.editorial-arena.portrait .editorial-news[data-news-variant="hero_split"]{box-sizing:border-box;gap:32px;padding-right:20px;padding-left:20px}'
    );
    expect(html).toContain('data-render-family", "team-roster"');
    expect(html).toContain('data-render-family", "sponsor-spotlight"');
    expect(html).toContain('data-render-family", "training-schedule"');
    expect(html).toContain('data-render-family", "volunteer-call"');
    expect(html).toContain('data-render-family", typedKind + "-list"');
    expect(html).toContain("renderLegacyTeamMini");
    expect(html).toContain("item.photoMediaAssetId");
    expect(html).toContain("var(--editorial-image-overlay-start)");
    expect(html).toContain("var(--editorial-image-overlay-mid)");
    expect(html).toContain("var(--editorial-image-overlay-end)");
    expect(html).toContain("configuredEditorialTokens");
    expect(html).toContain("linear-gradient(180deg,var(--editorial-image-overlay-end)");
    expect(html).not.toContain("linear-gradient(90deg,rgba(4,47,45,.55)");
    expect(html).toContain("LEGACY_TEMPLATE_READY");
    expect(html).toContain("if (editorialArena) {");
    expect(html).toContain('"matchcentre-clock"');
    expect(html).not.toContain('templateNode("span", "", "VeyoCast")');
    expect(html).not.toContain('"VeyoCast ClubTV"');
    expect(html).toContain('"sport_match_of_the_day"');
    expect(html).toContain("element.textContent = text");
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("new Function(");
  });

  it("resolveert FieldFlow plus tien historische renderthema's in Legacy", () => {
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
      "terrace",
      "fieldflow"
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

  it("houdt Static LG gelijk aan de Match Centre theme- en layoutcontracten", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("templatePageCounter(pageIndex, pageCount)");
    expect(html).toContain('"strong", "", "MATCHCENTRE"');
    expect(html).toContain('"b", "matchcentre-page-number"');
    expect(html).toContain('"matchcentre-clock"');
    expect(html).toContain("templateMatchCentreClock(");
    expect(html).toContain("runtime.matchCentreClockTimer");
    expect(html).toContain(
      "top:calc(52px + var(--viewport-inset-y,0px))"
    );
    expect(html).toContain(
      "bottom:calc(52px + var(--viewport-inset-y,0px))"
    );
    expect(html).toContain(
      ".legacy-fixture-list,.legacy-result-list{display:grid;grid-auto-rows:115px;align-content:start"
    );
    expect(html).toContain(
      '[data-columns="two"]{grid-auto-flow:column;grid-template-columns:repeat(2,minmax(0,1fr))'
    );
    expect(html).toContain(
      ".legacy-fixture-row,.legacy-result-row{display:grid;align-content:center"
    );
    expect(html).toContain(
      ".portrait .legacy-fixture-list{grid-auto-rows:221px}.portrait .legacy-result-list{grid-auto-rows:314px}"
    );
    expect(html).toContain(
      ".legacy-program-primary{grid-template-columns:var(--legacy-program-columns)}"
    );
    expect(html).toContain(
      ".legacy-result-primary{grid-template-columns:var(--legacy-result-columns)}"
    );
    expect(html).toContain(
      ".legacy-program-secondary{display:flex;align-items:center;justify-content:flex-end"
    );
    expect(html).toContain(".legacy-result-score{display:flex;min-width:112px");
    expect(html).toContain(
      "font-size:var(--vc-theme-sport-result-size-compact,24px)"
    );
    expect(html).toContain(
      "font-size:var(--vc-theme-sport-score-size-compact,42px)"
    );
    expect(html.match(/compact \? "48px" : "57px"/g)).toHaveLength(2);
    expect(html).toContain(
      'slideType === "sport_program" ? (orientation === "portrait" ? 7 : 6)'
    );
    expect(html).toContain('Math.ceil(itemCount / 2) + ",115px)"');
    expect(html).toContain("@keyframes legacy-match-row-in");
    expect(html).toContain(
      "templateSportDisplayConfiguration(sport.displayConfig)"
    );
    expect(html).toContain("Number(themePresentation.snapshotVersion) === 2");
    expect(html).toContain('"--vc-club-logo-background"');
    expect(html).toContain('"--vc-home-logo-background"');
    expect(html).toContain('"--vc-theme-body-font"');
    expect(html).toContain('"--vc-sport-row-size"');
    expect(html).toContain('"--vc-theme-sport-result-size-compact"');
    expect(html).toContain('"--vc-theme-sport-score-size-compact"');
    expect(html).toContain("24 * baseScale * sportScale / 1.12");
    expect(html).toContain("42 * baseScale * sportScale / 1.12");
    expect(html).toContain("snapshot._veyocastThemeRuntime");
    expect(html).toContain("Number(themeRuntime.version) >= 2");
    expect(html).toContain('["--vc-theme-canvas", "canvas"');
    expect(html).toContain('["--vc-theme-text-muted", "textMuted"');
    expect(html).toContain('"themeFontSizes":[');
    expect(html).toContain('"--vc-theme-font-" + String(themeFontSize)');
    expect(html).toContain("themeFontSize * baseScale * 1000");
    expect(html).toContain("font-size:var(--vc-theme-font-34,34px)");
    expect(html).toContain(
      "var limit = Number(maximum) === 100 ? 100 : 40"
    );
    expect(html).toContain('slideType === "sport_program" || slideType === "sport_results"');
    expect(html).not.toContain(
      'footer.appendChild(templateNode("span", "", sourceLabel))'
    );
    expect(html).not.toContain("MATCHCENTRE / 03");
  });

  it("rendert programma en uitslagen in de vaste S158-volgorde", () => {
    const html = renderLgLegacyHtml();
    const programStart = html.indexOf("function renderLegacyProgramPrimary");
    const programEnd = html.indexOf(
      "function renderLegacyProgramSecondary",
      programStart
    );
    const programSource = html.slice(programStart, programEnd);
    const programOrder = [
      "displayConfiguration.showDate",
      "displayConfiguration.showTime",
      "displayConfiguration.showHomeLogo",
      "teams[0], item.homeLogoMediaAssetId",
      'renderLegacyMatchTeam(teams[0], "home")',
      "displayConfiguration.showHomeDressingRoom",
      '"legacy-match-separator", "vs."',
      "displayConfiguration.showAwayLogo",
      "teams[1], item.awayLogoMediaAssetId",
      'renderLegacyMatchTeam(teams[1], "away")',
      "displayConfiguration.showAwayDressingRoom"
    ];
    for (let index = 1; index < programOrder.length; index += 1) {
      expect(programSource.indexOf(programOrder[index]!)).toBeGreaterThan(
        programSource.indexOf(programOrder[index - 1]!)
      );
    }

    const secondaryStart = html.indexOf(
      "function renderLegacyProgramSecondary"
    );
    const secondaryEnd = html.indexOf(
      "function templateLegacyResultScore",
      secondaryStart
    );
    const secondarySource = html.slice(secondaryStart, secondaryEnd);
    expect(secondarySource.indexOf("displayConfiguration.showField")).toBeGreaterThan(
      secondarySource.indexOf("displayConfiguration.showReferee")
    );
    expect(secondarySource.indexOf("displayConfiguration.showSportpark")).toBeGreaterThan(
      secondarySource.indexOf("displayConfiguration.showField")
    );
    expect(secondarySource).toContain(
      "secondary.children.length ? secondary : null"
    );

    const resultStart = html.indexOf("function renderLegacyResultPrimary");
    const resultEnd = html.indexOf(
      "function configureLegacyMatchColumns",
      resultStart
    );
    const resultSource = html.slice(resultStart, resultEnd);
    const resultOrder = [
      "displayConfiguration.showDate",
      "displayConfiguration.showTime",
      "displayConfiguration.showHomeLogo",
      "teams[0], item.homeLogoMediaAssetId",
      'renderLegacyMatchTeam(teams[0], "home")',
      "primary.appendChild(score)",
      "displayConfiguration.showAwayLogo",
      "teams[1], item.awayLogoMediaAssetId",
      'renderLegacyMatchTeam(teams[1], "away")'
    ];
    for (let index = 1; index < resultOrder.length; index += 1) {
      expect(resultSource.indexOf(resultOrder[index]!)).toBeGreaterThan(
        resultSource.indexOf(resultOrder[index - 1]!)
      );
    }
    expect(resultSource).toContain('"Uitslag nog niet bekend"');
    expect(resultSource).toContain(
      'score.appendChild(templateNode("span", "", "–"))'
    );
    expect(resultSource).toContain(
      '"Uitslag " + homeScore + " tegen " + awayScore'
    );
    expect(html).toContain(
      "numeric >= 0 && numeric <= 999"
    );
  });

  it("projecteert displayfallbacks, appearance en alle 26 theme-kleurrollen", () => {
    const html = renderLgLegacyHtml();
    const normalizedStart = html.indexOf(
      "function templateSportDisplayConfiguration"
    );
    const normalizedEnd = html.indexOf(
      "function templateSportOfficials",
      normalizedStart
    );
    const normalizedSource = html.slice(normalizedStart, normalizedEnd);
    expect(normalizedSource).toContain(
      'typeof source.showHomeLogo === "boolean"'
    );
    expect(normalizedSource).toContain(
      'typeof source.showAwayLogo === "boolean"'
    );
    expect(normalizedSource).toContain(
      'typeof source.showHomeDressingRoom === "boolean"'
    );
    expect(normalizedSource).toContain(
      'typeof source.showAwayDressingRoom === "boolean"'
    );
    expect(normalizedSource).toContain("source.showDate !== false");
    expect(normalizedSource).toContain("source.showTime !== false");
    expect(normalizedSource).toContain("source.showSportpark !== false");
    expect(normalizedSource).toContain("legacyShowLogo");
    expect(normalizedSource).toContain("legacyShowDressingRoom");

    const semanticVariables = [
      "--vc-accent", "--vc-accent-soft", "--vc-border", "--vc-border-soft",
      "--vc-canvas", "--vc-danger", "--vc-divider", "--vc-image-overlay-end",
      "--vc-image-overlay-mid", "--vc-image-overlay-start", "--vc-neutral",
      "--vc-panel", "--vc-qr-ink", "--vc-qr-surface", "--vc-row",
      "--vc-row-selected", "--vc-shadow", "--vc-success", "--vc-surface",
      "--vc-surface-raised", "--vc-text", "--vc-text-faint", "--vc-text-muted",
      "--vc-text-on-accent", "--vc-text-on-selected", "--vc-warning"
    ];
    for (const variable of semanticVariables) {
      expect(html).toContain(`["${variable}",`);
    }
    expect(html).toContain('"--vc-club-logo-background"');
    expect(html).toContain('"--vc-home-logo-background"');

    const matchCssStart = html.indexOf(
      ".legacy-fixture-list,.legacy-result-list"
    );
    const matchCssEnd = html.indexOf(
      ".legacy-team-mini{display:inline-grid",
      matchCssStart
    );
    const matchCss = html.slice(matchCssStart, matchCssEnd);
    expect(matchCss).toContain("var(--vc-row)");
    expect(matchCss).toContain("var(--vc-text)");
    expect(matchCss).toContain("var(--vc-text-muted)");
    expect(matchCss).toContain("var(--vc-accent)");
    expect(matchCss).toContain("var(--vc-home-logo-background)");
    expect(matchCss).toContain("var(--vc-panel)");
    expect(matchCss).not.toContain("var(--editorial-");
  });
});
