import type {PlayerManifestEnvelope} from "./player-manifest";
import {screenCompositionIdentity,screenCompositionZoneFrameIdentity} from "./player-screen-composition";

/** Facts can change independently inside an immutable composition. A changed
 * publication still needs every zone's ordinary publication boundary. */
export function changedCompositionDataBoundaryZones(current:PlayerManifestEnvelope,next:PlayerManifestEnvelope):("side"|"bottom")[]|null{
 if(current.manifest.releaseId!==next.manifest.releaseId||screenCompositionIdentity(current)!==screenCompositionIdentity(next))return null;
 return (["side","bottom"]as const).filter(id=>{const before=current.composition?.zones[id],after=next.composition?.zones[id];return before&&after?screenCompositionZoneFrameIdentity(before)!==screenCompositionZoneFrameIdentity(after):before!==after;});
}
export type ZoneBoundaryControl={holdAtBoundary:()=>Promise<void>;resume:(dataAccepted?:boolean)=>void;hasPresentedCurrentOccurrence?:(itemId:string)=>boolean};
/** Images stop immediately; a healthy video promises its natural end/trim boundary. */
export class ScreenCompositionBoundary{
 private controls=new Map<string,ZoneBoundaryControl>();
 register(id:string,control:ZoneBoundaryControl){this.controls.set(id,control);return()=>{if(this.controls.get(id)===control)this.controls.delete(id);};}
 hasPresentedCurrentOccurrence(id:string,itemId:string){return this.controls.get(id)?.hasPresentedCurrentOccurrence?.(itemId)??false;}
 holdAll(signal:AbortSignal):Promise<boolean>{return this.holdZones([...this.controls.keys()],signal);}
 async holdZones(ids:readonly string[],signal:AbortSignal):Promise<boolean>{
  if(signal.aborted)return false;const waiting=ids.flatMap(id=>{const control=this.controls.get(id);return control?[control.holdAtBoundary()]:[];});
  let abort:()=>void=()=>{};
  try{return await Promise.race([Promise.all(waiting).then(()=>!signal.aborted),new Promise<boolean>(resolve=>{abort=()=>resolve(false);signal.addEventListener("abort",abort,{once:true});if(signal.aborted)resolve(false);})]);}
  finally{signal.removeEventListener("abort",abort);if(signal.aborted)this.resumeZones(ids);}
 }
 resumeZones(ids:readonly string[],dataAccepted=false){ids.forEach(id=>this.controls.get(id)?.resume(dataAccepted));}
 resumeAll(dataAccepted=false){this.controls.forEach(control=>control.resume(dataAccepted));}
}
