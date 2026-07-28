-- Keep the guarded playlist mutation on an empty search_path while making the
-- deferrable position-key constraint resolvable by its schema-qualified name.

do $migration$
declare
  function_definition text;
  deferred_constraint text :=
    'set constraints playlist_items_tenant_playlist_position_key_uq deferred;';
  immediate_constraint text :=
    'set constraints playlist_items_tenant_playlist_position_key_uq immediate;';
begin
  select pg_catalog.pg_get_functiondef(
    'public.mutate_playlist_draft_v2(uuid,bigint,text,jsonb,uuid)'::regprocedure
  )
  into function_definition;

  if function_definition is null
    or pg_catalog.strpos(function_definition, deferred_constraint) = 0
    or pg_catalog.strpos(function_definition, immediate_constraint) = 0
  then
    raise exception
      'mutate_playlist_draft_v2 constraint statements no longer match the guarded migration';
  end if;

  function_definition := pg_catalog.replace(
    function_definition,
    deferred_constraint,
    'set constraints public.playlist_items_tenant_playlist_position_key_uq deferred;'
  );
  function_definition := pg_catalog.replace(
    function_definition,
    immediate_constraint,
    'set constraints public.playlist_items_tenant_playlist_position_key_uq immediate;'
  );

  execute function_definition;
end;
$migration$;
