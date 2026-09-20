/** One replaceable candidate, independent of polling, download and playback. */
export class LatestPlayerTarget {
  private generation = 0;
  private controller = new AbortController();
  private key: string | null = null;
  private screenId: string | null = null;
  private revision = -1n;

  observe(key: string, screenId: string, revision?: string) {
    if (revision !== undefined && !/^\d+$/.test(revision)) return null;
    const incoming = revision === undefined ? undefined : BigInt(revision);
    if (screenId === this.screenId && ((incoming === undefined && this.revision >= 0n) || (incoming !== undefined && incoming < this.revision))) return null;
    if (this.key === key && this.screenId === screenId) return this.token();
    this.controller.abort();
    this.controller = new AbortController();
    this.generation += 1;
    this.key = key;
    if (this.screenId !== screenId) this.revision = -1n;
    this.screenId = screenId;
    if (incoming !== undefined) this.revision = incoming;
    return this.token();
  }

  cancel() {
    this.controller.abort();
    this.key = null;
    this.generation += 1;
  }

  private token() {
    const generation = this.generation;
    const signal = this.controller.signal;
    return {
      generation,
      signal,
      isCurrent: () => !signal.aborted && generation === this.generation
    };
  }
}

export type PlayerTargetToken = NonNullable<ReturnType<LatestPlayerTarget["observe"]>>;
