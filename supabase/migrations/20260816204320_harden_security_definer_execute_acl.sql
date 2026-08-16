-- Supabase grants EXECUTE on new functions to PUBLIC, anon, authenticated and
-- service_role by default. These human command RPCs already enforce actor and
-- capability checks internally, but they must not be exposed to unsigned
-- callers at the database ACL boundary.
--
-- The credential-bound Player RPCs intentionally executable by anon are not
-- changed here; their exact allowlist is guarded by the accompanying pgTAP
-- regression test.
revoke execute on function
  public.claim_pairing_session(text, uuid, uuid, text, text),
  public.claim_pairing_session_v2(text, uuid, uuid, text),
  public.claim_pairing_session_v4(text, uuid, uuid, text),
  public.create_dynamic_data_source_v1(uuid, text, text, jsonb),
  public.create_dynamic_template_v1(
    text, text, text, text, text, text, text, jsonb, jsonb
  ),
  public.create_dynamic_template_version_v1(uuid),
  public.create_manual_product_v1(uuid, text, text, text, integer, text),
  public.deactivate_screen_v1(uuid, uuid),
  public.publish_dynamic_template_version_v1(uuid),
  public.publish_playlist_to_screens(uuid, uuid[], text),
  public.queue_player_command_v1(uuid, uuid, text, uuid, integer, jsonb),
  public.record_data_source_failure_v1(uuid, text, text),
  public.record_rss_sync_v1(uuid, jsonb),
  public.remove_screen_v1(uuid, uuid, text),
  public.update_dynamic_template_draft_v1(
    uuid, bigint, text, text, text, text, jsonb, jsonb
  ),
  public.upsert_sportlink_connection_v1(
    uuid, text, text, text, text, text, text
  ),
  public.withdraw_dynamic_template_v1(uuid)
from public, anon;

-- This legacy publish entrypoint is retained only because newer guarded
-- database functions call it as their postgres owner. No Data API role needs
-- direct EXECUTE permission.
revoke execute on function
  public.publish_playlist_to_screens(uuid, uuid[], text)
from authenticated, service_role;
