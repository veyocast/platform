import Link from "next/link";
import {ArrowRight,ShieldCheck,UserRound} from "lucide-react";
import {Button,StatusPill} from "@veyocast/ui";
import {requireControlSession} from "../../../../lib/control-session";
import s from "../settings/sites-settings.module.css";

export default async function AccountPage(){
 const session=await requireControlSession();
 return <div className={s.page}>
  <div className={s.heading}><div><h1>Account</h1><p>Jouw persoonlijke gegevens en toegang.</p></div></div>
  <div className={s.accountGrid}>
   <section className={s.surface} aria-labelledby="account-profile-title"><header><h2 id="account-profile-title">Persoonlijk profiel</h2></header><div className={s.accountAvatar}><UserRound aria-hidden="true" size={30}/><div><h3>{session.userName}</h3><StatusPill label={session.tenantRoleLabel??"Persoonlijk account"} tone="neutral"/></div></div>
    <div className={s.fieldGrid}><div className="field"><label htmlFor="account-name">Naam</label><input id="account-name" readOnly value={session.userName}/></div><div className="field"><label htmlFor="account-email">E-mailadres</label><input id="account-email" readOnly value={session.email}/></div></div>
    <div className={s.info}><UserRound aria-hidden="true" size={20}/><p>Je identiteit hoort bij je persoonlijke account. Je actieve werkcontext is {session.tenant}.</p></div><div className={s.formActions}><Button asChild variant="secondary"><Link href="/context">Van vereniging wisselen <ArrowRight aria-hidden="true" size={16}/></Link></Button></div>
   </section>
   <section className={s.surface} aria-labelledby="account-security-title"><header><h2 id="account-security-title">Beveiliging</h2><p>Bescherm jouw toegang tot de vereniging.</p></header><ShieldCheck aria-hidden="true" className={s.securityIcon} size={34}/><StatusPill label={session.assuranceLevel==="aal2"?"Tweestapsverificatie bevestigd":"Standaard sessie"} tone={session.assuranceLevel==="aal2"?"success":"neutral"}/><p>Tweestapsverificatie beveiligt je account en bevestigt gevoelige wijzigingen.</p><Button asChild><Link href="/dashboard/account/mfa">Tweestapsverificatie beheren <ArrowRight aria-hidden="true" size={16}/></Link></Button>
   </section>
  </div>
 </div>;
}
