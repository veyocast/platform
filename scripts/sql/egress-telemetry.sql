-- READ ONLY. Existing authenticated operator connection; not a billing meter.
begin read only;
set local statement_timeout = '10s';
select clock_timestamp() as observed_at, s.id as screen_id, d.id as device_id,
 d.app_version, d.last_seen_at, d.capabilities->'goalVideo'->>'runtime' as runtime,
 d.capabilities->'mediaTraffic' as media_traffic,
 d.storage_used_bytes, d.storage_quota_bytes
from public.player_devices d
join public.screens s on s.id=d.screen_id and s.tenant_id=d.tenant_id
where d.last_seen_at > now()-interval '24 hours'
order by d.last_seen_at desc limit 100;
rollback;
