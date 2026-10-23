-- S288: an explicit authoring selection of the newest authorized RSS articles.
-- Historical requests without newsSelection retain the full original reader.
begin;
create function private.sync_rss_article_limit_v1(p_slide_type text, p_configuration jsonb)
returns integer language plpgsql immutable security invoker set search_path = '' as $$
declare selection jsonb := p_configuration -> 'newsSelection'; maximum_articles integer;
begin
  if p_configuration ? 'newsSelection' then
    if p_slide_type is distinct from 'news'
      or not (p_configuration ? 'syncConfiguration')
      or jsonb_typeof(selection) is distinct from 'object'
      or not (selection ? 'maximumArticles')
      or (select count(*) from jsonb_object_keys(selection)) <> 1
      or jsonb_typeof(selection -> 'maximumArticles') is distinct from 'number'
      or coalesce(selection ->> 'maximumArticles', '') !~ '^[0-9]{1,2}$'
    then raise exception 'Explicit RSS article selection invalid' using errcode = '23514'; end if;
    maximum_articles := (selection ->> 'maximumArticles')::integer;
    if maximum_articles not between 1 and 20 then
      raise exception 'RSS selection must contain 1 to 20 newest articles' using errcode = '23514';
    end if;
  end if;

  return maximum_articles;
end;
$$;

create function private.validate_sync_rss_selection_v1() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.sync_rss_article_limit_v1(new.slide_type, new.configuration_json) is not null then
    perform private.assert_sync_dynamic_configuration_v1(new.tenant_id, new.slide_type,
      new.orientation, new.configuration_json -> 'syncConfiguration');
  end if;
  return new;
end;
$$;
create trigger dynamic_slides_validate_sync_rss_selection before insert or update of configuration_json,slide_type
  on public.dynamic_slides for each row execute function private.validate_sync_rss_selection_v1();
create trigger dynamic_slide_versions_validate_sync_rss_selection before insert or update of configuration_json,slide_type
  on public.dynamic_slide_versions for each row execute function private.validate_sync_rss_selection_v1();

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_before_rss_selection_v1;

create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  selection jsonb := p_slide.configuration_json -> 'newsSelection';
  result jsonb;
  maximum_articles integer;
begin
  maximum_articles := private.sync_rss_article_limit_v1(p_slide.slide_type, p_slide.configuration_json);

  -- Keep all existing tenant, provider, URL, media and publication checks.
  -- The inherited reader supplies its established newest-first ordering.
  result := private.build_dynamic_snapshot_before_rss_selection_v1(p_slide);
  if maximum_articles is not null then
    result := jsonb_set(result, '{news,articles}', (
      select coalesce(jsonb_agg(article order by ordinal), '[]'::jsonb)
      from jsonb_array_elements(result #> '{news,articles}')
        with ordinality as articles(article, ordinal)
      where ordinal <= maximum_articles
    ));
    result := jsonb_set(result, '{news,selection}', selection);
  end if;
  return result;
end;
$$;
revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides),
  private.build_dynamic_snapshot_before_rss_selection_v1(public.dynamic_slides),
  private.sync_rss_article_limit_v1(text,jsonb), private.validate_sync_rss_selection_v1()
  from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
