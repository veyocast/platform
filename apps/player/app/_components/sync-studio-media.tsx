"use client";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isSyncOnzeTrotsPresentation,syncSlidePageCount, syncSlideRendererAssets, syncBackgroundAssetForRef, syncSlideTransition,type SyncSlidePresentation } from "@veyocast/contracts";
import { SyncSlideStaticView,measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout,projectSyncOnzeTrotsMotion,applySyncOnzeTrotsMotion,advanceSyncOnzeTrotsTime } from "@veyocast/content-templates/sync-slide-static-view";
import type { PlayerManifestItem } from "../_lib/player-manifest";
import {hasVisibleSyncDomFrame}from"../_lib/sync-dom-frame";
import { supportsSyncOnzeTrotsV9,supportsSyncSlideDom,supportsSyncOnzeTrots } from "../_lib/sync-player-capabilities";
import type {LedScoresMatchState} from '../_lib/ledscores-match-experience';
import {projectSyncLiveMatch,selectSyncLiveMatchState} from '../_lib/sync-live-match';
import {
  syncPreparedCss,
  syncPreparedPresentation,
  syncPlaybackFrame,
  syncPlayerContent,
  prepareSyncBackgroundFonts,
  prepareSyncOnzeTrotsFonts,
} from "../_lib/sync-player-presentation";

/** A complete verified binary remains available on unsupported or failed DOM playback. */
export function SyncStudioMedia({
  item,
  onReady,
  fallback,
  passive = false,
  paused = false,
  onEnded,
  liveMatchStates,
  presentationOverride,iteration=0,
}: {
  item: PlayerManifestItem;
  onReady: (id: string) => void;
  fallback: ReactNode;
  passive?: boolean;
  paused?: boolean;
  onEnded?: (id:string)=>void;
  liveMatchStates?: ReadonlyMap<string,LedScoresMatchState>;
  presentationOverride?: SyncSlidePresentation;
  iteration?:number;
}) {
  const root = useRef<HTMLDivElement>(null),
    readyCallback=useRef(onReady),
    endedCallback=useRef(onEnded),
    endReported=useRef(false),
    elapsed = useRef(0),
    introFinished=useRef(false),scenePage=useRef(0),
    [page, setPage] = useState(0),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(passive),
    [frameReported, setFrameReported] = useState(false),
    [viewport,setViewport] = useState({width:0,height:0});
  const liveState=useRef<LedScoresMatchState|null>(null),[matchNow,setMatchNow]=useState(0);
  readyCallback.current=onReady;
  endedCallback.current=onEnded;
  const content=useMemo(()=>syncPlayerContent(item),[item]),presentation = content?.presentation,
    origin = typeof location === "undefined" ? "" : location.origin;
  // Canonical data revisions and fresh object instances do not change the
  // verified local resources. Only a changed resource requires font/image prep.
  const preparationIdentity=JSON.stringify([presentation?.rendererVersion,
    Object.entries(item.syncSystemAssetUrls??{}).sort(([a],[b])=>a<b?-1:a>b?1:0),
    Object.entries(content?.assets??{}).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,asset])=>[id,asset.checksumSha256,asset.mimeType,asset.bytes,asset.url])]);
  const binding=item.syncDynamic?.liveMatch;
  liveState.current=selectSyncLiveMatchState(binding,liveState.current,binding?liveMatchStates?.get(binding.connectionId):undefined);
  const displayPresentation=presentationOverride??(presentation?projectSyncLiveMatch(presentation,liveState.current,binding?.showClock??false,matchNow||Date.now()):undefined);
  useEffect(()=>{
    if(!binding||passive||paused)return;
    setMatchNow(Date.now());
    const timer=window.setInterval(()=>setMatchNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[binding?.connectionId,passive,paused]);
  const supported =
    supportsSyncSlideDom() && (!isSyncOnzeTrotsPresentation(presentation)||(presentation.rendererVersion==='sync-onzetrots-v9'?supportsSyncOnzeTrotsV9():supportsSyncOnzeTrots())) && syncPreparedPresentation(item, origin);
  const hasNaturalBoundary=(item.kind==='video'||Boolean(item.syncDynamic))&&onEnded!==undefined;
  const pages = presentation ? syncSlidePageCount(presentation) : 1,
    transition=presentation?syncSlideTransition(presentation):null,
    loopMs = Math.max(content?.durationMs??3000,item.syncDynamic&&item.kind==='image'&&pages===1?item.durationSeconds*1000:0),
    perPageMs = loopMs / pages;
  const size=syncPlaybackFrame(item,viewport);
  const css = useMemo(() => {
    try {
      return supported
        ? syncPreparedCss(item.syncSystemAssetUrls!, origin,presentation)
        : "";
    } catch {
      return "";
    }
  }, [supported, item.syncSystemAssetUrls, origin,presentation]);
  useEffect(() => {
    if (!supported || !css || !root.current) return;
    const element = root.current;
    const resize = () => {
      setViewport({width:element.clientWidth,height:element.clientHeight});
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [supported, css, presentation?.orientation]);
  useEffect(() => {
    if (!supported || !css || passive) return;
    let stopped = false,
      first = 0,
      second = 0;
    const timer = window.setTimeout(() => {
      if (!stopped) {
        stopped = true;
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
        fonts?.dispose();
        setFailed(true);
      }
    }, 5000);
    const background = syncBackgroundAssetForRef(presentation?.style.backgroundAsset);
    const fonts = isSyncOnzeTrotsPresentation(presentation)?prepareSyncOnzeTrotsFonts(item.syncSystemAssetUrls!,origin,presentation):background ? prepareSyncBackgroundFonts(item.syncSystemAssetUrls!, origin) : null;
    const images = [...new Set([
      ...(presentation?syncSlideRendererAssets(presentation):[])
        .filter((asset) => asset.mimeType.startsWith("image/"))
        .map((asset) => item.syncSystemAssetUrls![asset.path]!),
      ...Object.values(content?.assets ?? {}).map((asset) => asset.url),
    ])];
    void Promise.all([
      ...images.map((url) => {
        const image = new Image();
        image.src = url;
        return image.decode();
      }),
      ...(fonts ? [fonts.ready] : [
        "700 16px Inter",
        "700 16px Manrope",
        '700 16px "OnzeTrots Brush"',
      ].map((font) =>
        document.fonts.load(font).then((faces) => {
          if (!faces.length || faces.some((face) => face.status !== "loaded"))
            throw Error("SYNC_FONT_NOT_LOADED");
        }),
      )),
    ])
      .then(() => fonts ? undefined : document.fonts.ready)
      .then(() => {
        if (stopped) return;
        setReady(true);
        const reportVisibleFrame = () => {
          if (stopped) return;
          const frame =
              root.current?.querySelector<HTMLElement>(".vc-slide-preview"),
            animated=root.current?.querySelector<HTMLElement>('.sync-slide-animated'),
            box = frame?.getBoundingClientRect();
          if (
            (item.syncDynamic?.schemaVersion!==2||hasVisibleSyncDomFrame(root.current,presentation?.rendererVersion??''))&&
            frame &&
            box &&
            box.width > 0 &&
            box.height > 0 &&
            (!animated||Number(getComputedStyle(animated).opacity)>0)&&
            (presentation?.rendererVersion!=='sync-onzetrots-v9'||Number(getComputedStyle(frame.querySelector('.screen')!,'::before').opacity)>0)&&
            getComputedStyle(frame).visibility === "visible"
          ) {
            window.clearTimeout(timer);
            setFrameReported(true);
            readyCallback.current(item.id);
          } else first = requestAnimationFrame(reportVisibleFrame);
        };
        first = requestAnimationFrame(() => {
          second = requestAnimationFrame(reportVisibleFrame);
        });
      })
      .catch(() => {
        if (!stopped) {
          window.clearTimeout(timer);
          stopped = true;
          fonts?.dispose();
          setFailed(true);
        }
      });
    return () => {
      stopped = true;
      fonts?.dispose();
      window.clearTimeout(timer);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [
    supported,
    css,
    item.id,
    preparationIdentity,
    passive,
  ]);
  useEffect(() => {
    if (isSyncOnzeTrotsPresentation(presentation)||!frameReported || failed || paused || passive || endReported.current || (pages < 2 && !hasNaturalBoundary)) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - last;
      last = now;
      if(hasNaturalBoundary&&endedCallback.current&&elapsed.current>=loopMs){
        endReported.current=true;
        window.clearInterval(timer);
        endedCallback.current(item.id);
        return;
      }
      setPage(Math.floor((elapsed.current % loopMs) / perPageMs));
    }, 100);
    return () => window.clearInterval(timer);
  }, [frameReported, failed, paused, passive, pages, loopMs, perPageMs,item.kind,item.id,hasNaturalBoundary,presentation,iteration]);
  useLayoutEffect(()=>{elapsed.current=0;endReported.current=false;introFinished.current=false;scenePage.current=0;setPage(0);},[item.id,item.syncDynamic?.contentHash,iteration]);
  useLayoutEffect(()=>{
    const element=root.current;if(!isSyncOnzeTrotsPresentation(presentation)||!element||!ready||failed)return;
    const panelCount=presentation.rendererVersion==='sync-onzetrots-v9'?measureSyncOnzeTrotsV9Layout(element):0;
    const layouts=measureSyncOnzeTrotsLayout(element),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let previous:number|null=null,animation=0;
    const frame=(now:number)=>{
      const running=(frameReported||presentation.rendererVersion==='sync-onzetrots-v9'&&ready)&&!paused&&!passive&&!document.hidden&&!endReported.current;
      elapsed.current=advanceSyncOnzeTrotsTime(elapsed.current,previous,now,running);
      previous=running?now:null;
      if(hasNaturalBoundary&&running&&elapsed.current>=loopMs){endReported.current=true;endedCallback.current?.(item.id);return;}
      const local=elapsed.current%loopMs,currentPage=Math.floor(local/perPageMs);
      if(scenePage.current!==currentPage){scenePage.current=currentPage;introFinished.current=false;}
      setPage(before=>before===currentPage?before:currentPage);
      const internal=Math.max(0,local-currentPage*perPageMs);
      const scene=presentation.rendererVersion==='sync-onzetrots-v9'?{panelCount,mode:presentation.visual.mode,paused:paused||passive,introFinished:introFinished.current,entranceAllowed:presentation.style.motion!=='geen'}:undefined;
      const projected=projectSyncOnzeTrotsMotion(internal,layouts,presentation.visual.scrollSpeed,reduced.matches,scene);
      if(projected.entrance&&!passive)introFinished.current=projected.entrance.finished;
      applySyncOnzeTrotsMotion(projected,element);
      if(!passive)animation=requestAnimationFrame(frame);
    };
    frame(performance.now());return()=>cancelAnimationFrame(animation);
  },[presentation,ready,frameReported,failed,paused,passive,page,loopMs,perPageMs,hasNaturalBoundary,item.id,transition?.durationMs,iteration]);
  if (!supported || !css || failed || !presentation) return fallback;
  return (
    <div
      className="playback-media playback-sync"
      data-sync-page={page}
      data-sync-ready={ready}
      data-sync-content-hash={item.syncDynamic?.contentHash}
      ref={root}
      style={{
        width: "100%",
        height: "100%",
        position:'relative',
        overflow:'hidden',
        backgroundColor:size.backgroundColor,
      }}
    >
      <style>{css}</style>
      <style>{`@keyframes veyocast-sync-slide-enter{from{opacity:0;transform:translateY(var(--sync-slide-offset))}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.playback-sync .sync-slide-animated{animation:none!important}}`}</style>
      <div
        className="sync-slide-frame"
        style={{
          position:'absolute',
          left:size.left,
          top:size.top,
          width: size.width,
          height: size.height,
          visibility: ready && size.width > 0 ? "visible" : "hidden",
          containerType: "inline-size",
        }}
      >
        <div key={`${page}-${ready}`} className="sync-slide-animated" style={{width:'100%',height:'100%',...(transition&&ready&&!passive?{animation:`veyocast-sync-slide-enter ${transition.durationMs}ms ${transition.easing} both`,animationPlayState:paused?'paused':'running','--sync-slide-offset':`${transition.offsetPx}px`}:{} )} as React.CSSProperties}>
        <SyncSlideStaticView
          presentation={displayPresentation!}
          page={page % pages}
          includeStyles={false}
          resolveAsset={(asset) =>
            asset.kind === "system"
              ? item.syncSystemAssetUrls?.[asset.path]
              : content?.assets?.[asset.mediaAssetId]?.url
          }
        />
        </div>
      </div>
    </div>
  );
}
