begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(115);

select is(
  (
    select field.is_nullable
    from information_schema.columns field
    where field.table_schema = 'public'
      and field.table_name = 'dynamic_slide_snapshots'
      and field.column_name = 'snapshot_sequence'
  ),
  'YES',
  'legacy immutable snapshots can remain untouched without a sequence backfill'
);

select has_trigger(
  'public',
  'dynamic_slide_snapshots',
  'dynamic_snapshots_assign_sequence',
  'new snapshots receive their monotone sequence from a database trigger'
);

select has_trigger(
  'public',
  'dynamic_slide_snapshots',
  'dynamic_snapshots_reject_sequence_update',
  'snapshot ordering metadata is immutable throughout the render lifecycle'
);

select ok(
  not has_sequence_privilege(
    'authenticated',
    'private.dynamic_slide_snapshot_sequence_v1',
    'USAGE'
  )
  and not has_sequence_privilege(
    'service_role',
    'private.dynamic_slide_snapshot_sequence_v1',
    'USAGE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.assign_dynamic_snapshot_sequence_v1()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.assign_dynamic_snapshot_sequence_v1()',
    'EXECUTE'
  ),
  'browser and worker roles cannot control snapshot ordering metadata'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'private.dynamic_release_refresh_queue',
    'SELECT'
  ),
  'browser roles cannot inspect the private dynamic release queue'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_screen_fleet_releases_v1(uuid)',
    'EXECUTE'
  ) and not has_function_privilege(
    'anon',
    'public.list_screen_fleet_releases_v1(uuid)',
    'EXECUTE'
  ),
  'only authenticated Control users can call the fleet release projection'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.enqueue_dynamic_release_refresh_v1()',
    'EXECUTE'
  ) and not has_function_privilege(
    'service_role',
    'private.process_due_dynamic_release_refresh_v1(text)',
    'EXECUTE'
  ) and not has_function_privilege(
    'service_role',
    'private.process_dynamic_release_refresh_v1(uuid,uuid,text)',
    'EXECUTE'
  ) and not has_function_privilege(
    'service_role',
    'private.publish_queued_dynamic_release_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'browser and worker roles cannot invoke private queue internals directly'
);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
   where oid = 'public.sportlink_slide_batches'::regclass),
  'Sportlink slide batches force tenant RLS'
);

select ok(
  not has_table_privilege('anon', 'public.sportlink_slide_batches', 'SELECT')
  and not has_table_privilege('authenticated', 'public.sportlink_slide_batches', 'INSERT'),
  'browser roles cannot bypass the guarded Sportlink batch command'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000a51', 'authenticated', 'authenticated', 'dynamic-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000a52', 'authenticated', 'authenticated', 'dynamic-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000a53', 'authenticated', 'authenticated', 'dynamic-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000a51', 'Dynamic owner'),
  ('00000000-0000-4000-8000-000000000a52', 'Dynamic viewer'),
  ('00000000-0000-4000-8000-000000000a53', 'Dynamic other');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000a51', 'Dynamic tenant', 'dynamic-tenant'),
  ('10000000-0000-4000-8000-000000000a52', 'Other dynamic tenant', 'other-dynamic-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000000a51'),
  ('10000000-0000-4000-8000-000000000a52');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000a51', '00000000-0000-4000-8000-000000000a51', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000000a51', '00000000-0000-4000-8000-000000000a52', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000000a52', '00000000-0000-4000-8000-000000000a53', 'tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a51', true);

select ok(
  'tenant.dynamic_slide.write' = any(
    public.get_my_tenant_capabilities_v1(
      '10000000-0000-4000-8000-000000000a51'
    )
  ),
  'tenant owner receives dynamic slide write capability'
);

select ok(
  'tenant.data_source.manage' = any(
    public.get_my_tenant_capabilities_v1(
      '10000000-0000-4000-8000-000000000a51'
    )
  ),
  'tenant owner receives data source manage capability'
);

select lives_ok(
  $$select public.update_tenant_control_settings_v3(
    '10000000-0000-4000-8000-000000000a51',
    'Dynamic tenant',
    '#315cff',
    10,
    'contain',
    true,
    'landscape',
    1920,
    1080,
    'Europe/Amsterdam',
    'cut',
    null
  )$$,
  'tenant owner can set the canonical primary slide colour'
);

select is(
  (
    select primary_color
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000000a51'
  ),
  '#315CFF',
  'primary slide colour is normalized before storage'
);

create temporary table dynamic_test_ids (
  name text primary key,
  id uuid not null
);
grant select on dynamic_test_ids to service_role;

-- Later queue tests need to finish one exact fixture render. Using the global
-- worker claim there would make the suite race with other pgTAP files that
-- deliberately exercise the same shared worker command.
create function pg_temp.claim_dynamic_render_for_slide_v1(
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

insert into dynamic_test_ids values (
  'source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Handmatig menu',
    'manual_products',
    '{}'::jsonb
  )
);

select lives_ok(
  $$select public.stage_product_import_v1(
    '10000000-0000-4000-8000-000000000a51',
    'generic_excel',
    'menu.xlsx',
    repeat('a', 64),
    'Producten',
    '["ID","Naam","Prijs"]'::jsonb,
    '{"ID":"external_id","Naam":"name","Prijs":"price"}'::jsonb,
    '[{
      "included":true,
      "source":{"ID":"cola","Naam":"Cola","Prijs":"2,50"},
      "normalized":{
        "external_id":"cola","name":"Cola","description":null,
        "category":"Dranken","price_cents":250,"vat_rate":9,
        "unit":"stuk","barcode":null,"active":true,
        "slug":"cola","custom_fields":{}
      },
      "errors":[]
    }]'::jsonb
  )$$,
  'existing normalized product import remains reusable'
);

select is(
  public.apply_product_import_v1(
    (select id from public.product_catalog_imports
      where tenant_id = '10000000-0000-4000-8000-000000000a51'),
    'merge'
  ) ->> 'outcome',
  'applied',
  'menu product catalog is materialized'
);

select is(
  (
    select public.preview_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Menuvoorbeeld',
      version.id,
      (select id from dynamic_test_ids where name = 'source'),
      '{"title":"Vandaag","maxItems":8}'::jsonb
    ) #>> '{data,menu,products,0,name}'
    from public.dynamic_template_versions version
    join public.dynamic_templates template on template.id = version.template_id
    where template.slug = 'editorial-arena-menubord-dark-landscape'
      and version.status = 'published'
  ),
  'Cola',
  'preview uses the canonical normalized snapshot builder'
);

select is(
  (select count(*) from public.dynamic_slides),
  0::bigint,
  'preview does not persist a mutable dynamic slide'
);

select is(
  (select count(*) from public.dynamic_slide_snapshots) +
    (select count(*) from public.dynamic_render_jobs),
  0::bigint,
  'preview creates neither snapshots nor render jobs'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a52',
  true
);
select throws_ok(
  $$select public.preview_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Verboden voorbeeld',
    (select version.id
      from public.dynamic_template_versions version
      join public.dynamic_templates template on template.id = version.template_id
      where template.slug = 'editorial-arena-menubord-dark-landscape'
        and version.status = 'published'),
    (select id from dynamic_test_ids where name = 'source'),
    '{}'::jsonb
  )$$,
  '42501',
  'actor cannot preview dynamic slides',
  'viewer cannot preview dynamic slides'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a51',
  true
);

insert into dynamic_test_ids
select
  'slide',
  (
    public.create_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Kantinemenu',
      version.id,
      (select id from dynamic_test_ids where name = 'source'),
      'latest',
      '{"title":"Vandaag","maxItems":8}'::jsonb
    ) ->> 'slideId'
  )::uuid
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slug = 'editorial-arena-menubord-dark-landscape'
  and version.status = 'published';

select is(
  (select status from public.dynamic_slides
    where id = (select id from dynamic_test_ids where name = 'slide')),
  'rendering',
  'creating a slide atomically queues its first immutable snapshot'
);

select is(
  (
    select snapshot.snapshot_data_json #>> '{brand,primaryColor}'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'slide'
    )
    order by snapshot.created_at desc
    limit 1
  ),
  '#315CFF',
  'menu snapshots use the same tenant primary colour as news and sports'
);

select is(
  (select count(*) from public.dynamic_render_jobs),
  1::bigint,
  'exactly one render job exists for the snapshot'
);

reset role;
set local role service_role;

create temporary table dynamic_claim as
select * from public.claim_dynamic_render_job_v1('dynamic-test-worker', 120, 3);

select is(
  (select count(*) from dynamic_claim),
  1::bigint,
  'worker claims the queued render once'
);

select is(
  (select count(*) from public.claim_dynamic_render_job_v1(
    'second-worker', 120, 3
  )),
  0::bigint,
  'a leased render cannot be claimed twice'
);

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from dynamic_claim),
    'dynamic-test-worker',
    'tenants/' || (select tenant_id from dynamic_claim)::text ||
      '/assets/' || (select output_media_asset_id from dynamic_claim)::text ||
      '/dynamic-slide.png',
    4096,
    repeat('b', 64),
    1920,
    1080
  )$$,
  'worker can complete a valid tenant-scoped immutable PNG'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a51', true);

select is(
  (select status from public.dynamic_slides
    where id = (select id from dynamic_test_ids where name = 'slide')),
  'ready',
  'a completed render becomes the current ready snapshot'
);

insert into dynamic_test_ids
select
  'duplicate_slide',
  (
    public.create_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Tweede kantinemenu',
      version.id,
      (select id from dynamic_test_ids where name = 'source'),
      'latest',
      '{"title":"Vandaag","maxItems":8}'::jsonb
    ) ->> 'slideId'
  )::uuid
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slug = 'editorial-arena-menubord-dark-landscape'
  and version.status = 'published';

select is(
  (
    select job.output_media_asset_id
    from public.dynamic_render_jobs job
    join public.dynamic_slide_snapshots snapshot on snapshot.id = job.snapshot_id
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'duplicate_slide'
    )
  ),
  (
    select snapshot.output_media_asset_id
    from public.dynamic_slides slide
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = slide.current_snapshot_id
    where slide.id = (select id from dynamic_test_ids where name = 'slide')
  ),
  'identical dynamic output receives the same content-addressed fallback id'
);

reset role;
set local role service_role;

create temporary table duplicate_dynamic_claim as
select * from public.claim_dynamic_render_job_v1(
  'duplicate-dynamic-worker',
  120,
  3
);

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from duplicate_dynamic_claim),
    'duplicate-dynamic-worker',
    'tenants/' || (select tenant_id from duplicate_dynamic_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from duplicate_dynamic_claim)::text ||
      '/dynamic-slide.png',
    4096,
    repeat('b', 64),
    1920,
    1080
  )$$,
  'an identical fallback render safely reuses its existing media identity'
);

select is(
  (
    select count(*)
    from public.media_assets asset
    where asset.id = (
      select output_media_asset_id from duplicate_dynamic_claim
    )
  ),
  1::bigint,
  'identical fallback bytes occupy one canonical media asset'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a51',
  true
);

insert into public.playlists (
  id, tenant_id, name, created_by
) values (
  '30000000-0000-4000-8000-000000000a51',
  '10000000-0000-4000-8000-000000000a51',
  'Dynamische playlist',
  '00000000-0000-4000-8000-000000000a51'
);

select lives_ok(
  $$select public.add_dynamic_slide_to_playlist_v2(
    '30000000-0000-4000-8000-000000000a51',
    (select id from dynamic_test_ids where name = 'slide'),
    0,
    12,
    'a5100000-0000-4000-8000-000000000001'
  )$$,
  'ready dynamic snapshot enters the playlist as a guarded HTML/CSS item'
);

select ok(
  (
    select
      item.dynamic_slide_id is not null
      and item.dynamic_slide_id = (
        select id from dynamic_test_ids where name = 'slide'
      )
      and item.dynamic_snapshot_id is not null
      and item.dynamic_selection_mode = 'latest'
      and asset.status = 'ready'
    from public.playlist_items item
    join public.media_assets asset on asset.id = item.media_asset_id
    where item.playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  'playlist preserves HTML/CSS provenance plus a ready image fallback'
);

select is(
  (
    select revision
    from public.playlists
    where id = '30000000-0000-4000-8000-000000000a51'
  ),
  1::bigint,
  'guarded dynamic insertion increments the playlist revision'
);

select lives_ok(
  $$select public.add_dynamic_slide_to_playlist_v2(
    '30000000-0000-4000-8000-000000000a51',
    (select id from dynamic_test_ids where name = 'slide'),
    0,
    12,
    'a5100000-0000-4000-8000-000000000001'
  )$$,
  'replaying the same dynamic insertion is idempotent'
);

select is(
  (
    select count(*)
    from public.playlist_items
    where playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  1::bigint,
  'an idempotent replay does not duplicate the dynamic slide'
);

select is(
  (
    select outcome
    from public.mutate_playlist_draft_v1(
      '30000000-0000-4000-8000-000000000a51',
      1,
      'add_item',
      jsonb_build_object(
        'mediaAssetId',
        (
          select snapshot.output_media_asset_id
          from public.dynamic_slides slide
          join public.dynamic_slide_snapshots snapshot
            on snapshot.id = slide.current_snapshot_id
          where slide.id = (
            select id from dynamic_test_ids where name = 'slide'
          )
        )
      )
    )
  ),
  'applied',
  'a legacy fallback selection can still enter the guarded draft'
);

select ok(
  (
    select bool_and(
      item.dynamic_slide_id is not null
      and item.dynamic_snapshot_id is not null
    )
    from public.playlist_items item
    where item.playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  'generated fallback selections are promoted to HTML/CSS provenance'
);

select lives_ok(
  $$update public.playlist_items
    set dynamic_slide_id = null,
        dynamic_snapshot_id = null,
        dynamic_selection_mode = null
    where playlist_id = '30000000-0000-4000-8000-000000000a51'$$,
  'direct fallback demotion is canonicalized by trusted provenance'
);

select ok(
  (
    select bool_and(
      item.dynamic_slide_id is not null
      and item.dynamic_snapshot_id is not null
      and item.dynamic_selection_mode = 'latest'
    )
    from public.playlist_items item
    where item.playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  'generated fallback cannot be persisted as ordinary image provenance'
);

reset role;

insert into public.screens (
  id, tenant_id, name, orientation, status, created_by
) values (
  '40000000-0000-4000-8000-000000000a51',
  '10000000-0000-4000-8000-000000000a51',
  'Dynamic scherm',
  'landscape',
  'active',
  '00000000-0000-4000-8000-000000000a51'
);

insert into public.player_devices (
  id, tenant_id, screen_id, device_name, token_hash, status
) values (
  '50000000-0000-4000-8000-000000000a51',
  '10000000-0000-4000-8000-000000000a51',
  '40000000-0000-4000-8000-000000000a51',
  'Dynamic player',
  repeat('d', 64),
  'paired'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a51',
  true
);

insert into dynamic_test_ids
select
  'base_release',
  (
    public.publish_playlist_to_targets_v3(
      '30000000-0000-4000-8000-000000000a51',
      (
        select revision from public.playlists
        where id = '30000000-0000-4000-8000-000000000a51'
      ),
      array['40000000-0000-4000-8000-000000000a51'::uuid],
      'Eerste dynamische release',
      'a5100000-0000-4000-8000-000000000002'
    ) ->> 'releaseId'
  )::uuid;

select is(
  (
    select default_release_id
    from public.screens
    where id = '40000000-0000-4000-8000-000000000a51'
  ),
  (select id from dynamic_test_ids where name = 'base_release'),
  'the explicitly published release becomes the screen default'
);

select is((public.publish_playlist_to_targets_v3(
 '30000000-0000-4000-8000-000000000a51',
 (select revision from public.playlists where id='30000000-0000-4000-8000-000000000a51'),
 array['40000000-0000-4000-8000-000000000a51'::uuid], 'Ongewijzigd opnieuw synchroniseren',
 'a5100000-0000-4000-8000-000000000185')->>'releaseId')::uuid,
 (select id from dynamic_test_ids where name='base_release'),'unchanged intentional publication reuses the same configuration');
select is((select count(*) from public.list_current_publications_v1('10000000-0000-4000-8000-000000000a51')),1::bigint,
 'Control reads exactly one current publication per playlist');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a53',true);
select is((select count(*) from public.list_current_publications_v1('10000000-0000-4000-8000-000000000a51')),0::bigint,
 'tenant B cannot read tenant A current publication through the compact RPC');
select is((select count(*) from public.playlist_publications where tenant_id='10000000-0000-4000-8000-000000000a51'),0::bigint,
 'tenant B cannot read the underlying current publication pointer');
select throws_ok($test$update public.playlist_publications set config_revision=config_revision+1$test$,'42501',
 'permission denied for table playlist_publications','browser clients cannot mutate current publication ordering');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a51',true);
reset role;
select is(public.get_player_effective_target_v1(repeat('d',64))->>'desired_release_id',
 (select id::text from dynamic_test_ids where name='base_release'),'authorized target resolves the selected screen publication');
select ok(public.get_player_effective_target_v1(repeat('e',64)) is null,'an unknown device has no effective target');
select is((select count(*) from public.playlist_releases where playlist_id='30000000-0000-4000-8000-000000000a51'),1::bigint,
 'an unchanged publish creates no artificial release history');

update public.tenant_products
set name = 'Cola zero'
where tenant_id = '10000000-0000-4000-8000-000000000a51'
  and slug = 'cola';

set local role service_role;

select lives_ok(
  $$update public.dynamic_data_sources
    set revision = revision + 1
    where id = (select id from dynamic_test_ids where name = 'source')$$,
  'a non-RSS source revision queues latest snapshots too'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'slide'
    )
  ),
  2::bigint,
  'menu source refresh creates one new immutable snapshot'
);

reset role;
create temporary table dynamic_refresh_claim as
select * from pg_temp.claim_dynamic_render_for_slide_v1(
  (select id from dynamic_test_ids where name = 'slide'),
  'dynamic-refresh-worker'
);
grant select on dynamic_refresh_claim to service_role;
set local role service_role;

select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from dynamic_refresh_claim),
    'dynamic-refresh-worker',
    'tenants/' || (select tenant_id from dynamic_refresh_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from dynamic_refresh_claim)::text ||
      '/dynamic-slide.png',
    4096,
    repeat('c', 64),
    1920,
    1080
  )$$,
  'refreshed snapshot can complete with its own immutable fallback'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a51',
  true
);

select ok(
  (
    select bool_and(
      item.dynamic_snapshot_id = slide.current_snapshot_id
      and item.media_asset_id = snapshot.output_media_asset_id
    )
    from public.playlist_items item
    join public.dynamic_slides slide
      on slide.id = item.dynamic_slide_id
    join public.dynamic_slide_snapshots snapshot
      on snapshot.id = item.dynamic_snapshot_id
    where item.playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  'latest playlist draft follows the completed snapshot and matching fallback'
);

select is(
  (
    select count(*)
    from public.playlist_releases release
    where release.playlist_id = '30000000-0000-4000-8000-000000000a51'
  ),
  1::bigint,
  'a completed render does not synchronously create another release'
);

reset role;
-- S185 replaces the retired coalescing/backpressure suite with the data contract.
select is((select count(*) from private.dynamic_release_refresh_queue
  where tenant_id='10000000-0000-4000-8000-000000000a51' and pending),0::bigint,
  'a completed source render queues no publication');
select is(private.process_dynamic_release_refresh_v1('10000000-0000-4000-8000-000000000a51',
  '30000000-0000-4000-8000-000000000a51','legacy-worker'),0,
  'an old worker call cannot publish after cutover');
select is(private.publish_queued_dynamic_release_v1('10000000-0000-4000-8000-000000000a51',
  '30000000-0000-4000-8000-000000000a51'),0,
  'the retired direct producer cannot create a release');
select ok((select bool_and(live_data_enabled) from public.playlist_release_items
  where release_id=(select id from dynamic_test_ids where name='base_release')),
  'the published latest selection opts into live data');
select is((select count(*) from public.published_dynamic_data
  where tenant_id='10000000-0000-4000-8000-000000000a51'),1::bigint,
  'one published binding has one current dataset');
select ok((select bool_and(last_error_code is null and data_revision>1) from public.published_dynamic_data
  where tenant_id='10000000-0000-4000-8000-000000000a51'),
  'changed product data advances only the live data revision');
create temporary table s185_before as select * from public.published_dynamic_data
  where tenant_id='10000000-0000-4000-8000-000000000a51';
select lives_ok($test$do $body$ begin for i in 1..100 loop
  update public.tenant_products set name='Product '||i
  where tenant_id='10000000-0000-4000-8000-000000000a51' and slug='cola';
  update public.dynamic_data_sources set revision=revision+1
  where id=(select id from dynamic_test_ids where name='source');
end loop; end $body$$test$,'one hundred relevant source changes complete');
select is((select count(*) from public.playlist_releases
  where playlist_id='30000000-0000-4000-8000-000000000a51'),1::bigint,
  'one hundred source updates create zero playlist publications');
select is((select data_revision from public.published_dynamic_data where snapshot_id=(select snapshot_id from s185_before)),
  (select data_revision+100 from s185_before),'each actual content change advances the data revision once');
select lives_ok($test$do $body$ begin for i in 1..100 loop
  update public.dynamic_data_sources set revision=revision+1
  where id=(select id from dynamic_test_ids where name='source');
end loop; end $body$$test$,'one hundred identical fetches complete');
select is((select data_revision from public.published_dynamic_data where snapshot_id=(select snapshot_id from s185_before)),
  (select data_revision+100 from s185_before),'fetch metadata and repeated identical data do not cascade revisions');
select is((select assigned_release_id from public.screens where id='40000000-0000-4000-8000-000000000a51'),
  (select id from dynamic_test_ids where name='base_release'),'data changes leave the effective screen target unchanged');
select is((select release_id from public.playlist_publications where playlist_id='30000000-0000-4000-8000-000000000a51'),
  (select id from dynamic_test_ids where name='base_release'),'the current publication identity remains unchanged');
select ok(not has_table_privilege('anon','public.published_dynamic_data','SELECT')
  and not has_table_privilege('authenticated','public.published_dynamic_data','SELECT'),
  'clients cannot query live member data outside their published device API');
select ok(not has_function_privilege('anon','public.get_player_effective_target_v1(text)','EXECUTE')
  and not has_function_privilege('authenticated','public.get_player_effective_target_v1(text)','EXECUTE'),
  'the effective target service boundary is server-only');
update public.tenant_products set name='Cola failure proof' where tenant_id='10000000-0000-4000-8000-000000000a51' and slug='cola';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a51',
  true
);

insert into dynamic_test_ids values (
  'rss_source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Clubnieuws',
    'rss',
    '{"url":"https://example.com/news.xml"}'::jsonb
  )
);

select is(
  (
    select config_json ->> 'refreshMinutes'
    from public.dynamic_data_sources
    where id = (select id from dynamic_test_ids where name = 'rss_source')
  ),
  '5',
  'new RSS sources default to a five-minute refresh interval'
);

select lives_ok(
  $$select public.record_rss_sync_v1(
    (select id from dynamic_test_ids where name = 'rss_source'),
    '[{
      "externalId":"article-1",
      "title":"Trainingstijden",
      "intro":"Bekijk de actuele trainingstijden.",
      "author":"Redactie",
      "sourceName":"Clubnieuws",
      "link":"https://example.com/news/training",
      "publishedAt":"2026-07-27T09:00:00Z"
    }]'::jsonb
  )$$,
  'an RSS source can be populated before creating a slide'
);

select is(
  (
    select canonical_link
    from public.dynamic_news_articles
    where data_source_id = (
      select id from dynamic_test_ids where name = 'rss_source'
    )
      and external_id = 'article-1'
  ),
  'https://example.com/news/training',
  'RSS rows store a canonical article link for deduplication'
);

create temporary table rss_revision_before as
select revision
from public.dynamic_data_sources
where id = (select id from dynamic_test_ids where name = 'rss_source');

select is(
  (
    with repeated_sync as (
      select public.record_rss_sync_v1(
        (select id from dynamic_test_ids where name = 'rss_source'),
        '[{
          "externalId":"article-1",
          "title":"Trainingstijden",
          "intro":"Bekijk de actuele trainingstijden.",
          "author":"Redactie",
          "sourceName":"Clubnieuws",
          "link":"https://example.com/news/training",
          "publishedAt":"2026-07-27T09:00:00Z"
        }]'::jsonb
      )
    )
    select source.revision
    from repeated_sync
    cross join public.dynamic_data_sources source
    where source.id = (select id from dynamic_test_ids where name = 'rss_source')
  ),
  (select revision from rss_revision_before),
  'an unchanged RSS payload does not advance its content revision'
);

insert into dynamic_test_ids
select
  'rss_slide',
  (
    public.create_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Laatste clubnieuws',
      version.id,
      (select id from dynamic_test_ids where name = 'rss_source'),
      'latest',
      '{"title":"Clubnieuws","maxItems":4}'::jsonb
    ) ->> 'slideId'
  )::uuid
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slug = 'editorial-arena-nieuws-dark-landscape'
  and version.status = 'published';

select is(
  (
    select snapshot.snapshot_data_json #>> '{brand,primaryColor}'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'rss_slide'
    )
    order by snapshot.created_at desc
    limit 1
  ),
  '#315CFF',
  'RSS snapshot freezes the tenant primary colour for HTML/CSS playback'
);

select is(
  (
    select snapshot.snapshot_data_json #>> '{editorial,schemaVersion}'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'rss_slide'
    )
    order by snapshot.created_at desc
    limit 1
  ),
  '2',
  'Editorial Arena snapshots freeze the v2 presentation contract'
);

select ok(
  (
    select jsonb_typeof(
      snapshot.snapshot_data_json #> '{editorial,theme,dark}'
    ) = 'object'
      and jsonb_typeof(
        snapshot.snapshot_data_json #> '{editorial,theme,light}'
      ) = 'object'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'rss_slide'
    )
    order by snapshot.created_at desc
    limit 1
  ),
  'immutable Editorial Arena snapshots contain both complete theme maps'
);

select lives_ok(
  $$select public.record_rss_sync_v1(
    (select id from dynamic_test_ids where name = 'rss_source'),
    '[{
      "externalId":"article-1",
      "title":"Nieuwe trainingstijden",
      "intro":"De training begint vanaf maandag een uur eerder.",
      "author":"Redactie",
      "sourceName":"Clubnieuws",
      "link":"https://example.com/news/training",
      "publishedAt":"2026-07-27T10:00:00Z"
    }]'::jsonb
  )$$,
  'a manual RSS refresh succeeds'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'rss_slide'
    )
  ),
  2::bigint,
  'a manual RSS refresh automatically queues a new latest snapshot'
);

create temporary table primary_color_snapshot_counts (
  name text primary key,
  snapshot_count bigint not null
);

insert into primary_color_snapshot_counts values (
  'menu',
  (
    select count(*)
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'slide'
    )
  )
);

select lives_ok(
  $$select public.update_tenant_control_settings_v3(
    '10000000-0000-4000-8000-000000000a51',
    'Dynamic tenant',
    '#00aa77',
    10,
    'contain',
    true,
    'landscape',
    1920,
    1080,
    'Europe/Amsterdam',
    'cut',
    null
  )$$,
  'changing the primary colour safely requests a fresh latest snapshot'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'rss_slide'
    )
  ),
  3::bigint,
  'colour refresh adds one immutable RSS snapshot without rewriting history'
);

select is(
  (
    select count(*) - (
      select snapshot_count
      from primary_color_snapshot_counts
      where name = 'menu'
    )
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'slide'
    )
  ),
  1::bigint,
  'colour refresh also queues a new immutable menu snapshot'
);

reset role;
insert into public.tenant_products(
  id, tenant_id, source, slug, name, category, price_cents
) values (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '10000000-0000-4000-8000-000000000a52',
  'manual',
  'foreign-cola',
  'Cola van andere tenant',
  'Dranken',
  275
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a51', true);

select is(
  (
    select count(*)
    from public.dynamic_templates
    where slide_type = 'price_list'
      and status = 'published'
  ),
  4::bigint,
  'Editorial Arena registers all four price-list variants'
);

insert into dynamic_test_ids
select
  'price_slide',
  (
    public.create_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Kantineprijslijst',
      version.id,
      (select id from dynamic_test_ids where name = 'source'),
      'latest',
      jsonb_build_object(
        'title', 'Prijslijst',
        'slidePhotoMode', 'hide',
        'sections', jsonb_build_array(jsonb_build_object(
          'id', 'a5100000-0000-4000-8000-000000000010',
          'categoryId', 'Dranken',
          'categoryNameOverride', null,
          'column', 'left',
          'order', 0,
          'photoMode', 'inherit',
          'products', jsonb_build_array(jsonb_build_object(
            'id', 'a5100000-0000-4000-8000-000000000011',
            'productId', (
              select id from public.tenant_products
              where tenant_id = '10000000-0000-4000-8000-000000000a51'
                and slug = 'cola'
            ),
            'order', 0,
            'visible', true
          ))
        ))
      )
    ) ->> 'slideId'
  )::uuid
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slug = 'editorial-arena-prijslijst-dark-landscape'
  and version.status = 'published';

select is(
  (select slide_type from public.dynamic_slides
   where id = (select id from dynamic_test_ids where name = 'price_slide')),
  'price_list',
  'price-list creation persists the typed slide discriminator'
);

select is(
  (
    select snapshot.snapshot_data_json ->> 'type'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'price_slide'
    )
    order by snapshot.created_at desc limit 1
  ),
  'price_list',
  'price-list creation queues a canonical immutable snapshot'
);

select is(
  (
    select snapshot.snapshot_data_json #>>
      '{priceList,sections,0,products,0,formattedPrice}'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'price_slide'
    )
    order by snapshot.created_at desc limit 1
  ),
  '€ 2,50',
  'price-list snapshots format cents deterministically for Dutch signage'
);

select ok(
  not (
    select snapshot.snapshot_data_json #>
      '{priceList,sections,0,products,0}' ? 'imageMediaAssetId'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'price_slide'
    )
    order by snapshot.created_at desc limit 1
  ),
  'hidden price-list photos do not enter snapshot or offline asset manifests'
);

select lives_ok(
  $$select public.refresh_dynamic_slide_v1(
    (select id from dynamic_test_ids where name = 'price_slide')
  )$$,
  'an authorized actor can refresh a valid price list'
);

select throws_ok(
  $$select public.create_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Ongeldige prijslijst',
    (select version.id
     from public.dynamic_template_versions version
     join public.dynamic_templates template on template.id = version.template_id
     where template.slug = 'editorial-arena-prijslijst-dark-landscape'
       and version.status = 'published'),
    (select id from dynamic_test_ids where name = 'source'),
    'latest',
    '{"title":"Prijslijst","slidePhotoMode":"show","sections":[{"id":"a5100000-0000-4000-8000-000000000020","categoryId":"Dranken","column":"left","order":0,"photoMode":"inherit","products":[{"id":"a5100000-0000-4000-8000-000000000021","productId":"ffffffff-ffff-4fff-8fff-ffffffffffff","order":0,"visible":true}]}]}'::jsonb
  )$$,
  '23514',
  'price list product is unavailable',
  'unavailable or foreign product ids fail closed'
);

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots
    where dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'price_slide'
    )
  ),
  1::bigint,
  'unchanged price-list refresh reuses the immutable snapshot'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a52', true);

select throws_ok(
  $$select public.update_tenant_control_settings_v3(
    '10000000-0000-4000-8000-000000000a51',
    'Dynamic tenant',
    '#FFFFFF',
    10,
    'contain',
    true,
    'landscape',
    1920,
    1080,
    'Europe/Amsterdam',
    'cut',
    null
  )$$,
  '42501',
  'actor cannot update tenant settings',
  'tenant viewer cannot change the primary slide colour'
);

select throws_ok(
  $$select public.refresh_dynamic_slide_v1(
    (select id from dynamic_test_ids where name = 'slide')
  )$$,
  '42501',
  'actor cannot refresh dynamic slide',
  'tenant viewer cannot create new snapshots'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a53', true);

select is(
  (select count(*) from public.dynamic_slides),
  0::bigint,
  'another tenant cannot read dynamic slides'
);

select is(
  (select count(*) from public.dynamic_slide_snapshots),
  0::bigint,
  'another tenant cannot read immutable snapshot data'
);

reset role;
insert into public.tenant_products (
  id, tenant_id, source, slug, name, description, category, price_cents,
  currency, active, available, sort_order
) values
  (
    '20000000-0000-4000-8000-000000000a51',
    '10000000-0000-4000-8000-000000000a51',
    'manual', 'broodje-gezond', 'Broodje gezond', 'Vers bereid',
    'Broodjes', 475, 'EUR', true, true, 200
  ),
  (
    '20000000-0000-4000-8000-000000000a52',
    '10000000-0000-4000-8000-000000000a52',
    'manual', 'vreemd-product', 'Vreemd product', null,
    'Verboden', 999, 'EUR', true, true, 10
  );
create temporary table editorial_test_configuration as
select private.editorial_arena_configuration_v2(
  'dark', '#315CFF'
) as configuration;
grant select on editorial_test_configuration to authenticated;
insert into dynamic_test_ids
select 'product_cola', id
from public.tenant_products
where tenant_id = '10000000-0000-4000-8000-000000000a51'
  and slug = 'cola';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a51', true);

insert into dynamic_test_ids
select
  'manual_price_slide',
  (
    public.create_dynamic_slide_v1(
      '10000000-0000-4000-8000-000000000a51',
      'Handmatig geordende clubkaart',
      version.id,
      (select id from dynamic_test_ids where name = 'source'),
      'latest',
      jsonb_build_object(
        'title', 'Clubkaart', 'maxItems', 2,
        'editorial',
        (select configuration from editorial_test_configuration) ||
          jsonb_build_object(
            'priceList', jsonb_build_object(
              'categoryPhotoModes', jsonb_build_object(
                'Dranken', 'reserve-empty', 'Broodjes', 'show'
              ),
              'columns', jsonb_build_object(
                'left', jsonb_build_array(
                  jsonb_build_object('kind', 'category', 'category', 'Dranken'),
                  jsonb_build_object(
                    'kind', 'product', 'productId',
                    (select id from dynamic_test_ids where name = 'product_cola')
                  )
                ),
                'right', jsonb_build_array(
                  jsonb_build_object('kind', 'category', 'category', 'Broodjes'),
                  jsonb_build_object(
                    'kind', 'product', 'productId',
                    '20000000-0000-4000-8000-000000000a51'
                  )
                )
              ),
              'productFocalPoints', jsonb_build_object(
                '20000000-0000-4000-8000-000000000a51',
                jsonb_build_object('x', 0.35, 'y', 0.7)
              )
            )
          )
      )
    ) ->> 'slideId'
  )::uuid
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slug = 'editorial-arena-menubord-dark-landscape'
  and version.status = 'published';

select is(
  (
    select string_agg(product ->> 'name', ',' order by ordinal)
    from public.dynamic_slide_snapshots snapshot
    cross join jsonb_array_elements(snapshot.snapshot_data_json #> '{menu,products}')
      with ordinality as selected(product, ordinal)
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'manual_price_slide'
    )
  ),
  'Cola failure proof,Broodje gezond',
  'immutable menu snapshot resolves exactly the manually ordered product set'
);

select is(
  (
    select snapshot.snapshot_data_json #>>
      '{editorial,priceList,productFocalPoints,20000000-0000-4000-8000-000000000a51,y}'
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = (
      select id from dynamic_test_ids where name = 'manual_price_slide'
    )
  ),
  '0.7',
  'category overrides, manual columns and focal points are frozen immutably'
);

select throws_ok(
  $$select public.preview_dynamic_slide_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Verboden product',
    (select version.id
      from public.dynamic_template_versions version
      join public.dynamic_templates template on template.id = version.template_id
      where template.slug = 'editorial-arena-menubord-dark-landscape'
        and version.status = 'published'),
    (select id from dynamic_test_ids where name = 'source'),
    jsonb_build_object(
      'editorial',
      (select configuration from editorial_test_configuration) ||
        jsonb_build_object(
          'priceList', jsonb_build_object(
            'categoryPhotoModes', '{}'::jsonb,
            'columns', jsonb_build_object(
              'left', jsonb_build_array(
                jsonb_build_object('kind', 'category', 'category', 'Verboden'),
                jsonb_build_object(
                  'kind', 'product', 'productId',
                  '20000000-0000-4000-8000-000000000a52'
                )
              ),
              'right', '[]'::jsonb
            ),
            'productFocalPoints', '{}'::jsonb
          )
        )
    )
  )$$,
  '22023',
  'editorial price-list contains unavailable or foreign products',
  'snapshot builder rejects a cross-tenant product reference'
);

reset role;

-- Render completion order is not guaranteed. Prove that a slower older
-- snapshot can finish after a newer one without regressing the latest pointer.
insert into public.dynamic_slides (
  id,
  tenant_id,
  name,
  slide_type,
  orientation,
  template_id,
  template_version_id,
  data_source_id,
  selection_mode,
  status,
  configuration_json,
  created_by,
  updated_by
)
select
  '40000000-0000-4000-8000-000000000a60',
  slide.tenant_id,
  'Render-volgorde regressietest',
  slide.slide_type,
  slide.orientation,
  slide.template_id,
  slide.template_version_id,
  slide.data_source_id,
  'latest',
  'rendering',
  slide.configuration_json,
  slide.created_by,
  slide.updated_by
from public.dynamic_slides slide
where slide.id = (select id from dynamic_test_ids where name = 'slide');

insert into public.dynamic_slide_snapshots (
  id,
  tenant_id,
  dynamic_slide_id,
  dynamic_slide_version_id,
  template_version_id,
  data_source_id,
  source_revision_hash,
  snapshot_data_json,
  status,
  created_by,
  created_at
)
select
  fixture.id,
  base.tenant_id,
  '40000000-0000-4000-8000-000000000a60',
  base.dynamic_slide_version_id,
  base.template_version_id,
  base.data_source_id,
  fixture.revision_hash,
  base.snapshot_data_json,
  'queued',
  base.created_by,
  fixture.created_at
from public.dynamic_slides slide
join public.dynamic_slide_snapshots base
  on base.tenant_id = slide.tenant_id
 and base.id = slide.current_snapshot_id
cross join (
  values
    (
      '40000000-0000-4000-8000-000000000a61'::uuid,
      repeat('c', 64),
      now(),
      1
    ),
    (
      '40000000-0000-4000-8000-000000000a62'::uuid,
      repeat('d', 64),
      now(),
      2
    )
) as fixture(id, revision_hash, created_at, insertion_order)
where slide.id = (select id from dynamic_test_ids where name = 'slide')
order by fixture.insertion_order;

select throws_ok(
  $$insert into public.dynamic_slide_snapshots (
      id,
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      status,
      created_by,
      created_at,
      snapshot_sequence
    )
    select
      '40000000-0000-4000-8000-000000000a64',
      snapshot.tenant_id,
      snapshot.dynamic_slide_id,
      snapshot.dynamic_slide_version_id,
      snapshot.template_version_id,
      snapshot.data_source_id,
      repeat('e', 64),
      snapshot.snapshot_data_json,
      'queued',
      snapshot.created_by,
      now(),
      63
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = '40000000-0000-4000-8000-000000000a61'$$,
  '23514',
  'dynamic snapshot sequence is database-owned',
  'callers cannot provide snapshot ordering metadata explicitly'
);

select throws_ok(
  $$update public.dynamic_slide_snapshots
      set snapshot_sequence = snapshot_sequence + 100
    where id = '40000000-0000-4000-8000-000000000a61'$$,
  '55000',
  'dynamic snapshot records are immutable',
  'snapshot order cannot be rewritten while a render is still queued'
);

-- Simulate immutable rows that already existed when S146 was installed. The
-- production migration leaves these values NULL instead of rewriting history.
set local session_replication_role = replica;
update public.dynamic_slide_snapshots
set snapshot_sequence = null
where id in (
  '40000000-0000-4000-8000-000000000a61',
  '40000000-0000-4000-8000-000000000a62'
);
set local session_replication_role = origin;

select is(
  (
    select count(*)
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id in (
      '40000000-0000-4000-8000-000000000a61',
      '40000000-0000-4000-8000-000000000a62'
    )
      and snapshot.snapshot_sequence is null
  ),
  2::bigint,
  'legacy in-flight snapshots keep NULL ordering metadata'
);

insert into public.dynamic_render_jobs (
  id,
  tenant_id,
  snapshot_id,
  output_media_asset_id,
  created_at
)
values
  (
    '41000000-0000-4000-8000-000000000a61',
    '10000000-0000-4000-8000-000000000a51',
    '40000000-0000-4000-8000-000000000a61',
    '42000000-0000-4000-8000-000000000a61',
    clock_timestamp() - interval '2 seconds'
  ),
  (
    '41000000-0000-4000-8000-000000000a62',
    '10000000-0000-4000-8000-000000000a51',
    '40000000-0000-4000-8000-000000000a62',
    '42000000-0000-4000-8000-000000000a62',
    clock_timestamp() - interval '1 second'
  );

create temporary table reverse_newer_claim as
select * from pg_temp.claim_dynamic_render_for_slide_v1(
  '40000000-0000-4000-8000-000000000a60',
  'reverse-newer-worker'
);
grant select on reverse_newer_claim to service_role;
set local role service_role;
select is(
  (select snapshot_id from reverse_newer_claim),
  '40000000-0000-4000-8000-000000000a62'::uuid,
  'the newest queued snapshot is claimed first'
);
select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from reverse_newer_claim),
    'reverse-newer-worker',
    'tenants/' || (select tenant_id from reverse_newer_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from reverse_newer_claim)::text ||
      '/dynamic-slide.png',
    4162,
    repeat('e', 64),
    1920,
    1080
  )$$,
  'the newer snapshot can finish before its older sibling'
);

reset role;
create temporary table reverse_older_claim as
select * from pg_temp.claim_dynamic_render_for_slide_v1(
  '40000000-0000-4000-8000-000000000a60',
  'reverse-older-worker'
);
grant select on reverse_older_claim to service_role;
set local role service_role;
select is(
  (select snapshot_id from reverse_older_claim),
  '40000000-0000-4000-8000-000000000a61'::uuid,
  'the older queued snapshot remains independently renderable'
);
select lives_ok(
  $$select public.complete_dynamic_render_job_v1(
    (select job_id from reverse_older_claim),
    'reverse-older-worker',
    'tenants/' || (select tenant_id from reverse_older_claim)::text ||
      '/assets/' ||
      (select output_media_asset_id from reverse_older_claim)::text ||
      '/dynamic-slide.png',
    4161,
    repeat('f', 64),
    1920,
    1080
  )$$,
  'the older snapshot may complete safely after the newer snapshot'
);

reset role;
select is(
  (
    select current_snapshot_id
    from public.dynamic_slides
    where id = '40000000-0000-4000-8000-000000000a60'
  ),
  '40000000-0000-4000-8000-000000000a62'::uuid,
  'late older completion cannot regress the latest snapshot pointer'
);

select ok(
  not exists (
    select 1
    from public.dynamic_slide_snapshots snapshot
    where snapshot.snapshot_sequence is null
      and snapshot.id not in (
        '40000000-0000-4000-8000-000000000a61',
        '40000000-0000-4000-8000-000000000a62'
      )
  ),
  'every snapshot created after the migration receives a sequence'
);

select is(
  (
    select count(snapshot.snapshot_sequence)
    from public.dynamic_slide_snapshots snapshot
  ),
  (
    select count(distinct snapshot.snapshot_sequence)
    from public.dynamic_slide_snapshots snapshot
  ),
  'post-migration snapshot sequences remain unique'
);


-- Exercise the actual owner cutover with no simulated human JWT or actor.
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);
create temporary table s185_ops_before as select
  (select count(*) from public.playlist_releases where playlist_id='30000000-0000-4000-8000-000000000a51') releases,
  (select target_revision from public.screens where id='40000000-0000-4000-8000-000000000a51') target_revision,
  (select active_release_id from public.player_devices where id='50000000-0000-4000-8000-000000000a51') active_release_id;
update public.playlist_items set duration_seconds=duration_seconds+1 where playlist_id='30000000-0000-4000-8000-000000000a51';
select lives_ok($test$select private.cutover_current_publication_v1(
 '10000000-0000-4000-8000-000000000a51','30000000-0000-4000-8000-000000000a51',
 (select revision from public.playlists where id='30000000-0000-4000-8000-000000000a51'),repeat('a',40),'Verify scoped cutover without actor impersonation','github:test-operator')$test$,
 'the owner cutover publishes through an explicit audited system path');
select is((select count(*) from public.playlist_releases where playlist_id='30000000-0000-4000-8000-000000000a51'),
 (select releases+1 from s185_ops_before),'one intended configuration change creates one immutable revision');
select is((select active_release_id from public.player_devices where id='50000000-0000-4000-8000-000000000a51'),
 (select active_release_id from s185_ops_before),'cutover never fabricates an active player confirmation');
select is((select desired_release_id from public.player_devices where id='50000000-0000-4000-8000-000000000a51'),
 (select assigned_release_id from public.screens where id='40000000-0000-4000-8000-000000000a51'),'device desired follows the effective assignment');
select ok((select target_revision from public.screens where id='40000000-0000-4000-8000-000000000a51')>
 (select target_revision from s185_ops_before),'a new assignment advances screen ordering');
select ok(exists(select 1 from public.audit_events where tenant_id='10000000-0000-4000-8000-000000000a51'
 and action='playlist.publication.system' and metadata->>'operator'='github:test-operator' and metadata->>'systemExecuted'='true'),
 'system publication records provenance without an invented authenticated actor');
select lives_ok($test$select private.cutover_current_publication_v1(
 '10000000-0000-4000-8000-000000000a51','30000000-0000-4000-8000-000000000a51',
 (select revision from public.playlists where id='30000000-0000-4000-8000-000000000a51'),repeat('a',40),'Retry completed scoped cutover safely','github:test-operator')$test$,
 'the cutover operation is resumable and idempotent');
select ok(not has_function_privilege('service_role','private.cutover_current_publication_v1(uuid,uuid,bigint,text,text,text)','EXECUTE')
 and not has_function_privilege('authenticated','private.materialize_publication_configuration_v1(uuid,text,jsonb)','EXECUTE'),
 'ordinary service and browser roles cannot invoke the owner-only publication path');

create temporary table s185_refresh_before as select count(*) releases from public.playlist_releases;
select lives_ok($test$select private.refresh_used_publication_sources_v1(
 '10000000-0000-4000-8000-000000000a51',repeat('a',40),'Refresh used sources through existing workers','github:test-operator')$test$,
 'owner source refresh uses the existing source scheduler without impersonation');
select is((select count(*) from public.playlist_releases),(select releases from s185_refresh_before),
 'requesting a source refresh never publishes a playlist');
select ok(not has_function_privilege('service_role','private.refresh_used_publication_sources_v1(uuid,text,text,text)','EXECUTE')
 and not has_function_privilege('authenticated','private.refresh_used_publication_sources_v1(uuid,text,text,text)','EXECUTE'),
 'source maintenance is restricted to the authorized database owner');
select * from finish();
rollback;
