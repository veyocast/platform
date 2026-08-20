-- Read-only inventarisatie. Voert geen update, backfill, release of republish uit.
begin transaction read only;

select
  count(*) filter (
    where configuration_json #>> '{editorial,themeSelection,ref,catalog}' = 'v2'
  ) as v2_slides,
  count(*) filter (
    where configuration_json #> '{editorial,themeSelection}' is null
  ) as legacy_slides,
  count(*) filter (
    where configuration_json #> '{editorial,themeSelection}' is not null
      and configuration_json #>> '{editorial,themeSelection,ref,id}' not in (
        'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
        'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
      )
  ) as invalid_theme_ids
from public.dynamic_slides
where status <> 'archived';

select tenant_id, default_theme_id, default_theme_version,
  theme_mode_policy, theme_settings_revision
from public.tenant_settings
order by tenant_id;

rollback;
