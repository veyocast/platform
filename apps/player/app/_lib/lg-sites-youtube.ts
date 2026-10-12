/** Online YouTube metadata is frozen in the release; failures use the verified local item. */
export function lgSitesYouTubeScript() {
  return `
    var legacyYouTubeApiPromise = null;
    function lgYouTubeBinding(item) {
      var binding = item && item.onlinePlayback;
      if (!binding || binding.kind !== "youtube" || binding.privacyEnhanced !== true || !/^[A-Za-z0-9_-]{11}$/.test(binding.videoId || "")) return null;
      if (binding.playlistVideoIds && (!Array.isArray(binding.playlistVideoIds) || !binding.playlistVideoIds.length || binding.playlistVideoIds.length > 200 ||
        binding.playlistVideoIds[0] !== binding.videoId || typeof binding.playlistRepeat !== "boolean" ||
        !binding.playlistVideoIds.every(function (id) { return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id); }))) return null;
      return binding;
    }
    function lgYouTubeNextIndex(videos, current, unavailable, repeat, boundaryRequested) {
      if (boundaryRequested) return null;
      for (var offset = 1; offset <= videos.length; offset += 1) {
        var candidate = current + offset;
        if (candidate >= videos.length && !repeat) return null;
        var index = candidate % videos.length;
        if (videos[index] && !unavailable[videos[index]]) return index;
      }
      return null;
    }
    function lgYouTubeApi() {
      if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
      if (legacyYouTubeApiPromise) return legacyYouTubeApiPromise;
      legacyYouTubeApiPromise = new Promise(function (resolve, reject) {
        var previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (typeof previous === "function") previous();
          if (window.YT && window.YT.Player) resolve(window.YT);
          else reject(new Error("LEGACY_YOUTUBE_API_UNAVAILABLE"));
        };
        var existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
        if (!existing) {
          var script = document.createElement("script");
          script.src = "https://www.youtube.com/iframe_api";
          script["async"] = true;
          script.onerror = function () { reject(new Error("LEGACY_YOUTUBE_API_UNAVAILABLE")); };
          document.head.appendChild(script);
        }
      }).catch(function (error) { legacyYouTubeApiPromise = null; throw error; });
      return legacyYouTubeApiPromise;
    }
    function playLegacyYouTube(item, fallbackUrl, objectUrls, generation) {
      var binding = lgYouTubeBinding(item);
      if (!binding || runtime.offline || window.navigator.onLine === false) return false;
      var root = document.createElement("div");
      root.className = "lg-youtube-media";
      var host = document.createElement("div");
      host.style.width = host.style.height = "100%";
      root.appendChild(host);
      var disposed = false;
      var failed = false;
      var committed = false;
      var player = null;
      var playing = false;
      var elapsed = 0;
      var last = monotonicNow();
      var boundaryRequested = false;
      var videos = binding.playlistVideoIds || [binding.videoId];
      var current = 0;
      var unavailable = {};
      var loadTimer = null;
      var startTimer = null;
      var timer = null;
      function valid() { return !disposed && generation === runtime.playbackGeneration && (runtime.pendingElement === root || runtime.currentElement === root); }
      function fallback() {
        if (!valid() || failed) return;
        failed = true;
        clearPlaybackTimers();
        window.clearTimeout(loadTimer);
        window.clearTimeout(startTimer);
        window.clearInterval(timer);
        if (player) { try { player.destroy(); } catch (error) {} player = null; }
        if (runtime.pendingElement === root) cancelPendingMedia();
        var freshUrls = [];
        sourceForItem(item, function (url, objectUrl) {
          if (objectUrl) freshUrls.push(objectUrl);
          if (generation !== runtime.playbackGeneration) { revokeObjectUrls(freshUrls); return; }
          if (!url) { failItem("LEGACY_YOUTUBE_FALLBACK_MISSING"); return; }
          playLegacyVerifiedFallback(item, url, freshUrls, generation);
        });
      }
      function next(failure) {
        if (!valid()) return;
        if (failure) unavailable[videos[current]] = true;
        if (runtime.pendingRelease || legacyIsCompositionZone && legacyZoneCallbacks && legacyZoneCallbacks.wantsBoundary && legacyZoneCallbacks.wantsBoundary()) boundaryRequested = true;
        var index = lgYouTubeNextIndex(videos, current, unavailable, binding.playlistRepeat === true, boundaryRequested);
        if (index === null) {
          var allUnavailable = videos.every(function (id) { return unavailable[id]; });
          if (failure && allUnavailable) fallback();
          else nextItem();
          return;
        }
        current = index;
        playing = false;
        last = monotonicNow();
        window.clearTimeout(loadTimer);
        loadTimer = window.setTimeout(function () { next(true); }, 10000);
        try { player.loadVideoById(videos[current]); if (runtime.goalPauseApplied) player.pauseVideo(); } catch (error) { next(true); }
      }
      root.lgPause = function (paused) { if (!player) return; try { if (paused) player.pauseVideo(); else player.playVideo(); } catch (error) {} };
      root.lgCleanup = function () {
        if (disposed) return;
        disposed = true;
        window.clearTimeout(loadTimer);
        window.clearTimeout(startTimer);
        window.clearInterval(timer);
        window.removeEventListener("offline", fallback);
        if (player) { try { player.destroy(); } catch (error) {} player = null; }
      };
      beginPendingMedia(root, objectUrls);
      startTimer = window.setTimeout(fallback, 10000);
      window.addEventListener("offline", fallback);
      timer = window.setInterval(function () {
        var nowValue = monotonicNow();
        if (playing && !runtime.goalPauseApplied) elapsed += Math.max(0, nowValue - last);
        last = nowValue;
        if (binding.playlistVideoIds && elapsed >= itemDurationMs(item)) boundaryRequested = true;
      }, 100);
      lgYouTubeApi().then(function (YT) {
        if (!valid()) return;
        try {
          player = new YT.Player(host, {
            width: "100%", height: "100%", host: "https://www.youtube-nocookie.com", videoId: binding.videoId,
            playerVars: { autoplay: 1, controls: 0, disablekb: 1, enablejsapi: 1, fs: 0, iv_load_policy: 3,
              modestbranding: 1, origin: window.location.origin, playsinline: 1, rel: 0 },
            events: {
              onReady: function (event) { if (!valid()) return; event.target.mute(); if (runtime.goalPauseApplied) event.target.pauseVideo(); else event.target.playVideo(); },
              onError: function () { if (binding.playlistVideoIds) next(true); else fallback(); },
              onStateChange: function (event) {
                if (!valid()) return;
                playing = event.data === YT.PlayerState.PLAYING;
                last = monotonicNow();
                if (playing) {
                  window.clearTimeout(startTimer);
                  window.clearTimeout(loadTimer);
                  if (!committed) { committed = commitPendingMedia(root, objectUrls, generation); }
                } else if (event.data === YT.PlayerState.ENDED) {
                  if (binding.playlistVideoIds) next(false); else nextItem();
                }
              }
            }
          });
        } catch (error) { fallback(); }
      }, fallback);
      return true;
    }
  `;
}
