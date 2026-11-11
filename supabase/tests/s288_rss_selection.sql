-- S288: three sources are distinct from three authorable/playlist-ready designs.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000000288','RSS fixture A','rss-fixture-a'),('10000000-0000-4000-8000-000000000289','RSS fixture B','rss-fixture-b');
insert into public.tenant_settings(tenant_id)select id from public.tenants where slug in('rss-fixture-a','rss-fixture-b');
insert into auth.users(id,email)values('00000000-0000-4000-8000-000000000288','rss-fixture-owner@test.invalid'),('00000000-0000-4000-8000-000000000289','rss-fixture-other@test.invalid'),('00000000-0000-4000-8000-000000000290','rss-fixture-viewer@test.invalid');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000000288','Owner A'),('00000000-0000-4000-8000-000000000289','Owner B'),('00000000-0000-4000-8000-000000000290','Viewer');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000288','00000000-0000-4000-8000-000000000288','tenant_owner'),('10000000-0000-4000-8000-000000000289','00000000-0000-4000-8000-000000000289','tenant_owner'),('10000000-0000-4000-8000-000000000288','00000000-0000-4000-8000-000000000290','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,config_json)values
 ('20000000-0000-4000-8000-000000000288','10000000-0000-4000-8000-000000000288','Nieuwsbron een','rss','{"url":"https://news.example.org/one"}'),
 ('20000000-0000-4000-8000-000000000289','10000000-0000-4000-8000-000000000288','Nieuwsbron twee','rss','{"url":"https://news.example.org/two"}'),
 ('20000000-0000-4000-8000-000000000290','10000000-0000-4000-8000-000000000288','Nieuwsbron drie','rss','{"url":"https://news.example.org/three"}'),
 ('20000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000289','Andere nieuwsbron','rss','{"url":"https://news.example.org/foreign"}');
insert into public.dynamic_news_articles(tenant_id,data_source_id,external_id,title,intro,source_name,link,published_at,content_hash)
 select s.tenant_id,s.id,'article-'||n,'Artikel '||n||' uit '||s.name,'Gecontroleerde fixturetekst',s.name,'https://news.example.org/'||s.id||'/'||n,now()-make_interval(mins=>n),encode(extensions.digest(s.id::text||n,'sha256'),'hex')
 from public.dynamic_data_sources s cross join generate_series(1,30)n where s.id in('20000000-0000-4000-8000-000000000288','20000000-0000-4000-8000-000000000289','20000000-0000-4000-8000-000000000290','20000000-0000-4000-8000-000000000291');
create function pg_temp.request(source_id uuid default '20000000-0000-4000-8000-000000000288',maximum_articles integer default 5)returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,'dataSourceId',source_id,'configuration',
 jsonb_build_object('maxItems',200,'syncConfiguration',$cfg${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","slideType":"news","secondsPerPage":10,"seed":{"schemaVersion":1,"rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","family":"rss","orientation":"landscape","theme":"onzetrots-tv","name":"Nieuws & RSS","club":{"name":"RSS fixture club","tagline":""},"title":"DIT LEEFT OP DE CLUB","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":6,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"clubmuur","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true},"visual":{"schemaVersion":1,"mode":"light","scrollSpeed":"normal","panelOpacity":94},"authoring":{"schemaVersion":1,"headerSubtitles":{},"headerTexts":{},"welcomeScalePercent":150}}}$cfg$::jsonb)||case when maximum_articles is null then '{}'::jsonb else jsonb_build_object('newsSelection',jsonb_build_object('maximumArticles',maximum_articles))end)
 from public.dynamic_templates where slide_type='news'and orientation='landscape'and status='published'order by slug limit 1;
$$;
create function pg_temp.preview(request jsonb)returns jsonb language sql as $$
 select public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000000288','Nieuws',
 (request->>'templateVersionId')::uuid,(request->>'dataSourceId')::uuid,request->'configuration');
$$;
create temporary table replies(source_id uuid,request jsonb,nonce uuid,result jsonb);
grant select,insert on replies to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000288',true);
select is((select count(*)from public.sync_content_library_v1 where tenant_id='10000000-0000-4000-8000-000000000288'),0::bigint,'connected feeds do not impersonate saved designs');
select is(jsonb_array_length(pg_temp.preview(pg_temp.request())#>'{data,news,articles}'),5,'a full thirty-article feed previews exactly the five explicitly selected newest articles');
select is(pg_temp.preview(pg_temp.request())#>>'{data,news,articles,0,title}','Artikel 1 uit Nieuwsbron een','selection retains the canonical newest-first ordering');
select is(pg_temp.preview(pg_temp.request())#>>'{data,news,articles,4,title}','Artikel 5 uit Nieuwsbron een','selection ends at the fifth authorized article');
select is(jsonb_array_length(pg_temp.preview(pg_temp.request('20000000-0000-4000-8000-000000000288',1))#>'{data,news,articles}'),1,'one article is an accepted explicit lower bound');
select is(jsonb_array_length(pg_temp.preview(pg_temp.request('20000000-0000-4000-8000-000000000288',20))#>'{data,news,articles}'),20,'twenty articles is the accepted explicit upper bound');
select is(jsonb_array_length(pg_temp.preview(pg_temp.request('20000000-0000-4000-8000-000000000288',null))#>'{data,news,articles}'),30,'historical requests without the new selection still keep their full source');
insert into replies select id,request,nonce,public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000288','create',null,null,0,request,nonce)
 from(select id,pg_temp.request(id)as request,gen_random_uuid()as nonce from public.dynamic_data_sources where tenant_id='10000000-0000-4000-8000-000000000288')s;
select is((select count(*)from replies),3::bigint,'all three sources can each create their own design through the real guarded writer');
select is((select count(*)from public.sync_content_library_v1 where tenant_id='10000000-0000-4000-8000-000000000288'and kind='dynamic'),3::bigint,'all three designs are visible in Content before their fallback is ready');
select is((select count(*)from public.sync_content_library_v1 where tenant_id='10000000-0000-4000-8000-000000000288'and kind='dynamic'and placement is null),3::bigint,'incomplete designs never masquerade as playlist-ready content');
select is(jsonb_array_length(s.snapshot_data_json#>'{news,articles}'),5,'a real immutable snapshot contains the explicitly selected complete five-article source')
 from replies r join public.dynamic_slide_snapshots s on s.id=(r.result->>'snapshotId')::uuid;
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000288','create',null,null,0,r.request,r.nonce),r.result,'repeating the original news command returns its original receipt')from replies r;
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000000288'),3::bigint,'receipt recovery does not duplicate jobs');
select throws_ok(format($sql$select pg_temp.preview(jsonb_set(pg_temp.request(),'{configuration,newsSelection}',%L::jsonb))$sql$,bad::text),'23514',null,'invalid article selection is rejected')from (values('null'::jsonb),('[]'::jsonb),('{}'::jsonb),('{"maximumArticles":0}'::jsonb),('{"maximumArticles":21}'::jsonb),('{"maximumArticles":"5"}'::jsonb),('{"maximumArticles":1.5}'::jsonb),('{"maximumArticles":5,"extra":true}'::jsonb))v(bad);
select throws_ok($$select pg_temp.preview(pg_temp.request('20000000-0000-4000-8000-000000000291'))$$,'P0002',null,'a foreign source cannot be previewed using the new article selection');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000288','create',null,null,0,pg_temp.request('20000000-0000-4000-8000-000000000291'),gen_random_uuid())$$,'23514',null,'a foreign source cannot be authored through the news writer');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000289',true);
select is((select count(*)from public.sync_content_library_v1 where tenant_id='10000000-0000-4000-8000-000000000288'),0::bigint,'tenant B cannot discover tenant A news slides');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000290',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000288','create',null,null,0,pg_temp.request(),gen_random_uuid())$$,'42501',null,'viewer rights never permit RSS design creation');
reset role;
select is((select count(*)from public.dynamic_news_articles where tenant_id='10000000-0000-4000-8000-000000000288'),90::bigint,'the explicit display selection never removes any source article');
select is(has_function_privilege('authenticated','private.sync_rss_article_limit_v1(text,jsonb)','execute'),false,'the selection helper is not exposed to browser roles');
select is(has_function_privilege('service_role','private.build_dynamic_snapshot_before_rss_selection_v1(public.dynamic_slides)','execute'),false,'the inherited source reader is not exposed to worker roles');
grant update on replies to authenticated;
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
values('50000000-0000-4000-8000-000000288309','10000000-0000-4000-8000-000000000288','image','RSS test poster','poster.png','image/png','ready','tenant-media','tenants/10000000-0000-4000-8000-000000000288/assets/50000000-0000-4000-8000-000000288309/original/poster.png',100,repeat('e',64),1920,1080,now());
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id='50000000-0000-4000-8000-000000288309';
update public.dynamic_slide_snapshots set status='ready',output_media_asset_id='50000000-0000-4000-8000-000000288309',completed_at=now()
where id in(select(result->>'snapshotId')::uuid from replies);
update public.dynamic_slides slide set current_snapshot_id=(replies.result->>'snapshotId')::uuid,status='ready'
from replies where slide.id=(replies.result->>'slideId')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000288',true);
select public.create_or_resume_dynamic_slide_version_v1((result->>'slideId')::uuid,null) from replies;
update replies set request=jsonb_set(request,'{configuration,syncConfiguration,seed,authoring,rssLayout}',to_jsonb(case source_id
 when '20000000-0000-4000-8000-000000000288' then 'beeldheld'
 when '20000000-0000-4000-8000-000000000289' then 'nachteditie' else 'clubkrant' end));
select lives_ok(format($sql$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000288','save',%L,%L,%s,%L::jsonb,gen_random_uuid())$sql$,
 slide.id,version.id,version.edit_revision,replies.request::text),'the real guarded save accepts RSS layout '||(replies.request#>>'{configuration,syncConfiguration,seed,authoring,rssLayout}'))
 from replies join public.dynamic_slides slide on slide.id=(replies.result->>'slideId')::uuid
 join public.dynamic_slide_versions version on version.id=slide.active_draft_version_id;
select is(slide.configuration_json#>>'{syncConfiguration,seed,authoring,rssLayout}',replies.request#>>'{configuration,syncConfiguration,seed,authoring,rssLayout}','stored layout survives reading the same logical slide')
 from replies join public.dynamic_slides slide on slide.id=(replies.result->>'slideId')::uuid;
select is(slide.data_source_id,replies.source_id,'a layout-only edit retains its source identity')
 from replies join public.dynamic_slides slide on slide.id=(replies.result->>'slideId')::uuid;
select is(slide.configuration_json#>>'{newsSelection,maximumArticles}','5','a layout-only edit retains its article selection')
 from replies join public.dynamic_slides slide on slide.id=(replies.result->>'slideId')::uuid;
select throws_ok(format($sql$select pg_temp.preview(%L::jsonb)$sql$,jsonb_set(pg_temp.request(),'{configuration,syncConfiguration,seed,authoring,rssLayout}','"design-3"')::text),'23514',null,'invalid layout values are rejected at the actual database boundary');
reset role;
select *from finish();rollback;
