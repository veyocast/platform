"use server";
import { sportlinkSlideDraftSchema } from "@veyocast/contracts";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { loadCanonicalSitesSportlinkPreview } from "./sites-sportlink-preview-data";
export async function previewSitesSportlinkDraft(sourceId:string,value:unknown){
 await requireTenantControlSession("tenant.dynamic_slide.write");
 const draft=sportlinkSlideDraftSchema.safeParse(value);
 if(!draft.success||!/^[0-9a-f-]{36}$/i.test(sourceId))return {ok:false as const,message:"Kies eerst je bron, inhoud en teams om het schermvoorbeeld te laden."};
 const d=draft.data;
 const configuration={schemaVersion:1,blueprintKey:d.blueprintKey,context:d.context,title:d.title,display:d.display,maxItems:40,editorial:{schemaVersion:2,themeSelection:d.themeSelection},...(d.arrival?{arrival:d.arrival}:{}),...(d.teamContexts?{teamContexts:d.teamContexts}:{}),...(d.teamSelection?{teamSelection:d.teamSelection}:{}),...(d.sitesConfiguration?{sitesConfiguration:d.sitesConfiguration}:{})};
 return loadCanonicalSitesSportlinkPreview({sourceId,name:d.name,templateVersionId:d.templateVersionId,orientation:d.orientation,configuration});
}
