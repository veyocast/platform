create table public.player_device_lab_runs (
  run_id text primary key check (length(run_id) between 8 and 80),
  captured_at timestamptz not null,
  app_version text not null check (length(app_version) between 1 and 80),
  deployment_sha text not null check (length(deployment_sha) between 1 and 120),
  lg_model text check (lg_model is null or length(lg_model) <= 160),
  firmware_version text check (firmware_version is null or length(firmware_version) <= 160),
  detected_platform text check (detected_platform is null or length(detected_platform) <= 200),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  created_at timestamptz not null default now()
);

create index player_device_lab_runs_created_at_idx
on public.player_device_lab_runs(created_at desc);

alter table public.player_device_lab_runs enable row level security;
alter table public.player_device_lab_runs force row level security;

revoke all on public.player_device_lab_runs from anon, authenticated;
grant insert, select on public.player_device_lab_runs to service_role;

comment on table public.player_device_lab_runs is
  'Server-only Device Capability Lab results; access requires a temporary diagnostic session.';
