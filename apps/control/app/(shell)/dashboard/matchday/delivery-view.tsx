import Link from "next/link";
import type { MatchdayWorkspace } from "@veyocast/contracts";
import { deliveryLabels,displayTime,roleLabels } from "./labels";
import styles from "./matchday.module.css";

export function MatchdayDeliveries({workspace,timezone,canReadScreens=false}:{workspace:MatchdayWorkspace;timezone:string;canReadScreens?:boolean}){
 const selected=workspace.selected,publication=selected?.publication;
 if(!publication)return <p>Publiceer eerst een gecontroleerde versie om afleverstatus per doelscherm te volgen.</p>;
 return <section aria-labelledby="matchday-delivery-title"><h2 id="matchday-delivery-title">Status per doelscherm</h2><p>Ontvangst en voorbereiding bevestigen nog geen beeld. Playerbewijs zegt niets over de voeding of ingang van het fysieke paneel.</p><div className={styles.cards}>{publication.targets.map(target=>{
  const rows=selected.deliveries.filter(row=>row.screenId===target.screenId);
  return <article className={styles.card} key={target.screenId}>
   <h3>{target.screenName}</h3><p>{roleLabels[target.role]} · {target.width} × {target.height} · {target.orientation==="portrait"?"Staand":"Liggend"}</p>
   {rows.length?rows.map(row=>{
    const release=row.confirmedReleaseId?workspace.options.releases.find(value=>value.id===row.confirmedReleaseId):undefined;
    // Older rendered payloads bind renderedAt to this release. A restored
    // payload needs its own confirmation time; its renderedAt belongs to the
    // earlier temporary content and must never date the recovery release.
    const confirmedAt=row.confirmedAt??(row.status==="rendered"?row.renderedAt:null);
    const earlierFrame=row.status!=="rendered"?row.renderedAt:null;
    return <div className={styles.delivery} key={row.id}>
     <strong>{deliveryLabels[row.status]}</strong>
     <span>Bevestigde publicatie: {row.confirmedReleaseId?release?`${release.label} · versie ${release.version}`:"Versie onbekend":"Weergave onbekend"}</span>
     <span>Bevestigd op: {displayTime(confirmedAt,timezone)}</span>
     <span>Ontvangen: {displayTime(row.receivedAt,timezone)}</span>
     {row.detail?<p>{row.detail}</p>:null}
     {row.actionId||earlierFrame?<details><summary>Afleverdetails</summary>{row.actionId?<span>Actierevisie {row.actionRevision}</span>:null}{earlierFrame?<span>Eerder tijdelijk frame: {displayTime(earlierFrame,timezone)}</span>:null}</details>:null}
    </div>;
   }):<p>Weergave onbekend · wacht op Playerbewijs</p>}
   {canReadScreens&&selected.readScope!=="delegated"?<Link href={`/dashboard/screens/${encodeURIComponent(target.screenId)}`}>Bron- en publicatiebewijs openen</Link>:null}
  </article>;
 })}</div></section>;
}
