import {randomUUID} from "node:crypto";
import Link from "next/link";
import {ChevronRight,Grid2X2,Plus} from "lucide-react";
import {hasCapability} from "@veyocast/auth";
import {Button,StatusPill} from "@veyocast/ui";
import {requireTenantControlSession} from "../../../../../lib/control-session";
import {loadScreenGroups} from "../../screen-groups/data";
import {createScreenGroup,updateScreenGroup} from "../../screen-groups/actions";
import {ArchiveScreenGroupDialog,ScreenGroupDialog} from "../../screen-groups/screen-group-dialogs";
import s from "../screens-overview.module.css";
import shared from "../../settings/sites-settings.module.css";

export default async function ScreenGroupsPage({searchParams}:{searchParams:Promise<{fout?:string;succes?:string}>}){
 const session=await requireTenantControlSession("tenant.screen.read");const query=await searchParams;
 const data=session.isLive&&session.tenantId?await loadScreenGroups(session.tenantId):{error:null,groups:[],releases:[],screens:[]};
 const canManage=session.isLive&&session.tenantStatus==="active"&&hasCapability(session.capabilities,"tenant.screen.manage");
 return <div className={shared.page}><div className={shared.heading}><div><h1>Schermgroepen beheren</h1><p>Combineer schermen om content eenvoudig op meerdere plekken te tonen.</p></div><Button asChild variant="secondary"><Link href="/dashboard/screens">Gereed</Link></Button></div>
  {query.fout?<p className="notice notice--critical" role="alert"><strong>Schermgroep niet opgeslagen.</strong> {query.fout}</p>:null}{query.succes?<p className="notice notice--success" role="status">{query.succes}</p>:null}{data.error?<p className="notice notice--critical" role="alert"><strong>Schermgroepen niet geladen.</strong> {data.error}</p>:null}{!session.isLive?<p className="notice notice--warning" role="status">Configureer Supabase en log in om echte schermgroepen te beheren.</p>:null}
  <section className={shared.surface} aria-label="Schermgroepen"><div className={s.groupManager}>{data.groups.map(group=><details key={group.id}><summary><Grid2X2 aria-hidden="true" size={18}/><strong>{group.name}</strong><span>{group.memberIds.length} schermen</span>{group.status!=="active"?<StatusPill label="Gearchiveerd" tone="neutral"/>:null}<ChevronRight aria-hidden="true" size={16}/></summary>
   <form action={updateScreenGroup}><input type="hidden" name="groupId" value={group.id}/><input type="hidden" name="expectedRevision" value={group.revision}/><input type="hidden" name="idempotencyKey" value={randomUUID()}/><input type="hidden" name="name" value={group.name}/><input type="hidden" name="description" value={group.description??""}/><input type="hidden" name="defaultPlaylistId" value={group.defaultPlaylistId??""}/>
    <fieldset className={s.memberChecks} disabled={!canManage||group.status!=="active"}><legend className="sr-only">Schermen in {group.name}</legend>{data.screens.map(screen=><label key={screen.id}><input type="checkbox" name="screenIds" value={screen.id} defaultChecked={group.memberIds.includes(screen.id)} disabled={screen.disabled}/>{screen.name}</label>)}</fieldset>
    <div className={s.formActions}><span>Revisie {group.revision} · {group.defaultContent??"Geen standaardcontent"}</span>{canManage&&group.status==="active"?<><ScreenGroupDialog disabled={false} group={group} releases={data.releases} screens={data.screens}/><ArchiveScreenGroupDialog group={group}/><Button type="submit">Schermen opslaan</Button></>:null}</div>
   </form>
  </details>)}</div>{!data.groups.length?<p className={shared.empty}>Nog geen schermgroepen. Voeg een groep toe om schermen te combineren.</p>:null}
  <form action={createScreenGroup} className={s.newGroup}><input type="hidden" name="idempotencyKey" value={randomUUID()}/><input aria-label="Naam nieuwe schermgroep" placeholder="Naam van nieuwe groep" name="name" required minLength={2} maxLength={120} disabled={!canManage}/><Button disabled={!canManage} type="submit"><Plus aria-hidden="true" size={16}/>Groep toevoegen</Button></form>
  </section>
 </div>;
}
