begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000000392','RSS contract','s292-rss');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,config_json,next_sync_at)
values('20000000-0000-4000-8000-000000000392','10000000-0000-4000-8000-000000000392','RSS contract','rss','{"url":"https://news.example.test/rss"}',now());
create temporary table claims as select *from public.claim_due_rss_sync_v1('s292-rss',30);
select is((select count(*)from claims),1::bigint,'claim the real scheduled source exactly once');
select ok(public.renew_scheduled_rss_sync_v1((select run_id from claims),'s292-rss'),'renew the actual claimed lease');
select ok(not public.renew_scheduled_rss_sync_v1((select run_id from claims),'other-worker'),'another worker cannot renew the lease');
select ok(not has_function_privilege('authenticated','public.renew_scheduled_rss_sync_v1(uuid,text)','execute'),'browser cannot renew a worker lease');

create function pg_temp.media(n integer,missing_photo boolean default false)returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('assetId',asset_id,'externalId',case when role='provider_logo'then null else 'article-'||item end,
 'role',role,'mimeType','image/webp','storagePath','tenants/10000000-0000-4000-8000-000000000392/assets/'||asset_id||'/rss-'||role||'.webp',
 'checksumSha256',repeat('a',64),'fileSizeBytes',1024,'width',512,'height',512,'title','Controlled article artwork'))from(
 select item,role,('40000000-0000-4000-8000-'||lpad((item*2+case when role='article_hero'then 1 else 2 end)::text,12,'0'))::uuid asset_id from generate_series(1,n)item cross join(values('article_hero'),('article_qr'))roles(role)
 where not(missing_photo and item=1 and role='article_hero')
 union all select 0,'provider_logo','40000000-0000-4000-8000-000000000000'::uuid)objects
$$;
create function pg_temp.articles(n integer,missing_photo boolean default false)returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('externalId','article-'||item,'title',repeat('K',400),'canonicalLink','https://news.example.test/article/'||item,
 'link','https://news.example.test/article/'||item,'intro','Actual bounded summary','sourceName','Controlled supplier','author',null,'publishedAt',now(),
 'heroMediaAssetId',case when missing_photo and item=1 then null else ('40000000-0000-4000-8000-'||lpad((item*2+1)::text,12,'0'))::uuid end,
 'qrMediaAssetId',('40000000-0000-4000-8000-'||lpad((item*2+2)::text,12,'0'))::uuid))from generate_series(1,n)item
$$;
select is(jsonb_array_length(pg_temp.media(50)),101,'full producer bound is 101 artifacts');
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(25),pg_temp.media(25)),25,'25 illustrated articles complete with 51 artifacts');
select is((select count(*)from public.dynamic_news_articles where data_source_id='20000000-0000-4000-8000-000000000392'),25::bigint,'all articles committed atomically');
update public.dynamic_data_sources set next_sync_at=now(),last_successful_sync_at=now()-interval '1 second'where id='20000000-0000-4000-8000-000000000392';
truncate claims;insert into claims select *from public.claim_due_rss_sync_v1('s292-rss',30);
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(26),pg_temp.media(26)),26,'26 illustrated articles cross the old 51-artifact failure');
update public.dynamic_data_sources set next_sync_at=now(),last_successful_sync_at=now()-interval '1 second'where id='20000000-0000-4000-8000-000000000392';
truncate claims;insert into claims select *from public.claim_due_rss_sync_v1('s292-rss',30);
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50,true),pg_temp.media(50,true)),50,'50 articles include every QR and supplier logo with one optional missing photo');
select is((select count(*)from public.dynamic_news_articles where data_source_id='20000000-0000-4000-8000-000000000392'and qr_media_asset_id is not null),50::bigint,'every article retains its QR');
select is((select max(length(title))from public.dynamic_news_articles where data_source_id='20000000-0000-4000-8000-000000000392'),400,'full legitimate headline survives completion');
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50,true),pg_temp.media(50,true)),50,'retry of an acknowledged payload replays the receipt without any writes');
select throws_ok($$select public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50),pg_temp.media(50))$$,'23514',null,'a different payload cannot overwrite an acknowledged completion');
update public.dynamic_data_sources set next_sync_at=now(),last_successful_sync_at=now()-interval '1 second'where id='20000000-0000-4000-8000-000000000392';
truncate claims;insert into claims select *from public.claim_due_rss_sync_v1('s292-rss',30);
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50),pg_temp.media(50)),50,'full 101-artifact dataset succeeds without dropping images');
select is((select count(*)from public.media_assets where tenant_id='10000000-0000-4000-8000-000000000392'),101::bigint,'identical assets are reused across retries and batch sizes');
-- Separate HTTP RPCs have distinct transaction times. This rollback-only
-- pgTAP transaction shifts the stored observation between cycles to exercise
-- that same existing semantic-hash trigger rather than its same-time shortcut.
create temporary table stable_revision as select revision from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000392';
update public.dynamic_data_sources set next_sync_at=now(),last_successful_sync_at=now()-interval '1 second'where id='20000000-0000-4000-8000-000000000392';
truncate claims;insert into claims select *from public.claim_due_rss_sync_v1('s292-rss',30);
select is(public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50),pg_temp.media(50)),50,'a regular unchanged next source cycle still succeeds');
select is((select revision from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000392'),(select revision from stable_revision),'an unchanged source cycle does not advance the semantic data revision');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000000392'),0::bigint,'source completion creates no unsolicited slide capture job');
update public.dynamic_data_sources set next_sync_at=now(),last_successful_sync_at=now()-interval '1 second'where id='20000000-0000-4000-8000-000000000392';
truncate claims;insert into claims select *from public.claim_due_rss_sync_v1('s292-rss',30);
select throws_ok($$select public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',jsonb_set(pg_temp.articles(50),'{0,title}',to_jsonb(repeat('K',401))),pg_temp.media(50))$$,'22023',null,'an overlong headline rejects the whole new dataset');
select throws_ok($$select public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',null,'[]')$$,'22023',null,'a null payload cannot erase the last complete dataset');
select is((select count(*)from public.dynamic_news_articles where data_source_id='20000000-0000-4000-8000-000000000392'),50::bigint,'rejected completion preserves the previous complete dataset');
-- A newer attempt with the same worker name owns the source lease.
update public.dynamic_data_sources set last_attempt_at=now()+interval '1 second'where id='20000000-0000-4000-8000-000000000392';
select ok(not public.renew_scheduled_rss_sync_v1((select run_id from claims),'s292-rss'),'old run cannot renew a successor with the same worker name');
select throws_ok($$select public.complete_scheduled_rss_sync_v2((select run_id from claims),'s292-rss',pg_temp.articles(50),pg_temp.media(50))$$,'55000',null,'old run cannot complete a successor lease');
select throws_ok($$select public.fail_scheduled_rss_sync_v1((select run_id from claims),'s292-rss','test_failure','Controlled test')$$,'55000',null,'old run cannot fail a successor lease');
select *from finish();rollback;
