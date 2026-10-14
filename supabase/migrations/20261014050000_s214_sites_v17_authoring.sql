-- S214: admit the exact paired Sites v17 source at every existing authoring boundary.
-- Historical v11 documents and immutable releases remain valid and unchanged.

create function private.sites_presentation_identity_is_valid_v2(
 p_renderer_version text,
 p_source_revision text
) returns boolean language sql immutable security invoker set search_path='' as $$
 select (p_renderer_version='sites-v11' and p_source_revision='b1cae899af19fc39908217253094c5240d7359fc')
  or (p_renderer_version='sites-v17' and p_source_revision='6800bc858436ba0843eaea89b682cd5b43c3521d')
$$;
revoke all on function private.sites_presentation_identity_is_valid_v2(text,text) from public,anon,authenticated,service_role;

create or replace function private.assert_sites_assets_v1(p_tenant_id uuid,p_document jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare ref jsonb;pair record;sites_asset_id uuid;checksums constant jsonb:='{"/favicon.svg":"e6d2e59b7b5bbb0342e0fb496dfc262decbfe4426bbb7b047aec8d467d1dc6f7","/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp":"5115506847b4e78a4ea51618be9fd1c04202ced1564b00a47961e56a6941fe1a","/fieldflow/photos/FF-PHOTO-04-matchday-live-3840x2160-web.webp":"b7fce5339c8c865ee5ae86693c349d5f3a724b5235c9c7b80dcea2d688dfecb0","/fieldflow/photos/FF-PHOTO-05-sponsor-hub-3840x2160-web.webp":"cc94973585c9248d11b9b4bb871416ab49a413904e7bd928132cd0e9a3d1d2ef","/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp":"03dc11dbd5daa87e84d6e8f21b8ec51b54f271537fd24af57dbf4ea9911a254c","/file.svg":"1e0ae4d1a1ddfa36752988647b731e4abf150c414d069ec83c96fb0aaeff0307","/globe.svg":"d051a8c47936990a9085693d307bb7cea1bc1b6d7ed956bcbaacf674f4ec96b9","/onzetrots/brush/brush-frame.png":"4b002d67496adcc267160f002cedd117c8f1b13d619de0404f026647bfd7b9f7","/onzetrots/brush/clubhuis.svg":"8bb77aef3580efc3883cd43c2b10c42c85be0b7a1230a773a72dc377382f5f3b","/onzetrots/brush/duindorp-luchtfoto.svg":"f4c08b3cb5e713d1e317e5e62e1b1ddb3265d5c3442cedab0dc814b07d536e50","/onzetrots/brush/havenlicht.svg":"de9b50862e815400d9544b373fd59d19d844a8e6f635b27fa13109ba6de1f394","/onzetrots/brush/historische-poort.svg":"b6a6b3f19b27270ae610bf383ae79d177ea09f2faa146a0c8419a5e745fb280a","/onzetrots/brush/kerk.svg":"6e7531ea29a64f99b8c2da53f0209ceeb5bef43546246ecc55728379ca01ddf8","/onzetrots/duindorp-logo.png":"832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930","/onzetrots/houtrust-brush.webp":"4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171","/onzetrots/originals/clubhuis.jpg":"59f2c6f69fe0550cb261fe9fb67a46d08038dce890a3d03681d6a8121aec0b1c","/onzetrots/originals/duindorp-luchtfoto.jpg":"c4f9b1a26cff9cc9517cb5392ec684378914c6561d4b1fcb32c23bd107dd23e2","/onzetrots/originals/havenlicht.jpg":"70794084caa404e23e8215e4a33783e094e4210911d49553eeeca45a40945cd8","/onzetrots/originals/historische-poort.jpg":"5065f77c59a6b57dadf458bbc11674bece0cb4563ae65979139ec9b91c2f854c","/onzetrots/originals/kerk.jpg":"36c51d7c7dec84a79336fb176d37ed7fdbb6eadcc7854b5eccf351f4fbcdcbe7","/onzetrots/paint-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/onzetrots/premium/clubhuis.png":"7942a36dd34c06c4b576e122d52acc8f970e9a10af78d2e15861d0893da63efd","/onzetrots/premium/duindorp-luchtfoto.png":"a11606f1cc19a5f5885c506b265d654ac888d449afba1099ebb34a8f59695c60","/onzetrots/premium/havenlicht.png":"0a1009d093fce5d96f8e697624f2509e779acb0b7c36f3f7fac366333dc6db3e","/onzetrots/premium/historische-poort.png":"1776fefafb9f4845c67f1148c7971682b58be68c0f9f2ff2b4545355eac2d5d7","/onzetrots/premium/kerk.png":"0a2b23aaa9a3caddb6b7a6f36f5bfc2ed83c2f64ba32438a63023905d62ee7ec","/onzetrots/readability-brush.svg":"f42dba3e394f6c87a1381a55214c6998ba8e80ee17709702ab537e969a17dfbb","/onzetrots/type-distress.svg":"eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107","/onzetrots/website-brush/aan-zee-portrait-941.webp":"446eeeaa84b0e032d34fa6aac10615716d4927917bf9258d245ddad0ebc347d6","/onzetrots/website-brush/aan-zee-wide-1672.webp":"ab1df0dd01e1f5ed768e099897377e12b92b85c2856eb80c48c7a06416ece3ae","/onzetrots/website-brush/de-wijk-portrait-941.webp":"a9aab1cb20cbd4abcf92ed90463d8e50a2a67c4cf1637bd2cdeb55dbd265ae70","/onzetrots/website-brush/de-wijk-wide-1672.webp":"d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e","/onzetrots/website-brush/houtrust-portrait-941.webp":"e96a079d1a96f3ca75305329431065d2c61b7f3548735f48811bb57d34be4a14","/onzetrots/website-brush/houtrust-wide-1672.webp":"4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171","/onzetrots-tv/assets/clubmuur-lettering.webp":"c4bf31d7c6331f76f6e4db9bbac59052a01ad9c6f6ae3abe497925f90e15bf32","/onzetrots-tv/assets/clubmuur-players/trio-1280.webp":"543bb88be5c642cac8ed64c3f0f1f8e38608d8640fe5f41623a6477d62b89291","/onzetrots-tv/assets/clubmuur-portraits-v14/05-juichen-1280.webp":"a7519a49d43abe4e0bdc786780ad7d377528114085801c5de2592c38140a3dbb","/onzetrots-tv/assets/clubmuur-portraits-v14/07-walking-1280.webp":"6e5926d26fbf048d3a5e0ef091de8dc3b895df12ebd11e4e2a42c53a53907bfc","/onzetrots-tv/assets/clubmuur-portraits-v17/10-strijd-1280.webp":"16a4d2f6e372ec0deccd0f435506c15351fd54033d486b9b28c44b0cd557d433","/onzetrots-tv/assets/clubmuur-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/onzetrots-tv/assets/logo.png":"832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930","/onzetrots-tv/assets/sponsors/bnu.svg":"44f2ccd12438bcfb292e1283ecac9ef7f5758d4cb77b14e65835260181285504","/onzetrots-tv/assets/sponsors/deelman-daktechniek.svg":"555ca80ae9e1b9e60cf9179092ac0201e4adaf4032b0d53be979dc6d328e23b1","/onzetrots-tv/assets/sponsors/dg-webservices.svg":"dbe2716900d7137fe74250b2ef0708d668fdc8596161c07474006aed56d1c031","/onzetrots-tv/assets/sponsors/kwaliteit-kozijnen-holland.svg":"9eac38ab31bae0373a516e88724a246841c14a3efa5bfc61ca40b2537b224f68","/onzetrots-tv/assets/sponsors/proto-tegelzetbedrijf.svg":"337a0308cef2a2b7b68d89d0f2afcb789467aaaaf7651803e92e8a4e04321d01","/onzetrots-tv/assets/sponsors/rw-repair.png":"2698a951c6f595bdc3b08cd0ec891575b3122d891cd0b783a8e22515080f866d","/onzetrots-tv/assets/type-distress.svg":"eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107","/window.svg":"decf1cf7bb22b5c99c4857cfcd5718ce5465c4454166317589c83fc73df74b66"}'::jsonb;
begin
 if pg_catalog.pg_column_size(p_document)>524288 or(select count(*) from private.sites_json_nodes_v1(p_document))>5000 or exists(select 1 from private.sites_json_nodes_v1(p_document) where depth>16) then raise exception 'Sites document exceeds bounds' using errcode='23514';end if;
 for ref in select * from private.sites_asset_references_v1(p_document) loop
  if ref->>'checksumSha256' is null or ref->>'checksumSha256'!~'^[a-f0-9]{64}$' then raise exception 'Sites asset checksum invalid' using errcode='23514';end if;
  if ref->>'kind'='system' then
   if (select count(*) from jsonb_object_keys(ref))<>3 or checksums->>(ref->>'path') is distinct from ref->>'checksumSha256' then raise exception 'Sites system identity invalid' using errcode='23514';end if;
  else
   if (select count(*) from jsonb_object_keys(ref))<>3 or ref->>'mediaAssetId' is null or ref->>'mediaAssetId'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then raise exception 'Sites tenant asset identity invalid' using errcode='23514';end if;
   sites_asset_id:=(ref->>'mediaAssetId')::uuid;
   if not exists(select 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id where asset.tenant_id=p_tenant_id and asset.id=sites_asset_id and asset.kind='image' and asset.status='ready' and asset.deleted_at is null and variant.variant_type='original' and variant.mime_type in('image/jpeg','image/png','image/webp') and variant.checksum_sha256=ref->>'checksumSha256') then raise exception 'Sites media unavailable in this tenant' using errcode='23514';end if;
  end if;
 end loop;
 for pair in select item.key,item.value from private.sites_json_nodes_v1(p_document) node cross join lateral jsonb_each(case when jsonb_typeof(node.value)='object' then node.value else '{}'::jsonb end)item loop
  if pair.key in('photo','logo','brandLogo','heroImage','homeLogo','awayLogo','image') and(jsonb_typeof(pair.value)<>'object' or pair.value->>'kind' not in('tenant','system')) then raise exception 'Sites images require verified identities' using errcode='23514';end if;
  if pair.key='background' and jsonb_typeof(pair.value)='string' and pair.value#>>'{}'!~'^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$' then raise exception 'Sites background must be a color or asset identity' using errcode='23514';end if;
 end loop;
end;$$;

create or replace function private.assert_sites_studio_v1(p_tenant_id uuid,p_document jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare presentation jsonb:=p_document->'sitesPresentation';slide jsonb:=presentation->'slide';rows integer:=0;capacity integer;pages integer;seconds numeric;is_v17 boolean:=presentation->>'rendererVersion'='sites-v17';
begin
 if presentation->>'kind' is distinct from 'studio' or presentation->>'schemaVersion' is distinct from '1' or not private.sites_presentation_identity_is_valid_v2(presentation->>'rendererVersion',presentation->>'sourceRevision') or slide->>'themeId' not in('fieldflow','onzetrots-tv') or slide->>'orientation' is distinct from p_document#>>'{artboard,orientation}' or jsonb_array_length(p_document->'elements')<>0 then raise exception 'Sites Studio identity invalid' using errcode='23514';end if;
 if is_v17 and coalesce(slide->>'unifiedKind','') not in('agenda','competitie','rss','uitslagen','programma','matchday','verjaardagen','trainingen','vacatures','kantine','partners','welkom','bezoekers','led','sportlink-extra','vrij') then raise exception 'Sites Studio v17 family invalid' using errcode='23514';end if;
 if jsonb_typeof(slide#>'{tv,rows}')='array' then rows:=jsonb_array_length(slide#>'{tv,rows}');end if;
 if rows>200 or slide->>'duration' is null or slide->>'duration'!~'^[0-9]+$' then raise exception 'Sites duration or rows invalid' using errcode='23514';end if;
 seconds:=(slide->>'duration')::numeric;if seconds not between 3 and 120 then raise exception 'Sites page duration invalid' using errcode='23514';end if;
 if slide->>'themeId'='onzetrots-tv' then
  if jsonb_typeof(slide->'tv') is distinct from 'object' or slide#>>'{tv,kind}' not in('wedstrijd','programma','uitslagen','stand','kantine','clubnieuws','partners','welkom','score','goal','lineup','generic') or jsonb_typeof(slide#>'{tv,rows}') is distinct from 'array' then raise exception 'Sites TV content invalid' using errcode='23514';end if;
  if is_v17 then pages:=1;else capacity:=case slide#>>'{tv,kind}' when 'programma' then 8 when 'uitslagen' then 8 when 'stand' then 8 when 'kantine' then 12 when 'clubnieuws' then 3 when 'partners' then 6 when 'generic' then 6 else 12 end;pages:=greatest(1,ceil(rows::numeric/capacity)::integer);end if;
 else pages:=1;end if;
 if seconds*pages*1000>120000 or(p_document#>>'{motion,durationMs}')::numeric is distinct from seconds*pages*1000 or(pages>1 and p_document#>>'{motion,enabled}' is distinct from 'true') then raise exception 'Sites total duration must match all data pages and remain within 120 seconds' using errcode='23514';end if;
 perform private.assert_sites_assets_v1(p_tenant_id,presentation);
end;$$;
revoke all on function private.assert_sites_studio_v1(uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.sites_configuration_valid_before_placement_guard_v1(p_sites jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text;value numeric;
begin
 if jsonb_typeof(p_sites) is distinct from 'object' or p_sites->>'schemaVersion' is distinct from '1' or not private.sites_presentation_identity_is_valid_v2(p_sites->>'rendererVersion',p_sites->>'sourceRevision') or coalesce(p_sites->>'themeId','') not in('fieldflow','onzetrots-tv') or coalesce(p_sites->>'orientation','') not in('landscape','portrait') or coalesce(p_sites->>'provider','') not in('led-scores','sportlink','menu') or jsonb_typeof(p_sites->'title') is distinct from 'string' or length(p_sites->>'title')>240 or jsonb_typeof(p_sites->'subtitle') is distinct from 'string' or length(p_sites->>'subtitle')>1000 then return false;end if;
 if p_sites->>'provider'='led-scores' and(p_sites->>'rowsPerPage')::numeric>8 then return false;end if;
 if p_sites->>'rendererVersion'='sites-v17' then
  if coalesce(p_sites->>'unifiedKind','') not in('agenda','competitie','rss','uitslagen','programma','matchday','verjaardagen','trainingen','vacatures','kantine','partners','welkom','bezoekers','led','sportlink-extra','vrij') then return false;end if;
  if p_sites?'paintTone' and(jsonb_typeof(p_sites->'paintTone')is distinct from 'string' or p_sites->>'paintTone' not in('white','blue'))then return false;end if;
  if p_sites?'photoMotion' and jsonb_typeof(p_sites->'photoMotion')is distinct from 'boolean' then return false;end if;
  if p_sites?'rssLayout' and(jsonb_typeof(p_sites->'rssLayout')is distinct from 'string' or p_sites->>'rssLayout' not in('accordion','fullscreen','split'))then return false;end if;
  if p_sites?'menuLayout' and(jsonb_typeof(p_sites->'menuLayout')is distinct from 'string' or p_sites->>'menuLayout' not in('columns','tiles','list','featured'))then return false;end if;
  foreach key in array array['showPrices','showCategories','arrivalShowLogo','arrivalShowKickoff']loop if p_sites?key and jsonb_typeof(p_sites->key)is distinct from 'boolean' then return false;end if;end loop;
  if p_sites?'currency' and(jsonb_typeof(p_sites->'currency')is distinct from 'string' or length(btrim(p_sites->>'currency'))<>3)then return false;end if;
  if p_sites?'extraType' and(jsonb_typeof(p_sites->'extraType')is distinct from 'string' or length(p_sites->>'extraType')>240)then return false;end if;
  if p_sites?'qrUrl' and(jsonb_typeof(p_sites->'qrUrl')is distinct from 'string' or length(p_sites->>'qrUrl')>1024 or p_sites->>'qrUrl'!~'^[a-zA-Z][a-zA-Z0-9+.-]*://')then return false;end if;
  if p_sites?'body' and(jsonb_typeof(p_sites->'body')is distinct from 'string' or length(p_sites->>'body')>1000)then return false;end if;
  if p_sites?'vacancyContact' and(jsonb_typeof(p_sites->'vacancyContact')is distinct from 'string' or length(p_sites->>'vacancyContact')>240)then return false;end if;
  foreach key in array array['arrivalCards','arrivalBefore','arrivalAfter']loop
   if p_sites?key and(jsonb_typeof(p_sites->key)is distinct from 'number' or p_sites->>key!~'^[0-9]+$')then return false;end if;
  end loop;
  if p_sites?'arrivalCards' and(p_sites->>'arrivalCards')::numeric not between 1 and 4 then return false;end if;
  if p_sites?'arrivalBefore' and(p_sites->>'arrivalBefore')::numeric not between 0 and 1440 then return false;end if;
  if p_sites?'arrivalAfter' and(p_sites->>'arrivalAfter')::numeric not between 0 and 1440 then return false;end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p_sites)actual where actual<>all(array['schemaVersion','rendererVersion','sourceRevision','themeId','orientation','provider','title','subtitle','background','overlay','accent','layout','scale','align','safeArea','seconds','rowsPerPage','ledTheme','ledMoment','ledSide','titleScale','scoreScale','logoScale','teamScale','showBranding','showSceneLabel','showClock','showTimeline','timelineLimit','backgroundFit','grunge','animation','showCategories','ledTemplate','unifiedKind','paintTone','photoMotion','rssLayout','menuLayout','showPrices','currency','extraType','arrivalCards','arrivalBefore','arrivalAfter','arrivalShowLogo','arrivalShowKickoff','qrUrl','body','vacancyContact','welcomeImage'])) then return false;end if;
 foreach key in array array['scale','titleScale','scoreScale','logoScale','teamScale']loop
  if jsonb_typeof(p_sites->key) is distinct from 'number' then return false;end if;value:=(p_sites->>key)::numeric;if value not between 70 and 200 then return false;end if;
 end loop;
 if p_sites->>'provider'<>'led-scores' and(p_sites->>'scale')::numeric>140 then return false;end if;
 if p_sites ? 'showCategories' and jsonb_typeof(p_sites->'showCategories') is distinct from 'boolean' then return false;end if;
 if p_sites ? 'ledTemplate' and(jsonb_typeof(p_sites->'ledTemplate') is distinct from 'string' or p_sites->>'ledTemplate' not in('match-center','scoreboard'))then return false;end if;
 foreach key in array array['showBranding','showSceneLabel','showClock','showTimeline']loop if jsonb_typeof(p_sites->key) is distinct from 'boolean' then return false;end if;end loop;
 if jsonb_typeof(p_sites->'seconds') is distinct from 'number' or p_sites->>'seconds'!~'^[0-9]+$' or(p_sites->>'seconds')::numeric not between 3 and 120 or jsonb_typeof(p_sites->'rowsPerPage') is distinct from 'number' or p_sites->>'rowsPerPage'!~'^[0-9]+$' or(p_sites->>'rowsPerPage')::numeric not between 1 and 12 or jsonb_typeof(p_sites->'timelineLimit') is distinct from 'number' or p_sites->>'timelineLimit'!~'^[0-9]+$' or(p_sites->>'timelineLimit')::numeric not between 1 and 10 then return false;end if;
 if jsonb_typeof(p_sites->'overlay') is distinct from 'number' or(p_sites->>'overlay')::numeric not between 0 and 95 or jsonb_typeof(p_sites->'safeArea') is distinct from 'number' or(p_sites->>'safeArea')::numeric not between 0 and 12 or jsonb_typeof(p_sites->'grunge') is distinct from 'number' or(p_sites->>'grunge')::numeric not between 0 and 100 then return false;end if;
 return coalesce(p_sites->>'accent','')~'^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$' and coalesce(p_sites->>'layout','') in('full','split','sidebar') and coalesce(p_sites->>'align','') in('left','center','right') and coalesce(p_sites->>'ledTheme','') in('blue','paper','fieldflow') and coalesce(p_sites->>'ledMoment','') in('live','goal','lineup','start','half','end') and coalesce(p_sites->>'ledSide','') in('own','opponent','unknown') and coalesce(p_sites->>'backgroundFit','') in('cover','contain') and coalesce(p_sites->>'animation','') in('none','fade','rise','zoom','wipe');
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;$$;
revoke all on function private.sites_configuration_valid_before_placement_guard_v1(jsonb) from public,anon,authenticated,service_role;

create or replace function private.enforce_fieldflow_dynamic_authoring_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare authored_theme_id text:=coalesce(new.configuration_json#>>'{sitesConfiguration,themeId}',new.configuration_json#>>'{editorial,themeSelection,ref,id}',new.configuration_json#>>'{themeSelection,ref,id}',new.configuration_json#>>'{menuDocument,theme,themeId}',new.configuration_json#>>'{theme,themeId}');sites jsonb:=new.configuration_json->'sitesConfiguration';
begin
 if authored_theme_id is not null and authored_theme_id not in('fieldflow','onzetrots-tv') then raise exception 'authorable dynamic theme is invalid' using errcode='23514';end if;
 if sites is not null then
  if not private.sites_configuration_is_valid_v1(sites) then raise exception 'Sites dynamic configuration invalid'using errcode='23514';end if;
  perform private.assert_sites_assets_v1(new.tenant_id,sites);
 end if;return new;
end;$$;
revoke all on function private.enforce_fieldflow_dynamic_authoring_v1() from public,anon,authenticated,service_role;

create or replace function public.mutate_playlist_batch_v1(p_playlist_id uuid,p_expected_revision bigint,p_operations jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  playlist public.playlists%rowtype; item public.playlist_items%rowtype;
  operation jsonb; patch jsonb; payload jsonb; request jsonb; replay jsonb; result jsonb;
  mapping jsonb:='{}'; child_ids jsonb; before_ids uuid[]; ordered_ids uuid[];
  actor uuid:=private.current_user_id(); item_id uuid; client_id uuid; child_key uuid;
  current_revision bigint; ordinal integer:=0; next_sort integer; next_position numeric;
  series_item record; exported record; series_revision bigint; duration integer;series_index integer;
begin
  if p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null
    or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 200
    or octet_length(p_operations::text)>262144 then raise exception 'playlist batch exceeds limits' using errcode='22023';end if;
  select * into playlist from public.playlists where id=p_playlist_id for update;
  if not found or actor is null or not private.can_write_playlist(playlist.tenant_id) then raise exception 'actor cannot edit playlist' using errcode='42501';end if;
  perform private.require_active_tenant_command(playlist.tenant_id);
  if playlist.status='archived' then raise exception 'archived playlist cannot be edited' using errcode='23514';end if;
  request:=jsonb_build_object('playlistId',p_playlist_id,'expectedRevision',p_expected_revision,'operations',p_operations);
  replay:=private.begin_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request);
  if replay is not null then return replay;end if;
  if playlist.revision<>p_expected_revision then
    return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,
      jsonb_build_object('outcome','conflict','actualRevision',playlist.revision),'publisher.playlist.conflict','failed');
  end if;
  current_revision:=playlist.revision;
  for operation in select * from jsonb_array_elements(p_operations) loop
    ordinal:=ordinal+1;
    child_key:=md5(p_idempotency_key::text||':playlist-batch:'||ordinal)::uuid;
    if operation?'clientId' then
      client_id:=(operation->>'clientId')::uuid;
      if mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id) then raise exception 'duplicate command-local item identity' using errcode='23514';end if;
    else client_id:=null;end if;
    result:=null;
    if operation->>'operation' in('add_media','add_dynamic','add_youtube','add_engage')then
      duration:=(operation->>'durationSeconds')::integer;
      if duration is null or duration not between 3 and 3600 then raise exception 'duration outside limits'using errcode='23514';end if;
      if client_id is null then raise exception 'new placement requires command identity'using errcode='23514';end if;
    end if;
    item_id:=coalesce(nullif(mapping->>(operation->>'itemId'),'')::uuid,nullif(operation->>'itemId','')::uuid);
    select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;

    if operation->>'operation'='add_media' then
      duration:=(operation->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'media has no verified playback variant' using errcode='23514';end if;
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',
        jsonb_build_object('mediaAssetId',operation->>'mediaAssetId','durationSeconds',greatest(5,duration),'fitMode',playlist.default_fit_mode,'muted',playlist.default_video_muted)) command;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration,fit_mode=playlist.default_fit_mode,muted=playlist.default_video_muted,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_dynamic' then
      -- The library selection names the immutable snapshot the user reviewed.
      perform 1 from public.dynamic_slides where tenant_id=playlist.tenant_id and id=(operation->>'dynamicSlideId')::uuid and current_snapshot_id=(operation->>'expectedSnapshotId')::uuid for share;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      perform 1 from public.dynamic_slide_snapshots snapshot
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where snapshot.tenant_id=playlist.tenant_id and snapshot.dynamic_slide_id=(operation->>'dynamicSlideId')::uuid and snapshot.id=(operation->>'expectedSnapshotId')::uuid and snapshot.status='ready';
      if not found then raise exception 'dynamic selection has no verified output; nothing added'using errcode='23514';end if;
      result:=public.add_dynamic_slide_to_playlist_v2(playlist.id,(operation->>'dynamicSlideId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_youtube' then
      result:=public.add_youtube_source_to_playlist_v1(playlist.id,(operation->>'sourceId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_engage' then
      result:=public.add_engage_campaign_to_playlist_v1(playlist.id,(operation->>'campaignId')::uuid,(operation->>'fallbackAssetId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_studio_series' then
      select revision into series_revision from public.studio_series where tenant_id=playlist.tenant_id and id=(operation->>'seriesId')::uuid and status='active' for share;
      if series_revision is distinct from (operation->>'expectedSeriesRevision')::bigint then raise exception 'Studio series changed; reload library' using errcode='40001';end if;
      perform project.id from public.studio_series_items member join public.studio_projects project on project.tenant_id=member.tenant_id and project.id=member.project_id join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id where member.tenant_id=playlist.tenant_id and member.series_id=(operation->>'seriesId')::uuid order by project.id for share of project,draft;
      child_ids:='[]';series_index:=0;
      if jsonb_typeof(operation->'clientItemIds')is distinct from 'array' or jsonb_array_length(operation->'clientItemIds')not between 1 and 20 or(select count(distinct value)from jsonb_array_elements_text(operation->'clientItemIds'))<>jsonb_array_length(operation->'clientItemIds') then raise exception 'invalid series command identities'using errcode='23514';end if;
      for series_item in select project_id from public.studio_series_items where tenant_id=playlist.tenant_id and series_id=(operation->>'seriesId')::uuid order by sort_order loop
        select export.media_asset_id,coalesce(export.duration_seconds,project.duration_ms/1000.0) as duration_seconds into exported
          from public.studio_projects project join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
          join public.studio_revisions revision on revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
          join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
          join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id
          join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
          where project.tenant_id=playlist.tenant_id and project.id=series_item.project_id and project.status='active' and asset.status='ready' and asset.deleted_at is null
          order by export.created_at desc limit 1;
        if not found then raise exception 'Studio series has an incomplete current export; nothing added' using errcode='23514';end if;
        select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
        select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',jsonb_build_object('mediaAssetId',exported.media_asset_id,'durationSeconds',greatest(5,ceil(exported.duration_seconds)::integer),'fitMode','contain','muted',true)) command;
        select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
        update public.playlist_items set duration_seconds=greatest(3,ceil(exported.duration_seconds)::integer),fit_mode='contain',muted=true,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
        client_id:=(operation#>>array['clientItemIds',series_index::text])::uuid;
        if client_id is null or mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id)then raise exception 'duplicate series command identity'using errcode='23514';end if;
        mapping:=mapping||jsonb_build_object(client_id::text,item_id);series_index:=series_index+1;
        child_ids:=child_ids||jsonb_build_array(item_id);
        select revision into current_revision from public.playlists where id=playlist.id;
      end loop;
      if jsonb_array_length(child_ids)=0 or series_index<>jsonb_array_length(operation->'clientItemIds') then raise exception 'Studio series count changed' using errcode='40001';end if;
    elsif operation->>'operation'='duplicate' then
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'duplicate_item',jsonb_build_object('itemId',item_id),child_key);
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      -- The established command copies presentation; retain the later source contracts too.
      update public.playlist_items set sites_configuration_json=item.sites_configuration_json,
        dynamic_slide_id=item.dynamic_slide_id,dynamic_snapshot_id=item.dynamic_snapshot_id,dynamic_selection_mode=item.dynamic_selection_mode,
        youtube_source_id=item.youtube_source_id,engage_campaign_id=item.engage_campaign_id where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='replace_media' then
      -- The established guarded replacement preserves every presentation field.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if item.dynamic_slide_id is not null or item.youtube_source_id is not null or item.engage_campaign_id is not null then raise exception 'a live binding cannot be replaced by a static render' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'replacement has no verified playback variant' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
    elsif operation->>'operation'='replace_fallback' then
      select *into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if ((operation->>'sourceKind'='youtube'and item.youtube_source_id=(operation->>'sourceId')::uuid)or(operation->>'sourceKind'='engage'and item.engage_campaign_id=(operation->>'sourceId')::uuid))is distinct from true or item.dynamic_slide_id is not null then raise exception 'fallback source binding changed'using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original'and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
      where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.kind='image'and asset.status='ready'and asset.deleted_at is null
        and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=asset.tenant_id and snapshot.output_media_asset_id=asset.id and snapshot.status='ready');
      if not found then raise exception 'fallback image has no verified playback variant'using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
    elsif operation->>'operation'='refresh_dynamic' then
      -- This is an explicit authoring choice. Background data refresh never calls it.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      perform 1 from public.dynamic_slides slide join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=slide.tenant_id and snapshot.dynamic_slide_id=slide.id and snapshot.id=slide.current_snapshot_id
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where slide.tenant_id=playlist.tenant_id and slide.id=item.dynamic_slide_id and slide.status='ready' and snapshot.status='ready' and snapshot.id=(operation->>'expectedSnapshotId')::uuid for share of slide,snapshot;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      update public.playlist_items target set dynamic_snapshot_id=snapshot.id,media_asset_id=snapshot.output_media_asset_id from public.dynamic_slide_snapshots snapshot where target.id=item.id and snapshot.tenant_id=playlist.tenant_id and snapshot.id=(operation->>'expectedSnapshotId')::uuid;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='remove' then
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'remove_item',jsonb_build_object('itemId',item_id)) command;
    elsif operation->>'operation'='patch' then
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      patch:=operation->'patch';
      if jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(patch) key where key not in('durationSeconds','displayTitle','accessibilityName','enabled','muted','fitMode','transition','cropFocusX','cropFocusY','backgroundColor','volumePercent','trimStartSeconds','trimEndSeconds','visibleFrom','visibleUntil','sitesConfiguration')) then raise exception 'unsupported partial item patch' using errcode='22023';end if;
      payload:=jsonb_build_object('itemId',item.id,'durationSeconds',item.duration_seconds,'displayTitle',item.display_title,'accessibilityName',item.accessibility_name,'enabled',item.enabled,'muted',item.muted,'fitMode',item.fit_mode,'transition',item.transition,'cropFocusX',item.crop_focus_x,'cropFocusY',item.crop_focus_y,'backgroundColor',item.background_color,'volumePercent',item.volume_percent,'trimStartSeconds',item.trim_start_seconds,'trimEndSeconds',item.trim_end_seconds,'visibleFrom',item.visible_from,'visibleUntil',item.visible_until)||(patch-'sitesConfiguration');
      duration:=(payload->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'update_item_presentation',jsonb_set(payload,'{durationSeconds}',to_jsonb(greatest(5,duration))),child_key);
      if patch?'sitesConfiguration' and patch->'sitesConfiguration'<>'null'::jsonb then
        if not private.sites_configuration_is_valid_v1(patch->'sitesConfiguration') then raise exception 'placement configuration invalid'using errcode='23514';end if;
        if patch#>>'{sitesConfiguration,schemaVersion}' is distinct from '1' or not private.sites_presentation_identity_is_valid_v2(patch#>>'{sitesConfiguration,rendererVersion}',patch#>>'{sitesConfiguration,sourceRevision}') or patch#>>'{sitesConfiguration,themeId}' not in('fieldflow','onzetrots-tv') then raise exception 'placement configuration identity invalid' using errcode='23514';end if;
        perform private.assert_sites_assets_v1(playlist.tenant_id,patch->'sitesConfiguration');
      end if;
      update public.playlist_items set duration_seconds=duration,
        sites_configuration_json=case when patch?'sitesConfiguration' then nullif(patch->'sitesConfiguration','null'::jsonb) else sites_configuration_json end where id=item.id;
    elsif operation->>'operation'='reorder' then
      select coalesce(array_agg(coalesce(nullif(mapping->>value,'')::uuid,value::uuid) order by ordinality),'{}'::uuid[]) into ordered_ids from jsonb_array_elements_text(operation->'itemIds') with ordinality;
      if cardinality(ordered_ids)<>cardinality(before_ids) or cardinality(ordered_ids)<>(select count(distinct id) from unnest(ordered_ids) id) or not(ordered_ids @> before_ids and ordered_ids <@ before_ids) then raise exception 'order must contain each current item exactly once' using errcode='23514';end if;
      select coalesce(max(sort_order),0)+cardinality(ordered_ids)+1 into next_sort from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items set sort_order=sort_order+next_sort where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items target set sort_order=ordering.ordinality-1,position_key=ordering.ordinality*1024 from unnest(ordered_ids) with ordinality ordering(id,ordinality) where target.tenant_id=playlist.tenant_id and target.playlist_id=playlist.id and target.id=ordering.id;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='details' then
      if length(btrim(operation->>'name')) not between 2 and 120 or length(coalesce(operation->>'description',''))>500 then raise exception 'playlist details outside limits' using errcode='23514';end if;
      update public.playlists set name=btrim(operation->>'name'),description=nullif(btrim(operation->>'description'),''),status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    else raise exception 'unsupported playlist batch operation' using errcode='22023';end if;
    if result->>'outcome'='conflict' then raise exception 'playlist batch revision changed; all changes rolled back' using errcode='40001';end if;
    select revision into current_revision from public.playlists where id=playlist.id;
    if (select count(*) from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id)>1000 then raise exception 'playlist item limit exceeded' using errcode='23514';end if;
  end loop;
  return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,jsonb_build_object('outcome','applied','actualRevision',current_revision,'itemIds',mapping),'publisher.playlist.batch.saved','success');
end $$;
revoke all on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid) to authenticated;

alter table public.playlist_release_items drop constraint playlist_release_items_sites_studio_presentation_check;
alter table public.playlist_release_items add constraint playlist_release_items_sites_studio_presentation_check check(
 sites_studio_presentation_json is null or(
  jsonb_typeof(sites_studio_presentation_json)='object'
  and sites_studio_presentation_json->>'kind'='studio'
  and sites_studio_presentation_json->>'schemaVersion'='1'
  and private.sites_presentation_identity_is_valid_v2(sites_studio_presentation_json->>'rendererVersion',sites_studio_presentation_json->>'sourceRevision')
  and(sites_studio_presentation_json->>'rendererVersion'<>'sites-v17' or sites_studio_presentation_json#>>'{slide,unifiedKind}' in('agenda','competitie','rss','uitslagen','programma','matchday','verjaardagen','trainingen','vacatures','kantine','partners','welkom','bezoekers','led','sportlink-extra','vrij'))
  and pg_catalog.pg_column_size(sites_studio_presentation_json)<=524288
 )
);

create or replace function private.json_has_sites_authoring_v1(p_value jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesPresentation'),false)
  or coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesConfiguration'),false)
  or coalesce(p_value->>'rendererVersion' in('sites-v11','sites-v17'),false)
$$;
revoke all on function private.json_has_sites_authoring_v1(jsonb) from public,anon,authenticated,service_role;

comment on function private.sites_presentation_identity_is_valid_v2(text,text) is
 'Exact allowlist for immutable paired Sites renderer/source identities; no mixed or unknown pair is authorable.';
