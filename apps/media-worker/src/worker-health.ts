import { renameSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

import { VEYOCAST_APPS } from "@veyocast/config";

const readinessFreshnessMs = 75_000;
const readinessFileWriteIntervalMs = 5_000;
const defaultReadinessFilePath = "/tmp/veyocast-media-worker-ready.json";

type ReadinessMarker = {
  environment: string;
  lastPollAt: number;
  revision: string;
  service: string;
};

export type WorkerRuntimeHealth = {
  markTrafficBudget: (breached: boolean) => void;
  markDraining: () => void;
  markPoll: () => void;
  markResult: (status: "completed" | "failed" | "idle" | "retry_scheduled") => void;
  startServer: () => Promise<Server>;
};

export function createWorkerRuntimeHealth({
  environment = process.env.VEYOCAST_ENVIRONMENT ?? "development",
  now = () => Date.now(),
  port = 3100,
  readinessFilePath = defaultReadinessFilePath,
  readinessFileWriteInterval = readinessFileWriteIntervalMs,
  revision = process.env.DEPLOYMENT_SHA ?? "development"
}: {
  environment?: string;
  now?: () => number;
  port?: number;
  readinessFilePath?: string;
  readinessFileWriteInterval?: number;
  revision?: string;
} = {}): WorkerRuntimeHealth {
  let draining = false;
  let trafficBudgetBreached = false;
  let lastPollAt: number | null = null;
  let lastReadinessFileWriteAt: number | null = null;
  const recentResults: Array<"completed" | "failed" | "idle" | "retry_scheduled"> = [];

  removeReadinessMarker(readinessFilePath);

  return {
    markTrafficBudget(breached) { trafficBudgetBreached = breached; },
    markDraining() {
      draining = true;
      removeReadinessMarker(readinessFilePath);
    },
    markPoll() {
      if (draining) return;
      const polledAt = now();
      lastPollAt = polledAt;
      if (
        lastReadinessFileWriteAt === null ||
        polledAt - lastReadinessFileWriteAt >= readinessFileWriteInterval
      ) {
        const marker: ReadinessMarker = {
          environment,
          lastPollAt: polledAt,
          revision,
          service: VEYOCAST_APPS["media-worker"].name
        };
        if (writeReadinessMarker(readinessFilePath, marker)) {
          lastReadinessFileWriteAt = polledAt;
        }
      }
    },
    markResult(status) {
      recentResults.push(status);
      if (recentResults.length > 20) recentResults.shift();
    },
    startServer() {
      const server = createServer((request, response) => {
        const checkedAt = now();
        const isReady =
          !draining &&
          lastPollAt !== null &&
          checkedAt - lastPollAt <= readinessFreshnessMs;
        const isReadinessRequest = request.url === "/readyz";
        const isBusinessStatusRequest = request.url === "/statusz";

        if (
          request.method !== "GET" ||
          (!isReadinessRequest && !isBusinessStatusRequest && request.url !== "/healthz")
        ) {
          response.writeHead(404).end();
          return;
        }

        if (isBusinessStatusRequest) {
          const failed = recentResults.filter((status) => status === "failed").length;
          const retries = recentResults.filter((status) => status === "retry_scheduled").length;
          response.writeHead(200, {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8"
          });
          response.end(JSON.stringify({
            checkedAt: new Date(checkedAt).toISOString(),
            indicators: [
              { code: "recent_failures", state: failed ? "critical" : "healthy", value: failed },
              { code: "recent_retries", state: retries ? "warning" : "healthy", value: retries },
              { code: "idle_traffic_budget", state: trafficBudgetBreached ? "warning" : "healthy", value: Number(trafficBudgetBreached) }
            ],
            service: VEYOCAST_APPS["media-worker"].name,
            status: failed || retries || trafficBudgetBreached ? "degraded" : "healthy"
          }));
          return;
        }

        response.writeHead(isReadinessRequest && !isReady ? 503 : 200, {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8"
        });
        response.end(JSON.stringify({
          environment,
          revision,
          service: VEYOCAST_APPS["media-worker"].name,
          status: isReadinessRequest ? (isReady ? "ready" : "unavailable") : "ok"
        }));
      });

      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve(server);
        });
      });
    }
  };
}

export function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function removeReadinessMarker(path: string) {
  try {
    rmSync(path, { force: true });
  } catch {
    // Readiness fails closed when the marker cannot be removed or refreshed.
  }
}

function writeReadinessMarker(path: string, marker: ReadinessMarker) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(marker), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, path);
    return true;
  } catch {
    removeReadinessMarker(temporaryPath);
    return false;
  }
}
