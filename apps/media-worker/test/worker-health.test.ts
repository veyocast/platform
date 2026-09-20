import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { closeServer, createWorkerRuntimeHealth } from "../src/worker-health";

const servers: Parameters<typeof closeServer>[0][] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { force: true, recursive: true });
  });
});

describe("media worker runtime health", () => {
  it("only becomes ready after a recent queue poll and drains explicitly", async () => {
    const directory = mkdtempSync(join(tmpdir(), "veyocast-worker-health-"));
    temporaryDirectories.push(directory);
    let timestamp = 1_000;
    const health = createWorkerRuntimeHealth({
      environment: "staging",
      now: () => timestamp,
      port: 0,
      readinessFilePath: join(directory, "ready.json"),
      revision: "0123456789abcdef0123456789abcdef01234567"
    });
    const server = await health.startServer();
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Testserver heeft geen poort.");

    await expect(get(address.port, "/healthz")).resolves.toMatchObject({
      body: { service: "VeyoCast Media Worker", status: "ok" },
      statusCode: 200
    });
    await expect(get(address.port, "/readyz")).resolves.toMatchObject({ statusCode: 503 });

    health.markPoll();
    health.markResult("retry_scheduled");
    await expect(get(address.port, "/statusz")).resolves.toMatchObject({
      body: {
        indicators: [
          { code: "recent_failures", state: "healthy", value: 0 },
          { code: "recent_retries", state: "warning", value: 1 },
          { code: "idle_traffic_budget", state: "healthy", value: 0 }
        ],
        status: "degraded"
      },
      statusCode: 200
    });
    await expect(get(address.port, "/readyz")).resolves.toMatchObject({
      body: { environment: "staging", status: "ready" },
      statusCode: 200
    });

    timestamp += 75_001;
    await expect(get(address.port, "/readyz")).resolves.toMatchObject({ statusCode: 503 });
    health.markPoll();
    health.markDraining();
    await expect(get(address.port, "/readyz")).resolves.toMatchObject({ statusCode: 503 });
  });

  it("publishes a release-bound queue heartbeat and removes it while draining", () => {
    const directory = mkdtempSync(join(tmpdir(), "veyocast-worker-health-"));
    temporaryDirectories.push(directory);
    const readinessFilePath = join(directory, "ready.json");
    const revision = "0123456789abcdef0123456789abcdef01234567";
    let timestamp = 1_000;
    writeFileSync(readinessFilePath, JSON.stringify({ lastPollAt: 999_999 }));

    const health = createWorkerRuntimeHealth({
      environment: "production",
      now: () => timestamp,
      readinessFilePath,
      readinessFileWriteInterval: 5_000,
      revision
    });

    expect(existsSync(readinessFilePath)).toBe(false);
    health.markPoll();
    expect(readMarker(readinessFilePath)).toEqual({
      environment: "production",
      lastPollAt: 1_000,
      revision,
      service: "VeyoCast Media Worker"
    });

    timestamp = 5_999;
    health.markPoll();
    expect(readMarker(readinessFilePath).lastPollAt).toBe(1_000);

    timestamp = 6_000;
    health.markPoll();
    expect(readMarker(readinessFilePath).lastPollAt).toBe(6_000);

    health.markDraining();
    expect(existsSync(readinessFilePath)).toBe(false);
    health.markPoll();
    expect(existsSync(readinessFilePath)).toBe(false);
  });
});

function readMarker(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    environment: string;
    lastPollAt: number;
    revision: string;
    service: string;
  };
}

function get(port: number, path: string) {
  return new Promise<{ body: Record<string, unknown>; statusCode: number }>((resolve, reject) => {
    const outgoing = request({ host: "127.0.0.1", method: "GET", path, port }, (incoming) => {
      let body = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { body += chunk; });
      incoming.on("end", () => resolve({
        body: JSON.parse(body) as Record<string, unknown>,
        statusCode: incoming.statusCode ?? 0
      }));
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
}
