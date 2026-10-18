-- S226: a newly claimed attempt starts at 1%, including transient retry and
-- expired-lease recovery. Within-attempt monotonic progress and lease fencing
-- stay in the existing claim/update commands; no retry budget or delay changes.
create function private.reset_studio_attempt_progress_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='preparing' and new.attempt_count=old.attempt_count+1 then
  new.progress:=1;
 end if;
 return new;
end;$$;
create trigger studio_render_attempt_progress_v1
 before update of attempt_count on public.studio_render_jobs
 for each row execute function private.reset_studio_attempt_progress_v1();
revoke all on function private.reset_studio_attempt_progress_v1() from public,anon,authenticated,service_role;
