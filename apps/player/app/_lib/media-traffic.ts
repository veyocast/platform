/* eslint-disable no-var -- Function body is serialized into the ES5 Static LG bootstrap. */
/** Payload accounting, not wire/billing accounting. Self-contained ES5-compatible
 * factory is also embedded in Static LG. Counters ride the existing heartbeat;
 * no per-frame/range logs and no URLs, tokens or member data are retained.
 */
export function createMediaTraffic() {
  var counters = { networkPayloadBytes: 0, localReadBytes: 0, downloads: 0,
    cacheHits: 0, cacheMisses: 0, corrupt: 0, failed: 0, throttled: 0, duplicateDownloads: 0 };
  var failures: Record<string, { attempts: number; nextAt: number }> = {};
  var recent: Record<string, number> = {};
  var startedAt = new Date().toISOString();
  return {
    add: function (key: keyof typeof counters, count: number) {
      if (typeof count === "number" && isFinite(count) && count >= 0) {
        counters[key] = Math.min(9007199254740991, counters[key] + Math.floor(count));
      }
    },
    downloaded: function (key: string) {
      var now = Date.now();
      if (recent[key] && now - recent[key] < 300000) counters.duplicateDownloads += 1;
      if (Object.keys(recent).length >= 128) {
        Object.keys(recent).forEach(function (old) { if (now - (recent[old] || 0) >= 300000) delete recent[old]; });
      }
      if (recent[key] || Object.keys(recent).length < 128) recent[key] = now;
    },
    allow: function (key: string) {
      // Reclaim expired entries only under pressure; keep repeated failures in
      // backoff without permanently blocking new content after 128 old errors.
      if (!failures[key] && Object.keys(failures).length >= 128) {
        Object.keys(failures).forEach(function (old) { if (failures[old] && Date.now() >= failures[old].nextAt) delete failures[old]; });
      }
      if ((failures[key] && Date.now() < failures[key].nextAt) ||
        (!failures[key] && Object.keys(failures).length >= 128)) {
        counters.throttled += 1;
        return false;
      }
      return true;
    },
    failure: function (key: string) {
      if (!failures[key] && Object.keys(failures).length >= 128) {
        // Bound memory without evicting a failing key into an immediate retry.
        return;
      }
      var attempts = Math.min(3, (failures[key] ? failures[key].attempts : 0) + 1);
      failures[key] = { attempts: attempts, nextAt: Math.max(failures[key] ? failures[key].nextAt : 0, Date.now() + (attempts >= 3 ? 3600000 : 30000 * Math.pow(2, attempts - 1))) };
      counters.failed += 1;
    },
    defer: function (key: string, until: number) {
      if (isFinite(until) && until > Date.now() && (failures[key] || Object.keys(failures).length < 128)) {
        failures[key] = { attempts: failures[key] ? failures[key].attempts : 0,
          nextAt: Math.max(failures[key] ? failures[key].nextAt : 0, until) };
      }
    },
    success: function (key: string) { delete failures[key]; },
    snapshot: function () { return Object.assign({ version: 1, startedAt: startedAt, accounting: "payload" }, counters); }
  };
}

export const playerMediaTraffic = createMediaTraffic();
