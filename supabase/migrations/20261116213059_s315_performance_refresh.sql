set lock_timeout = '3s';
set statement_timeout = '15s';

create index player_heartbeats_tenant_recent_idx
  on public.player_heartbeats (tenant_id, created_at desc)
  include (screen_id, active_release_id, runtime_state);

do $eligibility$
declare
  definition text;
  marker text := $marker$(not(frozen.snapshot_data_json?'syncConfiguration')and not(frozen.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb and frozen.snapshot_data_json?'menuDocument'))$marker$;
begin
  select pg_get_functiondef('private.enqueue_sync_binary_before_dom_v2(uuid,uuid)'::regprocedure)into definition;
  if position(marker in definition)=0 then raise exception 'Binary eligibility predecessor mismatch';end if;
  execute replace(definition,marker,$replacement$(not(frozen.snapshot_data_json?'syncConfiguration')and ((frozen.snapshot_data_json->'syncPlaybackProtocol'='2'::jsonb and frozen.snapshot_data_json?'menuDocument')is distinct from true))$replacement$);
end;
$eligibility$;

revoke all on function private.enqueue_sync_binary_before_dom_v2(uuid,uuid)from public,anon,authenticated,service_role;

reset lock_timeout;
reset statement_timeout;
