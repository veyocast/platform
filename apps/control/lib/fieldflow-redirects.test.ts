import { describe, expect, it } from "vitest";

import { fieldflowRedirectUrl, resolveFieldflowRedirect } from "./fieldflow-redirects";

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

  it("preserves loopback cookie scope and queries across a canonical route redirect", () => {
    expect(fieldflowRedirectUrl("http://localhost:3220/dashboard/products?q=koffie", "127.0.0.1:3220", "/dashboard/sources/twelve/products").href)
      .toBe("http://127.0.0.1:3220/dashboard/sources/twelve/products?q=koffie");
    expect(fieldflowRedirectUrl("http://localhost:3220/dashboard/products", "[::1]:3220", "/dashboard/sources/twelve/products").hostname).toBe("[::1]");
  });

  it("does not replace production hosts or accept unrelated host headers or ports", () => {
    expect(fieldflowRedirectUrl("https://control.veyocast.nl/dashboard/products", "127.0.0.1", "/dashboard/sources/twelve/products").origin).toBe("https://control.veyocast.nl");
    for (const host of ["elsewhere.example:3220", "127.0.0.1:9999", "evil@127.0.0.1:3220"]) {
      expect(fieldflowRedirectUrl("http://localhost:3220/dashboard/products", host, "/dashboard/sources/twelve/products").origin).toBe("http://localhost:3220");
    }
  });

});
