begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('29800000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
select pg_temp.uid(n),'authenticated','authenticated','planning-s298-'||n||'@veyocast.test','test',now(),now(),now(),'{}','{}' from generate_series(1,3)n;
insert into public.profiles(id,display_name)select pg_temp.uid(n),'Planning test '||n from generate_series(1,3)n;
insert into public.tenants(id,name,slug,screen_limit)values
 (pg_temp.uid(10),'Planning A','planning-s298-a',10),(pg_temp.uid(11),'Planning B','planning-s298-b',10);
insert into public.tenant_settings(tenant_id,timezone_name)values(pg_temp.uid(10),'Europe/Amsterdam'),(pg_temp.uid(11),'Europe/Amsterdam');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 (pg_temp.uid(10),pg_temp.uid(1),'tenant_owner'),(pg_temp.uid(11),pg_temp.uid(2),'tenant_owner'),(pg_temp.uid(10),pg_temp.uid(3),'tenant_viewer');
insert into public.screens(id,tenant_id,name)values
 (pg_temp.uid(40),pg_temp.uid(10),'Kantine'),(pg_temp.uid(41),pg_temp.uid(10),'Entree'),(pg_temp.uid(42),pg_temp.uid(11),'Ander scherm');
insert into public.screen_groups(id,tenant_id,name)values(pg_temp.uid(50),pg_temp.uid(10),'Binnen');
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id)values(pg_temp.uid(10),pg_temp.uid(50),pg_temp.uid(40));
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.uid(20),pg_temp.uid(10),'image','Planning fixture','photo.webp','image/webp','ready',
 'tenants/'||pg_temp.uid(10)||'/assets/'||pg_temp.uid(20)||'/original.webp',2048,repeat('a',64),1920,1080);
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id=pg_temp.uid(20);
insert into public.playlists(id,tenant_id,name,created_by,updated_by)
select pg_temp.uid(n),pg_temp.uid(10),case n when 30 then 'Standaard' else 'Wedstrijdprogramma' end,pg_temp.uid(1),pg_temp.uid(1) from generate_series(30,31)n;
insert into public.playlist_items(id,tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,fit_mode,muted,created_by)
select pg_temp.uid(n+100),pg_temp.uid(10),pg_temp.uid(n),pg_temp.uid(20),0,1024,10,'contain',true,pg_temp.uid(1) from generate_series(30,31)n;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
create temporary table facts(key text primary key,value jsonb);
grant all on facts to authenticated,service_role;
insert into facts values('at',to_jsonb(date_trunc('minute',now())+interval '1 minute'));
insert into facts values('default',to_jsonb(private.materialize_playlist_configuration_s185(pg_temp.uid(30)))),
 ('planned',to_jsonb(private.materialize_playlist_configuration_s185(pg_temp.uid(31))));
update public.screens set default_playlist_id=pg_temp.uid(30),default_release_id=(select(value#>>'{}')::uuid from facts where key='default'),
 assigned_playlist_id=pg_temp.uid(30),assigned_release_id=(select(value#>>'{}')::uuid from facts where key='default') where tenant_id=pg_temp.uid(10);
create function pg_temp.at_time()returns timestamptz language sql as $$select(value#>>'{}')::timestamptz from facts where key='at'$$;
create function pg_temp.schedule(p_key integer,p_source text,p_target text,p_priority integer,p_start timestamptz,p_end timestamptz,
 p_kind text default 'once',p_recurrence jsonb default '{}')returns uuid language plpgsql as $$
declare result jsonb;
begin
 result:=public.mutate_content_schedule_v2(pg_temp.uid(10),null,0,'create',jsonb_build_object(
  'name','Rule '||p_key,'targetKind',p_target,'targetId',case when p_target='screen' then pg_temp.uid(40) else pg_temp.uid(50) end,
  'releaseId',(select value from facts where key='planned'),'timezoneName','Europe/Amsterdam','source',p_source,'priority',p_priority,
  'scheduleKind',p_kind,'startsAt',p_start,'endsAt',p_end,'recurrence',p_recurrence,'enabled',true),pg_temp.uid(p_key));
 insert into facts values('rule-'||p_key,to_jsonb(result->>'scheduleId'));
 return (result->>'scheduleId')::uuid;
end $$;
create function pg_temp.preview(p_at timestamptz default pg_temp.at_time(),p_screen integer default 40)returns jsonb language sql as $$
 select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(p_screen)],p_at)
$$;
set local role authenticated;
select pg_temp.schedule(100,'fallback','screen_group',1000,pg_temp.at_time()-interval '3 hours',pg_temp.at_time()+interval '8 hours');
select pg_temp.schedule(101,'publisher','screen_group',1000,pg_temp.at_time()-interval '3 hours',pg_temp.at_time()+interval '8 hours');
select pg_temp.schedule(102,'publisher','screen',10,pg_temp.at_time()-interval '2 hours',pg_temp.at_time()+interval '6 hours');
select pg_temp.schedule(103,'override','screen_group',0,pg_temp.at_time()-interval '1 hour',pg_temp.at_time()+interval '2 hours');
select pg_temp.schedule(104,'publisher','screen_group',1000,pg_temp.at_time()+interval '30 minutes',pg_temp.at_time()+interval '1 hour');
insert into facts values('before-preview',pg_temp.preview());
select is((select value#>>'{screens,0,winner,scheduleId}' from facts where key='before-preview'),
 (select value#>>'{}' from facts where key='rule-103'),'PLN-01 override wins before specificity and priority');
select is((select(value#>>'{screens,0,next,at}')::timestamptz from facts where key='before-preview'),pg_temp.at_time()+interval '2 hours',
 'PLN-02 a losing rule starting and ending in between is not Hierna');
select is((select value#>>'{screens,0,next,winner,scheduleId}' from facts where key='before-preview'),
 (select value#>>'{}' from facts where key='rule-102'),'PLN-02 override resumes individual publisher rule before group priority');
select is((pg_temp.preview(pg_temp.at_time()+interval '6 hours')#>>'{screens,0,winner,scheduleId}'),
 (select value#>>'{}' from facts where key='rule-101'),'half-open individual end resumes group publisher before regular');
select is(pg_temp.preview(pg_temp.at_time()+interval '8 hours')#>>'{screens,0,winner,source}','default',
 'after all scheduled intervals the then-current default wins');

select is((select assigned_release_id::text from public.screens where id=pg_temp.uid(40)),
 (select value#>>'{}' from facts where key='default'),'PLN-01 preview does not assign its calculated winner');
insert into facts values('state',jsonb_build_object(
 'schedules',(select count(*)from public.content_schedules),'releases',(select count(*)from public.playlist_releases),
 'assignments',(select count(*)from public.release_screen_assignments),'audits',(select count(*)from public.audit_events),
 'screen',(select to_jsonb(screen)from public.screens screen where id=pg_temp.uid(40))));
select lives_ok($$select pg_temp.preview()$$,'preview is repeatable without writes');
select is(jsonb_build_object(
 'schedules',(select count(*)from public.content_schedules),'releases',(select count(*)from public.playlist_releases),
 'assignments',(select count(*)from public.release_screen_assignments),'audits',(select count(*)from public.audit_events),
 'screen',(select to_jsonb(screen)from public.screens screen where id=pg_temp.uid(40))),
 (select value from facts where key='state'),'PLN-01 preview preserves row counts, audit and the complete screen target');
reset role;
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id)values(pg_temp.uid(10),pg_temp.uid(50),pg_temp.uid(41));
set local role authenticated;
select is(pg_temp.preview(pg_temp.at_time(),41)#>>'{screens,0,winner,source}','default',
 'PLN-03 later group membership does not expand published target snapshots');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(42)])$$,
 '42501',null,'INT-10 a screen from another tenant is refused');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],now(),32)$$,
 '22023',null,'preview horizon is bounded');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],'1999-12-31T23:59:59Z')$$,
 '22023',null,'preview rejects dates before the supported calendar range');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],'2100-01-01T00:00Z')$$,
 '22023',null,'preview rejects the exclusive upper calendar boundary');
select lives_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],'2035-01-01T00:00Z')$$,
 'bounded future seasons do not expire relative to the server clock');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40),pg_temp.uid(40)])$$,
 '22023',null,'duplicate targets cannot inflate scope');
select throws_ok($$select *from private.content_schedule_candidates_s298_v1(pg_temp.uid(10),pg_temp.uid(40),now())$$,
 '42501',null,'the private resolver cannot bypass the authenticated preview boundary');
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
select throws_ok($$select pg_temp.preview()$$,'42501',null,'INT-10 foreign tenant actor cannot inspect planning');
select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);
select lives_ok($$select pg_temp.preview()$$,'a viewer can inspect permitted planning without obtaining write permission');
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
reset role;
update public.screens set schedule_evaluated_at=null where tenant_id=pg_temp.uid(10);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($$select public.apply_due_content_schedules_v1(pg_temp.at_time())$$,'real scheduler applies the same shared resolver');
reset role;
select is((select active_schedule_id::text from public.screens where id=pg_temp.uid(40)),
 (select value#>>'{screens,0,winner,scheduleId}'from facts where key='before-preview'),
 'PLN-01 real assigned schedule is exactly the preview winner');
select is((select assigned_release_id::text from public.screens where id=pg_temp.uid(40)),
 (select value#>>'{screens,0,winner,releaseId}'from facts where key='before-preview'),
 'PLN-01 real assigned release is exactly the preview release');
set local role service_role;
select lives_ok($$select public.apply_due_content_schedules_v1(pg_temp.at_time()+interval '2 hours')$$,
 'real scheduler can evaluate the predicted resumption');
reset role;
select is((select active_schedule_id::text from public.screens where id=pg_temp.uid(40)),
 (select value#>>'{screens,0,next,winner,scheduleId}'from facts where key='before-preview'),
 'PLN-02 real resumption agrees with Hierna after override');
select ok(not has_function_privilege('anon','public.preview_effective_planning_v1(uuid,uuid[],timestamptz,integer,jsonb,uuid)','EXECUTE'),
 'anonymous callers cannot execute the planning preview');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
insert into facts values('proposal',jsonb_build_object('name','Voorgenomen overname',
 'releaseId',(select value from facts where key='planned'),'targetKind','all','targetId','',
 'startsAt',pg_temp.at_time(),'endsAt',pg_temp.at_time()+interval '20 minutes',
 'source','override','priority',900,'scheduleKind','once','recurrence','{}'::jsonb));
insert into facts values('proposal-report',public.preview_effective_planning_v1(pg_temp.uid(10),
 array[pg_temp.uid(40),pg_temp.uid(41)],pg_temp.at_time(),8,(select value from facts where key='proposal')));
select ok((select bool_and((screen#>>'{winner,draft}')::boolean)
 from facts cross join lateral jsonb_array_elements(value->'screens')screen where key='proposal-report'),
 'concept all-screen batch models individual rules without storing them');
select is((select count(*) from public.content_schedules),5::bigint,'proposal creates no persisted schedule');
select is(public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],pg_temp.at_time(),8,null,pg_temp.uid(31))
 #>>'{screens,0,winner,source}','override','publication preflight retains the current override above a proposed default');
select is(public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],pg_temp.at_time()+interval '8 hours',8,null,pg_temp.uid(31))
 #>>'{screens,0,winner,draft}','true','publication preflight shows the draft when normal default resumes');
select is((select default_playlist_id from public.screens where id=pg_temp.uid(40)),pg_temp.uid(30),
 'publication preflight does not replace the current default');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],pg_temp.at_time(),8,
 (select value||jsonb_build_object('unexpected',true)from facts where key='proposal'))$$,
 '22023',null,'unknown proposal fields cannot bypass validation');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],pg_temp.at_time(),8,
 (select value||jsonb_build_object('releaseId',pg_temp.uid(999))from facts where key='proposal'))$$,
 '42501',null,'a proposal cannot reference an unavailable release');
select throws_ok($$select public.preview_effective_planning_v1(pg_temp.uid(10),array[pg_temp.uid(40)],pg_temp.at_time(),8,
 (select value||jsonb_build_object('scheduleId',(select value from facts where key='rule-102'),
 'expectedRevision',999,'targetKind','screen','targetId',pg_temp.uid(40))from facts where key='proposal'))$$,
 'PT409',null,'stale proposal revisions are explicitly refused');
select pg_temp.schedule(110,'publisher','screen',100,'2026-03-28T00:00Z','2026-03-30T00:00Z','daily',
 '{"startTime":"02:30","endTime":"03:30"}');
select is((pg_temp.preview('2026-03-29T00:30Z')#>>'{screens,0,next,at}')::timestamptz,'2026-03-29T01:00Z'::timestamptz,
 'PLN-03 spring clock jump can activate a local window whose start time does not exist');
select is(pg_temp.preview('2026-03-29T01:00Z')#>>'{screens,0,winner,scheduleId}',
 (select value#>>'{}'from facts where key='rule-110'),'spring edge agrees with the active due predicate');
select pg_temp.schedule(111,'publisher','screen',100,'2026-10-24T00:00Z','2026-10-26T00:00Z','daily',
 '{"startTime":"02:30","endTime":"03:30"}');
select is((pg_temp.preview('2026-10-25T00:45Z')#>>'{screens,0,next,at}')::timestamptz,'2026-10-25T01:00Z'::timestamptz,
 'PLN-03 winter clock rollback can leave the first occurrence of a local window');
select is(pg_temp.preview('2026-10-25T01:00Z')#>>'{screens,0,winner,source}','default',
 'winter rollback resumes default until the second local start');
select is((pg_temp.preview('2026-10-25T01:00Z')#>>'{screens,0,next,at}')::timestamptz,'2026-10-25T01:30Z'::timestamptz,
 'PLN-03 second occurrence of an ambiguous local start is evaluated');
select is((pg_temp.preview('2026-10-25T01:30Z')#>>'{screens,0,next,at}')::timestamptz,'2026-10-25T02:30Z'::timestamptz,
 'second local interval ends at its actual UTC boundary');
select pg_temp.schedule(112,'publisher','screen',100,'2026-11-13T00:00Z','2026-11-15T00:00Z','weekly',
 '{"weekdays":[5],"startTime":"22:00","endTime":"02:00"}');
select is((pg_temp.preview('2026-11-13T21:30Z')#>>'{screens,0,next,at}')::timestamptz,'2026-11-13T23:00Z'::timestamptz,
 'PLN-03 midnight follows the existing weekday-at-evaluation semantics');
reset role;
select *from finish();
rollback;
