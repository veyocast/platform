-- Same dynamic queue and existing exhaustion/reaper rules. New workers receive
-- real immutable identities and a fenced lease; older workers skip Source jobs.
alter table public.dynamic_render_jobs add column lease_token uuid;
do $migration$
declare original text;modern text;legacy text;marker text;
begin
 select pg_get_functiondef('public.claim_dynamic_render_job_v1(text,integer,integer)'::regprocedure) into original;
 modern:=replace(original,'FUNCTION public.claim_dynamic_render_job_v1(','FUNCTION public.claim_dynamic_render_job_v2(');
 marker:='snapshot_data_json jsonb)';
 if position(marker in modern)=0 then raise exception 'Dynamic claim output migration precondition failed';end if;
 modern:=replace(modern,marker,'snapshot_data_json jsonb, template_version_id uuid, template_slug text, source_revision_hash text, dynamic_slide_version_id uuid, lease_token uuid)');
 marker:='locked_by = left(p_worker_id, 120),';
 if position(marker in modern)=0 then raise exception 'Dynamic claim lease migration precondition failed';end if;
 modern:=replace(modern,marker,marker||E'\n        lease_token = gen_random_uuid(),');
 marker:=E'    slide.name,\n    slide.orientation,';
 if position(marker in modern)=0 then raise exception 'Dynamic claim presentation migration precondition failed';end if;
 modern:=replace(modern,marker,$identity$    case when snapshot.snapshot_data_json?'syncConfiguration' then snapshot.snapshot_data_json#>>'{syncConfiguration,seed,name}' else slide.name end,
    case when snapshot.snapshot_data_json?'syncConfiguration' then snapshot.snapshot_data_json#>>'{syncConfiguration,seed,orientation}' else slide.orientation end,$identity$);
 marker:=E'    snapshot.snapshot_data_json\n  from claimed';
 if position(marker in modern)=0 then raise exception 'Dynamic claim identity migration precondition failed';end if;
 modern:=replace(modern,marker,E'    snapshot.snapshot_data_json,\n    snapshot.template_version_id,\n    template.slug,\n    snapshot.source_revision_hash,\n    snapshot.dynamic_slide_version_id,\n    claimed.lease_token\n  from claimed');
 marker:='on version.id = snapshot.template_version_id;';
 if position(marker in modern)=0 then raise exception 'Dynamic claim template migration precondition failed';end if;
 modern:=replace(modern,marker,'on version.id = snapshot.template_version_id join public.dynamic_templates template on template.id=version.template_id;');
 execute modern;
 marker:='where job.status = ''queued''';
 if position(marker in original)=0 then raise exception 'Legacy dynamic claim migration precondition failed';end if;
 legacy:=replace(original,marker,marker||E'\n      and not exists(select 1 from public.dynamic_slide_snapshots source_snapshot where source_snapshot.id=job.snapshot_id and source_snapshot.snapshot_data_json?''syncConfiguration'')');
 execute legacy;
end;$migration$;

create function public.renew_dynamic_render_lease_v2(p_job_id uuid,p_worker_id text,p_lease_token uuid)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.dynamic_render_jobs set locked_at=clock_timestamp()
 where id=p_job_id and status='rendering' and locked_by=left(p_worker_id,120) and lease_token=p_lease_token;
 return found;
end;$$;
create function public.fail_dynamic_render_job_v2(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_error_code text,p_error_detail text,p_retryable boolean)
 returns text language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dynamic_render_jobs where id=p_job_id and status='rendering' and locked_by=left(p_worker_id,120)and lease_token=p_lease_token for update;
 if not found then raise exception 'dynamic render lease lost' using errcode='55000';end if;
 return public.fail_dynamic_render_job_v1(p_job_id,p_worker_id,p_error_code,p_error_detail,p_retryable);
end;$$;

-- A legacy completion cannot accidentally acknowledge only the first Source page.
alter function public.complete_dynamic_render_job_v1(uuid,text,text,bigint,text,integer,integer)rename to complete_dynamic_render_before_sync_v1;
alter function public.complete_dynamic_render_before_sync_v1(uuid,text,text,bigint,text,integer,integer)set schema private;
create function public.complete_dynamic_render_job_v1(p_job_id uuid,p_worker_id text,p_storage_path text,p_file_size_bytes bigint,p_checksum_sha256 text,p_width integer,p_height integer)
 returns uuid language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.dynamic_render_jobs job join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=job.tenant_id and snapshot.id=job.snapshot_id where job.id=p_job_id and snapshot.snapshot_data_json?'syncConfiguration')then raise exception 'Source render requires complete validated artifact' using errcode='23514';end if;
 return private.complete_dynamic_render_before_sync_v1(p_job_id,p_worker_id,p_storage_path,p_file_size_bytes,p_checksum_sha256,p_width,p_height);
end;$$;
revoke all on function public.claim_dynamic_render_job_v2(text,integer,integer),public.renew_dynamic_render_lease_v2(uuid,text,uuid),public.fail_dynamic_render_job_v2(uuid,text,uuid,text,text,boolean),public.complete_dynamic_render_job_v1(uuid,text,text,bigint,text,integer,integer),private.complete_dynamic_render_before_sync_v1(uuid,text,text,bigint,text,integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.claim_dynamic_render_job_v2(text,integer,integer),public.renew_dynamic_render_lease_v2(uuid,text,uuid),public.fail_dynamic_render_job_v2(uuid,text,uuid,text,text,boolean),public.complete_dynamic_render_job_v1(uuid,text,text,bigint,text,integer,integer)to service_role;
