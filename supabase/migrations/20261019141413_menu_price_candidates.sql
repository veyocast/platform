-- S261: prices are approved authoring facts, not a live catalogue field.
-- Existing snapshots/releases remain immutable. No new table or device writer.

create function private.menu_price_hash_v1(p_value jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')
$$;

create function private.assert_menu_price_set_v1(p_tenant_id uuid,p_source_id uuid,p_set jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare proof jsonb;entry record;
begin
 if jsonb_typeof(p_set) is distinct from 'object' or octet_length(p_set::text)>20000
   or (select count(*)from jsonb_object_keys(p_set))<>7
   or p_set->>'schemaVersion'<>'1' or p_set->>'origin' not in('catalog','frozen-display')
   or p_set->>'dataSourceId' is distinct from p_source_id::text
   or coalesce(p_set->>'captureActorId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or coalesce(p_set->>'captureKey','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or coalesce(p_set->>'hash','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(p_set->'prices') is distinct from 'object'
   or (select count(*)from jsonb_object_keys(p_set->'prices'))>200
 then raise exception 'menu price set is invalid'using errcode='22023';end if;
 for entry in select key,value from jsonb_each(p_set->'prices')loop
  if entry.key!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or jsonb_typeof(entry.value)<>'number' or entry.value::text!~'^[0-9]{1,9}$'
    or entry.value::numeric>999999999 then raise exception 'menu price value is invalid'using errcode='22023';end if;
 end loop;
 if p_set->>'hash' is distinct from private.menu_price_hash_v1(p_set-'hash')then
  raise exception 'menu price set hash is invalid'using errcode='22023';end if;
 -- A self-consistent client hash is not authority. This exact set must already
 -- have been written by our private capture command in this tenant transaction.
 select receipt.outcome_json->'priceSet' into proof from public.publisher_command_receipts receipt
 where receipt.tenant_id=p_tenant_id and receipt.command_type='menu.price.capture.v1'
  and receipt.actor_user_id=(p_set->>'captureActorId')::uuid
  and receipt.idempotency_key=(p_set->>'captureKey')::uuid;
 if proof is distinct from p_set or not exists(select 1 from public.dynamic_data_sources
   where tenant_id=p_tenant_id and id=p_source_id)then
  raise exception 'menu price set has no tenant authority'using errcode='42501';end if;
end;$$;

create function private.capture_menu_price_set_v1(p_tenant_id uuid,p_source_id uuid,p_prices jsonb,p_origin text default 'catalog')returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();key uuid:=gen_random_uuid();price_set jsonb;request jsonb;entry record;
begin
 if actor is null or not(private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')or(p_origin='frozen-display'and private.has_tenant_capability(p_tenant_id,'tenant.playlist.write')))then
  raise exception 'menu price capture requires authoring permission'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_origin not in('catalog','frozen-display')or jsonb_typeof(p_prices) is distinct from 'object'
  or (select count(*)from jsonb_object_keys(p_prices))>200 or octet_length(p_prices::text)>16000
  or not exists(select 1 from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_source_id and status<>'archived')then
  raise exception 'menu price capture is invalid'using errcode='22023';end if;
 for entry in select e.key,e.value from jsonb_each(p_prices)as e loop
  if entry.key!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or jsonb_typeof(entry.value)<>'number'
   or entry.value::text!~'^[0-9]{1,9}$'or not exists(select 1 from public.tenant_products
    where tenant_id=p_tenant_id and id=entry.key::uuid and(data_source_id=p_source_id or data_source_id is null))then
   raise exception 'menu price product is outside source'using errcode='42501';end if;
 end loop;
 price_set:=jsonb_build_object('schemaVersion',1,'origin',p_origin,'dataSourceId',p_source_id,
  'captureActorId',actor,'captureKey',key,'prices',p_prices);
 price_set:=price_set||jsonb_build_object('hash',private.menu_price_hash_v1(price_set));
 request:=jsonb_build_object('sourceId',p_source_id,'origin',p_origin,'prices',p_prices);
 -- Commit is still the caller's transaction. A later CAS/render failure rolls
 -- this receipt back too; no external completion can escape before commit.
 perform private.complete_publisher_command(p_tenant_id,'menu.price.capture.v1',key,request,
  'dynamic_data_sources',p_source_id,jsonb_build_object('priceSet',price_set),'menu.price.captured');
 perform private.assert_menu_price_set_v1(p_tenant_id,p_source_id,price_set);
 return price_set;
end;$$;

-- Price overlay follows stable placement/product identities. An item with no
-- approved old price returns SQL NULL and is omitted from its array only.
-- All other current fields (including availability/name/image) remain live.
create function private.pin_menu_prices_v1(p_live jsonb,p_frozen jsonb)returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;entry record;old jsonb;patched jsonb;identity text;money_key text;
begin
 if jsonb_typeof(p_live)='array'then
  result:='[]'::jsonb;
  for entry in select value,ordinality from jsonb_array_elements(p_live)with ordinality loop
   old:=null;identity:=coalesce(entry.value->>'id',entry.value->>'productId',entry.value#>>'{productRef,productId}');
   if jsonb_typeof(p_frozen)='array'then
    if identity is not null then
     select value into old from jsonb_array_elements(p_frozen)where coalesce(value->>'id',value->>'productId',value#>>'{productRef,productId}')=identity limit 1;
    else old:=p_frozen->(entry.ordinality::integer-1);end if;
   end if;
   patched:=private.pin_menu_prices_v1(entry.value,old);
   if patched is not null then result:=result||jsonb_build_array(patched);end if;
  end loop;
  return result;
 end if;
 if jsonb_typeof(p_live) is distinct from 'object'then return p_live;end if;
 result:=p_live;
 if p_live?'priceMinor'and p_live?'id'then
  if jsonb_typeof(p_frozen->'priceMinor')is distinct from 'number'or p_frozen->>'currency'is distinct from 'EUR'then return null;end if;
  if(p_frozen->>'priceMinor')::numeric<>trunc((p_frozen->>'priceMinor')::numeric)or(p_frozen->>'priceMinor')::numeric not between 0 and 999999999 then return null;end if;
  result:=jsonb_set(jsonb_set(result,'{priceMinor}',p_frozen->'priceMinor'),'{currency}',p_frozen->'currency');
  foreach money_key in array array['unit','unitKey','vatRate','vatRateBps','taxMode','taxRateBps']loop
   if p_frozen?money_key then result:=jsonb_set(result,array[money_key],p_frozen->money_key);else result:=result-money_key;end if;
  end loop;
 elsif p_live?'formattedPrice'and p_live?'productId'then
  if coalesce(p_frozen->>'formattedPrice','')!~'^€[[:space:]]*[0-9]{1,7},[0-9]{2}$'then return null;end if;
  result:=jsonb_set(result,'{formattedPrice}',p_frozen->'formattedPrice');
 elsif p_live->>'kind'in('product','linked-product')then
  if jsonb_typeof(p_frozen#>'{snapshotFallback,price}')is distinct from 'object'or jsonb_typeof(p_frozen#>'{snapshotFallback,price,amountMinor}')is distinct from 'number'then return null;end if;
  result:=jsonb_set(result,'{snapshotFallback,price}',p_frozen#>'{snapshotFallback,price}');
 end if;
 if p_live->>'kind'='product-group'and p_frozen?'sharedPrice'then
  result:=jsonb_set(result,'{sharedPrice}',p_frozen->'sharedPrice');end if;
 for entry in select key,value from jsonb_each(result)loop
  if jsonb_typeof(entry.value)in('object','array')and entry.key not in('price','sharedPrice')then
   patched:=private.pin_menu_prices_v1(entry.value,p_frozen->entry.key);
   if patched is not null then result:=jsonb_set(result,array[entry.key],patched);else result:=result-entry.key;end if;
  end if;
 end loop;
 return result;
end;$$;

create function private.apply_menu_price_set_v1(p_value jsonb,p_prices jsonb,p_configuration jsonb,p_shared boolean default false)returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=p_value;entry record;patched jsonb;amount jsonb;override boolean:=p_shared;
begin
 if jsonb_typeof(p_value)='array'then
  result:='[]'::jsonb;for entry in select value from jsonb_array_elements(p_value)loop
   patched:=private.apply_menu_price_set_v1(entry.value,p_prices,p_configuration,p_shared);
   if patched is not null then result:=result||jsonb_build_array(patched);end if;
  end loop;return result;
 end if;
 if jsonb_typeof(p_value) is distinct from 'object'then return p_value;end if;
 if p_value?'id'and p_value?'priceMinor'then
  amount:=p_prices->(p_value->>'id');if amount is null then return null;end if;
  result:=jsonb_set(jsonb_set(result,'{priceMinor}',amount),'{currency}','"EUR"'::jsonb);
 elsif p_value?'productId'and p_value?'formattedPrice'then
  select exists(select 1 from private.sites_json_nodes_v1(p_configuration)as nodes(value)
   where value->>'id'=p_value->>'id'and value->'priceCentsOverride'is not null and value->'priceCentsOverride'<>'null'::jsonb)into override;
  if not override then
   amount:=p_prices->(p_value->>'productId');if amount is null then return null;end if;
   result:=jsonb_set(result,'{formattedPrice}',to_jsonb('€ '||replace(to_char(amount::numeric/100,'FM999999990.00'),'.',',')));
  end if;
 end if;
 for entry in select key,value from jsonb_each(result)loop
  if jsonb_typeof(entry.value)in('object','array')then
   patched:=private.apply_menu_price_set_v1(entry.value,p_prices,p_configuration,override);
   if patched is not null then result:=jsonb_set(result,array[entry.key],patched);else result:=result-entry.key;end if;
  end if;
 end loop;
 return result;
end;$$;

create function private.resolve_menu_render_prices_v1(p_tenant_id uuid,p_source_id uuid,p_document jsonb)returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return private.pin_menu_prices_v1(private.resolve_menu_document_v2(p_tenant_id,p_source_id,p_document),p_document);
end;$$;

-- All existing MenuDoc writers share this validator. Reserve Source/runtime
-- price fields before the unchanged older validator chain can persist them.
do $migration$
declare definition text;marker text:=' perform private.validate_menu_document_before_widgets_v1(p_tenant_id,p_data_source_id,p_document);';
begin
 select pg_get_functiondef('private.validate_menu_document_v2(uuid,uuid,jsonb)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'S261 MenuDoc perimeter precondition failed';end if;
 execute replace(definition,marker,$guard$ if p_document ?| array['menuApprovedPrices','menuRuntimePriceSnapshotId','menuPriceSet','menuPriceSourceReview']then
  raise exception 'Source runtime price fields cannot be stored in MenuDoc'using errcode='42501';end if;
$guard$||marker);
end;$migration$;

-- Only the S209 MenuDoc render resolver call changes; normal save/create source
-- resolution and the later theme/Sites wrappers keep their existing bodies.
do $migration$
declare definition text;old_call text:=E'document := private.resolve_menu_document_v2(\n    p_slide.tenant_id,\n    p_slide.data_source_id,\n    p_slide.configuration_json\n  );';
begin
 select pg_get_functiondef('private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(public.dynamic_slides)'::regprocedure)into definition;
 if (length(definition)-length(replace(definition,old_call,'')))/length(old_call)<>1 then
  raise exception 'S261 MenuDoc render resolver precondition failed';end if;
 execute replace(definition,old_call,replace(old_call,'private.resolve_menu_document_v2','private.resolve_menu_render_prices_v1'));
end;$migration$;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)rename to build_dynamic_snapshot_before_s261_prices_v1;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;price_set jsonb:=p_slide.configuration_json->'menuPriceSet';runtime public.dynamic_slides:=p_slide;approved jsonb;frozen public.dynamic_slide_snapshots%rowtype;
begin
 runtime.configuration_json:=runtime.configuration_json-'menuApprovedPrices';
 if price_set is not null then
  if p_slide.slide_type not in('menu','price_list')or not(p_slide.configuration_json?'syncConfiguration')then raise exception 'menu price set cannot change another slide family'using errcode='23514';end if;
  perform private.assert_menu_price_set_v1(p_slide.tenant_id,p_slide.data_source_id,price_set);
  approved:=price_set->'prices';
 end if;
 if p_slide.configuration_json?'menuRuntimePriceSnapshotId'then
  select *into frozen from public.dynamic_slide_snapshots where tenant_id=p_slide.tenant_id and data_source_id=p_slide.data_source_id
   and id=(p_slide.configuration_json->>'menuRuntimePriceSnapshotId')::uuid and status='ready';
  if frozen.id is null or p_slide.slide_type not in('menu','price_list')or not(p_slide.configuration_json?'syncConfiguration')then raise exception 'runtime menu price snapshot unavailable'using errcode='42501';end if;
  if frozen.snapshot_data_json?'menuPriceSet'then
   perform private.assert_menu_price_set_v1(p_slide.tenant_id,p_slide.data_source_id,frozen.snapshot_data_json->'menuPriceSet');
   approved:=frozen.snapshot_data_json#>'{menuPriceSet,prices}';
  else approved:=private.menu_snapshot_prices_v1(frozen.snapshot_data_json,p_slide.configuration_json);end if;
 end if;
 if approved is not null then runtime.configuration_json:=runtime.configuration_json||jsonb_build_object('menuApprovedPrices',approved);end if;
 result:=private.build_dynamic_snapshot_before_s261_prices_v1(runtime);
 if price_set is not null then
  result:=private.apply_menu_price_set_v1(result,price_set->'prices',p_slide.configuration_json)||jsonb_build_object('menuPriceSet',price_set);
 end if;
 return result;
end;$$;

-- Filter the original product query, renamed before_sportlink in20260728630000.
-- The Source typed-blueprint copy delegates through MenuDoc/Sportlink here; it
-- does not itself contain a product query. Filter before its201-row probe and
-- the outer Source200-row full-selection guard. The outer builder overwrites this
-- internal field from checked SQL authority; client values are never trusted.
do $migration$
declare definition text;marker text:='where product.tenant_id = p_slide.tenant_id';
begin
 select pg_get_functiondef('private.build_dynamic_snapshot_data_before_sportlink(public.dynamic_slides)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'S261 Source product bound precondition failed';end if;
 execute replace(definition,marker,marker||E'\n        and (not(p_slide.configuration_json ? ''menuApprovedPrices'') or (p_slide.configuration_json->''menuApprovedPrices'') ? product.id::text)');
end;$migration$;

-- Pin prices before both canonical build validation and live-data hashing.
-- Generation/leases/error handling/the existing binary enqueue remain intact.
do $migration$
declare definition text;marker text:=E'      select private.build_dynamic_snapshot_data(definition),source.revision';
begin
 select pg_get_functiondef('private.complete_published_data_before_binary_v1(uuid,uuid,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'S261 live definition precondition failed';end if;
 definition:=replace(definition,marker,$pin$      if definition.configuration_json?'syncConfiguration'and definition.slide_type in('menu','price_list')then
        definition.configuration_json:=definition.configuration_json||jsonb_build_object('menuRuntimePriceSnapshotId',frozen.id);
      end if;
      if definition.configuration_json->>'schemaVersion'='menu-document.v2' then
        definition.configuration_json:=private.pin_menu_prices_v1(definition.configuration_json,frozen.snapshot_data_json->'menuDocument');
      end if;
      select private.build_dynamic_snapshot_data(definition),source.revision$pin$);
 marker:='      hash:=private.published_data_hash_v1(dataset);';
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'S261 live hash precondition failed';end if;
 execute replace(definition,marker,$pin$      if definition.slide_type in('menu','price_list')then
        if frozen.snapshot_data_json?'menuPriceSet'then
          perform private.assert_menu_price_set_v1(p_tenant_id,frozen.data_source_id,frozen.snapshot_data_json->'menuPriceSet');
          dataset:=private.apply_menu_price_set_v1(dataset,frozen.snapshot_data_json#>'{menuPriceSet,prices}',definition.configuration_json);
        else dataset:=private.pin_menu_prices_v1(dataset,frozen.snapshot_data_json);end if;
      end if;
      hash:=private.published_data_hash_v1(dataset);$pin$);
end;$migration$;

create function private.menu_snapshot_prices_v1(p_snapshot jsonb,p_configuration jsonb)returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare prices jsonb:='{}'::jsonb;node jsonb;product_id text;amount numeric;prior jsonb;
begin
 for node in select value from private.sites_json_nodes_v1(p_snapshot)loop
  product_id:=null;amount:=null;
  if node?'id'and node?'priceMinor'and node->>'currency'='EUR'then
   if jsonb_typeof(node->'priceMinor')is distinct from 'number'then continue;end if;
   if(node->>'priceMinor')::numeric<>trunc((node->>'priceMinor')::numeric)or(node->>'priceMinor')::numeric not between 0 and 999999999 then continue;end if;
   product_id:=node->>'id';amount:=(node->>'priceMinor')::numeric;
  elsif node?'productId'and node?'formattedPrice'and node->>'formattedPrice'~'^€[[:space:]]*[0-9]{1,7},[0-9]{2}$'then
   if exists(select 1 from private.sites_json_nodes_v1(p_configuration)as cfg(value)
    where value->>'id'=node->>'id'and value->'priceCentsOverride'is not null and value->'priceCentsOverride'<>'null'::jsonb)then continue;end if;
   product_id:=node->>'productId';amount:=replace(regexp_replace(node->>'formattedPrice','^€[[:space:]]*',''),',','.')::numeric*100;
  end if;
  if product_id is not null then
   if product_id!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or amount<>trunc(amount)or amount<0 or amount>999999999 then
    raise exception 'frozen menu price cannot be represented safely'using errcode='23514';end if;
   prior:=prices->product_id;
   if prior is not null and prior<>to_jsonb(amount::bigint)then
    raise exception 'frozen menu has ambiguous catalogue prices'using errcode='23514';end if;
   prices:=prices||jsonb_build_object(product_id,amount::bigint);
  end if;
 end loop;
 return prices;
end;$$;

create function private.ensure_menu_basis_prices_v1(p_tenant_id uuid,p_basis_snapshot_id uuid,p_source_id uuid,p_configuration jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare frozen public.dynamic_slide_snapshots%rowtype;price_set jsonb;
begin
 if not(p_configuration?'syncConfiguration')or p_configuration#>>'{syncConfiguration,slideType}'not in('menu','price_list')then return p_configuration;end if;
 price_set:=p_configuration->'menuPriceSet';
 if price_set is not null then perform private.assert_menu_price_set_v1(p_tenant_id,p_source_id,price_set);return p_configuration;end if;
 select *into frozen from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_basis_snapshot_id
  and data_source_id=p_source_id and status='ready';
 if frozen.id is null then raise exception 'approved menu price basis missing'using errcode='23514';end if;
 price_set:=private.capture_menu_price_set_v1(p_tenant_id,p_source_id,private.menu_snapshot_prices_v1(frozen.snapshot_data_json,p_configuration),'frozen-display');
 return p_configuration||jsonb_build_object('menuPriceSet',price_set);
end;$$;

-- The ordinary public perimeter cannot manufacture or alter catalogue sets.
alter function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb)rename to create_dynamic_slide_before_s261_prices_v1;
alter function public.create_dynamic_slide_before_s261_prices_v1(uuid,text,uuid,uuid,text,jsonb)set schema private;
create function public.create_dynamic_slide_v1(p_tenant_id uuid,p_name text,p_template_version_id uuid,p_data_source_id uuid,p_selection_mode text default 'latest',p_configuration_json jsonb default '{}'::jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare configuration jsonb:=p_configuration_json;price_set jsonb;
begin
 if configuration?'menuPriceSet'or configuration?'menuPriceSourceReview'or configuration?'menuApprovedPrices'or configuration?'menuRuntimePriceSnapshotId'then raise exception 'client price set injection is forbidden'using errcode='42501';end if;
 if configuration?'syncConfiguration'and configuration#>>'{syncConfiguration,slideType}'in('menu','price_list')then
  if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')then raise exception 'Source menu authoring permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  price_set:=private.capture_menu_price_set_v1(p_tenant_id,p_data_source_id,private.menu_catalog_prices_v1(p_tenant_id,p_data_source_id,configuration));
  configuration:=configuration||jsonb_build_object('menuPriceSet',price_set);
 end if;
 return private.create_dynamic_slide_before_s261_prices_v1(p_tenant_id,p_name,p_template_version_id,p_data_source_id,p_selection_mode,configuration);
end;$$;

alter function public.save_dynamic_slide_version_v1(uuid,uuid,bigint,text,uuid,uuid,text,text,jsonb,jsonb)rename to save_dynamic_slide_version_before_s261_prices_v1;
alter function public.save_dynamic_slide_version_before_s261_prices_v1(uuid,uuid,bigint,text,uuid,uuid,text,text,jsonb,jsonb)set schema private;
create function public.save_dynamic_slide_version_v1(p_slide_id uuid,p_version_id uuid,p_expected_revision bigint,p_name text,p_template_version_id uuid,p_data_source_id uuid,p_orientation text,p_selection_mode text,p_configuration jsonb,p_theme_selection jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare version public.dynamic_slide_versions%rowtype;configuration jsonb:=p_configuration;review jsonb:=p_configuration->'menuPriceSourceReview';changed_source boolean;result jsonb;price_set jsonb;
begin
 if private.current_user_id()is null then raise exception 'authoring permission required'using errcode='42501';end if;
 select *into version from public.dynamic_slide_versions where id=p_version_id and dynamic_slide_id=p_slide_id;
 if version.id is not null and not private.has_tenant_capability(version.tenant_id,'tenant.dynamic_slide.write')then raise exception 'authoring permission required'using errcode='42501';end if;
 perform 1 from public.dynamic_slides where id=p_slide_id and tenant_id=version.tenant_id for update;
 select *into version from public.dynamic_slide_versions where id=p_version_id and dynamic_slide_id=p_slide_id for update;
 if configuration?'menuApprovedPrices'or configuration?'menuRuntimePriceSnapshotId'then raise exception 'runtime price metadata cannot be saved'using errcode='42501';end if;
 changed_source:=version.configuration_json?'syncConfiguration'and version.slide_type in('menu','price_list')and version.data_source_id is distinct from p_data_source_id;
 if changed_source then
  if private.current_user_id()is null or not private.has_tenant_capability(version.tenant_id,'tenant.dynamic_slide.write')then raise exception 'source change permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(version.tenant_id);
  if version.status<>'draft'or version.edit_revision<>p_expected_revision or not exists(select 1 from public.dynamic_slides where id=p_slide_id and tenant_id=version.tenant_id and active_draft_version_id=version.id)then raise exception 'source change CAS conflict'using errcode='40001';end if;
  if configuration?'menuPriceSet'or jsonb_typeof(review)is distinct from 'object'or(select count(*)from jsonb_object_keys(review))<>3
   or review->'confirmed'is distinct from 'true'::jsonb or review->>'sourceId'is distinct from p_data_source_id::text or coalesce(review->>'priceReviewHash','')!~'^[a-f0-9]{64}$'then raise exception 'new source prices require explicit review'using errcode='42501';end if;
  perform 1 from public.tenants where id=version.tenant_id for update;
  perform 1 from public.tenant_products where tenant_id=version.tenant_id order by id for share;
  configuration:=configuration-'menuPriceSourceReview';
  if review->>'priceReviewHash'is distinct from private.menu_price_source_review_hash_v1(version.tenant_id,p_data_source_id,configuration)then raise exception 'reviewed source prices changed'using errcode='40001';end if;
  price_set:=private.capture_menu_price_set_v1(version.tenant_id,p_data_source_id,private.menu_catalog_prices_v1(version.tenant_id,p_data_source_id,configuration));
  configuration:=configuration||jsonb_build_object('menuPriceSet',price_set);
 else
  if review is not null then raise exception 'same-source price recapture requires Producten review'using errcode='42501';end if;
  if(configuration->'menuPriceSet')is distinct from(version.configuration_json->'menuPriceSet')then raise exception 'ordinary save cannot alter a captured price set'using errcode='42501';end if;
  if configuration?'menuPriceSet'then perform private.assert_menu_price_set_v1(version.tenant_id,p_data_source_id,configuration->'menuPriceSet');end if;
 end if;
 result:=private.save_dynamic_slide_version_before_s261_prices_v1(p_slide_id,p_version_id,p_expected_revision,p_name,p_template_version_id,p_data_source_id,p_orientation,p_selection_mode,configuration,p_theme_selection);
 if changed_source and result->>'outcome'<>'applied'then raise exception 'source change CAS conflict'using errcode='40001';end if;
 if result->>'outcome'='applied'and configuration?'syncConfiguration'and version.slide_type in('menu','price_list')then result:=result||jsonb_build_object('configuration',configuration);end if;
 return result;
end;$$;

alter function public.create_or_resume_dynamic_slide_version_v1(uuid,uuid)rename to create_or_resume_dynamic_slide_before_s261_prices_v1;
alter function public.create_or_resume_dynamic_slide_before_s261_prices_v1(uuid,uuid)set schema private;
create function public.create_or_resume_dynamic_slide_version_v1(p_slide_id uuid,p_basis_version_id uuid default null)returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;version public.dynamic_slide_versions%rowtype;basis public.dynamic_slide_versions%rowtype;configuration jsonb;
begin
 result:=private.create_or_resume_dynamic_slide_before_s261_prices_v1(p_slide_id,p_basis_version_id);
 if result->>'outcome'='created'then
  select *into version from public.dynamic_slide_versions where id=(result->>'versionId')::uuid;
  if version.configuration_json?'syncConfiguration'and version.slide_type in('menu','price_list')then
   select *into basis from public.dynamic_slide_versions where tenant_id=version.tenant_id and id=version.based_on_version_id;
   configuration:=private.ensure_menu_basis_prices_v1(version.tenant_id,basis.published_snapshot_id,version.data_source_id,version.configuration_json);
   update public.dynamic_slide_versions set configuration_json=configuration where id=version.id and tenant_id=version.tenant_id and status='draft';
   update public.dynamic_slides set configuration_json=configuration where id=p_slide_id and tenant_id=version.tenant_id and active_draft_version_id=version.id;
  end if;
 end if;
 return result;
end;$$;

alter function public.publish_dynamic_slide_version_v1(uuid,uuid,bigint)rename to publish_dynamic_slide_version_before_s261_prices_v1;
alter function public.publish_dynamic_slide_version_before_s261_prices_v1(uuid,uuid,bigint)set schema private;
create function public.publish_dynamic_slide_version_v1(p_slide_id uuid,p_version_id uuid,p_expected_revision bigint)returns jsonb
language plpgsql security definer set search_path='' as $$
declare slide public.dynamic_slides%rowtype;version public.dynamic_slide_versions%rowtype;basis public.dynamic_slide_versions%rowtype;configuration jsonb;price_set jsonb;
begin
 if private.current_user_id()is null then raise exception 'publication permission required'using errcode='42501';end if;
 select *into version from public.dynamic_slide_versions where id=p_version_id and dynamic_slide_id=p_slide_id;
 if version.id is not null and not private.has_tenant_capability(version.tenant_id,'tenant.dynamic_slide.write')then raise exception 'publication permission required'using errcode='42501';end if;
 select *into slide from public.dynamic_slides where id=p_slide_id and tenant_id=version.tenant_id for update;
 select *into version from public.dynamic_slide_versions where id=p_version_id and dynamic_slide_id=p_slide_id for update;
 if version.id is not null and version.status='draft'and version.edit_revision=p_expected_revision then
  if private.current_user_id()is null or not private.has_tenant_capability(version.tenant_id,'tenant.dynamic_slide.write')then raise exception 'menu publish permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(version.tenant_id);
  configuration:=version.configuration_json;
  if configuration->>'schemaVersion'='menu-document.v2'then
   if not private.menu_studio_flag_enabled_v2(version.tenant_id,'read')or not private.menu_studio_flag_enabled_v2(version.tenant_id,'publish')or not private.menu_studio_flag_enabled_v2(version.tenant_id,'player')then
    raise exception 'Menu Studio publication is not enabled'using errcode='42501';end if;
  elsif configuration?'syncConfiguration'and version.slide_type in('menu','price_list')then
   if not(configuration?'menuPriceSet')then
    if version.based_on_version_id is not null then
     select *into basis from public.dynamic_slide_versions where tenant_id=version.tenant_id and id=version.based_on_version_id;
     configuration:=private.ensure_menu_basis_prices_v1(version.tenant_id,basis.published_snapshot_id,version.data_source_id,configuration);
    else
     price_set:=private.capture_menu_price_set_v1(version.tenant_id,version.data_source_id,private.menu_catalog_prices_v1(version.tenant_id,version.data_source_id,configuration));
     configuration:=configuration||jsonb_build_object('menuPriceSet',price_set);
    end if;
    update public.dynamic_slide_versions set configuration_json=configuration where id=version.id and tenant_id=version.tenant_id;
   end if;
   perform private.assert_menu_price_set_v1(version.tenant_id,version.data_source_id,configuration->'menuPriceSet');
  end if;
 end if;
 return private.publish_dynamic_slide_version_before_s261_prices_v1(p_slide_id,p_version_id,p_expected_revision);
end;$$;

-- Existing placement variants copy the approved price authority unchanged; a
-- legacy base without a set is anchored to that exact old snapshot first.
do $migration$
declare definition text;marker text:='select *into basis from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=base.dynamic_slide_version_id;';
begin
 select pg_get_functiondef('public.prepare_sync_dynamic_variant_v1(uuid,uuid,text,integer,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'S261 placement variant basis precondition failed';end if;
 execute replace(definition,marker,marker||E'\n basis.configuration_json:=private.ensure_menu_basis_prices_v1(p_tenant_id,base.id,base.data_source_id,basis.configuration_json);');
end;$migration$;

create function private.menu_price_nodes_v1(p_value jsonb,p_configuration jsonb,p_shared jsonb default null)returns table(product_id uuid,placement_id text,catalog_cents bigint,display_cents bigint,is_override boolean)
language plpgsql immutable security invoker set search_path='' as $$
declare entry record;shared jsonb:=p_shared;node_id text;amount bigint;manual boolean;catalog bigint;
begin
 if jsonb_typeof(p_value)='array'then
  for entry in select value from jsonb_array_elements(p_value)loop return query select *from private.menu_price_nodes_v1(entry.value,p_configuration,shared);end loop;return;
 end if;
 if jsonb_typeof(p_value) is distinct from 'object'or p_value->'hidden'='true'::jsonb or p_value->'visible'='false'::jsonb then return;end if;
 if p_value->>'kind'='product-group'and p_value->>'pricePolicy'='shared'then shared:=p_value->'sharedPrice';end if;
 node_id:=null;amount:=null;catalog:=null;manual:=false;
 if p_value?'id'and p_value?'priceMinor'and p_value->>'currency'='EUR'then
  if jsonb_typeof(p_value->'priceMinor')is distinct from 'number'then return;end if;
  if(p_value->>'priceMinor')::numeric<>trunc((p_value->>'priceMinor')::numeric)or(p_value->>'priceMinor')::numeric not between 0 and 999999999 then return;end if;
  node_id:=p_value->>'id';amount:=(p_value->>'priceMinor')::bigint;catalog:=amount;
 elsif p_value->>'kind'in('product','linked-product')and p_value#>>'{snapshotFallback,price,currency}'='EUR'then
  node_id:=p_value#>>'{productRef,productId}';catalog:=(p_value#>>'{snapshotFallback,price,amountMinor}')::bigint;
  manual:=shared is not null or(p_value?'priceOverrideMinor'and p_value->'priceOverrideMinor'<>'null'::jsonb);
  amount:=case when shared is not null then(shared->>'amountMinor')::bigint when manual then(p_value->>'priceOverrideMinor')::bigint else catalog end;
  if shared is not null then catalog:=null;end if;
 elsif p_value?'productId'and p_value->>'formattedPrice'~'^€[[:space:]]*[0-9]{1,7},[0-9]{2}$'then
  node_id:=p_value->>'productId';amount:=(replace(regexp_replace(p_value->>'formattedPrice','^€[[:space:]]*',''),',','.')::numeric*100)::bigint;
  select exists(select 1 from private.sites_json_nodes_v1(p_configuration)as cfg(value)
   where value->>'id'=p_value->>'id'and value->'priceCentsOverride'is not null and value->'priceCentsOverride'<>'null'::jsonb)into manual;
  if p_configuration#>>'{menuPriceSet,origin}'='catalog'then catalog:=(p_configuration#>>array['menuPriceSet','prices',node_id])::bigint;end if;
 end if;
 if node_id is not null then
  if node_id!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or amount<0 or amount>999999999 then raise exception 'frozen menu price invalid'using errcode='23514';end if;
  product_id:=node_id::uuid;placement_id:=coalesce(p_value->>'id',node_id);catalog_cents:=catalog;display_cents:=amount;is_override:=manual;return next;return;
 end if;
 for entry in select key,value from jsonb_each(p_value)loop
  if jsonb_typeof(entry.value)in('array','object')and entry.key<>'menuPriceSet'then return query select *from private.menu_price_nodes_v1(entry.value,p_configuration,shared);end if;
 end loop;
end;$$;

create function private.menu_selected_products_v1(p_tenant_id uuid,p_source_id uuid,p_configuration jsonb)returns setof public.tenant_products
language sql stable security definer set search_path='' as $$
 select product.*from public.tenant_products product where product.tenant_id=p_tenant_id
  and(product.data_source_id=p_source_id or product.data_source_id is null)
  and(nullif(p_configuration->>'category','')is null or product.category=p_configuration->>'category')
  and(case when p_configuration->>'schemaVersion'='menu-document.v2'then exists(
   select 1 from private.sites_json_nodes_v1(p_configuration)as nodes(value)where value#>>'{productRef,productId}'=product.id::text
  )when jsonb_typeof(p_configuration->'sections')='array'then exists(
   select 1 from private.sites_json_nodes_v1(p_configuration->'sections')as nodes(value)where value->>'productId'=product.id::text
  )else true end)
$$;
create function private.menu_catalog_prices_v1(p_tenant_id uuid,p_source_id uuid,p_configuration jsonb)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare prices jsonb;rows integer;
begin
 select count(*),coalesce(jsonb_object_agg(product.id::text,to_jsonb(product.price_cents)),'{}'::jsonb)into rows,prices
 from private.menu_selected_products_v1(p_tenant_id,p_source_id,p_configuration)product;
 if rows>200 or exists(select 1 from private.menu_selected_products_v1(p_tenant_id,p_source_id,p_configuration)
  where currency<>'EUR'or price_cents is null or price_cents<0)then raise exception 'menu full price selection exceeds supported bound'using errcode='23514';end if;
 return prices;
end;$$;

create function private.menu_price_impact_full_v1(p_tenant_id uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;review text;menu_count integer;
begin
 if (select count(*)from public.tenant_products where tenant_id=p_tenant_id)>100000 then raise exception 'catalogue impact exceeds full review bound'using errcode='54000';end if;
 select count(*)into menu_count from public.dynamic_slides where tenant_id=p_tenant_id and status<>'archived'and slide_type in('menu','price_list');
 if menu_count>500 then raise exception 'menu impact exceeds full review bound'using errcode='54000';end if;
 -- Hash the entire relevant authoring state, not the visible catalogue page.
 select private.menu_price_hash_v1(jsonb_build_object(
  'products',(select coalesce(jsonb_agg(jsonb_build_array(id,data_source_id,price_cents,currency,revision,active,available)order by id),'[]'::jsonb)from public.tenant_products where tenant_id=p_tenant_id),
  'menus',(select coalesce(jsonb_agg(jsonb_build_array(slide.id,slide.revision,slide.current_published_version_id,slide.active_draft_version_id,version.configuration_json,source.revision)order by slide.id),'[]'::jsonb)
   from public.dynamic_slides slide join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id and version.id=slide.current_published_version_id
   join public.dynamic_data_sources source on source.tenant_id=slide.tenant_id and source.id=version.data_source_id
   where slide.tenant_id=p_tenant_id and slide.status<>'archived'and slide.slide_type in('menu','price_list')),
  'references',(select coalesce(jsonb_agg(jsonb_build_array(item.release_id,item.dynamic_snapshot_id)order by item.release_id,item.id),'[]'::jsonb)
   from public.playlist_release_items item join private.referenced_publication_releases_v1(p_tenant_id)used on used.release_id=item.release_id
   where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id is not null)
 ))into review;
 with menus as(
  select slide.id,slide.name,slide.revision,slide.active_draft_version_id,version.id basis_id,version.data_source_id source_id,version.configuration_json configuration,version.published_snapshot_id,
   case when version.configuration_json?'syncConfiguration'then 'sync'else 'menu'end editor
  from public.dynamic_slides slide join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id and version.id=slide.current_published_version_id
  where slide.tenant_id=p_tenant_id and slide.status<>'archived'and version.slide_type in('menu','price_list')
   and(version.configuration_json?'syncConfiguration'or version.configuration_json->>'schemaVersion'='menu-document.v2')
 ),snapshots as(
  select distinct menu.id slide_id,snapshot.id,snapshot.snapshot_data_json,version.configuration_json
  from menus menu join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=p_tenant_id and snapshot.dynamic_slide_id=menu.id and snapshot.status='ready'
  join public.dynamic_slide_versions version on version.tenant_id=p_tenant_id and version.id=snapshot.dynamic_slide_version_id
  where snapshot.id=menu.published_snapshot_id or exists(select 1 from public.playlist_release_items item
   join private.referenced_publication_releases_v1(p_tenant_id)used on used.release_id=item.release_id
   where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id)
 ),facts as(
  select snapshot.slide_id,snapshot.id snapshot_id,node.*from snapshots snapshot
   cross join lateral private.menu_price_nodes_v1(snapshot.snapshot_data_json,snapshot.configuration_json)node
 ),pool as(
  select menu.id slide_id,product.id product_id,product.name,product.price_cents,
   coalesce((menu.configuration#>array['menuPriceSet','prices',product.id::text])::text::bigint,null)captured,
   menu.configuration#>>'{menuPriceSet,origin}'='catalog'captured_catalog
  from menus menu cross join lateral private.menu_selected_products_v1(p_tenant_id,menu.source_id,menu.configuration)product
 ),comparisons as(
  select pool.*,fact.snapshot_id,fact.placement_id,fact.catalog_cents,fact.display_cents,coalesce(fact.is_override,false)is_override,
   (fact.product_id is null and pool.captured is null)unpriced,
   (not coalesce(fact.is_override,false)and coalesce(fact.catalog_cents,pool.captured) is distinct from pool.price_cents)changed
  from pool left join facts fact on fact.slide_id=pool.slide_id and fact.product_id=pool.product_id
 ),diff as(
  select product_id,max(name)name,max(price_cents)next_price,
   coalesce(jsonb_agg(distinct coalesce(catalog_cents,case when captured_catalog then captured end))filter(where coalesce(catalog_cents,case when captured_catalog then captured end)is not null),'[]'::jsonb)old_catalog,
   coalesce(jsonb_agg(distinct display_cents)filter(where display_cents is not null),'[]'::jsonb)old_display,
   coalesce(jsonb_agg(distinct display_cents)filter(where is_override and display_cents is not null),'[]'::jsonb)overrides,
   count(distinct slide_id)menu_count,bool_or(unpriced or(catalog_cents is null and captured is null and not is_override))unpriced
  from comparisons group by product_id having bool_or(changed or unpriced)
 ),menu_stats as(
  select slide_id,count(distinct product_id)filter(where changed or unpriced)changed,
   count(distinct placement_id)filter(where is_override)overrides,count(distinct product_id)filter(where unpriced)unpriced
  from comparisons group by slide_id
 ),affected as(select menu.*,stats.changed,stats.overrides,stats.unpriced from menus menu join menu_stats stats on stats.slide_id=menu.id where stats.changed>0),
 playlist_links as(
  select distinct affected.id slide_id,playlist.id,playlist.name from affected
  join public.playlist_items item on item.tenant_id=p_tenant_id and item.dynamic_slide_id=affected.id
  join public.playlists playlist on playlist.tenant_id=p_tenant_id and playlist.id=item.playlist_id and playlist.status<>'archived'
  union
  select distinct affected.id,playlist.id,playlist.name from affected join snapshots snapshot on snapshot.slide_id=affected.id
  join public.playlist_release_items item on item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id
  join public.playlist_releases release on release.tenant_id=p_tenant_id and release.id=item.release_id
  join public.playlists playlist on playlist.tenant_id=p_tenant_id and playlist.id=release.playlist_id and playlist.status<>'archived'
 ),release_ids as(select distinct item.release_id from public.playlist_release_items item join snapshots snapshot on snapshot.id=item.dynamic_snapshot_id
  join affected on affected.id=snapshot.slide_id where item.tenant_id=p_tenant_id)
 select jsonb_build_object('status','ready','complete',true,'reviewHash',review,
  'totalProducts',(select count(*)from public.tenant_products where tenant_id=p_tenant_id),'changedProducts',(select count(*)from diff),
  'affectedMenus',(select count(*)from affected),'affectedPlacements',(select count(distinct(snapshot_id,placement_id))from comparisons where changed or unpriced),
  'affectedPlaylists',(select count(distinct id)from playlist_links),
  'desiredScreens',(select count(*)from public.player_devices where tenant_id=p_tenant_id and status='paired'and desired_release_id in(select release_id from release_ids)),
  'confirmedScreens',0,'unknownScreens',(select count(*)from public.player_devices where tenant_id=p_tenant_id and status='paired'and(active_release_id in(select release_id from release_ids)or desired_release_id in(select release_id from release_ids))),
  'reviewRequiredProducts',(select count(*)from diff where unpriced),'offset',0,'limit',20,'hasMore',false,
  'rows',(select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'previousCatalogPrices',old_catalog,'previousDisplayPrices',old_display,'nextCatalogPrice',next_price,'overridePrices',overrides,'affectedMenus',diff.menu_count,'unpriced',unpriced)order by name,product_id),'[]'::jsonb)from diff),
  'menus',(select coalesce(jsonb_agg(jsonb_build_object('slideId',affected.id,'basisVersionId',basis_id,'expectedRevision',revision,'sourceId',source_id,'name',name,'editor',editor,
   'changedProducts',changed,'preservedOverrides',overrides,'unpricedProducts',unpriced,'canPrepare',active_draft_version_id is null,
   'blockedReason',case when active_draft_version_id is not null then 'Er bestaat al een concept. Bewerk of rond dat eerst af; het wordt niet overschreven.'else null end,
   'playlists',(select coalesce(jsonb_agg(jsonb_build_object('id',links.id,'name',links.name)order by links.name,links.id),'[]'::jsonb)from playlist_links links where links.slide_id=affected.id))order by name,affected.id),'[]'::jsonb)from affected),
  'screenEvidence',(select coalesce(jsonb_agg(to_jsonb(device)),'[]'::jsonb)from(select active_release_id,desired_release_id,last_seen_at,last_error_code,current_sync_detail,status from public.player_devices where tenant_id=p_tenant_id and status='paired'and(active_release_id in(select release_id from release_ids)or desired_release_id in(select release_id from release_ids))order by id limit 1000)device),
  'affectedReleaseIds',(select coalesce(jsonb_agg(release_id),'[]'::jsonb)from release_ids),
  'error',null)into result;
 return result;
end;$$;

create function public.read_menu_price_impact_v1(p_tenant_id uuid,p_offset integer default 0,p_limit integer default 20)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;all_rows jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.product.read')
  or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')or not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read')then
  raise exception 'complete menu price read permission required'using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid price page'using errcode='22023';end if;
 result:=private.menu_price_impact_full_v1(p_tenant_id);all_rows:=result->'rows';
 return result||jsonb_build_object('rows',(select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)from jsonb_array_elements(all_rows)with ordinality where ordinality>p_offset and ordinality<=p_offset+p_limit),
  'offset',p_offset,'limit',p_limit,'hasMore',jsonb_array_length(all_rows)>p_offset+p_limit);
end;$$;

create function private.assert_menu_price_access_v1(p_tenant_id uuid,p_write boolean)returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.product.read')
  or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')or not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read')
  or(p_write and not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write'))then
  raise exception 'menu price permission required'using errcode='42501';end if;
 if p_write then perform private.require_active_tenant_command(p_tenant_id);end if;
end;$$;

create function private.preserve_menu_manual_prices_v1(p_new jsonb,p_old jsonb,p_shared jsonb default null)returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=p_new;entry record;prior jsonb;shared jsonb:=p_shared;identity text;
begin
 if jsonb_typeof(p_new)='array'then
  result:='[]'::jsonb;for entry in select value,ordinality from jsonb_array_elements(p_new)with ordinality loop
   identity:=coalesce(entry.value->>'id',entry.value#>>'{productRef,productId}');prior:=null;
   if jsonb_typeof(p_old)='array'then
    if identity is null then prior:=p_old->(entry.ordinality::integer-1);else
     select value into prior from jsonb_array_elements(p_old)where coalesce(value->>'id',value#>>'{productRef,productId}')=identity limit 1;end if;
   end if;
   result:=result||jsonb_build_array(private.preserve_menu_manual_prices_v1(entry.value,prior,shared));
  end loop;return result;
 end if;
 if jsonb_typeof(p_new) is distinct from 'object'then return p_new;end if;
 if p_old->>'kind'='product-group'and p_old->>'pricePolicy'='shared'then
  shared:=p_old->'sharedPrice';result:=jsonb_set(result,'{sharedPrice}',shared);
 end if;
 if shared is not null and p_new->>'kind'in('product','linked-product')then result:=jsonb_set(result,'{snapshotFallback,price}',shared);end if;
 for entry in select key,value from jsonb_each(result)loop
  if jsonb_typeof(entry.value)in('object','array')and entry.key not in('price','sharedPrice')then
   result:=jsonb_set(result,array[entry.key],private.preserve_menu_manual_prices_v1(entry.value,p_old->entry.key,shared));end if;
 end loop;return result;
end;$$;

create function private.read_menu_price_candidates_v1(p_tenant_id uuid,p_capture_actor_id uuid,p_capture_key uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipt jsonb;candidate jsonb;version public.dynamic_slide_versions%rowtype;snapshot public.dynamic_slide_snapshots%rowtype;job public.dynamic_render_jobs%rowtype;result jsonb:='[]'::jsonb;state text;
begin
 select outcome_json into receipt from public.publisher_command_receipts where tenant_id=p_tenant_id and actor_user_id=p_capture_actor_id
  and idempotency_key=p_capture_key and command_type='menu.price.prepare.v1';
 if receipt is null then raise exception 'menu price capture unavailable'using errcode='42501';end if;
 for candidate in select value from jsonb_array_elements(receipt->'candidates')loop
  select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=(candidate->>'versionId')::uuid and dynamic_slide_id=(candidate->>'slideId')::uuid;
  if version.id is null then raise exception 'captured menu version unavailable'using errcode='42501';end if;
  if version.status='draft'and version.edit_revision<>(candidate->>'editRevision')::bigint then raise exception 'captured menu draft changed'using errcode='40001';end if;
  select *into snapshot from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and dynamic_slide_version_id=version.id order by created_at desc,id limit 1;
  select *into job from public.dynamic_render_jobs where tenant_id=p_tenant_id and snapshot_id=snapshot.id order by created_at desc,id limit 1;
  state:=case when version.status='draft'then 'draft'when snapshot.status='ready'and job.status='completed'and snapshot.output_media_asset_id is not null then 'ready'
    when snapshot.status='failed'or job.status='failed'then 'failed'else 'pending'end;
  result:=result||jsonb_build_array(candidate||jsonb_build_object('state',state,'snapshotId',case when version.status='draft'then null else snapshot.id end,'jobId',case when version.status='draft'then null else job.id end));
 end loop;
 return jsonb_build_object('captureActorId',p_capture_actor_id,'captureKey',p_capture_key,'candidates',result);
end;$$;
create function public.read_menu_price_candidates_v1(p_tenant_id uuid,p_capture_actor_id uuid,p_capture_key uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_menu_price_access_v1(p_tenant_id,false);
 return private.read_menu_price_candidates_v1(p_tenant_id,p_capture_actor_id,p_capture_key);
end;$$;

create function public.prepare_menu_price_candidates_v1(p_tenant_id uuid,p_review_hash text,p_selections jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare request jsonb;replay jsonb;impact jsonb;selection jsonb;menu jsonb;slide public.dynamic_slides%rowtype;basis public.dynamic_slide_versions%rowtype;version public.dynamic_slide_versions%rowtype;
 result jsonb;configuration jsonb;price_set jsonb;candidate jsonb;candidates jsonb:='[]'::jsonb;reply jsonb;total_bytes integer:=0;
begin
 perform private.assert_menu_price_access_v1(p_tenant_id,true);
 if p_review_hash is null or p_review_hash!~'^[a-f0-9]{64}$'or p_idempotency_key is null or jsonb_typeof(p_selections)is distinct from 'array'
  or jsonb_array_length(p_selections)not between 1 and 25 or octet_length(p_selections::text)>16000 then raise exception 'invalid menu price selection'using errcode='22023';end if;
 for selection in select value from jsonb_array_elements(p_selections)loop
  if jsonb_typeof(selection)is distinct from 'object'or(select count(*)from jsonb_object_keys(selection))<>3
   or coalesce(selection->>'slideId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or coalesce(selection->>'basisVersionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or jsonb_typeof(selection->'expectedRevision')is distinct from 'number'or(selection->>'expectedRevision')::numeric<>trunc((selection->>'expectedRevision')::numeric)
   or(selection->>'expectedRevision')::numeric not between 0 and 9007199254740991 then raise exception 'invalid menu price basis'using errcode='22023';end if;
 end loop;
 if(select count(distinct value->>'slideId')from jsonb_array_elements(p_selections))<>jsonb_array_length(p_selections)then raise exception 'duplicate menu price target'using errcode='22023';end if;
 request:=jsonb_build_object('reviewHash',p_review_hash,'selections',p_selections);
 replay:=private.begin_publisher_command(p_tenant_id,'menu.price.prepare.v1',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 -- Tenant FK key-share serializes inserts; row locks hold existing prices.
 -- No global table lock, and no partially committed multi-menu price set.
 perform 1 from public.tenants where id=p_tenant_id for update;
 perform 1 from public.tenant_products where tenant_id=p_tenant_id order by id for share;
 perform 1 from public.dynamic_slides where tenant_id=p_tenant_id and id in(select(value->>'slideId')::uuid from jsonb_array_elements(p_selections))order by id for update;
 impact:=private.menu_price_impact_full_v1(p_tenant_id);
 if impact->>'reviewHash'is distinct from p_review_hash then raise exception 'menu price review changed'using errcode='40001';end if;
 -- Validate every target before creating any draft; exceptions still roll back
 -- the entire transaction, including internal capture receipts and audit rows.
 for selection in select value from jsonb_array_elements(p_selections)order by value->>'slideId'loop
  select value into menu from jsonb_array_elements(impact->'menus')where value->>'slideId'=selection->>'slideId';
  if menu is null or menu->'canPrepare'<>'true'::jsonb or menu->>'basisVersionId'is distinct from selection->>'basisVersionId'
   or(menu->>'expectedRevision')::bigint<>(selection->>'expectedRevision')::numeric::bigint then raise exception 'menu price basis changed'using errcode='40001';end if;
 end loop;
 for selection in select value from jsonb_array_elements(p_selections)order by value->>'slideId'loop
  select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=(selection->>'slideId')::uuid and status<>'archived';
  select *into basis from public.dynamic_slide_versions where tenant_id=p_tenant_id and dynamic_slide_id=slide.id and id=(selection->>'basisVersionId')::uuid and status in('published','archived');
  if slide.active_draft_version_id is not null or basis.id is null or slide.current_published_version_id is distinct from basis.id then raise exception 'existing menu draft or basis changed'using errcode='40001';end if;
  result:=public.create_or_resume_dynamic_slide_version_v1(slide.id,basis.id);
  if result->>'outcome'<>'created'then raise exception 'menu draft was not created'using errcode='40001';end if;
  select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=(result->>'versionId')::uuid;
  configuration:=version.configuration_json;
  if configuration?'syncConfiguration'then
   price_set:=private.capture_menu_price_set_v1(p_tenant_id,version.data_source_id,private.menu_catalog_prices_v1(p_tenant_id,version.data_source_id,configuration));
   total_bytes:=total_bytes+octet_length(price_set::text);if total_bytes>250000 then raise exception 'price batch exceeds payload budget'using errcode='54000';end if;
   configuration:=configuration||jsonb_build_object('menuPriceSet',price_set);
  else
   if configuration->>'schemaVersion'<>'menu-document.v2'or not private.menu_studio_flag_enabled_v2(p_tenant_id,'read')or not private.menu_studio_flag_enabled_v2(p_tenant_id,'authoring')then raise exception 'menu authoring is not enabled'using errcode='42501';end if;
   configuration:=private.preserve_menu_manual_prices_v1(private.resolve_menu_document_v2(p_tenant_id,version.data_source_id,configuration),configuration);
   configuration:=jsonb_set(configuration,'{revision}',to_jsonb(version.edit_revision+1));
   perform private.validate_menu_document_v2(p_tenant_id,version.data_source_id,configuration);
   price_set:=jsonb_build_object('hash',private.menu_price_hash_v1(configuration));
  end if;
  result:=private.save_dynamic_slide_version_before_s261_prices_v1(slide.id,version.id,version.edit_revision,version.name,version.template_version_id,version.data_source_id,version.orientation,version.selection_mode,configuration,version.theme_selection_json);
  if result->>'outcome'<>'applied'then raise exception 'menu price candidate CAS conflict'using errcode='40001';end if;
  if configuration->>'schemaVersion'='menu-document.v2' then update public.dynamic_slides set menu_document_revision=version.edit_revision+1 where tenant_id=p_tenant_id and id=slide.id;end if;
  select value into menu from jsonb_array_elements(impact->'menus')where value->>'slideId'=slide.id::text;
  candidate:=jsonb_build_object('slideId',slide.id,'versionId',version.id,'editRevision',(result->>'editRevision')::bigint,'name',version.name,'editor',case when configuration?'syncConfiguration'then 'sync'else 'menu'end,
   'priceSetHash',price_set->>'hash','state','draft','snapshotId',null,'jobId',null,'playlists',menu->'playlists');
  candidates:=candidates||jsonb_build_array(candidate);
 end loop;
 reply:=jsonb_build_object('captureActorId',private.current_user_id(),'captureKey',p_idempotency_key,'candidates',candidates);
 if octet_length(reply::text)>250000 then raise exception 'menu capture response exceeds bound'using errcode='54000';end if;
 return private.complete_publisher_command(p_tenant_id,'menu.price.prepare.v1',p_idempotency_key,request,'dynamic_slides',null,reply,'menu.price.candidates.prepared');
end;$$;

create function public.publish_menu_price_candidates_v1(p_tenant_id uuid,p_capture_actor_id uuid,p_capture_key uuid,p_candidates jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare request jsonb;replay jsonb;captured jsonb;candidate jsonb;approved jsonb;version public.dynamic_slide_versions%rowtype;result jsonb;
begin
 perform private.assert_menu_price_access_v1(p_tenant_id,true);
 if p_capture_actor_id is null or p_capture_key is null or p_idempotency_key is null or jsonb_typeof(p_candidates)is distinct from 'array'
  or jsonb_array_length(p_candidates)not between 1 and 25 or octet_length(p_candidates::text)>16000 then raise exception 'invalid price publication'using errcode='22023';end if;
 request:=jsonb_build_object('captureActorId',p_capture_actor_id,'captureKey',p_capture_key,'candidates',p_candidates);
 replay:=private.begin_publisher_command(p_tenant_id,'menu.price.publish.v1',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 select outcome_json into captured from public.publisher_command_receipts where tenant_id=p_tenant_id and actor_user_id=p_capture_actor_id and idempotency_key=p_capture_key and command_type='menu.price.prepare.v1';
 if captured is null then raise exception 'price capture unavailable'using errcode='42501';end if;
 if(select count(distinct value->>'slideId')from jsonb_array_elements(p_candidates))<>jsonb_array_length(p_candidates)then raise exception 'duplicate price candidate'using errcode='22023';end if;
 for candidate in select value from jsonb_array_elements(p_candidates)order by value->>'slideId'loop
  if jsonb_typeof(candidate)is distinct from 'object'or(select count(*)from jsonb_object_keys(candidate))<>3 then raise exception 'invalid candidate fields'using errcode='22023';end if;
  select value into approved from jsonb_array_elements(captured->'candidates')where value->>'slideId'=candidate->>'slideId'and value->>'versionId'=candidate->>'versionId';
  if approved is null or approved->'editRevision'is distinct from candidate->'expectedRevision'then raise exception 'candidate is outside capture'using errcode='42501';end if;
  perform 1 from public.dynamic_slides where tenant_id=p_tenant_id and id=(approved->>'slideId')::uuid for update;
  select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=(approved->>'versionId')::uuid and dynamic_slide_id=(approved->>'slideId')::uuid for update;
  if version.id is null or version.status<>'draft'or version.edit_revision<>(candidate->>'expectedRevision')::numeric::bigint then raise exception 'candidate changed before publication'using errcode='40001';end if;
  if version.configuration_json?'menuPriceSet'then
   perform private.assert_menu_price_set_v1(p_tenant_id,version.data_source_id,version.configuration_json->'menuPriceSet');
   if version.configuration_json#>>'{menuPriceSet,hash}'is distinct from approved->>'priceSetHash'then raise exception 'candidate price set changed'using errcode='40001';end if;
  elsif private.menu_price_hash_v1(version.configuration_json)is distinct from approved->>'priceSetHash'then raise exception 'menu candidate changed'using errcode='40001';end if;
 end loop;
 for candidate in select value from jsonb_array_elements(p_candidates)order by value->>'slideId'loop
  result:=public.publish_dynamic_slide_version_v1((candidate->>'slideId')::uuid,(candidate->>'versionId')::uuid,(candidate->>'expectedRevision')::numeric::bigint);
  if result->>'outcome'='conflict'then raise exception 'candidate publication conflict'using errcode='40001';end if;
 end loop;
 result:=private.read_menu_price_candidates_v1(p_tenant_id,p_capture_actor_id,p_capture_key);
 return private.complete_publisher_command(p_tenant_id,'menu.price.publish.v1',p_idempotency_key,request,'dynamic_slides',null,result,'menu.price.candidates.published');
end;$$;

create function private.menu_price_source_review_hash_v1(p_tenant_id uuid,p_source_id uuid,p_configuration jsonb)returns text
language sql stable security definer set search_path='' as $$
 select private.menu_price_hash_v1(jsonb_build_object('sourceId',p_source_id,'prices',private.menu_catalog_prices_v1(p_tenant_id,p_source_id,p_configuration)))
$$;
alter function public.preview_dynamic_slide_v1(uuid,text,uuid,uuid,jsonb)rename to preview_dynamic_slide_before_s261_prices_v1;
alter function public.preview_dynamic_slide_before_s261_prices_v1(uuid,text,uuid,uuid,jsonb)set schema private;
create function public.preview_dynamic_slide_v1(p_tenant_id uuid,p_name text,p_template_version_id uuid,p_data_source_id uuid,p_configuration_json jsonb default '{}'::jsonb)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare configuration jsonb:=p_configuration_json;result jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')then raise exception 'actor cannot preview dynamic slides'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if configuration?'menuApprovedPrices'or configuration?'menuRuntimePriceSnapshotId'then raise exception 'runtime price metadata is internal'using errcode='42501';end if;
 if configuration?'syncConfiguration'and configuration#>>'{syncConfiguration,slideType}'in('menu','price_list')then
  -- A newly selected source is previewed from its real catalogue. An old-source
  -- set is never treated as that new source's authority, and no receipt is made.
  if configuration?'menuPriceSet'and configuration#>>'{menuPriceSet,dataSourceId}'is distinct from p_data_source_id::text then
   perform private.assert_menu_price_set_v1(p_tenant_id,(configuration#>>'{menuPriceSet,dataSourceId}')::uuid,configuration->'menuPriceSet');
   configuration:=configuration-'menuPriceSet';
  end if;
  configuration:=configuration-'menuPriceSourceReview';
 end if;
 result:=private.preview_dynamic_slide_before_s261_prices_v1(p_tenant_id,p_name,p_template_version_id,p_data_source_id,configuration);
 if configuration?'syncConfiguration'and configuration#>>'{syncConfiguration,slideType}'in('menu','price_list')then
  result:=result||jsonb_build_object('priceReviewHash',private.menu_price_source_review_hash_v1(p_tenant_id,p_data_source_id,configuration));end if;
 return result;
end;$$;

-- Explicit ACLs: these captures/build helpers never become browser APIs.
do $acl$
declare proc record;
begin
 for proc in select oid from pg_proc where pronamespace='private'::regnamespace and proname in(
  'menu_price_hash_v1','assert_menu_price_set_v1','capture_menu_price_set_v1','menu_catalog_prices_v1','pin_menu_prices_v1','apply_menu_price_set_v1',
  'resolve_menu_render_prices_v1','build_dynamic_snapshot_data','build_dynamic_snapshot_before_s261_prices_v1','menu_snapshot_prices_v1','ensure_menu_basis_prices_v1',
  'create_dynamic_slide_before_s261_prices_v1','save_dynamic_slide_version_before_s261_prices_v1','create_or_resume_dynamic_slide_before_s261_prices_v1',
  'publish_dynamic_slide_version_before_s261_prices_v1','menu_price_nodes_v1','menu_selected_products_v1','menu_price_impact_full_v1',
  'assert_menu_price_access_v1','preserve_menu_manual_prices_v1','read_menu_price_candidates_v1','menu_price_source_review_hash_v1','preview_dynamic_slide_before_s261_prices_v1')loop
  execute 'revoke all on function '||proc.oid::regprocedure||' from public,anon,authenticated,service_role';
 end loop;
end;$acl$;
revoke all on function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb),public.save_dynamic_slide_version_v1(uuid,uuid,bigint,text,uuid,uuid,text,text,jsonb,jsonb),
 public.create_or_resume_dynamic_slide_version_v1(uuid,uuid),public.publish_dynamic_slide_version_v1(uuid,uuid,bigint),public.preview_dynamic_slide_v1(uuid,text,uuid,uuid,jsonb),
 public.read_menu_price_impact_v1(uuid,integer,integer),public.read_menu_price_candidates_v1(uuid,uuid,uuid),
 public.prepare_menu_price_candidates_v1(uuid,text,jsonb,uuid),public.publish_menu_price_candidates_v1(uuid,uuid,uuid,jsonb,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.create_dynamic_slide_v1(uuid,text,uuid,uuid,text,jsonb)to authenticated,service_role;
grant execute on function public.save_dynamic_slide_version_v1(uuid,uuid,bigint,text,uuid,uuid,text,text,jsonb,jsonb),
 public.create_or_resume_dynamic_slide_version_v1(uuid,uuid),public.publish_dynamic_slide_version_v1(uuid,uuid,bigint),public.preview_dynamic_slide_v1(uuid,text,uuid,uuid,jsonb),
 public.read_menu_price_impact_v1(uuid,integer,integer),public.read_menu_price_candidates_v1(uuid,uuid,uuid),
 public.prepare_menu_price_candidates_v1(uuid,text,jsonb,uuid),public.publish_menu_price_candidates_v1(uuid,uuid,uuid,jsonb,uuid)to authenticated;
notify pgrst,'reload schema';
