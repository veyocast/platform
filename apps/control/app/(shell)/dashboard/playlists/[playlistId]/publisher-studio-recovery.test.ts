import { describe, expect, it } from "vitest";

import {
  clearRecoveryFamily,
  findRecovery,
  parseRecovery,
  recoveryStorageKey,
  saveRecovery,
  type PublisherRecoveryRecord
} from "./publisher-studio-recovery";

const tenantId = "00000000-0000-4000-8000-000000000001";
const playlistId = "00000000-0000-4000-8000-000000000002";
const itemId = "00000000-0000-4000-8000-000000000003";

function record(revision = 4): PublisherRecoveryRecord {
  return {
    createdAt: "2026-07-23T18:00:00.000Z",
    intent: {
      activeId: itemId,
      idempotencyKey: "00000000-0000-4000-8000-000000000004",
      kind: "reorder",
      targetPosition: 0
    },
    order: [itemId],
    playlistId,
    queued: true,
    revision,
    tenantId,
    version: 1
  };
}

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("Publisher Studio recoverybuffer", () => {
  it("bewaart alleen een tenant-, playlist- en revisiegebonden intent", () => {
    const storage = new MemoryStorage();
    saveRecovery(storage, record());

    expect(
      storage.getItem(recoveryStorageKey(tenantId, playlistId, 4))
    ).not.toContain("http");
    expect(findRecovery(storage, tenantId, playlistId)).toEqual(record());
  });

  it("projecteert onbekende URL-velden uit een geldige allowlist", () => {
    const unsafe = JSON.stringify({
      ...record(),
      intent: {
        ...record().intent,
        signedUrl: "https://storage.example/token"
      }
    });

    const parsed = parseRecovery(unsafe);
    expect(parsed).toEqual(record());
    expect(JSON.stringify(parsed)).not.toContain("storage.example");
  });

  it("weigert een intent met een ongeldige idempotencysleutel", () => {
    const invalid = JSON.stringify({
      ...record(),
      intent: { ...record().intent, idempotencyKey: "kort" }
    });

    expect(parseRecovery(invalid)).toBeNull();
  });

  it("wist alle revisiebuffers van exact één tenantplaylist", () => {
    const storage = new MemoryStorage();
    saveRecovery(storage, record(3));
    saveRecovery(storage, record(4));

    clearRecoveryFamily(storage, tenantId, playlistId);

    expect(storage.length).toBe(0);
  });
});
