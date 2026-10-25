import {beforeEach,describe,it,expect,vi} from 'vitest';
import {sitesDynamicConfigurationSchema} from '@veyocast/contracts';
const f=vi.hoisted(()=>({session:null as unknown,row:null as unknown,queries:[] as Array<[string,string]>,save:vi.fn(),publish:vi.fn(),library:vi.fn(),client:vi.fn()}));
vi.mock('../../../../lib/control-session',()=>({getControlSession:async()=>f.session}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:f.client}));
vi.mock('../../../(shell)/dashboard/playlists/library',()=>({loadPublisherLibrary:f.library}));
vi.mock('../../../(shell)/dashboard/slides/menu-studio/actions',()=>({saveMenuStudioCommand:f.save,publishMenuStudio:f.publish}));
import {GET,POST} from './route';
const tenant='10000000-0000-4000-8000-000000000290',design='20000000-0000-4000-8000-000000000290',key='30000000-0000-4000-8000-000000000290';
const session={isLive:true,tenantId:tenant,tenantStatus:'active',capabilities:['tenant.dynamic_slide.read','tenant.dynamic_slide.write','tenant.playlist.write']};
const config=sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:'sites-v17',sourceRevision:'6800bc858436ba0843eaea89b682cd5b43c3521d',themeId:'onzetrots-tv',orientation:'portrait',provider:'menu',unifiedKind:'kantine',menuWidgets:true,title:'Ons menu'});
const document={schemaVersion:'menu-document.v2',id:design,tenantId:tenant,revision:2,title:'Ons menu',createdAt:'2026-10-24T12:00:00Z',updatedAt:'2026-10-24T12:00:00Z',assets:[],pages:[{id:'page-1',order:0,blocks:[]}],sitesConfiguration:config,theme:{themeId:'onzetrots-tv',themeVersion:'11.0.0',mode:'light',brand:{accent:'#03438a'}}};
const request=(body:unknown={designId:design,operationId:key},origin='https://control.example')=>new Request('https://control.example/api/publisher/library',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();f.session=session;f.row={configuration_json:document,active_draft_version_id:key};f.queries=[];
 const query={select:()=>query,eq:(field:string,value:string)=>{f.queries.push([field,value]);return query;},in:()=>query,is:()=>query,maybeSingle:async()=>({data:f.row,error:null})};
 f.client.mockResolvedValue({from:()=>query});f.save.mockResolvedValue({ok:true,document:{...document,revision:3,sitesConfiguration:{...config,onzeTrotsStyle:'v10-barlow-light'}}});f.publish.mockResolvedValue({ok:true});
 f.library.mockResolvedValue({designs:[],sourceState:{pendingDraft:true,processing:false,href:`/dashboard/slides/menu-studio/${design}`}});
});
describe('explicit preparation of saved menu prices',()=>{
 it('rejects missing auth, inactive tenant, foreign origin and either missing write capability before any command',async()=>{
  for(const value of [null,{...session,isLive:false},{...session,tenantStatus:'paused'},{...session,capabilities:['tenant.playlist.write']},{...session,capabilities:['tenant.dynamic_slide.write']}]){
   f.session=value;expect([401,403]).toContain((await POST(request())).status);
  }
  f.session=session;expect((await POST(request(undefined,'https://foreign.example'))).status).toBe(403);
  expect(f.client).not.toHaveBeenCalled();expect(f.save).not.toHaveBeenCalled();expect(f.publish).not.toHaveBeenCalled();
 });
 it('uses the authenticated tenant and updates only the saved style before preparing its exact acknowledged revision',async()=>{
  const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});
  expect(f.queries).toEqual([['tenant_id',tenant],['id',design]]);
  expect(f.save).toHaveBeenCalledWith({slideId:design,command:{baseRevision:2,operationId:key,operation:{kind:'set-sites-configuration',sitesConfiguration:{...config,onzeTrotsStyle:'v10-barlow-light'}}}});
  expect(f.publish).toHaveBeenCalledWith({slideId:design,expectedRevision:3,operationId:key});
  expect(document.revision).toBe(2);expect(document.sitesConfiguration.onzeTrotsStyle).toBeUndefined();
 });
 it('keeps an already tagged dark style and reuses the original saved document revision',async()=>{
  f.row={configuration_json:{...document,sitesConfiguration:{...config,onzeTrotsStyle:'v10-barlow-dark'}},active_draft_version_id:key};
  expect((await POST(request())).status).toBe(200);expect(f.save).not.toHaveBeenCalled();expect(f.publish).toHaveBeenCalledWith({slideId:design,expectedRevision:2,operationId:key});
 });
 it('upgrades an explicitly prepared historical dark menu while preserving its selected appearance',async()=>{
  f.row={configuration_json:{...document,sitesConfiguration:{...config,onzeTrotsStyle:'v9-marker-dark'}},active_draft_version_id:key};
  expect((await POST(request())).status).toBe(200);expect(f.save).toHaveBeenCalledWith(expect.objectContaining({command:expect.objectContaining({operation:expect.objectContaining({sitesConfiguration:expect.objectContaining({onzeTrotsStyle:'v10-barlow-dark'})})})}));
 });
 it('never prepares missing/foreign sources or continues after a concurrent edit refusal',async()=>{
  f.row=null;expect((await POST(request())).status).toBe(404);expect(f.publish).not.toHaveBeenCalled();
  f.row={configuration_json:document,active_draft_version_id:key};f.save.mockResolvedValue({ok:false,message:'Het menu is intussen gewijzigd.'});expect((await POST(request())).status).toBe(409);expect(f.publish).not.toHaveBeenCalled();
 });
 it('handles a repeated request after completion without creating a new version and rejects a forged command',async()=>{
  f.row={configuration_json:document,active_draft_version_id:null};expect((await POST(request())).status).toBe(200);expect(f.save).not.toHaveBeenCalled();expect(f.publish).not.toHaveBeenCalled();
  expect((await POST(request({designId:design,operationId:key,prices:[1]}))).status).toBe(400);
 });
 it('offers inline preparation only with active write permissions and an actual pending menu',async()=>{
  const url=`https://control.example/api/publisher/library?tab=dynamic&designId=${design}`;
  expect((await (await GET(new Request(url))).json()).sourceState.canPrepare).toBe(true);
  f.session={...session,capabilities:['tenant.dynamic_slide.read']};expect((await (await GET(new Request(url))).json()).sourceState.canPrepare).toBe(false);
 });
 it('reports failed preparation and uncertain reads without a success receipt or internal details',async()=>{
  f.publish.mockResolvedValue({ok:false,message:'De menuversie is intussen gewijzigd.'});expect((await POST(request())).status).toBe(409);
  f.client.mockRejectedValue(Error('PRIVATE_INTERNAL_DETAIL'));const response=await POST(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('PRIVATE_INTERNAL_DETAIL');
 });
});
