import { createServer, type Server } from "node:http";

import { VEYOCAST_APPS } from "@veyocast/config";

const readinessFreshnessMs = 75_000;

export type WorkerRuntimeHealth = {
  markDraining: () => void;
  markPoll: () => void;
  markResult: (status: "completed" | "failed" | "idle" | "retry_scheduled") => void;
  startServer: () => Promise<Server>;
};

export function createWorkerRuntimeHealth({
  environment = process.env.VEYOCAST_ENVIRONMENT ?? "development",
  now = () => Date.now(),
  port = 3100,
  revision = process.env.DEPLOYMENT_SHA ?? "development"
}: {
  environment?: string;
  now?: () => number;
  port?: number;
  revision?: string;
} = {}): WorkerRuntimeHealth {
  let draining = false;
  let lastPollAt: number | null = null;
  const recentResults: Array<"completed" | "failed" | "idle" | "retry_scheduled"> = [];

  return {
    markDraining() {
      draining = true;
    },
    markPoll() {
      lastPollAt = now();
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
              { code: "recent_retries", state: retries ? "warning" : "healthy", value: retries }
            ],
            service: VEYOCAST_APPS["media-worker"].name,
            status: failed || retries ? "degraded" : "healthy"
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
