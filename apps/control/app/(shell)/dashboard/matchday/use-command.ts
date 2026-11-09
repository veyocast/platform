"use client";

import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchdayCommandResult } from "../../../../lib/matchday-service";

export type ConfirmMatchdayCommand=(title:string,summary:string,command:()=>Promise<MatchdayCommandResult>)=>void;
type Attempt={title:string;summary:string;actorScope:string;command:()=>Promise<MatchdayCommandResult>};

/** A lost response retains the exact immutable command and request nonce.
 * Other mutations stay blocked until retry resolves the same receipt. */
export function useMatchdayCommand(actorScope:string){
 const router=useRouter();
 const scopeRef=useRef(actorScope),mounted=useRef(true);scopeRef.current=actorScope;
 const[confirmation,setConfirmation]=useState<Attempt|null>(null),[retry,setRetry]=useState<Attempt|null>(null);
 const[pending,setPending]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{mounted.current=true;setConfirmation(null);setRetry(null);setPending(false);setMessage("");return()=>{mounted.current=false;};},[actorScope]);
 const blocked=pending||retry!==null;
 const confirm:ConfirmMatchdayCommand=(title,summary,command)=>{if(!blocked&&scopeRef.current===actorScope)setConfirmation({title,summary,actorScope,command});};
 async function run(attempt:Attempt){
  if(!mounted.current||attempt.actorScope!==scopeRef.current)return;
  setConfirmation(null);setPending(true);setMessage("");
  let result:MatchdayCommandResult;
  try{result=await attempt.command();}catch{result={ok:false,code:"UNAVAILABLE",message:"Het antwoord op deze opdracht ontbreekt.",recovery:"Probeer dezelfde opdracht opnieuw om het bestaande resultaat terug te vinden."};}
  if(!mounted.current||attempt.actorScope!==scopeRef.current)return;
  setPending(false);
  if(!result.ok){setMessage(`${result.message} ${result.recovery}`);if(result.code==="UNAVAILABLE")setRetry(attempt);else{setRetry(null);router.refresh();}return;}
  setRetry(null);setMessage(result.receipt.message);router.refresh();
 }
 return {confirmation,confirm,blocked,pending,message,retry,cancel:()=>setConfirmation(null),accept:()=>confirmation&&void run(confirmation),retrySame:()=>retry&&void run(retry)};
}
