begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.uid(value integer) returns uuid language sql immutable as $$select ('31720000-0000-4000-8000-'||lpad(value::text,12,'0'))::uuid$$;
insert into auth.users(id,email) values(pg_temp.uid(1),'s317-domains@test.invalid');
insert into public.profiles(id,display_name) values(pg_temp.uid(1),'Domain administrator');
insert into public.platform_memberships(user_id,role) values(pg_temp.uid(1),'platform_admin');
insert into public.tenants(id,name,slug,screen_limit) values(pg_temp.uid(10),'Agent domains','s317-domains',10);
insert into public.tenant_settings(tenant_id) values(pg_temp.uid(10));
insert into public.tenant_memberships(tenant_id,user_id,role) values(pg_temp.uid(10),pg_temp.uid(1),'tenant_owner');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.uid(21),pg_temp.uid(10),'image','Synthetic poster','poster.png','image/png','ready','tenants/'||pg_temp.uid(10)||'/assets/'||pg_temp.uid(21)||'/original/poster.png',2048,repeat('a',64),1920,1080);
insert into public.media_variants(asset_id,tenant_id,variant_type,mime_type,storage_path,checksum_sha256,file_size_bytes,width,height)
values(pg_temp.uid(21),pg_temp.uid(10),'original','image/png','tenants/'||pg_temp.uid(10)||'/assets/'||pg_temp.uid(21)||'/original/poster.png',repeat('a',64),2048,1920,1080);
insert into storage.objects(bucket_id,name) values('tenant-media','tenants/'||pg_temp.uid(10)||'/assets/'||pg_temp.uid(21)||'/original/poster.png');
insert into public.screens(id,tenant_id,name,status) values(pg_temp.uid(41),pg_temp.uid(10),'Barscherm','active'),(pg_temp.uid(42),pg_temp.uid(10),'Kantine','active');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1),'aal','aal2','role','authenticated')::text,true);
select is(public.set_tenant_feature_flag_v2(pg_temp.uid(10),'control_ai_agent',true,'Explicit isolated activation',0,pg_temp.uid(80))->>'outcome','applied','existing platform rollout service can explicitly enable AI');
select ok(public.get_ai_agent_state_v1(pg_temp.uid(10)),'rollout confirmation and agent guard agree');
insert into public.ai_conversations(id,tenant_id,user_id) values(pg_temp.uid(20),pg_temp.uid(10),pg_temp.uid(1));
create temporary table results(name text primary key,value jsonb);grant all on results to authenticated,service_role;
insert into results values('create',public.create_ai_proposal_v1(pg_temp.uid(10),pg_temp.uid(20),jsonb_build_object('steps',jsonb_build_array(
 jsonb_build_object('domain','playlist','operation','create','commandKey',pg_temp.uid(81),'args',jsonb_build_object('newId',pg_temp.uid(30),'name','Confirmed club playlist','description','Preserved')),
 jsonb_build_object('domain','playlist','operation','add_item','commandKey',pg_temp.uid(82),'args',jsonb_build_object('id',pg_temp.uid(30),'revision',0,'payload',jsonb_build_object('mediaAssetId',pg_temp.uid(21)))),
 jsonb_build_object('domain','playlist','operation','add_item','commandKey',pg_temp.uid(83),'args',jsonb_build_object('id',pg_temp.uid(30),'revision',1,'payload',jsonb_build_object('mediaAssetId',pg_temp.uid(21))))))));
select is((select count(*) from public.playlists where id=pg_temp.uid(30)),0::bigint,'new playlist proposal alone creates no playlist');
select public.decide_ai_proposal_v1((select(value->>'id')::uuid from results where name='create'),(select value->>'plan_hash' from results where name='create'),true);
select public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='create'),(select value->>'plan_hash' from results where name='create'),0);
select public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='create'),(select value->>'plan_hash' from results where name='create'),1);
select is(public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='create'),(select value->>'plan_hash' from results where name='create'),2)->>'status','completed','create and two additions use real shared domain writers');
select is((select count(*) from public.playlist_items where playlist_id=pg_temp.uid(30)),2::bigint,'same media has two distinct retained playlist occurrences');
select is((select count(distinct id) from public.playlist_items where playlist_id=pg_temp.uid(30)),2::bigint,'duplicate media never collapses item identities');
insert into results values('order-before',(select jsonb_agg(jsonb_build_object('id',id,'duration',duration_seconds) order by sort_order) from public.playlist_items where playlist_id=pg_temp.uid(30)));
insert into results values('publish',public.create_ai_proposal_v1(pg_temp.uid(10),pg_temp.uid(20),jsonb_build_object('steps',jsonb_build_array(
 jsonb_build_object('domain','playlist','operation','move_item','commandKey',pg_temp.uid(84),'args',jsonb_build_object('id',pg_temp.uid(30),'revision',2,'payload',jsonb_build_object('itemId',(select id from public.playlist_items where playlist_id=pg_temp.uid(30) order by sort_order desc limit 1),'direction','up'))),
 jsonb_build_object('domain','playlist','operation','publish','commandKey',pg_temp.uid(85),'args',jsonb_build_object('id',pg_temp.uid(30),'revision',3,'screenIds',jsonb_build_array(pg_temp.uid(41),pg_temp.uid(42)),'notes','Exact approved publication'))))));
select public.decide_ai_proposal_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),true);
select public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),0);
select is((select id::text from public.playlist_items where playlist_id=pg_temp.uid(30) order by sort_order limit 1),(select value#>>'{1,id}' from results where name='order-before'),'only the selected second occurrence moves one position');
select is((select id::text from public.playlist_items where playlist_id=pg_temp.uid(30) order by position_key,id limit 1),(select value#>>'{1,id}' from results where name='order-before'),'canonical position-key order agrees with the exact moved occurrence');
select is(public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),1)->>'status','failed','publication without a fresh trusted preflight cannot proceed');
select is((select count(*) from public.playlist_releases where playlist_id=pg_temp.uid(30)),0::bigint,'changing a status label does not create a fake release');
reset role;
set local role service_role;
select ok(public.register_ai_execution_check_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),1,pg_temp.uid(1),pg_temp.uid(10)),'trusted checked step is tied to exact proposal hash user tenant and cursor');
reset role;
set local role authenticated;
select is(public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),1)->>'status','completed','real guarded publication completes the same approved plan');
select is((select count(*) from public.playlist_releases where playlist_id=pg_temp.uid(30)),1::bigint,'one real immutable release exists');
select is((select source_item_id::text from public.playlist_release_items where playlist_id=pg_temp.uid(30) order by sort_order limit 1),(select value#>>'{1,id}' from results where name='order-before'),'published immutable item order agrees with the preview and chosen occurrence');
select is((select count(*) from public.screens where tenant_id=pg_temp.uid(10) and assigned_release_id is not null),2::bigint,'both exact target screens receive the same publication');
select is((select count(distinct assigned_release_id) from public.screens where tenant_id=pg_temp.uid(10)),1::bigint,'shared target identity is preserved across both screens');
select is(jsonb_array_length(public.get_ai_playlist_reach_v1(pg_temp.uid(30))),2,'proposal reach finds both actual shared target screens');
reset role;
insert into public.screens(id,tenant_id,name,status) values(pg_temp.uid(43),pg_temp.uid(10),'Groepsdoel','active'),(pg_temp.uid(44),pg_temp.uid(10),'Zonebestemming','active');
insert into public.screen_groups(id,tenant_id,name,default_playlist_id,default_release_id) select pg_temp.uid(50),pg_temp.uid(10),'Gedeelde programmering',pg_temp.uid(30),assigned_release_id from public.screens where id=pg_temp.uid(41);
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id) values(pg_temp.uid(10),pg_temp.uid(50),pg_temp.uid(43));
insert into public.screen_compositions(id,tenant_id,screen_id,revision,configuration_json,published_by) values(pg_temp.uid(60),pg_temp.uid(10),pg_temp.uid(44),1,'{}',pg_temp.uid(1));
insert into public.screen_composition_bindings(tenant_id,composition_id,zone_id,playlist_id,release_id,config_revision) select pg_temp.uid(10),pg_temp.uid(60),'main',pg_temp.uid(30),assigned_release_id,1 from public.screens where id=pg_temp.uid(41);
update public.screens set composition_id=pg_temp.uid(60),composition_revision=1 where id=pg_temp.uid(44);
set local role authenticated;
select is(jsonb_array_length(public.get_ai_playlist_reach_v1(pg_temp.uid(30))),4,'reach also covers actual group defaults and active composition bindings');
select is(jsonb_array_length(public.get_ai_target_screens_v1(pg_temp.uid(10),'screen_group',pg_temp.uid(50))),1,'planning resolves the real current group members before approval');
select is(jsonb_array_length(public.get_ai_target_screens_v1(pg_temp.uid(10),'all',null)),4,'all-screen planning names the complete current target set');
select throws_ok($$select public.get_ai_target_screens_v1(pg_temp.uid(99),'all',null)$$,'42501',null,'target inspection cannot cross into a different tenant');
select public.execute_ai_proposal_step_v1((select(value->>'id')::uuid from results where name='publish'),(select value->>'plan_hash' from results where name='publish'),1);
select is((select count(*) from public.playlist_releases where playlist_id=pg_temp.uid(30)),1::bigint,'double approval or lost publication response creates no extra release');
select is((select count(*) from public.player_devices where tenant_id=pg_temp.uid(10) and active_release_id is not null),0::bigint,'publication does not forge a player acknowledgement');
select is(public.set_tenant_feature_flag_v2(pg_temp.uid(10),'control_ai_agent',false,'Explicit isolated disable',1,pg_temp.uid(86))->>'outcome','applied','normal feature rollout disables new agent work');
select is(public.create_playlist_draft_v2(pg_temp.uid(10),pg_temp.uid(31),'Manual still works',null,pg_temp.uid(87))->>'outcome','created','normal manual playlist creation does not depend on AI flag or provider');
select is(public.create_playlist_draft_v2(pg_temp.uid(10),pg_temp.uid(31),'Manual still works',null,pg_temp.uid(87))->>'playlistId',pg_temp.uid(31)::text,'shared normal creation receipt is idempotent');
select * from finish();
rollback;
