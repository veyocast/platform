import React from "react";
import type {ReactNode} from "react";
import {sitesPresentationSchema,type SitesPresentation} from "@veyocast/contracts";
import {OnzeTrotsTvMarkup} from "./sites-onzetrots-tv-markup";
import {LedSlideMarkup} from "./sites-led-markup";
import {SlideCanvas} from "./sites-studio-canvas";
import {SitesDynamicCanvas} from "./sites-dynamic-canvas";
import {sitesPresentationCss} from "./sites-styles";
import {sitesPresentationPages,resolveSitesSystemAsset,resolveSitesStudioPage,resolveSitesDynamicPage,type SitesAssetResolver} from "./sites-presentation-model";
export function SitesStaticView({presentation,resolveAsset=resolveSitesSystemAsset,page=0,active=false,compact=false,includeStyles=true,systemAssetUrls={}}:{presentation:SitesPresentation;resolveAsset?:SitesAssetResolver;page?:number;active?:boolean;compact?:boolean;includeStyles?:boolean;systemAssetUrls?:Readonly<Record<string,string>>}) {
 const input=sitesPresentationSchema.parse(presentation);const pages=sitesPresentationPages(input);const safePage=Math.min(pages-1,Math.max(0,Math.trunc(page)));let node:ReactNode;
 if(input.kind==="studio"){
  const {slide,content}=resolveSitesStudioPage(input,resolveAsset,safePage);
  if(slide.themeId==="onzetrots-tv"&&content)node=<OnzeTrotsTvMarkup content={content} orientation={slide.orientation} active={active} compact={compact}/>;else node=<SlideCanvas slide={slide} playing={active}/>;
 }else{
  const config=input.configuration;const {content,design}=resolveSitesDynamicPage(input,resolveAsset,safePage);
  if(config.themeId==="onzetrots-tv")node=<OnzeTrotsTvMarkup content={content} orientation={config.orientation} active={active} compact={compact}/>;
  else {node=config.provider==="led-scores"&&config.ledTheme!=="fieldflow"?<LedSlideMarkup design={design} background={design.background} active={active} compact={compact}/>:<SitesDynamicCanvas design={design} active={active} compact={compact}/>;}
 }
 return <>{includeStyles&&<style>{sitesPresentationCss.replace(/url\(["']?(\/[^"')]+)["']?\)/g,(match,path:string)=>systemAssetUrls[path]?`url("${systemAssetUrls[path]}")`:match)}</style>}{node}</>;
}