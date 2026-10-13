import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NextRequest } from "next/server";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runControlLogin } from "./login-flow";
import { createControlSupabaseClient } from "../../lib/supabase/server";
import { getControlLandingPath, getControlSession } from "../../lib/control-session";
import { createRequestDeadline, controlSessionBodyLimitBytes } from "../../lib/supabase/request-deadline";
import { middleware } from "../../middleware";

const cookieState = vi.hoisted(() => ({ values: new Map<string, string>(), writes: [] as string[] }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...cookieState.values].map(([name, value]) => ({ name, value })),
    get: (name: string) => cookieState.values.has(name) ? { value: cookieState.values.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieState.writes.push(name);
      cookieState.values.set(name, value);
    }
  })
}));

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
  cookieState.values.clear();
  cookieState.writes.length = 0;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const userId = "10000000-0000-4000-8000-000000000001";
const tenantId = "20000000-0000-4000-8000-000000000001";
const user = {
  id: userId, aud: "authenticated", email: "fixture@example.invalid",
  app_metadata: { provider: "email" }, user_metadata: { display_name: "Fixture" }, factors: []
};
function session(expired = false, mfa = false) {
  const exp = Math.floor(Date.now() / 1_000) + (expired ? -120 : 3_600);
  const token = [Buffer.from('{"alg":"HS256"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: userId, exp, aal: "aal1", amr: [] })).toString("base64url"), "fixture"].join(".");
  return {
    access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3_600,
    user: { ...user, factors: mfa ? [{ id: "fixture-factor", factor_type: "totp", status: "verified" }] : [] }
  };
}

async function fixture(options: { held?: "roles" | "refresh" | "capabilities"; tokenStatus?: number; tokenFailure?: "transport" | "malformed" | "oversize"; roleError?: boolean; mfa?: boolean; members?: number; archived?: boolean } = {}) {
  const sockets = new Set<Socket>();
  const requests: string[] = [];
  let onHeld!: () => void;
  let onClosed!: () => void;
  const held = new Promise<void>((resolve) => { onHeld = resolve; });
  const closed = new Promise<void>((resolve) => { onClosed = resolve; });
  const authSession = session(false, options.mfa);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    const path = url.pathname;
    requests.push(`${request.method} ${path}${path === "/auth/v1/token" ? url.search : ""}`);
    if (path === "/auth/v1/token" && options.tokenFailure) {
      if (options.tokenFailure === "transport") request.socket.destroy();
      else if (options.tokenFailure === "malformed") response.end("PRIVATE_MALFORMED_BODY");
      else {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.write(Buffer.alloc(controlSessionBodyLimitBytes + 1, 120));
        response.once("close", onClosed);
      }
      return;
    }
    const heldPath = options.held === "roles" ? "/rest/v1/tenant_memberships"
      : options.held === "capabilities" ? "/rest/v1/rpc/get_my_tenant_capabilities_v1"
        : options.held === "refresh" ? "/auth/v1/token" : null;
    if (path === heldPath) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"held":');
      response.once("close", onClosed);
      onHeld();
      return;
    }
    let data: unknown = [];
    let status = 200;
    if (path === "/auth/v1/token") {
      status = options.tokenStatus ?? 200;
      data = status === 200 ? authSession : status === 400
        ? { code: "invalid_credentials", message: "Invalid login credentials" }
        : { code: "unexpected_failure", message: "PRIVATE_PROVIDER_ERROR" };
    } else if (path === "/auth/v1/user") data = authSession.user;
    else if (path === "/rest/v1/profiles") data = { display_name: "Fixture" };
    else if (path === "/rest/v1/tenant_memberships") {
      status = options.roleError ? 403 : 200;
      data = options.roleError ? { code: "42501", message: "PRIVATE_ROLE_ERROR" } : Array.from({ length: options.members ?? 1 }, (_, index) => ({
        tenant_id: tenantId, role: "tenant_owner", custom_role_id: null,
        tenants: { id: tenantId, name: "Fixture club", slug: index === 0 ? "fixture-club" : "other-club", status: options.archived ? "archived" : "active" }
      }));
    } else if (path === "/rest/v1/tenant_settings") data = { timezone_name: "Europe/Amsterdam" };
    else if (path === "/rest/v1/rpc/get_my_tenant_capabilities_v1") data = ["tenant.overview.read"];
    response.writeHead(status, { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" });
    response.end(JSON.stringify(data));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => {
    sockets.forEach((socket) => socket.destroy());
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture missing");
  const url = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
  cookieState.values.set("veyocast-tenant-context", "fixture-club");
  return { requests, held, closed, url };
}

async function clientFor(budgetMs = 1_000) {
  const deadline = createRequestDeadline(budgetMs);
  cleanup.push(() => deadline.dispose());
  const client = await createControlSupabaseClient({ deadline });
  if (!client) throw new Error("fixture client missing");
  return { client, deadline };
}
const credentials = { email: "fixture@example.invalid", password: "fixture-password" };

describe("actual SSR Control login lifecycle", () => {
  it("stops a held native role body after successful Auth and never returns a partial landing", async () => {
    const native = await fixture({ held: "roles" });
    const { client, deadline } = await clientFor(300);
    const outcome = runControlLogin(client, credentials, deadline);
    await native.held;
    expect(await outcome).toEqual({ kind: "unavailable" });
    await native.closed;
    expect(native.requests.filter((path) => path.includes("/auth/v1/token"))).toHaveLength(1);
    expect(native.requests.some((path) => path.includes("/logout"))).toBe(false);
    expect(native.requests.some((path) => path.includes("capabilities"))).toBe(false);
  });

  it("fails closed for an explicit required-role rejection", async () => {
    const native = await fixture({ roleError: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, deadline } = await clientFor();
    expect(await runControlLogin(client, credentials, deadline)).toEqual({ kind: "unavailable" });
    expect(native.requests.some((path) => path.includes("capabilities"))).toBe(false);
  });

  it("reports ordinary invalid credentials without a role read or extra Auth request", async () => {
    const native = await fixture({ tokenStatus: 400 });
    const { client, deadline } = await clientFor();
    expect(await runControlLogin(client, credentials, deadline)).toEqual({ kind: "invalid_credentials" });
    expect(native.requests).toEqual(["POST /auth/v1/token?grant_type=password"]);
  });

  it.each([
    [{}, "/dashboard"],
    [{ mfa: true }, "/auth/mfa?reden=verificatie"],
    [{ archived: true }, "/context?reden=tenant_archived"],
    [{ members: 0 }, "/onboarding"]
  ] as const)("keeps authoritative MFA/context landing on the same SSR client (%j)", async (options, path) => {
    const native = await fixture(options);
    const { client, deadline } = await clientFor();
    expect(await runControlLogin(client, credentials, deadline)).toEqual({ kind: "success", path });
    expect(cookieState.writes.some((name) => name.startsWith("sb-"))).toBe(true);
    expect(native.requests.filter((request) => request.includes("/auth/v1/token"))).toEqual(["POST /auth/v1/token?grant_type=password"]);
    expect(native.requests.filter((request) => request.includes("/auth/v1/user"))).toHaveLength(1);
  });

  it("does not return fallback capabilities when an optional native capability request times out", async () => {
    const native = await fixture({ held: "capabilities" });
    const { client, deadline } = await clientFor(300);
    const outcome = runControlLogin(client, credentials, deadline);
    await native.held;
    expect(await outcome).toEqual({ kind: "unavailable" });
    await native.closed;
  });

  it.each(["held", "504", "transport", "malformed", "oversize"] as const)("ends pinned expired-cookie refresh on its first %s failure and preserves the original cookies", async (failure) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const native = await fixture(failure === "held" ? { held: "refresh" } : failure === "504" ? { tokenStatus: 504 } : { tokenFailure: failure });
    const original = `base64-${Buffer.from(JSON.stringify(session(true))).toString("base64url")}`;
    cookieState.values.set("sb-127-auth-token", original);
    const { client, deadline } = await clientFor(300);
    const started = Date.now();
    const resolving = getControlSession(client, deadline);
    const rejected = expect(resolving).rejects.toMatchObject({ name: "AbortError" });
    if (failure === "held") await native.held;
    await rejected;
    if (failure === "held" || failure === "oversize") await native.closed;
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(native.requests).toEqual(["POST /auth/v1/token?grant_type=refresh_token"]);
    expect(cookieState.writes).toEqual([]);
    expect(cookieState.values.get("sb-127-auth-token")).toBe(original);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("PRIVATE_");
  });

  it("can recover by an explicit new login scope after an availability failure", async () => {
    const failed = await fixture({ tokenStatus: 504 });
    const first = await clientFor();
    expect(await runControlLogin(first.client, credentials, first.deadline)).toEqual({ kind: "unavailable" });
    expect(failed.requests).toHaveLength(1);
    const recovered = await fixture();
    const second = await clientFor();
    expect(await runControlLogin(second.client, credentials, second.deadline)).toEqual({ kind: "success", path: "/dashboard" });
    expect(recovered.requests.filter((path) => path.includes("/auth/v1/token"))).toHaveLength(1);
  });

  it("bounds failed middleware refresh while forwarding the original expired cookies unchanged", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const native = await fixture({ tokenStatus: 504 });
    const original = `base64-${Buffer.from(JSON.stringify(session(true))).toString("base64url")}`;
    const request = new NextRequest(`${native.url}/login`, { headers: { cookie: `sb-127-auth-token=${original}` } });
    const response = await middleware(request);
    expect(native.requests).toEqual(["POST /auth/v1/token?grant_type=refresh_token"]);
    expect(request.cookies.get("sb-127-auth-token")?.value).toBe(original);
    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps successful middleware refresh cookies in both forwarded request and response", async () => {
    const native = await fixture();
    const original = `base64-${Buffer.from(JSON.stringify(session(true))).toString("base64url")}`;
    const request = new NextRequest(`${native.url}/login`, { headers: { cookie: `sb-127-auth-token=${original}` } });
    const response = await middleware(request);
    const refreshed = request.cookies.get("sb-127-auth-token")?.value;
    expect(refreshed).not.toBe(original);
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe(refreshed);
    expect(response.headers.get("x-middleware-request-cookie")).toContain(refreshed);
    expect(native.requests).toEqual(["POST /auth/v1/token?grant_type=refresh_token", "GET /auth/v1/user"]);
  });

  it("cleans the middleware deadline even if SSR construction fails before Auth", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-valid-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
    const response = await middleware(new NextRequest("https://fixture.invalid/login"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps default clients independent of disposed login deadlines", async () => {
    await fixture();
    const scoped = await clientFor();
    scoped.deadline.dispose();
    const nativeFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { headers: { "Content-Type": "application/json" } }));
    const client = await createControlSupabaseClient();
    if (!client) throw new Error("default fixture missing");
    const { error } = await client.from("profiles").select("display_name");
    expect(error).toBeNull();
    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(nativeFetch.mock.calls[0]?.[1]?.cache).toBe("no-store");
    expect(nativeFetch.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("keeps Next redirect control flow outside the availability catch", async () => {
    await fixture();
    const { client, deadline } = await clientFor();
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/context;307;" });
    vi.spyOn(client.auth, "signInWithPassword").mockRejectedValueOnce(redirectError);
    await expect(runControlLogin(client, credentials, deadline)).rejects.toBe(redirectError);
    expect(getControlLandingPath).toBeTypeOf("function");
  });
});
