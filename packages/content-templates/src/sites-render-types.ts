import type { SitesStudioSlide } from "@veyocast/contracts";
import type { OnzeTrotsTvContent, OnzeTrotsTvRow } from "./sites-screen-themes";
export type SitesStudioSlideView=Omit<SitesStudioSlide,"photo"|"logo"|"tv">&{photo?:string;logo?:string;tv?:OnzeTrotsTvContent};
export type SitesDynamicDesignView={id:string;name:string;kind:string;themeId?:"fieldflow"|"onzetrots-tv";provider:"led-scores"|"sportlink"|"menu";title:string;subtitle:string;background:string;overlay:number;accent:string;layout:"full"|"split"|"sidebar";orientation:"landscape"|"portrait";scale:number;align:"left"|"center"|"right";safeArea:number;seconds:number;rows:OnzeTrotsTvRow[];config:Record<string,unknown>};
