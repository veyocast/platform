-- S226: additive Sync documents. Existing Sites identities, release columns,
-- immutable publications, tenant permissions and operational flags are retained.
create extension if not exists pg_jsonschema with schema extensions;

-- Generated from the canonical Zod output schema; custom refinements follow below.
create function private.sync_slide_schema_v1() returns json
language sql immutable security invoker set search_path='' as $function$
 select $sync_schema${"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"rendererVersion":{"type":"string","const":"sync-v1"},"sourceRevision":{"type":"string","const":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a"},"family":{"type":"string","enum":["fixtures","results","period-standings","cancellations","dressing-rooms","officials","team-info","activities","training","volunteers","visitors","matchday","club-program","team-program","pool-program","club-results","team-results","pool-results","standings","team-arrivals","welcome","referees","changing-rooms","next-match","birthdays","lineup","scoreboard","goal","menu","engage","rss","sponsors","agenda","club-story","youtube","free"]},"orientation":{"type":"string","enum":["landscape","portrait"]},"theme":{"type":"string","enum":["fieldflow","onzetrots-tv"]},"name":{"type":"string","maxLength":400},"club":{"type":"object","properties":{"name":{"type":"string","maxLength":400},"tagline":{"default":"","type":"string","maxLength":400},"logo":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"system"},"path":{"type":"string"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","path","checksumSha256"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"tenant"},"mediaAssetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","mediaAssetId","checksumSha256"],"additionalProperties":false}]}},"required":["name","tagline"],"additionalProperties":false},"title":{"type":"string","maxLength":400},"headline":{"default":"","type":"string","maxLength":400},"body":{"default":"","type":"string","maxLength":4000},"subtitle":{"default":"","type":"string","maxLength":400},"topLabel":{"default":"CLUB TV","type":"string","maxLength":400},"footer":{"default":"","type":"string","maxLength":400},"footerRight":{"default":"","type":"string","maxLength":400},"home":{"type":"object","properties":{"name":{"type":"string","maxLength":400},"team":{"default":"","type":"string","maxLength":400},"logo":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"system"},"path":{"type":"string"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","path","checksumSha256"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"tenant"},"mediaAssetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","mediaAssetId","checksumSha256"],"additionalProperties":false}]}},"required":["name","team"],"additionalProperties":false},"away":{"type":"object","properties":{"name":{"type":"string","maxLength":400},"team":{"default":"","type":"string","maxLength":400},"logo":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"system"},"path":{"type":"string"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","path","checksumSha256"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"tenant"},"mediaAssetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","mediaAssetId","checksumSha256"],"additionalProperties":false}]}},"required":["name","team"],"additionalProperties":false},"match":{"type":"object","properties":{"homeScore":{"default":"","type":"string","maxLength":10},"awayScore":{"default":"","type":"string","maxLength":10},"clock":{"default":"","type":"string","maxLength":40},"date":{"default":"","type":"string","maxLength":400},"time":{"default":"","type":"string","maxLength":40}},"required":["homeScore","awayScore","clock","date","time"],"additionalProperties":false},"rows":{"default":[],"maxItems":200,"type":"array","items":{"type":"array","items":[{"type":"string","maxLength":400},{"type":"string","maxLength":400},{"type":"string","maxLength":400},{"type":"string","maxLength":400}]}},"rowsPerPage":{"default":4,"type":"integer","minimum":1,"maximum":8},"ownRowIndexes":{"default":[],"maxItems":200,"type":"array","items":{"type":"integer","minimum":0,"maximum":199}},"category":{"default":"","type":"string","maxLength":400},"subline":{"default":"","type":"string","maxLength":400},"special":{"type":"object","properties":{"label":{"type":"string","maxLength":400},"title":{"type":"string","maxLength":400},"priceCents":{"type":"integer","minimum":0,"maximum":100000000}},"required":["label","title","priceCents"],"additionalProperties":false},"lineup":{"default":[],"maxItems":11,"type":"array","items":{"minItems":1,"maxItems":11,"type":"array","items":{"type":"integer","minimum":1,"maximum":99}}},"news":{"default":[],"maxItems":50,"type":"array","items":{"type":"object","properties":{"title":{"type":"string","maxLength":400},"intro":{"type":"string","maxLength":4000},"source":{"type":"string","maxLength":400},"url":{"type":"string","maxLength":2048,"format":"uri"}},"required":["title","intro","source"],"additionalProperties":false}},"imageCaption":{"default":"","type":"string","maxLength":400},"youtubeUrl":{"type":"string","maxLength":2048,"format":"uri"},"poll":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","maxLength":400},"status":{"type":"string","enum":["draft","scheduled","live","closed","archived"]},"visibility":{"type":"string","enum":["live","after_vote","after_close"]},"publicUrl":{"type":"string","maxLength":2048,"format":"uri"},"options":{"minItems":2,"maxItems":12,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"label":{"type":"string","maxLength":400},"votes":{"type":"integer","minimum":0,"maximum":1000000000}},"required":["id","label","votes"],"additionalProperties":false}}},"required":["id","title","status","visibility","options"],"additionalProperties":false},"state":{"default":"ready","type":"string","enum":["ready","empty","error"]},"style":{"type":"object","properties":{"motion":{"type":"string","enum":["rustig","dynamisch","geen"]},"background":{"default":"stadium","type":"string","enum":["stadium","gradient","stripes","clubmuur","light","photo"]},"backgroundAsset":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"system"},"path":{"type":"string"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","path","checksumSha256"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"tenant"},"mediaAssetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"checksumSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["kind","mediaAssetId","checksumSha256"],"additionalProperties":false}]},"backgroundPosition":{"default":"center","type":"string","enum":["center","top","bottom","left","right"]},"font":{"default":"Inter, sans-serif","type":"string","enum":["Inter, sans-serif","Inter","Manrope","Arial","Brush","Condensed","Serif"]},"fontChanged":{"default":false,"type":"boolean"},"accent":{"default":"#1763ed","type":"string","pattern":"^#[a-f0-9]{6}$"},"alignment":{"default":"left","type":"string","enum":["left","center","right"]},"scale":{"default":100,"type":"number","minimum":50,"maximum":150},"safeMargin":{"default":5,"type":"number","minimum":2,"maximum":15},"showLogo":{"default":true,"type":"boolean"},"showFooter":{"default":true,"type":"boolean"}},"required":["background","backgroundPosition","font","fontChanged","accent","alignment","scale","safeMargin","showLogo","showFooter"],"additionalProperties":false}},"required":["schemaVersion","rendererVersion","sourceRevision","family","orientation","theme","name","club","title","headline","body","subtitle","topLabel","footer","footerRight","rows","rowsPerPage","ownRowIndexes","category","subline","lineup","news","imageCaption","state","style"],"additionalProperties":false}$sync_schema$::json;
$function$;

create function private.assert_sync_slide_v1(p_tenant_id uuid,p_slide jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare
 ref jsonb;
 link text;
 choices integer;
 manifest constant jsonb:=$sync_manifest${"/assets/brand-hero-1254.webp":"7badc69cca88b8bf9fbd770fb35e345108570318cf7d56e2f674813b8db5554a","/assets/brand-hero-480.webp":"fc6ff477c5ffaf8d220f2142d16b5e7a8e4cb5f88505ae03567b1678d052a007","/assets/brand-hero-800.webp":"f766151d506cd103fc83ab1597a73952be360f9040cc70b4dfa0a1f3b85ae656","/assets/brand-hero.png":"3997e2d0c033636cba036749d0f771112122488b8992b75177ebeb384a5fddc0","/assets/brand-icon.svg":"dc63b70f43d4f721c5f87d51c64f9f5660a6aa22c69f9245f3f4d711113c0fd3","/assets/clubmuur-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/assets/full-dark.svg":"bb6075cfa4436f1ed8f8b3f41c29b41f53e1c12bcc76b62f4f14420846236e43","/assets/full-light.svg":"877dac00409543e4699c39116b508ad5096e2f2fd3b361d32ae674044c9fef9e"}$sync_manifest$::jsonb;
begin
 if p_slide is null or pg_catalog.pg_column_size(p_slide)>524288
  or not extensions.jsonb_matches_schema(private.sync_slide_schema_v1(),p_slide)
 then raise exception 'Sync slide structure invalid' using errcode='23514';end if;

 -- Reuse the established ready/original/checksum/tenant validation, without
 -- broadening its frozen Sites system-image allowlist.
 for ref in select * from private.sites_asset_references_v1(p_slide) loop
  if ref->>'kind'='system' then
   if manifest->>(ref->>'path') is distinct from ref->>'checksumSha256'
   then raise exception 'Sync system asset identity invalid' using errcode='23514';end if;
  else perform private.assert_sites_assets_v1(p_tenant_id,ref);end if;
 end loop;
 if p_slide#>>'{style,background}'='photo' and not(p_slide->'style'?'backgroundAsset')
 then raise exception 'Sync photo background missing' using errcode='23514';end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements_text(p_slide->'ownRowIndexes') item where item.value::integer>=pg_catalog.jsonb_array_length(p_slide->'rows'))
 then raise exception 'Sync own row missing' using errcode='23514';end if;
 if p_slide?'poll' and p_slide->>'family'<>'engage'
 then raise exception 'Sync poll family invalid' using errcode='23514';end if;

 -- JSON Schema cannot express the canonical URL and poll-privacy refinements.
 for link in
  select item->>'url' from pg_catalog.jsonb_array_elements(p_slide->'news') item where item?'url'
  union all select p_slide#>>'{poll,publicUrl}' where p_slide#>'{poll,publicUrl}' is not null
  union all select p_slide->>'youtubeUrl' where p_slide?'youtubeUrl'
 loop
  if link!~*'^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'
  then raise exception 'Sync public URL invalid' using errcode='23514';end if;
 end loop;
 if p_slide?'youtubeUrl' and p_slide->>'youtubeUrl'!~*'^https://(www\.)?(youtube\.com|youtu\.be)(:443)?([/?#]|$)'
 then raise exception 'Sync video origin invalid' using errcode='23514';end if;
 if p_slide?'poll' then
  select count(distinct(item->>'id')::uuid) into choices from pg_catalog.jsonb_array_elements(p_slide#>'{poll,options}') item;
  if choices<>pg_catalog.jsonb_array_length(p_slide#>'{poll,options}')
  then raise exception 'Sync poll choice identity repeated' using errcode='23514';end if;
  if not((p_slide#>>'{poll,visibility}'='live' and p_slide#>>'{poll,status}' in('live','closed','archived')) or(p_slide#>>'{poll,status}' in('closed','archived') and p_slide#>>'{poll,visibility}'='after_close'))
   and exists(select 1 from pg_catalog.jsonb_array_elements(p_slide#>'{poll,options}') item where(item->>'votes')::bigint<>0)
  then raise exception 'Sync nonpublic votes forbidden' using errcode='23514';end if;
 end if;
end;$$;

alter function private.assert_studio_document(uuid,text,integer,integer,jsonb,uuid[]) rename to assert_studio_document_before_sync_v1;
create function private.assert_studio_document(p_tenant_id uuid,p_orientation text,p_width integer,p_height integer,p_document jsonb,p_referenced_asset_ids uuid[]) returns void
language plpgsql stable security definer set search_path='' as $$
declare
 slide jsonb:=p_document->'syncPresentation';
 legacy jsonb:=p_document;
 refs uuid[];
 synthetic jsonb;
 pages integer;
 duration_ms integer;
begin
 if p_document?'syncPresentation' then
  if p_document?'sitesPresentation' or p_document->'elements' is distinct from '[]'::jsonb
   or pg_catalog.pg_column_size(p_document)>524288
  then raise exception 'Sync document composition invalid' using errcode='23514';end if;
  perform private.assert_sync_slide_v1(p_tenant_id,slide);
  if length(btrim(slide->>'name')) not between 1 and 120
  then raise exception 'Sync document name invalid' using errcode='23514';end if;
  if slide->>'orientation' is distinct from p_document#>>'{artboard,orientation}'
  then raise exception 'Sync document orientation invalid' using errcode='23514';end if;
  pages:=case when slide->>'family'='rss' then greatest(1,pg_catalog.jsonb_array_length(slide->'news')) else greatest(1,ceil(pg_catalog.jsonb_array_length(slide->'rows')::numeric/(slide->>'rowsPerPage')::integer)::integer) end;
  if coalesce(p_document#>>'{motion,durationMs}','')!~'^[0-9]{1,6}$'
  then raise exception 'Sync document duration invalid' using errcode='23514';end if;
  duration_ms:=(p_document#>>'{motion,durationMs}')::integer;
  if duration_ms<pages*3000 or duration_ms>120000 or(pages>1 and p_document#>>'{motion,enabled}' is distinct from 'true')
  then raise exception 'Sync document duration invalid' using errcode='23514';end if;
  if slide#>>'{style,motion}' in('rustig','dynamisch') and p_document#>>'{motion,enabled}' is distinct from 'true'
  then raise exception 'Sync animated document requires video' using errcode='23514';end if;
  select coalesce(array_agg(distinct(ref->>'mediaAssetId')::uuid order by(ref->>'mediaAssetId')::uuid),'{}'::uuid[])
   into refs from private.sites_asset_references_v1(slide) ref where ref->>'kind'='tenant';
  if refs is distinct from private.normalize_studio_asset_ids(p_referenced_asset_ids)
  then raise exception 'Sync tenant manifest mismatch' using errcode='23514';end if;
  select coalesce(jsonb_agg(jsonb_build_object('type','image','mediaAssetId',asset_id)),'[]'::jsonb)
   into synthetic from unnest(refs) asset_id;
  legacy:=jsonb_set(jsonb_set(p_document-'syncPresentation','{elements}',synthetic),'{motion,durationMs}',to_jsonb(least(30000,duration_ms)));
 end if;
 -- Existing project lifecycle, active tenant, AAL2/capability, asset ownership,
 -- CAS revisions and command receipts remain in the original writers.
 perform private.assert_studio_document_before_sync_v1(p_tenant_id,p_orientation,p_width,p_height,legacy,p_referenced_asset_ids);
end;$$;

-- The existing operational authoring pause also covers the new representation.
create or replace function private.json_has_sites_authoring_v1(p_value jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesPresentation'),false)
  or coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesConfiguration'),false)
  or coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.syncPresentation'),false)
  or coalesce(p_value->>'rendererVersion' in('sites-v11','sites-v17','sync-v1'),false)
$$;

revoke all on function private.sync_slide_schema_v1(),private.assert_sync_slide_v1(uuid,jsonb),private.assert_studio_document(uuid,text,integer,integer,jsonb,uuid[]),private.assert_studio_document_before_sync_v1(uuid,text,integer,integer,jsonb,uuid[]),private.json_has_sites_authoring_v1(jsonb) from public,anon,authenticated,service_role;
comment on function private.assert_sync_slide_v1(uuid,jsonb) is 'Bounded exact Sync schema plus source identity, verified system images, current same-tenant original image checksums, public URL and poll privacy refinements. No new public writer or permission.';
