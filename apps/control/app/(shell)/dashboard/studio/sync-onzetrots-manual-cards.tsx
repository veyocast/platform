"use client";
import type {ReactNode} from 'react';
import {Button} from '@veyocast/ui';
import type {SyncOnzeTrotsPresentation,SyncOnzeTrotsRich,SyncSlideAsset} from '@veyocast/contracts';
import {SyncStudioField as Field} from './sync-studio-field';

type Props={presentation:SyncOnzeTrotsPresentation;onChange:(rich:SyncOnzeTrotsRich)=>void;imagePicker:(value:SyncSlideAsset|undefined,onPick:(value:SyncSlideAsset|undefined)=>void,label:string)=>ReactNode};

/** Explicit manual facts. Connected documents never mount this editor; their
 * controlled source remains the sole authority for names, ages and images. */
export function SyncOnzeTrotsManualCards({presentation,onChange,imagePicker}:Props){
 const rich=presentation.rich??{},birthday=presentation.family==='birthdays';
 const birthdays=rich.birthdays??presentation.rows.map((row,index)=>({id:`manual-${index}`,displayName:row[2],age:null,dateLabel:[row[0],row[1]].filter(Boolean).join(' '),meta:row[3]}));
 const activities=rich.activities??presentation.rows.map((row,index)=>({id:`manual-${index}`,title:row[2],body:row[3],dateLabel:row[1],timeLabel:row[0],location:'',image:undefined}));
 const count=birthday?birthdays.length:activities.length;
 const updateBirthday=(index:number,patch:Partial<(typeof birthdays)[number]>)=>onChange({...rich,birthdays:birthdays.map((item,i)=>i===index?{...item,...patch}:item)});
 const updateActivity=(index:number,patch:Partial<(typeof activities)[number]>)=>onChange({...rich,activities:activities.map((item,i)=>i===index?{...item,...patch}:item)});
 return <section aria-label={birthday?'Verjaardagskaarten':'Activiteitenkaarten'}>
  <h3>{birthday?'Jarigen':presentation.family==='agenda'?'Clubagenda':'Clubactiviteiten'}</h3>
  <p className="vc-property-hint">Zes vaste plekken per pagina. Extra kaarten krijgen een volgende pagina. Voeg alleen gegevens toe die je zelf wilt tonen.</p>
  {birthday?birthdays.map((item,index)=><details key={item.id} open={count===1}>
   <summary style={{minHeight:44,display:'flex',alignItems:'center'}}>{index+1}. {item.displayName||'Nieuwe jarige'}</summary>
   <Field label={`Naam · kaart ${index+1}`}><input maxLength={400} value={item.displayName} onChange={event=>updateBirthday(index,{displayName:event.target.value})}/></Field>
   <div className="vc-form-grid">
    <Field label={`Leeftijd · kaart ${index+1}`}><input type="number" min={0} max={130} value={item.age??''} onChange={event=>{const value=event.target.value;if(value==='')updateBirthday(index,{age:null});else if(Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=130)updateBirthday(index,{age:Number(value)});}}/></Field>
    <Field label={`Datum · kaart ${index+1}`}><input maxLength={400} placeholder="Bijvoorbeeld 24 oktober" value={item.dateLabel} onChange={event=>updateBirthday(index,{dateLabel:event.target.value})}/></Field>
   </div>
   <Field label={`Team of toelichting · kaart ${index+1}`}><input maxLength={400} value={item.meta} onChange={event=>updateBirthday(index,{meta:event.target.value})}/></Field>
   <Button type="button" variant="secondary" size="sm" onClick={()=>onChange({...rich,birthdays:birthdays.filter((_,i)=>i!==index)})}>Kaart {index+1} verwijderen</Button>
  </details>):activities.map((item,index)=><details key={item.id} open={count===1}>
   <summary style={{minHeight:44,display:'flex',alignItems:'center'}}>{index+1}. {item.title||'Nieuwe activiteit'}</summary>
   <Field label={`Activiteit · kaart ${index+1}`}><input maxLength={400} value={item.title} onChange={event=>updateActivity(index,{title:event.target.value})}/></Field>
   <Field label={`Toelichting · kaart ${index+1}`}><textarea rows={3} maxLength={4000} value={item.body} onChange={event=>updateActivity(index,{body:event.target.value})}/></Field>
   <div className="vc-form-grid">
    <Field label={`Datum · kaart ${index+1}`}><input maxLength={400} value={item.dateLabel} onChange={event=>updateActivity(index,{dateLabel:event.target.value})}/></Field>
    <Field label={`Tijd · kaart ${index+1}`}><input maxLength={400} value={item.timeLabel} onChange={event=>updateActivity(index,{timeLabel:event.target.value})}/></Field>
   </div>
   <Field label={`Locatie · kaart ${index+1}`}><input maxLength={400} value={item.location} onChange={event=>updateActivity(index,{location:event.target.value})}/></Field>
   {imagePicker(item.image,image=>updateActivity(index,{image}),`Afbeelding · kaart ${index+1}`)}
   <Button type="button" variant="secondary" size="sm" onClick={()=>onChange({...rich,activities:activities.filter((_,i)=>i!==index)})}>Kaart {index+1} verwijderen</Button>
  </details>)}
  <Button type="button" variant="secondary" size="md" disabled={count>=200} onClick={()=>birthday?onChange({...rich,birthdays:[...birthdays,{id:crypto.randomUUID(),displayName:'',age:null,dateLabel:'',meta:''}]}):onChange({...rich,activities:[...activities,{id:crypto.randomUUID(),title:'',body:'',dateLabel:'',timeLabel:'',location:''}]})}>{birthday?'Jarige toevoegen':'Activiteit toevoegen'}</Button>
 </section>;
}
