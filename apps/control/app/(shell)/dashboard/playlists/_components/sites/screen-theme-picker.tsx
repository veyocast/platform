"use client";
import {Check} from 'lucide-react';
import {SCREEN_THEMES} from '@veyocast/content-templates/sites-screen-themes';
import type {ScreenThemeId} from './model';
import s from './screen-theme-picker.module.css';

export function ScreenThemePicker({value,onChange,legacyLabel,compact=false}:{value:ScreenThemeId|undefined;onChange:(id:ScreenThemeId)=>void;legacyLabel?:string;compact?:boolean}) {
  return <fieldset className={`${s.picker} ${compact?s.compact:''}`}><legend>Schermthema</legend><div className={s.choices}>{SCREEN_THEMES.map(theme=>{
    const selected=(value||'fieldflow')===theme.id;
    return <button type="button" key={theme.id} className={s.choice} aria-pressed={selected} onClick={()=>onChange(theme.id)}><span className={s.swatch} data-theme={theme.id} aria-hidden="true"><b>{theme.id==='onzetrots-tv'?'ONZE TROTS.':'Samen voor de club.'}</b><i/></span><span className={s.copy}><strong>{theme.id==='fieldflow'&&legacyLabel?legacyLabel:theme.name}</strong>{!compact&&<small>{theme.id==='fieldflow'&&legacyLabel?'Behoud de stijl van dit ontwerp.':theme.description}</small>}</span><span className={s.check}>{selected&&<Check size={15}/>}</span></button>;
  })}</div>{!compact&&<p>Het thema gaat mee naar je playlist en publicatie. Je inhoud blijft bewerkbaar.</p>}</fieldset>;
}
