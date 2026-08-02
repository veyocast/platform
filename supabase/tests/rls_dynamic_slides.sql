begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(35);

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
where template.slug = 'menu-atelier-landscape'
  and version.status = 'published';

select is(
  (select status from public.dynamic_slides
    where id = (select id from dynamic_test_ids where name = 'slide')),
  'rendering',
  'creating a slide atomically queues its first immutable snapshot'
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

create temporary table dynamic_refresh_claim as
select * from public.claim_dynamic_render_job_v1(
  'dynamic-refresh-worker',
  120,
  3
);

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

insert into dynamic_test_ids values (
  'rss_source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000000a51',
    'Clubnieuws',
    'rss',
    '{"url":"https://example.com/news.xml"}'::jsonb
  )
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
where template.slug = 'news-editorial-landscape'
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

select * from finish();
rollback;
