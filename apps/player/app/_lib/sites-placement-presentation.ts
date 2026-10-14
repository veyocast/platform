import type {SitesPresentation} from "@veyocast/contracts";
import {sitesPresentationPages} from "@veyocast/content-templates/sites-presentation-model";

/** Rendering uses the frozen placement budget; the authoring revision remains immutable. */
export function sitesPresentationForPlacement(presentation:SitesPresentation,durationSeconds:number):SitesPresentation {
 const seconds=durationSeconds/sitesPresentationPages(presentation);
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error("SITES_PLACEMENT_DURATION_INVALID");
 // Widget canvases are static; their external modern/LG page clocks own the
 // exact placement budget. Keep the authoring-only integer seconds valid.
 if(presentation.kind==="dynamic"&&presentation.content.menuPages)return presentation;
 return presentation.kind==="dynamic"?{...presentation,configuration:{...presentation.configuration,seconds}}:{...presentation,slide:{...presentation.slide,duration:seconds}};
}
