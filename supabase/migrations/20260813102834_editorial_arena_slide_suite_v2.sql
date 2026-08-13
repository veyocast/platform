-- S101: freeze the complete Editorial Arena v2 presentation configuration in
-- every new immutable dynamic snapshot. Existing slides and releases remain
-- readable; legacy mutable slides receive deterministic defaults only when a
-- new preview/snapshot is built.

create or replace function private.editorial_arena_configuration_v2(
  p_mode text,
  p_accent text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 2,
    'newsVariant', 'hero_split',
    'pricePhotoMode', 'show',
    'theme', jsonb_build_object(
      'mode', case when p_mode = 'dark' then 'dark' else 'light' end,
      'light', jsonb_build_object(
        'canvas', '#D7D2C8', 'surface', '#F3F0E9',
        'surfaceRaised', '#FBF9F4', 'panel', '#E8E4DC',
        'row', '#FBF9F4', 'rowSelected', '#141619',
        'text', '#111315', 'textMuted', '#68665F',
        'textFaint', 'rgba(17, 19, 21, 0.47)',
        'textOnAccent', '#FFFAF2', 'textOnSelected', '#F7F3EB',
        'border', 'rgba(17, 19, 21, 0.12)',
        'borderSoft', 'rgba(17, 19, 21, 0.075)',
        'divider', 'rgba(17, 19, 21, 0.12)',
        'accent', coalesce(nullif(p_accent, ''), '#EC622C'),
        'accentSoft', 'rgba(236, 98, 44, 0.14)',
        'success', '#31A574', 'warning', '#C99431',
        'danger', '#D55656', 'neutral', '#A9A399',
        'shadow', 'rgba(66, 55, 41, 0.14)',
        'imageOverlayStart', 'rgba(6, 8, 10, 0.96)',
        'imageOverlayMid', 'rgba(6, 8, 10, 0.72)',
        'imageOverlayEnd', 'rgba(6, 8, 10, 0.08)',
        'qrSurface', '#F3F0E9', 'qrInk', '#111315'
      ),
      'dark', jsonb_build_object(
        'canvas', '#090B0E', 'surface', '#0D1116',
        'surfaceRaised', '#171C22', 'panel', '#14181D',
        'row', '#11161C', 'rowSelected', '#F3F0E9',
        'text', '#F7F3EB', 'textMuted', '#B9B5AD',
        'textFaint', 'rgba(247, 243, 235, 0.48)',
        'textOnAccent', '#111315', 'textOnSelected', '#111315',
        'border', 'rgba(250, 250, 247, 0.15)',
        'borderSoft', 'rgba(250, 250, 247, 0.09)',
        'divider', 'rgba(250, 250, 247, 0.14)',
        'accent', coalesce(nullif(p_accent, ''), '#FF6E37'),
        'accentSoft', 'rgba(255, 110, 55, 0.18)',
        'success', '#46D18C', 'warning', '#FFAD66',
        'danger', '#FF716B', 'neutral', '#8D9095',
        'shadow', 'rgba(0, 0, 0, 0.34)',
        'imageOverlayStart', 'rgba(6, 8, 10, 0.98)',
        'imageOverlayMid', 'rgba(6, 8, 10, 0.76)',
        'imageOverlayEnd', 'rgba(6, 8, 10, 0.12)',
        'qrSurface', '#F3F0E9', 'qrInk', '#111315'
      )
    )
  )
$$;

revoke all on function private.editorial_arena_configuration_v2(text, text)
  from public, anon, authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_editorial_suite_v2;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  configured jsonb;
  template_slug text;
  resolved_mode text;
begin
  result :=
    private.build_dynamic_snapshot_data_before_editorial_suite_v2(p_slide);
  configured := p_slide.configuration_json -> 'editorial';

  select template.slug
  into template_slug
  from public.dynamic_templates template
  where template.id = p_slide.template_id;

  resolved_mode := case
    when template_slug like '%-dark-%' then 'dark'
    else 'light'
  end;

  if jsonb_typeof(configured) <> 'object'
    or configured ->> 'schemaVersion' is distinct from '2'
    or jsonb_typeof(configured -> 'theme' -> 'light') <> 'object'
    or jsonb_typeof(configured -> 'theme' -> 'dark') <> 'object'
  then
    configured := private.editorial_arena_configuration_v2(
      resolved_mode,
      result #>> '{brand,primaryColor}'
    );
  end if;

  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'editorial', configured
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_editorial_suite_v2(
  public.dynamic_slides
) from public, anon, authenticated;
