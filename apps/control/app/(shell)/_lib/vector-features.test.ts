import { describe, expect, it } from "vitest";

import {
  emptyVectorTenantFeatures,
  isVectorControlEnabled,
  resolveVectorTenantFeatures
} from "./vector-features";

describe("Vector tenantfeatures", () => {
  it("blijft fail-closed zonder cohortregels", () => {
    expect(resolveVectorTenantFeatures([])).toEqual(emptyVectorTenantFeatures);
  });

  it("activeert de shell alleen wanneer design en shell samen vrijgegeven zijn", () => {
    const designOnly = resolveVectorTenantFeatures([
      { enabled: true, flag_key: "vector_v2_design_system" }
    ]);
    const complete = resolveVectorTenantFeatures([
      { enabled: true, flag_key: "vector_v2_design_system" },
      { enabled: true, flag_key: "vector_v2_control_shell" }
    ]);

    expect(isVectorControlEnabled(designOnly)).toBe(false);
    expect(isVectorControlEnabled(complete)).toBe(true);
  });

  it("negeert onbekende en uitgeschakelde flags", () => {
    const features = resolveVectorTenantFeatures([
      { enabled: true, flag_key: "not_a_real_flag" },
      { enabled: false, flag_key: "engage" },
      { enabled: true, flag_key: "venue_twin" }
    ]);

    expect(features.engage).toBe(false);
    expect(features.venue_twin).toBe(true);
  });
});
