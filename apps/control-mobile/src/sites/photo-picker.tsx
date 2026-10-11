import {AppText,Button,SurfaceCard,mobileSpacing} from "@veyocast/mobile-design-system";
import {useQuery} from "@tanstack/react-query";
import {useState} from "react";
import {Image,View} from "react-native";
import type {SitesAssetReference} from "@veyocast/contracts";
import {mobileApi} from "../api/mobile-api";
import {useTenant} from "../tenant/tenant-provider";
import {AppError} from "../components/app-error";
export function NativeSitesPhotoPicker({onPick}:{onPick:(asset:SitesAssetReference)=>void}){
 const {activeTenant}=useTenant();const [open,setOpen]=useState(false),[offset,setOffset]=useState(0);const query=useQuery({queryKey:["sites-photos",activeTenant?.id,offset],enabled:open&&Boolean(activeTenant),queryFn:()=>{if(!activeTenant)throw Error("Kies een organisatie.");return mobileApi.libraryV2(activeTenant.id,"media",offset);}});
 return <View style={{gap:mobileSpacing.compact}}><Button variant="secondary" onPress={()=>setOpen(value=>!value)}>{open?"Beeldkiezer sluiten":"Eigen beeld kiezen"}</Button>{open?<>{query.error?<AppError error={query.error}/>:null}{query.data?.entries.filter(entry=>entry.assetReference&&entry.previewUrl).map(entry=><SurfaceCard key={entry.id}><AppText>{entry.title}</AppText><Image source={{uri:entry.previewUrl!}} style={{width:"100%",aspectRatio:16/9}}/><Button variant="secondary" onPress={()=>{if(entry.assetReference)onPick(entry.assetReference);setOpen(false);}}>Dit beeld gebruiken</Button></SurfaceCard>)}<Button variant="secondary" disabled={offset===0} onPress={()=>setOffset(Math.max(0,offset-48))}>Vorige</Button><Button variant="secondary" disabled={!query.data?.hasMore} onPress={()=>setOffset(offset+48)}>Volgende</Button></>:null}</View>;
}
