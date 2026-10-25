begin;

-- Canonical builders restamp the Menu receipt, Sportlink last-synced revisions,
-- source expiry and theme-resolution time on unchanged observations. Preserve
-- those values in raw data for validation/freshness, outside protocol-2 data
-- and snapshot identities. Keep scope, dataset labels/order, actual appearance
-- and content facts. Version-1 callers retain their original hash and bytes.
create or replace function private.sync_dom_semantic_data_v2(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 with semantic as (
  select p_data - 'generatedAt'
   #- '{sport,generatedAt}' #- '{menu,generatedAt}' #- '{news,generatedAt}'
   #- '{sport,fetchedAt}' #- '{news,fetchedAt}' #- '{menu,fetchedAt}'
   #- '{sport,snapshotExpiresAt}'
   #- '{themePresentation,resolvedMode,resolvedAt}'
   #- '{menuDocument,publication,publishedAt}'
   #- '{priceList,menuDocument,publication,publishedAt}' as data
 )
 select case when jsonb_typeof(data#>'{sport,matchday,context,revisions}')='array'
  then jsonb_set(data,'{sport,matchday,context,revisions}',(
   select coalesce(jsonb_agg(case when jsonb_typeof(value)='object'
    then value-'revision' else value end order by ordinal),'[]'::jsonb)
   from jsonb_array_elements(data#>'{sport,matchday,context,revisions}')
    with ordinality as observed(value,ordinal)
  ),false)
  else data end
 from semantic
$$;
revoke all on function private.sync_dom_semantic_data_v2(jsonb)
 from public, anon, authenticated, service_role;

commit;
