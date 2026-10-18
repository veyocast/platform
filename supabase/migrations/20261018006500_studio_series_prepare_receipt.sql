-- Recover the original preparation before comparing mutable collection state.
-- Shape bounds, fresh tenant/read/render access and the actor-bound receipt
-- remain required. A new stale intent still fails before any job is requested.
do $migration$
declare definition text;revision_guard text;membership_guard text;receipt text;
begin
 select pg_get_functiondef('public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 revision_guard:=$guard$if series.revision is distinct from p_expected_revision then raise exception 'Studio series changed'using errcode='40001';end if;$guard$;
 membership_guard:=$guard$or jsonb_array_length(p_members)<>(select count(*)from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id)$guard$;
 receipt:=$receipt$replay:=private.begin_studio_command(series.tenant_id,'publisher.studio.prepare',p_idempotency_key,request);if replay is not null then return replay;end if;$receipt$;
 if position(revision_guard in definition)=0 or position(membership_guard in definition)=0 or position(receipt in definition)=0 then raise exception 'Studio preparation receipt migration precondition failed';end if;
 definition:=replace(definition,revision_guard,'');definition:=replace(definition,membership_guard,'');
 definition:=replace(definition,receipt,receipt||E'\n '||revision_guard||E'\n '||$guard$if jsonb_array_length(p_members)<>(select count(*)from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id)then raise exception 'invalid Studio member selection'using errcode='22023';end if;$guard$);
 execute definition;
end;$migration$;
revoke all on function public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid) to authenticated;
