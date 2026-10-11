"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {LedScoresMatchState} from "../_lib/ledscores-match-experience";
import {findFirstPlayableItemIndex,findNextPlayableItem,getPlayerItemPlaybackDurationMs,type PlayerManifestEnvelope} from "../_lib/player-manifest";
import type {ScreenCompositionBoundary} from "../_lib/screen-composition-boundary";
import {PlaybackScene} from "./player-runtime";

export function ScreenCompositionZone({zoneId,envelope,paused,boundary,onFrame,liveMatchStates,watchdogTimeoutMs}:{zoneId:"side"|"bottom";envelope:PlayerManifestEnvelope;paused:boolean;boundary:ScreenCompositionBoundary;onFrame:(zoneId:"side"|"bottom",releaseId:string)=>void;liveMatchStates:ReadonlyMap<string,LedScoresMatchState>;watchdogTimeoutMs:number}){
 const[index,setIndex]=useState(()=>Math.max(0,findFirstPlayableItemIndex(envelope.manifest.items)));const[held,setHeld]=useState(false);const[attempt,setAttempt]=useState(0);const[readyVersion,setReadyVersion]=useState(0);
 const item=envelope.manifest.items[index]??envelope.manifest.items[0];const current=useRef(item);current.current=item;
 const ready=useRef(false),ended=useRef(false),holding=useRef(false);const resolver=useRef<(()=>void)|null>(null);const elapsed=useRef({itemId:item?.id,remainingMs:item?getPlayerItemPlaybackDurationMs(item):0});
 const items=useRef(envelope.manifest.items);items.current=envelope.manifest.items;
 const advance=useCallback(()=>{if(holding.current){ended.current=true;setHeld(true);resolver.current?.();resolver.current=null;return;}const selected=findNextPlayableItem(items.current,index);if(selected){ready.current=false;ended.current=false;setAttempt(value=>value+1);setIndex(selected.index);}},[index]);
 useEffect(()=>boundary.register(zoneId,{holdAtBoundary:()=>{holding.current=true;if(!current.current||((current.current.kind!=="video"||!!current.current.sitesStudioPresentation)&&current.current.onlinePlayback?.kind!=="youtube")||!ready.current||ended.current){setHeld(true);return Promise.resolve();}return new Promise<void>(resolve=>{resolver.current=resolve;});},resume:()=>{holding.current=false;setHeld(false);resolver.current?.();resolver.current=null;if(ended.current){ended.current=false;advance();}}}),[advance,boundary,zoneId]);
 useEffect(()=>{ready.current=false;ended.current=false;elapsed.current={itemId:item?.id,remainingMs:item?getPlayerItemPlaybackDurationMs(item):0};},[item?.id,attempt]);
 useEffect(()=>{if(!item||((item.kind==="video"&&!item.sitesStudioPresentation)||item.onlinePlayback?.kind==="youtube")||paused||held||!ready.current)return;const start=performance.now();const timer=window.setTimeout(advance,Math.max(1,elapsed.current.remainingMs));return()=>{window.clearTimeout(timer);elapsed.current.remainingMs=Math.max(1,elapsed.current.remainingMs-(performance.now()-start));};},[advance,held,item?.id,paused,readyVersion]);
 useEffect(()=>{if(ready.current)onFrame(zoneId,envelope.manifest.releaseId);},[envelope.target?.revision,envelope.manifest.releaseId,onFrame,zoneId]);
 if(!item)return null;
 const muted={...item,muted:true,volumePercent:0};
 return <PlaybackScene playbackAttempt={attempt} item={muted} paused={paused||held} liveMatchStates={liveMatchStates} watchdogTimeoutMs={watchdogTimeoutMs} onReady={()=>{ready.current=true;setReadyVersion(value=>value+1);onFrame(zoneId,envelope.manifest.releaseId);}} onEnded={advance} onFailure={()=>{if(holding.current){ended.current=true;setHeld(true);resolver.current?.();resolver.current=null;}else advance();}}/>;
}
