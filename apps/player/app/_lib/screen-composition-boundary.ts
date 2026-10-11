export type ZoneBoundaryControl={holdAtBoundary:()=>Promise<void>;resume:()=>void};
/** Images stop immediately; a healthy video promises its natural end/trim boundary. */
export class ScreenCompositionBoundary{
 private controls=new Map<string,ZoneBoundaryControl>();
 register(id:string,control:ZoneBoundaryControl){this.controls.set(id,control);return()=>{if(this.controls.get(id)===control)this.controls.delete(id);};}
 async holdAll(signal:AbortSignal):Promise<boolean>{
  if(signal.aborted)return false;const waiting=[...this.controls.values()].map(control=>control.holdAtBoundary());
  let abort:()=>void=()=>{};
  try{return await Promise.race([Promise.all(waiting).then(()=>!signal.aborted),new Promise<boolean>(resolve=>{abort=()=>resolve(false);signal.addEventListener("abort",abort,{once:true});if(signal.aborted)resolve(false);})]);}
  finally{signal.removeEventListener("abort",abort);if(signal.aborted)this.resumeAll();}
 }
 resumeAll(){this.controls.forEach(control=>control.resume());}
}
