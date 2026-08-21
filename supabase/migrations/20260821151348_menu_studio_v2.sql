-- S112 Menu Studio v2. Additive and dual-read: legacy price-list
-- configurations and immutable releases are not rewritten.

alter table public.tenant_settings
  add column if not exists menu_document_v2_read_enabled boolean not null default false,
  add column if not exists menu_studio_v2_authoring_enabled boolean not null default false,
  add column if not exists menu_studio_v2_linked_groups_enabled boolean not null default false,
  add column if not exists menu_studio_v2_media_enabled boolean not null default false,
  add column if not exists menu_studio_v2_publish_enabled boolean not null default false,
  add column if not exists menu_studio_v2_player_enabled boolean not null default false;

alter table public.dynamic_slides
  add column if not exists menu_document_revision bigint,
  add column if not exists menu_last_published_revision bigint;
alter table public.dynamic_slides
  drop constraint if exists dynamic_slides_menu_document_revision_check,
  drop constraint if exists dynamic_slides_menu_published_revision_check;
alter table public.dynamic_slides
  add constraint dynamic_slides_menu_document_revision_check
    check (menu_document_revision is null or menu_document_revision >= 1),
  add constraint dynamic_slides_menu_published_revision_check
    check (
      menu_last_published_revision is null
      or (
        menu_last_published_revision >= 1
        and menu_document_revision is not null
        and menu_last_published_revision <= menu_document_revision
      )
    );

alter table public.media_assets
  add column tintable boolean not null default false,
  add constraint media_assets_tintable_svg_v2_check
    check (
      not tintable
      or (kind = 'image'::public.media_asset_kind and mime_type = 'image/svg+xml')
    );

create table public.menu_studio_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dynamic_slide_id uuid not null,
  operation_id uuid not null,
  base_revision bigint not null check (base_revision >= 0),
  next_revision bigint not null check (next_revision = base_revision + 1),
  command_json jsonb not null check (
    jsonb_typeof(command_json) = 'object'
    and octet_length(command_json::text) <= 65536
  ),
  candidate_sha256 text not null check (candidate_sha256 ~ '^[a-f0-9]{64}$'),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, dynamic_slide_id)
    references public.dynamic_slides(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (dynamic_slide_id, operation_id)
);

create index menu_studio_operations_tenant_slide_idx
  on public.menu_studio_operations(tenant_id, dynamic_slide_id, created_at desc);

alter table public.menu_studio_operations enable row level security;
alter table public.menu_studio_operations force row level security;
revoke all on public.menu_studio_operations from public, anon, authenticated;
grant select on public.menu_studio_operations to authenticated;
grant select, insert on public.menu_studio_operations to service_role;

create policy menu_studio_operations_tenant_read
on public.menu_studio_operations for select to authenticated
using (
  private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);

create trigger menu_studio_operations_reject_update
before update on public.menu_studio_operations
for each row execute function private.reject_dynamic_immutable_mutation();
create trigger menu_studio_operations_reject_delete
before delete on public.menu_studio_operations
for each row execute function private.reject_dynamic_immutable_mutation();

create or replace function private.menu_studio_flag_enabled_v2(
  p_tenant_id uuid,
  p_flag text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_flag
    when 'read' then settings.menu_document_v2_read_enabled
    when 'authoring' then settings.menu_studio_v2_authoring_enabled
    when 'linked_groups' then settings.menu_studio_v2_linked_groups_enabled
    when 'media' then settings.menu_studio_v2_media_enabled
    when 'publish' then settings.menu_studio_v2_publish_enabled
    when 'player' then settings.menu_studio_v2_player_enabled
    else false
  end
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id;
$$;

revoke all on function private.menu_studio_flag_enabled_v2(uuid, text)
  from public, anon, authenticated;

create or replace function private.collect_menu_ids_v2(p_value jsonb)
returns setof text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  entry record;
begin
  if jsonb_typeof(p_value) = 'object' then
    if jsonb_typeof(p_value -> 'id') = 'string' then
      return next p_value ->> 'id';
    end if;
    for entry in select key, value from jsonb_each(p_value)
    loop
      return query select * from private.collect_menu_ids_v2(entry.value);
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for entry in select value from jsonb_array_elements(p_value)
    loop
      return query select * from private.collect_menu_ids_v2(entry.value);
    end loop;
  end if;
  return;
end;
$$;

create or replace function private.collect_menu_asset_ids_v2(p_value jsonb)
returns setof uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  entry record;
  candidate text;
begin
  if jsonb_typeof(p_value) = 'object' then
    for entry in select key, value from jsonb_each(p_value)
    loop
      if entry.key in (
        'assetId', 'imageAssetId', 'logoAssetId',
        'mediaOverrideAssetId', 'posterAssetId'
      ) and jsonb_typeof(entry.value) = 'string' then
        candidate := trim(both '"' from entry.value::text);
        if candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return next candidate::uuid;
        else
          raise exception 'menu asset reference is invalid' using errcode = '22023';
        end if;
      end if;
      return query select * from private.collect_menu_asset_ids_v2(entry.value);
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for entry in select value from jsonb_array_elements(p_value)
    loop
      return query select * from private.collect_menu_asset_ids_v2(entry.value);
    end loop;
  end if;
  return;
end;
$$;

create or replace function private.collect_menu_nodes_v2(p_value jsonb)
returns setof jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  entry record;
begin
  if jsonb_typeof(p_value) = 'object' then
    if p_value ? 'type' or p_value ? 'kind' then
      return next p_value;
    end if;
    for entry in select value from jsonb_each(p_value)
    loop
      return query select * from private.collect_menu_nodes_v2(entry.value);
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for entry in select value from jsonb_array_elements(p_value)
    loop
      return query select * from private.collect_menu_nodes_v2(entry.value);
    end loop;
  end if;
  return;
end;
$$;

create or replace function private.menu_money_fingerprint_v2(p_money jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select concat_ws('|',
    p_money ->> 'currency',
    p_money ->> 'amountMinor',
    p_money ->> 'taxMode',
    coalesce(p_money ->> 'taxRateBps', ''),
    coalesce(p_money ->> 'unitKey', '')
  );
$$;

create or replace function private.validate_menu_layout_v2(p_layout jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  definition record;
  rect jsonb;
begin
  for definition in select * from (values
    ('landscape'::text, 96::numeric, 248::numeric, 1728::numeric, 704::numeric),
    ('portrait'::text, 72::numeric, 348::numeric, 936::numeric, 1388::numeric)
  ) bounds(orientation, x, y, w, h)
  loop
    rect := p_layout -> definition.orientation;
    if jsonb_typeof(rect) <> 'object'
      or jsonb_typeof(rect -> 'x') <> 'number'
      or jsonb_typeof(rect -> 'y') <> 'number'
      or jsonb_typeof(rect -> 'w') <> 'number'
      or jsonb_typeof(rect -> 'h') <> 'number'
      or jsonb_typeof(rect -> 'rotation') <> 'number'
      or (rect ->> 'w')::numeric <= 0
      or (rect ->> 'h')::numeric <= 0
      or (rect ->> 'x')::numeric < definition.x
      or (rect ->> 'y')::numeric < definition.y
      or (rect ->> 'x')::numeric + (rect ->> 'w')::numeric > definition.x + definition.w
      or (rect ->> 'y')::numeric + (rect ->> 'h')::numeric > definition.y + definition.h
      or (rect ->> 'rotation')::numeric not between -180 and 180
    then
      raise exception 'menu layout is outside the canonical body zone'
        using errcode = '23514';
    end if;
  end loop;
end;
$$;

create or replace function private.validate_menu_node_v2(p_value jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  entry record;
  line jsonb;
  first_fingerprint text;
  linked_count integer := 0;
  line_count integer := 0;
  visible_line_length integer := 0;
begin
  if jsonb_typeof(p_value) = 'array' then
    for entry in select value from jsonb_array_elements(p_value)
    loop
      perform private.validate_menu_node_v2(entry.value);
    end loop;
    return;
  end if;
  if jsonb_typeof(p_value) <> 'object' then return; end if;

  if p_value ? 'type' and p_value ->> 'type' not in (
    'category', 'product-group', 'image', 'video', 'logo', 'text', 'promo'
  ) then
    raise exception 'menu block type is invalid' using errcode = '22023';
  end if;
  if p_value ? 'layout' and (
    jsonb_typeof(p_value #> '{layout,landscape}') <> 'object'
    or jsonb_typeof(p_value #> '{layout,portrait}') <> 'object'
  ) then
    raise exception 'menu orientation layout is invalid' using errcode = '22023';
  end if;
  if p_value ? 'layout' then
    perform private.validate_menu_layout_v2(p_value -> 'layout');
  end if;
  if p_value ->> 'kind' in ('product', 'linked-product') and (
    jsonb_typeof(p_value -> 'productRef') <> 'object'
    or coalesce(p_value #>> '{productRef,productId}', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_value -> 'snapshotFallback') <> 'object'
  ) then
    raise exception 'linked menu product is invalid' using errcode = '22023';
  end if;
  if p_value ->> 'kind' = 'free-text' and (
    length(btrim(coalesce(p_value ->> 'label', ''))) not between 1 and 24
    or coalesce(p_value ->> 'label', '') ~ '[[:cntrl:]]'
    or p_value ?| array[
      'productRef', 'price', 'snapshotFallback', 'availability',
      'providerConnectionId', 'mediaOverrideAssetId'
    ]
  ) then
    raise exception 'free menu line contains product semantics' using errcode = '22023';
  end if;

  if p_value ? 'pricePolicy' then
    if p_value ->> 'pricePolicy' not in ('shared', 'from', 'separate')
      or jsonb_typeof(p_value -> 'secondaryLineItems') <> 'array'
      or jsonb_array_length(p_value -> 'secondaryLineItems') not between 1 and 40
    then
      raise exception 'menu product group is invalid' using errcode = '22023';
    end if;
    for line in select value from jsonb_array_elements(p_value -> 'secondaryLineItems')
    loop
      visible_line_length := visible_line_length +
        case when line_count > 0 then 3 else 0 end +
        length(btrim(coalesce(
          case
            when line ->> 'kind' = 'free-text' then line ->> 'label'
            else coalesce(
              line ->> 'labelOverride',
              line #>> '{snapshotFallback,variantLabel}',
              line #>> '{snapshotFallback,name}'
            )
          end,
          ''
        )));
      line_count := line_count + 1;
      if line ->> 'kind' = 'linked-product' then
        if line ? 'labelOverride' and (
          length(btrim(coalesce(line ->> 'labelOverride', ''))) not between 1 and 24
          or coalesce(line ->> 'labelOverride', '') ~ '[[:cntrl:]]'
        ) then
          raise exception 'linked menu label override is invalid' using errcode = '22023';
        end if;
        linked_count := linked_count + 1;
        if first_fingerprint is null then
          first_fingerprint := private.menu_money_fingerprint_v2(
            line #> '{snapshotFallback,price}'
          );
        elsif p_value ->> 'pricePolicy' = 'shared' and
          first_fingerprint <> private.menu_money_fingerprint_v2(
            line #> '{snapshotFallback,price}'
          )
        then
          raise exception 'shared menu prices are not equal' using errcode = '23514';
        end if;
      elsif line ->> 'kind' <> 'free-text' then
        raise exception 'menu line kind is invalid' using errcode = '22023';
      end if;
    end loop;
    if visible_line_length > coalesce((p_value #>> '{display,maxLines}')::integer, 0) * 72 then
      raise exception 'menu product group secondary line does not fit safely'
        using errcode = '23514';
    end if;
    if p_value ->> 'pricePolicy' = 'shared' and (
      jsonb_typeof(p_value -> 'sharedPrice') <> 'object'
      or (
        first_fingerprint is not null
        and private.menu_money_fingerprint_v2(p_value -> 'sharedPrice') <>
          first_fingerprint
      )
    ) then
      raise exception 'shared menu price is invalid' using errcode = '23514';
    end if;
    if p_value ->> 'pricePolicy' = 'from' and linked_count = 0 then
      raise exception 'from menu price needs a linked product' using errcode = '23514';
    end if;
    if p_value ->> 'pricePolicy' = 'separate' and p_value ? 'sharedPrice' then
      raise exception 'separate menu prices cannot have sharedPrice' using errcode = '23514';
    end if;
  end if;

  for entry in select key, value from jsonb_each(p_value)
  loop
    perform private.validate_menu_node_v2(entry.value);
  end loop;
end;
$$;

create or replace function private.resolve_menu_document_node_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_value jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  entry record;
  current_value jsonb := p_value;
  result jsonb;
  product public.tenant_products%rowtype;
  product_id uuid;
  provider_id text;
  tax_mode text;
begin
  if jsonb_typeof(current_value) = 'array' then
    select coalesce(jsonb_agg(
      private.resolve_menu_document_node_v2(
        p_tenant_id, p_data_source_id, value
      ) order by ordinal
    ), '[]'::jsonb)
    into result
    from jsonb_array_elements(current_value) with ordinality items(value, ordinal);
    return result;
  end if;
  if jsonb_typeof(current_value) <> 'object' then return current_value; end if;

  if current_value ->> 'kind' in ('product', 'linked-product') then
    begin
      product_id := (current_value #>> '{productRef,productId}')::uuid;
    exception when invalid_text_representation then
      raise exception 'linked menu product id is invalid' using errcode = '22023';
    end;
    provider_id := current_value #>> '{productRef,providerConnectionId}';
    if provider_id is not null and provider_id <> p_data_source_id::text then
      raise exception 'linked menu product belongs to another source'
        using errcode = '42501';
    end if;
    select * into product
    from public.tenant_products candidate
    where candidate.id = product_id
      and candidate.tenant_id = p_tenant_id
      and (
        candidate.data_source_id = p_data_source_id
        or candidate.data_source_id is null
      );
    if not found then
      raise exception 'linked menu product is unavailable for this tenant'
        using errcode = '42501';
    end if;
    tax_mode := case product.custom_fields ->> 'tax_mode'
      when 'exclusive' then 'exclusive'
      when 'not-applicable' then 'not-applicable'
      else 'inclusive'
    end;
    current_value := jsonb_set(
      current_value,
      '{snapshotFallback}',
      jsonb_strip_nulls(jsonb_build_object(
        'name', product.name,
        'variantLabel', coalesce(
          nullif(current_value #>> '{snapshotFallback,variantLabel}', ''),
          nullif(product.custom_fields ->> 'variant_label', '')
        ),
        'price', jsonb_strip_nulls(jsonb_build_object(
          'currency', product.currency,
          'amountMinor', coalesce(product.price_cents, 0),
          'taxMode', tax_mode,
          'taxRateBps', case
            when product.vat_rate is null then null
            else round(product.vat_rate * 100)::integer
          end,
          'unitKey', nullif(product.unit, '')
        )),
        'available', product.active and product.available,
        'imageAssetId', product.image_media_asset_id,
        'capturedAt', product.updated_at
      )),
      true
    );
    current_value := jsonb_set(
      current_value,
      '{productRef,sourceRevision}',
      to_jsonb(product.revision::text),
      true
    );
  end if;

  result := '{}'::jsonb;
  for entry in select key, value from jsonb_each(current_value)
  loop
    result := result || jsonb_build_object(
      entry.key,
      private.resolve_menu_document_node_v2(
        p_tenant_id, p_data_source_id, entry.value
      )
    );
  end loop;
  return result;
end;
$$;

create or replace function private.resolve_menu_document_assets_v2(
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
  result jsonb;
begin
  with requested as (
    select distinct collected.asset_id
    from private.collect_menu_asset_ids_v2(p_document) as collected(asset_id)
  ), resolved as (
    select
      asset.id,
      asset.checksum_sha256,
      (
        select variant.checksum_sha256
        from public.media_variants variant
        where variant.tenant_id = asset.tenant_id
          and variant.asset_id = asset.id
          and variant.variant_type = 'thumbnail'
      ) poster_checksum_sha256,
      case
        when asset.mime_type = 'image/gif' then 'animation'
        when asset.kind = 'video'::public.media_asset_kind then 'video'
        when exists (
          select 1
          from jsonb_array_elements(coalesce(p_document -> 'assets', '[]'::jsonb)) existing
          where existing ->> 'assetId' = asset.id::text
            and existing ->> 'kind' = 'logo'
        ) then 'logo'
        else 'image'
      end kind
    from requested
    join public.media_assets asset
      on asset.id = requested.asset_id
     and asset.tenant_id = p_tenant_id
     and asset.status = 'ready'::public.media_asset_status
    where asset.checksum_sha256 is not null
      and (
        asset.kind <> 'video'::public.media_asset_kind
        or (
          exists (
            select 1 from public.media_variants delivery
            where delivery.tenant_id = asset.tenant_id
              and delivery.asset_id = asset.id
              and delivery.variant_type = 'player_1080p'
          )
          and exists (
            select 1 from public.media_variants poster
            where poster.tenant_id = asset.tenant_id
              and poster.asset_id = asset.id
              and poster.variant_type = 'thumbnail'
          )
        )
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assetId', resolved.id,
    'assetVersion', resolved.checksum_sha256,
    'kind', resolved.kind,
    'status', 'ready',
    'sha256', resolved.checksum_sha256,
    'posterAssetVersion', resolved.poster_checksum_sha256
  ) order by resolved.id), '[]'::jsonb)
  into result from resolved;

  if jsonb_array_length(result) < (
    select count(distinct asset_id)
    from private.collect_menu_asset_ids_v2(p_document) as collected(asset_id)
  ) then
    raise exception 'menu contains a missing, cross-tenant or unready asset'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from private.collect_menu_nodes_v2(p_document) collected(node)
    join public.media_assets asset
      on asset.id = (collected.node ->> 'assetId')::uuid
     and asset.tenant_id = p_tenant_id
    where collected.node ->> 'type' in ('image', 'video', 'logo')
      and (
        (collected.node ->> 'type' = 'video' and asset.kind <> 'video'::public.media_asset_kind)
        or (collected.node ->> 'type' in ('image', 'logo') and asset.kind <> 'image'::public.media_asset_kind)
        or (
          collected.node ->> 'type' = 'logo'
          and asset.mime_type not in ('image/png', 'image/svg+xml', 'image/webp')
        )
        or (
          collected.node ->> 'type' = 'logo'
          and coalesce(collected.node #>> '{color,mode}', 'original') <> 'original'
          and (asset.mime_type <> 'image/svg+xml' or not asset.tintable)
        )
      )
  ) then
    raise exception 'menu media kind or logo color mode is incompatible'
      using errcode = '23514';
  end if;
  return jsonb_set(p_document, '{assets}', result, true);
end;
$$;

create or replace function private.resolve_menu_document_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_document jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved jsonb;
begin
  resolved := private.resolve_menu_document_node_v2(
    p_tenant_id, p_data_source_id, p_document
  );
  return private.resolve_menu_document_assets_v2(p_tenant_id, resolved);
end;
$$;

create or replace function private.validate_menu_document_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_document jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page jsonb;
  identifiers bigint;
  unique_identifiers bigint;
begin
  if jsonb_typeof(p_document) <> 'object'
    or p_document ->> 'schemaVersion' <> 'menu-document.v2'
    or p_document ->> 'tenantId' <> p_tenant_id::text
    or coalesce(p_document ->> 'id', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_document ->> 'revision', '') !~ '^[1-9][0-9]*$'
    or length(coalesce(p_document ->> 'title', '')) > 120
    or jsonb_typeof(p_document -> 'pages') <> 'array'
    or jsonb_array_length(p_document -> 'pages') not between 1 and 40
    or jsonb_typeof(p_document -> 'assets') <> 'array'
    or jsonb_array_length(p_document -> 'assets') > 100
    or p_document #>> '{theme,themeId}' not in (
      'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
      'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
    )
    or p_document #>> '{theme,mode}' not in ('light', 'dark')
    or coalesce(p_document #>> '{theme,themeVersion}', '') !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
    or coalesce(p_document #>> '{theme,brand,accent}', '') !~* '^#[0-9a-f]{6}$'
    or octet_length(p_document::text) > 1048576
  then
    raise exception 'menu document v2 is invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.dynamic_data_sources source
    where source.id = p_data_source_id
      and source.tenant_id = p_tenant_id
      and source.kind in ('manual_products', 'twelve_excel')
      and source.status = 'active'
  ) then
    raise exception 'menu source is unavailable' using errcode = '42501';
  end if;

  for page in select value from jsonb_array_elements(p_document -> 'pages')
  loop
    if jsonb_typeof(page) <> 'object'
      or jsonb_typeof(page -> 'blocks') <> 'array'
      or jsonb_array_length(page -> 'blocks') > 100
      or coalesce(page ->> 'id', '') = ''
      or coalesce(page ->> 'order', '') !~ '^[0-9]{1,5}$'
    then
      raise exception 'menu page is invalid' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(page -> 'blocks') with ordinality left_block(value, ordinal)
      join jsonb_array_elements(page -> 'blocks') with ordinality right_block(value, ordinal)
        on right_block.ordinal > left_block.ordinal
      cross join (values ('landscape'::text), ('portrait'::text)) orientation(name)
      where left_block.value ->> 'type' not in ('category', 'product-group')
        and right_block.value ->> 'type' not in ('category', 'product-group')
        and coalesce((left_block.value ->> 'hidden')::boolean, false) = false
        and coalesce((right_block.value ->> 'hidden')::boolean, false) = false
        and (left_block.value #>> array['layout', orientation.name, 'x'])::numeric <
          (right_block.value #>> array['layout', orientation.name, 'x'])::numeric +
          (right_block.value #>> array['layout', orientation.name, 'w'])::numeric
        and (left_block.value #>> array['layout', orientation.name, 'x'])::numeric +
          (left_block.value #>> array['layout', orientation.name, 'w'])::numeric >
          (right_block.value #>> array['layout', orientation.name, 'x'])::numeric
        and (left_block.value #>> array['layout', orientation.name, 'y'])::numeric <
          (right_block.value #>> array['layout', orientation.name, 'y'])::numeric +
          (right_block.value #>> array['layout', orientation.name, 'h'])::numeric
        and (left_block.value #>> array['layout', orientation.name, 'y'])::numeric +
          (left_block.value #>> array['layout', orientation.name, 'h'])::numeric >
          (right_block.value #>> array['layout', orientation.name, 'y'])::numeric
    ) then
      raise exception 'menu floating blocks overlap' using errcode = '23514';
    end if;
  end loop;

  select count(*), count(distinct value)
  into identifiers, unique_identifiers
  from private.collect_menu_ids_v2(p_document) as collected(value);
  if identifiers <> unique_identifiers or identifiers > 500 then
    raise exception 'menu ids must be unique and bounded' using errcode = '23505';
  end if;

  perform private.validate_menu_node_v2(p_document);
end;
$$;

revoke all on function private.collect_menu_ids_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.collect_menu_asset_ids_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.collect_menu_nodes_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.menu_money_fingerprint_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.validate_menu_layout_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.validate_menu_node_v2(jsonb)
  from public, anon, authenticated;
revoke all on function private.resolve_menu_document_node_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.resolve_menu_document_assets_v2(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.resolve_menu_document_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.validate_menu_document_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;

alter function private.validate_price_list_configuration_v1(uuid, uuid, jsonb)
  rename to validate_price_list_configuration_before_menu_studio_v2;

create or replace function private.validate_price_list_configuration_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_configuration jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved jsonb;
begin
  if p_configuration ->> 'schemaVersion' = 'menu-document.v2' then
    resolved := private.resolve_menu_document_v2(
      p_tenant_id, p_data_source_id, p_configuration
    );
    perform private.validate_menu_document_v2(
      p_tenant_id, p_data_source_id, resolved
    );
    return;
  end if;
  perform private.validate_price_list_configuration_before_menu_studio_v2(
    p_tenant_id, p_data_source_id, p_configuration
  );
end;
$$;

revoke all on function private.validate_price_list_configuration_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function private.validate_price_list_configuration_before_menu_studio_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_menu_studio_v2;

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
  document jsonb;
  selection jsonb;
  result jsonb;
  club_name text;
  club_logo_id uuid;
  published_at timestamptz := now();
begin
  if p_slide.slide_type <> 'price_list'
    or p_slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    return private.build_dynamic_snapshot_data_before_menu_studio_v2(p_slide);
  end if;

  document := private.resolve_menu_document_v2(
    p_slide.tenant_id,
    p_slide.data_source_id,
    p_slide.configuration_json
  );
  perform private.validate_menu_document_v2(
    p_slide.tenant_id, p_slide.data_source_id, document
  );
  document := jsonb_set(document, '{publication}', jsonb_build_object(
    'documentRevision', p_slide.menu_document_revision,
    'rendererVersion', '2.0.0',
    'contentFitVersion', 'dom-measured-2.0.0',
    'themeManifestVersion', '1.0.0',
    'assetManifestVersion', '1.0.0',
    'publishedAt', published_at
  ), true);
  select tenant.name into club_name
  from public.tenants tenant where tenant.id = p_slide.tenant_id;
  select coalesce(
    (select kit.logo_media_asset_id
     from public.studio_tenant_brand_kits kit
     where kit.tenant_id = p_slide.tenant_id),
    (select club.logo_media_asset_id
     from public.sports_clubs club
     where club.tenant_id = p_slide.tenant_id
       and club.active and club.logo_media_asset_id is not null
     order by club.last_synced_at desc, club.id limit 1)
  ) into club_logo_id;
  selection := jsonb_build_object(
    'accent', document #>> '{theme,brand,accent}',
    'support', document #>> '{theme,brand,support}',
    'categoryOverrides', '[]'::jsonb,
    'modePolicy', jsonb_build_object(
      'kind', 'fixed', 'mode', document #>> '{theme,mode}'
    ),
    'ref', jsonb_build_object(
      'catalog', 'v2',
      'id', document #>> '{theme,themeId}',
      'version', document #>> '{theme,themeVersion}'
    )
  );
  result := jsonb_build_object(
    'type', 'price_list',
    'menuDocument', document,
    'brand', jsonb_strip_nulls(jsonb_build_object(
      'clubName', club_name,
      'logoMediaAssetId', club_logo_id,
      'primaryColor', document #>> '{theme,brand,accent}'
    )),
    'themePresentation', jsonb_build_object(
      'catalogVersion', '1.0.0',
      'resolvedMode', jsonb_build_object(
        'mode', document #>> '{theme,mode}',
        'policy', selection -> 'modePolicy',
        'resolvedAt', published_at,
        'timezone', 'UTC'
      ),
      'selection', selection,
      'snapshotVersion', 1
    )
  );
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_menu_studio_v2(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function public.create_menu_studio_draft_v2(
  p_tenant_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_selection_mode text,
  p_document jsonb,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record record;
  slide_id uuid := gen_random_uuid();
  canonical jsonb;
  candidate_hash text;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot create Menu Studio drafts' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not private.menu_studio_flag_enabled_v2(p_tenant_id, 'read')
    or not private.menu_studio_flag_enabled_v2(p_tenant_id, 'authoring')
  then
    raise exception 'Menu Studio v2 authoring is not enabled' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 120
    or p_selection_mode not in ('latest', 'pinned')
    or p_operation_id is null
  then
    raise exception 'Menu Studio draft input is invalid' using errcode = '22023';
  end if;
  select template.id template_id, template.orientation
  into template_record
  from public.dynamic_template_versions version
  join public.dynamic_templates template on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published'
    and template.current_published_version_id = version.id
    and template.slide_type = 'price_list';
  if not found then
    raise exception 'published price-list template not found' using errcode = 'P0002';
  end if;

  canonical := (coalesce(p_document, '{}'::jsonb) - 'publication') ||
    jsonb_build_object(
      'schemaVersion', 'menu-document.v2',
      'id', slide_id,
      'tenantId', p_tenant_id,
      'revision', 1,
      'createdAt', now(),
      'updatedAt', now()
    );
  canonical := private.resolve_menu_document_v2(
    p_tenant_id, p_data_source_id, canonical
  );
  perform private.validate_menu_document_v2(
    p_tenant_id, p_data_source_id, canonical
  );
  if exists (
    select 1 from private.collect_menu_nodes_v2(canonical) collected(node)
    where collected.node ? 'pricePolicy'
  ) and
    not private.menu_studio_flag_enabled_v2(p_tenant_id, 'linked_groups')
  then
    raise exception 'Menu Studio linked groups are not enabled' using errcode = '42501';
  end if;
  if jsonb_array_length(canonical -> 'assets') > 0 and
    not private.menu_studio_flag_enabled_v2(p_tenant_id, 'media')
  then
    raise exception 'Menu Studio media is not enabled' using errcode = '42501';
  end if;

  insert into public.dynamic_slides (
    id, tenant_id, name, slide_type, orientation, template_id,
    template_version_id, data_source_id, selection_mode, status,
    configuration_json, revision, menu_document_revision,
    created_by, updated_by
  ) values (
    slide_id, p_tenant_id, btrim(p_name), 'price_list',
    template_record.orientation, template_record.template_id,
    p_template_version_id, p_data_source_id, p_selection_mode, 'draft',
    canonical, 1, 1, actor_id, actor_id
  );
  candidate_hash := encode(extensions.digest(
    pg_catalog.convert_to(canonical::text, 'UTF8'), 'sha256'
  ), 'hex');
  insert into public.menu_studio_operations (
    tenant_id, dynamic_slide_id, operation_id, base_revision,
    next_revision, command_json, candidate_sha256, actor_id
  ) values (
    p_tenant_id, slide_id, p_operation_id, 0, 1,
    jsonb_build_object('kind', 'create'), candidate_hash, actor_id
  );
  perform private.audit_event(
    p_tenant_id, 'menu_studio.draft.created', 'dynamic_slides',
    slide_id, 'success', jsonb_build_object('revision', 1)
  );
  return jsonb_build_object(
    'outcome', 'applied', 'slideId', slide_id,
    'revision', 1, 'document', canonical
  );
end;
$$;

create or replace function public.save_menu_studio_document_v2(
  p_slide_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_command jsonb,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  canonical jsonb;
  request_hash text;
  existing record;
  next_revision bigint := p_expected_revision + 1;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  if not found or slide.slide_type <> 'price_list'
    or slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    raise exception 'Menu Studio draft not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot save Menu Studio drafts' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'read')
    or not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'authoring')
  then
    raise exception 'Menu Studio v2 authoring is not enabled' using errcode = '42501';
  end if;
  if p_operation_id is null or jsonb_typeof(p_command) <> 'object'
    or octet_length(p_command::text) > 65536
  then
    raise exception 'Menu Studio operation is invalid' using errcode = '22023';
  end if;
  request_hash := encode(extensions.digest(
    pg_catalog.convert_to(
      coalesce(p_document, '{}'::jsonb)::text || p_command::text,
      'UTF8'
    ), 'sha256'
  ), 'hex');
  select operation.next_revision, operation.candidate_sha256
  into existing
  from public.menu_studio_operations operation
  where operation.dynamic_slide_id = slide.id
    and operation.operation_id = p_operation_id;
  if found then
    if existing.candidate_sha256 <> request_hash then
      raise exception 'operation id was already used for different input'
        using errcode = '23505';
    end if;
    if slide.menu_document_revision <> existing.next_revision then
      raise exception 'Menu Studio operation was applied before a newer revision'
        using errcode = '40001';
    end if;
    return jsonb_build_object(
      'outcome', 'already_applied',
      'revision', existing.next_revision,
      'document', slide.configuration_json
    );
  end if;
  if slide.menu_document_revision <> p_expected_revision then
    raise exception 'Menu Studio revision conflict' using errcode = '40001';
  end if;

  canonical := (coalesce(p_document, '{}'::jsonb) - 'publication') ||
    jsonb_build_object(
      'schemaVersion', 'menu-document.v2',
      'id', slide.id,
      'tenantId', slide.tenant_id,
      'revision', next_revision,
      'createdAt', slide.configuration_json -> 'createdAt',
      'updatedAt', now()
    );
  canonical := private.resolve_menu_document_v2(
    slide.tenant_id, slide.data_source_id, canonical
  );
  perform private.validate_menu_document_v2(
    slide.tenant_id, slide.data_source_id, canonical
  );
  if exists (
    select 1 from private.collect_menu_nodes_v2(canonical) collected(node)
    where collected.node ? 'pricePolicy'
  ) and
    not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'linked_groups')
  then
    raise exception 'Menu Studio linked groups are not enabled' using errcode = '42501';
  end if;
  if jsonb_array_length(canonical -> 'assets') > 0 and
    not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'media')
  then
    raise exception 'Menu Studio media is not enabled' using errcode = '42501';
  end if;

  update public.dynamic_slides
  set configuration_json = canonical,
      menu_document_revision = next_revision,
      revision = revision + 1,
      updated_by = actor_id,
      last_error_code = null
  where id = slide.id;
  insert into public.menu_studio_operations (
    tenant_id, dynamic_slide_id, operation_id, base_revision,
    next_revision, command_json, candidate_sha256, actor_id
  ) values (
    slide.tenant_id, slide.id, p_operation_id, p_expected_revision,
    next_revision, p_command, request_hash, actor_id
  );
  perform private.audit_event(
    slide.tenant_id, 'menu_studio.document.saved', 'dynamic_slides',
    slide.id, 'success', jsonb_build_object(
      'baseRevision', p_expected_revision,
      'revision', next_revision,
      'operationId', p_operation_id
    )
  );
  return jsonb_build_object(
    'outcome', 'applied', 'revision', next_revision, 'document', canonical
  );
end;
$$;

create or replace function public.publish_menu_studio_document_v2(
  p_slide_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  resolved jsonb;
  snapshot_result jsonb;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  if not found
    or slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    raise exception 'Menu Studio draft not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot publish Menu Studio documents' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'read')
    or not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'publish')
    or not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'player')
  then
    raise exception 'Menu Studio v2 publish is not enabled' using errcode = '42501';
  end if;
  if slide.menu_document_revision <> p_expected_revision then
    raise exception 'Menu Studio revision conflict' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.menu_studio_operations operation
    where operation.dynamic_slide_id = slide.id
      and operation.operation_id = p_operation_id
  ) then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'revision', slide.menu_document_revision,
      'snapshotId', slide.current_snapshot_id
    );
  end if;

  resolved := private.resolve_menu_document_v2(
    slide.tenant_id, slide.data_source_id, slide.configuration_json
  );
  perform private.validate_menu_document_v2(
    slide.tenant_id, slide.data_source_id, resolved
  );
  if resolved <> slide.configuration_json then
    raise exception 'Menu source or assets changed; review and save before publishing'
      using errcode = '40001';
  end if;
  snapshot_result := public.refresh_dynamic_slide_v1(slide.id);
  update public.dynamic_slides
  set menu_last_published_revision = p_expected_revision,
      updated_by = actor_id
  where id = slide.id;
  insert into public.menu_studio_operations (
    tenant_id, dynamic_slide_id, operation_id, base_revision,
    next_revision, command_json, candidate_sha256, actor_id
  ) values (
    slide.tenant_id, slide.id, p_operation_id,
    p_expected_revision - 1, p_expected_revision,
    jsonb_build_object('kind', 'publish'),
    encode(extensions.digest(
      pg_catalog.convert_to(slide.configuration_json::text, 'UTF8'), 'sha256'
    ), 'hex'), actor_id
  );
  perform private.audit_event(
    slide.tenant_id, 'menu_studio.document.published', 'dynamic_slides',
    slide.id, 'success', jsonb_build_object(
      'revision', p_expected_revision,
      'snapshotId', snapshot_result ->> 'snapshotId'
    )
  );
  return snapshot_result || jsonb_build_object(
    'outcome', 'applied', 'revision', p_expected_revision
  );
end;
$$;

revoke all on function public.create_menu_studio_draft_v2(
  uuid, text, uuid, uuid, text, jsonb, uuid
) from public, anon;
revoke all on function public.save_menu_studio_document_v2(
  uuid, bigint, uuid, jsonb, jsonb
) from public, anon;
revoke all on function public.publish_menu_studio_document_v2(
  uuid, bigint, uuid
) from public, anon;
grant execute on function public.create_menu_studio_draft_v2(
  uuid, text, uuid, uuid, text, jsonb, uuid
) to authenticated, service_role;
grant execute on function public.save_menu_studio_document_v2(
  uuid, bigint, uuid, jsonb, jsonb
) to authenticated, service_role;
grant execute on function public.publish_menu_studio_document_v2(
  uuid, bigint, uuid
) to authenticated, service_role;

-- Menu Studio reuses the canonical private media pipeline. Extend that shared
-- boundary for animated images, sanitized SVG sources and WebM ingestion.
alter table public.media_assets drop constraint if exists media_assets_check1;
alter table public.media_assets drop constraint if exists media_assets_kind_mime_v2_check;
alter table public.media_assets add constraint media_assets_kind_mime_v2_check
  check (
    (
      kind = 'image'::public.media_asset_kind
      and mime_type in (
        'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'
      )
    )
    or (
      kind = 'video'::public.media_asset_kind
      and mime_type in ('image/gif', 'video/mp4', 'video/webm')
    )
  );

update storage.buckets
set allowed_mime_types = array[
  'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
  'video/mp4', 'video/webm'
]
where id = 'tenant-media';

create or replace function public.create_media_video_upload_intent(
  p_tenant_id uuid,
  p_title text,
  p_original_file_name text,
  p_expected_mime_type text,
  p_expected_size_bytes bigint,
  p_idempotency_key uuid
)
returns table(
  asset_id uuid,
  upload_session_id uuid,
  storage_bucket text,
  storage_path text,
  expires_at timestamptz,
  resumed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_tenant_id uuid := p_tenant_id;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_file_name text := lower(btrim(coalesce(p_original_file_name, '')));
  existing_session public.media_upload_sessions%rowtype;
  existing_asset public.media_assets%rowtype;
  new_asset_id uuid := gen_random_uuid();
  new_session_id uuid := gen_random_uuid();
  new_path text;
  tenant_limit bigint;
  reserved_bytes bigint;
  pending_intent_count integer;
  intent_expires_at timestamptz := now() + interval '23 hours';
begin
  if current_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if target_tenant_id is null or not exists (
    select 1 from public.tenants tenant
    where tenant.id = target_tenant_id
      and tenant.status = 'active'::public.tenant_status
  ) or not (
    private.has_tenant_role(target_tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'an active writable tenant is required' using errcode = '42501';
  end if;
  if p_idempotency_key is null
    or length(normalized_title) not between 2 and 120
    or p_expected_mime_type not in ('video/mp4', 'video/webm')
    or p_expected_size_bytes is null
    or p_expected_size_bytes not between 1 and 524288000
    or (
      p_expected_mime_type = 'video/mp4'
      and normalized_file_name !~ '^[a-z0-9][a-z0-9_-]{0,79}\.mp4$'
    )
    or (
      p_expected_mime_type = 'video/webm'
      and normalized_file_name !~ '^[a-z0-9][a-z0-9_-]{0,79}\.webm$'
    )
  then
    raise exception 'video upload intent is invalid' using errcode = '22023';
  end if;

  select session.* into existing_session
  from public.media_upload_sessions session
  where session.tenant_id = target_tenant_id
    and session.created_by = current_user_id
    and session.idempotency_key = p_idempotency_key
  for update;
  if found then
    select asset.* into existing_asset
    from public.media_assets asset
    where asset.tenant_id = existing_session.tenant_id
      and asset.id = existing_session.asset_id;
    if existing_session.status <> 'pending'::public.media_upload_session_status
      or existing_session.expires_at <= now()
      or existing_session.expected_mime_type is distinct from p_expected_mime_type
      or existing_session.expected_size_bytes is distinct from p_expected_size_bytes
      or existing_asset.original_file_name is distinct from normalized_file_name
      or existing_asset.title is distinct from normalized_title
    then
      raise exception 'idempotency key belongs to another or expired upload intent'
        using errcode = '23505';
    end if;
    return query select
      existing_session.asset_id,
      existing_session.id,
      existing_session.storage_bucket,
      existing_session.storage_path,
      existing_session.expires_at,
      true;
    return;
  end if;

  select tenant.media_storage_limit_bytes into tenant_limit
  from public.tenants tenant
  where tenant.id = target_tenant_id
  for update;
  select count(*)::integer into pending_intent_count
  from public.media_upload_sessions session
  where session.tenant_id = target_tenant_id
    and session.created_by = current_user_id
    and session.status = 'pending'::public.media_upload_session_status
    and session.expires_at > now();
  if pending_intent_count >= 5 then
    raise exception 'actor has too many pending media upload intents' using errcode = '54000';
  end if;
  select coalesce(sum(asset.file_size_bytes), 0)::bigint into reserved_bytes
  from public.media_assets asset
  where asset.tenant_id = target_tenant_id
    and asset.deleted_at is null
    and asset.status <> 'deleted'::public.media_asset_status;
  if reserved_bytes + p_expected_size_bytes > tenant_limit then
    raise exception 'tenant media storage quota would be exceeded' using errcode = '53100';
  end if;

  new_path := 'tenants/' || target_tenant_id::text || '/assets/' ||
    new_asset_id::text || '/original/' || normalized_file_name;
  insert into public.media_assets (
    id, tenant_id, created_by, kind, title, original_file_name, mime_type,
    status, storage_bucket, storage_path, file_size_bytes
  ) values (
    new_asset_id, target_tenant_id, current_user_id, 'video', normalized_title,
    normalized_file_name, p_expected_mime_type, 'uploading', 'tenant-media',
    new_path, p_expected_size_bytes
  );
  insert into public.media_upload_sessions (
    id, tenant_id, asset_id, created_by, status, storage_bucket, storage_path,
    expected_mime_type, expected_size_bytes, expires_at, upload_protocol,
    idempotency_key
  ) values (
    new_session_id, target_tenant_id, new_asset_id, current_user_id, 'pending',
    'tenant-media', new_path, p_expected_mime_type, p_expected_size_bytes,
    intent_expires_at, 'tus', p_idempotency_key
  );
  perform private.audit_event(
    target_tenant_id, 'media.upload.intent_created', 'media_assets',
    new_asset_id, 'success', jsonb_build_object(
      'assetId', new_asset_id,
      'protocol', 'tus',
      'expectedMimeType', p_expected_mime_type,
      'expectedSizeBytes', p_expected_size_bytes
    )
  );
  return query select
    new_asset_id, new_session_id, 'tenant-media'::text,
    new_path, intent_expires_at, false;
end;
$$;

create or replace function public.finalize_media_video_upload(
  p_upload_session_id uuid
)
returns table(asset_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload_session public.media_upload_sessions%rowtype;
  media_asset public.media_assets%rowtype;
  storage_object storage.objects%rowtype;
  processing_job_id uuid;
  storage_size_text text;
  storage_mime_type text;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  select session.* into upload_session
  from public.media_upload_sessions session
  where session.id = p_upload_session_id
  for update;
  if not found then
    raise exception 'upload session was not found' using errcode = 'P0002';
  end if;
  if not (
    private.has_tenant_role(upload_session.tenant_id, array[
      'tenant_owner', 'tenant_admin', 'tenant_editor'
    ]::public.tenant_role[])
    or private.is_platform_member(array[
      'platform_owner', 'platform_admin'
    ]::public.platform_role[])
  ) then
    raise exception 'upload session is outside the writable tenant scope'
      using errcode = '42501';
  end if;
  select asset.* into media_asset
  from public.media_assets asset
  where asset.tenant_id = upload_session.tenant_id
    and asset.id = upload_session.asset_id
  for update;
  if not found
    or media_asset.kind <> 'video'::public.media_asset_kind
    or media_asset.mime_type not in ('video/mp4', 'video/webm')
  then
    raise exception 'upload session does not reference a supported video'
      using errcode = '22023';
  end if;
  if upload_session.status = 'uploaded'::public.media_upload_session_status then
    select job.id into processing_job_id
    from public.media_processing_jobs job
    where job.tenant_id = upload_session.tenant_id
      and job.asset_id = upload_session.asset_id
      and job.status in (
        'queued'::public.media_processing_job_status,
        'processing'::public.media_processing_job_status
      )
    order by job.created_at desc
    limit 1;
    if processing_job_id is null then
      raise exception 'finalized upload has no active processing job'
        using errcode = '55000';
    end if;
    return query select upload_session.asset_id, processing_job_id;
    return;
  end if;
  if upload_session.status <> 'pending'::public.media_upload_session_status
    or upload_session.expires_at <= now()
    or media_asset.status <> 'uploading'::public.media_asset_status
  then
    raise exception 'upload session is no longer pending' using errcode = '55000';
  end if;
  select object.* into storage_object
  from storage.objects object
  where object.bucket_id = upload_session.storage_bucket
    and object.name = upload_session.storage_path;
  if not found then
    raise exception 'uploaded storage object was not found' using errcode = 'P0002';
  end if;
  storage_size_text := storage_object.metadata ->> 'size';
  storage_mime_type := coalesce(
    storage_object.metadata ->> 'mimetype',
    storage_object.metadata ->> 'contentType'
  );
  if storage_size_text is null
    or storage_size_text !~ '^[0-9]+$'
    or storage_size_text::bigint <> upload_session.expected_size_bytes
    or storage_size_text::bigint <> media_asset.file_size_bytes
    or storage_mime_type is distinct from upload_session.expected_mime_type
    or storage_mime_type is distinct from media_asset.mime_type
  then
    raise exception 'uploaded storage metadata does not match the session'
      using errcode = '22023';
  end if;
  update public.media_upload_sessions
  set status = 'uploaded'::public.media_upload_session_status,
      completed_at = now()
  where id = upload_session.id;
  update public.media_assets
  set status = 'processing'::public.media_asset_status,
      validation_error = null
  where tenant_id = upload_session.tenant_id
    and id = upload_session.asset_id;
  insert into public.media_processing_jobs (tenant_id, asset_id, requested_by)
  values (upload_session.tenant_id, upload_session.asset_id, current_user_id)
  returning id into processing_job_id;
  return query select upload_session.asset_id, processing_job_id;
end;
$$;

revoke all on function public.create_media_video_upload_intent(
  uuid, text, text, text, bigint, uuid
) from public, anon;
revoke all on function public.finalize_media_video_upload(uuid)
  from public, anon;
grant execute on function public.create_media_video_upload_intent(
  uuid, text, text, text, bigint, uuid
) to authenticated;
grant execute on function public.finalize_media_video_upload(uuid)
  to authenticated;

-- A ready animation/video always has both a silent MP4 delivery rendition and
-- an immutable PNG poster. The existing thumbnail variant is the canonical
-- poster slot so older readers continue to understand the asset. Keep the
-- nine-argument legacy overload available during a rolling worker deployment;
-- new workers resolve this overload by its three additional poster arguments.

create function public.complete_media_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_original_checksum_sha256 text,
  p_player_storage_path text,
  p_player_checksum_sha256 text,
  p_player_file_size_bytes bigint,
  p_poster_storage_path text,
  p_poster_checksum_sha256 text,
  p_poster_file_size_bytes bigint,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_job public.media_processing_jobs%rowtype;
  media_asset public.media_assets%rowtype;
  expected_player_path text;
  expected_poster_path text;
begin
  select job.* into processing_job
  from public.media_processing_jobs job
  where job.id = p_job_id
  for update;
  if not found
    or processing_job.status <> 'processing'::public.media_processing_job_status
    or processing_job.locked_by is distinct from nullif(btrim(p_worker_id), '')
  then
    raise exception 'processing job is not owned by this worker' using errcode = '42501';
  end if;

  select asset.* into media_asset
  from public.media_assets asset
  where asset.tenant_id = processing_job.tenant_id
    and asset.id = processing_job.asset_id
    and asset.kind = 'video'::public.media_asset_kind
    and asset.mime_type in ('image/gif', 'video/mp4', 'video/webm')
    and asset.status = 'processing'::public.media_asset_status
  for update;
  if not found then
    raise exception 'processing asset is unavailable' using errcode = '23514';
  end if;

  expected_player_path := 'tenants/' || processing_job.tenant_id::text ||
    '/assets/' || processing_job.asset_id::text || '/variants/player-1080p.mp4';
  expected_poster_path := 'tenants/' || processing_job.tenant_id::text ||
    '/assets/' || processing_job.asset_id::text || '/variants/poster.png';
  if p_original_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_player_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_poster_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or p_player_storage_path is distinct from expected_player_path
    or p_poster_storage_path is distinct from expected_poster_path
    or p_player_file_size_bytes <= 0
    or p_poster_file_size_bytes <= 0
    or p_width <= 0 or p_height <= 0
    or greatest(p_width, p_height) > 1920
    or least(p_width, p_height) > 1080
    or p_duration_seconds <= 0
    or (media_asset.mime_type = 'image/gif' and p_duration_seconds > 60)
    or (media_asset.mime_type <> 'image/gif' and p_duration_seconds > 300)
  then
    raise exception 'processed variant metadata is invalid' using errcode = '23514';
  end if;

  insert into public.media_variants (
    tenant_id, asset_id, variant_type, storage_bucket, storage_path, mime_type,
    file_size_bytes, checksum_sha256, width, height, duration_seconds
  ) values
    (
      processing_job.tenant_id, processing_job.asset_id, 'original',
      media_asset.storage_bucket, media_asset.storage_path, media_asset.mime_type,
      media_asset.file_size_bytes, p_original_checksum_sha256,
      null, null, p_duration_seconds
    ),
    (
      processing_job.tenant_id, processing_job.asset_id, 'player_1080p',
      media_asset.storage_bucket, p_player_storage_path, 'video/mp4',
      p_player_file_size_bytes, p_player_checksum_sha256,
      p_width, p_height, p_duration_seconds
    ),
    (
      processing_job.tenant_id, processing_job.asset_id, 'thumbnail',
      media_asset.storage_bucket, p_poster_storage_path, 'image/png',
      p_poster_file_size_bytes, p_poster_checksum_sha256,
      p_width, p_height, null
    )
  on conflict (tenant_id, asset_id, variant_type) do update set
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size_bytes = excluded.file_size_bytes,
    checksum_sha256 = excluded.checksum_sha256,
    width = excluded.width,
    height = excluded.height,
    duration_seconds = excluded.duration_seconds;

  update public.media_assets set
    checksum_sha256 = p_original_checksum_sha256,
    width = p_width,
    height = p_height,
    duration_seconds = p_duration_seconds,
    status = 'ready',
    validation_error = null,
    processed_at = now()
  where tenant_id = processing_job.tenant_id and id = processing_job.asset_id;
  update public.media_processing_jobs set
    status = 'completed', locked_at = null, locked_by = null,
    finished_at = now(), error_code = null, error_message = null
  where id = processing_job.id;
end;
$$;

revoke all on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, text, text, bigint,
  integer, integer, numeric
) from public, anon, authenticated;
grant execute on function public.complete_media_processing_job(
  uuid, text, text, text, text, bigint, text, text, bigint,
  integer, integer, numeric
) to service_role;
