begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

-- Keep today's fixtures genuinely before/after kickoff at any test execution time.
create function pg_temp.match_time_today(p_time time, p_finished boolean)
returns timestamptz language sql stable as $$
  select case when p_finished
    then day_start + (now() - day_start) * (extract(epoch from p_time) / 86400)::double precision
    else now() + (day_end - now()) * (extract(epoch from p_time) / 86400)::double precision
  end
  from (select
    (now() at time zone 'Europe/Amsterdam')::date::timestamp at time zone 'Europe/Amsterdam' as day_start,
    ((now() at time zone 'Europe/Amsterdam')::date + 1)::timestamp at time zone 'Europe/Amsterdam' as day_end
  ) bounds
$$;


select plan(25);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000002601',
  'authenticated',
  'authenticated',
  's191source-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000002601',
  'S191 source owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000002601',
  'S191 source tenant',
  's191source-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000002601'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000002601',
  '00000000-0000-4000-8000-000000002601',
  'tenant_owner'
);

create temporary table s191source_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s191source_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002601', true);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000002601',
  'Sportlink · S191 source',
  'S191 source',
  '1581',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s191source_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000002601'
  and source.name = 'Sportlink · S191 source';

insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, active, metadata
) values
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-selected',
    'S191 source geselecteerd team',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-club-comp",
          "name":"S191 source clubcompetitie",
          "period":"s191source-club-phase",
          "poolExternalId":"s191source-club-pool",
          "poolName":"S191 source clubpoule",
          "season":"2026"
        },
        {
          "externalId":"s191source-pool-comp",
          "name":"S191 source poulecompetitie",
          "period":"s191source-pool-phase",
          "poolExternalId":"s191source-pool-exact",
          "poolName":"S191 source exacte poule",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-other-own',
    'S191 source ander eigen team',
    true,
    '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-ambiguous',
    'S191 source team met ambigue poule',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-amb-comp-a",
          "name":"S191 source ambigu A",
          "period":"s191source-amb-phase-a",
          "poolExternalId":"s191source-amb-pool-a",
          "poolName":"S191 source ambigue poule A",
          "season":"2026"
        },
        {
          "externalId":"s191source-amb-comp-b",
          "name":"S191 source ambigu B",
          "period":"s191source-amb-phase-b",
          "poolExternalId":"s191source-amb-pool-b",
          "poolName":"S191 source ambigue poule B",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-metadata-ambiguous',
    'S191 source team met alleen ambigue metadata',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-meta-comp-a",
          "period":"s191source-meta-phase-a",
          "poolExternalId":"s191source-meta-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s191source-meta-comp-b",
          "period":"s191source-meta-phase-b",
          "poolExternalId":"s191source-meta-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-standing-ambiguous',
    'S191 source team met ambigue standen',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-standing-comp-a",
          "period":"s191source-standing-phase-a",
          "poolExternalId":"s191source-standing-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s191source-standing-comp-b",
          "period":"s191source-standing-phase-b",
          "poolExternalId":"s191source-standing-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-pinned-ambiguous',
    'S191 source team met ambigue pinned context',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-pinned-comp",
          "period":"s191source-pinned-phase-a",
          "poolExternalId":"s191source-pinned-pool",
          "season":"2025"
        },
        {
          "externalId":"s191source-pinned-comp",
          "period":"s191source-pinned-phase-b",
          "poolExternalId":"s191source-pinned-pool",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000002601',
    (select connection_id from s191source_source),
    's191source-priority',
    'S191 source team met één actuele poule',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s191source-priority-comp-a",
          "period":"s191source-priority-phase-a",
          "poolExternalId":"s191source-priority-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s191source-priority-comp-b",
          "period":"s191source-priority-phase-b",
          "poolExternalId":"s191source-priority-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  );

create temporary table s191source_created (
  name text primary key,
  result jsonb not null
);
grant select, insert on s191source_created to authenticated;

create function pg_temp.s191source_context(
  p_team_id text,
  p_selection_mode text,
  p_competition_id text default null,
  p_phase_id text default null,
  p_pool_id text default null,
  p_season_id text default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'competitionId', case when p_selection_mode = 'pinned'
      then p_competition_id end,
    'competitionSelectionMode', p_selection_mode,
    'phaseId', case when p_selection_mode = 'pinned' then p_phase_id end,
    'poolId', case when p_selection_mode = 'pinned' then p_pool_id end,
    'providerTeamId', p_team_id,
    'seasonId', case when p_selection_mode = 'pinned' then p_season_id end
  )
$$;

create function pg_temp.s191source_draft(
  p_name text,
  p_blueprint text,
  p_team_id text,
  p_selection_mode text,
  p_competition_id text,
  p_phase_id text,
  p_pool_id text,
  p_season_id text,
  p_match_location text,
  p_display jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  context jsonb;
  draft jsonb;
  template_version_id uuid;
begin
  context := pg_temp.s191source_context(
    p_team_id,
    p_selection_mode,
    p_competition_id,
    p_phase_id,
    p_pool_id,
    p_season_id
  );

  select version.id
  into template_version_id
  from public.dynamic_template_versions version
  join public.dynamic_templates template
    on template.id = version.template_id
  where template.slide_type = case when p_blueprint like '%results%'
      then 'sport_results'
      else 'sport_program'
    end
    and template.orientation = 'landscape'
    and template.status = 'published'
    and version.status = 'published'
    and template.current_published_version_id = version.id
  order by template.slug
  limit 1;

  draft := pg_catalog.jsonb_build_object(
    'blueprintKey', p_blueprint,
    'context', context,
    'display', coalesce(p_display, '{}'::jsonb),
    'name', p_name,
    'orientation', 'landscape',
    'templateVersionId', template_version_id,
    'themeSelection', '{
      "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
      "modePolicy":{"kind":"fixed","mode":"light"},
      "accent":null,
      "support":null,
      "categoryOverrides":[]
    }'::jsonb,
    'title', p_name
  );

  if p_blueprint like 'sportlink.club_%' then
    draft := draft || pg_catalog.jsonb_build_object(
      'teamSelection', pg_catalog.jsonb_build_object(
        'matchLocation', p_match_location,
        'mode', 'selected',
        'teamContexts', pg_catalog.jsonb_build_array(context)
      )
    );
  end if;

  return draft;
end;
$$;

create function pg_temp.s191source_create_slide(
  p_name text,
  p_blueprint text,
  p_team_id text,
  p_selection_mode text,
  p_competition_id text,
  p_phase_id text,
  p_pool_id text,
  p_season_id text,
  p_match_location text,
  p_display jsonb,
  p_idempotency_key uuid
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select public.create_sportlink_slide_batch_v5(
    '10000000-0000-4000-8000-000000002601',
    (select source.data_source_id from pg_temp.s191source_source source),
    pg_catalog.jsonb_build_array(pg_temp.s191source_draft(
      p_name,
      p_blueprint,
      p_team_id,
      p_selection_mode,
      p_competition_id,
      p_phase_id,
      p_pool_id,
      p_season_id,
      p_match_location,
      p_display
    )),
    p_idempotency_key
  )
$$;

grant execute on function pg_temp.s191source_context(
  text, text, text, text, text, text
) to authenticated;
grant execute on function pg_temp.s191source_draft(
  text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;
grant execute on function pg_temp.s191source_create_slide(
  text, text, text, text, text, text, text, text, text, jsonb, uuid
) to authenticated;
reset role;
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,rows_json,metadata,scores_published,active,last_synced_at)
values('10000000-0000-4000-8000-000000002601',(select connection_id from pg_temp.s191source_source),'s191source-standing','s191source-pool-exact','2026','[{"externalId":"s191source-selected","name":"Synthetic source team","position":1,"played":3,"points":7}]','{"competition":{"externalId":"s191source-pool-comp","period":"s191source-pool-phase"},"pool":{"externalId":"s191source-pool-exact"}}',true,true,now());
select is((select count(*)from(select distinct template.slide_type,template.orientation from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id where template.slide_type like'sport_%'and template.status='published'and version.status='published' )registry),34::bigint,'the actual published wizard registry provides all seventeen families in both formats');
select ok(not exists(select 1 from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id where template.slug like'editorial-arena-sites-%'and(template.status<>'published'or version.status<>'published'or version.manifest_json->>'slideType'<>template.slide_type or jsonb_array_length(version.sample_data_json#>'{sport,items}')<>0 or version.markup~'class="(crest|crestText|kicker|eyebrow)"'or version.source_checksum_sha256<>encode(extensions.digest(pg_catalog.convert_to(version.markup||version.css||version.manifest_json::text,'UTF8'),'sha256'),'hex'))),'real additional canonical templates have typed manifests, verified checksums, empty provider samples and no placeholder crest');
select set_config('test.s191source_design','{"schemaVersion":1,"rendererVersion":"sites-v11","sourceRevision":"b1cae899af19fc39908217253094c5240d7359fc","themeId":"onzetrots-tv","orientation":"landscape","provider":"sportlink","title":"Onze teams","subtitle":"Actuele clubgegevens","overlay":65,"accent":"#FF8127","layout":"full","scale":100,"align":"left","safeArea":6,"seconds":15,"rowsPerPage":4,"ledTheme":"blue","ledMoment":"live","ledSide":"own","titleScale":100,"scoreScale":100,"logoScale":100,"teamScale":100,"showBranding":true,"showSceneLabel":true,"showClock":true,"showTimeline":true,"timelineLimit":5,"backgroundFit":"cover","grunge":35,"animation":"fade"}',true);
create temporary table s191source_family_results(slide_type text not null,orientation text not null,slide_id uuid not null,snapshot_id uuid not null,primary key(slide_type,orientation));
grant select,insert on s191source_family_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002601',true);
select set_config('test.s191source_draft',(pg_temp.s191source_draft('Sites clubprogramma','sportlink.club_schedule_today','s191source-selected','auto_current',null,null,null,null,'both','{}')||jsonb_build_object('sitesConfiguration',current_setting('test.s191source_design')::jsonb))::text,true);
select set_config('test.s191source_batch',public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(current_setting('test.s191source_draft')::jsonb),'50000000-0000-4000-8000-000000002601')::text,true);
select is((current_setting('test.s191source_batch')::jsonb->>'count')::integer,1,'typed batch creates exactly one real source design');
select is((select configuration_json->'sitesConfiguration' from public.dynamic_slides where id=(current_setting('test.s191source_batch')::jsonb#>>'{slides,0,slideId}')::uuid),current_setting('test.s191source_design')::jsonb,'real save and reload preserve the full authored Sites configuration');
select is((select snapshot_data_json->'sitesConfiguration' from public.dynamic_slide_snapshots where id=(current_setting('test.s191source_batch')::jsonb#>>'{slides,0,snapshotId}')::uuid),current_setting('test.s191source_design')::jsonb,'the first immutable snapshot already contains the authored design');
select is(public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(current_setting('test.s191source_draft')::jsonb),'50000000-0000-4000-8000-000000002601'),current_setting('test.s191source_batch')::jsonb,'idempotent retry returns the same design and snapshot IDs');
select throws_ok($$select public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(jsonb_set(current_setting('test.s191source_draft')::jsonb,'{sitesConfiguration,title}','"Gewijzigd ontwerp"'::jsonb)),'50000000-0000-4000-8000-000000002601')$$,'23505',null,'idempotency compares the full Sites configuration rather than only legacy draft fields');
select is((select count(*) from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000002601'),1::bigint,'retry does not create authoring versions or design churn');
reset role;
select is((select count(*) from private.sportlink_sites_batch_context_v1),0::bigint,'successful and replayed batches leave no private transaction context');
select ok(not has_table_privilege('authenticated','private.sportlink_sites_batch_context_v1','insert') and not has_table_privilege('service_role','private.sportlink_sites_batch_context_v1','insert'),'browser and service clients cannot forge a transaction authoring context');
select ok(not has_function_privilege('authenticated','public.create_dynamic_slide_before_s191_sites_source_v1(uuid,text,uuid,uuid,text,jsonb)','execute'),'browser roles cannot bypass the full Sites guard through the historical create function');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002601',true);
select throws_ok($$select public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(jsonb_set(current_setting('test.s191source_draft')::jsonb,'{sitesConfiguration,provider}','"menu"'::jsonb)),'50000000-0000-4000-8000-000000002602')$$,'23514',null,'source batch rejects the wrong typed provider');
select throws_ok($$select public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(jsonb_set(current_setting('test.s191source_draft')::jsonb,'{sitesConfiguration,orientation}','"portrait"'::jsonb)),'50000000-0000-4000-8000-000000002602')$$,'23514',null,'source batch rejects mismatched orientation');
select throws_ok($$select public.create_sportlink_slide_batch_v7('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),jsonb_build_array(jsonb_set(current_setting('test.s191source_draft')::jsonb,'{sitesConfiguration,html}','"<script>bad</script>"'::jsonb,true)),'50000000-0000-4000-8000-000000002602')$$,'23514',null,'source batch rejects executable or untyped configuration fields');
-- Read-only preview uses precisely the existing canonical DB builder; no source
-- records, snapshots, authoring versions or render jobs are created.
select set_config('test.s191source_counts',(select jsonb_build_array((select count(*)from public.dynamic_slides),(select count(*)from public.dynamic_slide_snapshots),(select count(*)from public.dynamic_render_jobs))::text),true);
select set_config('test.s191source_preview',public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000002601','Echt bronvoorbeeld',(current_setting('test.s191source_draft')::jsonb->>'templateVersionId')::uuid,(select data_source_id from pg_temp.s191source_source),jsonb_build_object('schemaVersion',1,'blueprintKey','sportlink.club_schedule_today','context',current_setting('test.s191source_draft')::jsonb->'context','teamSelection',current_setting('test.s191source_draft')::jsonb->'teamSelection','sitesConfiguration',current_setting('test.s191source_design')::jsonb))::text,true);
select is(current_setting('test.s191source_preview')::jsonb#>'{data,sitesConfiguration}',current_setting('test.s191source_design')::jsonb,'read-only provider preview uses the exact canonical Sites configuration');
select is((select jsonb_build_array((select count(*)from public.dynamic_slides),(select count(*)from public.dynamic_slide_snapshots),(select count(*)from public.dynamic_render_jobs))),current_setting('test.s191source_counts')::jsonb,'read-only preview creates no designs, snapshots, versions or render jobs');
reset role;
update public.sportlink_connections set privacy_birthdays_enabled=true where tenant_id='10000000-0000-4000-8000-000000002601';
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason)values('10000000-0000-4000-8000-000000002601','sportlink_birthdays',true,'Explicit synthetic birthday fixture')on conflict(tenant_id,flag_key)do update set enabled=true;
update public.sportlink_sync_policies set last_success_at=now()where tenant_id='10000000-0000-4000-8000-000000002601'and dataset_group='public_people';
insert into public.sportlink_capabilities(tenant_id,connection_id,article_key,capability,sensitivity,available,enabled,last_status_code)values('10000000-0000-4000-8000-000000002601',(select connection_id from pg_temp.s191source_source),'verjaardagen','birthdays','public_people_minimized',true,true,200)on conflict(tenant_id,connection_id,article_key)do update set available=true,last_status_code=200;
select set_config('test.s191source_familycfg',jsonb_build_object('schemaVersion',1,'title','Onze teams','context',current_setting('test.s191source_draft')::jsonb->'context','teamSelection',current_setting('test.s191source_draft')::jsonb->'teamSelection','maxItems',200,'display','{"columns":"one","showDressingRoom":false,"showField":true,"showHomeAway":true,"showLogo":true,"showReferee":false}'::jsonb,'editorial',jsonb_build_object('schemaVersion',2,'themeSelection',current_setting('test.s191source_draft')::jsonb->'themeSelection'),'sitesConfiguration',current_setting('test.s191source_design')::jsonb)::text,true);
select set_config('test.s191source_birthdaycfg','{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"presentation":{"pageDurationSeconds":8,"maxPerLandscapePage":6,"maxPerPortraitPage":6,"layout":"auto"},"selection":{"teamSelectionMode":"all","selectedTeamIds":[],"includeWithoutTeam":true}}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002601',true);
reset role;
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,active,metadata)
select '10000000-0000-4000-8000-000000002601',(select connection_id from pg_temp.s191source_source),'s191source-prefix-'||value,'AAA Synthetic prefix '||lpad(value::text,2,'0'),true,'{}'::jsonb from generate_series(1,45)value;
update public.sports_teams set metadata=metadata||'{"trainingSchedule":"Synthetic training Monday","sponsorName":"Synthetic selected sponsor","sponsorTagline":"Synthetic fixture only"}'::jsonb where tenant_id='10000000-0000-4000-8000-000000002601'and external_id='s191source-selected';
set local role authenticated;
-- All seventeen canonical Sportlink families use the same guarded create path.
-- Check the collection once rather than repeating an identical assertion per type.
do $$declare family text;shape text;template uuid;result jsonb;cfg jsonb;begin
 foreach family in array array['sport_program','sport_results','sport_standing','sport_period_standing','sport_match_of_the_day','sport_next_match','sport_cancellations','sport_dressing_rooms','sport_officials','sport_team','sport_sponsor','sport_activities','sport_trainings','sport_volunteers','sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals'] loop
 foreach shape in array array['landscape','portrait']loop
 select version.id into template from public.dynamic_template_versions version join public.dynamic_templates definition on definition.id=version.template_id where definition.slide_type=family and definition.orientation=shape  and definition.status='published' and version.status='published' and definition.current_published_version_id=version.id order by definition.slug limit 1;
 if template is null then raise exception 'required family template missing: %',family;end if;
 cfg:=jsonb_set(current_setting('test.s191source_familycfg')::jsonb,'{sitesConfiguration,orientation}',to_jsonb(shape));
 result:=public.create_sites_sportlink_family_v1('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),'Sites '||family||' '||shape,template,cfg||case when family='sport_birthdays'then jsonb_build_object('birthday',current_setting('test.s191source_birthdaycfg')::jsonb)else'{}'::jsonb end,gen_random_uuid());
 insert into pg_temp.s191source_family_results values(family,shape,(result->>'slideId')::uuid,(result->>'snapshotId')::uuid);
 end loop;end loop;
end$$;
select is((select count(*)from pg_temp.s191source_family_results),34::bigint,'all seventeen typed Sportlink families save through the real create path in both formats');
select ok(not exists(select 1 from pg_temp.s191source_family_results result join public.dynamic_slides slide on slide.id=result.slide_id join public.dynamic_slide_snapshots snapshot on snapshot.id=result.snapshot_id where slide.configuration_json->'sitesConfiguration' is distinct from jsonb_set(current_setting('test.s191source_design')::jsonb,'{orientation}',to_jsonb(result.orientation)) or snapshot.snapshot_data_json->'sitesConfiguration' is distinct from jsonb_set(current_setting('test.s191source_design')::jsonb,'{orientation}',to_jsonb(result.orientation))),'every family reload and immutable snapshot retain the same full design');
select ok(not exists(select 1 from pg_temp.s191source_family_results saved join public.dynamic_slide_snapshots snapshot on snapshot.id=saved.snapshot_id where saved.slide_type in('sport_team','sport_trainings','sport_sponsor')and(snapshot.snapshot_data_json#>'{sport,items}'is distinct from case when saved.slide_type='sport_sponsor'then '[{"id":"s191source-selected","primary":"Synthetic selected sponsor","secondary":"","meta":"Synthetic fixture only","status":"published"}]'::jsonb when saved.slide_type='sport_trainings'then '[{"id":"s191source-selected","primary":"S191 source geselecteerd team","secondary":"Synthetic training Monday","meta":"","status":"published"}]'::jsonb else '[{"id":"s191source-selected","primary":"S191 source geselecteerd team","secondary":"","meta":"","status":"published"}]'::jsonb end)),'provider selection happens before the forty-row historical limit for teams, trainings and sponsors');
select throws_ok($$select public.create_sites_sportlink_family_v1('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),'Invalid provider reference',(select template_version_id from public.dynamic_slides where id=(select slide_id from pg_temp.s191source_family_results where slide_type='sport_trainings'and orientation='landscape')),jsonb_set(current_setting('test.s191source_familycfg')::jsonb,'{teamSelection,teamContexts,0,providerTeamId}','"not-in-this-source"'),gen_random_uuid())$$,'23514',null,'family commands reject references outside the actual provider source');
select set_config('test.s191source_familyretry',public.create_sites_sportlink_family_v1('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),'Retry family',(select template_version_id from public.dynamic_slides where id=(select slide_id from pg_temp.s191source_family_results where slide_type='sport_trainings'and orientation='landscape')),current_setting('test.s191source_familycfg')::jsonb,'50000000-0000-4000-8000-000000002611')::text,true);
select is(public.create_sites_sportlink_family_v1('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),'Retry family',(select template_version_id from public.dynamic_slides where id=(select slide_id from pg_temp.s191source_family_results where slide_type='sport_trainings'and orientation='landscape')),current_setting('test.s191source_familycfg')::jsonb,'50000000-0000-4000-8000-000000002611'),current_setting('test.s191source_familyretry')::jsonb,'retry returns the same first immutable family snapshot and design IDs');
reset role;
update public.sportlink_connections set privacy_birthdays_enabled=false where tenant_id='10000000-0000-4000-8000-000000002601';
set local role authenticated;
select throws_ok($$select public.create_sites_sportlink_family_v1('10000000-0000-4000-8000-000000002601',(select data_source_id from pg_temp.s191source_source),'Privacy disabled birthday',(select template_version_id from public.dynamic_slides where id=(select slide_id from pg_temp.s191source_family_results where slide_type='sport_birthdays'and orientation='landscape')),current_setting('test.s191source_familycfg')::jsonb||jsonb_build_object('birthday',current_setting('test.s191source_birthdaycfg')::jsonb),gen_random_uuid())$$,'55000',null,'Sites birthday save retains the established explicit privacy gate');
select is((select count(*)from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000002601'),36::bigint,'rejected source and privacy checks create no authoring or render versions');
reset role;
select is((select count(*)from private.sportlink_sites_batch_context_v1),0::bigint,'rejected inputs and independent source saves leave no forged context');
select is((select count(*)from public.publisher_command_receipts where tenant_id='10000000-0000-4000-8000-000000002601'and command_type='sportlink.sites.family'),35::bigint,'all seventeen actual family commands have idempotent saved receipts');
select * from finish();
rollback;
