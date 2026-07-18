import "server-only";

import { timingSafeEqual } from "node:crypto";

export {
  createDeviceLabSession,
  isValidDeviceLabSession
} from "./device-lab-session";

export const deviceLabCookieName = "castivo_device_lab_session";

export function isValidDeviceLabAccessToken(candidate: string | null) {
  const expected = process.env.DEVICE_LAB_ACCESS_TOKEN?.trim();
  if (!candidate || !expected || expected.length < 24) return false;
  return safeEqual(candidate, expected);
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
