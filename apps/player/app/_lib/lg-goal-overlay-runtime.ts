import { royalCurrentDefaultStyle } from "../../../../packages/content-templates/src/royal-current-theme";
import { goalOverlayCss, renderGoalOverlayDom } from "../../../../packages/content-templates/src/goal-overlay-renderer";

// Trusted bundled code only. This function is the same renderer used by React.
export const legacyGoalOverlayCss = `${goalOverlayCss}
#goal-overlay[data-renderer=goal-v2]{--go-fallback-primary:${royalCurrentDefaultStyle.primary};padding:0;background:var(--go-v2-background);color:inherit;display:block}
#goal-overlay[data-renderer=goal-v2][hidden]{display:none}
@keyframes vc-goal-enter{from{opacity:0;transform:translateY(1.5%)}to{opacity:1;transform:translateY(0)}}
@keyframes vc-goal-fade{from{opacity:0}to{opacity:1}}
`;
export function legacyGoalOverlayScript() {
  return `var renderGoalOverlayV2Dom = ${renderGoalOverlayDom.toString()};\n` + String.raw`
    var goalV2CacheName = "veyocast-player-goal-assets-v2";
    var goalV2Preparing = {};
    var goalV2RequiredVideos = {};
    var goalV2Verified = {};
    var goalV2PreloadChain = Promise.resolve();
    function goalV2Log(event, goal, detail) {
      log(event, JSON.stringify({ eventId: goal.eventId, deliveryId: goal.deliveryId, detail: detail || null }));
    }
    function goalV2Checksum(bytes, expected) {
      return new Promise(function (resolve) { sha256Hex(bytes, function (error, checksum) { resolve(!error && checksum === expected); }); });
    }
    function goalV2Fetch(asset) {
      return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open("GET", asset.url, true);
        request.responseType = "arraybuffer";
        request.timeout = 60000;
        request.onprogress = function (event) { if (event.loaded > 128 * 1024 * 1024 || event.total > 128 * 1024 * 1024) { request.abort(); reject(new Error("goal_asset_too_large")); } };
        request.onerror = request.ontimeout = request.onabort = function () { reject(new Error("goal_asset_unavailable")); };
        request.onload = function () {
          if (request.status >= 200 && request.status < 300 && request.response && request.response.byteLength <= 128 * 1024 * 1024) resolve(request.response);
          else reject(new Error("goal_asset_unavailable"));
        };
        request.send();
      });
    }
    function goalV2MakeRoom(cache, size) {
      return cache.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return cache.match(key).then(function (response) { return { key: key, bytes: Number(response && response.headers.get("Content-Length")) || 0 }; }); }));
      }).then(function (items) {
        var total = items.reduce(function (sum, item) { return sum + item.bytes; }, size);
        var removals = [];
        items.forEach(function (item) { if (total > 256 * 1024 * 1024 && !goalV2RequiredVideos[new URL(item.key.url).pathname]) { total -= item.bytes; removals.push(cache.delete(item.key)); } });
        if (total > 256 * 1024 * 1024) throw new Error("goal_cache_full");
        return Promise.all(removals);
      });
    }
    function goalV2Prepare(asset) {
      if (!window.caches) return Promise.resolve(false);
      if (goalV2Preparing[asset.checksum]) return goalV2Preparing[asset.checksum];
      var path = "/__veyocast-goal-cache/" + asset.checksum;
      var task = caches.open(goalV2CacheName).then(function (cache) {
        return cache.match(path).then(function (response) {
          return response ? response.arrayBuffer().then(function (bytes) { return goalV2Checksum(bytes, asset.checksum); }) : false;
        }).then(function (valid) {
          if (valid) { goalV2Verified[asset.checksum] = true; return true; }
          return cache.delete(path).then(function () { return goalV2Fetch(asset); }).then(function (bytes) {
            return goalV2Checksum(bytes, asset.checksum).then(function (verified) {
              if (!verified) throw new Error("goal_asset_checksum_failed");
              return goalV2MakeRoom(cache, bytes.byteLength).then(function () {
                return cache.put(path, new Response(bytes, { headers: { "Content-Type": asset.mimeType, "Content-Length": String(bytes.byteLength) } }));
              }).then(function () { goalV2Verified[asset.checksum] = true; return true; });
            });
          });
        });
      }).catch(function () { return false; });
      goalV2Preparing[asset.checksum] = task;
      return task.then(function (value) { delete goalV2Preparing[asset.checksum]; return value; });
    }
    function goalV2LocalUrl(asset) {
      if (!asset || !window.caches) return Promise.resolve(null);
      return caches.open(goalV2CacheName).then(function (cache) {
        return cache.match("/__veyocast-goal-cache/" + asset.checksum).then(function (response) {
          if (!response) { goalV2Prepare(asset); return null; }
          return response.arrayBuffer().then(function (bytes) {
            return (goalV2Verified[asset.checksum] ? Promise.resolve(true) : goalV2Checksum(bytes, asset.checksum)).then(function (valid) {
              if (!valid) { cache.delete("/__veyocast-goal-cache/" + asset.checksum); goalV2Prepare(asset); return null; }
              goalV2Verified[asset.checksum] = true;
              return URL.createObjectURL(new Blob([bytes], { type: asset.mimeType }));
            });
          });
        });
      }).catch(function () { return null; });
    }
    function goalV2Preload(config) {
      var assets = (Array.isArray(config.assets) ? config.assets : []).concat(Array.isArray(config.teamAssets) ? config.teamAssets : []).slice(0, 1000);
      var ready = true;
      assets.forEach(function (value) {
        var asset = parseGoalAsset(value);
        if (asset) goalV2PreloadChain = goalV2PreloadChain.then(function () { return goalV2Prepare(asset); }).then(function (valid) {
          if (!valid) { ready = false; log("goal_asset_prefetch_failed", JSON.stringify({ mediaAssetId: asset.mediaAssetId })); }
        });
      });
      return goalV2PreloadChain.then(function () { return ready; });
    }
    function goalV2Appearance(config) {
      if (config.themeMode === "light" || config.themeMode === "dark") return config.themeMode;
      var policy = config.defaults && config.defaults.modePolicy;
      if (!policy) return "light";
      if (policy.kind === "fixed") return policy.mode;
      if (policy.kind === "auto") return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      try {
        var parts = new Intl.DateTimeFormat("en-US", { timeZone: policy.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
        var local = {};
        parts.forEach(function (part) { local[part.type] = part.value; });
        var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(local.weekday);
        var minutes = (Number(local.hour) % 24) * 60 + Number(local.minute);
        var found = policy.entries.find(function (entry) {
          var start = Number(entry.start.slice(0, 2)) * 60 + Number(entry.start.slice(3));
          var end = Number(entry.end.slice(0, 2)) * 60 + Number(entry.end.slice(3));
          return entry.days.indexOf(day) !== -1 && ((start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end));
        });
        return found ? found.mode : policy.fallback;
      } catch (error) { return policy.fallback || "light"; }
    }
    function renderGoalV2(goal) {
      clearGoalElement();
      var overlay = byId("goal-overlay");
      var config = goal.configuration;
      var orientation = window.innerHeight > window.innerWidth ? "portrait" : "landscape";
      var appearance = goalV2Appearance(config);
      var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var transition = reduced ? 0 : config.transitionDurationMs;
      var introId = config.introEnabled ? (orientation === "portrait" ? config.introPortraitMediaId || config.introLandscapeMediaId : config.introLandscapeMediaId || config.introPortraitMediaId) : null;
      var rendererRoot = document.createElement("div");
      var introVideo = null;
      var timer = null;
      var watchdog = null;
      var urls = [];
      var disposed = false;
      var phase = "IDLE";
      var rendererCleanup = null;
      runtime.goalActiveEventId = goal.eventId;
      runtime.goalActiveKind = "goal";
      runtime.goalActiveModel = goal;
      overlay.hidden = false;
      overlay.setAttribute("data-renderer", "goal-v2");
      overlay.style.setProperty("--go-v2-background", (appearance === "dark" ? config.darkOuterColor : config.lightOuterColor) || (config.defaults && config.defaults.primary) || "var(--go-fallback-primary)");
      rendererRoot.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      rendererRoot.style.visibility = "hidden";
      overlay.appendChild(rendererRoot);
      function state(next) { phase = next; overlay.setAttribute("data-goal-phase", phase); }
      function redraw() {
        if (disposed) return;
        if (rendererCleanup) rendererCleanup();
        var player = goal.player || {};
        rendererCleanup = renderGoalOverlayV2Dom(rendererRoot, config, {
          eventId: goal.eventId, homeTeam: goal.homeTeam, awayTeam: goal.awayTeam, homeScore: goal.homeScore, awayScore: goal.awayScore,
          scoreboardSide: goal.homeScore > goal.previousHomeScore ? "home" : "away", scorer: player.name || goal.scorerName,
          playerPhoto: player.photoUrl || null, shirtNumber: player.number || null, minute: goal.matchClock,
          homeLogo: goal.assets[goal.homeLogo] ? goal.assets[goal.homeLogo].url : null, awayLogo: goal.assets[goal.awayLogo] ? goal.assets[goal.awayLogo].url : null,
          competition: goal.competition, matchName: goal.matchName, round: goal.round, venue: goal.venue,
          test: goal.eventKind === "synthetic_test"
        }, orientation, appearance);
      }
      function show() {
        if (disposed || phase.indexOf("GOAL_OVERLAY") === 0 || phase === "RESUMING_PLAYLIST") return;
        window.clearTimeout(timer); window.clearInterval(watchdog);
        state("GOAL_OVERLAY_ENTERING");
        redraw();
        rendererRoot.style.visibility = "visible";
        if (config.enterAnimation !== "none" && transition) rendererRoot.style.animation = (config.enterAnimation === "rise" ? "vc-goal-enter" : "vc-goal-fade") + " " + transition + "ms both";
        if (introVideo) { try { introVideo.pause(); } catch (error) {} introVideo.removeAttribute("src"); if (introVideo.parentNode) introVideo.parentNode.removeChild(introVideo); }
        goalV2Log("goal_overlay_started", goal);
        timer = window.setTimeout(function () {
          state("GOAL_OVERLAY_VISIBLE"); rendererRoot.style.animation = "none";
          timer = window.setTimeout(function () {
            state("GOAL_OVERLAY_EXITING");
            rendererRoot.style.transition = "opacity " + transition + "ms ease";
            if (config.exitAnimation === "fade") rendererRoot.style.opacity = "0";
            timer = window.setTimeout(function () { state("RESUMING_PLAYLIST"); goalV2Log("goal_overlay_finished", goal); hideGoalOverlay(true); }, config.exitAnimation === "none" ? 0 : transition);
          }, config.overlayDurationMs);
        }, config.enterAnimation === "none" ? 0 : transition);
      }
      function fail(reason) { if (disposed || (phase !== "GOAL_INTRO_LOADING" && phase !== "GOAL_INTRO_PLAYING")) return; goalV2Log("goal_event_failed", goal, reason); show(); }
      runtime.goalV2Redraw = redraw;
      runtime.goalV2Cleanup = function () {
        disposed = true; window.clearTimeout(timer); window.clearInterval(watchdog);
        if (rendererCleanup) rendererCleanup();
        urls.forEach(function (url) { URL.revokeObjectURL(url); });
        runtime.goalV2Redraw = null;
      };
      redraw();
      if (!introId) show();
      else { state("GOAL_INTRO_LOADING"); timer = window.setTimeout(function () { fail("intro_cache_unavailable"); }, 2000); }
      Promise.all(Object.keys(goal.assets).map(function (id) {
        return goalV2LocalUrl(goal.assets[id]).then(function (url) {
          if (url) { if (disposed) URL.revokeObjectURL(url); else { urls.push(url); goal.assets[id] = Object.assign({}, goal.assets[id], { url: url }); } }
          return { id: id, url: url };
        });
      })).then(function (local) {
        if (disposed) return;
        redraw();
        if (!introId || phase !== "GOAL_INTRO_LOADING") return;
        window.clearTimeout(timer);
        var intro = local.find(function (asset) { return asset.id === introId && asset.url; });
        if (!intro) { fail("intro_not_cached"); return; }
        introVideo = document.createElement("video");
        introVideo.muted = true; introVideo.playsInline = true; introVideo.controls = false; introVideo.preload = "auto";
        introVideo.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;visibility:hidden";
        introVideo.onplaying = function () { if (disposed || phase !== "GOAL_INTRO_LOADING") return; state("GOAL_INTRO_PLAYING"); introVideo.style.visibility = "visible"; goalV2Log("goal_intro_started", goal); };
        introVideo.onended = function () { if (disposed || phase !== "GOAL_INTRO_PLAYING") return; goalV2Log("goal_intro_finished", goal); show(); };
        introVideo.onerror = function () { fail("intro_load_error"); };
        overlay.appendChild(introVideo); introVideo.src = intro.url;
        var progressedAt = now(); var position = 0;
        watchdog = window.setInterval(function () { if (introVideo.currentTime > position) { position = introVideo.currentTime; progressedAt = now(); } else if (now() - progressedAt > 8000) fail("intro_stalled"); }, 1000);
        try { var playing = introVideo.play(); if (playing && playing.catch) playing.catch(function () { fail("intro_playback_failed"); }); } catch (error) { fail("intro_playback_failed"); }
      }).catch(function () { fail("intro_cache_unavailable"); });
      return true;
    }
`;
}
