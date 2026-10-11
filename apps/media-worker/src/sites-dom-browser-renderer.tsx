import React,{useLayoutEffect} from "react";
import {createRoot,type Root} from "react-dom/client";
import {SitesPresentationView} from "@veyocast/content-templates/sites-presentation";
import type {SitesPresentation} from "@veyocast/contracts";

/** Fixed, worker-owned entry. Presentation text never becomes JavaScript or HTML. */
export interface SitesBrowserRenderInput {
 presentation:SitesPresentation;
 page:number;
 active:boolean;
 tenantAssetSources:Readonly<Record<string,string>>;
}
let root:Root|undefined;
let renderedPage=-1;
function CommittedSitesFrame({input}:{input:SitesBrowserRenderInput}){
 useLayoutEffect(()=>{document.getElementById("sites-capture")!.dataset.sitesPage=String(input.page);},[input.page]);
 return <SitesPresentationView presentation={input.presentation} page={input.page} active={input.active} includeStyles={false} resolveAsset={asset=>{
  if(asset.kind==="system")return asset.path;
  const href=input.tenantAssetSources[asset.mediaAssetId];
  return href&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(href)?href:undefined;
 }}/>;
}
function startSitesRender(input:SitesBrowserRenderInput){
 const node=document.getElementById("sites-capture");if(!node)throw Error("sites_capture_host_missing");
 // A worker frame is a fresh immutable page, just like the reference capture.
 // Keep its trusted CSP document, while dropping the prior page's fit/layer
 // state before mounting the next page. No author script or second nonce.
 if(root&&renderedPage!==input.page){root.unmount();root=undefined;delete node.dataset.sitesPage;}
 root??=createRoot(node);
 renderedPage=input.page;
 root.render(<CommittedSitesFrame input={input}/>);
}
(globalThis as typeof globalThis & {startSitesRender:typeof startSitesRender}).startSitesRender=startSitesRender;
