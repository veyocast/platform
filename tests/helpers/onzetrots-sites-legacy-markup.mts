import {sitesPresentationSchema,sitesCurrentPresentationSourceRevision} from "../../packages/contracts/src/sites-presentation";
import {buildSitesMarkup} from "../../apps/player/app/_lib/player-sites-markup";
import {createSitesPresentationCapture} from "../../apps/media-worker/src/sites-dom-capture";
import {writeFile} from "node:fs/promises";

// Run outside Playwright's JSX transport transform; exercise actual server markup.
const orientation=process.argv[2];
if(orientation!=="landscape"&&orientation!=="portrait")throw Error("Invalid fixture orientation");
const input=sitesPresentationSchema.parse({kind:"dynamic",configuration:{schemaVersion:1,rendererVersion:"sites-v17",sourceRevision:sitesCurrentPresentationSourceRevision,themeId:"onzetrots-tv",orientation,provider:"menu",unifiedKind:"kantine",title:"Onze club verwelkomt alle vrijwilligers en bezoekers voor een bijzondere wedstrijddag met de hele vereniging",accent:"#aa1133",menuWidgets:true},content:{kind:"kantine",title:"Onze kantine",clubName:"Eigen club",rows:[],menuPages:[{id:"page-1",columns:1,widgets:[{id:"coffee",type:"category",column:"full",columns:1,title:"Warme dranken",rows:[{id:"coffee",column:1,primary:"Clubkoffie",value:"€ 2,50"}]}]}]}});
const frozen=JSON.stringify(input),markup=await buildSitesMarkup(input,{},15);
let measurement:unknown;
if(process.argv[3]){
 const capture=await createSitesPresentationCapture({presentation:input,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,onMeasure:value=>{measurement=value;}});
 try{await writeFile(process.argv[3],await capture.renderPng(1200));}finally{await capture.close();}
}
process.stdout.write(JSON.stringify({markup,input,measurement,unchanged:JSON.stringify(input)===frozen}));
