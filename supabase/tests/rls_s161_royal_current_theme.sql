begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(63);

select ok(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":1,
    "surfaces":{"clubLogoBackground":"#E7F5EE","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-inter-v1","displayFontRef":"vc-manrope-v1","sportScale":1.12}
  }'::jsonb),
  'historical appearance v1 stays valid'
);

select ok(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  'Royal Current v8 default appearance is valid'
);

select ok(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":false,
    "palette":{"version":1,"primary":"#08734D","background":"neutral","secondary":"#DBA745"},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1.2,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1.4}
  }'::jsonb),
  'bounded advanced palette, scale and motion values are valid'
);

select isnt(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v7",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  true,
  'an unknown design revision is rejected'
);

select isnt(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"blue","background":"club","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  true,
  'a non-HEX primary is rejected'
);

select isnt(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"photo","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  true,
  'an unsupported background strategy is rejected'
);

select isnt(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1.21,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  true,
  'text scale above 120 percent is rejected'
);

select isnt(
  private.theme_appearance_settings_is_valid_v1('{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null,"freeCss":"body{}"},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb),
  true,
  'unknown or free-form style keys are rejected'
);

insert into public.tenants (id, name, slug, status) values
  (
    '16100000-0000-4000-8000-000000000001',
    'S161 new tenant',
    's161-new-tenant',
    'active'
  ),
  (
    '16100000-0000-4000-8000-000000000002',
    'S161 legacy tenant',
    's161-legacy-tenant',
    'active'
  );

-- The unchanged S153 trigger calls the replaced S161 ensure function.
insert into public.tenant_settings (tenant_id) values
  ('16100000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000002');

select is(
  (
    select profile.appearance_config
    from public.tenant_theme_profiles profile
    where profile.tenant_id = '16100000-0000-4000-8000-000000000001'
      and profile.theme_id = 'fieldflow'
  ),
  '{
    "schemaVersion":2,
    "designRevision":"royal-current-v8",
    "motionEnabled":true,
    "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null},
    "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
    "typography":{"baseScale":1,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1}
  }'::jsonb,
  'a new tenant receives the exact Royal Current v8 appearance default'
);

select is(
  (
    select profile.selection_json
    from public.tenant_theme_profiles profile
    where profile.tenant_id = '16100000-0000-4000-8000-000000000001'
      and profile.theme_id = 'fieldflow'
  ),
  '{
    "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
    "modePolicy":{"kind":"fixed","mode":"light"},
    "accent":"#2459ED",
    "support":null,
    "categoryOverrides":[]
  }'::jsonb,
  'a new tenant receives one authorable FieldFlow selection'
);

select ok(
  (
    select count(*) = 1
      and min(profile.revision) = min(settings.theme_settings_revision)
    from public.tenant_theme_profiles profile
    join public.tenant_settings settings
      on settings.tenant_id = profile.tenant_id
    where profile.tenant_id = '16100000-0000-4000-8000-000000000001'
  ),
  'new-tenant provisioning creates exactly one revision-aligned profile'
);

update public.tenant_theme_profiles profile
set appearance_config = '{
      "schemaVersion":1,
      "surfaces":{"clubLogoBackground":"#E7F5EE","homeLogoBackground":"#FFFFFF"},
      "typography":{"baseScale":1,"bodyFontRef":"vc-inter-v1","displayFontRef":"vc-manrope-v1","sportScale":1.12}
    }'::jsonb,
    revision = 73
where profile.tenant_id = '16100000-0000-4000-8000-000000000002'
  and profile.theme_id = 'fieldflow';

create temporary table s161_legacy_profile_before as
select pg_catalog.to_jsonb(profile) as value
from public.tenant_theme_profiles profile
where profile.tenant_id = '16100000-0000-4000-8000-000000000002'
  and profile.theme_id = 'fieldflow';

do $$
begin
  perform private.ensure_tenant_theme_profile_v1(
    '16100000-0000-4000-8000-000000000002'
  );
end;
$$;

select is(
  (
    select pg_catalog.to_jsonb(profile)
    from public.tenant_theme_profiles profile
    where profile.tenant_id = '16100000-0000-4000-8000-000000000002'
      and profile.theme_id = 'fieldflow'
  ),
  (select value from s161_legacy_profile_before),
  'provisioning never mutates an existing legacy profile'
);

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, config_json
) values
  (
    '16100000-0000-4000-8000-000000000011',
    '16100000-0000-4000-8000-000000000001',
    'S161 LED source',
    'ledscores',
    'active',
    'ready',
    '{"schemaVersion":1}'::jsonb
  ),
  (
    '16100000-0000-4000-8000-000000000012',
    '16100000-0000-4000-8000-000000000002',
    'S161 legacy menu source',
    'manual_products',
    'active',
    'ready',
    '{}'::jsonb
  ),
  (
    '16100000-0000-4000-8000-000000000014',
    '16100000-0000-4000-8000-000000000001',
    'S161 complete programme source',
    'sportlink',
    'active',
    'ready',
    '{}'::jsonb
  );

insert into public.ledscores_connections (
  id, tenant_id, name, club_slug, status, health_status, data_source_id
) values (
  '16100000-0000-4000-8000-000000000013',
  '16100000-0000-4000-8000-000000000001',
  'S161 LED connection',
  's161-led-connection',
  'active',
  'connected',
  '16100000-0000-4000-8000-000000000011'
);

insert into public.sportlink_connections (
  id, tenant_id, data_source_id, detected_club_name, client_id_suffix,
  encrypted_client_id, encryption_iv, encryption_tag
) values (
  '16100000-0000-4000-8000-000000000015',
  '16100000-0000-4000-8000-000000000001',
  '16100000-0000-4000-8000-000000000014',
  'S161 club',
  'S161',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

insert into public.sports_teams (
  tenant_id, source_connection_id, external_id, name, active, metadata
) values (
  '16100000-0000-4000-8000-000000000001',
  '16100000-0000-4000-8000-000000000015',
  's161-program-home',
  'S161 thuis JO17-1',
  true,
  '{}'::jsonb
);

insert into public.provider_asset_cache (
  id, provider, entity_type, external_entity_id, asset_role
) values
  (
    '16100000-0000-4000-8000-000000000016',
    'sportlink',
    'team',
    's161-program-home',
    'team_logo'
  ),
  (
    '16100000-0000-4000-8000-000000000017',
    'sportlink',
    'team',
    's161-program-away',
    'team_logo'
  );

insert into public.provider_asset_versions (
  id, cache_id, checksum_sha256, storage_bucket, storage_path, mime_type,
  file_size_bytes, width, height
) values
  (
    '16100000-0000-5000-8000-000000000018',
    '16100000-0000-4000-8000-000000000016',
    repeat('a', 64),
    'provider-assets',
    'providers/sportlink/team_logo/s161-program-home.webp',
    'image/webp',
    4096,
    256,
    256
  ),
  (
    '16100000-0000-5000-8000-000000000019',
    '16100000-0000-4000-8000-000000000017',
    repeat('b', 64),
    'provider-assets',
    'providers/sportlink/team_logo/s161-program-away.webp',
    'image/webp',
    4096,
    256,
    256
  );

update public.provider_asset_cache
set current_version_id = case external_entity_id
  when 's161-program-home'
    then '16100000-0000-5000-8000-000000000018'::uuid
  else '16100000-0000-5000-8000-000000000019'::uuid
end
where id in (
  '16100000-0000-4000-8000-000000000016',
  '16100000-0000-4000-8000-000000000017'
);

insert into public.sports_matches (
  tenant_id, source_connection_id, external_id, starts_at, status,
  home_team, away_team, competition, pool, venue, dressing_rooms, officials,
  scores_published, is_home_match, active
) values (
  '16100000-0000-4000-8000-000000000001',
  '16100000-0000-4000-8000-000000000015',
  's161-complete-programme',
  (((now() at time zone 'Europe/Amsterdam')::date + time '14:30')
    at time zone 'Europe/Amsterdam'),
  'scheduled',
  '{"externalId":"s161-program-home","name":"S161 thuis JO17-1"}',
  '{"externalId":"s161-program-away","name":"S161 uit JO17-2"}',
  '{"externalId":"s161-competition","name":"S161 competitie","period":"1","season":"2026"}',
  '{"externalId":"s161-pool","name":"S161 poule"}',
  '{"name":"Sportpark S161","field":"Veld 7"}',
  '{"home":"Kleedkamer 3","away":"Kleedkamer 4"}',
  '[{"displayName":"Robin Referee","role":"Scheidsrechter"}]',
  false,
  true,
  true
);

create temporary table s161_complete_programme_snapshot as
select private.build_dynamic_snapshot_data(
  pg_catalog.jsonb_populate_record(
    null::public.dynamic_slides,
    '{
      "id":"16100000-0000-4000-8000-000000000020",
      "tenant_id":"16100000-0000-4000-8000-000000000001",
      "name":"S161 compleet programma",
      "slide_type":"sport_program",
      "orientation":"landscape",
      "data_source_id":"16100000-0000-4000-8000-000000000014",
      "selection_mode":"latest",
      "status":"active",
      "configuration_json":{
        "blueprintKey":"sportlink.club_schedule_today",
        "display":{
          "columns":"two",
          "showAwayDressingRoom":true,
          "showAwayLogo":true,
          "showDate":true,
          "showDressingRoom":true,
          "showField":true,
          "showHomeAway":true,
          "showHomeDressingRoom":true,
          "showHomeLogo":true,
          "showLogo":true,
          "showReferee":true,
          "showSportpark":true,
          "showTime":true
        },
        "teamSelection":{
          "matchLocation":"both",
          "mode":"all",
          "teamContexts":[]
        }
      },
      "revision":1
    }'::jsonb
  )
) as payload;

select is(
  (
    select pg_catalog.jsonb_build_object(
      'displayConfig', snapshot.payload #> '{sport,displayConfig}',
      'itemCount', pg_catalog.jsonb_array_length(
        snapshot.payload #> '{sport,items}'
      ),
      'item', pg_catalog.jsonb_build_object(
        'awayLogoMediaAssetId',
          snapshot.payload #> '{sport,items,0,awayLogoMediaAssetId}',
        'awayRoom', snapshot.payload #> '{sport,items,0,awayRoom}',
        'awayTeam', snapshot.payload #> '{sport,items,0,awayTeam}',
        'date', snapshot.payload #> '{sport,items,0,date}',
        'field', snapshot.payload #> '{sport,items,0,field}',
        'homeLogoMediaAssetId',
          snapshot.payload #> '{sport,items,0,homeLogoMediaAssetId}',
        'homeRoom', snapshot.payload #> '{sport,items,0,homeRoom}',
        'homeTeam', snapshot.payload #> '{sport,items,0,homeTeam}',
        'officials', snapshot.payload #> '{sport,items,0,officials}',
        'time', snapshot.payload #> '{sport,items,0,time}',
        'venueName', snapshot.payload #> '{sport,items,0,venueName}'
      )
    )
    from s161_complete_programme_snapshot snapshot
  ),
  pg_catalog.jsonb_build_object(
    'displayConfig', '{
      "columns":"two",
      "showAwayDressingRoom":true,
      "showAwayLogo":true,
      "showDate":true,
      "showDressingRoom":true,
      "showField":true,
      "showHomeAway":true,
      "showHomeDressingRoom":true,
      "showHomeLogo":true,
      "showLogo":true,
      "showReferee":true,
      "showSportpark":true,
      "showTime":true
    }'::jsonb,
    'itemCount', 1,
    'item', pg_catalog.jsonb_build_object(
      'awayLogoMediaAssetId',
        '16100000-0000-5000-8000-000000000019',
      'awayRoom', 'Kleedkamer 4',
      'awayTeam', 'S161 uit JO17-2',
      'date', pg_catalog.to_char(
        now() at time zone 'Europe/Amsterdam',
        'DD-MM-YYYY'
      ),
      'field', 'Veld 7',
      'homeLogoMediaAssetId',
        '16100000-0000-5000-8000-000000000018',
      'homeRoom', 'Kleedkamer 3',
      'homeTeam', 'S161 thuis JO17-1',
      'officials',
        '[{"displayName":"Robin Referee","role":"Scheidsrechter"}]'::jsonb,
      'time', '14:30',
      'venueName', 'Sportpark S161'
    )
  ),
  'one complete programme snapshot freezes every optional row value together'
);

create temporary table s161_family_results as
select
  family.slide_type,
  family.position,
  private.build_dynamic_snapshot_data(
    pg_catalog.jsonb_populate_record(
      null::public.dynamic_slides,
      pg_catalog.jsonb_build_object(
        'id', extensions.gen_random_uuid(),
        'tenant_id', '16100000-0000-4000-8000-000000000001',
        'name', family.slide_type,
        'slide_type', family.slide_type,
        'orientation', 'landscape',
        'data_source_id', case
          when family.slide_type = 'ledscores_live_match'
            then '16100000-0000-4000-8000-000000000011'
          else null
        end,
        'selection_mode', 'latest',
        'status', 'active',
        'configuration_json', '{}'::jsonb,
        'revision', 1
      )
    )
  ) as payload
from pg_catalog.unnest(array[
  'menu',
  'price_list',
  'news',
  'ledscores_live_match',
  'sport_program',
  'sport_results',
  'sport_standing',
  'sport_period_standing',
  'sport_match_of_the_day',
  'sport_next_match',
  'sport_cancellations',
  'sport_dressing_rooms',
  'sport_officials',
  'sport_team',
  'sport_sponsor',
  'sport_activities',
  'sport_trainings',
  'sport_volunteers',
  'sport_birthdays',
  'sport_visitor_arrivals',
  'sport_referee_arrivals'
]::text[]) with ordinality as family(slide_type, position);

select ok(
  result.payload #>> '{themePresentation,snapshotVersion}' = '2'
    and result.payload #>> '{themePresentation,appearance,schemaVersion}' = '2'
    and result.payload #>> '{themePresentation,appearance,designRevision}'
      = 'royal-current-v8',
  pg_catalog.format(
    '%s snapshots receive frozen Royal Current v2 authority',
    result.slide_type
  )
)
from s161_family_results result
order by result.position;

create temporary table s161_arrival_results as
with cases(card_count, toggles) as (
  values
    (1, '{
      "showArrivalTime":true,
      "showClubLogo":false,
      "showCompetition":true,
      "showDressingRoom":false,
      "showField":true,
      "showKickoffTime":false,
      "showSponsor":true,
      "showWelcome":false
    }'::jsonb),
    (2, '{
      "showArrivalTime":false,
      "showClubLogo":true,
      "showCompetition":false,
      "showDressingRoom":true,
      "showField":false,
      "showKickoffTime":true,
      "showSponsor":false,
      "showWelcome":true
    }'::jsonb),
    (3, '{
      "showArrivalTime":true,
      "showClubLogo":true,
      "showCompetition":true,
      "showDressingRoom":true,
      "showField":true,
      "showKickoffTime":true,
      "showSponsor":false,
      "showWelcome":true
    }'::jsonb)
), configurations as (
  select
    cases.card_count,
    pg_catalog.jsonb_build_object(
      'cardCount', cases.card_count,
      'dutyDeskText', null,
      'emptyBehavior', 'skip',
      'highlightRecentMinutes', 15,
      'minutesAfter', 30,
      'minutesBefore', 90,
      'motionPreset', 'auto',
      'pageDurationSeconds', 12,
      'placeholderText', 'Er worden nu geen teams verwacht.',
      'sponsorMediaAssetId', null,
      'welcomeText', 'Welkom bij {{club}}'
    ) || cases.toggles as arrival_config
  from cases
)
select
  configurations.card_count,
  configurations.arrival_config,
  private.build_dynamic_snapshot_data(
    pg_catalog.jsonb_populate_record(
      null::public.dynamic_slides,
      pg_catalog.jsonb_build_object(
        'id', extensions.gen_random_uuid(),
        'tenant_id', '16100000-0000-4000-8000-000000000001',
        'name', 'Visitor cards ' || configurations.card_count::text,
        'slide_type', 'sport_visitor_arrivals',
        'orientation', 'landscape',
        'selection_mode', 'latest',
        'status', 'active',
        'configuration_json', pg_catalog.jsonb_build_object(
          'arrival', configurations.arrival_config,
          'blueprintKey', 'sportlink.visitor_arrivals'
        ),
        'revision', 1
      )
    )
  ) as payload
from configurations;

select is(
  result.payload #> '{sport,arrivalConfig}',
  result.arrival_config,
  pg_catalog.format(
    'visitor snapshots freeze the validated %s-card config and all display toggles',
    result.card_count
  )
)
from s161_arrival_results result
order by result.card_count;

update public.tenant_settings settings
set timezone_name = 'Pacific/Honolulu'
where settings.tenant_id = '16100000-0000-4000-8000-000000000001';

update public.tenant_theme_profiles profile
set selection_json = pg_catalog.jsonb_build_object(
      'ref', pg_catalog.jsonb_build_object(
        'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
      ),
      'modePolicy', pg_catalog.jsonb_build_object(
        'kind', 'schedule',
        'fallback', 'light',
        'timezone', 'Pacific/Kiritimati',
        'entries', pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'days', pg_catalog.jsonb_build_array(
              extract(
                dow from statement_timestamp() at time zone 'Pacific/Kiritimati'
              )::integer
            ),
            'start', '00:00',
            'end', '12:00',
            'mode', 'dark'
          ),
          pg_catalog.jsonb_build_object(
            'days', pg_catalog.jsonb_build_array(
              extract(
                dow from statement_timestamp() at time zone 'Pacific/Kiritimati'
              )::integer
            ),
            'start', '12:00',
            'end', '00:00',
            'mode', 'dark'
          )
        )
      ),
      'accent', '#2459ED',
      'support', null,
      'categoryOverrides', '[]'::jsonb
    ),
    revision = profile.revision + 1
where profile.tenant_id = '16100000-0000-4000-8000-000000000001'
  and profile.theme_id = 'fieldflow';

create temporary table s161_timezone_results as
select
  private.build_dynamic_snapshot_data(
    pg_catalog.jsonb_populate_record(
      null::public.dynamic_slides,
      pg_catalog.jsonb_build_object(
        'id', '16100000-0000-4000-8000-000000000021',
        'tenant_id', '16100000-0000-4000-8000-000000000001',
        'name', 'S161 timezone snapshot',
        'slide_type', 'menu',
        'orientation', 'landscape',
        'selection_mode', 'latest',
        'status', 'active',
        'configuration_json', '{}'::jsonb,
        'revision', 1
      )
    )
  ) as regular_payload,
  private.apply_tenant_theme_to_snapshot_v1(
    '16100000-0000-4000-8000-000000000001',
    '{"providerPayload":{"kept":true}}'::jsonb,
    '16100000-0000-4000-8000-000000000022'
  ) as rollout_payload;

select is(
  private.resolve_tenant_theme_timezone_v1(
    '16100000-0000-4000-8000-000000000001',
    (
      select profile.selection_json -> 'modePolicy'
      from public.tenant_theme_profiles profile
      where profile.tenant_id = '16100000-0000-4000-8000-000000000001'
        and profile.theme_id = 'fieldflow'
    )
  ),
  'Pacific/Kiritimati',
  'scheduled policy timezone overrides the differing tenant timezone'
);

select is(
  (select regular_payload #>> '{themePresentation,resolvedMode,timezone}'
   from s161_timezone_results),
  'Pacific/Kiritimati',
  'ordinary snapshots freeze the policy timezone'
);

select is(
  (select rollout_payload #>> '{themePresentation,resolvedMode,timezone}'
   from s161_timezone_results),
  'Pacific/Kiritimati',
  'rollout successor snapshots freeze the same policy timezone'
);

select is(
  (
    select (regular_payload #>> '{themePresentation,resolvedMode,mode}')
      || ':' || (rollout_payload #>> '{themePresentation,resolvedMode,mode}')
    from s161_timezone_results
  ),
  'dark:dark',
  'ordinary and rollout snapshots resolve the same scheduled mode'
);

select ok(
  (
    select rollout_payload -> 'providerPayload' = '{"kept":true}'::jsonb
      and rollout_payload #>> '{_veyocastThemeRuntime,version}' = '2'
    from s161_timezone_results
  ),
  'rollout correction preserves provider payload and prior runtime metadata'
);

with template as (
  select candidate.id, candidate.current_published_version_id
  from public.dynamic_templates candidate
  where candidate.slide_type = 'menu'
    and candidate.orientation = 'landscape'
    and candidate.status = 'published'
  order by candidate.created_at desc, candidate.id
  limit 1
)
insert into public.dynamic_slides (
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
)
select
  '16100000-0000-4000-8000-000000000031',
  '16100000-0000-4000-8000-000000000002',
  'S161 legacy slide',
  'menu',
  'landscape',
  template.id,
  template.current_published_version_id,
  '16100000-0000-4000-8000-000000000012',
  'latest',
  'ready',
  '{}'::jsonb
from template;

insert into public.dynamic_slide_snapshots (
  id, tenant_id, dynamic_slide_id, dynamic_slide_version_id,
  template_version_id, data_source_id, source_revision_hash,
  snapshot_data_json, status
)
select
  '16100000-0000-4000-8000-000000000032',
  slide.tenant_id,
  slide.id,
  slide.active_draft_version_id,
  slide.template_version_id,
  slide.data_source_id,
  repeat('1', 64),
  '{"legacy":"unchanged","themePresentation":{"snapshotVersion":1}}'::jsonb,
  'ready'
from public.dynamic_slides slide
where slide.id = '16100000-0000-4000-8000-000000000031';

select throws_ok(
  $$update public.dynamic_slide_snapshots
    set snapshot_data_json = '{"legacy":"changed"}'::jsonb
    where id = '16100000-0000-4000-8000-000000000032'$$,
  '55000',
  'dynamic snapshot records are immutable',
  'a ready legacy snapshot cannot be updated'
);

select throws_ok(
  $$delete from public.dynamic_slide_snapshots
    where id = '16100000-0000-4000-8000-000000000032'$$,
  '55000',
  'dynamic snapshot records are immutable',
  'a legacy snapshot cannot be deleted'
);

select is(
  (
    select snapshot.snapshot_data_json
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = '16100000-0000-4000-8000-000000000032'
  ),
  '{"legacy":"unchanged","themePresentation":{"snapshotVersion":1}}'::jsonb,
  'failed mutations leave historical snapshot bytes unchanged'
);

insert into public.playlists (id, tenant_id, name, status) values (
  '16100000-0000-4000-8000-000000000041',
  '16100000-0000-4000-8000-000000000002',
  'S161 legacy playlist',
  'published'
);

insert into public.playlist_releases (
  id, tenant_id, playlist_id, version, release_notes, manifest_hash,
  manifest_json, item_count, total_duration_seconds, total_bytes
) values (
  '16100000-0000-4000-8000-000000000042',
  '16100000-0000-4000-8000-000000000002',
  '16100000-0000-4000-8000-000000000041',
  1,
  'legacy-release',
  repeat('2', 64),
  '{"legacy":true}'::jsonb,
  1,
  10,
  0
);

select throws_ok(
  $$update public.playlist_releases
    set release_notes = 'changed'
    where id = '16100000-0000-4000-8000-000000000042'$$,
  '23514',
  'playlist releases are immutable',
  'a historical release cannot be updated'
);

select throws_ok(
  $$delete from public.playlist_releases
    where id = '16100000-0000-4000-8000-000000000042'$$,
  '23514',
  'playlist releases are immutable',
  'a historical release cannot be deleted'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'notes', release.release_notes,
      'manifest', release.manifest_json
    )
    from public.playlist_releases release
    where release.id = '16100000-0000-4000-8000-000000000042'
  ),
  '{"notes":"legacy-release","manifest":{"legacy":true}}'::jsonb,
  'failed mutations leave historical release authority unchanged'
);

select ok(
  has_function_privilege(
    current_user,
    'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)',
    'EXECUTE'
  ),
  'only the database owner can execute the Royal Current v8 reset'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v2(
    ' padded tenant ',
    'A sufficiently long reset reason',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/16101'
  )$$,
  '22023',
  'theme reset tenant name is invalid',
  'the v2 reset requires one exact unpadded tenant name'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v2(
    'Missing tenant',
    'short',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/16102'
  )$$,
  '22023',
  'theme reset reason is invalid',
  'the v2 reset requires an audit-grade reason'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v2(
    'Missing tenant',
    'A sufficiently long reset reason',
    'local:test-operator',
    'https://github.com/veyocast/platform/actions/runs/16103'
  )$$,
  '22023',
  'theme reset operator is invalid',
  'the v2 reset requires the protected GitHub operator format'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v2(
    'Missing tenant',
    'A sufficiently long reset reason',
    'github:test-operator',
    'https://example.test/actions/runs/16104'
  )$$,
  '22023',
  'theme reset workflow run is invalid',
  'the v2 reset requires the exact protected workflow URL format'
);

select throws_ok(
  $$select private.reset_tenant_fieldflow_royal_v2(
    'Missing tenant',
    'A sufficiently long reset reason',
    'github:test-operator',
    'https://github.com/veyocast/platform/actions/runs/16105'
  )$$,
  'P0002',
  'theme reset tenant not found',
  'the v2 reset fails closed for an unknown tenant'
);

insert into public.tenants (id, name, slug, status) values (
  '16100000-0000-4000-8000-000000000061',
  'Duindorp S161 reset',
  'duindorp-s161-reset',
  'active'
);

insert into public.tenant_settings (tenant_id) values (
  '16100000-0000-4000-8000-000000000061'
);

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, config_json
) values (
  '16100000-0000-4000-8000-000000000062',
  '16100000-0000-4000-8000-000000000061',
  'S161 reset source',
  'manual_products',
  'active',
  'ready',
  '{}'::jsonb
);

insert into public.media_assets (
  id, tenant_id, kind, title, original_file_name, mime_type, status,
  storage_bucket, storage_path, file_size_bytes, checksum_sha256,
  width, height, processed_at
) values (
  '16100000-0000-4000-8000-000000000063',
  '16100000-0000-4000-8000-000000000061',
  'image',
  'S161 immutable poster',
  'poster.png',
  'image/png',
  'ready',
  'tenant-media',
  'tenants/16100000-0000-4000-8000-000000000061/assets/16100000-0000-4000-8000-000000000063/original/poster.png',
  100,
  repeat('3', 64),
  1920,
  1080,
  pg_catalog.now()
);

with template as (
  select candidate.id, candidate.current_published_version_id
  from public.dynamic_templates candidate
  where candidate.slide_type = 'menu'
    and candidate.orientation = 'landscape'
    and candidate.status = 'published'
  order by candidate.created_at desc, candidate.id
  limit 1
)
insert into public.dynamic_slides (
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
)
select
  '16100000-0000-4000-8000-000000000064',
  '16100000-0000-4000-8000-000000000061',
  'S161 reset rollout slide',
  'menu',
  'landscape',
  template.id,
  template.current_published_version_id,
  '16100000-0000-4000-8000-000000000062',
  'latest',
  'rendering',
  '{}'::jsonb
from template;

insert into public.dynamic_slide_snapshots (
  id, tenant_id, dynamic_slide_id, dynamic_slide_version_id,
  template_version_id, data_source_id, source_revision_hash,
  snapshot_data_json, status, output_media_asset_id, completed_at
)
select
  '16100000-0000-4000-8000-000000000065',
  slide.tenant_id,
  slide.id,
  slide.active_draft_version_id,
  slide.template_version_id,
  slide.data_source_id,
  repeat('4', 64),
  private.build_dynamic_snapshot_data(slide)
    || '{"providerPayload":{"kept":true}}'::jsonb,
  'ready',
  '16100000-0000-4000-8000-000000000063',
  pg_catalog.now()
from public.dynamic_slides slide
where slide.id = '16100000-0000-4000-8000-000000000064';

update public.dynamic_slides slide
set current_snapshot_id = '16100000-0000-4000-8000-000000000065',
    status = 'ready'
where slide.id = '16100000-0000-4000-8000-000000000064';

create temporary table s161_reset_source_before as
select snapshot.snapshot_data_json as payload
from public.dynamic_slide_snapshots snapshot
where snapshot.id = '16100000-0000-4000-8000-000000000065';

create temporary table s161_reset_result as
select private.reset_tenant_fieldflow_royal_v2(
  'Duindorp S161 reset',
  'Apply the approved Royal Current v8 tenant reset',
  'github:test-operator',
  'https://github.com/veyocast/platform/actions/runs/16106'
) as value;

select ok(
  (
    select result.value ->> 'outcome' = 'applied'
      and (result.value ->> 'verified')::boolean
      and (result.value ->> 'snapshotCount')::integer = 1
      and (result.value ->> 'releaseTargetCount')::integer = 0
      and result.value ->> 'status' = 'rendering'
      and result.value ->> 'tenantId' =
        '16100000-0000-4000-8000-000000000061'
    from s161_reset_result result
  ),
  'the v2 reset applies to one exact tenant and reports its immutable rollout'
);

select ok(
  (
    select
      profile.selection_json = '{
        "ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},
        "modePolicy":{"kind":"fixed","mode":"dark"},
        "accent":"#2459ED",
        "support":null,
        "categoryOverrides":[]
      }'::jsonb
      and profile.color_overrides = '{}'::jsonb
      and profile.appearance_config = '{
        "schemaVersion":2,
        "designRevision":"royal-current-v8",
        "motionEnabled":true,
        "palette":{"version":1,"primary":"#2459ED","background":"club","secondary":null},
        "surfaces":{"clubLogoBackground":"#FFFFFF","homeLogoBackground":"#FFFFFF"},
        "typography":{"baseScale":1.05,"bodyFontRef":"vc-roboto-v1","displayFontRef":"vc-roboto-v1","sportScale":1.4}
      }'::jsonb
      and settings.default_theme_id = 'fieldflow'
      and settings.default_theme_version = '1.0.0'
      and settings.theme_mode_policy = '{"kind":"fixed","mode":"dark"}'::jsonb
      and settings.theme_accent = '#2459ED'
      and settings.theme_support is null
      and settings.theme_color_overrides = '{}'::jsonb
      and settings.theme_settings_revision = profile.revision
    from public.tenant_theme_profiles profile
    join public.tenant_settings settings
      on settings.tenant_id = profile.tenant_id
    where profile.tenant_id = '16100000-0000-4000-8000-000000000061'
      and profile.theme_id = 'fieldflow'
  ),
  'the v2 reset stores the exact Navy Glass profile and tenant-settings mirror'
);

select ok(
  exists (
    select 1
    from public.audit_events event
    join s161_reset_result result
      on event.id = (result.value ->> 'auditId')::uuid
    where event.tenant_id = '16100000-0000-4000-8000-000000000061'
      and event.action = 'tenant.theme.royal_current_reset'
      and event.target_type = 'tenant_theme_profiles'
      and event.result = 'success'
      and (event.metadata ->> 'immutable')::boolean
      and event.metadata ->> 'designRevision' = 'royal-current-v8'
      and event.metadata ->> 'operator' = 'github:test-operator'
      and event.metadata ->> 'workflowRun' =
        'https://github.com/veyocast/platform/actions/runs/16106'
  ),
  'the v2 reset writes one attributable immutable audit event'
);

select ok(
  (
    select rollout.status = 'rendering'
      and rollout.snapshot_count = 1
      and rollout.ready_snapshot_count = 0
      and rollout.release_target_count = 0
      and count(mapping.new_snapshot_id) = 1
      and bool_and(
        mapping.old_snapshot_id =
          '16100000-0000-4000-8000-000000000065'::uuid
      )
    from public.tenant_theme_rollouts rollout
    join s161_reset_result result
      on rollout.id = (result.value ->> 'rolloutId')::uuid
    left join private.tenant_theme_rollout_snapshots mapping
      on mapping.tenant_id = rollout.tenant_id
     and mapping.rollout_id = rollout.id
    group by rollout.id
  ),
  'the v2 reset creates one immutable successor snapshot mapping'
);

select ok(
  (
    select old_snapshot.snapshot_data_json = before.payload
      and old_snapshot.status = 'ready'
      and slide.current_snapshot_id = old_snapshot.id
      and new_snapshot.status = 'queued'
      and new_snapshot.snapshot_data_json -> 'providerPayload' =
        '{"kept":true}'::jsonb
      and new_snapshot.snapshot_data_json #>>
        '{themePresentation,appearance,designRevision}' = 'royal-current-v8'
      and new_snapshot.snapshot_data_json #>>
        '{themePresentation,resolvedMode,mode}' = 'dark'
      and new_snapshot.snapshot_data_json #>>
        '{themePresentation,appearance,typography,baseScale}' = '1.05'
      and new_snapshot.snapshot_data_json #>>
        '{themePresentation,appearance,typography,sportScale}' = '1.4'
    from s161_reset_source_before before
    join public.dynamic_slide_snapshots old_snapshot
      on old_snapshot.id = '16100000-0000-4000-8000-000000000065'
    join public.dynamic_slides slide
      on slide.id = old_snapshot.dynamic_slide_id
    join s161_reset_result result on true
    join private.tenant_theme_rollout_snapshots mapping
      on mapping.rollout_id = (result.value ->> 'rolloutId')::uuid
     and mapping.old_snapshot_id = old_snapshot.id
    join public.dynamic_slide_snapshots new_snapshot
      on new_snapshot.id = mapping.new_snapshot_id
  ),
  'reset rollout preserves the ready source bytes and freezes the exact v8 successor'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'notes', release.release_notes,
      'manifest', release.manifest_json
    )
    from public.playlist_releases release
    where release.id = '16100000-0000-4000-8000-000000000042'
  ),
  '{"notes":"legacy-release","manifest":{"legacy":true}}'::jsonb,
  'the tenant reset leaves unrelated historical releases byte-for-byte unchanged'
);

create temporary table s161_reset_noop_result as
select private.reset_tenant_fieldflow_royal_v2(
  'Duindorp S161 reset',
  'Repeat the approved Royal Current v8 tenant reset',
  'github:test-operator',
  'https://github.com/veyocast/platform/actions/runs/16107'
) as value;

select ok(
  (
    select noop.value ->> 'outcome' = 'noop'
      and noop.value -> 'auditId' = 'null'::jsonb
      and (noop.value ->> 'verified')::boolean
      and noop.value ->> 'rolloutId' = applied.value ->> 'rolloutId'
      and (
        select count(*)
        from public.tenant_theme_rollouts rollout
        where rollout.tenant_id = '16100000-0000-4000-8000-000000000061'
      ) = 1
      and (
        select count(*)
        from public.audit_events event
        where event.tenant_id = '16100000-0000-4000-8000-000000000061'
          and event.action = 'tenant.theme.royal_current_reset'
      ) = 1
    from s161_reset_noop_result noop
    cross join s161_reset_result applied
  ),
  'an exact repeated v2 reset is a verified noop without duplicate rollout or audit'
);

select is(
  (
    with roles(role_name) as (
      values ('public'), ('anon'), ('authenticated'), ('service_role')
    ), functions(signature) as (
      values
        ('private.theme_appearance_settings_is_valid_v1(jsonb)'),
        ('private.ensure_tenant_theme_profile_v1(uuid)'),
        ('private.resolve_tenant_theme_timezone_v1(uuid,jsonb)'),
        ('private.build_dynamic_snapshot_data(public.dynamic_slides)'),
        ('private.build_dynamic_snapshot_data_before_s161_royal_current(public.dynamic_slides)'),
        ('private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid)'),
        ('private.apply_tenant_theme_to_snapshot_before_s161_royal_current(uuid,jsonb,uuid)'),
        ('private.reset_tenant_fieldflow_royal_v2(text,text,text,text)')
    )
    select count(*)
    from roles
    cross join functions
    where has_function_privilege(role_name, signature, 'EXECUTE')
  ),
  0::bigint,
  'all S161 validators, builders, rollout helpers and retained predecessors deny Data API execution'
);

select ok(
  (
    select bool_and(
      'search_path=""' = any(coalesce(proc.proconfig, '{}'::text[]))
      and (
        proc.proname = 'theme_appearance_settings_is_valid_v1'
        or proc.prosecdef
      )
    )
    from pg_catalog.pg_proc proc
    where proc.oid = any(array[
      'private.theme_appearance_settings_is_valid_v1(jsonb)'::regprocedure,
      'private.ensure_tenant_theme_profile_v1(uuid)'::regprocedure,
      'private.resolve_tenant_theme_timezone_v1(uuid,jsonb)'::regprocedure,
      'private.build_dynamic_snapshot_data(public.dynamic_slides)'::regprocedure,
      'private.build_dynamic_snapshot_data_before_s161_royal_current(public.dynamic_slides)'::regprocedure,
      'private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid)'::regprocedure,
      'private.apply_tenant_theme_to_snapshot_before_s161_royal_current(uuid,jsonb,uuid)'::regprocedure,
      'private.reset_tenant_fieldflow_royal_v2(text,text,text,text)'::regprocedure
    ])
  ),
  'S161 runtime helpers use an empty search path and owner-only reads use SECURITY DEFINER'
);

select * from finish();
rollback;
