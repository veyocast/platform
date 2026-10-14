import type { PlayerDynamicTemplatePayload, SitesDynamicConfiguration, SitesPresentation, SitesStudioSlide } from "@veyocast/contracts";
import type { resolveSitesStudioSlide } from "@veyocast/content-templates/sites-presentation";

export type ScreenThemeId = "fieldflow" | "onzetrots-tv";
export type Media = { durationSeconds?:number;checksumSha256?:string;id:string;name:string;image:string;folder:string;size:string;kind:"image"|"video";tags?:string[];collections?:string[];favorite?:boolean;archived?:boolean;sourceKind?:"youtube"|"engage";sourceId?:string;fallbackAssetId?:string };
export type DynamicDesign = { id:string;name:string;kind:string;themeId:ScreenThemeId;provider:"led-scores"|"sportlink"|"menu";title:string;subtitle:string;background:string;overlay:number;accent:string;layout:"full"|"split"|"sidebar";orientation:"landscape"|"portrait";scale:number;align:"left"|"center"|"right";safeArea:number;seconds:number;rows:Array<{id:string;primary:string;secondary?:string;value?:string}>;config:Record<string,unknown>;screenIds:string[];groupNames:string[];snapshotId:string;payload:PlayerDynamicTemplatePayload;sitesConfiguration:SitesDynamicConfiguration };
export type StudioSlide = ReturnType<typeof resolveSitesStudioSlide> & { presentation:Extract<SitesPresentation,{kind:"studio"}>;assetUrls:Record<string,string>;draftRevision?:number;exportAssetId?:string;exportId?:string;exportKind:"image"|"video" };
export type StudioProject = { id:string;name:string;revision:number;slides:StudioSlide[] };
export type Slide = { mediaChecksumSha256?:string;id:string;name:string;image:string;seconds:number;mediaId?:string;designId?:string;design?:DynamicDesign;studioProjectId?:string;studioSlideId?:string;studioSlide?:StudioSlide;themeId?:ScreenThemeId;orientation?:"landscape"|"portrait";duplicateOf?:string;seriesClientId?:string;seriesClientItemIds?:string[];seriesIndex?:number;seriesRevision?:number;sourceKind?:"youtube"|"engage";sourceId?:string;fallbackAssetId?:string;kind?:"image"|"video";frozenStudioSlide?:SitesStudioSlide };
export type Playlist = { id:string;name:string;description:string;status:string;slides:Slide[];updated:string;archived?:boolean;itemCount?:number;totalDurationSeconds?:number;assignedScreenCount?:number };
export type Screen = { id:string;name:string;group:string;orientation:string;status:"online"|"offline"|"unknown";playlist?:string };
export type Group = { name:string;members:string[] };
export const PHOTOS = { club:"" }; // No tenant-owned example photo is substituted for missing content.

/** Keep the integer placement within the verified video source; playback ends naturally. */
export function mediaPlacementDuration(media: Pick<Media, "kind" | "durationSeconds" | "sourceKind">): number {
  if (media.kind !== "video" || media.sourceKind) return 12;
  if (typeof media.durationSeconds !== "number" || !Number.isFinite(media.durationSeconds) || media.durationSeconds <= 0) {
    throw new Error("De geverifieerde videoduur ontbreekt. Vernieuw de bibliotheek en selecteer de video opnieuw.");
  }
  return Math.max(5, Math.min(3600, Math.ceil(media.durationSeconds)));
}
