begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001491', 'authenticated', 'authenticated', 'theme-colors-a@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001492', 'authenticated', 'authenticated', 'theme-colors-b@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001491', 'Theme colors owner A'),
  ('00000000-0000-4000-8000-000000001492', 'Theme colors owner B');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-4000-8000-000000001491', 'Theme colors tenant A', 'theme-colors-a'),
  ('10000000-0000-4000-8000-000000001492', 'Theme colors tenant B', 'theme-colors-b');

insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001491'),
  ('10000000-0000-4000-8000-000000001492');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001491', '00000000-0000-4000-8000-000000001491', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001492', '00000000-0000-4000-8000-000000001492', 'tenant_owner');

create temporary table s149_palette (value jsonb not null);
insert into s149_palette(value)
select jsonb_build_object(
  'fieldflow',
  jsonb_build_object('dark', tokens, 'light', tokens, 'mode', 'light')
)
from (
  select jsonb_object_agg(token, '#123456') as tokens
  from unnest(array[
    'accent', 'accentSoft', 'border', 'borderSoft', 'canvas', 'danger',
    'divider', 'imageOverlayEnd', 'imageOverlayMid', 'imageOverlayStart',
    'neutral', 'panel', 'qrInk', 'qrSurface', 'row', 'rowSelected',
    'shadow', 'success', 'surface', 'surfaceRaised', 'text', 'textFaint',
    'textMuted', 'textOnAccent', 'textOnSelected', 'warning'
  ]::text[]) token
) palette;
grant select on s149_palette to authenticated;

select has_column(
  'public',
  'tenant_settings',
  'theme_color_overrides',
  'tenant settings stores one central theme color map'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.update_tenant_theme_settings_v2(uuid,bigint,text,text,jsonb,jsonb,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.update_tenant_theme_settings_v2(uuid,bigint,text,text,jsonb,jsonb,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.update_tenant_control_settings_v5(uuid,text,text,integer,text,boolean,text,integer,integer,text,text,text,bigint,text,text,jsonb,jsonb,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.update_tenant_control_settings_v5(uuid,text,text,integer,text,boolean,text,integer,integer,text,text,text,bigint,text,text,jsonb,jsonb,text,text)',
    'EXECUTE'
  ),
  'only authenticated users can invoke tenant settings commands'
);

select ok(
  not has_function_privilege(
    'service_role',
    'private.tenant_theme_color_overrides_is_valid_v1(jsonb)',
    'EXECUTE'
  ),
  'the private palette validator is not Data API executable'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001491',
  true
);

select is(
  public.update_tenant_theme_settings_v2(
    '10000000-0000-4000-8000-000000001491',
    0,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb,
    (select value from s149_palette),
    '#315CFF',
    '#17324D'
  ) ->> 'outcome',
  'applied',
  'tenant owner stores the central FieldFlow palette'
);

select is(
  (
    select theme_color_overrides #>> '{fieldflow,light,canvas}'
    from public.tenant_settings
    where tenant_id = '10000000-0000-4000-8000-000000001491'
  ),
  '#123456',
  'the complete palette is stored on the owning tenant'
);

select is(
  public.update_tenant_theme_settings_v2(
    '10000000-0000-4000-8000-000000001491',
    0,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"dark"}'::jsonb,
    (select value from s149_palette),
    null,
    null
  ) ->> 'outcome',
  'conflict',
  'a stale theme revision cannot overwrite newer tenant colors'
);

select throws_ok(
  $$select public.update_tenant_theme_settings_v2(
    '10000000-0000-4000-8000-000000001491',
    1,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb,
    '{"fieldflow":{"dark":{},"light":{},"mode":"light"}}'::jsonb,
    null,
    null
  )$$,
  '23514',
  'tenant theme colors are invalid',
  'an incomplete color map is rejected before storage'
);

select throws_ok(
  $$select public.update_tenant_theme_settings_v2(
    '10000000-0000-4000-8000-000000001492',
    0,
    'fieldflow',
    '1.0.0',
    '{"kind":"fixed","mode":"light"}'::jsonb,
    (select value from s149_palette),
    null,
    null
  )$$,
  '42501',
  'actor cannot update tenant theme settings',
  'tenant A cannot mutate tenant B colors'
);

select * from finish();
rollback;
