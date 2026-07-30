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

    if (!shouldUseObjectUrlForCachedPlayback()) {
      return { url: cacheKey };
    }

    if (typeof URL.createObjectURL !== "function") {
      if (
        typeof navigator !== "undefined" &&
        navigator.serviceWorker?.controller
      ) {
        return { url: cacheKey };
      }
      throw new Error("Object URL API is unavailable");
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

export function shouldUseObjectUrlForCachedPlayback({
  pathname = typeof window === "undefined" ? "" : window.location.pathname,
  serviceWorkerControlled =
    typeof navigator !== "undefined" &&
    Boolean(navigator.serviceWorker?.controller),
  userAgent =
    typeof navigator === "undefined" ? "" : navigator.userAgent
}: {
  pathname?: string;
  serviceWorkerControlled?: boolean;
  userAgent?: string;
} = {}) {
  if (!serviceWorkerControlled) return true;

  // De mediaspeler van webOS Signage kan een serviceworker-URL wel openen,
  // maar range-requests vervolgens buiten de gecontroleerde documentcontext
  // uitvoeren. Een object-URL gebruikt exact dezelfde geverifieerde cachebytes
  // en omzeilt alleen die instabiele transportgrens.
  return (
    pathname === "/lg" ||
    pathname.startsWith("/lg/") ||
    /web0s|webos|netcast|lg browser|\blge\b/i.test(userAgent)
  );
}
