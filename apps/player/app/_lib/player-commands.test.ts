import { describe, expect, it } from "vitest";

import {
  parsePlayerCommands,
  readExecutedPlayerCommandNonces,
  rememberExecutedPlayerCommand,
  shouldExecutePlayerCommand
} from "./player-commands";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

const command = {
  commandType: "RECOVER_PAIRING" as const,
  createdAt: "2026-07-26T10:00:00.000Z",
  expiresAt: "2026-07-26T10:10:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  nonce: "22222222-2222-4222-8222-222222222222",
  payload: {}
};

describe("player remote commands", () => {
  it("voert dezelfde nonce lokaal maar één keer uit", () => {
    const storage = memoryStorage();
    const now = Date.parse("2026-07-26T10:01:00.000Z");

    expect(
      shouldExecutePlayerCommand(
        command,
        readExecutedPlayerCommandNonces(storage, "commands", now),
        now
      )
    ).toBe(true);
    rememberExecutedPlayerCommand(storage, "commands", command.nonce, now);
    expect(
      shouldExecutePlayerCommand(
        command,
        readExecutedPlayerCommandNonces(storage, "commands", now),
        now
      )
    ).toBe(false);
  });

  it("voert een verlopen command niet uit", () => {
    expect(
      shouldExecutePlayerCommand(
        command,
        new Set(),
        Date.parse("2026-07-26T10:10:00.000Z")
      )
    ).toBe(false);
  });

  it("gebruikt de servertijd wanneer de apparaatklok twee uur voorloopt", () => {
    const serverNow = Date.parse("2026-07-26T10:01:00.000Z");
    const incorrectDeviceNow = Date.parse("2026-07-26T12:01:00.000Z");

    expect(incorrectDeviceNow).toBeGreaterThan(Date.parse(command.expiresAt));
    expect(
      shouldExecutePlayerCommand(command, new Set(), serverNow)
    ).toBe(true);
  });

  it("weigert onbekende commandtypes en onvolledige records", () => {
    expect(parsePlayerCommands([command, { ...command, commandType: "WIPE" }]))
      .toEqual([command]);
  });
});
