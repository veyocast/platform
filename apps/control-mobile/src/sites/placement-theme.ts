import type {MobilePlacementThemeResultV2} from "@veyocast/contracts";
type Ready=Extract<MobilePlacementThemeResultV2,{status:"ready"}>;
export async function awaitNativePlacementTheme({prepare,status,onPending,existingJobId,now=Date.now,wait=milliseconds=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds)),timeoutMs=300_000}:{prepare:()=>Promise<MobilePlacementThemeResultV2>;status:(jobId:string)=>Promise<MobilePlacementThemeResultV2>;onPending:(jobId:string)=>void;existingJobId?:string;now?:()=>number;wait?:(milliseconds:number)=>Promise<void>;timeoutMs?:number}):Promise<Ready>{
 const deadline=now()+timeoutMs;let result=existingJobId?await status(existingJobId):await prepare();
 while(result.status==="pending"){
  onPending(result.jobId);
  if(now()>=deadline)throw Error("De render is nog niet bevestigd. Je invoer en renderopdracht blijven behouden; probeer dezelfde themakeuze opnieuw.");
  await wait(Math.min(4000,Math.max(1,deadline-now())));
  if(now()>=deadline)throw Error("De render is nog niet bevestigd. Je invoer en renderopdracht blijven behouden; probeer dezelfde themakeuze opnieuw.");
  result=await status(result.jobId);
 }
 if(result.status==="failed")throw Error("De themarender is mislukt of niet volledig geverifieerd. De huidige playlist blijft behouden. Open het ontwerp en herstel de render.");
 return result;
}
