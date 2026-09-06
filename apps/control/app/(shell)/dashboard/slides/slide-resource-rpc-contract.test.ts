import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../../../../supabase/migrations/20260906143000_s153_slide_theme_backoffice.sql",
  import.meta.url
);

let migration = "";
let resourceAction = "";

function publicFunction(name: string) {
  const markers = [
    `create function public.${name}(`,
    `create or replace function public.${name}(`
  ];
  const start = markers
    .map((marker) => migration.indexOf(marker))
    .find((index) => index >= 0) ?? -1;
  expect(start, `${name} ontbreekt in de S153-migratie`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("\n$$;", start);
  expect(end, `${name} heeft geen herkenbare function boundary`).toBeGreaterThan(start);
  return migration.slice(start, end + 4);
}

describe("slide-resource RPC-contract", () => {
  beforeAll(async () => {
    [migration, resourceAction] = await Promise.all([
      readFile(migrationUrl, "utf8"),
      readFile(new URL("./slide-resource-actions.ts", import.meta.url), "utf8")
    ]);
  });

  it("houdt de Control-actie en guarded bulk-RPC-signature gelijk", () => {
    expect(resourceAction).toContain('supabase.rpc("mutate_dynamic_slides_v1"');
    for (const parameter of [
      "p_idempotency_key",
      "p_operation",
      "p_override",
      "p_slide_ids",
      "p_tenant_id"
    ]) {
      expect(resourceAction).toContain(`${parameter}:`);
    }

    expect(migration).toMatch(
      /create function public\.mutate_dynamic_slides_v1\(\s*p_tenant_id uuid,\s*p_slide_ids uuid\[\],\s*p_operation text,\s*p_override boolean,\s*p_idempotency_key uuid\s*\)/u
    );
    expect(migration).toMatch(
      /revoke all on function public\.mutate_dynamic_slides_v1\(\s*uuid, uuid\[\], text, boolean, uuid\s*\) from public, anon, authenticated, service_role;/u
    );
    expect(migration).toMatch(
      /grant execute on function public\.mutate_dynamic_slides_v1\(\s*uuid, uuid\[\], text, boolean, uuid\s*\) to authenticated;/u
    );
  });

  it("archiveert tenantveilig en laat immutable releasehistorie buiten de mutatie", () => {
    const contract = publicFunction("mutate_dynamic_slides_v1");

    expect(contract).toContain("security definer");
    expect(contract).toContain("set search_path = ''");
    expect(contract).toContain("cardinality(p_slide_ids) not between 1 and 100");
    expect(contract).toContain("'tenant.dynamic_slide.write'");
    expect(contract).toContain("private.can_write_playlist(p_tenant_id)");
    expect(contract).toContain("private.require_active_tenant_command(p_tenant_id)");
    expect(contract).toContain("private.begin_publisher_command(");
    expect(contract).toContain("private.complete_publisher_command(");
    expect(contract).toContain("for update;");
    expect(contract).toContain("draft_reference_count > 0 and not p_override");
    expect(contract).toContain("'outcome', 'blocked'");
    expect(contract).toContain("delete from public.playlist_items");
    expect(contract).toContain("update public.playlists");
    expect(contract).toContain("update public.dynamic_slide_versions");
    expect(contract).toContain("update public.dynamic_slides");
    expect(contract).toContain("'immutableReleasesChanged', false");
    expect(contract).not.toContain("public.playlist_release_items");
    expect(contract).not.toContain("public.playlist_releases");
    expect(contract).not.toContain("delete from public.dynamic_slide_snapshots");
  });

  it("bewaakt één clubslide per blueprint en canonicaliseert oude v3-fan-out", () => {
    const v4 = publicFunction("create_sportlink_slide_batch_v4");
    const v3 = publicFunction("create_sportlink_slide_batch_v3");

    expect(v4).toContain("cardinality(seen_club_keys)");
    expect(v4).toContain("duplicate club-wide Sportlink component");
    expect(v4).toContain("draft -> 'teamSelection'");
    expect(v4).toContain("'teamSelection', case");
    expect(v4).toContain("'maxItems', case when is_club_aggregate then 100 else 40 end");
    expect(v4).toContain("public.create_dynamic_slide_v1(");
    expect(v3).toContain("distinct on (");
    expect(v3).toContain("'mode', 'selected'");
    expect(v3).toContain("'teamContexts', contexts");
    expect(v3).toContain("public.create_sportlink_slide_batch_v4(");
  });
});
