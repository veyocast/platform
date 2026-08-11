-- S100: readable Editorial Arena news/standing slides, locally generated
-- article QR assets and canonical-link RSS deduplication.

alter table public.dynamic_news_articles
  add column canonical_link text;

alter table public.dynamic_news_articles
  add column qr_media_asset_id uuid;

alter table public.dynamic_news_articles
  add constraint dynamic_news_articles_canonical_link_check
  check (
    canonical_link is null
    or (length(canonical_link) <= 2048 and canonical_link ~ '^https?://')
  );

alter table public.dynamic_news_articles
  add constraint dynamic_news_articles_qr_asset_fkey
  foreign key (tenant_id, qr_media_asset_id)
  references public.media_assets(tenant_id, id) on delete restrict;

create index dynamic_news_articles_canonical_link_idx
  on public.dynamic_news_articles(tenant_id, data_source_id, canonical_link);

create or replace function private.set_dynamic_news_canonical_link_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.canonical_link := coalesce(
    nullif(new.canonical_link, ''),
    lower(split_part(new.link, '#', 1))
  );
  return new;
end;
$$;

revoke all on function private.set_dynamic_news_canonical_link_v1()
  from public, anon, authenticated;

drop trigger if exists dynamic_news_articles_set_canonical_link
  on public.dynamic_news_articles;
create trigger dynamic_news_articles_set_canonical_link
before insert or update of link, canonical_link
on public.dynamic_news_articles
for each row execute function private.set_dynamic_news_canonical_link_v1();

update public.dynamic_news_articles
set canonical_link = lower(split_part(link, '#', 1))
where canonical_link is null;

with ranked as (
  select
    article.id,
    row_number() over (
      partition by article.tenant_id, article.data_source_id, article.canonical_link
      order by article.published_at desc nulls last,
        article.updated_at desc,
        article.created_at desc,
        article.id desc
    ) as duplicate_rank
  from public.dynamic_news_articles article
)
delete from public.dynamic_news_articles article
using ranked
where ranked.id = article.id
  and ranked.duplicate_rank > 1;

alter table public.dynamic_news_articles
  alter column canonical_link set not null;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_news_qr_v1;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  enriched_articles jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_news_qr_v1(p_slide);
  if p_slide.slide_type <> 'news' then
    return result;
  end if;

  select coalesce(
    jsonb_agg(
      source.article || jsonb_strip_nulls(jsonb_build_object(
        'canonicalLink', stored.canonical_link,
        'qrMediaAssetId', stored.qr_media_asset_id
      ))
      order by source.article_order
    ),
    '[]'::jsonb
  )
  into enriched_articles
  from jsonb_array_elements(
    coalesce(result #> '{news,articles}', '[]'::jsonb)
  ) with ordinality as source(article, article_order)
  left join public.dynamic_news_articles stored
    on stored.tenant_id = p_slide.tenant_id
   and stored.data_source_id = p_slide.data_source_id
   and stored.external_id = source.article ->> 'externalId';

  return jsonb_set(result, '{news,articles}', enriched_articles, true);
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_news_qr_v1(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function public.complete_scheduled_rss_sync_v2(
  p_run_id uuid,
  p_worker_id text,
  p_articles jsonb,
  p_media_assets jsonb default '[]'::jsonb
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  run_record public.dynamic_sync_runs%rowtype;
  source_record public.dynamic_data_sources%rowtype;
  article jsonb;
  media jsonb;
  imported_count integer := 0;
  media_asset_id uuid;
  hero_media_asset_id uuid;
  qr_media_asset_id uuid;
  provider_logo_asset_id uuid;
  expected_storage_path text;
  media_role text;
  media_checksum text;
  media_title text;
  media_width integer;
  media_height integer;
  media_bytes bigint;
begin
  select * into run_record
  from public.dynamic_sync_runs
  where id = p_run_id and status = 'running'
  for update;
  if not found then
    raise exception 'RSS sync run not found' using errcode = 'P0002';
  end if;

  select * into source_record
  from public.dynamic_data_sources
  where id = run_record.data_source_id
    and tenant_id = run_record.tenant_id
    and kind = 'rss'
    and provider_status = 'syncing'
    and sync_locked_by = left(p_worker_id, 120)
  for update;
  if not found then
    raise exception 'RSS sync lease lost' using errcode = '55000';
  end if;
  if jsonb_typeof(p_articles) <> 'array'
    or jsonb_array_length(p_articles) > 50
    or jsonb_typeof(coalesce(p_media_assets, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_media_assets, '[]'::jsonb)) > 51
  then
    raise exception 'invalid RSS payload' using errcode = '22023';
  end if;

  for media in
    select value
    from jsonb_array_elements(coalesce(p_media_assets, '[]'::jsonb))
  loop
    if coalesce(media ->> 'assetId', '') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(media ->> 'checksumSha256', '') !~ '^[a-f0-9]{64}$'
      or media ->> 'mimeType' is distinct from 'image/webp'
      or media ->> 'role' not in ('article_hero', 'article_qr', 'provider_logo')
      or coalesce(media ->> 'fileSizeBytes', '') !~ '^[0-9]{1,8}$'
      or coalesce(media ->> 'width', '') !~ '^[0-9]{1,4}$'
      or coalesce(media ->> 'height', '') !~ '^[0-9]{1,4}$'
    then
      raise exception 'invalid RSS media payload' using errcode = '22023';
    end if;

    media_asset_id := (media ->> 'assetId')::uuid;
    media_role := media ->> 'role';
    media_checksum := media ->> 'checksumSha256';
    media_bytes := (media ->> 'fileSizeBytes')::bigint;
    media_width := (media ->> 'width')::integer;
    media_height := (media ->> 'height')::integer;
    media_title := left(coalesce(
      nullif(btrim(media ->> 'title'), ''),
      case media_role
        when 'provider_logo' then 'RSS leverancierlogo'
        when 'article_qr' then 'RSS artikel QR-code'
        else 'RSS nieuwsafbeelding'
      end
    ), 160);
    expected_storage_path :=
      'tenants/' || source_record.tenant_id::text ||
      '/assets/' || media_asset_id::text ||
      '/rss-' || media_role || '.webp';

    if media ->> 'storagePath' is distinct from expected_storage_path
      or media_bytes <= 0 or media_bytes > 8000000
      or media_width <= 0 or media_width > 1920
      or media_height <= 0 or media_height > 1920
      or (
        media_role in ('article_hero', 'article_qr')
        and length(coalesce(media ->> 'externalId', '')) not between 1 and 512
      )
      or (
        media_role = 'provider_logo'
        and nullif(media ->> 'externalId', '') is not null
      )
    then
      raise exception 'RSS media metadata is invalid' using errcode = '23514';
    end if;

    insert into public.media_assets(
      id, tenant_id, created_by, kind, title, original_file_name,
      mime_type, status, storage_bucket, storage_path, file_size_bytes,
      checksum_sha256, width, height, processed_at
    ) values (
      media_asset_id, source_record.tenant_id, null,
      'image'::public.media_asset_kind, media_title,
      'rss-' || media_role || '.webp', 'image/webp',
      'ready'::public.media_asset_status, 'tenant-media',
      expected_storage_path, media_bytes, media_checksum,
      media_width, media_height, now()
    )
    on conflict (id) do nothing;

    if not exists (
      select 1
      from public.media_assets asset
      where asset.id = media_asset_id
        and asset.tenant_id = source_record.tenant_id
        and asset.storage_path = expected_storage_path
        and asset.checksum_sha256 = media_checksum
        and asset.file_size_bytes = media_bytes
        and asset.status = 'ready'::public.media_asset_status
    ) then
      raise exception 'RSS media identity collision' using errcode = '23514';
    end if;

    insert into public.media_variants(
      tenant_id, asset_id, variant_type, storage_bucket, storage_path,
      mime_type, file_size_bytes, checksum_sha256, width, height
    ) values (
      source_record.tenant_id, media_asset_id,
      'original'::public.media_variant_type, 'tenant-media',
      expected_storage_path, 'image/webp', media_bytes, media_checksum,
      media_width, media_height
    )
    on conflict (tenant_id, asset_id, variant_type) do nothing;

    if not exists (
      select 1
      from public.media_variants variant
      where variant.tenant_id = source_record.tenant_id
        and variant.asset_id = media_asset_id
        and variant.variant_type = 'original'::public.media_variant_type
        and variant.storage_bucket = 'tenant-media'
        and variant.storage_path = expected_storage_path
        and variant.mime_type = 'image/webp'
        and variant.file_size_bytes = media_bytes
        and variant.checksum_sha256 = media_checksum
        and variant.width = media_width
        and variant.height = media_height
    ) then
      raise exception 'RSS media variant identity collision'
        using errcode = '23514';
    end if;

    if media_role = 'provider_logo' then
      if provider_logo_asset_id is not null then
        raise exception 'RSS payload has more than one provider logo'
          using errcode = '22023';
      end if;
      provider_logo_asset_id := media_asset_id;
    end if;
  end loop;

  for article in select value from jsonb_array_elements(p_articles)
  loop
    if length(btrim(article ->> 'title')) not between 1 and 160
      or length(coalesce(article ->> 'externalId', '')) not between 1 and 512
      or coalesce(article ->> 'link', '') !~ '^https?://'
      or length(coalesce(article ->> 'link', '')) > 2048
      or coalesce(article ->> 'canonicalLink', '') !~ '^https?://'
      or length(coalesce(article ->> 'canonicalLink', '')) > 2048
    then
      raise exception 'invalid normalized RSS article' using errcode = '22023';
    end if;

    hero_media_asset_id := null;
    qr_media_asset_id := null;
    if nullif(article ->> 'heroMediaAssetId', '') is not null then
      if article ->> 'heroMediaAssetId' !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'invalid RSS hero media id' using errcode = '22023';
      end if;
      hero_media_asset_id := (article ->> 'heroMediaAssetId')::uuid;
    end if;
    if nullif(article ->> 'qrMediaAssetId', '') is not null then
      if article ->> 'qrMediaAssetId' !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'invalid RSS QR media id' using errcode = '22023';
      end if;
      qr_media_asset_id := (article ->> 'qrMediaAssetId')::uuid;
    end if;
    if (
      hero_media_asset_id is not null
      and not exists (
        select 1 from public.media_assets asset
        where asset.id = hero_media_asset_id
          and asset.tenant_id = source_record.tenant_id
          and asset.kind = 'image'::public.media_asset_kind
          and asset.status = 'ready'::public.media_asset_status
      )
    ) or (
      qr_media_asset_id is not null
      and not exists (
        select 1 from public.media_assets asset
        where asset.id = qr_media_asset_id
          and asset.tenant_id = source_record.tenant_id
          and asset.kind = 'image'::public.media_asset_kind
          and asset.status = 'ready'::public.media_asset_status
      )
    ) then
      raise exception 'RSS article media is unavailable' using errcode = '23514';
    end if;

    insert into public.dynamic_news_articles(
      tenant_id, data_source_id, external_id, canonical_link,
      title, intro, author, source_name, link,
      hero_media_asset_id, qr_media_asset_id, published_at, content_hash,
      raw_reference
    ) values (
      source_record.tenant_id, source_record.id, article ->> 'externalId',
      article ->> 'canonicalLink',
      btrim(article ->> 'title'), nullif(left(article ->> 'intro', 4000), ''),
      nullif(left(article ->> 'author', 160), ''),
      left(article ->> 'sourceName', 160), article ->> 'link',
      hero_media_asset_id, qr_media_asset_id,
      nullif(article ->> 'publishedAt', '')::timestamptz,
      encode(extensions.digest(
        pg_catalog.convert_to(article::text, 'UTF8'), 'sha256'
      ), 'hex'),
      jsonb_build_object(
        'syncRunId', run_record.id,
        'scheduled', true,
        'mediaNormalized', hero_media_asset_id is not null,
        'qrGenerated', qr_media_asset_id is not null
      )
    )
    on conflict (tenant_id, data_source_id, external_id) do update set
      canonical_link = excluded.canonical_link,
      title = excluded.title,
      intro = excluded.intro,
      author = excluded.author,
      source_name = excluded.source_name,
      link = excluded.link,
      hero_media_asset_id = coalesce(
        excluded.hero_media_asset_id,
        public.dynamic_news_articles.hero_media_asset_id
      ),
      qr_media_asset_id = coalesce(
        excluded.qr_media_asset_id,
        public.dynamic_news_articles.qr_media_asset_id
      ),
      published_at = excluded.published_at,
      content_hash = excluded.content_hash,
      raw_reference = excluded.raw_reference;
    imported_count := imported_count + 1;
  end loop;

  -- The normalized table mirrors the current feed. Older provider GUIDs for
  -- the same canonical article and articles no longer present are removed;
  -- immutable release snapshots continue to retain their own bounded payload.
  delete from public.dynamic_news_articles stored
  where stored.tenant_id = source_record.tenant_id
    and stored.data_source_id = source_record.id
    and not exists (
      select 1
      from jsonb_array_elements(p_articles) incoming
      where incoming ->> 'canonicalLink' = stored.canonical_link
    );

  with ranked as (
    select
      stored.id,
      row_number() over (
        partition by stored.canonical_link
        order by stored.published_at desc nulls last,
          stored.updated_at desc,
          stored.id desc
      ) as duplicate_rank
    from public.dynamic_news_articles stored
    where stored.tenant_id = source_record.tenant_id
      and stored.data_source_id = source_record.id
  )
  delete from public.dynamic_news_articles stored
  using ranked
  where ranked.id = stored.id
    and ranked.duplicate_rank > 1;

  update public.dynamic_sync_runs
  set status = 'succeeded', item_count = imported_count, finished_at = now()
  where id = run_record.id;

  update public.dynamic_data_sources
  set
    config_json = case when provider_logo_asset_id is null
      then config_json
      else jsonb_set(
        config_json,
        '{providerLogoMediaAssetId}',
        to_jsonb(provider_logo_asset_id::text),
        true
      )
    end,
    provider_status = 'ready',
    last_successful_sync_at = now(),
    last_error_code = null,
    last_error_detail = null,
    next_sync_at = now() + make_interval(
      mins => least(greatest(
        case when coalesce(config_json ->> 'refreshMinutes', '') ~ '^[0-9]{1,4}$'
          then (config_json ->> 'refreshMinutes')::integer
          else 15
        end,
        5
      ), 1440)
    ),
    sync_locked_at = null,
    sync_locked_by = null,
    revision = revision + 1
  where id = source_record.id;

  insert into public.audit_events(
    tenant_id, action, target_type, target_id, result, metadata
  ) values (
    source_record.tenant_id, 'dynamic.data_source.scheduled_sync',
    'dynamic_data_sources', source_record.id, 'success',
    jsonb_build_object(
      'systemExecuted', true,
      'syncRunId', run_record.id,
      'itemCount', imported_count,
      'mediaAssetCount',
        jsonb_array_length(coalesce(p_media_assets, '[]'::jsonb))
    )
  );
  return imported_count;
end;
$$;

revoke all on function public.complete_scheduled_rss_sync_v2(
  uuid, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_scheduled_rss_sync_v2(
  uuid, text, jsonb, jsonb
) to service_role;
