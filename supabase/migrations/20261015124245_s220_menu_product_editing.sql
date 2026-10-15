-- S220: product-local amount overrides and unrestricted free presentation copy.
-- No table, RLS policy, immutable release or catalog ownership changes.
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
    jsonb_typeof(p_value -> 'label') is distinct from 'string'
    or length(btrim(coalesce(p_value ->> 'label', ''))) < 1
    or coalesce(p_value ->> 'label', '') ~ '[[:cntrl:]]'
    or p_value ?| array[
      'productRef', 'price', 'snapshotFallback', 'availability',
      'providerConnectionId', 'mediaOverrideAssetId'
    ]
  ) then
    raise exception 'free menu line contains product semantics' using errcode = '22023';
  end if;

  -- Only a product placement may override its amount. Catalog currency, tax
  -- metadata and source snapshots continue to be resolved server-side.
  if p_value ? 'priceOverrideMinor' and p_value -> 'priceOverrideMinor' <> 'null'::jsonb then
    if p_value ->> 'kind' is distinct from 'product'
      or jsonb_typeof(p_value -> 'priceOverrideMinor') is distinct from 'number'
    then
      raise exception 'menu product price override is invalid' using errcode = '22023';
    end if;
    if (p_value ->> 'priceOverrideMinor')::numeric < 0
      or (p_value ->> 'priceOverrideMinor')::numeric > 999999999
      or trunc((p_value ->> 'priceOverrideMinor')::numeric) <> (p_value ->> 'priceOverrideMinor')::numeric
    then
      raise exception 'menu product price override is invalid' using errcode = '22023';
    end if;
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

revoke all on function private.validate_menu_node_v2(jsonb) from public, anon, authenticated, service_role;
