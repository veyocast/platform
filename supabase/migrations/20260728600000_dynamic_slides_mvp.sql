-- S51: fixed dynamic slides, safe provider snapshots and immutable render outputs.

alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write', 'tenant.product.write',
      'tenant.playlist.write', 'tenant.playlist.publish',
      'tenant.screen.manage', 'tenant.settings.manage', 'tenant.audit.read',
      'tenant.support.export', 'tenant.ticket.write',
      'tenant.studio.read', 'tenant.studio.create', 'tenant.studio.edit_own',
      'tenant.studio.edit_all', 'tenant.studio.archive',
      'tenant.studio.template.manage', 'tenant.studio.motion.edit',
      'tenant.studio.render', 'tenant.studio.job.manage',
      'tenant.dynamic_slide.read', 'tenant.dynamic_slide.write',
      'tenant.data_source.read', 'tenant.data_source.manage'
    ]::text[]
    and (
      ('tenant.media.write' = any(capabilities))
      = ('tenant.playlist.write' = any(capabilities))
    )
  );

alter function private.builtin_tenant_capabilities(public.tenant_role)
  rename to builtin_tenant_capabilities_before_dynamic_slides;
create function private.builtin_tenant_capabilities(p_role public.tenant_role)
returns text[]
language sql immutable set search_path = ''
as $$
  select private.builtin_tenant_capabilities_before_dynamic_slides(p_role)
    || case
      when p_role in (
        'tenant_owner'::public.tenant_role,
        'tenant_admin'::public.tenant_role
      ) then array[
        'tenant.dynamic_slide.read', 'tenant.dynamic_slide.write',
        'tenant.data_source.read', 'tenant.data_source.manage'
      ]::text[]
      when p_role = 'tenant_editor'::public.tenant_role then array[
        'tenant.dynamic_slide.read', 'tenant.dynamic_slide.write',
        'tenant.data_source.read'
      ]::text[]
      else array[
        'tenant.dynamic_slide.read', 'tenant.data_source.read'
      ]::text[]
    end;
$$;

alter function private.tenant_baseline_capabilities()
  rename to tenant_baseline_capabilities_before_dynamic_slides;
create function private.tenant_baseline_capabilities()
returns text[]
language sql immutable set search_path = ''
as $$
  select private.tenant_baseline_capabilities_before_dynamic_slides()
    || array['tenant.dynamic_slide.read', 'tenant.data_source.read']::text[];
$$;

alter function private.normalize_custom_role_capabilities(text[])
  rename to normalize_custom_role_capabilities_before_dynamic_slides;
create function private.normalize_custom_role_capabilities(p_capabilities text[])
returns text[]
language sql immutable set search_path = ''
as $$
  select private.normalize_custom_role_capabilities_before_dynamic_slides(
    coalesce(p_capabilities, '{}'::text[])
  ) || array(
    select capability
    from unnest(coalesce(p_capabilities, '{}'::text[])) capability
    where capability in (
      'tenant.dynamic_slide.write',
      'tenant.data_source.manage'
    )
    order by capability
  );
$$;

create table public.dynamic_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  description text not null default '' check (length(description) <= 500),
  category text not null check (category in ('menu', 'news')),
  slide_type text not null check (slide_type in ('menu', 'news')),
  orientation text not null check (orientation in ('landscape', 'portrait')),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'withdrawn', 'archived')
  ),
  current_published_version_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, slide_type, orientation)
);
create trigger dynamic_templates_set_updated_at
before update on public.dynamic_templates
for each row execute function private.set_updated_at();

create table public.dynamic_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.dynamic_templates(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'withdrawn', 'archived')
  ),
  markup text not null check (length(markup) between 1 and 100000),
  css text not null default '' check (length(css) <= 50000),
  manifest_json jsonb not null check (jsonb_typeof(manifest_json) = 'object'),
  sample_data_json jsonb not null check (jsonb_typeof(sample_data_json) = 'object'),
  source_checksum_sha256 text not null check (
    source_checksum_sha256 ~ '^[a-f0-9]{64}$'
  ),
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id, version),
  unique (template_id, id),
  check (
    (status = 'published' and published_at is not null)
    or (status <> 'published')
  )
);
alter table public.dynamic_templates
  add constraint dynamic_templates_published_version_fkey
  foreign key (id, current_published_version_id)
  references public.dynamic_template_versions(template_id, id)
  on delete restrict;
create unique index dynamic_template_one_draft_idx
  on public.dynamic_template_versions(template_id)
  where status = 'draft';
create index dynamic_template_versions_template_idx
  on public.dynamic_template_versions(template_id, version desc);

create table public.dynamic_data_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  kind text not null check (kind in ('manual_products', 'twelve_excel', 'rss')),
  status text not null default 'active' check (
    status in ('active', 'paused', 'error', 'archived')
  ),
  provider_status text not null default 'ready' check (
    provider_status in ('ready', 'not_connected', 'syncing', 'error')
  ),
  config_json jsonb not null default '{}'::jsonb check (
    jsonb_typeof(config_json) = 'object'
    and not (config_json ?| array[
      'password', 'secret', 'token', 'apiKey', 'api_key', 'clientSecret'
    ])
  ),
  secret_reference text check (
    secret_reference is null
    or secret_reference ~ '^[a-zA-Z0-9/_:.-]{3,240}$'
  ),
  last_successful_sync_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_]{3,80}$'
  ),
  last_error_detail text check (
    last_error_detail is null or length(last_error_detail) <= 500
  ),
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, name)
);
create index dynamic_data_sources_tenant_idx
  on public.dynamic_data_sources(tenant_id, status, updated_at desc);
create trigger dynamic_data_sources_set_updated_at
before update on public.dynamic_data_sources
for each row execute function private.set_updated_at();

alter table public.tenant_products
  add column data_source_id uuid,
  add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column available boolean not null default true,
  add column image_media_asset_id uuid,
  add column sort_order integer not null default 100 check (
    sort_order between 0 and 100000
  ),
  add column source_updated_at timestamptz,
  add column last_synced_at timestamptz,
  add constraint tenant_products_data_source_fkey
    foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  add constraint tenant_products_image_asset_fkey
    foreign key (tenant_id, image_media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict;
create unique index tenant_products_source_external_id_uq
  on public.tenant_products(tenant_id, data_source_id, source_external_id)
  where data_source_id is not null and source_external_id is not null;

create table public.dynamic_news_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  data_source_id uuid not null,
  external_id text not null check (length(external_id) between 1 and 512),
  title text not null check (length(btrim(title)) between 1 and 160),
  intro text check (intro is null or length(intro) <= 4000),
  author text check (author is null or length(author) <= 160),
  source_name text not null check (length(btrim(source_name)) between 1 and 160),
  link text not null check (
    length(link) <= 2048 and link ~ '^https?://'
  ),
  hero_media_asset_id uuid,
  published_at timestamptz,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  raw_reference jsonb not null default '{}'::jsonb check (
    jsonb_typeof(raw_reference) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete cascade,
  foreign key (tenant_id, hero_media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict,
  unique (tenant_id, data_source_id, external_id),
  unique (tenant_id, id)
);
create index dynamic_news_articles_source_idx
  on public.dynamic_news_articles(
    tenant_id, data_source_id, published_at desc nulls last
  );
create trigger dynamic_news_articles_set_updated_at
before update on public.dynamic_news_articles
for each row execute function private.set_updated_at();

create table public.dynamic_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  data_source_id uuid not null,
  status text not null check (
    status in ('running', 'succeeded', 'failed')
  ),
  item_count integer not null default 0 check (item_count >= 0),
  error_code text,
  error_detail text check (
    error_detail is null or length(error_detail) <= 500
  ),
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete cascade
);
create index dynamic_sync_runs_source_idx
  on public.dynamic_sync_runs(tenant_id, data_source_id, started_at desc);

create table public.dynamic_slides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  slide_type text not null check (slide_type in ('menu', 'news')),
  orientation text not null check (orientation in ('landscape', 'portrait')),
  template_id uuid not null,
  template_version_id uuid not null,
  data_source_id uuid not null,
  selection_mode text not null default 'latest' check (
    selection_mode in ('latest', 'pinned')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'rendering', 'ready', 'error', 'archived')
  ),
  configuration_json jsonb not null default '{}'::jsonb check (
    jsonb_typeof(configuration_json) = 'object'
  ),
  current_snapshot_id uuid,
  last_error_code text,
  revision bigint not null default 0 check (revision >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (template_id, template_version_id)
    references public.dynamic_template_versions(template_id, id) on delete restrict,
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  unique (tenant_id, id)
);
create index dynamic_slides_tenant_idx
  on public.dynamic_slides(tenant_id, status, updated_at desc);
create trigger dynamic_slides_set_updated_at
before update on public.dynamic_slides
for each row execute function private.set_updated_at();

create table public.dynamic_slide_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dynamic_slide_id uuid not null,
  template_version_id uuid not null references public.dynamic_template_versions(id)
    on delete restrict,
  data_source_id uuid not null,
  source_revision_hash text not null check (
    source_revision_hash ~ '^[a-f0-9]{64}$'
  ),
  snapshot_data_json jsonb not null check (
    jsonb_typeof(snapshot_data_json) = 'object'
  ),
  status text not null default 'queued' check (
    status in ('queued', 'rendering', 'ready', 'failed')
  ),
  output_media_asset_id uuid,
  error_code text,
  error_detail text check (
    error_detail is null or length(error_detail) <= 500
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (tenant_id, dynamic_slide_id)
    references public.dynamic_slides(tenant_id, id) on delete restrict,
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  foreign key (tenant_id, output_media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (dynamic_slide_id, source_revision_hash, template_version_id)
);
alter table public.dynamic_slides
  add constraint dynamic_slides_current_snapshot_fkey
  foreign key (tenant_id, current_snapshot_id)
  references public.dynamic_slide_snapshots(tenant_id, id) on delete restrict;
create index dynamic_slide_snapshots_slide_idx
  on public.dynamic_slide_snapshots(
    tenant_id, dynamic_slide_id, created_at desc
  );

create table public.dynamic_render_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  snapshot_id uuid not null,
  output_media_asset_id uuid not null default gen_random_uuid(),
  status text not null default 'queued' check (
    status in ('queued', 'rendering', 'completed', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_detail text check (
    error_detail is null or length(error_detail) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, snapshot_id)
    references public.dynamic_slide_snapshots(tenant_id, id) on delete cascade,
  unique (tenant_id, id),
  unique (snapshot_id)
);
create index dynamic_render_jobs_queue_idx
  on public.dynamic_render_jobs(status, created_at)
  where status in ('queued', 'rendering');
create trigger dynamic_render_jobs_set_updated_at
before update on public.dynamic_render_jobs
for each row execute function private.set_updated_at();

alter table public.playlist_items
  add column dynamic_slide_id uuid,
  add column dynamic_snapshot_id uuid,
  add column dynamic_selection_mode text check (
    dynamic_selection_mode is null
    or dynamic_selection_mode in ('latest', 'pinned')
  ),
  add constraint playlist_items_dynamic_slide_fkey
    foreign key (tenant_id, dynamic_slide_id)
    references public.dynamic_slides(tenant_id, id) on delete restrict,
  add constraint playlist_items_dynamic_snapshot_fkey
    foreign key (tenant_id, dynamic_snapshot_id)
    references public.dynamic_slide_snapshots(tenant_id, id) on delete restrict,
  add constraint playlist_items_dynamic_consistency_check check (
    (
      dynamic_slide_id is null
      and dynamic_snapshot_id is null
      and dynamic_selection_mode is null
    )
    or (
      dynamic_slide_id is not null
      and dynamic_snapshot_id is not null
      and dynamic_selection_mode is not null
    )
  );
create index playlist_items_dynamic_slide_idx
  on public.playlist_items(tenant_id, dynamic_slide_id)
  where dynamic_slide_id is not null;

alter table public.playlist_release_items
  add column dynamic_snapshot_id uuid,
  add constraint playlist_release_items_dynamic_snapshot_fkey
    foreign key (tenant_id, dynamic_snapshot_id)
    references public.dynamic_slide_snapshots(tenant_id, id) on delete restrict;

create or replace function private.materialize_dynamic_release_provenance()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.source_item_id is not null then
    select item.dynamic_snapshot_id into new.dynamic_snapshot_id
    from public.playlist_items item
    where item.tenant_id = new.tenant_id
      and item.id = new.source_item_id;
  end if;
  return new;
end;
$$;
create trigger playlist_release_items_dynamic_provenance
before insert on public.playlist_release_items
for each row execute function private.materialize_dynamic_release_provenance();

create or replace function private.reject_dynamic_immutable_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'dynamic snapshot records are immutable'
    using errcode = '55000';
end;
$$;
create trigger dynamic_template_versions_reject_delete
before delete on public.dynamic_template_versions
for each row execute function private.reject_dynamic_immutable_mutation();
create trigger dynamic_snapshots_reject_update
before update on public.dynamic_slide_snapshots
for each row when (
  old.status = 'ready' or old.status = 'failed'
)
execute function private.reject_dynamic_immutable_mutation();
create trigger dynamic_snapshots_reject_delete
before delete on public.dynamic_slide_snapshots
for each row execute function private.reject_dynamic_immutable_mutation();

alter table public.dynamic_templates enable row level security;
alter table public.dynamic_template_versions enable row level security;
alter table public.dynamic_data_sources enable row level security;
alter table public.dynamic_news_articles enable row level security;
alter table public.dynamic_sync_runs enable row level security;
alter table public.dynamic_slides enable row level security;
alter table public.dynamic_slide_snapshots enable row level security;
alter table public.dynamic_render_jobs enable row level security;
alter table public.dynamic_templates force row level security;
alter table public.dynamic_template_versions force row level security;
alter table public.dynamic_data_sources force row level security;
alter table public.dynamic_news_articles force row level security;
alter table public.dynamic_sync_runs force row level security;
alter table public.dynamic_slides force row level security;
alter table public.dynamic_slide_snapshots force row level security;
alter table public.dynamic_render_jobs force row level security;

create policy dynamic_templates_platform_read
on public.dynamic_templates for select to authenticated
using (
  status = 'published'
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support', 'platform_viewer'
  ]::public.platform_role[])
);
create policy dynamic_template_versions_platform_read
on public.dynamic_template_versions for select to authenticated
using (
  status = 'published'
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support', 'platform_viewer'
  ]::public.platform_role[])
);
create policy dynamic_templates_platform_write
on public.dynamic_templates for all to authenticated
using (private.is_platform_member(array[
  'platform_owner', 'platform_admin'
]::public.platform_role[]))
with check (private.is_platform_member(array[
  'platform_owner', 'platform_admin'
]::public.platform_role[]));
create policy dynamic_template_versions_platform_write
on public.dynamic_template_versions for all to authenticated
using (private.is_platform_member(array[
  'platform_owner', 'platform_admin'
]::public.platform_role[]))
with check (private.is_platform_member(array[
  'platform_owner', 'platform_admin'
]::public.platform_role[]));

create policy dynamic_data_sources_tenant_read
on public.dynamic_data_sources for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.data_source.read'));
create policy dynamic_news_articles_tenant_read
on public.dynamic_news_articles for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.data_source.read'));
create policy dynamic_sync_runs_tenant_read
on public.dynamic_sync_runs for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.data_source.read'));
create policy dynamic_slides_tenant_read
on public.dynamic_slides for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read'));
create policy dynamic_snapshots_tenant_read
on public.dynamic_slide_snapshots for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read'));
create policy dynamic_render_jobs_tenant_read
on public.dynamic_render_jobs for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read'));

create or replace function public.create_dynamic_data_source_v1(
  p_tenant_id uuid,
  p_name text,
  p_kind text,
  p_config_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_id uuid;
  provider_state text;
begin
  if actor_id is null
    or not private.has_tenant_capability(
      p_tenant_id, 'tenant.data_source.manage'
    )
  then
    raise exception 'actor cannot create data sources' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_kind not in ('manual_products', 'twelve_excel', 'rss')
    or length(btrim(p_name)) not between 2 and 120
    or jsonb_typeof(coalesce(p_config_json, '{}'::jsonb)) <> 'object'
    or coalesce(p_config_json, '{}'::jsonb) ?| array[
      'password', 'secret', 'token', 'apiKey', 'api_key', 'clientSecret'
    ]
  then
    raise exception 'invalid data source' using errcode = '22023';
  end if;
  if p_kind = 'rss' and (
    p_config_json ->> 'url' is null
    or p_config_json ->> 'url' !~ '^https?://'
  ) then
    raise exception 'RSS source requires an HTTP(S) URL' using errcode = '22023';
  end if;
  provider_state := case
    when p_kind = 'twelve_excel' then 'not_connected'
    else 'ready'
  end;
  insert into public.dynamic_data_sources (
    tenant_id, name, kind, provider_status, config_json, created_by, updated_by
  ) values (
    p_tenant_id, btrim(p_name), p_kind, provider_state,
    coalesce(p_config_json, '{}'::jsonb), actor_id, actor_id
  ) returning id into source_id;
  perform private.audit_event(
    p_tenant_id, 'dynamic.data_source.created',
    'dynamic_data_sources', source_id, 'success',
    jsonb_build_object('kind', p_kind, 'providerStatus', provider_state)
  );
  return source_id;
end;
$$;

create or replace function public.record_rss_sync_v1(
  p_data_source_id uuid,
  p_articles jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_record public.dynamic_data_sources%rowtype;
  run_id uuid;
  imported_count integer := 0;
  article jsonb;
begin
  select * into source_record from public.dynamic_data_sources
  where id = p_data_source_id and kind = 'rss' and status <> 'archived';
  if not found then
    raise exception 'RSS source not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    source_record.tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'actor cannot sync data source' using errcode = '42501';
  end if;
  if jsonb_typeof(p_articles) <> 'array'
    or jsonb_array_length(p_articles) > 50
  then
    raise exception 'invalid RSS article payload' using errcode = '22023';
  end if;
  insert into public.dynamic_sync_runs(
    tenant_id, data_source_id, status, started_by
  ) values (
    source_record.tenant_id, source_record.id, 'running', actor_id
  ) returning id into run_id;
  for article in select value from jsonb_array_elements(p_articles)
  loop
    if length(btrim(article ->> 'title')) not between 1 and 160
      or length(coalesce(article ->> 'externalId', '')) not between 1 and 512
      or coalesce(article ->> 'link', '') !~ '^https?://'
      or length(coalesce(article ->> 'link', '')) > 2048
    then
      raise exception 'invalid normalized RSS article' using errcode = '22023';
    end if;
    insert into public.dynamic_news_articles (
      tenant_id, data_source_id, external_id, title, intro, author,
      source_name, link, published_at, content_hash, raw_reference
    ) values (
      source_record.tenant_id,
      source_record.id,
      article ->> 'externalId',
      btrim(article ->> 'title'),
      nullif(left(article ->> 'intro', 4000), ''),
      nullif(left(article ->> 'author', 160), ''),
      left(article ->> 'sourceName', 160),
      article ->> 'link',
      nullif(article ->> 'publishedAt', '')::timestamptz,
      encode(extensions.digest(
        pg_catalog.convert_to(article::text, 'UTF8'), 'sha256'
      ), 'hex'),
      jsonb_build_object('syncRunId', run_id)
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
  update public.dynamic_sync_runs
  set status = 'succeeded', item_count = imported_count, finished_at = now()
  where id = run_id;
  update public.dynamic_data_sources
  set
    provider_status = 'ready',
    status = 'active',
    last_attempt_at = now(),
    last_successful_sync_at = now(),
    last_error_code = null,
    last_error_detail = null,
    revision = revision + 1,
    updated_by = actor_id
  where id = source_record.id;
  perform private.audit_event(
    source_record.tenant_id, 'dynamic.data_source.synced',
    'dynamic_data_sources', source_record.id, 'success',
    jsonb_build_object('syncRunId', run_id, 'itemCount', imported_count)
  );
  return jsonb_build_object(
    'runId', run_id, 'itemCount', imported_count, 'status', 'succeeded'
  );
end;
$$;

create or replace function public.record_data_source_failure_v1(
  p_data_source_id uuid,
  p_error_code text,
  p_error_detail text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  source_record public.dynamic_data_sources%rowtype;
  run_id uuid;
begin
  select * into source_record from public.dynamic_data_sources
  where id = p_data_source_id;
  if not found then
    raise exception 'data source not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    source_record.tenant_id, 'tenant.data_source.manage'
  ) then
    raise exception 'actor cannot update data source' using errcode = '42501';
  end if;
  insert into public.dynamic_sync_runs(
    tenant_id, data_source_id, status, error_code, error_detail,
    started_by, finished_at
  ) values (
    source_record.tenant_id, source_record.id, 'failed',
    left(p_error_code, 80), left(p_error_detail, 500), actor_id, now()
  ) returning id into run_id;
  update public.dynamic_data_sources set
    provider_status = 'error',
    last_attempt_at = now(),
    last_error_code = left(p_error_code, 80),
    last_error_detail = left(p_error_detail, 500),
    updated_by = actor_id
  where id = source_record.id;
  perform private.audit_event(
    source_record.tenant_id, 'dynamic.data_source.sync_failed',
    'dynamic_data_sources', source_record.id, 'failed',
    jsonb_build_object('syncRunId', run_id, 'errorCode', p_error_code)
  );
end;
$$;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
  max_items integer := least(
    greatest(coalesce((p_slide.configuration_json ->> 'maxItems')::integer, 12), 1),
    40
  );
begin
  if p_slide.slide_type = 'menu' then
    select jsonb_build_object(
      'type', 'menu',
      'menu', jsonb_build_object(
        'title', coalesce(
          nullif(p_slide.configuration_json ->> 'title', ''), p_slide.name
        ),
        'generatedAt', now(),
        'products', coalesce(jsonb_agg(jsonb_build_object(
          'id', product.id,
          'externalId', coalesce(product.source_external_id, product.slug),
          'name', product.name,
          'description', product.description,
          'category', product.category,
          'priceMinor', product.price_cents,
          'currency', product.currency,
          'active', product.active,
          'available', product.available,
          'imageMediaAssetId', product.image_media_asset_id,
          'sortOrder', product.sort_order,
          'sourceUpdatedAt', product.source_updated_at
        ) order by product.sort_order, product.name), '[]'::jsonb)
      )
    ) into result
    from (
      select *
      from public.tenant_products product
      where product.tenant_id = p_slide.tenant_id
        and product.active
        and product.available
        and (
          product.data_source_id = p_slide.data_source_id
          or (
            product.data_source_id is null
            and exists (
              select 1 from public.dynamic_data_sources source
              where source.id = p_slide.data_source_id
                and source.kind in ('manual_products', 'twelve_excel')
            )
          )
        )
        and (
          p_slide.configuration_json ->> 'category' is null
          or product.category = p_slide.configuration_json ->> 'category'
        )
      order by product.sort_order, product.name
      limit max_items
    ) product;
  else
    select jsonb_build_object(
      'type', 'news',
      'news', jsonb_build_object(
        'sourceName', coalesce(
          max(article.source_name),
          (select source.name from public.dynamic_data_sources source
            where source.id = p_slide.data_source_id)
        ),
        'generatedAt', now(),
        'articles', coalesce(jsonb_agg(jsonb_build_object(
          'externalId', article.external_id,
          'title', article.title,
          'intro', article.intro,
          'author', article.author,
          'sourceName', article.source_name,
          'link', article.link,
          'publishedAt', article.published_at,
          'heroMediaAssetId', article.hero_media_asset_id
        ) order by article.published_at desc nulls last, article.created_at desc),
        '[]'::jsonb)
      )
    ) into result
    from (
      select *
      from public.dynamic_news_articles news_article
      where news_article.tenant_id = p_slide.tenant_id
        and news_article.data_source_id = p_slide.data_source_id
      order by news_article.published_at desc nulls last,
        news_article.created_at desc
      limit max_items
    ) article;
  end if;
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'brand',
    coalesce((
      select jsonb_build_object(
        'primaryColor', brand.primary_color,
        'secondaryColor', brand.secondary_color
      )
      from public.studio_tenant_brand_kits brand
      where brand.tenant_id = p_slide.tenant_id
    ), jsonb_build_object(
      'primaryColor', '#ff5a1f',
      'secondaryColor', '#111111'
    ))
  );
end;
$$;

-- Forward declaration; replaced below after create_dynamic_slide_v1 is defined.
create or replace function public.refresh_dynamic_slide_v1(p_slide_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'dynamic slide refresh is not initialized'
    using errcode = '55000';
end;
$$;

create or replace function public.create_dynamic_slide_v1(
  p_tenant_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_selection_mode text default 'latest',
  p_configuration_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record record;
  source_record public.dynamic_data_sources%rowtype;
  slide_id uuid;
  snapshot_result jsonb;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create dynamic slides' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select
    template.id template_id, template.slide_type, template.orientation
  into template_record
  from public.dynamic_template_versions version
  join public.dynamic_templates template on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published';
  if not found then
    raise exception 'published dynamic template not found' using errcode = 'P0002';
  end if;
  select * into source_record from public.dynamic_data_sources
  where id = p_data_source_id and tenant_id = p_tenant_id
    and status <> 'archived';
  if not found or (
    template_record.slide_type = 'menu'
    and source_record.kind not in ('manual_products', 'twelve_excel')
  ) or (
    template_record.slide_type = 'news'
    and source_record.kind <> 'rss'
  ) then
    raise exception 'data source does not match template' using errcode = '23514';
  end if;
  if length(btrim(p_name)) not between 2 and 120
    or p_selection_mode not in ('latest', 'pinned')
    or jsonb_typeof(coalesce(p_configuration_json, '{}'::jsonb)) <> 'object'
  then
    raise exception 'invalid dynamic slide' using errcode = '22023';
  end if;
  insert into public.dynamic_slides (
    tenant_id, name, slide_type, orientation, template_id,
    template_version_id, data_source_id, selection_mode,
    configuration_json, created_by, updated_by
  ) values (
    p_tenant_id, btrim(p_name), template_record.slide_type,
    template_record.orientation, template_record.template_id,
    p_template_version_id, p_data_source_id, p_selection_mode,
    coalesce(p_configuration_json, '{}'::jsonb), actor_id, actor_id
  ) returning id into slide_id;
  snapshot_result := public.refresh_dynamic_slide_v1(slide_id);
  perform private.audit_event(
    p_tenant_id, 'dynamic.slide.created', 'dynamic_slides',
    slide_id, 'success',
    jsonb_build_object(
      'templateVersionId', p_template_version_id,
      'dataSourceId', p_data_source_id
    )
  );
  return snapshot_result || jsonb_build_object('slideId', slide_id);
end;
$$;

create or replace function public.refresh_dynamic_slide_v1(
  p_slide_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  revision_hash text;
  snapshot_id uuid;
  job_id uuid;
begin
  select * into slide_record from public.dynamic_slides
  where id = p_slide_id and status <> 'archived';
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide_record.tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot refresh dynamic slide' using errcode = '42501';
  end if;
  snapshot_data := private.build_dynamic_snapshot_data(slide_record);
  if snapshot_data = '{}'::jsonb
    or (
      slide_record.slide_type = 'menu'
      and jsonb_array_length(snapshot_data #> '{menu,products}') = 0
    )
    or (
      slide_record.slide_type = 'news'
      and jsonb_array_length(snapshot_data #> '{news,articles}') = 0
    )
  then
    raise exception 'data source has no renderable content' using errcode = '23514';
  end if;
  revision_hash := encode(extensions.digest(
    pg_catalog.convert_to(
      jsonb_build_object(
        'templateVersionId', slide_record.template_version_id,
        'configuration', slide_record.configuration_json,
        'data', snapshot_data
      )::text,
      'UTF8'
    ), 'sha256'
  ), 'hex');
  select snapshot.id into snapshot_id
  from public.dynamic_slide_snapshots snapshot
  where snapshot.dynamic_slide_id = slide_record.id
    and snapshot.template_version_id = slide_record.template_version_id
    and snapshot.source_revision_hash = revision_hash;
  if snapshot_id is null then
    insert into public.dynamic_slide_snapshots (
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json, created_by
    ) values (
      slide_record.tenant_id, slide_record.id,
      slide_record.template_version_id, slide_record.data_source_id,
      revision_hash, snapshot_data, actor_id
    ) returning id into snapshot_id;
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    values (slide_record.tenant_id, snapshot_id)
    returning id into job_id;
    update public.dynamic_slides set
      status = 'rendering', last_error_code = null,
      revision = revision + 1, updated_by = actor_id
    where id = slide_record.id;
    perform private.audit_event(
      slide_record.tenant_id, 'dynamic.snapshot.created',
      'dynamic_slide_snapshots', snapshot_id, 'success',
      jsonb_build_object('slideId', slide_record.id, 'jobId', job_id)
    );
  else
    select job.id into job_id
    from public.dynamic_render_jobs job where job.snapshot_id = snapshot_id;
  end if;
  return jsonb_build_object(
    'slideId', slide_record.id,
    'snapshotId', snapshot_id,
    'jobId', job_id,
    'status', 'rendering'
  );
end;
$$;

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
begin
  select * into playlist_record from public.playlists where id = p_playlist_id;
  select * into slide_record from public.dynamic_slides
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
  select * into snapshot_record from public.dynamic_slide_snapshots
  where id = slide_record.current_snapshot_id and status = 'ready';
  if not found or snapshot_record.output_media_asset_id is null then
    raise exception 'dynamic slide has no ready snapshot' using errcode = '23514';
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
    least(greatest(p_duration_seconds, 5), 3600), 'contain', true, actor_id,
    slide_record.id, snapshot_record.id, slide_record.selection_mode
  ) returning id into item_id;
  perform private.audit_event(
    playlist_record.tenant_id, 'dynamic.slide.added_to_playlist',
    'playlist_items', item_id, 'success',
    jsonb_build_object(
      'playlistId', playlist_record.id,
      'slideId', slide_record.id,
      'snapshotId', snapshot_record.id
    )
  );
  return item_id;
end;
$$;

create or replace function public.claim_dynamic_render_job_v1(
  p_worker_id text,
  p_lock_timeout_seconds integer default 120,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  tenant_id uuid,
  snapshot_id uuid,
  output_media_asset_id uuid,
  slide_name text,
  orientation text,
  markup text,
  css text,
  manifest_json jsonb,
  snapshot_data_json jsonb
)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.dynamic_render_jobs job set
    status = 'queued', locked_at = null, locked_by = null
  where job.status = 'rendering'
    and job.locked_at < now() - make_interval(
      secs => least(greatest(p_lock_timeout_seconds, 30), 600)
    )
    and job.attempt_count < least(greatest(p_max_attempts, 1), 5);
  return query
  with candidate as (
    select job.id from public.dynamic_render_jobs job
    where job.status = 'queued'
      and job.attempt_count < least(greatest(p_max_attempts, 1), job.max_attempts)
    order by job.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.dynamic_render_jobs job set
      status = 'rendering',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      locked_by = left(p_worker_id, 120),
      started_at = coalesce(started_at, now()),
      error_code = null,
      error_detail = null
    from candidate where job.id = candidate.id returning job.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    snapshot.id,
    claimed.output_media_asset_id,
    slide.name,
    slide.orientation,
    version.markup,
    version.css,
    version.manifest_json,
    snapshot.snapshot_data_json
  from claimed
  join public.dynamic_slide_snapshots snapshot
    on snapshot.id = claimed.snapshot_id
  join public.dynamic_slides slide on slide.id = snapshot.dynamic_slide_id
  join public.dynamic_template_versions version
    on version.id = snapshot.template_version_id;
  update public.dynamic_slide_snapshots snapshot set status = 'rendering'
  where snapshot.id in (
    select job.snapshot_id from public.dynamic_render_jobs job
    where job.status = 'rendering' and job.locked_by = left(p_worker_id, 120)
  ) and snapshot.status = 'queued';
end;
$$;

create or replace function public.complete_dynamic_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  job_record public.dynamic_render_jobs%rowtype;
  snapshot_record public.dynamic_slide_snapshots%rowtype;
  slide_record public.dynamic_slides%rowtype;
  expected_path text;
begin
  select * into job_record from public.dynamic_render_jobs
  where id = p_job_id and status = 'rendering'
    and locked_by = left(p_worker_id, 120) for update;
  if not found then
    raise exception 'dynamic render lease lost' using errcode = '55000';
  end if;
  select * into snapshot_record from public.dynamic_slide_snapshots
  where id = job_record.snapshot_id;
  select * into slide_record from public.dynamic_slides
  where id = snapshot_record.dynamic_slide_id;
  expected_path := 'tenants/' || job_record.tenant_id::text || '/assets/'
    || job_record.output_media_asset_id::text || '/dynamic-slide.png';
  if p_storage_path <> expected_path
    or p_file_size_bytes not between 1 and 524288000
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_width not between 360 and 7680
    or p_height not between 360 and 4320
  then
    raise exception 'invalid dynamic render artifact' using errcode = '22023';
  end if;
  insert into public.media_assets(
    id, tenant_id, created_by, kind, title, original_file_name,
    mime_type, status, storage_bucket, storage_path, file_size_bytes,
    checksum_sha256, width, height, processed_at
  ) values (
    job_record.output_media_asset_id, job_record.tenant_id,
    snapshot_record.created_by, 'image', slide_record.name,
    'dynamic-slide.png', 'image/png', 'ready', 'tenant-media',
    p_storage_path, p_file_size_bytes, p_checksum_sha256,
    p_width, p_height, now()
  );
  insert into public.media_variants(
    tenant_id, asset_id, variant_type, storage_bucket, storage_path,
    mime_type, file_size_bytes, checksum_sha256, width, height
  ) values (
    job_record.tenant_id, job_record.output_media_asset_id, 'original',
    'tenant-media', p_storage_path, 'image/png', p_file_size_bytes,
    p_checksum_sha256, p_width, p_height
  );
  update public.dynamic_slide_snapshots set
    status = 'ready',
    output_media_asset_id = job_record.output_media_asset_id,
    completed_at = now()
  where id = snapshot_record.id;
  update public.dynamic_render_jobs set
    status = 'completed', finished_at = now(), locked_at = null, locked_by = null
  where id = job_record.id;
  update public.dynamic_slides set
    status = 'ready',
    current_snapshot_id = snapshot_record.id,
    last_error_code = null
  where id = slide_record.id
    and (
      current_snapshot_id is null
      or selection_mode = 'latest'
      or current_snapshot_id = snapshot_record.id
    );
  insert into public.audit_events(
    tenant_id, actor_user_id, action, target_type, target_id, result, metadata
  ) values (
    job_record.tenant_id, snapshot_record.created_by,
    'dynamic.render.completed', 'dynamic_slide_snapshots',
    snapshot_record.id, 'success',
    jsonb_build_object(
      'systemExecuted', true,
      'jobId', job_record.id,
      'mediaAssetId', job_record.output_media_asset_id,
      'checksum', p_checksum_sha256
    )
  );
  return job_record.output_media_asset_id;
end;
$$;

create or replace function public.fail_dynamic_render_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_detail text,
  p_retryable boolean default true
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  job_record public.dynamic_render_jobs%rowtype;
  next_status text;
begin
  select * into job_record from public.dynamic_render_jobs
  where id = p_job_id and status = 'rendering'
    and locked_by = left(p_worker_id, 120) for update;
  if not found then
    raise exception 'dynamic render lease lost' using errcode = '55000';
  end if;
  next_status := case
    when p_retryable and job_record.attempt_count < job_record.max_attempts
      then 'queued'
    else 'failed'
  end;
  update public.dynamic_render_jobs set
    status = next_status,
    locked_at = null,
    locked_by = null,
    finished_at = case when next_status = 'failed' then now() else null end,
    error_code = left(p_error_code, 80),
    error_detail = left(p_error_detail, 500)
  where id = job_record.id;
  if next_status = 'failed' then
    update public.dynamic_slide_snapshots set
      status = 'failed',
      error_code = left(p_error_code, 80),
      error_detail = left(p_error_detail, 500)
    where id = job_record.snapshot_id;
    update public.dynamic_slides slide set
      status = case when slide.current_snapshot_id is null then 'error' else 'ready' end,
      last_error_code = left(p_error_code, 80)
    from public.dynamic_slide_snapshots snapshot
    where snapshot.id = job_record.snapshot_id
      and slide.id = snapshot.dynamic_slide_id;
  end if;
  return next_status;
end;
$$;

create or replace function public.publish_dynamic_template_version_v1(
  p_version_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  version_record public.dynamic_template_versions%rowtype;
begin
  if actor_id is null or not private.is_platform_member(array[
    'platform_owner', 'platform_admin'
  ]::public.platform_role[]) then
    raise exception 'actor cannot publish templates' using errcode = '42501';
  end if;
  perform private.require_aal2_command();
  select * into version_record from public.dynamic_template_versions
  where id = p_version_id and status = 'draft' for update;
  if not found then
    raise exception 'draft template version not found' using errcode = 'P0002';
  end if;
  update public.dynamic_template_versions set
    status = 'published', published_by = actor_id, published_at = now()
  where id = version_record.id;
  update public.dynamic_templates set
    status = 'published',
    current_published_version_id = version_record.id,
    updated_by = actor_id
  where id = version_record.template_id;
  perform private.audit_event(
    null, 'dynamic.template.published', 'dynamic_template_versions',
    version_record.id, 'success',
    jsonb_build_object(
      'templateId', version_record.template_id,
      'version', version_record.version
    )
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.materialize_dynamic_release_provenance()
  from public, anon, authenticated;
revoke all on function private.reject_dynamic_immutable_mutation()
  from public, anon, authenticated;
revoke all on function public.claim_dynamic_render_job_v1(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_dynamic_render_job_v1(
  uuid, text, text, bigint, text, integer, integer
) from public, anon, authenticated;
revoke all on function public.fail_dynamic_render_job_v1(
  uuid, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.claim_dynamic_render_job_v1(
  text, integer, integer
) to service_role;
grant execute on function public.complete_dynamic_render_job_v1(
  uuid, text, text, bigint, text, integer, integer
) to service_role;
grant execute on function public.fail_dynamic_render_job_v1(
  uuid, text, text, text, boolean
) to service_role;
grant execute on function public.create_dynamic_data_source_v1(
  uuid, text, text, jsonb
) to authenticated;
grant execute on function public.record_rss_sync_v1(uuid, jsonb)
  to authenticated;
grant execute on function public.record_data_source_failure_v1(
  uuid, text, text
) to authenticated;
grant execute on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) to authenticated;
grant execute on function public.refresh_dynamic_slide_v1(uuid)
  to authenticated;
grant execute on function public.add_dynamic_slide_to_playlist_v1(
  uuid, uuid, integer
) to authenticated;
grant execute on function public.publish_dynamic_template_version_v1(uuid)
  to authenticated;
grant select on public.dynamic_templates, public.dynamic_template_versions,
  public.dynamic_data_sources, public.dynamic_news_articles,
  public.dynamic_sync_runs, public.dynamic_slides,
  public.dynamic_slide_snapshots, public.dynamic_render_jobs
  to authenticated;
grant insert, update on public.dynamic_templates,
  public.dynamic_template_versions to authenticated;
grant all on public.dynamic_templates, public.dynamic_template_versions,
  public.dynamic_data_sources, public.dynamic_news_articles,
  public.dynamic_sync_runs, public.dynamic_slides,
  public.dynamic_slide_snapshots, public.dynamic_render_jobs
  to service_role;

create or replace function private.guard_dynamic_template_version_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.markup is distinct from old.markup
    or new.css is distinct from old.css
    or new.manifest_json is distinct from old.manifest_json
    or new.sample_data_json is distinct from old.sample_data_json
    or new.source_checksum_sha256 is distinct from old.source_checksum_sha256
    or new.template_id is distinct from old.template_id
    or new.version is distinct from old.version
  ) then
    raise exception 'published template version source is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger dynamic_template_versions_guard_update
before update on public.dynamic_template_versions
for each row execute function private.guard_dynamic_template_version_update();
revoke all on function private.guard_dynamic_template_version_update()
  from public, anon, authenticated;

do $$
declare
  template_record record;
  template_id uuid;
  version_id uuid;
  source_markup text;
  source_css text;
  source_manifest jsonb;
  sample_data jsonb := '{
    "brand":{"primaryColor":"#ff5a1f","secondaryColor":"#111111"},
    "menu":{"title":"Kantinemenu","products":[
      {"name":"Broodje van de week","priceMinor":650,"currency":"EUR"},
      {"name":"Verse soep","priceMinor":425,"currency":"EUR"},
      {"name":"Clubburger","priceMinor":875,"currency":"EUR"},
      {"name":"Frisdrank","priceMinor":275,"currency":"EUR"}
    ]},
    "news":{"sourceName":"Clubnieuws","articles":[{
      "title":"Een nieuw seizoen begint",
      "intro":"Alles wat leden en bezoekers vandaag moeten weten.",
      "publishedAt":"2026-07-27T10:00:00Z",
      "link":"https://example.com/nieuws"
    }]}
  }'::jsonb;
begin
  for template_record in
    select * from (values
      (
        'menu-atelier-landscape',
        'Atelier menubord — liggend',
        'Rustig tweekoloms menubord voor kantine en horeca.',
        'menu',
        'landscape',
        1920,
        1080
      ),
      (
        'menu-atelier-portrait',
        'Atelier menubord — staand',
        'Verticaal menubord met grote, leesbare prijzen.',
        'menu',
        'portrait',
        1080,
        1920
      ),
      (
        'news-editorial-landscape',
        'Editorial nieuws — liggend',
        'Nieuwsheadline met intro en bronvermelding.',
        'news',
        'landscape',
        1920,
        1080
      ),
      (
        'news-editorial-portrait',
        'Editorial nieuws — staand',
        'Verticale nieuwskaart voor foyer en entree.',
        'news',
        'portrait',
        1080,
        1920
      )
    ) as seed(slug, name, description, slide_type, orientation, width, height)
  loop
    if template_record.slide_type = 'menu' then
      source_markup := case
        when template_record.orientation = 'landscape' then
          '<rect width="1920" height="1080" class="paper"/>' ||
          '<rect x="72" y="72" width="1776" height="936" rx="28" class="panel"/>' ||
          '<rect x="112" y="112" width="18" height="160" rx="9" fill="{{brand.primaryColor}}"/>' ||
          '<text x="170" y="190" class="eyebrow">MENU VANDAAG</text>' ||
          '<text x="170" y="270" class="title">{{truncate menu.title "34"}}</text>' ||
          '<line x1="170" y1="330" x2="1750" y2="330" class="rule"/>' ||
          '<text x="170" y="405" class="names">{{#each menu.products}}' ||
          '<tspan x="170" dy="78">{{truncate name "32"}}</tspan>{{/each}}</text>' ||
          '<text x="1710" y="405" text-anchor="end" class="prices">' ||
          '{{#each menu.products}}<tspan x="1710" dy="78">{{currency priceMinor "EUR"}}</tspan>{{/each}}</text>' ||
          '<text x="170" y="950" class="footer">Vers bereid · zolang de voorraad strekt</text>'
        else
          '<rect width="1080" height="1920" class="paper"/>' ||
          '<rect x="64" y="64" width="952" height="1792" rx="30" class="panel"/>' ||
          '<rect x="112" y="118" width="144" height="16" rx="8" fill="{{brand.primaryColor}}"/>' ||
          '<text x="112" y="220" class="eyebrow">MENU VANDAAG</text>' ||
          '<text x="112" y="330" class="title">{{truncate menu.title "22"}}</text>' ||
          '<line x1="112" y1="400" x2="968" y2="400" class="rule"/>' ||
          '<text x="112" y="500" class="names">{{#each menu.products}}' ||
          '<tspan x="112" dy="112">{{truncate name "24"}}</tspan>{{/each}}</text>' ||
          '<text x="946" y="500" text-anchor="end" class="prices">' ||
          '{{#each menu.products}}<tspan x="946" dy="112">{{currency priceMinor "EUR"}}</tspan>{{/each}}</text>' ||
          '<text x="112" y="1760" class="footer">Vers bereid · zolang de voorraad strekt</text>'
      end;
      source_css := case
        when template_record.orientation = 'landscape' then
          '.paper{fill:#f4efe6}.panel{fill:#fffdf8}.eyebrow{font:700 25px Inter;letter-spacing:5px;fill:#676056}.title{font:700 72px Inter;fill:#111}.names{font:500 38px Inter;fill:#111}.prices{font:700 38px Inter;fill:#111}.rule{stroke:#d9d0c2;stroke-width:2}.footer{font:500 22px Inter;fill:#676056}'
        else
          '.paper{fill:#f4efe6}.panel{fill:#fffdf8}.eyebrow{font:700 24px Inter;letter-spacing:5px;fill:#676056}.title{font:700 66px Inter;fill:#111}.names{font:500 38px Inter;fill:#111}.prices{font:700 38px Inter;fill:#111}.rule{stroke:#d9d0c2;stroke-width:2}.footer{font:500 22px Inter;fill:#676056}'
      end;
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', 'menu',
        'canvas', jsonb_build_object(
          'width', template_record.width, 'height', template_record.height
        ),
        'maxCollectionItems',
          case when template_record.orientation = 'landscape' then 7 else 10 end,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path','brand.primaryColor','type','string','required',true),
          jsonb_build_object('path','menu.title','type','string','required',true),
          jsonb_build_object('path','menu.products','type','string','required',true),
          jsonb_build_object('path','menu.products.name','type','string','required',true),
          jsonb_build_object('path','menu.products.priceMinor','type','number','required',true)
        )
      );
    else
      source_markup := case
        when template_record.orientation = 'landscape' then
          '<rect width="1920" height="1080" class="paper"/>' ||
          '<rect x="90" y="90" width="1740" height="900" rx="30" class="panel"/>' ||
          '<rect x="140" y="140" width="230" height="14" rx="7" fill="{{brand.primaryColor}}"/>' ||
          '<text x="140" y="235" class="eyebrow">{{truncate news.sourceName "42"}}</text>' ||
          '{{#each news.articles}}<text x="140" y="390" class="title">{{truncate title "48"}}</text>' ||
          '<text x="140" y="570" class="intro">{{truncate intro "170"}}</text>' ||
          '<text x="140" y="890" class="date">{{date publishedAt "long"}}</text>{{/each}}'
        else
          '<rect width="1080" height="1920" class="paper"/>' ||
          '<rect x="64" y="64" width="952" height="1792" rx="30" class="panel"/>' ||
          '<rect x="112" y="120" width="184" height="16" rx="8" fill="{{brand.primaryColor}}"/>' ||
          '<text x="112" y="235" class="eyebrow">{{truncate news.sourceName "30"}}</text>' ||
          '{{#each news.articles}}<text x="112" y="470" class="title">{{truncate title "54"}}</text>' ||
          '<text x="112" y="880" class="intro">{{truncate intro "220"}}</text>' ||
          '<text x="112" y="1740" class="date">{{date publishedAt "long"}}</text>{{/each}}'
      end;
      source_css := case
        when template_record.orientation = 'landscape' then
          '.paper{fill:#111}.panel{fill:#fffdf8}.eyebrow{font:700 25px Inter;letter-spacing:4px;fill:#676056;text-transform:uppercase}.title{font:700 78px Inter;fill:#111}.intro{font:400 35px Inter;fill:#4d4740}.date{font:600 24px Inter;fill:#676056}'
        else
          '.paper{fill:#111}.panel{fill:#fffdf8}.eyebrow{font:700 23px Inter;letter-spacing:4px;fill:#676056;text-transform:uppercase}.title{font:700 66px Inter;fill:#111}.intro{font:400 34px Inter;fill:#4d4740}.date{font:600 23px Inter;fill:#676056}'
      end;
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', 'news',
        'canvas', jsonb_build_object(
          'width', template_record.width, 'height', template_record.height
        ),
        'maxCollectionItems', 1,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path','brand.primaryColor','type','string','required',true),
          jsonb_build_object('path','news.sourceName','type','string','required',true),
          jsonb_build_object('path','news.articles','type','string','required',true),
          jsonb_build_object('path','news.articles.title','type','string','required',true),
          jsonb_build_object('path','news.articles.intro','type','string','required',false),
          jsonb_build_object('path','news.articles.publishedAt','type','datetime','required',false)
        )
      );
    end if;
    insert into public.dynamic_templates(
      slug, name, description, category, slide_type, orientation, status
    ) values (
      template_record.slug, template_record.name, template_record.description,
      template_record.slide_type, template_record.slide_type,
      template_record.orientation, 'published'
    ) returning id into template_id;
    insert into public.dynamic_template_versions(
      template_id, version, status, markup, css, manifest_json,
      sample_data_json, source_checksum_sha256, published_at
    ) values (
      template_id, 1, 'published', source_markup, source_css,
      source_manifest, sample_data,
      encode(extensions.digest(
        pg_catalog.convert_to(
          source_markup || source_css || source_manifest::text, 'UTF8'
        ), 'sha256'
      ), 'hex'),
      now()
    ) returning id into version_id;
    update public.dynamic_templates
    set current_published_version_id = version_id
    where id = template_id;
  end loop;
end;
$$;
