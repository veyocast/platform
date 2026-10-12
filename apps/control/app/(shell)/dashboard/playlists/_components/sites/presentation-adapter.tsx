"use client";
import { SitesPresentationView, sitesPresentationPages } from "@veyocast/content-templates/sites-presentation";
export { AssetImage } from "@veyocast/content-templates/sites-media";
export type { DynamicDesign, StudioProject } from "./model";
import type { DynamicDesign, StudioSlide } from "./model";
import { buildSitesPresentationFromDynamicPayload, resolveSitesDynamicAsset } from "@veyocast/content-templates/sites-dynamic-projector";

export function studioSlidePages(slide:StudioSlide) { return sitesPresentationPages(slide.presentation); }
export function SlideCanvas({slide}:{slide:StudioSlide}) {
  return <SitesPresentationView presentation={{...slide.presentation,slide:{...slide.presentation.slide,themeId:slide.themeId,duration:slide.duration}}} compact resolveAsset={asset=>asset.kind==="system"?asset.path:slide.assetUrls[asset.mediaAssetId]}/>;
}
export function ExperiencePreview({design,compact=false}:{design:DynamicDesign;compact?:boolean}) {
  const presentation=buildSitesPresentationFromDynamicPayload(design.payload,{...design.sitesConfiguration,themeId:design.themeId,seconds:design.seconds});
  return presentation?<SitesPresentationView presentation={presentation} compact={compact} resolveAsset={asset=>resolveSitesDynamicAsset(design.payload,asset)}/>:<p role="status">Dit live voorbeeld is nog niet beschikbaar. De opgeslagen fallback blijft behouden.</p>;
}
export async function uploadBackground(file:File):Promise<{assetId:string;previewUrl:string}> {
  const form=new FormData();form.set("media",file);form.set("title",file.name.replace(/\.[^.]+$/,"")||"Nieuwe afbeelding");
  const upload=new AbortController();
  const uploadDeadline=setTimeout(()=>upload.abort(),120000);
  let assetId:string;
  try {
    const response=await fetch("/api/media/images",{method:"POST",body:form,signal:upload.signal});
    const body=await response.json()as{ok?:boolean;data?:{assetId?:string};error?:{cause?:string;recovery?:string}};
    if(!response.ok||!body.ok||!body.data?.assetId)throw new Error(body.error?.cause??"De upload is niet bevestigd. Probeer opnieuw.");
    assetId=body.data.assetId;
  } catch(error) {
    if(upload.signal.aborted)throw new Error("De upload is niet op tijd bevestigd. Het bestand is nog niet geselecteerd; controleer de beeldbank voordat je opnieuw uploadt.");
    throw error;
  } finally {clearTimeout(uploadDeadline);}
  const verification=new AbortController();
  const verificationDeadline=setTimeout(()=>verification.abort(),25000);
  try {
    for(let attempt=0;attempt<20&&!verification.signal.aborted;attempt++){
      const preview=await fetch(`/api/publisher/library?tab=media&assetId=${encodeURIComponent(assetId)}`,{cache:"no-store",signal:verification.signal});
      const result=await preview.json()as{media?:Array<{id:string;image:string}>};
      const asset=result.media?.find(item=>item.id===assetId&&item.image);
      if(preview.ok&&asset)return{assetId,previewUrl:asset.image};
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  } catch { /* Uploaded bytes remain private and unselected until verified. */ }
  finally {clearTimeout(verificationDeadline);}
  throw new Error("Je upload is opgeslagen en wordt nog verwerkt. Open de beeldbank om de verwerkingsstatus te controleren.");
}
