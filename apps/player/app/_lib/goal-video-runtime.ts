export type GoalVideoCode = "GOAL_VIDEO_STARTED" | "GOAL_VIDEO_COMPLETED" |
  "GOAL_VIDEO_LOAD_ERROR" | "GOAL_VIDEO_PLAY_REJECTED" |
  "GOAL_VIDEO_START_TIMEOUT" | "GOAL_VIDEO_PLAYBACK_ERROR";

/** One decoder, one watchdog, one terminal callback; shared with Static LG.
 * A timeout is failure recovery only. Successful completion requires ended.
 */
export function playGoalIntroVideo(video: HTMLVideoElement, url: string, handlers: {
  onPlaying: () => void;
  onComplete: () => void;
  onFailure: (code: GoalVideoCode) => void;
  fallbackUrl?: string;
  onFallback?: (code: GoalVideoCode, mediaErrorCode: number | null) => void;
  startTimeoutMs?: number;
  stallTimeoutMs?: number;
}) {
  let disposed = false;
  let finished = false;
  let started = false;
  let position = 0;
  let progressedAt = Date.now();
  let preparingAt = progressedAt;
  let sourceGeneration = 0;
  let fallbackAttempted = false;
  function fail(code: GoalVideoCode) {
    if (disposed || finished) return;
    // Some native signage decoders reject Blob URLs despite supporting the
    // verified MP4. Reuse the published HTTPS/Range source, as normal LG video
    // playback does. Never restart a video that has already begun playing.
    if (!started && !fallbackAttempted && url.indexOf("blob:") === 0 &&
      handlers.fallbackUrl && handlers.fallbackUrl.indexOf("https://") === 0 &&
      (code === "GOAL_VIDEO_LOAD_ERROR" || code === "GOAL_VIDEO_PLAY_REJECTED" || code === "GOAL_VIDEO_START_TIMEOUT")) {
      fallbackAttempted = true;
      if (handlers.onFallback) handlers.onFallback(code, video.error ? video.error.code : null);
      preparingAt = Date.now();
      setSource(handlers.fallbackUrl);
      return;
    }
    finished = true;
    window.clearInterval(watchdog);
    handlers.onFailure(code);
  }
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.controls = false;
  video.preload = "auto";
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  const playing = function () {
    if (disposed || finished || started) return;
    started = true;
    progressedAt = Date.now();
    handlers.onPlaying();
  };
  const ended = function () {
    if (disposed || finished) return;
    finished = true;
    window.clearInterval(watchdog);
    handlers.onComplete();
  };
  const error = function () { fail(started ? "GOAL_VIDEO_PLAYBACK_ERROR" : "GOAL_VIDEO_LOAD_ERROR"); };
  video.addEventListener("playing", playing);
  video.addEventListener("ended", ended);
  video.addEventListener("error", error);
  const watchdog = window.setInterval(function () {
    if (disposed || finished) return;
    if (!started && Date.now() - preparingAt >= (handlers.startTimeoutMs || 8000)) {
      fail("GOAL_VIDEO_START_TIMEOUT");
    } else if (started && video.currentTime > position) {
      position = video.currentTime;
      progressedAt = Date.now();
    } else if (started && Date.now() - progressedAt >= (handlers.stallTimeoutMs || 8000)) {
      fail("GOAL_VIDEO_PLAYBACK_ERROR");
    }
  }, 250);
  function setSource(source: string) {
    const generation = ++sourceGeneration;
    try { video.src = source; video.load(); } catch { fail("GOAL_VIDEO_LOAD_ERROR"); return; }
    try {
      // A rejection from the replaced Blob decoder must not abort HTTPS recovery.
      const promise = finished ? undefined : video.play();
      if (promise && typeof promise.catch === "function") promise.catch(function () {
        if (generation === sourceGeneration) fail("GOAL_VIDEO_PLAY_REJECTED");
      });
    } catch { if (generation === sourceGeneration) fail("GOAL_VIDEO_PLAY_REJECTED"); }
  }
  setSource(url);
  return function () {
    if (disposed) return;
    disposed = true;
    window.clearInterval(watchdog);
    video.removeEventListener("playing", playing);
    video.removeEventListener("ended", ended);
    video.removeEventListener("error", error);
    try { video.pause(); } catch { /* detached decoder */ }
    video.removeAttribute("src");
    try { video.load(); } catch { /* release native decoder resources */ }
  };
}
