import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TenantCreateSubmit,
  tenantCreateSubmitLabel
} from "./tenant-create-submit";

describe("tenant creation feedback", () => {
  it("communicates the pending state without changing the command", () => {
    expect(tenantCreateSubmitLabel(false)).toBe("Vereniging aanmaken");
    expect(tenantCreateSubmitLabel(true)).toBe("Vereniging wordt aangemaakt…");
  });

  it("keeps an unavailable command visibly disabled", () => {
    const html = renderToStaticMarkup(
      <TenantCreateSubmit canCreate={false} requiresAal2={false} />
    );

    expect(html).toContain("disabled");
    expect(html).toContain("Vereniging aanmaken");
  });

  it("replaces an inert AAL1 command with the recovery action", () => {
    const html = renderToStaticMarkup(
      <TenantCreateSubmit canCreate={false} requiresAal2 />
    );

    expect(html).toContain("Tweestapsverificatie openen");
    expect(html).toContain("%2Fplatform%2Ftenants%23nieuwe-tenant");
    expect(html).not.toContain("disabled");
  });
});
