-- Voor gecontroleerd handmatig gebruik na het stoppen van nieuwe v2-authoring.
-- Bewaart alle snapshots, releases, instellingen en overridehistorie.
begin;

revoke execute on function public.update_tenant_control_settings_v4(
  uuid, text, text, integer, text, boolean, text, integer, integer,
  text, text, text, bigint, text, text, jsonb, text, text
) from authenticated;
revoke execute on function public.update_tenant_theme_settings_v1(
  uuid, bigint, text, text, jsonb, text, text
) from authenticated;
revoke execute on function public.upsert_tenant_theme_category_override_v1(
  uuid, uuid, text, bigint, text, text, integer
) from authenticated;
revoke execute on function public.convert_dynamic_slide_theme_v2(
  uuid, bigint, jsonb
) from authenticated;

drop function private.build_dynamic_snapshot_data(public.dynamic_slides);
alter function private.build_dynamic_snapshot_data_before_theme_engine_v2(
  public.dynamic_slides
) rename to build_dynamic_snapshot_data;

commit;
