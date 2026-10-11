-- S191: typed Sites scene configuration, tenant asset identity and historical canvas guards.
-- Forward-only validator replacement: published versions are never rewritten.
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
          scene,array['background','layers','orientation']::text[] ||
            case when scene ? 'sitesConfiguration' then array['sitesConfiguration']::text[] else '{}'::text[] end
        )
        or scene ->> 'orientation' is distinct from orientation_key
        or jsonb_typeof(scene -> 'layers') <> 'array'
        or jsonb_array_length(scene -> 'layers') > 16 then
        raise exception 'invalid LED Scores canvas scene' using errcode = '23514';
      end if;

      -- The authored Sites scene is an explicit opt-in. Historical canvas layers
      -- and background validation below remain unchanged, including exact manifests.
      if scene ? 'sitesConfiguration' then
        if not private.sites_configuration_is_valid_v1(scene -> 'sitesConfiguration')
          or scene #>> '{sitesConfiguration,provider}' is distinct from 'led-scores'
          or scene #>> '{sitesConfiguration,orientation}' is distinct from orientation_key
          or coalesce((scene #>> '{sitesConfiguration,rowsPerPage}')::integer,0) > 8 then
          raise exception 'invalid LED Scores Sites scene' using errcode = '23514';
        end if;
        perform private.assert_sites_assets_v1(p_tenant_id, scene -> 'sitesConfiguration');
        canvas_asset_ids := canvas_asset_ids || array(
          select distinct (ref ->> 'mediaAssetId')::uuid
          from private.sites_asset_references_v1(scene -> 'sitesConfiguration') ref
          where ref ->> 'kind' = 'tenant'
        );
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
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
