import{describe,expect,it}from"vitest";
import{contentFormat,contentPlacementOperations,readContentPlacement,type ContentItem}from"./model";
const id=(n:number)=>`22600000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const item=(patch:Partial<ContentItem>):ContentItem=>({id:id(1),key:"studio:"+id(1),title:"Ontwerp",kind:"studio",family:"free",status:"ready",archived:false,orientation:"landscape",duration:12,width:1920,height:1080,preview:null,href:"/dashboard/studio/"+id(1),placement:{kind:"media",assetId:id(2)},...patch});
describe("content selection to existing guarded playlist batch",()=>{
 it("uses verified media dimensions rather than assuming every landscape file is 16:9",()=>{
  expect(contentFormat(item({kind:"media",width:1600,height:1200}))).toBe("4:3");
  expect(contentFormat(item({kind:"media",width:1080,height:1920}))).toBe("9:16");
  for(const dimensions of[{width:null,height:null},{width:0,height:1080},{width:1920,height:-1},{width:1.5,height:1}])expect(contentFormat(item({kind:"media",...dimensions}))).toBe("Formaat nog onbekend");
  expect(contentFormat(item({kind:"studio",orientation:"portrait",width:null,height:null}))).toBe("9:16");
 });
 it("preserves mixed selection order, immutable snapshot identity and every series member",()=>{
  let sequence=100;
  const operations=contentPlacementOperations([item({}),item({id:id(3),placement:{kind:"dynamic",snapshotId:id(4)},duration:19}),item({id:id(5),placement:{kind:"series",memberCount:3,revision:8}})],()=>id(sequence++));
  expect(operations).toEqual([{operation:"add_media",clientId:id(100),mediaAssetId:id(2),durationSeconds:12},{operation:"add_dynamic",clientId:id(101),dynamicSlideId:id(3),expectedSnapshotId:id(4),durationSeconds:19},{operation:"add_studio_series",clientId:id(102),clientItemIds:[id(102),id(103),id(104)],seriesId:id(5),expectedSeriesRevision:8}]);
 });
 it("rejects the entire selection when a saved draft has no current verified output",()=>{
  expect(()=>contentPlacementOperations([item({}),item({placement:null,title:"Nog een concept"})],()=>id(10))).toThrow(/Nog een concept is nog niet gereed/);
  expect(()=>contentPlacementOperations([item({archived:true})],()=>id(10))).toThrow(/nog niet gereed/);
 });
 it("does not accept malformed or oversized placement metadata as ready content",()=>{
  for(const value of[null,[],{kind:"media",assetId:"not-an-id"},{kind:"dynamic",snapshotId:15},{kind:"series",memberCount:21,revision:1},{kind:"series",memberCount:1,revision:0}])expect(readContentPlacement(value)).toBeNull();
 });
});
