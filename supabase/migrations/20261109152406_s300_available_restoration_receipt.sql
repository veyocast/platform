-- S300: availability is a causal restoration command. Only an exact already
-- validated predecessor window frame may confirm its own action/target receipt.

create or replace function public.apply_matchday_action_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;publication public.matchday_publications%rowtype;run public.matchday_runs%rowtype;head public.matchday_object_states%rowtype;
 action public.matchday_actions%rowtype;target public.matchday_publication_targets%rowtype;previous public.matchday_actions%rowtype;
 kind text:=p_input->>'kind';operation_key text;expected bigint;screen_ids uuid[];until_time timestamptz;at_time timestamptz:=private.matchday_now_s300_v1();
 match_value jsonb;payload jsonb;role_value jsonb;placement jsonb;release_check jsonb;release_id uuid;global_main boolean;valid_transition boolean;
 replay jsonb;new_action_id uuid:=gen_random_uuid();schedule_id uuid;reason text;begin
 actor:=private.matchday_member_actor_s300_v1(p_tenant_id);
 if kind not in('field','phase','postponed','cancelled','sold_out','available')or kind is null then raise exception 'invalid action kind'using errcode='22023';end if;
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','publicationId','expectedRevision','requestId','screenIds','endsAt','reason','kind']||
  case kind when'field'then array['matchId','field']when'phase'then array['matchId','phase']when'postponed'then array['matchId','newKickoffAt']
   when'cancelled'then array['matchId']else array['productId','menuSnapshotId','placementId']end);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'requestId');
 expected:=private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if jsonb_typeof(p_input->'screenIds')<>'array'or jsonb_array_length(p_input->'screenIds')not between 1 and 200
  or jsonb_typeof(p_input->'reason')<>'string'or length(btrim(p_input->>'reason'))not between 2 and 300 then raise exception 'invalid action targets or reason'using errcode='22023';end if;
 select array_agg(private.matchday_uuid_s300_v1(value)order by value#>>'{}')into screen_ids from jsonb_array_elements(p_input->'screenIds');
 if(select count(distinct value)from unnest(screen_ids)value)<>cardinality(screen_ids)then raise exception 'duplicate action targets'using errcode='22023';end if;
 until_time:=private.screen_frame_timestamp_s296_v1(p_input->>'endsAt');
 if until_time is null then raise exception 'finite action expiry required'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.action',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=(p_input->>'publicationId')::uuid
  and runbook_id=(p_input->>'runbookId')::uuid;
 if publication.id is null then raise exception 'action publication outside tenant or runbook'using errcode='42501';end if;
 select *into strict run from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id for update;
 if until_time<=at_time or until_time>publication.ends_at or publication.starts_at>at_time or publication.ends_at<=at_time
  or run.status in('closed','cancelled')or not coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,'Deze uitvoering of vervaltijd is niet meer actief.');end if;
 if(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids))<>cardinality(screen_ids)then
  raise exception 'action target outside frozen publication'using errcode='42501';end if;
 if kind in('sold_out','available')then
  perform private.matchday_uuid_s300_v1(p_input->'productId');perform private.matchday_uuid_s300_v1(p_input->'menuSnapshotId');
  if jsonb_typeof(p_input->'placementId')<>'string'or length(btrim(p_input->>'placementId'))not between 1 and 200 then raise exception 'invalid placement'using errcode='22023';end if;
  operation_key:='menu:'||(p_input->>'menuSnapshotId')||':'||(p_input->>'placementId')||':'||(p_input->>'productId');
  select role into reason from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids)and role<>'canteen'limit 1;
  if found then raise exception 'menu action outside canteen targets'using errcode='42501';end if;
  select value into role_value from jsonb_array_elements(publication.configuration_json->'roles')where value->>'role'='canteen';
  select value into placement from jsonb_array_elements(role_value->'menuFallbacks')where value->>'productId'=p_input->>'productId'
   and value->>'menuSnapshotId'=p_input->>'menuSnapshotId'and value->>'placementId'=p_input->>'placementId';
  if placement is null then raise exception 'menu action has no frozen compatible placement'using errcode='42501';end if;
  payload:=p_input||jsonb_build_object('productLabel',placement->>'productLabel');
 else
  perform private.matchday_uuid_s300_v1(p_input->'matchId');
  select value into match_value from jsonb_array_elements(publication.configuration_json->'matches')where value->>'id'=p_input->>'matchId';
  if match_value is null then raise exception 'action match outside frozen publication'using errcode='42501';end if;
  operation_key:='match:'||(p_input->>'matchId')||case when kind='field'then':field'else':phase'end;
  if kind='field'and(jsonb_typeof(p_input->'field')<>'string'or length(btrim(p_input->>'field'))not between 1 and 120)then raise exception 'invalid field value'using errcode='22023';end if;
  if kind='postponed'and p_input->'newKickoffAt'<>'null'::jsonb and private.screen_frame_timestamp_s296_v1(p_input->>'newKickoffAt')is null then
   raise exception 'invalid explicit proposed kick-off'using errcode='22023';end if;
  payload:=p_input||jsonb_build_object('matchCode',match_value->>'matchCode','homeTeamName',match_value->>'homeTeamName','awayTeamName',match_value->>'awayTeamName');
 end if;
 if not private.matchday_can_operate_s300_v1(p_tenant_id,publication.id,kind,operation_key,screen_ids,until_time)then
  raise exception 'action outside explicit object, action, targets or grant expiry'using errcode='42501';end if;
 global_main:=kind in('phase','postponed','cancelled')and p_input->>'matchId'=publication.configuration_json->>'mainMatchId';
 if global_main and cardinality(screen_ids)<>(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,
   'Deze hoofdwedstrijdactie geldt voor alle draaiboekdoelen; vraag een volledig bevoegde wedstrijddienst om bevestiging');end if;
 if kind='phase'then
  valid_transition:=global_main and case run.phase
   when'before'then p_input->>'phase'in('playing','postponed','cancelled')when'playing'then p_input->>'phase'in('halftime','finished','postponed','cancelled')
   when'halftime'then p_input->>'phase'in('resumed','finished','postponed','cancelled')when'resumed'then p_input->>'phase'in('halftime','finished','postponed','cancelled')
   when'postponed'then p_input->>'phase'in('before','cancelled')else false end;
  if not coalesce(valid_transition,false)then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,'Deze faseovergang is niet geldig voor de hoofdwedstrijd.');end if;
 end if;
 insert into public.matchday_object_states(tenant_id,publication_id,object_key)values(p_tenant_id,publication.id,operation_key)on conflict do nothing;
 select state.*into head from public.matchday_object_states state where state.tenant_id=p_tenant_id and state.publication_id=publication.id and state.object_key=operation_key for update;
 if head.revision<>expected then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','conflict',publication.runbook_id,publication.id,head.current_action_id,head.revision,'Een andere operator wijzigde dit object. Controleer de huidige waarde voordat je opnieuw bevestigt.');end if;
 perform 1 from public.screens where tenant_id=p_tenant_id and id=any(screen_ids)order by id for update;
 perform 1 from public.player_devices where tenant_id=p_tenant_id and screen_id=any(screen_ids)and status='paired'order by id for share;
 if exists(select 1 from public.matchday_publication_targets target_row where target_row.tenant_id=p_tenant_id and target_row.publication_id=publication.id and target_row.screen_id=any(screen_ids)
  and not exists(select 1 from public.player_devices device join public.screens target_screen
   on target_screen.tenant_id=device.tenant_id and target_screen.id=device.screen_id and target_screen.status='active'and target_screen.deleted_at is null
   where device.tenant_id=p_tenant_id and device.id=target_row.player_id and device.screen_id=target_row.screen_id and device.status='paired'and device.capabilities->>'matchdayExpiry'='matchday-expiry-v1'
    and target_screen.orientation::text=target_row.orientation and target_screen.resolution_width=target_row.width and target_screen.resolution_height=target_row.height
    and target_screen.composition_id is not distinct from target_row.composition_id and target_screen.composition_revision=target_row.composition_revision))then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Een gekoppelde Player of zijn vervalondersteuning is gewijzigd. Publiceer eerst opnieuw na controle.');end if;
 -- Availability restores one exact, still-active sold-out predecessor. A first,
 -- repeated or expired availability command has no causal Player restoration
 -- to confirm; return a replayable blocked receipt without inventing an action.
 if kind='available'then
  select *into previous from public.matchday_actions where tenant_id=p_tenant_id and id=head.current_action_id
   and publication_id=publication.id and object_key=operation_key;
  perform 1 from public.matchday_deliveries predecessor where predecessor.tenant_id=p_tenant_id
   and predecessor.publication_id=publication.id and predecessor.action_id=previous.id order by predecessor.id for update;
  if previous.id is null or previous.kind<>'sold_out'or previous.ends_at<=at_time
   or not exists(select 1 from public.matchday_action_lifecycle where tenant_id=p_tenant_id and action_id=previous.id and status='active')
   or exists(select 1 from public.matchday_publication_targets target_row where target_row.tenant_id=p_tenant_id
    and target_row.publication_id=publication.id and target_row.screen_id=any(screen_ids)
    and not exists(select 1 from public.matchday_deliveries predecessor join public.content_schedules predecessor_schedule
     on predecessor_schedule.tenant_id=predecessor.tenant_id and predecessor_schedule.id=predecessor.schedule_id
     where predecessor.tenant_id=p_tenant_id and predecessor.publication_id=publication.id and predecessor.action_id=previous.id
      and predecessor.target_id=target_row.id and predecessor.device_id=target_row.player_id and predecessor.action_revision=previous.revision
      and predecessor_schedule.enabled and predecessor_schedule.ends_at>at_time))then
   return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,
    head.current_action_id,head.revision,'Dit product heeft op een geselecteerd scherm geen actieve tijdelijke uitverkochtmelding om te herstellen.');
  end if;
 end if;
 if kind in('field','postponed','cancelled')and exists(select 1 from public.matchday_deliveries delivery join public.matchday_actions current_action
  on current_action.tenant_id=delivery.tenant_id and current_action.id=delivery.action_id join public.matchday_action_lifecycle lifecycle
  on lifecycle.tenant_id=current_action.tenant_id and lifecycle.action_id=current_action.id
  join public.matchday_publication_targets target_row on target_row.tenant_id=delivery.tenant_id and target_row.id=delivery.target_id
  where delivery.tenant_id=p_tenant_id and delivery.publication_id=publication.id and target_row.screen_id=any(screen_ids)
   and lifecycle.status='active'and current_action.kind in('field','postponed','cancelled')and current_action.ends_at>at_time and current_action.object_key<>operation_key
  group by target_row.screen_id having count(*)>=10)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Er zijn al tien gelijktijdige meldingen op een doelscherm. Beëindig eerst een melding.');end if;
 if kind='sold_out'and exists(select 1 from public.matchday_owned_schedules owned join public.content_schedules schedule on schedule.tenant_id=owned.tenant_id and schedule.id=owned.schedule_id
  join public.matchday_actions current_action on current_action.tenant_id=owned.tenant_id and current_action.id=owned.action_id
  join public.matchday_publication_targets target_row on target_row.tenant_id=owned.tenant_id and target_row.id=owned.target_id
  where owned.tenant_id=p_tenant_id and owned.publication_id=publication.id and target_row.screen_id=any(screen_ids)
   and current_action.kind='sold_out'and current_action.object_key<>operation_key and schedule.enabled and schedule.ends_at>at_time)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Een ander product gebruikt al de tijdelijke vervangpublicatie op dit scherm. Beëindig die eerst.');end if;
 if head.current_action_id is not null then
  select *into previous from public.matchday_actions where tenant_id=p_tenant_id and id=head.current_action_id;
  -- One object head supersedes its complete previous action. A smaller new
  -- target selection must never silently stop that action on other screens,
  -- including screens outside a delegate's grant. Require explicit full scope.
  if previous.ends_at>at_time and exists(select 1 from public.matchday_action_lifecycle
   where tenant_id=p_tenant_id and action_id=previous.id and status='active')
   and exists(select 1 from jsonb_array_elements_text(previous.payload_json->'screenIds')previous_screen
    where previous_screen::uuid<>all(screen_ids))then
   return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,
    previous.id,head.revision,'De eerdere actie omvat andere schermen. Laat een bevoegde operator de volledige schermselectie beoordelen.');
  end if;
  update public.matchday_action_lifecycle set status='superseded',ended_at=at_time,ended_by=actor where tenant_id=p_tenant_id and action_id=previous.id and status='active';
  update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=actor where schedule.tenant_id=p_tenant_id and schedule.enabled
   and exists(select 1 from public.matchday_owned_schedules owned where owned.tenant_id=p_tenant_id and owned.action_id=previous.id and owned.schedule_id=schedule.id);
 end if;
 insert into public.matchday_actions(id,tenant_id,publication_id,object_key,revision,kind,payload_json,content_hash,starts_at,ends_at,actor_id,reason,supersedes_action_id,request_id)
 values(new_action_id,p_tenant_id,publication.id,operation_key,head.revision+1,kind,payload,private.matchday_hash_s300_v1(payload-array['requestId','reason']),at_time,until_time,actor,btrim(p_input->>'reason'),head.current_action_id,(p_input->>'requestId')::uuid)returning *into action;
 insert into public.matchday_action_lifecycle(tenant_id,action_id)values(p_tenant_id,action.id);
 update public.matchday_object_states state set current_action_id=action.id,revision=action.revision where state.tenant_id=p_tenant_id and state.publication_id=publication.id and state.object_key=operation_key;
 if global_main then
  update public.matchday_runs set phase=case when kind='phase'then p_input->>'phase'else kind end,phase_actor_id=actor,phase_changed_at=at_time where tenant_id=p_tenant_id and publication_id=publication.id;
  if kind in('postponed','cancelled')or p_input->>'phase'in('postponed','cancelled')then
   update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=actor where schedule.tenant_id=p_tenant_id and schedule.enabled
    and exists(select 1 from public.matchday_owned_schedules owned join public.matchday_publication_targets target_row on target_row.tenant_id=owned.tenant_id and target_row.id=owned.target_id
     where owned.tenant_id=p_tenant_id and owned.publication_id=publication.id and owned.schedule_id=schedule.id and owned.action_id is null
      and schedule.id<>private.matchday_schedule_id_s300_v1(publication.id,target_row.screen_id,'default'));
  end if;
 end if;
 for target in select *from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids)order by screen_id loop
  if kind in('phase','sold_out')then
   if kind='phase'then release_id:=coalesce((target.phase_release_ids->>(p_input->>'phase'))::uuid,target.default_release_id);
   else release_id:=(placement->>'unavailableReleaseId')::uuid;end if;
   release_check:=private.matchday_release_s300_v1(p_tenant_id,release_id,target.screen_id);
   if release_check is null or not coalesce((release_check->>'ready')::boolean,false)or not coalesce((release_check->>'compatible')::boolean,false)then
    raise exception 'frozen replacement release is no longer ready'using errcode='23514';end if;
   schedule_id:=private.matchday_write_schedule_s300_v1(p_tenant_id,target.id,'action:'||action.id,release_id,at_time,until_time,action.id);
  else
   insert into public.matchday_deliveries(tenant_id,publication_id,target_id,action_id,action_revision,content_hash,device_id)
   values(p_tenant_id,publication.id,target.id,action.id,action.revision,action.content_hash,target.player_id);
   if kind='available'and exists(select 1 from public.matchday_deliveries predecessor where predecessor.tenant_id=p_tenant_id
    and predecessor.publication_id=publication.id and predecessor.action_id=previous.id and predecessor.target_id=target.id
    and predecessor.device_id=target.player_id and predecessor.offered_at is null)then
    update public.matchday_deliveries set status='skipped',
     detail='De tijdelijke melding was nog niet aan deze Player aangeboden; geen herstelbeeld bevestigd.'
     where tenant_id=p_tenant_id and action_id=action.id and target_id=target.id and device_id=target.player_id;
   end if;
  end if;
 end loop;
 update public.matchday_runs set revision=revision+1 where tenant_id=p_tenant_id and publication_id=publication.id;
 perform private.matchday_sync_scoped_targets_s300_v1(p_tenant_id,publication.id,screen_ids);
 perform private.audit_event(p_tenant_id,'matchday.action.value','matchday_actions',action.id,'success',jsonb_build_object(
  'objectKey',operation_key,'beforeActionId',head.current_action_id,'afterActionId',action.id,'screenIds',screen_ids,'expiresAt',until_time,
  'requestId',p_input->'requestId','reason',btrim(p_input->>'reason')));
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','applied',publication.runbook_id,publication.id,action.id,action.revision,'Opdracht klaargezet voor de geselecteerde schermen. Weergave wacht op passend Playerbewijs.');
end$$;

create or replace function public.record_player_matchday_window_offer_s300_v1(p_token_hash text,p_input jsonb)returns boolean
language plpgsql security definer set search_path=''as $$
declare device public.player_devices%rowtype;delivery public.matchday_deliveries%rowtype;bootstrap jsonb;window_metadata jsonb;identity jsonb;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 perform private.matchday_keys_s300_v1(p_input,array['publicationId','targetId','windowId','contentHash','fallbackReleaseId','fallbackCompositionId','fallbackCompositionRevision','fallbackCompositionHash']);
 perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'targetId');
 perform private.matchday_uuid_s300_v1(p_input->'windowId');perform private.matchday_uuid_s300_v1(p_input->'fallbackReleaseId');
 if p_input->>'contentHash'!~'^[a-f0-9]{64}$'or jsonb_typeof(p_input->'contentHash')<>'string'then raise exception 'invalid window hash'using errcode='22023';end if;
 if p_input->'fallbackCompositionId'='null'::jsonb then
  if p_input->'fallbackCompositionRevision'<>'null'::jsonb or p_input->'fallbackCompositionHash'<>'null'::jsonb then raise exception 'composition identity is inconsistent'using errcode='22023';end if;
 else
  perform private.matchday_uuid_s300_v1(p_input->'fallbackCompositionId');perform private.matchday_revision_s300_v1(p_input->'fallbackCompositionRevision');
  if jsonb_typeof(p_input->'fallbackCompositionHash')<>'string'or p_input->>'fallbackCompositionHash'!~'^[a-f0-9]{64}$'then raise exception 'invalid composition hash'using errcode='22023';end if;
 end if;
 select *into device from public.player_devices where token_hash=lower(btrim(p_token_hash))and status='paired';
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 perform 1 from public.screens where tenant_id=device.tenant_id and id=device.screen_id and status='active'and deleted_at is null for share;
 select *into device from public.player_devices where id=device.id and token_hash=lower(btrim(p_token_hash))and status='paired'for share;
 bootstrap:=public.get_player_effective_target_v1(p_token_hash);window_metadata:=bootstrap->'matchday_window';
 if window_metadata is null or window_metadata->>'publication_id'is distinct from p_input->>'publicationId'
  or window_metadata->>'target_id'is distinct from p_input->>'targetId'or window_metadata->>'window_id'is distinct from p_input->>'windowId'
  or window_metadata->>'content_hash'is distinct from p_input->>'contentHash'or window_metadata->>'fallback_release_id'is distinct from p_input->>'fallbackReleaseId'
  or window_metadata#>>'{fallback_composition,id}'is distinct from p_input->>'fallbackCompositionId'
  or coalesce(window_metadata#>'{fallback_composition,revision}','null'::jsonb)is distinct from p_input->'fallbackCompositionRevision'
  or window_metadata->>'fallback_composition_hash'is distinct from p_input->>'fallbackCompositionHash'then return false;end if;
 select *into delivery from public.matchday_deliveries where tenant_id=device.tenant_id and device_id=device.id
  and target_id=(p_input->>'targetId')::uuid and schedule_id=(p_input->>'windowId')::uuid and publication_id=(p_input->>'publicationId')::uuid
  and content_hash=p_input->>'contentHash'for update;
 if delivery.id is null then raise exception 'window was not issued to this device'using errcode='42501';end if;
 -- A concurrent availability command locks the same predecessor row. Repeat
 -- the current target check after acquiring it, so an older pre-lock read
 -- cannot issue a window that was removed while this request was waiting.
 bootstrap:=public.get_player_effective_target_v1(p_token_hash);window_metadata:=bootstrap->'matchday_window';
 if window_metadata is null or window_metadata->>'publication_id'is distinct from p_input->>'publicationId'
  or window_metadata->>'target_id'is distinct from p_input->>'targetId'or window_metadata->>'window_id'is distinct from p_input->>'windowId'
  or window_metadata->>'content_hash'is distinct from p_input->>'contentHash'or window_metadata->>'fallback_release_id'is distinct from p_input->>'fallbackReleaseId'
  or window_metadata#>>'{fallback_composition,id}'is distinct from p_input->>'fallbackCompositionId'
  or coalesce(window_metadata#>'{fallback_composition,revision}','null'::jsonb)is distinct from p_input->'fallbackCompositionRevision'
  or window_metadata->>'fallback_composition_hash'is distinct from p_input->>'fallbackCompositionHash'then return false;end if;

 identity:=jsonb_build_object('releaseId',p_input->'fallbackReleaseId','compositionId',p_input->'fallbackCompositionId',
  'compositionRevision',p_input->'fallbackCompositionRevision','compositionHash',p_input->'fallbackCompositionHash');
 if delivery.window_offers_json@>jsonb_build_array(identity)then return true;end if;
 if jsonb_array_length(delivery.window_offers_json)>=8 then raise exception 'MATCHDAY_FALLBACK_OFFER_LIMIT'using errcode='54000';end if;
 update public.matchday_deliveries set window_offers_json=window_offers_json||jsonb_build_array(identity),offered_at=coalesce(offered_at,private.matchday_now_s300_v1())
  where tenant_id=device.tenant_id and id=delivery.id;
 return true;
end$$;

-- The predecessor row is changed only after the existing exact window offer,
-- composition, device, release, end-time and first-frame checks have passed.
-- Recheck the causal frame bounds here: an old restoration must never confirm a
-- newer availability revision. This does not authorize any additional frame.
create function private.matchday_available_restoration_receipt_s300_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare predecessor public.matchday_actions%rowtype;successor public.matchday_actions%rowtype;
 device public.player_devices%rowtype;report jsonb;frame_at timestamptz;reported timestamptz;identity jsonb;
 receipt public.matchday_deliveries%rowtype;ended_at timestamptz;begin
 if new.restored_at is null or new.restored_at is not distinct from old.restored_at
  or new.confirmed_release_id is null or new.schedule_id is null or new.offered_at is null then return new;end if;
 select *into predecessor from public.matchday_actions where tenant_id=new.tenant_id and id=new.action_id
  and publication_id=new.publication_id and kind='sold_out'and revision=new.action_revision;
 if predecessor.id is null then return new;end if;
 select *into device from public.player_devices where tenant_id=new.tenant_id and id=new.device_id and status='paired';
 if device.id is null or not exists(select 1 from public.matchday_publication_targets target
  join public.screens screen on screen.tenant_id=target.tenant_id and screen.id=target.screen_id
  where target.tenant_id=new.tenant_id and target.id=new.target_id and target.publication_id=new.publication_id
   and target.player_id=device.id and target.screen_id=device.screen_id and screen.status='active'and screen.deleted_at is null)then return new;end if;
 report:=device.current_sync_detail->'matchdayWindow';
 reported:=private.screen_frame_timestamp_s296_v1(report->>'reportedAt');
 frame_at:=private.screen_frame_timestamp_s296_v1(device.current_sync_detail#>>'{publicationTrace,firstFrameAt}');
 if report->>'phase'is distinct from'restored'or report->>'publicationId'is distinct from new.publication_id::text
  or report->>'targetId'is distinct from new.target_id::text or report->>'windowId'is distinct from new.schedule_id::text
  or report->>'contentHash'is distinct from new.content_hash or report->>'releaseId'is distinct from new.confirmed_release_id::text
  or reported is null or reported is distinct from new.restored_at or reported<new.offered_at
  or device.last_seen_at is null or reported>device.last_seen_at or device.last_seen_at>private.matchday_now_s300_v1()
  or frame_at is null or frame_at>reported or frame_at<new.offered_at
  or device.active_release_id is distinct from new.confirmed_release_id
  or device.active_composition_id::text is distinct from report->>'compositionId'
  or device.current_sync_detail#>>'{publicationTrace,releaseId}'is distinct from report->>'releaseId'then return new;end if;
 identity:=jsonb_build_object('releaseId',report->'releaseId','compositionId',report->'compositionId',
  'compositionRevision',report->'compositionRevision','compositionHash',report->'compositionHash');
 if not new.window_offers_json@>jsonb_build_array(identity)then return new;end if;
 select *into successor from public.matchday_actions where tenant_id=new.tenant_id and publication_id=new.publication_id
  and supersedes_action_id=predecessor.id and object_key=predecessor.object_key and revision=predecessor.revision+1 and kind='available';
 if successor.id is null or frame_at<successor.starts_at or frame_at<successor.created_at then return new;end if;
 select lifecycle.ended_at into ended_at from public.matchday_action_lifecycle lifecycle
  where lifecycle.tenant_id=new.tenant_id and lifecycle.action_id=successor.id;
 if ended_at is not null and frame_at>=ended_at then return new;end if;
 update public.matchday_deliveries set status='restored',restored_at=new.restored_at,confirmed_release_id=new.confirmed_release_id,
  detail='Beschikbaarheid bevestigd met het getoonde herstelbeeld van de bijbehorende uitverkochtmelding.'
  where tenant_id=new.tenant_id and publication_id=new.publication_id and target_id=new.target_id and device_id=new.device_id
   and action_id=successor.id and action_revision=successor.revision and content_hash=successor.content_hash
   and schedule_id is null and restored_at is null and status not in('skipped','failed')returning *into receipt;
 if receipt.id is not null then
  insert into public.audit_events(tenant_id,actor_device_id,action,target_type,target_id,result,metadata)
  values(new.tenant_id,new.device_id,'matchday.delivery.restored','matchday_deliveries',receipt.id,'success',
   jsonb_build_object('publicationId',new.publication_id,'targetId',new.target_id,'actionId',successor.id,
    'revision',successor.revision,'contentHash',successor.content_hash,'sourceDeliveryId',new.id,
    'sourceActionId',predecessor.id,'sourceWindowId',new.schedule_id,'reportedAt',reported,'frameAt',frame_at,'releaseId',new.confirmed_release_id));
 end if;
 return new;
end$$;
create trigger matchday_available_restoration_receipt after update of restored_at,confirmed_release_id on public.matchday_deliveries
 for each row execute function private.matchday_available_restoration_receipt_s300_v1();

-- CREATE OR REPLACE preserves the human RPC's ACL; state it explicitly. The
-- trusted receipt trigger is private and has no API-callable entry point.
revoke all on function public.apply_matchday_action_s300_v1(uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.apply_matchday_action_s300_v1(uuid,jsonb)to authenticated;
revoke all on function private.matchday_available_restoration_receipt_s300_v1()from public,anon,authenticated,service_role;

revoke all on function public.record_player_matchday_window_offer_s300_v1(text,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.record_player_matchday_window_offer_s300_v1(text,jsonb)to service_role;
