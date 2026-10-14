/** Actual renderer fixture for the bounded LG browser gate; never imported by runtime routes. */
import {sitesPresentationSchema,sitesCurrentPresentationSourceRevision} from "@veyocast/contracts";
import {buildSitesMarkup} from "./player-sites-markup";
import systemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
const orientation=process.argv[2]==="portrait"?"portrait":"landscape";
const photo=systemAssets.files.find(asset=>asset.path==="/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp")!;
const presentation=sitesPresentationSchema.parse({kind:"dynamic",configuration:{schemaVersion:1,rendererVersion:"sites-v17",sourceRevision:sitesCurrentPresentationSourceRevision,provider:"menu",unifiedKind:"kantine",themeId:"onzetrots-tv",orientation,title:"Onze kantine",accent:"#c12545",menuWidgets:true},content:{kind:"kantine",title:"Onze kantine",rows:[],menuPages:[{id:"page-1",columns:2,widgets:[{id:"products",type:"category",column:"right",columns:1,title:"Warme dranken",subtitle:"Vers gezet",rows:[{id:"coffee",column:1,primary:"Clubkoffie",secondary:"Met koekje · Cappuccino",value:"€ 2,50"}]},{id:"photo",type:"image",column:"left",columns:1,title:"Clubhuis",rows:[],image:{kind:"system",path:photo.path,checksumSha256:photo.sha256},aspectRatio:"9:16",fit:"cover"}]},{id:"page-2",columns:1,widgets:[{id:"deal",type:"promo",column:"full",columns:1,title:"Koffiedeal",subtitle:"Koffie met iets lekkers",rows:[]}]}]}});
process.stdout.write(JSON.stringify(await buildSitesMarkup(presentation,{},30)));
