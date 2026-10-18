-- Source uses the existing tenant campaign and immutable Studio export. Its
-- public identity is resolved within the tenant, never accepted as a foreign
-- public campaign shortcut. Private vote data cannot become an offline card.
alter function private.assert_sync_slide_v1(uuid,jsonb)rename to assert_sync_slide_before_engage_v1;
create function private.assert_sync_slide_v1(p_tenant_id uuid,p_slide jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
declare campaign public.engage_campaigns%rowtype;public_campaign jsonb;
begin
 perform private.assert_sync_slide_before_engage_v1(p_tenant_id,p_slide);
 if p_slide->>'family'='engage'and p_slide?'poll'then
  select *into campaign from public.engage_campaigns
   where tenant_id=p_tenant_id and public_id=(p_slide#>>'{poll,id}')::uuid
    and status in('scheduled','live','closed');
  if campaign.id is null or not private.tenant_feature_enabled_v1(p_tenant_id,'engage')then
   raise exception 'Source campaign unavailable within tenant'using errcode='42501';end if;
  if jsonb_array_length(p_slide#>'{poll,options}')<>(select count(*)from public.engage_options where tenant_id=p_tenant_id and campaign_id=campaign.id)
   or exists(select 1 from jsonb_array_elements(p_slide#>'{poll,options}')choice where not exists(
    select 1 from public.engage_options option where option.tenant_id=p_tenant_id and option.campaign_id=campaign.id and option.id=(choice->>'id')::uuid))then
   raise exception 'Source campaign choices incomplete or foreign'using errcode='23514';end if;
  public_campaign:=public.get_engage_campaign_public_v1(campaign.public_id);
  if not coalesce((public_campaign->>'resultsVisible')::boolean,false)
   and exists(select 1 from jsonb_array_elements(p_slide#>'{poll,options}')choice where(choice->>'votes')::bigint<>0)then
   raise exception 'Source private campaign votes forbidden'using errcode='23514';end if;
 end if;
end;$$;
revoke all on function private.assert_sync_slide_before_engage_v1(uuid,jsonb),private.assert_sync_slide_v1(uuid,jsonb)
 from public,anon,authenticated,service_role;

create function private.assert_sync_engage_release_binding_v1()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.sync_studio_presentation_json->>'family'='engage'and new.sync_studio_presentation_json?'poll'
  and new.engage_public_id is distinct from(new.sync_studio_presentation_json#>>'{poll,id}')::uuid then
  raise exception 'Source export campaign does not match the published binding'using errcode='23514';
 end if;
 return new;
end;$$;
revoke all on function private.assert_sync_engage_release_binding_v1()from public,anon,authenticated,service_role;
create trigger zzz_sync_engage_release_binding before insert on public.playlist_release_items
 for each row execute function private.assert_sync_engage_release_binding_v1();
notify pgrst,'reload schema';
