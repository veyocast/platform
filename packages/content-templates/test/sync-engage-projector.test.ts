import {expect,it} from 'vitest';
import {syncSlidePresentationSchema} from '@veyocast/contracts';
import {projectSyncEngageCampaign} from '../src/sync-engage-projector';
const id='10000000-0000-4000-8000-000000000232';
const emptySeed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'engage',orientation:'portrait',theme:'onzetrots-tv',name:'Eigen publieksvraag',title:'STEM MEE',club:{name:'Eigen club'},style:{motion:'geen'}});
const campaign={id,kind:'poll',closesAt:null,privacyNotice:'Stemmen worden zonder naam geteld.',question:'Wie was de beste speler?',title:'Eigen wedstrijd',resultVisibility:'live',resultsVisible:true,status:'live',tenantName:'Eigen club',totalVotes:8,options:[{id:'20000000-0000-4000-8000-000000000232',label:'Eigen speler A',sortOrder:0,voteCount:6},{id:'30000000-0000-4000-8000-000000000232',label:'Eigen speler B',sortOrder:1,voteCount:2}]};
const seed=syncSlidePresentationSchema.parse({...emptySeed,poll:{id,title:campaign.question,status:'live',visibility:'after_vote',optionsPerPage:4,options:campaign.options.map(x=>({id:x.id,label:x.label,votes:0}))}});
it('projects only the selected public authority while retaining exact Source design and all option identities',()=>{
 const value=projectSyncEngageCampaign(seed,campaign,id)!;expect(value.theme).toBe(seed.theme);expect(value.orientation).toBe(seed.orientation);expect(value.style).toEqual(seed.style);expect(value.poll).toMatchObject({id,title:campaign.question,status:'live',visibility:'live',options:[{id:campaign.options[0]!.id,label:'Eigen speler A',votes:6},{id:campaign.options[1]!.id,label:'Eigen speler B',votes:2}]});
 expect(projectSyncEngageCampaign(seed,campaign,'40000000-0000-4000-8000-000000000232')).toBeNull();
});
it('removes every count when the public authority hides results, including after-vote and closed private results',()=>{
 for(const status of['live','closed']){const result=projectSyncEngageCampaign(seed,{...campaign,status,resultsVisible:false,resultVisibility:'after_vote'},id)!;expect(result.poll?.visibility).toBe('after_vote');expect(result.poll?.options.map(option=>option.votes)).toEqual([0,0]);}
});
it('refuses incomplete totals and unsupported option bounds instead of inventing or truncating results',()=>{
 expect(projectSyncEngageCampaign(seed,{...campaign,totalVotes:9},id)).toBeNull();
 expect(projectSyncEngageCampaign(seed,{...campaign,options:campaign.options.map(({voteCount:_,...option})=>{void _;return option;})},id)).toBeNull();
 expect(projectSyncEngageCampaign(seed,{...campaign,options:Array.from({length:25},(_,i)=>({...campaign.options[0],id:`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`,sortOrder:i,voteCount:0})),totalVotes:0},id)).toBeNull();
});
it('retains a verified saved QR destination and refuses a fallback authored for another campaign',()=>{
 const poll={id,title:campaign.question,status:'live' as const,visibility:'live' as const,publicUrl:`https://control.example.invalid/engage/${id}`,options:campaign.options.map(option=>({id:option.id,label:option.label,votes:0}))};
 expect(projectSyncEngageCampaign({...seed,poll},campaign,id)?.poll?.publicUrl).toBe(poll.publicUrl);
 expect(projectSyncEngageCampaign({...seed,poll:{...poll,id:'40000000-0000-4000-8000-000000000232'}},campaign,id)).toBeNull();
});

it.each([2,12,13,24])('preserves every public answer, original ordering and values across a %i-option paged projection',count=>{
 const options=Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,'0')}`,label:`Speler ${i+1}`,sortOrder:i,voteCount:i+1}));
 const selected=syncSlidePresentationSchema.parse({...seed,poll:{...seed.poll,options:options.map(x=>({id:x.id,label:x.label,votes:0}))}});
 const value=projectSyncEngageCampaign(selected,{...campaign,options,totalVotes:options.reduce((sum,x)=>sum+x.voteCount,0)},id)!;
 expect(value.poll).toMatchObject({optionsPerPage:4,options:options.map(x=>({id:x.id,label:x.label,votes:x.voteCount}))});
 for(const visibility of['after_vote','after_close']){
  const hidden=projectSyncEngageCampaign(value,{...campaign,options,totalVotes:999,resultsVisible:false,resultVisibility:visibility},id)!;
  expect(hidden.poll?.options.map(x=>x.votes)).toEqual(Array(count).fill(0));
  expect(hidden.poll?.visibility).toBe(visibility);
 }
 const closed=projectSyncEngageCampaign(value,{...campaign,status:'closed',resultVisibility:'after_close',options,totalVotes:options.reduce((sum,x)=>sum+x.voteCount,0)},id)!;
 expect(closed.poll?.options.map(x=>x.votes)).toEqual(options.map(x=>x.voteCount));
});
it('keeps the layout discriminator absent on a historical published fallback',()=>{
 const poll={id,title:campaign.question,status:'live' as const,visibility:'live' as const,options:campaign.options.map(x=>({id:x.id,label:x.label,votes:0}))};
 const result=projectSyncEngageCampaign({...seed,poll},campaign,id)!;
 expect(result.poll).not.toHaveProperty('optionsPerPage');
 expect(result.poll?.options).toHaveLength(2);
});

it('does not add pages to an old empty one-page fallback when no poll layout was frozen',()=>{
 for(const count of[13,24]){
  const options=Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,'0')}`,label:`Speler ${i+1}`,sortOrder:i,voteCount:0}));
  expect(projectSyncEngageCampaign(emptySeed,{...campaign,options,totalVotes:0},id)).toBeNull();
 }
 const legacy=projectSyncEngageCampaign(emptySeed,campaign,id)!;
 expect(legacy.poll).not.toHaveProperty('optionsPerPage');
 expect(legacy.poll?.options).toHaveLength(2);
});

it('refuses option identity, order or count changes that would disagree with frozen playback timing',()=>{
 const unchanged=projectSyncEngageCampaign(seed,campaign,id)!;expect(unchanged.poll?.options).toHaveLength(2);
 for(const options of[
  [...campaign.options].reverse(),
  campaign.options.map((x,i)=>i?x:{...x,id:'26200000-0000-4000-8000-000000000999'}),
  [...campaign.options,{id:'26200000-0000-4000-8000-000000000998',label:'Speler C',sortOrder:2,voteCount:0}],
 ])expect(projectSyncEngageCampaign(seed,{...campaign,options},id)).toBeNull();
});
