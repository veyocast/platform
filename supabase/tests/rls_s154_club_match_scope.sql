begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(66);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-4000-8000-000000001541',
    'authenticated', 'authenticated', 's154-owner-a@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000001542',
    'authenticated', 'authenticated', 's154-owner-b@veyocast.test', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001541', 'S154 owner A'),
  ('00000000-0000-4000-8000-000000001542', 'S154 owner B');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001541', 'S154 tenant A', 's154-tenant-a'),
  ('10000000-0000-4000-8000-000000001542', 'S154 tenant B', 's154-tenant-b');

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001541'),
  ('10000000-0000-4000-8000-000000001542');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  (
    '10000000-0000-4000-8000-000000001541',
    '00000000-0000-4000-8000-000000001541',
    'tenant_owner'
  ),
  (
    '10000000-0000-4000-8000-000000001542',
    '00000000-0000-4000-8000-000000001542',
    'tenant_owner'
  );

create temporary table s154_sources (
  name text primary key,
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select, insert on s154_sources to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001541',
  true
);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001541',
  'Sportlink · S154 primair',
  'S154 primair',
  '1541',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);
insert into s154_sources (name, tenant_id, connection_id, data_source_id)
select
  'tenant-a-primary',
  connection.tenant_id,
  connection.id,
  connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001541'
  and source.name = 'Sportlink · S154 primair';

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001541',
  'Sportlink · S154 secundair',
  'S154 secundair',
  '1542',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);
insert into s154_sources (name, tenant_id, connection_id, data_source_id)
select
  'tenant-a-secondary',
  connection.tenant_id,
  connection.id,
  connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001541'
  and source.name = 'Sportlink · S154 secundair';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001542',
  true
);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001542',
  'Sportlink · S154 tenant B',
  'S154 tenant B',
  '1543',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);
insert into s154_sources (name, tenant_id, connection_id, data_source_id)
select
  'tenant-b-primary',
  connection.tenant_id,
  connection.id,
  connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001542'
  and source.name = 'Sportlink · S154 tenant B';

reset role;

-- Only two active teams in the primary source are owned by tenant A. The
-- collision IDs deliberately exist only in another source or another tenant.
insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, active, metadata
) values
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-own-home', 'S154 eigen thuis', true, '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-own-away', 'S154 eigen uit', true, '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-inactive', 'S154 inactief', false, '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-secondary'),
    's154-source-only', 'S154 ander bronteam', true, '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-secondary'),
    's154-legacy-own', 'S154 legacy eigen team', true, '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001542',
    (select connection_id from s154_sources where name = 'tenant-b-primary'),
    's154-tenant-only', 'S154 ander tenantteam', true, '{}'::jsonb
  );

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-own-home', statement_timestamp() + interval '1 day 1 minute',
    'scheduled',
    '{"externalId":"s154-own-home","name":"S154 club"}',
    '{"externalId":"s154-opponent-a","name":"Tegenstander A"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"name":"Sportpark S154","field":"Veld 1"}', '{}', '[]', false,
    false, -- deliberately wrong: direction must derive from the selected team
    true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-own-away', statement_timestamp() + interval '1 day 2 minutes',
    'scheduled',
    '{"externalId":"s154-opponent-b","name":"Tegenstander B"}',
    '{"externalId":"s154-own-away","name":"S154 eigen uit"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 2"}', '{}', '[]', false,
    true, -- deliberately wrong for the same reason
    true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-foreign-foreign', statement_timestamp() + interval '1 day 3 minutes',
    'scheduled',
    '{"externalId":"s154-opponent-c","name":"Tegenstander C"}',
    '{"externalId":"s154-opponent-d","name":"Tegenstander D"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 3"}', '{}', '[]', false, false, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-inactive-home', statement_timestamp() + interval '1 day 4 minutes',
    'scheduled',
    '{"externalId":"s154-inactive","name":"S154 inactief"}',
    '{"externalId":"s154-opponent-e","name":"Tegenstander E"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 4"}', '{}', '[]', false, true, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-source-collision', statement_timestamp() + interval '1 day 5 minutes',
    'scheduled',
    '{"externalId":"s154-source-only","name":"Team uit andere bron"}',
    '{"externalId":"s154-opponent-f","name":"Tegenstander F"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 5"}', '{}', '[]', false, true, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-tenant-collision', statement_timestamp() + interval '1 day 6 minutes',
    'scheduled',
    '{"externalId":"s154-tenant-only","name":"Team uit andere tenant"}',
    '{"externalId":"s154-opponent-g","name":"Tegenstander G"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 6"}', '{}', '[]', false, true, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's154-own-own', statement_timestamp() + interval '1 day 7 minutes',
    'scheduled',
    '{"externalId":"s154-own-home","name":"S154 eigen thuis"}',
    '{"externalId":"s154-own-away","name":"S154 eigen uit"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 7"}', '{}', '[]', false, false, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-secondary'),
    's154-legacy-home', statement_timestamp() + interval '1 day 11 minutes',
    'scheduled',
    '{"externalId":"s154-legacy-own","name":"S154 legacy eigen team"}',
    '{"externalId":"s154-legacy-opponent-a","name":"Legacy tegenstander A"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 11"}', '{}', '[]', false, false, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-secondary'),
    's154-legacy-away', statement_timestamp() + interval '1 day 12 minutes',
    'scheduled',
    '{"externalId":"s154-legacy-opponent-b","name":"Legacy tegenstander B"}',
    '{"externalId":"s154-legacy-own","name":"S154 legacy eigen team"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 12"}', '{}', '[]', false, true, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-secondary'),
    's154-legacy-foreign', statement_timestamp() + interval '1 day 13 minutes',
    'scheduled',
    '{"externalId":"s154-legacy-opponent-c","name":"Legacy tegenstander C"}',
    '{"externalId":"s154-legacy-opponent-d","name":"Legacy tegenstander D"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"field":"Veld 13"}', '{}', '[]', false, false, true
  );

create function pg_temp.s154_context(p_team_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'competitionId', null,
    'competitionSelectionMode', 'auto_current',
    'phaseId', null,
    'poolId', null,
    'providerTeamId', p_team_id,
    'seasonId', null
  )
$$;

create temporary table s154_created (
  name text primary key,
  result jsonb not null
);
grant select, insert on s154_created to authenticated;
grant select on s154_created to service_role;

create function pg_temp.s154_create_club_slide(
  p_source_name text,
  p_name text,
  p_mode text,
  p_location text,
  p_idempotency_key uuid,
  p_include_location boolean default true,
  p_extra_selection jsonb default '{}'::jsonb,
  p_display jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  contexts jsonb;
  primary_context jsonb;
  source_record record;
  team_selection jsonb;
  template_version_id uuid;
begin
  select source.*
  into source_record
  from pg_temp.s154_sources source
  where source.name = p_source_name;

  contexts := case p_source_name
    when 'tenant-a-primary' then jsonb_build_array(
      pg_temp.s154_context('s154-own-home'),
      pg_temp.s154_context('s154-own-away')
    )
    when 'tenant-a-secondary' then jsonb_build_array(
      pg_temp.s154_context('s154-legacy-own')
    )
    else jsonb_build_array(pg_temp.s154_context('s154-tenant-only'))
  end;
  primary_context := contexts -> 0;
  team_selection := jsonb_build_object(
    'mode', p_mode,
    'teamContexts', case when p_mode = 'all' then '[]'::jsonb else contexts end
  );
  if p_include_location then
    team_selection := team_selection || jsonb_build_object(
      'matchLocation', p_location
    );
  end if;
  team_selection := team_selection || coalesce(p_extra_selection, '{}'::jsonb);

  select version.id
  into template_version_id
  from public.dynamic_template_versions version
  join public.dynamic_templates template
    on template.id = version.template_id
  where template.slide_type = 'sport_program'
    and template.orientation = 'landscape'
    and template.status = 'published'
    and version.status = 'published'
    and template.current_published_version_id = version.id
  order by template.slug
  limit 1;

  return public.create_sportlink_slide_batch_v4(
    source_record.tenant_id,
    source_record.data_source_id,
    jsonb_build_array(jsonb_build_object(
      'blueprintKey', 'sportlink.club_schedule_next_7_days',
      'context', primary_context,
      'name', p_name,
      'orientation', 'landscape',
      'display', p_display,
      'teamSelection', team_selection,
      'templateVersionId', template_version_id,
      'themeSelection', '{
        "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
        "modePolicy":{"kind":"fixed","mode":"light"},
        "accent":null,
        "support":null,
        "categoryOverrides":[]
      }'::jsonb,
      'title', p_name
    )),
    p_idempotency_key
  );
end;
$$;

grant execute on function pg_temp.s154_context(text) to authenticated;
grant execute on function pg_temp.s154_create_club_slide(
  text, text, text, text, uuid, boolean, jsonb, jsonb
) to authenticated;

create function pg_temp.s156_create_today_variant_batch(
  p_idempotency_key uuid,
  p_duplicate_first boolean default false,
  p_source_name text default 'tenant-a-primary',
  p_legacy_both_duplicate boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  contexts jsonb;
  drafts jsonb := '[]'::jsonb;
  source_record record;
  template_version_id uuid;
  variant record;
begin
  select source.*
  into source_record
  from pg_temp.s154_sources source
  where source.name = p_source_name;

  contexts := case p_source_name
    when 'tenant-a-primary' then pg_catalog.jsonb_build_array(
      pg_temp.s154_context('s154-own-home'),
      pg_temp.s154_context('s154-own-away')
    )
    else pg_catalog.jsonb_build_array(
      pg_temp.s154_context('s154-tenant-only')
    )
  end;

  for variant in
    select value.*
    from (values
      (1, 'sportlink.club_schedule_today', 'both', 'sport_program',
        'Clubprogramma vandaag · Thuis en uit'),
      (2, 'sportlink.club_schedule_today', 'home', 'sport_program',
        'Clubprogramma vandaag · Thuis'),
      (3, 'sportlink.club_schedule_today', 'away', 'sport_program',
        'Clubprogramma vandaag · Uit'),
      (4, 'sportlink.club_results_today', 'both', 'sport_results',
        'Clubuitslagen vandaag · Thuis en uit'),
      (5, 'sportlink.club_results_today', 'home', 'sport_results',
        'Clubuitslagen vandaag · Thuis'),
      (6, 'sportlink.club_results_today', 'away', 'sport_results',
        'Clubuitslagen vandaag · Uit')
    ) value(sort_order, blueprint_key, match_location, slide_type, label)
    order by value.sort_order
  loop
    select version.id
    into template_version_id
    from public.dynamic_template_versions version
    join public.dynamic_templates template
      on template.id = version.template_id
    where template.slide_type = variant.slide_type
      and template.orientation = 'landscape'
      and template.status = 'published'
      and version.status = 'published'
      and template.current_published_version_id = version.id
    order by template.slug
    limit 1;

    drafts := drafts || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'blueprintKey', variant.blueprint_key,
        'context', contexts -> 0,
        'name', variant.label,
        'orientation', 'landscape',
        'teamSelection', pg_catalog.jsonb_build_object(
          'matchLocation', variant.match_location,
          'mode', 'selected',
          'teamContexts', contexts
        ),
        'templateVersionId', template_version_id,
        'themeSelection', '{
          "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
          "modePolicy":{"kind":"fixed","mode":"light"},
          "accent":null,
          "support":null,
          "categoryOverrides":[]
        }'::jsonb,
        'title', variant.label
      )
    );
  end loop;

  if p_duplicate_first then
    drafts := drafts || pg_catalog.jsonb_build_array(drafts -> 0);
  end if;
  if p_legacy_both_duplicate then
    drafts := drafts || pg_catalog.jsonb_build_array(
      (drafts -> 0) || pg_catalog.jsonb_build_object(
        'teamSelection',
        (drafts #> '{0,teamSelection}') - 'matchLocation'
      )
    );
  end if;

  return public.create_sportlink_slide_batch_v4(
    source_record.tenant_id,
    source_record.data_source_id,
    drafts,
    p_idempotency_key
  );
end;
$$;

grant execute on function pg_temp.s156_create_today_variant_batch(
  uuid, boolean, text, boolean
) to authenticated;

create function pg_temp.s154_build_with_team_selection(
  p_slide_id uuid,
  p_team_selection jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
begin
  select slide.*
  into slide_record
  from public.dynamic_slides slide
  where slide.id = p_slide_id;
  slide_record.configuration_json := jsonb_set(
    slide_record.configuration_json,
    '{teamSelection}',
    p_team_selection,
    true
  );
  return private.build_dynamic_snapshot_data(slide_record);
end;
$$;

create function pg_temp.s154_malformed_selection_fails_closed(
  p_slide_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := pg_temp.s154_build_with_team_selection(
    p_slide_id,
    '{
      "matchLocation":"both",
      "mode":"selected",
      "teamContexts":"not-an-array"
    }'::jsonb
  );
  return result #>> '{sport,teamSelectionMode}' = 'selected'
    and jsonb_array_length(result #> '{sport,items}') = 0;
exception when others then
  return false;
end;
$$;

create function pg_temp.s154_null_blueprint_is_passthrough(
  p_slide_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actual jsonb;
  expected jsonb;
  slide_record public.dynamic_slides%rowtype;
begin
  select slide.*
  into slide_record
  from public.dynamic_slides slide
  where slide.id = p_slide_id;
  slide_record.configuration_json :=
    slide_record.configuration_json - 'blueprintKey';
  actual := private.build_dynamic_snapshot_data(slide_record);
  expected := private.build_dynamic_snapshot_data_before_s154_club_match_scope(
    slide_record
  );
  return actual - '_veyocastThemeRuntime' = expected
    and not coalesce(actual #> '{sport}' ? 'matchLocation', false);
exception when others then
  return false;
end;
$$;

select ok(
  not has_function_privilege(
    'authenticated',
    'private.sportlink_team_selection_is_valid_v1(uuid,uuid,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.sportlink_match_matches_team_selection_v1(uuid,uuid,public.sports_matches,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.queue_club_match_scope_snapshots_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'the private validator, match helper and repair queue are not Data API executable'
);

select ok(
  private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', jsonb_build_array(
        pg_temp.s154_context('s154-own-home'),
        pg_temp.s154_context('s154-own-away')
      )
    )
  ),
  'the private validator accepts both for selected own teams'
);

select ok(
  private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"matchLocation":"home","mode":"all","teamContexts":[]}'::jsonb
  ),
  'the private validator accepts home for all active own teams'
);

select ok(
  private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"matchLocation":"away","mode":"all","teamContexts":[]}'::jsonb
  ),
  'the private validator accepts away for all active own teams'
);

select ok(
  private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"mode":"all","teamContexts":[]}'::jsonb
  ),
  'a missing database matchLocation remains backward-compatible as both'
);

select ok(
  not private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"matchLocation":null,"mode":"all","teamContexts":[]}'::jsonb
  ),
  'an explicit null matchLocation is rejected'
);

select ok(
  not private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"matchLocation":"neutral","mode":"all","teamContexts":[]}'::jsonb
  ),
  'an unknown matchLocation value is rejected'
);

select ok(
  not private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    '{"matchLocation":"both","mode":"all","teamContexts":[],"unexpected":true}'::jsonb
  ),
  'unknown teamSelection properties are rejected'
);

select ok(
  not private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', jsonb_build_array(
        pg_temp.s154_context('s154-source-only')
      )
    )
  ),
  'a selected team from another source of the same tenant is rejected'
);

select ok(
  not private.sportlink_team_selection_is_valid_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', jsonb_build_array(
        pg_temp.s154_context('s154-tenant-only')
      )
    )
  ),
  'a selected team from another tenant is rejected even when its ID appears in a fixture'
);

select ok(
  not private.sportlink_match_matches_team_selection_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-secondary'),
    (
      select fixture
      from public.sports_matches fixture
      where fixture.external_id = 's154-source-collision'
        and fixture.source_connection_id = (
          select connection_id
          from s154_sources
          where name = 'tenant-a-primary'
        )
    ),
    '{"matchLocation":"both","mode":"all","teamContexts":[]}'::jsonb
  ),
  'all-mode matching binds the fixture and owned team to the exact same source connection'
);

select ok(
  not private.sportlink_match_matches_team_selection_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    (
      select fixture
      from public.sports_matches fixture
      where fixture.external_id = 's154-source-collision'
        and fixture.source_connection_id = (
          select connection_id
          from s154_sources
          where name = 'tenant-a-primary'
        )
    ),
    jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', jsonb_build_array(
        pg_temp.s154_context('s154-source-only')
      )
    )
  )
  and not private.sportlink_match_matches_team_selection_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-primary'),
    (
      select fixture
      from public.sports_matches fixture
      where fixture.external_id = 's154-tenant-collision'
        and fixture.source_connection_id = (
          select connection_id
          from s154_sources
          where name = 'tenant-a-primary'
        )
    ),
    jsonb_build_object(
      'matchLocation', 'both',
      'mode', 'selected',
      'teamContexts', jsonb_build_array(
        pg_temp.s154_context('s154-tenant-only')
      )
    )
  ),
  'selected-mode matching revalidates tenant and source ownership at snapshot time'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001541',
  true
);

select lives_ok(
  $$insert into s154_created values (
    'selected-both',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 selected both', 'selected', 'both',
      '60000000-0000-4000-8000-000000001541'
    )
  )$$,
  'v4 creates one selected-team slide for both directions'
);
select lives_ok(
  $$insert into s154_created values (
    'selected-home',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 selected home', 'selected', 'home',
      '60000000-0000-4000-8000-000000001542'
    )
  )$$,
  'v4 creates one selected-team home slide'
);
select lives_ok(
  $$insert into s154_created values (
    'selected-away',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 selected away', 'selected', 'away',
      '60000000-0000-4000-8000-000000001543'
    )
  )$$,
  'v4 creates one selected-team away slide'
);
select lives_ok(
  $$insert into s154_created values (
    'all-both',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 all both', 'all', 'both',
      '60000000-0000-4000-8000-000000001544'
    )
  )$$,
  'v4 creates one all-own-teams slide for both directions'
);
select lives_ok(
  $$insert into s154_created values (
    'all-home',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 all home', 'all', 'home',
      '60000000-0000-4000-8000-000000001545'
    )
  )$$,
  'v4 creates one all-own-teams home slide'
);
select lives_ok(
  $$insert into s154_created values (
    'all-away',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 all away', 'all', 'away',
      '60000000-0000-4000-8000-000000001546'
    )
  )$$,
  'v4 creates one all-own-teams away slide'
);

select is(
  (
    select count(*)
    from public.dynamic_slides slide
    join s154_created created
      on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
  ),
  6::bigint,
  'the location matrix remains six logical slides without team fan-out'
);

select is(
  (
    select count(*)
    from public.dynamic_slides slide
    join s154_created created
      on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
    where slide.configuration_json #>> '{teamSelection,matchLocation}' =
      split_part(created.name, '-', 2)
  ),
  6::bigint,
  'every explicit matchLocation is persisted in its one aggregate slide'
);

-- Exact local-day fixtures prove that every S156 today variant contains the
-- right home/away subset. Noon-ish fixture times avoid a UTC date boundary.
reset role;
insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's156-today-program-home',
    (((now() at time zone 'Europe/Amsterdam')::date + time '10:00')
      at time zone 'Europe/Amsterdam'),
    'scheduled',
    '{"externalId":"s154-own-home","name":"S154 club"}',
    '{"externalId":"s156-program-opponent-home","name":"Programma tegenstander thuis"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"name":"Sportpark S154","field":"Veld P1"}', '{}', '[]', false,
    false, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's156-today-program-away',
    (((now() at time zone 'Europe/Amsterdam')::date + time '11:00')
      at time zone 'Europe/Amsterdam'),
    'scheduled',
    '{"externalId":"s156-program-opponent-away","name":"Programma tegenstander uit"}',
    '{"externalId":"s154-own-away","name":"S154 eigen uit"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"name":"Sportpark Uit","field":"Veld P2"}', '{}', '[]', false,
    true, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's156-today-results-home',
    (((now() at time zone 'Europe/Amsterdam')::date + time '12:00')
      at time zone 'Europe/Amsterdam'),
    'finished',
    '{"externalId":"s154-own-home","name":"S154 club","score":"2"}',
    '{"externalId":"s156-results-opponent-home","name":"Uitslag tegenstander thuis","score":"1"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"name":"Sportpark S154","field":"Veld U1"}', '{}', '[]', true,
    false, true
  ),
  (
    '10000000-0000-4000-8000-000000001541',
    (select connection_id from s154_sources where name = 'tenant-a-primary'),
    's156-today-results-away',
    (((now() at time zone 'Europe/Amsterdam')::date + time '13:00')
      at time zone 'Europe/Amsterdam'),
    'finished',
    '{"externalId":"s156-results-opponent-away","name":"Uitslag tegenstander uit","score":"0"}',
    '{"externalId":"s154-own-away","name":"S154 eigen uit","score":"3"}',
    '{"externalId":"s154-competition","name":"S154 competitie"}',
    '{"externalId":"s154-pool","name":"S154 poule"}',
    '{"name":"Sportpark Uit","field":"Veld U2"}', '{}', '[]', true,
    true, true
  );
set local role authenticated;

select lives_ok(
  $$insert into s154_created(name, result)
    select 's156-today-variants', pg_temp.s156_create_today_variant_batch(
      '60000000-0000-4000-8000-000000001560'
    )$$,
  'one v4 transaction creates all six clubwide today variants'
);

select is(
  (
    select result ->> 'count'
    from s154_created
    where name = 's156-today-variants'
  ),
  '6',
  'the today batch returns programme and results for both, home and away'
);

select is(
  (
    select count(distinct pg_catalog.jsonb_build_array(
      slide.configuration_json ->> 'blueprintKey',
      slide.configuration_json #>> '{teamSelection,matchLocation}'
    ))
    from s154_created batch
    cross join lateral pg_catalog.jsonb_array_elements(
      batch.result -> 'slides'
    ) created(value)
    join public.dynamic_slides slide
      on slide.id = (created.value ->> 'slideId')::uuid
    where slide.configuration_json ->> 'blueprintKey' in (
      'sportlink.club_schedule_today',
      'sportlink.club_results_today'
    )
      and batch.name = 's156-today-variants'
  ),
  6::bigint,
  'all six exact blueprint and matchLocation pairs are persisted'
);

select is(
  (
    select string_agg(
      (slide.configuration_json ->> 'blueprintKey') || ':' ||
      (slide.configuration_json #>> '{teamSelection,matchLocation}') || '=' ||
      coalesce((
        select string_agg(item.value ->> 'id', ',' order by item.ordinality)
        from jsonb_array_elements(
          snapshot.snapshot_data_json #> '{sport,items}'
        ) with ordinality item(value, ordinality)
      ), ''),
      ';' order by
        slide.configuration_json ->> 'blueprintKey',
        slide.configuration_json #>> '{teamSelection,matchLocation}'
    )
    from s154_created batch
    cross join lateral jsonb_array_elements(batch.result -> 'slides') created(value)
    join public.dynamic_slides slide
      on slide.id = (created.value ->> 'slideId')::uuid
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.value ->> 'snapshotId')::uuid
    where batch.name = 's156-today-variants'
  ),
  'sportlink.club_results_today:away=s156-today-results-away;' ||
    'sportlink.club_results_today:both=s156-today-results-away,s156-today-results-home;' ||
    'sportlink.club_results_today:home=s156-today-results-home;' ||
    'sportlink.club_schedule_today:away=s156-today-program-away;' ||
    'sportlink.club_schedule_today:both=s156-today-program-home,s156-today-program-away;' ||
    'sportlink.club_schedule_today:home=s156-today-program-home',
  'all six today snapshots contain the correct local-day home/away subset'
);

select is(
  pg_temp.s156_create_today_variant_batch(
    '60000000-0000-4000-8000-000000001560'
  ),
  (select result from s154_created where name = 's156-today-variants'),
  'retrying the aggregate today request returns its original idempotent result'
);

select ok(
  (
    select count(*) = 1
      and bool_and((event.metadata ->> 'fanOut')::boolean)
      and bool_and((event.metadata ->> 'variantCount')::integer = 6)
      and bool_and((event.metadata ->> 'count')::integer = 6)
    from public.audit_events event
    join s154_created batch
      on event.target_id = (batch.result ->> 'batchId')::uuid
    where batch.name = 's156-today-variants'
      and event.action = 'sportlink.slide_batch.created'
  ),
  'the six-variant command has one correlated master audit event'
);

select throws_ok(
  $$select pg_temp.s156_create_today_variant_batch(
    '60000000-0000-4000-8000-000000001561',
    true
  )$$,
  '22023', null,
  'an exact duplicate today variant rejects the entire transaction'
);

select throws_ok(
  $$select pg_temp.s156_create_today_variant_batch(
    '60000000-0000-4000-8000-000000001563',
    false,
    'tenant-a-primary',
    true
  )$$,
  '22023', null,
  'legacy missing matchLocation and explicit both are one duplicate variant'
);

select throws_ok(
  $$select pg_temp.s156_create_today_variant_batch(
    '60000000-0000-4000-8000-000000001562',
    false,
    'tenant-b-primary'
  )$$,
  '42501', null,
  'tenant A cannot create a six-variant today batch for tenant B'
);

reset role;
update public.sports_matches
set active = false
where external_id like 's156-today-%';
set local role authenticated;

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'selected-both'
  ),
  's154-own-home,s154-own-away,s154-own-own',
  'selected both includes own home and away fixtures and de-duplicates own-versus-own'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'selected-home'
  ),
  's154-own-home,s154-own-own',
  'selected home follows the selected team side rather than is_home_match'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'selected-away'
  ),
  's154-own-away,s154-own-own',
  'selected away follows the selected team side rather than is_home_match'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'all-both'
  ),
  's154-own-home,s154-own-away,s154-own-own',
  'all both excludes foreign-versus-foreign, inactive, other-source and other-tenant fixtures'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'all-home'
  ),
  's154-own-home,s154-own-own',
  'all home includes only fixtures with an active own team on the home side'
);

select is(
  (
    select string_agg(item.value ->> 'id', ',' order by item.ordinality)
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) with ordinality item(value, ordinality)
    where created.name = 'all-away'
  ),
  's154-own-away,s154-own-own',
  'all away includes only fixtures with an active own team on the away side'
);

select ok(
  exists (
    select 1
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral pg_catalog.jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) item(value)
    where created.name = 'selected-both'
      and item.value ->> 'id' = 's154-own-home'
      and item.value ->> 'homeTeam' = 'S154 eigen thuis'
      and item.value ->> 'venueName' = 'Sportpark S154'
      and item.value ->> 'field' = 'Veld 1'
  ),
  'club match rows freeze the complete team label and structured location'
);

insert into s154_created(name, result)
select 'field-hidden', pg_temp.s154_create_club_slide(
  'tenant-a-primary',
  'S154 veld verborgen',
  'selected',
  'both',
  '60000000-0000-4000-8000-000000001564',
  true,
  '{}'::jsonb,
  '{"showField":false}'::jsonb
);

select is(
  (
    select item.value ->> 'venueName'
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral pg_catalog.jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) item(value)
    where created.name = 'field-hidden'
      and item.value ->> 'id' = 's154-own-home'
  ),
  'Sportpark S154',
  'sportpark remains visible when the optional field is hidden'
);

select is(
  (
    select item.value ->> 'field'
    from s154_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral pg_catalog.jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) item(value)
    where created.name = 'field-hidden'
      and item.value ->> 'id' = 's154-own-home'
  ),
  null,
  'field stays absent when its display setting is disabled'
);

reset role;

update public.sports_teams
set active = false
where tenant_id = '10000000-0000-4000-8000-000000001541'
  and source_connection_id = (
    select connection_id
    from s154_sources
    where name = 'tenant-a-primary'
  )
  and external_id = 's154-own-home';

select is(
  (
    select jsonb_array_length(
      private.build_dynamic_snapshot_data(slide) #> '{sport,items}'
    )
    from s154_created created
    join public.dynamic_slides slide
      on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
    where created.name = 'selected-both'
  ),
  0,
  'a selected slide fails closed when one persisted selected team is no longer active'
);

update public.sports_teams
set active = true
where tenant_id = '10000000-0000-4000-8000-000000001541'
  and source_connection_id = (
    select connection_id
    from s154_sources
    where name = 'tenant-a-primary'
  )
  and external_id = 's154-own-home';

select ok(
  pg_temp.s154_malformed_selection_fails_closed(
    (
      select (created.result #>> '{slides,0,slideId}')::uuid
      from s154_created created
      where created.name = 'selected-both'
    )
  ),
  'a malformed explicit teamSelection neither crashes refresh nor reopens the broad feed'
);

select ok(
  pg_temp.s154_null_blueprint_is_passthrough(
    (
      select (created.result #>> '{slides,0,slideId}')::uuid
      from s154_created created
      where created.name = 'selected-both'
    )
  ),
  'a NULL blueprint stays outside the S154 club normalization path'
);

select ok(
  (
    select private.build_dynamic_snapshot_data(slide)
      #>> '{_veyocastThemeRuntime,version}' = '2'
    from public.dynamic_slides slide
    where slide.id = (
      select (created.result #>> '{slides,0,slideId}')::uuid
      from s154_created created
      where created.name = 'selected-both'
    )
  ),
  'new S159 snapshot builds expose the versioned theme runtime marker'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001541',
  true
);

select lives_ok(
  $$insert into s154_created values (
    'missing-location',
    pg_temp.s154_create_club_slide(
      'tenant-a-primary', 'S154 legacy missing location', 'all', null,
      '60000000-0000-4000-8000-000000001547', false
    )
  )$$,
  'v4 keeps cached database clients without matchLocation compatible'
);

select ok(
  (
    select
      not (slide.configuration_json #> '{teamSelection}' ? 'matchLocation')
      and snapshot.snapshot_data_json #>> '{sport,matchLocation}' = 'both'
    from s154_created created
    join public.dynamic_slides slide
      on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    where created.name = 'missing-location'
  ),
  'the runtime normalizes a missing persisted matchLocation to both without rewriting configuration'
);

select throws_ok(
  $$select pg_temp.s154_create_club_slide(
    'tenant-a-primary', 'S154 explicit null', 'all', null,
    '60000000-0000-4000-8000-000000001548', true
  )$$,
  '22023', null,
  'v4 rejects an explicit null matchLocation'
);

select throws_ok(
  $$select pg_temp.s154_create_club_slide(
    'tenant-a-primary', 'S154 invalid location', 'all', 'neutral',
    '60000000-0000-4000-8000-000000001549'
  )$$,
  '22023', null,
  'v4 rejects an invalid matchLocation'
);

select throws_ok(
  $$select pg_temp.s154_create_club_slide(
    'tenant-a-primary', 'S154 extra selection field', 'all', 'both',
    '60000000-0000-4000-8000-000000001550', true,
    '{"unexpected":true}'::jsonb
  )$$,
  '22023', null,
  'v4 rejects unknown teamSelection fields'
);

reset role;

select throws_ok(
  $$update public.dynamic_slide_versions version
    set configuration_json = jsonb_set(
      version.configuration_json,
      '{teamSelection,matchLocation}',
      'null'::jsonb
    )
    from s154_created created
    where created.name = 'selected-home'
      and version.dynamic_slide_id =
        (created.result #>> '{slides,0,slideId}')::uuid$$,
  '23514', null,
  'the persistence trigger rejects an explicit null matchLocation'
);

select throws_ok(
  $$update public.dynamic_slide_versions version
    set configuration_json = jsonb_set(
      version.configuration_json,
      '{teamSelection,matchLocation}',
      '"neutral"'::jsonb
    )
    from s154_created created
    where created.name = 'selected-home'
      and version.dynamic_slide_id =
        (created.result #>> '{slides,0,slideId}')::uuid$$,
  '23514', null,
  'the persistence trigger rejects an invalid matchLocation on direct writes'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001541',
  true
);

select throws_ok(
  $$select pg_temp.s154_create_club_slide(
    'tenant-b-primary', 'S154 cross tenant create', 'all', 'both',
    '60000000-0000-4000-8000-000000001551'
  )$$,
  '42501', null,
  'tenant A cannot create a scoped club slide for tenant B'
);

select lives_ok(
  $$insert into s154_created values (
    'legacy-no-selection',
    pg_temp.s154_create_club_slide(
      'tenant-a-secondary', 'S154 legacy no selection', 'selected', 'both',
      '60000000-0000-4000-8000-000000001552'
    )
  )$$,
  'a valid source-scoped slide is prepared for the legacy migration fixture'
);

select lives_ok(
  $$insert into s154_created values (
    'pinned-excluded',
    pg_temp.s154_create_club_slide(
      'tenant-a-secondary', 'S154 pinned excluded', 'selected', 'both',
      '60000000-0000-4000-8000-000000001553'
    )
  )$$,
  'a second slide is prepared to prove pinned slides stay outside forced refresh'
);

select lives_ok(
  $$insert into s154_created values (
    'open-draft-preserved',
    pg_temp.s154_create_club_slide(
      'tenant-a-secondary', 'S154 open draft excluded', 'selected', 'both',
      '60000000-0000-4000-8000-000000001554'
    )
  )$$,
  'a third slide is prepared to prove an open draft stays intact during published-version repair'
);

reset role;

create function pg_temp.claim_s154_render_v1(
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
  order by snapshot.created_at desc, snapshot.id desc, job.id
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

create temporary table s154_initial_render_claims as
select created.name, claim.*
from s154_created created
cross join lateral pg_temp.claim_s154_render_v1(
  (created.result #>> '{slides,0,slideId}')::uuid,
  's154-legacy-render-worker'
) claim
where created.name in (
  'legacy-no-selection',
  'pinned-excluded',
  'open-draft-preserved'
);

select is(
  (select count(*) from s154_initial_render_claims),
  3::bigint,
  'the migration fixtures each claim exactly one initial immutable render'
);

select lives_ok(
  $sql$do $complete$
    declare
      claim record;
    begin
      for claim in
        select * from s154_initial_render_claims order by name
      loop
        perform public.complete_dynamic_render_job_v1(
          claim.job_id,
          's154-legacy-render-worker',
          'tenants/' || claim.tenant_id::text || '/assets/' ||
            claim.output_media_asset_id::text || '/dynamic-slide.png',
          4096,
          repeat(substr(md5(claim.name), 1, 1), 64),
          1920,
          1080
        );
      end loop;
    end
  $complete$$sql$,
  'all migration fixture renders become published immutable snapshots'
);

reset role;

select ok(
  (
    select count(*) = 3
    from s154_created created
    join public.dynamic_slides slide
      on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
    join public.dynamic_slide_versions version
      on version.id = slide.current_published_version_id
    where created.name in (
        'legacy-no-selection',
        'pinned-excluded',
        'open-draft-preserved'
      )
      and slide.status = 'ready'
      and slide.current_snapshot_id =
        (created.result #>> '{slides,0,snapshotId}')::uuid
      and version.status = 'published'
  ),
  'all prepared fixtures have a ready last-known-good snapshot and published version'
);

create temporary table s154_excluded_before as
select
  created.name,
  slide.id slide_id,
  slide.current_published_version_id version_id,
  slide.current_snapshot_id snapshot_id
from s154_created created
join public.dynamic_slides slide
  on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
where created.name in ('pinned-excluded', 'open-draft-preserved');
grant select on s154_excluded_before to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001541',
  true
);

select lives_ok(
  $$select public.create_or_resume_dynamic_slide_version_v1(
    (
      select slide_id
      from s154_excluded_before
      where name = 'open-draft-preserved'
    ),
    null
  )$$,
  'the open-draft preservation fixture receives an unpublished authoring draft'
);

reset role;

-- Make the open authoring draft observably different from its published
-- version. The corrective queue must render published `both`, not this draft's
-- `away` selection, and may not modify either mirrored draft representation.
update public.dynamic_slides slide
set configuration_json = jsonb_set(
      slide.configuration_json,
      '{teamSelection,matchLocation}',
      '"away"'::jsonb
    ),
    revision = slide.revision + 1
from s154_excluded_before excluded
where excluded.name = 'open-draft-preserved'
  and slide.id = excluded.slide_id;

create temporary table s154_open_draft_before as
select
  slide.id slide_id,
  slide.current_published_version_id published_version_id,
  slide.active_draft_version_id draft_version_id,
  slide.configuration_json mirrored_configuration_json,
  to_jsonb(draft) draft_version_row
from s154_excluded_before excluded
join public.dynamic_slides slide on slide.id = excluded.slide_id
join public.dynamic_slide_versions draft
  on draft.id = slide.active_draft_version_id
where excluded.name = 'open-draft-preserved';

-- Simulate a previously published pinned slide without rewriting it through
-- the authoring API. This is fixture setup only and rolls back with the test.
set local session_replication_role = replica;
update public.dynamic_slides slide
set selection_mode = 'pinned'
from s154_excluded_before excluded
where excluded.name = 'pinned-excluded'
  and slide.id = excluded.slide_id;
update public.dynamic_slide_versions version
set selection_mode = 'pinned'
from s154_excluded_before excluded
where excluded.name = 'pinned-excluded'
  and version.id = excluded.version_id;
set local session_replication_role = origin;

-- Make the provider state newer than all three current snapshots. Only the
-- eligible latest slide may receive a replacement from the rollout queue.
insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values (
  '10000000-0000-4000-8000-000000001541',
  (select connection_id from s154_sources where name = 'tenant-a-secondary'),
  's154-legacy-new', statement_timestamp() + interval '1 day 14 minutes',
  'scheduled',
  '{"externalId":"s154-legacy-own","name":"S154 legacy eigen team"}',
  '{"externalId":"s154-legacy-opponent-e","name":"Legacy tegenstander E"}',
  '{"externalId":"s154-competition","name":"S154 competitie"}',
  '{"externalId":"s154-pool","name":"S154 poule"}',
  '{"field":"Veld 14"}', '{}', '[]', false, false, true
);

create temporary table s154_legacy_before as
select
  slide.id slide_id,
  slide.current_published_version_id version_id,
  slide.current_snapshot_id snapshot_id,
  snapshot.snapshot_data_json
from s154_created created
join public.dynamic_slides slide
  on slide.id = (created.result #>> '{slides,0,slideId}')::uuid
join public.dynamic_slide_snapshots snapshot
  on snapshot.id = slide.current_snapshot_id
where created.name = 'legacy-no-selection';

-- Simulate rows that predate S153. Production never performs these writes:
-- S154 only reads this historical shape and queues a replacement snapshot.
set local session_replication_role = replica;
update public.dynamic_slides slide
set configuration_json = slide.configuration_json - 'teamSelection'
from s154_legacy_before legacy
where slide.id = legacy.slide_id;
update public.dynamic_slide_versions version
set configuration_json = version.configuration_json - 'teamSelection'
from s154_legacy_before legacy
where version.id = legacy.version_id;
set local session_replication_role = origin;

select ok(
  (
    select
      built.data #>> '{sport,matchLocation}' = 'both'
      and built.data #>> '{sport,teamSelectionMode}' = 'all'
      and built.data #>> '{sport,selectedTeamCount}' = '2'
      and (
        select string_agg(item.value ->> 'id', ',' order by item.ordinality)
        from jsonb_array_elements(
          built.data #> '{sport,items}'
        ) with ordinality item(value, ordinality)
      ) = 's154-legacy-home,s154-legacy-away,s154-legacy-new'
    from s154_legacy_before legacy
    join public.dynamic_slides slide on slide.id = legacy.slide_id
    cross join lateral (
      select private.build_dynamic_snapshot_data(slide) data
    ) built
  ),
  'legacy no-teamSelection becomes all own teams and both directions while foreign fixtures stay excluded'
);

select is(
  private.queue_club_match_scope_snapshots_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-secondary')
  ),
  2,
  'the S154 repair queues published-version snapshots for legacy and open-draft latest slides'
);

select ok(
  (
    select
      snapshot.snapshot_data_json #>> '{sport,matchLocation}' = 'both'
      and snapshot.snapshot_data_json #>> '{sport,teamSelectionMode}' = 'all'
      and snapshot.snapshot_data_json #>> '{sport,selectedTeamCount}' = '2'
      and (
        select string_agg(item.value ->> 'id', ',' order by item.ordinality)
        from jsonb_array_elements(
          snapshot.snapshot_data_json #> '{sport,items}'
        ) with ordinality item(value, ordinality)
      ) = 's154-legacy-home,s154-legacy-away,s154-legacy-new'
    from s154_legacy_before legacy
    join public.dynamic_slide_snapshots snapshot
      on snapshot.dynamic_slide_id = legacy.slide_id
     and snapshot.id <> legacy.snapshot_id
  ),
  'the queued replacement contains only same-source active own-team matches'
);

select ok(
  (
    select count(*) = 2
    from s154_legacy_before legacy
    join public.dynamic_slide_snapshots snapshot
      on snapshot.dynamic_slide_id = legacy.slide_id
  )
  and (
    select count(*) = 1
    from s154_legacy_before legacy
    join public.dynamic_slide_snapshots snapshot
      on snapshot.dynamic_slide_id = legacy.slide_id
     and snapshot.id <> legacy.snapshot_id
    join public.dynamic_render_jobs job
      on job.tenant_id = snapshot.tenant_id
     and job.snapshot_id = snapshot.id
    where snapshot.status = 'queued'
      and job.status = 'queued'
  ),
  'the backfill adds exactly one queued snapshot and one render job'
);

select ok(
  (
    select count(*) = 1
    from s154_excluded_before excluded
    join public.dynamic_slides slide on slide.id = excluded.slide_id
    where excluded.name = 'pinned-excluded'
      and slide.selection_mode = 'pinned'
      and slide.current_snapshot_id = excluded.snapshot_id
      and (
        select count(*)
        from public.dynamic_slide_snapshots snapshot
        where snapshot.dynamic_slide_id = excluded.slide_id
      ) = 1
  ),
  'forced scope rollout leaves the pinned slide untouched'
);

select ok(
  (
    select
      slide.current_snapshot_id = excluded.snapshot_id
      and slide.active_draft_version_id = before.draft_version_id
      and slide.configuration_json = before.mirrored_configuration_json
      and to_jsonb(draft) = before.draft_version_row
      and draft.status = 'draft'
      and draft.configuration_json #>>
        '{teamSelection,matchLocation}' = 'away'
      and published.configuration_json #>>
        '{teamSelection,matchLocation}' = 'both'
      and (
        select count(*)
        from public.dynamic_slide_snapshots snapshot
        where snapshot.dynamic_slide_id = excluded.slide_id
      ) = 2
      and (
        select count(*) = 1
        from public.dynamic_slide_snapshots snapshot
        join public.dynamic_render_jobs job
          on job.tenant_id = snapshot.tenant_id
         and job.snapshot_id = snapshot.id
        where snapshot.dynamic_slide_id = excluded.slide_id
          and snapshot.id <> excluded.snapshot_id
          and snapshot.dynamic_slide_version_id =
            before.published_version_id
          and snapshot.snapshot_data_json #>>
            '{sport,matchLocation}' = 'both'
          and (
            select string_agg(
              item.value ->> 'id',
              ',' order by item.ordinality
            )
            from jsonb_array_elements(
              snapshot.snapshot_data_json #> '{sport,items}'
            ) with ordinality item(value, ordinality)
          ) = 's154-legacy-home,s154-legacy-away,s154-legacy-new'
          and snapshot.status = 'queued'
          and job.status = 'queued'
      )
    from s154_excluded_before excluded
    join s154_open_draft_before before
      on before.slide_id = excluded.slide_id
    join public.dynamic_slides slide on slide.id = excluded.slide_id
    join public.dynamic_slide_versions draft
      on draft.id = slide.active_draft_version_id
    join public.dynamic_slide_versions published
      on published.id = slide.current_published_version_id
    where excluded.name = 'open-draft-preserved'
  ),
  'open draft stays byte-identical while correction targets its exact published version'
);

select ok(
  (
    select
      slide.current_snapshot_id = legacy.snapshot_id
      and current_snapshot.snapshot_data_json = legacy.snapshot_data_json
      and current_snapshot.status = 'ready'
    from s154_legacy_before legacy
    join public.dynamic_slides slide on slide.id = legacy.slide_id
    join public.dynamic_slide_snapshots current_snapshot
      on current_snapshot.id = legacy.snapshot_id
  ),
  'queueing preserves the current last-known-good pointer and historical snapshot bytes'
);

select is(
  private.queue_club_match_scope_snapshots_v1(
    '10000000-0000-4000-8000-000000001541',
    (select data_source_id from s154_sources where name = 'tenant-a-secondary')
  ),
  0,
  'repeating the S154 repair queue is idempotent while replacements are pending'
);

select throws_ok(
  $$update public.dynamic_slide_snapshots snapshot
    set snapshot_data_json = jsonb_set(
      snapshot.snapshot_data_json,
      '{sport,matchLocation}',
      '"away"'::jsonb
    )
    from s154_legacy_before legacy
    where snapshot.id = legacy.snapshot_id$$,
  '55000', null,
  'the S154 correction cannot mutate the historical ready snapshot'
);

select * from finish();
rollback;
