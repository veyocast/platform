-- Editorial Arena price list: reuse the tenant product catalogue, store typed
-- placements in dynamic_slides.configuration_json and resolve immutable snapshots.
-- No new tenant table is introduced; existing tenant_products RLS remains the
-- authoritative catalogue boundary.

alter table public.dynamic_templates
  drop constraint dynamic_templates_category_check;
alter table public.dynamic_templates
  add constraint dynamic_templates_category_check
  check (category in ('menu', 'news', 'sports', 'price_list'));

alter table public.dynamic_templates
  drop constraint dynamic_templates_slide_type_check;
alter table public.dynamic_templates
  add constraint dynamic_templates_slide_type_check check (
    slide_type in (
      'menu','price_list','news','sport_program','sport_results','sport_standing',
      'sport_period_standing','sport_match_of_the_day','sport_next_match',
      'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
      'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
      'sport_birthdays'
    )
  );

alter table public.dynamic_slides
  drop constraint dynamic_slides_slide_type_check;
alter table public.dynamic_slides
  add constraint dynamic_slides_slide_type_check check (
    slide_type in (
      'menu','price_list','news','sport_program','sport_results','sport_standing',
      'sport_period_standing','sport_match_of_the_day','sport_next_match',
      'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
      'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
      'sport_birthdays'
    )
  );

create or replace function private.validate_price_list_configuration_v1(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_configuration jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  section jsonb;
  product jsonb;
  seen_placement_ids text[] := '{}';
  seen_product_ids uuid[] := '{}';
  product_id uuid;
  image_override_id uuid;
  placement_count integer := 0;
  visible_product_count integer := 0;
begin
  if jsonb_typeof(p_configuration) <> 'object'
    or jsonb_typeof(p_configuration -> 'sections') <> 'array'
    or jsonb_array_length(p_configuration -> 'sections') not between 1 and 40
    or p_configuration ->> 'slidePhotoMode' not in ('show', 'hide')
    or length(btrim(coalesce(p_configuration ->> 'title', ''))) not between 1 and 160
    or octet_length(p_configuration::text) > 131072
  then
    raise exception 'price list configuration is invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.dynamic_data_sources source
    where source.id = p_data_source_id
      and source.tenant_id = p_tenant_id
      and source.kind in ('manual_products', 'twelve_excel')
      and source.status = 'active'
  ) then
    raise exception 'price list source is unavailable' using errcode = '23514';
  end if;

  for section in select value from jsonb_array_elements(p_configuration -> 'sections')
  loop
    if jsonb_typeof(section) <> 'object'
      or coalesce(section ->> 'id', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or section ->> 'column' not in ('left', 'right')
      or section ->> 'photoMode' not in ('inherit', 'show', 'hide')
      or coalesce(section ->> 'categoryId', '') = ''
      or length(section ->> 'categoryId') > 200
      or coalesce(section ->> 'order', '') !~ '^[0-9]{1,6}$'
      or jsonb_typeof(section -> 'products') <> 'array'
      or jsonb_array_length(section -> 'products') not between 1 and 100
      or section ->> 'id' = any(seen_placement_ids)
    then
      raise exception 'price list section is invalid' using errcode = '22023';
    end if;
    seen_placement_ids := array_append(seen_placement_ids, section ->> 'id');

    for product in select value from jsonb_array_elements(section -> 'products')
    loop
      placement_count := placement_count + 1;
      if placement_count > 200 then
        raise exception 'price list exceeds the 200 product safety limit'
          using errcode = '22023';
      end if;
      if jsonb_typeof(product) <> 'object'
        or coalesce(product ->> 'id', '') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(product ->> 'productId', '') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or product ->> 'id' = any(seen_placement_ids)
        or jsonb_typeof(product -> 'visible') <> 'boolean'
        or coalesce(product ->> 'order', '') !~ '^[0-9]{1,6}$'
      then
        raise exception 'price list product placement is invalid'
          using errcode = '22023';
      end if;
      seen_placement_ids := array_append(seen_placement_ids, product ->> 'id');
      product_id := (product ->> 'productId')::uuid;
      if (product ->> 'visible')::boolean then
        if product_id = any(seen_product_ids) then
          raise exception 'price list product is placed more than once'
            using errcode = '23505';
        end if;
        seen_product_ids := array_append(seen_product_ids, product_id);
        visible_product_count := visible_product_count + 1;
      end if;
      if nullif(product ->> 'imageAssetIdOverride', '') is not null then
        image_override_id := (product ->> 'imageAssetIdOverride')::uuid;
        if not exists (
          select 1 from public.media_assets asset
          where asset.id = image_override_id
            and asset.tenant_id = p_tenant_id
            and asset.kind = 'image'::public.media_asset_kind
            and asset.status = 'ready'::public.media_asset_status
        ) then
          raise exception 'price list image override is unavailable'
            using errcode = '23514';
        end if;
      end if;
      if not exists (
        select 1 from public.tenant_products catalogue
        where catalogue.id = product_id
          and catalogue.tenant_id = p_tenant_id
          and catalogue.active
          and catalogue.available
          and (
            catalogue.data_source_id = p_data_source_id
            or catalogue.data_source_id is null
          )
          and coalesce(catalogue.category, 'Overig') = section ->> 'categoryId'
      ) then
        raise exception 'price list product is unavailable'
          using errcode = '23514';
      end if;
    end loop;
  end loop;

  if visible_product_count < 1 then
    raise exception 'price list has no visible products' using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.validate_price_list_configuration_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated;

-- Source synchronization may continue even if an administrator removed a
-- selected catalogue item. Skip only the now-invalid price list and preserve
-- its last-ready snapshot; other dynamic slides still refresh normally.
create or replace function private.queue_latest_dynamic_snapshots_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_slide_types text[] default null,
  p_reason text default 'source_content_changed'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  content_hash text;
  new_snapshot_id uuid;
  queued_count integer := 0;
begin
  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id
      and slide.data_source_id = p_data_source_id
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
      and (p_slide_types is null or slide.slide_type = any(p_slide_types))
    order by slide.id
  loop
    if slide_record.slide_type = 'price_list' then
      begin
        perform private.validate_price_list_configuration_v1(
          slide_record.tenant_id,
          slide_record.data_source_id,
          slide_record.configuration_json
        );
      exception when check_violation then
        update public.dynamic_slides
        set last_error_code = 'PRICE_LIST_CONFIGURATION_STALE'
        where id = slide_record.id;
        continue;
      end;
    end if;

    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(slide_record, snapshot_data);
    new_snapshot_id := null;

    if exists (
      select 1
      from public.dynamic_slide_snapshots current_snapshot
      where current_snapshot.id = slide_record.current_snapshot_id
        and current_snapshot.dynamic_slide_id = slide_record.id
        and current_snapshot.template_version_id = slide_record.template_version_id
        and private.dynamic_snapshot_content_hash_v1(
          slide_record, current_snapshot.snapshot_data_json
        ) = content_hash
    ) then
      continue;
    end if;

    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json
    ) values (
      slide_record.tenant_id, slide_record.id, slide_record.template_version_id,
      slide_record.data_source_id, content_hash, snapshot_data
    )
    on conflict (dynamic_slide_id, source_revision_hash, template_version_id)
    do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
      update public.dynamic_slides
      set status = 'rendering', last_error_code = null
      where id = slide_record.id;
      queued_count := queued_count + 1;
    end if;
  end loop;

  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      p_tenant_id, 'dynamic.snapshot.auto_queued',
      'dynamic_data_sources', p_data_source_id, 'success',
      jsonb_build_object(
        'systemExecuted', true,
        'reason', left(coalesce(p_reason, 'source_content_changed'), 120),
        'queuedCount', queued_count
      )
    );
  end if;
  return queued_count;
end;
$$;

revoke all on function private.queue_latest_dynamic_snapshots_v2(
  uuid, uuid, text[], text
) from public, anon, authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_price_list_v1;

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
  resolved_sections jsonb;
  club_name text;
  club_logo_id uuid;
  primary_color text;
begin
  if p_slide.slide_type <> 'price_list' then
    return private.build_dynamic_snapshot_data_before_price_list_v1(p_slide);
  end if;

  select tenant.name into club_name
  from public.tenants tenant where tenant.id = p_slide.tenant_id;
  select coalesce(
    (select kit.logo_media_asset_id
     from public.studio_tenant_brand_kits kit
     where kit.tenant_id = p_slide.tenant_id),
    (select club.logo_media_asset_id
     from public.sports_clubs club
     where club.tenant_id = p_slide.tenant_id
       and club.active and club.logo_media_asset_id is not null
     order by club.last_synced_at desc, club.id limit 1)
  ) into club_logo_id;
  select settings.primary_color into primary_color
  from public.tenant_settings settings where settings.tenant_id = p_slide.tenant_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', source.section ->> 'id',
      'name', coalesce(
        nullif(source.section ->> 'categoryNameOverride', ''),
        source.section ->> 'categoryId'
      ),
      'column', source.section ->> 'column',
      'order', (source.section ->> 'order')::integer,
      'products', source.products
    )
    order by (source.section ->> 'order')::integer, source.section ->> 'id'
  ), '[]'::jsonb)
  into resolved_sections
  from (
    select section,
      (
        select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', placement ->> 'id',
          'productId', product.id,
          'name', coalesce(
            nullif(placement ->> 'nameOverride', ''),
            product.name
          ),
          'description', coalesce(
            nullif(placement ->> 'descriptionOverride', ''),
            product.description,
            ''
          ),
          'formattedPrice', '€ ' || replace(to_char(
            coalesce(
              nullif(placement ->> 'priceCentsOverride', '')::integer,
              product.price_cents,
              0
            ) / 100.0,
            'FM999999990.00'
          ), '.', ','),
          'photoVisible', (
            case section ->> 'photoMode'
              when 'show' then true
              when 'hide' then false
              else p_slide.configuration_json ->> 'slidePhotoMode' = 'show'
            end
          ),
          'imageMediaAssetId', case
            when (
              case section ->> 'photoMode'
                when 'show' then true
                when 'hide' then false
                else p_slide.configuration_json ->> 'slidePhotoMode' = 'show'
              end
            ) then coalesce(
              nullif(placement ->> 'imageAssetIdOverride', '')::uuid,
              product.image_media_asset_id
            )
            else null
          end,
          'imageFocalPoint', placement -> 'imageFocalPointOverride'
        )) order by (placement ->> 'order')::integer, placement ->> 'id'), '[]'::jsonb)
        from jsonb_array_elements(section -> 'products') placement
        join public.tenant_products product
          on product.id = (placement ->> 'productId')::uuid
         and product.tenant_id = p_slide.tenant_id
         and product.active and product.available
         and (
           product.data_source_id = p_slide.data_source_id
           or product.data_source_id is null
         )
        where coalesce((placement ->> 'visible')::boolean, false)
      ) products
    from jsonb_array_elements(
      coalesce(p_slide.configuration_json -> 'sections', '[]'::jsonb)
    ) section
  ) source
  where jsonb_array_length(source.products) > 0;

  result := jsonb_build_object(
    'type', 'price_list',
    'priceList', jsonb_build_object(
      'title', coalesce(
        nullif(p_slide.configuration_json ->> 'title', ''),
        p_slide.name
      ),
      'slidePhotoMode', p_slide.configuration_json ->> 'slidePhotoMode',
      'sections', resolved_sections,
      'generatedAt', now()
    ),
    'brand', jsonb_strip_nulls(jsonb_build_object(
      'clubName', club_name,
      'logoMediaAssetId', club_logo_id,
      'primaryColor', coalesce(primary_color, '#FF5C20')
    ))
  );
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_price_list_v1(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function private.dynamic_snapshot_content_hash_v1(
  p_slide public.dynamic_slides,
  p_snapshot_data jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'templateVersionId', p_slide.template_version_id,
          'configuration', p_slide.configuration_json,
          'data',
            coalesce(p_snapshot_data, '{}'::jsonb)
              #- '{menu,generatedAt}'
              #- '{news,generatedAt}'
              #- '{sport,generatedAt}'
              #- '{priceList,generatedAt}'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function private.dynamic_snapshot_content_hash_v1(
  public.dynamic_slides,
  jsonb
) from public, anon, authenticated;

alter function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) rename to create_dynamic_slide_before_price_list_v1;

create or replace function public.create_dynamic_slide_v1(
  p_tenant_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_selection_mode text default 'latest',
  p_configuration_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_slide_type text;
begin
  select template.slide_type into selected_slide_type
  from public.dynamic_template_versions version
  join public.dynamic_templates template on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published'
    and template.current_published_version_id = version.id;

  if selected_slide_type = 'price_list' then
    perform private.validate_price_list_configuration_v1(
      p_tenant_id, p_data_source_id, p_configuration_json
    );
  end if;
  return public.create_dynamic_slide_before_price_list_v1(
    p_tenant_id, p_name, p_template_version_id, p_data_source_id,
    p_selection_mode, p_configuration_json
  );
end;
$$;

revoke all on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) from public, anon;
grant execute on function public.create_dynamic_slide_v1(
  uuid, text, uuid, uuid, text, jsonb
) to authenticated, service_role;

-- Validate live catalogue references before refresh. When a configured
-- product disappears, the ready snapshot remains the last-valid version.
alter function public.refresh_dynamic_slide_v1(uuid)
  rename to refresh_dynamic_slide_before_price_list_v1;

create or replace function public.refresh_dynamic_slide_v1(
  p_slide_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide_record public.dynamic_slides%rowtype;
begin
  select * into slide_record
  from public.dynamic_slides
  where id = p_slide_id
    and status <> 'archived';
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide_record.tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot refresh dynamic slide' using errcode = '42501';
  end if;
  if slide_record.slide_type = 'price_list' then
    perform private.validate_price_list_configuration_v1(
      slide_record.tenant_id,
      slide_record.data_source_id,
      slide_record.configuration_json
    );
  end if;
  return public.refresh_dynamic_slide_before_price_list_v1(p_slide_id);
end;
$$;

revoke all on function public.refresh_dynamic_slide_v1(uuid)
  from public, anon;
grant execute on function public.refresh_dynamic_slide_v1(uuid)
  to authenticated, service_role;
revoke all on function public.refresh_dynamic_slide_before_price_list_v1(uuid)
  from public, anon, authenticated;

-- Four locked fixed-canvas variants. Markup is the immutable PNG fallback;
-- the shared React renderer is authoritative for preview and HTML playback.
do $$
declare
  variant record;
  selected_template_id uuid;
  selected_version_id uuid;
  markup text;
  css text;
  manifest jsonb;
  sample jsonb;
  checksum text;
begin
  for variant in
    select * from (values ('landscape'), ('portrait')) shape(orientation)
    cross join (values ('dark'), ('light')) palette(mode)
  loop
    markup :=
      '<rect class="bg" width="100%" height="100%"/>' ||
      '<rect class="top" fill="{{brand.primaryColor}}" width="100%" height="8"/>' ||
      '<text class="title" x="156" y="126">{{priceList.title}}</text>' ||
      '<text class="hint" x="156" y="190">PRIJSLIJST · HTML/CSS</text>' ||
      '<g transform="translate(82 240)">{{#each priceList.sections}}' ||
      '<text class="category" fill="{{brand.primaryColor}}" x="0" y="0">{{truncate name "38"}}</text>' ||
      '{{#each products}}<text class="product" x="0" y="52">{{truncate name "38"}}</text>' ||
      '<text class="price" x="760" y="52" text-anchor="end">{{formattedPrice}}</text>{{/each}}{{/each}}</g>';
    css := case when variant.mode = 'dark' then
      '.bg{fill:#070a0e}.title,.product,.price{fill:#f3f0e9}.hint{fill:#9aa2ac}'
    else
      '.bg{fill:#f3f1ec}.title,.product,.price{fill:#17202a}.hint{fill:#6f7882}'
    end ||
      '.title{font:900 58px Arial}.hint{font:800 18px Arial;letter-spacing:3px}' ||
      '.category{font:900 28px Arial}.product{font:800 24px Arial}.price{font:900 28px Arial}';
    manifest := jsonb_build_object(
      'schemaVersion', 1,
      'engine', 'veyocast-safe-template-v1',
      'slideType', 'price_list',
      'canvas', jsonb_build_object(
        'width', case when variant.orientation = 'landscape' then 1920 else 1080 end,
        'height', case when variant.orientation = 'landscape' then 1080 else 1920 end
      ),
      'maxCollectionItems', 100,
      'allowedFields', jsonb_build_array(
        jsonb_build_object('path', 'brand.primaryColor', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.title', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.sections', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.sections.name', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.sections.products', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.sections.products.name', 'type', 'string', 'required', true),
        jsonb_build_object('path', 'priceList.sections.products.formattedPrice', 'type', 'string', 'required', true)
      )
    );
    sample := jsonb_build_object(
      'type', 'price_list',
      'brand', jsonb_build_object('primaryColor', '#FF5C20'),
      'priceList', jsonb_build_object(
        'title', 'Prijslijst',
        'sections', jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid(), 'name', 'Warme snacks',
          'column', 'left', 'order', 0,
          'products', jsonb_build_array(jsonb_build_object(
            'id', gen_random_uuid(), 'name', 'Clubburger',
            'description', 'Rundvlees · cheddar', 'formattedPrice', '€ 6,95'
          ))
        ))
      )
    );
    checksum := encode(extensions.digest(
      pg_catalog.convert_to(markup || css || manifest::text, 'UTF8'), 'sha256'
    ), 'hex');

    insert into public.dynamic_templates(
      slug, name, description, category, slide_type, orientation, status
    ) values (
      'editorial-arena-prijslijst-' || variant.mode || '-' || variant.orientation,
      'Prijslijst · ' ||
        case when variant.mode = 'dark' then 'donker' else 'licht' end || ' · ' ||
        case when variant.orientation = 'landscape' then 'liggend' else 'staand' end,
      'Editorial Arena HTML/CSS-prijslijst met twee vaste kolommen.',
      'price_list', 'price_list', variant.orientation, 'published'
    ) on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      slide_type = excluded.slide_type,
      orientation = excluded.orientation,
      status = 'published'
    returning id into selected_template_id;

    select v.id into selected_version_id from public.dynamic_template_versions v
    where v.template_id = selected_template_id and v.source_checksum_sha256 = checksum
    limit 1;
    if selected_version_id is null then
      insert into public.dynamic_template_versions(
        template_id, version, status, markup, css, manifest_json,
        sample_data_json, source_checksum_sha256, published_at
      ) values (
        selected_template_id,
        coalesce((select max(v.version) + 1 from public.dynamic_template_versions v
          where v.template_id = selected_template_id), 1),
        'published', markup, css, manifest, sample, checksum, now()
      ) returning id into selected_version_id;
    end if;
    update public.dynamic_templates
    set current_published_version_id = selected_version_id, status = 'published'
    where id = selected_template_id;
  end loop;
end;
$$;
