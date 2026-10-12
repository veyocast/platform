import Link from "next/link";
import {ArrowRight,Building2,Monitor,Play} from "lucide-react";
import {Button,StatusPill} from "@veyocast/ui";
import {requireControlCapability} from "../../../lib/control-session";
import {loadPlatformOverview} from "../../../lib/control-overview";
import s from "../dashboard/settings/sites-settings.module.css";

export default async function PlatformPage(){
 const session=await requireControlCapability("platform.system.read");
 const data=session.isLive?await loadPlatformOverview():{tenants:[],screens:[],devices:[],error:false};
 const active=data.tenants.filter(tenant=>tenant.status==="active").length;
 const online=data.devices.filter(device=>Boolean(device.last_seen_at&&Date.now()-new Date(device.last_seen_at).getTime()<5*60_000)).length;
 return <div className={s.page}>
  <div className={s.heading}><div><h1>Platformbeheer</h1><p>Verenigingen, toegang en platformstatus op één plek.</p></div><Button asChild><Link href="/platform/tenants">Verenigingen beheren <ArrowRight aria-hidden="true" size={17}/></Link></Button></div>
  {!session.isLive?<p className="notice notice--warning" role="status">Geen live platformgegevens. Verbind de lokale Supabase-omgeving om verenigingen en schermen te bekijken.</p>:null}
  {data.error?<p className="notice notice--critical" role="alert"><strong>Platformoverzicht niet beschikbaar.</strong> De gegevens konden niet veilig worden geladen. Vernieuw de pagina of log opnieuw in.</p>:null}
  <div className={s.metrics}><div><Building2 aria-hidden="true"/><small>Verenigingen</small><strong>{data.tenants.length}</strong><span>{active} actief</span></div><div><Monitor aria-hidden="true"/><small>Schermen</small><strong>{data.screens.length}</strong><span>Geregistreerde schermen</span></div><div><Play aria-hidden="true"/><small>Players</small><strong>{data.devices.length}</strong><span>{online} recent online</span></div></div>
  <nav aria-label="Platformonderdelen" className={s.tabs}>{[["Verenigingen","/platform/tenants"],["Gebruikers","/platform/users"],["Systeem","/platform/system"]].map(([label,path])=><Link href={path!} key={path}>{label}</Link>)}</nav>
  <section className={s.surface}><header><h2>Verenigingen</h2><p>De actuele omgevingen binnen het platform.</p></header><div className={s.tableScroll}><table className={s.table}><thead><tr><th scope="col">Vereniging</th><th scope="col">Schermen</th><th scope="col">Status</th><th scope="col">Actie</th></tr></thead><tbody>{data.tenants.map(tenant=><tr key={tenant.id}><td><strong>{tenant.name}</strong><small className={s.block}>{tenant.slug}</small></td><td>{data.screens.filter(screen=>screen.tenant_id===tenant.id).length} / {tenant.screen_limit}</td><td><StatusPill label={tenant.status==="active"?"Actief":tenant.status==="paused"?"Gepauzeerd":"Gearchiveerd"} tone={tenant.status==="active"?"success":"neutral"}/></td><td><Button asChild variant="secondary"><Link href={`/platform/tenants/${tenant.id}`}>Bekijken <ArrowRight aria-hidden="true" size={15}/></Link></Button></td></tr>)}</tbody></table></div>{!data.tenants.length&&!data.error?<p className={s.empty}>Nog geen verenigingen beschikbaar.</p>:null}</section>
 </div>;
}
