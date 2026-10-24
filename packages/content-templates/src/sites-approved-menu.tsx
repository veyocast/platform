import React, {type ReactNode} from 'react';
import {syncSlidePresentationSchema,type SitesPresentation,type SyncOnzeTrotsV9Presentation} from '@veyocast/contracts';
import {SyncOnzeTrotsView} from './sync-onzetrots-view';
import {syncOnzeTrotsV9Styles} from './sync-onzetrots-v9-styles';
import {contrastRatio} from './editorial-arena-theme';
import type {SitesAssetResolver} from './sites-presentation-model';

type Menu=Extract<SitesPresentation,{kind:'dynamic'}>;
export const isApprovedOnzeTrotsMenu=(menu:Menu)=>menu.configuration.themeId==='onzetrots-tv'&&Boolean(menu.configuration.onzeTrotsStyle);

/** The same v9 frame as the slide collection, with the saved menu widgets inside.
 * The Sites boundary has already validated these asset references and prices. */
export function SitesApprovedMenu({presentation,resolveAsset,children}:{presentation:Menu;resolveAsset:SitesAssetResolver;children:ReactNode}){
 const config=presentation.configuration,content=presentation.content;
 const base=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'menu',orientation:config.orientation,theme:'onzetrots-tv',name:config.title,club:{name:content.clubName??''},title:config.title,footer:'',style:{font:'Brush',fontChanged:true,showLogo:config.showBranding,showFooter:config.showBranding,motion:'geen'},visual:{schemaVersion:1,mode:config.onzeTrotsStyle==='v9-marker-dark'?'dark':'light',panelOpacity:94},authoring:{headerTexts:{menu:content.title},headerSubtitles:{menu:content.subtitle??''}}}) as SyncOnzeTrotsV9Presentation;
 const custom=config.accent.toLowerCase()!=='#03438a';
 const accent=approvedMenuAccent(config.accent,base.visual.mode);
 const slide={...base,club:{...base.club,logo:content.logo},style:{...base.style,backgroundAsset:config.background}};
 return <div className="ot-v9-scope vm-approved" data-custom-accent={custom||undefined} style={{'--vm-approved-accent':accent,'--vm-background-fit':config.backgroundFit,'--vm-background-opacity':(100-config.overlay)/100} as React.CSSProperties}><SyncOnzeTrotsView slide={slide} resolveAsset={asset=>resolveAsset(asset as Parameters<SitesAssetResolver>[0])} page={0}>{children}</SyncOnzeTrotsView></div>;
}

export const approvedMenuCss=syncOnzeTrotsV9Styles({style:{font:'Brush',fontChanged:true}})+String.raw`
.vm-approved{width:100%;height:100%}
/* The legacy host also owns a generic .panel; it must not cap this header. */
.vm-approved .slide-header-container{width:100%;max-width:none}
.vm-approved[data-custom-accent] .screen{--blue:var(--vm-approved-accent)}
.vm-approved .screen.ot-controlled:before{background-size:var(--vm-background-fit,cover);opacity:var(--vm-background-opacity,.95)}
.vm-approved .vm-menu-panel{display:flex;flex-direction:column;width:100%;height:100%;padding:24px;min-height:0}
.vm-approved .vm-products-fit{flex:1;min-height:0;min-width:0;overflow:hidden}
.vm-approved .vm-widgets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;height:auto;align-items:start}
.vm-approved .vm-widgets[data-columns="1"],.vm-approved .vm-widgets[data-full="true"]{grid-template-columns:1fr}
.vm-approved .vm-widget{min-width:0;overflow:hidden;background:transparent;border:0;border-radius:0}
.vm-approved .vm-widget[data-column="full"]{grid-column:1/-1}
.vm-approved .vm-widget>header{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:10px}
.vm-approved .vm-widget>header>span{color:var(--blue);font-size:15px}
.vm-approved .vm-widget h2{font-family:OTMarker,cursive;font-size:calc(30px * var(--vm-scale));color:var(--blue);line-height:1.3}
.vm-approved .vm-widget header p{font-size:calc(18px * var(--vm-scale));line-height:1.4;color:var(--dim);margin-top:6px}
.vm-approved .vm-product{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:12px 0;min-width:0}
.vm-approved .vm-product>span{font-size:calc(22px * var(--vm-scale));line-height:1.35;color:var(--ink)}
.vm-approved .vm-product>b{font-family:OTBarlow,sans-serif;white-space:nowrap;font-size:calc(27px * var(--vm-scale));color:var(--blue)}
.vm-approved .vm-product small{font-size:calc(17px * var(--vm-scale));color:var(--dim)}
.vm-approved .vm-menu-slogan{font-family:OTMarker,cursive;color:var(--blue);font-size:20px;line-height:1.4;padding-top:18px;text-transform:none}
.vm-approved .vm-widget-image{height:var(--vm-widget-height)}
.vm-approved .vm-products{gap:24px}
`;

/** Keep the selected hue legible on the approved light/dark panel. */
export function approvedMenuAccent(value:string,mode:'light'|'dark'){
 const background=mode==='dark'?'#0c1f3a':'#ffffff',target=mode==='dark'?[241,245,255]:[16,36,65];
 const channels=[1,3,5].map(offset=>parseInt(value.slice(offset,offset+2),16));
 for(let step=0;step<=100;step++){
  const color='#'+channels.map((channel,index)=>Math.round(channel+(target[index]!-channel)*step/100).toString(16).padStart(2,'0')).join('');
  if((contrastRatio(color,background)??0)>=4.5)return color;
 }
 return mode==='dark'?'#f1f5ff':'#102441';
}
