-- S85: one canonical portrait RSS-news template, explicit per-page timing and
-- content-addressed supplier media for the trusted HTML/CSS Player runtime.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_rss_portrait;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
  seconds_per_slide integer;
  provider_logo_id uuid;
  provider_logo_text text;
begin
  result := private.build_dynamic_snapshot_data_before_rss_portrait(p_slide);
  if p_slide.slide_type <> 'news' then
    return result;
  end if;

  seconds_per_slide := case
    when coalesce(p_slide.configuration_json ->> 'secondsPerSlide', '')
      ~ '^[0-9]{1,3}$'
      then least(greatest(
        (p_slide.configuration_json ->> 'secondsPerSlide')::integer,
        5
      ), 120)
    else 5
  end;
  select source.config_json ->> 'providerLogoMediaAssetId'
  into provider_logo_text
  from public.dynamic_data_sources source
  where source.id = p_slide.data_source_id
    and source.tenant_id = p_slide.tenant_id;
  if coalesce(provider_logo_text, '') ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    select asset.id into provider_logo_id
    from public.media_assets asset
    where asset.id = provider_logo_text::uuid
      and asset.tenant_id = p_slide.tenant_id
      and asset.kind = 'image'::public.media_asset_kind
      and asset.status = 'ready'::public.media_asset_status;
  end if;

  result := jsonb_set(
    result,
    '{news,secondsPerSlide}',
    to_jsonb(seconds_per_slide),
    true
  );
  result := jsonb_set(
    result,
    '{news,title}',
    to_jsonb(coalesce(
      nullif(btrim(p_slide.configuration_json ->> 'title'), ''),
      'Nieuws'
    )),
    true
  );
  result := jsonb_set(
    result,
    '{news,providerLogoMediaAssetId}',
    case when provider_logo_id is null
      then 'null'::jsonb
      else to_jsonb(provider_logo_id::text)
    end,
    true
  );
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
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
      or media ->> 'role' not in ('article_hero', 'provider_logo')
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
      case when media_role = 'provider_logo'
        then 'RSS leverancierlogo'
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
        media_role = 'article_hero'
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
    then
      raise exception 'invalid normalized RSS article' using errcode = '22023';
    end if;
    hero_media_asset_id := null;
    if nullif(article ->> 'heroMediaAssetId', '') is not null then
      if article ->> 'heroMediaAssetId' !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'invalid RSS hero media id' using errcode = '22023';
      end if;
      hero_media_asset_id := (article ->> 'heroMediaAssetId')::uuid;
      if not exists (
        select 1
        from public.media_assets asset
        where asset.id = hero_media_asset_id
          and asset.tenant_id = source_record.tenant_id
          and asset.kind = 'image'::public.media_asset_kind
          and asset.status = 'ready'::public.media_asset_status
      ) then
        raise exception 'RSS hero media is unavailable' using errcode = '23514';
      end if;
    end if;

    insert into public.dynamic_news_articles(
      tenant_id, data_source_id, external_id, title, intro, author,
      source_name, link, hero_media_asset_id, published_at, content_hash,
      raw_reference
    ) values (
      source_record.tenant_id, source_record.id, article ->> 'externalId',
      btrim(article ->> 'title'), nullif(left(article ->> 'intro', 4000), ''),
      nullif(left(article ->> 'author', 160), ''),
      left(article ->> 'sourceName', 160), article ->> 'link',
      hero_media_asset_id,
      nullif(article ->> 'publishedAt', '')::timestamptz,
      encode(extensions.digest(
        pg_catalog.convert_to(article::text, 'UTF8'), 'sha256'
      ), 'hex'),
      jsonb_build_object(
        'syncRunId', run_record.id,
        'scheduled', true,
        'mediaNormalized', hero_media_asset_id is not null
      )
    )
    on conflict (tenant_id, data_source_id, external_id) do update set
      title = excluded.title,
      intro = excluded.intro,
      author = excluded.author,
      source_name = excluded.source_name,
      link = excluded.link,
      hero_media_asset_id = coalesce(
        excluded.hero_media_asset_id,
        public.dynamic_news_articles.hero_media_asset_id
      ),
      published_at = excluded.published_at,
      content_hash = excluded.content_hash,
      raw_reference = excluded.raw_reference;
    imported_count := imported_count + 1;
  end loop;

  update public.dynamic_sync_runs
  set
    status = 'succeeded',
    item_count = imported_count,
    finished_at = now()
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

create or replace function public.request_rss_media_sync_v1(
  p_data_source_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_record public.dynamic_data_sources%rowtype;
begin
  select * into source_record
  from public.dynamic_data_sources
  where id = p_data_source_id
    and kind = 'rss'
    and status = 'active';
  if not found then
    raise exception 'RSS source not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    source_record.tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'actor cannot schedule RSS media sync'
      using errcode = '42501';
  end if;
  update public.dynamic_data_sources
  set next_sync_at = now()
  where id = source_record.id
    and provider_status <> 'syncing';
  perform private.audit_event(
    source_record.tenant_id,
    'dynamic.rss.media_sync_requested',
    'dynamic_data_sources',
    source_record.id,
    'success',
    jsonb_build_object('actorId', actor_id)
  );
end;
$$;

revoke all on function public.request_rss_media_sync_v1(uuid)
  from public, anon;
grant execute on function public.request_rss_media_sync_v1(uuid)
  to authenticated;

create or replace function public.add_dynamic_slide_to_playlist_v1(
  p_playlist_id uuid,
  p_dynamic_slide_id uuid,
  p_duration_seconds integer default 10
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  slide_record public.dynamic_slides%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  next_sort integer;
  item_id uuid;
  resolved_duration integer;
  news_page_count integer;
  seconds_per_slide integer;
begin
  select * into playlist_record
  from public.playlists
  where id = p_playlist_id;
  select * into slide_record
  from public.dynamic_slides
  where id = p_dynamic_slide_id;
  if playlist_record.id is null or slide_record.id is null
    or playlist_record.tenant_id <> slide_record.tenant_id
  then
    raise exception 'playlist or dynamic slide not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    playlist_record.tenant_id, 'tenant.playlist.write'
  ) then
    raise exception 'actor cannot change playlist' using errcode = '42501';
  end if;
  select * into snapshot_record
  from public.dynamic_slide_snapshots
  where id = slide_record.current_snapshot_id
    and tenant_id = playlist_record.tenant_id
    and status = 'ready';
  if not found or snapshot_record.output_media_asset_id is null then
    raise exception 'dynamic slide has no ready snapshot' using errcode = '23514';
  end if;

  resolved_duration := least(greatest(p_duration_seconds, 5), 3600);
  if slide_record.slide_type = 'news' then
    news_page_count := greatest(
      jsonb_array_length(coalesce(
        snapshot_record.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )),
      1
    );
    seconds_per_slide := least(greatest(
      case
        when coalesce(
          snapshot_record.snapshot_data_json #>> '{news,secondsPerSlide}',
          ''
        ) ~ '^[0-9]{1,3}$'
          then (
            snapshot_record.snapshot_data_json #>>
              '{news,secondsPerSlide}'
          )::integer
        else 5
      end,
      5
    ), 120);
    resolved_duration := least(news_page_count * seconds_per_slide, 3600);
  end if;

  select coalesce(max(item.sort_order), -1) + 1 into next_sort
  from public.playlist_items item
  where item.tenant_id = playlist_record.tenant_id
    and item.playlist_id = playlist_record.id;
  insert into public.playlist_items(
    tenant_id, playlist_id, media_asset_id, sort_order, duration_seconds,
    fit_mode, muted, created_by, dynamic_slide_id, dynamic_snapshot_id,
    dynamic_selection_mode
  ) values (
    playlist_record.tenant_id, playlist_record.id,
    snapshot_record.output_media_asset_id, next_sort,
    resolved_duration, 'contain', true, actor_id,
    slide_record.id, snapshot_record.id, slide_record.selection_mode
  ) returning id into item_id;
  perform private.audit_event(
    playlist_record.tenant_id, 'dynamic.slide.added_to_playlist',
    'playlist_items', item_id, 'success',
    jsonb_build_object(
      'playlistId', playlist_record.id,
      'slideId', slide_record.id,
      'snapshotId', snapshot_record.id,
      'durationSeconds', resolved_duration
    )
  );
  return item_id;
end;
$$;

revoke all on function public.add_dynamic_slide_to_playlist_v1(
  uuid, uuid, integer
) from public, anon;
grant execute on function public.add_dynamic_slide_to_playlist_v1(
  uuid, uuid, integer
) to authenticated;

create or replace function private.follow_latest_dynamic_snapshot_in_drafts()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected_count integer := 0;
  resolved_duration integer;
  page_count integer;
  seconds_per_slide integer;
begin
  if old.status is distinct from 'ready'
    and new.status = 'ready'
    and new.output_media_asset_id is not null
  then
    resolved_duration := null;
    if new.snapshot_data_json ->> 'type' = 'news' then
      page_count := greatest(jsonb_array_length(coalesce(
        new.snapshot_data_json #> '{news,articles}',
        '[]'::jsonb
      )), 1);
      seconds_per_slide := least(greatest(
        case
          when coalesce(
            new.snapshot_data_json #>> '{news,secondsPerSlide}',
            ''
          ) ~ '^[0-9]{1,3}$'
            then (
              new.snapshot_data_json #>> '{news,secondsPerSlide}'
            )::integer
          else 5
        end,
        5
      ), 120);
      resolved_duration := least(page_count * seconds_per_slide, 3600);
    end if;

    with changed_items as (
      update public.playlist_items item
      set
        dynamic_snapshot_id = new.id,
        media_asset_id = new.output_media_asset_id,
        duration_seconds = coalesce(resolved_duration, item.duration_seconds),
        updated_at = now()
      where item.tenant_id = new.tenant_id
        and item.dynamic_slide_id = new.dynamic_slide_id
        and item.dynamic_selection_mode = 'latest'
      returning item.playlist_id
    ),
    changed_playlists as (
      select distinct playlist_id from changed_items
    )
    update public.playlists playlist
    set
      revision = playlist.revision + 1,
      updated_at = now()
    where playlist.tenant_id = new.tenant_id
      and playlist.id in (
        select changed.playlist_id from changed_playlists changed
      );
    get diagnostics affected_count = row_count;

    if affected_count > 0 then
      insert into public.audit_events(
        tenant_id, action, target_type, target_id, result, metadata
      ) values (
        new.tenant_id,
        'dynamic.draft_snapshot.followed',
        'dynamic_slide_snapshots',
        new.id,
        'success',
        jsonb_build_object(
          'systemExecuted', true,
          'playlistCount', affected_count,
          'dynamicSlideId', new.dynamic_slide_id,
          'durationSeconds', resolved_duration
        )
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.follow_latest_dynamic_snapshot_in_drafts()
  from public, anon, authenticated;

do $$
declare
  canonical_template_id uuid;
  canonical_version_id uuid;
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  revision_hash text;
  new_snapshot_id uuid;
begin
  select template.id, template.current_published_version_id
  into canonical_template_id, canonical_version_id
  from public.dynamic_templates template
  where template.slug = 'news-newsroom-dark-portrait'
    and template.slide_type = 'news'
    and template.orientation = 'portrait';
  if canonical_template_id is null or canonical_version_id is null then
    raise exception 'canonical portrait RSS template is unavailable'
      using errcode = '55000';
  end if;

  update public.dynamic_templates
  set
    name = 'RSS nieuws · staand',
    description =
      'Dynamische portrait-nieuwsslider met leverancierlogo, beeld, kop en broninformatie.',
    status = 'published'
  where id = canonical_template_id;

  update public.dynamic_template_versions
  set status = 'withdrawn'
  where template_id in (
    select template.id
    from public.dynamic_templates template
    where template.slide_type = 'news'
      and template.orientation = 'portrait'
      and template.id <> canonical_template_id
  )
    and status = 'published';

  update public.dynamic_templates
  set status = 'withdrawn'
  where slide_type = 'news'
    and orientation = 'portrait'
    and id <> canonical_template_id;

  for slide_record in
    update public.dynamic_slides slide
    set
      template_id = canonical_template_id,
      template_version_id = canonical_version_id,
      configuration_json = jsonb_set(
        slide.configuration_json,
        '{secondsPerSlide}',
        to_jsonb(case
          when coalesce(
            slide.configuration_json ->> 'secondsPerSlide',
            ''
          ) ~ '^[0-9]{1,3}$'
            then least(greatest(
              (slide.configuration_json ->> 'secondsPerSlide')::integer,
              5
            ), 120)
          else 5
        end),
        true
      ),
      status = 'rendering'
    where slide.slide_type = 'news'
      and slide.orientation = 'portrait'
      and slide.status <> 'archived'
    returning slide.*
  loop
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    revision_hash := encode(extensions.digest(
      pg_catalog.convert_to(jsonb_build_object(
        'templateVersionId', slide_record.template_version_id,
        'configuration', slide_record.configuration_json,
        'data', snapshot_data
      )::text, 'UTF8'), 'sha256'
    ), 'hex');
    new_snapshot_id := null;
    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json
    ) values (
      slide_record.tenant_id, slide_record.id,
      slide_record.template_version_id, slide_record.data_source_id,
      revision_hash, snapshot_data
    )
    on conflict (
      dynamic_slide_id, source_revision_hash, template_version_id
    ) do nothing
    returning id into new_snapshot_id;
    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
    end if;
  end loop;
end;
$$;
