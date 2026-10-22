/** Illustratieve pure regels voor de nieuwe renderer. Geen bestaande repo-API. */
export function selectUpcomingHomeFixtures(fixtures, { ownClubId, ownTeamIds, nowMs }) {
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite');
  const teamIds = new Set(ownTeamIds);
  return fixtures.filter(match =>
    match.homeClubId === ownClubId &&
    teamIds.has(match.homeTeamId) &&
    match.status === 'scheduled' &&
    Number.isFinite(Date.parse(match.kickoffAt)) &&
    Date.parse(match.kickoffAt) > nowMs
  ).sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))
    .slice(0, 4);
}

/** null houdt een plek vast; render die als lege, onzichtbare aria-hidden slot. */
export function sixSlotPages(items) {
  const pageCount = Math.max(1, Math.ceil(items.length / 6));
  return Array.from({ length: pageCount }, (_, page) =>
    Array.from({ length: 6 }, (_, slot) => items[page * 6 + slot] ?? null));
}

/** Logische pixels. elapsedMs is actieve tijd: pauze/verborgen tijd telt niet mee. */
export function rankScrollAt({ elapsedMs, maxScroll, speed = 30, pauseSeconds = 2.5 }) {
  if (![elapsedMs, maxScroll, speed, pauseSeconds].every(Number.isFinite) ||
      speed <= 0 || pauseSeconds < 0) throw new TypeError('Invalid motion geometry');
  const max = Math.max(0, maxScroll);
  if (max === 0) return 0;
  const travel = max / speed;
  const cycle = travel * 2 + pauseSeconds * 2;
  const phase = Math.max(0, elapsedMs) / 1000 % cycle;
  if (phase < pauseSeconds) return 0;
  if (phase < pauseSeconds + travel) return (phase - pauseSeconds) * speed;
  if (phase < pauseSeconds * 2 + travel) return max;
  return Math.max(0, max - (phase - pauseSeconds * 2 - travel) * speed);
}

export function pinnedOwnRowY({ normalY, scrollY, viewportHeight, rowHeight }) {
  if (normalY === null) return null;
  const bottom = Math.max(0, viewportHeight - rowHeight);
  return Math.min(bottom, Math.max(0, normalY - scrollY));
}
