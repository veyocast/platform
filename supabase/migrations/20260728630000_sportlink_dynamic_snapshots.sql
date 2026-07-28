-- Connect normalized Sportlink datasets to the existing immutable slide engine.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_sportlink;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  max_items integer := least(greatest(
    coalesce((p_slide.configuration_json->>'maxItems')::integer,8),1),40);
  title text := coalesce(nullif(p_slide.configuration_json->>'title',''),p_slide.name);
begin
  if p_slide.slide_type in ('menu','news') then
    return private.build_dynamic_snapshot_data_before_sportlink(p_slide);
  end if;
  if p_slide.slide_type in (
    'sport_program','sport_results','sport_match_of_the_day','sport_next_match',
    'sport_cancellations','sport_dressing_rooms','sport_officials'
  ) then
    select jsonb_build_object(
      'type',p_slide.slide_type,
      'sport',jsonb_build_object(
        'title',title,'generatedAt',now(),
        'items',coalesce(jsonb_agg(jsonb_build_object(
          'id',match.external_id,
          'primary',(match.home_team->>'name') || ' – ' || (match.away_team->>'name'),
          'secondary',to_char(match.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),
          'meta',case
            when p_slide.slide_type='sport_dressing_rooms' then concat_ws(
              ' · ',
              nullif('Thuis '||coalesce(match.dressing_rooms->>'home',''),'Thuis '),
              nullif('Uit '||coalesce(match.dressing_rooms->>'away',''),'Uit '),
              nullif('Official '||coalesce(match.dressing_rooms->>'official',''),'Official ')
            )
            when p_slide.slide_type='sport_officials' then coalesce((
              select string_agg(person->>'displayName',' · ')
              from jsonb_array_elements(match.officials) person
            ),'Nog niet bekend')
            else coalesce(match.venue->>'field',match.venue->>'name','')
          end,
          'status',case when match.status='cancelled' then
            coalesce(match.cancellation_reason,'Afgelast') else match.status end
        ) order by match.starts_at),'[]'::jsonb),
        'emptyStateCode',case when count(*)=0 then
          case when p_slide.slide_type='sport_results' then 'RESULTS_NOT_PUBLISHED'
            else 'NO_ITEMS_IN_PERIOD' end else null end,
        'expiresAt',max(match.expires_at)
      )
    ) into result
    from (
      select m.* from public.sports_matches m
      join public.sportlink_connections c on c.id=m.source_connection_id
      where m.tenant_id=p_slide.tenant_id
        and c.data_source_id=p_slide.data_source_id and m.active
        and (m.expires_at is null or m.expires_at>now())
        and case
          when p_slide.slide_type='sport_results' then m.status='finished'
          when p_slide.slide_type='sport_cancellations' then m.status='cancelled'
          when p_slide.slide_type='sport_match_of_the_day' then
            m.status in ('scheduled','postponed')
            and (m.starts_at at time zone c.timezone)::date=
              (now() at time zone c.timezone)::date
          when p_slide.slide_type='sport_next_match' then
            m.status in ('scheduled','postponed') and m.starts_at>=now()
          else m.status in ('scheduled','postponed') and m.starts_at>=
            date_trunc('day',now() at time zone c.timezone) at time zone c.timezone
        end
      order by case when p_slide.slide_type='sport_results'
        then -extract(epoch from m.starts_at) else extract(epoch from m.starts_at) end
      limit case when p_slide.slide_type in ('sport_match_of_the_day','sport_next_match')
        then 1 else max_items end
    ) match;
  elsif p_slide.slide_type in ('sport_standing','sport_period_standing') then
    select jsonb_build_object('type',p_slide.slide_type,'sport',jsonb_build_object(
      'title',title,'generatedAt',now(),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',row->>'externalId',
          'primary',concat_ws('. ',nullif(row->>'position',''),row->>'teamName'),
          'secondary',coalesce(row->>'played','0')||' gespeeld',
          'meta',coalesce(row->>'points','0')||' pt',
          'status','published'
        ) order by coalesce((row->>'position')::integer,999))
        from jsonb_array_elements(standing.rows_json) row
      ),'[]'::jsonb),
      'emptyStateCode',case when standing.id is null or not standing.scores_published
        then 'STANDINGS_NOT_PUBLISHED' else null end,'expiresAt',null))
    into result from public.sports_standings standing
    join public.sportlink_connections c on c.id=standing.source_connection_id
    where standing.tenant_id=p_slide.tenant_id and c.data_source_id=p_slide.data_source_id
      and standing.active
      and (p_slide.slide_type<>'sport_period_standing' or standing.period_number is not null)
    order by standing.last_synced_at desc limit 1;
  elsif p_slide.slide_type='sport_activities' then
    select jsonb_build_object('type',p_slide.slide_type,'sport',jsonb_build_object(
      'title',title,'generatedAt',now(),
      'items',coalesce(jsonb_agg(jsonb_build_object(
        'id',activity.external_id,'primary',activity.name,
        'secondary',to_char(activity.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),
        'meta',coalesce(activity.location,''),'status','scheduled'
      ) order by activity.starts_at),'[]'::jsonb),
      'emptyStateCode',case when count(*)=0 then 'NO_ACTIVITIES' else null end,
      'expiresAt',max(activity.expires_at)))
    into result from (
      select a.* from public.sports_activities a
      join public.sportlink_connections c on c.id=a.source_connection_id
      where a.tenant_id=p_slide.tenant_id and c.data_source_id=p_slide.data_source_id
        and a.active and (a.expires_at is null or a.expires_at>now())
      order by a.starts_at limit max_items
    ) activity;
  else
    result := jsonb_build_object('type',p_slide.slide_type,'sport',jsonb_build_object(
      'title',title,'generatedAt',now(),'items','[]'::jsonb,
      'emptyStateCode','DATASET_DISABLED_OR_EMPTY','expiresAt',null));
  end if;
  return coalesce(result,jsonb_build_object(
    'type',p_slide.slide_type,'sport',jsonb_build_object(
      'title',title,'generatedAt',now(),'items','[]'::jsonb,
      'emptyStateCode','NO_ITEMS_IN_PERIOD','expiresAt',null)
  )) || jsonb_build_object('brand',coalesce((
    select jsonb_build_object('primaryColor',brand.primary_color,
      'secondaryColor',brand.secondary_color)
    from public.studio_tenant_brand_kits brand where brand.tenant_id=p_slide.tenant_id
  ),jsonb_build_object('primaryColor','#ff5a1f','secondaryColor','#111111')));
end $$;

create or replace function public.record_sportlink_sync_v1(
  p_connection_id uuid,p_club jsonb,p_teams jsonb,p_matches jsonb,p_activities jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare connection public.sportlink_connections%rowtype;
  source_id uuid; read_count integer := 0; affected_count integer := 0;
begin
  select * into connection from public.sportlink_connections where id=p_connection_id;
  if connection.id is null then raise exception using errcode='P0002',message='connection_not_found'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and not private.has_tenant_capability(
    connection.tenant_id,'tenant.data_source.manage'
  ) then
    raise exception using errcode='42501',message='tenant_capability_required';
  end if;
  source_id := connection.data_source_id;
  if jsonb_typeof(p_club)='object' and p_club->>'externalId' is not null then
    insert into public.sports_clubs(
      tenant_id,source_connection_id,external_id,name,city,information,colors,last_synced_at
    ) values(connection.tenant_id,connection.id,p_club->>'externalId',p_club->>'name',
      nullif(p_club->>'city',''),nullif(p_club->>'information',''),
      coalesce(p_club->'colors','{}'),now())
    on conflict(tenant_id,source_connection_id,external_id) do update set
      name=excluded.name,city=excluded.city,information=excluded.information,
      colors=excluded.colors,last_synced_at=now(),active=true;
    read_count := read_count+1;
  end if;
  insert into public.sports_teams(
    tenant_id,source_connection_id,external_id,local_external_id,name,
    competition_name,category,gender,team_type,last_synced_at
  ) select connection.tenant_id,connection.id,item->>'externalId',
    nullif(item->>'localExternalId',''),item->>'name',
    nullif(item->>'competitionName',''),nullif(item->>'category',''),
    nullif(item->>'gender',''),nullif(item->>'teamType',''),now()
  from jsonb_array_elements(coalesce(p_teams,'[]')) item
  where item->>'externalId' is not null and item->>'name' is not null
  on conflict(tenant_id,source_connection_id,external_id) do update set
    name=excluded.name,competition_name=excluded.competition_name,
    category=excluded.category,gender=excluded.gender,team_type=excluded.team_type,
    last_synced_at=now(),active=true,missing_sync_count=0;
  get diagnostics affected_count = row_count;
  read_count := read_count+affected_count;
  if jsonb_array_length(coalesce(p_teams,'[]'::jsonb)) > 0 then
    update public.sports_teams team
    set missing_sync_count=team.missing_sync_count+1,
      active=case when team.missing_sync_count+1 >= 3 then false else team.active end
    where team.tenant_id=connection.tenant_id
      and team.source_connection_id=connection.id
      and not exists (
        select 1 from jsonb_array_elements(p_teams) item
        where item->>'externalId'=team.external_id
      );
  end if;
  insert into public.sports_matches(
    tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,
    competition,pool,venue,dressing_rooms,officials,is_home_match,
    cancellation_reason,scores_published,expires_at,last_synced_at
  ) select connection.tenant_id,connection.id,item->>'externalId',
    (item->>'startsAt')::timestamptz,item->>'status',item->'homeTeam',item->'awayTeam',
    item->'competition',item->'pool',coalesce(item->'venue','{}'),
    coalesce(item->'dressingRooms','{}'),coalesce(item->'officials','[]'),
    coalesce((item->>'isHomeMatch')::boolean,false),nullif(item->>'cancellationReason',''),
    (item->'homeTeam'->'score') is not null,((item->>'startsAt')::timestamptz+interval '2 days'),now()
  from jsonb_array_elements(coalesce(p_matches,'[]')) item
  where item->>'externalId' is not null and item->>'startsAt' is not null
  on conflict(tenant_id,source_connection_id,external_id) do update set
    starts_at=excluded.starts_at,status=excluded.status,home_team=excluded.home_team,
    away_team=excluded.away_team,competition=excluded.competition,pool=excluded.pool,
    venue=excluded.venue,dressing_rooms=excluded.dressing_rooms,officials=excluded.officials,
    cancellation_reason=excluded.cancellation_reason,scores_published=excluded.scores_published,
    expires_at=excluded.expires_at,last_synced_at=now(),active=true,missing_sync_count=0;
  get diagnostics affected_count = row_count;
  read_count := read_count+affected_count;
  if jsonb_array_length(coalesce(p_matches,'[]'::jsonb)) > 0 then
    update public.sports_matches match
    set missing_sync_count=match.missing_sync_count+1,
      active=case when match.missing_sync_count+1 >= 3 then false else match.active end
    where match.tenant_id=connection.tenant_id
      and match.source_connection_id=connection.id
      and match.starts_at >= now()-interval '14 days'
      and not exists (
        select 1 from jsonb_array_elements(p_matches) item
        where item->>'externalId'=match.external_id
      );
  end if;
  insert into public.sports_activities(
    tenant_id,source_connection_id,external_id,name,starts_at,ends_at,all_day,
    location,public_url,expires_at,last_synced_at
  ) select connection.tenant_id,connection.id,item->>'externalId',item->>'name',
    (item->>'startsAt')::timestamptz,(item->>'endsAt')::timestamptz,
    coalesce((item->>'allDay')::boolean,false),nullif(item->>'location',''),
    nullif(item->>'url',''),coalesce((item->>'endsAt')::timestamptz,
      (item->>'startsAt')::timestamptz+interval '1 day'),now()
  from jsonb_array_elements(coalesce(p_activities,'[]')) item
  where item->>'externalId' is not null and item->>'startsAt' is not null
  on conflict(tenant_id,source_connection_id,external_id) do update set
    name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
    all_day=excluded.all_day,location=excluded.location,public_url=excluded.public_url,
    expires_at=excluded.expires_at,last_synced_at=now(),active=true;
  get diagnostics affected_count = row_count;
  read_count := read_count+affected_count;
  update public.sportlink_connections set last_attempt_at=now(),last_success_at=now(),
    last_error_code=null,next_sync_at=now()+interval '1 hour' where id=connection.id;
  update public.dynamic_data_sources set provider_status='ready',
    last_attempt_at=now(),last_successful_sync_at=now(),last_error_code=null,
    revision=revision+1 where id=source_id;
  perform private.audit_event(connection.tenant_id,'sportlink.sync.completed',
    'sportlink_connections',connection.id,'success',jsonb_build_object('read',read_count));
  return jsonb_build_object('outcome','succeeded','readCount',read_count);
end $$;
grant execute on function public.record_sportlink_sync_v1(uuid,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

do $$
declare slide_type text; orientation text; template_id uuid; version_id uuid;
  width integer; height integer; markup text; css text; manifest jsonb;
begin
  foreach slide_type in array array[
    'sport_program','sport_results','sport_standing','sport_match_of_the_day',
    'sport_cancellations','sport_dressing_rooms','sport_activities','sport_sponsor'
  ] loop
    foreach orientation in array array['landscape','portrait'] loop
      width := case when orientation='landscape' then 1920 else 1080 end;
      height := case when orientation='landscape' then 1080 else 1920 end;
      markup := '<rect class="bg" width="100%" height="100%"/><text class="eyebrow" x="90" y="120">VEYOCAST CLUBTV</text><text class="title" x="90" y="220">{{sport.title}}</text><g transform="translate(90 300)">{{#each sport.items}}<g class="item"><text class="primary" x="0" y="0">{{primary}}</text><text class="secondary" x="0" y="54">{{secondary}}</text><text class="meta" x="' || (width-300)::text || '" y="0">{{meta}}</text></g>{{/each}}</g>';
      css := '.bg{fill:#f7f2e8}.eyebrow{font:700 28px Arial;fill:#f15a24}.title{font:700 72px Arial;fill:#111}.primary{font:700 38px Arial;fill:#111}.secondary,.meta{font:400 26px Arial;fill:#59544d}.item:nth-child(1){transform:translateY(0)}.item:nth-child(2){transform:translateY(90px)}.item:nth-child(3){transform:translateY(180px)}.item:nth-child(4){transform:translateY(270px)}.item:nth-child(5){transform:translateY(360px)}.item:nth-child(6){transform:translateY(450px)}.item:nth-child(7){transform:translateY(540px)}.item:nth-child(8){transform:translateY(630px)}';
      manifest := jsonb_build_object('schemaVersion',1,'engine','veyocast-safe-template-v1',
        'slideType',slide_type,'canvas',jsonb_build_object('width',width,'height',height),
        'maxCollectionItems',12,'allowedFields',jsonb_build_array(
          jsonb_build_object('path','sport.title','type','string','required',true),
          jsonb_build_object('path','sport.items','type','string','required',true),
          jsonb_build_object('path','sport.items.primary','type','string','required',false),
          jsonb_build_object('path','sport.items.secondary','type','string','required',false),
          jsonb_build_object('path','sport.items.meta','type','string','required',false)));
      insert into public.dynamic_templates(
        slug,name,description,category,slide_type,orientation,status
      ) values('sportlink-'||replace(replace(slide_type,'sport_',''),'_','-')||'-'||orientation,
        initcap(replace(replace(slide_type,'sport_',''),'_',' '))||' · '||
          case when orientation='landscape' then 'liggend' else 'staand' end,
        'Vaste premium Sportlink-referentietemplate.','sports',slide_type,orientation,'published')
      returning id into template_id;
      insert into public.dynamic_template_versions(
        template_id,version,status,markup,css,manifest_json,sample_data_json,
        source_checksum_sha256,published_at
      ) values(template_id,1,'published',markup,css,manifest,
        jsonb_build_object('type',slide_type,'sport',jsonb_build_object(
          'title','Clubprogramma','items',jsonb_build_array(jsonb_build_object(
            'primary','VeyoCast 1 – Bezoekers','secondary','Zaterdag 14:30',
            'meta','Veld 1')))),
        encode(extensions.digest(markup||css||manifest::text,'sha256'),'hex'),now())
      returning id into version_id;
      update public.dynamic_templates set current_published_version_id=version_id
        where id=template_id;
    end loop;
  end loop;
end $$;
