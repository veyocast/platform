export type ScreenThemeId = 'fieldflow' | 'onzetrots-tv';
export const ONZETROTS_TV_ASSETS = '/onzetrots-tv/assets';
export const ONZETROTS_TV_BACKGROUNDS = [
  {id:'tv-wall',name:'OnzeTrots · Clubmuur',image:`${ONZETROTS_TV_ASSETS}/clubmuur-wall.webp`},
  {id:'tv-players',name:'OnzeTrots · Samen',image:`${ONZETROTS_TV_ASSETS}/clubmuur-players/trio-1280.webp`},
  {id:'tv-joy',name:'OnzeTrots · Juichen',image:`${ONZETROTS_TV_ASSETS}/clubmuur-portraits-v14/05-juichen-1280.webp`},
  {id:'tv-match',name:'OnzeTrots · Strijd',image:`${ONZETROTS_TV_ASSETS}/clubmuur-portraits-v17/10-strijd-1280.webp`},
];
export const SCREEN_THEMES = [
  {id:'fieldflow' as const,name:'FieldFlow',description:'De vertrouwde, rustige clubstijl.'},
  {id:'onzetrots-tv' as const,name:'OnzeTrots TV',description:'Clubblauw, grote koppen en de Clubmuur-collectie.'},
];
export type OnzeTrotsTvKind = 'wedstrijd'|'programma'|'uitslagen'|'stand'|'kantine'|'clubnieuws'|'partners'|'welkom'|'score'|'goal'|'lineup'|'generic';
export type OnzeTrotsTvRow = {
  id:string;primary:string;secondary?:string;value?:string;rank?:number;image?:string;
  home?:string;away?:string;time?:string;field?:string;tag?:string;own?:boolean;homeOwn?:boolean;awayOwn?:boolean;
  homeScore?:string;awayScore?:string;played?:string;won?:string;drawn?:string;lost?:string;difference?:string;points?:string;form?:string[];
};
export type OnzeTrotsTvContent = {
  kind:OnzeTrotsTvKind;title:string;subtitle?:string;eyebrow?:string;clubName?:string;logo?:string;
  background?:string;heroImage?:string;time?:string;location?:string;footer?:string;
  rows:OnzeTrotsTvRow[];values?:string[];combo?:{name:string;price:string;note?:string};
  match?:{home:string;away:string;homeScore?:string;awayScore?:string;homeLogo?:string;awayLogo?:string;clock?:string;label?:string;homeLabel?:string;awayLabel?:string;homeOwn?:boolean;awayOwn?:boolean};
  standingColumns?:string[];page?:number;pages?:number;scale?:number;overlay?:number;align?:'left'|'center'|'right';safeArea?:number;accent?:string;
  titleScale?:number;scoreScale?:number;logoScale?:number;teamScale?:number;showBranding?:boolean;
  backgroundFit?:'cover'|'contain';showSceneLabel?:boolean;timeline?:OnzeTrotsTvRow[];layout?:'full'|'split'|'sidebar';
};
