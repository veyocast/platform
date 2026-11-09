import {describe,expect,it,vi} from "vitest";
import {ScreenCompositionBoundary,changedCompositionDataBoundaryZones} from "./screen-composition-boundary";
import {demoOnlineDeviceToken,getPlayerManifestForToken} from "./player-manifest";

function compositionFixture(){
 const result=getPlayerManifestForToken(demoOnlineDeviceToken);if(!result.ok)throw Error("Existing fixture missing");
 const main=structuredClone(result.body),side=structuredClone(result.body),bottom=structuredClone(result.body);
 for(const [index,envelope]of [main,side,bottom].entries()){
  envelope.manifest.items=[envelope.manifest.items[0]!];
  envelope.manifest.items[0]!.dynamicTemplate={schemaVersion:1,snapshotId:'10000000-0000-4000-8000-000000000295',templateVersionId:'20000000-0000-4000-8000-000000000295',snapshotHash:String(index+1).repeat(64),templateSlug:'historical-news',orientation:'landscape',slideType:'news',data:{},assets:{}};
 }
 const envelopes=[main,side,bottom],ids=['main','side','bottom']as const;
 main.composition={published:{id:'10000000-0000-4000-8000-000000000297',revision:1,configuration:{schemaVersion:1,layout:'three',orientation:'landscape',mainWidthPercent:70,bottomHeightPercent:20,zones:ids.map((id,index)=>({id,playlistId:envelopes[index]!.manifest.playlistId}))},bindings:ids.map((zoneId,index)=>({zoneId,playlistId:envelopes[index]!.manifest.playlistId,releaseId:envelopes[index]!.manifest.releaseId,publicationId:'10000000-0000-4000-8000-000000000298',configRevision:1}))},zones:{side,bottom}};
 return main;
}
describe("composition activation boundary",()=>{
 it("distinguishes accepted data from a cancelled hold when resuming renderer clocks",()=>{const boundary=new ScreenCompositionBoundary(),resume=vi.fn();boundary.register("side",{holdAtBoundary:async()=>{},resume});boundary.resumeAll(true);expect(resume).toHaveBeenLastCalledWith(true);boundary.resumeAll();expect(resume).toHaveBeenLastCalledWith(false);});
 it("waits for all healthy video zone boundaries while images hold their last frame",async()=>{const boundary=new ScreenCompositionBoundary();let finish!:()=>void;const imageResume=vi.fn();boundary.register("side",{holdAtBoundary:()=>new Promise<void>(resolve=>{finish=resolve;}),resume:vi.fn()});boundary.register("bottom",{holdAtBoundary:async()=>{},resume:imageResume});let completed=false;const result=boundary.holdAll(new AbortController().signal).then(value=>{completed=value;return value;});await Promise.resolve();expect(completed).toBe(false);finish();expect(await result).toBe(true);expect(imageResume).not.toHaveBeenCalled();boundary.resumeAll();expect(imageResume).toHaveBeenCalledOnce();});
 it("cancels obsolete prepared targets and resumes existing healthy playback",async()=>{const boundary=new ScreenCompositionBoundary();const resume=vi.fn();boundary.register("side",{holdAtBoundary:()=>new Promise(()=>{}),resume});const signal=new AbortController();const result=boundary.holdAll(signal.signal);signal.abort();expect(await result).toBe(false);expect(resume).toHaveBeenCalledOnce();expect(await boundary.holdAll(signal.signal)).toBe(false);});
 it("leaves an unchanged zone's running occurrence untouched during another zone's data boundary",async()=>{
  const boundary=new ScreenCompositionBoundary(),unchanged={holdAtBoundary:vi.fn(async()=>{}),resume:vi.fn()},changed={holdAtBoundary:vi.fn(async()=>{}),resume:vi.fn()};
  boundary.register("side",unchanged);boundary.register("bottom",changed);
  expect(await boundary.holdZones(["bottom"],new AbortController().signal)).toBe(true);boundary.resumeZones(["bottom"],true);
  expect(changed.holdAtBoundary).toHaveBeenCalledOnce();expect(changed.resume).toHaveBeenCalledWith(true);expect(unchanged.holdAtBoundary).not.toHaveBeenCalled();expect(unchanged.resume).not.toHaveBeenCalled();
 });
 it("does not hold side or bottom for main-only facts or signed access renewal",()=>{
  const before=compositionFixture(),after=structuredClone(before);after.manifest.items[0]!.dynamicTemplate!.snapshotHash='f'.repeat(64);after.composition!.zones.side!.manifest.items[0]!.source.url='https://media.example/renewed.png';
  expect(changedCompositionDataBoundaryZones(before,after)).toEqual([]);
 });
 it("selects only the independently changed side or bottom facts",()=>{
  const before=compositionFixture(),after=structuredClone(before);after.composition!.zones.side!.manifest.items[0]!.dynamicTemplate!.snapshotHash='f'.repeat(64);
  expect(changedCompositionDataBoundaryZones(before,after)).toEqual(["side"]);after.composition!.zones.bottom!.manifest.items[0]!.dynamicTemplate!.snapshotHash='e'.repeat(64);expect(changedCompositionDataBoundaryZones(before,after)).toEqual(["side","bottom"]);
 });
 it("retains every-zone publication boundaries for a new release or composition revision",()=>{
  const before=compositionFixture(),after=structuredClone(before);after.manifest.releaseId='10000000-0000-4000-8000-000000000299';expect(changedCompositionDataBoundaryZones(before,after)).toBeNull();after.manifest.releaseId=before.manifest.releaseId;after.composition!.published.revision++;expect(changedCompositionDataBoundaryZones(before,after)).toBeNull();
 });
});
