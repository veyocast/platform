-- S191: a Studio design series orders existing, independently immutable render documents.
create table public.studio_series(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,owner_user_id uuid references public.profiles(id) on delete set null,name text not null check(length(btrim(name))between 2 and 120),revision bigint not null default 1 check(revision>0),status text not null default 'active' check(status in('active','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id)
);
create index studio_series_tenant_updated_idx on public.studio_series(tenant_id,updated_at desc);
create table public.studio_series_items(
 tenant_id uuid not null,series_id uuid not null,project_id uuid not null,sort_order integer not null check(sort_order between 0 and 19),primary key(tenant_id,series_id,project_id),unique(tenant_id,series_id,sort_order),foreign key(tenant_id,series_id)references public.studio_series(tenant_id,id)on delete cascade,foreign key(tenant_id,project_id)references public.studio_projects(tenant_id,id)on delete restrict
);
create index studio_series_items_tenant_project_idx on public.studio_series_items(tenant_id,project_id);
alter table public.studio_series enable row level security;alter table public.studio_series_items enable row level security;
create policy studio_series_read on public.studio_series for select to authenticated using(private.can_read_studio(tenant_id));
create policy studio_series_items_read on public.studio_series_items for select to authenticated using(private.can_read_studio(tenant_id));
revoke all on public.studio_series,public.studio_series_items from public,anon,authenticated;
grant select on public.studio_series,public.studio_series_items to authenticated;grant all on public.studio_series,public.studio_series_items to service_role;

create function public.create_studio_series_v1(p_tenant_id uuid,p_name text,p_slides jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();series_id uuid:=gen_random_uuid();slide jsonb;result jsonb;replay jsonb;project_id uuid;ids uuid[]:='{}';ordinal integer:=0;request jsonb:=jsonb_build_object('name',p_name,'slides',p_slides);
begin
 if actor is null or not private.can_create_studio(p_tenant_id) then raise exception 'actor cannot create Studio series'using errcode='42501';end if;perform private.require_active_tenant_command(p_tenant_id);
 if length(btrim(p_name))not between 2 and 120 or jsonb_typeof(p_slides)is distinct from 'array' or jsonb_array_length(p_slides)not between 1 and 20 then raise exception 'Studio series outside limits'using errcode='23514';end if;
 replay:=private.begin_studio_command(p_tenant_id,'studio.series.create',p_idempotency_key,request);if replay is not null then return replay;end if;
 insert into public.studio_series(id,tenant_id,owner_user_id,name)values(series_id,p_tenant_id,actor,btrim(p_name));
 for slide in select * from jsonb_array_elements(p_slides)loop
  if slide#>>'{document,sitesPresentation,kind}'is distinct from 'studio' then raise exception 'Series entries require trusted Sites documents'using errcode='23514';end if;
  result:=public.create_studio_project_v1(p_tenant_id=>p_tenant_id,p_name=>slide->>'name',p_orientation=>slide#>>'{document,artboard,orientation}',p_document=>slide->'document',p_referenced_asset_ids=>array(select value::uuid from jsonb_array_elements_text(coalesce(slide->'referencedAssetIds','[]'::jsonb))),p_project_kind=>'design',p_idempotency_key=>(slide->>'commandKey')::uuid);
  project_id:=(result->>'projectId')::uuid;if project_id is null then raise exception 'Studio series entry was not created'using errcode='55000';end if;
  insert into public.studio_series_items(tenant_id,series_id,project_id,sort_order)values(p_tenant_id,series_id,project_id,ordinal);ids:=array_append(ids,project_id);ordinal:=ordinal+1;
 end loop;
 return private.complete_studio_command(p_tenant_id,'studio.series.create',p_idempotency_key,request,'studio_series',series_id,jsonb_build_object('outcome','created','seriesId',series_id,'revision',1,'projectIds',to_jsonb(ids)),'studio.series.created','success');
end;$$;
create function public.save_studio_series_v1(p_series_id uuid,p_expected_revision bigint,p_slides jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
<<series_write>>
declare series public.studio_series%rowtype;slide jsonb;result jsonb;replay jsonb;project_id uuid;ordinal integer:=0;ids uuid[]:='{}';request jsonb:=jsonb_build_object('seriesId',p_series_id,'expectedRevision',p_expected_revision,'slides',p_slides);next_revision bigint;
begin
 select * into series from public.studio_series where id=p_series_id for update;
 if not found or private.current_user_id()is null or not private.can_edit_studio_project(series.tenant_id,series.owner_user_id)then raise exception 'actor cannot edit Studio series'using errcode='42501';end if;perform private.require_active_tenant_command(series.tenant_id);
 if series.status<>'active' or jsonb_typeof(p_slides)is distinct from 'array' or jsonb_array_length(p_slides)not between 1 and 20 then raise exception 'Studio series outside limits'using errcode='23514';end if;
 replay:=private.begin_studio_command(series.tenant_id,'studio.series.save',p_idempotency_key,request);if replay is not null then return replay;end if;
 if series.revision<>p_expected_revision then return jsonb_build_object('outcome','conflict','revision',series.revision);end if;
 -- Lock every existing project in one deterministic order before validating any changes.
 perform project.id from public.studio_projects project join public.studio_series_items item on item.tenant_id=project.tenant_id and item.project_id=project.id where item.tenant_id=series.tenant_id and item.series_id=series.id order by project.id for update of project;
 for slide in select * from jsonb_array_elements(p_slides)loop
  project_id:=nullif(slide->>'projectId','')::uuid;
  if project_id is not null and(project_id=any(ids)or not exists(select 1 from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id and studio_series_items.project_id=series_write.project_id))then raise exception 'Studio series membership invalid'using errcode='23514';end if;
  if slide#>>'{document,sitesPresentation,kind}'is distinct from 'studio' then raise exception 'Series entries require trusted Sites documents'using errcode='23514';end if;
  if project_id is null then
   if not private.can_create_studio(series.tenant_id) then raise exception 'actor cannot add Studio slide'using errcode='42501';end if;
   result:=public.create_studio_project_v1(p_tenant_id=>series.tenant_id,p_name=>coalesce(slide->>'name',slide#>>'{document,sitesPresentation,slide,name}'),p_orientation=>slide#>>'{document,artboard,orientation}',p_document=>slide->'document',p_referenced_asset_ids=>array(select value::uuid from jsonb_array_elements_text(coalesce(slide->'referencedAssetIds','[]'::jsonb))),p_project_kind=>'design',p_idempotency_key=>(slide->>'commandKey')::uuid);
   project_id:=(result->>'projectId')::uuid;
   if project_id is null then raise exception 'Studio series entry was not created'using errcode='55000';end if;
  else
   result:=public.save_studio_draft_v1(project_id,(slide->>'expectedDraftRevision')::bigint,slide->'document',array(select value::uuid from jsonb_array_elements_text(coalesce(slide->'referencedAssetIds','[]'::jsonb))),(slide->>'commandKey')::uuid);
   if result->>'outcome' is distinct from 'saved' then raise exception 'Studio series draft revision conflict; all changes rolled back'using errcode='40001';end if;
  end if;
  ids:=array_append(ids,project_id);
 end loop;
 delete from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id;
 foreach project_id in array ids loop insert into public.studio_series_items(tenant_id,series_id,project_id,sort_order)values(series.tenant_id,series.id,project_id,ordinal);ordinal:=ordinal+1;end loop;
 update public.studio_series set revision=revision+1,updated_at=now()where id=series.id returning revision into next_revision;
 return private.complete_studio_command(series.tenant_id,'studio.series.save',p_idempotency_key,request,'studio_series',series.id,jsonb_build_object('outcome','saved','seriesId',series.id,'revision',next_revision,'projectIds',to_jsonb(ids)),'studio.series.saved','success');
end;$$;
revoke all on function public.create_studio_series_v1(uuid,text,jsonb,uuid),public.save_studio_series_v1(uuid,bigint,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.create_studio_series_v1(uuid,text,jsonb,uuid),public.save_studio_series_v1(uuid,bigint,jsonb,uuid)to authenticated;
