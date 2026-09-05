import { describe, expect, it } from "vitest";

import { resolveFieldflowRedirect } from "./fieldflow-redirects";

describe("FieldFlow one-hop redirects", () => {
  it.each([
    ["/dashboard/releases", "/dashboard/publications"],
    ["/dashboard/releases/release-1", "/dashboard/publications/release-1"],
    ["/dashboard/products", "/dashboard/sources/twelve/products"],
    ["/dashboard/products/imports/import-1", "/dashboard/sources/twelve/imports/import-1"],
    ["/dashboard/integrations/twelve-products/imports/import-2", "/dashboard/sources/twelve/imports/import-2"],
    ["/dashboard/data-sources/sportlink", "/dashboard/sources/sportlink"],
    ["/dashboard/screen-groups", "/dashboard/screens/groups"],
    ["/platform/users", "/platform/access/users"]
  ])("maps %s directly to %s", (source, target) => {
    expect(resolveFieldflowRedirect(source)).toBe(target);
    expect(resolveFieldflowRedirect(target)).toBeNull();
  });

  it("does not rewrite canonical, auth or API routes", () => {
    expect(resolveFieldflowRedirect("/dashboard/account/mfa")).toBeNull();
    expect(resolveFieldflowRedirect("/auth/mfa")).toBeNull();
    expect(resolveFieldflowRedirect("/api/health")).toBeNull();
  });

});
