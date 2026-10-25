import{beforeEach,it,expect,vi}from'vitest';
import * as React from'react';
const f=vi.hoisted(()=>({theme:'onzetrots-tv',redirect:vi.fn((path:string)=>{throw Error('REDIRECT '+path);}),rpc:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:f.redirect}));
vi.mock('./control-session',()=>({requireTenantControlSession:async()=>({isLive:true,tenantId:'10000000-0000-4000-8000-000000000291',tenant:'Eigen club',capabilities:[]})}));
vi.mock('./supabase/server',()=>({createControlSupabaseClient:async()=>({rpc:f.rpc,from:(table:string)=>{
 const value=()=>table==='tenant_settings'?{default_theme_id:f.theme,default_theme_version:f.theme==='onzetrots-tv'?'11.0.0':'1.0.0',theme_mode_policy:{kind:'fixed',mode:'light'},primary_color:'#03438a',timezone_name:'Europe/Amsterdam'}:table==='tenant_theme_profiles'?{selection_json:{ref:{catalog:'v2',id:f.theme,version:f.theme==='onzetrots-tv'?'11.0.0':'1.0.0'},modePolicy:{kind:'fixed',mode:'light'},accent:'#03438a',categoryOverrides:[]}}:null;
 const query={select:()=>query,eq:()=>query,in:()=>query,is:()=>query,order:()=>query,limit:()=>query,like:()=>query,maybeSingle:async()=>({data:value(),error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)};return query;
 }})}));
import SportlinkNewPage from'../app/(shell)/dashboard/studio/sportlink/new/page';
import BirthdayNewPage from'../app/(shell)/dashboard/studio/sportlink/birthdays/new/page';
import NewsNewPage from'../app/(shell)/dashboard/slides/new/page';
beforeEach(()=>{vi.stubGlobal('React',React);vi.clearAllMocks();f.theme='onzetrots-tv';});
const entries=[{page:()=>SportlinkNewPage({searchParams:Promise.resolve({})}),target:'/dashboard/studio/new?group=Sport&mode=connected'},{page:()=>BirthdayNewPage({searchParams:Promise.resolve({})}),target:'/dashboard/studio/new?family=birthdays&mode=connected'},{page:()=>NewsNewPage({searchParams:Promise.resolve({family:'news'})}),target:'/dashboard/studio/new?family=rss&mode=connected'}];
for(const[index,entry]of entries.entries()){
 it(`old OnzeTrots entry ${index} opens the current common wizard without a source command`,async()=>{
  await expect(entry.page()).rejects.toThrow('REDIRECT '+entry.target);expect(f.rpc).not.toHaveBeenCalled();
 });
 it(`entry ${index} retains the existing FieldFlow compatibility surface`,async()=>{
  f.theme='fieldflow';await expect(entry.page()).resolves.toBeTruthy();expect(f.redirect).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
 });
}
