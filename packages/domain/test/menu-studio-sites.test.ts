import { describe, expect, it } from "vitest";
import { sitesDynamicConfigurationSchema, sitesPresentationSourceRevision, sitesPresentationVersion, type MenuDocumentV2, type MenuStudioCommand } from "@veyocast/contracts";
import { applyMenuStudioCommand, commitMenuStudioHistory, createMenuStudioHistory, redoMenuStudioHistory, undoMenuStudioHistory } from "../src/menu-studio";

const changedAt = "2026-10-11T14:00:00.000Z";
function configuration(themeId: "fieldflow" | "onzetrots-tv" = "fieldflow") {
  return sitesDynamicConfigurationSchema.parse({ schemaVersion: 1, rendererVersion: sitesPresentationVersion, sourceRevision: sitesPresentationSourceRevision,
    provider: "menu", themeId, orientation: "landscape", title: "Clubmenu", rowsPerPage: 12 });
}
function document(): MenuDocumentV2 {
  return { schemaVersion: "menu-document.v2", id: "sites-menu", tenantId: "sites-tenant", revision: 1, title: "Menu",
    createdAt: "2026-10-11T12:00:00.000Z", updatedAt: "2026-10-11T12:00:00.000Z", assets: [], pages: [{ id: "page-1", order: 0, blocks: [] }],
    theme: { themeId: "editorial", themeVersion: "1.0.0", mode: "light", brand: { accent: "#FF5C20" } } };
}
function command(operation: MenuStudioCommand["operation"], baseRevision = 1): MenuStudioCommand {
  return { operationId: "a1910000-0000-4000-8000-000000003001", baseRevision, operation };
}

describe("Sites Menu Studio command persistence", () => {
  it("saves design configuration as one versioned mutation without changing products or publication metadata", () => {
    const before = document();
    const design = configuration("onzetrots-tv");
    const result = applyMenuStudioCommand(before, command({ kind: "set-sites-configuration", sitesConfiguration: design }), changedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toMatchObject({ sitesConfiguration: design, revision: 2, updatedAt: changedAt, pages: before.pages });
    expect(result.document.theme).toEqual(before.theme);
    expect(before.sitesConfiguration).toBeUndefined();
    expect(result.document.sitesConfiguration).not.toBe(design);
  });

  it("preserves existing design for a legacy theme command and replaces it only when explicitly provided", () => {
    const before = { ...document(), sitesConfiguration: configuration() };
    const preserved = applyMenuStudioCommand(before, command({ kind: "set-theme", theme: { ...before.theme, mode: "dark" } }), changedAt);
    expect(preserved.ok && preserved.document.sitesConfiguration).toEqual(before.sitesConfiguration);
    const replaced = applyMenuStudioCommand(before, command({ kind: "set-theme", theme: before.theme, sitesConfiguration: configuration("onzetrots-tv") }), changedAt);
    expect(replaced.ok && replaced.document.sitesConfiguration?.themeId).toBe("onzetrots-tv");
  });

  it("undo and redo retain exact Sites configuration and restore-to-content can return to a legacy document", () => {
    const before = { ...document(), sitesConfiguration: configuration() };
    const changed = applyMenuStudioCommand(before, command({ kind: "set-sites-configuration", sitesConfiguration: configuration("onzetrots-tv") }), changedAt);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const history = commitMenuStudioHistory(createMenuStudioHistory(before), changed.document);
    expect(undoMenuStudioHistory(history).present.sitesConfiguration?.themeId).toBe("fieldflow");
    expect(redoMenuStudioHistory(undoMenuStudioHistory(history)).present.sitesConfiguration?.themeId).toBe("onzetrots-tv");
    const restored = applyMenuStudioCommand(changed.document, command({ kind: "restore-content", assets: before.assets, pages: before.pages,
      providerSnapshot: null, theme: before.theme, title: before.title ?? null, sitesConfiguration: before.sitesConfiguration }, 2), changedAt);
    expect(restored.ok && restored.document.sitesConfiguration).toEqual(before.sitesConfiguration);
    expect(restored.ok && restored.document.revision).toBe(3);
    const legacy = applyMenuStudioCommand(changed.document, command({ kind: "restore-content", assets: before.assets, pages: before.pages,
      providerSnapshot: null, theme: before.theme, title: null }, 2), changedAt);
    expect(legacy.ok && legacy.document.sitesConfiguration).toBeUndefined();
  });

  it("rejects stale design edits and invalid provider configuration without mutating the original", () => {
    const before = { ...document(), sitesConfiguration: configuration() };
    expect(applyMenuStudioCommand(before, command({ kind: "set-sites-configuration", sitesConfiguration: configuration("onzetrots-tv") }, 9), changedAt))
      .toMatchObject({ ok: false, code: "revision-conflict" });
    expect(applyMenuStudioCommand(before, command({ kind: "set-sites-configuration", sitesConfiguration: { ...configuration(), provider: "sportlink" } }), changedAt).ok)
      .toBe(false);
    expect(before.sitesConfiguration.themeId).toBe("fieldflow");
  });
});
