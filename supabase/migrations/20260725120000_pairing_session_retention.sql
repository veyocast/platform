-- Failed pairing sessions are operationally useful only during their short
-- claim window. Remove unclaimed rows after fifteen minutes while retaining
-- claimed sessions as device and audit evidence.

create or replace function private.cleanup_stale_pairing_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pairing_sessions
  where status in (
    'pending'::public.pairing_session_status,
    'expired'::public.pairing_session_status,
    'cancelled'::public.pairing_session_status
  )
    and created_at <= now() - interval '15 minutes';
  return new;
end;
$$;

revoke all on function private.cleanup_stale_pairing_sessions()
from public, anon, authenticated;

drop trigger if exists pairing_attempts_cleanup_stale_sessions
on private.pairing_creation_attempts;
create trigger pairing_attempts_cleanup_stale_sessions
after insert on private.pairing_creation_attempts
for each row execute function private.cleanup_stale_pairing_sessions();

delete from public.pairing_sessions
where status in (
  'pending'::public.pairing_session_status,
  'expired'::public.pairing_session_status,
  'cancelled'::public.pairing_session_status
)
  and created_at <= now() - interval '15 minutes';
