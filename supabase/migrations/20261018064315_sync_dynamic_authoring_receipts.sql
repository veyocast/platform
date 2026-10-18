-- Source authoring uses the existing dynamic entities, canonical builder and
-- render queue. The established Publisher receipt precedes mutable draft CAS.
create function public.mutate_sync_dynamic_authoring_v1(
 p_tenant_id uuid,p_action text,p_slide_id uuid,p_version_id uuid,
 p_expected_revision bigint,p_request jsonb,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=private.current_user_id();request jsonb;result jsonb;configuration jsonb;
 version public.dynamic_slide_versions%rowtype;slide public.dynamic_slides%rowtype;
 template record;result_id uuid;event_name text;
begin
 if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')then
  raise exception 'slide write permission required'using errcode='42501';
 end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_action is null or p_action not in('create','save','publish')or p_idempotency_key is null
  or p_expected_revision is null or p_expected_revision<0
  or jsonb_typeof(p_request)is distinct from'object'or octet_length(p_request::text)>262144
  or(p_action='create'and(p_slide_id is not null or p_version_id is not null or p_expected_revision<>0))
  or(p_action<>'create'and(p_slide_id is null or p_version_id is null))then
  raise exception 'invalid Source authoring command'using errcode='22023';
 end if;
 if(p_action='publish'and p_request<>'{}'::jsonb)or(p_action<>'publish'and(
  (select count(*)from jsonb_object_keys(p_request))<>3
  or not(p_request?&array['templateVersionId','dataSourceId','configuration'])
  or jsonb_typeof(p_request->'configuration')is distinct from'object'))then
  raise exception 'invalid Source authoring fields'using errcode='23514';
 end if;
 request:=jsonb_build_object('action',p_action,'slideId',p_slide_id,'versionId',p_version_id,
  'expectedRevision',p_expected_revision,'request',p_request);
 result:=private.begin_publisher_command(p_tenant_id,'sync.dynamic.authoring',p_idempotency_key,request);
 if result is not null then return result;end if;
 if p_action<>'create'then
  select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=p_slide_id and status<>'archived'for update;
  select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and dynamic_slide_id=p_slide_id and id=p_version_id for update;
  if slide.id is null or version.id is null or not(version.configuration_json?'syncConfiguration')then
   raise exception 'Source version unavailable'using errcode='42501';
  end if;
 end if;
 if p_action='publish'then
  result:=public.publish_dynamic_slide_version_v1(p_slide_id,p_version_id,p_expected_revision);
 else
  configuration:=p_request->'configuration';
  if not(configuration?'syncConfiguration')or configuration?'sitesConfiguration'then
   raise exception 'Source configuration required'using errcode='23514';
  end if;
  select t.slide_type,t.orientation into template
  from public.dynamic_template_versions v join public.dynamic_templates t on t.id=v.template_id
  where v.id=(p_request->>'templateVersionId')::uuid and v.status='published'
   and t.status='published'and t.current_published_version_id=v.id;
  if not found then raise exception 'published Source template unavailable'using errcode='23514';end if;
  perform private.assert_sync_dynamic_configuration_v1(p_tenant_id,template.slide_type,template.orientation,configuration->'syncConfiguration');
  if p_action='create'then
   result:=public.create_dynamic_slide_v1(p_tenant_id,configuration#>>'{syncConfiguration,seed,name}',
    (p_request->>'templateVersionId')::uuid,(p_request->>'dataSourceId')::uuid,'latest',configuration);
  else
   result:=public.save_dynamic_slide_version_v1(p_slide_id,p_version_id,p_expected_revision,
    configuration#>>'{syncConfiguration,seed,name}',(p_request->>'templateVersionId')::uuid,
    (p_request->>'dataSourceId')::uuid,template.orientation,version.selection_mode,
    configuration,version.theme_selection_json);
  end if;
 end if;
 result_id:=coalesce((result->>'slideId')::uuid,p_slide_id);
 if result_id is null then raise exception 'Source receipt unavailable'using errcode='23514';end if;
 event_name:='sync.dynamic.'||p_action;
 return private.complete_publisher_command(p_tenant_id,'sync.dynamic.authoring',p_idempotency_key,
  request,'dynamic_slides',result_id,result,event_name,
  case when result->>'outcome'='conflict'then'failed'else'success'end);
end;$$;
revoke all on function public.mutate_sync_dynamic_authoring_v1(uuid,text,uuid,uuid,bigint,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_sync_dynamic_authoring_v1(uuid,text,uuid,uuid,bigint,jsonb,uuid)to authenticated;
notify pgrst,'reload schema';
