-- S306: unknown dimensions are legal read metadata, but never a ready temporal
-- publication target. Preserve the existing resolver/context/CAS/fingerprint.
alter function private.matchday_preflight_s300_v1(uuid,uuid,bigint,uuid)
 rename to matchday_preflight_before_resolution_s306_v1;
create function private.matchday_preflight_s300_v1(
 p_tenant_id uuid,p_runbook_id uuid,p_expected_revision bigint,p_proposal_id uuid
)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;target jsonb;targets jsonb:='[]';issues jsonb:='[]';unknown_count integer:=0;
 reason constant text:='De resolutie van dit scherm is onbekend. Controleer het schermprofiel of kies een ander doel voordat je publiceert.';
begin
 result:=private.matchday_preflight_before_resolution_s306_v1(p_tenant_id,p_runbook_id,p_expected_revision,p_proposal_id);
 for target in select value from jsonb_array_elements(result->'targets')loop
  if exists(select 1 from public.screens screen where screen.tenant_id=p_tenant_id
   and screen.id=(target->>'screenId')::uuid and screen.deleted_at is null
   and(screen.resolution_width is null or screen.resolution_height is null))then
   unknown_count:=unknown_count+1;
   target:=target||jsonb_build_object('ready',false,'reason',reason);
   issues:=issues||jsonb_build_array(jsonb_build_object('screenId',target->'screenId',
    'role',target->'role','code','SCREEN_RESOLUTION_UNKNOWN','message',reason));
  end if;
  targets:=targets||jsonb_build_array(target);
 end loop;
 if unknown_count=0 then return result;end if;
 return result||jsonb_build_object('targets',targets,'issues',(result->'issues')||issues,'canPublish',false);
end$$;
revoke all on function private.matchday_preflight_s300_v1(uuid,uuid,bigint,uuid),
 private.matchday_preflight_before_resolution_s306_v1(uuid,uuid,bigint,uuid)
 from public,anon,authenticated,service_role;
