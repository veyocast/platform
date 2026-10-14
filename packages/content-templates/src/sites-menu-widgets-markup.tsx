import React, { type CSSProperties } from "react";
import { sitesSystemImageChecksums, type SitesPresentation } from "@veyocast/contracts";
import type { SitesAssetResolver } from "./sites-presentation-model";

export function SitesMenuWidgetsMarkup({presentation,resolveAsset,page=0,width}:{presentation:Extract<SitesPresentation,{kind:"dynamic"}>;resolveAsset:SitesAssetResolver;page?:number;width?:number}) {
 const config=presentation.configuration,content=presentation.content,portrait=config.orientation==="portrait",w=portrait?1080:1920,h=portrait?1920:1080;
 const menuPage=content.menuPages?.[page]; if(!menuPage)return null;
 const background=config.background?resolveAsset(config.background):undefined;
 const logo=content.logo?resolveAsset(content.logo):undefined;
 const lettering=config.themeId==="onzetrots-tv"?resolveAsset({kind:"system",path:"/onzetrots-tv/assets/clubmuur-lettering.webp",checksumSha256:sitesSystemImageChecksums["/onzetrots-tv/assets/clubmuur-lettering.webp"]}):undefined;
 const scale=width?width/w:1;
 const style={width:w,height:h,transform:`scale(${scale})`,padding:`${h*config.safeArea/100}px ${w*config.safeArea/100}px`,"--vm-accent":config.accent,"--vm-accent-ink":accentInk(config.accent),"--vm-scale":config.scale/100,textAlign:config.align} as CSSProperties;
 return <div className="vm-frame" style={{width:width??w,height:width?h*scale:h}}><section className="vm-canvas" data-theme={config.themeId} data-orientation={config.orientation} data-photo={Boolean(background)} style={style} aria-label={config.title||"Menukaart"}>
  {background&&<img alt="" className="vm-background" src={background} style={{objectFit:config.backgroundFit}}/>}{background&&<div className="vm-shade" style={{opacity:config.overlay/100}}/>}
  <header className="vm-header">{logo&&<img src={logo} alt={content.clubName||"Clublogo"}/>}<div className="vm-header-copy" data-fit-box><div className="vm-header-inner" data-fit-content>{content.clubName&&<span>{content.clubName}</span>}<h1>{config.title||"Menukaart"}</h1>{config.subtitle&&<p>{config.subtitle}</p>}</div></div></header>
  <div className="vm-widgets" data-columns={menuPage.columns}>{menuPage.widgets.map(widget=><section key={widget.id} className={`vm-widget vm-${widget.type}`} data-column={widget.column} data-fit-box><div className="vm-widget-content" data-fit-content>
   {(widget.title||widget.subtitle)&&<header><h2>{widget.title}</h2>{widget.subtitle&&<p>{widget.subtitle}</p>}</header>}
   {widget.type==="category"&&<div className="vm-products" data-columns={widget.columns}>{Array.from({length:widget.columns},(_,index)=><div className="vm-product-column" key={index}>{widget.rows.filter(row=>row.column===index+1).map(row=><article key={row.id} className="vm-product">{row.image&&<img src={resolveAsset(row.image)} alt=""/>}<span><strong>{row.primary}</strong>{row.secondary&&<small>{row.secondary}</small>}</span>{config.showPrices&&row.value&&<b>{row.value}</b>}</article>)}</div>)}</div>}
   {widget.image&&<figure className="vm-widget-image" data-ratio={widget.aspectRatio??"16:9"}><img src={resolveAsset(widget.image)} alt={widget.title||"Widgetafbeelding"} style={{objectFit:widget.fit??"contain"}}/></figure>}
  </div></section>)}</div>
  <footer className="vm-footer">{lettering?<img src={lettering} alt="OnzeTrots"/>:<span>{content.clubName||"Menu"}</span>}<span className="vm-page">{page+1} / {content.menuPages!.length}</span></footer>
 </section></div>;
}
function accentInk(color:string) {const hex=color.slice(1,7),channels=[0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722>.179?"#142039":"#ffffff";}
