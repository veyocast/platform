-- S51 follow-up: audited platform template draft commands with concurrency guards.

alter table public.dynamic_template_versions
  add column revision bigint not null default 0 check (revision >= 0),
  add column updated_at timestamptz not null default now();
create trigger dynamic_template_versions_set_updated_at
before update on public.dynamic_template_versions
for each row execute function private.set_updated_at();

create or replace function public.create_dynamic_template_v1(
  p_name text,
  p_slug text,
  p_description text,
  p_slide_type text,
  p_orientation text,
  p_markup text,
  p_css text,
  p_manifest_json jsonb,
  p_sample_data_json jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_id uuid;
  version_id uuid;
  checksum text;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot create dynamic templates' using errcode = '42501';
  end if;
  if length(btrim(p_name)) not between 2 and 120
    or p_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
    or length(coalesce(p_description, '')) > 500
    or p_slide_type not in ('menu', 'news')
    or p_orientation not in ('landscape', 'portrait')
    or length(p_markup) not between 1 and 100000
    or length(coalesce(p_css, '')) > 50000
    or jsonb_typeof(p_manifest_json) <> 'object'
    or jsonb_typeof(p_sample_data_json) <> 'object'
  then
    raise exception 'invalid dynamic template draft' using errcode = '22023';
  end if;
  checksum := encode(extensions.digest(
    pg_catalog.convert_to(
      p_markup || coalesce(p_css, '') || p_manifest_json::text, 'UTF8'
    ), 'sha256'
  ), 'hex');
  insert into public.dynamic_templates(
    slug, name, description, category, slide_type, orientation,
    created_by, updated_by
  ) values (
    p_slug, btrim(p_name), coalesce(p_description, ''), p_slide_type,
    p_slide_type, p_orientation, actor_id, actor_id
  ) returning id into template_id;
  insert into public.dynamic_template_versions(
    template_id, version, markup, css, manifest_json, sample_data_json,
    source_checksum_sha256, created_by
  ) values (
    template_id, 1, p_markup, coalesce(p_css, ''), p_manifest_json,
    p_sample_data_json, checksum, actor_id
  ) returning id into version_id;
  perform private.audit_event(
    null, 'dynamic.template.created', 'dynamic_templates',
    template_id, 'success',
    jsonb_build_object('versionId', version_id, 'slideType', p_slide_type)
  );
  return jsonb_build_object(
    'templateId', template_id, 'versionId', version_id, 'revision', 0
  );
end;
$$;

create or replace function public.update_dynamic_template_draft_v1(
  p_version_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_description text,
  p_markup text,
  p_css text,
  p_manifest_json jsonb,
  p_sample_data_json jsonb
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  version_record public.dynamic_template_versions%rowtype;
  next_revision bigint;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot update dynamic templates' using errcode = '42501';
  end if;
  select * into version_record from public.dynamic_template_versions
  where id = p_version_id and status = 'draft' for update;
  if not found then
    raise exception 'template draft not found' using errcode = 'P0002';
  end if;
  if version_record.revision <> p_expected_revision then
    raise exception 'template draft revision conflict' using errcode = '40001';
  end if;
  if length(btrim(p_name)) not between 2 and 120
    or length(coalesce(p_description, '')) > 500
    or length(p_markup) not between 1 and 100000
    or length(coalesce(p_css, '')) > 50000
    or jsonb_typeof(p_manifest_json) <> 'object'
    or jsonb_typeof(p_sample_data_json) <> 'object'
  then
    raise exception 'invalid dynamic template draft' using errcode = '22023';
  end if;
  update public.dynamic_template_versions set
    markup = p_markup,
    css = coalesce(p_css, ''),
    manifest_json = p_manifest_json,
    sample_data_json = p_sample_data_json,
    source_checksum_sha256 = encode(extensions.digest(
      pg_catalog.convert_to(
        p_markup || coalesce(p_css, '') || p_manifest_json::text, 'UTF8'
      ), 'sha256'
    ), 'hex'),
    revision = revision + 1
  where id = version_record.id
  returning revision into next_revision;
  update public.dynamic_templates set
    name = btrim(p_name),
    description = coalesce(p_description, ''),
    updated_by = actor_id
  where id = version_record.template_id;
  perform private.audit_event(
    null, 'dynamic.template.updated', 'dynamic_template_versions',
    version_record.id, 'success',
    jsonb_build_object(
      'templateId', version_record.template_id,
      'revision', next_revision
    )
  );
  return next_revision;
end;
$$;

create or replace function public.create_dynamic_template_version_v1(
  p_template_id uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record public.dynamic_templates%rowtype;
  source_version public.dynamic_template_versions%rowtype;
  new_version_id uuid;
  next_version integer;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot version dynamic templates' using errcode = '42501';
  end if;
  select * into template_record from public.dynamic_templates
  where id = p_template_id for update;
  if not found or template_record.current_published_version_id is null then
    raise exception 'published template not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.dynamic_template_versions
    where template_id = template_record.id and status = 'draft'
  ) then
    raise exception 'template already has a draft' using errcode = '23505';
  end if;
  select * into source_version from public.dynamic_template_versions
  where id = template_record.current_published_version_id;
  select coalesce(max(version), 0) + 1 into next_version
  from public.dynamic_template_versions where template_id = template_record.id;
  insert into public.dynamic_template_versions(
    template_id, version, status, markup, css, manifest_json,
    sample_data_json, source_checksum_sha256, created_by
  ) values (
    template_record.id, next_version, 'draft', source_version.markup,
    source_version.css, source_version.manifest_json,
    source_version.sample_data_json, source_version.source_checksum_sha256,
    actor_id
  ) returning id into new_version_id;
  perform private.audit_event(
    null, 'dynamic.template.version_created', 'dynamic_template_versions',
    new_version_id, 'success',
    jsonb_build_object(
      'templateId', template_record.id, 'version', next_version,
      'sourceVersionId', source_version.id
    )
  );
  return new_version_id;
end;
$$;

create or replace function public.withdraw_dynamic_template_v1(
  p_template_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record public.dynamic_templates%rowtype;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot withdraw dynamic templates' using errcode = '42501';
  end if;
  perform private.require_aal2_command();
  select * into template_record from public.dynamic_templates
  where id = p_template_id and status = 'published' for update;
  if not found then
    raise exception 'published template not found' using errcode = 'P0002';
  end if;
  update public.dynamic_template_versions set status = 'withdrawn'
  where id = template_record.current_published_version_id;
  update public.dynamic_templates set
    status = 'withdrawn', updated_by = actor_id
  where id = template_record.id;
  perform private.audit_event(
    null, 'dynamic.template.withdrawn', 'dynamic_templates',
    template_record.id, 'success',
    jsonb_build_object(
      'versionId', template_record.current_published_version_id
    )
  );
end;
$$;

grant execute on function public.create_dynamic_template_v1(
  text, text, text, text, text, text, text, jsonb, jsonb
) to authenticated;
grant execute on function public.update_dynamic_template_draft_v1(
  uuid, bigint, text, text, text, text, jsonb, jsonb
) to authenticated;
grant execute on function public.create_dynamic_template_version_v1(uuid)
  to authenticated;
grant execute on function public.withdraw_dynamic_template_v1(uuid)
  to authenticated;

create or replace function public.create_manual_product_v1(
  p_data_source_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_price_minor integer,
  p_currency text default 'EUR'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_record public.dynamic_data_sources%rowtype;
  product_id uuid := gen_random_uuid();
  product_slug text;
begin
  select * into source_record from public.dynamic_data_sources
  where id = p_data_source_id
    and kind = 'manual_products'
    and status = 'active';
  if not found then
    raise exception 'manual product source not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    source_record.tenant_id, 'tenant.product.write'
  ) then
    raise exception 'actor cannot create products' using errcode = '42501';
  end if;
  if length(btrim(p_name)) not between 1 and 160
    or length(coalesce(p_description, '')) > 1000
    or length(coalesce(p_category, '')) > 160
    or p_price_minor not between 0 and 100000000
    or p_currency !~ '^[A-Z]{3}$'
  then
    raise exception 'invalid manual product' using errcode = '22023';
  end if;
  product_slug := left(
    trim(both '-' from regexp_replace(
      lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'
    )),
    68
  ) || '-' || left(replace(product_id::text, '-', ''), 8);
  insert into public.tenant_products(
    id, tenant_id, source, source_external_id, slug, name, description,
    category, price_cents, currency, available, active, data_source_id,
    created_by, updated_by
  ) values (
    product_id, source_record.tenant_id, 'manual', product_id::text,
    product_slug, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_category, '')), ''), p_price_minor,
    p_currency, true, true, source_record.id, actor_id, actor_id
  );
  perform private.audit_event(
    source_record.tenant_id, 'dynamic.manual_product.created',
    'tenant_products', product_id, 'success',
    jsonb_build_object('dataSourceId', source_record.id)
  );
  return product_id;
end;
$$;

grant execute on function public.create_manual_product_v1(
  uuid, text, text, text, integer, text
) to authenticated;

alter table public.dynamic_data_sources
  add column next_sync_at timestamptz,
  add column sync_locked_at timestamptz,
  add column sync_locked_by text;
create index dynamic_data_sources_due_rss_idx
  on public.dynamic_data_sources(next_sync_at)
  where kind = 'rss' and status = 'active';
update public.dynamic_data_sources
set next_sync_at = now() + interval '15 minutes'
where kind = 'rss';

create or replace function private.schedule_next_rss_sync()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'succeeded' and old.status is distinct from new.status then
    update public.dynamic_data_sources source set
      next_sync_at = coalesce(source.next_sync_at, now() + interval '15 minutes')
    where source.id = new.data_source_id and source.kind = 'rss';
  end if;
  return new;
end;
$$;
create trigger dynamic_sync_runs_schedule_next
after update on public.dynamic_sync_runs
for each row execute function private.schedule_next_rss_sync();
revoke all on function private.schedule_next_rss_sync()
  from public, anon, authenticated;

create or replace function public.claim_due_rss_sync_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 120
)
returns table (
  run_id uuid,
  tenant_id uuid,
  data_source_id uuid,
  source_url text
)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.dynamic_data_sources source set
    provider_status = case
      when source.last_successful_sync_at is null then 'error'
      else 'ready'
    end,
    sync_locked_at = null,
    sync_locked_by = null,
    next_sync_at = now()
  where source.kind = 'rss'
    and source.provider_status = 'syncing'
    and source.sync_locked_at < now() - make_interval(
      secs => least(greatest(p_lock_timeout_seconds, 30), 600)
    );
  return query
  with candidate as (
    select source.id
    from public.dynamic_data_sources source
    where source.kind = 'rss'
      and source.status = 'active'
      and source.provider_status <> 'syncing'
      and coalesce(source.next_sync_at, now()) <= now()
    order by source.next_sync_at nulls first, source.created_at
    for update skip locked
    limit 1
  ), claimed_source as (
    update public.dynamic_data_sources source set
      provider_status = 'syncing',
      last_attempt_at = now(),
      sync_locked_at = now(),
      sync_locked_by = left(p_worker_id, 120)
    from candidate
    where source.id = candidate.id
    returning source.*
  ), created_run as (
    insert into public.dynamic_sync_runs(
      tenant_id, data_source_id, status
    )
    select source.tenant_id, source.id, 'running'
    from claimed_source source
    returning *
  )
  select
    run.id,
    run.tenant_id,
    run.data_source_id,
    source.config_json ->> 'url'
  from created_run run
  join claimed_source source on source.id = run.data_source_id;
end;
$$;

create or replace function public.complete_scheduled_rss_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_articles jsonb
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  run_record public.dynamic_sync_runs%rowtype;
  source_record public.dynamic_data_sources%rowtype;
  article jsonb;
  imported_count integer := 0;
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  revision_hash text;
  new_snapshot_id uuid;
begin
  select * into run_record from public.dynamic_sync_runs
  where id = p_run_id and status = 'running' for update;
  if not found then
    raise exception 'RSS sync run not found' using errcode = 'P0002';
  end if;
  select * into source_record from public.dynamic_data_sources
  where id = run_record.data_source_id
    and provider_status = 'syncing'
    and sync_locked_by = left(p_worker_id, 120)
  for update;
  if not found then
    raise exception 'RSS sync lease lost' using errcode = '55000';
  end if;
  if jsonb_typeof(p_articles) <> 'array'
    or jsonb_array_length(p_articles) > 50
  then
    raise exception 'invalid RSS payload' using errcode = '22023';
  end if;
  for article in select value from jsonb_array_elements(p_articles)
  loop
    if length(btrim(article ->> 'title')) not between 1 and 160
      or length(coalesce(article ->> 'externalId', '')) not between 1 and 512
      or coalesce(article ->> 'link', '') !~ '^https?://'
    then
      raise exception 'invalid normalized RSS article' using errcode = '22023';
    end if;
    insert into public.dynamic_news_articles(
      tenant_id, data_source_id, external_id, title, intro, author,
      source_name, link, published_at, content_hash, raw_reference
    ) values (
      source_record.tenant_id, source_record.id, article ->> 'externalId',
      btrim(article ->> 'title'), nullif(left(article ->> 'intro', 4000), ''),
      nullif(left(article ->> 'author', 160), ''),
      left(article ->> 'sourceName', 160), article ->> 'link',
      nullif(article ->> 'publishedAt', '')::timestamptz,
      encode(extensions.digest(
        pg_catalog.convert_to(article::text, 'UTF8'), 'sha256'
      ), 'hex'),
      jsonb_build_object('syncRunId', run_record.id, 'scheduled', true)
    )
    on conflict (tenant_id, data_source_id, external_id) do update set
      title = excluded.title,
      intro = excluded.intro,
      author = excluded.author,
      source_name = excluded.source_name,
      link = excluded.link,
      published_at = excluded.published_at,
      content_hash = excluded.content_hash,
      raw_reference = excluded.raw_reference;
    imported_count := imported_count + 1;
  end loop;
  update public.dynamic_sync_runs set
    status = 'succeeded', item_count = imported_count, finished_at = now()
  where id = run_record.id;
  update public.dynamic_data_sources set
    provider_status = 'ready',
    last_successful_sync_at = now(),
    last_error_code = null,
    last_error_detail = null,
    next_sync_at = now() + make_interval(
      mins => least(greatest(
        coalesce((config_json ->> 'refreshMinutes')::integer, 15), 5
      ), 1440)
    ),
    sync_locked_at = null,
    sync_locked_by = null,
    revision = revision + 1
  where id = source_record.id;
  for slide_record in
    select * from public.dynamic_slides slide
    where slide.tenant_id = source_record.tenant_id
      and slide.data_source_id = source_record.id
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
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
      update public.dynamic_slides set status = 'rendering'
      where id = slide_record.id;
    end if;
  end loop;
  insert into public.audit_events(
    tenant_id, action, target_type, target_id, result, metadata
  ) values (
    source_record.tenant_id, 'dynamic.data_source.scheduled_sync',
    'dynamic_data_sources', source_record.id, 'success',
    jsonb_build_object(
      'systemExecuted', true,
      'syncRunId', run_record.id,
      'itemCount', imported_count
    )
  );
  return imported_count;
end;
$$;

create or replace function public.fail_scheduled_rss_sync_v1(
  p_run_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_detail text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  run_record public.dynamic_sync_runs%rowtype;
  source_record public.dynamic_data_sources%rowtype;
begin
  select * into run_record from public.dynamic_sync_runs
  where id = p_run_id and status = 'running' for update;
  if not found then
    raise exception 'RSS sync run not found' using errcode = 'P0002';
  end if;
  select * into source_record from public.dynamic_data_sources
  where id = run_record.data_source_id
    and provider_status = 'syncing'
    and sync_locked_by = left(p_worker_id, 120)
  for update;
  if not found then
    raise exception 'RSS sync lease lost' using errcode = '55000';
  end if;
  update public.dynamic_sync_runs set
    status = 'failed',
    error_code = left(p_error_code, 80),
    error_detail = left(p_error_detail, 500),
    finished_at = now()
  where id = run_record.id;
  update public.dynamic_data_sources set
    provider_status = 'error',
    last_error_code = left(p_error_code, 80),
    last_error_detail = left(p_error_detail, 500),
    next_sync_at = now() + interval '15 minutes',
    sync_locked_at = null,
    sync_locked_by = null
  where id = source_record.id;
  insert into public.audit_events(
    tenant_id, action, target_type, target_id, result, metadata
  ) values (
    source_record.tenant_id, 'dynamic.data_source.scheduled_sync_failed',
    'dynamic_data_sources', source_record.id, 'failed',
    jsonb_build_object(
      'systemExecuted', true,
      'syncRunId', run_record.id,
      'errorCode', left(p_error_code, 80)
    )
  );
end;
$$;

revoke all on function public.claim_due_rss_sync_v1(text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_scheduled_rss_sync_v1(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_scheduled_rss_sync_v1(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_due_rss_sync_v1(text, integer)
  to service_role;
grant execute on function public.complete_scheduled_rss_sync_v1(
  uuid, text, jsonb
) to service_role;
grant execute on function public.fail_scheduled_rss_sync_v1(
  uuid, text, text, text
) to service_role;
