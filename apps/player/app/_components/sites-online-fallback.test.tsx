import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach,describe,expect,it,vi} from "vitest";
import {studioSitesSystemTemplates} from "../../../../packages/studio/src/index";
import {PlaybackMedia} from "./player-runtime";
import {YouTubePlaybackMedia} from "./youtube-playback-media";
import {EngagePlaybackMedia} from "./engage-playback-media";
import type {PlayerManifestItem} from "../_lib/player-manifest";

const presentation=studioSitesSystemTemplates.find(value=>value.id==="sites-v11-tv-programma-landscape-hd")!.document.sitesPresentation!;
if(presentation.kind!=="studio")throw new Error("Studio fixture is unavailable");
const base:PlayerManifestItem={id:"10000000-0000-4000-8000-000000191261",kind:"image",title:"Verified release fallback",durationSeconds:30,fitMode:"contain",muted:true,transition:"cut",sitesStudioPresentation:{...presentation,slide:{...presentation.slide,title:"Immutable TV fallback",tv:{...presentation.slide.tv!,title:"Immutable TV fallback",rows:[{id:"row-1",primary:"Tenant club",home:"Tenant club",away:"Other club"}]}}},source:{url:"blob:verified-fallback",bytes:100,checksumSha256:"a".repeat(64),mimeType:"image/png"}};
const youtube:PlayerManifestItem={...base,onlinePlayback:{kind:"youtube",videoId:"abcdefghijk",title:"Official video",privacyEnhanced:true}};
const engage:PlayerManifestItem={...base,onlinePlayback:{kind:"engage",publicId:"30000000-0000-4000-8000-000000191261",question:"Live campaign question",title:"Live campaign"}};
const callbacks={onEnded:()=>undefined,onFailure:()=>undefined,onReady:()=>undefined,watchdogTimeoutMs:10000};

describe("frozen Sites presentation as an online-source fallback",()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it("preserves the online source components ahead of the frozen Studio renderer",()=>{
  expect(PlaybackMedia({item:youtube,...callbacks}).type).toBe(YouTubePlaybackMedia);
  expect(PlaybackMedia({item:engage,...callbacks}).type).toBe(EngagePlaybackMedia);
 });
 it("keeps the official YouTube host while the online video is available",()=>{
  vi.stubGlobal("navigator",{onLine:true});
  const html=renderToStaticMarkup(<PlaybackMedia item={youtube} {...callbacks}/>);
  expect(html).toContain("playback-youtube");
  expect(html).not.toContain("Immutable TV fallback");
  expect(html).not.toContain("blob:verified-fallback");
 });
 it("renders the same canonical Studio TV document for offline YouTube playback",()=>{
  const html=renderToStaticMarkup(<PlaybackMedia item={youtube} passive {...callbacks}/>);
  expect(html).toContain("Immutable TV fallback");
  expect(html).toContain("Tenant club");
  expect(html).toContain("playback-sites");
  expect(html).not.toContain("playback-youtube");
 });
 it("uses the frozen TV document while the Engage campaign has not arrived",()=>{
  const html=renderToStaticMarkup(<PlaybackMedia item={engage} passive {...callbacks}/>);
  expect(html).toContain("Immutable TV fallback");
  expect(html).toContain("Tenant club");
  expect(html).not.toContain("engage-playback__results");
 });
});
