"use client";

import {useId} from 'react';
import {Maximize2,RotateCcw} from 'lucide-react';
import type {DynamicDesign} from './experience';
import s from './led-sizing-controls.module.css';

type Props={design:DynamicDesign;onChange:(patch:Partial<DynamicDesign>)=>void};
type ScaleKey='ledTitleScale'|'ledScoreScale'|'ledLogoScale'|'ledTeamScale';
const parts:{key:ScaleKey;label:string}[]=[
  {key:'ledTitleScale',label:'Titel en subtekst'},
  {key:'ledScoreScale',label:'Tussenstand'},
  {key:'ledLogoScale',label:'Teamlogo’s'},
  {key:'ledTeamScale',label:'Teamnamen'},
];
const percent=(value:unknown)=>{
  const number=Number(value??100);
  return Number.isFinite(number)?Math.min(200,Math.max(70,number)):100;
};

export function LedSizingControls({design,onChange}:Props){
  const id=useId();
  const config=design.config;
  const updateConfig=(patch:Record<string,unknown>)=>onChange({config:{...config,...patch}});
  const preset=(fill:boolean)=>onChange({
    layout:'full',safeArea:3,align:'center',scale:fill?125:100,
    config:{...config,ledTitleScale:fill?110:100,ledScoreScale:fill?120:100,ledLogoScale:fill?130:100,ledTeamScale:fill?110:100,showBranding:!fill,showSceneLabel:!fill},
  });
  return <section className={s.panel} aria-labelledby={`${id}-title`}>
    <header className={s.heading}>
      <div><h3 id={`${id}-title`}>Groter in beeld</h3><p>Geef de stand, logo’s en tekst alle ruimte.</p></div>
      <Maximize2 size={18} aria-hidden="true"/>
    </header>
    <div className={s.presets}>
      <button type="button" className={s.fillButton} onClick={()=>preset(true)}><Maximize2 size={15} aria-hidden="true"/>Schermvullend</button>
      <button type="button" className={s.resetButton} onClick={()=>preset(false)}><RotateCcw size={14} aria-hidden="true"/>Standaard</button>
    </div>
    <div className={`${s.slider} ${s.master}`}>
      <label htmlFor={`${id}-all`}>Alles vergroten <output htmlFor={`${id}-all`}>{percent(design.scale)}%</output></label>
      <input id={`${id}-all`} type="range" min={70} max={200} step={5} value={percent(design.scale)} onChange={event=>onChange({scale:Number(event.target.value)})}/>
      <div className={s.rangeEnds} aria-hidden="true"><span>70%</span><span>200%</span></div>
    </div>
    <div className={s.partGrid}>
      {parts.map(part=><div className={s.slider} key={part.key}>
        <label htmlFor={`${id}-${part.key}`}>{part.label}<output htmlFor={`${id}-${part.key}`}>{percent(config[part.key])}%</output></label>
        <input id={`${id}-${part.key}`} type="range" min={70} max={200} step={5} value={percent(config[part.key])} onChange={event=>updateConfig({[part.key]:Number(event.target.value)})}/>
      </div>)}
    </div>
    <p className={s.hint}>De onderdelen schalen samen met ‘Alles vergroten’. Automatisch passend maken houdt ze binnen het beeld en voorkomt overlap.</p>
    <div className={s.visibility}>
      <label><input type="checkbox" checked={config.showBranding!==false} onChange={event=>updateConfig({showBranding:event.target.checked})}/><span>Clubregels boven en onder</span></label>
      <label><input type="checkbox" checked={config.showSceneLabel!==false} onChange={event=>updateConfig({showSceneLabel:event.target.checked})}/><span>Kleine regel boven de titel</span></label>
    </div>
  </section>;
}
