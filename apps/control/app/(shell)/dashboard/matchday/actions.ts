"use server";

import {
  applyMatchdayActionCommand, closeMatchdayCommand, endMatchdayActionCommand,
  grantMatchdayCommand, previewMatchdayCommand, publishMatchdayCommand,
  saveMatchdayDraftCommand, setMatchdayEnabledCommand
} from "../../../../lib/matchday-service";

export async function saveMatchdayDraft(value:unknown,expectedActorScope:string) {return saveMatchdayDraftCommand(value,expectedActorScope);}
export async function previewMatchday(runbookId:string,expectedRevision:number,expectedActorScope:string) {return previewMatchdayCommand(runbookId,expectedRevision,expectedActorScope);}
export async function publishMatchday(value:unknown,expectedActorScope:string) {return publishMatchdayCommand(value,expectedActorScope);}
export async function setMatchdayEnabled(value:unknown,expectedActorScope:string) {return setMatchdayEnabledCommand(value,expectedActorScope);}
export async function applyMatchdayAction(value:unknown,expectedActorScope:string) {return applyMatchdayActionCommand(value,expectedActorScope);}
export async function endMatchdayAction(value:unknown,expectedActorScope:string) {return endMatchdayActionCommand(value,expectedActorScope);}
export async function closeMatchday(value:unknown,expectedActorScope:string) {return closeMatchdayCommand(value,expectedActorScope);}
export async function grantMatchday(value:unknown,expectedActorScope:string) {return grantMatchdayCommand(value,expectedActorScope);}
