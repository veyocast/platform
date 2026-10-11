-- S191: additive Sites v11 authoring. Frozen releases and old Studio documents are untouched.
alter table public.tenant_settings drop constraint tenant_settings_default_theme_id_check;
alter table public.tenant_settings add constraint tenant_settings_default_theme_id_check check(default_theme_id in('fieldflow','onzetrots-tv','editorial','obsidian','atelier','velocity','heritage','halo','swiss','pavilion','tactical','terrace'));
alter table public.studio_projects drop constraint studio_projects_duration_ms_check;
alter table public.studio_projects add constraint studio_projects_duration_ms_check check(duration_ms between 1000 and 120000);
alter table public.studio_exports drop constraint studio_exports_duration_seconds_check;
alter table public.studio_exports add constraint studio_exports_duration_seconds_check check(duration_seconds is null or duration_seconds>0 and duration_seconds<=120);

alter function private.theme_selection_is_valid_v1(jsonb) rename to theme_selection_before_sites_v11;
create function private.theme_selection_is_valid_v1(p_selection jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select case when p_selection#>>'{ref,id}'='onzetrots-tv' then p_selection#>>'{ref,version}'='11.0.0' and private.theme_selection_before_sites_v11(jsonb_set(jsonb_set(p_selection,'{ref,id}','"fieldflow"'::jsonb),'{ref,version}','"1.0.0"'::jsonb)) else private.theme_selection_before_sites_v11(p_selection) end;
$$;
revoke all on function private.theme_selection_is_valid_v1(jsonb),private.theme_selection_before_sites_v11(jsonb) from public,anon,authenticated,service_role;
-- CHECK constraints bind a function OID; explicitly bind the additive validator.
alter table public.tenant_theme_profiles drop constraint tenant_theme_profiles_selection_json_check;
alter table public.tenant_theme_profiles add constraint tenant_theme_profiles_selection_json_check check(private.theme_selection_is_valid_v1(selection_json));

create or replace function private.enforce_fieldflow_tenant_theme_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not ((new.default_theme_id='fieldflow' and new.default_theme_version='1.0.0') or (new.default_theme_id='onzetrots-tv' and new.default_theme_version='11.0.0')) then raise exception 'authorable screen theme is invalid' using errcode='23514';end if;return new;
end;$$;

create function private.sites_json_nodes_v1(p_document jsonb) returns table(value jsonb,depth integer) language sql immutable security invoker set search_path='' as $$
 with recursive nodes(value,depth) as(select p_document,0 union all select children.value,nodes.depth+1 from nodes cross join lateral(select item.value from pg_catalog.jsonb_each(case when jsonb_typeof(nodes.value)='object' then nodes.value else '{}'::jsonb end) item union all select item.value from pg_catalog.jsonb_array_elements(case when jsonb_typeof(nodes.value)='array' then nodes.value else '[]'::jsonb end) item)children where nodes.depth<17)select * from nodes;
$$;
create function private.sites_asset_references_v1(p_document jsonb) returns setof jsonb language sql immutable security invoker set search_path='' as $$select value from private.sites_json_nodes_v1(p_document) where value->>'kind' in('tenant','system');$$;
create function private.assert_sites_assets_v1(p_tenant_id uuid,p_document jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare ref jsonb;pair record;sites_asset_id uuid;checksums constant jsonb:='{"/favicon.svg":"e6d2e59b7b5bbb0342e0fb496dfc262decbfe4426bbb7b047aec8d467d1dc6f7","/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp":"5115506847b4e78a4ea51618be9fd1c04202ced1564b00a47961e56a6941fe1a","/fieldflow/photos/FF-PHOTO-04-matchday-live-3840x2160-web.webp":"b7fce5339c8c865ee5ae86693c349d5f3a724b5235c9c7b80dcea2d688dfecb0","/fieldflow/photos/FF-PHOTO-05-sponsor-hub-3840x2160-web.webp":"cc94973585c9248d11b9b4bb871416ab49a413904e7bd928132cd0e9a3d1d2ef","/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp":"03dc11dbd5daa87e84d6e8f21b8ec51b54f271537fd24af57dbf4ea9911a254c","/file.svg":"1e0ae4d1a1ddfa36752988647b731e4abf150c414d069ec83c96fb0aaeff0307","/globe.svg":"d051a8c47936990a9085693d307bb7cea1bc1b6d7ed956bcbaacf674f4ec96b9","/onzetrots/brush/brush-frame.png":"4b002d67496adcc267160f002cedd117c8f1b13d619de0404f026647bfd7b9f7","/onzetrots/brush/clubhuis.svg":"8bb77aef3580efc3883cd43c2b10c42c85be0b7a1230a773a72dc377382f5f3b","/onzetrots/brush/duindorp-luchtfoto.svg":"f4c08b3cb5e713d1e317e5e62e1b1ddb3265d5c3442cedab0dc814b07d536e50","/onzetrots/brush/havenlicht.svg":"de9b50862e815400d9544b373fd59d19d844a8e6f635b27fa13109ba6de1f394","/onzetrots/brush/historische-poort.svg":"b6a6b3f19b27270ae610bf383ae79d177ea09f2faa146a0c8419a5e745fb280a","/onzetrots/brush/kerk.svg":"6e7531ea29a64f99b8c2da53f0209ceeb5bef43546246ecc55728379ca01ddf8","/onzetrots/duindorp-logo.png":"832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930","/onzetrots/houtrust-brush.webp":"4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171","/onzetrots/originals/clubhuis.jpg":"59f2c6f69fe0550cb261fe9fb67a46d08038dce890a3d03681d6a8121aec0b1c","/onzetrots/originals/duindorp-luchtfoto.jpg":"c4f9b1a26cff9cc9517cb5392ec684378914c6561d4b1fcb32c23bd107dd23e2","/onzetrots/originals/havenlicht.jpg":"70794084caa404e23e8215e4a33783e094e4210911d49553eeeca45a40945cd8","/onzetrots/originals/historische-poort.jpg":"5065f77c59a6b57dadf458bbc11674bece0cb4563ae65979139ec9b91c2f854c","/onzetrots/originals/kerk.jpg":"36c51d7c7dec84a79336fb176d37ed7fdbb6eadcc7854b5eccf351f4fbcdcbe7","/onzetrots/paint-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/onzetrots/premium/clubhuis.png":"7942a36dd34c06c4b576e122d52acc8f970e9a10af78d2e15861d0893da63efd","/onzetrots/premium/duindorp-luchtfoto.png":"a11606f1cc19a5f5885c506b265d654ac888d449afba1099ebb34a8f59695c60","/onzetrots/premium/havenlicht.png":"0a1009d093fce5d96f8e697624f2509e779acb0b7c36f3f7fac366333dc6db3e","/onzetrots/premium/historische-poort.png":"1776fefafb9f4845c67f1148c7971682b58be68c0f9f2ff2b4545355eac2d5d7","/onzetrots/premium/kerk.png":"0a2b23aaa9a3caddb6b7a6f36f5bfc2ed83c2f64ba32438a63023905d62ee7ec","/onzetrots/readability-brush.svg":"f42dba3e394f6c87a1381a55214c6998ba8e80ee17709702ab537e969a17dfbb","/onzetrots/type-distress.svg":"eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107","/onzetrots-tv/assets/clubmuur-lettering.webp":"c4bf31d7c6331f76f6e4db9bbac59052a01ad9c6f6ae3abe497925f90e15bf32","/onzetrots-tv/assets/clubmuur-players/trio-1280.webp":"543bb88be5c642cac8ed64c3f0f1f8e38608d8640fe5f41623a6477d62b89291","/onzetrots-tv/assets/clubmuur-portraits-v14/05-juichen-1280.webp":"a7519a49d43abe4e0bdc786780ad7d377528114085801c5de2592c38140a3dbb","/onzetrots-tv/assets/clubmuur-portraits-v14/07-walking-1280.webp":"6e5926d26fbf048d3a5e0ef091de8dc3b895df12ebd11e4e2a42c53a53907bfc","/onzetrots-tv/assets/clubmuur-portraits-v17/10-strijd-1280.webp":"16a4d2f6e372ec0deccd0f435506c15351fd54033d486b9b28c44b0cd557d433","/onzetrots-tv/assets/clubmuur-wall.webp":"fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310","/onzetrots-tv/assets/logo.png":"832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930","/onzetrots-tv/assets/sponsors/bnu.svg":"44f2ccd12438bcfb292e1283ecac9ef7f5758d4cb77b14e65835260181285504","/onzetrots-tv/assets/sponsors/deelman-daktechniek.svg":"555ca80ae9e1b9e60cf9179092ac0201e4adaf4032b0d53be979dc6d328e23b1","/onzetrots-tv/assets/sponsors/dg-webservices.svg":"dbe2716900d7137fe74250b2ef0708d668fdc8596161c07474006aed56d1c031","/onzetrots-tv/assets/sponsors/kwaliteit-kozijnen-holland.svg":"9eac38ab31bae0373a516e88724a246841c14a3efa5bfc61ca40b2537b224f68","/onzetrots-tv/assets/sponsors/proto-tegelzetbedrijf.svg":"337a0308cef2a2b7b68d89d0f2afcb789467aaaaf7651803e92e8a4e04321d01","/onzetrots-tv/assets/sponsors/rw-repair.png":"2698a951c6f595bdc3b08cd0ec891575b3122d891cd0b783a8e22515080f866d","/onzetrots-tv/assets/type-distress.svg":"eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107","/window.svg":"decf1cf7bb22b5c99c4857cfcd5718ce5465c4454166317589c83fc73df74b66"}'::jsonb;
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

create function private.assert_sites_studio_v1(p_tenant_id uuid,p_document jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare presentation jsonb:=p_document->'sitesPresentation';slide jsonb:=presentation->'slide';rows integer:=coalesce(jsonb_array_length(slide#>'{tv,rows}'),0);capacity integer;pages integer;seconds numeric;
begin
 if presentation->>'kind' is distinct from 'studio' or presentation->>'schemaVersion' is distinct from '1' or presentation->>'rendererVersion' is distinct from 'sites-v11' or presentation->>'sourceRevision' is distinct from 'b1cae899af19fc39908217253094c5240d7359fc' or slide->>'themeId' not in('fieldflow','onzetrots-tv') or slide->>'orientation' is distinct from p_document#>>'{artboard,orientation}' or jsonb_array_length(p_document->'elements')<>0 then raise exception 'Sites Studio identity invalid' using errcode='23514';end if;
 if rows>200 or slide->>'duration' is null or slide->>'duration'!~'^[0-9]+$' then raise exception 'Sites duration or rows invalid' using errcode='23514';end if;
 seconds:=(slide->>'duration')::numeric;if seconds not between 3 and 120 then raise exception 'Sites page duration invalid' using errcode='23514';end if;
 if slide->>'themeId'='onzetrots-tv' then
  if jsonb_typeof(slide->'tv') is distinct from 'object' or slide#>>'{tv,kind}' not in('wedstrijd','programma','uitslagen','stand','kantine','clubnieuws','partners','welkom','score','goal','lineup','generic') or jsonb_typeof(slide#>'{tv,rows}') is distinct from 'array' then raise exception 'Sites TV content invalid' using errcode='23514';end if;
  capacity:=case slide#>>'{tv,kind}' when 'programma' then 8 when 'uitslagen' then 8 when 'stand' then 8 when 'kantine' then 12 when 'clubnieuws' then 3 when 'partners' then 6 when 'generic' then 6 else 12 end;pages:=greatest(1,ceil(rows::numeric/capacity)::integer);
 else pages:=1;end if;
 if seconds*pages*1000>120000 or(p_document#>>'{motion,durationMs}')::numeric is distinct from seconds*pages*1000 or(pages>1 and p_document#>>'{motion,enabled}' is distinct from 'true') then raise exception 'Sites total duration must match all data pages and remain within 120 seconds' using errcode='23514';end if;
 perform private.assert_sites_assets_v1(p_tenant_id,presentation);
end;$$;
alter function private.assert_studio_document(uuid,text,integer,integer,jsonb,uuid[]) rename to assert_studio_document_before_sites_v11;
create function private.assert_studio_document(p_tenant_id uuid,p_orientation text,p_width integer,p_height integer,p_document jsonb,p_referenced_asset_ids uuid[]) returns void language plpgsql stable security definer set search_path='' as $$
declare refs uuid[];legacy jsonb:=p_document;synthetic jsonb;
begin
 if p_document?'sitesPresentation' then
  perform private.assert_sites_studio_v1(p_tenant_id,p_document);
  select coalesce(array_agg(distinct(ref->>'mediaAssetId')::uuid order by(ref->>'mediaAssetId')::uuid),'{}'::uuid[]) into refs from private.sites_asset_references_v1(p_document->'sitesPresentation')ref where ref->>'kind'='tenant';
  if refs is distinct from private.normalize_studio_asset_ids(p_referenced_asset_ids) then raise exception 'Sites tenant manifest mismatch' using errcode='23514';end if;
  select coalesce(jsonb_agg(jsonb_build_object('type','image','mediaAssetId',asset_id)),'[]'::jsonb)into synthetic from unnest(refs)asset_id;
  legacy:=jsonb_set(jsonb_set(p_document-'sitesPresentation','{elements}',synthetic),'{motion,durationMs}',to_jsonb(least(30000,(p_document#>>'{motion,durationMs}')::integer)));
 end if;
 perform private.assert_studio_document_before_sites_v11(p_tenant_id,p_orientation,p_width,p_height,legacy,p_referenced_asset_ids);
end;$$;

create or replace function private.enforce_fieldflow_dynamic_authoring_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare authored_theme_id text:=coalesce(new.configuration_json#>>'{sitesConfiguration,themeId}',new.configuration_json#>>'{editorial,themeSelection,ref,id}',new.configuration_json#>>'{themeSelection,ref,id}',new.configuration_json#>>'{menuDocument,theme,themeId}',new.configuration_json#>>'{theme,themeId}');sites jsonb:=new.configuration_json->'sitesConfiguration';
begin
 if authored_theme_id is not null and authored_theme_id not in('fieldflow','onzetrots-tv') then raise exception 'authorable dynamic theme is invalid' using errcode='23514';end if;
 if sites is not null then
  if not private.sites_configuration_is_valid_v1(sites) then raise exception 'Sites dynamic configuration invalid'using errcode='23514';end if;
  if sites->>'schemaVersion' is distinct from '1' or sites->>'rendererVersion' is distinct from 'sites-v11' or sites->>'sourceRevision' is distinct from 'b1cae899af19fc39908217253094c5240d7359fc' or sites->>'orientation' not in('landscape','portrait') or sites->>'provider' not in('led-scores','sportlink','menu') or sites->>'seconds'!~'^[0-9]+$' or(sites->>'seconds')::integer not between 3 and 120 or sites->>'scale'!~'^[0-9]+([.][0-9]+)?$' or(sites->>'scale')::numeric not between 70 and 200 then raise exception 'Sites dynamic configuration invalid' using errcode='23514';end if;
  perform private.assert_sites_assets_v1(new.tenant_id,sites);
 end if;return new;
end;$$;

alter function private.ensure_tenant_theme_profile_v1(uuid) rename to ensure_tenant_theme_profile_before_sites_v11;
create function private.ensure_tenant_theme_profile_v1(p_tenant_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.ensure_tenant_theme_profile_before_sites_v11(p_tenant_id);
 insert into public.tenant_theme_profiles(tenant_id,theme_id,theme_version,selection_json,color_overrides,appearance_config)
 select tenant_id,'onzetrots-tv','11.0.0',jsonb_set(jsonb_set(selection_json,'{ref,id}','"onzetrots-tv"'::jsonb),'{ref,version}','"11.0.0"'::jsonb),color_overrides,appearance_config from public.tenant_theme_profiles where tenant_id=p_tenant_id and theme_id='fieldflow' on conflict(tenant_id,theme_id)do nothing;
end;$$;

create or replace function public.update_tenant_theme_settings_v3(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_color_overrides jsonb,
  p_appearance jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_profile public.tenant_theme_profiles%rowtype;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else pg_catalog.upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else pg_catalog.upper(p_support)
  end;
  rollout public.tenant_theme_rollouts%rowtype;
  rollout_id uuid;
  selection jsonb;
  theme_changed boolean;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.settings.manage'
  ) then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  selection := pg_catalog.jsonb_build_object(
    'ref', pg_catalog.jsonb_build_object(
      'catalog', 'v2',
      'id', p_theme_id,
      'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case when normalized_accent is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_accent) end,
    'support', case when normalized_support is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_support) end,
    'categoryOverrides', '[]'::jsonb
  );

  if not ((p_theme_id='fieldflow' and p_theme_version='1.0.0') or (p_theme_id='onzetrots-tv' and p_theme_version='11.0.0'))
    or not private.theme_selection_is_valid_v1(selection)
    or p_color_overrides is null
    or (
      p_color_overrides <> '{}'::jsonb
      and not private.tenant_theme_color_overrides_is_valid_v1(
        p_color_overrides
      )
    )
    or not private.theme_appearance_settings_is_valid_v1(p_appearance)
  then
    raise exception 'tenant theme settings are invalid'
      using errcode = '23514';
  end if;

  perform settings.tenant_id
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'tenant settings not found' using errcode = 'P0002';
  end if;

  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
  for update;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  if current_profile.revision <> p_expected_revision then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;

  theme_changed := exists(select 1 from public.tenant_settings where tenant_id=p_tenant_id and default_theme_id is distinct from p_theme_id) or
    current_profile.theme_version is distinct from p_theme_version
    or current_profile.selection_json is distinct from selection
    or current_profile.color_overrides is distinct from p_color_overrides
    or current_profile.appearance_config is distinct from p_appearance;
  if not theme_changed then
    return pg_catalog.jsonb_build_object(
      'outcome', 'noop',
      'queuedSnapshotCount', 0,
      'snapshotCount', 0,
      'releaseTargetCount', 0,
      'revision', current_profile.revision
    );
  end if;

  -- A design version that is still publishing has no stable immutable source
  -- snapshot yet. Wait instead of mixing two theme revisions in one version.
  perform slide.id
  from public.dynamic_slides slide
  where slide.tenant_id = p_tenant_id
    and slide.status <> 'archived'
    and slide.current_published_version_id is not null
  order by slide.id
  for update;
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
  ) then
    raise exception 'wait for active slide publication before theme rollout'
      using errcode = '55000';
  end if;

  next_revision := current_profile.revision + 1;
  update public.tenant_theme_profiles profile
  set theme_version = p_theme_version,
      selection_json = selection,
      color_overrides = p_color_overrides,
      appearance_config = p_appearance,
      revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id;

  -- tenant_settings remains a compatibility mirror for old readers only.
  update public.tenant_settings settings
  set default_theme_id = p_theme_id,
      default_theme_version = p_theme_version,
      theme_mode_policy = p_mode_policy,
      theme_accent = normalized_accent,
      theme_support = normalized_support,
      theme_color_overrides = p_color_overrides,
      theme_settings_revision = next_revision,
      updated_by = actor_id,
      updated_at = now()
  where settings.tenant_id = p_tenant_id;

  rollout_id := private.start_tenant_theme_rollout_v2(
    p_tenant_id,
    p_theme_id,
    next_revision,
    actor_id,
    null
  );
  select candidate.* into rollout
  from public.tenant_theme_rollouts candidate
  where candidate.tenant_id = p_tenant_id
    and candidate.id = rollout_id;

  perform private.audit_event(
    p_tenant_id,
    'tenant.theme.updated',
    'tenant_theme_profiles',
    p_tenant_id,
    'success',
    pg_catalog.jsonb_build_object(
      'themeId', p_theme_id,
      'themeVersion', p_theme_version,
      'settingsRevision', next_revision,
      'rolloutId', rollout_id,
      'snapshotCount', rollout.snapshot_count,
      'releaseTargetCount', rollout.release_target_count,
      'immutable', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', rollout.snapshot_count,
    'snapshotCount', rollout.snapshot_count,
    'releaseTargetCount', rollout.release_target_count,
    'revision', next_revision,
    'rolloutId', rollout_id,
    'status', rollout.status
  );
end;
$$;

create or replace function public.update_tenant_theme_settings_v1(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preserved_appearance jsonb;
  preserved_colors jsonb;
  result jsonb;
  next_revision bigint;
begin
  if private.current_user_id() is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not ((p_theme_id='fieldflow' and p_theme_version='1.0.0') or (p_theme_id='onzetrots-tv' and p_theme_version='11.0.0'))
  then
    raise exception 'new tenant theme settings must use FieldFlow 1.0.0'
      using errcode = '23514';
  end if;
  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.appearance_config, profile.color_overrides
  into preserved_appearance, preserved_colors
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  result := public.update_tenant_theme_settings_v3(
    p_tenant_id,
    p_expected_revision,
    p_theme_id,
    p_theme_version,
    p_mode_policy,
    preserved_colors,
    preserved_appearance,
    p_accent,
    p_support
  );
  if result ->> 'outcome' <> 'noop' then
    return result;
  end if;

  -- v1 historically treated a successful compare-and-swap as applied even
  -- when its visible values matched the defaults. Preserve that revision
  -- contract without claiming a rollout for unchanged presentation settings.
  update public.tenant_theme_profiles profile
  set revision = profile.revision + 1,
      updated_by = private.current_user_id(),
      updated_at = pg_catalog.now()
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
    and profile.revision = p_expected_revision
  returning profile.revision into next_revision;
  if next_revision is null then
    return pg_catalog.jsonb_build_object('outcome', 'conflict');
  end if;
  update public.tenant_settings settings
  set theme_settings_revision = next_revision,
      updated_by = private.current_user_id(),
      updated_at = pg_catalog.now()
  where settings.tenant_id = p_tenant_id;
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'queuedSnapshotCount', 0,
    'snapshotCount', 0,
    'releaseTargetCount', 0,
    'revision', next_revision
  );
end;
$$;

create or replace function public.update_tenant_theme_settings_v2(
  p_tenant_id uuid,
  p_expected_revision bigint,
  p_theme_id text,
  p_theme_version text,
  p_mode_policy jsonb,
  p_color_overrides jsonb,
  p_accent text default null,
  p_support text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preserved_appearance jsonb;
  actor_id uuid := private.current_user_id();
  current_profile public.tenant_theme_profiles%rowtype;
  data_source record;
  next_revision bigint;
  normalized_accent text := case
    when p_accent is null then null else pg_catalog.upper(p_accent)
  end;
  normalized_support text := case
    when p_support is null then null else pg_catalog.upper(p_support)
  end;
  queued_count integer := 0;
  selection jsonb;
begin
  if actor_id is null
    or not private.has_tenant_capability(
      p_tenant_id,
      'tenant.settings.manage'
    )
  then
    raise exception 'actor cannot update tenant theme settings'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  selection := pg_catalog.jsonb_build_object(
    'ref', pg_catalog.jsonb_build_object(
      'catalog', 'v2',
      'id', p_theme_id,
      'version', p_theme_version
    ),
    'modePolicy', p_mode_policy,
    'accent', case when normalized_accent is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_accent) end,
    'support', case when normalized_support is null
      then 'null'::jsonb else pg_catalog.to_jsonb(normalized_support) end,
    'categoryOverrides', '[]'::jsonb
  );
  if not ((p_theme_id='fieldflow' and p_theme_version='1.0.0') or (p_theme_id='onzetrots-tv' and p_theme_version='11.0.0'))
    or not private.theme_selection_is_valid_v1(selection)
    or p_color_overrides is null
    or (
      p_color_overrides <> '{}'::jsonb
      and not private.tenant_theme_color_overrides_is_valid_v1(
        p_color_overrides
      )
    )
  then
    raise exception 'tenant theme colors are invalid' using errcode = '23514';
  end if;
  perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = p_theme_id
  for update;
  if not found then
    raise exception 'tenant theme profile not found' using errcode = 'P0002';
  end if;
  preserved_appearance := current_profile.appearance_config;

  -- A legacy v2 caller may already have started publishing a new design
  -- version. Refresh that exact publishing version with the new theme instead
  -- of aborting it; the current v3 UI intentionally remains stricter.
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
  ) then
    if current_profile.revision <> p_expected_revision then
      return pg_catalog.jsonb_build_object('outcome', 'conflict');
    end if;
    next_revision := current_profile.revision + 1;
    update public.tenant_theme_profiles profile
    set theme_version = p_theme_version,
        selection_json = selection,
        color_overrides = p_color_overrides,
        revision = next_revision,
        updated_by = actor_id,
        updated_at = pg_catalog.now()
    where profile.tenant_id = p_tenant_id
      and profile.theme_id = p_theme_id;
    update public.tenant_settings settings
    set default_theme_id = p_theme_id,
        default_theme_version = p_theme_version,
        theme_mode_policy = p_mode_policy,
        theme_accent = normalized_accent,
        theme_support = normalized_support,
        theme_color_overrides = p_color_overrides,
        theme_settings_revision = next_revision,
        updated_by = actor_id,
        updated_at = pg_catalog.now()
    where settings.tenant_id = p_tenant_id;

    for data_source in
      select distinct slide.data_source_id
      from public.dynamic_slides slide
      where slide.tenant_id = p_tenant_id
        and slide.data_source_id is not null
        and slide.selection_mode = 'latest'
        and slide.status <> 'archived'
      order by slide.data_source_id
    loop
      queued_count := queued_count + private.queue_latest_dynamic_snapshots_v2(
        p_tenant_id,
        data_source.data_source_id,
        null,
        'tenant_theme_colors_changed'
      );
    end loop;

    perform private.audit_event(
      p_tenant_id,
      'tenant.theme.updated',
      'tenant_theme_profiles',
      p_tenant_id,
      'success',
      pg_catalog.jsonb_build_object(
        'themeId', p_theme_id,
        'themeVersion', p_theme_version,
        'revision', next_revision,
        'queuedSnapshotCount', queued_count,
        'legacyPublishingCompatibility', true
      )
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'applied',
      'queuedSnapshotCount', queued_count,
      'revision', next_revision
    );
  end if;

  return public.update_tenant_theme_settings_v3(
    p_tenant_id,
    p_expected_revision,
    p_theme_id,
    p_theme_version,
    p_mode_policy,
    p_color_overrides,
    preserved_appearance,
    p_accent,
    p_support
  );
end;
$$;

-- Wrap the current S161/S188 pipeline: runtime metadata, full provider data,
-- standings enrichment and policy-owned timezone resolution remain intact.
create function private.apply_sites_theme_profile_v1(p_tenant_id uuid,p_result jsonb,p_theme_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile public.tenant_theme_profiles%rowtype;policy jsonb;timezone_name text;resolved_at timestamptz:=statement_timestamp();result jsonb:=p_result;
begin
 if p_theme_id is distinct from 'onzetrots-tv' then return result;end if;
 select * into profile from public.tenant_theme_profiles where tenant_id=p_tenant_id and theme_id=p_theme_id;
 if profile.tenant_id is null or not private.theme_selection_is_valid_v1(profile.selection_json) then raise exception 'screen theme profile unavailable' using errcode='P0002';end if;
 policy:=profile.selection_json->'modePolicy';timezone_name:=private.resolve_tenant_theme_timezone_v1(p_tenant_id,policy);
 result:=jsonb_set(result,'{themePresentation}',jsonb_build_object('appearance',profile.appearance_config,'catalogVersion','1.0.0','settingsRevision',profile.revision,'snapshotVersion',2,'selection',profile.selection_json,'resolvedMode',jsonb_build_object('mode',private.resolve_theme_mode_v1(policy,timezone_name,resolved_at),'policy',policy,'resolvedAt',to_char(resolved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'timezone',timezone_name)),true);
 if result?'editorial' then result:=jsonb_set(result,'{editorial,themeSelection}',profile.selection_json,true);end if;
 if result?'_veyocastThemeRollout' then result:=jsonb_set(result,'{_veyocastThemeRollout,settingsRevision}',to_jsonb(profile.revision),true);end if;
 return result;
end;$$;
revoke all on function private.apply_sites_theme_profile_v1(uuid,jsonb,text) from public,anon,authenticated,service_role;

alter function private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid) rename to apply_tenant_theme_to_snapshot_before_sites_v11;
create function private.apply_tenant_theme_to_snapshot_v1(p_tenant_id uuid,p_snapshot_data jsonb,p_rollout_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;theme_id text;
begin
 result:=private.apply_tenant_theme_to_snapshot_before_sites_v11(p_tenant_id,p_snapshot_data,p_rollout_id);
 select default_theme_id into theme_id from public.tenant_settings where tenant_id=p_tenant_id;
 return private.apply_sites_theme_profile_v1(p_tenant_id,result,theme_id);
end;$$;
revoke all on function private.apply_tenant_theme_to_snapshot_v1(uuid,jsonb,uuid),private.apply_tenant_theme_to_snapshot_before_sites_v11(uuid,jsonb,uuid) from public,anon,authenticated,service_role;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides) rename to build_dynamic_snapshot_data_before_sites_v11;
create function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;theme_id text;sites jsonb:=p_slide.configuration_json->'sitesConfiguration';
begin
 result:=private.build_dynamic_snapshot_data_before_sites_v11(p_slide);
 select coalesce(sites->>'themeId',settings.default_theme_id) into theme_id from public.tenant_settings settings where tenant_id=p_slide.tenant_id;
 result:=private.apply_sites_theme_profile_v1(p_slide.tenant_id,result,theme_id);
 if sites is not null then result:=jsonb_set(result,'{sitesConfiguration}',sites,true);end if;
 if p_slide.configuration_json#>'{menuDocument,sitesConfiguration}' is not null then result:=jsonb_set(result,'{sitesConfiguration}',p_slide.configuration_json#>'{menuDocument,sitesConfiguration}',true);end if;
 return result;
end;$$;
revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides),private.build_dynamic_snapshot_data_before_sites_v11(public.dynamic_slides) from public,anon,authenticated,service_role;

create or replace function private.require_current_theme_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_revision bigint;
  snapshot_revision bigint;
  snapshot_theme_id text;
begin
  if new.current_snapshot_id is null
    or new.current_snapshot_id is not distinct from old.current_snapshot_id
  then
    return new;
  end if;

  select
    snapshot.snapshot_data_json #>> '{themePresentation,selection,ref,id}',
    case
      when snapshot.snapshot_data_json #>> '{themePresentation,settingsRevision}'
        ~ '^[0-9]+$'
      then (
        snapshot.snapshot_data_json #>> '{themePresentation,settingsRevision}'
      )::bigint
      else -1
    end
  into snapshot_theme_id, snapshot_revision
  from public.dynamic_slide_snapshots snapshot
  where snapshot.tenant_id = new.tenant_id
    and snapshot.id = new.current_snapshot_id;

  if snapshot_theme_id not in ('fieldflow','onzetrots-tv') then
    return new;
  end if;

  select profile.revision
  into profile_revision
  from public.tenant_theme_profiles profile
  where profile.tenant_id = new.tenant_id
    and profile.theme_id = snapshot_theme_id;

  if profile_revision is not null
    and coalesce(snapshot_revision, -1) < profile_revision
  then
    new.current_snapshot_id := old.current_snapshot_id;
    new.status := case
      when old.status = 'archived' then 'archived'
      when old.current_snapshot_id is not null then 'ready'
      else old.status
    end;
    new.last_error_code := 'STALE_THEME_SNAPSHOT_IGNORED';
  end if;
  return new;
end;
$$;

alter function private.validate_menu_document_v2(uuid,uuid,jsonb) rename to validate_menu_document_before_sites_v11;
create function private.validate_menu_document_v2(p_tenant_id uuid,p_data_source_id uuid,p_document jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare validation_document jsonb:=p_document;
begin
 if p_document?'sitesConfiguration' then
  if not private.sites_configuration_is_valid_v1(p_document->'sitesConfiguration') or p_document#>>'{sitesConfiguration,provider}' is distinct from 'menu' or p_document#>>'{sitesConfiguration,themeId}' is distinct from p_document#>>'{theme,themeId}' then raise exception 'Sites Menu configuration invalid'using errcode='23514';end if;
  perform private.assert_sites_assets_v1(p_tenant_id,p_document->'sitesConfiguration');
  validation_document:=validation_document-'sitesConfiguration';
 end if;
 if p_document#>>'{theme,themeId}'='onzetrots-tv' then
  if p_document#>>'{theme,themeVersion}' is distinct from '11.0.0' then raise exception 'Sites menu theme version invalid' using errcode='23514';end if;
  validation_document:=jsonb_set(jsonb_set(validation_document,'{theme,themeId}','"fieldflow"'::jsonb),'{theme,themeVersion}','"1.0.0"'::jsonb);
 end if;perform private.validate_menu_document_before_sites_v11(p_tenant_id,p_data_source_id,validation_document);
end;$$;
revoke all on function private.sites_json_nodes_v1(jsonb),private.sites_asset_references_v1(jsonb),private.assert_sites_assets_v1(uuid,jsonb),private.assert_sites_studio_v1(uuid,jsonb),private.assert_studio_document(uuid,text,integer,integer,jsonb,uuid[]),private.assert_studio_document_before_sites_v11(uuid,text,integer,integer,jsonb,uuid[]),private.ensure_tenant_theme_profile_v1(uuid),private.ensure_tenant_theme_profile_before_sites_v11(uuid),private.validate_menu_document_v2(uuid,uuid,jsonb),private.validate_menu_document_before_sites_v11(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
comment on function private.assert_sites_studio_v1(uuid,jsonb) is 'S191 trusted Sites v11 document, fixed artboard, verified tenant/system assets, complete paging <=120s; legacy documents retain previous limits.';

create or replace function public.save_studio_draft_v1(
  p_project_id uuid,
  p_expected_revision bigint,
  p_document jsonb,
  p_referenced_asset_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  next_motion_enabled boolean;
  next_duration_ms integer;
  next_document_hash text;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  checkpoint_revision_id uuid;
  checkpoint_revision_number bigint;
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
  then
    raise exception 'actor cannot edit Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot edit Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected Studio revision is invalid' using errcode = '23514';
  end if;
  perform private.assert_studio_document(
    project_record.tenant_id,
    case when p_document ? 'sitesPresentation' then p_document #>> '{artboard,orientation}' else project_record.orientation end,
    case when p_document ? 'sitesPresentation' then (p_document #>> '{artboard,width}')::integer else project_record.width end,
    case when p_document ? 'sitesPresentation' then (p_document #>> '{artboard,height}')::integer else project_record.height end,
    p_document,
    normalized_asset_ids
  );
  next_motion_enabled := (p_document #>> '{motion,enabled}')::boolean;
  next_duration_ms := (p_document #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot edit Studio motion' using errcode = '42501';
  end if;

  next_document_hash := private.studio_document_hash(p_document);
  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedRevision', p_expected_revision,
    'documentHash', next_document_hash,
    'referencedAssetIds', to_jsonb(normalized_asset_ids)
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;

  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id
  for update;

  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;
  if project_record.status <> 'active' then
    raise exception 'Studio project is not editable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.draft.save',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.draft.conflict',
      'failed'
    );
  end if;

  update public.studio_project_drafts
  set
    draft_revision = draft_revision + 1,
    document_json = p_document,
    document_hash = next_document_hash,
    referenced_asset_ids = normalized_asset_ids,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and project_id = project_record.id
  returning draft_revision into draft_record.draft_revision;

  update public.studio_projects
  set
    orientation = case when p_document ? 'sitesPresentation' then p_document #>> '{artboard,orientation}' else orientation end,
    width = case when p_document ? 'sitesPresentation' then (p_document #>> '{artboard,width}')::integer else width end,
    height = case when p_document ? 'sitesPresentation' then (p_document #>> '{artboard,height}')::integer else height end,
    motion_enabled = next_motion_enabled,
    duration_ms = next_duration_ms,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and id = project_record.id
  returning revision into project_record.revision;

  if draft_record.draft_revision % 10 = 0 then
    select coalesce(max(revision.revision_number), 0) + 1
    into checkpoint_revision_number
    from public.studio_revisions revision
    where revision.tenant_id = project_record.tenant_id
      and revision.project_id = project_record.id;

    insert into public.studio_revisions (
      tenant_id,
      project_id,
      revision_number,
      draft_revision,
      schema_version,
      document_json,
      document_hash,
      reason,
      created_by
    )
    values (
      project_record.tenant_id,
      project_record.id,
      checkpoint_revision_number,
      draft_record.draft_revision,
      draft_record.schema_version,
      p_document,
      next_document_hash,
      'checkpoint',
      actor_id
    )
    returning id into checkpoint_revision_id;

    insert into public.studio_revision_assets (
      tenant_id,
      project_id,
      revision_id,
      media_asset_id
    )
    select
      project_record.tenant_id,
      project_record.id,
      checkpoint_revision_id,
      asset_id
    from unnest(normalized_asset_ids) asset_id;
  end if;

  outcome := jsonb_strip_nulls(jsonb_build_object(
    'outcome', 'saved',
    'projectId', project_record.id,
    'projectRevision', project_record.revision,
    'draftRevision', draft_record.draft_revision,
    'checkpointRevisionId', checkpoint_revision_id,
    'checkpointRevisionNumber', checkpoint_revision_number
  ));
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
    p_idempotency_key,
    request_json,
    'studio_projects',
    project_record.id,
    outcome,
    'studio.draft.saved'
  );
end;
$$;

-- Retain the established FieldFlow publication barrier and extend it to TV.
alter function private.assert_theme_release_pointer_current_v1(uuid,uuid) rename to assert_theme_release_pointer_before_sites_v11;
create function private.assert_theme_release_pointer_current_v1(p_tenant_id uuid,p_release_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_theme_release_pointer_before_sites_v11(p_tenant_id,p_release_id);
 perform profile.tenant_id from public.tenant_theme_profiles profile where tenant_id=p_tenant_id and theme_id='onzetrots-tv' for share;
 if exists(select 1 from public.playlist_release_items item join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id join public.tenant_theme_profiles profile on profile.tenant_id=item.tenant_id and profile.theme_id='onzetrots-tv' where item.tenant_id=p_tenant_id and item.release_id=p_release_id and snapshot.snapshot_data_json#>>'{themePresentation,selection,ref,id}'='onzetrots-tv' and snapshot.snapshot_data_json#>>'{themePresentation,settingsRevision}' is distinct from profile.revision::text) then raise exception 'release contains stale screen theme snapshot' using errcode='55000';end if;
end;$$;
revoke all on function private.assert_theme_release_pointer_current_v1(uuid,uuid),private.assert_theme_release_pointer_before_sites_v11(uuid,uuid) from public,anon,authenticated,service_role;

create function private.sites_configuration_is_valid_v1(p_sites jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text;value numeric;
begin
 if jsonb_typeof(p_sites) is distinct from 'object' or p_sites->>'schemaVersion' is distinct from '1' or p_sites->>'rendererVersion' is distinct from 'sites-v11' or p_sites->>'sourceRevision' is distinct from 'b1cae899af19fc39908217253094c5240d7359fc' or coalesce(p_sites->>'themeId','') not in('fieldflow','onzetrots-tv') or coalesce(p_sites->>'orientation','') not in('landscape','portrait') or coalesce(p_sites->>'provider','') not in('led-scores','sportlink','menu') or jsonb_typeof(p_sites->'title') is distinct from 'string' or length(p_sites->>'title')>240 or jsonb_typeof(p_sites->'subtitle') is distinct from 'string' or length(p_sites->>'subtitle')>1000 then return false;end if;
 if p_sites->>'provider'='led-scores' and(p_sites->>'rowsPerPage')::numeric>8 then return false;end if;
 if exists(select 1 from jsonb_object_keys(p_sites)actual where actual<>all(array['schemaVersion','rendererVersion','sourceRevision','themeId','orientation','provider','title','subtitle','background','overlay','accent','layout','scale','align','safeArea','seconds','rowsPerPage','ledTheme','ledMoment','ledSide','titleScale','scoreScale','logoScale','teamScale','showBranding','showSceneLabel','showClock','showTimeline','timelineLimit','backgroundFit','grunge','animation','showCategories','ledTemplate'])) then return false;end if;
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
revoke all on function private.sites_configuration_is_valid_v1(jsonb) from public,anon,authenticated,service_role;

-- Restoring a Sites revision restores its validated artboard atomically.
create or replace function public.restore_studio_revision_v1(
  p_project_id uuid,
  p_revision_id uuid,
  p_expected_draft_revision bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  source_revision public.studio_revisions%rowtype;
  source_asset_ids uuid[];
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  restored_revision_id uuid;
  restored_revision_number bigint;
  next_motion_enabled boolean;
  next_duration_ms integer;
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;
  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
  then
    raise exception 'actor cannot restore Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot restore Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_draft_revision is null or p_expected_draft_revision < 0 then
    raise exception 'expected Studio revision is invalid' using errcode = '23514';
  end if;

  select revision.*
  into source_revision
  from public.studio_revisions revision
  where revision.tenant_id = project_record.tenant_id
    and revision.project_id = project_record.id
    and revision.id = p_revision_id;
  if not found then
    raise exception 'Studio revision not found' using errcode = 'P0002';
  end if;

  select coalesce(
    array_agg(revision_asset.media_asset_id order by revision_asset.media_asset_id),
    '{}'::uuid[]
  )
  into source_asset_ids
  from public.studio_revision_assets revision_asset
  where revision_asset.tenant_id = source_revision.tenant_id
    and revision_asset.revision_id = source_revision.id;

  perform private.assert_studio_document(
    project_record.tenant_id,
    case when source_revision.document_json?'sitesPresentation' then source_revision.document_json#>>'{artboard,orientation}' else project_record.orientation end,
    case when source_revision.document_json?'sitesPresentation' then (source_revision.document_json#>>'{artboard,width}')::integer else project_record.width end,
    case when source_revision.document_json?'sitesPresentation' then (source_revision.document_json#>>'{artboard,height}')::integer else project_record.height end,
    source_revision.document_json,
    source_asset_ids
  );
  next_motion_enabled :=
    (source_revision.document_json #>> '{motion,enabled}')::boolean;
  next_duration_ms :=
    (source_revision.document_json #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot restore Studio motion' using errcode = '42501';
  end if;

  request_json := jsonb_build_object(
    'projectId', project_record.id,
    'revisionId', source_revision.id,
    'expectedDraftRevision', p_expected_draft_revision,
    'documentHash', source_revision.document_hash
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.revision.restore',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;
  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id
  for update;
  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;
  if project_record.status <> 'active' then
    raise exception 'Studio project is not restorable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_draft_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'sourceRevisionId', source_revision.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.revision.restore',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.revision.restore_conflict',
      'failed'
    );
  end if;

  update public.studio_project_drafts
  set
    draft_revision = draft_revision + 1,
    schema_version = source_revision.schema_version,
    document_json = source_revision.document_json,
    document_hash = source_revision.document_hash,
    referenced_asset_ids = source_asset_ids,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and project_id = project_record.id
  returning * into draft_record;

  update public.studio_projects
  set
    orientation=case when source_revision.document_json?'sitesPresentation' then source_revision.document_json#>>'{artboard,orientation}' else orientation end,
    width=case when source_revision.document_json?'sitesPresentation' then (source_revision.document_json#>>'{artboard,width}')::integer else width end,
    height=case when source_revision.document_json?'sitesPresentation' then (source_revision.document_json#>>'{artboard,height}')::integer else height end,
    motion_enabled = next_motion_enabled,
    duration_ms = next_duration_ms,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and id = project_record.id
  returning * into project_record;

  select coalesce(max(revision.revision_number), 0) + 1
  into restored_revision_number
  from public.studio_revisions revision
  where revision.tenant_id = project_record.tenant_id
    and revision.project_id = project_record.id;

  insert into public.studio_revisions (
    tenant_id,
    project_id,
    revision_number,
    draft_revision,
    schema_version,
    document_json,
    document_hash,
    reason,
    created_by
  )
  values (
    project_record.tenant_id,
    project_record.id,
    restored_revision_number,
    draft_record.draft_revision,
    source_revision.schema_version,
    source_revision.document_json,
    source_revision.document_hash,
    'restore',
    actor_id
  )
  returning id into restored_revision_id;

  insert into public.studio_revision_assets (
    tenant_id,
    project_id,
    revision_id,
    media_asset_id
  )
  select
    project_record.tenant_id,
    project_record.id,
    restored_revision_id,
    media_asset_id
  from unnest(source_asset_ids) media_asset_id;

  outcome := jsonb_build_object(
    'outcome', 'restored',
    'projectId', project_record.id,
    'sourceRevisionId', source_revision.id,
    'revisionId', restored_revision_id,
    'revisionNumber', restored_revision_number,
    'projectRevision', project_record.revision,
    'draftRevision', draft_record.draft_revision
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.revision.restore',
    p_idempotency_key,
    request_json,
    'studio_revisions',
    restored_revision_id,
    outcome,
    'studio.revision.restored'
  );
end;
$$;
