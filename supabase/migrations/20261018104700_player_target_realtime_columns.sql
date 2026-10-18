-- One denied filter rejects the whole existing multiplexed Player channel,
-- including LED match updates. The server subscribes by the authorized device's
-- screen ID and reads only identity/revision; never screen names or settings.
grant select(id,tenant_id,target_revision)on public.screens to service_role;
