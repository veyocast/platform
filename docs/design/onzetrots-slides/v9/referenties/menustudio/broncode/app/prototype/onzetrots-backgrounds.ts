// Art-directed OnzeTrots compositions based on the five original landmark references.
export const ONZETROTS_BACKGROUNDS = [
 {id:'onzetrots-clubhuis',name:'Duindorp SV · Clubhuis',image:'/onzetrots/premium/clubhuis.png'},
 {id:'onzetrots-havenlicht',name:'Het groene havenlicht',image:'/onzetrots/premium/havenlicht.png'},
 {id:'onzetrots-kerk',name:'Kerk in Duindorp',image:'/onzetrots/premium/kerk.png'},
 {id:'onzetrots-luchtfoto',name:'Duindorp van boven',image:'/onzetrots/premium/duindorp-luchtfoto.png'},
 {id:'onzetrots-poort',name:'Historische poort',image:'/onzetrots/premium/historische-poort.png'},
];

const legacyBackgrounds:Record<string,string>={
 '/onzetrots/houtrust-brush.webp':'/onzetrots/premium/clubhuis.png',
 '/onzetrots/paint-wall.webp':'/onzetrots/premium/historische-poort.png',
 '/onzetrots/originals/clubhuis.jpg':'/onzetrots/premium/clubhuis.png',
 '/onzetrots/originals/havenlicht.jpg':'/onzetrots/premium/havenlicht.png',
 '/onzetrots/originals/kerk.jpg':'/onzetrots/premium/kerk.png',
 '/onzetrots/originals/duindorp-luchtfoto.jpg':'/onzetrots/premium/duindorp-luchtfoto.png',
 '/onzetrots/originals/historische-poort.jpg':'/onzetrots/premium/historische-poort.png',
 '/onzetrots/brush/clubhuis.svg':'/onzetrots/premium/clubhuis.png',
 '/onzetrots/brush/havenlicht.svg':'/onzetrots/premium/havenlicht.png',
 '/onzetrots/brush/kerk.svg':'/onzetrots/premium/kerk.png',
 '/onzetrots/brush/duindorp-luchtfoto.svg':'/onzetrots/premium/duindorp-luchtfoto.png',
 '/onzetrots/brush/historische-poort.svg':'/onzetrots/premium/historische-poort.png',
};

// Preserve the chosen landmark in saved designs and playlist snapshots.
// Only known built-in paths change; custom images and uploads retain their identity.
export function resolveOnzeTrotsBackground(value:string):string {
 return Object.prototype.hasOwnProperty.call(legacyBackgrounds,value)?legacyBackgrounds[value]:value;
}
