export type MobilePlaylistOperation =
  | "add_item"
  | "move_item"
  | "remove_item"
  | "update_item";

export function mobilePlaylistMutationRpc(
  operation: MobilePlaylistOperation
): "mutate_playlist_draft_mobile_v1" | "mutate_playlist_draft_v2" {
  return operation === "move_item"
    ? "mutate_playlist_draft_v2"
    : "mutate_playlist_draft_mobile_v1";
}
