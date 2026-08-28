begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

select is(
  (
    select count(*)
    from public.dynamic_templates
    where slide_type = 'news'
      and orientation = 'portrait'
      and status = 'published'
  ),
  2::bigint,
  'both Editorial Arena portrait news modes are selectable'
);

select is(
  (
    select status
    from public.dynamic_templates
    where slug = 'news-editorial-portrait'
  ),
  'archived',
  'the previous portrait news variant is archived'
);

select is(
  (
    select count(*)
    from public.dynamic_template_versions version
    join public.dynamic_templates template
      on template.id = version.template_id
    where template.slide_type = 'news'
      and template.orientation = 'portrait'
      and version.status = 'published'
  ),
  2::bigint,
  'both Editorial Arena portrait news versions are published'
);

select is(
  (
    select count(*)
    from public.dynamic_templates
    where slug like 'editorial-arena-%'
      and status = 'published'
  ),
  52::bigint,
  'thirteen capability-backed types expose four Editorial Arena variants'
);

select is(
  (
    select count(*)
    from public.dynamic_templates
    where status = 'published'
      and slide_type in (
        'sport_match_of_the_day',
        'sport_period_standing',
        'sport_sponsor',
        'sport_team',
        'sport_trainings',
        'sport_volunteers'
      )
  ),
  0::bigint,
  'remaining types without a complete data flow stay inactive'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_scheduled_rss_sync_v2(uuid,text,jsonb,jsonb)',
    'execute'
  ),
  'tenant browser sessions cannot complete scheduled RSS media syncs'
);

select * from finish();
rollback;
