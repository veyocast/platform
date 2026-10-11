import {sitesPresentationSchema,type SitesPresentation,type SitesAssetReference,type LedScoresCanvasScene} from "@veyocast/contracts";
import type {ActiveLedScoresOverlay} from "../_components/ledscores-goal-overlay";
import type {LedScoresOverlayAsset} from "./ledscores-match-experience";
/** Reuses normalized DB delivery state and verified overlay assets. */
export function buildSitesLedOverlayPresentation(overlay:ActiveLedScoresOverlay,orientation:"landscape"|"portrait"):SitesPresentation|null{
 const scene=overlay.scene?.[orientation];if(!scene?.sitesConfiguration||overlay.kind==="lineup_clear")return null;
 const image=(url:string|null|undefined):SitesAssetReference|undefined=>{const asset=(url?overlay.assets.get(url):null)??[...overlay.assets.values()].find(asset=>asset.url===url&&asset.mimeType.startsWith("image/"));return asset?{kind:"tenant",mediaAssetId:asset.mediaAssetId,checksumSha256:asset.checksum}:undefined;};
 const goal=overlay.kind==="goal";const home=goal?{name:overlay.homeTeam,score:overlay.homeScore,logoUrl:overlay.homeLogo}:overlay.home;const away=goal?{name:overlay.awayTeam,score:overlay.awayScore,logoUrl:overlay.awayLogo}:overlay.away;
 const homeScored=goal&&overlay.homeScore>overlay.previousHomeScore;const awayScored=goal&&overlay.awayScore>overlay.previousAwayScore;
 const ownHome=goal?overlay.scoringSide==="own"?homeScored:overlay.scoringSide==="opponent"?awayScored:false:false;const ownAway=goal?overlay.scoringSide==="own"?awayScored:overlay.scoringSide==="opponent"?homeScored:false:false;
 const moment=goal?"goal":overlay.kind==="lineup"?"lineup":overlay.kind==="half_time"?"half":overlay.kind==="match_end"?"end":"live";
 const title=scene.sitesConfiguration.title||(moment==="lineup"?"Samen het veld op":goal?"GOALLL!":moment==="half"?"Ruststand":moment==="end"?"De eindstand":"De tussenstand");
 const rows=overlay.kind==="lineup"?overlay.lineup.map((player,index)=>({id:player.id??`player-${index}`,primary:player.name,secondary:undefined,value:player.number??undefined,image:image(player.photoUrl)})):[{id:"home",primary:home.name,value:String(home.score),own:ownHome,image:image(home.logoUrl)},{id:"away",primary:away.name,value:String(away.score),own:ownAway,image:image(away.logoUrl)}];
 const parsed=sitesPresentationSchema.safeParse({kind:"dynamic",configuration:{...scene.sitesConfiguration,ledMoment:moment,ledSide:goal?overlay.scoringSide:scene.sitesConfiguration.ledSide},content:{kind:overlay.kind==="lineup"?"lineup":goal?"goal":"score",title,subtitle:scene.sitesConfiguration.subtitle,background:scene.sitesConfiguration.background,rows,match:{home:home.name,away:away.name,homeScore:String(home.score),awayScore:String(away.score),homeLogo:image(home.logoUrl),awayLogo:image(away.logoUrl),homeOwn:ownHome,awayOwn:ownAway,clock:overlay.matchClock??undefined}}});return parsed.success?parsed.data:null;
}
export function resolveSitesLedAsset(assets:ReadonlyMap<string,LedScoresOverlayAsset>,asset:SitesAssetReference){if(asset.kind==="system")return asset.path;const stored=assets.get(asset.mediaAssetId);return stored?.checksum===asset.checksumSha256&&stored.mimeType.startsWith("image/")?stored.url:undefined;}
export function sceneWithSitesConfiguration(scene:LedScoresCanvasScene){return !!scene.sitesConfiguration;}
