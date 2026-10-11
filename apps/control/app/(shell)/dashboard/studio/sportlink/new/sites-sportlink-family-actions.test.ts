import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeSelection } from "@veyocast/contracts";
const f=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),template:vi.fn(),preview:vi.fn()}));
vi.mock("../../../../../../lib/control-session",()=>({requireTenantControlSession:f.session}));
vi.mock("../../../../../../lib/supabase/server",()=>({createControlSupabaseClient:async()=>({rpc:f.rpc,from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:f.template};return query;}})}));
vi.mock("./sites-sportlink-preview-data",()=>({loadCanonicalSitesSportlinkPreview:f.preview}));
import { createSitesSportlinkFamily, previewSitesSportlinkFamily } from "./sites-sportlink-family-actions";
import { buildSitesSportlinkFamilyDraft, sitesSportlinkAutoContext } from "./sites-sportlink-family-model";
import { createSitesSourceDesign } from "./sites-source-design";
const tenant="a1910000-0000-4000-8000-000000006201",source="a1910000-0000-4000-8000-000000006202",template="a1910000-0000-4000-8000-000000006203",command="a1910000-0000-4000-8000-000000006204",slide="a1910000-0000-4000-8000-000000006205",snapshot="a1910000-0000-4000-8000-000000006206";
const theme:ThemeSelection={accent:"#2459ED",categoryOverrides:[],modePolicy:{kind:"fixed",mode:"light"},ref:{catalog:"v2",id:"fieldflow",version:"1.0.0"},support:null};
const draft=()=>buildSitesSportlinkFamilyDraft({family:"sport_trainings",name:"Trainingen",templateVersionId:template,design:createSitesSourceDesign("sportlink","Trainingen"),contexts:[sitesSportlinkAutoContext("real-provider-team")],allTeams:false,themeSelection:theme});
beforeEach(()=>{vi.resetAllMocks();f.session.mockResolvedValue({tenantId:tenant});f.template.mockResolvedValue({data:{slide_type:"sport_trainings",orientation:"landscape"},error:null});f.rpc.mockResolvedValue({data:{slideId:slide,snapshotId:snapshot},error:null});f.preview.mockResolvedValue({ok:false,message:"Geen actuele brongegevens."});});
describe("Familiewizard serveracties bewaken tenant en bevestigd resultaat",()=>{
 it("vereist serverrechten vóór preview of save en heeft geen preview-writepad",async()=>{
  f.session.mockRejectedValue(new Error("DENIED"));await expect(previewSitesSportlinkFamily(source,draft())).rejects.toThrow("DENIED");await expect(createSitesSportlinkFamily(source,draft(),command)).rejects.toThrow("DENIED");expect(f.rpc).not.toHaveBeenCalled();expect(f.preview).not.toHaveBeenCalled();
 });
 it("previewt de brongebonden canonical selectie en maakt geen render of ontwerp aan",async()=>{
  expect(await previewSitesSportlinkFamily(source,draft())).toEqual({ok:false,message:"Geen actuele brongegevens."});
  expect(f.preview).toHaveBeenCalledWith(expect.objectContaining({sourceId:source,expectedSlideType:"sport_trainings",configuration:expect.objectContaining({sourceTeamSelection:{mode:"selected",teamContexts:[sitesSportlinkAutoContext("real-provider-team")]}})}));expect(f.rpc).not.toHaveBeenCalled();
 });
 it("slaat alleen voor de actieve tenant met dezelfde idempotencysleutel op en geeft echte IDs terug",async()=>{
  expect(await createSitesSportlinkFamily(source,draft(),command)).toEqual({ok:true,slideId:slide,snapshotId:snapshot});
  expect(f.session).toHaveBeenCalledWith("tenant.dynamic_slide.write");expect(f.rpc).toHaveBeenCalledWith("create_sites_sportlink_family_v1",{p_tenant_id:tenant,p_data_source_id:source,p_name:"Trainingen",p_template_version_id:template,p_configuration:draft().configuration,p_idempotency_key:command});
 });
 it("weigert een template van een andere familie zonder write",async()=>{
  f.template.mockResolvedValue({data:{slide_type:"sport_program",orientation:"landscape"},error:null});expect(await createSitesSportlinkFamily(source,draft(),command)).toMatchObject({ok:false,message:expect.stringContaining("familie of formaat")});expect(f.rpc).not.toHaveBeenCalled();
 });
 it("houdt modulefouten en transportuitval zichtbaar en hergebruikt de sleutel bij herstel",async()=>{
  f.rpc.mockResolvedValueOnce({error:{code:"55000"},data:null});expect(await createSitesSportlinkFamily(source,draft(),command)).toMatchObject({ok:false,message:expect.stringContaining("nog niet actief")});
  f.rpc.mockRejectedValueOnce(new Error("raw-sensitive-diagnostic"));expect(await createSitesSportlinkFamily(source,draft(),command)).toMatchObject({ok:false,message:expect.stringContaining("dezelfde sleutel")});
  expect(await createSitesSportlinkFamily(source,draft(),command)).toMatchObject({ok:true});expect(f.rpc.mock.calls.every(([,args])=>args.p_idempotency_key===command)).toBe(true);
 });
 it("beschouwt ontbrekende bevestiging niet als opgeslagen en weigert ongetypte invoer vóór RPC",async()=>{
  f.rpc.mockResolvedValue({data:{slideId:slide},error:null});expect(await createSitesSportlinkFamily(source,draft(),command)).toMatchObject({ok:false,message:expect.stringContaining("nog niet bevestigd")});f.rpc.mockClear();expect(await createSitesSportlinkFamily(source,{...draft(),configuration:{...draft().configuration,html:"<script>bad</script>"}},command)).toMatchObject({ok:false});expect(f.rpc).not.toHaveBeenCalled();
 });
});
