export type ScreenLayout={kind:'full'|'sidebar'|'bottom'|'three';main:string;side:string;bottom:string;mainShare:number;footerShare:number};
export type Screen={id:string;name:string;group:string;status:'active'|'online'|'offline';playlist:string;orientation:string;layout?:ScreenLayout};
export type Group={name:string;members:string[]};
const names=['Kantine TV 1','Kantine TV 2','Entree','Sponsorwand','Kleedkamer 1','Kleedkamer 2','Kleedkamer 3','Kleedkamer 4','Tribune links','Tribune rechts','Buitenbar','Terras','Veld 1','Veld 2','Jeugdhonk','Bestuurskamer','Clubhuis hal','Clubhuis zaal','Materiaalruimte','Ontvangst'];
export const initialScreens:Screen[]=names.map((name,i)=>({id:`screen-${i+1}`,name,group:i<2?'Kantine':i===2?'Entree':i===3?'Kantine':i<8?'Kleedkamers':i<10?'Tribune':i<14?'Buiten':i===15?'Bestuur':'Clubhuis',status:i<18?'active':'online',playlist:i<18?(i%2?'Clubhuis — Vandaag':'Wedstrijddag'):'',orientation:'Liggend (16:9)'}));
const group=(name:string,ids:number[]):Group=>({name,members:ids.map(id=>`screen-${id}`)});
export const initialGroups=[group('Clubhuis',[1,2,3,17,18]),group('Kleedkamers',[5,6,7,8]),group('Kantine',[1,2,4]),group('Buiten',[11,12,13,14,15,16,19,20]),group('Entree',[3]),group('Tribune',[9,10]),group('Bestuur',[16])];
