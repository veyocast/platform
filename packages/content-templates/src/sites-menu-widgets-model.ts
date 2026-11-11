import type { MenuDocumentV2, SitesAssetReference, SitesDynamicConfiguration, SitesTvContent } from "@veyocast/contracts";
import { formatMenuMoney, resolveMenuGroupPrice, resolveMenuProductPrice } from "./menu-scene-model";

type Widget=NonNullable<SitesTvContent["menuPages"]>[number]["widgets"][number];
/** Canonical, bounded page projection shared by preview, poster and both Players. */
export function projectSitesMenuWidgets(document:MenuDocumentV2,configuration:SitesDynamicConfiguration,asset:(id:string)=>SitesAssetReference|undefined):NonNullable<SitesTvContent["menuPages"]> {
 const result:NonNullable<SitesTvContent["menuPages"]>=[];
 for(const page of [...document.pages].sort((a,b)=>a.order-b.order)) {
  const columns=configuration.orientation==="portrait"?page.portraitColumns??1:page.landscapeColumns??2;
  const blocks=page.blocks.filter(block=>!block.hidden).sort((a,b)=>a.order-b.order);
  {
   const current=blocks;
   const explicitColumns=new Map<string,1|2>();
   const widgets:Widget[]=current.map(block=>{
    const common={id:block.id,column:columns===1?"full" as const:block.widget?.column??"full",columns:1 as 1|2,title:"",rows:[] as Widget["rows"]};
    if(block.type==="category") {
     const count=block.columns??1,nodes=[...block.productNodes].sort((a,b)=>a.order-b.order);
     const rows=nodes.map(node=>{
      const column=count===1?1:node.kind==="product"&&node.column?node.column:1;
      if(node.kind==="product"&&node.column&&count===2)explicitColumns.set(node.id,node.column);
      if(node.kind==="product")return {id:node.id,column:column as 1|2,primary:node.nameOverride??node.snapshotFallback.name,secondary:node.secondaryLineItems?.map(line=>line.kind==="free-text"?line.label:line.labelOverride??line.snapshotFallback.variantLabel??line.snapshotFallback.name).join(" · ")||node.snapshotFallback.variantLabel||"",value:formatMenuMoney(resolveMenuProductPrice(node)),image:asset(node.mediaOverrideAssetId??node.snapshotFallback.imageAssetId??"")};
      return {id:node.id,column:column as 1|2,primary:node.title,secondary:node.secondaryLineItems.map(line=>line.kind==="free-text"?line.label:line.labelOverride??line.snapshotFallback.variantLabel??line.snapshotFallback.name).join(" · "),value:resolveMenuGroupPrice(node),image:asset(node.imageAssetId??"")};
     });
     return {...common,type:"category" as const,columns:count,title:block.headingVisible===false?"":block.labelOverride??block.source.sourceName,subtitle:block.subtitle??"",rows};
    }
    if(block.type==="product-group")return {...common,type:"category" as const,rows:[{id:block.group.id,column:1 as const,primary:block.group.title,secondary:block.group.secondaryLineItems.map(line=>line.kind==="free-text"?line.label:line.labelOverride??line.snapshotFallback.name).join(" · "),value:resolveMenuGroupPrice(block.group)}]};
    if(block.type==="image"||block.type==="logo"||block.type==="video")return {...common,type:"image" as const,image:asset(block.type==="video"?block.playback.posterAssetId??block.assetId:block.assetId),title:block.type==="image"?block.caption??"":"",aspectRatio:block.widget?.aspectRatio??"16:9",fit:block.type==="image"?block.appearance.fit:"contain" as const};
    if(block.type==="promo")return {...common,type:"promo" as const,title:block.title,subtitle:block.body??"",image:asset(block.assetId??"")};
    return {...common,type:"text" as const,title:block.text};
   });
   result.push({id:`${page.id}:0:0`,columns,widgets:widgets.map(widget=>({...widget,rows:widget.rows.map((row,index)=>({...row,column:widget.columns===1?1:explicitColumns.get(row.id)??(index<Math.ceil(widget.rows.length/2)?1:2)}))}))});
  }
 }
 return result;
}
