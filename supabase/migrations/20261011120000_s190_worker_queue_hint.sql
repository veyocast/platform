-- Separate v2 keeps old deployed workers compatible during the staged rollout.
-- Return readiness only, never tenant IDs, records or lease credentials.
create function public.get_worker_queue_hint_v2(p_max_attempts integer default 3)
returns integer language sql stable security definer set search_path='' as $$
  select public.get_render_queue_hint_v1(p_max_attempts)
    + case when exists(select 1 from private.published_data_refresh_queue
        where next_attempt_at<=now() and (lease_until is null or lease_until<=now())) then 8 else 0 end
    + case when exists(select 1 from private.publication_version_prune_queue where pending and not_before<=now()) then 16 else 0 end;
$$;
revoke all on function public.get_worker_queue_hint_v2(integer) from public,anon,authenticated;
grant execute on function public.get_worker_queue_hint_v2(integer) to service_role;
notify pgrst,'reload schema';
