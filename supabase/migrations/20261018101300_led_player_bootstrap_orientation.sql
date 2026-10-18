-- The Player service intentionally has no direct SELECT on screens. Add the
-- paired display property inside the existing token-bound authority, retaining
-- its immutable alert-version selection and catch-up ordering unchanged.
do $migration$
declare definition text;updated text;matches integer;
begin
 select pg_get_functiondef('public.get_ledscores_player_bootstrap_v1(text)'::regprocedure)into definition;
 select count(*)into matches from regexp_matches(definition,$pattern$'screenId',[[:space:]]*device_record.screen_id$pattern$,'g');
 if matches<>2 then raise exception 'LED bootstrap orientation precondition failed: %',matches;end if;
 updated:=regexp_replace(definition,$pattern$'screenId',[[:space:]]*device_record.screen_id$pattern$,
  $replacement$'screenId',device_record.screen_id,
      'screenOrientation',(select screen.orientation from public.screens screen
        where screen.tenant_id=device_record.tenant_id
          and screen.id=device_record.screen_id and screen.deleted_at is null)$replacement$,'g');
 execute updated;
end;$migration$;
notify pgrst,'reload schema';
