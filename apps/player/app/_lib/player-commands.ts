import {
  playerAssetCacheName,
  playerDatabaseName
} from "./player-cache";

export const playerCommandTypes = [
  "RELOAD_PLAYER",
  "RECOVER_PAIRING",
  "FORCE_UNPAIR",
  "CLEAR_PLAYER_CACHE"
] as const;

export type PlayerCommandType = (typeof playerCommandTypes)[number];

export type PlayerCommand = {
  commandType: PlayerCommandType;
  createdAt: string;
  expiresAt: string;
  id: string;
  nonce: string;
  payload: Record<string, unknown>;
};

type ExecutedCommand = {
  executedAt: string;
  nonce: string;
};

const executedCommandRetentionMs = 7 * 24 * 60 * 60 * 1_000;
const maximumExecutedCommands = 100;
const playerShellCachePrefix = "veyocast-player-shell-";

export function parsePlayerCommands(value: unknown): PlayerCommand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }
    const command = candidate as Record<string, unknown>;
    if (
      typeof command.id !== "string" ||
      typeof command.nonce !== "string" ||
      typeof command.createdAt !== "string" ||
      typeof command.expiresAt !== "string" ||
      !playerCommandTypes.includes(command.commandType as PlayerCommandType) ||
      !command.payload ||
      typeof command.payload !== "object" ||
      Array.isArray(command.payload)
    ) {
      return [];
    }
    return [{
      commandType: command.commandType as PlayerCommandType,
      createdAt: command.createdAt,
      expiresAt: command.expiresAt,
      id: command.id,
      nonce: command.nonce,
      payload: command.payload as Record<string, unknown>
    }];
  });
}

export function shouldExecutePlayerCommand(
  command: PlayerCommand,
  executedNonces: ReadonlySet<string>,
  authoritativeNow = Date.now()
) {
  const expiry = Date.parse(command.expiresAt);
  return (
    Number.isFinite(expiry) &&
    expiry > authoritativeNow &&
    !executedNonces.has(command.nonce)
  );
}

export function readExecutedPlayerCommandNonces(
  storage: Pick<Storage, "getItem">,
  key: string,
  now = Date.now()
) {
  return new Set(
    readExecutedCommands(storage, key, now).map((entry) => entry.nonce)
  );
}

export function rememberExecutedPlayerCommand(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  nonce: string,
  now = Date.now()
) {
  const entries = readExecutedCommands(storage, key, now).filter(
    (entry) => entry.nonce !== nonce
  );
  entries.push({ executedAt: new Date(now).toISOString(), nonce });
  try {
    storage.setItem(
      key,
      JSON.stringify(entries.slice(-maximumExecutedCommands))
    );
  } catch {
    // Server completion remains the cross-reload idempotency boundary.
  }
}

export async function clearPlayerContentCaches() {
  const failures: string[] = [];

  if (typeof indexedDB !== "undefined") {
    await deleteDatabase(playerDatabaseName).catch(() => {
      failures.push("INDEXEDDB_CLEAR_FAILED");
    });
  }

  if (typeof caches !== "undefined") {
    await caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name === playerAssetCacheName ||
                name.startsWith(playerShellCachePrefix)
            )
            .map((name) => caches.delete(name))
        )
      )
      .catch(() => {
        failures.push("CACHE_STORAGE_CLEAR_FAILED");
      });
  }

  return { failures, ok: failures.length === 0 };
}

function readExecutedCommands(
  storage: Pick<Storage, "getItem">,
  key: string,
  now: number
) {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ExecutedCommand => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return false;
        }
        const candidate = entry as Partial<ExecutedCommand>;
        const executedAt =
          typeof candidate.executedAt === "string"
            ? Date.parse(candidate.executedAt)
            : Number.NaN;
        return (
          typeof candidate.nonce === "string" &&
          Number.isFinite(executedAt) &&
          executedAt > now - executedCommandRetentionMs &&
          executedAt <= now
        );
      })
      .slice(-maximumExecutedCommands);
  } catch {
    return [];
  }
}

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("INDEXEDDB_DELETE_BLOCKED"));
  });
}
