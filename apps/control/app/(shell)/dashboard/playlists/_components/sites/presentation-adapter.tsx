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
export {uploadBackground} from "./upload-media";
