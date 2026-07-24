import type { StudioAnimationPreset } from "./constants";
import type { StudioElement } from "./schema";

export type StudioFrameTransform = Readonly<{
  clipProgress: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  textProgress: number;
  x: number;
  y: number;
}>;

type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export function applyStudioEasing(progress: number, easing: Easing): number {
  const value = clamp(progress, 0, 1);
  switch (easing) {
    case "ease-in":
      return value * value;
    case "ease-out":
      return 1 - (1 - value) * (1 - value);
    case "ease-in-out":
      return value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;
    case "linear":
      return value;
  }
}

export function interpolateStudioElement(
  element: StudioElement,
  timeMs: number,
  documentDurationMs: number
): StudioFrameTransform {
  const base: StudioFrameTransform = {
    clipProgress: 1,
    opacity: element.visible ? element.opacity : 0,
    scaleX: 1,
    scaleY: 1,
    textProgress: 1,
    x: element.x,
    y: element.y
  };
  const timing = element.timing;
  if (!timing) return base;
  if (timeMs < timing.startMs || timeMs > timing.endMs) {
    return { ...base, opacity: 0 };
  }

  let result = base;
  if (timing.entry) {
    const localTime = timeMs - timing.startMs - timing.entry.delayMs;
    const progress = applyStudioEasing(
      localTime / Math.max(1, timing.entry.durationMs),
      timing.entry.easing
    );
    result = applyPreset(
      result,
      timing.entry.preset,
      progress,
      timing.entry.distance,
      timing.entry.intensity,
      "entry"
    );
  }
  if (timing.exit) {
    const exitStart = timing.endMs - timing.exit.durationMs - timing.exit.delayMs;
    const progress = applyStudioEasing(
      (timeMs - exitStart) / Math.max(1, timing.exit.durationMs),
      timing.exit.easing
    );
    result = applyPreset(
      result,
      timing.exit.preset,
      progress,
      timing.exit.distance,
      timing.exit.intensity,
      "exit"
    );
  }
  if (timing.continuous) {
    const localDuration = Math.max(1, timing.endMs - timing.startMs);
    const progress = clamp((timeMs - timing.startMs) / localDuration, 0, 1);
    result = applyContinuousPreset(
      result,
      timing.continuous.preset,
      progress,
      timing.continuous.distance,
      timing.continuous.intensity,
      documentDurationMs
    );
  }
  return result;
}

function applyPreset(
  value: StudioFrameTransform,
  preset: StudioAnimationPreset,
  progress: number,
  distance: number,
  intensity: number,
  phase: "entry" | "exit"
): StudioFrameTransform {
  const directionProgress = phase === "entry" ? progress : 1 - progress;
  const fade = phase === "entry" ? progress : 1 - progress;
  switch (preset) {
    case "fade":
      return { ...value, opacity: value.opacity * fade };
    case "slide-left":
      return { ...value, x: value.x + distance * (1 - directionProgress), opacity: value.opacity * fade };
    case "slide-right":
      return { ...value, x: value.x - distance * (1 - directionProgress), opacity: value.opacity * fade };
    case "slide-up":
      return { ...value, y: value.y + distance * (1 - directionProgress), opacity: value.opacity * fade };
    case "slide-down":
      return { ...value, y: value.y - distance * (1 - directionProgress), opacity: value.opacity * fade };
    case "zoom":
      return {
        ...value,
        opacity: value.opacity * fade,
        scaleX: 0.82 + 0.18 * directionProgress,
        scaleY: 0.82 + 0.18 * directionProgress
      };
    case "pop": {
      const overshoot = 1 + Math.sin(directionProgress * Math.PI) * intensity;
      return {
        ...value,
        opacity: value.opacity * fade,
        scaleX: (0.72 + 0.28 * directionProgress) * overshoot,
        scaleY: (0.72 + 0.28 * directionProgress) * overshoot
      };
    }
    case "bounce": {
      const bounce = Math.sin(directionProgress * Math.PI * 3) *
        (1 - directionProgress) * distance * intensity;
      return {
        ...value,
        opacity: value.opacity * fade,
        y: value.y - bounce
      };
    }
    case "wipe":
      return { ...value, clipProgress: directionProgress, opacity: value.opacity * fade };
    case "typewriter":
      return { ...value, textProgress: directionProgress, opacity: value.opacity };
    case "none":
    case "drift":
    case "slow-zoom":
      return value;
  }
}

function applyContinuousPreset(
  value: StudioFrameTransform,
  preset: StudioAnimationPreset,
  progress: number,
  distance: number,
  intensity: number,
  documentDurationMs: number
): StudioFrameTransform {
  const stableProgress = documentDurationMs > 0 ? progress : 0;
  switch (preset) {
    case "drift":
      return {
        ...value,
        x: value.x + Math.sin(stableProgress * Math.PI * 2) * distance * intensity,
        y: value.y + Math.cos(stableProgress * Math.PI * 2) * distance * intensity * 0.5
      };
    case "slow-zoom": {
      const scale = 1 + stableProgress * intensity;
      return { ...value, scaleX: scale, scaleY: scale };
    }
    default:
      return value;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
