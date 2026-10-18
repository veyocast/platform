begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
-- Match Storage API's existing SQL-delete context so its generic direct-SQL
-- guard cannot mask the new reference guard. Never set this in product code.
set local storage.allow_delete_query='true';
select no_plan();
-- SQL admission fixtures, not claims about decoded physical files/playback.
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select ('23100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email)select pg_temp.id(n),'frame-'||n||'@test.invalid'from generate_series(1,4)n;
insert into public.profiles(id,display_name)select pg_temp.id(n),'Frame actor '||n from generate_series(1,4)n;
insert into public.tenants(id,name,slug)values(pg_temp.id(11),'Frame tenant A','s231-frame-a'),(pg_temp.id(12),'Frame tenant B','s231-frame-b');
insert into public.tenant_settings(tenant_id)values(pg_temp.id(11)),(pg_temp.id(12));
insert into public.tenant_memberships(tenant_id,user_id,role)values(pg_temp.id(11),pg_temp.id(1),'tenant_owner'),(pg_temp.id(12),pg_temp.id(2),'tenant_owner'),(pg_temp.id(11),pg_temp.id(3),'tenant_viewer'),(pg_temp.id(11),pg_temp.id(4),'tenant_admin');
insert into public.media_assets(id,tenant_id,created_by,title,kind,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height,duration_seconds)
select pg_temp.id(n),pg_temp.id(case when n=23 then 12 else 11 end),pg_temp.id(case when n=23 then 2 else 1 end),'Frame source '||n,
 case when n=21 then 'video'::public.media_asset_kind else 'image'::public.media_asset_kind end,'source-'||n||case when n=21 then '.mp4'else '.png'end,
 case when n=21 then 'video/mp4'else 'image/png'end,'ready','tenants/'||pg_temp.id(case when n=23 then 12 else 11 end)||'/assets/'||pg_temp.id(n)||'/original/source',4096,repeat(case when n=21 then 'a'else 'b'end,64),1920,1080,case when n=21 then 240 else null end from generate_series(21,23)n;
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds)
select pg_temp.id(right(id::text,12)::integer+10),tenant_id,id,case when kind='video'then 'player_1080p'::public.media_variant_type else 'original'::public.media_variant_type end,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds from public.media_assets where id in(pg_temp.id(21),pg_temp.id(22),pg_temp.id(23));
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id in(pg_temp.id(31),pg_temp.id(32),pg_temp.id(33));
create function pg_temp.settings(p_name text default 'Raw video design',p_duration integer default 220,p_fit text default 'cover',p_focus text default 'center',p_photo boolean default true)returns jsonb language sql immutable as $$
select jsonb_build_object('schemaVersion',1,'name',p_name,'orientation','landscape','durationSeconds',p_duration,'fitMode',p_fit,'focus',p_focus,
 'appearance',jsonb_build_object('themeId','onzetrots-tv','accentColor','#1763ed','background',case when p_photo then jsonb_build_object('kind','image','mediaAssetId',pg_temp.id(22),'position','top')else '{"kind":"preset","preset":"clubmuur"}'::jsonb end),
 'sourceMetadata','{"title":"Metadata only","headline":"","subtitle":"","body":"","footer":"","font":"Arial","scale":100,"alignment":"left","safeMargin":5,"showLogo":true,"showFooter":true,"motion":"geen"}'::jsonb);
$$;
create function pg_temp.sources(p_photo boolean default true)returns jsonb language sql stable as $$
select jsonb_agg(jsonb_build_object('role',case when asset_id=pg_temp.id(21)then 'media'else 'background'end,'mediaAssetId',asset_id,'variantId',id,'checksumSha256',checksum_sha256,'byteSize',file_size_bytes)order by asset_id)
from public.media_variants where id=pg_temp.id(31)or(p_photo and id=pg_temp.id(32));$$;
create function pg_temp.create_frame(p_frame integer,p_nonce integer,p_primary boolean default true)returns jsonb language sql as $$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(p_frame),pg_temp.id(21),pg_temp.sources(),pg_temp.settings(),pg_temp.id(p_nonce),p_primary)$$;
create function pg_temp.command(p_frame integer,p_revision integer,p_operation text,p_payload jsonb,p_nonce integer)returns jsonb language sql as $$select public.mutate_media_frame_v1(pg_temp.id(11),pg_temp.id(p_frame),p_revision,p_operation,p_payload,pg_temp.id(p_nonce))$$;
create function pg_temp.batch(p_operations jsonb,p_nonce integer)returns jsonb language sql as $$select public.mutate_playlist_batch_v1(pg_temp.id(51),(select revision from public.playlists where id=pg_temp.id(51)),p_operations,pg_temp.id(p_nonce))$$;
create temporary table results(name text primary key,value jsonb);grant all on results to authenticated;
insert into results values('counts',jsonb_build_object('assets',(select count(*)from public.media_assets),'variants',(select count(*)from public.media_variants),'objects',(select count(*)from storage.objects)));
set local role anon;
select throws_ok($$select public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(21))$$,'42501',null,'anonymous cannot read a private frame source');
select throws_ok($$select pg_temp.create_frame(41,101)$$,'42501',null,'anonymous cannot create a frame');
select throws_ok($$select *from public.media_frames$$,'42501',null,'anonymous has no frame table privilege');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select throws_ok($$select pg_temp.create_frame(41,101)$$,'42501',null,'viewer cannot create');
select is(public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(21))#>>'{variant,byteSize}','4096','viewer can read own verified media DTO');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select is((public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(21))->>'durationSeconds')::numeric,240::numeric,'the real four-minute source duration is retained');
select throws_ok($$select public.get_media_frame_source_v1(pg_temp.id(12),pg_temp.id(23))$$,'42501',null,'tenant A cannot read B source');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(12),pg_temp.id(43),pg_temp.id(23),'[]',pg_temp.settings(),pg_temp.id(103))$$,'42501',null,'foreign tenant create denied before source resolution');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(41),pg_temp.id(21),pg_temp.sources(),pg_temp.settings()||'{"url":"https://injected.invalid"}',pg_temp.id(104))$$,'23514',null,'SQL rejects unknown settings keys and URL injection');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(41),pg_temp.id(21),jsonb_set(pg_temp.sources(),'{0,checksumSha256}',to_jsonb(repeat('f',64))),pg_temp.settings(),pg_temp.id(105))$$,'23514',null,'SQL checks the actual source checksum');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(41),pg_temp.id(21),pg_temp.sources(false),pg_temp.settings(),pg_temp.id(106))$$,'23514',null,'selected background requires its exact verified source');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(49),pg_temp.id(21),pg_temp.sources(),pg_temp.settings('Too long video',241),pg_temp.id(140),false)$$,'23514',null,'create rejects video duration beyond the actual240-second source');
select is((select count(*)from public.media_frames where id=pg_temp.id(49)),0::bigint,'rejected overshoot creates no logical frame');
select is((select count(*)from public.publisher_command_receipts where tenant_id=pg_temp.id(11)and idempotency_key=pg_temp.id(140)),0::bigint,'rejected overshoot creates no success receipt');
insert into results values('video-boundary',public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(49),pg_temp.id(21),pg_temp.sources(),pg_temp.settings('Video at source limit',240),pg_temp.id(141),false));
select is((select settings_json->>'durationSeconds'from public.media_frame_versions where id=(select(value->>'versionId')::uuid from results where name='video-boundary')),'240','exact source-duration boundary is accepted without clipping');
select throws_ok($$select pg_temp.command(49,1,'save',jsonb_build_object('settings',pg_temp.settings('Overshoot saved video',900),'expectedSources',pg_temp.sources()),142)$$,'23514',null,'save rejects an overlong video before a new immutable version');
select is((select count(*)from public.media_frame_versions where frame_id=pg_temp.id(49)),1::bigint,'rejected save preserves previous immutable version');
insert into results values('video-boundary-save',pg_temp.command(49,1,'save',jsonb_build_object('settings',pg_temp.settings('Boundary saved video',240),'expectedSources',pg_temp.sources()),143));
select is(pg_temp.command(49,1,'save',jsonb_build_object('settings',pg_temp.settings('Boundary saved video',240),'expectedSources',pg_temp.sources()),143),(select value from results where name='video-boundary-save'),'boundary save receipt remains replayable before current CAS');
select is(public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(49),pg_temp.id(21),pg_temp.sources(),pg_temp.settings('Video at source limit',240),pg_temp.id(141),false),(select value from results where name='video-boundary'),'boundary create receipt remains replayable after later save');
insert into results values('pre-copy',pg_temp.create_frame(44,107,false));
select is((select count(*)from public.media_frames where is_primary),0::bigint,'copy before first edit does not implicitly save a primary design');
select is((select count(*)from public.sync_content_library_v1 where id=pg_temp.id(21)),1::bigint,'untouched original asset card stays visible beside its new copy');
select is((select content_key from public.sync_content_library_v1 where id=pg_temp.id(44)),'media-frame:'||pg_temp.id(44),'logical copy has independent library identity');
insert into results values('create',pg_temp.create_frame(41,101));
insert into results values('long-image',public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(50),pg_temp.id(22),jsonb_build_array(jsonb_build_object('role','media','mediaAssetId',pg_temp.id(22),'variantId',pg_temp.id(32),'checksumSha256',repeat('b',64),'byteSize',4096)),pg_temp.settings('Long image',901,'contain','center',false),pg_temp.id(144)));
select is((select settings_json->>'durationSeconds'from public.media_frame_versions where id=(select(value->>'versionId')::uuid from results where name='long-image')),'901','901-second image is valid and is never clipped by the video bound');

select is((select value->>'outcome'from results where name='create'),'created','first explicit save creates primary and immutable v1');
select is(pg_temp.create_frame(41,101),(select value from results where name='create'),'identical lost-response retry returns the original receipt');
select throws_ok($$select pg_temp.create_frame(45,101)$$,'23505',null,'same nonce with changed body cannot create another frame');
select throws_ok($$select pg_temp.create_frame(45,108)$$,'PT409',null,'second primary loses with an application conflict');
select is((select count(*)from public.sync_content_library_v1 where id=pg_temp.id(21)),1::bigint,'primary replaces legacy row without a duplicate asset card');
select is((select revision from public.sync_content_library_v1 where id=pg_temp.id(21)),1::bigint,'primary exposes operational revision');
select is((select media_frame_id from public.sync_content_library_v1 where id=pg_temp.id(21)),pg_temp.id(41),'primary identity stays separate from asset identity');
select is((select placement->>'kind'from public.sync_content_library_v1 where id=pg_temp.id(21)),'media_frame','ready placement explicitly names frame version');
select throws_ok($$update public.media_frames set revision=99 where id=pg_temp.id(41)$$,'42501',null,'browser cannot bypass CAS with table update');
select throws_ok($$insert into public.media_frame_versions(tenant_id,frame_id,version_number,settings_json)values(pg_temp.id(11),pg_temp.id(41),99,pg_temp.settings())$$,'42501',null,'browser cannot insert arbitrary immutable versions');
insert into results values('duplicate',pg_temp.command(41,1,'duplicate',jsonb_build_object('newFrameId',pg_temp.id(42)),109));
select is((select value->>'outcome'from results where name='duplicate'),'duplicated','duplicate creates an independently editable logical frame');
select is(pg_temp.command(41,1,'duplicate',jsonb_build_object('newFrameId',pg_temp.id(42)),109),(select value from results where name='duplicate'),'duplicate receipt replay does not create another version/copy');
reset role;
select is((select count(*)from public.media_assets),(select(value->>'assets')::bigint from results where name='counts'),'logical duplicate creates no physical asset');
select is((select count(*)from public.media_variants),(select(value->>'variants')::bigint from results where name='counts'),'logical duplicate creates no variant');
select is((select count(*)from storage.objects),(select(value->>'objects')::bigint from results where name='counts'),'logical duplicate creates no Storage object');
-- One verified untouched asset exercises the legacy branch beside logical copies.
insert into public.media_assets(id,tenant_id,created_by,title,kind,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.id(26),pg_temp.id(11),pg_temp.id(1),'Legacy picker source','image','legacy.png','image/png','ready','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(26)||'/legacy.png',128,repeat('c',64),32,32);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.id(36),pg_temp.id(11),pg_temp.id(26),'original','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(26)||'/legacy.png','image/png',128,repeat('c',64),32,32);
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id=pg_temp.id(36);
insert into public.media_folders(id,tenant_id,name)values(pg_temp.id(91),pg_temp.id(11),'Pickerfolder');
insert into public.media_tags(id,tenant_id,name)values(pg_temp.id(92),pg_temp.id(11),'Bronlabel');
insert into public.media_collections(id,tenant_id,name)values(pg_temp.id(93),pg_temp.id(11),'Pickercollectie');
insert into public.media_collections(id,tenant_id,name,status,archived_at)values(pg_temp.id(94),pg_temp.id(11),'Inactive collection secret','archived',now());
insert into public.media_collections(id,tenant_id,name)values(pg_temp.id(95),pg_temp.id(12),'Foreign collection secret');
update public.media_assets set folder_id=pg_temp.id(91)where id=pg_temp.id(21);
insert into public.media_asset_tags(tenant_id,media_asset_id,tag_id)values(pg_temp.id(11),pg_temp.id(21),pg_temp.id(92));
insert into public.media_collection_items(tenant_id,media_asset_id,collection_id)values(pg_temp.id(11),pg_temp.id(21),pg_temp.id(93));
insert into public.media_collection_items(tenant_id,media_asset_id,collection_id)values(pg_temp.id(11),pg_temp.id(21),pg_temp.id(94)),(pg_temp.id(12),pg_temp.id(23),pg_temp.id(95));
insert into public.media_asset_favorites(tenant_id,media_asset_id,user_id)values(pg_temp.id(11),pg_temp.id(21),pg_temp.id(1));
set local role anon;
select throws_ok($$select *from public.list_publisher_media_frame_library_v1(pg_temp.id(11))$$,'42501',null,'anonymous cannot read logical picker library');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11))),6::bigint,'picker unifies primary, three copies, image primary and one untouched asset');
select is((select media_frame_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(21)),pg_temp.id(41),'picker primary keeps asset selection identity and explicit frame identity');
select is((select source_asset_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(42)),pg_temp.id(21),'copy picker identity retains separate physical source');
select is((select title from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(42)),'Raw video design (kopie)','picker displays actual copy name instead of original asset title');
select ok((select media_frame_id is null and media_frame_version_id is null from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(26)),'untouched verified asset keeps legacy placement identity');
select is((select total_count from public.list_publisher_media_frame_library_v1(pg_temp.id(11),2,2)limit 1),6::bigint,'picker total count is complete before pagination');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),2,2)),2::bigint,'picker returns only the requested bounded page');
select is((select count(distinct asset_id)from(select asset_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11),2,0)union all select asset_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11),2,2)union all select asset_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11),2,4))pages),6::bigint,'three pages have no duplicate or omitted logical identities');
select is((select asset_id from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,'(kopie)')),pg_temp.id(42),'search finds exact logical copy by saved name');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,'Bronlabel')),4::bigint,'source tag search includes its independent logical copies');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,'Pickercollectie')),4::bigint,'active collection-name search includes its ready logical copies');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,'Inactive collection secret')),0::bigint,'inactive collection names cannot match picker search');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,'Foreign collection secret')),0::bigint,'foreign collection names cannot leak matching assets or logical copies');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,null,null,pg_temp.id(94))),0::bigint,'an inactive collection id cannot resurrect archived collection membership');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,null,pg_temp.id(91))),4::bigint,'folder filtering uses physical source metadata before counting');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,null,null,pg_temp.id(93))),4::bigint,'collection filtering includes all ready copies of that source');
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,null,null,null,true)),4::bigint,'current actor favorite source yields its ready logical copies');
select is((select tags from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(42)),'[{"name":"Bronlabel"}]'::jsonb,'picker tags belong to source metadata');
select is((select collections from public.list_publisher_media_frame_library_v1(pg_temp.id(11))where asset_id=pg_temp.id(42)),'[{"name":"Pickercollectie"}]'::jsonb,'picker collections belong to source metadata');
select throws_ok($$select *from public.list_publisher_media_frame_library_v1(pg_temp.id(12))$$,'42501',null,'picker denies foreign tenant before any source query');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11),50,0,null,null,null,true)),0::bigint,'favorites stay actor scoped even in the same tenant');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
reset role;
select throws_ok($$update public.media_frame_versions set settings_json=pg_temp.settings('Tampered')where frame_id=pg_temp.id(41)$$,'55000',null,'even privileged version rewrite is rejected');
select throws_ok($$update public.media_frame_version_assets set checksum_sha256=repeat('f',64)where version_id=(select current_version_id from public.media_frames where id=pg_temp.id(41))$$,'55000',null,'frozen source fingerprints cannot be rewritten');
select throws_ok($$update public.media_assets set width=1280 where id=pg_temp.id(21)$$,'55000',null,'retained source dimensions cannot change beneath a frozen frame');
select throws_ok($$update public.media_assets set checksum_sha256=repeat('f',64)where id=pg_temp.id(21)$$,'55000',null,'retained source facts cannot be replaced through asset metadata');
select lives_ok($$update public.media_assets set title='Renamed shared source'where id=pg_temp.id(21)$$,'ordinary source labels remain editable');
select throws_ok($$update public.media_variants set checksum_sha256=repeat('f',64)where id=pg_temp.id(31)$$,'55000',null,'referenced variant update is blocked');
select throws_ok($$delete from public.media_variants where id=pg_temp.id(32)$$,'55000',null,'referenced private background variant is retained');
select throws_ok($$delete from public.media_assets where id=pg_temp.id(21)$$,'55000',null,'source asset retention survives logical copies');
select throws_ok($$update storage.objects set metadata='{"size":999}'where name=(select storage_path from public.media_variants where id=pg_temp.id(31))$$,'55000',null,'service/owner cannot upsert frozen bytes through Storage metadata');
select throws_ok($$delete from storage.objects where name=(select storage_path from public.media_variants where id=pg_temp.id(32))$$,'55000',null,'service/owner cannot delete frozen private background object');
insert into public.playlists(id,tenant_id,name)values(pg_temp.id(51),pg_temp.id(11),'Pinned media designs');
insert into public.screens(id,tenant_id,name,status)values(pg_temp.id(61),pg_temp.id(11),'Frame screen','active');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
insert into results values('add',pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','add_media_frame','clientId',pg_temp.id(71),'frameId',pg_temp.id(41),'expectedVersionId',(select value->>'versionId'from results where name='create'))),110));
select is((select media_frame_version_id from public.playlist_items where playlist_id=pg_temp.id(51)),(select(value->>'versionId')::uuid from results where name='create'),'draft placement pins the reviewed v1');
select is((select duration_seconds from public.playlist_items where playlist_id=pg_temp.id(51)),220,'placement keeps a duration above the old 180-second editor ceiling');
insert into results values('patch',pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','patch','itemId',(select id from public.playlist_items where playlist_id=pg_temp.id(51)),'patch','{"durationSeconds":220,"fitMode":"cover","trimStartSeconds":10,"trimEndSeconds":235,"muted":false,"volumePercent":37,"transition":"wipe"}'::jsonb)),111));
select is((select media_frame_overrides from public.playlist_items where playlist_id=pg_temp.id(51)),'{"durationSeconds":true,"fitMode":true}'::jsonb,'same-value patch records explicit override intent');
insert into results values('publish-v1',public.publish_playlist_to_targets_v3(pg_temp.id(51),(select revision from public.playlists where id=pg_temp.id(51)),array[pg_temp.id(61)],'Frame v1',pg_temp.id(112)));
select is((select value->>'outcome'from results where name='publish-v1'),'published','ordinary publication accepts the complete pinned media frame');
select is((select media_frame_provenance_json->>'versionId'from public.playlist_release_items where release_id=(select(value->>'releaseId')::uuid from results where name='publish-v1')),(select value->>'versionId'from results where name='create'),'release freezes exact v1 provenance');
select is((select jsonb_array_length(media_frame_provenance_json->'sourceAssets')from public.playlist_release_items where release_id=(select(value->>'releaseId')::uuid from results where name='publish-v1')),2,'release includes both verified source and background');
insert into results values('release-v1-before',(select to_jsonb(i)from public.playlist_release_items i where release_id=(select(value->>'releaseId')::uuid from results where name='publish-v1')));
insert into results values('save',pg_temp.command(41,1,'save',jsonb_build_object('settings',pg_temp.settings('Changed media design',200,'contain','left'),'expectedSources',pg_temp.sources()),113));
select is((select value->>'versionNumber'from results where name='save'),'2','save creates immutable content version two');
select is((select media_frame_version_id from public.playlist_items where playlist_id=pg_temp.id(51)),(select(value->>'versionId')::uuid from results where name='create'),'saving library design does not refresh existing placement');
select is(pg_temp.create_frame(41,101),(select value from results where name='create'),'old create receipt survives a later save and revision');
select is(pg_temp.command(41,1,'save',jsonb_build_object('settings',pg_temp.settings('Changed media design',200,'contain','left'),'expectedSources',pg_temp.sources()),113),(select value from results where name='save'),'save response-loss replay precedes current CAS check');
select throws_ok($$select pg_temp.command(41,1,'save',jsonb_build_object('settings',pg_temp.settings(),'expectedSources',pg_temp.sources()),114)$$,'PT409',null,'stale save is an application conflict without SQLSTATE retry loops');
select throws_ok($$select pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','refresh_media_frame','itemId',(select id from public.playlist_items where playlist_id=pg_temp.id(51)),'expectedPinnedVersionId',(select value->>'versionId'from results where name='save'),'versionId',(select value->>'versionId'from results where name='save'))),115)$$,'PT409',null,'refresh rejects a stale pinned placement identity');
select lives_ok($$select pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','refresh_media_frame','itemId',(select id from public.playlist_items where playlist_id=pg_temp.id(51)),'expectedPinnedVersionId',(select value->>'versionId'from results where name='create'),'versionId',(select value->>'versionId'from results where name='save'))),116)$$,'explicit refresh applies only the reviewed new version');
select is((select media_frame_version_id from public.playlist_items where playlist_id=pg_temp.id(51)),(select(value->>'versionId')::uuid from results where name='save'),'explicit refresh updates the pinned version');
select is((select duration_seconds from public.playlist_items where playlist_id=pg_temp.id(51)),220,'explicit equal-value duration override survives new default 200');
select is((select fit_mode from public.playlist_items where playlist_id=pg_temp.id(51)),'cover','explicit equal-value cover survives new contain default');
select is((select crop_focus_x from public.playlist_items where playlist_id=pg_temp.id(51)),0::numeric,'unoverridden focus refreshes to new left default');
select is((select display_title from public.playlist_items where playlist_id=pg_temp.id(51)),'Changed media design','unoverridden display title refreshes');
select is((select jsonb_build_array(trim_start_seconds,trim_end_seconds,muted,volume_percent,transition)from public.playlist_items where playlist_id=pg_temp.id(51)),'[10,235,false,37,"wipe"]'::jsonb,'refresh preserves existing trim, audio, volume and transition');
select is((select to_jsonb(i)from public.playlist_release_items i where release_id=(select(value->>'releaseId')::uuid from results where name='publish-v1')),(select value from results where name='release-v1-before'),'v1 release remains byte-identical after save and refresh');
insert into results values('playlist-copy',to_jsonb(public.duplicate_playlist_draft_v1(pg_temp.id(51),'Copied pinned design')));
select is((select media_frame_version_id from public.playlist_items where playlist_id=(select(value#>>'{}')::uuid from results where name='playlist-copy')),(select(value->>'versionId')::uuid from results where name='save'),'playlist duplicate preserves version binding');
select is((select media_frame_overrides from public.playlist_items where playlist_id=(select(value#>>'{}')::uuid from results where name='playlist-copy')),'{"durationSeconds":true,"fitMode":true}'::jsonb,'playlist duplicate preserves explicit intent mask');
insert into results values('template',public.create_tenant_playlist_template_v1(pg_temp.id(51),'Raw frame template','Pinned content',pg_temp.id(117)));
insert into results values('instantiate',public.instantiate_tenant_playlist_template_v1((select(value->>'templateId')::uuid from results where name='template'),'Instantiated frame design',pg_temp.id(118)));
select is((select media_frame_version_id from public.playlist_items where playlist_id=(select(value->>'playlistId')::uuid from results where name='instantiate')),(select(value->>'versionId')::uuid from results where name='save'),'template instantiation preserves frame version');
select is((select media_frame_overrides from public.playlist_items where playlist_id=(select(value->>'playlistId')::uuid from results where name='instantiate')),'{"durationSeconds":true,"fitMode":true}'::jsonb,'template instantiation preserves explicit placement overrides');
select lives_ok($$select public.restore_playlist_release_to_draft_v1((select(value->>'releaseId')::uuid from results where name='publish-v1'),(select revision from public.playlists where id=pg_temp.id(51)),pg_temp.id(119))$$,'ordinary immutable-release restore succeeds');
select is((select media_frame_version_id from public.playlist_items where playlist_id=pg_temp.id(51)),(select(value->>'versionId')::uuid from results where name='create'),'release restore returns exact historical frame v1');
select is((select media_frame_overrides from public.playlist_items where playlist_id=pg_temp.id(51)),'{"durationSeconds":true,"fitMode":true}'::jsonb,'release restore retains original override intent');
-- The established v2/mobile item command retains provenance too.
insert into results values('legacy-item-copy',public.mutate_playlist_draft_v2(pg_temp.id(51),(select revision from public.playlists where id=pg_temp.id(51)),'duplicate_item',jsonb_build_object('itemId',(select id from public.playlist_items where playlist_id=pg_temp.id(51))),pg_temp.id(130)));
select is((select media_frame_version_id from public.playlist_items where id=(select(value->>'itemId')::uuid from results where name='legacy-item-copy')),(select(value->>'versionId')::uuid from results where name='create'),'legacy v2/mobile item duplicate retains pinned frame');
select is((select media_frame_overrides from public.playlist_items where id=(select(value->>'itemId')::uuid from results where name='legacy-item-copy')),'{"durationSeconds":true,"fitMode":true}'::jsonb,'legacy item duplicate retains overrides');
select pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','remove','itemId',(select value->>'itemId'from results where name='legacy-item-copy'))),131);
insert into results values('batch-item-copy',pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','duplicate','clientId',pg_temp.id(72),'itemId',(select id from public.playlist_items where playlist_id=pg_temp.id(51)))),132));
select is((select media_frame_version_id from public.playlist_items where id=(select(value#>>array['itemIds',pg_temp.id(72)::text])::uuid from results where name='batch-item-copy')),(select(value->>'versionId')::uuid from results where name='create'),'batch duplicate retains exact frame version');
select pg_temp.batch(jsonb_build_array(jsonb_build_object('operation','remove','itemId',(select value#>>array['itemIds',pg_temp.id(72)::text]from results where name='batch-item-copy'))),133);
select lives_ok($$select public.mutate_playlist_batch_v1((select(value#>>'{}')::uuid from results where name='playlist-copy'),(select revision from public.playlists where id=(select(value#>>'{}')::uuid from results where name='playlist-copy')),jsonb_build_array(jsonb_build_object('operation','replace_media','itemId',(select id from public.playlist_items where playlist_id=(select(value#>>'{}')::uuid from results where name='playlist-copy')),'mediaAssetId',pg_temp.id(21))),pg_temp.id(134))$$,'explicit replacement with same asset still clears logical frame binding');
select ok((select media_frame_id is null and media_frame_version_id is null and media_frame_overrides='{}'::jsonb from public.playlist_items where playlist_id=(select(value#>>'{}')::uuid from results where name='playlist-copy')),'same-asset replacement cannot retain stale design provenance');
select throws_ok($$select pg_temp.command(41,2,'archive','{"settings":{}}',135)$$,'22023',null,'lifecycle command rejects unexpected payload keys');
select ok(exists(select 1 from public.get_media_frame_usage_v1(pg_temp.id(11),pg_temp.id(41))where usage_type='release'),'usage reports immutable frame publication');
select is((select count(*)from public.get_media_frame_usage_v1(pg_temp.id(11),pg_temp.id(42))),0::bigint,'usage distinguishes an unused logical copy sharing the same asset');
insert into results values('archive',pg_temp.command(41,2,'archive','{}',120));
select is((select archived from public.sync_content_library_v1 where id=pg_temp.id(21)),true,'archive affects only logical primary frame');
select is((select media_frame_id from public.sync_content_library_v1 where id=pg_temp.id(21)),pg_temp.id(41),'archived card retains recovery identity');
select ok((select placement is null from public.sync_content_library_v1 where id=pg_temp.id(21)),'archived frame cannot create a new placement');
select is((select deleted_at is null from public.media_assets where id=pg_temp.id(21)),true,'archiving frame does not archive shared asset');
select is((select archived from public.sync_content_library_v1 where id=pg_temp.id(42)),false,'archiving primary leaves its logical copy active');
select is(pg_temp.command(41,2,'archive','{}',120),(select value from results where name='archive'),'archive lost-response replay succeeds before state and CAS');
select lives_ok($$select pg_temp.command(41,3,'restore','{}',121)$$,'restore reactivates the same logical frame');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select throws_ok($$select pg_temp.command(41,2,'archive','{}',120)$$,'PT409',null,'another actor cannot replay the original actors receipt');
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select throws_ok($$select pg_temp.command(41,4,'archive','{}',122)$$,'42501',null,'viewer cannot mutate an existing frame');
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
select lives_ok($$select public.create_media_frame_v1(pg_temp.id(12),pg_temp.id(43),pg_temp.id(23),jsonb_build_array(jsonb_build_object('role','media','mediaAssetId',pg_temp.id(23),'variantId',pg_temp.id(33),'checksumSha256',repeat('b',64),'byteSize',4096)),pg_temp.settings('Tenant B image',10,'contain','center',false),pg_temp.id(136))$$,'tenant B can create its own independent verified frame');
select is((select count(*)from public.media_frames where tenant_id=pg_temp.id(11)),0::bigint,'tenant B cannot read tenant A frames');
select is((select count(*)from public.media_frame_versions where tenant_id=pg_temp.id(11)),0::bigint,'tenant B cannot read tenant A version settings');
select is((select count(*)from public.media_frame_version_assets where tenant_id=pg_temp.id(11)),0::bigint,'tenant B cannot read private source paths');
select throws_ok($$select public.get_media_frame_usage_v1(pg_temp.id(11),pg_temp.id(41))$$,'42501',null,'tenant B cannot inspect A usage');
select throws_ok($$select pg_temp.command(41,4,'archive','{}',123)$$,'42501',null,'tenant B cannot mutate tenant A frame');
reset role;
select throws_ok($$delete from storage.objects where name=(select storage_path from public.media_variants where id=pg_temp.id(31))$$,'42501',null,'foreign authenticated JWT cannot acquire source deletion authority through privileged trigger');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$delete from storage.objects where name=(select storage_path from public.media_variants where id=pg_temp.id(31))$$,'55000',null,'all version references remain retained after archive/restore');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select is((select count(*)from public.media_frames where tenant_id=pg_temp.id(12)),0::bigint,'tenant A cannot read existing tenant B frame');
with removed as(delete from storage.objects where name=(select storage_path from public.media_variants where id=pg_temp.id(31))returning id)
select is((select count(*)from removed),0::bigint,'browser Storage delete policy hides retained source objects');
with changed as(update storage.objects set metadata='{"size":999}'where name=(select storage_path from public.media_variants where id=pg_temp.id(31))returning id)
select is((select count(*)from changed),0::bigint,'browser Storage update policy blocks retained source objects');
select pg_temp.command(41,4,'archive','{}',137);
select pg_temp.command(42,1,'archive','{}',138);
select pg_temp.command(44,1,'archive','{}',139);
select pg_temp.command(49,2,'archive','{}',145);
select pg_temp.command(50,1,'archive','{}',146);
select is((select count(*)from public.list_publisher_media_frame_library_v1(pg_temp.id(11))),1::bigint,'archived frames disappear from picker while untouched ready legacy asset remains');
reset role;
select throws_ok($$delete from storage.objects where name=(select storage_path from public.media_variants where id=pg_temp.id(31))$$,'55000',null,'bytes remain retained when every logical frame is archived');
select throws_ok($$delete from public.media_assets where id=pg_temp.id(21)$$,'55000',null,'physical asset retention includes archived design versions');
-- Source-ready metadata cannot stand in for an actual Storage object.
insert into public.media_assets(id,tenant_id,created_by,title,kind,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.id(24),pg_temp.id(11),pg_temp.id(1),'Missing object fixture','image','missing.png','image/png','ready','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png',12,repeat('c',64),1,1);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.id(34),pg_temp.id(11),pg_temp.id(24),'original','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png','image/png',12,repeat('c',64),1,1);
set local role authenticated;
select throws_ok($$select public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(24))$$,'P0002',null,'missing object is unavailable even if DB metadata says ready');
reset role;
insert into public.media_assets(id,tenant_id,created_by,title,kind,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height,duration_seconds)
values(pg_temp.id(25),pg_temp.id(11),pg_temp.id(1),'Unknown video duration','video','unknown.mp4','video/mp4','ready','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(25)||'/unknown.mp4',4096,repeat('a',64),1920,1080,null);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds)
values(pg_temp.id(35),pg_temp.id(11),pg_temp.id(25),'player_1080p','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(25)||'/unknown.mp4','video/mp4',4096,repeat('a',64),1920,1080,240);
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id=pg_temp.id(35);
set local role authenticated;
select throws_ok($$select public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(25))$$,'P0002',null,'video without actual asset duration is not a ready source');
select throws_ok($$select public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(52),pg_temp.id(25),jsonb_build_array(jsonb_build_object('role','media','mediaAssetId',pg_temp.id(25),'variantId',pg_temp.id(35),'checksumSha256',repeat('a',64),'byteSize',4096)),pg_temp.settings('Unknown video',10,'cover','center',false),pg_temp.id(147))$$,'23514',null,'create cannot admit a video with unknown actual duration');
reset role;
update public.media_assets set duration_seconds=240 where id=pg_temp.id(25);
update public.media_variants set duration_seconds=null where id=pg_temp.id(35);
set local role authenticated;
select throws_ok($$select public.get_media_frame_source_v1(pg_temp.id(11),pg_temp.id(25))$$,'P0002',null,'video without measured playback-variant duration is not ready');
reset role;
-- Retain the old exact pending-upload authority after a role changes to
-- viewer, while retained frame paths remain protected even from that owner.
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id=pg_temp.id(34);
insert into public.media_upload_sessions(id,tenant_id,asset_id,created_by,storage_path,expected_mime_type,expected_size_bytes,created_at,expires_at)
select pg_temp.id(case when id=pg_temp.id(21)then 81 else 82 end),tenant_id,id,pg_temp.id(4),storage_path,mime_type,file_size_bytes,now()-interval '2 hours',now()+interval '1 hour'
from public.media_assets where id in(pg_temp.id(21),pg_temp.id(24));
update public.tenant_memberships set role='tenant_viewer'where tenant_id=pg_temp.id(11)and user_id=pg_temp.id(4);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select is(private.has_tenant_capability(pg_temp.id(11),'tenant.media.write'),false,'pending-session owner no longer has broad media-write capability');
select is(private.media_frame_storage_write_allowed_v1('tenant-media','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png'),true,'exact current own pending session preserves old pre-lock authority');
with changed as(update storage.objects set metadata='{"size":12}'where name='tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png'returning id)
select is((select count(*)from changed),1::bigint,'old pending-upload UPDATE still works on unreferenced own bytes');
with changed as(update storage.objects set metadata='{"size":999}'where name='tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(21)||'/original/source'returning id)
select is((select count(*)from changed),0::bigint,'pending owner still cannot upsert a retained frame source');
with removed as(delete from storage.objects where name='tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(21)||'/original/source'returning id)
select is((select count(*)from removed),0::bigint,'pending owner still cannot delete retained frame bytes');
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select is(private.media_frame_storage_write_allowed_v1('tenant-media','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png'),false,'another viewer cannot borrow the original uploader session');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
with removed as(delete from storage.objects where name='tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png'returning id)
select is((select count(*)from removed),1::bigint,'old pending-upload DELETE remains available for unreferenced own bytes');
reset role;
update public.media_upload_sessions set expires_at=now()-interval '1 minute'where id=pg_temp.id(82);
set local role authenticated;
select is(private.media_frame_storage_write_allowed_v1('tenant-media','tenants/'||pg_temp.id(11)||'/assets/'||pg_temp.id(24)||'/missing.png'),false,'an expired own pending session gives no mutex/write authority');
select is(private.media_frame_storage_write_allowed_v1('tenant-media','tenants/'||pg_temp.id(12)||'/assets/'||pg_temp.id(23)||'/original/source'),false,'an own pending session cannot authorize a foreign tenant path');
reset role;
select ok((select relrowsecurity from pg_class where oid='public.media_frames'::regclass),'frame table RLS is enabled');
select ok((select 'security_invoker=true'=any(reloptions)from pg_class where oid='public.sync_content_library_v1'::regclass),'library retains security-invoker semantics');
select is(has_function_privilege('anon','public.create_media_frame_v1(uuid,uuid,uuid,jsonb,jsonb,uuid,boolean)','EXECUTE'),false,'anonymous has no command grant');
select is(has_table_privilege('authenticated','public.media_frame_version_assets','UPDATE'),false,'no browser source-reference rewrite grant');
select *from finish();
rollback;
