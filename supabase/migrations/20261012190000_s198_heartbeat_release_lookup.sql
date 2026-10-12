begin;

-- Keep any stricter session limit. Fail atomically rather than queueing
-- heartbeat writes behind an unbounded lock wait or index build.
do $$
begin
  if current_setting('lock_timeout')::interval = interval '0'
     or current_setting('lock_timeout')::interval > interval '1 second' then
    perform set_config('lock_timeout', '1s', true);
  end if;
  if current_setting('statement_timeout')::interval = interval '0'
     or current_setting('statement_timeout')::interval > interval '30 seconds' then
    perform set_config('statement_timeout', '30s', true);
  end if;
end;
$$;

-- The bounded pruner rechecks every reference before removing heartbeat
-- history for one obsolete release. Support that exact tenant/release lookup.
create index player_heartbeats_tenant_active_release_idx
  on public.player_heartbeats (tenant_id, active_release_id)
  where active_release_id is not null;

comment on index public.player_heartbeats_tenant_active_release_idx is
  'Supports tenant-scoped obsolete-release heartbeat lookups without changing release eligibility or access policies.';

commit;
