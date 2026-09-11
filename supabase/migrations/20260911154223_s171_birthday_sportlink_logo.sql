-- S171: keep the canonical Sportlink club profile (including the tenant logo)
-- fresh once per day. The worker already content-addresses provider assets, so
-- unchanged logo bytes reuse the immutable version and do not create churn.
update public.sportlink_sync_policies
set frequency = 'daily',
    next_sync_at = least(next_sync_at, now())
where dataset_group = 'club_profile'
  and frequency <> 'daily';

-- New connections inherit the same daily cadence. Patch the existing function
-- in place so this migration remains safe after earlier function revisions.
do $$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.upsert_sportlink_connection_v1(uuid,text,text,text,text,text,text)'::regprocedure
  ) into definition;
  patched := replace(
    definition,
    'when group_name=''club_profile'' then ''weekly''',
    'when group_name=''club_profile'' then ''daily'''
  );
  if patched = definition then
    raise exception 'S171 could not patch Sportlink connection cadence';
  end if;
  execute patched;
end $$;

-- The wizard only exposes 1, 2, 4 and 6 cards. Keep the privileged RPC
-- invariant aligned with the contract, including its pre-S138 implementation.
do $$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'private.create_sportlink_birthday_slide_before_s138_readiness(uuid,uuid,text,uuid,jsonb)'::regprocedure
  ) into definition;
  patched := replace(
    definition,
    'config#>>''{presentation,maxPerLandscapePage}'' !~ ''^[1-8]$''',
    'config#>>''{presentation,maxPerLandscapePage}'' !~ ''^(1|2|4|6)$'''
  );
  patched := replace(
    patched,
    'config#>>''{presentation,maxPerPortraitPage}'' !~ ''^[1-8]$''',
    'config#>>''{presentation,maxPerPortraitPage}'' !~ ''^(1|2|4|6)$'''
  );
  if patched = definition then
    raise exception 'S171 could not patch birthday card-count validation';
  end if;
  execute patched;
end $$;
