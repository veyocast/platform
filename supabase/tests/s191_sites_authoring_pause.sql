begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$select ('19136000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
 select pg_temp.uid(n),'authenticated','authenticated','s191-pause-'||n||'@veyocast.test','test',now(),now(),now(),'{}','{}'from generate_series(1,3)n;
insert into public.profiles(id,display_name)select pg_temp.uid(n),'Pause fixture '||n from generate_series(1,3)n;
insert into public.platform_memberships(user_id,role)values(pg_temp.uid(3),'platform_admin');
insert into public.tenants(id,name,slug)values(pg_temp.uid(10),'Pause tenant A','s191-pause-a'),(pg_temp.uid(11),'Pause tenant B','s191-pause-b');
insert into public.tenant_settings(tenant_id)values(pg_temp.uid(10)),(pg_temp.uid(11));
insert into public.tenant_memberships(tenant_id,user_id,role)values(pg_temp.uid(10),pg_temp.uid(1),'tenant_owner'),(pg_temp.uid(11),pg_temp.uid(2),'tenant_owner');
create temporary table pause_fixtures(name text primary key,value jsonb);grant all on pause_fixtures to authenticated;
insert into pause_fixtures values('document','{"schemaVersion":1,"artboard":{"width":1920,"height":1080,"orientation":"landscape","background":{"kind":"solid","color":"#FAFAF7"},"safeArea":{"top":64,"right":64,"bottom":64,"left":64}},"motion":{"enabled":false,"durationMs":15000,"fps":30},"elements":[],"metadata":{"fontRegistryVersion":"2026-07-24.1","tenantBrandApplied":false},"sitesPresentation":{"kind":"studio","schemaVersion":1,"rendererVersion":"sites-v11","sourceRevision":"b1cae899af19fc39908217253094c5240d7359fc","slide":{"id":"s191-fixture","name":"Typed club update","title":"Onze club","time":"","subtitle":"","location":"","duration":15,"color":"#03438a","background":"#052a55","bold":true,"italic":false,"align":"left","size":58,"context":true,"showLocation":true,"animation":"Geen","transition":"Rustig","orientation":"landscape","themeId":"onzetrots-tv","tv":{"kind":"programma","title":"Onze club","rows":[{"id":"fixture-match","primary":"Team A","home":"Team A","away":"Team B","time":"14:00"}],"scale":100}}}}'::jsonb),('configuration','{"schemaVersion":1,"rendererVersion":"sites-v11","sourceRevision":"b1cae899af19fc39908217253094c5240d7359fc","themeId":"onzetrots-tv","orientation":"landscape","provider":"sportlink","title":"Stand","subtitle":"","overlay":25,"accent":"#03438a","layout":"full","scale":100,"align":"left","safeArea":4,"seconds":15,"rowsPerPage":8,"ledTheme":"blue","ledMoment":"live","ledSide":"unknown","titleScale":100,"scoreScale":100,"logoScale":100,"teamScale":100,"showBranding":true,"showSceneLabel":true,"showClock":true,"showTimeline":true,"timelineLimit":3,"backgroundFit":"contain","grunge":55,"animation":"rise"}'::jsonb);

insert into public.studio_projects(id,tenant_id,owner_user_id,name,orientation,width,height,motion_enabled,duration_ms)
values(pg_temp.uid(20),pg_temp.uid(10),pg_temp.uid(1),'Immutable Sites fixture','landscape',1920,1080,false,15000);
insert into public.studio_project_drafts(tenant_id,project_id,document_json,document_hash)values(pg_temp.uid(10),pg_temp.uid(20),jsonb_set((select value from pause_fixtures where name='document'),'{sitesPresentation,slide,title}','"Current draft"'),repeat('a',64));
insert into public.studio_revisions(id,tenant_id,project_id,revision_number,draft_revision,document_json,document_hash)
values(pg_temp.uid(21),pg_temp.uid(10),pg_temp.uid(20),1,0,(select value from pause_fixtures where name='document'),repeat('b',64));
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.uid(30),pg_temp.uid(10),'image','Verified source','fixture.png','image/png','ready','tenants/'||pg_temp.uid(10)||'/assets/'||pg_temp.uid(30)||'/original/fixture.png',1024,repeat('c',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select pg_temp.uid(31),tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id=pg_temp.uid(30);
insert into public.playlists(id,tenant_id,name,created_by,updated_by)values(pg_temp.uid(40),pg_temp.uid(10),'Published frozen Sites',pg_temp.uid(1),pg_temp.uid(1)),(pg_temp.uid(41),pg_temp.uid(10),'Historical no snapshot',pg_temp.uid(1),pg_temp.uid(1)),(pg_temp.uid(42),pg_temp.uid(11),'Other tenant playlist',pg_temp.uid(2),pg_temp.uid(2));
insert into public.playlist_items(id,tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,fit_mode,muted,sites_configuration_json)
values(pg_temp.uid(43),pg_temp.uid(10),pg_temp.uid(40),pg_temp.uid(30),0,1024,15,'contain',true,(select value from pause_fixtures where name='configuration'));
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
insert into pause_fixtures values('release',to_jsonb(private.materialize_playlist_configuration_s185(pg_temp.uid(40))));
insert into pause_fixtures select 'release-hash',to_jsonb(manifest_hash)from public.playlist_releases where id=((select value from pause_fixtures where name='release')#>>'{}')::uuid;
-- A genuinely historical release lacking an authoring snapshot remains recoverable.
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values(pg_temp.uid(45),pg_temp.uid(10),pg_temp.uid(41),1,repeat('d',64),'{}',1,15,1024);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,sites_configuration_json)
select pg_temp.uid(10),pg_temp.uid(41),pg_temp.uid(45),asset.id,variant.id,0,15,'contain',true,'image','Historical frozen',variant.storage_path,variant.mime_type,variant.file_size_bytes,variant.checksum_sha256,(select value from pause_fixtures where name='configuration')from public.media_assets asset join public.media_variants variant on variant.asset_id=asset.id where asset.id=pg_temp.uid(30);
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)values(pg_temp.uid(50),pg_temp.uid(10),'Read-only fixture','sportlink','active','ready','{}');
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,selection_mode,status,configuration_json)
select pg_temp.uid(n),pg_temp.uid(10),'Dynamic fixture '||n,'sport_standing','landscape',chosen.template_id,chosen.version_id,pg_temp.uid(50),'latest','draft',
 jsonb_build_object('editorial',jsonb_build_object('schemaVersion',2,'themeSelection',jsonb_build_object('ref',jsonb_build_object('catalog','v2','id','fieldflow','version','1.0.0'),'modePolicy',jsonb_build_object('kind','fixed','mode','light'),'accent',null,'support',null,'categoryOverrides','[]'::jsonb)))||case when n=51 then jsonb_build_object('sitesConfiguration',(select value from pause_fixtures where name='configuration'))else '{}'::jsonb end
from generate_series(51,52)n cross join lateral(select template.id as template_id,version.id as version_id from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id where template.slide_type='sport_standing'and template.orientation='landscape'and template.status='published'limit 1) chosen;
-- The cross-tenant move fixture starts valid in B with only system assets.
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256)
values(pg_temp.uid(32),pg_temp.uid(11),'image','B fallback','b.png','image/png','ready','tenants/'||pg_temp.uid(11)||'/assets/'||pg_temp.uid(32)||'/original/b.png',1024,repeat('e',64));
insert into public.playlist_items(id,tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,fit_mode,muted,sites_configuration_json)
values(pg_temp.uid(44),pg_temp.uid(11),pg_temp.uid(42),pg_temp.uid(32),0,1024,15,'contain',true,(select value from pause_fixtures where name='configuration'));
insert into public.ledscores_connections(id,tenant_id,name,club_slug,status)values(pg_temp.uid(80),pg_temp.uid(10),'LED paused fixture','pause-fixture','active');
insert into public.ledscores_goal_alerts(id,tenant_id,connection_id,name,duration_ms,underlay_policy,draft_config)
values(pg_temp.uid(81),pg_temp.uid(10),pg_temp.uid(80),'Existing alert',8000,'continue',jsonb_build_object('schemaVersion',1,'ownDesign','{}'::jsonb,'opponentDesign','{}'::jsonb,'unknownDesign','{}'::jsonb,'canvasExperience',jsonb_build_object('scenes',jsonb_build_object('goalOwn',jsonb_build_object('landscape',jsonb_build_object('sitesConfiguration',(select value||'{"provider":"led-scores"}'::jsonb from pause_fixtures where name='configuration')))))));
select ok(not has_function_privilege('anon','public.get_sites_authoring_state_v1(uuid)','execute'),'anonymous cannot read tenant pause state');
select ok(not has_table_privilege('authenticated','private.sites_immutable_restore_contexts','insert'),'browser cannot forge restore contexts');
select ok(not has_table_privilege('service_role','private.sites_immutable_restore_contexts','insert'),'service API cannot forge restore contexts');
select ok(not has_function_privilege('authenticated','public.restore_studio_revision_before_sites_pause_v1(uuid,uuid,bigint,uuid)','execute'),'legacy Studio restore entry is private');
select ok(not has_function_privilege('authenticated','public.restore_playlist_release_to_draft_before_sites_pause_v1(uuid,bigint,uuid)','execute'),'legacy playlist restore entry is private');
set local role authenticated;select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select is(public.get_sites_authoring_state_v1(pg_temp.uid(10))->'paused','false'::jsonb,'absent managed negative flag defaults to available');
select throws_ok($$select public.get_sites_authoring_state_v1(pg_temp.uid(11))$$,'42501','Sites authoring read permission required','tenant A cannot read B pause state');
select throws_ok($$select public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',true,'Pause fixture decision',0,pg_temp.uid(60))$$,'42501','platform feature rollout permission required','tenant owner cannot pause or grant rights');
select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);select set_config('request.jwt.claim.aal','aal1',true);
select throws_ok($$select public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',true,'Pause fixture decision',0,pg_temp.uid(60))$$,'42501','sensitive command requires aal2','pause requires real AAL2');
select set_config('request.jwt.claim.aal','aal2',true);
insert into pause_fixtures values('pause',public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',true,'Pause fixture decision',0,pg_temp.uid(60)));
select is((select value->>'outcome'from pause_fixtures where name='pause'),'applied','managed platform command really pauses authoring');
select is(public.get_sites_authoring_state_v1(pg_temp.uid(10))->'paused','true'::jsonb,'actual scoped readback acknowledges pause');
select is(public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',true,'Pause fixture decision',0,pg_temp.uid(60)),(select value from pause_fixtures where name='pause'),'pause retry preserves idempotent acknowledgement');
select throws_ok($$select public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',false,'Stale resume fixture',0,pg_temp.uid(61))$$,'PT409','feature rollout revision conflict','stale resume cannot reopen authoring');
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select throws_ok($$select public.create_studio_project_v1(pg_temp.uid(10),'Blocked Sites','landscape',(select value from pause_fixtures where name='document'),'{}'::uuid[],'design',pg_temp.uid(62))$$,'55000','Sites authoring is paused','real create RPC cannot introduce a new Sites document');
select throws_ok($$select public.save_studio_draft_v1(pg_temp.uid(20),0,jsonb_set((select value from pause_fixtures where name='document'),'{sitesPresentation,slide,title}','"Changed while paused"'),'{}'::uuid[],pg_temp.uid(63))$$,'55000','Sites authoring is paused','real CAS save cannot change a paused document');
select is((select draft_revision from public.studio_project_drafts where project_id=pg_temp.uid(20)),0::bigint,'failed save preserves current revision');
select throws_ok($$select public.update_tenant_theme_settings_v3(profile.tenant_id,profile.revision,'onzetrots-tv','11.0.0',profile.selection_json->'modePolicy',profile.color_overrides,profile.appearance_config,profile.selection_json->>'accent',profile.selection_json->>'support')from public.tenant_theme_profiles profile where profile.tenant_id=pg_temp.uid(10)and profile.theme_id='onzetrots-tv'$$,'55000','Sites authoring is paused','real guarded tenant TV-theme selection cannot bypass authoring pause');

select throws_ok($$update public.studio_project_drafts set updated_by=pg_temp.uid(1)where project_id=pg_temp.uid(20)$$,'42501',null,'direct browser draft writes remain denied');
select throws_ok($$update public.playlist_items set sites_configuration_json=jsonb_set(sites_configuration_json,'{title}','"Unauthorized edit"')where id=pg_temp.uid(43)$$,'55000','Sites authoring is paused','direct RLS-authorized placement editing cannot bypass pause');
select throws_ok($$update public.playlist_items set sites_configuration_json=null where id=pg_temp.uid(43)$$,'55000','Sites authoring is paused','removing a Sites configuration is authoring too');
select lives_ok($$update public.playlist_items set duration_seconds=20 where id=pg_temp.uid(43)$$,'clock changes do not rewrite frozen Sites configuration');
select throws_ok($$update public.dynamic_slides set configuration_json=jsonb_set(configuration_json,'{sitesConfiguration,title}','"Changed"')where id=pg_temp.uid(51)$$,'42501',null,'browser direct dynamic DML remains denied');
reset role;
select throws_ok($$update public.dynamic_slides set configuration_json=jsonb_set(configuration_json,'{sitesConfiguration,title}','"Changed"')where id=pg_temp.uid(51)$$,'55000','Sites authoring is paused','server-side dynamic edits also reach the central pause guard');
select throws_ok($$update public.dynamic_slides set configuration_json=jsonb_set(configuration_json,'{editorial,themeSelection,ref,id}','"onzetrots-tv"')||'{"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"onzetrots-tv","version":"11.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}}}'::jsonb where id=pg_temp.uid(52)$$,'55000','Sites authoring is paused','theme-only dynamic input cannot bypass Sites opt-in');
reset role;
select lives_ok($$update public.dynamic_slides set updated_at=now(),last_error_code=null where id=pg_temp.uid(51)$$,'unchanged provider refresh bookkeeping remains available');
select throws_ok($$update public.studio_project_drafts set document_json=jsonb_set(document_json,'{sitesPresentation,slide,title}','"Privileged direct edit"')where project_id=pg_temp.uid(20)$$,'55000','Sites authoring is paused','even direct server SQL goes through the central draft guard');
select lives_ok($$update public.tenant_theme_profiles set revision=revision+1 where tenant_id=pg_temp.uid(10)and theme_id='onzetrots-tv'$$,'unchanged profile bookkeeping is permitted');
select throws_ok($$update public.tenant_theme_profiles set selection_json=jsonb_set(selection_json,'{modePolicy,mode}','"dark"')where tenant_id=pg_temp.uid(10)and theme_id='onzetrots-tv'$$,'55000','Sites authoring is paused','new TV theme authoring is centrally blocked');
select throws_ok($$update public.tenant_settings set default_theme_id='onzetrots-tv',default_theme_version='11.0.0'where tenant_id=pg_temp.uid(10)$$,'55000','Sites authoring is paused','default TV selection cannot bypass pause');
select is((select manifest_hash from public.playlist_releases where id=((select value from pause_fixtures where name='release')#>>'{}')::uuid),(select value#>>'{}'from pause_fixtures where name='release-hash'),'pause leaves the published immutable release hash unchanged');
set local role authenticated;select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
insert into pause_fixtures values('studio-restored',public.restore_studio_revision_v1(pg_temp.uid(20),pg_temp.uid(21),0,pg_temp.uid(64)));
select is((select value->>'outcome'from pause_fixtures where name='studio-restored'),'restored','exact immutable Studio revision restores during pause');
select is((select document_json from public.studio_project_drafts where project_id=pg_temp.uid(20)),(select value from pause_fixtures where name='document'),'restore copies exact immutable source content');
insert into pause_fixtures values('playlist-restored',public.restore_playlist_release_to_draft_v1(((select value from pause_fixtures where name='release')#>>'{}')::uuid,(select revision from public.playlists where id=pg_temp.uid(40)),pg_temp.uid(65)));
select is((select value->>'outcome'from pause_fixtures where name='playlist-restored'),'restored','exact frozen playlist restores while paused');
select is((select sites_configuration_json from public.playlist_items where playlist_id=pg_temp.uid(40)),(select value from pause_fixtures where name='configuration'),'real restore reload preserves full Sites configuration');
select lives_ok($$select public.restore_playlist_release_to_draft_v1(pg_temp.uid(45),(select revision from public.playlists where id=pg_temp.uid(41)),pg_temp.uid(66))$$,'historical frozen release without authoring snapshot also restores');
select is((select sites_configuration_json from public.playlist_items where playlist_id=pg_temp.uid(41)),(select value from pause_fixtures where name='configuration'),'historical restore recovers the exact frozen config');
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
select throws_ok($$select public.restore_studio_revision_v1(pg_temp.uid(20),pg_temp.uid(21),1,pg_temp.uid(67))$$,'42501','actor cannot restore Studio project','tenant B cannot invoke the restore exception');
select throws_ok($$select public.restore_playlist_release_to_draft_v1(((select value from pause_fixtures where name='release')#>>'{}')::uuid,2,pg_temp.uid(68))$$,'42501','actor cannot restore this release','tenant B cannot restore A frozen release');
reset role;
select is((select count(*)from private.sites_immutable_restore_contexts),0::bigint,'private exception contexts are removed before either restore returns');
-- Both source and target write capabilities are real; a 42501 cannot hide this guard.
insert into public.tenant_memberships(tenant_id,user_id,role)values(pg_temp.uid(11),pg_temp.uid(1),'tenant_owner');
set local role authenticated;select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select throws_ok($$update public.playlist_items set tenant_id=pg_temp.uid(10),playlist_id=pg_temp.uid(40),media_asset_id=pg_temp.uid(30),sort_order=1,position_key=2048 where id=pg_temp.uid(44)$$,'55000','Sites authoring is paused','unchanged system-only cfg cannot be moved into the paused tenant by an actor owning both tenants');
select is((select tenant_id from public.playlist_items where id=pg_temp.uid(44)),pg_temp.uid(11),'rejected transfer leaves the source tenant placement intact');
select set_config('app.sites_restore','true',true);
select throws_ok($$update public.playlist_items set sites_configuration_json=jsonb_set(sites_configuration_json,'{title}','"Forged restore"')where playlist_id=pg_temp.uid(40)$$,'55000','Sites authoring is paused','browser GUC cannot impersonate the private restore provenance');
select lives_ok($$select public.restore_studio_revision_v1(pg_temp.uid(20),pg_temp.uid(21),0,pg_temp.uid(70))$$,'restore conflict retains the original CAS response');
select is(public.restore_studio_revision_v1(pg_temp.uid(20),pg_temp.uid(21),0,pg_temp.uid(64)),(select value from pause_fixtures where name='studio-restored'),'exact restore replay retains the first acknowledgement');
reset role;
select is((select count(*)from private.sites_immutable_restore_contexts),0::bigint,'conflict and replay close private restore contexts too');
select lives_ok($$update public.studio_project_drafts set updated_by=pg_temp.uid(1)where project_id=pg_temp.uid(20)$$,'same-content worker bookkeeping remains available through guarded tables');
select throws_ok($$update public.ledscores_goal_alerts set draft_config=jsonb_set(draft_config,'{canvasExperience,scenes,goalOwn,landscape,sitesConfiguration,title}','"Changed alert"')where id=pg_temp.uid(81)$$,'55000','Sites authoring is paused','LED scene authoring cannot bypass the managed stop');
select throws_ok($$update public.ledscores_goal_alerts set draft_config=draft_config-'canvasExperience'where id=pg_temp.uid(81)$$,'55000','Sites authoring is paused','removing the Sites LED scene is guarded too');
select lives_ok($$update public.ledscores_goal_alerts set updated_at=now()where id=pg_temp.uid(81)$$,'unchanged alert bookkeeping remains available');
update public.tenant_settings set default_theme_id='onzetrots-tv',default_theme_version='11.0.0'where tenant_id=pg_temp.uid(11);
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)values(pg_temp.uid(53),pg_temp.uid(11),'B inherited-theme source','sportlink','active','ready','{}');

select ok(exists(select 1 from public.audit_events where tenant_id=pg_temp.uid(10)and action='tenant.feature_flag.changed'),'pause uses the existing audited managed decision');
update private.tenant_feature_flag_definitions set kill_switch_active=true where flag_key='sites_authoring_paused';
select ok(private.sites_authoring_is_paused_v1(pg_temp.uid(11)),'global emergency stop pauses even a tenant without a configured flag');
select throws_ok($$insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,selection_mode,status,configuration_json)
 select pg_temp.uid(54),pg_temp.uid(11),'Inherited TV authoring','sport_standing','landscape',template_id,template_version_id,pg_temp.uid(53),'latest','draft',configuration_json from public.dynamic_slides where id=pg_temp.uid(52)$$,'55000','Sites authoring is paused','legacy-looking config inheriting the tenant TV default still reaches the central Sites stop');

update public.tenant_feature_flags set enabled=false where tenant_id=pg_temp.uid(10)and flag_key='sites_authoring_paused';
select ok(private.sites_authoring_is_paused_v1(pg_temp.uid(10)),'raw off never reverses a global stop for a negative flag');
select throws_ok($$update public.studio_project_drafts set document_json=jsonb_set(document_json,'{sitesPresentation,slide,title}','"Global stop bypass"')where project_id=pg_temp.uid(20)$$,'55000','Sites authoring is paused','global stop blocks real authoring');
update private.tenant_feature_flag_definitions set kill_switch_active=false where flag_key='sites_authoring_paused';
set local role authenticated;select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);select set_config('request.jwt.claim.aal','aal2',true);
select is(public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',true,'Managed pause repeat after global check',2,pg_temp.uid(71))->>'outcome','applied','managed cohort command can reapply the explicit pause');
select is(public.set_tenant_feature_flag_v2(pg_temp.uid(10),'sites_authoring_paused',false,'Managed cohort resume after reviewed rollback',3,pg_temp.uid(72))->>'outcome','applied','managed CAS command really resumes authoring with an acknowledgement');
reset role;

set local role authenticated;select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select is(public.get_sites_authoring_state_v1(pg_temp.uid(10))->'paused','false'::jsonb,'actual readback returns available after both stop conditions clear');
select lives_ok($$select public.save_studio_draft_v1(pg_temp.uid(20),1,jsonb_set((select value from pause_fixtures where name='document'),'{sitesPresentation,slide,title}','"Authorized resumed change"'),'{}'::uuid[],pg_temp.uid(69))$$,'authoring really resumes through original CAS save');
reset role;
select *from finish();rollback;
