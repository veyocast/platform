-- S142: safe, paired LED Scores canvas scenes. The source document remains in
-- the existing draft and immutable version chain; media references continue to
-- be frozen by the existing version-assets table.

alter table public.ledscores_goal_alerts
  drop constraint ledscores_goal_alerts_draft_config_check;
alter table public.ledscores_goal_alerts
  add constraint ledscores_goal_alerts_draft_config_check check (
    jsonb_typeof(draft_config) = 'object'
    and pg_column_size(draft_config) <= 250000
    and draft_config ->> 'schemaVersion' = '1'
    and jsonb_typeof(draft_config -> 'ownDesign') = 'object'
    and jsonb_typeof(draft_config -> 'opponentDesign') = 'object'
    and jsonb_typeof(draft_config -> 'unknownDesign') = 'object'
  );

alter table public.ledscores_goal_alert_versions
  drop constraint ledscores_goal_alert_versions_config_snapshot_check;
alter table public.ledscores_goal_alert_versions
  add constraint ledscores_goal_alert_versions_config_snapshot_check check (
    jsonb_typeof(config_snapshot) = 'object'
    and pg_column_size(config_snapshot) <= 262144
  );

-- Keep the original, audited S132 write flow and change only its bounded input
-- limits. The assertions make a future upstream body change fail closed.
do $$
declare
  save_definition text;
begin
  select pg_get_functiondef(
    'public.save_ledscores_goal_alert_before_s141_live_match_v1(uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer)'::regprocedure
  ) into save_definition;
  if position('pg_column_size(p_config) > 65536' in save_definition) = 0
    or position('cardinality(normalized_assets) > 10' in save_definition) = 0 then
    raise exception 'S142 cannot safely patch the expected LED Scores save limits';
  end if;
  save_definition := replace(
    save_definition,
    'pg_column_size(p_config) > 65536',
    'pg_column_size(p_config) > 250000'
  );
  save_definition := replace(
    save_definition,
    'cardinality(normalized_assets) > 10',
    'cardinality(normalized_assets) > 24'
  );
  execute save_definition;
end;
$$;

-- A reconnect may still carry a valid, unexpired delivery for immutable
-- version A after version B became current. Keep both versions in the bounded
-- bootstrap so catch-up renders the exact published canvas and assets. A
-- pending delivery is authoritative for its frozen version even when the
-- mutable alert is paused or the screen is retargeted before reconnect.
create or replace function public.get_ledscores_player_bootstrap_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
  configs jsonb;
  pending_deliveries jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid player credential' using errcode = '22023';
  end if;
  select * into device_record
  from public.player_devices device
  where device.token_hash = p_token_hash and device.status = 'paired';
  if not found then
    return jsonb_build_object('authorized', false);
  end if;
  if not private.ledscores_feature_enabled(device_record.tenant_id) then
    return jsonb_build_object(
      'authorized', true, 'enabled', false,
      'tenantId', device_record.tenant_id,
      'screenId', device_record.screen_id,
      'deviceId', device_record.id,
      'configs', '[]'::jsonb
    );
  end if;

  with candidate_versions as (
    select
      version.id,
      version.tenant_id,
      version.alert_id,
      version.checksum_sha256,
      version.priority,
      version.duration_ms,
      version.underlay_policy,
      version.config_snapshot,
      false as pending_catchup
    from public.ledscores_goal_alerts alert
    join public.ledscores_goal_alert_versions version
      on version.tenant_id = alert.tenant_id
      and version.id = alert.current_published_version_id
    join public.ledscores_goal_alert_version_groups target
      on target.tenant_id = version.tenant_id
      and target.alert_version_id = version.id
    join public.screen_group_memberships membership
      on membership.tenant_id = target.tenant_id
      and membership.screen_group_id = target.screen_group_id
      and membership.screen_id = device_record.screen_id
    where alert.tenant_id = device_record.tenant_id
      and alert.status = 'published'

    union all

    select
      version.id,
      version.tenant_id,
      version.alert_id,
      version.checksum_sha256,
      version.priority,
      version.duration_ms,
      version.underlay_policy,
      version.config_snapshot,
      true as pending_catchup
    from public.ledscores_player_deliveries pending
    join public.ledscores_goal_alert_versions version
      on version.tenant_id = pending.tenant_id
      and version.id = pending.alert_version_id
    where pending.tenant_id = device_record.tenant_id
      and pending.screen_id = device_record.screen_id
      and pending.message_kind in ('goal','match_overlay')
      and pending.status in ('pending','received')
      and pending.expires_at > clock_timestamp()
  ), selected_versions as (
    select distinct on (candidate.id) candidate.*
    from candidate_versions candidate
    order by candidate.id, candidate.pending_catchup desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'alertId', version.alert_id,
        'alertVersionId', version.id,
        'checksum', version.checksum_sha256,
        'priority', version.priority,
        'durationMs', version.duration_ms,
        'underlayPolicy', version.underlay_policy,
        'config', version.config_snapshot,
        'assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'mediaAssetId', asset.media_asset_id,
            'bucket', asset.storage_bucket,
            'path', asset.storage_path,
            'mimeType', asset.mime_type,
            'checksum', asset.checksum_sha256
          ) order by asset.media_asset_id)
          from public.ledscores_goal_alert_version_assets asset
          where asset.tenant_id = version.tenant_id
            and asset.alert_version_id = version.id
        ), '[]'::jsonb)
      ) order by version.pending_catchup desc, version.priority desc
    ),
    '[]'::jsonb
  ) into configs
  from selected_versions version;

  select coalesce(jsonb_agg(delivery_payload order by execute_at), '[]'::jsonb)
  into pending_deliveries
  from (
    select
      delivery.execute_at,
      jsonb_build_object(
        'id', delivery.id,
        'screen_id', delivery.screen_id,
        'message_kind', delivery.message_kind,
        'alert_version_id', delivery.alert_version_id,
        'payload', delivery.payload,
        'execute_at', delivery.execute_at,
        'expires_at', delivery.expires_at
      ) as delivery_payload
    from public.ledscores_player_deliveries delivery
    where delivery.tenant_id = device_record.tenant_id
      and delivery.screen_id = device_record.screen_id
      and delivery.message_kind = 'goal'
      and delivery.status in ('pending', 'received')
      and delivery.expires_at > clock_timestamp()
    order by delivery.execute_at desc
    limit 1
  ) latest_delivery;

  return jsonb_build_object(
    'authorized', true,
    'enabled', true,
    'tenantId', device_record.tenant_id,
    'screenId', device_record.screen_id,
    'deviceId', device_record.id,
    'configs', configs,
    'pendingDeliveries', pending_deliveries
  );
end;
$$;

create or replace function private.ledscores_canvas_has_exact_keys_v1(
  p_value jsonb,
  p_keys text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) <> 'object' then false
    else coalesce(
      array(select key from jsonb_object_keys(p_value) key order by key),
      '{}'::text[]
    ) = coalesce(
      array(select key from unnest(p_keys) key order by key),
      '{}'::text[]
    )
  end;
$$;

create or replace function private.ledscores_canvas_number_between_v1(
  p_value jsonb,
  p_min numeric,
  p_max numeric
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) <> 'number' then return false; end if;
  return (p_value #>> '{}')::numeric between p_min and p_max;
exception when numeric_value_out_of_range or invalid_text_representation then
  return false;
end;
$$;

create or replace function private.ledscores_canvas_integer_between_v1(
  p_value jsonb,
  p_min integer,
  p_max integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  value_text text;
begin
  if jsonb_typeof(p_value) <> 'number' then return false; end if;
  value_text := p_value #>> '{}';
  if value_text !~ '^-?[0-9]+$' then return false; end if;
  return value_text::integer between p_min and p_max;
exception when numeric_value_out_of_range or invalid_text_representation then
  return false;
end;
$$;

create or replace function private.ledscores_canvas_color_v1(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'string'
    and (p_value #>> '{}') ~* '^#[0-9a-f]{6}([0-9a-f]{2})?$';
$$;

revoke all on function private.ledscores_canvas_has_exact_keys_v1(jsonb,text[])
  from public, anon, authenticated;
revoke all on function private.ledscores_canvas_number_between_v1(jsonb,numeric,numeric)
  from public, anon, authenticated;
revoke all on function private.ledscores_canvas_integer_between_v1(jsonb,integer,integer)
  from public, anon, authenticated;
revoke all on function private.ledscores_canvas_color_v1(jsonb)
  from public, anon, authenticated;

create or replace function private.validate_ledscores_canvas_config_v1(
  p_tenant_id uuid,
  p_config jsonb,
  p_asset_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  experience jsonb := p_config -> 'canvasExperience';
  scenes jsonb;
  pair jsonb;
  scene jsonb;
  background jsonb;
  layer jsonb;
  moment_key text;
  orientation_key text;
  layer_type text;
  layer_index integer;
  layer_ids text[];
  layer_z_indexes integer[];
  canvas_asset_ids uuid[] := '{}'::uuid[];
  canvas_image_asset_ids uuid[] := '{}'::uuid[];
  canvas_background_asset_ids uuid[] := '{}'::uuid[];
  referenced_asset_ids uuid[] := '{}'::uuid[];
  normalized_asset_ids uuid[] := array(
    select distinct value
    from unnest(coalesce(p_asset_ids,'{}'::uuid[])) value
    order by value
  );
  config_key text;
  asset_text text;
begin
  -- Legacy published configurations remain valid and use the old renderer.
  if experience is null then return; end if;

  if not private.ledscores_canvas_has_exact_keys_v1(
      experience,array['schemaVersion','scenes']::text[]
    )
    or experience ->> 'schemaVersion' <> '1' then
    raise exception 'invalid LED Scores canvas experience' using errcode = '23514';
  end if;
  scenes := experience -> 'scenes';
  if not private.ledscores_canvas_has_exact_keys_v1(
    scenes,array[
      'goalOwn','goalOpponent','goalUnknown','lineupHome','lineupAway',
      'matchStart','halfTime','matchEnd'
    ]::text[]
  ) then
    raise exception 'invalid LED Scores canvas moments' using errcode = '23514';
  end if;

  foreach moment_key in array array[
    'goalOwn','goalOpponent','goalUnknown','lineupHome','lineupAway',
    'matchStart','halfTime','matchEnd'
  ]::text[] loop
    pair := scenes -> moment_key;
    if not private.ledscores_canvas_has_exact_keys_v1(
      pair,array['landscape','portrait']::text[]
    ) then
      raise exception 'LED Scores canvas requires both orientations' using errcode = '23514';
    end if;

    foreach orientation_key in array array['landscape','portrait']::text[] loop
      scene := pair -> orientation_key;
      if not private.ledscores_canvas_has_exact_keys_v1(
          scene,array['background','layers','orientation']::text[]
        )
        or scene ->> 'orientation' is distinct from orientation_key
        or jsonb_typeof(scene -> 'layers') <> 'array'
        or jsonb_array_length(scene -> 'layers') > 16 then
        raise exception 'invalid LED Scores canvas scene' using errcode = '23514';
      end if;

      background := scene -> 'background';
      if background ->> 'kind' = 'solid' then
        if not private.ledscores_canvas_has_exact_keys_v1(
            background,array['color','kind']::text[]
          ) or not private.ledscores_canvas_color_v1(background -> 'color') then
          raise exception 'invalid LED Scores canvas background' using errcode = '23514';
        end if;
      elsif background ->> 'kind' = 'gradient' then
        if not private.ledscores_canvas_has_exact_keys_v1(
            background,array['angle','from','kind','to']::text[]
          )
          or not private.ledscores_canvas_number_between_v1(background -> 'angle',0,360)
          or not private.ledscores_canvas_color_v1(background -> 'from')
          or not private.ledscores_canvas_color_v1(background -> 'to') then
          raise exception 'invalid LED Scores canvas background' using errcode = '23514';
        end if;
      elsif background ->> 'kind' = 'media' then
        if not private.ledscores_canvas_has_exact_keys_v1(
            background,array[
              'focusX','focusY','kind','mediaAssetId','objectFit',
              'overlayColor','overlayOpacity'
            ]::text[]
          )
          or coalesce(background ->> 'mediaAssetId','') !~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or background ->> 'objectFit' not in ('cover','contain')
          or not private.ledscores_canvas_number_between_v1(background -> 'focusX',0,1)
          or not private.ledscores_canvas_number_between_v1(background -> 'focusY',0,1)
          or not private.ledscores_canvas_color_v1(background -> 'overlayColor')
          or not private.ledscores_canvas_number_between_v1(background -> 'overlayOpacity',0,1) then
          raise exception 'invalid LED Scores canvas media background' using errcode = '23514';
        end if;
        canvas_asset_ids := array_append(canvas_asset_ids,(background ->> 'mediaAssetId')::uuid);
        canvas_background_asset_ids := array_append(
          canvas_background_asset_ids,(background ->> 'mediaAssetId')::uuid
        );
      else
        raise exception 'invalid LED Scores canvas background' using errcode = '23514';
      end if;

      layer_ids := '{}'::text[];
      layer_z_indexes := '{}'::integer[];
      layer_index := 0;
      for layer in select value from jsonb_array_elements(scene -> 'layers') loop
        layer_index := layer_index + 1;
        layer_type := layer ->> 'type';
        if jsonb_typeof(layer) <> 'object'
          or coalesce(layer ->> 'id','') !~ '^[a-z][a-z0-9-]{0,63}$'
          or length(btrim(coalesce(layer ->> 'name',''))) not between 1 and 80
          or layer ->> 'animation' not in ('none','fade','rise','zoom','wipe')
          or jsonb_typeof(layer -> 'locked') <> 'boolean'
          or jsonb_typeof(layer -> 'visible') <> 'boolean'
          or not private.ledscores_canvas_number_between_v1(layer -> 'height',8,3840)
          or not private.ledscores_canvas_number_between_v1(layer -> 'width',8,3840)
          or not private.ledscores_canvas_number_between_v1(layer -> 'x',-1920,3840)
          or not private.ledscores_canvas_number_between_v1(layer -> 'y',-1920,3840)
          or (
            orientation_key = 'landscape'
            and not private.ledscores_canvas_number_between_v1(
              layer -> 'y',-1080,2160
            )
          )
          or (
            orientation_key = 'portrait'
            and not private.ledscores_canvas_number_between_v1(
              layer -> 'x',-1080,2160
            )
          )
          or not private.ledscores_canvas_number_between_v1(layer -> 'opacity',0,1)
          or not private.ledscores_canvas_number_between_v1(layer -> 'rotation',-180,180)
          or not private.ledscores_canvas_integer_between_v1(layer -> 'zIndex',0,15)
          or (layer ->> 'id') = any(layer_ids)
          or (layer ->> 'zIndex')::integer = any(layer_z_indexes) then
          raise exception 'invalid or duplicate LED Scores canvas layer' using errcode = '23514';
        end if;
        layer_ids := array_append(layer_ids,layer ->> 'id');
        layer_z_indexes := array_append(layer_z_indexes,(layer ->> 'zIndex')::integer);

        if layer_type = 'text' then
          if not private.ledscores_canvas_has_exact_keys_v1(layer,array[
              'align','animation','backgroundColor','binding','cornerRadius',
              'fill','fontFamily','fontSize','fontWeight','height','id',
              'letterSpacing','lineHeight','locked','name','opacity','padding',
              'rotation','text','type','verticalAlign','visible','width','x','y','zIndex'
            ]::text[])
            or layer ->> 'align' not in ('left','center','right')
            or layer ->> 'fontFamily' not in ('Inter','Inter Tight')
            or not private.ledscores_canvas_integer_between_v1(layer -> 'fontWeight',400,900)
            or (layer ->> 'fontWeight')::integer not in (400,500,600,700,800,900)
            or not private.ledscores_canvas_number_between_v1(layer -> 'fontSize',16,360)
            or not private.ledscores_canvas_number_between_v1(layer -> 'letterSpacing',-10,40)
            or not private.ledscores_canvas_number_between_v1(layer -> 'lineHeight',0.8,2)
            or not private.ledscores_canvas_number_between_v1(layer -> 'padding',0,160)
            or not private.ledscores_canvas_number_between_v1(layer -> 'cornerRadius',0,240)
            or not private.ledscores_canvas_color_v1(layer -> 'fill')
            or not (
              layer -> 'backgroundColor' = 'null'::jsonb
              or private.ledscores_canvas_color_v1(layer -> 'backgroundColor')
            )
            or layer ->> 'verticalAlign' not in ('top','middle','bottom')
            or length(coalesce(layer ->> 'text','')) > 240
            or not (
              layer -> 'binding' = 'null'::jsonb
              or layer ->> 'binding' in (
                'headline','secondaryText','homeTeam','awayTeam','homeScore',
                'awayScore','score','previousScore','clock','period','scoringTeam',
                'scorerName','scorerNumber','eventLabel'
              )
            )
            or (
              layer -> 'binding' = 'null'::jsonb
              and length(btrim(coalesce(layer ->> 'text',''))) = 0
            ) then
            raise exception 'invalid LED Scores canvas text layer' using errcode = '23514';
          end if;
        elsif layer_type = 'image' then
          if not private.ledscores_canvas_has_exact_keys_v1(layer,array[
              'animation','binding','cornerRadius','focusX','focusY','height','id',
              'locked','mediaAssetId','name','objectFit','opacity','rotation','type',
              'visible','width','x','y','zIndex'
            ]::text[])
            or layer ->> 'objectFit' not in ('cover','contain')
            or not private.ledscores_canvas_number_between_v1(layer -> 'cornerRadius',0,960)
            or not private.ledscores_canvas_number_between_v1(layer -> 'focusX',0,1)
            or not private.ledscores_canvas_number_between_v1(layer -> 'focusY',0,1)
            or not (
              layer -> 'binding' = 'null'::jsonb
              or layer ->> 'binding' in ('scorerPhoto','homeLogo','awayLogo','scoringTeamLogo')
            )
            or not (
              layer -> 'mediaAssetId' = 'null'::jsonb
              or coalesce(layer ->> 'mediaAssetId','') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            )
            or ((layer -> 'binding') = 'null'::jsonb) = ((layer -> 'mediaAssetId') = 'null'::jsonb) then
            raise exception 'invalid LED Scores canvas image layer' using errcode = '23514';
          end if;
          if layer -> 'mediaAssetId' <> 'null'::jsonb then
            canvas_asset_ids := array_append(canvas_asset_ids,(layer ->> 'mediaAssetId')::uuid);
            canvas_image_asset_ids := array_append(
              canvas_image_asset_ids,(layer ->> 'mediaAssetId')::uuid
            );
          end if;
        elsif layer_type = 'shape' then
          if not private.ledscores_canvas_has_exact_keys_v1(layer,array[
              'animation','cornerRadius','fill','height','id','locked','name',
              'opacity','rotation','shape','stroke','strokeWidth','type','visible',
              'width','x','y','zIndex'
            ]::text[])
            or layer ->> 'shape' not in ('rectangle','ellipse','line')
            or not private.ledscores_canvas_number_between_v1(layer -> 'cornerRadius',0,960)
            or not private.ledscores_canvas_number_between_v1(layer -> 'strokeWidth',0,32)
            or not private.ledscores_canvas_color_v1(layer -> 'fill')
            or not (
              layer -> 'stroke' = 'null'::jsonb
              or private.ledscores_canvas_color_v1(layer -> 'stroke')
            ) then
            raise exception 'invalid LED Scores canvas shape layer' using errcode = '23514';
          end if;
        elsif layer_type = 'lineup' then
          if not private.ledscores_canvas_has_exact_keys_v1(layer,array[
              'accentColor','animation','cardColor','columns','gap','height','id',
              'locked','name','opacity','rotation','showName','showNumber',
              'showPhoto','textColor','type','visible','width','x','y','zIndex'
            ]::text[])
            or not private.ledscores_canvas_color_v1(layer -> 'accentColor')
            or not private.ledscores_canvas_color_v1(layer -> 'cardColor')
            or not private.ledscores_canvas_color_v1(layer -> 'textColor')
            or not private.ledscores_canvas_integer_between_v1(layer -> 'columns',1,6)
            or not private.ledscores_canvas_number_between_v1(layer -> 'gap',0,96)
            or jsonb_typeof(layer -> 'showName') <> 'boolean'
            or jsonb_typeof(layer -> 'showNumber') <> 'boolean'
            or jsonb_typeof(layer -> 'showPhoto') <> 'boolean' then
            raise exception 'invalid LED Scores canvas lineup layer' using errcode = '23514';
          end if;
        else
          raise exception 'unsupported LED Scores canvas layer' using errcode = '23514';
        end if;
      end loop;
    end loop;
  end loop;

  referenced_asset_ids := canvas_asset_ids;
  foreach config_key in array array[
    'logoMediaAssetId','ownMediaAssetId','opponentMediaAssetId','unknownMediaAssetId',
    'ownSoundMediaAssetId','opponentSoundMediaAssetId','sponsorMediaAssetId'
  ]::text[] loop
    asset_text := nullif(p_config ->> config_key,'');
    if asset_text is not null then
      if asset_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'invalid LED Scores media reference' using errcode = '23514';
      end if;
      referenced_asset_ids := array_append(referenced_asset_ids,asset_text::uuid);
    end if;
  end loop;
  referenced_asset_ids := array(
    select distinct value from unnest(referenced_asset_ids) value order by value
  );
  if referenced_asset_ids is distinct from normalized_asset_ids then
    raise exception 'LED Scores asset manifest must exactly match the canvas configuration'
      using errcode = '23514';
  end if;

  canvas_image_asset_ids := array(
    select distinct value from unnest(canvas_image_asset_ids) value order by value
  );
  if (
    select count(*) from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = any(canvas_image_asset_ids)
      and asset.kind::text = 'image'
      and asset.mime_type::text in ('image/jpeg','image/png','image/webp')
      and asset.status::text = 'ready'
      and asset.deleted_at is null
      and asset.checksum_sha256 is not null
  ) <> cardinality(canvas_image_asset_ids) then
    raise exception 'LED Scores canvas image must be a ready tenant image'
      using errcode = '23514';
  end if;

  canvas_background_asset_ids := array(
    select distinct value from unnest(canvas_background_asset_ids) value order by value
  );
  if (
    select count(*) from public.media_assets asset
    where asset.tenant_id = p_tenant_id
      and asset.id = any(canvas_background_asset_ids)
      and asset.status::text = 'ready'
      and asset.deleted_at is null
      and asset.checksum_sha256 is not null
      and (
        (
          asset.kind::text = 'image'
          and asset.mime_type::text in ('image/jpeg','image/png','image/webp')
        )
        or (
          asset.kind::text = 'video'
          and exists (
            select 1 from public.media_variants variant
            where variant.tenant_id = asset.tenant_id
              and variant.asset_id = asset.id
              and variant.variant_type::text = 'player_1080p'
              and variant.mime_type::text = 'video/mp4'
              and variant.checksum_sha256 is not null
          )
        )
      )
  ) <> cardinality(canvas_background_asset_ids) then
    raise exception 'LED Scores canvas background must be a player-ready image or video'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.validate_ledscores_canvas_config_v1(uuid,jsonb,uuid[])
  from public, anon, authenticated;

alter function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) rename to save_ledscores_goal_alert_before_s142_canvas_v1;
revoke all on function public.save_ledscores_goal_alert_before_s142_canvas_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) from public, anon, authenticated, service_role;

create or replace function public.save_ledscores_goal_alert_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_connection_id uuid,
  p_name text,
  p_priority integer,
  p_duration_ms integer,
  p_underlay_policy text,
  p_config jsonb,
  p_target_group_ids uuid[],
  p_asset_ids uuid[],
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ledscores_capability(
    p_tenant_id,'tenant.dynamic_slide.write'
  );
  perform private.validate_ledscores_canvas_config_v1(
    p_tenant_id,p_config,p_asset_ids
  );
  return public.save_ledscores_goal_alert_before_s142_canvas_v1(
    p_tenant_id,p_alert_id,p_connection_id,p_name,p_priority,p_duration_ms,
    p_underlay_policy,p_config,p_target_group_ids,p_asset_ids,p_expected_revision
  );
end;
$$;
revoke all on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) from public, anon;
grant execute on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) to authenticated, service_role;

-- Revalidate the current draft at the publish boundary as well. This closes the
-- gap for drafts created before this migration or repaired through operations.
alter function public.publish_ledscores_goal_alert_v1(
  uuid,uuid,integer,uuid
) rename to publish_ledscores_goal_alert_before_s142_canvas_v1;
revoke all on function public.publish_ledscores_goal_alert_before_s142_canvas_v1(
  uuid,uuid,integer,uuid
) from public, anon, authenticated, service_role;

create or replace function public.publish_ledscores_goal_alert_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_expected_revision integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_config jsonb;
  draft_asset_ids uuid[];
begin
  perform private.require_ledscores_capability(
    p_tenant_id,'tenant.dynamic_slide.write'
  );
  select alert.draft_config into draft_config
  from public.ledscores_goal_alerts alert
  where alert.tenant_id = p_tenant_id and alert.id = p_alert_id;
  if not found then
    raise exception 'LED Scores goal alert not found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(asset.media_asset_id order by asset.media_asset_id),'{}'::uuid[])
  into draft_asset_ids
  from public.ledscores_goal_alert_draft_assets asset
  where asset.tenant_id = p_tenant_id and asset.alert_id = p_alert_id;
  perform private.validate_ledscores_canvas_config_v1(
    p_tenant_id,draft_config,draft_asset_ids
  );
  return public.publish_ledscores_goal_alert_before_s142_canvas_v1(
    p_tenant_id,p_alert_id,p_expected_revision,p_idempotency_key
  );
end;
$$;
revoke all on function public.publish_ledscores_goal_alert_v1(
  uuid,uuid,integer,uuid
) from public, anon;
grant execute on function public.publish_ledscores_goal_alert_v1(
  uuid,uuid,integer,uuid
) to authenticated, service_role;
