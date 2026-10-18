import { describe, expect, it } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import { maximumPlaylistPlacementSeconds, parsePlaylistBatchJournal, planPlaylistChanges, playlistBatchJournalKey, preparePlaylistBatchJournal, refreshMediaFramePlacement, validatePlaylistPlan } from "./playlist-command-plan";
import type { MediaFramePlacementVersion, Playlist, Slide } from "./model";

const id = (n:number) => `19170000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tenant=id(10), actor=id(1), frame=id(20), asset=id(30);
const settings=()=>mediaFrameDefaultSettings({kind:"video",title:"Versie één",durationSeconds:601});
const version=(n:number):MediaFramePlacementVersion=>({id:id(n),number:n,settings:{...settings(),name:`Versie ${n}`,durationSeconds:n===1?601:901,focus:"right",fitMode:"contain"},mediaAssetId:asset,checksumSha256:"a".repeat(64),image:"https://private.example.test/temporary-preview",kind:"video"});
const slide=():Slide=>({id:id(100),name:"Versie 1",seconds:601,kind:"video",mediaId:asset,image:"https://private.example.test/temporary-preview",mediaFrame:{frameId:frame,pinnedVersionId:id(1),pinnedVersionNumber:1,selected:version(1),current:version(2),overrides:{},fitMode:"cover",cropFocusX:0.5,cropFocusY:0.5,backgroundColor:null}});
const playlist=(item:Slide):Playlist=>({id:id(500),name:"Eigen playlist",description:"",updated:"",status:"Concept",slides:[item]});
const scope={tenantId:tenant,actorScope:`${tenant}:${actor}`,playlistId:id(500)};
const batch=()=>validatePlaylistPlan(scope.playlistId,7,id(600),[{operation:"refresh_media_frame",itemId:id(100),expectedPinnedVersionId:id(1),versionId:id(2)}]);

describe("explicit immutable media frame refresh",()=>{
  it("changes unoverridden defaults without writing old duration or title back as overrides",()=>{
    const original=slide(),next=refreshMediaFramePlacement(original);
    expect(next).toMatchObject({name:"Versie 2",seconds:901,mediaFrame:{pinnedVersionId:id(1),pinnedVersionNumber:1,selected:{id:id(2)},fitMode:"contain",cropFocusX:1,cropFocusY:0.5}});
    expect(planPlaylistChanges(playlist(original),playlist(next),new Map())).toEqual([{operation:"refresh_media_frame",itemId:original.id,expectedPinnedVersionId:id(1),versionId:id(2)}]);
    expect(original.mediaFrame!.selected.id).toBe(id(1));expect(original.seconds).toBe(601);
  });
  it("preserves explicit placement preferences, including same-value user intent",()=>{
    const original=slide();original.mediaFrame!.overrides={durationSeconds:true,displayTitle:true,fitMode:true,cropFocusX:true};
    const edited={...original,mediaFrame:{...original.mediaFrame!,edits:{durationSeconds:601,displayTitle:original.name}}};
    const next=refreshMediaFramePlacement(edited);
    expect(next).toMatchObject({seconds:601,name:original.name,mediaFrame:{fitMode:"cover",cropFocusX:0.5}});
    expect(planPlaylistChanges(playlist(original),playlist(next),new Map())).toEqual([
      {operation:"refresh_media_frame",itemId:original.id,expectedPinnedVersionId:id(1),versionId:id(2)},
      {operation:"patch",itemId:original.id,patch:{durationSeconds:601,displayTitle:original.name}},
    ]);
  });
  it("does not infer a refresh from an unchanged placement or a newer library version alone",()=>{
    const original=slide();expect(planPlaylistChanges(playlist(original),structuredClone(playlist(original)),new Map())).toEqual([]);
  });
  it.each([null,{...version(2),number:1}])("cannot choose an unavailable or non-newer version",current=>{
    const original=slide();original.mediaFrame!.current=current;expect(()=>refreshMediaFramePlacement(original)).toThrow();
  });
  it("refuses a selected version that is no longer the explicitly verified current version",()=>{
    const original=slide(),next=refreshMediaFramePlacement(original);next.mediaFrame!.current=version(3);
    expect(()=>planPlaylistChanges(playlist(original),playlist(next),new Map())).toThrow("actuele media-ontwerpversie");
  });
  it("adds a frame by logical frame/version identities without creating an asset or a default override",()=>{
    const chosen=slide();const empty={...playlist(chosen),slides:[]};
    const ops=planPlaylistChanges(empty,playlist(chosen),new Map([[chosen.id,chosen]]));
    expect(ops).toEqual([{operation:"add_media_frame",clientId:chosen.id,frameId:frame,expectedVersionId:id(1)},{operation:"reorder",itemIds:[chosen.id]}]);
  });
  it("duplicates the placement binding before explicitly refreshing only its copy",()=>{
    const original=slide(),copy=refreshMediaFramePlacement({...structuredClone(original),id:id(101),duplicateOf:original.id});
    const after={...playlist(original),slides:[original,copy]};
    const ops=planPlaylistChanges(playlist(original),after,new Map([[copy.id,copy]]));
    expect(ops.slice(0,2)).toEqual([{operation:"duplicate",clientId:copy.id,itemId:original.id},{operation:"refresh_media_frame",itemId:copy.id,expectedPinnedVersionId:id(1),versionId:id(2)}]);
    expect(ops.some(op=>op.operation==="replace_media"||op.operation==="patch")).toBe(false);
  });
  it("retains real long rawmedia duration while preserving old non-frame presenter bounds",()=>{
    expect(maximumPlaylistPlacementSeconds(slide())).toBe(3600);
    expect(maximumPlaylistPlacementSeconds({...slide(),mediaFrame:undefined})).toBe(180);
  });
});

describe("durable exact batch journal",()=>{
  it("recovers the exact original nonce/revision/operations without a private preview URL",()=>{
    const original=batch(),journal=preparePlaylistBatchJournal(scope,original),raw=JSON.stringify(journal);
    expect(raw).not.toContain("https:");expect(raw).not.toContain("image");
    const restored=parsePlaylistBatchJournal(raw,scope);
    expect(restored.command).toEqual(original);expect(restored.command.expectedRevision).toBe(7);expect(restored.command.idempotencyKey).toBe(id(600));
    expect(restored.command.operations).toEqual([{operation:"refresh_media_frame",itemId:id(100),expectedPinnedVersionId:id(1),versionId:id(2)}]);
  });
  it.each([
    {...scope,actorScope:`${tenant}:${id(2)}`},
    {...scope,tenantId:id(11),actorScope:`${id(11)}:${actor}`},
    {...scope,playlistId:id(501)},
  ])("cannot restore an original action into another actor, tenant or playlist",other=>{
    expect(playlistBatchJournalKey(other)).not.toBe(playlistBatchJournalKey(scope));
    expect(()=>parsePlaylistBatchJournal(JSON.stringify(preparePlaylistBatchJournal(scope,batch())),other)).toThrow();
  });
  it("validates the command playlist independently of the storage key",()=>{
    expect(()=>preparePlaylistBatchJournal(scope,{...batch(),playlistId:id(501)})).toThrow("andere playlist");
  });
  it("rejects unknown URL-bearing journal fields and malformed or oversized recovery data",()=>{
    const journal=preparePlaylistBatchJournal(scope,batch());
    expect(()=>parsePlaylistBatchJournal(JSON.stringify({...journal,previewUrl:"https://private.example.test/secret"}),scope)).toThrow();
    expect(()=>parsePlaylistBatchJournal("not-json",scope)).toThrow();
    expect(()=>parsePlaylistBatchJournal("x".repeat(300001),scope)).toThrow();
    expect(()=>preparePlaylistBatchJournal({...scope,actorScope:""},batch())).toThrow();
  });
});
