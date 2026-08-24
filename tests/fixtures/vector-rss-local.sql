-- Local-only RSS fixture for the isolated Vector Studio browser journey.
-- Never load this file in staging or production.
insert into public.dynamic_data_sources (
  id,
  tenant_id,
  name,
  kind,
  status,
  provider_status,
  config_json,
  last_successful_sync_at,
  last_attempt_at,
  revision,
  created_by,
  updated_by
)
values (
  'a1234567-89ab-4cde-8f01-23456789abcd',
  '10000000-0000-4000-8000-000000000101',
  'Clubnieuws',
  'rss',
  'active',
  'ready',
  '{"feedUrl":"https://example.test/clubnieuws.xml","refreshIntervalMinutes":30}'::jsonb,
  now(),
  now(),
  1,
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101'
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  provider_status = excluded.provider_status,
  config_json = excluded.config_json,
  last_successful_sync_at = excluded.last_successful_sync_at,
  last_attempt_at = excluded.last_attempt_at,
  revision = excluded.revision,
  updated_by = excluded.updated_by;

insert into public.dynamic_news_articles (
  id,
  tenant_id,
  data_source_id,
  external_id,
  title,
  intro,
  author,
  source_name,
  link,
  published_at,
  content_hash,
  raw_reference
)
values (
  'b1234567-89ab-4cde-8f01-23456789abcd',
  '10000000-0000-4000-8000-000000000101',
  'a1234567-89ab-4cde-8f01-23456789abcd',
  'clubnieuws-jeugdtribune',
  'Nieuwe jeugdtribune geopend',
  'De nieuwe jeugdtribune is klaar voor de eerstvolgende thuiswedstrijd.',
  'Redactie',
  'Clubnieuws',
  'https://example.test/clubnieuws/nieuwe-jeugdtribune',
  now() - interval '1 hour',
  repeat('a', 64),
  '{"fixture":"vector-rss-local"}'::jsonb
)
on conflict (tenant_id, data_source_id, external_id) do update set
  title = excluded.title,
  intro = excluded.intro,
  author = excluded.author,
  source_name = excluded.source_name,
  link = excluded.link,
  published_at = excluded.published_at,
  content_hash = excluded.content_hash,
  raw_reference = excluded.raw_reference;
