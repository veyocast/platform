import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { normalizeAppPath } from "next/dist/shared/lib/router/utils/app-paths";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  selectedTenant: "e3000000-0000-4000-8000-000000000001"
}));

vi.mock("./supabase/config", () => ({ getControlRuntimeMode: () => "live" }));
vi.mock("./supabase/server", () => ({ createControlSupabaseClient: mocks.client }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "eigen" }) }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Client rendering is outside this server-route test. Neither session guard nor
// the canonical authenticated workspace loader is replaced.
vi.mock("../app/(shell)/_components/control-shell", () => ({ ControlShell: () => null }));
vi.mock("../app/(shell)/dashboard/matchday/workbench", () => ({ MatchdayWorkbench: () => null }));

import { requireControlSession } from "./control-session";

const appRoot = path.resolve(import.meta.dirname, "../app");
const shellRoot = path.join(appRoot, "(shell)");
const fixture = JSON.parse(readFileSync(path.resolve(appRoot, "../../../tests/fixtures/s300-matchday-rpc.json"), "utf8")) as Record<string, unknown>;
const delegatedWorkspace = fixture["delegated-workspace"];
const runbookId = "e3000000-0000-4000-8000-000000000020";
const userId = "e3000000-0000-4000-8000-000000000099";

type Result = { data: unknown; error: { code: string } | null };
class Query implements PromiseLike<Result> {
  constructor(private readonly result: () => Result) {}
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  in() { return this; }
  is() { return this; }
  limit() { return this; }
  retry() { return this; }
  abortSignal() { return this; }
  async maybeSingle() { return this.result(); }
  then<T = Result, U = never>(success?: ((value: Result) => T | PromiseLike<T>) | null, failure?: ((reason: unknown) => U | PromiseLike<U>) | null): PromiseLike<T | U> {
    return Promise.resolve(this.result()).then(success, failure);
  }
}

let authenticated = true;
let capabilities: string[] = [];
let workspaceResult: Result;

function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? pages(path.join(directory, entry.name)) : entry.name === "page.tsx" ? [path.join(directory, entry.name)] : []
  );
}

function routePage(url: string) {
  const matches = pages(appRoot).filter(file => normalizeAppPath(`/${path.relative(appRoot, file).replace(/\.tsx$/, "")}`) === url);
  expect(matches, `exactly one Next page for ${url}`).toHaveLength(1);
  return matches[0]!;
}

function routeLayouts(page: string) {
  const layouts: string[] = [];
  for (let directory = path.dirname(page); directory.startsWith(shellRoot); directory = path.dirname(directory)) {
    const layout = path.join(directory, "layout.tsx");
    if (existsSync(layout)) layouts.unshift(layout);
  }
  return layouts;
}

type Layout = { default: (props: { children: ReactNode }) => Promise<ReactNode> };
type Page = { default: (props: { searchParams: Promise<{ runbook: string; day: string }> }) => Promise<ReactElement> };

async function requestRoute(url = "/dashboard/matchday") {
  const file = routePage(url);
  let shell: ReactElement<{ uploadQueue: unknown[] }> | undefined;
  // Execute the actual source ancestry, including the dashboard parent when
  // present. Merely importing the leaf/workbench would miss the original bug.
  for (const layoutFile of routeLayouts(file)) {
    const module = await import(/* @vite-ignore */ layoutFile) as Layout;
    const element = await module.default({ children: null });
    if (layoutFile === path.join(shellRoot, "layout.tsx")) shell = element as typeof shell;
  }
  const module = await import(/* @vite-ignore */ file) as Page;
  return { page: await module.default({ searchParams: Promise.resolve({ runbook: runbookId, day: "2026-11-09" }) }), shell };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  authenticated = true;
  capabilities = [];
  workspaceResult = { data: delegatedWorkspace, error: null };
  mocks.from.mockImplementation((table: string) => new Query(() => ({
    error: null,
    data: {
      profiles: { display_name: "Toegewezen vrijwilliger" },
      tenant_memberships: [{ tenant_id: mocks.selectedTenant, role: "tenant_viewer", custom_role_id: "e3000000-0000-4000-8000-000000000098", tenants: { id: mocks.selectedTenant, name: "Eigen vereniging", slug: "eigen", status: "active" } }],
      platform_memberships: [],
      tenant_custom_roles: [{ id: "e3000000-0000-4000-8000-000000000098", name: "Alleen toegewezen taken" }],
      tenant_settings: { timezone_name: "Europe/Amsterdam" },
      media_assets: [{ id: "private-upload", original_file_name: "eigen.png", title: "Eigen upload", status: "processing" }]
    }[table] ?? null
  })));
  mocks.rpc.mockImplementation((name: string) => new Query(() => {
    if (name === "get_my_tenant_capabilities_v1") return { data: capabilities, error: null };
    if (name === "get_my_platform_ticket_capabilities_v1") return { data: [], error: null };
    if (name === "get_matchday_workspace_s300_v1") return workspaceResult;
    throw new Error(`Unexpected RPC ${name}`);
  }));
  mocks.client.mockResolvedValue({
    from: mocks.from,
    rpc: mocks.rpc,
    auth: {
      getUser: async () => ({ data: { user: authenticated ? { id: userId, email: "volunteer@example.test", user_metadata: {} } : null }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null }) }
    }
  });
});

describe("delegated Matchday server route boundary", () => {
  it("passes the actual parent chain with no global capabilities to the exact delegated workspace RPC", async () => {
    expect((await requireControlSession()).capabilities).toEqual([]);
    const result = await requestRoute();
    expect(result.page.props).toMatchObject({ actorScope: `${mocks.selectedTenant}:${userId}`, canReadScreens: false, workspace: { selected: { id: runbookId, readScope: "delegated" } } });
    expect(mocks.rpc).toHaveBeenCalledWith("get_matchday_workspace_s300_v1", { p_tenant_id: mocks.selectedTenant, p_runbook_id: runbookId, p_day: "2026-11-09" });
    expect(result.shell?.props.uploadQueue).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalledWith("media_assets");
  });

  it("does not query tenant media even when an overview-only member opens the shell", async () => {
    capabilities = ["tenant.overview.read"];
    const result = await requestRoute();
    expect(result.shell?.props.uploadQueue).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalledWith("media_assets");
  });

  it("retains the authorized upload tray for members with media.read", async () => {
    capabilities = ["tenant.overview.read", "tenant.media.read"];
    const result = await requestRoute();
    expect(result.shell?.props.uploadQueue).toEqual([{ id: "private-upload", fileName: "eigen.png", title: "Eigen upload", status: "processing" }]);
    expect(mocks.from.mock.calls.filter(([table]) => table === "media_assets")).toHaveLength(1);
  });

  it("does not render a workspace when the canonical delegation RPC denies access", async () => {
    workspaceResult = { data: null, error: { code: "42501" } };
    const result = await requestRoute();
    const markup = renderToStaticMarkup(result.page);
    expect(markup).toContain("Deze handeling is niet toegestaan");
    expect(result.page.props).not.toHaveProperty("workspace");
    expect(mocks.rpc).toHaveBeenCalledWith("get_matchday_workspace_s300_v1", expect.objectContaining({ p_tenant_id: mocks.selectedTenant }));
    expect(mocks.from).not.toHaveBeenCalledWith("media_assets");
  });

  it("rejects an unauthenticated request in the real shell guard before reading a workspace", async () => {
    authenticated = false;
    await expect(requestRoute()).rejects.toThrow("redirect:/login?reden=sessie");
    expect(mocks.rpc).not.toHaveBeenCalledWith("get_matchday_workspace_s300_v1", expect.anything());
  });

  it("keeps overview and immutable preview under the original overview parent", async () => {
    const dashboardLayout = path.join(shellRoot, "dashboard/layout.tsx");
    const matchdayLayouts = routeLayouts(routePage("/dashboard/matchday"));
    expect(matchdayLayouts).toContain(path.join(shellRoot, "layout.tsx"));
    expect(matchdayLayouts).not.toContain(dashboardLayout);
    for (const url of ["/dashboard", "/dashboard/matchday/preview/[releaseId]"]) {
      expect(routeLayouts(routePage(url))).toContain(dashboardLayout);
      await expect(requestRoute(url)).rejects.toThrow("redirect:/context?reden=selected");
    }
    const previewSource = readFileSync(routePage("/dashboard/matchday/preview/[releaseId]"), "utf8");
    expect(previewSource).toContain('requireTenantControlSession("tenant.release.read")');
    capabilities = ["tenant.overview.read"];
    await expect(requestRoute("/dashboard/matchday/preview/[releaseId]")).rejects.toThrow("redirect:/dashboard");
  });
});
