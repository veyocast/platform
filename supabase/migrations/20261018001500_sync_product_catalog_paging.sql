-- A bounded read projection; existing guarded catalog commands remain the writers.
create index if not exists tenant_products_sync_catalog_idx
  on public.tenant_products(tenant_id, active desc, category, name, id)
  where deleted_at is null;

create function public.list_sync_products_v1(
  p_tenant_id uuid,
  p_query text default '',
  p_category text default '',
  p_availability text default 'all',
  p_offset integer default 0
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb; pattern text;
begin
  if p_tenant_id is null or p_query is null or length(p_query)>120
    or p_category is null or length(p_category)>160
    or p_availability is null or p_availability not in ('all','active','inactive')
    or p_offset is null or p_offset<0 or p_offset>100000 then
    raise exception 'Invalid product catalog filters' using errcode='22023';
  end if;
  -- Search values are SQL parameters. Wildcards in user input are literal.
  pattern := '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  with base as not materialized (
    select id, data_source_id, slug, name, description, category, price_cents,
      vat_rate, unit, barcode, source_external_id, custom_fields,
      image_media_asset_id, active, revision, updated_at
    from public.tenant_products
    where tenant_id=p_tenant_id and deleted_at is null
  ), filtered as not materialized (
    select * from base
    where (p_category='' or category=p_category)
      and (p_availability='all' or active=(p_availability='active'))
      and (btrim(p_query)='' or name ilike pattern or category ilike pattern or source_external_id ilike pattern)
  ), page as (
    select * from filtered
    order by active desc, category asc nulls last, name asc, id asc
    limit 50 offset p_offset
  ), categories as (
    select distinct category from base where category is not null and category<>''
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(page) order by active desc,category asc nulls last,name asc,id asc) from page),'[]'::jsonb),
    'count',(select count(*) from filtered),
    'total',(select count(*) from base),
    'active',(select count(*) from base where active),
    'categories',coalesce((select jsonb_agg(category order by category) from (select category from categories order by category limit 200) c),'[]'::jsonb),
    'categoriesComplete',(select count(*)<=200 from categories),
    'offset',p_offset,'pageSize',50
  ) into result;
  return result;
end;
$$;
revoke all on function public.list_sync_products_v1(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_sync_products_v1(uuid,text,text,text,integer) to authenticated;
comment on function public.list_sync_products_v1(uuid,text,text,text,integer) is
  'S226 bounded catalog search and exact tenant totals; SECURITY INVOKER retains product RLS, no mutation or service-role bypass.';
