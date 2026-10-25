begin;
select plan(19);
-- These are identity contracts, not a second Menu renderer. A live canary
-- showed that the canonical builder restamps publication.publishedAt on reads.
create function pg_temp.menu_data(protocol integer default 2)returns jsonb language sql as $$
 select jsonb_build_object('syncPlaybackProtocol',protocol,'type','price_list','menuDocument',jsonb_build_object(
  'schemaVersion','menu-document.v2','revision',1,'publication',jsonb_build_object('publishedAt','2026-10-25T12:00:00Z','documentRevision',1,'rendererVersion','2.0.0'),
  'pages',jsonb_build_array(jsonb_build_object('products',jsonb_build_array(jsonb_build_object('id','coffee','name','Clubkoffie','price',250,'available',true,'imageChecksum',repeat('a',64)))))))
$$;
select is(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,publication,publishedAt}','"2026-10-25T12:05:00Z"')),'v2 root Menu publication observation cannot advance data identity');
select is(private.published_data_hash_v1(jsonb_build_object('syncPlaybackProtocol',2,'priceList',jsonb_build_object('menuDocument',pg_temp.menu_data()->'menuDocument'))),private.published_data_hash_v1(jsonb_build_object('syncPlaybackProtocol',2,'priceList',jsonb_build_object('menuDocument',jsonb_set(pg_temp.menu_data()->'menuDocument','{publication,publishedAt}','"2026-10-25T12:05:00Z"')))),'the canonical priceList alias has the same observation rule');
select is(private.published_data_hash_v1(pg_temp.menu_data(1)),private.published_data_hash_before_dom_v2(pg_temp.menu_data(1)),'historical v1 hashes remain byte-compatible');
select isnt(private.published_data_hash_v1(pg_temp.menu_data(1)),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(1),'{menuDocument,publication,publishedAt}','"2026-10-25T12:05:00Z"')),'v1 observations retain their historical contract');
select is(private.published_data_hash_v1(pg_temp.menu_data()-'syncPlaybackProtocol'),private.published_data_hash_before_dom_v2(pg_temp.menu_data()-'syncPlaybackProtocol'),'unversioned historical hashes remain compatible');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,pages,0,products,0,price}','325')),'a real approved price change changes identity');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,pages,0,products,0,name}','"Thee"')),'a product name change changes identity');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,pages,0,products,0,available}','false')),'availability remains semantic');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,pages,0,products,0,imageChecksum}',to_jsonb(repeat('b',64)))),'a verified image checksum remains semantic');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,publication,documentRevision}','2')),'publication document revision remains semantic');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,publication,rendererVersion}','"3.0.0"')),'publication renderer identity remains semantic');
select isnt(private.published_data_hash_v1(pg_temp.menu_data()),private.published_data_hash_v1(jsonb_set(pg_temp.menu_data(),'{menuDocument,revision}','2')),'the immutable document revision is preserved');
select is(private.sync_dom_semantic_data_v2(pg_temp.menu_data())#>'{menuDocument,publication,publishedAt}',null,'the v2 canonical identity omits only the observed publication time');
select is(private.sync_dom_semantic_data_v2(pg_temp.menu_data())#>'{menuDocument,publication,documentRevision}','1'::jsonb,'the rest of the publication receipt is retained');
select is(private.published_data_hash_v1('{"syncPlaybackProtocol":2,"type":"news","news":{"fetchedAt":"2026-10-25T12:00:00Z","articles":[]}}'),private.published_data_hash_v1('{"syncPlaybackProtocol":2,"type":"news","news":{"fetchedAt":"2026-10-25T12:05:00Z","articles":[]}}'),'existing RSS observation normalization is retained');
select ok(not has_function_privilege('anon','private.sync_dom_semantic_data_v2(jsonb)','execute'),'anonymous roles cannot execute the private normalizer');
select ok(not has_function_privilege('authenticated','private.sync_dom_semantic_data_v2(jsonb)','execute'),'tenant roles cannot execute the private normalizer directly');
select ok(not has_function_privilege('service_role','private.sync_dom_semantic_data_v2(jsonb)','execute'),'service role has no additional direct helper grant');
select is((select provolatile::text from pg_proc where oid='private.sync_dom_semantic_data_v2(jsonb)'::regprocedure),'i','identity normalization remains immutable');
select *from finish();
rollback;
