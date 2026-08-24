\set ON_ERROR_STOP on

insert into public.tenant_feature_flags (
  tenant_id, flag_key, enabled, rollout_reason
) values (
  '10000000-0000-4000-8000-000000000101',
  'engage',
  true,
  'Geisoleerde lokale Vector Engage end-to-end verificatie.'
) on conflict (tenant_id, flag_key) do update set
  enabled = excluded.enabled,
  rollout_reason = excluded.rollout_reason;

insert into public.engage_campaigns (
  id, public_id, tenant_id, kind, status, title, question,
  result_visibility, privacy_notice
) values (
  '50000000-0000-4000-8000-000000001250',
  '50000000-0000-4000-8000-000000001251',
  '10000000-0000-4000-8000-000000000101',
  'motm',
  'live',
  'Man van de wedstrijd',
  'Wie was vandaag de man van de wedstrijd?',
  'after_vote',
  'Je stem wordt zonder naam opgeslagen en alleen gebruikt voor deze actie.'
) on conflict (id) do update set
  status = excluded.status,
  title = excluded.title,
  question = excluded.question,
  result_visibility = excluded.result_visibility;

insert into public.engage_options (
  id, tenant_id, campaign_id, label, sort_order
) values
  (
    '50000000-0000-4000-8000-000000001261',
    '10000000-0000-4000-8000-000000000101',
    '50000000-0000-4000-8000-000000001250',
    'Ruben de Vries',
    0
  ),
  (
    '50000000-0000-4000-8000-000000001262',
    '10000000-0000-4000-8000-000000000101',
    '50000000-0000-4000-8000-000000001250',
    'Youssef El Amrani',
    1
  ),
  (
    '50000000-0000-4000-8000-000000001263',
    '10000000-0000-4000-8000-000000000101',
    '50000000-0000-4000-8000-000000001250',
    'Daan Vermeer',
    2
  )
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;
