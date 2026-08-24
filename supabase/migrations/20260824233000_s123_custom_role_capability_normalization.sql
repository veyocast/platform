-- Consolidate custom-role capability normalization after additive capability
-- migrations. Earlier wrappers passed extension capabilities into the legacy
-- validator before removing them, which made valid product/dynamic/sponsor/
-- billing combinations impossible to create through the public RPC.

create or replace function private.normalize_custom_role_capabilities(
  p_capabilities text[]
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text[];
  allowed constant text[] := array[
    'tenant.media.write',
    'tenant.product.write',
    'tenant.playlist.write',
    'tenant.playlist.publish',
    'tenant.screen.manage',
    'tenant.settings.manage',
    'tenant.audit.read',
    'tenant.support.export',
    'tenant.ticket.write',
    'tenant.studio.read',
    'tenant.studio.create',
    'tenant.studio.edit_own',
    'tenant.studio.edit_all',
    'tenant.studio.archive',
    'tenant.studio.template.manage',
    'tenant.studio.motion.edit',
    'tenant.studio.render',
    'tenant.studio.job.manage',
    'tenant.dynamic_slide.read',
    'tenant.dynamic_slide.write',
    'tenant.data_source.read',
    'tenant.data_source.manage',
    'tenant.sponsor.read',
    'tenant.sponsor.write',
    'tenant.sponsor.approve',
    'tenant.sponsor.publish',
    'tenant.sponsor.report',
    'tenant.billing.read',
    'tenant.billing.manage'
  ]::text[];
begin
  select coalesce(array_agg(distinct capability order by capability), '{}'::text[])
  into normalized
  from unnest(coalesce(p_capabilities, '{}'::text[])) capability;

  if not normalized <@ allowed then
    raise exception 'custom role contains unsupported capabilities'
      using errcode = '23514';
  end if;
  if (
    ('tenant.media.write' = any(normalized))
    <> ('tenant.playlist.write' = any(normalized))
  ) then
    raise exception 'content editing requires media and playlist write together'
      using errcode = '23514';
  end if;

  return normalized;
end;
$$;

revoke all on function private.normalize_custom_role_capabilities(text[])
from public, anon, authenticated;
