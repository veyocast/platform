-- S191 product commands: catalog changes stay tenant scoped and leave frozen
-- MenuDocument/publication fallbacks intact. Removal archives the provider row.
alter table public.tenant_products add column deleted_at timestamptz;
create index tenant_products_visible_tenant_idx on public.tenant_products(tenant_id,category,name) where deleted_at is null;
create or replace function private.restore_product_after_provider_import_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.deleted_at is not null and new.last_import_id is distinct from old.last_import_id and new.last_import_id is not null and new.active then new.deleted_at:=null;end if;
  return new;
end;$$;
create trigger tenant_products_restore_explicit_import before update on public.tenant_products for each row execute function private.restore_product_after_provider_import_v1();
revoke all on function private.restore_product_after_provider_import_v1() from public,anon,authenticated,service_role;
create function public.manage_tenant_product_v2(p_tenant_id uuid,p_product_id uuid,p_data_source_id uuid,p_expected_revision bigint,p_action text,p_values jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();product public.tenant_products%rowtype;source public.dynamic_data_sources%rowtype;request jsonb;result jsonb;name_value text;external_value text;product_id uuid;price_value integer;vat_value numeric;active_value boolean;
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.product.write')then raise exception 'product write permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_action not in('create','update','delete')or p_action is null or p_idempotency_key is null or p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_values)is distinct from'object'or octet_length(p_values::text)>8192 then raise exception 'invalid product command'using errcode='22023';end if;
  if exists(select 1 from jsonb_object_keys(p_values)key where key not in('name','description','category','priceCents','vatRate','unit','barcode','externalId','active'))then raise exception 'unknown product fields'using errcode='23514';end if;
  if p_action='delete'and p_values<>'{}'::jsonb then raise exception 'delete has no product values'using errcode='23514';end if;
  request:=jsonb_build_object('productId',p_product_id,'dataSourceId',p_data_source_id,'expectedRevision',p_expected_revision,'action',p_action,'values',p_values);
  result:=private.begin_publisher_command(p_tenant_id,'product.catalog.command',p_idempotency_key,request);if result is not null then return result;end if;
  if p_action='create'then
    if p_product_id is not null or p_expected_revision<>0 then raise exception 'invalid create revision'using errcode='23514';end if;
    select *into source from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_data_source_id and kind='manual_products'and status='active'for update;
    if not found then raise exception 'active manual product source required'using errcode='23514';end if;
  else
    select *into product from public.tenant_products where tenant_id=p_tenant_id and id=p_product_id for update;
    if not found then raise exception 'product unavailable'using errcode='42501';end if;
    if p_data_source_id is not null and product.data_source_id is distinct from p_data_source_id then raise exception 'product source cannot change'using errcode='23514';end if;
    if product.revision<>p_expected_revision then
      result:=jsonb_build_object('outcome','conflict','productId',product.id,'actualRevision',product.revision);
      return private.complete_publisher_command(p_tenant_id,'product.catalog.command',p_idempotency_key,request,'tenant_products',product.id,result,'product.catalog.conflict','failed');
    end if;
    if product.deleted_at is not null then raise exception 'product was removed'using errcode='23514';end if;
  end if;
  if p_action='delete'then
    update public.tenant_products set active=false,available=false,archived_at=coalesce(archived_at,clock_timestamp()),deleted_at=clock_timestamp(),revision=revision+1,updated_by=actor where tenant_id=p_tenant_id and id=product.id;
    result:=jsonb_build_object('outcome','archived','productId',product.id,'revision',product.revision+1,'frozenPublicationsPreserved',true);
    return private.complete_publisher_command(p_tenant_id,'product.catalog.command',p_idempotency_key,request,'tenant_products',product.id,result,'product.catalog.removed');
  end if;
  name_value:=btrim(p_values->>'name');external_value:=nullif(btrim(p_values->>'externalId'),'');
  if jsonb_typeof(p_values->'name')is distinct from'string'or length(coalesce(name_value,''))not between 1 and 160
    or coalesce(jsonb_typeof(p_values->'active'),'null')<>'boolean'
    or coalesce(jsonb_typeof(p_values->'priceCents'),'null')not in('number','null')
    or coalesce(jsonb_typeof(p_values->'vatRate'),'null')not in('number','null')then raise exception 'invalid typed product values'using errcode='23514';end if;
  if exists(select 1 from jsonb_each(p_values)field where field.key in('description','category','unit','barcode','externalId')and jsonb_typeof(field.value)not in('string','null'))then raise exception 'invalid product text'using errcode='23514';end if;
  if length(coalesce(p_values->>'description',''))>1000 or length(coalesce(p_values->>'category',''))>160 or length(coalesce(p_values->>'unit',''))>80 or length(coalesce(p_values->>'barcode',''))>80 or length(coalesce(external_value,''))>160 then raise exception 'product text too long'using errcode='23514';end if;
  if p_values->>'priceCents'is not null then
    if(p_values->>'priceCents')!~'^[0-9]+$'or(p_values->>'priceCents')::numeric>100000000 then raise exception 'integer product price required'using errcode='23514';end if;price_value:=(p_values->>'priceCents')::integer;
  end if;
  if p_values->>'vatRate'is not null then vat_value:=(p_values->>'vatRate')::numeric;if vat_value not between 0 and 100 or round(vat_value,2)<>vat_value then raise exception 'invalid product VAT'using errcode='23514';end if;end if;
  active_value:=(p_values->>'active')::boolean;
  -- The existing case-sensitive provider key stays unchanged. Its normalized
  -- counterpart is checked under the source lock to prevent duplicate articles.
  if p_action='update'and product.data_source_id is not null then perform 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=product.data_source_id for update;end if;
  if external_value is not null and exists(select 1 from public.tenant_products other where other.tenant_id=p_tenant_id and other.data_source_id is not distinct from coalesce(source.id,product.data_source_id)and other.id is distinct from product.id and lower(btrim(other.source_external_id))=lower(external_value))then raise exception 'article number already used'using errcode='23505';end if;
  if p_action='create'then
    product_id:=gen_random_uuid();
    insert into public.tenant_products(id,tenant_id,data_source_id,source,source_external_id,slug,name,description,category,price_cents,vat_rate,unit,barcode,active,available,archived_at,revision,created_by,updated_by)
    values(product_id,p_tenant_id,source.id,'manual',external_value,'product-'||replace(product_id::text,'-',''),name_value,nullif(btrim(p_values->>'description'),''),nullif(btrim(p_values->>'category'),''),price_value,vat_value,nullif(btrim(p_values->>'unit'),''),nullif(btrim(p_values->>'barcode'),''),active_value,active_value,case when active_value then null else clock_timestamp()end,1,actor,actor);
    result:=jsonb_build_object('outcome','created','productId',product_id,'revision',1);
  else
    update public.tenant_products set name=name_value,description=nullif(btrim(p_values->>'description'),''),category=nullif(btrim(p_values->>'category'),''),price_cents=price_value,vat_rate=vat_value,unit=nullif(btrim(p_values->>'unit'),''),barcode=nullif(btrim(p_values->>'barcode'),''),source_external_id=external_value,active=active_value,available=active_value,archived_at=case when active_value then null else coalesce(archived_at,clock_timestamp())end,revision=revision+1,updated_by=actor where tenant_id=p_tenant_id and id=product.id;
    product_id:=product.id;result:=jsonb_build_object('outcome','updated','productId',product.id,'revision',product.revision+1);
  end if;
  return private.complete_publisher_command(p_tenant_id,'product.catalog.command',p_idempotency_key,request,'tenant_products',product_id,result,'product.catalog.saved');
end;$$;
revoke all on function public.manage_tenant_product_v2(uuid,uuid,uuid,bigint,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.manage_tenant_product_v2(uuid,uuid,uuid,bigint,text,jsonb,uuid)to authenticated;
notify pgrst,'reload schema';
