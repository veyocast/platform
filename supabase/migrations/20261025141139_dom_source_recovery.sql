begin;

-- Fifty normalized articles may each have a hero and a QR, plus one logo.
-- Keep the full producer output and preserve the legacy RPC and its ACL.
alter table public.dynamic_news_articles drop constraint dynamic_news_articles_title_check;
alter table public.dynamic_news_articles add constraint dynamic_news_articles_title_check
 check(length(btrim(title)) between 1 and 400);
do $migration$
declare definition text;signature text;before text;
begin
 definition:=pg_get_functiondef('public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)'::regprocedure);
 before:=$needle$jsonb_array_length(coalesce(p_media_assets, '[]'::jsonb)) > 51$needle$;
 if position(before in definition)=0 then raise exception 'S292 RSS media bound predecessor mismatch';end if;
 definition:=replace(definition,before,$replace$jsonb_array_length(coalesce(p_media_assets, '[]'::jsonb)) > 101
    or jsonb_array_length(coalesce(p_media_assets, '[]'::jsonb)) > 2 * jsonb_array_length(p_articles) + 1$replace$);
 definition:=replace(definition,$needle$jsonb_typeof(p_articles) <> 'array'$needle$,$replace$jsonb_typeof(p_articles) is distinct from 'array'$replace$);
 execute definition;
 for signature in select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname in('complete_scheduled_rss_sync_v1','complete_scheduled_rss_sync_v2','record_rss_sync_v1') loop
  definition:=pg_get_functiondef(signature::regprocedure);
  execute replace(definition,$needle$length(btrim(article ->> 'title')) not between 1 and 160$needle$,
   $replace$length(btrim(coalesce(article ->> 'title',''))) not between 1 and 400$replace$);
 end loop;
 -- A restarted process may reuse its worker name. Fence the original run as
 -- well, so it cannot complete/fail the lease held by a newer source attempt.
 foreach signature in array array['public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)','public.fail_scheduled_rss_sync_v1(uuid,text,text,text)']loop
  definition:=pg_get_functiondef(signature::regprocedure);
  before:='and sync_locked_by = left(p_worker_id, 120)';
  if position(before in definition)=0 then raise exception 'S292 RSS lease predecessor mismatch';end if;
  execute replace(definition,before,before||E'\n    and (last_attempt_at is null or last_attempt_at <= run_record.started_at)');
 end loop;
end;$migration$;

-- Store the receipt in the same transaction as the complete article/media set.
-- An interrupted response can be retried without duplicating data or revisions.
alter table public.dynamic_sync_runs
 add column completion_fingerprint text check(completion_fingerprint is null or completion_fingerprint~'^[a-f0-9]{64}$'),
 add column completion_worker text check(completion_worker is null or length(completion_worker)<=120);
alter function public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)rename to complete_scheduled_rss_before_s292_v1;
alter function public.complete_scheduled_rss_before_s292_v1(uuid,text,jsonb,jsonb)set schema private;
create function public.complete_scheduled_rss_sync_v2(p_run_id uuid,p_worker_id text,p_articles jsonb,p_media_assets jsonb default '[]'::jsonb)
returns integer language plpgsql security definer set search_path=''as $$
declare run_record public.dynamic_sync_runs%rowtype;result integer;
 fingerprint text:=encode(extensions.digest(convert_to(jsonb_build_array(p_articles,p_media_assets)::text,'UTF8'),'sha256'),'hex');
begin
 select *into run_record from public.dynamic_sync_runs where id=p_run_id for update;
 if not found then raise exception 'RSS sync run not found'using errcode='P0002';end if;
 if run_record.status='succeeded'then
  if run_record.completion_fingerprint=fingerprint and run_record.completion_worker=left(p_worker_id,120)then return run_record.item_count;end if;
  raise exception 'RSS completion receipt mismatch'using errcode='23514';
 end if;
 result:=private.complete_scheduled_rss_before_s292_v1(p_run_id,p_worker_id,p_articles,p_media_assets);
 update public.dynamic_sync_runs set completion_fingerprint=fingerprint,completion_worker=left(p_worker_id,120)where id=p_run_id;
 return result;
end;$$;
revoke all on function private.complete_scheduled_rss_before_s292_v1(uuid,text,jsonb,jsonb),public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)to service_role;

create function public.renew_scheduled_rss_sync_v1(p_run_id uuid,p_worker_id text)returns boolean
language plpgsql security definer set search_path='' as $$
declare run_record public.dynamic_sync_runs%rowtype;
begin
 select *into run_record from public.dynamic_sync_runs where id=p_run_id and status='running'for update;
 if not found then return false;end if;
 update public.dynamic_data_sources set sync_locked_at=clock_timestamp()
 where id=run_record.data_source_id and tenant_id=run_record.tenant_id and kind='rss'and status='active'
  and provider_status='syncing'and sync_locked_by=left(p_worker_id,120)
  and(last_attempt_at is null or last_attempt_at<=run_record.started_at);
 return found;
end;$$;
revoke all on function public.renew_scheduled_rss_sync_v1(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.renew_scheduled_rss_sync_v1(uuid,text)to service_role;

-- Both means the selected team in either role. Pool standings intentionally
-- remain complete; only the match datasets receive this membership predicate.
do $migration$
declare definition text;before text;
begin
 definition:=pg_get_functiondef('private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)'::regprocedure);
 before:=$needle$and (coalesce(selection->>'matchLocation','both')='both' or private.sportlink_match_matches_team_selection_v1(p_slide.tenant_id,p_slide.data_source_id,match,selection));$needle$;
 if position(before in definition)=0 then raise exception 'S292 matchday predecessor mismatch';end if;
 execute replace(definition,before,$replace$and (match.home_team->>'externalId'=scope_context->>'teamId' or match.away_team->>'externalId'=scope_context->>'teamId')
   and (coalesce(selection->>'matchLocation','both')='both'
    or (selection->>'matchLocation'='home'and match.home_team->>'externalId'=scope_context->>'teamId')
    or (selection->>'matchLocation'='away'and match.away_team->>'externalId'=scope_context->>'teamId'));$replace$);
 -- The source birthday feed admits 250 records. Period/team/privacy selection
 -- happens before the presentation's separate 200-row/120-second limits.
 definition:=pg_get_functiondef('private.build_dynamic_snapshot_before_s261_prices_v1(public.dynamic_slides)'::regprocedure);
 before:='jsonb_array_length(node)>200';
 if position(before in definition)=0 then raise exception 'S292 birthday bound predecessor mismatch';end if;
 execute replace(definition,before,$replace$jsonb_array_length(node)>(case when p_slide.slide_type='sport_birthdays'then 250 else 200 end)$replace$);
 definition:=pg_get_functiondef('private.build_dynamic_snapshot_data_before_s129_home_arrivals(public.dynamic_slides)'::regprocedure);
 before:='select max(source_fetched_at) into fetched_at';
 if position(before in definition)=0 then raise exception 'S292 birthday observation predecessor mismatch';end if;
 execute replace(definition,before,$replace$select coalesce(max(source_fetched_at),(select policy.last_success_at from public.sportlink_sync_policies policy
  where policy.tenant_id=p_slide.tenant_id and policy.connection_id=connection.id and policy.dataset_group='public_people')) into fetched_at$replace$);
end;$migration$;
notify pgrst,'reload schema';
commit;
