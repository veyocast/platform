import {DynamicRenderBackendError,type ClaimedDynamicRenderJob,type DynamicRenderBackend} from './dynamic-render-backend';

/** One in-flight renewal, including during long full-video encodes. Stop the
 * timer before completion so an acknowledged completion cannot self-expire. */
export function createDynamicRenderLease(backend:DynamicRenderBackend,job:ClaimedDynamicRenderJob,config:{workerId:string;lockTimeoutSeconds:number},parent?:AbortSignal){
 const controller=new AbortController(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;
 let timer:ReturnType<typeof setInterval>|undefined,inFlight:Promise<void>|undefined,error:unknown;
 const enabled=Boolean(job.leaseToken&&backend.renewJob);
 const renew=()=>{
  if(!enabled)return Promise.resolve();
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   try{if(!await backend.renewJob!(job,config.workerId))throw new DynamicRenderBackendError('dynamic_render_lease_lost',false,'De renderopdracht is door een nieuwere poging overgenomen.');}
   catch(cause){error=cause;controller.abort(cause);}
  })().finally(()=>{inFlight=undefined;});
  return inFlight;
 };
 const check=async()=>{if(error)throw error;signal.throwIfAborted();await renew();if(error)throw error;signal.throwIfAborted();};
 const stop=async()=>{if(timer){clearInterval(timer);timer=undefined;}await inFlight;};
 return {signal,get error(){return error;},check,stop,
  async begin(){await check();if(enabled){timer=setInterval(()=>{void renew();},Math.floor(Math.min(600,Math.max(30,config.lockTimeoutSeconds))*1000/3));timer.unref();}},
  async prepareCompletion(){await stop();await check();},
 };
}
