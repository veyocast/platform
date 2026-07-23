import "server-only";

import {
  createPlayerDemoSession,
  isStagingPlayerDemoEnabled,
  isValidPlayerDemoSession,
  matchesPlayerDemoCode
} from "./player-demo-session";

export const playerDemoCookieName = "veyocast_player_demo_session";

export function canUsePlayerDemo() {
  return isStagingPlayerDemoEnabled();
}

export function isValidPlayerDemoCode(candidate: unknown) {
  return canUsePlayerDemo() && matchesPlayerDemoCode(candidate);
}

export function issuePlayerDemoSession() {
  if (!canUsePlayerDemo()) return null;
  return createPlayerDemoSession({ secret: readSessionSecret() });
}

export function acceptsPlayerDemoSession(value: string | null | undefined) {
  return (
    canUsePlayerDemo() &&
    isValidPlayerDemoSession({
      secret: readSessionSecret(),
      value
    })
  );
}

function readSessionSecret() {
  return process.env.DEVICE_LAB_SESSION_SECRET;
}

