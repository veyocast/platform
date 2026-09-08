import { describe, expect, it } from "vitest";

import { tenantSettingsSaveErrorMessage } from "./settings-save-errors";

describe("tenantSettingsSaveErrorMessage", () => {
  it("explains how to recover from a stale settings revision", () => {
    expect(tenantSettingsSaveErrorMessage({ code: "40001" }))
      .toContain("vernieuw de pagina");
  });

  it("identifies the legacy Menu Studio compatibility failure", () => {
    expect(tenantSettingsSaveErrorMessage({
      code: "23514",
      message: "new menu documents must use FieldFlow 1.0.0"
    })).toContain("compatibiliteitshotfix");
  });

  it("explains how to recover from a bounded database timeout", () => {
    expect(tenantSettingsSaveErrorMessage({ code: "57014" }))
      .toContain("duurde langer dan toegestaan");
  });

  it("does not expose raw database details for unknown failures", () => {
    const message = tenantSettingsSaveErrorMessage({
      code: "XX000",
      message: "sensitive internal detail"
    });
    expect(message).not.toContain("sensitive internal detail");
    expect(message).toContain("niets gedeeltelijk gewijzigd");
  });
});
