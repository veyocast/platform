import { describe, expect, it } from "vitest";

import {
  previousPlayerStorageKey,
  readAndMigrateStorageValue,
  removeCurrentAndPreviousStorageValues
} from "./brand-transition";

function createStorage(entries: Record<string, string>) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values
  };
}

describe("brand storage transition", () => {
  it("moves a previous player value into the VeyoCast namespace", () => {
    const previousKey = previousPlayerStorageKey("deviceToken");
    const storage = createStorage({ [previousKey]: "device-token" });

    expect(
      readAndMigrateStorageValue(
        storage,
        "veyocast.player.deviceToken",
        previousKey
      )
    ).toBe("device-token");
    expect(storage.values.get("veyocast.player.deviceToken")).toBe("device-token");
    expect(storage.values.has(previousKey)).toBe(false);
  });

  it("keeps a current value authoritative and can clear both namespaces", () => {
    const previousKey = previousPlayerStorageKey("pairingCode");
    const currentKey = "veyocast.player.pairingCode";
    const storage = createStorage({ [currentKey]: "NEW", [previousKey]: "OLD" });

    expect(readAndMigrateStorageValue(storage, currentKey, previousKey)).toBe("NEW");
    expect(storage.values.has(previousKey)).toBe(false);
    removeCurrentAndPreviousStorageValues(storage, currentKey, previousKey);
    expect(storage.values.size).toBe(0);
  });
});
