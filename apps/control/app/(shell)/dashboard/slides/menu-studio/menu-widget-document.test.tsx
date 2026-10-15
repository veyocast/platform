import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { menuDocumentV2Schema, type MenuDocumentV2 } from "@veyocast/contracts";
import { buildSitesMenuPresentation } from "@veyocast/content-templates/sites-dynamic-projector";
import { SitesStaticView } from "@veyocast/content-templates/sites-static-view";
import { sitesPresentationAssets, sitesPresentationPages } from "@veyocast/content-templates/sites-presentation-model";
import { createSitesSourceDesign } from "../../studio/sportlink/new/sites-source-design";
import { buildMenuWidgetDocument, menuLinkedIds, menuProductPlacement, menuWidgetLayout, parseMenuPriceMinor } from "./menu-widget-document";
import type {MenuStudioProductOption,MenuStudioMediaOption} from "./menu-studio-editor";
const id=(index:number)=>`10000000-0000-4000-8000-${String(index).padStart(12,"0")}`;
const product=(index:number):MenuStudioProductOption=>({id:id(index),sourceId:id(50),sourceKind:"twelve_excel",sourceRevision:"rev-2",name:index===1?"Koffie":"Cappuccino",priceCents:250,currency:"EUR",category:"Dranken",available:true,description:"",taxMode:"inclusive"});
const photo:MenuStudioMediaOption={id:id(60),assetVersion:"original",sha256:"a".repeat(64),name:"Clubfoto",url:"https://storage.invalid/verified-photo",kind:"image",mimeType:"image/png",tintable:false};
function fixture():MenuDocumentV2 {return {schemaVersion:"menu-document.v2",id:id(40),tenantId:id(41),revision:2,createdAt:"2026-10-14T12:00:00Z",updatedAt:"2026-10-14T12:00:00Z",assets:[],theme:{themeId:"fieldflow",themeVersion:"1.0.0",mode:"light",brand:{accent:"#ff8127"}},pages:[{id:"page-1",order:0,landscapeColumns:2,portraitColumns:2,blocks:[{id:"coffee-widget",type:"category",order:0,widget:{column:"right"},columns:2,labelOverride:"Warme dranken",subtitle:"Vers gezet",layout:menuWidgetLayout(),source:{source:"manual",sourceCategoryId:"coffee",sourceName:"Dranken"},productNodes:[{...menuProductPlacement(product(1),"coffee-product"),nameOverride:"Clubkoffie",column:2,secondaryLineItems:[{id:"coffee-note",kind:"free-text",label:"Met koekje",presentationOnly:true,order:0},{...menuProductPlacement(product(2),"related-product"),kind:"linked-product",order:1}]}]},{id:"photo-widget",type:"image",order:1,layout:menuWidgetLayout(),widget:{column:"left",aspectRatio:"9:16"},assetId:photo.id,caption:"Ons clubhuis",appearance:{fit:"contain",focalPoint:{x:.5,y:.5},opacity:1}}]},{id:"page-2",order:1,landscapeColumns:1,portraitColumns:1,blocks:[{id:"deal",type:"promo",order:0,layout:menuWidgetLayout(),widget:{column:"full"},title:"Koffiedeal",body:"Koffie met iets lekkers"}]}]};}
const design={...createSitesSourceDesign("menu","Kantine"),themeId:"onzetrots-tv" as const,menuWidgets:true,background:{kind:"tenant" as const,mediaAssetId:photo.id,checksumSha256:photo.sha256},accent:"#c12545",align:"right" as const,overlay:40,rowsPerPage:8};
describe("Menu widget persistence and display",()=>{
 it("roundtrips manual pages, image beside products, explicit product column, category copy and mixed sublines without rebuilding them",()=>{
  const source=fixture(),built=buildMenuWidgetDocument(source,[product(1),product(2)],design,[photo]);
  const reopened=menuDocumentV2Schema.parse(JSON.parse(JSON.stringify(built)));
  expect(reopened.pages).toHaveLength(2);expect(reopened.pages[0]?.blocks[0]).toMatchObject({labelOverride:"Warme dranken",subtitle:"Vers gezet",columns:2,widget:{column:"right"},productNodes:[{nameOverride:"Clubkoffie",column:2,secondaryLineItems:[{kind:"free-text",label:"Met koekje"},{kind:"linked-product",productRef:{sourceRevision:"rev-2"}}]}]});
  expect(menuLinkedIds(reopened)).toEqual([id(1),id(2)]);expect(source.assets).toEqual([]);
  const presentation=buildSitesMenuPresentation(reopened,design)!;if(presentation.kind!=="dynamic")throw Error("missing");
  expect(sitesPresentationPages(presentation)).toBe(2);expect(presentation.content.menuPages?.[0]?.widgets[0]).toMatchObject({column:"right",columns:2,rows:[{column:2,primary:"Clubkoffie",secondary:"Met koekje · Cappuccino",value:"€ 2,50"}]});
  expect(sitesPresentationAssets(presentation)).toContainEqual(design.background);
  const html=renderToStaticMarkup(<SitesStaticView presentation={presentation} page={0} resolveAsset={asset=>asset.kind==="system"?asset.path:photo.url}/>);
  expect(html).toContain('data-column="right"');expect(html).toContain('<strong>Clubkoffie</strong><small>Met koekje · Cappuccino</small>');expect(html).toContain('object-fit:contain');expect(html).toContain('opacity:0.4');expect(html).toContain('--vm-accent:#c12545');expect(html).toContain('text-align:right');
  expect(renderToStaticMarkup(<SitesStaticView presentation={presentation} page={1}/>)).toContain("Koffiedeal");
 });
 it("keeps every product when a two-column widget requires multiple screen pages",()=>{
  const source=fixture();source.pages=source.pages.slice(0,1);source.pages[0]!.blocks=source.pages[0]!.blocks.slice(0,1);const block=source.pages[0]!.blocks[0]!;if(block.type!=="category")throw Error("missing");
  const products=Array.from({length:22},(_,index)=>({...product(index+1),name:`Product ${index+1}`}));block.productNodes=products.map((item,index)=>({...menuProductPlacement(item,`row-${index}`),order:index,column:index<11?1:2}));
  const built=buildMenuWidgetDocument(source,products,{...design,rowsPerPage:4,scale:140},[photo]),presentation=buildSitesMenuPresentation(built)!;
  if(presentation.kind!=="dynamic")throw Error("missing");const rendered=presentation.content.menuPages!.flatMap(page=>page.widgets.flatMap(widget=>widget.rows));
  expect(rendered).toHaveLength(22);expect(new Set(rendered.map(row=>row.id)).size).toBe(22);expect(sitesPresentationPages(presentation)).toBeGreaterThan(1);
 });

 it("preserves edited amounts and unrestricted sublines while refreshing catalog snapshots",()=>{
  const source=fixture(),block=source.pages[0]!.blocks[0]!;if(block.type!=="category")throw Error("fixture");
  const node=block.productNodes[0]!;if(node.kind!=="product")throw Error("fixture");
  const copy="Deze vrije toelichting is langer dan vierentwintig tekens. ".repeat(40);
  node.priceOverrideMinor=375;node.secondaryLineItems=[{id:"long-copy",kind:"free-text",order:0,presentationOnly:true,label:copy}];
  const built=buildMenuWidgetDocument(source,[{...product(1),priceCents:300},product(2)],design,[photo]);
  const reopened=menuDocumentV2Schema.parse(JSON.parse(JSON.stringify(built))),presentation=buildSitesMenuPresentation(reopened)!;
  expect(reopened.pages[0]?.blocks[0]).toMatchObject({productNodes:[{priceOverrideMinor:375,snapshotFallback:{price:{amountMinor:300}}}]});
  if(presentation.kind!=="dynamic")throw Error("missing");
  expect(presentation.content.menuPages?.[0]?.widgets[0]?.rows[0]).toMatchObject({value:"€ 3,75",secondary:copy.trim()});
 });
 it("fills automatic products down column one before two, without reshuffling existing rows",()=>{
  const source=fixture();source.pages=source.pages.slice(0,1);source.pages[0]!.blocks=source.pages[0]!.blocks.slice(0,1);const block=source.pages[0]!.blocks[0]!;if(block.type!=="category")throw Error("fixture");
  block.widget={column:"full"};
  const products=Array.from({length:12},(_,index)=>({...product(index+1),name:`Product ${index+1}`}));
  const project=(count:number)=>{block.productNodes=products.slice(0,count).map((item,index)=>({...menuProductPlacement(item,`row-${index}`),order:index}));const presentation=buildSitesMenuPresentation(buildMenuWidgetDocument(source,products,{...design,rowsPerPage:3,orientation:"portrait",scale:100},[photo]))!;if(presentation.kind!=="dynamic")throw Error("missing");return presentation.content.menuPages!.flatMap(page=>page.widgets.flatMap(widget=>widget.rows));};
  expect(project(1).map(row=>row.column)).toEqual([1]);expect(project(2).map(row=>row.column)).toEqual([1,1]);
  const rows=project(12);expect(rows.map(row=>row.id)).toEqual(products.map((_,index)=>`row-${index}`));expect(rows.map(row=>row.column)).toEqual([1,1,1,2,2,2,1,1,1,2,2,2]);
 });
 it("parses decimal prices as exact cents and rejects ambiguous or invalid input",()=>{
  for(const [input,expected]of [["3,50",350],["3.5",350],["0",0],["0,01",1],["9999999,99",999999999],[" 2 ",200]] as const)expect(parseMenuPriceMinor(input)).toBe(expected);
  for(const input of ["","-1","3,555","1e3","3,50 euro","10000000","NaN"])expect(parseMenuPriceMinor(input)).toBeNull();
 });
 it("allows a media-only menu and rejects missing product or replaced media selections before saving",()=>{
  const source=fixture();source.pages[0]!.blocks=source.pages[0]!.blocks.slice(1);expect(buildMenuWidgetDocument(source,[],design,[photo]).pages).toHaveLength(2);
  expect(()=>buildMenuWidgetDocument(fixture(),[product(1)],design,[photo])).toThrow("product ontbreekt");
  expect(()=>buildMenuWidgetDocument(fixture(),[product(1),product(2)],design,[{...photo,sha256:"b".repeat(64)}])).toThrow("achtergrond is gewijzigd");
 });
});
