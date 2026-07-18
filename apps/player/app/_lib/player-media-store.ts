export type StoredMediaUrl = {
  objectUrl?: string;
  url: string;
};

export interface PlayerMediaStore {
  delete(cacheKey: string): Promise<boolean>;
  get(cacheKey: string): Promise<Response | undefined>;
  keys(): Promise<string[]>;
  put(cacheKey: string, response: Response): Promise<void>;
  resolvePlaybackUrl(cacheKey: string): Promise<StoredMediaUrl>;
}

export class CacheStorageMediaStore implements PlayerMediaStore {
  constructor(private readonly cacheName: string) {}

  async delete(cacheKey: string) {
    return (await this.open()).delete(cacheKey);
  }

  async get(cacheKey: string) {
    return (await this.open()).match(cacheKey).then((response) => response ?? undefined);
  }

  async keys() {
    const requests = await (await this.open()).keys();
    return requests.map((request) => {
      const url = new URL(request.url);
      return `${url.pathname}${url.search}`;
    });
  }

  async put(cacheKey: string, response: Response) {
    await (await this.open()).put(cacheKey, response);
  }

  async resolvePlaybackUrl(cacheKey: string): Promise<StoredMediaUrl> {
    const response = await this.get(cacheKey);
    if (!response) {
      throw new Error(`cached asset missing: ${cacheKey}`);
    }

    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      return { url: cacheKey };
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    return { objectUrl, url: objectUrl };
  }

  private async open() {
    if (typeof caches === "undefined") {
      throw new Error("Cache Storage API is unavailable");
    }
    return caches.open(this.cacheName);
  }
}

export function createPlayerMediaStore(cacheName: string): PlayerMediaStore {
  return new CacheStorageMediaStore(cacheName);
}
