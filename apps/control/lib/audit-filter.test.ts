import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const service = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("./supabase/server", () => ({ createControlSupabaseClient: service.client }));

import { loadTenantAuditEvents } from "./control-overview";

const tenant = "19170000-0000-4000-8000-000000000010";
const foreignTenant = "19170000-0000-4000-8000-000000000011";
type Event = {
  id: string;
  tenant_id: string;
  actor_user_id: null;
  action: string;
  target_type: string;
  target_id: null;
  result: "success";
  metadata: Record<string, never>;
  created_at: string;
};
const event = (id: string, values: Partial<Event> = {}): Event => ({
  id, tenant_id: tenant, actor_user_id: null, action: "tenant.custom_role.created",
  target_type: "tenant_custom_roles", target_id: null, result: "success",
  metadata: {}, created_at: "2026-10-18T12:00:00.000Z", ...values
});
const literalCharacter = (value: string) =>
  "\\^$.*+?()[]{}|".includes(value) ? `\\${value}` : value;

// Exercise actual SDK URL serialization against the two documented PostgREST
// pattern operators. The literal-match expectations below do not depend on an
// exported escape helper or prescribe its implementation.
function matches(value: string, filter: string | null) {
  if (!filter) return true;
  const separator = filter.indexOf(".");
  const operator = filter.slice(0, separator);
  const pattern = filter.slice(separator + 1);
  if (operator === "imatch") return new RegExp(pattern, "i").test(value);
  if (operator !== "ilike") throw new Error("Unexpected pattern operator");
  const aliasPattern = pattern.replaceAll("*", "%");
  let expression = "^";
  for (let index = 0; index < aliasPattern.length; index += 1) {
    const character = aliasPattern[index]!;
    if (character === "\\" && index + 1 < aliasPattern.length) {
      expression += literalCharacter(aliasPattern[++index]!);
    } else {
      expression += character === "%" ? ".*" : character === "_" ? "." : literalCharacter(character);
    }
  }
  return new RegExp(`${expression}$`, "i").test(value);
}

let rows: Event[];
let requests: URL[];
let denied: boolean;
beforeEach(() => {
  rows = [];
  requests = [];
  denied = false;
  const client = createClient("https://audit-tests.invalid", "unit-public-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push(url);
      if (url.pathname.endsWith("/tenant_settings")) {
        return Response.json([{ timezone_name: "Europe/Amsterdam" }]);
      }
      if (denied) return Response.json({ code: "42501", message: "Denied" }, { status: 403 });
      const filtered = rows.filter(row =>
        url.searchParams.get("tenant_id") === `eq.${row.tenant_id}` &&
        matches(row.action, url.searchParams.get("action")) &&
        matches(row.target_type, url.searchParams.get("target_type"))
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? filtered.length);
      return Response.json(filtered.slice(offset, offset + limit), {
        headers: { "content-range": `${offset}-${Math.max(offset, Math.min(offset + limit, filtered.length) - 1)}/${filtered.length}` }
      });
    } }
  });
  service.client.mockResolvedValue(client);
});

describe("literal tenant audit filters", () => {
  for (const field of ["action", "target"] as const) {
    it.each([
      ["tenant.custom_role", "prefix TENANT.CUSTOM_ROLE suffix", "tenantXcustom_role"],
      ["tenant_custom_roles", "prefix tenant_custom_roles suffix", "tenantXcustomXroles"],
      ["%", "prefix % suffix", "ordinary event"],
      ["_", "prefix _ suffix", "ordinary event"],
      ["\\", "prefix \\ suffix", "ordinary event"],
      ["*", "prefix * suffix", "ordinary event"],
      ["a.*[b](c)?+$^{x}|\\", "prefix a.*[b](c)?+$^{x}|\\ suffix", "axbc"],
      ["x),tenant_id.eq.other", "prefix x),tenant_id.eq.other suffix", "unrelated event"]
    ])(`${field} finds only the literal substring %s`, async (term, matching, other) => {
      const column = field === "action" ? "action" : "target_type";
      rows = [
        event("literal-own", { [column]: matching }),
        event("different-own", { [column]: other }),
        event("literal-foreign", { tenant_id: foreignTenant, [column]: matching })
      ];
      const result = await loadTenantAuditEvents(tenant, { [field]: `  ${term}  ` });
      expect(result.error).toBe(false);
      expect(result.events.map(row => row.id)).toEqual(["literal-own"]);
      expect(result.total).toBe(1);
      expect(requests[0]?.searchParams.get("tenant_id")).toBe(`eq.${tenant}`);
      expect(requests[0]?.searchParams.get("or")).toBeNull();
    });
  }

  it("combines both literal filters and keeps the 50-row tenant page", async () => {
    rows = Array.from({ length: 121 }, (_, index) => event(`own-${index}`));
    rows.push(event("foreign", { tenant_id: foreignTenant }));
    const result = await loadTenantAuditEvents(tenant, {
      action: "tenant.custom_role", target: "tenant_custom_roles", page: 2
    });
    expect(result.events.map(row => row.id)).toEqual(rows.slice(50, 100).map(row => row.id));
    expect(result.total).toBe(121);
    expect(result.pageCount).toBe(3);
    expect(requests[0]?.searchParams.get("offset")).toBe("50");
    expect(requests[0]?.searchParams.get("limit")).toBe("50");
    expect(requests[0]?.searchParams.get("order")).toBe("created_at.desc");
  });

  it("keeps an unavailable audit read closed", async () => {
    denied = true;
    const result = await loadTenantAuditEvents(tenant, { action: "tenant.custom_role", page: 2 });
    expect(result).toEqual({ error: true, events: [], page: 2, pageCount: 1, total: 0 });
    expect(requests).toHaveLength(1);
  });
});
