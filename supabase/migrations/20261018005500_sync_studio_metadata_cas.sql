-- A Source name belongs to the draft as well as the library metadata. Advance
-- the draft CAS when renaming, so a previously opened editor cannot undo it.
do $migration$
declare definition text;previous text;replacement text;
begin
 select pg_get_functiondef('public.mutate_studio_project_v1(uuid,bigint,text,jsonb,uuid)'::regprocedure) into definition;
 previous:=$old$    update public.studio_projects
    set
      name = normalized_name,
      revision = revision + 1,
      updated_by = actor_id
    where tenant_id = project_record.tenant_id and id = project_record.id
    returning * into project_record;$old$;
 replacement:=$new$    select draft.* into draft_record from public.studio_project_drafts draft
      where draft.tenant_id=project_record.tenant_id and draft.project_id=project_record.id for update;
    if draft_record.document_json ? 'syncPresentation' then
      outcome:=public.save_studio_draft_v1(project_record.id,draft_record.draft_revision,
        jsonb_set(draft_record.document_json,'{syncPresentation,name}',to_jsonb(normalized_name)),
        draft_record.referenced_asset_ids,private.studio_series_child_key_v1(p_idempotency_key,0));
      if outcome->>'outcome' is distinct from 'saved' then
        raise exception 'Source rename draft conflict' using errcode='40001';
      end if;
      select project.* into project_record from public.studio_projects project
        where project.tenant_id=project_record.tenant_id and project.id=project_record.id;
    else
      update public.studio_projects set name=normalized_name,revision=revision+1,updated_by=actor_id
        where tenant_id=project_record.tenant_id and id=project_record.id returning * into project_record;
    end if;$new$;
 if position(previous in definition)=0 then raise exception 'Source metadata rename migration precondition failed';end if;
 definition:=replace(definition,previous,replacement);
 previous:=$old$    insert into public.studio_projects (
      tenant_id,
      owner_user_id,
      name,
      project_kind,$old$;
 replacement:=$new$    if draft_record.document_json ? 'syncPresentation' then
      draft_record.document_json:=jsonb_set(draft_record.document_json,'{syncPresentation,name}',to_jsonb(normalized_name));
      perform private.assert_sync_slide_v1(project_record.tenant_id,draft_record.document_json->'syncPresentation');
      draft_record.document_hash:=private.studio_document_hash(draft_record.document_json);
    end if;
    insert into public.studio_projects (
      tenant_id,
      owner_user_id,
      name,
      project_kind,$new$;
 if position(previous in definition)=0 then raise exception 'Source metadata copy migration precondition failed';end if;
 definition:=replace(definition,previous,replacement);
 execute definition;
end;$migration$;
revoke all on function public.mutate_studio_project_v1(uuid,bigint,text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.mutate_studio_project_v1(uuid,bigint,text,jsonb,uuid) to authenticated;
