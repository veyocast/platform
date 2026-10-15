import type { MenuDocumentV2, SitesAssetReference, SitesDynamicConfiguration, SitesTvContent } from "@veyocast/contracts";
import { formatMenuMoney, resolveMenuGroupPrice, resolveMenuProductPrice } from "./menu-scene-model";

type Widget=NonNullable<SitesTvContent["menuPages"]>[number]["widgets"][number];
/** Canonical, bounded page projection shared by preview, poster and both Players. */
export function projectSitesMenuWidgets(document:MenuDocumentV2,configuration:SitesDynamicConfiguration,asset:(id:string)=>SitesAssetReference|undefined):NonNullable<SitesTvContent["menuPages"]> {
 const result:NonNullable<SitesTvContent["menuPages"]>=[];
 for(const page of [...document.pages].sort((a,b)=>a.order-b.order)) {
  const columns=configuration.orientation==="portrait"?page.portraitColumns??1:page.landscapeColumns??2;
  const blocks=page.blocks.filter(block=>!block.hidden).sort((a,b)=>a.order-b.order);
  for(let start=0;start<Math.max(1,blocks.length);) {
   const current:typeof blocks=[]; const weights:[number,number]=[0,0];
   for(const candidate of blocks.slice(start)){const column=columns===1?"full":candidate.widget?.column??"full";const left=column==="right"?0:1,right=column==="left"?0:1;if(current.length && (weights[0]+left>(configuration.orientation==="portrait"?3:2) || weights[1]+right>(configuration.orientation==="portrait"?3:2)))break;current.push(candidate);weights[0]+=left;weights[1]+=right;}
   const chunkStart=start;start+=Math.max(1,current.length);
   weights[0]=weights[1]=0;
   for(const block of current){const col=columns===1?"full":block.widget?.column??"full";if(col!=="right")weights[0]++;if(col!=="left")weights[1]++;}
   const capacity=Math.max(1,Math.floor(configuration.rowsPerPage*100/configuration.scale/Math.max(1,...weights)));
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
   const nativeWidth=configuration.orientation==="portrait"?1080:1920,nativeHeight=configuration.orientation==="portrait"?1920:1080;
   const headerLines=estimatedLines(configuration.title,nativeWidth*(1-configuration.safeArea/50),82);
   const availableHeight=nativeHeight*(1-configuration.safeArea/50)-headerLines*90-(configuration.subtitle?65:0)-110;
   const slices=widgets.map(widget=>{
    const widgetWidth=(nativeWidth*(1-configuration.safeArea/50)-(columns===2&&widget.column!=="full"?28:0))/(columns===2&&widget.column!=="full"?2:1);
    const bodyWidth=(widgetWidth-60-(widget.columns===2?34:0))/widget.columns;
    const header=(widget.title?estimatedLines(widget.title,widgetWidth-60,44*configuration.scale/100)*49*configuration.scale/100:0)+(widget.subtitle?estimatedLines(widget.subtitle,widgetWidth-60,25*configuration.scale/100)*34*configuration.scale/100+9:0)+16;
    const budget=Math.max(80,availableHeight/Math.max(1,...weights)-85-header);
    // Automatic flow fills the first column before advancing to the second.
    // Explicit placements have independent cursors so their columns stay intact.
    const pages:{rows:[Widget["rows"],Widget["rows"]];used:[number,number]}[]=[];
    const getPage=(index:number)=>pages[index]??(pages[index]={rows:[[],[]],used:[0,0]});
    const cursors=[0,0];let automaticPage=0,automaticColumn:0|1=0;
    for(const row of widget.rows){
     const textWidth=Math.max(60,bodyWidth-120-(row.image?85:0)),scale=configuration.scale/100;
     const cost=Math.max(row.image?90:0,estimatedLines(row.primary,textWidth,32*scale)*39*scale+(row.secondary?estimatedLines(row.secondary,textWidth,25*scale)*33*scale+6:0)+40);
     const fits=(index:number,column:0|1)=>{const target=getPage(index);return target.rows[column].length===0||(target.rows[column].length<capacity&&target.used[column]+cost<=budget);};
     const explicit=explicitColumns.get(row.id);
     let index:number,column:0|1;
     if(explicit){
      column=explicit===1?0:1;index=cursors[column]!;
      while(!fits(index,column))index++;
      cursors[column]=index;
     }else{
      index=automaticPage;column=automaticColumn;
      while(!fits(index,column)){
       if(widget.columns===2&&column===0)column=1;else{index++;column=0;}
      }
      automaticPage=index;automaticColumn=column;
     }
     const target=getPage(index);target.rows[column].push({...row,column:(column+1) as 1|2});target.used[column]+=cost;
    }
    return pages.length?pages.map(page=>page.rows.flat()):[[]];
   });
   const derived=Math.max(1,...slices.map(slice=>slice.length));
   for(let index=0;index<derived;index++)result.push({id:`${page.id}:${chunkStart}:${index}`,columns,widgets:widgets.map((widget,widgetIndex)=>({...widget,rows:slices[widgetIndex]?.[index]??[]}))});
  }
 }
 return result;
}

/** Conservative native-canvas line estimate; pagination keeps long copy readable. */
function estimatedLines(text:string,width:number,size:number){return Math.max(1,...text.split("\n").map(line=>Math.ceil(line.length*size*.64/Math.max(size,width))));}
