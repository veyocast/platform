import { describe, expect, it } from "vitest";

import { mobilePlaylistMutationRpc } from "./playlist-mutation";

describe("mobile playlist mutation routing", () => {
  it("uses the canonical position-key mutation for drag reorder", () => {
    expect(mobilePlaylistMutationRpc("move_item")).toBe(
      "mutate_playlist_draft_v2"
    );
  });

  it("keeps lightweight mobile mutations on their idempotent wrapper", () => {
    expect(mobilePlaylistMutationRpc("add_item")).toBe(
      "mutate_playlist_draft_mobile_v1"
    );
    expect(mobilePlaylistMutationRpc("update_item")).toBe(
      "mutate_playlist_draft_mobile_v1"
    );
    expect(mobilePlaylistMutationRpc("remove_item")).toBe(
      "mutate_playlist_draft_mobile_v1"
    );
  });
});
