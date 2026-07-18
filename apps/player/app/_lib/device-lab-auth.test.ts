import { afterEach, describe, expect, it } from "vitest";

import {
  createDeviceLabSession,
  isValidDeviceLabSession
} from "./device-lab-session";

const originalSecret = process.env.DEVICE_LAB_SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.DEVICE_LAB_SESSION_SECRET;
  } else {
    process.env.DEVICE_LAB_SESSION_SECRET = originalSecret;
  }
});

describe("Device Lab-sessies", () => {
  it("blijft fail-closed zonder een sterk sessiegeheim", () => {
    delete process.env.DEVICE_LAB_SESSION_SECRET;
    expect(createDeviceLabSession()).toBeNull();
    expect(isValidDeviceLabSession("2000000000.nonce.configuration-missing", 0)).toBe(false);

    process.env.DEVICE_LAB_SESSION_SECRET = "te-kort";
    expect(createDeviceLabSession()).toBeNull();
  });

  it("maakt met een sterk geheim een tijdelijke valide sessie", () => {
    process.env.DEVICE_LAB_SESSION_SECRET = "castivo-device-lab-session-secret-for-tests-2026";
    const now = 1_700_000_000_000;
    const session = createDeviceLabSession(now);

    expect(session).not.toBeNull();
    expect(isValidDeviceLabSession(session?.value, now)).toBe(true);
    expect(isValidDeviceLabSession(session?.value, now + session!.maxAge * 1_000)).toBe(false);
  });
});
