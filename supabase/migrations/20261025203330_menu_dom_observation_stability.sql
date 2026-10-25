begin;

-- The Menu builder restamps this receipt when it reads the same approved
-- document. It is observation metadata, independently of the price/product
-- facts. Both protocol-2 data and snapshot identities use this normalizer;
-- version-1 callers retain their original hash function and receipt bytes.
create or replace function private.sync_dom_semantic_data_v2(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 select p_data - 'generatedAt'
  #- '{sport,generatedAt}' #- '{menu,generatedAt}' #- '{news,generatedAt}'
  #- '{sport,fetchedAt}' #- '{news,fetchedAt}' #- '{menu,fetchedAt}'
  #- '{menuDocument,publication,publishedAt}'
  #- '{priceList,menuDocument,publication,publishedAt}'
$$;
revoke all on function private.sync_dom_semantic_data_v2(jsonb)
 from public, anon, authenticated, service_role;

commit;
