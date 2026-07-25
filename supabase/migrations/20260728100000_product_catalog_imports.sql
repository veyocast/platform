-- S41-A: tenant-safe spreadsheet product catalog snapshots.
-- Twelve remains a file import, not a claimed live provider integration.

alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write',
      'tenant.playlist.write',
      'tenant.playlist.publish',
      'tenant.screen.manage',
      'tenant.settings.manage',
      'tenant.audit.read',
      'tenant.support.export',
      'tenant.studio.read',
      'tenant.studio.create',
      'tenant.studio.edit_own',
      'tenant.studio.edit_all',
      'tenant.studio.archive',
      'tenant.studio.template.manage',
      'tenant.studio.motion.edit',
      'tenant.studio.render',
      'tenant.studio.job.manage',
      'tenant.product.write'
    ]::text[]
    and (
      ('tenant.media.write' = any(capabilities))
      = ('tenant.playlist.write' = any(capabilities))
    )
  );

alter function private.builtin_tenant_capabilities(public.tenant_role)
  rename to builtin_tenant_capabilities_before_products;
create function private.builtin_tenant_capabilities(
  p_role public.tenant_role
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select private.builtin_tenant_capabilities_before_products(p_role)
    || array['tenant.product.read']::text[]
    || case
      when p_role in (
        'tenant_owner'::public.tenant_role,
        'tenant_admin'::public.tenant_role,
        'tenant_editor'::public.tenant_role
      )
      then array['tenant.product.write']::text[]
      else '{}'::text[]
    end;
$$;

alter function private.tenant_baseline_capabilities()
  rename to tenant_baseline_capabilities_before_products;
create function private.tenant_baseline_capabilities()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select private.tenant_baseline_capabilities_before_products()
    || array['tenant.product.read']::text[];
$$;

alter function private.normalize_custom_role_capabilities(text[])
  rename to normalize_custom_role_capabilities_before_products;
create function private.normalize_custom_role_capabilities(
  p_capabilities text[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select private.normalize_custom_role_capabilities_before_products(
    coalesce(p_capabilities, '{}'::text[])
  ) || case
    when 'tenant.product.write' = any(coalesce(p_capabilities, '{}'::text[]))
    then array['tenant.product.write']::text[]
    else '{}'::text[]
  end;
$$;

create table public.product_catalog_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null default 'twelve_excel'
    check (source in ('twelve_excel', 'generic_excel')),
  file_name text not null check (length(btrim(file_name)) between 1 and 180),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  sheet_name text not null check (length(btrim(sheet_name)) between 1 and 120),
  headers jsonb not null check (
    jsonb_typeof(headers) = 'array'
    and jsonb_array_length(headers) between 2 and 75
  ),
  column_mapping jsonb not null default '{}'::jsonb
    check (jsonb_typeof(column_mapping) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'cancelled')),
  row_count integer not null default 0 check (row_count between 0 and 10000),
  included_count integer not null default 0
    check (included_count between 0 and row_count),
  valid_count integer not null default 0
    check (valid_count between 0 and row_count),
  created_by uuid references public.profiles(id) on delete set null,
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  cancelled_at timestamptz,
  unique (tenant_id, id),
  check (
    (status = 'draft' and applied_at is null and cancelled_at is null)
    or (status = 'applied' and applied_at is not null and cancelled_at is null)
    or (status = 'cancelled' and applied_at is null and cancelled_at is not null)
  )
);

create table public.product_catalog_import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  import_id uuid not null,
  row_number integer not null check (row_number between 1 and 10000),
  included boolean not null default true,
  source_values jsonb not null check (jsonb_typeof(source_values) = 'object'),
  normalized_values jsonb not null check (jsonb_typeof(normalized_values) = 'object'),
  validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, import_id, row_number),
  foreign key (tenant_id, import_id)
    references public.product_catalog_imports(tenant_id, id)
    on delete cascade
);

create table public.tenant_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null default 'twelve_excel'
    check (source in ('twelve_excel', 'generic_excel', 'manual')),
  source_external_id text,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 1000),
  category text check (category is null or length(category) <= 160),
  price_cents integer check (price_cents is null or price_cents between 0 and 100000000),
  vat_rate numeric(5,2) check (vat_rate is null or vat_rate between 0 and 100),
  unit text check (unit is null or length(unit) <= 80),
  barcode text check (barcode is null or length(barcode) <= 80),
  custom_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_fields) = 'object'),
  active boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  last_import_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, slug),
  foreign key (tenant_id, last_import_id)
    references public.product_catalog_imports(tenant_id, id)
    on delete set null,
  check ((active and archived_at is null) or (not active))
);

create index product_catalog_imports_tenant_created_idx
  on public.product_catalog_imports(tenant_id, created_at desc);
create index product_catalog_import_rows_import_idx
  on public.product_catalog_import_rows(tenant_id, import_id, row_number);
create index tenant_products_tenant_active_category_idx
  on public.tenant_products(tenant_id, active, category, name);
create index tenant_products_external_id_idx
  on public.tenant_products(tenant_id, source, source_external_id)
  where source_external_id is not null;

create trigger product_catalog_imports_set_updated_at
before update on public.product_catalog_imports
for each row execute function private.set_updated_at();
create trigger product_catalog_import_rows_set_updated_at
before update on public.product_catalog_import_rows
for each row execute function private.set_updated_at();
create trigger tenant_products_set_updated_at
before update on public.tenant_products
for each row execute function private.set_updated_at();

alter table public.product_catalog_imports enable row level security;
alter table public.product_catalog_imports force row level security;
alter table public.product_catalog_import_rows enable row level security;
alter table public.product_catalog_import_rows force row level security;
alter table public.tenant_products enable row level security;
alter table public.tenant_products force row level security;

revoke all on
  public.product_catalog_imports,
  public.product_catalog_import_rows,
  public.tenant_products
from public, anon, authenticated;
grant select on
  public.product_catalog_imports,
  public.product_catalog_import_rows,
  public.tenant_products
to authenticated;

create policy "product_catalog_imports_select_by_scope"
on public.product_catalog_imports for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.product.read')
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "product_catalog_import_rows_select_by_scope"
on public.product_catalog_import_rows for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.product.read')
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);
create policy "tenant_products_select_by_scope"
on public.tenant_products for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.product.read')
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function private.recount_product_import(p_import_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.product_catalog_imports import
  set
    row_count = aggregate.total,
    included_count = aggregate.included,
    valid_count = aggregate.valid
  from (
    select
      count(*)::integer as total,
      count(*) filter (where row.included)::integer as included,
      count(*) filter (
        where row.included
          and jsonb_array_length(row.validation_errors) = 0
      )::integer as valid
    from public.product_catalog_import_rows row
    where row.import_id = p_import_id
  ) aggregate
  where import.id = p_import_id;
$$;

create or replace function public.stage_product_import_v1(
  p_tenant_id uuid,
  p_source text,
  p_file_name text,
  p_file_sha256 text,
  p_sheet_name text,
  p_headers jsonb,
  p_column_mapping jsonb,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  import_id uuid;
  row_count integer;
begin
  if actor_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.product.write')
  then
    raise exception 'actor cannot import products' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  row_count := case
    when jsonb_typeof(p_rows) = 'array' then jsonb_array_length(p_rows)
    else -1
  end;
  if p_source not in ('twelve_excel', 'generic_excel')
    or length(btrim(coalesce(p_file_name, ''))) not between 1 and 180
    or coalesce(p_file_sha256, '') !~ '^[0-9a-f]{64}$'
    or length(btrim(coalesce(p_sheet_name, ''))) not between 1 and 120
    or jsonb_typeof(p_headers) <> 'array'
    or jsonb_array_length(p_headers) not between 2 and 75
    or jsonb_typeof(p_column_mapping) <> 'object'
    or row_count not between 1 and 10000
  then
    raise exception 'product import is outside supported limits' using errcode = '23514';
  end if;

  insert into public.product_catalog_imports (
    tenant_id,
    source,
    file_name,
    file_sha256,
    sheet_name,
    headers,
    column_mapping,
    created_by
  )
  values (
    p_tenant_id,
    p_source,
    btrim(p_file_name),
    p_file_sha256,
    btrim(p_sheet_name),
    p_headers,
    p_column_mapping,
    actor_id
  )
  returning id into import_id;

  insert into public.product_catalog_import_rows (
    tenant_id,
    import_id,
    row_number,
    included,
    source_values,
    normalized_values,
    validation_errors
  )
  select
    p_tenant_id,
    import_id,
    source_row.ordinality::integer,
    coalesce((source_row.value->>'included')::boolean, true),
    coalesce(source_row.value->'source', '{}'::jsonb),
    coalesce(source_row.value->'normalized', '{}'::jsonb),
    coalesce(source_row.value->'errors', '[]'::jsonb)
  from jsonb_array_elements(p_rows) with ordinality source_row(value, ordinality);

  perform private.recount_product_import(import_id);
  perform private.audit_event(
    p_tenant_id,
    'product.import.staged',
    'product_catalog_imports',
    import_id,
    'success',
    jsonb_build_object('source', p_source, 'rowCount', row_count)
  );
  return import_id;
end;
$$;

create or replace function public.replace_product_import_rows_v1(
  p_import_id uuid,
  p_column_mapping jsonb,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  import_record public.product_catalog_imports%rowtype;
  row_count integer;
begin
  select import.* into import_record
  from public.product_catalog_imports import
  where import.id = p_import_id
  for update;
  if not found then raise exception 'product import not found' using errcode = 'P0002'; end if;
  if actor_id is null
    or not private.has_tenant_capability(import_record.tenant_id, 'tenant.product.write')
  then
    raise exception 'actor cannot edit product import' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(import_record.tenant_id);
  row_count := case
    when jsonb_typeof(p_rows) = 'array' then jsonb_array_length(p_rows)
    else -1
  end;
  if import_record.status <> 'draft'
    or jsonb_typeof(p_column_mapping) <> 'object'
    or row_count not between 1 and 10000
  then
    raise exception 'product import cannot be remapped' using errcode = '23514';
  end if;

  delete from public.product_catalog_import_rows row
  where row.tenant_id = import_record.tenant_id
    and row.import_id = import_record.id;
  insert into public.product_catalog_import_rows (
    tenant_id,
    import_id,
    row_number,
    included,
    source_values,
    normalized_values,
    validation_errors
  )
  select
    import_record.tenant_id,
    import_record.id,
    source_row.ordinality::integer,
    coalesce((source_row.value->>'included')::boolean, true),
    coalesce(source_row.value->'source', '{}'::jsonb),
    coalesce(source_row.value->'normalized', '{}'::jsonb),
    coalesce(source_row.value->'errors', '[]'::jsonb)
  from jsonb_array_elements(p_rows) with ordinality source_row(value, ordinality);
  update public.product_catalog_imports
  set column_mapping = p_column_mapping
  where id = import_record.id;
  perform private.recount_product_import(import_record.id);
end;
$$;

create or replace function public.apply_product_import_v1(
  p_import_id uuid,
  p_mode text default 'merge'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  import_record public.product_catalog_imports%rowtype;
  imported_count integer;
begin
  select import.* into import_record
  from public.product_catalog_imports import
  where import.id = p_import_id
  for update;
  if not found then raise exception 'product import not found' using errcode = 'P0002'; end if;
  if actor_id is null
    or not private.has_tenant_capability(import_record.tenant_id, 'tenant.product.write')
  then
    raise exception 'actor cannot apply product import' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(import_record.tenant_id);
  if import_record.status <> 'draft'
    or p_mode not in ('merge', 'replace')
    or import_record.included_count = 0
    or import_record.valid_count <> import_record.included_count
  then
    raise exception 'product import is not ready' using errcode = '23514';
  end if;

  insert into public.tenant_products (
    tenant_id,
    source,
    source_external_id,
    slug,
    name,
    description,
    category,
    price_cents,
    vat_rate,
    unit,
    barcode,
    custom_fields,
    active,
    last_import_id,
    created_by,
    updated_by
  )
  select
    import_record.tenant_id,
    import_record.source,
    nullif(row.normalized_values->>'external_id', ''),
    row.normalized_values->>'slug',
    row.normalized_values->>'name',
    nullif(row.normalized_values->>'description', ''),
    nullif(row.normalized_values->>'category', ''),
    nullif(row.normalized_values->>'price_cents', '')::integer,
    nullif(row.normalized_values->>'vat_rate', '')::numeric,
    nullif(row.normalized_values->>'unit', ''),
    nullif(row.normalized_values->>'barcode', ''),
    coalesce(row.normalized_values->'custom_fields', '{}'::jsonb),
    coalesce((row.normalized_values->>'active')::boolean, true),
    import_record.id,
    actor_id,
    actor_id
  from public.product_catalog_import_rows row
  where row.tenant_id = import_record.tenant_id
    and row.import_id = import_record.id
    and row.included
    and jsonb_array_length(row.validation_errors) = 0
  on conflict (tenant_id, slug) do update set
    source = excluded.source,
    source_external_id = excluded.source_external_id,
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price_cents = excluded.price_cents,
    vat_rate = excluded.vat_rate,
    unit = excluded.unit,
    barcode = excluded.barcode,
    custom_fields = excluded.custom_fields,
    active = excluded.active,
    archived_at = case when excluded.active then null else now() end,
    last_import_id = excluded.last_import_id,
    updated_by = actor_id,
    revision = public.tenant_products.revision + 1;
  get diagnostics imported_count = row_count;

  if p_mode = 'replace' then
    update public.tenant_products product
    set
      active = false,
      archived_at = coalesce(product.archived_at, now()),
      updated_by = actor_id,
      revision = product.revision + 1
    where product.tenant_id = import_record.tenant_id
      and product.source = import_record.source
      and product.active
      and product.last_import_id is distinct from import_record.id;
  end if;

  update public.product_catalog_imports
  set status = 'applied', applied_at = now(), applied_by = actor_id
  where id = import_record.id;
  perform private.audit_event(
    import_record.tenant_id,
    'product.import.applied',
    'product_catalog_imports',
    import_record.id,
    'success',
    jsonb_build_object('mode', p_mode, 'productCount', imported_count)
  );
  return jsonb_build_object(
    'outcome', 'applied',
    'productCount', imported_count
  );
end;
$$;

create or replace function public.update_tenant_product_v1(
  p_product_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_description text,
  p_category text,
  p_price_cents integer,
  p_vat_rate numeric,
  p_unit text,
  p_barcode text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  product_record public.tenant_products%rowtype;
begin
  select product.* into product_record
  from public.tenant_products product
  where product.id = p_product_id
  for update;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  if actor_id is null
    or not private.has_tenant_capability(product_record.tenant_id, 'tenant.product.write')
  then
    raise exception 'actor cannot edit product' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(product_record.tenant_id);
  if p_expected_revision <> product_record.revision then
    return jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', product_record.revision
    );
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 160
    or p_price_cents is not null and p_price_cents not between 0 and 100000000
    or p_vat_rate is not null and p_vat_rate not between 0 and 100
  then
    raise exception 'product values are invalid' using errcode = '23514';
  end if;
  update public.tenant_products
  set
    name = btrim(p_name),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    category = nullif(btrim(coalesce(p_category, '')), ''),
    price_cents = p_price_cents,
    vat_rate = p_vat_rate,
    unit = nullif(btrim(coalesce(p_unit, '')), ''),
    barcode = nullif(btrim(coalesce(p_barcode, '')), ''),
    active = coalesce(p_active, false),
    archived_at = case when coalesce(p_active, false) then null else coalesce(archived_at, now()) end,
    revision = revision + 1,
    updated_by = actor_id
  where id = product_record.id;
  perform private.audit_event(
    product_record.tenant_id,
    'product.updated',
    'tenant_products',
    product_record.id
  );
  return jsonb_build_object(
    'outcome', 'updated',
    'revision', product_record.revision + 1
  );
end;
$$;

create or replace function private.format_product_price(p_price_cents integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_price_cents is null then ''
    else '€ ' || (p_price_cents / 100)::text || ',' ||
      lpad(mod(p_price_cents, 100)::text, 2, '0')
  end;
$$;

create or replace function private.resolve_studio_product_shortcodes(
  p_tenant_id uuid,
  p_document jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved jsonb := p_document;
  element_count integer := coalesce(jsonb_array_length(p_document->'elements'), 0);
  element_index integer;
  element_text text;
  product_record record;
  custom_field record;
begin
  if jsonb_typeof(p_document->'elements') <> 'array' then return p_document; end if;
  for element_index in 0..greatest(element_count - 1, -1) loop
    if resolved #>> array['elements', element_index::text, 'type'] <> 'text' then
      continue;
    end if;
    element_text := resolved #>> array['elements', element_index::text, 'text'];
    for product_record in
      select product.*
      from public.tenant_products product
      where product.tenant_id = p_tenant_id and product.active
    loop
      element_text := replace(element_text, '{{product:' || product_record.slug || ':name}}', product_record.name);
      element_text := replace(element_text, '{{product:' || product_record.slug || ':description}}', coalesce(product_record.description, ''));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':category}}', coalesce(product_record.category, ''));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':price}}', private.format_product_price(product_record.price_cents));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':vat_rate}}', coalesce(product_record.vat_rate::text, ''));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':unit}}', coalesce(product_record.unit, ''));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':barcode}}', coalesce(product_record.barcode, ''));
      element_text := replace(element_text, '{{product:' || product_record.slug || ':external_id}}', coalesce(product_record.source_external_id, ''));
      for custom_field in
        select field.key, field.value #>> '{}' as value
        from jsonb_each(product_record.custom_fields) field
      loop
        element_text := replace(
          element_text,
          '{{product:' || product_record.slug || ':custom.' || custom_field.key || '}}',
          coalesce(custom_field.value, '')
        );
      end loop;
    end loop;
    resolved := jsonb_set(
      resolved,
      array['elements', element_index::text, 'text'],
      to_jsonb(element_text)
    );
  end loop;
  return resolved;
end;
$$;

create or replace function private.resolve_studio_products_before_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reason = 'render' then
    new.document_json := private.resolve_studio_product_shortcodes(
      new.tenant_id,
      new.document_json
    );
    new.document_hash := private.studio_document_hash(new.document_json);
  end if;
  return new;
end;
$$;

create trigger studio_revisions_resolve_product_shortcodes
before insert on public.studio_revisions
for each row execute function private.resolve_studio_products_before_revision();

revoke all on function public.stage_product_import_v1(
  uuid, text, text, text, text, jsonb, jsonb, jsonb
) from public, anon;
revoke all on function public.replace_product_import_rows_v1(
  uuid, jsonb, jsonb
) from public, anon;
revoke all on function public.apply_product_import_v1(uuid, text)
  from public, anon;
revoke all on function public.update_tenant_product_v1(
  uuid, bigint, text, text, text, integer, numeric, text, text, boolean
) from public, anon;
grant execute on function public.stage_product_import_v1(
  uuid, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.replace_product_import_rows_v1(
  uuid, jsonb, jsonb
) to authenticated;
grant execute on function public.apply_product_import_v1(uuid, text)
  to authenticated;
grant execute on function public.update_tenant_product_v1(
  uuid, bigint, text, text, text, integer, numeric, text, text, boolean
) to authenticated;
