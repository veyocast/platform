import { describe, expect, it } from "vitest";
import { initialPlayerPreparationStage, playerProblemStage, validDisplayedPairingCode } from "./player-status-presentation";

describe("real initial Player status facts", () => {
  it("does not invent download progress before a cache callback", () => {
    expect(initialPlayerPreparationStage(null)).toBe("boot");
    expect(initialPlayerPreparationStage("DOWNLOADING")).toBe("download");
    expect(initialPlayerPreparationStage("VERIFYING")).toBe("verify");
  });
  it("distinguishes missing offline content from a disabled or failed device", () => {
    expect(playerProblemStage("PLAYER_OFFLINE", false)).toBe("offline-empty");
    expect(playerProblemStage("PAIRING_CODE_EXPIRED", false)).toBe("pairing-expired");
    expect(playerProblemStage("INVALID_DEVICE_TOKEN", false)).toBe("error");
    expect(playerProblemStage("PLAYER_OFFLINE", true)).toBe("disabled");
  });
});

describe("pairing code presentation", () => {
  const expiry = "2026-10-18T18:00:00.123456+00:00";
  it("uses only the exact supplied valid code, including PostgreSQL expiry precision", () => {
    expect(validDisplayedPairingCode("QAX 234", expiry)).toBe("QAX 234");
    expect(validDisplayedPairingCode("QAX234", expiry)).toBe("QAX234");
    expect(validDisplayedPairingCode(undefined, expiry)).toBeNull();
    expect(validDisplayedPairingCode("not-a-code", expiry)).toBeNull();
  });
  it("does not add a second expiry clock and still rejects invalid timestamps", () => {
    expect(validDisplayedPairingCode("QAX 234", "2020-01-01T00:00:00Z")).toBe("QAX 234");
    expect(validDisplayedPairingCode("QAX 234", "invalid")).toBeNull();
    expect(validDisplayedPairingCode(undefined, undefined)).toBeNull();
  });
  it("retains the existing explicit unconfigured transport code without making one up", () => {
    expect(validDisplayedPairingCode("DEV 234", undefined)).toBe("DEV 234");
  });
});
