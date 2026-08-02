-- A tenant timezone is the single source of truth for Sportlink imports and
-- generated slides. Absolute instants remain timestamptz/UTC.

create or replace function private.set_sportlink_connection_tenant_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(settings.timezone_name, 'Europe/Amsterdam')
  into new.timezone
  from public.tenant_settings settings
  where settings.tenant_id = new.tenant_id;

  new.timezone := coalesce(new.timezone, 'Europe/Amsterdam');
  return new;
end
$$;

drop trigger if exists sportlink_connection_tenant_timezone
  on public.sportlink_connections;
create trigger sportlink_connection_tenant_timezone
before insert or update of tenant_id
on public.sportlink_connections
for each row execute function private.set_sportlink_connection_tenant_timezone();

create or replace function private.propagate_tenant_timezone_to_sportlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.timezone_name is distinct from old.timezone_name then
    update public.sportlink_connections
    set timezone = new.timezone_name
    where tenant_id = new.tenant_id
      and timezone is distinct from new.timezone_name;
  end if;
  return new;
end
$$;

drop trigger if exists tenant_settings_sportlink_timezone
  on public.tenant_settings;
create trigger tenant_settings_sportlink_timezone
after insert or update of timezone_name
on public.tenant_settings
for each row execute function private.propagate_tenant_timezone_to_sportlink();

revoke all on function private.set_sportlink_connection_tenant_timezone()
  from public, anon, authenticated;
revoke all on function private.propagate_tenant_timezone_to_sportlink()
  from public, anon, authenticated;

update public.sportlink_connections connection
set timezone = settings.timezone_name
from public.tenant_settings settings
where settings.tenant_id = connection.tenant_id
  and connection.timezone is distinct from settings.timezone_name;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
          'secondary',to_char(
            match.starts_at at time zone match.source_timezone,
            'DD-MM-YYYY HH24:MI'
          ),
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
      select m.*, c.timezone as source_timezone
      from public.sports_matches m
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
        'secondary',to_char(
          activity.starts_at at time zone activity.source_timezone,
          'DD-MM-YYYY HH24:MI'
        ),
        'meta',coalesce(activity.location,''),'status','scheduled'
      ) order by activity.starts_at),'[]'::jsonb),
      'emptyStateCode',case when count(*)=0 then 'NO_ACTIVITIES' else null end,
      'expiresAt',max(activity.expires_at)))
    into result from (
      select a.*, c.timezone as source_timezone
      from public.sports_activities a
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
end
$$;
