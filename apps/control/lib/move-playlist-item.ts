export function movePlaylistItem<Item extends { id: string }>(items: Item[], itemId: string, offset: -1 | 1): Item[] {
  const index = items.findIndex(item => item.id === itemId);
  const destination = index + offset;
  if (index < 0 || destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination]!, next[index]!];
  return next;
}
