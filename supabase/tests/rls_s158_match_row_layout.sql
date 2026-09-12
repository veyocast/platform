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


select plan(22);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001581',
  'authenticated',
  'authenticated',
  's158-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000001581',
  'S158 owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001581',
  'S158 tenant',
  's158-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001581'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001581',
  '00000000-0000-4000-8000-000000001581',
  'tenant_owner'
);

create temporary table s158_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s158_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001581',
  'Sportlink · S158',
  'S158',
  '1581',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s158_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001581'
  and source.name = 'Sportlink · S158';

insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, active, metadata
) values
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-selected',
    'S158 geselecteerd team',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-club-comp",
          "name":"S158 clubcompetitie",
          "period":"s158-club-phase",
          "poolExternalId":"s158-club-pool",
          "poolName":"S158 clubpoule",
          "season":"2026"
        },
        {
          "externalId":"s158-pool-comp",
          "name":"S158 poulecompetitie",
          "period":"s158-pool-phase",
          "poolExternalId":"s158-pool-exact",
          "poolName":"S158 exacte poule",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-other-own',
    'S158 ander eigen team',
    true,
    '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-ambiguous',
    'S158 team met ambigue poule',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-amb-comp-a",
          "name":"S158 ambigu A",
          "period":"s158-amb-phase-a",
          "poolExternalId":"s158-amb-pool-a",
          "poolName":"S158 ambigue poule A",
          "season":"2026"
        },
        {
          "externalId":"s158-amb-comp-b",
          "name":"S158 ambigu B",
          "period":"s158-amb-phase-b",
          "poolExternalId":"s158-amb-pool-b",
          "poolName":"S158 ambigue poule B",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-metadata-ambiguous',
    'S158 team met alleen ambigue metadata',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-meta-comp-a",
          "period":"s158-meta-phase-a",
          "poolExternalId":"s158-meta-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s158-meta-comp-b",
          "period":"s158-meta-phase-b",
          "poolExternalId":"s158-meta-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-standing-ambiguous',
    'S158 team met ambigue standen',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-standing-comp-a",
          "period":"s158-standing-phase-a",
          "poolExternalId":"s158-standing-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s158-standing-comp-b",
          "period":"s158-standing-phase-b",
          "poolExternalId":"s158-standing-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-pinned-ambiguous',
    'S158 team met ambigue pinned context',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-pinned-comp",
          "period":"s158-pinned-phase-a",
          "poolExternalId":"s158-pinned-pool",
          "season":"2025"
        },
        {
          "externalId":"s158-pinned-comp",
          "period":"s158-pinned-phase-b",
          "poolExternalId":"s158-pinned-pool",
          "season":"2026"
        }
      ]
    }'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-priority',
    'S158 team met één actuele poule',
    true,
    '{
      "competitionOptions":[
        {
          "externalId":"s158-priority-comp-a",
          "period":"s158-priority-phase-a",
          "poolExternalId":"s158-priority-pool-a",
          "season":"2026"
        },
        {
          "externalId":"s158-priority-comp-b",
          "period":"s158-priority-phase-b",
          "poolExternalId":"s158-priority-pool-b",
          "season":"2026"
        }
      ]
    }'::jsonb
  );

create temporary table s158_created (
  name text primary key,
  result jsonb not null
);
grant select, insert on s158_created to authenticated;

create function pg_temp.s158_context(
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

create function pg_temp.s158_draft(
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
  context := pg_temp.s158_context(
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

create function pg_temp.s158_create_slide(
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
    '10000000-0000-4000-8000-000000001581',
    (select source.data_source_id from pg_temp.s158_source source),
    pg_catalog.jsonb_build_array(pg_temp.s158_draft(
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

grant execute on function pg_temp.s158_context(
  text, text, text, text, text, text
) to authenticated;
grant execute on function pg_temp.s158_draft(
  text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;
grant execute on function pg_temp.s158_create_slide(
  text, text, text, text, text, text, text, text, text, jsonb, uuid
) to authenticated;

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_sportlink_slide_batch_v5(uuid,uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_sportlink_slide_batch_v5(uuid,uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.create_sportlink_slide_batch_v5(uuid,uuid,jsonb,uuid)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join lateral pg_catalog.aclexplode(coalesce(
      procedure.proacl,
      pg_catalog.acldefault('f', procedure.proowner)
    )) privilege
    where procedure.oid =
      'public.create_sportlink_slide_batch_v5(uuid,uuid,jsonb,uuid)'
        ::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'v5 is executable only by authenticated Data API callers and not PUBLIC'
);

select ok(
  (
    select procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc procedure
    where procedure.oid =
      'public.create_sportlink_slide_batch_v5(uuid,uuid,jsonb,uuid)'
        ::regprocedure
  )
  and not has_function_privilege(
    'authenticated',
    'private.resolve_sportlink_pool_context_v1(uuid,uuid,jsonb,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.resolve_sportlink_pool_context_v1(uuid,uuid,jsonb,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.build_dynamic_snapshot_data(public.dynamic_slides)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.queue_match_row_snapshots_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'v5 is a hardened definer while its resolver, builder and queue remain private'
);

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-club-selected-home',
    pg_temp.match_time_today(time '09:00', false),
    'scheduled',
    '{"externalId":"s158-selected","name":"S158 geselecteerd team"}',
    '{"externalId":"s158-club-visitor-home","name":"Clubbezoeker thuis"}',
    '{"externalId":"s158-club-comp","name":"S158 clubcompetitie","period":"s158-club-phase","season":"2026"}',
    '{"externalId":"s158-club-pool","name":"S158 clubpoule"}',
    '{"name":"Sportpark S158","field":"Veld C1"}',
    '{"home":"C1 thuis","away":"C1 uit"}',
    '["Scheidsrechter C1"]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-club-selected-away',
    pg_temp.match_time_today(time '10:00', false),
    'scheduled',
    '{"externalId":"s158-club-visitor-away","name":"Clubbezoeker uit"}',
    '{"externalId":"s158-selected","name":"S158 geselecteerd team"}',
    '{"externalId":"s158-club-comp","name":"S158 clubcompetitie","period":"s158-club-phase","season":"2026"}',
    '{"externalId":"s158-club-pool","name":"S158 clubpoule"}',
    '{"name":"Sportpark bezoeker","field":"Veld C2"}',
    '{"home":"C2 thuis","away":"C2 uit"}',
    '["Scheidsrechter C2"]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-club-other-own-home',
    pg_temp.match_time_today(time '11:00', false),
    'scheduled',
    '{"externalId":"s158-other-own","name":"S158 ander eigen team"}',
    '{"externalId":"s158-club-visitor-other","name":"Andere bezoeker"}',
    '{"externalId":"s158-club-comp","name":"S158 clubcompetitie","period":"s158-club-phase","season":"2026"}',
    '{"externalId":"s158-club-pool","name":"S158 clubpoule"}',
    '{"name":"Sportpark S158","field":"Veld C3"}',
    '{}',
    '[]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-club-foreign',
    pg_temp.match_time_today(time '12:00', false),
    'scheduled',
    '{"externalId":"s158-club-foreign-home","name":"Vreemd thuis"}',
    '{"externalId":"s158-club-foreign-away","name":"Vreemd uit"}',
    '{"externalId":"s158-club-comp","name":"S158 clubcompetitie","period":"s158-club-phase","season":"2026"}',
    '{"externalId":"s158-club-pool","name":"S158 clubpoule"}',
    '{"name":"Sportpark vreemd","field":"Veld C4"}',
    '{}',
    '[]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-ambiguous-fixture-a',
    pg_temp.match_time_today(time '18:00', false),
    'scheduled',
    '{"externalId":"s158-ambiguous","name":"S158 team met ambigue poule"}',
    '{"externalId":"s158-ambiguous-away-a","name":"Ambigu uit A"}',
    '{"externalId":"s158-amb-comp-a","name":"S158 ambigu A","period":"s158-amb-phase-a","season":"2026"}',
    '{"externalId":"s158-amb-pool-a","name":"S158 ambigue poule A"}',
    '{"name":"Sportpark ambigu A","field":"Veld A"}',
    '{}',
    '[]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-ambiguous-fixture-b',
    pg_temp.match_time_today(time '19:00', false),
    'scheduled',
    '{"externalId":"s158-ambiguous-home-b","name":"Ambigu thuis B"}',
    '{"externalId":"s158-ambiguous","name":"S158 team met ambigue poule"}',
    '{"externalId":"s158-amb-comp-b","name":"S158 ambigu B","period":"s158-amb-phase-b","season":"2026"}',
    '{"externalId":"s158-amb-pool-b","name":"S158 ambigue poule B"}',
    '{"name":"Sportpark ambigu B","field":"Veld B"}',
    '{}',
    '[]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-priority-today',
    pg_temp.match_time_today(time '20:00', false),
    'scheduled',
    '{"externalId":"s158-priority","name":"S158 team met één actuele poule"}',
    '{"externalId":"s158-priority-away-a","name":"Prioriteit uit A"}',
    '{"externalId":"s158-priority-comp-a","name":"Prioriteit A","period":"s158-priority-phase-a","season":"2026"}',
    '{"externalId":"s158-priority-pool-a","name":"Prioriteitspoule A"}',
    '{"name":"Sportpark prioriteit A","field":"Veld PA"}',
    '{}',
    '[]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-priority-horizon',
    (((now() at time zone 'Europe/Amsterdam')::date + 8 + time '20:00')
      at time zone 'Europe/Amsterdam'),
    'scheduled',
    '{"externalId":"s158-priority","name":"S158 team met één actuele poule"}',
    '{"externalId":"s158-priority-away-b","name":"Prioriteit uit B"}',
    '{"externalId":"s158-priority-comp-b","name":"Prioriteit B","period":"s158-priority-phase-b","season":"2026"}',
    '{"externalId":"s158-priority-pool-b","name":"Prioriteitspoule B"}',
    '{"name":"Sportpark prioriteit B","field":"Veld PB"}',
    '{}',
    '[]',
    false,
    true,
    true
  );

insert into public.sports_standings (
  tenant_id, source_connection_id, external_id, pool_external_id,
  rows_json, scores_published, season_key, metadata
) values
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-standing-a',
    's158-standing-pool-a',
    '[{"externalId":"s158-standing-ambiguous","teamName":"S158 team met ambigue standen"}]',
    true,
    '2026',
    '{
      "competition":{"externalId":"s158-standing-comp-a"},
      "pool":{"externalId":"s158-standing-pool-a"}
    }'
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-standing-b',
    's158-standing-pool-b',
    '[{"externalId":"s158-standing-ambiguous","teamName":"S158 team met ambigue standen"}]',
    true,
    '2026',
    '{
      "competition":{"externalId":"s158-standing-comp-b"},
      "pool":{"externalId":"s158-standing-pool-b"}
    }'
  );

select is(
  private.resolve_sportlink_pool_context_v1(
    '10000000-0000-4000-8000-000000001581',
    (select data_source_id from s158_source),
    pg_temp.s158_context('s158-metadata-ambiguous', 'auto_current'),
    'sportlink.pool_schedule_today'
  ),
  null::jsonb,
  'metadata with multiple exact pool tuples fails closed'
);

select is(
  private.resolve_sportlink_pool_context_v1(
    '10000000-0000-4000-8000-000000001581',
    (select data_source_id from s158_source),
    pg_temp.s158_context('s158-standing-ambiguous', 'auto_current'),
    'sportlink.pool_schedule_today'
  ),
  null::jsonb,
  'standing evidence with multiple exact pool tuples fails closed'
);

select is(
  private.resolve_sportlink_pool_context_v1(
    '10000000-0000-4000-8000-000000001581',
    (select data_source_id from s158_source),
    pg_temp.s158_context(
      's158-pinned-ambiguous', 'pinned',
      's158-pinned-comp', null, 's158-pinned-pool', null
    ),
    'sportlink.pool_schedule_today'
  ),
  null::jsonb,
  'pinned context without phase and season fails closed when two tuples match'
);

select is(
  private.resolve_sportlink_pool_context_v1(
    '10000000-0000-4000-8000-000000001581',
    (select data_source_id from s158_source),
    pg_temp.s158_context('s158-priority', 'auto_current'),
    'sportlink.pool_schedule_today'
  ) ->> 'poolId',
  's158-priority-pool-a',
  'one current-window fixture wins over a different wider-horizon pool'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select lives_ok(
  $$insert into s158_created values (
    'club-home',
    pg_temp.s158_create_slide(
      'S158 club thuis',
      'sportlink.club_schedule_today',
      's158-selected',
      'auto_current',
      null, null, null, null,
      'home',
      '{}'::jsonb,
      '60000000-0000-4000-8000-000000001581'
    )
  )$$,
  'v5 delegates one selected-team home slide without widening its scope'
);

select lives_ok(
  $$insert into s158_created values (
    'club-away',
    pg_temp.s158_create_slide(
      'S158 club uit',
      'sportlink.club_schedule_today',
      's158-selected',
      'auto_current',
      null, null, null, null,
      'away',
      '{}'::jsonb,
      '60000000-0000-4000-8000-000000001582'
    )
  )$$,
  'v5 delegates one selected-team away slide without widening its scope'
);

reset role;

select is(
  (
    select pg_catalog.string_agg(
      created.name || '=' || coalesce((
        select pg_catalog.string_agg(
          item.value ->> 'id',
          ',' order by item.value ->> 'id'
        )
        from pg_catalog.jsonb_array_elements(
          snapshot.snapshot_data_json #> '{sport,items}'
        ) item(value)
      ), ''),
      ';' order by created.name
    )
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    where created.name in ('club-home', 'club-away')
  ),
  'club-away=s158-club-selected-away;' ||
    'club-home=s158-club-selected-home',
  'club snapshots include only the selected own team on the requested side'
);

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-pool-own',
    pg_temp.match_time_today(time '13:00', false),
    'scheduled',
    '{"externalId":"s158-selected","name":"S158 geselecteerd team"}',
    '{"externalId":"s158-pool-visitor","name":"Poulebezoeker"}',
    '{"externalId":"s158-pool-comp","name":"S158 poulecompetitie","period":"s158-pool-phase","season":"2026"}',
    '{"externalId":"s158-pool-exact","name":"S158 exacte poule"}',
    '{"name":"Sportpark S158","field":"Veld P1"}',
    '{"home":"P1 thuis","away":"P1 uit"}',
    '["Scheidsrechter P1"]',
    false,
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-pool-foreign',
    pg_temp.match_time_today(time '14:00', false),
    'scheduled',
    '{"externalId":"s158-pool-foreign-home","name":"Poule vreemd thuis"}',
    '{"externalId":"s158-pool-foreign-away","name":"Poule vreemd uit"}',
    '{"externalId":"s158-pool-comp","name":"S158 poulecompetitie","period":"s158-pool-phase","season":"2026"}',
    '{"externalId":"s158-pool-exact","name":"S158 exacte poule"}',
    '{"name":"Sportpark vreemd","field":"Veld P2"}',
    '{"home":"P2 thuis","away":"P2 uit"}',
    '["Scheidsrechter P2"]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-pool-wrong-pool',
    pg_temp.match_time_today(time '15:00', false),
    'scheduled',
    '{"externalId":"s158-wrong-pool-home","name":"Verkeerde poule thuis"}',
    '{"externalId":"s158-wrong-pool-away","name":"Verkeerde poule uit"}',
    '{"externalId":"s158-pool-comp","name":"S158 poulecompetitie","period":"s158-pool-phase","season":"2026"}',
    '{"externalId":"s158-pool-other","name":"S158 verkeerde poule"}',
    '{"name":"Sportpark verkeerd","field":"Veld P3"}',
    '{}',
    '[]',
    false,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000001581',
    (select connection_id from s158_source),
    's158-pool-wrong-phase',
    pg_temp.match_time_today(time '16:00', false),
    'scheduled',
    '{"externalId":"s158-wrong-phase-home","name":"Verkeerde fase thuis"}',
    '{"externalId":"s158-wrong-phase-away","name":"Verkeerde fase uit"}',
    '{"externalId":"s158-pool-comp","name":"S158 poulecompetitie","period":"s158-other-phase","season":"2026"}',
    '{"externalId":"s158-pool-exact","name":"S158 exacte poule"}',
    '{"name":"Sportpark verkeerd","field":"Veld P4"}',
    '{}',
    '[]',
    false,
    false,
    true
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select lives_ok(
  $$insert into s158_created values (
    'pool-exact',
    pg_temp.s158_create_slide(
      'S158 poule vandaag',
      'sportlink.pool_schedule_today',
      's158-selected',
      'pinned',
      's158-pool-comp',
      's158-pool-phase',
      's158-pool-exact',
      '2026',
      null,
      '{}'::jsonb,
      '60000000-0000-4000-8000-000000001583'
    )
  )$$,
  'v5 creates an exact pinned pool programme for today'
);

reset role;

select is(
  (
    select pg_catalog.string_agg(
      item.value ->> 'id',
      ',' order by item.value ->> 'id'
    )
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral pg_catalog.jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) item(value)
    where created.name = 'pool-exact'
  ),
  's158-pool-foreign,s158-pool-own',
  'a pool slide includes every exact-pool match, including foreign versus foreign'
);

select ok(
  (
    select snapshot.snapshot_data_json #>>
        '{sport,poolContext,competitionId}' = 's158-pool-comp'
      and snapshot.snapshot_data_json #>>
        '{sport,poolContext,phaseId}' = 's158-pool-phase'
      and snapshot.snapshot_data_json #>>
        '{sport,poolContext,poolId}' = 's158-pool-exact'
      and snapshot.snapshot_data_json #>>
        '{sport,poolContext,seasonId}' = '2026'
      and snapshot.snapshot_data_json #>>
        '{sport,poolContext,sourceConnectionId}' = source.connection_id::text
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join s158_source source
    where created.name = 'pool-exact'
  ),
  'the pool snapshot freezes one exact competition, phase, pool, season and source'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select lives_ok(
  $$insert into s158_created values (
    'pool-ambiguous',
    pg_temp.s158_create_slide(
      'S158 onopgeloste poule',
      'sportlink.pool_schedule_today',
      's158-ambiguous',
      'auto_current',
      null, null, null, null,
      null,
      '{}'::jsonb,
      '60000000-0000-4000-8000-000000001584'
    )
  )$$,
  'v5 safely creates an auto-current pool slide without broadening ambiguity'
);

reset role;

select ok(
  (
    select snapshot.snapshot_data_json #> '{sport,items}' = '[]'::jsonb
      and snapshot.snapshot_data_json #> '{sport,poolContext}' = 'null'::jsonb
      and snapshot.snapshot_data_json #>> '{sport,emptyStateCode}' =
        'COMPETITION_CONTEXT_UNRESOLVED'
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    where created.name = 'pool-ambiguous'
  ),
  'an unresolved auto-current pool fails closed with no cross-pool items'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select throws_ok(
  $$select pg_temp.s158_create_slide(
    'S158 poule zonder pool-ID',
    'sportlink.pool_schedule_today',
    's158-selected',
    'pinned',
    's158-pool-comp',
    's158-pool-phase',
    null,
    '2026',
    null,
    '{}'::jsonb,
    '60000000-0000-4000-8000-000000001585'
  )$$,
  '22023',
  null,
  'v5 rejects a pinned pool draft without an exact pool ID'
);

reset role;

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values (
  '10000000-0000-4000-8000-000000001581',
  (select connection_id from s158_source),
  's158-result-unknown',
  pg_temp.match_time_today(time '17:00', true),
    'finished',
  '{"externalId":"s158-result-home","name":"Uitslag thuis","score":"9"}',
  '{"externalId":"s158-result-away","name":"Uitslag uit","score":"8"}',
  '{"externalId":"s158-pool-comp","name":"S158 poulecompetitie","period":"s158-pool-phase","season":"2026"}',
  '{"externalId":"s158-pool-exact","name":"S158 exacte poule"}',
  '{"name":"Sportpark resultaat","field":"Veld R1"}',
  '{"home":"R1 thuis","away":"R1 uit"}',
  '["Scheidsrechter R1"]',
  false,
  false,
  true
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select lives_ok(
  $$insert into s158_created values (
    'result-unknown',
    pg_temp.s158_create_slide(
      'S158 uitslag onbekend',
      'sportlink.pool_results_today',
      's158-selected',
      'pinned',
      's158-pool-comp',
      's158-pool-phase',
      's158-pool-exact',
      '2026',
      null,
      '{
        "columns":"two",
        "showAwayDressingRoom":true,
        "showAwayLogo":false,
        "showDate":false,
        "showDressingRoom":true,
        "showField":false,
        "showHomeAway":false,
        "showHomeDressingRoom":false,
        "showHomeLogo":true,
        "showLogo":true,
        "showReferee":true,
        "showSportpark":true,
        "showTime":false
      }'::jsonb,
      '60000000-0000-4000-8000-000000001586'
    )
  )$$,
  'v5 creates a pool result slide when a finished score is not published'
);

reset role;

select ok(
  (
    select count(*) = 1
      and pg_catalog.bool_and(item.value ->> 'id' = 's158-result-unknown')
      and pg_catalog.bool_and(item.value -> 'homeScore' is null)
      and pg_catalog.bool_and(item.value -> 'awayScore' is null)
      and pg_catalog.bool_and(item.value -> 'homeRoom' is null)
      and pg_catalog.bool_and(item.value ->> 'awayRoom' = 'R1 uit')
      and pg_catalog.bool_and(item.value -> 'field' is null)
      and pg_catalog.bool_and(item.value ->> 'venueName' =
        'Sportpark resultaat')
      and pg_catalog.bool_and(item.value -> 'officials' =
        '["Scheidsrechter R1"]'::jsonb)
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    cross join lateral pg_catalog.jsonb_array_elements(
      snapshot.snapshot_data_json #> '{sport,items}'
    ) item(value)
    where created.name = 'result-unknown'
  ),
  'the finished row remains present with blank scores and projected optional details'
);

select is(
  (
    select snapshot.snapshot_data_json #> '{sport,displayConfig}'
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    where created.name = 'result-unknown'
  ),
  '{
    "columns":"two",
    "showAwayDressingRoom":true,
    "showAwayLogo":false,
    "showDate":false,
    "showDressingRoom":true,
    "showField":false,
    "showHomeAway":false,
    "showHomeDressingRoom":false,
    "showHomeLogo":true,
    "showLogo":true,
    "showReferee":true,
    "showSportpark":true,
    "showTime":false
  }'::jsonb,
  'the snapshot freezes the exact independent 13-key display contract'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select lives_ok(
  $$insert into s158_created values (
    'legacy-display',
    pg_temp.s158_create_slide(
      'S158 legacy weergave',
      'sportlink.pool_schedule_today',
      's158-selected',
      'pinned',
      's158-pool-comp',
      's158-pool-phase',
      's158-pool-exact',
      '2026',
      null,
      '{
        "columns":"one",
        "showDressingRoom":true,
        "showField":false,
        "showHomeAway":true,
        "showLogo":false,
        "showReferee":true
      }'::jsonb,
      '60000000-0000-4000-8000-000000001587'
    )
  )$$,
  'v5 accepts the established six-key display contract for safe normalization'
);

reset role;

select is(
  (
    select snapshot.snapshot_data_json #> '{sport,displayConfig}'
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    where created.name = 'legacy-display'
  ),
  '{
    "columns":"one",
    "showAwayDressingRoom":true,
    "showAwayLogo":false,
    "showDate":true,
    "showDressingRoom":true,
    "showField":false,
    "showHomeAway":true,
    "showHomeDressingRoom":true,
    "showHomeLogo":false,
    "showLogo":false,
    "showReferee":true,
    "showSportpark":true,
    "showTime":true
  }'::jsonb,
  'legacy logo and dressing-room choices inherit to both sides in the 13-key snapshot'
);

select ok(
  (
    select count(*) = 6
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #> '{themePresentation,selection}' =
          profile.selection_json
      )
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #> '{themePresentation,appearance}' =
          profile.appearance_config
      )
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #>>
          '{themePresentation,settingsRevision}' = profile.revision::text
      )
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #>>
          '{themePresentation,snapshotVersion}' = '2'
      )
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #>>
          '{themePresentation,selection,ref,id}' = 'fieldflow'
      )
      and pg_catalog.bool_and(
        snapshot.snapshot_data_json #>>
          '{themePresentation,selection,ref,version}' = '1.0.0'
      )
    from s158_created created
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = (created.result #>> '{slides,0,snapshotId}')::uuid
    join public.tenant_theme_profiles profile
      on profile.tenant_id = snapshot.tenant_id
     and profile.theme_id = 'fieldflow'
  ),
  'every club and pool snapshot projects the same tenant-default theme snapshot'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001581', true);

select throws_ok(
  $$select public.create_sportlink_slide_batch_v5(
    '10000000-0000-4000-8000-000000001581',
    (select data_source_id from s158_source),
    pg_catalog.jsonb_build_array(
      pg_temp.s158_draft(
        'S158 dubbele clubvariant',
        'sportlink.club_schedule_today',
        's158-selected',
        'auto_current',
        null, null, null, null,
        'home',
        '{}'::jsonb
      ),
      pg_temp.s158_draft(
        'S158 dubbele clubvariant',
        'sportlink.club_schedule_today',
        's158-selected',
        'auto_current',
        null, null, null, null,
        'home',
        '{}'::jsonb
      ),
      pg_temp.s158_draft(
        'S158 pool activeert V5',
        'sportlink.pool_schedule_today',
        's158-selected',
        'pinned',
        's158-pool-comp',
        's158-pool-phase',
        's158-pool-exact',
        '2026',
        null,
        '{}'::jsonb
      )
    ),
    '60000000-0000-4000-8000-000000001588'
  )$$,
  '22023',
  null,
  'a mixed V5 batch preserves V4 duplicate-club rejection atomically'
);

select * from finish();
rollback;
