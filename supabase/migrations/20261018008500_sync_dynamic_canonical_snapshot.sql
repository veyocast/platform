-- The canonical source tables and all existing entitlement, period, privacy and
-- identity filters stay authoritative. Only Source requests use an extra row
-- beyond their full 200-row bound to detect overflow rather than shorten it.
do $migration$
declare proc record;definition text;updated text;cap text;new_cap text;changed integer:=0;
begin
 for proc in select p.oid,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like'build_dynamic_snapshot%'and p.pronargs=1 and p.proargtypes[0]='public.dynamic_slides'::regtype
 loop
  definition:=pg_get_functiondef(proc.oid);updated:=definition;
  cap:=substring(updated from 'max_items integer[[:space:]]*:?=[^;]+;');
  if cap is not null then
   new_cap:=regexp_replace(cap,',[[:space:]]*(40|200)[[:space:]]*[)][[:space:]]*;$',
    $replace$, (case when p_slide.configuration_json ? 'syncConfiguration' then 201 else \1 end));$replace$);
   updated:=replace(updated,cap,new_cap);
  end if;
  updated:=regexp_replace(updated,'limit (40|100)([[:space:]]|$)',
   $replace$limit (case when p_slide.configuration_json ? 'syncConfiguration' then 201 else \1 end)\2$replace$,'g');
  updated:=replace(updated,'limit case when is_club then 100 else 40 end',
   'limit case when p_slide.configuration_json ? ''syncConfiguration'' then 201 when is_club then 100 else 40 end');
  updated:=replace(updated,$find$p_slide.configuration_json#>>'{sitesConfiguration,provider}'='sportlink'$find$,
   $replace$(p_slide.configuration_json#>>'{sitesConfiguration,provider}'='sportlink' or p_slide.configuration_json ? 'syncConfiguration')$replace$);
  if updated is distinct from definition then
   if proc.proname='build_dynamic_snapshot_data_before_s122_theme_restore'then
    -- S206 preserves this exact historical body as an incident regression
    -- boundary. Keep it byte-for-byte and route only Source through its copy.
    execute replace(updated,'FUNCTION private.build_dynamic_snapshot_data_before_s122_theme_restore(', 'FUNCTION private.build_sync_dynamic_typed_snapshot_v1(');
   else execute updated;end if;
   changed:=changed+1;
  end if;
 end loop;
 if changed<>10 then raise exception 'Source bounded canonical readers precondition failed: %',changed;end if;
 select pg_get_functiondef('private.build_dynamic_snapshot_data_before_s128_birthdays(public.dynamic_slides)'::regprocedure)into definition;
 if position('private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide)'in definition)=0 then raise exception 'Source typed canonical route precondition failed';end if;
 definition:=replace(definition,'FUNCTION private.build_dynamic_snapshot_data_before_s128_birthdays(', 'FUNCTION private.build_sync_dynamic_typed_wrapper_v1(');
 execute replace(definition,'private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide)','private.build_sync_dynamic_typed_snapshot_v1(p_slide)');
 select pg_get_functiondef('private.build_dynamic_snapshot_data_before_s129_home_arrivals(public.dynamic_slides)'::regprocedure)into definition;
 if position('private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide)'in definition)=0 then raise exception 'Source typed wrapper route precondition failed';end if;
 execute replace(definition,'private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide)',
  $route$(case when p_slide.configuration_json?'syncConfiguration'then private.build_sync_dynamic_typed_wrapper_v1(p_slide)else private.build_dynamic_snapshot_data_before_s128_birthdays(p_slide)end)$route$);
 revoke all on function private.build_sync_dynamic_typed_snapshot_v1(public.dynamic_slides),private.build_sync_dynamic_typed_wrapper_v1(public.dynamic_slides)from public,anon,authenticated,service_role;
end;$migration$;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)rename to build_dynamic_snapshot_before_sync_v1;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;runtime_slide public.dynamic_slides:=p_slide;cfg jsonb:=p_slide.configuration_json->'syncConfiguration';node jsonb;
begin
 if cfg is null then return private.build_dynamic_snapshot_before_sync_v1(p_slide);end if;
 perform private.assert_sync_dynamic_configuration_v1(p_slide.tenant_id,p_slide.slide_type,p_slide.orientation,cfg);
 -- The Source design paginates the entire authorized selection. The legacy
 -- layout's maxItems setting never silently drops the remainder of that data.
 runtime_slide.configuration_json:=jsonb_set(runtime_slide.configuration_json,'{maxItems}','201');
 result:=private.build_dynamic_snapshot_before_sync_v1(runtime_slide);
 for node in select value from private.sites_json_nodes_v1(case when p_slide.slide_type='news'then result->'news'when p_slide.slide_type='menu'then coalesce(result->'menuDocument',result->'menu',result->'data')when p_slide.slide_type='price_list'then result->'priceList'else result->'sport'end)where jsonb_typeof(value)='array'
 loop
  if jsonb_array_length(node)>200 then raise exception 'Source full selection exceeds 200 rows; narrow the selection or split into a series'using errcode='23514';end if;
 end loop;
 return result||jsonb_build_object('syncConfiguration',cfg,'generatedAt',now());
end;$$;

-- Render retries evaluate the immutable snapshot at its original generation
-- time. That timestamp is metadata and must not cause extra snapshots or data
-- revisions when no source fact changed.
create or replace function private.dynamic_snapshot_content_hash_v1(p_slide public.dynamic_slides,p_snapshot_data jsonb)returns text
language sql stable security definer set search_path='' as $$
 select private.dynamic_snapshot_content_hash_before_s122_versions(p_slide,
  case when p_slide.configuration_json?'syncConfiguration'then p_snapshot_data-'generatedAt'else p_snapshot_data end)
$$;
revoke all on function private.build_dynamic_snapshot_before_sync_v1(public.dynamic_slides),private.build_dynamic_snapshot_data(public.dynamic_slides),private.dynamic_snapshot_content_hash_v1(public.dynamic_slides,jsonb)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
