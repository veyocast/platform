-- Source is a renderer, never an alternative entitlement path. Existing
-- frozen releases remain playable when authoring/provider work is paused.
alter function private.assert_sync_dynamic_configuration_v1(uuid,text,text,jsonb)
 rename to assert_sync_dynamic_before_led_v1;
create function private.assert_sync_dynamic_configuration_v1(
 p_tenant_id uuid,p_slide_type text,p_orientation text,p_config jsonb
)returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_sync_dynamic_before_led_v1(p_tenant_id,p_slide_type,p_orientation,p_config);
 if p_slide_type='ledscores_live_match' and not private.ledscores_feature_enabled(p_tenant_id)then
  raise exception 'LED Scores feature required for Source authoring'using errcode='42501';
 end if;
end;$$;
revoke all on function private.assert_sync_dynamic_before_led_v1(uuid,text,text,jsonb),
 private.assert_sync_dynamic_configuration_v1(uuid,text,text,jsonb)
 from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
