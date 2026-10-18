import type {PlayerDynamicTemplateAsset,SitesPresentation} from '@veyocast/contracts';
import {sitesPresentationAssets} from '@veyocast/content-templates/sites-presentation-model';
import {DynamicRenderBackendError} from './dynamic-render-backend';
import {loadVerifiedDynamicCaptureAssets} from './dynamic-capture-assets';

/** The existing Sites authority and failure contract remain unchanged. */
export async function loadSitesDynamicCaptureAssets(presentation:SitesPresentation,assets:Record<string,PlayerDynamicTemplateAsset>,storageOrigin:string|undefined,signal?:AbortSignal,fetcher:typeof fetch=fetch){
 return loadVerifiedDynamicCaptureAssets(sitesPresentationAssets(presentation).filter(ref=>ref.kind==='tenant'),assets,storageOrigin,unavailable,signal,fetcher);
}
function unavailable(){return new DynamicRenderBackendError('dynamic_sites_asset_unavailable',true,'Een gecontroleerd slidebeeld is niet beschikbaar. De laatste goede slide blijft behouden.');}
