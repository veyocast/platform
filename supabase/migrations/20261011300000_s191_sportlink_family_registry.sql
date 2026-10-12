-- Complete the canonical source registry without touching any existing
-- published version, tenant source, slide, snapshot or immutable release.
-- React/static Sites renderers already consume all seventeen typed families;
-- these real registry versions also retain a safe canonical SVG fallback.
-- The existing two birthday templates stay unique and unchanged; the wizard
-- selects published typed families instead of requiring an Editorial slug.
create function private.ensure_sites_sportlink_family_registry_v1() returns void
language plpgsql security invoker set search_path='' as $$
declare target record;shape text;source public.dynamic_template_versions%rowtype;
  target_id uuid;version_id uuid;registry_slug text;markup text;manifest jsonb;sample jsonb;existing record;
begin
 for target in select *from(values
  ('sport_period_standing','Periodestand','sport_standing'),
  ('sport_match_of_the_day','Wedstrijd van de dag','sport_next_match'),
  ('sport_team','Teaminformatie','sport_activities'),
  ('sport_sponsor','Sponsors','sport_activities'),
  ('sport_trainings','Trainingen','sport_activities'),
  ('sport_volunteers','Vrijwilligers','sport_activities'))families(slide_type,label,source_type)
 loop
  foreach shape in array array['landscape','portrait']loop
   registry_slug:='editorial-arena-sites-'||replace(replace(target.slide_type,'sport_',''),'_','-')||'-'||shape;
   select template.id,template.slide_type,template.orientation,template.status,
    version.status as version_status,version.manifest_json
   into existing from public.dynamic_templates template
   left join public.dynamic_template_versions version on version.id=template.current_published_version_id
   where template.slug=registry_slug;
   if found then
    if existing.slide_type<>target.slide_type or existing.orientation<>shape or existing.status<>'published'
     or existing.version_status is distinct from'published' or existing.manifest_json->>'slideType'is distinct from target.slide_type
     or existing.manifest_json->>'engine'is distinct from'veyocast-safe-template-v1'
    then raise exception 'canonical Sportlink registry entry conflicts with existing metadata'using errcode='23514';end if;
    continue;
   end if;
   select version.*into source from public.dynamic_templates template
   join public.dynamic_template_versions version on version.id=template.current_published_version_id
   where template.slide_type=target.source_type and template.orientation=shape
    and template.status='published'and version.status='published'
    and version.manifest_json->>'engine'='veyocast-safe-template-v1'
   order by(template.slug like'editorial-arena-%')desc,template.slug limit 1;
   if not found then raise exception 'canonical Sportlink source renderer unavailable'using errcode='23514';end if;
   -- The approved existing data layout remains. Do not reproduce historical
   -- placeholder crests or software headings; the Player supplies its locked
   -- VeyoCast lock-up. The family title comes from the frozen canonical data.
   markup:=regexp_replace(source.markup,'<path[^>]*class="crest"[^>]*/>','','g');
   markup:=regexp_replace(markup,'<text[^>]*class="(crestText|kicker|eyebrow)"[^>]*>[^<]*</text>','','g');
   markup:=regexp_replace(markup,'(<text[^>]*class="title"[^>]*>)[^<]*(</text>)','\1{{truncate sport.title "44"}}\2','g');
   manifest:=jsonb_set(source.manifest_json,'{slideType}',to_jsonb(target.slide_type),true);
   if not exists(select 1 from jsonb_array_elements(manifest->'allowedFields')field where field->>'path'='sport.title')then
    manifest:=jsonb_set(manifest,'{allowedFields}',(manifest->'allowedFields')||jsonb_build_array(jsonb_build_object('path','sport.title','type','string','required',true)));
   end if;
   -- A published template is structural metadata. Never invent people, teams,
   -- scores, providers or media to make the authoring preview appear populated.
   sample:=jsonb_build_object('type',target.slide_type,'brand',coalesce(source.sample_data_json->'brand','{}'::jsonb),
    'sport',jsonb_build_object('title',target.label,'items','[]'::jsonb));
   insert into public.dynamic_templates(slug,name,description,category,slide_type,orientation,status)
   values(registry_slug,target.label||case when shape='portrait'then' · staand'else' · liggend'end,
    'Canonieke Sportlink-familie met getypte databaseprojectie, Sites-presentatie en immutable PNG-fallback.',
    'sports',target.slide_type,shape,'published')returning id into target_id;
   insert into public.dynamic_template_versions(template_id,version,status,markup,css,manifest_json,sample_data_json,source_checksum_sha256,published_at)
   values(target_id,1,'published',markup,source.css,manifest,sample,
    encode(extensions.digest(pg_catalog.convert_to(markup||source.css||manifest::text,'UTF8'),'sha256'),'hex'),now())returning id into version_id;
   update public.dynamic_templates set current_published_version_id=version_id where id=target_id;
  end loop;
 end loop;
end$$;
revoke all on function private.ensure_sites_sportlink_family_registry_v1() from public,anon,authenticated,service_role;
select private.ensure_sites_sportlink_family_registry_v1();
notify pgrst,'reload schema';
