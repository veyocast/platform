-- Parent commands and nested project commands require different stable receipts.
create function private.studio_series_child_key_v1(p_key uuid,p_index integer) returns uuid
language sql immutable strict security invoker set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
 from (select md5(p_key::text||':studio-series:'||p_index::text) h) value
$$;
revoke all on function private.studio_series_child_key_v1(uuid,integer) from public,anon,authenticated,service_role;

do $$
declare definition text;
begin
 select pg_get_functiondef('public.create_studio_series_v1(uuid,text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'p_idempotency_key=>(slide->>''commandKey'')::uuid','p_idempotency_key=>private.studio_series_child_key_v1(p_idempotency_key,ordinal)');
 if position('private.studio_series_child_key_v1(p_idempotency_key,ordinal)' in definition)=0 then raise exception 'Studio create receipt migration precondition failed';end if;
 execute definition;
 select pg_get_functiondef('public.save_studio_series_v1(uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'p_idempotency_key=>(slide->>''commandKey'')::uuid','p_idempotency_key=>private.studio_series_child_key_v1(p_idempotency_key,cardinality(ids))');
 definition:=replace(definition,'(slide->>''commandKey'')::uuid);','private.studio_series_child_key_v1(p_idempotency_key,cardinality(ids)));');
 if position('private.studio_series_child_key_v1(p_idempotency_key,cardinality(ids))' in definition)=0 then raise exception 'Studio save receipt migration precondition failed';end if;
 execute definition;
end;$$;
revoke all on function public.create_studio_series_v1(uuid,text,jsonb,uuid),public.save_studio_series_v1(uuid,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_studio_series_v1(uuid,text,jsonb,uuid),public.save_studio_series_v1(uuid,bigint,jsonb,uuid) to authenticated;

-- Accept the explicitly typed menu marker at every dynamic/placement boundary.
-- Delegate the remaining configuration to the existing exact identity validator.
alter function private.sites_configuration_is_valid_v1(jsonb) rename to sites_configuration_before_menu_widgets_v1;
create function private.sites_configuration_is_valid_v1(p_sites jsonb)returns boolean
language sql immutable security invoker set search_path='' as $$
 select case when p_sites?'menuWidgets' then
  p_sites->>'provider'='menu' and jsonb_typeof(p_sites->'menuWidgets')='boolean'
   and private.sites_configuration_before_menu_widgets_v1(p_sites-'menuWidgets')
 else private.sites_configuration_before_menu_widgets_v1(p_sites)end
$$;
revoke all on function private.sites_configuration_is_valid_v1(jsonb),private.sites_configuration_before_menu_widgets_v1(jsonb)from public,anon,authenticated,service_role;

-- Extend the existing tenant-aware Menu validation rather than introduce another store.
alter function private.validate_menu_document_v2(uuid,uuid,jsonb) rename to validate_menu_document_before_widgets_v1;
create function private.validate_menu_document_v2(p_tenant_id uuid,p_data_source_id uuid,p_document jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare node jsonb;
begin
 perform private.validate_menu_document_before_widgets_v1(p_tenant_id,p_data_source_id,p_document);
 if p_document#>'{sitesConfiguration,menuWidgets}' is not null and jsonb_typeof(p_document#>'{sitesConfiguration,menuWidgets}') is distinct from 'boolean' then raise exception 'menu widget marker invalid' using errcode='22023';end if;
 for node in select value from private.sites_json_nodes_v1(p_document) value loop
  if node?'widget' and (node->>'type' not in('category','product-group','image','video','logo','text','promo') or jsonb_typeof(node->'widget') is distinct from 'object' or node#>>'{widget,column}' is null or node#>>'{widget,column}' not in('full','left','right') or (node#>'{widget,aspectRatio}' is not null and node#>>'{widget,aspectRatio}' not in('16:9','9:16'))) then raise exception 'menu widget placement invalid' using errcode='22023';end if;
  if (node?'columns' and node->>'columns' not in('1','2')) or (node?'landscapeColumns' and node->>'landscapeColumns' not in('1','2')) or (node?'portraitColumns' and node->>'portraitColumns' not in('1','2')) or (node->>'kind'='product' and node?'column' and node->>'column' not in('1','2')) then raise exception 'menu column count invalid' using errcode='22023';end if;
  if node->>'kind'='product' and node?'secondaryLineItems' and (jsonb_typeof(node->'secondaryLineItems') is distinct from 'array' or jsonb_array_length(node->'secondaryLineItems')>8) then raise exception 'menu product sublines outside limits' using errcode='22023';end if;
 end loop;
end;$$;
revoke all on function private.validate_menu_document_v2(uuid,uuid,jsonb),private.validate_menu_document_before_widgets_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
comment on function private.studio_series_child_key_v1(uuid,integer) is 'Stable independent receipt namespace for atomic Studio series create/save, including retries and nested project writes.';
