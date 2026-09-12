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
  startTimeoutMs?: number;
  stallTimeoutMs?: number;
}) {
  let disposed = false;
  let finished = false;
  let started = false;
  let position = 0;
  let progressedAt = Date.now();
  const preparingAt = progressedAt;
  function fail(code: GoalVideoCode) {
    if (disposed || finished) return;
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
  try { video.src = url; } catch { fail("GOAL_VIDEO_LOAD_ERROR"); }
  try {
    // Older HTMLMediaElement implementations return void from play().
    const promise = finished ? undefined : video.play();
    if (promise && typeof promise.catch === "function") promise.catch(function () { fail("GOAL_VIDEO_PLAY_REJECTED"); });
  } catch { fail("GOAL_VIDEO_PLAY_REJECTED"); }
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
