-- Editorial Arena: one capability-gated HTML/CSS theme, four fixed-canvas
-- variants per active type, enriched immutable payloads and safe legacy
-- withdrawal. PNG artifacts remain compatibility fallbacks/thumbnails.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_editorial_arena;

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
  enriched_items jsonb;
  club_name text;
  brand_logo_id uuid;
  tenant_primary_color text;
begin
  result :=
    private.build_dynamic_snapshot_data_before_editorial_arena(p_slide);

  select tenant.name
  into club_name
  from public.tenants tenant
  where tenant.id = p_slide.tenant_id;

  select kit.logo_media_asset_id
  into brand_logo_id
  from public.studio_tenant_brand_kits kit
  where kit.tenant_id = p_slide.tenant_id;

  select settings.primary_color
  into tenant_primary_color
  from public.tenant_settings settings
  where settings.tenant_id = p_slide.tenant_id;

  result := result || jsonb_build_object(
    'brand',
    coalesce(result -> 'brand', '{}'::jsonb) ||
      jsonb_strip_nulls(jsonb_build_object(
        'clubName', club_name,
        'logoMediaAssetId', brand_logo_id,
        'primaryColor', coalesce(tenant_primary_color, '#FF5C20')
      ))
  );

  if p_slide.slide_type = 'menu' then
    select coalesce(jsonb_agg(
      product_item || jsonb_strip_nulls(jsonb_build_object(
        'variantLine',
        coalesce(
          nullif(product.custom_fields ->> 'variantLine', ''),
          nullif(product.custom_fields ->> 'variant', ''),
          nullif(product.unit, '')
        )
      ))
      order by item_order
    ), '[]'::jsonb)
    into enriched_items
    from jsonb_array_elements(
      coalesce(result #> '{menu,products}', '[]'::jsonb)
    ) with ordinality as source(product_item, item_order)
    left join public.tenant_products product
      on product.tenant_id = p_slide.tenant_id
     and product.id::text = product_item ->> 'id';

    result := jsonb_set(
      result,
      '{menu,products}',
      enriched_items,
      true
    );
  elsif p_slide.slide_type in (
    'sport_program',
    'sport_results',
    'sport_next_match',
    'sport_cancellations',
    'sport_dressing_rooms',
    'sport_officials'
  ) then
    select coalesce(jsonb_agg(
      source.item || jsonb_strip_nulls(jsonb_build_object(
        'homeTeam', match_record.home_team ->> 'name',
        'awayTeam', match_record.away_team ->> 'name',
        'homeScore', match_record.home_team -> 'score',
        'awayScore', match_record.away_team -> 'score',
        'date', to_char(
          match_record.starts_at at time zone connection.timezone,
          'DD-MM-YYYY'
        ),
        'time', to_char(
          match_record.starts_at at time zone connection.timezone,
          'HH24:MI'
        ),
        'venue', concat_ws(
          ' · ',
          nullif(match_record.venue ->> 'name', ''),
          nullif(match_record.venue ->> 'field', '')
        ),
        'competition', coalesce(
          nullif(match_record.competition ->> 'name', ''),
          nullif(match_record.pool ->> 'name', '')
        ),
        'homeRoom', nullif(match_record.dressing_rooms ->> 'home', ''),
        'awayRoom', nullif(match_record.dressing_rooms ->> 'away', ''),
        'officials', coalesce(match_record.officials, '[]'::jsonb)
      ))
      order by source.item_order
    ), '[]'::jsonb)
    into enriched_items
    from jsonb_array_elements(
      coalesce(result #> '{sport,items}', '[]'::jsonb)
    ) with ordinality as source(item, item_order)
    left join lateral (
      select match.*
      from public.sports_matches match
      join public.sportlink_connections source_connection
        on source_connection.id = match.source_connection_id
       and source_connection.tenant_id = match.tenant_id
      where match.tenant_id = p_slide.tenant_id
        and source_connection.data_source_id = p_slide.data_source_id
        and match.external_id = source.item ->> 'id'
      order by match.last_synced_at desc
      limit 1
    ) match_record on true
    left join public.sportlink_connections connection
      on connection.id = match_record.source_connection_id
     and connection.tenant_id = match_record.tenant_id;

    result := jsonb_set(
      result,
      '{sport,items}',
      enriched_items,
      true
    );
  end if;

  return result;
end
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_editorial_arena(
  public.dynamic_slides
) from public, anon, authenticated;

-- The existing primary-colour trigger is broadened from news-only to every
-- capability-backed Editorial Arena slide. Immutable releases remain frozen;
-- mutable latest slides receive a fresh renderhash through the source revision.
create or replace function private.refresh_news_slides_after_primary_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.primary_color is not distinct from old.primary_color
  then
    return new;
  end if;

  update public.dynamic_data_sources source
  set revision = source.revision + 1
  where source.tenant_id = new.tenant_id
    and source.status = 'active'
    and exists (
      select 1
      from public.dynamic_slides slide
      where slide.tenant_id = source.tenant_id
        and slide.data_source_id = source.id
        and slide.slide_type in (
          'menu',
          'news',
          'sport_activities',
          'sport_cancellations',
          'sport_dressing_rooms',
          'sport_next_match',
          'sport_officials',
          'sport_program',
          'sport_results',
          'sport_standing'
        )
        and slide.selection_mode = 'latest'
        and slide.status <> 'archived'
    );

  return new;
end;
$$;

revoke all on function private.refresh_news_slides_after_primary_color()
  from public, anon, authenticated;

do $$
declare
  variant record;
  selected_template_id uuid;
  selected_version_id uuid;
  source_markup text;
  source_css text;
  source_manifest jsonb;
  sample_data jsonb;
  row_css text;
  row_index integer;
  canvas_width integer;
  canvas_height integer;
  max_collection integer;
begin
  row_css := '';
  for row_index in 1..18 loop
    row_css := row_css || '.item:nth-child(' || row_index || '){transform:translateY(' ||
      ((row_index - 1) * 72)::text || 'px)}';
  end loop;

  for variant in
    select *
    from (values
      ('menu', 'menubord', 'Menubord', 'menu'),
      ('news', 'nieuws', 'Nieuws', 'news'),
      ('sport_activities', 'clubagenda', 'Clubagenda', 'sports'),
      ('sport_cancellations', 'afgelastingen', 'Afgelastingen', 'sports'),
      ('sport_standing', 'competitiestand', 'Competitiestand', 'sports'),
      ('sport_dressing_rooms', 'veld-kleedkamer', 'Veld- en kleedkamerindeling', 'sports'),
      ('sport_program', 'programma', 'Programma', 'sports'),
      ('sport_results', 'uitslagen', 'Uitslagen', 'sports'),
      ('sport_next_match', 'volgende-wedstrijd', 'Volgende wedstrijd', 'sports'),
      ('sport_officials', 'scheidsrechters', 'Scheidsrechtersaanstellingen', 'sports')
    ) as kind(slide_type, template_key, label, category)
    cross join (values ('dark'), ('light')) as palette(mode)
    cross join (values ('landscape'), ('portrait')) as shape(orientation)
  loop
    canvas_width := case
      when variant.orientation = 'landscape' then 1920 else 1080
    end;
    canvas_height := case
      when variant.orientation = 'landscape' then 1080 else 1920
    end;
    max_collection := case
      when variant.slide_type = 'news' then 1
      when variant.slide_type = 'sport_standing'
        and variant.orientation = 'portrait' then 18
      when variant.slide_type = 'sport_standing' then 8
      when variant.orientation = 'portrait' then 8
      else 8
    end;

    if variant.slide_type = 'menu' then
      source_markup :=
        '<rect class="bg" width="100%" height="100%"/>' ||
        '<rect class="topline" fill="{{brand.primaryColor}}" width="100%" height="8"/>' ||
        '<path class="crest" fill="{{brand.primaryColor}}" d="M58 36h70l-8 82-27 25-27-25z"/>' ||
        '<text class="crestText" x="93" y="93" text-anchor="middle">VC</text>' ||
        '<text class="kicker" fill="{{brand.primaryColor}}" x="156" y="61">EDITORIAL ARENA</text>' ||
        '<text class="title" x="156" y="126">MENUBORD</text>' ||
        '<text class="subtitle" x="156" y="162">KANTINEFAVORIETEN</text>' ||
        '<rect class="panel" x="82" y="214" width="' ||
          case when variant.orientation = 'landscape' then '820' else '916' end ||
          '" height="' || case when variant.orientation = 'landscape' then '774' else '390' end || '" rx="24"/>' ||
        '<text class="section" fill="{{brand.primaryColor}}" x="126" y="284">VANDAAG OP HET MENU</text>' ||
        '<text class="hero" x="126" y="420">LEKKER VOOR, TIJDENS</text>' ||
        '<text class="hero accentText" fill="{{brand.primaryColor}}" x="126" y="490">&amp; NA DE WEDSTRIJD</text>' ||
        '<g transform="translate(' ||
          case when variant.orientation = 'landscape' then '950 286' else '96 720' end ||
          ')">{{#each menu.products}}<g class="item"><rect class="itemBg" x="0" y="-36" width="' ||
          case when variant.orientation = 'landscape' then '840' else '888' end ||
          '" height="62" rx="12"/><text class="primary" x="24" y="4">{{truncate name "34"}}</text>' ||
          '<text class="variant" fill="{{brand.primaryColor}}" x="24" y="25">{{truncate variantLine "42"}}</text>' ||
          '<text class="price" fill="{{brand.primaryColor}}" x="' ||
          case when variant.orientation = 'landscape' then '810' else '858' end ||
          '" y="4" text-anchor="end">{{currency priceMinor "EUR"}}</text></g>{{/each}}</g>';
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', variant.slide_type,
        'canvas', jsonb_build_object(
          'width', canvas_width,
          'height', canvas_height
        ),
        'maxCollectionItems', max_collection,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path', 'brand.primaryColor', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'menu.products', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'menu.products.name', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'menu.products.variantLine', 'type', 'string', 'required', false),
          jsonb_build_object('path', 'menu.products.priceMinor', 'type', 'number', 'required', true)
        )
      );
      sample_data := jsonb_build_object(
        'type', 'menu',
        'menu', jsonb_build_object(
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Clubburger',
              'variantLine', 'Regular · spicy · veggie',
              'priceMinor', 895
            )
          )
        )
      );
    elsif variant.slide_type = 'news' then
      source_markup :=
        '<rect class="bg" width="100%" height="100%"/>' ||
        '<rect class="topline" fill="{{brand.primaryColor}}" width="100%" height="8"/>' ||
        '<path class="crest" fill="{{brand.primaryColor}}" d="M58 36h70l-8 82-27 25-27-25z"/>' ||
        '<text class="crestText" x="93" y="93" text-anchor="middle">VC</text>' ||
        '<text class="kicker" fill="{{brand.primaryColor}}" x="156" y="61">EDITORIAL ARENA</text>' ||
        '<text class="title" x="156" y="126">NIEUWS</text>' ||
        '<text class="subtitle" x="156" y="162">NIEUWS UIT EN ROND DE CLUB</text>' ||
        '<rect class="heroPanel" x="82" y="214" width="' ||
          case when variant.orientation = 'landscape' then '850' else '916' end ||
          '" height="' || case when variant.orientation = 'landscape' then '774' else '700' end || '" rx="24"/>' ||
        '<rect class="panel" x="' ||
          case when variant.orientation = 'landscape' then '960' else '82' end ||
          '" y="' || case when variant.orientation = 'landscape' then '214' else '944' end ||
          '" width="' || case when variant.orientation = 'landscape' then '878' else '916' end ||
          '" height="' || case when variant.orientation = 'landscape' then '774' else '850' end || '" rx="24"/>' ||
        '{{#each news.articles}}<text class="section" x="' ||
          case when variant.orientation = 'landscape' then '1010' else '130' end ||
          '" y="' || case when variant.orientation = 'landscape' then '360' else '1050' end ||
          '" fill="{{brand.primaryColor}}">{{truncate sourceName "32"}}</text><text class="newsTitle" x="' ||
          case when variant.orientation = 'landscape' then '1010' else '130' end ||
          '" y="' || case when variant.orientation = 'landscape' then '470' else '1180' end ||
          '">{{truncate title "54"}}</text><text class="intro" x="' ||
          case when variant.orientation = 'landscape' then '1010' else '130' end ||
          '" y="' || case when variant.orientation = 'landscape' then '670' else '1420' end ||
          '">{{truncate intro "180"}}</text>{{/each}}';
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', variant.slide_type,
        'canvas', jsonb_build_object(
          'width', canvas_width,
          'height', canvas_height
        ),
        'maxCollectionItems', 1,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path', 'brand.primaryColor', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'news.articles', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'news.articles.sourceName', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'news.articles.title', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'news.articles.intro', 'type', 'string', 'required', false)
        )
      );
      sample_data := jsonb_build_object(
        'type', 'news',
        'news', jsonb_build_object(
          'articles', jsonb_build_array(jsonb_build_object(
            'sourceName', 'Clubnieuws',
            'title', 'Alles wat vandaag op de club gebeurt',
            'intro', 'Het laatste nieuws voor leden en bezoekers.'
          ))
        )
      );
    elsif variant.slide_type = 'sport_standing' then
      source_markup :=
        '<rect class="bg" width="100%" height="100%"/>' ||
        '<rect class="topline" fill="{{brand.primaryColor}}" width="100%" height="8"/>' ||
        '<path class="crest" fill="{{brand.primaryColor}}" d="M58 36h70l-8 82-27 25-27-25z"/>' ||
        '<text class="crestText" x="93" y="93" text-anchor="middle">VC</text>' ||
        '<text class="kicker" fill="{{brand.primaryColor}}" x="156" y="61">EDITORIAL ARENA</text>' ||
        '<text class="title" x="156" y="126">STAND</text>' ||
        '<text class="subtitle" x="156" y="162">ACTUELE COMPETITIESTAND</text>' ||
        '<rect class="panel" x="82" y="214" width="' || (canvas_width - 164)::text ||
          '" height="' || (canvas_height - 306)::text || '" rx="24"/>' ||
        '<text class="columns" fill="{{brand.primaryColor}}" x="112" y="276">#   TEAM                                      G     W     GL     V      PT      +/-</text>' ||
        '<g transform="translate(118 350)">{{#each sport.items}}<g class="item">' ||
        '<text class="rank accentText" fill="{{brand.primaryColor}}" x="0" y="0">{{position}}</text>' ||
        '<text class="primary" x="58" y="0">{{truncate teamName "34"}}</text>' ||
        '<text class="meta" x="' || (canvas_width - 330)::text ||
          '" y="0" text-anchor="end">{{played}}  {{won}}  {{drawn}}  {{lost}}   {{points}} PT</text>' ||
        '</g>{{/each}}</g>';
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', variant.slide_type,
        'canvas', jsonb_build_object(
          'width', canvas_width,
          'height', canvas_height
        ),
        'maxCollectionItems', max_collection,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path', 'brand.primaryColor', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items.position', 'type', 'number', 'required', false),
          jsonb_build_object('path', 'sport.items.teamName', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items.played', 'type', 'number', 'required', false),
          jsonb_build_object('path', 'sport.items.won', 'type', 'number', 'required', false),
          jsonb_build_object('path', 'sport.items.drawn', 'type', 'number', 'required', false),
          jsonb_build_object('path', 'sport.items.lost', 'type', 'number', 'required', false),
          jsonb_build_object('path', 'sport.items.points', 'type', 'number', 'required', false)
        )
      );
      sample_data := jsonb_build_object(
        'type', variant.slide_type,
        'sport', jsonb_build_object(
          'items', jsonb_build_array(jsonb_build_object(
            'position', 1,
            'teamName', 'VeyoCast 1',
            'played', 18,
            'won', 13,
            'drawn', 3,
            'lost', 2,
            'points', 42
          ))
        )
      );
    else
      source_markup :=
        '<rect class="bg" width="100%" height="100%"/>' ||
        '<rect class="topline" fill="{{brand.primaryColor}}" width="100%" height="8"/>' ||
        '<path class="crest" fill="{{brand.primaryColor}}" d="M58 36h70l-8 82-27 25-27-25z"/>' ||
        '<text class="crestText" x="93" y="93" text-anchor="middle">VC</text>' ||
        '<text class="kicker" fill="{{brand.primaryColor}}" x="156" y="61">EDITORIAL ARENA</text>' ||
        '<text class="title" x="156" y="126">' || upper(variant.label) || '</text>' ||
        '<text class="subtitle" x="156" y="162">ACTUELE CLUBINFORMATIE</text>' ||
        '<rect class="panel" x="82" y="214" width="' || (canvas_width - 164)::text ||
          '" height="' || (canvas_height - 306)::text || '" rx="24"/>' ||
        '<g transform="translate(126 330)">{{#each sport.items}}<g class="item">' ||
        '<text class="primary" x="0" y="0">{{truncate primary "48"}}</text>' ||
        '<text class="secondary" x="0" y="32">{{truncate secondary "46"}}</text>' ||
        '<text class="meta" x="' || (canvas_width - 340)::text ||
          '" y="0" text-anchor="end">{{truncate meta "32"}}</text>' ||
        '</g>{{/each}}</g>';
      source_manifest := jsonb_build_object(
        'schemaVersion', 1,
        'engine', 'veyocast-safe-template-v1',
        'slideType', variant.slide_type,
        'canvas', jsonb_build_object(
          'width', canvas_width,
          'height', canvas_height
        ),
        'maxCollectionItems', max_collection,
        'allowedFields', jsonb_build_array(
          jsonb_build_object('path', 'brand.primaryColor', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items.primary', 'type', 'string', 'required', true),
          jsonb_build_object('path', 'sport.items.secondary', 'type', 'string', 'required', false),
          jsonb_build_object('path', 'sport.items.meta', 'type', 'string', 'required', false)
        )
      );
      sample_data := jsonb_build_object(
        'type', variant.slide_type,
        'sport', jsonb_build_object(
          'items', jsonb_build_array(jsonb_build_object(
            'primary', 'VeyoCast 1 – Bezoekers',
            'secondary', 'Zaterdag 14:30',
            'meta', 'Veld 1'
          ))
        )
      );
    end if;

    sample_data := sample_data || jsonb_build_object(
      'brand',
      jsonb_build_object('primaryColor', '#FF5C20')
    );

    source_css :=
      case when variant.mode = 'dark' then
        '.bg{fill:#070a0e}.panel{fill:#0d1218;stroke:#303943;stroke-width:1}.primary,.title,.hero,.newsTitle{fill:#f3f0e9}.secondary,.meta,.subtitle,.intro{fill:#9aa2ac}'
      else
        '.bg{fill:#f3f1ec}.panel{fill:#fffefa;stroke:#d8d6d0;stroke-width:1}.primary,.title,.hero,.newsTitle{fill:#17202a}.secondary,.meta,.subtitle,.intro{fill:#6f7882}'
      end ||
      '.crestText{font:900 18px Arial;fill:#fff}' ||
      '.kicker{font:900 18px Arial;letter-spacing:4px}.title{font:900 58px Arial}' ||
      '.subtitle{font:800 20px Arial;letter-spacing:3px}.section{font:900 22px Arial}' ||
      '.hero{font:900 62px Arial}.newsTitle{font:900 62px Arial}.intro{font:400 25px Arial}' ||
      '.heroPanel{fill:#152d43}.itemBg{fill:' ||
        case when variant.mode = 'dark' then '#121820' else '#f7f5f0' end || '}' ||
      '.primary{font:900 28px Arial}.secondary,.meta{font:400 19px Arial}' ||
      '.variant{font:800 12px Arial}.price{font:900 28px Arial}' ||
      '.rank{font:900 27px Arial}.columns{font:900 16px Arial;letter-spacing:2px}' ||
      row_css;

    insert into public.dynamic_templates(
      slug,
      name,
      description,
      category,
      slide_type,
      orientation,
      status
    ) values (
      'editorial-arena-' || variant.template_key || '-' ||
        variant.mode || '-' || variant.orientation,
      variant.label || ' · ' ||
        case when variant.mode = 'dark' then 'donker' else 'licht' end ||
        ' · ' ||
        case when variant.orientation = 'landscape'
          then 'liggend'
          else 'staand'
        end,
      'Editorial Arena HTML/CSS-slide met immutable snapshotfallback.',
      variant.category,
      variant.slide_type,
      variant.orientation,
      'published'
    )
    on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        slide_type = excluded.slide_type,
        orientation = excluded.orientation,
        status = 'published'
    returning id into selected_template_id;

    select version.id
    into selected_version_id
    from public.dynamic_template_versions version
    where version.template_id = selected_template_id
      and version.source_checksum_sha256 = encode(extensions.digest(
        pg_catalog.convert_to(
          source_markup || source_css || source_manifest::text,
          'UTF8'
        ),
        'sha256'
      ), 'hex')
    limit 1;

    if selected_version_id is null then
      insert into public.dynamic_template_versions(
        template_id,
        version,
        status,
        markup,
        css,
        manifest_json,
        sample_data_json,
        source_checksum_sha256,
        published_at
      ) values (
        selected_template_id,
        coalesce((
          select max(version.version) + 1
          from public.dynamic_template_versions version
          where version.template_id = selected_template_id
        ), 1),
        'published',
        source_markup,
        source_css,
        source_manifest,
        sample_data,
        encode(extensions.digest(
          pg_catalog.convert_to(
            source_markup || source_css || source_manifest::text,
            'UTF8'
          ),
          'sha256'
        ), 'hex'),
        now()
      )
      returning id into selected_version_id;
    end if;

    update public.dynamic_templates
    set current_published_version_id = selected_version_id,
        status = 'published'
    where id = selected_template_id;
  end loop;
end
$$;

-- The registry has one visible theme after this point. Historical rows remain
-- available to immutable release/audit foreign keys.
update public.dynamic_templates
set status = 'archived'
where slug not like 'editorial-arena-%'
  and status <> 'archived';

update public.dynamic_template_versions version
set status = 'archived'
from public.dynamic_templates template
where template.id = version.template_id
  and template.slug not like 'editorial-arena-%'
  and version.status <> 'archived';

-- Move mutable slide definitions to the matching Editorial Arena version.
-- Existing immutable releases keep their frozen snapshot and continue through
-- the trusted Player HTML/CSS renderer or verified PNG fallback.
do $$
declare
  slide_record public.dynamic_slides%rowtype;
  target_template record;
  requested_mode text;
  snapshot_data jsonb;
  revision_hash text;
  new_snapshot_id uuid;
begin
  for slide_record in
    select slide.*
    from public.dynamic_slides slide
    where slide.status <> 'archived'
      and slide.slide_type in (
        'menu',
        'news',
        'sport_activities',
        'sport_cancellations',
        'sport_dressing_rooms',
        'sport_next_match',
        'sport_officials',
        'sport_program',
        'sport_results',
        'sport_standing'
      )
  loop
    select case
      when template.slug like '%light%' then 'light'
      else 'dark'
    end
    into requested_mode
    from public.dynamic_templates template
    where template.id = slide_record.template_id;

    select
      template.id,
      template.current_published_version_id
    into target_template
    from public.dynamic_templates template
    where template.slug =
      'editorial-arena-' ||
      case slide_record.slide_type
        when 'menu' then 'menubord'
        when 'news' then 'nieuws'
        when 'sport_activities' then 'clubagenda'
        when 'sport_cancellations' then 'afgelastingen'
        when 'sport_standing' then 'competitiestand'
        when 'sport_dressing_rooms' then 'veld-kleedkamer'
        when 'sport_program' then 'programma'
        when 'sport_results' then 'uitslagen'
        when 'sport_next_match' then 'volgende-wedstrijd'
        when 'sport_officials' then 'scheidsrechters'
      end ||
      '-' || requested_mode || '-' || slide_record.orientation
      and template.status = 'published';

    if target_template.id is null
      or target_template.current_published_version_id is null
    then
      continue;
    end if;

    update public.dynamic_slides
    set template_id = target_template.id,
        template_version_id =
          target_template.current_published_version_id,
        revision = revision + 1
    where id = slide_record.id;

    slide_record.template_id := target_template.id;
    slide_record.template_version_id :=
      target_template.current_published_version_id;
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    revision_hash := encode(extensions.digest(
      pg_catalog.convert_to(jsonb_build_object(
        'templateVersionId', slide_record.template_version_id,
        'configuration', slide_record.configuration_json,
        'data', snapshot_data
      )::text, 'UTF8'),
      'sha256'
    ), 'hex');

    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      created_by
    ) values (
      slide_record.tenant_id,
      slide_record.id,
      slide_record.template_version_id,
      slide_record.data_source_id,
      revision_hash,
      snapshot_data,
      slide_record.updated_by
    )
    on conflict (
      dynamic_slide_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning id into new_snapshot_id;

    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
      update public.dynamic_slides
      set status = 'rendering',
          last_error_code = null
      where id = slide_record.id;
    end if;
  end loop;
end
$$;
