-- Uitsluitend voor de lokale, expliciet ingeschakelde Menu Studio E2E.
-- Featureflags blijven in alle migrations en echte tenants standaard uit.
\set ON_ERROR_STOP on

insert into public.tenant_settings (
  tenant_id, updated_by, menu_document_v2_read_enabled,
  menu_studio_v2_authoring_enabled, menu_studio_v2_linked_groups_enabled,
  menu_studio_v2_media_enabled, menu_studio_v2_publish_enabled,
  menu_studio_v2_player_enabled, theme_accent, theme_support
) values (
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101', true, true, true, true, true, true,
  '#FF5C20', '#0050FF'
) on conflict (tenant_id) do update set
  menu_document_v2_read_enabled = true,
  menu_studio_v2_authoring_enabled = true,
  menu_studio_v2_linked_groups_enabled = true,
  menu_studio_v2_media_enabled = true,
  menu_studio_v2_publish_enabled = true,
  menu_studio_v2_player_enabled = true;

insert into public.dynamic_data_sources (
  id, tenant_id, name, kind, status, provider_status, created_by, updated_by
) values (
  '30000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  'Brasserie assortiment', 'manual_products', 'active', 'ready',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101'
) on conflict (id) do nothing;

insert into public.tenant_products (
  id, tenant_id, data_source_id, source, source_external_id, slug, name,
  description, category, price_cents, currency, available, source_category_id,
  sort_order, created_by, updated_by
)
select
  ('50000000-0000-4000-8000-' || lpad(product_index::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000101'::uuid,
  '30000000-0000-4000-8000-000000000101'::uuid,
  'manual', 'e2e-' || slug, slug, name, description, category, price,
  'EUR', true, lower(replace(category, ' ', '-')), product_index,
  '00000000-0000-4000-8000-000000000101'::uuid,
  '00000000-0000-4000-8000-000000000101'::uuid
from (values
  (1, 'cola-regular', 'Coca-Cola Regular', 'Gekoeld geserveerd', 'Frisdranken', 310),
  (2, 'cola-zero', 'Coca-Cola Zero', 'Zonder suiker', 'Frisdranken', 310),
  (3, 'cola-cherry', 'Coca-Cola Cherry', 'Kersensmaak', 'Frisdranken', 310),
  (4, 'espresso', 'Espresso', 'Krachtig en vers gezet', 'Warme dranken', 285),
  (5, 'cappuccino', 'Cappuccino', 'Romig melkschuim', 'Warme dranken', 350),
  (6, 'soep', 'Soep van het seizoen', 'Met brood', 'Gerechten', 875),
  (7, 'tosti', 'Tosti oude kaas', 'Zuurdesembrood', 'Gerechten', 940)
) as products(product_index, slug, name, description, category, price)
on conflict (tenant_id, slug) do nothing;
