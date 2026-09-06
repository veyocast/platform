import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("mediaresource-overzicht", () => {
  it("houdt zoeken compact en pagineert via de bestaande server-RPC", () => {
    const page = source("./page.tsx");

    expect(page).toContain("list_publisher_media_assets_v2");
    expect(page).toContain("p_page_size: mediaPageSize");
    expect(page).toContain("const countProbe = archivedOnly");
    expect(page).toContain("page > pageCount");
    expect(page).toContain("redirect(mediaHref");
    expect(page).toContain('params.status === "archived"');
    expect(page).toContain("disabled={viewingArchive}");
    expect(page).toContain("defaultOpen={false}");
    expect(page).toContain('select("asset_id, variant_type, storage_bucket, storage_path")');
    expect(page).toContain("updated_at");
  });

  it("biedt dezelfde toegankelijke rijacties en multi-select op media", () => {
    const workspace = source("./media-library-workspace.tsx");

    expect(workspace).toContain("Naam media");
    expect(workspace).toContain("Aangemaakt op");
    expect(workspace).toContain("Bijgewerkt op");
    expect(workspace).toContain("MediaPreviewDialog");
    expect(workspace).toContain("MediaArchiveDialog");
    expect(workspace).toContain("AddMediaToPlaylistDialog");
    expect(workspace).toContain("addPlaylistItem");
    expect(workspace).toContain("Alles op deze pagina selecteren");
    expect(workspace).toContain("disabled={!canBulk}");
    expect(workspace).toContain("canBulk && selectedAssets.length");
    expect(workspace).toContain("canWrite={canBulk}");
    expect(workspace).toContain("Geen schrijfrechten");
  });

  it("forceert voor bulkverwijderen een expliciete conceptoverride", () => {
    const action = source("./media-resource-actions.ts");

    expect(action).toContain('formData.get("confirmOverride") !== "on"');
    expect(action).toContain("removeDraftReferences: override && expectedDraftCount > 0");
    expect(action).toContain('revalidatePath("/dashboard/playlists")');
    expect(action).toContain("releases blijven immutable");
  });
});
