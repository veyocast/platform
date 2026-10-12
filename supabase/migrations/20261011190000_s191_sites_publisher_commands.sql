-- S191: persisted club fields and atomic adapters for the exact Sites workflows.
alter table public.tenant_settings add column club_location text not null default ''check(length(club_location)<=120),
  add column club_website text not null default ''check(club_website=''or(length(club_website)<=500 and club_website~'^https://[^[:space:]@]+$')),
  add column club_profile_revision bigint not null default 0 check(club_profile_revision>=0);
create function private.advance_club_profile_revision_v1()returns trigger language plpgsql security invoker set search_path='' as $$begin new.club_profile_revision:=old.club_profile_revision+1;return new;end $$;
revoke all on function private.advance_club_profile_revision_v1()from public,anon,authenticated,service_role;
create trigger zz_settings_club_profile_revision before update on public.tenant_settings for each row execute function private.advance_club_profile_revision_v1();
create function public.update_tenant_control_settings_v4(
  p_tenant_id uuid,p_name text,p_primary_color text,p_default_image_duration_seconds integer,p_default_fit_mode text,
  p_default_video_muted boolean,p_default_screen_orientation text,p_default_resolution_width integer,p_default_resolution_height integer,
  p_timezone_name text,p_default_transition text,p_default_background_color text,p_club_location text,p_club_website text,p_expected_profile_revision bigint,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare settings public.tenant_settings%rowtype;request jsonb;replay jsonb;actual_revision bigint;
begin
  if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.settings.manage')then raise exception 'settings management required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  select * into settings from public.tenant_settings where tenant_id=p_tenant_id for update;
  if not found then raise exception 'tenant settings unavailable'using errcode='P0002';end if;
  request:=jsonb_build_object('tenantId',p_tenant_id,'name',p_name,'primaryColor',p_primary_color,'duration',p_default_image_duration_seconds,'fit',p_default_fit_mode,'muted',p_default_video_muted,'orientation',p_default_screen_orientation,'width',p_default_resolution_width,'height',p_default_resolution_height,'timezone',p_timezone_name,'transition',p_default_transition,'background',p_default_background_color,'location',p_club_location,'website',p_club_website,'expectedRevision',p_expected_profile_revision);
  replay:=private.begin_publisher_command(p_tenant_id,'tenant.settings.v4',p_idempotency_key,request);if replay is not null then return replay;end if;
  if p_expected_profile_revision is distinct from settings.club_profile_revision then return private.complete_publisher_command(p_tenant_id,'tenant.settings.v4',p_idempotency_key,request,'tenant_settings',p_tenant_id,jsonb_build_object('outcome','conflict','actualRevision',settings.club_profile_revision),'tenant.settings.conflict','failed');end if;
  if p_club_location is null or length(btrim(p_club_location))>120 or p_club_website is null or length(btrim(p_club_website))>500 or(btrim(p_club_website)<>''and btrim(p_club_website)!~'^https://[^[:space:]@]+$')then raise exception 'club profile fields invalid'using errcode='23514';end if;
  perform public.update_tenant_control_settings_v3(p_tenant_id,p_name,p_primary_color,p_default_image_duration_seconds,p_default_fit_mode,p_default_video_muted,p_default_screen_orientation,p_default_resolution_width,p_default_resolution_height,p_timezone_name,p_default_transition,p_default_background_color);
  update public.tenant_settings set club_location=btrim(p_club_location),club_website=btrim(p_club_website),updated_by=private.current_user_id(),updated_at=now()where tenant_id=p_tenant_id returning club_profile_revision into actual_revision;
  return private.complete_publisher_command(p_tenant_id,'tenant.settings.v4',p_idempotency_key,request,'tenant_settings',p_tenant_id,jsonb_build_object('outcome','saved','actualRevision',actual_revision),'tenant.settings.saved','success');
end $$;
revoke all on function public.update_tenant_control_settings_v4(uuid,text,text,integer,text,boolean,text,integer,integer,text,text,text,text,text,bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.update_tenant_control_settings_v4(uuid,text,text,integer,text,boolean,text,integer,integer,text,text,text,text,text,bigint,uuid)to authenticated;

create function public.save_publish_screen_composition_batch_v1(p_tenant_id uuid,p_targets jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare target jsonb;result jsonb;results jsonb:='[]';request jsonb;replay jsonb;ordinal integer:=0;save_key uuid;publish_key uuid;
begin
  if private.current_user_id()is null or not private.can_manage_screens(p_tenant_id)or not private.has_tenant_capability(p_tenant_id,'tenant.playlist.publish')then raise exception 'screen management and publication required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if jsonb_typeof(p_targets)is distinct from 'array'or jsonb_array_length(p_targets)not between 1 and 100 or octet_length(p_targets::text)>262144
    or(select count(distinct value->>'screenId')from jsonb_array_elements(p_targets))<>jsonb_array_length(p_targets)then raise exception 'composition target batch outside limits'using errcode='22023';end if;
  perform id from public.screens where tenant_id=p_tenant_id and id in(select(value->>'screenId')::uuid from jsonb_array_elements(p_targets))order by id for update;
  if(select count(*)from public.screens where tenant_id=p_tenant_id and id in(select(value->>'screenId')::uuid from jsonb_array_elements(p_targets)))<>jsonb_array_length(p_targets)then raise exception 'target unavailable in tenant'using errcode='42501';end if;
  request:=jsonb_build_object('targets',p_targets);replay:=private.begin_publisher_command(p_tenant_id,'screen.composition.batch',p_idempotency_key,request);if replay is not null then return replay;end if;
  for target in select * from jsonb_array_elements(p_targets)loop
    ordinal:=ordinal+1;save_key:=md5(p_idempotency_key::text||':composition:save:'||ordinal)::uuid;publish_key:=md5(p_idempotency_key::text||':composition:publish:'||ordinal)::uuid;
    result:=public.save_screen_composition_draft_v1((target->>'screenId')::uuid,(target->>'expectedDraftRevision')::bigint,target->'configuration',save_key);
    if result->>'outcome'is distinct from 'saved'then raise exception 'composition revision conflict; no targets changed'using errcode='40001';end if;
    result:=public.publish_screen_composition_v1((target->>'screenId')::uuid,(result->>'actualRevision')::bigint,publish_key);
    if result->>'outcome'is distinct from 'published'then raise exception 'composition publication conflict; no targets changed'using errcode='40001';end if;
    results:=results||jsonb_build_array(result||jsonb_build_object('screenId',target->>'screenId'));
  end loop;
  return private.complete_publisher_command(p_tenant_id,'screen.composition.batch',p_idempotency_key,request,'screens',null,jsonb_build_object('outcome','published','targets',results),'publisher.screen.composition.batch.published','success');
end $$;
revoke all on function public.save_publish_screen_composition_batch_v1(uuid,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_publish_screen_composition_batch_v1(uuid,jsonb,uuid)to authenticated;

create function public.create_studio_series_zone_playlist_v1(p_series_id uuid,p_expected_series_revision bigint,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare series public.studio_series%rowtype;playlist_id uuid:=gen_random_uuid();release_id uuid;request jsonb;replay jsonb;result jsonb;ids uuid[];revision bigint;name text;
begin
  select * into series from public.studio_series where id=p_series_id and status='active'for share;
  if not found or private.current_user_id()is null or not private.can_write_playlist(series.tenant_id)or not private.has_tenant_capability(series.tenant_id,'tenant.playlist.publish')then raise exception 'Studio playlist publication required'using errcode='42501';end if;
  perform private.require_active_tenant_command(series.tenant_id);
  request:=jsonb_build_object('seriesId',p_series_id,'expectedSeriesRevision',p_expected_series_revision);
  replay:=private.begin_publisher_command(series.tenant_id,'studio.zone.playlist',p_idempotency_key,request);if replay is not null then return replay;end if;
  if series.revision is distinct from p_expected_series_revision then raise exception 'Studio series changed; no playlist created'using errcode='40001';end if;
  select array_agg(gen_random_uuid()order by sort_order)into ids from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id;
  if cardinality(ids)is null or cardinality(ids)=0 then raise exception 'Studio series is empty'using errcode='23514';end if;
  name:=left(series.name,110)||' · scherm';
  insert into public.playlists(id,tenant_id,name,created_by,updated_by)values(playlist_id,series.tenant_id,name,private.current_user_id(),private.current_user_id());
  select playlists.revision into revision from public.playlists where id=playlist_id;
  result:=public.mutate_playlist_batch_v1(playlist_id,revision,jsonb_build_array(jsonb_build_object('operation','add_studio_series','clientId',ids[1],'clientItemIds',to_jsonb(ids),'seriesId',series.id,'expectedSeriesRevision',series.revision)),md5(p_idempotency_key::text||':studio-zone:items')::uuid);
  if result->>'outcome'is distinct from 'applied'then raise exception 'Studio series not added'using errcode='40001';end if;
  release_id:=private.materialize_playlist_configuration_s185(playlist_id,'Studio-ontwerp voor schermzone');
  return private.complete_publisher_command(series.tenant_id,'studio.zone.playlist',p_idempotency_key,request,'playlists',playlist_id,jsonb_build_object('outcome','created','playlistId',playlist_id,'releaseId',release_id,'itemCount',cardinality(ids)),'publisher.studio.zone.playlist.created','success');
end $$;
revoke all on function public.create_studio_series_zone_playlist_v1(uuid,bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.create_studio_series_zone_playlist_v1(uuid,bigint,uuid)to authenticated;
select pg_catalog.pg_notify('pgrst','reload schema');
