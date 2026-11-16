import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseLedScoresPlayerAssetRegistry, LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS } from '../src/ledscores-player-assets';

const sourceUrl = 'https://api.ledscores.score.tel/players/person.png';
const versionId = '30000000-0000-4000-8000-000000000003';
const now = Date.parse('2026-11-16T12:00:00Z');
const fresh = () => ({ current_version_id: versionId, last_checked_at: new Date(now).toISOString(), source_url: sourceUrl });
function fixture(entityType: 'team' | 'player' = 'player') {
  const read = vi.fn(async () => ({ data: fresh(), error: null as { message: string } | null }));
  const query = { eq: vi.fn(() => query), maybeSingle: read };
  const activation = vi.fn(async () => ({ error: null as { message: string } | null }));
  const table = { select: vi.fn(() => query),
    upsert: vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'replacement-version' }, error: null }) }) })),
    update: vi.fn(() => ({ eq: activation })) };
  const client = { from: vi.fn(() => table), storage: { from: () => ({ upload: async () => ({ error: null }) }) } };
  const registry = new SupabaseLedScoresPlayerAssetRegistry(client as unknown as ConstructorParameters<typeof SupabaseLedScoresPlayerAssetRegistry>[0], entityType);
  return { registry, read, query, activation };
}
const artifact = () => ({ assetVersionId: versionId, bytes: new Uint8Array([1]), checksumSha256: 'a'.repeat(64),
  externalId: 'same', fileSizeBytes: 1, height: 1, mimeType: 'image/webp' as const, sourceUrl, storagePath: 'fixture.webp', width: 1 });
afterEach(() => vi.useRealTimers());

describe('bounded provider metadata cache', () => {
  it('reduces one hundred identical lookups to one request, including concurrent callers', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    expect(await Promise.all(Array.from({ length: 100 }, () => value.registry.findCurrent('connection/team/player', sourceUrl)))).toEqual(Array(100).fill(versionId));
    await value.registry.findCurrent('connection/team/player', sourceUrl);
    expect(value.read).toHaveBeenCalledTimes(1);
    expect(value.query.eq).toHaveBeenCalledWith('asset_role', 'player_photo');
    vi.setSystemTime(now + 60_000);
    await value.registry.findCurrent('connection/team/player', sourceUrl);
    expect(value.read).toHaveBeenCalledTimes(2);
  });
  it('never extends the existing six-hour provider revalidation deadline', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    value.read.mockResolvedValue({ data: { ...fresh(), last_checked_at: new Date(now - LED_SCORES_PLAYER_PHOTO_REVALIDATE_MS + 5_000).toISOString() }, error: null });
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe(versionId);
    vi.setSystemTime(now + 5_001);
    expect(await value.registry.findCurrent('same', sourceUrl)).toBeNull();
    expect(value.read).toHaveBeenCalledTimes(2);
  });
  it('isolates connections, source URLs, clients and entity types', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const first = fixture();const second = fixture('team');
    await first.registry.findCurrent('connection-a/team/player', sourceUrl);
    await first.registry.findCurrent('connection-b/team/player', sourceUrl);
    expect(await first.registry.findCurrent('connection-a/team/player', sourceUrl + '?revision=2')).toBeNull();
    await second.registry.findCurrent('connection-a/team/player', sourceUrl);
    expect(first.read).toHaveBeenCalledTimes(3);expect(second.read).toHaveBeenCalledTimes(1);
    expect(second.query.eq).toHaveBeenCalledWith('asset_role', 'team_logo');
  });
  it('does not cache failures or misses', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    value.read.mockResolvedValueOnce({ data: fresh(), error: { message: 'temporary' } });
    await expect(value.registry.findCurrent('same', sourceUrl)).rejects.toThrow('ledscores_player_photo_cache_lookup_failed');
    value.read.mockResolvedValueOnce({ data: { ...fresh(), source_url: 'other' }, error: null });
    expect(await value.registry.findCurrent('same', sourceUrl)).toBeNull();
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe(versionId);
    expect(value.read).toHaveBeenCalledTimes(3);
  });
  it('evicts old positive entries at a fixed memory ceiling', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    for (let index = 0; index < 513; index += 1) await value.registry.findCurrent('connection/' + index, sourceUrl);
    await value.registry.findCurrent('connection/0', sourceUrl);
    expect(value.read).toHaveBeenCalledTimes(514);
  });
  it('invalidates a cached version when the local clock moves backwards', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();await value.registry.findCurrent('same', sourceUrl);
    vi.setSystemTime(now - 1);
    expect(await value.registry.findCurrent('same', sourceUrl)).toBeNull();
    expect(value.read).toHaveBeenCalledTimes(2);
  });
  it('bounds both positive metadata and concurrent lookup tracking', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    const requests = Array.from({ length: 600 }, (_, index) => value.registry.findCurrent('connection/' + index, sourceUrl));
    const internal = value.registry as unknown as { pending: Map<string, unknown>; current: Map<string, unknown> };
    expect(internal.pending.size).toBe(512);
    await Promise.all(requests);
    expect(internal.pending.size).toBe(0);expect(internal.current.size).toBe(512);
  });
  it('does not let a delayed pre-activation lookup repopulate the cache', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    let resolveOld!: (result: Awaited<ReturnType<typeof value.read>>) => void;
    value.read.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const oldLookup = value.registry.findCurrent('same', sourceUrl);
    expect(await value.registry.save(artifact())).toBe('replacement-version');
    value.read.mockResolvedValue({ data: { ...fresh(), current_version_id: 'replacement-version' }, error: null });
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe('replacement-version');
    resolveOld({ data: fresh(), error: null });
    await oldLookup;
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe('replacement-version');
    expect(value.read).toHaveBeenCalledTimes(2);
  });
  it('keeps a confirmed good version available if replacement activation fails', async () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const value = fixture();
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe(versionId);
    value.activation.mockResolvedValueOnce({ error: { message: 'temporary' } });
    await expect(value.registry.save(artifact())).rejects.toThrow('ledscores_player_photo_activation_failed');
    expect(await value.registry.findCurrent('same', sourceUrl)).toBe(versionId);
    expect(value.read).toHaveBeenCalledTimes(1);
  });
});
