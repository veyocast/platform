-- S313: additive platform editorial boundary. No tenant or Player data changes.
-- Published reads are invoker/RLS reads; a successful publish commit is immediately live.
create table public.platform_blog_sites (
  site_id text not null check (site_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  environment text not null check (environment in ('development','test','staging','production')),
  public_origin text not null check (public_origin ~ '^https://[a-z0-9.-]+(:[0-9]+)?$' or (environment in ('development','test') and public_origin ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$')),
  created_at timestamptz not null default now(),
  primary key (site_id, environment)
);
create table public.platform_blog_posts (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  environment text not null,
  external_id text not null check (external_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'),
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  published_revision bigint,
  canonical_slug text,
  first_published_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (site_id,environment) references public.platform_blog_sites(site_id,environment),
  unique (site_id,environment,external_id),
  unique (id,site_id,environment),
  check ((published_revision is null and canonical_slug is null and published_at is null) or (published_revision is not null and canonical_slug is not null and published_at is not null))
);
create table public.platform_blog_revisions (
  post_id uuid not null,
  site_id text not null,
  environment text not null,
  revision bigint not null check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  primary key (post_id,revision),
  unique (post_id,revision,site_id,environment),
  foreign key (post_id,site_id,environment) references public.platform_blog_posts(id,site_id,environment)
);
alter table public.platform_blog_posts add constraint platform_blog_published_revision_fk foreign key(id,published_revision) references public.platform_blog_revisions(post_id,revision) deferrable initially deferred;
-- Zero exists only inside a creation command; every committed pointer must resolve.
alter table public.platform_blog_posts add constraint platform_blog_draft_revision_fk foreign key(id,draft_revision) references public.platform_blog_revisions(post_id,revision) deferrable initially deferred;
create table public.platform_blog_routes (
  site_id text not null,
  environment text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
  post_id uuid not null,
  was_published boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(site_id,environment,slug),
  unique(site_id,environment,slug,post_id),
  foreign key(post_id,site_id,environment) references public.platform_blog_posts(id,site_id,environment)
);
alter table public.platform_blog_posts add constraint platform_blog_canonical_route_fk foreign key(site_id,environment,canonical_slug,id) references public.platform_blog_routes(site_id,environment,slug,post_id) deferrable initially deferred;
create index platform_blog_routes_post_idx on public.platform_blog_routes(post_id);
create table public.platform_blog_assets (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  environment text not null,
  storage_path text not null unique,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  output_sha256 text not null check (output_sha256 ~ '^[a-f0-9]{64}$'),
  type text not null check (type in ('image/jpeg','image/png','image/webp')),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  bytes bigint not null check (bytes between 1 and 8388608),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_at timestamptz not null default now(),
  unique(id,site_id,environment),
  foreign key(site_id,environment) references public.platform_blog_sites(site_id,environment),
  check (width::bigint*height::bigint<=40000000)
);
create index platform_blog_assets_site_idx on public.platform_blog_assets(site_id,environment);
create table public.platform_blog_revision_assets (
  post_id uuid not null,
  revision bigint not null,
  site_id text not null,
  environment text not null,
  asset_id uuid not null,
  primary key(post_id,revision,asset_id),
  foreign key(post_id,revision,site_id,environment) references public.platform_blog_revisions(post_id,revision,site_id,environment),
  foreign key(asset_id,site_id,environment) references public.platform_blog_assets(id,site_id,environment)
);
create index platform_blog_revision_assets_asset_idx on public.platform_blog_revision_assets(asset_id);
create index platform_blog_posts_public_idx on public.platform_blog_posts(site_id,environment,published_at desc) where published_revision is not null;
create index platform_blog_revisions_scope_idx on public.platform_blog_revisions(site_id,environment);

-- Secrets, receipts and counters have no Data API grants. A receipt is retained indefinitely:
-- it cannot expire before a delayed SocialHero task or a recovered process replays it.
create table private.platform_blog_tokens (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  environment text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  label text not null check(length(label) between 1 and 80),
  scopes text[] not null check(cardinality(scopes)>0 and scopes <@ array['capabilities:read','posts:read','media:write','posts:write','posts:publish']::text[]),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  foreign key(site_id,environment) references public.platform_blog_sites(site_id,environment)
);
create index platform_blog_tokens_site_idx on private.platform_blog_tokens(site_id,environment);
create table private.platform_blog_rate_limits (
  token_id uuid not null references private.platform_blog_tokens(id),
  scope text not null,
  window_start timestamptz not null,
  requests integer not null check(requests>0),
  primary key(token_id,scope)
);
create table private.platform_blog_human_media_limits (
  user_id uuid not null references public.profiles(id),
  site_id text not null,
  environment text not null,
  window_start timestamptz not null,
  requests integer not null check(requests>0),
  primary key(user_id,site_id,environment),
  foreign key(site_id,environment) references public.platform_blog_sites(site_id,environment)
);
create table private.platform_blog_receipts (
  site_id text not null,
  environment text not null,
  operation text not null,
  idempotency_key text not null check(length(idempotency_key) between 8 and 200),
  fingerprint text not null,
  response jsonb,
  intent jsonb,
  actor_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(site_id,environment,operation,idempotency_key),
  foreign key(site_id,environment) references public.platform_blog_sites(site_id,environment)
);
alter table private.platform_blog_tokens enable row level security;
alter table private.platform_blog_rate_limits enable row level security;
alter table private.platform_blog_human_media_limits enable row level security;
alter table private.platform_blog_receipts enable row level security;
revoke all on private.platform_blog_tokens,private.platform_blog_rate_limits,private.platform_blog_human_media_limits,private.platform_blog_receipts from public,anon,authenticated,service_role;

create function private.blog_staff()
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_platform_member(array['platform_owner','platform_admin']::public.platform_role[]);
$$;
revoke all on function private.blog_staff() from public,anon,authenticated,service_role;
grant execute on function private.blog_staff() to authenticated,service_role;

alter table public.platform_blog_sites enable row level security;
alter table public.platform_blog_posts enable row level security;
alter table public.platform_blog_revisions enable row level security;
alter table public.platform_blog_routes enable row level security;
alter table public.platform_blog_assets enable row level security;
alter table public.platform_blog_revision_assets enable row level security;
revoke all on public.platform_blog_sites,public.platform_blog_posts,public.platform_blog_revisions,public.platform_blog_routes,public.platform_blog_assets,public.platform_blog_revision_assets from public,anon,authenticated,service_role;
grant select on public.platform_blog_sites,public.platform_blog_posts,public.platform_blog_revisions,public.platform_blog_routes,public.platform_blog_assets,public.platform_blog_revision_assets to authenticated,service_role;
grant select on public.platform_blog_sites,public.platform_blog_routes,public.platform_blog_assets,public.platform_blog_revision_assets to anon;
grant select(post_id,site_id,environment,revision,payload,created_at) on public.platform_blog_revisions to anon;
-- An anonymous read cannot inspect draft pointers or unpublished modification timestamps.
grant select(id,site_id,environment,external_id,published_revision,canonical_slug,first_published_at,published_at) on public.platform_blog_posts to anon;
create policy blog_sites_read on public.platform_blog_sites for select to anon,authenticated using(true);
create policy blog_posts_staff on public.platform_blog_posts for select to authenticated using((select private.blog_staff()));
create policy blog_posts_public on public.platform_blog_posts for select to anon,authenticated using(published_revision is not null);
create policy blog_revisions_staff on public.platform_blog_revisions for select to authenticated using((select private.blog_staff()));
create policy blog_revisions_public on public.platform_blog_revisions for select to anon,authenticated using(exists(select 1 from public.platform_blog_posts p where p.id=post_id and p.published_revision=revision));
create policy blog_routes_staff on public.platform_blog_routes for select to authenticated using((select private.blog_staff()));
create policy blog_routes_public on public.platform_blog_routes for select to anon,authenticated using(was_published and exists(select 1 from public.platform_blog_posts p where p.id=post_id and p.published_revision is not null));
create policy blog_refs_staff on public.platform_blog_revision_assets for select to authenticated using((select private.blog_staff()));
create policy blog_refs_public on public.platform_blog_revision_assets for select to anon,authenticated using(exists(select 1 from public.platform_blog_posts p where p.id=post_id and p.published_revision=revision));
create policy blog_assets_staff on public.platform_blog_assets for select to authenticated using((select private.blog_staff()));
create policy blog_assets_public on public.platform_blog_assets for select to anon,authenticated using(status='ready' and exists(select 1 from public.platform_blog_revision_assets a join public.platform_blog_posts p on p.id=a.post_id and p.published_revision=a.revision where a.asset_id=platform_blog_assets.id));
create view public.platform_blog_publications with(security_invoker=true) as
 select p.id,p.external_id,p.site_id,p.environment,r.revision,r.payload,p.published_at,
        r.created_at as updated_at,p.first_published_at,p.canonical_slug as slug
 from public.platform_blog_posts p join public.platform_blog_revisions r on r.post_id=p.id and r.revision=p.published_revision;
revoke all on public.platform_blog_publications from public,anon,authenticated,service_role;
grant select on public.platform_blog_publications to anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('platform_blog_media','platform_blog_media',false,8388608,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
create policy blog_storage_select on storage.objects for select to authenticated
 using(bucket_id='platform_blog_media' and (select private.blog_staff()) and exists(select 1 from public.platform_blog_assets a where a.storage_path=name));
create policy blog_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='platform_blog_media' and (select private.blog_staff()) and (select private.current_aal())='aal2' and exists(select 1 from public.platform_blog_assets a where a.storage_path=name and a.status='pending'));
-- No UPDATE/DELETE policy: immutable media cannot be replaced through an editor session.

create function private.blog_immutable_revision()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_REVISION' using errcode='PT409'; end;
$$;
revoke all on function private.blog_immutable_revision() from public,anon,authenticated,service_role;
create trigger blog_revision_immutable before update or delete on public.platform_blog_revisions for each row execute function private.blog_immutable_revision();

create function private.blog_check_token(p_hash text,p_site text,p_environment text,p_scope text)
returns private.platform_blog_tokens language plpgsql security definer set search_path='' as $$
declare t private.platform_blog_tokens;
begin
 select * into t from private.platform_blog_tokens where token_hash=p_hash and revoked_at is null and expires_at>clock_timestamp() for share;
 if t.id is null then raise exception 'INVALID_CREDENTIAL' using errcode='PT401'; end if;
 if t.site_id<>p_site or t.environment<>p_environment or p_scope is null or not p_scope=any(t.scopes) then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 return t;
end;
$$;
revoke all on function private.blog_check_token(text,text,text,text) from public,anon,authenticated,service_role;

create function public.blog_authorize_token(p_token_hash text,p_site_id text,p_environment text,p_scope text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.platform_blog_tokens; n integer; w timestamptz:=date_trunc('minute',clock_timestamp()); limit_count integer;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 t:=private.blog_check_token(p_token_hash,p_site_id,p_environment,p_scope);
 limit_count:=case when p_scope='media:write' then 10 when p_scope in ('posts:write','posts:publish') then 30 else 120 end;
 insert into private.platform_blog_rate_limits(token_id,scope,window_start,requests) values(t.id,p_scope,w,1)
 on conflict(token_id,scope) do update set window_start=w,requests=case when platform_blog_rate_limits.window_start=w then least(platform_blog_rate_limits.requests+1,limit_count+1) else 1 end returning requests into n;
 if n>limit_count then return jsonb_build_object('allowed',false,'code','RATE_LIMITED','retryAfter',greatest(1,ceil(extract(epoch from w+interval '1 minute'-clock_timestamp()))::integer)); end if;
 return jsonb_build_object('allowed',true,'id',t.id,'scopes',t.scopes,'publicOrigin',(select public_origin from public.platform_blog_sites where site_id=p_site_id and environment=p_environment));
end;
$$;
revoke all on function public.blog_authorize_token(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.blog_authorize_token(text,text,text,text) to service_role;

create function public.blog_authorize_media_upload(p_site_id text,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; w timestamptz:=date_trunc('minute',clock_timestamp()); actor uuid:=private.current_user_id();
begin
 if not private.blog_staff() or private.current_aal()<>'aal2' then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 if not exists(select 1 from public.platform_blog_sites where site_id=p_site_id and environment=p_environment) then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
 insert into private.platform_blog_human_media_limits(user_id,site_id,environment,window_start,requests) values(actor,p_site_id,p_environment,w,1)
 on conflict(user_id,site_id,environment) do update set window_start=w,requests=case when platform_blog_human_media_limits.window_start=w then least(platform_blog_human_media_limits.requests+1,31) else 1 end returning requests into n;
 if n>30 then return jsonb_build_object('allowed',false,'code','RATE_LIMITED','retryAfter',greatest(1,ceil(extract(epoch from w+interval '1 minute'-clock_timestamp()))::integer)); end if;
 return jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.blog_authorize_media_upload(text,text) from public,anon,authenticated,service_role;
grant execute on function public.blog_authorize_media_upload(text,text) to authenticated;

create function public.blog_configure_site(p_site_id text,p_environment text,p_public_origin text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.blog_staff() or private.current_aal()<>'aal2' then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 insert into public.platform_blog_sites(site_id,environment,public_origin) values(p_site_id,p_environment,p_public_origin)
 on conflict(site_id,environment) do update set public_origin=excluded.public_origin;
 perform private.audit_event(null,'platform.blog.site.configured','platform_blog_site',null,'success',jsonb_build_object('siteId',p_site_id,'environment',p_environment));
 return jsonb_build_object('siteId',p_site_id,'environment',p_environment,'publicOrigin',p_public_origin);
end;
$$;
revoke all on function public.blog_configure_site(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.blog_configure_site(text,text,text) to authenticated;

create function public.blog_manage_token(p_site_id text,p_environment text,p_action text,p_token_id uuid default null,p_token_hash text default null,p_label text default null,p_scopes text[] default null,p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token_id uuid; result jsonb;
begin
 if not private.blog_staff() or (p_action<>'list' and private.current_aal()<>'aal2') then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 if p_action='list' then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'scopes',scopes,'expiresAt',expires_at,'revokedAt',revoked_at,'createdAt',created_at) order by created_at desc),'[]'::jsonb) into result from private.platform_blog_tokens where site_id=p_site_id and environment=p_environment;
   return result;
 end if;
 if p_action not in ('create','rotate','revoke') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 if p_action in ('rotate','revoke') then
   update private.platform_blog_tokens set revoked_at=clock_timestamp() where id=p_token_id and site_id=p_site_id and environment=p_environment and revoked_at is null returning id into token_id;
   if token_id is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
 end if;
 if p_action in ('create','rotate') then
   if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '366 days' or coalesce(p_token_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   insert into private.platform_blog_tokens(site_id,environment,token_hash,label,scopes,expires_at,created_by) values(p_site_id,p_environment,p_token_hash,p_label,p_scopes,p_expires_at,private.current_user_id()) returning id into token_id;
 end if;
 perform private.audit_event(null,'platform.blog.token.'||p_action,'platform_blog_token',token_id,'success',jsonb_build_object('siteId',p_site_id,'environment',p_environment));
 return jsonb_build_object('id',token_id,'action',p_action);
end;
$$;
revoke all on function public.blog_manage_token(text,text,text,uuid,text,text,text[],timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.blog_manage_token(text,text,text,uuid,text,text,text[],timestamptz) to authenticated;

create function private.blog_trim(p_text text)
returns text language sql immutable set search_path='' as $$
 select btrim(coalesce(p_text,''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.blog_trim(text) from public,anon,authenticated,service_role;

-- Zod/JavaScript measure strings in UTF-16 code units, including astral characters.
create function private.blog_text_length(p_text text)
returns integer language sql immutable set search_path='' as $$
 select coalesce(sum(case when c='' then 0 when ascii(c)>65535 then 2 else 1 end),0)::integer from regexp_split_to_table(coalesce(p_text,''),'') c;
$$;
revoke all on function private.blog_text_length(text) from public,anon,authenticated,service_role;

create function private.blog_safe_link(p_href text)
returns boolean language plpgsql immutable set search_path='' as $$
declare host text; port text;
begin
 if p_href is null or p_href='' or p_href~'[[:cntrl:][:space:]\\]' then return false; end if;
 if p_href='/' or p_href~'^/[^/][^[:space:]]*$' or p_href~'^#[A-Za-z0-9_-]+$' or (p_href~*'^(mailto|tel):[^[:space:]]+$' and p_href!~*'^(mailto|tel)://') then return true; end if;
 if p_href!~*'^https?://(\[[0-9a-f:]+\]|[a-z0-9.-]+)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then return false; end if;
 host:=substring(lower(p_href) from '^https?://(\[[^]]+\]|[^/:?#]+)');
 if host~'^\[' then perform substring(host from '^\[([^]]+)\]$')::inet;
 elsif host~'^[0-9.]+$' then perform host::inet;
 -- WHATWG treats a numeric final DNS label as IPv4 and rejects invalid punycode.
 -- Reject these exotic hostname forms conservatively before publication.
 elsif host~'(^|\.)([0-9]+|0x[0-9a-f]*)\.?$' or host~'(^|\.)xn--' then return false;
 end if;
 port:=substring(lower(p_href) from '^https?://(?:\[[^]]+\]|[^/:?#]+):([0-9]+)');
 return port is null or port::integer<=65535;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function private.blog_safe_link(text) from public,anon,authenticated,service_role;

-- The independent database boundary mirrors the shared TipTap schema. Every accepted
-- publication must also pass validateArticleDraft(payload,true) when read publicly.
create function private.blog_validate_payload(p_payload jsonb,p_site text,p_environment text,p_publishing boolean default false)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare
 n record; mark jsonb; node_type text; attrs jsonb; allowed text[]; key text; value jsonb;
 asset uuid; refs uuid[]:='{}'; doc jsonb; hero jsonb; children integer; first_child text;
 marks_seen text[]; has_content boolean:=false;
 blocks text[]:=array['paragraph','heading','bulletList','orderedList','taskList','blockquote','codeBlock','horizontalRule','image','table','youtube'];
 uuid_pattern text:='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1048576
   or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(array['type','locale','title','slug','excerpt','content','seoTitle','seoDescription','authorId','categoryId','tags','hero','ogImageAssetId']))
   or coalesce(p_payload->>'type','') not in ('blog','article') or p_payload->>'locale' is distinct from 'nl-NL'
   or jsonb_typeof(p_payload->'title') is distinct from 'string' or private.blog_text_length(p_payload->>'title')>200
   or jsonb_typeof(p_payload->'slug') is distinct from 'string' or coalesce(p_payload->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_payload->>'slug')>160
   or jsonb_typeof(p_payload->'excerpt') is distinct from 'string' or private.blog_text_length(p_payload->>'excerpt')>600
   or jsonb_typeof(p_payload->'seoTitle') is distinct from 'string' or private.blog_text_length(p_payload->>'seoTitle')>200
   or jsonb_typeof(p_payload->'seoDescription') is distinct from 'string' or private.blog_text_length(p_payload->>'seoDescription')>600
   or p_payload->>'authorId' is distinct from 'redactie'
   or coalesce(p_payload->>'categoryId','') not in ('clubtv','sponsoring','schermen','narrowcasting')
   or jsonb_typeof(p_payload->'tags') is distinct from 'array' or jsonb_array_length(p_payload->'tags')>20
 then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'tags') t where jsonb_typeof(t)<>'string' or private.blog_text_length(t#>>'{}')>60 or private.blog_trim(t#>>'{}')='') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 hero:=p_payload->'hero';
 if jsonb_typeof(hero) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(hero) k where k<>all(array['assetId','alt','focalPoint']))
   or jsonb_typeof(hero->'assetId') is distinct from 'string'
   or (hero->>'assetId'<>'' and hero->>'assetId'!~uuid_pattern)
   or jsonb_typeof(hero->'alt') is distinct from 'string' or private.blog_text_length(hero->>'alt')>300
   or jsonb_typeof(hero->'focalPoint') is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(hero->'focalPoint') k where k<>all(array['x','y']))
   or jsonb_typeof(hero#>'{focalPoint,x}') is distinct from 'number' or jsonb_typeof(hero#>'{focalPoint,y}') is distinct from 'number'
   or (hero#>>'{focalPoint,x}')::numeric not between 0 and 1 or (hero#>>'{focalPoint,y}')::numeric not between 0 and 1
 then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 if hero->>'assetId'<>'' then refs:=array_append(refs,(hero->>'assetId')::uuid); end if;
 if p_payload ? 'ogImageAssetId' and p_payload->'ogImageAssetId'<>'null'::jsonb then
   if jsonb_typeof(p_payload->'ogImageAssetId') is distinct from 'string' or p_payload->>'ogImageAssetId'!~uuid_pattern then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   refs:=array_append(refs,(p_payload->>'ogImageAssetId')::uuid);
 end if;
 doc:=p_payload->'content';
 if doc->>'type' is distinct from 'doc' or jsonb_typeof(doc->'content') is distinct from 'array' or octet_length(doc::text)>250000 then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 for n in with recursive nodes(node,depth,parent,position) as (
   select doc,0,null::text,1::bigint union all
   select child,nodes.depth+1,nodes.node->>'type',ordinality from nodes cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.node->'content')='array' then nodes.node->'content' else '[]'::jsonb end) with ordinality c(child,ordinality) where nodes.depth<25
 ) select node,depth,parent,position,row_number() over() as ordinal from nodes
 loop
   if n.depth>24 or n.ordinal>5000 or jsonb_typeof(n.node)<>'object'
      or exists(select 1 from jsonb_object_keys(n.node) k where k<>all(array['type','text','content','marks','attrs'])) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   node_type:=n.node->>'type';
   allowed:=case node_type
     when 'doc' then array[]::text[] when 'text' then array[]::text[] when 'paragraph' then array['textAlign'] when 'heading' then array['level','textAlign']
     when 'bulletList' then array[]::text[] when 'orderedList' then array['start','type'] when 'listItem' then array[]::text[] when 'taskList' then array[]::text[] when 'taskItem' then array['checked']
     when 'blockquote' then array[]::text[] when 'codeBlock' then array['language'] when 'horizontalRule' then array[]::text[] when 'hardBreak' then array[]::text[]
     when 'image' then array['assetId','src','alt','title','width','height'] when 'table' then array[]::text[] when 'tableRow' then array[]::text[]
     when 'tableHeader' then array['colspan','rowspan','colwidth','align'] when 'tableCell' then array['colspan','rowspan','colwidth','align'] when 'youtube' then array['src','start','width','height'] else null end;
   attrs:=coalesce(nullif(n.node->'attrs','null'::jsonb),'{}'::jsonb);
   if allowed is null or jsonb_typeof(attrs)<>'object' or exists(select 1 from jsonb_object_keys(attrs) k where k<>all(allowed))
     or (n.node ? 'content' and jsonb_typeof(n.node->'content')<>'array') or (n.node ? 'marks' and jsonb_typeof(n.node->'marks')<>'array')
     or (node_type='text' and (jsonb_typeof(n.node->'text') is distinct from 'string' or n.node->>'text'='' or private.blog_text_length(n.node->>'text')>40000))
     or (node_type<>'text' and n.node ? 'text')
   then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   children:=coalesce(jsonb_array_length(n.node->'content'),0); first_child:=n.node#>>'{content,0,type}';
   if (n.depth=0 and node_type<>'doc') or (n.depth>0 and node_type='doc')
     or (n.parent in ('doc','blockquote','listItem','taskItem','tableCell','tableHeader') and not node_type=any(blocks))
     or (n.parent in ('paragraph','heading') and node_type not in ('text','hardBreak'))
     or (n.parent='codeBlock' and (node_type<>'text' or coalesce(jsonb_array_length(n.node->'marks'),0)>0))
     or (n.parent in ('bulletList','orderedList') and node_type<>'listItem') or (n.parent='taskList' and node_type<>'taskItem')
     or (n.parent='table' and node_type<>'tableRow') or (n.parent='tableRow' and node_type not in ('tableCell','tableHeader'))
     or (node_type in ('doc','blockquote','bulletList','orderedList','taskList','listItem','taskItem','table','tableRow','tableCell','tableHeader') and children=0)
     or (node_type in ('listItem','taskItem') and first_child<>'paragraph')
     or (node_type in ('text','horizontalRule','hardBreak','image','youtube') and children>0)
     or (n.parent in ('text','horizontalRule','hardBreak','image','youtube'))
   then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if attrs->>'textAlign' is not null and attrs->>'textAlign' not in ('left','center','right') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if attrs->>'align' is not null and attrs->>'align' not in ('left','center','right') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if node_type='heading' and coalesce(attrs->>'level','') not in ('2','3','4') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if attrs->>'language' is not null and attrs->>'language'!~*'^[a-z0-9_+-]{1,40}$' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if attrs ? 'checked' and attrs->'checked'<>'null'::jsonb and jsonb_typeof(attrs->'checked')<>'boolean' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   if attrs->>'type' is not null and attrs->>'type' not in ('1','a','A','i','I') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   foreach key in array array['width','height','colspan','rowspan','start'] loop
     value:=attrs->key;
     if value is not null and value<>'null'::jsonb and (jsonb_typeof(value)<>'number' or (value#>>'{}')::numeric<>trunc((value#>>'{}')::numeric) or (value#>>'{}')::numeric<case when key='start' then 0 else 1 end or (value#>>'{}')::numeric>case when key in ('colspan','rowspan') then 50 else 10000 end) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   end loop;
   if attrs ? 'colwidth' and attrs->'colwidth'<>'null'::jsonb then
     if jsonb_typeof(attrs->'colwidth')<>'array' or jsonb_array_length(attrs->'colwidth')>50 or exists(select 1 from jsonb_array_elements(attrs->'colwidth') v where jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) or (v#>>'{}')::numeric not between 0 and 10000) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   end if;
   if node_type='youtube' then
     if coalesce(attrs->>'src','')!~'^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
     has_content:=true;
   elsif node_type='image' then
     if coalesce(attrs->>'assetId','')!~uuid_pattern or attrs->>'src' is distinct from ('/api/blog/media/'||(attrs->>'assetId')) or jsonb_typeof(attrs->'alt') is distinct from 'string' or private.blog_trim(attrs->>'alt')='' or private.blog_text_length(attrs->>'alt')>300 or (attrs->'title' is not null and attrs->'title'<>'null'::jsonb and (jsonb_typeof(attrs->'title')<>'string' or private.blog_text_length(attrs->>'title')>300)) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
     refs:=array_append(refs,(attrs->>'assetId')::uuid); has_content:=true;
   elsif node_type='text' and private.blog_trim(n.node->>'text')<>'' then has_content:=true;
   end if;
   marks_seen:='{}';
   if coalesce(jsonb_array_length(n.node->'marks'),0)>8 or (node_type not in ('text','hardBreak') and coalesce(jsonb_array_length(n.node->'marks'),0)>0) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   for mark in select v from jsonb_array_elements(coalesce(n.node->'marks','[]'::jsonb)) v loop
     if jsonb_typeof(mark)<>'object' or exists(select 1 from jsonb_object_keys(mark) k where k<>all(array['type','attrs'])) or coalesce(mark->>'type','') not in ('bold','italic','strike','underline','code','link') or mark->>'type'=any(marks_seen) or 'code'=any(marks_seen) or (mark->>'type'='code' and cardinality(marks_seen)>0) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
     marks_seen:=array_append(marks_seen,mark->>'type');
     if mark->>'type'='link' then
       if jsonb_typeof(mark->'attrs') is distinct from 'object' or jsonb_typeof(mark#>'{attrs,href}') is distinct from 'string' or not private.blog_safe_link(mark#>>'{attrs,href}')
         or exists(select 1 from jsonb_object_keys(mark->'attrs') k where k<>all(array['href','target','rel','class','title']))
         or coalesce(mark#>'{attrs,target}','null'::jsonb)<>'null'::jsonb or coalesce(mark#>'{attrs,rel}','null'::jsonb)<>'null'::jsonb or coalesce(mark#>'{attrs,class}','null'::jsonb)<>'null'::jsonb
         or (mark#>'{attrs,title}' is not null and mark#>'{attrs,title}'<>'null'::jsonb and (jsonb_typeof(mark#>'{attrs,title}')<>'string' or private.blog_text_length(mark#>>'{attrs,title}')>300))
       then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
     elsif mark->'attrs' is not null and mark->'attrs'<>'null'::jsonb and (jsonb_typeof(mark->'attrs')<>'object' or mark->'attrs'<>'{}'::jsonb) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
   end loop;
 end loop;
 if p_publishing and (private.blog_text_length(private.blog_trim(p_payload->>'title'))<3 or private.blog_trim(p_payload->>'excerpt')='' or private.blog_trim(p_payload->>'seoTitle')='' or private.blog_trim(p_payload->>'seoDescription')='' or hero->>'assetId'='' or private.blog_trim(hero->>'alt')='' or not has_content) then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 select coalesce(array_agg(distinct r),'{}'::uuid[]) into refs from unnest(refs) r;
 if exists(select 1 from unnest(refs) r where not exists(select 1 from public.platform_blog_assets a where a.id=r and a.site_id=p_site and a.environment=p_environment and a.status='ready')) then raise exception 'INVALID_ASSET' using errcode='PT400'; end if;
 return refs;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then raise exception 'INVALID_REQUEST' using errcode='PT400';
end;
$$;
revoke all on function private.blog_validate_payload(jsonb,text,text,boolean) from public,anon,authenticated,service_role;

create function private.blog_post_response(p public.platform_blog_posts,p_origin text,p_with_payload boolean default false)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'externalId',p.external_id,'revision',p.draft_revision,'draftRevision',p.draft_revision,'publishedRevision',p.published_revision,'publishedSlug',p.canonical_slug,'status',case when p.published_revision is null then 'draft' else 'published' end,'publicUrl',case when p.canonical_slug is null then null else p_origin||'/blog/'||p.canonical_slug end,'publishedAt',p.published_at,'updatedAt',p.updated_at)
 || case when p_with_payload then jsonb_build_object('payload',(select r.payload from public.platform_blog_revisions r where r.post_id=p.id and r.revision=p.draft_revision)) else '{}'::jsonb end;
$$;
revoke all on function private.blog_post_response(public.platform_blog_posts,text,boolean) from public,anon,authenticated,service_role;

create function private.blog_finish_media(p_site text,p_environment text,p_key text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.platform_blog_receipts; a public.platform_blog_assets; result_json jsonb;
begin
 select * into r from private.platform_blog_receipts where site_id=p_site and environment=p_environment and operation='media' and idempotency_key=p_key for update;
 if r.idempotency_key is null or r.intent is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
 if r.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
 if r.response is not null then return r.response; end if;
 select * into a from public.platform_blog_assets where id=(r.intent#>>'{body,assetId}')::uuid and site_id=p_site and environment=p_environment and status='pending' for update;
 if a.id is null or not exists(select 1 from storage.objects o where o.bucket_id='platform_blog_media' and o.name=a.storage_path and coalesce((o.metadata->>'size')::bigint,-1)=a.bytes and o.metadata->>'mimetype'=a.type) then raise exception 'MEDIA_NOT_READY' using errcode='PT409'; end if;
 update public.platform_blog_assets set status='ready' where id=a.id;
 result_json:=jsonb_build_object('httpStatus',201,'body',jsonb_build_object('assetId',a.id,'width',a.width,'height',a.height,'type',a.type,'status','ready','storagePath',a.storage_path));
 update private.platform_blog_receipts set response=result_json where site_id=p_site and environment=p_environment and operation='media' and idempotency_key=p_key;
 insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata) values(r.actor_user_id,'platform.blog.media.complete','platform_blog_asset',a.id,jsonb_build_object('siteId',p_site,'environment',p_environment,'serverAttested',true));
 return result_json;
end;
$$;
revoke all on function private.blog_finish_media(text,text,text,text) from public,anon,authenticated,service_role;

-- Only the trusted server can attest decoded/re-encoded/read-back bytes. An editor
-- may reserve and upload a pending object, but cannot mark it ready through the Data API.
create function public.blog_complete_human_media(p_site_id text,p_environment text,p_payload jsonb,p_idempotency_key text,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.platform_blog_receipts; fp text;
begin
 if current_setting('role',true)<>'service_role' or p_actor_user_id is null or not exists(select 1 from public.platform_memberships where user_id=p_actor_user_id and role in ('platform_owner','platform_admin')) then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 select * into r from private.platform_blog_receipts where site_id=p_site_id and environment=p_environment and operation='media' and idempotency_key=p_idempotency_key for update;
 if r.idempotency_key is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
 if r.actor_user_id is distinct from p_actor_user_id then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 fp:=encode(extensions.digest(jsonb_build_object('method','POST','target','media','payload',p_payload,'expectedRevision',null)::text,'sha256'),'hex');
 return private.blog_finish_media(p_site_id,p_environment,p_idempotency_key,fp);
end;
$$;
revoke all on function public.blog_complete_human_media(text,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.blog_complete_human_media(text,text,jsonb,text,uuid) to service_role;

create function public.blog_command(p_site_id text,p_environment text,p_operation text,p_external_id text,p_payload jsonb,p_expected_revision bigint,p_idempotency_key text,p_token_hash text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller_service boolean:=current_setting('role',true)='service_role'; human boolean:=false;
 scope text; origin text; p public.platform_blog_posts; r private.platform_blog_receipts;
 op text; method text; fp text; result_json jsonb; refs uuid[]; asset_id uuid; asset_path text; a public.platform_blog_assets;
 payload jsonb:=coalesce(p_payload,'{}'::jsonb); status_code integer:=200;
begin
 scope:=case p_operation when 'capabilities' then 'capabilities:read' when 'list' then 'posts:read' when 'status' then 'posts:read' when 'upsert' then 'posts:write' when 'publish' then 'posts:publish' when 'media.intent' then 'media:write' when 'media.complete' then 'media:write' when 'media.status' then 'media:write' else null end;
 if scope is null then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 if caller_service then perform private.blog_check_token(p_token_hash,p_site_id,p_environment,scope);
 else
   human:=private.blog_staff();
   if not human or p_operation='media.complete' or (p_operation not in ('capabilities','list','status','media.status') and private.current_aal()<>'aal2') then raise exception 'PERMISSION_DENIED' using errcode='PT403'; end if;
 end if;
 select public_origin into origin from public.platform_blog_sites where site_id=p_site_id and environment=p_environment;
 if origin is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
 if p_operation='capabilities' then return jsonb_build_object('httpStatus',200,'body',jsonb_build_object('siteId',p_site_id,'environment',p_environment,'contractVersion','1','blogPath','/blog','publicOrigin',origin,'canonicalOrigin',origin)); end if;
 if p_operation='list' then
   select coalesce(jsonb_agg(private.blog_post_response(x,origin,human) order by x.updated_at desc),'[]'::jsonb) into result_json from (select * from public.platform_blog_posts where site_id=p_site_id and environment=p_environment order by updated_at desc limit 500) x;
   return jsonb_build_object('httpStatus',200,'body',result_json);
 end if;
 if p_operation not like 'media.%' and coalesce(p_external_id,'')!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 if p_operation='status' then
   select * into p from public.platform_blog_posts where site_id=p_site_id and environment=p_environment and external_id=p_external_id;
   if p.id is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
   return jsonb_build_object('httpStatus',200,'body',private.blog_post_response(p,origin,human));
 end if;
 if coalesce(length(p_idempotency_key),0) not between 8 and 200 or p_idempotency_key~'[[:cntrl:]]' then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
 op:=case when p_operation like 'media.%' then 'media' else p_operation end;
 method:=case op when 'upsert' then 'PUT' else 'POST' end;
 fp:=encode(extensions.digest(jsonb_build_object('method',method,'target',case when op='media' then 'media' else p_external_id end,'payload',payload,'expectedRevision',p_expected_revision)::text,'sha256'),'hex');
 if p_operation='media.status' then
   select * into r from private.platform_blog_receipts where site_id=p_site_id and environment=p_environment and operation=op and idempotency_key=p_idempotency_key;
   if r.idempotency_key is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
   if r.fingerprint<>fp then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
   return coalesce(r.response,r.intent);
 end if;
 -- The unique receipt and row lock serialize retries before any revision precondition.
 insert into private.platform_blog_receipts(site_id,environment,operation,idempotency_key,fingerprint,actor_user_id) values(p_site_id,p_environment,op,p_idempotency_key,fp,case when human then private.current_user_id() else null end) on conflict do nothing;
 select * into r from private.platform_blog_receipts where site_id=p_site_id and environment=p_environment and operation=op and idempotency_key=p_idempotency_key for update;
 if r.fingerprint<>fp then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
 if r.response is not null then return r.response; end if;
 if op='media' then
   if r.intent is null then
     if coalesce(payload->>'sha256','')!~'^[a-f0-9]{64}$' or coalesce(payload->>'outputSha256','')!~'^[a-f0-9]{64}$' or coalesce(payload->>'type','') not in ('image/jpeg','image/png','image/webp') then raise exception 'INVALID_REQUEST' using errcode='PT400'; end if;
     asset_id:=gen_random_uuid();
     asset_path:='platform/'||p_site_id||'/'||p_environment||'/assets/'||asset_id::text||'/original.'||case payload->>'type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
     insert into public.platform_blog_assets(id,site_id,environment,storage_path,source_sha256,output_sha256,type,width,height,bytes)
      values(asset_id,p_site_id,p_environment,asset_path,payload->>'sha256',payload->>'outputSha256',payload->>'type',(payload->>'width')::integer,(payload->>'height')::integer,(payload->>'bytes')::bigint) returning * into a;
     r.intent:=jsonb_build_object('httpStatus',202,'body',jsonb_build_object('assetId',a.id,'storagePath',a.storage_path,'status','pending'));
     update private.platform_blog_receipts set intent=r.intent where site_id=p_site_id and environment=p_environment and operation=op and idempotency_key=p_idempotency_key;
   else select * into a from public.platform_blog_assets where id=(r.intent#>>'{body,assetId}')::uuid;
   end if;
   if p_operation in ('media.intent','media.status') then return r.intent; end if;
   return private.blog_finish_media(p_site_id,p_environment,p_idempotency_key,fp);
 else
   -- Same external identity is serialized even when two different idempotency keys race.
   perform pg_advisory_xact_lock(hashtextextended(p_site_id||'/'||p_environment||'/'||p_external_id,313));
   select * into p from public.platform_blog_posts where site_id=p_site_id and environment=p_environment and external_id=p_external_id for update;
   if p_operation='upsert' then
     refs:=private.blog_validate_payload(payload,p_site_id,p_environment,false);
     if p.id is null then
       if p_expected_revision is not null and p_expected_revision<>0 then raise exception 'REVISION_CONFLICT' using errcode='PT412'; end if;
       insert into public.platform_blog_posts(site_id,environment,external_id) values(p_site_id,p_environment,p_external_id) returning * into p;
       status_code:=201;
     elsif p_expected_revision is null or p_expected_revision<>p.draft_revision then raise exception 'REVISION_CONFLICT' using errcode='PT412'; end if;
     -- Routes are reserved on save, including historical slugs. No locale partition exists.
     insert into public.platform_blog_routes(site_id,environment,slug,post_id) values(p_site_id,p_environment,payload->>'slug',p.id) on conflict do nothing;
     if not exists(select 1 from public.platform_blog_routes where site_id=p_site_id and environment=p_environment and slug=payload->>'slug' and post_id=p.id) then raise exception 'SLUG_CONFLICT' using errcode='PT409'; end if;
     insert into public.platform_blog_revisions(post_id,site_id,environment,revision,payload,created_by) values(p.id,p_site_id,p_environment,p.draft_revision+1,payload,private.current_user_id());
     insert into public.platform_blog_revision_assets(post_id,revision,site_id,environment,asset_id) select p.id,p.draft_revision+1,p_site_id,p_environment,x from unnest(refs) x;
     update public.platform_blog_posts set draft_revision=draft_revision+1,updated_at=clock_timestamp() where id=p.id returning * into p;
   else
     if p.id is null then raise exception 'NOT_FOUND' using errcode='PT404'; end if;
     if p_expected_revision is null or p_expected_revision<>p.draft_revision or jsonb_typeof(payload->'revision') is distinct from 'number' or (payload->>'revision')::bigint<>p.draft_revision then raise exception 'REVISION_CONFLICT' using errcode='PT412'; end if;
     select x.payload into payload from public.platform_blog_revisions x where x.post_id=p.id and x.revision=p.draft_revision;
     perform private.blog_validate_payload(payload,p_site_id,p_environment,true);
     update public.platform_blog_routes set was_published=true where site_id=p_site_id and environment=p_environment and slug=payload->>'slug' and post_id=p.id;
     if p.published_revision is distinct from p.draft_revision then
       update public.platform_blog_posts set published_revision=draft_revision,canonical_slug=payload->>'slug',first_published_at=coalesce(first_published_at,clock_timestamp()),published_at=clock_timestamp() where id=p.id returning * into p;
     end if;
   end if;
   result_json:=jsonb_build_object('httpStatus',status_code,'body',private.blog_post_response(p,origin,false));
   insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    values(private.current_user_id(),'platform.blog.'||p_operation,'platform_blog_post',p.id,jsonb_build_object('siteId',p_site_id,'environment',p_environment,'revision',p.draft_revision,'api',caller_service));
 end if;
 update private.platform_blog_receipts set response=result_json where site_id=p_site_id and environment=p_environment and operation=op and idempotency_key=p_idempotency_key;
 return result_json;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or check_violation then raise exception 'INVALID_REQUEST' using errcode='PT400';
end;
$$;
revoke all on function public.blog_command(text,text,text,text,jsonb,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.blog_command(text,text,text,text,jsonb,bigint,text,text) to authenticated,service_role;
