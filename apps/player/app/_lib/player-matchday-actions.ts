import{playerMatchdayActionsResponseSchema,type PlayerMatchdayAction}from"@veyocast/contracts";
export type MatchdayActionScope={deviceId:string;screenId:string;publicationId:string;targetId:string};
const objectKey=(action:PlayerMatchdayAction)=>`${action.publicationId}:${action.matchId}:${action.kind==='field'?'field':'status'}`;
export function formatMatchdayKickoff(value:string,timezone:unknown){
 const options:Intl.DateTimeFormatOptions={day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'};
 try{return new Intl.DateTimeFormat('nl-NL',{...options,timeZone:typeof timezone==='string'?timezone:'Europe/Amsterdam'}).format(new Date(value));}
 catch{return new Intl.DateTimeFormat('nl-NL',{...options,timeZone:'Europe/Amsterdam'}).format(new Date(value));}
}
/** Session-only high water and monotonic expiry. Nothing is restored from an
 * unauthenticated cache or a preceding boot's wall clock. */
export class PlayerMatchdayActionsState{
 private readonly deadlines=new Map<string,number>();
 private readonly revisions=new Map<string,{revision:number;hash:string}>();
 observe(value:unknown,requestId:string,requestStart:number,now:number,scope:MatchdayActionScope){
  const response=playerMatchdayActionsResponseSchema.parse(value);
  if(response.requestId!==requestId||response.deviceId!==scope.deviceId||response.screenId!==scope.screenId||(response.publicationId!==scope.publicationId&&(response.publicationId!==null||response.actions.length!==0))||!Number.isFinite(requestStart)||!Number.isFinite(now)||now<requestStart)throw Error('MATCHDAY_ACTION_RESPONSE_UNBOUND');
  const server=Date.parse(response.serverTime),keys=new Set<string>();
  for(const action of response.actions){
   const key=objectKey(action),before=this.revisions.get(key),start=Date.parse(action.startsAt),end=Date.parse(action.expiresAt);
   if(action.deviceId!==scope.deviceId||action.screenId!==scope.screenId||action.publicationId!==scope.publicationId||action.targetId!==scope.targetId||keys.has(key)||end<=start||end-start>48*60*60_000||server<start)throw Error('MATCHDAY_ACTION_BINDING_INVALID');
   if(before&&(action.actionRevision<before.revision||action.actionRevision===before.revision&&action.contentHash!==before.hash))throw Error('MATCHDAY_ACTION_REVISION_REGRESSED');
   keys.add(key);
  }
  const active:PlayerMatchdayAction[]=[];
  for(const action of response.actions){
   const deadline=Math.min(this.deadlines.get(action.deliveryId)??Infinity,requestStart+Date.parse(action.expiresAt)-server);
   this.deadlines.set(action.deliveryId,deadline);this.revisions.set(objectKey(action),{revision:action.actionRevision,hash:action.contentHash});
   if(now<deadline)active.push(action);
  }
  return active;
 }
 remaining(action:PlayerMatchdayAction,now:number){return Math.max(0,(this.deadlines.get(action.deliveryId)??now)-now);}
 active(actions:readonly PlayerMatchdayAction[],now:number){return actions.filter(action=>this.remaining(action,now)>0);}
}
