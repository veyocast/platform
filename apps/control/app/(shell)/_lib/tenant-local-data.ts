const tenantScopedPrefixes = [
  "veyocast:publisher-recovery:v1:"
] as const;

const tenantScopedKeys = [
  "veyocast:media-upload:pending:v1"
] as const;

const tenantScopedDatabases = [
  "veyocast-studio-recovery"
] as const;

export function clearTenantScopedLocalData(
  storage: Pick<Storage, "key" | "length" | "removeItem">
) {
  const keys = new Set<string>(tenantScopedKeys);
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && tenantScopedPrefixes.some((prefix) => key.startsWith(prefix))) {
      keys.add(key);
    }
  }
  for (const key of keys) storage.removeItem(key);
  if (typeof indexedDB !== "undefined") {
    for (const database of tenantScopedDatabases) indexedDB.deleteDatabase(database);
  }
}
