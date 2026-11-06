import type { EditorialColorTokens, ThemeMode } from "@veyocast/contracts";
import { ONZETROTS_FONT_FACE_CSS, ONZETROTS_HEADER_FONT_FAMILY, ONZETROTS_PRIMARY } from "./onzetrots-brand";

export const onzeTrotsThemeFontCss=ONZETROTS_FONT_FACE_CSS+['h1','h2','h3','h4','[data-role="heading"]'].map(selector=>`[data-generic-onzetrots="true"] ${selector}`).join(',')+`{font-family:${ONZETROTS_HEADER_FONT_FAMILY},cursive!important;font-weight:400!important;font-style:normal!important;font-synthesis:none}`;

/** Runtime projection; saved appearance and publication fields stay intact. */
export function onzeTrotsThemeCssVariables(themeId:string):Record<string,string|number>{
  return themeId==='onzetrots-tv'?{
    '--vc-theme-accent':ONZETROTS_PRIMARY,
    '--vc-theme-accent-ink':'#ffffff',
    '--vc-theme-display-font':`"${ONZETROTS_HEADER_FONT_FAMILY}"`,
    '--vc-theme-display-weight':400,
  }:{};
}

export function onzeTrotsThemeTokens(themeId:string,mode:ThemeMode,tokens:EditorialColorTokens):EditorialColorTokens{
  return themeId==='onzetrots-tv'?{...tokens,accent:ONZETROTS_PRIMARY,accentSoft:mode==='dark'?'rgba(3,67,138,0.2)':'rgba(3,67,138,0.14)',textOnAccent:'#ffffff'}:tokens;
}

/** A ready frame must own a loaded header face, rather than a fallback font. */
export async function prepareThemeFonts(themeId:string,fonts:Pick<FontFaceSet,'load'|'ready'>|undefined=typeof document==='undefined'?undefined:document.fonts):Promise<void>{
  if(themeId==='onzetrots-tv'){
    if(!fonts)throw Error('ONZETROTS_HEADER_FONT_UNAVAILABLE');
    const faces=await fonts.load(`400 16px ${ONZETROTS_HEADER_FONT_FAMILY}`);
    if(!faces.length||faces.some(face=>face.status!=='loaded'))throw Error('ONZETROTS_HEADER_FONT_UNAVAILABLE');
  }
  if(fonts)await fonts.ready;
}
