const defaultChunkSize = 100;

export function chunkPlaylistStudioIds(
  values: readonly (string | null | undefined)[],
  chunkSize = defaultChunkSize
) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError("chunkSize must be a positive integer");
  }

  const ids = [...new Set(values.filter((value): value is string => Boolean(value)))];
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}

export function mergePlaylistStudioRows<T extends Readonly<{ id: string }>>(
  ...groups: readonly (readonly T[])[]
) {
  const rows = new Map<string, T>();
  for (const group of groups) {
    for (const row of group) rows.set(row.id, row);
  }
  return [...rows.values()];
}
