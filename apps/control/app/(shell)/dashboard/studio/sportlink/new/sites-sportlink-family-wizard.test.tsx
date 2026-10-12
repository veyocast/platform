import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sportDynamicSlideTypes, type ThemeSelection } from "@veyocast/contracts";
vi.mock("./sites-sportlink-family-actions",()=>({createSitesSportlinkFamily:vi.fn(),previewSitesSportlinkFamily:vi.fn()}));
vi.stubGlobal("React",React);
import { SitesSportlinkFamilyWizard } from "./sites-sportlink-family-wizard";
import { sitesSportlinkFamilyLabels } from "./sites-sportlink-family-model";
const theme:ThemeSelection={accent:"#2459ED",categoryOverrides:[],modePolicy:{kind:"fixed",mode:"light"},ref:{catalog:"v2",id:"fieldflow",version:"1.0.0"},support:null};
const defaults={sources:[{id:"actual-source",name:"Actieve clubbron"}],teams:[],media:[],themeSelection:theme};
describe("Werkelijke familiewizard toont alleen beschikbare bronpaden",()=>{
 it("rendert alle zeventien familiekeuzes en maakt beschikbare templates bereikbaar",()=>{
  const html=renderToStaticMarkup(createElement(SitesSportlinkFamilyWizard,{...defaults,templates:sportDynamicSlideTypes.map((slideType,index)=>({slideType,orientation:"landscape",versionId:String(index)}))}));
  const buttons=html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gu)??[];expect(buttons).toHaveLength(17);for(const label of Object.values(sitesSportlinkFamilyLabels))expect(buttons.some(button=>button.includes(label)&&!button.includes("disabled"))).toBe(true);
  expect(html).not.toContain("Sophie de Vries");expect(html).not.toContain("Milan van den Berg");
 });
 it("laat ontbrekende templates zichtbaar maar onbeschikbaar en activeert zonder bron geen families",()=>{
  const html=renderToStaticMarkup(createElement(SitesSportlinkFamilyWizard,{...defaults,templates:[{slideType:"sport_program",orientation:"landscape",versionId:"actual-template"}]}));
  const buttons=html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gu)??[];expect(buttons.filter(button=>button.includes("disabled"))).toHaveLength(16);
  const empty=renderToStaticMarkup(createElement(SitesSportlinkFamilyWizard,{...defaults,sources:[],templates:sportDynamicSlideTypes.map(slideType=>({slideType,orientation:"landscape",versionId:"actual-template"}))}));expect((empty.match(/<button\b[^>]*>/gu)??[]).every(button=>button.includes("disabled"))).toBe(true);
 });
});
