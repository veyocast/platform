-- Only after the environment's normal deployment job completes successfully.
-- Project binding is supplied explicitly through the Supabase connector.
begin read only;
select jsonb_build_object(
  'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
  'latestMigration',(select max(version) from supabase_migrations.schema_migrations),
  's313MigrationPresent',exists(select 1 from supabase_migrations.schema_migrations where version='20261113124946'),
  'blogTableCount',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relname like 'platform_blog_%'),
  'blogTablesAllRls',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relname like 'platform_blog_%'),
  'directAuthenticatedWrites',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relname like 'platform_blog_%' and has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')),
  'blogFunctionCount',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'blog_%'),
  'anonymousBlogExecuteCount',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'blog_%' and has_function_privilege('anon',p.oid,'EXECUTE')),
  'publicViewSecurityInvoker',(select reloptions @> array['security_invoker=true'] from pg_class where oid='public.platform_blog_publications'::regclass),
  'anonymousDraftPointer',has_column_privilege('anon','public.platform_blog_posts','draft_revision','SELECT'),
  'anonymousRevisionActor',has_column_privilege('anon','public.platform_blog_revisions','created_by','SELECT'),
  'mediaBucket',(select jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'mimeTypes',allowed_mime_types) from storage.buckets where id='platform_blog_media'),
  'sites',(select coalesce(jsonb_agg(jsonb_build_object('siteId',site_id,'environment',environment,'publicOrigin',public_origin)),'[]'::jsonb) from public.platform_blog_sites),
  'tokenCount',(select count(*) from private.platform_blog_tokens),
  'activeTokenCount',(select count(*) from private.platform_blog_tokens where revoked_at is null and expires_at>now()),
  'articleCount',(select count(*) from public.platform_blog_posts),
  'revisionCount',(select count(*) from public.platform_blog_revisions),
  'assetCount',(select count(*) from public.platform_blog_assets),
  'publishedCount',(select count(*) from public.platform_blog_publications)
) as deployment_readback;
commit;
