begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- SQL admission fixtures only. These tests do not claim real FFmpeg/device acceptance.
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000261151','Price owner A','s261-price-a'),
 ('10000000-0000-4000-8000-000000261152','Price owner B','s261-price-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000261151'),('10000000-0000-4000-8000-000000261152');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values
 ('00000000-0000-4000-8000-000000261151','authenticated','authenticated','price-a@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000261152','authenticated','authenticated','price-b@test.invalid','test',now(),now(),now(),'{}','{}'),
 ('00000000-0000-4000-8000-000000261153','authenticated','authenticated','price-reader@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000261151','Owner A'),('00000000-0000-4000-8000-000000261152','Owner B'),('00000000-0000-4000-8000-000000261153','Reader A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','tenant_owner'),
 ('10000000-0000-4000-8000-000000261152','00000000-0000-4000-8000-000000261152','tenant_owner'),
 ('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261153','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values
 ('20000000-0000-4000-8000-000000261151','10000000-0000-4000-8000-000000261151','First source','manual_products'),
 ('20000000-0000-4000-8000-000000261153','10000000-0000-4000-8000-000000261151','Other own source','manual_products'),
 ('20000000-0000-4000-8000-000000261152','10000000-0000-4000-8000-000000261152','Foreign source','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)
select '10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261151','manual','product-'||n,'Product '||lpad(n::text,3,'0'),250 from generate_series(1,61)n;
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values
 ('10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261153','manual','other-product','New source product',500);
create function pg_temp.source_config()returns jsonb language sql immutable as $function$select $configuration${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"fixtures","orientation":"landscape","theme":"fieldflow","name":"Gekoppeld bronontwerp","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"secondsPerPage":3}$configuration$::jsonb$function$;
create function pg_temp.request()returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,'dataSourceId','20000000-0000-4000-8000-000000261151','configuration',jsonb_build_object('maxItems',200,'syncConfiguration',jsonb_set(jsonb_set(pg_temp.source_config(),'{slideType}','"menu"'),'{seed,family}','"menu"')))
 from public.dynamic_templates where slug='editorial-arena-menubord-dark-landscape'and status='published';$$;

create temporary table price_results(name text primary key,value jsonb);
grant select,insert,update on price_results to authenticated,service_role;
create function pg_temp.price_artifact(p_snapshot uuid)returns jsonb language sql stable as $f$
 with input as(select s.*,j.output_media_asset_id as job_output_media_asset_id,greatest(1,ceil(jsonb_array_length(s.snapshot_data_json#>'{menu,products}')::numeric/(s.snapshot_data_json#>>'{syncConfiguration,seed,rowsPerPage}')::integer)::integer)pages
  from public.dynamic_slide_snapshots s join public.dynamic_render_jobs j on j.snapshot_id=s.id where s.id=p_snapshot),
 output as(select *,pages>1 or snapshot_data_json#>>'{syncConfiguration,seed,style,motion}'in('rustig','dynamisch')is_video from input)
 select jsonb_build_object('mimeType',case when is_video then'video/mp4'else'image/png'end,'durationMs',pages*(snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer*1000,
 'width',1920,'height',1080,'byteLength',4096,'checksumSha256',repeat('d',64),
 'storagePath','tenants/'||tenant_id||'/assets/'||job_output_media_asset_id||'/sync-dynamic/'||repeat('d',64)||case when is_video then'.mp4'else'.png'end,
 'presentation',jsonb_set(snapshot_data_json#>'{syncConfiguration,seed}','{rows}',(select jsonb_agg(jsonb_build_array(value->>'name','€ '||replace(to_char((value->>'priceMinor')::numeric/100,'FM999999990.00'),'.',','),'','')order by ordinality)from jsonb_array_elements(snapshot_data_json#>'{menu,products}')with ordinality)),
 'poster',jsonb_build_object('byteLength',case when is_video then 1024 else 4096 end,'checksumSha256',repeat(case when is_video then'e'else'd'end,64),'storagePath','tenants/'||tenant_id||'/assets/'||job_output_media_asset_id||'/sync-dynamic/'||repeat(case when is_video then'e'else'd'end,64)||'.png'))from output;$f$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('created',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','create',null,null,0,pg_temp.request(),'40000000-0000-4000-8000-000000261151'));
select ok((select value?'snapshotId'from price_results where name='created'),'ordinary Source create obtains an existing canonical render');
select throws_ok($$select public.create_dynamic_slide_v1('10000000-0000-4000-8000-000000261151','Forged',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261151','latest',(pg_temp.request()->'configuration')||jsonb_build_object('menuPriceSet','{}'::jsonb))$$,'42501',null,'ordinary create rejects a client-supplied set');
reset role;
set local role service_role;
create temporary table price_claim as select *from public.claim_dynamic_render_job_v2('price-base',60,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from price_claim),'price-base',(select lease_token from price_claim),pg_temp.price_artifact((select snapshot_id from price_claim)))$$,'admitted initial output completes the normal published version');
reset role;
insert into price_results select 'baseline',jsonb_build_object('slideId',id,'versionId',current_published_version_id,'snapshotId',current_snapshot_id,'configuration',configuration_json,'slideRevision',revision)from public.dynamic_slides where id=(select(value->>'slideId')::uuid from price_results where name='created');
insert into price_results select 'old-snapshot',to_jsonb(s)from public.dynamic_slide_snapshots s where id=(select(value->>'snapshotId')::uuid from price_results where name='baseline');
select ok((select configuration_json?'menuPriceSet'from public.dynamic_slides where id=(select(value->>'slideId')::uuid from price_results where name='created')),'SQL stores an authoritative initial price set');
select is(has_function_privilege('authenticated','private.capture_menu_price_set_v1(uuid,uuid,jsonb,text)','execute'),false,'browser roles cannot call private capture');
select is(has_function_privilege('anon','public.prepare_menu_price_candidates_v1(uuid,text,jsonb,uuid)','execute'),false,'anonymous callers cannot prepare');
update public.tenant_products set price_cents=350 where tenant_id='10000000-0000-4000-8000-000000261151'and slug='product-61';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('review',public.read_menu_price_impact_v1('10000000-0000-4000-8000-000000261151',0,20));
select is((select(value->>'totalProducts')::integer from price_results where name='review'),62,'impact covers the whole catalogue, not fifty visible rows');
select is((select(value->>'changedProducts')::integer from price_results where name='review'),1,'a product beyond the first catalogue page appears in the exact diff');
select is((select value#>>'{rows,0,name}'from price_results where name='review'),'Product 061','the off-page changed product is identified');
select is((select value#>>'{rows,0,previousCatalogPrices,0}'from price_results where name='review'),'250','the old approved integer price remains explicit');
select is((select value#>>'{rows,0,nextCatalogPrice}'from price_results where name='review'),'350','the new catalogue price is separate');
select throws_ok($$select public.read_menu_price_impact_v1('10000000-0000-4000-8000-000000261152',0,20)$$,'42501',null,'tenant A cannot read tenant B impact');
insert into price_results select 'selection',jsonb_build_array(jsonb_build_object('slideId',value#>>'{menus,0,slideId}','basisVersionId',value#>>'{menus,0,basisVersionId}','expectedRevision',(value#>>'{menus,0,expectedRevision}')::bigint))from price_results where name='review';
select throws_ok($$select public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',(select value->>'reviewHash'from price_results where name='review'),'[]','40000000-0000-4000-8000-000000261152')$$,'22023',null,'empty selection never means all menus');
insert into price_results values('prepared',public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',(select value->>'reviewHash'from price_results where name='review'),(select value from price_results where name='selection'),'40000000-0000-4000-8000-000000261153'));
select is((select value#>>'{candidates,0,state}'from price_results where name='prepared'),'draft','capture does not secretly publish');
select is(public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',(select value->>'reviewHash'from price_results where name='review'),(select value from price_results where name='selection'),'40000000-0000-4000-8000-000000261153'),(select value from price_results where name='prepared'),'lost response replays before the now-changed CAS/hash');
select throws_ok($$select public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',repeat('b',64),(select value from price_results where name='selection'),'40000000-0000-4000-8000-000000261153')$$,'23505',null,'same nonce cannot become a different capture');
reset role;
select is((select to_jsonb(s)from public.dynamic_slide_snapshots s where id=(select(value->>'snapshotId')::uuid from price_results where name='baseline')),(select value from price_results where name='old-snapshot'),'preparing a price candidate does not mutate the old snapshot');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000261151'),1::bigint,'capture creates no render job');
update public.tenant_products set price_cents=450 where tenant_id='10000000-0000-4000-8000-000000261151'and slug='product-61';
select is((select configuration_json#>>array['menuPriceSet','prices',(select id::text from public.tenant_products where tenant_id='10000000-0000-4000-8000-000000261151'and slug='product-61')]from public.dynamic_slide_versions where id=(select(value#>>'{candidates,0,versionId}')::uuid from price_results where name='prepared')),'350','a candidate retains reviewed prices after another catalogue change');

-- Ordinary editor writes cannot turn a browser hash into SQL price authority.
create function pg_temp.save_price_draft(p_configuration jsonb,p_source uuid default '20000000-0000-4000-8000-000000261151')returns jsonb language sql as $$
 select public.save_dynamic_slide_version_v1(v.dynamic_slide_id,v.id,v.edit_revision,v.name,v.template_version_id,p_source,v.orientation,v.selection_mode,p_configuration,v.theme_selection_json)
 from public.dynamic_slide_versions v where v.id=(select(value#>>'{candidates,0,versionId}')::uuid from price_results where name='prepared');$$;
insert into price_results select 'candidate-config',configuration_json from public.dynamic_slide_versions where id=(select(value#>>'{candidates,0,versionId}')::uuid from price_results where name='prepared');
insert into price_results select 'forged-config',jsonb_set(value,'{menuPriceSet}',(value->'menuPriceSet')||jsonb_build_object('prices',jsonb_build_object((select id::text from public.tenant_products where tenant_id='10000000-0000-4000-8000-000000261151'and slug='product-61'),1)))from price_results where name='candidate-config';
update price_results set value=jsonb_set(value,'{menuPriceSet,hash}',to_jsonb(private.menu_price_hash_v1((value->'menuPriceSet')-'hash')))where name='forged-config';
select throws_ok($$select private.assert_menu_price_set_v1('10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261151',(select value->'menuPriceSet'from price_results where name='forged-config'))$$,'42501',null,'a coherent client hash is not a durable SQL capture receipt');
select throws_ok($$select private.assert_menu_price_set_v1('10000000-0000-4000-8000-000000261152','20000000-0000-4000-8000-000000261151',(select value->'menuPriceSet'from price_results where name='candidate-config'))$$,'42501',null,'the exact valid set cannot cross a tenant boundary');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select throws_ok($$select pg_temp.save_price_draft((select value from price_results where name='forged-config'))$$,'42501',null,'ordinary save rejects even correctly rehashed client prices');
select throws_ok($$select pg_temp.save_price_draft((select value-'menuPriceSet'from price_results where name='candidate-config'))$$,'42501',null,'ordinary save cannot silently remove a price authority');
select throws_ok($$select pg_temp.save_price_draft((select value||jsonb_build_object('menuPriceSourceReview',jsonb_build_object('sourceId','20000000-0000-4000-8000-000000261151','priceReviewHash',repeat('a',64),'confirmed',true))from price_results where name='candidate-config'))$$,'42501',null,'same-source confirmation is not a hidden catalogue recapture path');
select throws_ok($$select pg_temp.save_price_draft((select value from price_results where name='candidate-config'),'20000000-0000-4000-8000-000000261153')$$,'42501',null,'changing a source requires its own fresh explicit review');
select throws_ok($$update public.dynamic_slide_versions set configuration_json='{}'where id=(select(value#>>'{candidates,0,versionId}')::uuid from price_results where name='prepared')$$,'42501',null,'authenticated callers cannot bypass the command by updating a version');
insert into price_results select 'publish-selection',jsonb_build_array(jsonb_build_object('slideId',value#>>'{candidates,0,slideId}','versionId',value#>>'{candidates,0,versionId}','expectedRevision',(value#>>'{candidates,0,editRevision}')::bigint))from price_results where name='prepared';
select throws_ok($$select public.publish_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153','[]','40000000-0000-4000-8000-000000261154')$$,'22023',null,'no selection cannot publish all captured menus');
insert into price_results values('published',public.publish_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153',(select value from price_results where name='publish-selection'),'40000000-0000-4000-8000-000000261155'));
select is((select value#>>'{candidates,0,state}'from price_results where name='published'),'pending','the explicit second command enters the ordinary render pipeline, not TV activation');
select is(public.publish_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153',(select value from price_results where name='publish-selection'),'40000000-0000-4000-8000-000000261155'),(select value from price_results where name='published'),'publish lost-ACK replay retains its original receipt before mutable CAS');
reset role;
select is((select count(*)from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000261151'),0::bigint,'candidate publication does not create or assign an immutable playlist release');
set local role service_role;
create temporary table candidate_claim as select *from public.claim_dynamic_render_job_v2('price-candidate',60,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from candidate_claim),'price-candidate',(select lease_token from candidate_claim),pg_temp.price_artifact((select snapshot_id from candidate_claim)))$$,'the candidate completes through the existing admitted render writer');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select is(public.read_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153')#>>'{candidates,0,state}','ready','pure status read sees readiness only after the existing output admission');
insert into price_results values('source-draft',public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from price_results where name='baseline'),(select(value#>>'{candidates,0,versionId}')::uuid from price_results where name='prepared')));
reset role;
-- Reuse the ordinary save helper against the newly opened design draft.
update price_results set value=jsonb_set(value,'{candidates,0,versionId}',(select value->'versionId'from price_results where name='source-draft'))where name='prepared';
insert into price_results select 'source-config',configuration_json-'menuPriceSet'from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='source-draft');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('source-preview',public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000261151','New source',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261153',(select value from price_results where name='source-config')));
select alike((select value->>'priceReviewHash'from price_results where name='source-preview'),repeat('_',64),'ordinary read-only preview supplies a complete source review fingerprint');
select throws_ok($$select pg_temp.save_price_draft((select value||jsonb_build_object('menuPriceSourceReview',jsonb_build_object('sourceId','20000000-0000-4000-8000-000000261153','priceReviewHash',repeat('a',64),'confirmed',true))from price_results where name='source-config'),'20000000-0000-4000-8000-000000261153')$$,'40001',null,'a stale source preview cannot commit a new price set');
insert into price_results select 'source-command',jsonb_build_object('templateVersionId',(pg_temp.request()->>'templateVersionId'),'dataSourceId','20000000-0000-4000-8000-000000261153','configuration',value||jsonb_build_object('menuPriceSourceReview',jsonb_build_object('sourceId','20000000-0000-4000-8000-000000261153','priceReviewHash',(select value->>'priceReviewHash'from price_results where name='source-preview'),'confirmed',true)))from price_results where name='source-config';
insert into price_results select 'source-command-revision',to_jsonb(edit_revision)from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='source-draft');
insert into price_results values('source-saved',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','save',(select(value->>'slideId')::uuid from price_results where name='baseline'),(select(value->>'versionId')::uuid from price_results where name='source-draft'),(select(value::text)::bigint from price_results where name='source-command-revision'),(select value from price_results where name='source-command'),'40000000-0000-4000-8000-000000261160'));
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','save',(select(value->>'slideId')::uuid from price_results where name='baseline'),(select(value->>'versionId')::uuid from price_results where name='source-draft'),(select(value::text)::bigint from price_results where name='source-command-revision'),(select value from price_results where name='source-command'),'40000000-0000-4000-8000-000000261160'),(select value from price_results where name='source-saved'),'ordinary source-switch lost ACK replays exact command/configuration after the CAS revision changed');
select is((select value#>>'{configuration,menuPriceSet,dataSourceId}'from price_results where name='source-saved'),'20000000-0000-4000-8000-000000261153','source save returns the actual canonical new-source price authority');
select ok((select not(value->'configuration'?'menuPriceSourceReview')from price_results where name='source-saved'),'transient confirmation does not persist as reusable price authority');
reset role;
select is((select to_jsonb(s)from public.dynamic_slide_snapshots s where id=(select(value->>'snapshotId')::uuid from price_results where name='baseline')),(select value from price_results where name='old-snapshot'),'a later source switch leaves the old published snapshot byte-equal');

-- Pure shape boundaries use complete money leaves, never inferred override intent.
select is(private.pin_menu_prices_v1('{"special":{"id":"x","priceMinor":999,"currency":"EUR"},"name":"live"}','{}'),'{"name":"live"}'::jsonb,'an unpriced nested object is omitted instead of keeping its live price');
select is(private.pin_menu_prices_v1('{"id":"x","priceMinor":999,"currency":"USD","unit":"glass","taxRateBps":900}','{"id":"x","priceMinor":250,"currency":"EUR","unit":"bottle","taxRateBps":2100}'),'{"id":"x","priceMinor":250,"currency":"EUR","unit":"bottle","taxRateBps":2100}'::jsonb,'amount, currency, unit and VAT metadata stay frozen together');
select is(private.pin_menu_prices_v1('{"kind":"product","snapshotFallback":{"price":{"currency":"USD","amountMinor":999,"unitKey":"glass","taxMode":"exclusive","taxRateBps":900}}}','{"kind":"product","snapshotFallback":{"price":{"currency":"EUR","amountMinor":250,"unitKey":"bottle","taxMode":"inclusive","taxRateBps":2100}}}')#>'{snapshotFallback,price}','{"currency":"EUR","amountMinor":250,"unitKey":"bottle","taxMode":"inclusive","taxRateBps":2100}'::jsonb,'MenuDoc render pins the full money leaf before shared-group validation');
select is(private.apply_menu_price_set_v1('{"priceList":{"sections":[{"products":[{"id":"placement","productId":"00000000-0000-4000-8000-000000261111","formattedPrice":"€ 2,50"}]}]}}','{"00000000-0000-4000-8000-000000261111":900}','{"sections":[{"id":"placement","priceCentsOverride":250}]}')#>>'{priceList,sections,0,products,0,formattedPrice}','€ 2,50','an explicit equal-valued placement override stays manual');
select is(private.preserve_menu_manual_prices_v1('{"kind":"product-group","pricePolicy":"shared","sharedPrice":{"amountMinor":900,"currency":"EUR"},"items":[{"kind":"product","snapshotFallback":{"price":{"amountMinor":900,"currency":"EUR"}}}]}','{"kind":"product-group","pricePolicy":"shared","sharedPrice":{"amountMinor":250,"currency":"EUR"},"items":[{"kind":"product","snapshotFallback":{"price":{"amountMinor":250,"currency":"EUR"}}}]}')#>>'{items,0,snapshotFallback,price,amountMinor}','250','explicit shared-group price policy survives catalogue candidate capture');

select is(private.pin_menu_prices_v1('[{"id":"x","priceMinor":999,"currency":"EUR"}]','[{"id":"x","priceMinor":null,"currency":"EUR"}]'),'[]'::jsonb,'JSONnull in an older snapshot is unpriced, never a current-price fallback');
select is(private.pin_menu_prices_v1('{"special":{"kind":"product","snapshotFallback":{"price":{"amountMinor":999,"currency":"EUR"}}}}','{"special":{"kind":"product","snapshotFallback":{"price":null}}}'),'{}'::jsonb,'a MenuDoc object with no old money is omitted rather than resolved at a current price');
select is(private.menu_snapshot_prices_v1('{"menu":{"products":[{"id":"00000000-0000-4000-8000-000000261111","priceMinor":null,"currency":"EUR"},{"id":"00000000-0000-4000-8000-000000261112","priceMinor":250,"currency":"EUR"}]}}','{}'),'{"00000000-0000-4000-8000-000000261112":250}'::jsonb,'legacy anchoring includes only real approved money and keeps other known prices');

select is(private.pin_menu_prices_v1('[{"id":"x","priceMinor":999,"currency":"EUR"}]','[{"id":"x","priceMinor":250.0,"currency":"EUR"}]'),'[{"id":"x","priceMinor":250,"currency":"EUR"}]'::jsonb,'valid integral JSON250.0 stays approved, rather than being treated as unpriced');
select is(private.menu_snapshot_prices_v1('{"menu":{"products":[{"id":"00000000-0000-4000-8000-000000261111","priceMinor":250.0,"currency":"EUR"},{"id":"00000000-0000-4000-8000-000000261112","priceMinor":250.5,"currency":"EUR"},{"id":"00000000-0000-4000-8000-000000261113","priceMinor":-1,"currency":"EUR"},{"id":"00000000-0000-4000-8000-000000261114","priceMinor":"250","currency":"EUR"}]}}','{}'),'{"00000000-0000-4000-8000-000000261111":250}'::jsonb,'legacy anchoring accepts integral numeric representation and omits fraction, negative and string values');

-- One real Source full-selection fixture combines every live-price boundary:
-- 200 approved IDs, X initially unavailable, X returns with a changed catalogue
-- price, Y is newly inserted as row201, and a known current name still refreshes.
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('20000000-0000-4000-8000-000000261154','10000000-0000-4000-8000-000000261151','Two hundred approved','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents,available)
select '10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261154','manual','bounded-'||n,'Bounded '||lpad(n::text,3,'0'),250,n<>200 from generate_series(1,200)n;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('bounded-create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','create',null,null,0,jsonb_set(jsonb_set(pg_temp.request(),'{dataSourceId}','"20000000-0000-4000-8000-000000261154"'),'{configuration,syncConfiguration,seed,rowsPerPage}','8'),'40000000-0000-4000-8000-000000261156'));
reset role;
set local role service_role;
create temporary table bounded_claim as select *from public.claim_dynamic_render_job_v2('price-bounded',60,3);
select lives_ok($$select public.complete_dynamic_render_job_v2((select job_id from bounded_claim),'price-bounded',(select lease_token from bounded_claim),pg_temp.price_artifact((select snapshot_id from bounded_claim)))$$,'the actual Source200 selection renders through the normal full-selection admission');
reset role;
insert into price_results select 'bounded-baseline',to_jsonb(s)from public.dynamic_slide_snapshots s where s.id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create');
select is((select jsonb_array_length(value#>'{snapshot_data_json,menu,products}')from price_results where name='bounded-baseline'),199,'unavailable X is absent from the visible baseline');
select is((select count(*)from price_results,jsonb_object_keys(value#>'{snapshot_data_json,menuPriceSet,prices}')where name='bounded-baseline'),200::bigint,'the approved authority includes temporarily unavailable X');
insert into public.playlists(id,tenant_id,name)values('50000000-0000-4000-8000-000000261151','10000000-0000-4000-8000-000000261151','Frozen price reference');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select public.mutate_playlist_batch_v1('50000000-0000-4000-8000-000000261151',0,jsonb_build_array(jsonb_build_object('operation','add_sync_dynamic','clientId','60000000-0000-4000-8000-000000261151','dynamicSlideId',(select value->>'slideId'from price_results where name='bounded-create'),'expectedSnapshotId',(select value->>'snapshotId'from price_results where name='bounded-create'),'snapshotId',(select value->>'snapshotId'from price_results where name='bounded-create'),'durationSeconds',75)),'40000000-0000-4000-8000-000000261157');
reset role;
-- Explicit SQL publication fixture, not an assertion of an active physical TV.
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)values('70000000-0000-4000-8000-000000261151','10000000-0000-4000-8000-000000261151','50000000-0000-4000-8000-000000261151',1,repeat('f',64),'{}',1,75,4096);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,source_item_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256)
select item.tenant_id,item.playlist_id,'70000000-0000-4000-8000-000000261151',item.id,asset.id,variant.id,0,item.duration_seconds,item.fit_mode,item.muted,asset.kind,asset.title,variant.storage_path,variant.mime_type,variant.file_size_bytes,variant.checksum_sha256
from public.playlist_items item join public.media_assets asset on asset.id=item.media_asset_id and asset.tenant_id=item.tenant_id join public.media_variants variant on variant.asset_id=asset.id and variant.tenant_id=asset.tenant_id and variant.variant_type='player_1080p'where item.playlist_id='50000000-0000-4000-8000-000000261151';
insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id)values('80000000-0000-4000-8000-000000261151','10000000-0000-4000-8000-000000261151','SQL price reference','landscape','active','50000000-0000-4000-8000-000000261151','70000000-0000-4000-8000-000000261151');
insert into price_results select 'bounded-release',to_jsonb(r)from public.playlist_releases r where id='70000000-0000-4000-8000-000000261151';
update public.tenant_products set available=true,price_cents=999 where tenant_id='10000000-0000-4000-8000-000000261151'and slug='bounded-200';
update public.tenant_products set name='Known current name'where tenant_id='10000000-0000-4000-8000-000000261151'and slug='bounded-1';
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values('10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261154','manual','bounded-201','New unpriced Y',777);
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000261154';
update private.published_data_refresh_queue set next_attempt_at=clock_timestamp()+'1 hour'::interval where snapshot_id<>(select(value->>'snapshotId')::uuid from price_results where name='bounded-create');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into price_results values('bounded-live-claim',public.claim_published_data_refresh_v1('price-live',60));
select is((select value->>'snapshotId'from price_results where name='bounded-live-claim'),(select value->>'snapshotId'from price_results where name='bounded-create'),'the live worker claims the exact referenced price-bound snapshot');
select is(public.complete_published_data_refresh_v1('10000000-0000-4000-8000-000000261151',(select(value->>'snapshotId')::uuid from price_results where name='bounded-create'),(select(value->>'leaseToken')::uuid from price_results where name='bounded-live-claim'))->>'status','completed','new row201 does not fail the actual current-facts worker before filtering');
reset role;
select is((select value->>'priceMinor'from public.published_dynamic_data,jsonb_array_elements(data_json#>'{menu,products}')where snapshot_id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')and value->>'name'='Bounded 200'),'250','approved unavailable X returns at its captured price, never the new999 catalogue price');
select ok((select exists(select 1 from jsonb_array_elements(data_json#>'{menu,products}')where value->>'name'='Known current name')from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')),'known names stay live');
select is((select jsonb_array_length(data_json#>'{menu,products}')from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')),200,'all200 approved IDs remain visible after the raw source grew to201');
select ok((select not exists(select 1 from jsonb_array_elements(data_json#>'{menu,products}')where value->>'name'='New unpriced Y')from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')),'genuinely unpriced Y is excluded before the actual201 overflow guard');
update public.tenant_products set available=false where tenant_id='10000000-0000-4000-8000-000000261151'and slug='bounded-2';
update public.dynamic_data_sources set revision=revision+1 where id='20000000-0000-4000-8000-000000261154';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into price_results values('availability-live-claim',public.claim_published_data_refresh_v1('price-availability',60));
select is(public.complete_published_data_refresh_v1('10000000-0000-4000-8000-000000261151',(select(value->>'snapshotId')::uuid from price_results where name='bounded-create'),(select(value->>'leaseToken')::uuid from price_results where name='availability-live-claim'))->>'status','completed','a later availability change follows the same live worker chain');
reset role;
select ok((select not exists(select 1 from jsonb_array_elements(data_json#>'{menu,products}')where value->>'name'in('Bounded 002','New unpriced Y'))from public.published_dynamic_data where snapshot_id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')),'known current unavailability applies while unpriced Y remains excluded');
select is((select to_jsonb(s)from public.dynamic_slide_snapshots s where id=(select(value->>'snapshotId')::uuid from price_results where name='bounded-create')),(select value from price_results where name='bounded-baseline'),'live refresh leaves the original immutable snapshot unchanged');
select is((select to_jsonb(r)from public.playlist_releases r where id='70000000-0000-4000-8000-000000261151'),(select value from price_results where name='bounded-release'),'live availability refresh does not create or alter the frozen release');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select throws_ok($$select public.create_dynamic_slide_v1('10000000-0000-4000-8000-000000261151','Too large',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261154','latest',pg_temp.request()->'configuration')$$,'23514',null,'ordinary new authoring still rejects a201-product selection');
reset role;
-- Foreign-overflow catalogue does not leak its size through the private reader.
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)select '10000000-0000-4000-8000-000000261152','20000000-0000-4000-8000-000000261152','manual','foreign-'||n,'Foreign '||n,250 from generate_series(1,201)n;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select throws_ok($$select public.create_dynamic_slide_v1('10000000-0000-4000-8000-000000261152','Forbidden',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261152','latest',pg_temp.request()->'configuration')$$,'42501',null,'foreign overflow remains behind the authorization boundary');
select throws_ok($$select public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000261152','Forbidden',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261152',pg_temp.request()->'configuration')$$,'42501',null,'foreign preview cannot reveal catalogue shape');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261153',true);
select throws_ok($$select public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',repeat('a',64),(select value from price_results where name='selection'),'40000000-0000-4000-8000-000000261158')$$,'42501',null,'a reader cannot capture or create concepts');
select throws_ok($$select public.publish_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153',(select value from price_results where name='publish-selection'),'40000000-0000-4000-8000-000000261159')$$,'42501',null,'a reader cannot publish candidates');
reset role;

-- Real MenuDoc public writers all share the reserved-key validator boundary.
update public.tenant_settings set menu_document_v2_read_enabled=true,menu_studio_v2_authoring_enabled=true,menu_studio_v2_linked_groups_enabled=true,menu_studio_v2_media_enabled=true,menu_studio_v2_publish_enabled=true,menu_studio_v2_player_enabled=true where tenant_id='10000000-0000-4000-8000-000000261151';
create function pg_temp.menu_document()returns jsonb language sql immutable as $$select '{"schemaVersion":"menu-document.v2","id":"draft","tenantId":"draft","revision":1,"createdAt":"2026-10-19T12:00:00Z","updatedAt":"2026-10-19T12:00:00Z","title":"Menu boundary","theme":{"themeId":"fieldflow","themeVersion":"1.0.0","mode":"light","brand":{"accent":"#FF5C20"}},"assets":[],"pages":[{"id":"page-1","order":0,"blocks":[]}]}'::jsonb$$;
create function pg_temp.create_menu(p_extra jsonb,p_key uuid)returns jsonb language sql as $$select public.create_menu_studio_draft_v2('10000000-0000-4000-8000-000000261151','Menu boundary',current_published_version_id,'20000000-0000-4000-8000-000000261153','latest',pg_temp.menu_document()||p_extra,p_key)from public.dynamic_templates where slide_type='price_list'and orientation='landscape'and status='published'order by slug limit 1$$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select throws_ok($$select pg_temp.create_menu('{"menuApprovedPrices":{}}','40000000-0000-4000-8000-000000261161')$$,'42501',null,'MenuDoc create cannot store the internal approved-price map');
select throws_ok($$select pg_temp.create_menu('{"menuRuntimePriceSnapshotId":"00000000-0000-4000-8000-000000261111"}','40000000-0000-4000-8000-000000261162')$$,'42501',null,'MenuDoc create cannot store a synthetic runtime snapshot identity');
insert into price_results values('menu-created',pg_temp.create_menu('{}','40000000-0000-4000-8000-000000261163'));
select throws_ok($$select public.save_menu_studio_document_v2((select(value->>'slideId')::uuid from price_results where name='menu-created'),1,'40000000-0000-4000-8000-000000261164','{"kind":"restore-content"}',(select value->'document'||'{"menuApprovedPrices":{}}'::jsonb from price_results where name='menu-created'))$$,'42501',null,'MenuDoc save/restore cannot persist an internal approved-price map');
select throws_ok($$select public.save_menu_studio_document_v2((select(value->>'slideId')::uuid from price_results where name='menu-created'),1,'40000000-0000-4000-8000-000000261165','{"kind":"restore-content"}',(select value->'document'||'{"menuRuntimePriceSnapshotId":"00000000-0000-4000-8000-000000261111"}'::jsonb from price_results where name='menu-created'))$$,'42501',null,'MenuDoc save/restore cannot persist an internal runtime snapshot');
select throws_ok($$select public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000261151','Internal',(pg_temp.request()->>'templateVersionId')::uuid,'20000000-0000-4000-8000-000000261151',(pg_temp.request()->'configuration')||'{"menuApprovedPrices":{}}'::jsonb)$$,'42501',null,'ordinary Source preview rejects runtime-map injection');
reset role;

-- A retained receipt is authority even after real origin-version retention.
-- A normal restored version copies the price set; it does not recapture600.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('copy-create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','create',null,null,0,jsonb_set(pg_temp.request(),'{dataSourceId}','"20000000-0000-4000-8000-000000261153"'),'40000000-0000-4000-8000-000000261166'));
reset role;
set local role service_role;
create temporary table copy_claim as select *from public.claim_dynamic_render_job_v2('copy-origin',60,3);
select public.complete_dynamic_render_job_v2((select job_id from copy_claim),'copy-origin',(select lease_token from copy_claim),pg_temp.price_artifact((select snapshot_id from copy_claim)));
reset role;
insert into price_results select 'copy-origin',jsonb_build_object('versionId',current_published_version_id,'configuration',configuration_json)from public.dynamic_slides where id=(select(value->>'slideId')::uuid from price_results where name='copy-create');
update public.tenant_products set price_cents=600 where tenant_id='10000000-0000-4000-8000-000000261151'and slug='other-product';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('copy-draft',public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from price_results where name='copy-create'),(select(value->>'versionId')::uuid from price_results where name='copy-origin')));
select is((select configuration_json->'menuPriceSet'from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='copy-draft')),(select value#>'{configuration,menuPriceSet}'from price_results where name='copy-origin'),'normal restore copies the exact approved set while catalogue price changes');
select public.publish_dynamic_slide_version_v1((select(value->>'slideId')::uuid from price_results where name='copy-create'),(select(value->>'versionId')::uuid from price_results where name='copy-draft'),(select edit_revision from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='copy-draft')));
reset role;
set local role service_role;
create temporary table restored_claim as select *from public.claim_dynamic_render_job_v2('copy-restored',60,3);
select public.complete_dynamic_render_job_v2((select job_id from restored_claim),'copy-restored',(select lease_token from restored_claim),pg_temp.price_artifact((select snapshot_id from restored_claim)));
select set_config('request.jwt.claim.role','service_role',true);
select public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000261151',100);
reset role;
select is((select count(*)from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='copy-origin')),0::bigint,'the actual old origin version is pruned');
select lives_ok($$select private.assert_menu_price_set_v1('10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261153',(select value#>'{configuration,menuPriceSet}'from price_results where name='copy-origin'))$$,'price authority survives origin-version deletion because the receipt remains');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('copy-variant',public.prepare_sync_dynamic_variant_v1('10000000-0000-4000-8000-000000261151',(select current_snapshot_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from price_results where name='copy-create')),'onzetrots-tv',3,'40000000-0000-4000-8000-000000261167'));
select is((select configuration_json->'menuPriceSet'from public.dynamic_slide_versions where id=(select(value->>'versionId')::uuid from price_results where name='copy-variant')),(select value#>'{configuration,menuPriceSet}'from price_results where name='copy-origin'),'the existing placement variant copies durable price authority after origin pruning');
reset role;

-- Two validly selected menus: first capture succeeds internally, the second
-- source cannot be captured. The statement must roll back all earlier effects.
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('20000000-0000-4000-8000-000000261155','10000000-0000-4000-8000-000000261151','Atomic other source','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)values('10000000-0000-4000-8000-000000261151','20000000-0000-4000-8000-000000261155','manual','atomic-other','Atomic other product',500);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('atomic-create',public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000261151','create',null,null,0,jsonb_set(pg_temp.request(),'{dataSourceId}','"20000000-0000-4000-8000-000000261155"'),'40000000-0000-4000-8000-000000261168'));
reset role;
-- Drain the independent variant output before the atomic fixture output.
set local role service_role;
create temporary table atomic_claim1 as select *from public.claim_dynamic_render_job_v2('atomic-first',60,3);
select public.complete_dynamic_render_job_v2((select job_id from atomic_claim1),'atomic-first',(select lease_token from atomic_claim1),pg_temp.price_artifact((select snapshot_id from atomic_claim1)));
create temporary table atomic_claim2 as select *from public.claim_dynamic_render_job_v2('atomic-second',60,3);
select public.complete_dynamic_render_job_v2((select job_id from atomic_claim2),'atomic-second',(select lease_token from atomic_claim2),pg_temp.price_artifact((select snapshot_id from atomic_claim2)));
reset role;
create temporary table atomic_ids as select id,data_source_id from public.dynamic_slides where id in((select(value->>'slideId')::uuid from price_results where name='copy-create'),(select(value->>'slideId')::uuid from price_results where name='atomic-create'));
grant select on atomic_ids to authenticated;
-- The loop orders by actual slide UUID; make only its LAST source unpriceable.
update public.tenant_products set price_cents=case when data_source_id=(select data_source_id from atomic_ids order by id desc limit 1)then null else 700 end where data_source_id in(select data_source_id from atomic_ids);
create function pg_temp.authoring_state()returns jsonb language sql stable as $$select jsonb_build_object('slides',(select md5(coalesce(string_agg(to_jsonb(s)::text,','order by id),''))from public.dynamic_slides s where tenant_id='10000000-0000-4000-8000-000000261151'),'versions',(select md5(coalesce(string_agg(to_jsonb(v)::text,','order by id),''))from public.dynamic_slide_versions v where tenant_id='10000000-0000-4000-8000-000000261151'),'receipts',(select md5(coalesce(string_agg(to_jsonb(r)::text,','order by idempotency_key,command_type),''))from public.publisher_command_receipts r where tenant_id='10000000-0000-4000-8000-000000261151'),'audit',(select count(*)from public.audit_events where tenant_id='10000000-0000-4000-8000-000000261151'))$$;
insert into price_results values('atomic-before',pg_temp.authoring_state());
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
insert into price_results values('atomic-review',public.read_menu_price_impact_v1('10000000-0000-4000-8000-000000261151',0,50));
insert into price_results select 'atomic-selection',jsonb_agg(jsonb_build_object('slideId',menu->>'slideId','basisVersionId',menu->>'basisVersionId','expectedRevision',(menu->>'expectedRevision')::bigint)order by menu->>'slideId')from price_results,jsonb_array_elements(value->'menus')menu where name='atomic-review'and(menu->>'slideId')::uuid in(select id from atomic_ids);
select is((select jsonb_array_length(value)from price_results where name='atomic-selection'),2,'the atomic command explicitly selects exactly two real menus');
select throws_ok($$select public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',(select value->>'reviewHash'from price_results where name='atomic-review'),(select value from price_results where name='atomic-selection'),'40000000-0000-4000-8000-000000261169')$$,'23514',null,'the second ordered target cannot capture an unknown price');
reset role;
select is(pg_temp.authoring_state(),(select value from price_results where name='atomic-before'),'both menus, capture/prepare receipts and audits roll back together after second-target failure');
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='paused'where id='10000000-0000-4000-8000-000000261151';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000261151',true);
select throws_ok($$select public.prepare_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151',(select value->>'reviewHash'from price_results where name='atomic-review'),(select value from price_results where name='atomic-selection'),'40000000-0000-4000-8000-000000261170')$$,'42501',null,'a paused tenant cannot prepare price candidates');
select throws_ok($$select public.publish_menu_price_candidates_v1('10000000-0000-4000-8000-000000261151','00000000-0000-4000-8000-000000261151','40000000-0000-4000-8000-000000261153',(select value from price_results where name='publish-selection'),'40000000-0000-4000-8000-000000261171')$$,'42501',null,'a paused tenant cannot publish even a previously captured candidate');
reset role;

-- Exact signatures: renaming retains the old ACL on its old OID; every NEW
-- helper/root must independently reject all browser/service execution grants.
create temporary table price_private_signatures(signature text primary key);
insert into price_private_signatures values
 ('private.menu_price_hash_v1(jsonb)'),('private.assert_menu_price_set_v1(uuid,uuid,jsonb)'),('private.capture_menu_price_set_v1(uuid,uuid,jsonb,text)'),
 ('private.pin_menu_prices_v1(jsonb,jsonb)'),('private.apply_menu_price_set_v1(jsonb,jsonb,jsonb,boolean)'),('private.resolve_menu_render_prices_v1(uuid,uuid,jsonb)'),
 ('private.build_dynamic_snapshot_data(public.dynamic_slides)'),('private.build_dynamic_snapshot_before_s261_prices_v1(public.dynamic_slides)'),
 ('private.menu_snapshot_prices_v1(jsonb,jsonb)'),('private.ensure_menu_basis_prices_v1(uuid,uuid,uuid,jsonb)'),
 ('private.create_dynamic_slide_before_s261_prices_v1(uuid,text,uuid,uuid,text,jsonb)'),('private.save_dynamic_slide_version_before_s261_prices_v1(uuid,uuid,bigint,text,uuid,uuid,text,text,jsonb,jsonb)'),
 ('private.create_or_resume_dynamic_slide_before_s261_prices_v1(uuid,uuid)'),('private.publish_dynamic_slide_version_before_s261_prices_v1(uuid,uuid,bigint)'),
 ('private.menu_price_nodes_v1(jsonb,jsonb,jsonb)'),('private.menu_selected_products_v1(uuid,uuid,jsonb)'),('private.menu_catalog_prices_v1(uuid,uuid,jsonb)'),
 ('private.menu_price_impact_full_v1(uuid)'),('private.assert_menu_price_access_v1(uuid,boolean)'),('private.preserve_menu_manual_prices_v1(jsonb,jsonb,jsonb)'),
 ('private.read_menu_price_candidates_v1(uuid,uuid,uuid)'),('private.menu_price_source_review_hash_v1(uuid,uuid,jsonb)'),('private.preview_dynamic_slide_before_s261_prices_v1(uuid,text,uuid,uuid,jsonb)');
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot execute '||signature)from price_private_signatures cross join(values('anon'),('authenticated'),('service_role'))roles(role)order by signature,role;
select *from finish();
rollback;
