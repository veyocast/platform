export type GoalVideoTelemetry = {
  code: string; eventId: string; deliveryId: string; alertVersionId: string | null;
  assetId: string | null; orientation: "portrait" | "landscape"; mimeType: string | null;
  at: string; width: number; height: number;
  source?: "cache_blob" | "https";
  mediaErrorCode?: number | null;
};

/** Bounded diagnostic history rides the existing device-authenticated heartbeat.
 * No signed URLs, member names, scores, tokens or user agent strings are stored.
 */
export function goalVideoTelemetry(entry?: GoalVideoTelemetry): GoalVideoTelemetry[] {
  const key = "veyocast-player-goal-video-diagnostics-v1";
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    const entries: GoalVideoTelemetry[] = Array.isArray(parsed) ? parsed.filter(function (value: GoalVideoTelemetry) { return value && Date.parse(value.at) > Date.now() - 10 * 60_000; }).slice(-11) : [];
    if (entry) {
      entries.push(entry);
      window.localStorage.setItem(key, JSON.stringify(entries));
      console.info(JSON.stringify(Object.assign({ event: "goal_video" }, entry)));
    }
    return entries;
  } catch { return entry ? [entry] : []; }
}

/** Capability evidence, not user-agent based playback decisions. */
export function goalVideoCapabilities(runtime: "react" | "static-lg", appVersion?: string) {
  const probe = document.createElement("video");
  const browser = navigator.userAgent.match(/(?:Chrome|Chromium)\/([0-9.]{1,24})/);
  return { runtime, appVersion: appVersion || "development", browserVersion: browser ? browser[1] : null,
    webOS: /web[0o]s/i.test(navigator.userAgent), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    h264: probe.canPlayType('video/mp4; codecs="avc1.4D4028"'),
    webm: probe.canPlayType('video/webm; codecs="vp9"'),
    reducedMotion: Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) };
}
