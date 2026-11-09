-- S301: exact observed Sportlink contexts and draft-only authoring commands.
-- No provider request, publication, immutable version or existing plan changes.
create function private.sportlink_season_hash_s301_v1(p_value jsonb) returns text
language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')
$$;

create function private.sportlink_season_contexts_s301_v1(p_tenant_id uuid,p_connection_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by item#>>'{context,providerTeamId}',item#>>'{context,seasonId}',
  item#>>'{context,competitionId}',item#>>'{context,poolId}',item#>>'{context,phaseId}',item::text),'[]') from (
  select min(observed.item::text)::jsonb item from (select jsonb_build_object(
   'context',jsonb_build_object('providerTeamId',team.external_id,'competitionSelectionMode','pinned',
    'competitionId',option->>'externalId','poolId',nullif(option->>'poolExternalId',''),
    'seasonId',option->>'season','phaseId',nullif(option->>'period','')),
   'teamName',left(team.name,240),'competitionName',left(coalesce(option->>'name','Competitie'),240),
   'poolName',left(nullif(option->>'poolName',''),240),'phaseName',left(nullif(option->>'period',''),240),
   'qualifications',jsonb_build_object('competitionType',left(nullif(option->>'type',''),240),
    'discipline',left(nullif(team.team_type,''),240),'level',left(nullif(option->>'level',''),240))) item
  from public.sports_teams team join public.sportlink_connections connection
   on connection.tenant_id=team.tenant_id and connection.id=team.source_connection_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(team.metadata->'competitionOptions')='array'
   then team.metadata->'competitionOptions' else '[]'::jsonb end) option
  where team.tenant_id=p_tenant_id and team.source_connection_id=p_connection_id and team.active
   and (cardinality(connection.selected_team_codes)=0 or team.external_id=any(connection.selected_team_codes)
    or team.local_external_id=any(connection.selected_team_codes))
   and jsonb_typeof(option)='object' and jsonb_typeof(option->'externalId')='string'
   and length(btrim(option->>'externalId')) between 1 and 200
   and btrim(option->>'externalId')=option->>'externalId'
   and jsonb_typeof(option->'season')='string' and length(btrim(option->>'season')) between 1 and 80
   and btrim(option->>'season')=option->>'season'
   and (option->'poolExternalId' is null or option->'poolExternalId'='null'::jsonb
    or (jsonb_typeof(option->'poolExternalId')='string' and length(option->>'poolExternalId') between 1 and 200
     and btrim(option->>'poolExternalId')=option->>'poolExternalId'))
   and (option->'period' is null or option->'period'='null'::jsonb
    or (jsonb_typeof(option->'period')='string' and length(option->>'period') between 1 and 200
     and btrim(option->>'period')=option->>'period'))
 ) observed group by observed.item->'context',observed.item->'qualifications') canonical
$$;

create function private.sportlink_season_source_hash_s301_v1(p_tenant_id uuid,p_connection_id uuid,p_contexts jsonb)
returns text language sql stable security definer set search_path='' as $$
 select private.sportlink_season_hash_s301_v1(jsonb_build_object(
  'connectionId',connection.id,'sourceId',connection.data_source_id,'connectionStatus',connection.status,
  'sourceStatus',source.status,'teams',to_jsonb(connection.selected_team_codes),
  'clubs',(select coalesce(jsonb_agg(club.external_id order by club.external_id),'[]')
   from public.sports_clubs club where club.tenant_id=p_tenant_id and club.source_connection_id=connection.id),
  'contexts',(select coalesce(jsonb_agg(item order by item),'[]')from(select distinct jsonb_build_object('context',value->'context',
   'qualifications',value->'qualifications')item from jsonb_array_elements(p_contexts))canonical)))
 from public.sportlink_connections connection join public.dynamic_data_sources source
  on source.tenant_id=connection.tenant_id and source.id=connection.data_source_id
 where connection.tenant_id=p_tenant_id and connection.id=p_connection_id
$$;

-- A broad all-team source without explicit overrides has no season binding.
-- Repeated primary contexts are collapsed by exact provider ID; disagreement
-- is malformed and cannot be repaired through a bulk guess.
create function private.sportlink_season_bindings_s301_v1(p_configuration jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare contexts jsonb:='[]'; result jsonb:='[]'; item jsonb; before jsonb; field text;
begin
 if jsonb_typeof(p_configuration) is distinct from 'object' then return null; end if;
 if p_configuration?'sourceTeamSelection'then
  if p_configuration?'teamSelection'and p_configuration->'teamSelection'is distinct from p_configuration->'sourceTeamSelection'then return null;end if;
  return private.sportlink_season_bindings_s301_v1((p_configuration-'sourceTeamSelection')||jsonb_build_object('teamSelection',p_configuration->'sourceTeamSelection'));
 end if;
 if p_configuration#>>'{teamSelection,mode}'='all' then
  if jsonb_typeof(p_configuration#>'{teamSelection,teamContexts}') is distinct from 'array' then return null; end if;
  contexts:=p_configuration#>'{teamSelection,teamContexts}';
  if jsonb_array_length(contexts)=0 then return '[]'; end if;
 else
  if p_configuration?'teamSelection' then
   if p_configuration#>>'{teamSelection,mode}' is distinct from 'selected'
    or jsonb_typeof(p_configuration#>'{teamSelection,teamContexts}') is distinct from 'array' then return null; end if;
   contexts:=p_configuration#>'{teamSelection,teamContexts}';
  end if;
  if p_configuration?'teamContexts' then
   if jsonb_typeof(p_configuration->'teamContexts') is distinct from 'array' then return null; end if;
   contexts:=contexts||(p_configuration->'teamContexts');
  end if;
 end if;
 if p_configuration?'context' then contexts:=contexts||jsonb_build_array(p_configuration->'context'); end if;
 if jsonb_array_length(contexts)=0 or jsonb_array_length(contexts)>1001 then return null; end if;
 for item in select *from jsonb_array_elements(contexts) loop
  if jsonb_typeof(item) is distinct from 'object' or not(item?&array[
   'providerTeamId','competitionSelectionMode','competitionId','phaseId','poolId','seasonId'])
   or (select count(*)from jsonb_object_keys(item))<>6
   or jsonb_typeof(item->'providerTeamId') is distinct from 'string'
   or length(btrim(item->>'providerTeamId')) not between 1 and 200
   or btrim(item->>'providerTeamId')<>item->>'providerTeamId'
   or coalesce(item->>'competitionSelectionMode','') not in('pinned','auto_current') then return null; end if;
  foreach field in array array['competitionId','phaseId','poolId','seasonId'] loop
   if item->field is distinct from 'null'::jsonb and (jsonb_typeof(item->field) is distinct from 'string'
    or length(btrim(item->>field)) not between 1 and case when field='seasonId' then 80 else 200 end
    or btrim(item->>field)<>item->>field) then return null; end if;
   if item->>'competitionSelectionMode'='auto_current' and item->field is distinct from 'null'::jsonb then return null; end if;
  end loop;
  select value->'context' into before from jsonb_array_elements(result)
   where value->>'fromProviderTeamId'=item->>'providerTeamId';
  if before is not null and before is distinct from item then return null; end if;
  if before is null then result:=result||jsonb_build_array(jsonb_build_object(
   'fromProviderTeamId',item->>'providerTeamId','context',item)); end if;
 end loop;
 if jsonb_array_length(result)>500 then return null; end if;
 if p_configuration#>>'{birthday,selection,teamSelectionMode}'='selected'then
  if jsonb_typeof(p_configuration#>'{birthday,selection,selectedTeamIds}')is distinct from'array'
   or jsonb_array_length(p_configuration#>'{birthday,selection,selectedTeamIds}')<>jsonb_array_length(result)
   or exists(select 1 from jsonb_array_elements(p_configuration#>'{birthday,selection,selectedTeamIds}')selected_team
    where jsonb_typeof(selected_team)is distinct from'string'or not exists(select 1 from jsonb_array_elements(result)binding
     where binding->>'fromProviderTeamId'=selected_team#>>'{}'))then return null;end if;
 end if;
 return result;
end $$;

create function public.get_sportlink_season_switch_inventory_v1(
 p_tenant_id uuid,p_connection_id uuid,p_target_season_id text default null,
 p_filters jsonb default '{}',p_cursor text default null,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare connection public.sportlink_connections%rowtype; source public.dynamic_data_sources%rowtype;
 contexts jsonb; context_hash text; filter_hash text; cursor_value jsonb; cursor_rank integer;
 cursor_kind text; cursor_id text; report_rows jsonb; total_count bigint; has_more boolean; next_cursor text;
 query text; status_filter text; kind_filter text; resource_id uuid; seasons jsonb;
 last_matches timestamptz; last_competitions timestamptz; last_teams timestamptz;
 health_state text; health_reasons jsonb:='[]'; observed_through timestamptz;
 runbooks_available boolean:=private.sportlink_season_runbooks_available_s301_v1();
begin
 if private.current_user_id() is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')
  or not exists(select 1 from public.tenants where id=p_tenant_id and status in('active','paused')) then
  raise exception 'season inventory read permission required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or jsonb_typeof(p_filters) is distinct from 'object'
  or octet_length(p_filters::text)>4096 or exists(select 1 from jsonb_object_keys(p_filters)key
   where key<>all(array['query','status','resourceKind','resourceId']))
  or (p_target_season_id is not null and(length(p_target_season_id)not between 1 and 80 or btrim(p_target_season_id)<>p_target_season_id))
  or (p_cursor is not null and length(p_cursor)>2000) then
  raise exception 'invalid bounded season inventory request' using errcode='22023'; end if;
 foreach query in array array['query','status','resourceKind','resourceId'] loop
  if p_filters?query and jsonb_typeof(p_filters->query) is distinct from 'string' then
   raise exception 'invalid season inventory filter' using errcode='22023'; end if;
 end loop;
 query:=btrim(coalesce(p_filters->>'query',''));status_filter:=coalesce(p_filters->>'status','all');
 kind_filter:=coalesce(p_filters->>'resourceKind','all');resource_id:=(p_filters->>'resourceId')::uuid;
 if length(query)>120 or status_filter not in('all','attention','available','locked')
  or kind_filter not in('all','dynamic_slide','matchday_runbook') then
  raise exception 'invalid season inventory filter' using errcode='22023'; end if;
 if(kind_filter='dynamic_slide'and not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read'))
  or(kind_filter='matchday_runbook'and not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read'))
  or(kind_filter='all'and not(private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')
   or private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')))then
  raise exception 'season resource read permission required'using errcode='42501';end if;
 select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and id=p_connection_id;
 select *into source from public.dynamic_data_sources where tenant_id=p_tenant_id and id=connection.data_source_id and kind='sportlink';
 if connection.id is null or source.id is null then raise exception 'season source outside tenant' using errcode='42501'; end if;
 contexts:=private.sportlink_season_contexts_s301_v1(p_tenant_id,p_connection_id);
 context_hash:=private.sportlink_season_source_hash_s301_v1(p_tenant_id,p_connection_id,contexts);
 filter_hash:=private.sportlink_season_hash_s301_v1(jsonb_build_object('tenant',p_tenant_id,
  'connection',p_connection_id,'season',p_target_season_id,'filters',p_filters,'runbooksAvailable',runbooks_available));
 if p_cursor is not null then
  begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;
   if jsonb_typeof(cursor_value)is distinct from'object' or cursor_value->>'filterHash' is distinct from filter_hash
    or (select count(*)from jsonb_object_keys(cursor_value))<>4
    or coalesce(cursor_value->>'rank','')!~'^[0-9]$'
    or coalesce(cursor_value->>'kind','')not in('dynamic_slide','matchday_runbook') then raise exception 'invalid cursor'; end if;
   cursor_rank:=(cursor_value->>'rank')::integer;cursor_kind:=cursor_value->>'kind';cursor_id:=((cursor_value->>'id')::uuid)::text;
   if cursor_id is null then raise exception 'invalid cursor'; end if;
  exception when others then raise exception 'season inventory cursor does not match this selection' using errcode='22023'; end;
 end if;
 with all_rows as materialized (
  select private.sportlink_season_row_s301_v1(slide,version,connection,source.status,p_target_season_id,contexts,context_hash)item
  from public.dynamic_slides slide left join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id
   and version.dynamic_slide_id=slide.id and version.id=coalesce(slide.active_draft_version_id,slide.current_published_version_id)
   and not version.is_source_variant
  where slide.tenant_id=p_tenant_id and kind_filter in('all','dynamic_slide')
   and private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')
   and (resource_id is null or slide.id=resource_id)
   and (slide.data_source_id=source.id or exists(select 1 from public.dynamic_slide_versions basis
    where basis.tenant_id=p_tenant_id and basis.dynamic_slide_id=slide.id and basis.id in(slide.active_draft_version_id,slide.current_published_version_id)
     and basis.data_source_id=source.id))
  union all
  select value from private.sportlink_season_runbook_rows_s301_v1(p_tenant_id,p_connection_id,p_target_season_id,contexts,context_hash)value
   where kind_filter in('all','matchday_runbook')and private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')
    and(resource_id is null or value->>'resourceId'=resource_id::text)
 ), filtered as materialized (
  select item,case item->>'state' when 'conflict'then 0 when 'malformed'then 1 when 'source_unavailable'then 2
   when 'choice_required'then 3 when 'locked'then 4 when 'available'then 5 when 'current'then 6 else 7 end rank_no
  from all_rows where (query=''or position(lower(query)in lower(concat_ws(' ',item->>'name',item->>'resourceKind',
   item->>'state',(select string_agg((value->'currentContext')::text,' ')from jsonb_array_elements(item->'bindings')))))>0)
   and(status_filter='all' or(status_filter='attention'and item->>'state'in('conflict','malformed','source_unavailable','choice_required'))
    or(status_filter='available'and item->>'state'='available')or(status_filter='locked'and item->>'state'in('locked','broad_unchanged')))
 ), page as materialized (
  select *from filtered where p_cursor is null or(rank_no,item->>'resourceKind',item->>'resourceId')>(cursor_rank,cursor_kind,cursor_id)
  order by rank_no,item->>'resourceKind',item->>'resourceId' limit p_limit+1
 ), numbered as(select *,row_number()over(order by rank_no,item->>'resourceKind',item->>'resourceId')ordinal from page)
 select (select count(*)from filtered),count(*)>p_limit,
  coalesce(jsonb_agg(case when item->>'resourceKind'='dynamic_slide' then jsonb_set(item,'{impact}',
   (private.sportlink_season_impact_s301_v1(p_tenant_id,(item->>'resourceId')::uuid)-'reviewHash'))else item end order by ordinal)
   filter(where ordinal<=p_limit),'[]'),
  (select replace(encode(convert_to(jsonb_build_object('filterHash',filter_hash,'rank',rank_no,
   'kind',item->>'resourceKind','id',item->>'resourceId')::text,'UTF8'),'base64'),E'\n','')from numbered where ordinal=p_limit)
 into total_count,has_more,report_rows,next_cursor from numbered;
 select coalesce(jsonb_agg(jsonb_build_object('id',season,'label',season)order by season),'[]')into seasons
  from(select distinct value#>>'{context,seasonId}'season from jsonb_array_elements(contexts)order by season limit 100)observed;
 select max(last_success_at)filter(where dataset_group='matches'),max(last_success_at)filter(where dataset_group='competitions'),
  max(last_success_at)filter(where dataset_group='teams')into last_matches,last_competitions,last_teams
  from public.sportlink_sync_policies where tenant_id=p_tenant_id and connection_id=p_connection_id;
 select max(starts_at)into observed_through from public.sports_matches where tenant_id=p_tenant_id and source_connection_id=p_connection_id and active;
 if connection.status<>'active'or source.status<>'active'then
  health_state:='unavailable';health_reasons:='["De bronverbinding is niet actief."]';
 elsif exists(select 1 from public.sportlink_sync_runs run left join public.sportlink_sync_policies policy
  on policy.tenant_id=run.tenant_id and policy.connection_id=run.connection_id and policy.dataset_group=run.dataset_group
  where run.tenant_id=p_tenant_id and run.connection_id=p_connection_id and run.dataset_group in('teams','matches','competitions')
   and run.status in('failed','partial')and run.finished_at>coalesce(policy.last_success_at,'-infinity'::timestamptz))then
  health_state:='incomplete';health_reasons:='["Een relevante deelbroncontrole is mislukt of gedeeltelijk. De laatst geldige broncontext blijft herkenbaar."]';
 elsif jsonb_array_length(contexts)=0 or last_teams is null then
  health_state:='incomplete';health_reasons:='["Geen volledige seizoenscontext of geslaagde teamsynchronisatie aangetoond."]';
 elsif exists(select 1 from public.sportlink_sync_policies where tenant_id=p_tenant_id and connection_id=p_connection_id
  and dataset_group in('teams','matches','competitions')and enabled and next_sync_at<now())then
  health_state:='stale';health_reasons:='["Een relevante synchronisatie is volgens het ingestelde beleid achterstallig."]';
 elsif last_matches is null or last_competitions is null then
  health_state:='incomplete';health_reasons:='["Niet alle relevante deelbronnen hebben een aangetoonde geslaagde synchronisatie."]';
 else health_state:='ready';end if;
 if (select count(distinct value#>>'{context,seasonId}')from jsonb_array_elements(contexts))>100 then
  health_reasons:=health_reasons||'["Meer dan honderd waargenomen seizoenen; de seizoenskeuzelijst is begrensd."]';end if;
 if not runbooks_available then health_reasons:=health_reasons||'["Wedstrijddag-draaiboekintegratie is nog niet beschikbaar; de inventaris is daarvoor niet volledig."]';end if;
 return jsonb_build_object('schemaVersion',1,'connection',jsonb_build_object('id',connection.id,'sourceId',source.id,
  'name',left(source.name,240),'timeZone',connection.timezone),'seasons',seasons,'targetSeasonId',p_target_season_id,
  'sourceHealth',jsonb_build_object('state',health_state,'matchesLastSuccessAt',last_matches,
   'competitionsLastSuccessAt',last_competitions,'observedThrough',observed_through,'coverageKnown',false,'reasons',health_reasons),
  'rows',report_rows,'nextCursor',case when has_more then next_cursor end,
  'totalCount',case when runbooks_available or kind_filter='dynamic_slide'then total_count end,
  'integration',jsonb_build_object('matchdayRunbooks',case when runbooks_available then 'available'else'unavailable'end));
end $$;

create function private.sportlink_season_binding_hash_s301_v1(p_source_id uuid,p_configuration jsonb)
returns text language sql immutable set search_path='' as $$
 select private.sportlink_season_hash_s301_v1(jsonb_build_object('sourceId',p_source_id,
  'context',p_configuration->'context','teamContexts',p_configuration->'teamContexts',
  'teamSelection',p_configuration->'teamSelection','sourceTeamSelection',p_configuration->'sourceTeamSelection',
  'birthdayTeamIds',p_configuration#>'{birthday,selection,selectedTeamIds}'))
$$;

create function private.sportlink_season_impact_s301_v1(p_tenant_id uuid,p_slide_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')
  or not private.has_tenant_capability(p_tenant_id,'tenant.release.read') then
  return jsonb_build_object('knownCount',null,'truncated',false,'unknown',true,'references','[]'::jsonb,'reviewHash',null);
 end if;
 with releases as materialized (
  select distinct item.release_id,snapshot.dynamic_slide_version_id version_id
  from public.playlist_release_items item join public.dynamic_slide_snapshots snapshot
   on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
  where item.tenant_id=p_tenant_id and snapshot.dynamic_slide_id=p_slide_id
 ), refs as (
  select 'publication' kind,playlist.id::text id,left(playlist.name,240) name,
   '/dashboard/playlists/'||playlist.id href,'draft_playlist' state,null::uuid version_id,
   jsonb_build_object('playlistId',playlist.id,'revision',playlist.revision,'items',(select coalesce(jsonb_agg(
    to_jsonb(item)-array['created_at','updated_at','created_by'] order by item.id),'[]')from public.playlist_items item
    where item.tenant_id=p_tenant_id and item.playlist_id=playlist.id)) fingerprint
  from public.playlists playlist where playlist.tenant_id=p_tenant_id and exists(
   select 1 from public.playlist_items item where item.tenant_id=p_tenant_id and item.playlist_id=playlist.id
    and (item.dynamic_slide_id=p_slide_id or exists(select 1 from public.dynamic_slide_snapshots snapshot
     where snapshot.tenant_id=p_tenant_id and snapshot.id=item.dynamic_snapshot_id and snapshot.dynamic_slide_id=p_slide_id)))
  union
  select 'publication',release.id::text,left(playlist.name||' · v'||release.version,240),
   '/dashboard/publications/'||release.id,'immutable_release',refs.version_id,
   jsonb_build_object('releaseId',release.id,'playlistId',release.playlist_id,'version',release.version,
    'manifestHash',release.manifest_hash,'slideVersionId',refs.version_id)
  from releases refs join public.playlist_releases release on release.tenant_id=p_tenant_id and release.id=refs.release_id
  join public.playlists playlist on playlist.tenant_id=p_tenant_id and playlist.id=release.playlist_id
  union
  select 'schedule',schedule.id::text,left(schedule.name,240),'/dashboard/planning',
   case when schedule.deleted_at is not null then 'removed_schedule' when not schedule.enabled then 'disabled_schedule'
    when schedule.ends_at<=now() then 'historical_schedule' when schedule.schedule_kind<>'once' then 'recurring_schedule'
    when schedule.starts_at>now() then 'future_schedule' else 'configured_schedule' end,refs.version_id,
   jsonb_build_object('schedule',to_jsonb(schedule)-array['name','created_at','updated_at','created_by','updated_by'],
    'slideVersionId',refs.version_id,'targets',(select coalesce(jsonb_agg(jsonb_build_object('screenId',target.screen_id,
     'provenanceKind',target.provenance_kind,'provenanceId',target.provenance_id)order by target.screen_id),'[]')
     from public.publisher_target_snapshot_screens target where target.tenant_id=p_tenant_id
      and target.snapshot_id=schedule.target_snapshot_id))
  from releases refs join public.content_schedules schedule on schedule.tenant_id=p_tenant_id and schedule.release_id=refs.release_id
  union
  select 'screen',screen.id::text,left(screen.name,240),'/dashboard/screens/'||screen.id,
   case when screen.assigned_release_id=refs.release_id then 'desired_publication' else 'default_publication' end,refs.version_id,
   jsonb_build_object('screen',to_jsonb(screen)-array['name','location','created_at','updated_at','created_by','deleted_by',
    'schedule_evaluated_at','target_changed_at'],'referencedReleaseId',refs.release_id,'slideVersionId',refs.version_id)
  from releases refs join public.screens screen on screen.tenant_id=p_tenant_id
   and refs.release_id in(screen.assigned_release_id,screen.default_release_id)
  where private.has_tenant_capability(p_tenant_id,'tenant.screen.read')
  union
  select 'zone',binding.composition_id||':'||binding.zone_id,left(screen.name||' · '||binding.zone_id,240),
   '/dashboard/screens/'||screen.id,case when screen.composition_id=binding.composition_id
    then 'configured_zone' else 'historical_zone' end,refs.version_id,
   jsonb_build_object('binding',to_jsonb(binding),'composition',jsonb_build_object('id',composition.id,
    'revision',composition.revision,'configuration',composition.configuration_json),'screenId',screen.id,
    'screenCompositionId',screen.composition_id,'screenCompositionRevision',screen.composition_revision,
    'referencedReleaseId',refs.release_id,'slideVersionId',refs.version_id)
  from releases refs join public.screen_composition_bindings binding on binding.tenant_id=p_tenant_id
   and refs.release_id in(binding.release_id,binding.fallback_release_id)
  join public.screen_compositions composition on composition.tenant_id=p_tenant_id and composition.id=binding.composition_id
  join public.screens screen on screen.tenant_id=p_tenant_id and screen.id=composition.screen_id
  where private.has_tenant_capability(p_tenant_id,'tenant.screen.read')
  union
  select 'screen',screen.id::text,left(screen.name,240),'/dashboard/screens/'||screen.id,
   'confirmed_publication',refs.version_id,jsonb_build_object('screenId',screen.id,
    'referencedReleaseId',refs.release_id,'slideVersionId',refs.version_id)
  from releases refs join public.player_devices device on device.tenant_id=p_tenant_id
   and device.active_release_id=refs.release_id and device.status='paired'
  join public.screens screen on screen.tenant_id=p_tenant_id and screen.id=device.screen_id
  cross join lateral(select private.screen_frame_timestamp_s296_v1(
   device.current_sync_detail#>>'{publicationTrace,firstFrameAt}')frame_at)frame
  where private.has_tenant_capability(p_tenant_id,'tenant.screen.read')and refs.version_id is not null
   and refs.release_id is distinct from screen.assigned_release_id and refs.release_id is distinct from screen.default_release_id
   and device.current_sync_detail#>>'{publicationTrace,releaseId}'=device.active_release_id::text
   and frame.frame_at is not null and device.last_seen_at is not null
   and frame.frame_at<=device.last_seen_at and device.last_seen_at<=statement_timestamp()
 ), ordered as (
  select *,row_number()over(order by kind,id,state,version_id,fingerprint::text) ordinal from refs
 ) select jsonb_build_object('knownCount',count(*),'truncated',count(*)>100,'unknown',true,
  'reviewHash',private.sportlink_season_hash_s301_v1(coalesce(jsonb_agg(jsonb_build_object(
   'kind',kind,'id',id,'state',state,'versionId',version_id,'fingerprint',fingerprint)order by ordinal)filter(where state<>'confirmed_publication'),'[]')),
  'references',coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'name',name,'href',href,
   'state',state,'confirmedVersionId',case when kind='screen'and exists(
    select 1 from public.player_devices device cross join lateral(select private.screen_frame_timestamp_s296_v1(
     device.current_sync_detail#>>'{publicationTrace,firstFrameAt}')frame_at)frame
    where device.tenant_id=p_tenant_id and device.screen_id::text=ordered.id and device.status='paired'
     and device.active_release_id::text=ordered.fingerprint->>'referencedReleaseId'
     and device.current_sync_detail#>>'{publicationTrace,releaseId}'=device.active_release_id::text
     and frame.frame_at is not null and device.last_seen_at is not null
     and frame.frame_at<=device.last_seen_at and device.last_seen_at<=statement_timestamp())then version_id end)order by ordinal)filter(where ordinal<=100),'[]')) into result from ordered;
 -- Direct canonical dependencies are known. Embedded series, unpublished
 -- runbook integration and physical per-zone playback remain explicitly unknown.
 -- A configured immutable version is never claimed as a Player-confirmed frame.
 -- Screen confirmation requires the paired device and exact valid publication
 -- frame. Observation-only historical screen references and frame times never
 -- enter the concurrency review hash; all known references count toward the cap.
 return result;
end $$;

create function private.sportlink_season_review_hash_s301_v1(p_tenant_id uuid,p_slide_id uuid,p_source_hash text)
returns text language sql stable security definer set search_path='' as $$
 select private.sportlink_season_hash_s301_v1(jsonb_build_object('source',p_source_hash,
  'impact',private.sportlink_season_impact_s301_v1(p_tenant_id,p_slide_id)->'reviewHash'))
$$;

create function private.sportlink_season_links_s301_v1(p_tenant_id uuid,p_slide_id uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:=jsonb_build_object('edit','/dashboard/slides/'||p_slide_id||'/edit','publish',null,'restore',null);
 count_ids bigint;target_id text;
begin
 if not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')
  or not private.has_tenant_capability(p_tenant_id,'tenant.release.read')then return result;end if;
 select count(distinct item.playlist_id),min(item.playlist_id::text)into count_ids,target_id
  from public.playlist_items item where item.tenant_id=p_tenant_id and(item.dynamic_slide_id=p_slide_id
   or exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id
    and snapshot.id=item.dynamic_snapshot_id and snapshot.dynamic_slide_id=p_slide_id));
 if count_ids=1 then result:=jsonb_set(result,'{publish}',to_jsonb('/dashboard/playlists/'||target_id||'/publish'));end if;
 select count(distinct item.release_id),min(item.release_id::text)into count_ids,target_id
  from public.playlist_release_items item join public.dynamic_slide_snapshots snapshot
   on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
  where item.tenant_id=p_tenant_id and snapshot.dynamic_slide_id=p_slide_id;
 if count_ids=1 then result:=jsonb_set(result,'{restore}',to_jsonb('/dashboard/publications/'||target_id));end if;
 return result;
end $$;

-- S300 replaces these private seams using its real draft model. An unavailable
-- integration must never masquerade as a complete empty runbook inventory.
create function private.sportlink_season_runbooks_available_s301_v1() returns boolean
language sql stable set search_path='' as $$select false$$;
create function private.sportlink_season_runbook_rows_s301_v1(
 p_tenant_id uuid,p_connection_id uuid,p_target_season_id text,p_contexts jsonb,p_context_hash text
) returns setof jsonb language sql stable set search_path='' as $$select null::jsonb where false$$;
create function private.sportlink_season_runbook_preview_s301_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
begin raise exception 'matchday runbook season integration unavailable' using errcode='55000'; end $$;
create function private.sportlink_season_runbook_apply_s301_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path='' as $$
begin raise exception 'matchday runbook season integration unavailable' using errcode='55000'; end $$;

create function private.sportlink_season_candidates_s301_v1(
 p_contexts jsonb,p_current jsonb,p_target_season_id text,p_pool_required boolean
) returns setof jsonb language sql stable set search_path='' as $$
 with old_qualifications as (
  select case when count(distinct value->'qualifications')=1 then min((value->'qualifications')::text)::jsonb end value
  from jsonb_array_elements(p_contexts) where value->'context'=p_current
 ), candidates as (
  select value from jsonb_array_elements(p_contexts) where value#>>'{context,seasonId}'=p_target_season_id
   and (not p_pool_required or value#>>'{context,poolId}' is not null)
 ) select value||jsonb_build_object(
  'candidateId',private.sportlink_season_hash_s301_v1((value->'context')||jsonb_build_object('qualifications',value->'qualifications')),
  'label',left(concat_ws(' · ',value->>'teamName',value->>'competitionName',value->>'phaseName',value->>'poolName',p_target_season_id),240),
  'reason',case when value#>>'{context,providerTeamId}'=p_current->>'providerTeamId' then 'same_team_identity' else 'explicit_choice' end)
 from candidates where
  ((select value->>'competitionType' from old_qualifications) is null
   or value#>>'{qualifications,competitionType}'=(select value->>'competitionType'from old_qualifications))
  and ((select value->>'discipline' from old_qualifications) is null
   or value#>>'{qualifications,discipline}'=(select value->>'discipline'from old_qualifications))
 order by case when value#>>'{context,providerTeamId}'=p_current->>'providerTeamId' then 0 else 1 end,
  value#>>'{context,providerTeamId}',value#>>'{context,competitionId}',value#>>'{context,poolId}',
  value#>>'{context,phaseId}',value::text
$$;

create function private.sportlink_season_row_s301_v1(
 p_slide public.dynamic_slides,p_version public.dynamic_slide_versions,p_connection public.sportlink_connections,
 p_source_status text,p_target_season_id text,p_contexts jsonb,p_context_hash text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 configuration jsonb:=coalesce(p_version.configuration_json,p_slide.configuration_json);
 source_id uuid:=coalesce(p_version.data_source_id,p_slide.data_source_id);
 bindings jsonb; item jsonb; rows jsonb:='[]'; candidates jsonb; candidate_count integer;
 same_team jsonb; old_qualifications jsonb; automatic boolean:=true; current_selection boolean:=true;
 can_update boolean:=true; state text; reason text; pool_required boolean; candidate_limit integer;
begin
 bindings:=private.sportlink_season_bindings_s301_v1(configuration);
 pool_required:=p_slide.slide_type in('sport_match_of_the_day','sport_standing','sport_period_standing')
  or coalesce(configuration->>'blueprintKey','') like 'sportlink.pool_%';
 candidate_limit:=least(50,greatest(1,500/greatest(1,coalesce(jsonb_array_length(bindings),0))));
 for item in select *from jsonb_array_elements(coalesce(bindings,'[]')) loop
  select count(*),coalesce(jsonb_agg(candidate order by ordinal)filter(where ordinal<=candidate_limit),'[]')
   into candidate_count,candidates from private.sportlink_season_candidates_s301_v1(
    p_contexts,item->'context',p_target_season_id,pool_required)with ordinality c(candidate,ordinal);
  select case when count(*)=1 then min(value::text)::jsonb end into same_team
   from private.sportlink_season_candidates_s301_v1(p_contexts,item->'context',p_target_season_id,pool_required)value
   where value#>>'{context,providerTeamId}'=item->>'fromProviderTeamId';
  select case when count(distinct value->'qualifications')=1 then min((value->'qualifications')::text)::jsonb end
   into old_qualifications from jsonb_array_elements(p_contexts)where value->'context'=item->'context';
  automatic:=automatic and same_team is not null and candidate_count<=candidate_limit
   and old_qualifications->>'competitionType' is not null and old_qualifications->>'discipline' is not null
   and old_qualifications->>'level' is not null
   and old_qualifications= same_team->'qualifications';
  current_selection:=current_selection and item#>>'{context,seasonId}'=p_target_season_id
   and exists(select 1 from jsonb_array_elements(p_contexts)where value->'context'=item->'context');
  can_update:=can_update and candidate_count>0;
  rows:=rows||jsonb_build_array(jsonb_build_object('fromProviderTeamId',item->>'fromProviderTeamId',
   'currentContext',item->'context','candidates',candidates,'candidateCount',candidate_count,
   'candidatesTruncated',candidate_count>candidate_limit));
 end loop;
 if p_version.id is null or bindings is null then
  state:='malformed';reason:='De oorspronkelijke versie of exacte teamcontext is onvolledig. Open het ontwerp voor handmatige controle.';can_update:=false;
 elsif p_slide.status='archived' or p_version.status not in('draft','published','archived')
  or(p_slide.active_draft_version_id is not null and p_version.status not in('draft','publishing'))
  or source_id<>p_connection.data_source_id then
  state:='locked';reason:='Deze versie is historisch, wordt gepubliceerd of heeft intussen een andere bron. De publicatie blijft behouden.';can_update:=false;
 elsif jsonb_array_length(bindings)=0 then
  state:='broad_unchanged';reason:='Deze bewuste selectie van alle teams en contexten heeft geen expliciete seizoenskoppeling.';can_update:=false;
 elsif p_target_season_id is null then
  state:='source_unavailable';reason:='Kies een doelseizoen dat aantoonbaar in de ingelezen bron voorkomt.';can_update:=false;
 elsif p_connection.status<>'active' or p_source_status<>'active' then
  state:='source_unavailable';reason:='De bronverbinding is niet actief. Controleer Bronbeheer; de bestaande selectie blijft behouden.';can_update:=false;
 elsif not can_update then
  state:='source_unavailable';reason:='Er is nog geen volledige, passende team-/competitie-/poulecontext voor dit doelseizoen. Afwezigheid bewijst geen verdwenen opvolger.';
 elsif coalesce(current_selection,false)then
  state:='current';reason:='De opgeslagen identiteit is al exact geldig voor het gekozen doelseizoen.';can_update:=false;
 elsif coalesce(automatic,false)then
  state:='available';reason:='Dezelfde stabiele teamidentiteit heeft één aantoonbaar passende context. Bevestig het voorstel expliciet.';
 else
  state:='choice_required';reason:='Kies bewust een exacte broncontext. Ontbrekende kwalificaties, gewijzigde teamcodes of meerdere mogelijkheden worden niet op naam gekoppeld.';
 end if;
 can_update:=can_update and private.has_tenant_capability(p_slide.tenant_id,'tenant.dynamic_slide.write');
 return jsonb_build_object('resourceKind','dynamic_slide','resourceId',p_slide.id,'name',left(coalesce(p_slide.library_name,p_version.name,p_slide.name),240),
  'state',state,'reason',reason,'canUpdate',can_update,'basisVersionId',p_version.id,
  'draftVersionId',case when p_version.status='draft' then p_version.id end,'expectedRevision',coalesce(p_version.edit_revision,0),
  'oldBindingHash',private.sportlink_season_binding_hash_s301_v1(source_id,configuration),
  'contextHash',private.sportlink_season_review_hash_s301_v1(p_slide.tenant_id,p_slide.id,p_context_hash),
  'bindings',rows,'impact',jsonb_build_object('knownCount',null,'truncated',false,'unknown',true,'references','[]'::jsonb),
  'links',private.sportlink_season_links_s301_v1(p_slide.tenant_id,p_slide.id));
end $$;

create function private.assert_sportlink_season_input_s301_v1(p_input jsonb,p_apply boolean)
returns void language plpgsql immutable set search_path='' as $$
declare field text; mapping jsonb; context jsonb; ignored uuid;
begin
 if jsonb_typeof(p_input)is distinct from'object' or octet_length(p_input::text)>262144
  or (select count(*)from jsonb_object_keys(p_input))<>(case when p_apply then 10 else 8 end)
  or not(p_input?&array['resourceKind','resourceId','basisVersionId','expectedRevision','oldBindingHash','contextHash','newSelection','clearSelectedMatches'])
  or coalesce(p_input->>'resourceKind','')not in('dynamic_slide','matchday_runbook')
  or jsonb_typeof(p_input->'resourceId')is distinct from'string'
  or p_input->>'resourceId' is null
  or jsonb_typeof(p_input->'expectedRevision')is distinct from'number'
  or coalesce(p_input->>'expectedRevision','')!~'^[0-9]{1,16}$'
  or (p_input->>'expectedRevision')::numeric>9007199254740991
  or coalesce(p_input->>'oldBindingHash','')!~'^[a-f0-9]{64}$'
  or coalesce(p_input->>'contextHash','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(p_input->'clearSelectedMatches')is distinct from'boolean'
  or jsonb_typeof(p_input->'newSelection')is distinct from'object'
  or (select count(*)from jsonb_object_keys(p_input->'newSelection'))<>1
  or jsonb_typeof(p_input#>'{newSelection,mappings}')is distinct from'array'
  or jsonb_array_length(p_input#>'{newSelection,mappings}')not between 1 and 500 then
  raise exception 'invalid bounded season command' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_input)key where key<>all(array[
  'resourceKind','resourceId','basisVersionId','expectedRevision','oldBindingHash','contextHash','newSelection',
  'clearSelectedMatches','requestId','correlationId']))then raise exception 'unknown season command field'using errcode='22023';end if;
 ignored:=(p_input->>'resourceId')::uuid;
 if p_input->'basisVersionId' is distinct from'null'::jsonb then
  if jsonb_typeof(p_input->'basisVersionId')is distinct from'string'then raise exception 'invalid basis identity'using errcode='22023';end if;
  ignored:=(p_input->>'basisVersionId')::uuid;
 end if;
 if p_apply then
  if jsonb_typeof(p_input->'requestId')is distinct from'string'or jsonb_typeof(p_input->'correlationId')is distinct from'string'then
   raise exception 'season receipt identity required'using errcode='22023';end if;
  ignored:=(p_input->>'requestId')::uuid;ignored:=(p_input->>'correlationId')::uuid;
 elsif p_input?'requestId'or p_input?'correlationId'then raise exception 'preview cannot submit a receipt'using errcode='22023';end if;
 for mapping in select *from jsonb_array_elements(p_input#>'{newSelection,mappings}')loop
  if jsonb_typeof(mapping)is distinct from'object'or(select count(*)from jsonb_object_keys(mapping))<>2
   or not(mapping?&array['fromProviderTeamId','context'])or jsonb_typeof(mapping->'fromProviderTeamId')is distinct from'string'
   or length(btrim(mapping->>'fromProviderTeamId'))not between 1 and 200 then
   raise exception 'invalid exact team mapping'using errcode='22023';end if;
  context:=mapping->'context';
  if private.sportlink_season_bindings_s301_v1(jsonb_build_object('context',context))is null
   or context->>'competitionSelectionMode'is distinct from'pinned'
   or jsonb_typeof(context->'seasonId')is distinct from'string'then
   raise exception 'mapping requires an exact observed season context'using errcode='22023';end if;
 end loop;
 if (select count(distinct value->>'fromProviderTeamId')from jsonb_array_elements(p_input#>'{newSelection,mappings}'))
   <>jsonb_array_length(p_input#>'{newSelection,mappings}')
  or(select count(distinct value#>>'{context,providerTeamId}')from jsonb_array_elements(p_input#>'{newSelection,mappings}'))
   <>jsonb_array_length(p_input#>'{newSelection,mappings}')
  or(select count(distinct value#>>'{context,seasonId}')from jsonb_array_elements(p_input#>'{newSelection,mappings}'))<>1 then
  raise exception 'each old and new team must occur exactly once in one target season'using errcode='22023';end if;
end $$;

create function private.sportlink_season_patch_s301_v1(p_configuration jsonb,p_mappings jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_configuration; replacement jsonb; items jsonb;selection_key text;
begin
 if p_configuration?'context'then
  select value->'context'into replacement from jsonb_array_elements(p_mappings)
   where value->>'fromProviderTeamId'=p_configuration#>>'{context,providerTeamId}';
  if replacement is not null then result:=jsonb_set(result,'{context}',replacement);end if;
 end if;
 if p_configuration?'teamContexts'then
  select jsonb_agg(coalesce(mapping.value->'context',original.value)order by original.ordinality)into items
  from jsonb_array_elements(p_configuration->'teamContexts')with ordinality original
  left join lateral(select value from jsonb_array_elements(p_mappings)
   where value->>'fromProviderTeamId'=original.value->>'providerTeamId')mapping on true;
  result:=jsonb_set(result,'{teamContexts}',coalesce(items,'[]'));
 end if;
 foreach selection_key in array array['teamSelection','sourceTeamSelection']loop
 if p_configuration?selection_key then
  select jsonb_agg(coalesce(mapping.value->'context',original.value)order by original.ordinality)into items
  from jsonb_array_elements(p_configuration#>array[selection_key,'teamContexts'])with ordinality original
  left join lateral(select value from jsonb_array_elements(p_mappings)
   where value->>'fromProviderTeamId'=original.value->>'providerTeamId')mapping on true;
  result:=jsonb_set(result,array[selection_key,'teamContexts'],coalesce(items,'[]'));
 end if;
 end loop;
 if jsonb_typeof(p_configuration#>'{birthday,selection,selectedTeamIds}')='array'then
  select jsonb_agg(coalesce(mapping.value#>'{context,providerTeamId}',original.value)order by original.ordinality)into items
  from jsonb_array_elements(p_configuration#>'{birthday,selection,selectedTeamIds}')with ordinality original
  left join lateral(select value from jsonb_array_elements(p_mappings)
   where value->>'fromProviderTeamId'=original.value#>>'{}')mapping on true;
  result:=jsonb_set(result,'{birthday,selection,selectedTeamIds}',coalesce(items,'[]'));
 end if;
 return result;
end $$;

create function private.sportlink_season_prepare_s301_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare slide public.dynamic_slides%rowtype;version public.dynamic_slide_versions%rowtype;
 connection public.sportlink_connections%rowtype;source public.dynamic_data_sources%rowtype;
 contexts jsonb;bindings jsonb;mapping jsonb;previous jsonb;resolved jsonb;configuration jsonb;
 source_hash text;row_value jsonb;pool_required boolean;season text;
begin
 select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=(p_input->>'resourceId')::uuid;
 if slide.id is null then raise exception 'season resource outside tenant'using errcode='42501';end if;
 select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and dynamic_slide_id=slide.id
  and id=coalesce(slide.active_draft_version_id,slide.current_published_version_id)and not is_source_variant;
 if version.id is distinct from(p_input->>'basisVersionId')::uuid or version.id is null
  or version.edit_revision<>(p_input->>'expectedRevision')::bigint
  or private.sportlink_season_binding_hash_s301_v1(version.data_source_id,version.configuration_json)is distinct from p_input->>'oldBindingHash'then
  return jsonb_build_object('status','conflict','reason','Het concept, de oorspronkelijke versie of de selectie is sinds de controle gewijzigd.');end if;
 select *into source from public.dynamic_data_sources where tenant_id=p_tenant_id and id=version.data_source_id and kind='sportlink';
 select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and data_source_id=source.id;
 if source.id is null or connection.id is null then raise exception 'season source outside tenant'using errcode='42501';end if;
 contexts:=private.sportlink_season_contexts_s301_v1(p_tenant_id,connection.id);
 source_hash:=private.sportlink_season_source_hash_s301_v1(p_tenant_id,connection.id,contexts);
 if private.sportlink_season_review_hash_s301_v1(p_tenant_id,slide.id,source_hash)is distinct from p_input->>'contextHash'then
  return jsonb_build_object('status','conflict','reason','De gecontroleerde bronidentiteit of toegankelijke contexten zijn gewijzigd. Controleer deze rij opnieuw.');end if;
 bindings:=private.sportlink_season_bindings_s301_v1(version.configuration_json);
 if slide.status='archived'or version.status not in('draft','published','archived')or bindings is null
  or jsonb_array_length(bindings)=0 or source.status<>'active'or connection.status<>'active'then
  return jsonb_build_object('status','blocked','reason','Deze bronselectie is historisch, onvolledig, breed of tijdelijk niet beschikbaar. Er is niets gewijzigd.');end if;
 if (p_input->>'clearSelectedMatches')::boolean then
  raise exception 'dynamic source command cannot clear runbook matches'using errcode='22023';end if;
 if jsonb_array_length(bindings)<>jsonb_array_length(p_input#>'{newSelection,mappings}')or exists(
  select 1 from jsonb_array_elements(bindings)binding where not exists(select 1 from jsonb_array_elements(p_input#>'{newSelection,mappings}')chosen_mapping
   where chosen_mapping->>'fromProviderTeamId'=binding->>'fromProviderTeamId'))then
  raise exception 'mapping must cover every original explicit team exactly once'using errcode='22023';end if;
 pool_required:=version.slide_type in('sport_match_of_the_day','sport_standing','sport_period_standing')
  or coalesce(version.configuration_json->>'blueprintKey','')like'sportlink.pool_%';
 for mapping in select *from jsonb_array_elements(p_input#>'{newSelection,mappings}')loop
  select value->'context'into previous from jsonb_array_elements(bindings)where value->>'fromProviderTeamId'=mapping->>'fromProviderTeamId';
  season:=mapping#>>'{context,seasonId}';
  if not exists(select 1 from private.sportlink_season_candidates_s301_v1(contexts,previous,season,pool_required)candidate
   where candidate->'context'=mapping->'context')then
   raise exception 'mapping is not an accessible exact normalized destination context'using errcode='42501';end if;
  if mapping#>>'{context,poolId}'is not null then
   if version.configuration_json?'syncConfiguration'then
    resolved:=private.sync_resolve_sportlink_pool_context_v1(p_tenant_id,source.id,mapping->'context','sportlink.pool_standings');
   else resolved:=private.resolve_sportlink_pool_context_v1(p_tenant_id,source.id,mapping->'context','sportlink.pool_standings');end if;
   if resolved is null or exists(select 1 from unnest(array['competitionId','poolId','seasonId','phaseId'])key
    where resolved->key is distinct from mapping#>array['context',key])or resolved->>'sourceConnectionId'<>connection.id::text then
    raise exception 'canonical Sportlink context resolver refused destination'using errcode='42501';end if;
  end if;
 end loop;
 configuration:=private.sportlink_season_patch_s301_v1(version.configuration_json,p_input#>'{newSelection,mappings}');
 if configuration=version.configuration_json then return jsonb_build_object('status','blocked','reason','De geselecteerde koppeling is al actueel.');end if;
 row_value:=private.sportlink_season_row_s301_v1(slide,version,connection,source.status,season,contexts,source_hash);
 return jsonb_build_object('status','ready','versionId',version.id,'configuration',configuration,'sourceId',source.id,
  'connectionId',connection.id,'oldSelection',jsonb_build_object('mappings',bindings),'row',row_value);
end $$;

create function public.preview_sportlink_season_switch_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare prepared jsonb;version public.dynamic_slide_versions%rowtype;projection jsonb;preview_state text:='blocked';
 message text;can_apply boolean:=false;reasons jsonb:='[]';impact jsonb;data_items integer;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')
  or not private.has_tenant_capability(p_tenant_id,case when p_input->>'resourceKind'='matchday_runbook'
   then'tenant.playlist.read'else'tenant.dynamic_slide.read'end)
  or not exists(select 1 from public.tenants where id=p_tenant_id and status in('active','paused'))then
  raise exception 'season preview read permission required'using errcode='42501';end if;
 perform private.assert_sportlink_season_input_s301_v1(p_input,false);
 if p_input->>'resourceKind'='matchday_runbook'then return private.sportlink_season_runbook_preview_s301_v1(p_tenant_id,p_input);end if;
 prepared:=private.sportlink_season_prepare_s301_v1(p_tenant_id,p_input);
 impact:=private.sportlink_season_impact_s301_v1(p_tenant_id,(p_input->>'resourceId')::uuid)-'reviewHash';
 if prepared->>'status'<>'ready'then message:=prepared->>'reason';reasons:=jsonb_build_array(message);
 elsif not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')
  or not exists(select 1 from public.tenants where id=p_tenant_id and status='active')then
  message:='De bestaande inhoudscontrole en conceptbewerking vereisen schrijfrechten en een actieve club.';reasons:=jsonb_build_array(message);
 else
  select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=(prepared->>'versionId')::uuid;
  can_apply:=true;
  begin
   projection:=public.preview_dynamic_slide_v1(p_tenant_id,version.name,version.template_version_id,
    version.data_source_id,prepared->'configuration');
   data_items:=jsonb_array_length(coalesce(projection#>'{data,sport,items}','[]'));
   select data_items+coalesce(sum(jsonb_array_length(coalesce(projection#>array['data','sport','matchday',dataset,'items'],'[]'))),0)::integer
    into data_items from unnest(array['results','poolResults','standings','fixtures'])dataset;
   preview_state:=case when data_items=0 then'empty'else'ready'end;
   if preview_state='empty'then message:='De bronidentiteit is geldig; deze selectie bevat momenteel geen zichtbare records. Bestaande publicatiegates blijven gelden.';end if;
  exception when others then
   projection:=null;preview_state:='unavailable';
   message:='De bestaande inhoudscontrole is tijdelijk niet beschikbaar. Het concept kan alleen via de bestaande authoringvalidatie worden opgeslagen; publiceren vraagt een geslaagde preflight.';
  end;
 end if;
 return jsonb_build_object('schemaVersion',1,'resourceKind','dynamic_slide','resourceId',p_input->'resourceId',
  'oldSelection',prepared->'oldSelection','newSelection',p_input->'newSelection','basisVersionId',p_input->'basisVersionId',
  'expectedRevision',p_input->'expectedRevision','oldBindingHash',p_input->'oldBindingHash','contextHash',p_input->'contextHash',
  'canApply',can_apply,'reasons',reasons,'preview',jsonb_build_object('state',preview_state,'data',projection,'message',message),
  'impact',impact,'clearsSelectedMatches',false,'links',private.sportlink_season_links_s301_v1(p_tenant_id,(p_input->>'resourceId')::uuid));
end $$;

-- The established Publisher receipt schema and request hash are reused. Its
-- general completion helper does not return the generated primary key; this
-- scoped variant allocates that key first so the public acknowledgement, audit
-- and stored replay contain the same real receipt identity without later edits.
create function private.complete_sportlink_season_command_s301_v1(
 p_tenant_id uuid,p_input jsonb,p_target_type text,p_target_id uuid,p_result jsonb,p_old_selection jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt_id uuid:=gen_random_uuid();audit_id uuid;result jsonb:=p_result||jsonb_build_object('receiptId',receipt_id);
begin
 audit_id:=private.audit_event(p_tenant_id,'sportlink.season.draft.applied',p_target_type,p_target_id,
  case when result->>'status'='applied'then'success'else'failed'end,jsonb_build_object(
   'commandType','sportlink.season.draft.apply','idempotencyKey',p_input->'requestId',
   'correlationId',p_input->'correlationId','oldBindingHash',p_input->'oldBindingHash','contextHash',p_input->'contextHash',
   'oldSelection',p_old_selection,'newSelection',p_input->'newSelection','outcome',result));
 insert into public.publisher_command_receipts(id,tenant_id,actor_user_id,idempotency_key,command_type,request_hash,
  target_type,target_id,outcome_json,audit_event_id)values(receipt_id,p_tenant_id,private.current_user_id(),
  (p_input->>'requestId')::uuid,'sportlink.season.draft.apply',private.sportlink_season_hash_s301_v1(p_input),
  p_target_type,p_target_id,result,audit_id);
 return result;
end $$;

create function public.apply_sportlink_season_switch_draft_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prepared jsonb;replay jsonb;result jsonb;saved jsonb;forked jsonb;
 slide public.dynamic_slides%rowtype;version public.dynamic_slide_versions%rowtype;draft_version public.dynamic_slide_versions%rowtype;
 source_id uuid;connection_id uuid;draft_id uuid;revision bigint;status text;reason text;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')
  or not private.has_tenant_capability(p_tenant_id,case when p_input->>'resourceKind'='matchday_runbook'
   then'tenant.playlist.write'else'tenant.dynamic_slide.write'end)then
  raise exception 'season draft write permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 perform private.assert_sportlink_season_input_s301_v1(p_input,true);
 -- Matching retries return before resource revision, active-draft and current
 -- normalized-source checks; a changed body under this nonce is a conflict.
 replay:=private.begin_publisher_command(p_tenant_id,'sportlink.season.draft.apply',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 if p_input->>'resourceKind'='matchday_runbook'then
  result:=private.sportlink_season_runbook_apply_s301_v1(p_tenant_id,p_input);
  return private.complete_sportlink_season_command_s301_v1(p_tenant_id,p_input,'matchday_runbooks',
   (p_input->>'resourceId')::uuid,result,null);
 end if;
 select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=(p_input->>'resourceId')::uuid for update;
 if slide.id is null then raise exception 'season resource outside tenant'using errcode='42501';end if;
 select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and dynamic_slide_id=slide.id
  and id=coalesce(slide.active_draft_version_id,slide.current_published_version_id)for update;
 source_id:=version.data_source_id;
 select id into connection_id from public.sportlink_connections where tenant_id=p_tenant_id and data_source_id=source_id;
 -- Use the worker's club/team -> connection/source lock order. Shared row
 -- locks retain exact normalized candidates until the authoring transaction ends.
 perform id from public.sports_clubs where tenant_id=p_tenant_id and source_connection_id=connection_id order by id for share;
 perform id from public.sports_teams where tenant_id=p_tenant_id and source_connection_id=connection_id order by id for share;
 perform id from public.sportlink_connections where tenant_id=p_tenant_id and id=connection_id for share;
 perform id from public.dynamic_data_sources where tenant_id=p_tenant_id and id=source_id for share;
 prepared:=private.sportlink_season_prepare_s301_v1(p_tenant_id,p_input);
 status:=prepared->>'status';reason:=prepared->>'reason';
 if status='ready'then
  begin
   if version.status='draft'then draft_id:=version.id;revision:=version.edit_revision;
   else
    -- The screen/slide lock and prepare check guarantee that this call cannot
    -- silently resume another user's newly created draft.
    forked:=public.create_or_resume_dynamic_slide_version_v1(slide.id,version.id);
    if forked->>'outcome'<>'created'then raise exception 'draft fork conflict'using errcode='40001';end if;
    draft_id:=(forked->>'versionId')::uuid;
    -- The original materialization triggers can advance edit_revision after
    -- the fork's local RETURNING row was captured. Reload this exact new draft;
    -- this is not permission to resume any pre-existing concurrent draft.
    select *into draft_version from public.dynamic_slide_versions where tenant_id=p_tenant_id
     and dynamic_slide_id=slide.id and id=draft_id for update;
    if draft_version.status is distinct from'draft'or draft_version.based_on_version_id is distinct from version.id
     or not exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id and id=slide.id and active_draft_version_id=draft_id)then
     raise exception 'draft fork identity conflict'using errcode='40001';end if;
    revision:=draft_version.edit_revision;
   end if;
   saved:=public.save_dynamic_slide_version_v1(slide.id,draft_id,revision,version.name,version.template_version_id,
    version.data_source_id,version.orientation,version.selection_mode,prepared->'configuration',version.theme_selection_json);
   if saved->>'outcome'<>'applied'then raise exception 'draft save conflict'using errcode='40001';end if;
   select edit_revision into revision from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=draft_id;
   status:='applied';reason:=null;
  exception
   when serialization_failure then status:='conflict';draft_id:=null;revision:=null;
    reason:='Het concept is tijdens het opslaan gewijzigd. Controleer deze rij opnieuw.';
   when check_violation or invalid_parameter_value or no_data_found or insufficient_privilege then
    status:='blocked';draft_id:=null;revision:=null;
    reason:='De bestaande authoringvalidatie weigert deze conceptwijziging. Er is niets gedeeltelijk opgeslagen; open het ontwerp voor controle.';
  end;
 end if;
 result:=jsonb_build_object('schemaVersion',1,'status',status,'resourceKind','dynamic_slide','resourceId',slide.id,
  'requestId',p_input->'requestId','correlationId',p_input->'correlationId','receiptId',null,
  'previousVersionId',p_input->'basisVersionId','draftVersionId',draft_id,'previousRevision',p_input->'expectedRevision',
  'newRevision',revision,'reason',reason,'links',private.sportlink_season_links_s301_v1(p_tenant_id,slide.id));
 return private.complete_sportlink_season_command_s301_v1(p_tenant_id,p_input,'dynamic_slides',slide.id,result,prepared->'oldSelection');
end $$;

-- Helpers are implementation details, never alternate browser entrypoints.
do $acl$
declare proc record;
begin
 for proc in select oid from pg_proc where pronamespace='private'::regnamespace and proname like '%\_s301\_v1'escape'\'loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',proc.oid::regprocedure);
 end loop;
end $acl$;
revoke all on function public.get_sportlink_season_switch_inventory_v1(uuid,uuid,text,jsonb,text,integer),
 public.preview_sportlink_season_switch_v1(uuid,jsonb),public.apply_sportlink_season_switch_draft_v1(uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.get_sportlink_season_switch_inventory_v1(uuid,uuid,text,jsonb,text,integer),
 public.preview_sportlink_season_switch_v1(uuid,jsonb),public.apply_sportlink_season_switch_draft_v1(uuid,jsonb)to authenticated;
notify pgrst,'reload schema';
