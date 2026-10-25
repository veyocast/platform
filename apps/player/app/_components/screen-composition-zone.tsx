"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {LedScoresMatchState} from "../_lib/ledscores-match-experience";
import {findFirstPlayableItemIndex,findNextPlayableItem,getPlayerItemPlaybackDurationMs,type PlayerManifestEnvelope} from "../_lib/player-manifest";
import type {ScreenCompositionBoundary} from "../_lib/screen-composition-boundary";
import {playerItemDataIdentity,screenCompositionZoneFrameIdentity} from "../_lib/player-screen-composition";
import {PlaybackScene} from "./player-runtime";

export function ScreenCompositionZone({zoneId,envelope,paused,boundary,onFrame,onDomFailure,liveMatchStates,watchdogTimeoutMs}:{zoneId:"side"|"bottom";envelope:PlayerManifestEnvelope;paused:boolean;boundary:ScreenCompositionBoundary;onDomFailure:()=>void;onFrame:(zoneId:"side"|"bottom",releaseId:string)=>void;liveMatchStates:ReadonlyMap<string,LedScoresMatchState>;watchdogTimeoutMs:number}){
 const[index,setIndex]=useState(()=>Math.max(0,findFirstPlayableItemIndex(envelope.manifest.items)));const[held,setHeld]=useState(false);const[attempt,setAttempt]=useState(0);const[readyVersion,setReadyVersion]=useState(0);
 const item=envelope.manifest.items[index]??envelope.manifest.items[0];const current=useRef(item);current.current=item;
 const dataClock=item?.menuDom?.contentHash??(item?.syncDynamic?.schemaVersion===2?item.syncDynamic.contentHash:undefined);
 const readyData=useRef<string|null>(null);
 const ready=useRef(false),ended=useRef(false),holding=useRef(false);const resolver=useRef<(()=>void)|null>(null);const elapsed=useRef({itemId:item?.id,remainingMs:item?getPlayerItemPlaybackDurationMs(item):0});
 const items=useRef(envelope.manifest.items);items.current=envelope.manifest.items;
 const advance=useCallback(()=>{if(holding.current){ended.current=true;setHeld(true);resolver.current?.();resolver.current=null;return;}const selected=findNextPlayableItem(items.current,index);if(selected){ready.current=false;ended.current=false;setAttempt(value=>value+1);setIndex(selected.index);}},[index]);
 const pageBoundary=useCallback(()=>{if(holding.current)advance();},[advance]);
 useEffect(()=>boundary.register(zoneId,{holdAtBoundary:()=>{holding.current=true;if(!current.current||((current.current.kind!=="video"||!!current.current.sitesStudioPresentation)&&current.current.onlinePlayback?.kind!=="youtube"&&!current.current.menuDom&&current.current.syncDynamic?.schemaVersion!==2)||!ready.current||ended.current){setHeld(true);return Promise.resolve();}return new Promise<void>(resolve=>{resolver.current=resolve;});},resume:()=>{holding.current=false;setHeld(false);resolver.current?.();resolver.current=null;if(ended.current){ended.current=false;advance();}}}),[advance,boundary,zoneId]);
 useEffect(()=>{ready.current=false;ended.current=false;elapsed.current={itemId:item?.id,remainingMs:item?getPlayerItemPlaybackDurationMs(item):0};},[item?.id,dataClock,attempt]);
 useEffect(()=>{if(!item||((item.kind==="video"&&!item.sitesStudioPresentation)||item.onlinePlayback?.kind==="youtube")||paused||held||!ready.current)return;const start=performance.now();const timer=window.setTimeout(advance,Math.max(1,elapsed.current.remainingMs));return()=>{window.clearTimeout(timer);elapsed.current.remainingMs=Math.max(1,elapsed.current.remainingMs-(performance.now()-start));};},[advance,held,item?.id,paused,readyVersion]);
 useEffect(()=>{if(ready.current&&item&&readyData.current===playerItemDataIdentity(item))onFrame(zoneId,screenCompositionZoneFrameIdentity(envelope));},[envelope,envelope.target?.revision,item,onFrame,zoneId]);
 if(!item)return null;
 const muted={...item,muted:true,volumePercent:0};
 return <PlaybackScene onBoundary={pageBoundary} playbackAttempt={attempt} item={muted} paused={paused||held} liveMatchStates={liveMatchStates} watchdogTimeoutMs={watchdogTimeoutMs} onReady={()=>{readyData.current=playerItemDataIdentity(item);ready.current=true;setReadyVersion(value=>value+1);onFrame(zoneId,screenCompositionZoneFrameIdentity(envelope));}} onEnded={advance} onFailure={(_id,code)=>{if(code==='SYNC_DOM_ERROR'){onDomFailure();return;}if(holding.current){ended.current=true;setHeld(true);resolver.current?.();resolver.current=null;}else advance();}}/>;
}
