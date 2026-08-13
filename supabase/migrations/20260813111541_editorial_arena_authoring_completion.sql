-- S101 authoring completion: a manually composed two-column price list is
-- resolved tenant-side and frozen into the immutable snapshot. The editorial
-- configuration (including category overrides and focal points) was already
-- frozen by editorial_arena_slide_suite_v2; this wrapper guarantees that its
-- referenced product set is the exact product set rendered by Player.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_editorial_authoring_v2;

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
  configured jsonb;
  configured_products jsonb;
  requested_count integer;
  distinct_count integer;
  resolved_count integer;
begin
  result :=
    private.build_dynamic_snapshot_data_before_editorial_authoring_v2(
      p_slide
    );
  configured := p_slide.configuration_json #> '{editorial,priceList}';

  if p_slide.slide_type <> 'menu' or jsonb_typeof(configured) <> 'object' then
    return result;
  end if;

  if jsonb_typeof(configured #> '{columns,left}') <> 'array'
    or jsonb_typeof(configured #> '{columns,right}') <> 'array'
  then
    raise exception 'invalid editorial price-list columns'
      using errcode = '22023';
  end if;

  with entries as (
    select item, 0 as column_order, ordinal
    from jsonb_array_elements(configured #> '{columns,left}')
      with ordinality as entry(item, ordinal)
    union all
    select item, 1 as column_order, ordinal
    from jsonb_array_elements(configured #> '{columns,right}')
      with ordinality as entry(item, ordinal)
  ), requested as (
    select item ->> 'productId' as product_id
    from entries
    where item ->> 'kind' = 'product'
  )
  select count(*), count(distinct product_id)
  into requested_count, distinct_count
  from requested;

  if requested_count = 0 then
    return result;
  end if;

  if requested_count > 40 or requested_count <> distinct_count
  then
    raise exception 'invalid editorial price-list product selection'
      using errcode = '22023';
  end if;

  with entries as (
    select item, 0 as column_order, ordinal
    from jsonb_array_elements(configured #> '{columns,left}')
      with ordinality as entry(item, ordinal)
    union all
    select item, 1 as column_order, ordinal
    from jsonb_array_elements(configured #> '{columns,right}')
      with ordinality as entry(item, ordinal)
  ), requested as (
    select
      item ->> 'productId' as product_id,
      column_order,
      ordinal
    from entries
    where item ->> 'kind' = 'product'
  ), resolved as (
    select product.*, requested.column_order, requested.ordinal
    from requested
    join public.tenant_products product
      on product.id::text = requested.product_id
      and product.tenant_id = p_slide.tenant_id
      and product.active
      and product.available
      and (
        product.data_source_id = p_slide.data_source_id
        or (
          product.data_source_id is null
          and exists (
            select 1
            from public.dynamic_data_sources source
            where source.id = p_slide.data_source_id
              and source.tenant_id = p_slide.tenant_id
              and source.kind in ('manual_products', 'twelve_excel')
          )
        )
      )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
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
    ) order by product.column_order, product.ordinal), '[]'::jsonb),
    count(*)
  into configured_products, resolved_count
  from resolved product;

  if resolved_count <> requested_count then
    raise exception 'editorial price-list contains unavailable or foreign products'
      using errcode = '22023';
  end if;

  return jsonb_set(result, '{menu,products}', configured_products, false);
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function
  private.build_dynamic_snapshot_data_before_editorial_authoring_v2(
    public.dynamic_slides
  ) from public, anon, authenticated;
