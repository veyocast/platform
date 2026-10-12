/** Browser-test fixture: execute the exact shared JSX with the normal React renderer, outside Playwright's JSX transform. */
import {renderToStaticMarkup} from "react-dom/server";
import {sitesPresentationSchema} from "@veyocast/contracts";
import {SitesStaticView} from "@veyocast/content-templates/sites-static-view";
import {sitesPresentationCss} from "@veyocast/content-templates/sites-styles";
import systemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";

const orientation=process.argv[2];const themeId=process.argv[3];const goal=process.argv[4]==="goal";
const presentation=sitesPresentationSchema.parse({kind:"dynamic",configuration:{schemaVersion:1,rendererVersion:"sites-v11",sourceRevision:systemAssets.sourceRevision,themeId,orientation,provider:"led-scores",title:goal?"GOALLL!":"De tussenstand",ledMoment:goal?"goal":"live",seconds:30,showClock:false},content:{kind:goal?"goal":"score",title:goal?"GOALLL!":"De tussenstand",subtitle:"Samen langs de lijn",rows:[{id:"home",primary:"Duindorp sv 1",value:"12"},{id:"away",primary:"Tegenstander met een langere clubnaam 1",value:"3"}],match:{home:"Duindorp sv 1",away:"Tegenstander met een langere clubnaam 1",homeScore:"12",awayScore:"3"}}});
const tokens=new Map<string,string>();const token=(path:string)=>{const asset=systemAssets.files.find(item=>item.path===path);if(!asset)throw new Error("Unknown locked fixture asset");const value=`VEYOSITES_ASSET_${asset.sha256}`;tokens.set(value,`/__veyocast-player-cache/${asset.sha256}`);return value;};
const css=sitesPresentationCss.replace(/url\(["']?(\/[^"')]+)["']?\)/g,(_match,path:string)=>`url("${token(path)}")`);
const html=renderToStaticMarkup(SitesStaticView({presentation,includeStyles:false,active:true,resolveAsset:asset=>asset.kind==="system"?token(asset.path):undefined}));
process.stdout.write(JSON.stringify({rendererVersion:"sites-v11",sourceRevision:systemAssets.sourceRevision,orientation,width:orientation==="portrait"?1080:1920,height:orientation==="portrait"?1920:1080,pageDurationSeconds:30,pages:[html],css,assetTokens:[...tokens].map(([token,cacheKey])=>({token,cacheKey}))}));
