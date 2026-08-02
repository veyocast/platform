begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select is(
  (
    select count(*)
    from public.dynamic_templates
    where slide_type = 'news'
      and orientation = 'portrait'
      and status = 'published'
  ),
  1::bigint,
  'exactly one portrait news template remains selectable'
);

select is(
  (
    select status
    from public.dynamic_templates
    where slug = 'news-editorial-portrait'
  ),
  'withdrawn',
  'the previous portrait news variant is withdrawn'
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
  1::bigint,
  'exactly one portrait news template version remains published'
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
