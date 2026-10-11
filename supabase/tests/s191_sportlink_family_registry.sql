begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(3);
create temporary table s191_registry_before as select
 (select jsonb_agg(jsonb_build_array(template.id,template.status,template.current_published_version_id,version.id,version.source_checksum_sha256,version.status)order by template.id,version.id)
  from public.dynamic_templates template left join public.dynamic_template_versions version on version.template_id=template.id)as registry,
 (select jsonb_build_array((select count(*)from public.dynamic_data_sources),(select count(*)from public.dynamic_slides),
  (select count(*)from public.dynamic_slide_snapshots),(select count(*)from public.playlist_releases),(select count(*)from public.dynamic_render_jobs)))as tenant_counts;
-- Reexecute the real forward migration. Existing published metadata and every
-- historical version must keep the same identities; this is not a fake fixture.
select private.ensure_sites_sportlink_family_registry_v1();
select is((select jsonb_agg(jsonb_build_array(template.id,template.status,template.current_published_version_id,version.id,version.source_checksum_sha256,version.status)order by template.id,version.id)
 from public.dynamic_templates template left join public.dynamic_template_versions version on version.template_id=template.id),
 (select registry from s191_registry_before),'reexecuting the actual family registry migration preserves every published and historical template/version identity');
select is((select jsonb_build_array((select count(*)from public.dynamic_data_sources),(select count(*)from public.dynamic_slides),
 (select count(*)from public.dynamic_slide_snapshots),(select count(*)from public.playlist_releases),(select count(*)from public.dynamic_render_jobs))),
 (select tenant_counts from s191_registry_before),'registry installation/retry creates no tenant sources, designs, snapshots, publications or render work');
select ok(not has_function_privilege('authenticated','private.ensure_sites_sportlink_family_registry_v1()','execute')and not has_function_privilege('anon','private.ensure_sites_sportlink_family_registry_v1()','execute')and not has_function_privilege('service_role','private.ensure_sites_sportlink_family_registry_v1()','execute'),'client and service roles cannot invoke the global registry installation helper');
select *from finish();
rollback;
