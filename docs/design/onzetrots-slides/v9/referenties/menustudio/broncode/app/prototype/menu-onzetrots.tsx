"use client";

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {DynamicDesign} from './experience';
import {AssetImage,useAssetUrl} from './media-assets';
import styles from './menu-onzetrots.module.css';

export const MENU_ONZETROTS_BACKGROUNDS=[
  {id:'houtrust',name:'OnzeTrots · Ons clubhuis',image:'/onzetrots/website-brush/houtrust-wide-1672.webp'},
  {id:'de-wijk',name:'OnzeTrots · Onze wijk',image:'/onzetrots/website-brush/de-wijk-wide-1672.webp'},
  {id:'aan-zee',name:'OnzeTrots · Onze kust',image:'/onzetrots/website-brush/aan-zee-wide-1672.webp'},
];

const bounded=(value:unknown,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;

/** Built-in scenes keep their dedicated crop; custom uploaded media keep their identity. */
export function menuOnzeTrotsBackground(source:string,orientation:DynamicDesign['orientation']){
  const scene=source.match(/\/(houtrust|de-wijk|aan-zee)-(?:wide-1672|portrait-941)\.webp$/)?.[1];
  if(scene)return `/onzetrots/website-brush/${scene}-${orientation==='portrait'?'portrait-941':'wide-1672'}.webp`;
  if(!source||source==='/onzetrots-tv/assets/clubmuur-wall.webp')return `/onzetrots/website-brush/houtrust-${orientation==='portrait'?'portrait-941':'wide-1672'}.webp`;
  return source;
}

/** Dedicated Menu Studio renderer: it never changes FieldFlow or other OnzeTrots families. */
export function MenuOnzeTrotsPreview({design,rows,page,pages,active=false,compact=false}:{design:DynamicDesign;rows:DynamicDesign['rows'];page:number;pages:number;active?:boolean;compact?:boolean}){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(0);
  const portrait=design.orientation==='portrait',logicalWidth=portrait?900:1600,logicalHeight=portrait?1600:900;
  const mode=design.config.onzetrotsMode==='dark'?'dark':'light';
  const background=useAssetUrl(menuOnzeTrotsBackground(design.background,design.orientation));
  const clubName=text(design.config.clubName,'Duindorp SV');
  const clubLogo=text(design.config.clubLogo,'/onzetrots-tv/assets/logo.png');
  const pageSize=Math.round(bounded(Number(design.config.rowsPerPage),1,10,6));
  const panelOpacity=bounded(design.config.panelOpacity,80,100,94)/100;
  const contrast=bounded(design.overlay,10,95,35)/100;
  const typeScale=bounded(design.scale,70,140,100)/100;

  useEffect(()=>{
    const element=host.current;if(!element)return;
    const measure=()=>setWidth(element.clientWidth);measure();
    const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    let stopped=false;const root=canvas.current;if(!root)return;
    const fit=()=>{
      if(stopped)return;
      const title=root.querySelector<HTMLElement>('[data-menu-title]');
      const titleBox=root.querySelector<HTMLElement>('[data-menu-header-text]');
      const subtitle=root.querySelector<HTMLElement>('[data-menu-subtitle]');
      if(subtitle){
        let size=portrait?11:12;subtitle.style.fontSize=`${size}px`;
        for(let i=0;i<12&&size>9;i++){
          if(subtitle.scrollWidth<=subtitle.clientWidth+1&&subtitle.scrollHeight<=30)break;
          size=Math.max(9,size-.5);subtitle.style.fontSize=`${size}px`;
        }
      }
      if(title&&titleBox){
        let size=portrait?38:42;title.style.fontSize=`${size}px`;
        const available=titleBox.clientHeight-(subtitle?.offsetHeight||0)-(subtitle&&design.title?7:0);
        for(let i=0;i<90&&size>14;i++){
          const line=parseFloat(getComputedStyle(title).lineHeight)||size*1.12;
          if(title.scrollWidth<=title.clientWidth+1&&title.scrollHeight<=Math.min(available,line*2)+1)break;
          size-=.5;title.style.fontSize=`${size}px`;
        }
      }
      root.querySelectorAll<HTMLElement>('[data-menu-product-name]').forEach(name=>{
        let size=(portrait?29:25)*typeScale;name.style.fontSize=`${size}px`;
        const box=name.parentElement!;
        const other=[...box.children].filter(child=>child!==name).reduce((sum,child)=>sum+(child as HTMLElement).offsetHeight,0);
        const available=Math.max(20,box.clientHeight-other-(box.children.length-1)*7);
        for(let i=0;i<60&&size>12;i++){
          if(name.scrollWidth<=name.clientWidth+1&&name.scrollHeight<=available+1)break;
          size-=.5;name.style.fontSize=`${size}px`;
        }
      });
    };
    const frame=requestAnimationFrame(fit);void document.fonts.ready.then(fit);
    return()=>{stopped=true;cancelAnimationFrame(frame)};
  },[design.title,design.subtitle,design.scale,portrait,rows,width,typeScale,mode,background,design.id]);

  const vars={
    '--menu-panel':mode==='dark'?`rgba(12,31,58,${panelOpacity})`:`rgba(255,255,255,${panelOpacity})`,
    '--menu-contrast':contrast,
    '--menu-type-scale':typeScale,
    '--menu-grid-rows':Math.ceil(pageSize/(portrait?1:2)),
  } as CSSProperties;

  return <div ref={host} className={`${styles.preview} ${portrait?styles.portrait:''} ${compact?styles.compact:''}`} style={{aspectRatio:`${logicalWidth}/${logicalHeight}`}} role="img" aria-label={`${design.title||design.name} · OnzeTrots ${mode==='dark'?'donker':'licht'} · ${portrait?'staand':'liggend'}`}>
    <div key={`${design.id}:${design.orientation}:${mode}:${background}`} ref={canvas} className={`${styles.canvas} ${mode==='dark'?styles.dark:''} ${portrait?styles.canvasPortrait:''} ${active?styles.active:''}`} style={{...vars,width:logicalWidth,height:logicalHeight,transform:`scale(${width/logicalWidth})`}}>
      {background&&<img className={styles.photo} src={background} alt=""/>}
      <div className={styles.shade}/>
      <div className={styles.layout}>
        <header className={`${styles.panel} ${styles.header}`}>
          <div className={styles.headerText} data-menu-header-text>
            {design.subtitle!==''&&<span className={styles.subtitle} data-menu-subtitle>{design.subtitle}</span>}
            <h2 className={styles.title} data-menu-title>{design.title}</h2>
          </div>
          <AssetImage className={styles.clubLogo} src={clubLogo} alt={`${clubName} clublogo`}/>
        </header>
        <section className={`${styles.panel} ${styles.menuPanel}`} aria-label="Menukaart">
          {rows.length?<div className={styles.menuGrid}>{rows.map(row=><article className={styles.product} key={row.id}>
            <div className={styles.productText}>
              {design.config.showCategories!==false&&row.secondary&&<span className={styles.category}>{row.secondary}</span>}
              <strong className={styles.productName} data-menu-product-name>{row.primary}</strong>
              {design.config.showCategories===false&&row.secondary&&<small>{row.secondary}</small>}
            </div>
            {row.value&&<b className={styles.price}>{row.value}</b>}
          </article>)}</div>:<div className={styles.empty}><h3>Wat mag het zijn?</h3><p>Kies producten om je menukaart te vullen.</p></div>}
          <div className={styles.menuNote}><span>Bestellen en afrekenen aan de bar.</span><span>{pages>1?`${page+1} / ${pages}`:'Welkom in onze kantine.'}</span></div>
        </section>
        <footer className={styles.footer}><span className={styles.wordmark} role="img" aria-label="OnzeTrots"/><small>ONZE CLUB. ONZE TROTS.</small></footer>
      </div>
    </div>
  </div>;
}
