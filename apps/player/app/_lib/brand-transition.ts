const previousBrandNamespace = String.fromCharCode(99, 97, 115, 116, 105, 118, 111);

export function previousPlayerStorageKey(suffix: string) {
  return `${previousBrandNamespace}.player.${suffix}`;
}

export function readAndMigrateStorageValue(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  currentKey: string,
  previousKey: string
) {
  const currentValue = storage.getItem(currentKey);
  if (currentValue !== null) {
    storage.removeItem(previousKey);
    return currentValue;
  }

  const previousValue = storage.getItem(previousKey);
  if (previousValue === null) return null;

  storage.setItem(currentKey, previousValue);
  storage.removeItem(previousKey);
  return previousValue;
}

export function removeCurrentAndPreviousStorageValues(
  storage: Pick<Storage, "removeItem">,
  currentKey: string,
  previousKey: string
) {
  storage.removeItem(currentKey);
  storage.removeItem(previousKey);
}
