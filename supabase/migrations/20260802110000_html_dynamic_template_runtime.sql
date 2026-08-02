-- S84: trusted HTML/CSS-first dynamic slides with an immutable PNG fallback.
-- Provider data still enters through normalized snapshots; no tenant-authored
-- markup or provider request is ever executed by a Player.

create or replace function private.queue_latest_dynamic_snapshots_after_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  revision_hash text;
  new_snapshot_id uuid;
  queued_count integer := 0;
begin
  if new.revision is not distinct from old.revision then
    return new;
  end if;

  for slide_record in
    select *
    from public.dynamic_slides slide
    where slide.tenant_id = new.tenant_id
      and slide.data_source_id = new.id
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
  loop
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    revision_hash := encode(extensions.digest(
      pg_catalog.convert_to(jsonb_build_object(
        'templateVersionId', slide_record.template_version_id,
        'configuration', slide_record.configuration_json,
        'data', snapshot_data
      )::text, 'UTF8'), 'sha256'
    ), 'hex');
    new_snapshot_id := null;

    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json
    ) values (
      slide_record.tenant_id, slide_record.id,
      slide_record.template_version_id, slide_record.data_source_id,
      revision_hash, snapshot_data
    )
    on conflict (
      dynamic_slide_id, source_revision_hash, template_version_id
    ) do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
      update public.dynamic_slides
      set status = 'rendering'
      where id = slide_record.id;
      queued_count := queued_count + 1;
    end if;
  end loop;

  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      new.tenant_id, 'dynamic.snapshot.auto_queued',
      'dynamic_data_sources', new.id, 'success',
      jsonb_build_object(
        'systemExecuted', true,
        'sourceKind', new.kind,
        'queuedCount', queued_count
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.queue_latest_dynamic_snapshots_after_sync()
  from public, anon, authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_html_runtime;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
  max_items integer := least(greatest(
    coalesce((p_slide.configuration_json ->> 'maxItems')::integer, 8),
    1
  ), 40);
  title text := coalesce(
    nullif(p_slide.configuration_json ->> 'title', ''),
    p_slide.name
  );
begin
  if p_slide.slide_type not in (
    'sport_team', 'sport_sponsor', 'sport_trainings',
    'sport_volunteers', 'sport_birthdays'
  ) then
    return private.build_dynamic_snapshot_data_before_html_runtime(p_slide);
  end if;

  if p_slide.slide_type in (
    'sport_team', 'sport_sponsor', 'sport_trainings'
  ) then
    select jsonb_build_object(
      'type', p_slide.slide_type,
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', team.external_id,
          'primary', case
            when p_slide.slide_type = 'sport_sponsor'
              then coalesce(nullif(team.metadata ->> 'sponsorName', ''), team.name)
            else team.name
          end,
          'secondary', case
            when p_slide.slide_type = 'sport_trainings'
              then coalesce(
                nullif(team.metadata ->> 'trainingSchedule', ''),
                team.competition_name,
                ''
              )
            else coalesce(team.competition_name, team.category, '')
          end,
          'meta', case
            when p_slide.slide_type = 'sport_sponsor'
              then coalesce(nullif(team.metadata ->> 'sponsorTagline', ''), team.name)
            else coalesce(team.team_type, team.category, '')
          end,
          'status', 'published'
        ) order by team.name), '[]'::jsonb),
        'emptyStateCode', case when count(*) = 0
          then 'DATASET_DISABLED_OR_EMPTY' else null end,
        'expiresAt', null
      )
    ) into result
    from (
      select team.*
      from public.sports_teams team
      join public.sportlink_connections connection
        on connection.id = team.source_connection_id
      where team.tenant_id = p_slide.tenant_id
        and connection.data_source_id = p_slide.data_source_id
        and team.active
        and (
          p_slide.slide_type <> 'sport_sponsor'
          or nullif(team.metadata ->> 'sponsorName', '') is not null
        )
      order by team.name
      limit max_items
    ) team;
  else
    select jsonb_build_object(
      'type', p_slide.slide_type,
      'sport', jsonb_build_object(
        'title', title,
        'generatedAt', now(),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', person.external_id,
          'primary', person.display_name,
          'secondary', coalesce(person.role, ''),
          'meta', case
            when p_slide.slide_type = 'sport_birthdays'
              then coalesce(nullif(person.metadata ->> 'birthdayLabel', ''), '')
            else coalesce(nullif(person.metadata ->> 'teamName', ''), '')
          end,
          'status', 'published'
        ) order by person.display_name), '[]'::jsonb),
        'emptyStateCode', case when count(*) = 0
          then 'DATASET_DISABLED_OR_EMPTY' else null end,
        'expiresAt', max(person.expires_at)
      )
    ) into result
    from (
      select person.*
      from public.sports_public_people person
      join public.sportlink_connections connection
        on connection.id = person.source_connection_id
      where person.tenant_id = p_slide.tenant_id
        and connection.data_source_id = p_slide.data_source_id
        and person.active
        and person.visibility_scope = 'public'
        and (person.expires_at is null or person.expires_at > now())
        and case
          when p_slide.slide_type = 'sport_birthdays'
            then connection.privacy_birthdays_enabled
          else connection.privacy_people_enabled
        end
      order by person.display_name
      limit max_items
    ) person;
  end if;

  return coalesce(result, jsonb_build_object(
    'type', p_slide.slide_type,
    'sport', jsonb_build_object(
      'title', title,
      'generatedAt', now(),
      'items', '[]'::jsonb,
      'emptyStateCode', 'DATASET_DISABLED_OR_EMPTY',
      'expiresAt', null
    )
  )) || jsonb_build_object(
    'brand',
    coalesce((
      select jsonb_build_object(
        'primaryColor', brand.primary_color,
        'secondaryColor', brand.secondary_color
      )
      from public.studio_tenant_brand_kits brand
      where brand.tenant_id = p_slide.tenant_id
    ), jsonb_build_object(
      'primaryColor', '#ff5a1f',
      'secondaryColor', '#111111'
    ))
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function private.refresh_product_sources_after_import()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'applied' and old.status is distinct from new.status then
    update public.dynamic_data_sources source
    set
      provider_status = 'ready',
      last_attempt_at = coalesce(new.applied_at, now()),
      last_successful_sync_at = coalesce(new.applied_at, now()),
      last_error_code = null,
      last_error_detail = null,
      revision = source.revision + 1
    where source.tenant_id = new.tenant_id
      and source.kind = 'twelve_excel'
      and source.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists product_import_refreshes_dynamic_sources
  on public.product_catalog_imports;
create trigger product_import_refreshes_dynamic_sources
after update of status on public.product_catalog_imports
for each row execute function private.refresh_product_sources_after_import();

revoke all on function private.refresh_product_sources_after_import()
  from public, anon, authenticated;

create or replace function private.refresh_sportlink_source_after_dataset_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'succeeded' and old.status is distinct from new.status then
    update public.dynamic_data_sources source
    set
      provider_status = 'ready',
      last_attempt_at = coalesce(new.finished_at, now()),
      last_successful_sync_at = coalesce(new.finished_at, now()),
      last_error_code = null,
      last_error_detail = null,
      revision = source.revision + 1
    from public.sportlink_connections connection
    where connection.id = new.connection_id
      and connection.tenant_id = new.tenant_id
      and source.id = connection.data_source_id
      and source.tenant_id = new.tenant_id
      and source.kind = 'sportlink'
      and source.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists sportlink_dataset_refreshes_dynamic_source
  on public.sportlink_sync_runs;
create trigger sportlink_dataset_refreshes_dynamic_source
after update of status on public.sportlink_sync_runs
for each row execute function private.refresh_sportlink_source_after_dataset_sync();

revoke all on function private.refresh_sportlink_source_after_dataset_sync()
  from public, anon, authenticated;

create or replace function private.refresh_bound_product_source()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  source_id uuid;
  source_tenant_id uuid;
begin
  source_id := case when tg_op = 'DELETE'
    then old.data_source_id else new.data_source_id end;
  source_tenant_id := case when tg_op = 'DELETE'
    then old.tenant_id else new.tenant_id end;
  if source_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  update public.dynamic_data_sources source
  set
    provider_status = 'ready',
    last_successful_sync_at = now(),
    last_error_code = null,
    last_error_detail = null,
    revision = source.revision + 1
  where source.id = source_id
    and source.tenant_id = source_tenant_id
    and source.kind in ('manual_products', 'twelve_excel')
    and source.status = 'active';
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tenant_products_refresh_bound_source
  on public.tenant_products;
create trigger tenant_products_refresh_bound_source
after insert or update or delete on public.tenant_products
for each row execute function private.refresh_bound_product_source();

revoke all on function private.refresh_bound_product_source()
  from public, anon, authenticated;

create or replace function private.follow_latest_dynamic_snapshot_in_drafts()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected_count integer := 0;
begin
  if old.status is distinct from 'ready'
    and new.status = 'ready'
    and new.output_media_asset_id is not null
  then
    with changed_items as (
      update public.playlist_items item
      set
        dynamic_snapshot_id = new.id,
        media_asset_id = new.output_media_asset_id,
        updated_at = now()
      where item.tenant_id = new.tenant_id
        and item.dynamic_slide_id = new.dynamic_slide_id
        and item.dynamic_selection_mode = 'latest'
      returning item.playlist_id
    ),
    changed_playlists as (
      select distinct playlist_id from changed_items
    )
    update public.playlists playlist
    set
      revision = playlist.revision + 1,
      updated_at = now()
    where playlist.tenant_id = new.tenant_id
      and playlist.id in (
        select changed.playlist_id from changed_playlists changed
      );
    get diagnostics affected_count = row_count;

    if affected_count > 0 then
      insert into public.audit_events(
        tenant_id, action, target_type, target_id, result, metadata
      ) values (
        new.tenant_id,
        'dynamic.draft_snapshot.followed',
        'dynamic_slide_snapshots',
        new.id,
        'success',
        jsonb_build_object(
          'systemExecuted', true,
          'playlistCount', affected_count,
          'dynamicSlideId', new.dynamic_slide_id
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dynamic_snapshot_updates_latest_drafts
  on public.dynamic_slide_snapshots;
create trigger dynamic_snapshot_updates_latest_drafts
after update of status on public.dynamic_slide_snapshots
for each row execute function private.follow_latest_dynamic_snapshot_in_drafts();

revoke all on function private.follow_latest_dynamic_snapshot_in_drafts()
  from public, anon, authenticated;

do $$
declare
  template_row record;
  template_id uuid;
  version_id uuid;
  source_markup text;
  source_css text;
  source_manifest jsonb;
  sample_data jsonb;
begin
  for template_row in
    select *
    from (
      select
        kind.slide_type,
        kind.label,
        kind.category,
        shape.orientation,
        palette.theme,
        kind.slide_type || '-' ||
          case when kind.slide_type = 'menu'
            then 'clubhouse' else 'newsroom' end ||
          '-' || palette.theme || '-' || shape.orientation as slug
      from (values
        ('menu', 'Clubhouse menu', 'menu'),
        ('news', 'Newsroom', 'news')
      ) as kind(slide_type, label, category)
      cross join (values ('landscape'), ('portrait')) as shape(orientation)
      cross join (values ('dark')) as palette(theme)

      union all

      select
        sport.slide_type,
        sport.label,
        'sports',
        shape.orientation,
        palette.theme,
        'sportlink-' || replace(
          replace(sport.slide_type, 'sport_', ''), '_', '-'
        ) || '-match-centre-' || palette.theme || '-' || shape.orientation
      from (values
        ('sport_program', 'Programma'),
        ('sport_results', 'Uitslagen'),
        ('sport_standing', 'Competitiestand'),
        ('sport_period_standing', 'Periodestand'),
        ('sport_match_of_the_day', 'Match of the Day'),
        ('sport_next_match', 'Volgende wedstrijd'),
        ('sport_cancellations', 'Afgelastingen'),
        ('sport_dressing_rooms', 'Veld- en kleedkamerindeling'),
        ('sport_officials', 'Wedstrijdofficials'),
        ('sport_team', 'Teamvoorstelling'),
        ('sport_sponsor', 'Teamsponsor'),
        ('sport_activities', 'Clubagenda'),
        ('sport_trainings', 'Trainingen'),
        ('sport_volunteers', 'Vrijwilligers'),
        ('sport_birthdays', 'Verjaardagen')
      ) as sport(slide_type, label)
      cross join (values ('landscape'), ('portrait')) as shape(orientation)
      cross join (values ('light'), ('dark')) as palette(theme)
    ) variants
  loop
    if exists (
      select 1 from public.dynamic_templates existing
      where existing.slug = template_row.slug
    ) then
      continue;
    end if;

    source_markup :=
      '<rect class="bg" width="100%" height="100%"/>' ||
      '<rect class="accent" x="74" y="72" width="16" height="116" rx="8"/>' ||
      '<text class="eyebrow" x="126" y="116">VEYOCAST CLUBTV</text>' ||
      '<text class="title" x="126" y="205">{{truncate ' ||
      case
        when template_row.slide_type = 'menu' then 'menu.title'
        when template_row.slide_type = 'news' then 'news.sourceName'
        else 'sport.title'
      end ||
      ' "44"}}</text>' ||
      case
        when template_row.slide_type = 'menu' then
          '<g transform="translate(126 320)">{{#each menu.products}}' ||
          '<g class="item"><text class="primary" x="0" y="0">{{truncate name "34"}}</text>' ||
          '<text class="meta" x="' ||
          case when template_row.orientation = 'landscape'
            then '1540' else '800' end ||
          '" y="0" text-anchor="end">{{currency priceMinor "EUR"}}</text></g>{{/each}}</g>'
        when template_row.slide_type = 'news' then
          '{{#each news.articles}}<text class="headline" x="126" y="410">{{truncate title "54"}}</text>' ||
          '<text class="intro" x="126" y="540">{{truncate intro "180"}}</text>{{/each}}'
        else
          '<g transform="translate(126 320)">{{#each sport.items}}' ||
          '<g class="item"><text class="primary" x="0" y="0">{{truncate primary "48"}}</text>' ||
          '<text class="secondary" x="0" y="48">{{truncate secondary "48"}}</text>' ||
          '<text class="meta" x="' ||
          case when template_row.orientation = 'landscape'
            then '1540' else '800' end ||
          '" y="0" text-anchor="end">{{truncate meta "32"}}</text></g>{{/each}}</g>'
      end;
    source_css := case
      when template_row.theme = 'dark' then
        '.bg{fill:#080908}.accent{fill:#f15a24}.eyebrow{font:700 26px Arial;letter-spacing:5px;fill:#f15a24}.title{font:700 74px Arial;fill:#fffdf7}.headline{font:700 92px Arial;fill:#fffdf7}.intro{font:400 34px Arial;fill:#c9c4b9}.primary{font:700 38px Arial;fill:#fffdf7}.secondary,.meta{font:400 25px Arial;fill:#c9c4b9}.item:nth-child(1){transform:translateY(0)}.item:nth-child(2){transform:translateY(92px)}.item:nth-child(3){transform:translateY(184px)}.item:nth-child(4){transform:translateY(276px)}.item:nth-child(5){transform:translateY(368px)}.item:nth-child(6){transform:translateY(460px)}.item:nth-child(7){transform:translateY(552px)}.item:nth-child(8){transform:translateY(644px)}'
      else
        '.bg{fill:#f4efe6}.accent{fill:#f15a24}.eyebrow{font:700 26px Arial;letter-spacing:5px;fill:#f15a24}.title{font:700 74px Arial;fill:#11110f}.headline{font:700 92px Arial;fill:#11110f}.intro{font:400 34px Arial;fill:#625f57}.primary{font:700 38px Arial;fill:#11110f}.secondary,.meta{font:400 25px Arial;fill:#625f57}.item:nth-child(1){transform:translateY(0)}.item:nth-child(2){transform:translateY(92px)}.item:nth-child(3){transform:translateY(184px)}.item:nth-child(4){transform:translateY(276px)}.item:nth-child(5){transform:translateY(368px)}.item:nth-child(6){transform:translateY(460px)}.item:nth-child(7){transform:translateY(552px)}.item:nth-child(8){transform:translateY(644px)}'
    end;
    source_manifest := jsonb_build_object(
      'schemaVersion', 1,
      'engine', 'veyocast-safe-template-v1',
      'slideType', template_row.slide_type,
      'canvas', jsonb_build_object(
        'width', case when template_row.orientation = 'landscape' then 1920 else 1080 end,
        'height', case when template_row.orientation = 'landscape' then 1080 else 1920 end
      ),
      'maxCollectionItems',
        case when template_row.slide_type = 'news' then 1 else 8 end,
      'allowedFields', jsonb_build_array(
        jsonb_build_object(
          'path',
          case
            when template_row.slide_type = 'menu' then 'menu.title'
            when template_row.slide_type = 'news' then 'news.sourceName'
            else 'sport.title'
          end,
          'type', 'string', 'required', true
        ),
        jsonb_build_object(
          'path',
          case
            when template_row.slide_type = 'menu' then 'menu.products'
            when template_row.slide_type = 'news' then 'news.articles'
            else 'sport.items'
          end,
          'type', 'string', 'required', true
        )
      ) ||
      case
        when template_row.slide_type = 'menu' then jsonb_build_array(
          jsonb_build_object(
            'path', 'menu.products.name',
            'type', 'string', 'required', true
          ),
          jsonb_build_object(
            'path', 'menu.products.priceMinor',
            'type', 'number', 'required', true
          )
        )
        when template_row.slide_type = 'news' then jsonb_build_array(
          jsonb_build_object(
            'path', 'news.articles.title',
            'type', 'string', 'required', true
          ),
          jsonb_build_object(
            'path', 'news.articles.intro',
            'type', 'string', 'required', false
          )
        )
        else jsonb_build_array(
          jsonb_build_object(
            'path', 'sport.items.primary',
            'type', 'string', 'required', true
          ),
          jsonb_build_object(
            'path', 'sport.items.secondary',
            'type', 'string', 'required', false
          ),
          jsonb_build_object(
            'path', 'sport.items.meta',
            'type', 'string', 'required', false
          )
        )
      end
    );
    sample_data := case
      when template_row.slide_type = 'menu' then jsonb_build_object(
        'type', 'menu',
        'menu', jsonb_build_object(
          'title', 'Menu vandaag',
          'products', jsonb_build_array(
            jsonb_build_object('name', 'Clubburger', 'priceMinor', 695),
            jsonb_build_object('name', 'Friet groot', 'priceMinor', 425)
          )
        )
      )
      when template_row.slide_type = 'news' then jsonb_build_object(
        'type', 'news',
        'news', jsonb_build_object(
          'sourceName', 'Clubnieuws',
          'articles', jsonb_build_array(jsonb_build_object(
            'title', 'Alles wat vandaag op de club gebeurt',
            'intro', 'Het laatste nieuws voor leden en bezoekers.'
          ))
        )
      )
      else jsonb_build_object(
        'type', template_row.slide_type,
        'sport', jsonb_build_object(
          'title', template_row.label,
          'items', jsonb_build_array(jsonb_build_object(
            'primary', 'VeyoCast 1 – Bezoekers',
            'secondary', 'Zaterdag 14:30',
            'meta', 'Veld 1'
          ))
        )
      )
    end;

    insert into public.dynamic_templates(
      slug, name, description, category, slide_type, orientation, status
    ) values (
      template_row.slug,
      template_row.label || ' · ' ||
        case when template_row.theme = 'dark' then 'donker' else 'licht' end ||
        ' · ' ||
        case when template_row.orientation = 'landscape'
          then 'liggend' else 'staand' end,
      'Vaste VeyoCast HTML/CSS-runtime met immutable PNG-fallback.',
      template_row.category,
      template_row.slide_type,
      template_row.orientation,
      'published'
    ) returning id into template_id;

    insert into public.dynamic_template_versions(
      template_id, version, status, markup, css, manifest_json,
      sample_data_json, source_checksum_sha256, published_at
    ) values (
      template_id, 1, 'published', source_markup, source_css,
      source_manifest, sample_data,
      encode(extensions.digest(
        pg_catalog.convert_to(
          source_markup || source_css || source_manifest::text, 'UTF8'
        ),
        'sha256'
      ), 'hex'),
      now()
    ) returning id into version_id;

    update public.dynamic_templates
    set current_published_version_id = version_id
    where id = template_id;
  end loop;
end;
$$;
