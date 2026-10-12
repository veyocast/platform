create function public.list_publisher_playlists_v1(p_tenant_id uuid,p_offset integer default 0,p_search text default null,p_status text default 'all',p_sort text default 'updated',p_assignment text default 'all')returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')then raise exception 'actor cannot read playlists'using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 100000 or length(coalesce(p_search,''))>160 or p_status not in('all','draft','published','archived')or p_sort not in('updated','name','items')or p_assignment not in('all','assigned','unassigned')then raise exception 'playlist filters outside limits'using errcode='22023';end if;
 with matching as materialized(select playlist.*,coalesce(items.item_count,0)as item_count,coalesce(items.duration,0)as total_duration_seconds,
   coalesce(items.covers,'{}'::uuid[])as cover_asset_ids,coalesce(screens.screen_count,0)as assigned_screen_count,
   publication.config_revision as last_published_version,coalesce(profile.display_name,'Onbekende beheerder')as updated_by_name
   from public.playlists playlist
   left join lateral(select count(*)as item_count,sum(duration_seconds)as duration,(array_agg(media_asset_id order by position_key,id))[1:4]as covers
     from public.playlist_items item where item.tenant_id=p_tenant_id and item.playlist_id=playlist.id)items on true
   left join lateral(select count(distinct screen.id)as screen_count from public.screens screen where screen.tenant_id=p_tenant_id and screen.deleted_at is null and screen.status<>'disabled'
     and(screen.assigned_playlist_id=playlist.id or exists(select 1 from public.screen_composition_bindings binding where binding.tenant_id=screen.tenant_id and binding.composition_id=screen.composition_id and binding.playlist_id=playlist.id)))screens on true
   left join public.playlist_publications publication on publication.tenant_id=playlist.tenant_id and publication.playlist_id=playlist.id
   left join public.profiles profile on profile.id=playlist.updated_by
   where playlist.tenant_id=p_tenant_id and(p_status='all'or playlist.status::text=p_status)
     and(nullif(btrim(p_search),'')is null or position(lower(btrim(p_search))in lower(playlist.name))>0)),
 filtered as(select * from matching where p_assignment='all'or(p_assignment='assigned'and assigned_screen_count>0)or(p_assignment='unassigned'and assigned_screen_count=0)),
 page as(select * from filtered order by case when p_sort='name'then name end asc,case when p_sort='items'then item_count end desc,updated_at desc,id limit 20 offset p_offset)
 select jsonb_build_object('total',(select count(*)from filtered),'rows',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'status',status,
   'revision',revision,'updatedAt',updated_at,'updatedBy',updated_by_name,'itemCount',item_count,'totalDurationSeconds',total_duration_seconds,'assignedScreenCount',assigned_screen_count,
   'lastPublishedVersion',last_published_version,'coverAssetIds',cover_asset_ids)order by case when p_sort='name'then name end asc,case when p_sort='items'then item_count end desc,updated_at desc,id),'[]'::jsonb))into result from page;
 return result;
end $$;
revoke all on function public.list_publisher_playlists_v1(uuid,integer,text,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.list_publisher_playlists_v1(uuid,integer,text,text,text,text)to authenticated;

create function public.mutate_playlist_library_batch_v1(p_tenant_id uuid,p_action text,p_targets jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare request jsonb;replay jsonb;target jsonb;playlist public.playlists%rowtype;result jsonb;created_ids uuid[]:='{}';target_ids uuid[];actor uuid:=private.current_user_id();
begin
 if actor is null or p_action not in('duplicate','archive','restore')or not private.has_tenant_capability(p_tenant_id,case when p_action='duplicate'then 'tenant.playlist.write'else 'tenant.playlist.archive'end)then raise exception 'actor cannot manage selected playlists'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if jsonb_typeof(p_targets)is distinct from 'array'or jsonb_array_length(p_targets)not between 1 and 100 or octet_length(p_targets::text)>32768 then raise exception 'playlist selection outside limits'using errcode='22023';end if;
 select array_agg((value->>'id')::uuid)into target_ids from jsonb_array_elements(p_targets);
 if cardinality(target_ids)<>(select count(distinct id)from unnest(target_ids)id)then raise exception 'duplicate playlist selection'using errcode='22023';end if;
 perform 1 from public.playlists where tenant_id=p_tenant_id and id=any(target_ids)order by id for update;
 if(select count(*)from public.playlists where tenant_id=p_tenant_id and id=any(target_ids))<>cardinality(target_ids)then raise exception 'playlist selection is not in this tenant'using errcode='42501';end if;
 request:=jsonb_build_object('action',p_action,'targets',p_targets);
 replay:=private.begin_publisher_command(p_tenant_id,'playlist.library.batch.v1',p_idempotency_key,request);if replay is not null then return replay;end if;
 for target in select * from jsonb_array_elements(p_targets)loop
   select * into strict playlist from public.playlists where tenant_id=p_tenant_id and id=(target->>'id')::uuid;
   if playlist.revision is distinct from (target->>'expectedRevision')::bigint then raise exception 'selected playlist revision conflict; nothing changed'using errcode='40001';end if;
   if p_action='duplicate'then created_ids:=array_append(created_ids,public.duplicate_playlist_draft_v1(playlist.id,null));
   elsif p_action='archive'then
     if exists(select 1 from public.screen_composition_bindings binding join public.screens screen on screen.tenant_id=binding.tenant_id and screen.composition_id=binding.composition_id where binding.tenant_id=p_tenant_id and binding.playlist_id=playlist.id and screen.deleted_at is null and screen.status<>'disabled')then raise exception 'playlist is assigned to an active screen'using errcode='23514';end if;
     if exists(select 1 from public.screens screen where screen.tenant_id=p_tenant_id and screen.assigned_playlist_id=playlist.id and screen.status<>'disabled')then raise exception 'playlist is assigned to an active screen'using errcode='23514';end if;
     if playlist.status<>'archived'then update public.playlists set status='archived',archived_at=now(),revision=revision+1,updated_by=actor,updated_at=clock_timestamp()where tenant_id=p_tenant_id and id=playlist.id;end if;
   else
     if playlist.status<>'archived'then raise exception 'only archived playlists can be restored'using errcode='23514';end if;
     update public.playlists set status='draft',archived_at=null,revision=revision+1,updated_by=actor,updated_at=clock_timestamp()where tenant_id=p_tenant_id and id=playlist.id;
   end if;
 end loop;
 return private.complete_publisher_command(p_tenant_id,'playlist.library.batch.v1',p_idempotency_key,request,'tenants',p_tenant_id,jsonb_build_object('outcome','applied','createdIds',created_ids,'count',cardinality(target_ids)),'publisher.playlist.library.batch','success');
end $$;
revoke all on function public.mutate_playlist_library_batch_v1(uuid,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_playlist_library_batch_v1(uuid,text,jsonb,uuid)to authenticated;
