-- PostgREST 14 retries SQLSTATE40001 internally, including after client abort.
-- These seven S226 authoring/request boundaries must reject stale commands
-- once. Keep every existing auth/RLS/receipt/CAS operation in the private base;
-- translate only the outward conflict to the nonretryable HTTP409 SQLSTATE.
do $migration$
declare
 signature text; original oid; base_name text; argument_types text;
 arguments text; argument_names text; return_type text; metadata record;
begin
 foreach signature in array array[
  'public.mutate_sync_studio_series_v1(uuid,bigint,uuid,bigint,text,text,uuid[],uuid)',
  'public.prepare_publisher_sync_project_v1(uuid,bigint,uuid)',
  'public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid)',
  'public.mutate_studio_project_v1(uuid,bigint,text,jsonb,uuid)',
  'public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)',
  'public.update_marketing_inquiry_v1(uuid,integer,text,text)',
  'public.retry_marketing_inquiry_mail_v1(uuid,integer,boolean)'
 ] loop
  original:=to_regprocedure(signature);
  if original is null then raise exception 'S226 conflict boundary is missing: %',signature;end if;
  select * into metadata from pg_proc where oid=original;
  if not metadata.prosecdef or metadata.proretset or metadata.proargmodes is not null
   or array_length(metadata.proargnames,1) is distinct from metadata.pronargs
   or not has_function_privilege('authenticated',original,'execute')
   or has_function_privilege('anon',original,'execute')
   or has_function_privilege('service_role',original,'execute') then
   raise exception 'S226 conflict boundary contract differs: %',signature;
  end if;
  argument_types:=oidvectortypes(metadata.proargtypes);
  arguments:=pg_get_function_arguments(original);
  return_type:=pg_get_function_result(original);
  if return_type not in('jsonb','integer') then raise exception 'Unexpected S226 boundary return type';end if;
  select string_agg(format('%I',name),', 'order by ordinal)into argument_names
   from unnest(metadata.proargnames)with ordinality as names(name,ordinal);
  base_name:='s226_conflict_base_'||metadata.proname;
  if to_regprocedure(format('private.%I(%s)',base_name,argument_types))is not null then
   raise exception 'S226 private conflict base already exists';
  end if;
  execute format('alter function %s rename to %I',signature,base_name);
  execute format('alter function public.%I(%s) set schema private',base_name,argument_types);
  execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',base_name,argument_types);
  execute format($definition$
   create function public.%I(%s)returns %s language plpgsql security definer set search_path='' as $body$
   begin
    return private.%I(%s);
   exception when serialization_failure then
    raise exception using errcode='PT409',message='De versie is intussen gewijzigd. Herlaad de actuele gegevens en bevestig je keuze opnieuw.';
   end;
   $body$;
  $definition$,metadata.proname,arguments,return_type,base_name,argument_names);
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',metadata.proname,argument_types);
  execute format('grant execute on function public.%I(%s) to authenticated',metadata.proname,argument_types);
 end loop;
end;
$migration$;

notify pgrst,'reload schema';
