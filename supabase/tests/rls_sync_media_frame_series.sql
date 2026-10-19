begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
set local storage.allow_delete_query='true';
select no_plan();
-- Synthetic SQL source-admission fixtures. No decoded-files/playback claim.
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select ('23200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email)select pg_temp.id(n),'series-'||n||'@test.invalid'from generate_series(1,6)n;
insert into public.profiles(id,display_name)select pg_temp.id(n),'Series actor '||n from generate_series(1,6)n;
insert into public.tenants(id,name,slug)values(pg_temp.id(11),'Series tenant A','s232-series-a'),(pg_temp.id(12),'Series tenant B','s232-series-b');
insert into public.tenant_settings(tenant_id)values(pg_temp.id(11)),(pg_temp.id(12));
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities)values
 (pg_temp.id(81),pg_temp.id(11),'Media only',array['tenant.media.write','tenant.playlist.write']),
 (pg_temp.id(82),pg_temp.id(11),'Read-only custom',array[]::text[]),
 (pg_temp.id(83),pg_temp.id(11),'Studio only',array['tenant.studio.read','tenant.studio.create']);
insert into public.tenant_memberships(tenant_id,user_id,role,custom_role_id)values
 (pg_temp.id(11),pg_temp.id(1),'tenant_owner',null),(pg_temp.id(12),pg_temp.id(2),'tenant_owner',null),
 (pg_temp.id(11),pg_temp.id(3),'tenant_viewer',null),(pg_temp.id(11),pg_temp.id(4),'tenant_viewer',pg_temp.id(81)),
 (pg_temp.id(11),pg_temp.id(5),'tenant_viewer',pg_temp.id(82)),(pg_temp.id(11),pg_temp.id(6),'tenant_viewer',pg_temp.id(83));
insert into public.media_assets(id,tenant_id,created_by,title,kind,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height,duration_seconds)
select pg_temp.id(n),pg_temp.id(case when n=23 then 12 else 11 end),pg_temp.id(case when n=23 then 2 else 1 end),'Series source '||n,
 case when n=22 then 'video'::public.media_asset_kind else 'image'::public.media_asset_kind end,'source-'||n,
 case when n=22 then 'video/mp4'else 'image/png'end,'ready','tenants/'||pg_temp.id(case when n=23 then 12 else 11 end)||'/assets/'||pg_temp.id(n)||'/original/source',4096,repeat(case when n=22 then 'b'else 'a'end,64),1920,1080,case when n=22 then 19.2 else null end from generate_series(21,23)n;
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds)
select pg_temp.id(right(id::text,12)::integer+10),tenant_id,id,case when kind='video'then 'player_1080p'::public.media_variant_type else 'original'::public.media_variant_type end,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height,duration_seconds from public.media_assets where id in(pg_temp.id(21),pg_temp.id(22),pg_temp.id(23));
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id in(pg_temp.id(31),pg_temp.id(32),pg_temp.id(33));
create function pg_temp.settings(p_name text default 'Dirty saved image',p_duration integer default 901)returns jsonb language sql immutable as $$
select jsonb_build_object('schemaVersion',1,'name',p_name,'orientation','portrait','durationSeconds',p_duration,'fitMode','contain','focus','left',
 'appearance','{"themeId":"onzetrots-tv","accentColor":"#1763ed","background":{"kind":"preset","preset":"clubmuur"}}'::jsonb,
 'sourceMetadata','{"title":"Metadata only","headline":"Changed before append","subtitle":"","body":"","footer":"","font":"Arial","scale":110,"alignment":"right","safeMargin":6,"showLogo":true,"showFooter":false,"motion":"geen"}'::jsonb);$$;
create function pg_temp.sources(p_asset integer default 21)returns jsonb language sql stable as $$
select jsonb_build_array(jsonb_build_object('role','media','mediaAssetId',asset_id,'variantId',id,'checksumSha256',checksum_sha256,'byteSize',file_size_bytes))from public.media_variants where asset_id=pg_temp.id(p_asset);$$;
create function pg_temp.payload(p_title text,p_new integer default null,p_settings jsonb default pg_temp.settings())returns jsonb language sql stable as $$
select jsonb_build_object('sourceAssetId',pg_temp.id(21),'settings',p_settings,'expectedSources',pg_temp.sources(),'seriesTitle',p_title)||case when p_new is null then '{}'::jsonb else jsonb_build_object('newFrameId',pg_temp.id(p_new))end;$$;
create function pg_temp.command(p_frame integer,p_revision integer,p_title text,p_nonce integer,p_new integer default null,p_binding jsonb default null,p_settings jsonb default pg_temp.settings())returns jsonb language sql as $$
select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(p_frame),p_revision,(p_binding->>'seriesId')::uuid,(p_binding->>'seriesRevision')::bigint,case when p_new is null then 'save_series'else 'append_series'end,pg_temp.payload(p_title,p_new,p_settings),pg_temp.id(p_nonce));$$;
create function pg_temp.binding(p_frame integer)returns jsonb language sql stable as $$select public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(p_frame))->'series'$$;
create temporary table results(name text primary key,value jsonb);grant all on results to authenticated;
-- Populated immutable publication/placement preservation fence, before series.
insert into public.playlists(id,tenant_id,name)values(pg_temp.id(51),pg_temp.id(11),'Existing pinned release');
insert into public.screens(id,tenant_id,name,status)values(pg_temp.id(61),pg_temp.id(11),'Series screen','active');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
insert into results values('old-frame',public.create_media_frame_v1(pg_temp.id(11),pg_temp.id(50),pg_temp.id(21),pg_temp.sources(),pg_temp.settings('Existing pinned image'),pg_temp.id(100),false));
select public.mutate_playlist_batch_v1(pg_temp.id(51),(select revision from public.playlists where id=pg_temp.id(51)),jsonb_build_array(jsonb_build_object('operation','add_media_frame','clientId',pg_temp.id(71),'frameId',pg_temp.id(50),'expectedVersionId',(select value->>'versionId'from results where name='old-frame'))),pg_temp.id(101));
insert into results values('publication',public.publish_playlist_to_targets_v3(pg_temp.id(51),(select revision from public.playlists where id=pg_temp.id(51)),array[pg_temp.id(61)],'Series baseline',pg_temp.id(102)));
reset role;
insert into results values('immutable-before',jsonb_build_object(
 'assets',(select jsonb_agg(to_jsonb(a)order by a.id)from public.media_assets a),'variants',(select jsonb_agg(to_jsonb(v)order by v.id)from public.media_variants v),
 'objects',(select jsonb_agg(to_jsonb(o)order by o.id)from storage.objects o),
 'pinned',(select jsonb_agg(to_jsonb(i)order by i.id)from public.playlist_items i),
 'releases',(select jsonb_agg(to_jsonb(r)order by r.id)from public.playlist_releases r),
 'releaseItems',(select jsonb_agg(to_jsonb(i)order by i.id)from public.playlist_release_items i),
 'oldVersions',(select jsonb_agg(to_jsonb(v)order by v.id)from public.media_frame_versions v where frame_id=pg_temp.id(50)),
 'oldRefs',(select jsonb_agg(to_jsonb(a)order by a.version_id,a.role)from public.media_frame_version_assets a where version_id=(select current_version_id from public.media_frames where id=pg_temp.id(50)))));
select ok((select relrowsecurity from pg_class where oid='public.media_frame_series'::regclass),'header RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.media_frame_series_items'::regclass),'membership RLS enabled');
select ok(not has_table_privilege('authenticated','public.media_frame_series','INSERT,UPDATE,DELETE'),'authenticated cannot directly mutate header');
select ok(not has_table_privilege('service_role','public.media_frame_series_items','INSERT,UPDATE,DELETE'),'service role has no direct membership mutation grant');
select ok(not has_function_privilege('anon','public.mutate_media_frame_series_v1(uuid,uuid,integer,uuid,bigint,text,jsonb,uuid)','EXECUTE'),'anon has no mutation execution grant');
select ok(not has_function_privilege('service_role','public.get_media_frame_series_v1(uuid,uuid)','EXECUTE'),'read RPC has no implicit service-role route');
select is(private.media_series_utf16_length_v1(''),0,'empty label has exactlyzeroUTF16 units');
select is(private.media_series_utf16_length_v1('A😀'),3,'UTF16 length counts supplementary Unicode as two units');
select is(private.media_series_utf16_prefix_v1('😀😀x',3),'😀','prefix never splits a supplementary code point');
select is(private.media_series_trim_v1(E'\t'||chr(160)||chr(65279)||'Name'||chr(12288)||E'\r\n'),'Name','append trim matches JS tabs NBSP BOM and Unicode spaces');
select is(private.media_series_trim_v1(chr(133)||'x'||chr(133)),chr(133)||'x'||chr(133),'append trim preserves non-ECMAScript U0085');
set local role anon;
select throws_ok($$select *from public.media_frame_series$$,'42501',null,'anonymous cannot read series tables');
select throws_ok($$select pg_temp.command(41,0,'A',110)$$,'42501',null,'anonymous cannot command');
select throws_ok($$select public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(50))$$,'42501',null,'anonymous cannot read binding RPC');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select throws_ok($$select pg_temp.command(41,0,'A',110)$$,'42501',null,'viewer cannot command');
select ok(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(50))->'series'='null'::jsonb,'viewer sees actual unbound metadata');
select set_config('request.jwt.claim.sub',pg_temp.id(5)::text,true);
select throws_ok($$select pg_temp.command(41,0,'A',110)$$,'42501',null,'custom read-only role cannot author media series');
select set_config('request.jwt.claim.sub',pg_temp.id(6)::text,true);
select throws_ok($$select pg_temp.command(41,0,'A',110)$$,'42501',null,'Studio-only role cannot author media series');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
insert into results values('unbound',pg_temp.command(41,0,E'\t '||chr(160),110));
select is((select value->'series'from results where name='unbound'),'null'::jsonb,'custom media editor may save whitespace title without making a group');
select is((select count(*)from public.media_frame_series),0::bigint,'blank unbound save creates no header');
select is((select settings_json->>'durationSeconds'from public.media_frame_versions where frame_id=pg_temp.id(41)),'901','series preserves valid901-second image settings');
select is(pg_temp.command(41,0,E'\t '||chr(160),110),(select value from results where name='unbound'),'original create parent receipt replays before changed revision');
select throws_ok($$select pg_temp.command(41,0,'changed',110)$$,'23505',null,'same parent nonce cannot change label');
select throws_ok($$select pg_temp.command(41,0,'A',111)$$,'PT409',null,'fresh duplicate first primary cannot overwrite existing frame');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(12),pg_temp.id(43),0,null,null,'save_series',pg_temp.payload('Foreign'),pg_temp.id(112))$$,'42501',null,'tenant A cannot command tenant B');
select throws_ok($$select public.get_media_frame_series_v1(pg_temp.id(12),pg_temp.id(43))$$,'42501',null,'tenant A cannot read tenant B binding');
select throws_ok($$select public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(9999))$$,'P0002',null,'authorized missing frame is explicit');
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41),1,null,1,'save_series',pg_temp.payload('A'),pg_temp.id(113))$$,'22023',null,'binding IDs and revisions must both be null or present');
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41),1,null,null,'detach',pg_temp.payload('A'),pg_temp.id(113))$$,'22023',null,'unknown operation cannot detach');
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41),1,null,null,'save_series',pg_temp.payload('A')||'{"extra":1}',pg_temp.id(113))$$,'22023',null,'unknown payload fields rejected');
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41),1,null,null,'save_series',jsonb_set(pg_temp.payload('A'),'{sourceAssetId}','"not-uuid"'),pg_temp.id(113))$$,'22023',null,'malformed source UUID rejected');
select throws_ok($$select pg_temp.command(41,1,repeat('😀',61),113)$$,'22023',null,'series title limit uses120UTF16 units');
select throws_ok($$select pg_temp.command(41,1,'A',113,null,null,pg_temp.settings()||'{"injected":true}')$$,'23514',null,'invalid settings cannot be saved through series');
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41),1,null,null,'save_series',jsonb_set(pg_temp.payload('A'),'{expectedSources,0,checksumSha256}',to_jsonb(repeat('f',64))),pg_temp.id(113))$$,'23514',null,'frozen source facts still validated by original S231 writer');
select throws_ok($$select pg_temp.command(41,1,'A',113,41)$$,'22023',null,'append must make a distinct logical frame');
select throws_ok($$select pg_temp.command(41,1,'A',113,50)$$,'PT409',null,'existing copy ID cannot be adopted');
insert into results values('append',pg_temp.command(41,1,E'\t'||chr(160)||'Shared label'||chr(160),120,42,null,pg_temp.settings('  Current dirty name  ',902)));
select is((select value->>'frameRevision'from results where name='append'),'2','dirty current frame saved before append');
select is((select value#>>'{series,seriesRevision}'from results where name='append'),'1','new server-minted header starts revision1');
select is((select value#>>'{series,memberCount}'from results where name='append'),'2','atomic initial append makes exactly two members');
select is((select value#>>'{series,seriesTitle}'from results where name='append'),'Shared label','append uses exact JS-compatible trimmed label');
select is((select value#>>'{newFrame,frameRevision}'from results where name='append'),'1','copy starts operationalrevision1');
select is((select value#>>'{newFrame,versionNumber}'from results where name='append'),'1','copy starts immutableversion1');
select is((select is_primary from public.media_frames where id=pg_temp.id(42)),false,'appended frame is a logical nonprimary copy');
select is((select settings_json->>'name'from public.media_frame_versions where frame_id=pg_temp.id(42)),'Shared label · slide 2','copy generated name uses series ordinal');
select is((select v.settings_json-'name'from public.media_frame_versions v where frame_id=pg_temp.id(42)),(select v.settings_json-'name'from public.media_frame_versions v where frame_id=pg_temp.id(41)and version_number=2),'copy preserves every newly saved setting except generated name');
select is((select jsonb_agg(to_jsonb(a)-'version_id'order by role)from public.media_frame_version_assets a where version_id=(select current_version_id from public.media_frames where id=pg_temp.id(42))),(select jsonb_agg(to_jsonb(a)-'version_id'order by role)from public.media_frame_version_assets a where version_id=(select current_version_id from public.media_frames where id=pg_temp.id(41))),'copy pins exact same verified source refs');
select is(pg_temp.command(41,1,E'\t'||chr(160)||'Shared label'||chr(160),120,42,null,pg_temp.settings('  Current dirty name  ',902)),(select value from results where name='append'),'lost append ACK replays original complete result before binding/frameCAS');
select throws_ok($$select pg_temp.command(41,1,'Shared label',120,43)$$,'23505',null,'same nonce with changed copy identity is rejected');
select throws_ok($$select pg_temp.command(41,1,'A',121,43,pg_temp.binding(41))$$,'PT409',null,'stale frame CAS rejected');
select throws_ok($$select pg_temp.command(41,2,'A',121,43)$$,'PT409',null,'null binding cannot hide a newly bound frame');
select throws_ok($$select pg_temp.command(41,2,'A',121,43,jsonb_set(pg_temp.binding(41),'{seriesRevision}','99'))$$,'PT409',null,'stale group CAS rejected');
insert into results values('save-copy',pg_temp.command(42,1,'  Other member raw  ',122,null,pg_temp.binding(42)));
select is((select value#>>'{series,seriesRevision}'from results where name='save-copy'),'2','one bound command advances header once');
select is(pg_temp.binding(41)->>'seriesTitle','Shared label','saving copy never changes current primary label');
select is(pg_temp.binding(42)->>'seriesTitle','  Other member raw  ','ordinary save preserves member title byte-for-byte');
insert into results values('clear-copy',pg_temp.command(42,2,'',123,null,pg_temp.binding(42)));
select is(pg_temp.binding(42)->>'seriesTitle','','clearing label preserves empty string');
select is(pg_temp.binding(42)->>'seriesId',pg_temp.binding(41)->>'seriesId','clearing label retains original membership');
insert into results values('fallback',pg_temp.command(42,3,E'\t'||chr(160),124,43,pg_temp.binding(42),pg_temp.settings('  Fallback name  ')));
select is(pg_temp.binding(42)->>'seriesTitle','Fallback name','blank append falls back to normalized saved current name');
select is(pg_temp.binding(43)->>'seriesTitle','Fallback name','fallback label written on new member');
select is(pg_temp.binding(41)->>'seriesTitle','Shared label','append changes only current/new labels');
insert into results values('read',public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(42)));
select is((select value->>'versionId'from results where name='read'),(select current_version_id::text from public.media_frames where id=pg_temp.id(42)),'atomic binding read carries same current immutable version');
select throws_ok($$update public.media_frame_series set revision=88$$,'42501',null,'no direct groupCAS bypass');
select throws_ok($$update public.media_frame_series_items set series_title='bypass'$$,'42501',null,'no direct label write');
select throws_ok($$delete from public.media_frame_series_items$$,'42501',null,'no direct detach/delete');
-- >20 real members: each request appends one copy and advances header once.
do $$declare i integer;r integer;b jsonb;begin for i in 4..21 loop
 select revision into r from public.media_frames where id=pg_temp.id(41);b:=pg_temp.binding(41);
 perform pg_temp.command(41,r,'Many',200+i,1000+i,b);
end loop;end $$;
select is((pg_temp.binding(41)->>'memberCount')::bigint,21::bigint,'twenty-first member is accepted without Studio20restriction');
select is((select count(*)from public.media_frame_series_items),21::bigint,'append creates exactly one new membership per request');
select is((select array_agg(position order by position)from public.media_frame_series_items),array(select generate_series(0,20)),'counter yields distinct contiguous indexed positions');
select is((pg_temp.binding(41)->>'seriesRevision')::bigint,22::bigint,'each subsequent bound command advances header exactly once');
-- Ensure invalid clone rolls back an already-saved current version + new header.
reset role;
create function pg_temp.reject_clone()returns trigger language plpgsql as $$begin if new.id=pg_temp.id(999)then raise exception 'synthetic clone failure'using errcode='23514';end if;return new;end $$;
create trigger s232_test_reject_clone before insert on public.media_frames for each row execute function pg_temp.reject_clone();
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
insert into results values('before-failure',public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41)));
select throws_ok($$select pg_temp.command(41,(select revision from public.media_frames where id=pg_temp.id(41)),'Failed dirty save',300,999,pg_temp.binding(41))$$,'23514',null,'copy failure rejects entire save-current+append transaction');
select is(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41)),(select value from results where name='before-failure'),'failed append retains current version/revision/header/count/label exactly');
select is((select count(*)from public.publisher_command_receipts where idempotency_key=pg_temp.id(300)),0::bigint,'failed append has no parent success receipt');
select throws_ok($$select pg_temp.command(50,1,'New failed group',301,999)$$,'23514',null,'new group and already-saved historical current frame roll back with failed copy');
select is((select count(*)from public.media_frame_series),1::bigint,'failed initial group leaves no orphan header');
select is((select count(*)from public.media_frame_versions where frame_id=pg_temp.id(50)),1::bigint,'failed initial group rolls back saved version of unbound frame');
reset role;
drop trigger s232_test_reject_clone on public.media_frames;
-- Narrow overflow boundary is synthetic; no need to insert billions of rows.
insert into results values('counter-before',jsonb_build_object('count',(select member_count from public.media_frame_series),'revision',(select revision from public.media_frame_series)));
update public.media_frame_series set member_count=2147483648;
set local role authenticated;
select throws_ok($$select pg_temp.command(41,(select revision from public.media_frames where id=pg_temp.id(41)),'Overflow',302,999,pg_temp.binding(41))$$,'23514',null,'integer-position overflow rejected before current save');
select is((select current_version_id::text from public.media_frames where id=pg_temp.id(41)),(select value->>'versionId'from results where name='before-failure'),'position overflow does not create a current version');
reset role;
update public.media_frame_series set member_count=(select(value->>'count')::bigint from results where name='counter-before');
select throws_ok($$insert into public.media_frame_series_items(tenant_id,frame_id,series_id,position)select pg_temp.id(12),pg_temp.id(50),id,0 from public.media_frame_series$$,'23503',null,'composite tenant FKs reject foreign frame and series');
select throws_ok($$insert into public.media_frame_series_items(tenant_id,frame_id,series_id,position)select pg_temp.id(11),pg_temp.id(41),id,99 from public.media_frame_series$$,'23505',null,'one group per frame enforced by composite primary key');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
select is((select count(*)from public.media_frame_series),0::bigint,'tenant B cannot SELECT tenant A headers');
select is((select count(*)from public.media_frame_series_items),0::bigint,'tenant B cannot SELECT tenant A memberships');
select throws_ok($$select public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41))$$,'42501',null,'foreign actor cannot read binding RPC');
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select is((select count(*)from public.media_frame_series_items),21::bigint,'viewer can read genuine own membership rows');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
insert into results values('pre-archive',public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41)));
select public.mutate_media_frame_v1(pg_temp.id(11),pg_temp.id(41),(select revision from public.media_frames where id=pg_temp.id(41)),'archive','{}',pg_temp.id(310));
select is(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41))->'series',(select value->'series'from results where name='pre-archive'),'archived frame preserves membership and header');
select is(pg_temp.command(41,1,E'\t'||chr(160)||'Shared label'||chr(160),120,42,null,pg_temp.settings('  Current dirty name  ',902)),(select value from results where name='append'),'original parent receipt still replays after archive and many edits');
select throws_ok($$select pg_temp.command(41,(select revision from public.media_frames where id=pg_temp.id(41)),'Fresh archive edit',311,null,pg_temp.binding(41))$$,'55000',null,'fresh archived edit remains forbidden');
select public.mutate_media_frame_v1(pg_temp.id(11),pg_temp.id(41),(select revision from public.media_frames where id=pg_temp.id(41)),'restore','{}',pg_temp.id(312));
select is(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41))->'series',(select value->'series'from results where name='pre-archive'),'restore preserves binding labels positions and counter');

-- Supplementary Unicode and generated names share the actual JS UTF16 budget.
insert into results values('unicode',pg_temp.command(43,1,repeat('😀',60),320,44,pg_temp.binding(43)));
select is(pg_temp.binding(43)->>'seriesTitle',repeat('😀',60),'exact120UTF16 title is accepted without truncating submitted label');
reset role;
select ok((select private.media_series_utf16_length_v1(settings_json->>'name')<=120 from public.media_frame_versions where frame_id=pg_temp.id(44)),'generated copy name fits120UTF16 units and keeps whole characters');
set local role authenticated;
select throws_ok($$select pg_temp.command(43,2,'A',321,null,pg_temp.binding(43),pg_temp.settings(repeat('😀',61)))$$,'23514',null,'series rejects settings name beyond120UTF16 units');
-- Existing video limit is inherited from S231, including ceil(assetduration).
select throws_ok($$select public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(49),0,null,null,'append_series',jsonb_build_object('sourceAssetId',pg_temp.id(22),'settings',pg_temp.settings('Video too long',21),'expectedSources',pg_temp.sources(22),'seriesTitle','','newFrameId',pg_temp.id(48)),pg_temp.id(322))$$,'23514',null,'unsaved video append rejects overshoot before either frame exists');
select is((select count(*)from public.media_frames where id in(pg_temp.id(49),pg_temp.id(48))),0::bigint,'bad video first append leaves neither primary nor copy');
insert into results values('first-video',public.mutate_media_frame_series_v1(pg_temp.id(11),pg_temp.id(49),0,null,null,'append_series',jsonb_build_object('sourceAssetId',pg_temp.id(22),'settings',pg_temp.settings('Video at limit',20),'expectedSources',pg_temp.sources(22),'seriesTitle','','newFrameId',pg_temp.id(48)),pg_temp.id(323)));
select is((select value->>'frameRevision'from results where name='first-video'),'1','first unsaved append atomically creates currentprimaryv1');
select is((select value#>>'{newFrame,versionNumber}'from results where name='first-video'),'1','first unsaved append creates exactlyone copyversion');
select is((select settings_json->>'durationSeconds'from public.media_frame_versions where frame_id=pg_temp.id(48)),'20','video copy preserves source boundary duration');
select is((select value#>>'{series,seriesTitle}'from results where name='first-video'),'Video at limit','first append blank label falls back to actual saved name');
-- Atomic read does not provision, append, save or create receipts.
insert into results values('get-before',jsonb_build_object('frames',(select count(*)from public.media_frames),'versions',(select count(*)from public.media_frame_versions),'headers',(select count(*)from public.media_frame_series),'members',(select count(*)from public.media_frame_series_items),'receipts',(select count(*)from public.publisher_command_receipts)));
select public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(43));
select is(jsonb_build_object('frames',(select count(*)from public.media_frames),'versions',(select count(*)from public.media_frame_versions),'headers',(select count(*)from public.media_frame_series),'members',(select count(*)from public.media_frame_series_items),'receipts',(select count(*)from public.publisher_command_receipts)),(select value from results where name='get-before'),'GET binding is read-only across all command tables');
reset role;
-- Receipt-completion failure also rolls back both nested S231 commands.
create function pg_temp.reject_parent_receipt()returns trigger language plpgsql as $$begin if new.idempotency_key=pg_temp.id(324)then raise exception 'synthetic parent completion failure'using errcode='23514';end if;return new;end $$;
create trigger s232_test_reject_receipt before insert on public.publisher_command_receipts for each row execute function pg_temp.reject_parent_receipt();
set local role authenticated;
insert into results values('parent-failure-before',public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(43)));
select throws_ok($$select pg_temp.command(43,2,'Receipt failed',324,47,pg_temp.binding(43))$$,'23514',null,'parent receipt failure rolls back both nested writes');
select is(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(43)),(select value from results where name='parent-failure-before'),'parent completion failure preserves full original current/binding DTO');
select is((select count(*)from public.media_frames where id=pg_temp.id(47)),0::bigint,'parent completion failure leaves no appended frame');
reset role;
drop trigger s232_test_reject_receipt on public.publisher_command_receipts;
-- Admission remains fresh even for an existing committed receipt.
delete from public.tenant_memberships where tenant_id=pg_temp.id(11)and user_id=pg_temp.id(4);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select throws_ok($$select pg_temp.command(41,0,E'\t '||chr(160),110)$$,'42501',null,'revoked original actor cannot retrieve previous result');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='paused'where id=pg_temp.id(11);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$select pg_temp.command(41,1,E'\t'||chr(160)||'Shared label'||chr(160),120,42,null,pg_temp.settings('  Current dirty name  ',902))$$,'42501',null,'paused tenant cannot replay a human mutation');
select ok(public.get_media_frame_series_v1(pg_temp.id(11),pg_temp.id(41))->'series'is not null,'paused tenant remains readable');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='active'where id=pg_temp.id(11);
select is(jsonb_build_object(
 'assets',(select jsonb_agg(to_jsonb(a)order by a.id)from public.media_assets a),'variants',(select jsonb_agg(to_jsonb(v)order by v.id)from public.media_variants v),
 'objects',(select jsonb_agg(to_jsonb(o)order by o.id)from storage.objects o),
 'pinned',(select jsonb_agg(to_jsonb(i)order by i.id)from public.playlist_items i),
 'releases',(select jsonb_agg(to_jsonb(r)order by r.id)from public.playlist_releases r),
 'releaseItems',(select jsonb_agg(to_jsonb(i)order by i.id)from public.playlist_release_items i),
 'oldVersions',(select jsonb_agg(to_jsonb(v)order by v.id)from public.media_frame_versions v where frame_id=pg_temp.id(50)),
 'oldRefs',(select jsonb_agg(to_jsonb(a)order by a.version_id,a.role)from public.media_frame_version_assets a where version_id=(select current_version_id from public.media_frames where id=pg_temp.id(50)))),
 (select value from results where name='immutable-before'),'all preexisting source bytes metadata, pinned placement, populated release and historical version/refs unchanged');
select *from finish();
rollback;
