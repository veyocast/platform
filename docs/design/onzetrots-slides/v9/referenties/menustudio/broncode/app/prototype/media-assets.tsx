"use client";
import {useEffect,useState,type ImgHTMLAttributes} from 'react';
import {ImagePlus} from 'lucide-react';
import {resolveOnzeTrotsBackground} from './onzetrots-backgrounds';

// Blobs live separately from design snapshots, keeping browser storage small.
const assetUrls=new Map<string,string>();
function assetDatabase():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('veyocast-assets',1);request.onupgradeneeded=()=>request.result.createObjectStore('images');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Afbeeldingen kunnen niet worden opgeslagen in deze browser.'));})}
export async function uploadBackground(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw new Error('Kies een JPG-, PNG-, WebP- of AVIF-afbeelding.');
 if(file.size>20*1024*1024)throw new Error('Kies een afbeelding tot 20 MB.');
 const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('Deze afbeelding kan niet worden gelezen. Kies een ander bestand.');});
 const canvas=document.createElement('canvas');const factor=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('De afbeelding kan niet worden verwerkt.');}ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Opslaan van de afbeelding is mislukt.')),'image/webp',0.85));
 const id=`image-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;const db=await assetDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Onvoldoende browseropslag. Verwijder oude bestanden of kies een kleinere foto.'));tx.onabort=()=>reject(new Error('De afbeelding is niet opgeslagen.'));}).finally(()=>db.close());
 const value=`asset:${id}`;assetUrls.set(value,URL.createObjectURL(blob));return value;
}
export function useAssetUrl(source:string){const value=resolveOnzeTrotsBackground(source);const[url,setUrl]=useState(()=>value.startsWith('asset:')?assetUrls.get(value)||'':value);useEffect(()=>{let alive=true;if(!value.startsWith('asset:')){setUrl(value);return}const cached=assetUrls.get(value);if(cached){setUrl(cached);return}setUrl('');void assetDatabase().then(db=>new Promise<Blob|undefined>((resolve,reject)=>{const request=db.transaction('images','readonly').objectStore('images').get(value.slice(6));request.onsuccess=()=>{resolve(request.result);db.close()};request.onerror=()=>{reject(request.error);db.close()}})).then(blob=>{if(blob){const source=assetUrls.get(value)||URL.createObjectURL(blob);assetUrls.set(value,source);if(alive)setUrl(source)}}).catch(()=>{});return()=>{alive=false}},[value]);return url}
export function AssetImage({src='',alt='',...props}:ImgHTMLAttributes<HTMLImageElement>){const url=useAssetUrl(typeof src==='string'?src:'');return url?<img {...props} src={url} alt={alt}/>:<span {...(props.className?{className:props.className}:{})} role="img" aria-label={alt||'Afbeelding niet beschikbaar'} style={{...props.style,display:'grid',placeItems:'center',background:'#dce5e0'}}><ImagePlus size={22}/></span>}

