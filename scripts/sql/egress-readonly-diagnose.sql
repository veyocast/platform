-- VeyoCast egress: READ-ONLY controles voor de op 20-09-2026 aangetroffen schema's.
-- Controleer project-ref vóór uitvoeren: productie csrakhciqvehitplvale.
-- Dit zijn PostgreSQL-queries, GEEN Logs Explorer SQL en GEEN billingmeter.
-- Gebruik bestaande geautoriseerde toegang; geen actor-/JWT-impersonatie.
-- Geen querystatistiekenreset, massale mediafetch of productie-mutatie.
-- Het script kan meerdere resultsets opleveren. Voer secties zo nodig apart uit.

begin read only;
set local statement_timeout = '15s';

-- Q1: tijd en statistiekenvenster.
select clock_timestamp() as measured_at, stats_reset, dealloc
from extensions.pg_stat_statements_info;

-- Q2: huidige publicaties en voorraad jobs; aantallen zijn geen netwerkbytes.
select
 (select count(*) from public.playlist_publications) as current_publication_records,
 (select count(*) from public.published_dynamic_data) as live_datasets,
 (select count(*) from public.playlist_releases) as retained_releases,
 (select count(*) from public.dynamic_slide_snapshots) as retained_snapshots,
 (select count(*) from public.dynamic_render_jobs) as retained_dynamic_jobs,
 (select count(*) from public.media_processing_jobs) as retained_media_jobs,
 (select count(*) from public.studio_render_jobs) as retained_studio_jobs;

-- Q3: voer dit op twee echte meetmomenten uit en bereken delta / seconden.
-- Behoud userid/dbid/queryid/toplevel om verschillende counters niet samen te gooien.
select clock_timestamp() as measured_at, userid, dbid, toplevel,
 queryid::text, calls, rows,
 substring(query from '"public"\."([^"]+)"') as function_name
from extensions.pg_stat_statements
where query like 'WITH pgrst_source%'
  and query ~ '"(claim_dynamic_render_job_v1|claim_media_processing_job|claim_studio_render_job_v1|complete_dynamic_render_job_v1|record_player_heartbeat_v2)"'
order by calls desc;

-- Q4: publicatieredenen en laatste recente publicaties.
select p.name, r.version, r.published_at, r.release_notes,
 r.item_count, r.total_duration_seconds, r.total_bytes
from public.playlist_releases r
join public.playlists p on p.id=r.playlist_id and p.tenant_id=r.tenant_id
where r.published_at > now()-interval '2 days'
order by r.published_at desc limit 25;

select pending, count(*) as queue_records,
 max(last_requested_at) as last_request,
 max(last_published_at) as last_publish,
 max(attempt_count) as max_attempts
from private.dynamic_release_refresh_queue group by pending;

-- Q5: controleer bodies en gekoppelde triggers; voer de functies niet uit.
select n.nspname, p.proname, p.prosrc
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
 and p.proname in ('process_dynamic_release_refresh_v1',
                   'process_due_dynamic_release_refresh_v1');

select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal
 and p.proname in ('enqueue_dynamic_release_refresh_v1','track_current_publication_v1');

-- Q6: werkelijke opslagmetadata. Som grootte is NIET egress.
select id,public from storage.buckets;
select metadata->>'cacheControl' as cache_control,count(*) as object_records
from storage.objects group by 1 order by 2 desc;
select bucket_id,metadata->>'mimetype' as mime,count(*) as object_records,
 sum(case when (metadata->>'size') ~ '^[0-9]+$'
          then (metadata->>'size')::numeric else 0 end) as stored_bytes,
 count(*) filter(where updated_at>now()-interval '24 hours') as updated_objects_24h
from storage.objects group by 1,2 order by stored_bytes desc;

-- Q7: actieve video-items op het onderzochte scherm. Geen signingtokens/URL's nodig.
select s.name,p.name as playlist,r.id as active_release_id,r.version,
 r.total_duration_seconds,r.total_bytes,
 ri.asset_title,ri.file_size_bytes,ri.duration_seconds,
 ri.media_asset_id,ri.media_variant_id,ri.checksum_sha256
from public.player_devices d
join public.screens s on s.id=d.screen_id and s.tenant_id=d.tenant_id
join public.playlist_releases r on r.id=d.active_release_id and r.tenant_id=d.tenant_id
join public.playlists p on p.id=r.playlist_id and p.tenant_id=r.tenant_id
join public.playlist_release_items ri on ri.release_id=r.id and ri.tenant_id=r.tenant_id
where d.tenant_id='7526e17f-c819-431c-a05d-4ef5f16ea1c0'
 and s.name='Kantine Prijslijst' and ri.asset_kind='video';

-- Q8: versies en gerapporteerde cachevelden; null is onbekend, geen bewezen cache-miss.
select s.name,d.platform,d.app_version,d.last_seen_at,d.current_sync_phase,
 d.storage_used_bytes,d.storage_quota_bytes,
 d.capabilities#>>'{goalVideo,runtime}' as runtime,
 d.capabilities#>>'{goalVideo,browserVersion}' as browser_version,
 d.capabilities#>>'{goalVideo,webOS}' as reported_webos,
 d.active_release_id,d.desired_release_id
from public.player_devices d
left join public.screens s on s.id=d.screen_id and s.tenant_id=d.tenant_id
where d.tenant_id='7526e17f-c819-431c-a05d-4ef5f16ea1c0';

-- Q9: grootte van de actuele JSONtekst, GEEN HTTP-compressie-/billingbytes.
select data_json->>'type' as type,count(*) as datasets,
 round(avg(octet_length(data_json::text))) as avg_serialized_bytes,
 max(octet_length(data_json::text)) as max_serialized_bytes,
 max(data_revision) as max_revision,
 max(changed_at) as last_changed,max(checked_at) as last_checked
from public.published_dynamic_data group by 1;

-- Q10: aanmaak van renders, geen daadwerkelijke bestandsdownloads.
select d.slide_type,count(*) as jobs_last_6h,
 count(distinct d.id) as slide_count,
 count(*) filter(where d.status='archived') as currently_archived_slide_jobs
from public.dynamic_render_jobs j
join public.dynamic_slide_snapshots ss on ss.id=j.snapshot_id and ss.tenant_id=j.tenant_id
join public.dynamic_slides d on d.id=ss.dynamic_slide_id and d.tenant_id=ss.tenant_id
where j.created_at>now()-interval '6 hours'
group by 1 order by 2 desc;

-- Q11: registratienamen; geen volledige migraties/body met mogelijke secrets exporteren.
select version,name from supabase_migrations.schema_migrations
order by version desc limit 10;

commit;
