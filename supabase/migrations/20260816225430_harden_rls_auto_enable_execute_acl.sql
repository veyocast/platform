-- Newly created Supabase projects can contain this platform-managed event
-- trigger function. The trigger is useful: it enables RLS automatically when
-- a table is created in public. It executes as its postgres owner, so none of
-- the Data API roles need permission to call the function directly.
--
-- Older projects do not necessarily contain the function. Keep this migration
-- forward-only and portable across both project shapes.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke execute on function public.rls_auto_enable() '
      'from public, anon, authenticated, service_role';
  end if;
end;
$migration$;
