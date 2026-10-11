import {describe,expect,it} from "vitest";
import {sitesDynamicConfigurationSchema,sitesPresentationSchema,type SitesPresentation} from "@veyocast/contracts";
import {resolveSitesDynamicPage,resolveSitesStudioPage} from "../src/sites-presentation-model";
const config={schemaVersion:1,rendererVersion:"sites-v11",sourceRevision:"b1cae899af19fc39908217253094c5240d7359fc",themeId:"onzetrots-tv",provider:"menu",orientation:"landscape",title:"Kantine"};
describe("trusted Sites page composition",()=>{
 it("retains the original featured result across all pages without replacing match data with display text",()=>{
  const input=sitesPresentationSchema.parse({kind:"studio",schemaVersion:1,rendererVersion:"sites-v11",sourceRevision:config.sourceRevision,slide:{id:"result-fixture",name:"Uitslagen",title:"Echte uitslagen",time:"",subtitle:"",location:"",duration:15,color:"#123f8d",background:"#063893",bold:true,italic:false,align:"left",size:64,context:true,showLocation:false,animation:"Geen",transition:"Rustig",orientation:"landscape",themeId:"onzetrots-tv",tv:{kind:"uitslagen",title:"Uitslagen",values:["Eigen team"],rows:Array.from({length:17},(_,i)=>({id:`row-${i}`,primary:`Titel ${i}`,home:`Thuis ${i}`,away:`Uit ${i}`,homeScore:String(i),awayScore:"1",own:i===9}))}}});
  if(input.kind!=="studio")throw Error("Fixture kind");
  expect(resolveSitesStudioPage(input,undefined,0).content?.rows).toHaveLength(8);
  const last=resolveSitesStudioPage(input,undefined,2);expect(last.content?.rows.map(row=>row.id)).toEqual(["row-16"]);expect(last.content?.match).toEqual({home:"Thuis 9",away:"Uit 9",homeScore:"9",awayScore:"1",label:"Eigen team"});expect(last.pages).toBe(3);expect(input.slide.tv?.rows).toHaveLength(17);
 });
 it("defaults legacy flags and rejects mistyped additive flags",()=>{expect(sitesDynamicConfigurationSchema.parse(config)).toMatchObject({showCategories:true,ledTemplate:"match-center"});for(const values of [{showCategories:"false"},{ledTemplate:"unknown"},{ledTemplate:false}])expect(sitesDynamicConfigurationSchema.safeParse({...config,...values}).success).toBe(false);});
 it("hides category labels while preserving the actual product variant and immutable input",()=>{
  const input=sitesPresentationSchema.parse({kind:"dynamic",configuration:{...config,showCategories:false},content:{kind:"kantine",title:"Kantine",rows:[{id:"product",primary:"Koffie",secondary:"Groot",tag:"Warme dranken",value:"€ 2,50"}]}}) as Extract<SitesPresentation,{kind:"dynamic"}>;
  const resolved=resolveSitesDynamicPage(input);expect(resolved.content.rows[0]).toMatchObject({primary:"Koffie",secondary:"Groot",tag:"Assortiment",value:"€ 2,50"});expect(resolved.design.rows[0]?.secondary).toBe("Groot");expect(input.content.rows[0]?.tag).toBe("Warme dranken");
 });
 it("passes the selected LED scoreboard mode to the shared renderer",()=>{const input=sitesPresentationSchema.parse({kind:"dynamic",configuration:{...config,provider:"led-scores",ledTemplate:"scoreboard"},content:{kind:"score",title:"Stand",rows:[]}}) as Extract<SitesPresentation,{kind:"dynamic"}>;expect(resolveSitesDynamicPage(input).design.config.template).toBe("scoreboard");});
 it("keeps the LED-only fit setting from changing Menu or Sportlink TV backgrounds",()=>{
  for(const provider of ["menu","sportlink","led-scores"]){const input=sitesPresentationSchema.parse({kind:"dynamic",configuration:{...config,provider,backgroundFit:"contain"},content:{kind:"kantine",title:"Kantine",rows:[]}})as Extract<SitesPresentation,{kind:"dynamic"}>;expect(resolveSitesDynamicPage(input).content.backgroundFit).toBe(provider==="led-scores"?"contain":undefined);if(provider!=="led-scores")expect(resolveSitesDynamicPage({...input,content:{...input.content,backgroundFit:"cover"}}).content.backgroundFit).toBe("cover");expect(input.configuration.backgroundFit).toBe("contain");}
 });
});
