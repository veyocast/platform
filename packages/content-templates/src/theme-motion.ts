import type { ThemeMotionState } from "@veyocast/contracts";

export type ThemeMotionEvent =
  | { type: "ACTIVATE" }
  | { type: "ENTER_COMPLETE" }
  | { type: "EXIT_COMPLETE" }
  | { type: "REQUEST_EXIT" };

export type ThemeMotionFrame = {
  activeDwellStarted: boolean;
  state: ThemeMotionState;
};

export const initialThemeMotionFrame: ThemeMotionFrame = {
  activeDwellStarted: false,
  state: "IDLE"
};

export function reduceThemeMotion(
  frame: ThemeMotionFrame,
  event: ThemeMotionEvent
): ThemeMotionFrame {
  if (frame.state === "IDLE" && event.type === "ACTIVATE") {
    return { activeDwellStarted: false, state: "ENTERING" };
  }
  if (frame.state === "ENTERING" && event.type === "ENTER_COMPLETE") {
    return { activeDwellStarted: true, state: "ACTIVE" };
  }
  if (frame.state === "ACTIVE" && event.type === "REQUEST_EXIT") {
    return { activeDwellStarted: true, state: "EXITING" };
  }
  if (frame.state === "EXITING" && event.type === "EXIT_COMPLETE") {
    return initialThemeMotionFrame;
  }
  return frame;
}

export function themePosterFrameAt(elapsedMs: number) {
  return elapsedMs >= 900;
}
