begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(62);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-4000-8000-000000001531',
    'authenticated', 'authenticated', 's153-owner-a@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001532',
    'authenticated', 'authenticated', 's153-owner-b@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001531', 'S153 owner A'),
  ('00000000-0000-4000-8000-000000001532', 'S153 owner B');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001531', 'S153 tenant A', 's153-tenant-a'),
  ('10000000-0000-4000-8000-000000001532', 'S153 tenant B', 's153-tenant-b');

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001531'),
  ('10000000-0000-4000-8000-000000001532');

select is(
  (
    select count(*)
    from public.tenant_theme_profiles
    where tenant_id in (
      '10000000-0000-4000-8000-000000001531'::uuid,
      '10000000-0000-4000-8000-000000001532'::uuid
    )
      and theme_id = 'fieldflow'
  ),
  2::bigint,
  'tenant settings bootstrap a FieldFlow theme profile for every new tenant'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values
  (
    '10000000-0000-4000-8000-000000001531',
    '00000000-0000-4000-8000-000000001531',
    'tenant_owner'
  ),
  (
    '10000000-0000-4000-8000-000000001532',
    '00000000-0000-4000-8000-000000001532',
    'tenant_owner'
  );

create temporary table s153_theme_values (
  name text primary key,
  value jsonb not null
);

insert into s153_theme_values (name, value) values
  (
    'selection',
    '{
      "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
      "modePolicy":{"kind":"fixed","mode":"light"},
      "accent":null,
      "support":null,
      "categoryOverrides":[]
    }'::jsonb
  ),
  (
    'appearance',
    '{
      "schemaVersion":1,
      "surfaces":{
        "clubLogoBackground":"#E7F5EE",
        "homeLogoBackground":"#FFFFFF"
      },
      "typography":{
        "baseScale":1,
        "bodyFontRef":"vc-inter-v1",
        "displayFontRef":"vc-manrope-v1",
        "sportScale":1.12
      }
    }'::jsonb
  );
grant select on s153_theme_values to authenticated;

insert into public.tenant_theme_profiles (
  tenant_id, theme_id, theme_version, selection_json, color_overrides,
  appearance_config, updated_by
)
select
  tenant_id,
  'fieldflow',
  '1.0.0',
  (select value from s153_theme_values where name = 'selection'),
  '{}'::jsonb,
  (select value from s153_theme_values where name = 'appearance'),
  case tenant_id
    when '10000000-0000-4000-8000-000000001531'::uuid
      then '00000000-0000-4000-8000-000000001531'::uuid
    else '00000000-0000-4000-8000-000000001532'::uuid
  end
from unnest(array[
  '10000000-0000-4000-8000-000000001531'::uuid,
  '10000000-0000-4000-8000-000000001532'::uuid
]) tenant_id
on conflict (tenant_id, theme_id) do update
set theme_version = excluded.theme_version,
    selection_json = excluded.selection_json,
    color_overrides = excluded.color_overrides,
    appearance_config = excluded.appearance_config,
    updated_by = excluded.updated_by;

select has_table(
  'public',
  'tenant_theme_profiles',
  'theme-scoped tenant profiles have a dedicated table'
);

select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_catalog.pg_class relation
    where relation.oid = 'public.tenant_theme_profiles'::regclass
  ),
  'theme profiles enable and force row-level security'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.theme_appearance_settings_is_valid_v1(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.theme_appearance_settings_is_valid_v1(jsonb)',
    'EXECUTE'
  ),
  'the private appearance validator is not Data API executable'
);

select ok(
  private.theme_appearance_settings_is_valid_v1(
    (select value from s153_theme_values where name = 'appearance')
  ),
  'the curated typography, scale and logo-surface payload is valid'
);

select ok(
  not private.theme_appearance_settings_is_valid_v1(
    jsonb_set(
      (select value from s153_theme_values where name = 'appearance'),
      '{typography,displayFontRef}',
      '"untrusted-font"'::jsonb
    )
  ),
  'an uncurated font reference is rejected by appearance validation'
);

select throws_ok(
  $$update public.tenant_theme_profiles
    set appearance_config = jsonb_set(
      appearance_config,
      '{typography,sportScale}',
      '4'::jsonb
    )
    where tenant_id = '10000000-0000-4000-8000-000000001531'$$,
  '23514',
  null,
  'the table constraint rejects an out-of-range sports scale'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);

select is(
  (select count(*) from public.tenant_theme_profiles),
  1::bigint,
  'tenant A sees exactly its own theme profile'
);

select is(
  (
    select count(*)
    from public.tenant_theme_profiles
    where tenant_id = '10000000-0000-4000-8000-000000001532'
  ),
  0::bigint,
  'tenant A cannot read tenant B theme settings'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001532',
  true
);
select is(
  (select count(*) from public.tenant_theme_profiles),
  1::bigint,
  'tenant B independently sees exactly its own theme profile'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
select lives_ok(
  $$select public.upsert_sportlink_connection_v1(
    '10000000-0000-4000-8000-000000001531',
    'Sportlink · S153 club',
    'S153 club',
    '1531',
    'encrypted-value',
    'initialization-vector',
    'authentication-tag'
  )$$,
  'tenant A can prepare its own active Sportlink source'
);

reset role;

insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, metadata
)
select
  '10000000-0000-4000-8000-000000001531',
  connection.id,
  's153-team-' || lpad(team_number::text, 2, '0'),
  'S153 team ' || team_number,
  '{}'::jsonb
from generate_series(1, 30) team_number
cross join lateral (
  select id
  from public.sportlink_connections
  where tenant_id = '10000000-0000-4000-8000-000000001531'
  limit 1
) connection;

create temporary table s153_team_contexts (value jsonb not null);
insert into s153_team_contexts (value)
select jsonb_agg(
  jsonb_build_object(
    'competitionId', null,
    'competitionSelectionMode', 'auto_current',
    'phaseId', null,
    'poolId', null,
    'providerTeamId', 's153-team-' || lpad(team_number::text, 2, '0'),
    'seasonId', null
  )
  order by team_number
)
from generate_series(1, 30) team_number;
grant select on s153_team_contexts to authenticated;

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match
)
select
  '10000000-0000-4000-8000-000000001531', connection.id,
  's153-fixture-' || lpad(fixture_number::text, 3, '0'),
  (date_trunc('day', statement_timestamp() at time zone connection.timezone)
    + interval '1 day' + make_interval(mins => fixture_number))
    at time zone connection.timezone,
  'scheduled',
  jsonb_build_object(
    'externalId', 's153-team-' || lpad((((fixture_number - 1) % 30) + 1)::text, 2, '0'),
    'name', 'S153 team ' || (((fixture_number - 1) % 30) + 1)
  ),
  jsonb_build_object(
    'externalId', 's153-opponent-' || lpad(fixture_number::text, 3, '0'),
    'name', 'S153 tegenstander ' || fixture_number
  ),
  jsonb_build_object('externalId', 's153-competition', 'name', 'S153 competitie'),
  jsonb_build_object('externalId', 's153-pool', 'name', 'S153 poule'),
  jsonb_build_object('field', 'Veld ' || fixture_number),
  '{}'::jsonb, '[]'::jsonb, false, true
from generate_series(1, 101) fixture_number
cross join lateral (
  select id, timezone
  from public.sportlink_connections
  where tenant_id = '10000000-0000-4000-8000-000000001531'
  limit 1
) connection;

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_sportlink_slide_batch_v4(uuid,uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_sportlink_slide_batch_v4(uuid,uuid,jsonb,uuid)',
    'EXECUTE'
  ),
  'only authenticated Control callers can invoke Sportlink batch v4'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);

select lives_ok(
  $$select set_config(
    'test.s153_batch_result',
    public.create_sportlink_slide_batch_v4(
      '10000000-0000-4000-8000-000000001531',
      (
        select data_source_id
        from public.sportlink_connections
        where tenant_id = '10000000-0000-4000-8000-000000001531'
        limit 1
      ),
      jsonb_build_array(jsonb_build_object(
        'blueprintKey', 'sportlink.club_schedule_next_7_days',
        'context', (select value -> 0 from s153_team_contexts),
        'name', 'S153 clubprogramma',
        'orientation', 'landscape',
        'teamSelection', jsonb_build_object(
          'mode', 'selected',
          'teamContexts', (select value from s153_team_contexts)
        ),
        'templateVersionId', (
          select template.current_published_version_id
          from public.dynamic_templates template
          where template.slide_type = 'sport_program'
            and template.orientation = 'landscape'
            and template.status = 'published'
            and template.current_published_version_id is not null
          order by template.slug
          limit 1
        ),
        'themeSelection', (
          select value from s153_theme_values where name = 'selection'
        ),
        'title', 'Clubprogramma komende 7 dagen'
      )),
      '60000000-0000-4000-8000-000000001531'
    )::text,
    true
  )$$,
  'batch v4 accepts one club slide with thirty selected teams'
);

select is(
  (
    current_setting('test.s153_batch_result')::jsonb ->> 'count'
  )::integer,
  1,
  'one club blueprint produces exactly one logical slide'
);

select is(
  (
    select count(*)
    from public.dynamic_slides
    where tenant_id = '10000000-0000-4000-8000-000000001531'
      and name = 'S153 clubprogramma'
  ),
  1::bigint,
  'the database contains no team fan-out slides'
);

select ok(
  (
    select
      configuration_json #>> '{teamSelection,mode}' = 'selected'
      and jsonb_array_length(
        configuration_json #> '{teamSelection,teamContexts}'
      ) = 30
      and configuration_json -> 'context'
        = configuration_json #> '{teamSelection,teamContexts,0}'
    from public.dynamic_slides
    where id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  ),
  'all thirty teams remain one editable filter on that slide'
);

select is(
  (
    current_setting('test.s153_batch_result')::jsonb
      #>> '{slides,0,teamCount}'
  )::integer,
  30,
  'the creation result reports every selected team beyond the old limit'
);

select is(
  (
    select jsonb_array_length(snapshot.snapshot_data_json #> '{sport,items}')
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = (
      current_setting('test.s153_batch_result')::jsonb #>> '{slides,0,snapshotId}'
    )::uuid
  ),
  100,
  'one aggregate snapshot keeps the bounded first one hundred of 101 eligible matches'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from public.dynamic_slide_snapshots snapshot
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where snapshot.id = (
      current_setting('test.s153_batch_result')::jsonb #>> '{slides,0,snapshotId}'
    )::uuid
  ),
  (
    select string_agg(
      's153-fixture-' || lpad(fixture_number::text, 3, '0'),
      ',' order by fixture_number
    )
    from generate_series(1, 100) fixture_number
  ),
  'the bounded aggregate snapshot preserves chronological match ordering'
);

reset role;

create function pg_temp.claim_s153_render_v1(
  p_slide_id uuid,
  p_worker_id text
)
returns table (
  job_id uuid,
  tenant_id uuid,
  snapshot_id uuid,
  output_media_asset_id uuid
)
language plpgsql
set search_path = ''
as $$
declare
  selected_job_id uuid;
begin
  select job.id
  into selected_job_id
  from public.dynamic_render_jobs job
  join public.dynamic_slide_snapshots snapshot
    on snapshot.tenant_id = job.tenant_id
   and snapshot.id = job.snapshot_id
  where snapshot.dynamic_slide_id = p_slide_id
    and job.status = 'queued'
  order by
    snapshot.snapshot_sequence desc nulls last,
    snapshot.created_at desc,
    snapshot.id desc,
    job.id
  for update of job skip locked
  limit 1;

  if selected_job_id is null then
    return;
  end if;

  update public.dynamic_render_jobs job
  set status = 'rendering',
      attempt_count = attempt_count + 1,
      locked_at = clock_timestamp(),
      locked_by = left(p_worker_id, 120),
      started_at = coalesce(started_at, clock_timestamp()),
      error_code = null,
      error_detail = null
  where job.id = selected_job_id;

  update public.dynamic_slide_snapshots snapshot
  set status = 'rendering'
  from public.dynamic_render_jobs job
  where job.id = selected_job_id
    and snapshot.tenant_id = job.tenant_id
    and snapshot.id = job.snapshot_id
    and snapshot.status = 'queued';

  return query
  select job.id, job.tenant_id, job.snapshot_id, job.output_media_asset_id
  from public.dynamic_render_jobs job
  where job.id = selected_job_id;
end;
$$;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table s153_render_claim as
select *
from pg_temp.claim_s153_render_v1(
  (
    current_setting('test.s153_batch_result')::jsonb
      #>> '{slides,0,slideId}'
  )::uuid,
  's153-render-worker'
);

select is(
  (select count(*) from s153_render_claim),
  1::bigint,
  'the aggregate club slide queues exactly one immutable render'
);

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from s153_render_claim),
    's153-render-worker',
    'tenants/' || (select tenant_id from s153_render_claim)::text ||
      '/assets/' || (select output_media_asset_id from s153_render_claim)::text ||
      '/dynamic-slide.png',
    4096,
    repeat('e', 64),
    1920,
    1080
  )$$,
  'the immutable fallback render completes for playlist use'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);

select is(
  (
    select status
    from public.dynamic_slides
    where id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  ),
  'ready',
  'the completed aggregate slide is ready without creating team slides'
);

insert into public.playlists (
  id, tenant_id, name, created_by, updated_by
) values (
  '30000000-0000-4000-8000-000000001531',
  '10000000-0000-4000-8000-000000001531',
  'S153 publicatie',
  '00000000-0000-4000-8000-000000001531',
  '00000000-0000-4000-8000-000000001531'
);

select lives_ok(
  $$select public.add_dynamic_slide_to_playlist_v2(
    '30000000-0000-4000-8000-000000001531',
    (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid,
    0,
    12,
    '61000000-0000-4000-8000-000000001531'
  )$$,
  'the one aggregate slide enters a mutable playlist draft'
);

reset role;

insert into public.screens (
  id, tenant_id, name, orientation, status, created_by
) values (
  '40000000-0000-4000-8000-000000001531',
  '10000000-0000-4000-8000-000000001531',
  'S153 scherm',
  'landscape',
  'active',
  '00000000-0000-4000-8000-000000001531'
);

insert into public.player_devices (
  id, tenant_id, screen_id, device_name, token_hash, status
) values (
  '50000000-0000-4000-8000-000000001531',
  '10000000-0000-4000-8000-000000001531',
  '40000000-0000-4000-8000-000000001531',
  'S153 player',
  repeat('5', 64),
  'paired'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);

select lives_ok(
  $$select set_config(
    'test.s153_release_id',
    public.publish_playlist_to_targets_v3(
      '30000000-0000-4000-8000-000000001531',
      (
        select revision
        from public.playlists
        where id = '30000000-0000-4000-8000-000000001531'
      ),
      array['40000000-0000-4000-8000-000000001531'::uuid],
      'S153 immutable release',
      '62000000-0000-4000-8000-000000001531'
    ) ->> 'releaseId',
    true
  )$$,
  'the draft publishes an immutable release before resource archiving'
);

select is(
  (
    select count(*)
    from public.playlist_release_items
    where release_id = current_setting('test.s153_release_id')::uuid
  ),
  1::bigint,
  'the published release contains one immutable aggregate-slide item'
);

select ok(
  (
    select release_item.dynamic_snapshot_id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,snapshotId}'
    )::uuid
    from public.playlist_release_items release_item
    where release_item.release_id = current_setting('test.s153_release_id')::uuid
  )
  and (
    select count(*) = 1
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  ),
  'release provenance and its immutable snapshot exist before mutation'
);

-- Make the provider mutable state observably newer than the published source.
-- A theme rollout must still clone the exact immutable provider payload.
reset role;
update public.player_devices
set active_release_id = current_setting('test.s153_release_id')::uuid,
    desired_release_id = current_setting('test.s153_release_id')::uuid
where id = '50000000-0000-4000-8000-000000001531';
insert into public.content_schedules (
  id, tenant_id, name, target_kind, target_screen_id,
  playlist_id, release_id, timezone_name, schedule_kind,
  starts_at, ends_at, priority, source, enabled, created_by, updated_by
) values (
  '70000000-0000-4000-8000-000000001531',
  '10000000-0000-4000-8000-000000001531',
  'S153 actieve override',
  'screen',
  '40000000-0000-4000-8000-000000001531',
  '30000000-0000-4000-8000-000000001531',
  current_setting('test.s153_release_id')::uuid,
  'Europe/Amsterdam',
  'once',
  statement_timestamp() - interval '1 hour',
  statement_timestamp() + interval '1 hour',
  900,
  'override',
  true,
  '00000000-0000-4000-8000-000000001531',
  '00000000-0000-4000-8000-000000001531'
);
update public.content_schedules schedule
set target_snapshot_id = private.create_publisher_target_snapshot(
  schedule.tenant_id,
  schedule.release_id,
  schedule.id,
  'schedule',
  schedule.id,
  array[schedule.target_screen_id],
  '00000000-0000-4000-8000-000000001531'
)
where schedule.id = '70000000-0000-4000-8000-000000001531';
update public.screens screen
set active_assignment_source = 'override',
    active_schedule_id = '70000000-0000-4000-8000-000000001531',
    active_target_snapshot_id = schedule.target_snapshot_id
from public.content_schedules schedule
where screen.id = '40000000-0000-4000-8000-000000001531'
  and schedule.id = '70000000-0000-4000-8000-000000001531';

-- Dormant resources deliberately remain outside the forced rollout target
-- set. Their unchanged release pointers must therefore be revalidated when a
-- later UPDATE makes the resource live again.
insert into public.screen_groups (
  id, tenant_id, name, status, archived_at, created_by, updated_by,
  default_playlist_id, default_release_id
) values (
  '40000000-0000-4000-8000-000000001533',
  '10000000-0000-4000-8000-000000001531',
  'S153 dormant group',
  'archived',
  statement_timestamp(),
  '00000000-0000-4000-8000-000000001531',
  '00000000-0000-4000-8000-000000001531',
  '30000000-0000-4000-8000-000000001531',
  current_setting('test.s153_release_id')::uuid
);
insert into public.content_schedules (
  id, tenant_id, name, target_kind, target_screen_id,
  playlist_id, release_id, timezone_name, schedule_kind,
  starts_at, ends_at, priority, source, enabled, created_by, updated_by
) values (
  '70000000-0000-4000-8000-000000001532',
  '10000000-0000-4000-8000-000000001531',
  'S153 dormant schedule',
  'screen',
  '40000000-0000-4000-8000-000000001531',
  '30000000-0000-4000-8000-000000001531',
  current_setting('test.s153_release_id')::uuid,
  'Europe/Amsterdam',
  'once',
  statement_timestamp() - interval '1 hour',
  statement_timestamp() + interval '1 hour',
  100,
  'publisher',
  false,
  '00000000-0000-4000-8000-000000001531',
  '00000000-0000-4000-8000-000000001531'
);
update public.screens
set status = 'disabled'
where id = '40000000-0000-4000-8000-000000001531';
update public.sports_matches
set home_team = jsonb_set(
  home_team,
  '{name}',
  '"Provider state changed after publish"'::jsonb,
  true
)
where tenant_id = '10000000-0000-4000-8000-000000001531'
  and external_id = 's153-fixture-001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);

select lives_ok(
  $$select set_config(
    'test.s153_theme_result',
    public.update_tenant_theme_settings_v3(
      '10000000-0000-4000-8000-000000001531',
      0,
      'fieldflow',
      '1.0.0',
      '{"kind":"fixed","mode":"dark"}'::jsonb,
      '{}'::jsonb,
      jsonb_set(
        jsonb_set(
          (select value from s153_theme_values where name = 'appearance'),
          '{surfaces,clubLogoBackground}',
          '"#112233"'::jsonb
        ),
        '{typography,baseScale}',
        '1.1'::jsonb
      )
    )::text,
    true
  )$$,
  'saving theme settings starts one immutable forced rollout'
);

select ok(
  current_setting('test.s153_theme_result')::jsonb ->> 'outcome' = 'applied'
  and (
    current_setting('test.s153_theme_result')::jsonb ->> 'snapshotCount'
  )::integer = 1
  and (
    current_setting('test.s153_theme_result')::jsonb ->> 'releaseTargetCount'
  )::integer = 1
  and current_setting('test.s153_theme_result')::jsonb ->> 'status' =
    'rendering',
  'the save reports one snapshot and one active immutable release branch'
);

select is(
  public.update_tenant_theme_settings_v3(
    '10000000-0000-4000-8000-000000001531',
    1,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"dark"}'::jsonb,
    '{}'::jsonb,
    jsonb_set(
      jsonb_set(
        (select value from s153_theme_values where name = 'appearance'),
        '{surfaces,clubLogoBackground}',
        '"#112233"'::jsonb
      ),
      '{typography,baseScale}',
      '1.1'::jsonb
    )
  ) ->> 'outcome',
  'noop',
  'an unchanged save is an honest no-op and creates no rollout claim'
);

select ok(
  (
    select count(*) = 1
    from public.tenant_theme_rollouts
    where tenant_id = '10000000-0000-4000-8000-000000001531'
  )
  and (
    select slide.status = 'ready'
      and slide.current_snapshot_id = (
        current_setting('test.s153_batch_result')::jsonb
          #>> '{slides,0,snapshotId}'
      )::uuid
    from public.dynamic_slides slide
    where slide.id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  ),
  'the planner stages beside the last-known-good current snapshot'
);

reset role;
update public.dynamic_slides
set status = 'rendering'
where id = (
  current_setting('test.s153_batch_result')::jsonb
    #>> '{slides,0,slideId}'
)::uuid;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
insert into public.playlists (
  id, tenant_id, name, created_by, updated_by
) values (
  '30000000-0000-4000-8000-000000001532',
  '10000000-0000-4000-8000-000000001531',
  'S153 playlist tijdens rollout',
  '00000000-0000-4000-8000-000000001531',
  '00000000-0000-4000-8000-000000001531'
);

select throws_ok(
  $$select public.add_dynamic_slide_to_playlist_v2(
      '30000000-0000-4000-8000-000000001532',
      (
        current_setting('test.s153_batch_result')::jsonb
          #>> '{slides,0,slideId}'
      )::uuid,
      0,
      12,
      '61000000-0000-4000-8000-000000001532'
    )$$,
  '55000',
  null,
  'new draft bindings are blocked while their theme rollout is active'
);

select throws_ok(
  $$insert into public.screen_groups (
      id, tenant_id, name, status, created_by, updated_by,
      default_playlist_id, default_release_id
    ) values (
      '40000000-0000-4000-8000-000000001532',
      '10000000-0000-4000-8000-000000001531',
      'S153 stale race target',
      'active',
      '00000000-0000-4000-8000-000000001531',
      '00000000-0000-4000-8000-000000001531',
      '30000000-0000-4000-8000-000000001531',
      current_setting('test.s153_release_id')::uuid
    )$$,
  '55000',
  null,
  'a stale release cannot become active after the planner froze its branches'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table s153_theme_render_claim as
select *
from pg_temp.claim_s153_render_v1(
  (
    current_setting('test.s153_batch_result')::jsonb
      #>> '{slides,0,slideId}'
  )::uuid,
  's153-theme-render-worker'
);

select is(
  (select count(*) from s153_theme_render_claim),
  1::bigint,
  'the first forced theme rollout queues exactly one render'
);

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from s153_theme_render_claim),
    's153-theme-render-worker',
    'tenants/' || (select tenant_id from s153_theme_render_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from s153_theme_render_claim)::text ||
      '/dynamic-slide.png',
    4100,
    repeat('a', 64),
    1920,
    1080
  )$$,
  'render completion atomically materializes all active release branches'
);

reset role;
select throws_ok(
  $$update public.screens
    set status = 'active'
    where id = '40000000-0000-4000-8000-000000001531'$$,
  '55000',
  null,
  'a disabled screen cannot reactivate an unchanged stale release pointer'
);
select throws_ok(
  $$update public.screen_groups
    set status = 'active', archived_at = null
    where id = '40000000-0000-4000-8000-000000001533'$$,
  '55000',
  null,
  'an archived group cannot reactivate an unchanged stale release pointer'
);
select throws_ok(
  $$update public.content_schedules
    set enabled = true
    where id = '70000000-0000-4000-8000-000000001532'$$,
  '55000',
  null,
  'a disabled schedule cannot reactivate an unchanged stale release pointer'
);

-- Rebinding the disabled screen and paired player to the current immutable
-- branch is valid; the subsequent activation is then allowed.
update public.screens screen
set assigned_release_id = branch.replacement_release_id,
    default_release_id = branch.replacement_release_id,
    active_target_snapshot_id = schedule.target_snapshot_id,
    status = 'active'
from private.tenant_theme_rollout_release_branches branch
join public.content_schedules schedule
  on schedule.tenant_id = branch.tenant_id
 and schedule.id = '70000000-0000-4000-8000-000000001531'
where branch.rollout_id = (
    current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
  )::uuid
  and screen.tenant_id = branch.tenant_id
  and screen.id = '40000000-0000-4000-8000-000000001531';
update public.player_devices device
set desired_release_id = branch.replacement_release_id
from private.tenant_theme_rollout_release_branches branch
where branch.rollout_id = (
    current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
  )::uuid
  and device.tenant_id = branch.tenant_id
  and device.id = '50000000-0000-4000-8000-000000001531';

update public.dynamic_slides
set status = 'rendering'
where id = (
  current_setting('test.s153_batch_result')::jsonb
    #>> '{slides,0,slideId}'
)::uuid;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
select lives_ok(
  $$select set_config(
    'test.s153_add_after_rollout',
    public.add_dynamic_slide_to_playlist_v2(
      '30000000-0000-4000-8000-000000001532',
      (
        current_setting('test.s153_batch_result')::jsonb
          #>> '{slides,0,slideId}'
      )::uuid,
      0,
      12,
      '61000000-0000-4000-8000-000000001532'
    )::text,
    true
  )$$,
  'a rendering status mirror is addable again after rollout completion'
);
reset role;
select ok(
  (
    select item.dynamic_snapshot_id = slide.current_snapshot_id
      and snapshot.snapshot_data_json
        #>> '{themePresentation,settingsRevision}' = '1'
    from public.playlist_items item
    join public.dynamic_slides slide
      on slide.tenant_id = item.tenant_id
     and slide.id = item.dynamic_slide_id
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = item.tenant_id
     and snapshot.id = item.dynamic_snapshot_id
    where item.id = (
      current_setting('test.s153_add_after_rollout')::jsonb ->> 'itemId'
    )::uuid
  ),
  'post-rollout add binds the promoted immutable themed snapshot'
);

select ok(
  (
    select rollout.status = 'ready'
      and rollout.snapshot_count = 1
      and rollout.ready_snapshot_count = 1
      and rollout.release_target_count = 1
      and rollout.release_count = 1
    from public.tenant_theme_rollouts rollout
    where rollout.id = (
      current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'the rollout becomes ready only after snapshot and release targets finish'
);

select ok(
  (
    select old_snapshot.snapshot_data_json -> 'sport'
      = new_snapshot.snapshot_data_json -> 'sport'
    from private.tenant_theme_rollout_snapshots mapping
    join public.dynamic_slide_snapshots old_snapshot
      on old_snapshot.tenant_id = mapping.tenant_id
     and old_snapshot.id = mapping.old_snapshot_id
    join public.dynamic_slide_snapshots new_snapshot
      on new_snapshot.tenant_id = mapping.tenant_id
     and new_snapshot.id = mapping.new_snapshot_id
    where mapping.rollout_id = (
      current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
  )
  and (
    select home_team ->> 'name' = 'Provider state changed after publish'
    from public.sports_matches
    where tenant_id = '10000000-0000-4000-8000-000000001531'
      and external_id = 's153-fixture-001'
  ),
  'theme rollout clones provider data instead of rebuilding from newer state'
);

select ok(
  (
    select
      new_snapshot.snapshot_data_json
        #>> '{themePresentation,appearance,typography,baseScale}' = '1.1'
      and new_snapshot.snapshot_data_json
        #>> '{themePresentation,appearance,surfaces,clubLogoBackground}' =
          '#112233'
      and new_snapshot.snapshot_data_json
        #>> '{_veyocastThemeRollout,id}' = mapping.rollout_id::text
    from private.tenant_theme_rollout_snapshots mapping
    join public.dynamic_slide_snapshots new_snapshot
      on new_snapshot.tenant_id = mapping.tenant_id
     and new_snapshot.id = mapping.new_snapshot_id
    where mapping.rollout_id = (
      current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'the cloned snapshot carries the selected theme appearance and provenance'
);

select ok(
  (
    select branch.status = 'ready'
      and source_item.dynamic_snapshot_id = mapping.old_snapshot_id
      and replacement_item.dynamic_snapshot_id = mapping.new_snapshot_id
      and branch.replacement_release_id <> branch.source_release_id
    from private.tenant_theme_rollout_release_branches branch
    join private.tenant_theme_rollout_snapshots mapping
      on mapping.tenant_id = branch.tenant_id
     and mapping.rollout_id = branch.rollout_id
    join public.playlist_release_items source_item
      on source_item.tenant_id = branch.tenant_id
     and source_item.release_id = branch.source_release_id
     and source_item.dynamic_snapshot_id = mapping.old_snapshot_id
    join public.playlist_release_items replacement_item
      on replacement_item.tenant_id = branch.tenant_id
     and replacement_item.release_id = branch.replacement_release_id
     and replacement_item.sort_order = source_item.sort_order
    where branch.rollout_id = (
      current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'the old release stays immutable while its active branch gets a new release'
);

select ok(
  (
    select screen.assigned_release_id = branch.replacement_release_id
      and screen.default_release_id = branch.replacement_release_id
      and device.desired_release_id = branch.replacement_release_id
      and device.active_release_id = branch.source_release_id
      and screen.active_assignment_source = 'override'
      and screen.active_schedule_id = schedule.id
      and screen.active_target_snapshot_id = schedule.target_snapshot_id
    from private.tenant_theme_rollout_release_branches branch
    join public.screens screen
      on screen.tenant_id = branch.tenant_id
     and screen.id = '40000000-0000-4000-8000-000000001531'
    join public.player_devices device
      on device.tenant_id = branch.tenant_id
     and device.screen_id = screen.id
    join public.content_schedules schedule
      on schedule.tenant_id = branch.tenant_id
     and schedule.id = '70000000-0000-4000-8000-000000001531'
    where branch.rollout_id = (
      current_setting('test.s153_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
      and schedule.release_id = branch.replacement_release_id
  ),
  'override schedule and desired pointers advance while active release stays'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
select lives_ok(
  $$select set_config(
    'test.s153_failed_theme_result',
    public.update_tenant_theme_settings_v3(
      '10000000-0000-4000-8000-000000001531',
      1,
      'fieldflow',
      '1.0.0',
      '{"kind":"fixed","mode":"dark"}'::jsonb,
      '{}'::jsonb,
      jsonb_set(
        jsonb_set(
          (select value from s153_theme_values where name = 'appearance'),
          '{surfaces,clubLogoBackground}',
          '"#334455"'::jsonb
        ),
        '{typography,baseScale}',
        '1.2'::jsonb
      )
    )::text,
    true
  )$$,
  'a second changed save creates a distinct rollout revision'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table s153_failed_theme_claim as
select *
from pg_temp.claim_s153_render_v1(
  (
    current_setting('test.s153_batch_result')::jsonb
      #>> '{slides,0,slideId}'
  )::uuid,
  's153-failed-theme-worker'
);
select is(
  public.fail_dynamic_render_job_v1(
    (select job_id from s153_failed_theme_claim),
    's153-failed-theme-worker',
    'S153_THEME_RENDER_FAILED',
    'deterministic non-retryable pgTAP failure',
    false
  ),
  'failed',
  'a terminal render failure marks its rollout snapshot failed'
);

reset role;
select is(
  (
    select status
    from public.tenant_theme_rollouts
    where id = (
      current_setting('test.s153_failed_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'failed',
  'the failed snapshot marks the forced rollout failed'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
select lives_ok(
  $$select set_config(
    'test.s153_retry_result',
    public.retry_tenant_theme_rollout_v1(
      '10000000-0000-4000-8000-000000001531',
      (
        current_setting('test.s153_failed_theme_result')::jsonb
          ->> 'rolloutId'
      )::uuid,
      '64000000-0000-4000-8000-000000001531'
    )::text,
    true
  )$$,
  'an explicit retry creates a fresh immutable rollout attempt'
);

select ok(
  current_setting('test.s153_retry_result')::jsonb ->> 'outcome' = 'applied'
  and current_setting('test.s153_retry_result')::jsonb ->> 'rolloutId'
    <> current_setting('test.s153_failed_theme_result')::jsonb ->> 'rolloutId'
  and (
    select retry_of_rollout_id = (
      current_setting('test.s153_failed_theme_result')::jsonb ->> 'rolloutId'
    )::uuid
    from public.tenant_theme_rollouts
    where id = (
      current_setting('test.s153_retry_result')::jsonb ->> 'rolloutId'
    )::uuid
  ),
  'the retry has explicit lineage and a new rollout identity'
);

select is(
  public.retry_tenant_theme_rollout_v1(
    '10000000-0000-4000-8000-000000001531',
    (
      current_setting('test.s153_failed_theme_result')::jsonb ->> 'rolloutId'
    )::uuid,
    '64000000-0000-4000-8000-000000001531'
  ),
  current_setting('test.s153_retry_result')::jsonb,
  'retry is idempotent for the same actor and command key'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001532',
  true
);
select throws_ok(
  $$select public.retry_tenant_theme_rollout_v1(
    '10000000-0000-4000-8000-000000001531',
    (
      current_setting('test.s153_failed_theme_result')::jsonb ->> 'rolloutId'
    )::uuid,
    '64000000-0000-4000-8000-000000001532'
  )$$,
  '42501',
  null,
  'another tenant cannot retry this tenant rollout'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
create temporary table s153_retry_theme_claim as
select *
from pg_temp.claim_s153_render_v1(
  (
    current_setting('test.s153_batch_result')::jsonb
      #>> '{slides,0,slideId}'
  )::uuid,
  's153-retry-theme-worker'
);
select is(
  (select count(*) from s153_retry_theme_claim),
  1::bigint,
  'retry produces one fresh render instead of reusing the failed snapshot'
);

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from s153_retry_theme_claim),
    's153-retry-theme-worker',
    'tenants/' || (select tenant_id from s153_retry_theme_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from s153_retry_theme_claim)::text ||
      '/dynamic-slide.png',
    4200,
    repeat('b', 64),
    1920,
    1080
  )$$,
  'the explicit retry can finish through the same release planner'
);

reset role;
select ok(
  (
    select rollout.status = 'ready'
      and rollout.ready_snapshot_count = rollout.snapshot_count
      and rollout.release_count = rollout.release_target_count
    from public.tenant_theme_rollouts rollout
    where rollout.id = (
      current_setting('test.s153_retry_result')::jsonb ->> 'rolloutId'
    )::uuid
  )
  and (
    select count(*) = 2
    from private.tenant_theme_rollout_snapshots mapping
    where mapping.rollout_id in (
      (current_setting('test.s153_failed_theme_result')::jsonb
        ->> 'rolloutId')::uuid,
      (current_setting('test.s153_retry_result')::jsonb
        ->> 'rolloutId')::uuid
    )
      and mapping.new_snapshot_id <> mapping.old_snapshot_id
  ),
  'retry reaches ready with a fresh snapshot and release branch'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001531',
  true
);
select is(
  public.update_tenant_theme_settings_v1(
    '10000000-0000-4000-8000-000000001531',
    2,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb
  ) ->> 'outcome',
  'applied',
  'legacy v1 delegates changed settings to the immutable v2 planner'
);

select is(
  public.update_tenant_theme_settings_v2(
    '10000000-0000-4000-8000-000000001531',
    3,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb,
    '{}'::jsonb
  ) ->> 'outcome',
  'noop',
  'legacy v2 preserves appearance and cannot bypass the v3 no-op contract'
);

select set_config(
  'test.s153_revision_before_archive',
  (
    select revision::text
    from public.playlists
    where id = '30000000-0000-4000-8000-000000001531'
  ),
  true
);

select is(
  public.mutate_dynamic_slides_v1(
    '10000000-0000-4000-8000-000000001531',
    array[(
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid],
    'archive',
    false,
    '63000000-0000-4000-8000-000000001531'
  ) ->> 'outcome',
  'blocked',
  'normal archive is blocked while a mutable playlist references the slide'
);

select ok(
  (
    select status <> 'archived'
    from public.dynamic_slides
    where id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  )
  and (
    select count(*) = 1
    from public.playlist_items
    where playlist_id = '30000000-0000-4000-8000-000000001531'
  ),
  'a blocked archive leaves both slide and draft reference unchanged'
);

select is(
  public.mutate_dynamic_slides_v1(
    '10000000-0000-4000-8000-000000001531',
    array[(
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid],
    'archive',
    true,
    '63000000-0000-4000-8000-000000001532'
  ) ->> 'outcome',
  'applied',
  'explicit override applies the guarded archive'
);

select ok(
  (
    select status = 'archived' and archived_at is not null
    from public.dynamic_slides
    where id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid
  )
  and (
    select count(*) = 0
    from public.playlist_items
    where playlist_id = '30000000-0000-4000-8000-000000001531'
  )
  and (
    select revision = current_setting(
      'test.s153_revision_before_archive'
    )::bigint + 1
    from public.playlists
    where id = '30000000-0000-4000-8000-000000001531'
  ),
  'override atomically archives the slide, removes draft use and revises the playlist'
);

select ok(
  (
    select count(*) = 1
    from public.playlist_release_items release_item
    where release_item.release_id = current_setting('test.s153_release_id')::uuid
      and release_item.dynamic_snapshot_id = (
        current_setting('test.s153_batch_result')::jsonb
          #>> '{slides,0,snapshotId}'
      )::uuid
  )
  and (
    select count(*) = 1
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = (
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,snapshotId}'
    )::uuid
  ),
  'override preserves immutable release items and snapshots byte-for-byte'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001532',
  true
);
select throws_ok(
  $$select public.mutate_dynamic_slides_v1(
    '10000000-0000-4000-8000-000000001531',
    array[(
      current_setting('test.s153_batch_result')::jsonb
        #>> '{slides,0,slideId}'
    )::uuid],
    'archive',
    false,
    '63000000-0000-4000-8000-000000001533'
  )$$,
  '42501',
  null,
  'tenant B cannot mutate tenant A slides'
);

select * from finish();
rollback;
