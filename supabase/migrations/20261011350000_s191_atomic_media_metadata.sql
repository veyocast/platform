-- Media editors and label/collection commands serialize within one tenant,
-- before touching any parent, label or membership row. Unrelated tenants and
-- provider/data synchronization do not share this lock.
create function private.lock_media_metadata_v1(p_tenant_id uuid)
returns void language sql strict security invoker set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('veyocast:media-metadata:'||p_tenant_id::text,0));
$$;
revoke all on function private.lock_media_metadata_v1(uuid)from public,anon,authenticated,service_role;

-- Relationship changes require the existing guarded commands. SELECT/RLS and
-- personal-favorite privacy are retained; direct child-first writes cannot
-- bypass the common transaction lock.
revoke insert,update,delete on public.media_folders,public.media_tags,public.media_collections,
  public.media_asset_tags,public.media_collection_items,public.media_asset_favorites
from authenticated,service_role;

-- The Source media modal saves one complete metadata edit. Original bytes,
-- immutable snapshots and releases are never modified by this command.
create function private.advance_media_metadata_clock_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end $$;
revoke all on function private.advance_media_metadata_clock_v1()from public,anon,authenticated,service_role;
create trigger zzz_media_metadata_clock before update on public.media_assets
for each row execute function private.advance_media_metadata_clock_v1();

create function private.touch_media_membership_clock_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op in('UPDATE','DELETE')then
    update public.media_assets set updated_at=clock_timestamp()
    where tenant_id=old.tenant_id and id=old.media_asset_id;
  end if;
  if tg_op='INSERT' or(tg_op='UPDATE' and(new.tenant_id,new.media_asset_id)is distinct from(old.tenant_id,old.media_asset_id))then
    update public.media_assets set updated_at=clock_timestamp()
    where tenant_id=new.tenant_id and id=new.media_asset_id;
  end if;
  if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function private.touch_media_membership_clock_v1()from public,anon,authenticated,service_role;
create trigger media_asset_tags_metadata_clock after insert or update or delete on public.media_asset_tags
for each row execute function private.touch_media_membership_clock_v1();
create trigger media_collection_items_metadata_clock after insert or update or delete on public.media_collection_items
for each row execute function private.touch_media_membership_clock_v1();
create trigger media_asset_favorites_metadata_clock after insert or update or delete on public.media_asset_favorites
for each row execute function private.touch_media_membership_clock_v1();

-- Existing UI commands acquire the same parent-before-membership lock order.
alter function public.mutate_media_organization_v1(uuid,text,jsonb,uuid)
rename to mutate_media_organization_before_metadata_v1;
revoke all on function public.mutate_media_organization_before_metadata_v1(uuid,text,jsonb,uuid)
from public,anon,authenticated,service_role;
create function public.mutate_media_organization_v1(p_tenant_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if private.current_user_id()is null or not(case when btrim(p_operation)='set_favorite'
    then private.is_tenant_member(p_tenant_id)else private.can_write_playlist(p_tenant_id)end)
    then raise exception 'actor cannot organize media for this tenant'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  perform private.lock_media_metadata_v1(p_tenant_id);
  if octet_length(p_payload::text)>32768 then raise exception 'media command exceeds limits'using errcode='22023';end if;
  if btrim(p_operation)in('move_asset','assign_tag','remove_tag','set_favorite')then
    perform 1 from public.media_assets where tenant_id=p_tenant_id and id=(p_payload->>'assetId')::uuid for update;
  end if;
  return public.mutate_media_organization_before_metadata_v1(p_tenant_id,p_operation,p_payload,p_idempotency_key);
end $$;
revoke all on function public.mutate_media_organization_v1(uuid,text,jsonb,uuid)from public,anon;
grant execute on function public.mutate_media_organization_v1(uuid,text,jsonb,uuid)to authenticated;

alter function public.bulk_organize_media_assets_v1(uuid,uuid[],text,uuid,uuid)
rename to bulk_organize_media_assets_before_metadata_v1;
revoke all on function public.bulk_organize_media_assets_before_metadata_v1(uuid,uuid[],text,uuid,uuid)
from public,anon,authenticated,service_role;
create function public.bulk_organize_media_assets_v1(p_tenant_id uuid,p_asset_ids uuid[],p_operation text,p_target_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if private.current_user_id()is null or not private.can_write_playlist(p_tenant_id)
    then raise exception 'actor cannot organize media for this tenant'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  perform private.lock_media_metadata_v1(p_tenant_id);
  if coalesce(cardinality(p_asset_ids),0)not between 1 and 100 then raise exception 'media batch exceeds limits'using errcode='22023';end if;
  perform 1 from public.media_assets where tenant_id=p_tenant_id and id=any(p_asset_ids)order by id for update;
  return public.bulk_organize_media_assets_before_metadata_v1(p_tenant_id,p_asset_ids,p_operation,p_target_id,p_idempotency_key);
end $$;
revoke all on function public.bulk_organize_media_assets_v1(uuid,uuid[],text,uuid,uuid)from public,anon;
grant execute on function public.bulk_organize_media_assets_v1(uuid,uuid[],text,uuid,uuid)to authenticated;


alter function public.mutate_media_collection_v1(uuid,uuid,bigint,text,jsonb,uuid)
rename to mutate_media_collection_before_metadata_v1;
revoke all on function public.mutate_media_collection_before_metadata_v1(uuid,uuid,bigint,text,jsonb,uuid)
from public,anon,authenticated,service_role;
create function public.mutate_media_collection_v1(p_tenant_id uuid,p_collection_id uuid,p_expected_revision bigint,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if private.current_user_id()is null or not private.can_write_playlist(p_tenant_id)
    then raise exception 'actor cannot mutate media collections for this tenant'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if octet_length(p_payload::text)>32768 then raise exception 'media command exceeds limits'using errcode='22023';end if;
  perform private.lock_media_metadata_v1(p_tenant_id);
  return public.mutate_media_collection_before_metadata_v1(p_tenant_id,p_collection_id,p_expected_revision,p_operation,p_payload,p_idempotency_key);
end $$;
revoke all on function public.mutate_media_collection_v1(uuid,uuid,bigint,text,jsonb,uuid)from public,anon,service_role;
grant execute on function public.mutate_media_collection_v1(uuid,uuid,bigint,text,jsonb,uuid)to authenticated;

create function private.touch_media_label_clock_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Every reachable label writer owns the tenant mutex before taking its row
  -- lock. Attached parent clocks now cover the names displayed by the modal.
  if tg_table_name='media_tags' then
    perform 1 from public.media_assets asset where asset.tenant_id=new.tenant_id
      and exists(select 1 from public.media_asset_tags item where item.tenant_id=new.tenant_id and item.media_asset_id=asset.id and item.tag_id=new.id)
      order by asset.id for update;
    update public.media_assets asset set updated_at=clock_timestamp() where asset.tenant_id=new.tenant_id
      and exists(select 1 from public.media_asset_tags item where item.tenant_id=new.tenant_id and item.media_asset_id=asset.id and item.tag_id=new.id);
  else
    perform 1 from public.media_assets asset where asset.tenant_id=new.tenant_id
      and exists(select 1 from public.media_collection_items item where item.tenant_id=new.tenant_id and item.media_asset_id=asset.id and item.collection_id=new.id)
      order by asset.id for update;
    update public.media_assets asset set updated_at=clock_timestamp() where asset.tenant_id=new.tenant_id
      and exists(select 1 from public.media_collection_items item where item.tenant_id=new.tenant_id and item.media_asset_id=asset.id and item.collection_id=new.id);
  end if;
  return new;
end $$;
revoke all on function private.touch_media_label_clock_v1()from public,anon,authenticated,service_role;
create trigger media_tags_metadata_clock after update on public.media_tags
for each row when(old.* is distinct from new.*)execute function private.touch_media_label_clock_v1();
create trigger media_collections_metadata_clock after update on public.media_collections
for each row when(old.* is distinct from new.*)execute function private.touch_media_label_clock_v1();

create function public.save_media_metadata_v1(p_tenant_id uuid,p_asset_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();asset public.media_assets%rowtype;folder uuid;
  request jsonb;replay jsonb;result jsonb;tag_ids uuid[]:='{}';collection_ids uuid[]:='{}';label text;label_id uuid;
begin
  if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.write')
    then raise exception 'media write permission required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  perform private.lock_media_metadata_v1(p_tenant_id);
  if p_asset_id is null or p_expected_updated_at is null or p_idempotency_key is null
    or jsonb_typeof(p_payload)is distinct from 'object' or octet_length(p_payload::text)>32768
    or(select count(*)from jsonb_object_keys(p_payload))<>5
    or not p_payload?&array['title','folderId','tags','collections','favorite']
    or jsonb_typeof(p_payload->'title')is distinct from 'string'
    or length(btrim(p_payload->>'title'))not between 2 and 120
    or jsonb_typeof(p_payload->'favorite')is distinct from 'boolean'
    or jsonb_typeof(p_payload->'folderId')not in('string','null')
    or jsonb_typeof(p_payload->'tags')is distinct from 'array'
    or jsonb_typeof(p_payload->'collections')is distinct from 'array'
    then raise exception 'media metadata invalid'using errcode='23514';end if;
  if jsonb_array_length(p_payload->'tags')>20 or jsonb_array_length(p_payload->'collections')>20
    or exists(select 1 from jsonb_array_elements(p_payload->'tags')value where jsonb_typeof(value)is distinct from 'string'or length(btrim(value#>>'{}'))not between 1 and 48)
    or exists(select 1 from jsonb_array_elements(p_payload->'collections')value where jsonb_typeof(value)is distinct from 'string'or length(btrim(value#>>'{}'))not between 2 and 80)
    then raise exception 'media labels exceed limits'using errcode='23514';end if;
  folder:=nullif(p_payload->>'folderId','')::uuid;
  select * into asset from public.media_assets where tenant_id=p_tenant_id and id=p_asset_id for update;
  if not found then raise exception 'media not found'using errcode='P0002';end if;
  request:=jsonb_build_object('assetId',p_asset_id,'expectedUpdatedAt',p_expected_updated_at,'payload',p_payload);
  replay:=private.begin_publisher_command(p_tenant_id,'media.metadata.v1',p_idempotency_key,request);
  if replay is not null then return replay;end if;
  if asset.updated_at<>p_expected_updated_at then
    return private.complete_publisher_command(p_tenant_id,'media.metadata.v1',p_idempotency_key,request,'media_assets',p_asset_id,
      jsonb_build_object('outcome','conflict','assetId',p_asset_id,'actualUpdatedAt',asset.updated_at),'publisher.media.metadata.conflict','failed');
  end if;
  if asset.deleted_at is not null then raise exception 'archived media cannot be edited'using errcode='23514';end if;
  if folder is not null then
    perform 1 from public.media_folders where tenant_id=p_tenant_id and id=folder for key share;
    if not found then raise exception 'tenant media folder not found'using errcode='23514';end if;
  end if;
  -- Deterministic label order also prevents opposite label-creation lock orders.
  for label in select min(btrim(value))from jsonb_array_elements_text(p_payload->'tags')value group by lower(btrim(value))order by lower(btrim(value))loop
    insert into public.media_tags(tenant_id,name,created_by)values(p_tenant_id,label,actor)
    on conflict(tenant_id,lower(name))do nothing;
    select id into label_id from public.media_tags where tenant_id=p_tenant_id and lower(name)=lower(label)for key share;
    tag_ids:=array_append(tag_ids,label_id);
  end loop;
  for label in select min(btrim(value))from jsonb_array_elements_text(p_payload->'collections')value group by lower(btrim(value))order by lower(btrim(value))loop
    insert into public.media_collections(tenant_id,name,created_by,updated_by)values(p_tenant_id,label,actor,actor)
    on conflict(tenant_id,lower(name))where status='active'do nothing;
    select id into label_id from public.media_collections where tenant_id=p_tenant_id and status='active'and lower(name)=lower(label)for key share;
    collection_ids:=array_append(collection_ids,label_id);
  end loop;
  delete from public.media_asset_tags where tenant_id=p_tenant_id and media_asset_id=p_asset_id and not(tag_id=any(tag_ids));
  insert into public.media_asset_tags(tenant_id,media_asset_id,tag_id,created_by)select p_tenant_id,p_asset_id,id,actor from unnest(tag_ids)id on conflict do nothing;
  delete from public.media_collection_items where tenant_id=p_tenant_id and media_asset_id=p_asset_id and not(collection_id=any(collection_ids));
  insert into public.media_collection_items(tenant_id,collection_id,media_asset_id,added_by)select p_tenant_id,id,p_asset_id,actor from unnest(collection_ids)id on conflict do nothing;
  if(p_payload->>'favorite')::boolean then
    insert into public.media_asset_favorites(tenant_id,media_asset_id,user_id)values(p_tenant_id,p_asset_id,actor)on conflict do nothing;
  else delete from public.media_asset_favorites where tenant_id=p_tenant_id and media_asset_id=p_asset_id and user_id=actor;end if;
  update public.media_assets set title=btrim(p_payload->>'title'),folder_id=folder where tenant_id=p_tenant_id and id=p_asset_id returning * into asset;
  result:=jsonb_build_object('outcome','applied','assetId',p_asset_id,'actualUpdatedAt',asset.updated_at);
  return private.complete_publisher_command(p_tenant_id,'media.metadata.v1',p_idempotency_key,request,'media_assets',p_asset_id,result,'publisher.media.metadata.saved','success');
end $$;
revoke all on function public.save_media_metadata_v1(uuid,uuid,timestamptz,jsonb,uuid)from public,anon,service_role;
grant execute on function public.save_media_metadata_v1(uuid,uuid,timestamptz,jsonb,uuid)to authenticated;
