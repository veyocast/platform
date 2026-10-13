import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSportlinkMatches, SportlinkClient } from "@veyocast/integrations/server";
import sharp from "sharp";
import { createHash } from "node:crypto";
import type { SportlinkTeamLogoArtifact } from "../src/sportlink-media";
import { prepareSportlinkClubLogo, prepareSportlinkTeamLogo } from "../src/sportlink-media";

import {
  collectSportlinkPoolContexts,
  collectSportlinkPoolIds,
  collectSportlinkMatchLogoCandidates,
  dedupeSportlinkMatches,
  enrichSportlinkOwnMatchesWithPoolContexts,
  enrichSportlinkPoolMatches,
  fetchSportlinkDataset,
  runSportlinkSyncLoop,
  runSportlinkSyncOnce,
  SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const logoBytes = new Uint8Array(await sharp({
  create: { background: "#123456", channels: 4, height: 64, width: 64 }
}).webp().toBuffer());
const logoChecksum = createHash("sha256").update(logoBytes).digest("hex");

describe("immutable Sportlink logo objects through the real Supabase client", () => {
  const job = {
    connectionId: "20000000-0000-4000-8000-000000000001", dataSourceId: "30000000-0000-4000-8000-000000000001",
    datasetGroup: "competitions", encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
    runId: "40000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
  };
  type Batch = Parameters<SupabaseSportlinkSyncBackend["complete"]>[2];
  const batch = (teamLogos: SportlinkTeamLogoArtifact[] = []): Batch => ({
    activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
    matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos, teams: []
  });
  const image = (color: string) => sharp({
    create: { background: color, channels: 4, height: 64, width: 64 }
  }).png().toBuffer();
  const prepare = async (id: string, color = "#123456") => prepareSportlinkTeamLogo(
    job, id, "Testteam", "https://images.test/same-source.png", await image(color)
  );
  const storage = () => {
    const objects = new Map<string, Uint8Array>();
    const uploads: string[] = [];
    const reads: string[] = [];
    const payloads: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/v1/object/")) {
        if (init?.method === "GET") {
          reads.push(url.pathname);
          expect(init.cache).toBe("no-store");
          const object = objects.get(url.pathname);
          return object ? new Response(new Uint8Array(object), { headers: { "content-type": "image/webp" } })
            : Response.json({ message: "not found" }, { status: 404 });
        }
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-upsert")).toBe("false");
        uploads.push(url.pathname);
        objects.set(url.pathname, new Uint8Array(init?.body as Uint8Array));
        return Response.json({ Id: "stored", Key: "stored" });
      }
      expect(url.pathname).toBe("/rest/v1/rpc/complete_sportlink_sync_v4");
      payloads.push(JSON.parse(String(init?.body)));
      return Response.json({ readCount: 2 });
    }));
    return { objects, uploads, reads, payloads };
  };
  const backend = () => new SupabaseSportlinkSyncBackend("https://supabase.test", "fixture-only");

  it("uploads one shared object, keeps both external IDs, and reuses verified bytes in a new worker run", async () => {
    const first = await prepare("team-1"), second = await prepare("team-2");
    expect(first.storagePath).toBe(second.storagePath);
    expect(first.assetId).not.toBe(second.assetId);
    const state = storage();
    await expect(backend().complete(job, "worker:test", batch([first, second]))).resolves.toBe(2);
    await expect(backend().complete(job, "worker:test", batch([first, second]))).resolves.toBe(2);
    expect(state.uploads).toHaveLength(1);
    expect(state.reads).toHaveLength(2);
    for (const payload of state.payloads) expect(payload.p_team_logos).toEqual([
      expect.objectContaining({ assetId: first.assetId, externalId: "team-1" }),
      expect.objectContaining({ assetId: second.assetId, externalId: "team-2" })
    ]);
  });

  it("checks changed bytes at the same source URL and stores precisely one new shared object", async () => {
    const old = await prepare("team-1"), current = await prepare("team-1", "#abcdef"), other = await prepare("team-2", "#abcdef");
    expect(old.sourceUrl).toBe(current.sourceUrl);
    const state = storage();
    await backend().complete(job, "worker:test", batch([old]));
    await backend().complete(job, "worker:test", batch([current, other]));
    expect(state.uploads).toHaveLength(2);
    expect(state.objects).toHaveProperty("size", 2);
    expect(current.assetId).not.toBe(old.assetId);
    expect(state.payloads[1]?.p_team_logos).toEqual([
      expect.objectContaining({ assetId: current.assetId, externalId: "team-1" }),
      expect.objectContaining({ assetId: other.assetId, externalId: "team-2" })
    ]);
  });

  it("checks the daily club source again and submits its newly stored version rather than the old logo", async () => {
    let color = "#123456";
    const source = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return url.pathname === "/clubgegevens" ? Response.json({ clubcode: "TEST", clubnaam: "Testclub" })
        : new Response(new Uint8Array(await image(color)), { headers: { "content-type": "image/png" } });
    });
    const client = new SportlinkClient("fixture-only", { fetchImpl: source, maxAttempts: 1 });
    const state = storage();
    const old = await fetchSportlinkDataset("club_profile", client, job);
    await backend().complete({ ...job, datasetGroup: "club_profile" }, "worker:test", old);
    color = "#abcdef";
    const current = await fetchSportlinkDataset("club_profile", client, job);
    await backend().complete({ ...job, datasetGroup: "club_profile" }, "worker:test", current);
    expect(source).toHaveBeenCalledTimes(4);
    expect(state.uploads).toHaveLength(2);
    expect(current.clubLogo?.assetId).not.toBe(old.clubLogo?.assetId);
    expect(state.payloads[1]?.p_club_logo).toMatchObject({ assetId: current.clubLogo?.assetId, externalId: "TEST" });
  });

  it.each([true, false])("accepts a concurrent insert only after verifying the competing object's bytes (%s)", async (valid) => {
    const artifact = await prepare("team-1");
    let reads = 0, writes = 0;
    let payload: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        if (init?.method === "GET") return ++reads === 1 ? Response.json({}, { status: 404 })
          : new Response(valid ? new Uint8Array(artifact.bytes) : new Uint8Array(artifact.bytes.length), { headers: { "content-type": "image/webp" } });
        writes++;
        return Response.json({ message: "conflict", statusCode: "409" }, { status: 409 });
      }
      payload = JSON.parse(String(init?.body));
      return Response.json({ readCount: 1 });
    }));
    await backend().complete(job, "worker:test", batch([artifact]));
    expect(reads).toBe(2); expect(writes).toBe(1);
    expect(payload?.p_team_logos).toHaveLength(valid ? 1 : 0);
  });

  it.each([400, 503])("does not interpret lookup HTTP%s with a false404 body as a missing object", async (status) => {
    const artifact = await prepare("team-1");
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        methods.push(init?.method ?? "");
        return Response.json({ statusCode: "404", message: "PRIVATE_TOKEN" }, { status });
      }
      if (url.pathname.endsWith("provider_asset_cache")) return Response.json([]);
      expect(JSON.parse(String(init?.body)).p_team_logos).toEqual([]);
      return Response.json({ readCount: 1 });
    }));
    await expect(backend().complete(job, "worker:test", batch([artifact]))).resolves.toBe(1);
    expect(methods).toEqual(["GET"]);
  });

  it.each([
    [404, { code: "NoSuchKey", message: "not found" }],
    [400, { code: "not_found", message: "Object not found" }],
    [400, { statusCode: "404", message: "Object not found" }]
  ])("creates a missing immutable object for the pinned SDK's documented shape HTTP%s/%j", async (status, body) => {
    const artifact = await prepare("team-1");
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        methods.push(init?.method ?? "");
        return init?.method === "GET" ? Response.json(body, { status }) : Response.json({ Id: "stored", Key: "stored" });
      }
      expect(JSON.parse(String(init?.body)).p_team_logos).toHaveLength(1);
      return Response.json({ readCount: 1 });
    }));
    await backend().complete(job, "worker:test", batch([artifact]));
    expect(methods).toEqual(["GET", "POST"]);
  });

  it.each([
    [404, { code: "NoSuchBucket", message: "Object not found" }],
    [400, { code: "InvalidRequest", message: "Object not found" }],
    [500, { code: "not_found", message: "Object not found" }],
    [503, { code: "NoSuchKey", message: "Object not found" }]
  ])("keeps non-object-miss HTTP%s/%j behind the optional media circuit", async (status, body) => {
    const artifact = await prepare("team-1");
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        methods.push(init?.method ?? ""); return Response.json(body, { status });
      }
      if (url.pathname.endsWith("provider_asset_cache")) return Response.json([]);
      expect(JSON.parse(String(init?.body)).p_team_logos).toHaveLength(0);
      return Response.json({ readCount: 1 });
    }));
    await backend().complete(job, "worker:test", batch([artifact]));
    expect(methods).toEqual(["GET"]);
  });

  it.each([
    [409, { code: "ResourceAlreadyExists", message: "exists" }],
    [400, { code: "already_exists", message: "The resource already exists" }],
    [400, { statusCode: "409", message: "The resource already exists" }]
  ])("verifies real bytes after the pinned SDK's modern or legacy conflict HTTP%s/%j", async (status, body) => {
    const artifact = await prepare("team-1");
    const methods: string[] = [];
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        methods.push(init?.method ?? "");
        if (init?.method === "GET") return ++reads === 1 ? Response.json({}, { status: 404 }) : new Response(new Uint8Array(artifact.bytes));
        return Response.json(body, { status });
      }
      expect(JSON.parse(String(init?.body)).p_team_logos).toHaveLength(1);
      return Response.json({ readCount: 1 });
    }));
    await backend().complete(job, "worker:test", batch([artifact]));
    expect(methods).toEqual(["GET", "POST", "GET"]);
  });

  it("cancels an oversized object stream and never rewrites its corrupt immutable path", async () => {
    const artifact = await prepare("team-1");
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(artifact.bytes.length + 1)); },
      cancel() { cancelled = true; }
    });
    const writes: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith("/storage/")) {
        writes.push(init?.method ?? "");
        return new Response(stream);
      }
      if (url.pathname.endsWith("provider_asset_cache")) return Response.json([]);
      expect(JSON.parse(String(init?.body)).p_team_logos).toEqual([]);
      return Response.json({ readCount: 1 });
    }));
    await backend().complete(job, "worker:test", batch([artifact]));
    expect(cancelled).toBe(true); expect(writes).toEqual(["GET"]);
  });

  it("aborts a held object body without upload, pointer completion or private error leakage", async () => {
    const artifact = await prepare("team-1");
    let began!: () => void;
    const started = new Promise<void>((resolve) => { began = resolve; });
    let cancelled = false;
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? "");
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(artifact.bytes.slice(0, 1)); began(); },
        cancel() { cancelled = true; }
      }));
    }));
    const controller = new AbortController();
    const instance = backend(); instance.bindOperationSignal(controller.signal);
    const pending = instance.complete(job, "worker:test", batch([artifact]));
    await started; controller.abort("PRIVATE_REASON");
    await expect(pending).rejects.toHaveProperty("code", "SPORTLINK_WORKER_CANCELLED");
    await vi.waitFor(() => expect(cancelled).toBe(true));
    expect(methods).toEqual(["GET"]);
  });

  it("aborts the real SDK's held POST at the same object deadline after a late missing GET", async () => {
    const artifact = await prepare("team-1"), later = await prepare("team-2", "#abcdef");
    const paths: string[] = [];
    let began!: () => void, closed!: () => void;
    const uploading = new Promise<void>((resolve) => { began = resolve; });
    const disconnected = new Promise<void>((resolve) => { closed = resolve; });
    let uploadSignal: AbortSignal | null | undefined;
    const nativeFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>((input, init) => {
      if (init?.method === "POST" && String(input).includes("/storage/v1/object/")) uploadSignal = init.signal;
      return nativeFetch(input, init);
    }));
    const server = createServer((request, response) => {
      const path = request.url ?? "";
      paths.push(`${request.method} ${path}`);
      request.resume();
      response.setHeader("Content-Type", "application/json");
      if (path.startsWith("/storage/") && request.method === "GET") {
        setTimeout(() => { response.statusCode = 404; response.end(JSON.stringify({ message: "not found" })); }, 350);
      } else if (path.startsWith("/storage/")) {
        response.writeHead(200);
        response.write('{"Id":');
        response.once("close", closed);
        began();
      } else if (path.startsWith("/rest/v1/provider_asset_cache")) response.end("[]");
      else response.end(JSON.stringify({ readCount: 2 }));
    });
    await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture_address_invalid");
    const instance = new SupabaseSportlinkSyncBackend(`http://127.0.0.1:${address.port}`, "fixture-only", undefined, 600);
    let pending: ReturnType<SupabaseSportlinkSyncBackend["complete"]> | undefined;
    try {
      pending = instance.complete(job, "worker:test", batch([artifact, later]));
      await uploading;
      await expect(pending).resolves.toBe(2);
      expect(uploadSignal?.aborted).toBe(true);
      await disconnected;
      expect(paths.filter((path) => path.includes("/storage/"))).toEqual([
        `GET /storage/v1/object/provider-assets/${artifact.storagePath}`,
        `POST /storage/v1/object/provider-assets/${artifact.storagePath}`
      ]);
      expect(paths.filter((path) => path.includes("complete_sportlink_sync_v4"))).toHaveLength(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
      await pending;
    }
  });

  it("separates club and team roles even for the same normalized image", async () => {
    const team = await prepare("team-1");
    const club = await prepareSportlinkClubLogo(job, "club-1", "Testclub", await image("#123456"));
    const state = storage();
    const current = batch([team]); current.clubLogo = club;
    await backend().complete(job, "worker:test", current);
    expect(club.checksumSha256).toBe(team.checksumSha256);
    expect(state.uploads).toHaveLength(2);
    expect(state.payloads[0]?.p_club_logo).toMatchObject({ assetId: club.assetId, role: "club_logo" });
  });
});

describe("Sportlink worker lifecycle cancellation", () => {
  const job = {
    connectionId: "20000000-0000-4000-8000-000000000001", dataSourceId: "30000000-0000-4000-8000-000000000001",
    datasetGroup: "competitions", encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
    runId: "40000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
  };
  const claimRow = { connection_id: job.connectionId, data_source_id: job.dataSourceId, dataset_group: job.datasetGroup,
    encrypted_client_id: job.encryptedClientId, encryption_iv: job.encryptionIv, encryption_tag: job.encryptionTag,
    run_id: job.runId, tenant_id: job.tenantId, timezone: job.timezone };
  type Batch = Parameters<SupabaseSportlinkSyncBackend["complete"]>[2];
  const batch = (): Batch => ({ activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
    matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: [] });
  const logos = (): Batch["teamLogos"] => [1, 2].map((number) => ({
    assetId: `50000000-0000-5000-8000-${String(number).padStart(12, "0")}`, bytes: logoBytes,
    checksumSha256: logoChecksum, externalId: `team-${number}`, fileSizeBytes: logoBytes.length, height: 64,
    mimeType: "image/webp", role: "team_logo", sourceUrl: "https://provider.test/PRIVATE_SOURCE",
    storagePath: `providers/sportlink/team_logo/${logoChecksum}.webp`, title: "PRIVATE_TEAM", width: 64
  }));

  it("binds exactly one lifecycle signal and rejects rebinding before any I/O", async () => {
    const rpc = vi.fn(); const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "fixture-only", { rpc });
    const controller = new AbortController(); backend.bindOperationSignal(controller.signal); backend.bindOperationSignal(controller.signal);
    expect(() => backend.bindOperationSignal(new AbortController().signal)).toThrow("sportlink_operation_signal_already_bound");
    controller.abort("PRIVATE_REASON");
    const executeDataset = vi.fn();
    expect(await runSportlinkSyncOnce({ backend, encryptionKey: "fixture-only", executeDataset,
      lockTimeoutSeconds: 60, signal: controller.signal, workerId: "worker:test" })).toEqual({ status: "idle" });
    await expect(backend.claim("worker:test", 60)).rejects.toHaveProperty("code", "SPORTLINK_WORKER_CANCELLED");
    await expect(backend.complete(job, "worker:test", batch())).rejects.toHaveProperty("code", "SPORTLINK_WORKER_CANCELLED");
    await expect(backend.fail(job, "worker:test", "code", "detail")).rejects.toHaveProperty("code", "SPORTLINK_WORKER_CANCELLED");
    await expect(backend.renew(job, "worker:test")).rejects.toHaveProperty("code", "SPORTLINK_WORKER_CANCELLED");
    expect(rpc).not.toHaveBeenCalled();
    expect(executeDataset).not.toHaveBeenCalled();
  });

  it.each(["claim", "upload", "complete", "fail", "cache"])("aborts a held native SDK %s and starts no later request", async (stage) => {
    const paths: string[] = []; let began!: () => void, closed!: () => void;
    const active = new Promise<void>((resolve) => { began = resolve; });
    const disconnected = new Promise<void>((resolve) => { closed = resolve; });
    const held = (path: string) => stage === "claim" ? path.includes("claim_due_") : stage === "upload" ? path.startsWith("/storage/")
      : stage === "cache" ? path.startsWith("/rest/v1/provider_asset_cache") : path.includes(`${stage}_sportlink_sync_`);
    const server = createServer((request, response) => {
      const path = request.url ?? ""; paths.push(path); request.resume();
      if (held(path)) { response.on("close", closed); began(); return; }
      response.setHeader("Content-Type", "application/json");
      if (path.includes("claim_due_")) response.end(JSON.stringify([claimRow]));
      else if (path.startsWith("/storage/")) { response.statusCode = 503; response.end(JSON.stringify({ message: "PRIVATE_ERROR" })); }
      else if (stage === "fail") { response.statusCode = 500; response.end(JSON.stringify({ code: "57014", message: "PRIVATE_ERROR" })); }
      else response.end(JSON.stringify({ readCount: 0 }));
    });
    await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); if (!address || typeof address === "string") throw new Error("fixture_address_invalid");
    const backend = new SupabaseSportlinkSyncBackend(`http://127.0.0.1:${address.port}`, "fixture-only");
    const controller = new AbortController(); let execution: ReturnType<typeof runSportlinkSyncOnce> | undefined;
    try {
      execution = runSportlinkSyncOnce({ backend, encryptionKey: "fixture-only", lockTimeoutSeconds: 60, signal: controller.signal,
        executeDataset: async (_job, _key, signal) => { expect(signal).toBe(controller.signal); const current = batch();
          if (stage === "upload" || stage === "cache") current.teamLogos = logos(); return current; }, workerId: "worker:test" });
      await active; controller.abort("PRIVATE_ABORT_REASON");
      const result = await execution; await disconnected;
      expect(result).toEqual({ status: "idle" }); expect(JSON.stringify(result)).not.toContain("PRIVATE_");
      expect(paths.filter((path) => path.startsWith("/storage/"))).toHaveLength(stage === "upload" || stage === "cache" ? 1 : 0);
      expect(paths.filter((path) => path.includes("complete_sportlink_sync_"))).toHaveLength(stage === "complete" || stage === "fail" ? 1 : 0);
      expect(paths.filter((path) => path.includes("fail_sportlink_sync_"))).toHaveLength(stage === "fail" ? 1 : 0);
    } finally {
      controller.abort(); server.closeAllConnections();
      await new Promise<void>((resolve) => { server.close(() => resolve()); }); await execution;
    }
  });

  it("disarms heartbeat and cancels a native renewal while provider work is pending", async () => {
    vi.useFakeTimers(); let began!: () => void, closed!: () => void, providerBegan!: () => void;
    const active = new Promise<void>((resolve) => { began = resolve; });
    const disconnected = new Promise<void>((resolve) => { closed = resolve; });
    const fetching = new Promise<void>((resolve) => { providerBegan = resolve; });
    const paths: string[] = [];
    const server = createServer((request, response) => {
      const path = request.url ?? ""; paths.push(path); request.resume();
      if (path.includes("claim_due_")) { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify([claimRow])); }
      else { response.on("close", closed); began(); }
    });
    await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); if (!address || typeof address === "string") throw new Error("fixture_address_invalid");
    const backend = new SupabaseSportlinkSyncBackend(`http://127.0.0.1:${address.port}`, "fixture-only"); const controller = new AbortController();
    const execution = runSportlinkSyncOnce({ backend, encryptionKey: "fixture-only", executeDataset: async () => {
      providerBegan(); return new Promise(() => {}); }, lockTimeoutSeconds: 60, signal: controller.signal, workerId: "worker:test" });
    try {
      await fetching; await vi.advanceTimersByTimeAsync(20_000); await active;
      controller.abort("PRIVATE_REASON"); expect(await execution).toEqual({ status: "idle" }); await disconnected;
      await vi.advanceTimersByTimeAsync(120_000);
      expect(paths).toEqual(["/rest/v1/rpc/claim_due_sportlink_sync_v2", "/rest/v1/rpc/renew_sportlink_sync_lease_v1"]);
    } finally {
      controller.abort(); server.closeAllConnections(); await new Promise<void>((resolve) => { server.close(() => resolve()); });
      await execution;
    }
  });

  it("suppresses loop accounting during a stopped claim and makes no second claim", async () => {
    const controller = new AbortController(); const onResult = vi.fn();
    const claim = vi.fn(async () => { controller.abort("PRIVATE_REASON"); return null; });
    await runSportlinkSyncLoop({ backend: { claim, complete: vi.fn(), fail: vi.fn(), renew: vi.fn() }, encryptionKey: null,
      intervalMs: 1000, lockTimeoutSeconds: 60, signal: controller.signal, onResult, workerId: "worker:test" });
    expect(claim).toHaveBeenCalledOnce(); expect(onResult).not.toHaveBeenCalled();
  });
});

describe("Sportlink sync worker", () => {
  it("fetches the tenant logo with the daily club profile observation", async () => {
    const logo = await sharp({
      create: { background: "#FF5C20", channels: 4, height: 64, width: 64 }
    }).png().toBuffer();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/clubgegevens") {
        return new Response(JSON.stringify({
          clubcode: "DUIN",
          clubnaam: "Duindorp sv"
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/clublogo") {
        return new Response(new Uint8Array(logo), {
          headers: { "content-type": "image/png" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "club_profile",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "club_profile",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      club: { externalId: "DUIN", name: "Duindorp sv" },
      clubLogo: { externalId: "DUIN", role: "club_logo" }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses the same connection catalog to identify equally named standing teams", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const payload = url.pathname === "/teams" ? [
        { teamcode: 355471, teamnaam: "Club 35+1", poulecode: 833025, competitienaam: "Veteranen beker zaterdag" },
        { teamcode: 394546, teamnaam: "Club 35+1", poulecode: 836218, competitienaam: "Vrijdag 7x7" }
      ] : url.pathname === "/poulestand" ? [{ team: "Club 35+1", positie: 1, punten: 6 }] : [];
      return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    });
    const batch = await fetchSportlinkDataset("competitions", new SportlinkClient("client-id", {
      fetchImpl: fetchImpl as typeof fetch, maxAttempts: 1
    }), {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
    });
    expect(batch.standings.map((standing) => ({
      pool: standing.pool.externalId, team: standing.rows[0]?.externalId
    }))).toEqual([{ pool: "833025", team: "355471" }, { pool: "836218", team: "394546" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  describe("standing form for every pool team", () => {
    const job = {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
    };
    const ownTeam = { teamcode: 10, teamnaam: "Testclub 1", poulecode: 701 };
    const client = (fetchImpl: typeof fetch) => new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });

    it("fetches own and other results over 90 days and completes forms without creating selectable opponents", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
      const requests: string[] = [];
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([
          { team: "Testclub 1" }, { team: "Bezoekers 1" }, { team: "Bezoekers 2" }
        ]);
        if (url.pathname === "/pouleuitslagen") {
          expect(url.searchParams.get("poulecode")).toBe("701");
          expect(url.searchParams.get("aantaldagen")).toBe("90");
          const own = url.searchParams.get("eigenwedstrijden") === "JA";
          requests.push(url.searchParams.get("eigenwedstrijden")!);
          return Response.json([
            { wedstrijdcode: own ? 11 : 21, wedstrijddatum: "2026-08-01", uitslag: "1-0" },
            { wedstrijdcode: own ? 12 : 22, wedstrijddatum: "2026-08-15", uitslag: "1-1" },
            { wedstrijdcode: own ? 13 : 23, wedstrijddatum: "2026-09-05", uitslag: "0-1" }
          ].map((match) => ({
            ...match, thuisteam: own ? "Testclub 1" : "Bezoekers 1",
            thuisteamid: own ? 10 : 20, uitteam: "Bezoekers 2", uitteamid: 30
          })));
        }
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(requests).toEqual(["NEE", "JA"]);
      expect(batch.standings[0]?.rows.map((row) => row.form)).toEqual([
        ["win", "draw", "loss"], ["win", "draw", "loss"], ["draw", "win", "win"]
      ]);
      expect(batch.teams).toEqual([]);
      expect(batch.matches).toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    });

    it.each([
      [[{ team: "Testclub 1", vorm: "WGV" }, { team: "Bezoekers 1", vorm: "VGW" }]],
      [[]]
    ])("avoids extra provider requests for complete provider form or an empty standing: %j", async (rows) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json(rows);
        if (url.pathname === "/pouleuitslagen") throw new Error("unexpected result request");
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings[0]?.rows).toHaveLength(rows.length);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it.each([4001, 4031])("retains the standing when pool results are unavailable (%s)", async (code) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Testclub 1", punten: 6 }]);
        if (url.pathname === "/pouleuitslagen") return Response.json({ error: { code } });
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings[0]?.rows[0]).toMatchObject({ teamName: "Testclub 1", points: 6, form: [] });
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    });

    it.each([4012, 5001])("rejects an incomplete observation on a genuine provider failure (%s)", async (code) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Testclub 1" }]);
        if (url.pathname === "/pouleuitslagen") return Response.json({ error: { code } });
        return Response.json([]);
      });
      await expect(fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job)).rejects.toHaveProperty("code", code === 4012 ? "SPORTLINK_CLIENT_ID_INVALID" : "SPORTLINK_SERVER_ERROR");
    });

    it("keeps equally named teams in different pools separate and rejects explicit conflicting pool rows", async () => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/teams") return Response.json([ownTeam, { ...ownTeam, teamcode: 11, poulecode: 702 }]);
        if (url.pathname === "/poulestand") return Response.json([{ team: "Bezoekers 1" }]);
        if (url.pathname === "/pouleuitslagen" && url.searchParams.get("eigenwedstrijden") === "NEE") {
          const pool = url.searchParams.get("poulecode")!;
          return Response.json([
            { wedstrijdcode: Number(pool), wedstrijddatum: "2026-09-05", thuisteam: "Bezoekers 1", thuisteamid: Number(pool), uitteam: "Bezoekers 2", uitslag: pool === "701" ? "1-0" : "0-1" },
            { wedstrijdcode: 999, wedstrijddatum: "2026-09-12", poulecode: 999, thuisteam: "Bezoekers 1", thuisteamid: 999, uitteam: "Bezoekers 2", uitslag: "1-1" }
          ]);
        }
        return Response.json([]);
      });
      const batch = await fetchSportlinkDataset("competitions", client(fetchImpl as typeof fetch), job);
      expect(batch.standings.map((standing) => standing.rows[0]?.form)).toEqual([["win"], ["loss"]]);
    });
  });

  it("verzamelt beide wedstrijdlogo's voor een immutable snapshot", () => {
    const candidates = collectSportlinkMatchLogoCandidates([{
      awayTeam: {
        externalId: "away",
        logoUrl: "https://provider.test/away.png",
        name: "Uit",
        score: null
      },
      cancellationReason: null,
      competition: null,
      dressingRooms: { away: null, home: null, official: null },
      externalId: "fixture",
      homeTeam: {
        externalId: "home",
        logoUrl: "https://provider.test/home.png",
        name: "Thuis",
        score: null
      },
      isHomeMatch: false,
      officials: [],
      pool: null,
      startsAt: "2026-09-02T18:00:00.000Z",
      status: "scheduled",
      venue: { city: null, field: null, name: null, routeUrl: null }
    }]);
    expect([...candidates]).toEqual([
      ["https://provider.test/home.png", { externalId: "home", teamName: "Thuis" }],
      ["https://provider.test/away.png", { externalId: "away", teamName: "Uit" }]
    ]);
  });

  it("uses both provider team identifiers for birthday enrichment", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/teams") {
        return new Response(JSON.stringify([{
          lokaleteamcode: -1,
          teamcode: 123456,
          teamnaam: "Duindorp 1"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/team-indeling") {
        expect(url.searchParams.get("teamcode")).toBe("123456");
        expect(url.searchParams.get("lokaleteamcode")).toBe("-1");
        expect(url.searchParams.get("toonlidfoto")).toBe("JA");
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      if (url.pathname === "/verjaardagen") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "public_people",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "public_people",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      birthdays: [],
      teamMembers: []
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("normalizes abbreviated provider birthday dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/verjaardagen") {
        return new Response(JSON.stringify([{
          verjaardag: "30 aug",
          volledigenaam: "Testpersoon"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/teams") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(fetchSportlinkDataset(
      "public_people",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "public_people",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    )).resolves.toMatchObject({
      birthdays: [{ day: 30, displayName: "Testpersoon", month: 8 }]
    });
  });

  it("fails closed when provider birthdays cannot be normalized", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/verjaardagen") {
        return new Response(JSON.stringify([{
          verjaardag: "30 onbekend",
          volledigenaam: "Testpersoon"
        }]), { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/teams") {
        return new Response("[]", {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });
    const job = {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "public_people",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn().mockResolvedValue(0);
    const fail = vi.fn().mockResolvedValue(undefined);
    const client = new SportlinkClient("client-id", {
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1
    });

    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job),
        complete,
        fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({
      datasetGroup: "public_people",
      errorCode: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      runId: job.runId,
      status: "failed"
    });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(
      job,
      "worker:sportlink",
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      expect.stringContaining("bestaande verjaardagen blijven behouden")
    );
  });

  it.each([
    ["explicit empty", []],
    ["empty wrapper", { records: [] }],
    ["valid outside window", [{ verjaardag: "20 nov", volledigenaam: "Fixture" }]],
    ["valid expired provider cache", [{ verjaardag: "10 okt", volledigenaam: "Fixture" }]],
    ["mixed valid outside window and invalid", [
      { verjaardag: "20 nov", volledigenaam: "Fixture" },
      { verjaardag: "42 okt", volledigenaam: "Invalid fixture" }
    ]]
  ])("completes a safe empty birthday selection for %s", async (_label, payload) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T10:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(JSON.stringify(url.pathname === "/verjaardagen" ? payload : []), {
        headers: { "content-type": "application/json" }
      });
    });
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "public_people",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn().mockResolvedValue(0);
    const fail = vi.fn();
    const client = new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });
    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job), complete, fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toMatchObject({ status: "completed", readCount: 0 });
    expect(complete).toHaveBeenCalledWith(job, "worker:sportlink", expect.objectContaining({
      birthdays: [], birthdayFetchedAt: "2026-10-11T10:00:00.000Z"
    }));
    expect(fail).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown object", {}],
    ["unrecognized null", null],
    ["invalid entries", ["unknown"]],
    ["completely invalid dates", [{ verjaardag: "42 okt", volledigenaam: "Fixture" }]]
  ])("preserves last-known-good birthdays for %s", async (_label, payload) => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(JSON.stringify(url.pathname === "/verjaardagen" ? payload : []), {
        headers: { "content-type": "application/json" }
      });
    });
    const client = new SportlinkClient("test-client", { fetchImpl, maxAttempts: 1 });
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "public_people",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const complete = vi.fn();
    const fail = vi.fn().mockResolvedValue(undefined);
    await expect(runSportlinkSyncOnce({
      backend: {
        claim: vi.fn().mockResolvedValue(job), complete, fail,
        renew: vi.fn().mockResolvedValue(true)
      },
      encryptionKey: "x".repeat(32),
      executeDataset: () => fetchSportlinkDataset("public_people", client, job),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toMatchObject({
      status: "failed", errorCode: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY"
    });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(job, "worker:sportlink",
      "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY", expect.stringContaining("bestaande verjaardagen"));
  });

  it("derives bounded club pools without an incomplete team-pool request", () => {
    expect(collectSportlinkPoolIds(
      [
        { poulecode: 90, teamcode: 10, teamnaam: "Club 1" },
        { poulecode: null, teamcode: 11, teamnaam: "Club 2" },
        { poulecode: 90, teamcode: 12, teamnaam: "Club 3" }
      ],
      [
        { poulecode: 91, teamcode: 11 },
        { poulecode: 92, teamcode: 999 }
      ]
    )).toEqual(["90", "91"]);
  });

  it("matches pool rows through a positive local team code", () => {
    expect(collectSportlinkPoolIds(
      [{ lokaleteamcode: 44, teamcode: -1, teamnaam: "Club 4" }],
      [
        { lokaleteamcode: -1, poulecode: 93, teamcode: -1 },
        { lokaleteamcode: 44, poulecode: 94, teamcode: -1 }
      ]
    )).toEqual(["94"]);
  });

  it("includes all 32 club pools, including youth teams beyond the former limit", () => {
    const teams = Array.from({ length: 32 }, (_, index) => ({
      teamcode: index + 1, teamnaam: `Vereniging team ${index + 1}`
    }));
    const pools = teams.map((team, index) => ({ ...team, poulecode: index + 100 }));
    const result = collectSportlinkPoolIds(teams, [
      ...pools, ...pools, { teamcode: 999, poulecode: 999 }
    ]);
    expect(result).toHaveLength(32);
    expect(result.slice(24)).toEqual(["124", "125", "126", "127", "128", "129", "130", "131"]);
  });

  it("fails explicitly instead of silently publishing an incomplete catalogue", () => {
    const teams = Array.from({ length: 129 }, (_, index) => ({
      teamcode: index + 1, poulecode: index + 100
    }));
    expect(() => collectSportlinkPoolIds(teams, [])).toThrow(
      expect.objectContaining({ code: "SPORTLINK_POOL_LIMIT_EXCEEDED" })
    );
    expect(() => collectSportlinkPoolIds(teams.slice(0, 3), [], 2)).toThrow(
      expect.objectContaining({ code: "SPORTLINK_POOL_LIMIT_EXCEEDED" })
    );
  });

  it("resolves cup and league by exact fixture phase rather than catalogue order", () => {
    const teams = [{ teamcode: 10, teamnaam: "Vereniging 1" }];
    const pools = [
      { teamcode: 10, poulecode: 701, poule: "A", fase: "Beker" },
      { teamcode: 10, poulecode: 702, poule: "B", fase: "Competitie" }
    ];
    const matches = mapSportlinkMatches([{
      wedstrijdcode: 11, thuisteamid: 10, thuisteam: "Vereniging 1",
      uitteamid: 20, uitteam: "Bezoekers", wedstrijddatum: "2026-09-12",
      aanvangstijd: "14:00", fase: "Beker"
    }]);
    for (const catalogue of [pools, [...pools].reverse()]) {
      expect(enrichSportlinkOwnMatchesWithPoolContexts(matches, teams, catalogue)[0])
        .toMatchObject({ pool: { externalId: "701" } });
    }
    const withoutPhase = matches.map((match) => ({ ...match, competition: null }));
    expect(enrichSportlinkOwnMatchesWithPoolContexts(withoutPhase, teams, pools)[0]?.pool).toBeNull();
  });

  it("preserves authoritative pool rows when an own fixture has only a derived ambiguous pool", () => {
    const teams = [{ teamcode: 10, teamnaam: "Vereniging 1" }];
    const pools = [
      { teamcode: 10, poulecode: 701, poule: "A" },
      { teamcode: 10, poulecode: 702, poule: "B" }
    ];
    const matches = mapSportlinkMatches([{
      wedstrijdcode: 11, thuisteamid: 10, thuisteam: "Vereniging 1",
      uitteamid: 20, uitteam: "Bezoekers", wedstrijddatum: "2026-09-12",
      aanvangstijd: "14:00", poule: "Fixture label"
    }]);
    const context = collectSportlinkPoolContexts(teams, pools)[0]!;
    const authoritative = enrichSportlinkPoolMatches(matches, context);
    const own = enrichSportlinkOwnMatchesWithPoolContexts(matches, teams, pools);
    expect(own[0]?.pool).toBeNull();
    expect(dedupeSportlinkMatches([...authoritative, ...own])[0]?.pool).toMatchObject({
      externalId: "701", competitionExternalId: context.competition?.externalId
    });
    const explicit = matches.map((match) => ({
      ...match, pool: { externalId: "701", name: "A", competitionExternalId: "fixture-hash" }
    }));
    expect(enrichSportlinkOwnMatchesWithPoolContexts(explicit, teams, pools)[0]?.pool)
      .toMatchObject({ competitionExternalId: context.competition?.externalId });
  });

  it("keeps competition and season with every standings context", () => {
    expect(collectSportlinkPoolContexts(
      [{
        competitie: "Vierde klasse",
        poule: "4C",
        poulecode: 701,
        seizoen: "2026/2027",
        teamcode: 10
      }],
      []
    )).toEqual([{
      competition: expect.objectContaining({
        name: "Vierde klasse",
        season: "2026/2027"
      }),
      poolExternalId: "701",
      poolName: "4C"
    }]);
  });

  it("marks every pool fixture with the requested pool context", () => {
    const context = collectSportlinkPoolContexts([{
      competitie: "Vierde klasse", poule: "4C", poulecode: 701, teamcode: 10,
      fase: "Beker", seizoen: "2026/2027"
    }], [])[0]!;
    const match = {
      awayTeam: { externalId: "away", logoUrl: null, name: "Uit", score: null },
      cancellationReason: null, competition: null,
      dressingRooms: { away: null, home: null, official: null }, externalId: "match-1",
      homeTeam: { externalId: "home", logoUrl: null, name: "Thuis", score: null },
      isHomeMatch: false, officials: [], pool: null,
      startsAt: "2026-08-23T12:00:00.000Z", status: "scheduled" as const,
      venue: { city: null, field: null, name: null, routeUrl: null }
    };
    expect(enrichSportlinkPoolMatches([match], context)[0]).toMatchObject({
      pool: { externalId: "701", name: "4C" },
      competition: { name: "Vierde klasse" }
    });
    expect(enrichSportlinkPoolMatches([{
      ...match,
      competition: { externalId: "fixture-label", name: "Fixture label", period: null, season: null, type: null }
    }], context)[0]?.competition).toMatchObject({
      name: "Fixture label", period: "Beker", season: "2026/2027"
    });
  });

  it("combines home, away and other pool fixtures without losing pool metadata", async () => {
    const poolRequests: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/teams") {
        return Response.json([{
          competitie: "Vierde klasse",
          poule: "4C",
          poulecode: 701,
          teamcode: 10,
          teamnaam: "Duindorp 1"
        }]);
      }
      if (url.pathname === "/uitslagen") {
        return Response.json([{
          aanvangstijd: "14:30",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Vereniging Uit 1",
          uitslag: "2-1",
          wedstrijddatum: "2026-08-29",
          wedstrijdcode: 7002
        }]);
      }
      if (url.pathname === "/programma") {
        return Response.json([{
          aanvangstijd: "14:30",
          teamvolgorde: "thuis",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Bezoekers 1",
          uitteamid: 30,
          veld: "Veld 1",
          wedstrijddatum: "2026-09-06",
          wedstrijdcode: 7004
        }]);
      }
      if (url.pathname === "/poule-programma" || url.pathname === "/pouleuitslagen") {
        poolRequests.push(`${url.pathname}:${url.searchParams.get("eigenwedstrijden")}`);
        expect(url.searchParams.get("aantaldagen")).toBe("14");
        const own = url.searchParams.get("eigenwedstrijden") === "JA";
        if (url.pathname === "/poule-programma") {
          return Response.json([own ? {
            aanvangstijd: "12:00",
            teamvolgorde: "uit",
            thuisteam: "Pouleclub 3",
            thuisteamid: 40,
            uitteam: "Duindorp 1",
            uitteamid: 10,
            wedstrijddatum: "2026-09-07",
            wedstrijdcode: 7003
          } : {
            aanvangstijd: "14:30",
            thuisteam: "Pouleclub 1",
            thuisteamid: 20,
            uitteam: "Pouleclub 2",
            uitteamid: 21,
            wedstrijddatum: "2026-09-06",
            wedstrijdcode: 7001
          }]);
        }
        return Response.json([own ? {
          aanvangstijd: "14:30",
          teamvolgorde: "thuis",
          thuisteam: "Duindorp 1",
          thuisteamid: 10,
          uitteam: "Vereniging Uit 1",
          uitteamid: 50,
          uitslag: "2-1",
          wedstrijddatum: "2026-08-29",
          wedstrijdcode: 7002
        } : {
          aanvangstijd: "11:00",
          thuisteam: "Pouleclub 5",
          uitteam: "Pouleclub 6",
          uitslag: "1-1",
          wedstrijddatum: "2026-08-30",
          wedstrijdcode: 7005
        }]);
      }
      return Response.json([]);
    });

    const batch = await fetchSportlinkDataset(
      "matches",
      new SportlinkClient("client-id", {
        fetchImpl: fetchImpl as typeof fetch,
        maxAttempts: 1
      }),
      {
        connectionId: "20000000-0000-4000-8000-000000000001",
        dataSourceId: "30000000-0000-4000-8000-000000000001",
        datasetGroup: "matches",
        encryptedClientId: "ciphertext",
        encryptionIv: "initialization",
        encryptionTag: "authentication",
        runId: "40000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000001",
        timezone: "Europe/Amsterdam"
      }
    );

    expect(poolRequests).toEqual([
      "/poule-programma:NEE",
      "/poule-programma:JA",
      "/pouleuitslagen:NEE",
      "/pouleuitslagen:JA"
    ]);
    expect(batch.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: "7001",
        pool: expect.objectContaining({ externalId: "701" }),
        status: "scheduled"
      }),
      expect.objectContaining({
        externalId: "7002",
        homeTeam: expect.objectContaining({ score: 2 }),
        isHomeMatch: true,
        pool: expect.objectContaining({ externalId: "701" }),
        status: "finished"
      }),
      expect.objectContaining({
        externalId: "7003",
        isHomeMatch: false,
        pool: expect.objectContaining({ externalId: "701" })
      }),
      expect.objectContaining({
        externalId: "7004",
        isHomeMatch: true,
        pool: expect.objectContaining({ externalId: "701" })
      }),
      expect.objectContaining({
        externalId: "7005",
        pool: expect.objectContaining({ externalId: "701" }),
        status: "finished"
      })
    ]));
    expect(batch.matches.filter((match) => match.externalId === "7002"))
      .toHaveLength(1);
  });

  it("claims a command once and reports missing encryption configuration safely", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          connection_id: "20000000-0000-4000-8000-000000000001",
          data_source_id: "30000000-0000-4000-8000-000000000001",
          dataset_group: "matches",
          encrypted_client_id: "ciphertext",
          encryption_iv: "initialization",
          encryption_tag: "authentication",
          run_id: "40000000-0000-4000-8000-000000000001",
          tenant_id: "10000000-0000-4000-8000-000000000001",
          timezone: "Europe/Amsterdam"
        }],
        error: null
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: null,
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({
      datasetGroup: "matches",
      errorCode: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      runId: "40000000-0000-4000-8000-000000000001",
      status: "failed"
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: 900,
      p_worker_id: "worker:sportlink"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "fail_sportlink_sync_v1", {
      p_error_code: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      p_error_detail: "De serverconfiguratie voor Sportlink-synchronisatie ontbreekt.",
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });
  });

  it("does not execute anything when no dataset is due", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a safe retryable failure when the claim RPC is unavailable", async () => {
    const claim = vi.fn().mockRejectedValue(new Error("private provider URL and token"));
    const fail = vi.fn();
    await expect(runSportlinkSyncOnce({
      backend: { claim, complete: vi.fn(), fail, renew: vi.fn() },
      encryptionKey: "x".repeat(32), lockTimeoutSeconds: 900, workerId: "worker:test"
    })).resolves.toEqual({ status: "failed", errorCode: "SPORTLINK_SYNC_CLAIM_FAILED" });
    expect(fail).not.toHaveBeenCalled();
  });

  it("aborts an unresponsive Supabase claim at the transport deadline", async () => {
    let requestSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init?.signal;
      requestSignal?.addEventListener("abort", () => reject(new DOMException("Request timed out", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", undefined, 10);
    await expect(runSportlinkSyncOnce({
      backend, encryptionKey: "x".repeat(32), lockTimeoutSeconds: 900, workerId: "worker:test"
    })).resolves.toEqual({ status: "failed", errorCode: "SPORTLINK_SYNC_CLAIM_FAILED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("recovers from claim outages with bounded backoff and an immediate abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const claim = vi.fn().mockRejectedValue(new Error("database timeout"));
    const onResult = vi.fn();
    const execution = runSportlinkSyncLoop({
      backend: { claim, complete: vi.fn(), fail: vi.fn(), renew: vi.fn() },
      encryptionKey: "x".repeat(32), intervalMs: 15_000,
      lockTimeoutSeconds: 900, onResult, signal: controller.signal, workerId: "worker:test"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(claim).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(claim).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(claim).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(claim).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(claim).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(claim).toHaveBeenCalledTimes(4);
    claim.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(claim).toHaveBeenCalledTimes(5);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    controller.abort();
    await expect(execution).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues dispatching when recording a dataset failure is unavailable", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "matches",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null);
    const fail = vi.fn().mockRejectedValue(new Error("database unavailable during failure recording"));
    const onResult = vi.fn((result: { status: string }) => {
      if (result.status === "idle") controller.abort();
    });
    const execution = runSportlinkSyncLoop({
      backend: { claim, complete: vi.fn(), fail, renew: vi.fn() },
      encryptionKey: null, intervalMs: 1_000, lockTimeoutSeconds: 900,
      onResult, signal: controller.signal, workerId: "worker:test"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fail).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed", errorCode: "SPORTLINK_CONFIGURATION_UNAVAILABLE", runId: job.runId
    }));
    expect(claim).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(execution).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["23505", "SPORTLINK_SYNC_COMPLETE_23505"],
    ["57014", "SPORTLINK_SYNC_COMPLETE_57014"],
    ["PGRST003", "SPORTLINK_SYNC_COMPLETE_PGRST003"],
    ["PGRST202", "SPORTLINK_SYNC_COMPLETE_PGRST202"],
    ["PGRST301", "SPORTLINK_SYNC_COMPLETE_PGRST301"],
    ["KEY12", "SPORTLINK_SYNC_COMPLETE_RPC_FAILED"],
    ["unexpected\nprivate details", "SPORTLINK_SYNC_COMPLETE_RPC_FAILED"]
  ])("retains a bounded completion diagnostic for %s without raw errors", async (code, expectedCode) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code } });
    const backend = new SupabaseSportlinkSyncBackend("https://project.supabase.co", "test-only", { rpc });
    await expect(backend.complete({
      connectionId: "connection", dataSourceId: "source", datasetGroup: "competitions",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    }, "worker:test", {
      activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: []
    })).rejects.toMatchObject({
      code: expectedCode,
      message: "Sportlink-gegevens zijn opgehaald maar konden niet worden verwerkt. De bestaande gegevens blijven behouden; controleer de synchronisatiediagnose."
    });
  });

  describe("completion diagnostics through the real PostgREST client", () => {
    const job = {
      connectionId: "connection", dataSourceId: "source", datasetGroup: "matches",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    };
    const batch = {
      activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: []
    };

    it("reports a fetch deadline as transport failure rather than an invalid success body", async () => {
      let requestSignal: AbortSignal | null | undefined;
      const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        requestSignal = init?.signal;
        requestSignal?.addEventListener("abort", () => reject(new DOMException("PRIVATE_PROVIDER_TOKEN", "TimeoutError")), { once: true });
      }));
      vi.stubGlobal("fetch", fetchMock);
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", undefined, 10);
      await expect(backend.complete(job, "worker:test", batch)).rejects.toMatchObject({
        code: "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED"
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(requestSignal?.aborted).toBe(true);
    });

    it("records a safe failed run when the SDK turns a network rejection into status zero", async () => {
      const fetchMock = vi.fn().mockRejectedValue(Object.assign(new TypeError("PRIVATE_PROVIDER_URL"), {
        cause: { code: "PRIVATE_TOKEN", message: "PRIVATE_CONNECTION_STRING" }
      }));
      vi.stubGlobal("fetch", fetchMock);
      const completion = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const fail = vi.fn();
      const result = await runSportlinkSyncOnce({
        backend: {
          claim: vi.fn().mockResolvedValue(job),
          complete: completion.complete.bind(completion),
          fail,
          renew: vi.fn().mockResolvedValue(true)
        },
        encryptionKey: "x".repeat(32), executeDataset: async () => batch,
        lockTimeoutSeconds: 900, workerId: "worker:test"
      });
      expect(result).toEqual({
        status: "failed", datasetGroup: "matches", runId: "run",
        errorCode: "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED"
      });
      expect(fail).toHaveBeenCalledWith(job, "worker:test", "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED", expect.any(String));
      expect(JSON.stringify([result, fail.mock.calls])).not.toContain("PRIVATE_");
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each([
      [504, "PGRST003", "SPORTLINK_SYNC_COMPLETE_PGRST003"],
      [404, "PGRST202", "SPORTLINK_SYNC_COMPLETE_PGRST202"],
      [500, "57014", "SPORTLINK_SYNC_COMPLETE_57014"],
      [500, "KEY12", "SPORTLINK_SYNC_COMPLETE_RPC_FAILED"]
    ])("keeps reviewed upstream codes from an actual HTTP %s response", async (status, code, expectedCode) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
        code, message: "PRIVATE_CONNECTION_STRING", details: "PRIVATE_PROVIDER_PAYLOAD", hint: "PRIVATE_TOKEN"
      }), { status, headers: { "Content-Type": "application/json" } })));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const failure = await backend.complete(job, "worker:test", batch).catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: expectedCode });
      expect(JSON.stringify(failure)).not.toContain("PRIVATE_");
    });

    it.each([
      ["57014", "canceling statement due to statement timeout", "SPORTLINK_SYNC_COMPLETE_57014_STATEMENT_TIMEOUT"],
      ["57014", "canceling statement due to user request", "SPORTLINK_SYNC_COMPLETE_57014_USER_REQUEST"],
      ["57014", "canceling statement due to statement timeout PRIVATE_TOKEN", "SPORTLINK_SYNC_COMPLETE_57014"],
      ["57014", "PRIVATE_CONNECTION_STRING", "SPORTLINK_SYNC_COMPLETE_57014"],
      ["42501", "canceling statement due to statement timeout", "SPORTLINK_SYNC_COMPLETE_42501"],
      ["KEY12", "canceling statement due to user request", "SPORTLINK_SYNC_COMPLETE_RPC_FAILED"]
    ])("persists only the exact reviewed cancellation reason for %s / %s", async (code, message, expectedCode) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        code, message, details: "PRIVATE_PROVIDER_PAYLOAD", hint: "PRIVATE_CONNECTION_STRING"
      }), { status: 500, headers: { "Content-Type": "application/json" } }));
      vi.stubGlobal("fetch", fetchMock);
      const completion = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const fail = vi.fn();
      const result = await runSportlinkSyncOnce({
        backend: {
          claim: vi.fn().mockResolvedValue(job), complete: completion.complete.bind(completion),
          fail, renew: vi.fn().mockResolvedValue(true)
        },
        encryptionKey: "x".repeat(32), executeDataset: async () => batch,
        lockTimeoutSeconds: 900, workerId: "worker:test"
      });
      expect(result).toEqual({ status: "failed", datasetGroup: "matches", runId: "run", errorCode: expectedCode });
      expect(fail).toHaveBeenCalledWith(job, "worker:test", expectedCode, expect.any(String));
      expect(JSON.stringify([result, fail.mock.calls])).not.toContain("PRIVATE_");
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("keeps a status-zero cancellation-shaped SDK error classified as transport failure", async () => {
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", {
        rpc: vi.fn().mockResolvedValue({ data: null, error: {
          code: "57014", message: "canceling statement due to statement timeout"
        }, status: 0 })
      });
      await expect(backend.complete(job, "worker:test", batch)).rejects.toMatchObject({
        code: "SPORTLINK_SYNC_COMPLETE_TRANSPORT_FAILED"
      });
    });

    it.each([null, [], "PRIVATE_PAYLOAD", 5])("rejects a malformed successful response without calling it a transport failure (%j)", async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
        status: 200, headers: { "Content-Type": "application/json" }
      })));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete(job, "worker:test", batch)).rejects.toMatchObject({
        code: "SPORTLINK_SYNC_COMPLETE_INVALID_RESULT"
      });
    });

    it("rejects an invalid successful read count with the safe response diagnostic", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ readCount: "PRIVATE_PAYLOAD" }), {
        status: 200, headers: { "Content-Type": "application/json" }
      })));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete(job, "worker:test", batch)).rejects.toMatchObject({
        code: "SPORTLINK_SYNC_COMPLETE_INVALID_RESULT"
      });
    });

    it("ignores a fabricated status and sensitive error code", async () => {
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PRIVATE_TOKEN" }, status: "0\nPRIVATE_TOKEN" })
      });
      const failure = await backend.complete(job, "worker:test", batch).catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: "SPORTLINK_SYNC_COMPLETE_RPC_FAILED" });
      expect(JSON.stringify(failure)).not.toContain("PRIVATE_");
    });
  });

  describe("optional media resilience through the real Supabase client", () => {
    type Batch = Parameters<SupabaseSportlinkSyncBackend["complete"]>[2];
    const job = {
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions", encryptedClientId: "unused",
      encryptionIv: "unused", encryptionTag: "unused",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
    };
    const logo = (externalId: string, number: number): SportlinkTeamLogoArtifact => ({
      assetId: `50000000-0000-5000-8000-${String(number).padStart(12, "0")}`,
      bytes: logoBytes, checksumSha256: logoChecksum,
      externalId, fileSizeBytes: logoBytes.length, height: 64, mimeType: "image/webp",
      role: "team_logo", sourceUrl: "https://provider.test/PRIVATE_SOURCE",
      storagePath: `providers/sportlink/team_logo/${logoChecksum}.webp`,
      title: "PRIVATE_TEAM_NAME", width: 64
    });
    const batch = (count = 3): Batch => ({
      activities: [{
        allDay: false, calendarName: null, endsAt: null, externalId: "activity-1",
        location: null, name: "Training", startsAt: "2026-10-12T18:00:00Z", url: null
      }], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: mapSportlinkMatches([{
        wedstrijdcode: "match-1", wedstrijddatum: "2026-10-12T15:00:00Z",
        thuisteam: "Thuis", thuisteamid: "team-1", uitteam: "Uit", uitteamid: "team-2"
      }]), personPhotos: [], standings: [{
        competition: null, externalId: "standing-1", periodNumber: null,
        pool: { competitionExternalId: null, externalId: "pool-1", name: "Poule 1" },
        rows: Array.from({ length: count }, (_, index) => ({
          drawn: 1, externalId: `team-${index + 1}`, form: ["win", "draw", "loss"],
          goalsAgainst: 3, goalsFor: 6, lost: 1, played: 4, points: 7,
          position: index + 1, teamName: `Ploeg ${index + 1}`, won: 2
        })), scoresPublished: true
      }], teamMembers: [],
      teamLogos: Array.from({ length: count }, (_, index) => logo(`team-${index + 1}`, index + 1)),
      teams: []
    });
    const cached = (externalId: string, number: number) => {
      const id = `60000000-0000-5000-8000-${String(number).padStart(12, "0")}`;
      const cacheId = `70000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
      return {
        id: cacheId, provider: "sportlink", entity_type: "team", external_entity_id: externalId,
        asset_role: "team_logo", current_version_id: id,
        version: {
          id, cache_id: cacheId, checksum_sha256: "f".repeat(64), storage_bucket: "provider-assets",
          storage_path: `providers/sportlink/team_logo/${"f".repeat(64)}.webp`,
          mime_type: "image/webp", file_size_bytes: 3, width: 64, height: 64
        }
      };
    };
    const warnings = () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((line) => {
        lines.push(String(line));
        return true;
      });
      return () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    };
    const storageFailure = () => Response.json({
      statusCode: "503", error: "PRIVATE_TOKEN", message: "PRIVATE_STORAGE_PATH"
    }, { status: 503 });
    const awaitAbort = (signal: AbortSignal | null | undefined) => new Promise<Response>((_resolve, reject) => {
      const rejectAbort = () => reject(new DOMException("PRIVATE_PROVIDER_TOKEN", "TimeoutError"));
      if (signal?.aborted) rejectAbort();
      else signal?.addEventListener("abort", rejectAbort, { once: true });
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it("commits current data, reuses validated team versions and stops later uploads after one failure", async () => {
      const readWarnings = warnings();
      const current = batch();
      expect(current.matches).toHaveLength(1);
      Object.assign(current.standings[0]!.rows[2]!, { logoMediaAssetId: current.teamLogos[2]!.assetId });
      const payloads: Record<string, unknown>[] = [];
      const requests: URL[] = [];
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        requests.push(url);
        if (url.pathname.startsWith("/storage/v1/object/")) return storageFailure();
        if (url.pathname === "/rest/v1/provider_asset_cache") {
          expect(url.searchParams.get("provider")).toBe("eq.sportlink");
          expect(url.searchParams.get("entity_type")).toBe("eq.team");
          expect(url.searchParams.get("asset_role")).toBe("eq.team_logo");
          expect(url.searchParams.get("external_entity_id")).toBe("in.(team-1,team-2,team-3)");
          expect(url.searchParams.get("limit")).toBe("100");
          expect(url.searchParams.get("select")).toContain("provider_asset_versions!provider_asset_cache_current_version_fk");
          return Response.json([cached("team-1", 1), cached("team-2", 2)]);
        }
        expect(url.pathname).toBe("/rest/v1/rpc/complete_sportlink_sync_v4");
        payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json({ readCount: 5 });
      });
      vi.stubGlobal("fetch", fetchMock);
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete(job, "worker:test", current)).resolves.toBe(5);
      expect(requests.map((url) => url.pathname)).toEqual([
        `/storage/v1/object/provider-assets/${current.teamLogos[0]!.storagePath}`,
        "/rest/v1/provider_asset_cache", "/rest/v1/rpc/complete_sportlink_sync_v4"
      ]);
      expect(payloads[0]).toMatchObject({
        p_activities: current.activities, p_matches: current.matches, p_club_logo: {}, p_team_logos: [],
        p_run_id: job.runId, p_worker_id: "worker:test"
      });
      const rows = (payloads[0]!.p_standings as Array<{ rows: Record<string, unknown>[] }>)[0]!.rows;
      expect(rows.map((row) => row.logoMediaAssetId)).toEqual([
        cached("team-1", 1).version.id, cached("team-2", 2).version.id, undefined
      ]);
      expect(rows.map((row) => [row.points, row.form])).toEqual(current.standings[0]!.rows.map((row) => [row.points, row.form]));
      expect(readWarnings()).toEqual([expect.objectContaining({
        event: "sportlink.sync.completed", level: "warn", fields: {
          outcome: "completed_with_optional_media_warning", errorCode: "SPORTLINK_MEDIA_PARTIAL",
          failedLogos: 1, skippedLogos: 2, reusedTeamLogos: 2, cacheLookupFailed: false
        }
      })]);
      expect(JSON.stringify(readWarnings())).not.toMatch(/PRIVATE_|providers\/|team-[123]/);
    });

    it.each(["transport", "deadline"])("bounds a %s storage failure to one upload even with 100 optional logos", async (failure) => {
      const readWarnings = warnings();
      const current = batch(100);
      let uploads = 0;
      let uploadSignal: AbortSignal | null | undefined;
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) {
          uploads++;
          uploadSignal = init?.signal;
          if (failure === "deadline") return awaitAbort(uploadSignal);
          throw new TypeError("PRIVATE_CONNECTION_STRING");
        }
        if (url.pathname === "/rest/v1/provider_asset_cache") return Response.json([]);
        expect(url.pathname).toBe("/rest/v1/rpc/complete_sportlink_sync_v4");
        const payload = JSON.parse(String(init?.body));
        expect(payload.p_team_logos).toEqual([]);
        expect(payload.p_standings[0].rows).toHaveLength(100);
        return Response.json({ readCount: 100 });
      });
      vi.stubGlobal("fetch", fetchMock);
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", undefined, 10);
      await expect(backend.complete(job, "worker:test", current)).resolves.toBe(100);
      expect(uploads).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      if (failure === "deadline") expect(uploadSignal?.aborted).toBe(true);
      expect(readWarnings()[0]).toMatchObject({ fields: { failedLogos: 1, skippedLogos: 99 } });
      expect(JSON.stringify(readWarnings())).not.toContain("PRIVATE_");
    });

    it("submits successfully stored logos while omitting later failed and skipped new versions", async () => {
      const readWarnings = warnings();
      const current = batch();
      const differentBytes = new Uint8Array(await sharp({
        create: { background: "#abcdef", channels: 4, height: 64, width: 64 }
      }).webp().toBuffer());
      const differentChecksum = createHash("sha256").update(differentBytes).digest("hex");
      for (const logo of current.teamLogos.slice(1)) Object.assign(logo, {
        bytes: differentBytes, checksumSha256: differentChecksum, fileSizeBytes: differentBytes.length,
        storagePath: `providers/sportlink/team_logo/${differentChecksum}.webp`
      });
      let uploads = 0;
      let payload: Record<string, unknown> | undefined;
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) {
          if (init?.method === "GET") return Response.json({ message: "not found" }, { status: 404 });
          return ++uploads === 1 ? Response.json({ Id: "stored", Key: "stored" }) : storageFailure();
        }
        if (url.pathname === "/rest/v1/provider_asset_cache") {
          expect(url.searchParams.get("external_entity_id")).toBe("in.(team-2,team-3)");
          return Response.json([cached("team-2", 2)]);
        }
        payload = JSON.parse(String(init?.body));
        return Response.json({ readCount: 3 });
      }));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete(job, "worker:test", current)).resolves.toBe(3);
      expect(uploads).toBe(2);
      expect(payload?.p_team_logos).toEqual([expect.objectContaining({ assetId: current.teamLogos[0]!.assetId })]);
      expect(JSON.stringify(payload)).not.toContain(current.teamLogos[1]!.assetId);
      expect(JSON.stringify(payload)).not.toContain(current.teamLogos[2]!.assetId);
      expect(readWarnings()[0]).toMatchObject({ fields: { failedLogos: 1, skippedLogos: 1, reusedTeamLogos: 1 } });
    });

    it("retains club data without replacing its existing logo when the optional upload fails", async () => {
      const readWarnings = warnings();
      const current = batch(0);
      current.club = {
        city: "Den Haag", clubCode: "CLUB", colors: { primary: null, secondary: null, text: null },
        externalId: "club-1", foundedOn: null, information: null, logoUrl: null,
        name: "Testclub", websiteUrl: null
      };
      current.clubLogo = {
        ...logo("club-1", 1), role: "club_logo",
        storagePath: `providers/sportlink/club_logo/${logoChecksum}.webp`
      };
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) return storageFailure();
        expect(url.pathname).toBe("/rest/v1/rpc/complete_sportlink_sync_v4");
        expect(JSON.parse(String(init?.body))).toMatchObject({ p_club: current.club, p_club_logo: {}, p_team_logos: [] });
        return Response.json({ readCount: 1 });
      });
      vi.stubGlobal("fetch", fetchMock);
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete({ ...job, datasetGroup: "club_profile" }, "worker:test", current)).resolves.toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(readWarnings()[0]).toMatchObject({ fields: { failedLogos: 1, skippedLogos: 0 } });
    });

    it.each(["wrong_role", "foreign_identity", "wrong_cache", "dangling_version", "invalid_path", "duplicate"])("falls back safely for a %s canonical cache response", async (invalid) => {
      const readWarnings = warnings();
      const current = batch();
      const entry = cached("team-1", 1);
      const bad = invalid === "wrong_role" ? { ...entry, asset_role: "person_photo" }
        : invalid === "foreign_identity" ? { ...entry, external_entity_id: "other-team" }
          : invalid === "wrong_cache" ? { ...entry, version: { ...entry.version, cache_id: "70000000-0000-4000-8000-000000000009" } }
            : invalid === "dangling_version" ? { ...entry, current_version_id: "70000000-0000-5000-8000-000000000001" }
              : invalid === "invalid_path" ? { ...entry, version: { ...entry.version, storage_path: "tenants/PRIVATE_TENANT/photo.webp" } }
                : entry;
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) return storageFailure();
        if (url.pathname === "/rest/v1/provider_asset_cache") return Response.json(invalid === "duplicate" ? [bad, bad] : [bad]);
        const payload = JSON.parse(String(init?.body));
        expect(payload.p_standings[0].rows.every((row: Record<string, unknown>) => !row.logoMediaAssetId)).toBe(true);
        expect(payload.p_team_logos).toEqual([]);
        return Response.json({ readCount: 3 });
      }));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      await expect(backend.complete(job, "worker:test", current)).resolves.toBe(3);
      expect(readWarnings()[0]).toMatchObject({ fields: { reusedTeamLogos: 0, cacheLookupFailed: true } });
      expect(JSON.stringify(readWarnings())).not.toContain("PRIVATE_");
    });

    it("bounds a failed cache lookup and still completes with the initials fallback", async () => {
      const readWarnings = warnings();
      let cacheSignal: AbortSignal | null | undefined;
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) return storageFailure();
        if (url.pathname === "/rest/v1/provider_asset_cache") {
          cacheSignal = init?.signal;
          return awaitAbort(cacheSignal);
        }
        expect(JSON.parse(String(init?.body)).p_team_logos).toEqual([]);
        return Response.json({ readCount: 3 });
      });
      vi.stubGlobal("fetch", fetchMock);
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", undefined, 10);
      await expect(backend.complete(job, "worker:test", batch())).resolves.toBe(3);
      expect(cacheSignal?.aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(readWarnings()[0]).toMatchObject({ fields: { cacheLookupFailed: true, reusedTeamLogos: 0 } });
    });

    it.each(["57014", "55000"])("keeps a genuine ingest/ownership failure %s failed and emits no committed-media warning", async (code) => {
      const readWarnings = warnings();
      const current = batch();
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.startsWith("/storage/v1/object/")) return storageFailure();
        if (url.pathname === "/rest/v1/provider_asset_cache") return Response.json([]);
        return Response.json({ code, message: "PRIVATE_SQL_MESSAGE" }, { status: 500 });
      }));
      const completion = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const fail = vi.fn();
      await expect(runSportlinkSyncOnce({
        backend: {
          claim: vi.fn().mockResolvedValue(job), complete: completion.complete.bind(completion),
          fail, renew: vi.fn().mockResolvedValue(true)
        }, encryptionKey: "x".repeat(32), executeDataset: async () => current,
        lockTimeoutSeconds: 900, workerId: "worker:test"
      })).resolves.toEqual({ status: "failed", datasetGroup: "competitions", runId: job.runId, errorCode: `SPORTLINK_SYNC_COMPLETE_${code}` });
      expect(fail).toHaveBeenCalledWith(job, "worker:test", `SPORTLINK_SYNC_COMPLETE_${code}`, expect.any(String));
      expect(readWarnings()).toEqual([]);
      expect(JSON.stringify(fail.mock.calls)).not.toContain("PRIVATE_");
    });

    it("does not start uploads or ingest after losing its lease during the provider observation", async () => {
      vi.useFakeTimers();
      const readWarnings = warnings();
      let finishObservation: ((value: Batch) => void) | undefined;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const completion = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const fail = vi.fn();
      const execution = runSportlinkSyncOnce({
        backend: {
          claim: vi.fn().mockResolvedValue(job), complete: completion.complete.bind(completion),
          fail, renew: vi.fn().mockResolvedValue(false)
        }, encryptionKey: "x".repeat(32),
        executeDataset: () => new Promise<Batch>((resolve) => { finishObservation = resolve; }),
        lockTimeoutSeconds: 900, workerId: "worker:test"
      });
      await vi.advanceTimersByTimeAsync(60_000);
      finishObservation!(batch());
      await expect(execution).resolves.toEqual({
        status: "failed", datasetGroup: "competitions", runId: job.runId, errorCode: "SPORTLINK_WORKER_LEASE_LOST"
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(readWarnings()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([false, true])("keeps person-photo storage fail-closed and submits pointers only after successful upload (%s)", async (succeeds) => {
      const readWarnings = warnings();
      const current = batch(0);
      current.personPhotos = [{
        ...logo("b".repeat(64), 1), role: "person_photo",
        storagePath: `providers/sportlink/person_photo/${"a".repeat(64)}.webp`
      }];
      current.teamMembers = [{ identityKey: "b".repeat(64), photoProviderAssetVersionId: current.personPhotos[0]!.assetId }];
      const requests: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        requests.push(url.pathname);
        if (url.pathname.startsWith("/storage/v1/object/")) return succeeds ? Response.json({ Id: "stored", Key: "stored" }) : storageFailure();
        expect(url.pathname).toBe("/rest/v1/rpc/complete_sportlink_birthdays_v1");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          p_person_photos: [expect.objectContaining({ assetId: current.personPhotos[0]!.assetId, role: "person_photo" })],
          p_team_members: current.teamMembers
        });
        return Response.json({ readCount: 1 });
      }));
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only");
      const completion = backend.complete({ ...job, datasetGroup: "public_people" }, "worker:test", current);
      if (succeeds) await expect(completion).resolves.toBe(1);
      else await expect(completion).rejects.toHaveProperty("code", "SPORTLINK_MEDIA_UPLOAD_FAILED");
      expect(requests).toHaveLength(succeeds ? 2 : 1);
      expect(readWarnings()).toEqual([]);
    });

    it("cannot retroactively fail a committed ingest when warning output fails", async () => {
      vi.spyOn(process.stdout, "write").mockImplementation(() => { throw new Error("PRIVATE_LOGGER_FAILURE"); });
      const current = batch(0);
      current.clubLogo = {
        ...logo("club-1", 1), role: "club_logo",
        storagePath: `providers/sportlink/club_logo/${logoChecksum}.webp`
      };
      const rpc = vi.fn().mockResolvedValue({ data: { readCount: 1 }, error: null });
      const backend = new SupabaseSportlinkSyncBackend("https://supabase.test", "test-only", { rpc });
      await expect(backend.complete(job, "worker:test", current)).resolves.toBe(1);
      expect(rpc).toHaveBeenCalledOnce();
      expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v4", expect.objectContaining({ p_club_logo: {} }));
    });
  });

  it("uploads an official club logo locally before completing the provider run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { readCount: 1 },
      error: null
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const download = vi.fn(() => ({ asStream: async () => ({ data: null, error: { status: 404 } }) }));
    const from = vi.fn(() => ({ download, upload }));
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc, storage: { from } }
    );
    const bytes = logoBytes;

    await expect(backend.complete({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "club_profile",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "worker:sportlink", {
      activities: [],
      birthdayFetchedAt: null,
      birthdays: [],
      club: {
        city: "Den Haag",
        clubCode: "DUIN",
        colors: { primary: null, secondary: null, text: null },
        externalId: "club-1",
        foundedOn: null,
        information: null,
        logoUrl: null,
        name: "Duindorp sv",
        websiteUrl: null
      },
      clubLogo: {
        assetId: "50000000-0000-5000-8000-000000000001",
        bytes,
        checksumSha256: logoChecksum,
        externalId: "club-1",
        fileSizeBytes: bytes.length,
        height: 64,
        mimeType: "image/webp",
        role: "club_logo",
        storagePath: `providers/sportlink/club_logo/${logoChecksum}.webp`,
        title: "Duindorp sv clublogo",
        width: 64
      },
      matches: [],
      personPhotos: [],
      standings: [],
      teamMembers: [],
      teamLogos: [],
      teams: []
    })).resolves.toBe(1);

    expect(from).toHaveBeenCalledWith("provider-assets");
    expect(upload).toHaveBeenCalledWith(
      `providers/sportlink/club_logo/${logoChecksum}.webp`,
      bytes,
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false
      }
    );
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v4", expect.objectContaining({
      p_club_logo: expect.objectContaining({
        assetId: "50000000-0000-5000-8000-000000000001",
        role: "club_logo"
      }),
      p_run_id: "40000000-0000-4000-8000-000000000001"
    }));
  });

  it("completes birthdays through the minimized birthday RPC without credentials", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { readCount: 2 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co", "service-secret", { rpc }
    );
    const fetchedAt = "2026-08-28T12:00:00.000Z";
    await expect(backend.complete({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "public_people", encryptedClientId: "ciphertext",
      encryptionIv: "initialization", encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "worker:sportlink", {
      activities: [], birthdayFetchedAt: fetchedAt,
      birthdays: [{
        day: 29, displayName: "Testpersoon", externalId: "b".repeat(40),
        matchStatus: "unmatched", memberIdentityKey: null, month: 8,
        nextOccurrence: "2026-08-29", normalizedName: "testpersoon",
        role: null, teamAssignments: []
      }], club: null, clubLogo: null, matches: [], personPhotos: [],
      standings: [], teamLogos: [], teamMembers: [], teams: []
    })).resolves.toBe(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "complete_sportlink_birthdays_v1", {
      p_birthdays: [expect.objectContaining({ externalId: "b".repeat(40) })],
      p_fetched_at: fetchedAt, p_person_photos: [],
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_team_members: [], p_worker_id: "worker:sportlink"
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps successful ingest successful without a fallible post-commit render RPC", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "refresh_sportlink_time_sensitive_slides_v1") {
        throw new Error("obsolete refresh timed out after ingest committed");
      }
      return { data: { readCount: 0 }, error: null };
    });
    const backend = new SupabaseSportlinkSyncBackend("https://project.supabase.co", "test-only", { rpc });
    await expect(backend.complete({
      connectionId: "connection", dataSourceId: "source", datasetGroup: "matches",
      encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
      runId: "run", tenantId: "tenant", timezone: "Europe/Amsterdam"
    }, "worker:test", {
      activities: [], birthdayFetchedAt: null, birthdays: [], club: null, clubLogo: null,
      matches: [], personPhotos: [], standings: [], teamMembers: [], teamLogos: [], teams: []
    })).resolves.toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v4", expect.any(Object));
  });

  it("renews the lease while a provider dataset is still being fetched", async () => {
    vi.useFakeTimers();
    let finishDataset: ((value: {
      activities: [];
      birthdayFetchedAt: null;
      birthdays: [];
      club: null;
      clubLogo: null;
      matches: [];
      personPhotos: [];
      standings: [];
      teamMembers: [];
      teamLogos: [];
      teams: [];
    }) => void) | undefined;
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_due_sportlink_sync_v2") {
        return {
          data: [{
            connection_id: "20000000-0000-4000-8000-000000000001",
            data_source_id: "30000000-0000-4000-8000-000000000001",
            dataset_group: "competitions",
            encrypted_client_id: "ciphertext",
            encryption_iv: "initialization",
            encryption_tag: "authentication",
            run_id: "40000000-0000-4000-8000-000000000001",
            tenant_id: "10000000-0000-4000-8000-000000000001",
            timezone: "Europe/Amsterdam"
          }],
          error: null
        };
      }
      if (functionName === "renew_sportlink_sync_lease_v1") {
        return { data: true, error: null };
      }
      if (functionName === "complete_sportlink_sync_v4") {
        return { data: { readCount: 0 }, error: null };
      }
      return { data: null, error: null };
    });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );
    const execution = runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      executeDataset: () => new Promise((resolve) => {
        finishDataset = resolve;
      }),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    });

    await vi.waitFor(() => expect(finishDataset).toBeTypeOf("function"));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(rpc).toHaveBeenCalledWith("renew_sportlink_sync_lease_v1", {
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });

    finishDataset?.({
      activities: [],
      birthdayFetchedAt: null,
      birthdays: [],
      club: null,
      clubLogo: null,
      matches: [],
      personPhotos: [],
      standings: [],
      teamMembers: [],
      teamLogos: [],
      teams: []
    });
    await expect(execution).resolves.toEqual({
      datasetGroup: "competitions",
      readCount: 0,
      runId: "40000000-0000-4000-8000-000000000001",
      status: "completed"
    });
  });
});
import { createServer } from "node:http";
