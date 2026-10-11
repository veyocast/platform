"use client";
import {sitesPresentationSchema,type SitesPresentation}from"@veyocast/contracts";
import {studioSitesSystemTemplates}from"@veyocast/studio";
import {SitesPresentationView}from"@veyocast/content-templates/sites-presentation";
import {AssetImage,ExperiencePreview}from"./presentation-adapter";
import type {Slide}from"./model";
import styles from "./placement-preview.module.css";
/** Preview uses the same trusted template and actual asset identity as the server render. */
export function photoPlacementPresentation(slide:Slide,tenantName:string):Extract<SitesPresentation,{kind:'studio'}>|null{
 const marker=slide.studioSlide?.presentation.slide.id==='sites-v11-media-placement';
 const original=marker?slide.studioSlide?.presentation.slide.photo:undefined;
 const mediaId=original?.kind==='tenant'?original.mediaAssetId:slide.mediaId;
 const checksum=original?.kind==='tenant'?original.checksumSha256:slide.mediaChecksumSha256;
 const theme=slide.studioSlide?.themeId??slide.themeId;
 if(slide.design||slide.kind==='video'||theme!=='onzetrots-tv'||!mediaId||!checksum||(!marker&&slide.studioSlide))return null;
 const orientation=slide.orientation??slide.studioSlide?.orientation??'landscape';
 const base=studioSitesSystemTemplates.find(value=>value.id===`sites-v11-tv-welkom-${orientation}-hd`)?.document.sitesPresentation;if(base?.kind!=='studio')return null;
 const reference={kind:'tenant' as const,mediaAssetId:mediaId,checksumSha256:checksum};const title=slide.name.trim().slice(0,120);
 const parsed=sitesPresentationSchema.safeParse({...base,slide:{...base.slide,id:'sites-v11-media-placement',name:title,title,time:'',location:'',subtitle:'',logo:undefined,photo:reference,duration:Math.min(120,slide.seconds),clubName:tenantName,tv:{kind:'generic',title,rows:[],heroImage:reference,clubName:tenantName,scale:100}}});
 return parsed.success&&parsed.data.kind==='studio'?parsed.data:null;
}
export function PlaylistPlacementPreview({slide,active,tenantName}:{slide:Slide;active:boolean;tenantName:string}){
 if(slide.design)return <ExperiencePreview design={slide.design}/>;
 const photo=photoPlacementPresentation(slide,tenantName);
 if(photo)return <SitesPresentationView presentation={photo}active={active}resolveAsset={asset=>asset.kind==='system'?asset.path:slide.studioSlide?.assetUrls[asset.mediaAssetId]??slide.image}/>;
 if(slide.studioSlide)return <SitesPresentationView presentation={{...slide.studioSlide.presentation,slide:{...slide.studioSlide.presentation.slide,themeId:slide.studioSlide.themeId,duration:Math.min(120,slide.seconds)}}}active={active}resolveAsset={asset=>asset.kind==='system'?asset.path:slide.studioSlide!.assetUrls[asset.mediaAssetId]}/>;
 if(slide.kind==='video')return <video src={slide.image}autoPlay={active}muted playsInline controls={!active}style={{width:'100%',height:'100%',objectFit:'contain'}}><track kind="captions"/></video>;
 return slide.image?<div className={styles.slidePreview}><AssetImage src={slide.image}alt={slide.name}/><div><small>{tenantName.toLocaleUpperCase('nl-NL')}</small><strong>{slide.name}</strong></div></div>:<p>Dit item heeft nog geen geladen voorbeeld. De opgeslagen afspeelbron blijft behouden.</p>;
}
