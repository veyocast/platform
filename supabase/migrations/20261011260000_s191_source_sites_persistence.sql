-- S191: preserve typed source designs before the established batch builds its
-- first immutable snapshot. Browser roles cannot forge this transaction context.
create table private.sportlink_sites_batch_context_v1 (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  data_source_id uuid not null,
  backend_pid integer not null,
  transaction_id bigint not null,
  draft_json jsonb not null check(jsonb_typeof(draft_json)='object' and octet_length(draft_json::text)<=16384),
  foreign key(tenant_id,data_source_id) references public.dynamic_data_sources(tenant_id,id) on delete cascade
);
create index sportlink_sites_batch_context_tenant_idx on private.sportlink_sites_batch_context_v1(tenant_id,backend_pid,transaction_id);
alter table private.sportlink_sites_batch_context_v1 enable row level security;
alter table private.sportlink_sites_batch_context_v1 force row level security;
revoke all on private.sportlink_sites_batch_context_v1 from public,anon,authenticated,service_role;

alter function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb) rename to create_dynamic_slide_before_s191_sites_source_v1;
revoke all on function public.create_dynamic_slide_before_s191_sites_source_v1(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.create_dynamic_slide_v1(p_tenant_id uuid,p_name text,p_template_version_id uuid,p_data_source_id uuid,p_selection_mode text default 'latest',p_configuration_json jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context_row private.sportlink_sites_batch_context_v1%rowtype;configuration jsonb:=p_configuration_json;expected_provider text;template_orientation text;
begin
  select * into context_row from private.sportlink_sites_batch_context_v1 context
  where context.tenant_id=p_tenant_id and context.actor_id=private.current_user_id()
    and context.data_source_id=p_data_source_id and context.backend_pid=pg_backend_pid() and context.transaction_id=txid_current()
    and context.draft_json->>'name'=p_name and(context.draft_json->>'templateVersionId')::uuid=p_template_version_id
    and context.draft_json->>'blueprintKey'=p_configuration_json->>'blueprintKey'
    and context.draft_json->'context' is not distinct from p_configuration_json->'context';
  if found then
    -- This value was already strictly checked by V7 in this same actor/tenant
    -- transaction. Put it into the document before the old create/render chain.
    configuration:=jsonb_set(configuration,'{sitesConfiguration}',context_row.draft_json->'sitesConfiguration',true);
    delete from private.sportlink_sites_batch_context_v1 where id=context_row.id;
  end if;
  if configuration ? 'sitesConfiguration' then
    select case when template.slide_type in('menu','price_list')then 'menu' when template.slide_type='ledscores_live_match'then 'led-scores' else 'sportlink' end,template.orientation into expected_provider,template_orientation
    from public.dynamic_template_versions version join public.dynamic_templates template on template.id=version.template_id
    where version.id=p_template_version_id and version.status='published' and template.status='published' and template.current_published_version_id=version.id;
    if not private.sites_configuration_is_valid_v1(configuration->'sitesConfiguration') or configuration#>>'{sitesConfiguration,provider}' is distinct from expected_provider
      or configuration#>>'{sitesConfiguration,orientation}' is distinct from template_orientation then raise exception 'Sites source configuration invalid'using errcode='23514';end if;
    perform private.assert_sites_assets_v1(p_tenant_id,configuration->'sitesConfiguration');
  end if;
  return public.create_dynamic_slide_before_s191_sites_source_v1(p_tenant_id,p_name,p_template_version_id,p_data_source_id,p_selection_mode,configuration);
end;$$;
revoke all on function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb) to authenticated,service_role;

create function public.create_sportlink_slide_batch_v7(p_tenant_id uuid,p_data_source_id uuid,p_drafts jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();draft jsonb;configuration jsonb;result jsonb;replay boolean;template_orientation text;request jsonb;completed jsonb;legacy_drafts jsonb;
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write') then raise exception 'slide write permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_idempotency_key is null or jsonb_typeof(p_drafts) is distinct from 'array' or jsonb_array_length(p_drafts) not between 1 and 25 or octet_length(p_drafts::text)>250000 then raise exception 'invalid Sportlink batch'using errcode='22023';end if;
  if not exists(select 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_data_source_id and kind='sportlink' and status='active') then raise exception 'Sportlink source unavailable'using errcode='23514';end if;
  request:=jsonb_build_object('sourceId',p_data_source_id,'drafts',p_drafts);
  completed:=private.begin_publisher_command(p_tenant_id,'sportlink.sites.batch',p_idempotency_key,request);
  if completed is not null then return completed;end if;
  perform 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_data_source_id for update;
  -- V6 still owns source serialization, full blueprint validation, duplicate
  -- purpose rejection and idempotency; this context supplies only the new field.
  select exists(select 1 from public.sportlink_slide_batches where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key and result_json is not null)into replay;
  if replay then raise exception 'idempotency key already used by another source command'using errcode='22023';end if;
  for draft in select value from jsonb_array_elements(p_drafts) loop
    if draft ? 'sitesConfiguration' then
      configuration:=draft->'sitesConfiguration';
      if not private.sites_configuration_is_valid_v1(configuration) or configuration->>'provider' is distinct from 'sportlink'
        or configuration->>'orientation' is distinct from draft->>'orientation' then raise exception 'Sites Sportlink configuration invalid'using errcode='23514';end if;
      perform private.assert_sites_assets_v1(p_tenant_id,configuration);
      select template.orientation into template_orientation from public.dynamic_template_versions version join public.dynamic_templates template on template.id=version.template_id
      where version.id=(draft->>'templateVersionId')::uuid and version.status='published' and template.status='published' and template.current_published_version_id=version.id;
      if template_orientation is distinct from configuration->>'orientation' then raise exception 'Sites template orientation invalid'using errcode='23514';end if;
      if not replay then
        insert into private.sportlink_sites_batch_context_v1(tenant_id,actor_id,data_source_id,backend_pid,transaction_id,draft_json)
        values(p_tenant_id,actor,p_data_source_id,pg_backend_pid(),txid_current(),draft);
      end if;
    end if;
  end loop;
  select jsonb_agg(value-'sitesConfiguration'order by ordinality)into legacy_drafts from jsonb_array_elements(p_drafts)with ordinality;
  result:=public.create_sportlink_slide_batch_v6(p_tenant_id,p_data_source_id,legacy_drafts,p_idempotency_key);
  if exists(select 1 from private.sportlink_sites_batch_context_v1 where tenant_id=p_tenant_id and actor_id=actor and backend_pid=pg_backend_pid() and transaction_id=txid_current()) then
    raise exception 'Sites draft configuration was not consumed before rendering'using errcode='23514';
  end if;
  return private.complete_publisher_command(p_tenant_id,'sportlink.sites.batch',p_idempotency_key,request,'dynamic_data_sources',p_data_source_id,result,'sportlink.sites.batch.saved');
end;$$;
revoke all on function public.create_sportlink_slide_batch_v7(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_sportlink_slide_batch_v7(uuid,uuid,jsonb,uuid)to authenticated;
notify pgrst,'reload schema';

-- The source wizard also offers the six canonical families that are outside
-- the older eleven-blueprint batch contract. Reuse the same canonical builder.
create function public.create_sites_sportlink_family_v1(p_tenant_id uuid,p_data_source_id uuid,p_name text,p_template_version_id uuid,p_configuration jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();family text;request jsonb;result jsonb;context jsonb;cfg jsonb:=p_configuration;context_id uuid;selection jsonb;
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')then raise exception 'slide write permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_idempotency_key is null or length(btrim(coalesce(p_name,'')))not between 1 and 160 or jsonb_typeof(cfg)is distinct from'object'or octet_length(cfg::text)>32768 or cfg->>'schemaVersion'is distinct from'1'
    or not private.sites_configuration_is_valid_v1(cfg->'sitesConfiguration')or cfg#>>'{sitesConfiguration,provider}'is distinct from'sportlink'then raise exception 'invalid Sites source design'using errcode='23514';end if;
  if exists(select 1 from jsonb_object_keys(cfg)key where key not in('schemaVersion','title','context','display','maxItems','editorial','teamSelection','sitesConfiguration','birthday'))then raise exception 'unknown source configuration'using errcode='23514';end if;
  if not exists(select 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_data_source_id and kind='sportlink'and status='active')then raise exception 'Sportlink source unavailable'using errcode='23514';end if;
  select template.slide_type into family from public.dynamic_template_versions version join public.dynamic_templates template on template.id=version.template_id where version.id=p_template_version_id and version.status='published'and template.status='published'and template.current_published_version_id=version.id and template.orientation=cfg#>>'{sitesConfiguration,orientation}';
  if family is null or family not in('sport_program','sport_results','sport_standing','sport_period_standing','sport_match_of_the_day','sport_next_match','sport_cancellations','sport_dressing_rooms','sport_officials','sport_team','sport_sponsor','sport_activities','sport_trainings','sport_volunteers','sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals')then raise exception 'Sportlink family template unavailable'using errcode='23514';end if;
  if not private.sportlink_display_config_is_valid_v2(cfg->'display')or not private.sportlink_team_selection_is_valid_v1(p_tenant_id,p_data_source_id,cfg->'teamSelection')then raise exception 'invalid source selection'using errcode='23514';end if;
  if jsonb_typeof(cfg->'editorial')is distinct from'object'or cfg#>>'{editorial,schemaVersion}'is distinct from'2'or(select count(*)from jsonb_object_keys(cfg->'editorial'))<>2 or not private.theme_selection_is_valid_v1(cfg#>'{editorial,themeSelection}')then raise exception 'invalid source theme selection'using errcode='23514';end if;
  context:=cfg->'context';
  if context is not null and context<>'null'::jsonb and not private.sportlink_team_contexts_are_valid_v2(p_tenant_id,p_data_source_id,jsonb_build_array(context))then raise exception 'invalid source competition context'using errcode='23514';end if;
  if family in('sport_standing','sport_period_standing','sport_team')and(context is null or context='null'::jsonb)then raise exception 'team context required for this family'using errcode='23514';end if;
  if cfg->>'maxItems'is null or cfg->>'maxItems'!~'^[0-9]+$'or(cfg->>'maxItems')::integer not between 1 and 200 then raise exception 'invalid source item limit'using errcode='23514';end if;
  perform private.assert_sites_assets_v1(p_tenant_id,cfg->'sitesConfiguration');
  request:=jsonb_build_object('sourceId',p_data_source_id,'name',btrim(p_name),'templateVersionId',p_template_version_id,'configuration',cfg);
  result:=private.begin_publisher_command(p_tenant_id,'sportlink.sites.family',p_idempotency_key,request);if result is not null then return result;end if;
  perform 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_data_source_id for update;
  selection:=cfg->'teamSelection';cfg:=cfg-'teamSelection';
  if family='sport_program'then cfg:=cfg||jsonb_build_object('blueprintKey','sportlink.club_schedule_next_7_days','teamSelection',selection);
  elsif family='sport_results'then cfg:=cfg||jsonb_build_object('blueprintKey','sportlink.club_results_previous_7_days','teamSelection',selection);
  elsif family='sport_standing'then cfg:=cfg||jsonb_build_object('blueprintKey','sportlink.pool_standings');
  elsif family in('sport_visitor_arrivals','sport_referee_arrivals')then
    if selection->>'mode'<>'selected'then raise exception 'arrival requires an explicit linked team selection'using errcode='23514';end if;
    cfg:=cfg||jsonb_build_object('blueprintKey',case when family='sport_visitor_arrivals'then'sportlink.visitor_arrivals'else'sportlink.referee_arrivals'end,'teamContexts',selection->'teamContexts');
  elsif family in('sport_team','sport_trainings','sport_sponsor')then cfg:=cfg||jsonb_build_object('sourceTeamSelection',selection);
  end if;
  if family='sport_birthdays'then
    -- Preserve the established privacy/module/readiness validation and inject
    -- only the already validated Sites configuration before its first snapshot.
    insert into private.sportlink_sites_batch_context_v1(tenant_id,actor_id,data_source_id,backend_pid,transaction_id,draft_json)values(p_tenant_id,actor,p_data_source_id,pg_backend_pid(),txid_current(),jsonb_build_object('name',btrim(p_name),'templateVersionId',p_template_version_id,'blueprintKey','sportlink.birthdays','sitesConfiguration',cfg->'sitesConfiguration'))returning id into context_id;
    result:=public.create_sportlink_birthday_slide_v1(p_tenant_id,p_data_source_id,btrim(p_name),p_template_version_id,cfg->'birthday');
    if exists(select 1 from private.sportlink_sites_batch_context_v1 where id=context_id)then raise exception 'birthday design was not included before rendering'using errcode='23514';end if;
  else
    if cfg?'birthday'then raise exception 'birthday selection does not belong to this family'using errcode='23514';end if;
    result:=public.create_dynamic_slide_v1(p_tenant_id,btrim(p_name),p_template_version_id,p_data_source_id,'latest',cfg);
  end if;
  return private.complete_publisher_command(p_tenant_id,'sportlink.sites.family',p_idempotency_key,request,'dynamic_slides',(result->>'slideId')::uuid,result,'sportlink.sites.family.saved');
end;$$;
revoke all on function public.create_sites_sportlink_family_v1(uuid,uuid,text,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.create_sites_sportlink_family_v1(uuid,uuid,text,uuid,jsonb,uuid)to authenticated;
notify pgrst,'reload schema';

-- Filter typed canonical team-derived items by provider IDs, before either a
-- frozen snapshot or a live published delivery is constructed. Historical
-- configurations are unaffected and display labels are never parsed as IDs.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)rename to build_dynamic_snapshot_before_s191_family_selection_v1;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;selection jsonb:=p_slide.configuration_json->'sourceTeamSelection';items jsonb;
  max_items integer:=least(greatest(coalesce((p_slide.configuration_json->>'maxItems')::integer,8),1),200);
begin
 result:=private.build_dynamic_snapshot_before_s191_family_selection_v1(p_slide);
 if p_slide.slide_type in('sport_team','sport_trainings','sport_sponsor')and selection->>'mode'in('all','selected')and p_slide.configuration_json#>>'{sitesConfiguration,provider}'='sportlink'then
  if not private.sportlink_team_selection_is_valid_v1(p_slide.tenant_id,p_slide.data_source_id,selection)then raise exception 'invalid provider team selection'using errcode='23514';end if;
  -- Match the canonical provider projection, but apply the source-bound ID
  -- selection before limiting. Otherwise a selected team beyond row forty in
  -- the historical club-wide builder disappears from both preview and release.
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',team.external_id,
   'primary',case when p_slide.slide_type='sport_sponsor'then coalesce(nullif(team.metadata->>'sponsorName',''),team.name)else team.name end,
   'secondary',case when p_slide.slide_type='sport_trainings'then coalesce(nullif(team.metadata->>'trainingSchedule',''),team.competition_name,'')else coalesce(team.competition_name,team.category,'')end,
   'meta',case when p_slide.slide_type='sport_sponsor'then coalesce(nullif(team.metadata->>'sponsorTagline',''),team.name)else coalesce(team.team_type,team.category,'')end,
   'status','published')order by team.name,team.external_id),'[]'::jsonb)into items
  from(select team.* from public.sports_teams team join public.sportlink_connections connection on connection.tenant_id=team.tenant_id and connection.id=team.source_connection_id
   where team.tenant_id=p_slide.tenant_id and connection.data_source_id=p_slide.data_source_id and team.active
    and(p_slide.slide_type<>'sport_sponsor'or nullif(team.metadata->>'sponsorName','')is not null)
    and(selection->>'mode'='all'or exists(select 1 from jsonb_array_elements(selection->'teamContexts')context where context->>'providerTeamId'=team.external_id))
   order by team.name,team.external_id limit max_items)team;
  result:=jsonb_set(result,'{sport,items}',items);
  result:=jsonb_set(result,'{sport,emptyStateCode}',case when jsonb_array_length(items)=0 then '"DATASET_DISABLED_OR_EMPTY"'::jsonb else 'null'::jsonb end);
 end if;
 return result;
end;$$;
revoke all on function private.build_dynamic_snapshot_before_s191_family_selection_v1(public.dynamic_slides),private.build_dynamic_snapshot_data(public.dynamic_slides)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
