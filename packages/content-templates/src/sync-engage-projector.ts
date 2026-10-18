import {engagePublicCampaignSchema,syncSlidePresentationSchema,type SyncSlidePresentation} from '@veyocast/contracts';

/** The existing public campaign authority decides whether results are visible.
 * Author-supplied totals and private management metrics never enter playback. */
export function projectSyncEngageCampaign(seed:SyncSlidePresentation,value:unknown,publicId:string):SyncSlidePresentation|null{
 const parsed=engagePublicCampaignSchema.safeParse(value);
 if(seed.family!=='engage'||!parsed.success||parsed.data.id!==publicId||seed.poll&&seed.poll.id!==publicId||parsed.data.options.length>12)return null;
 const campaign=parsed.data;
 if(campaign.resultsVisible&&(campaign.options.some(option=>option.voteCount===undefined)||campaign.options.reduce((sum,option)=>sum+(option.voteCount??0),0)!==campaign.totalVotes))return null;
 const result=syncSlidePresentationSchema.safeParse({...seed,state:'ready',poll:{id:publicId,title:campaign.question,status:campaign.status,
  visibility:campaign.resultsVisible?'live':campaign.resultVisibility==='after_close'&&campaign.status==='live'?'after_close':'after_vote',publicUrl:seed.poll?.publicUrl,
  options:campaign.options.map(option=>({id:option.id,label:option.label,votes:campaign.resultsVisible?option.voteCount??0:0})),
 }});
 return result.success?result.data:null;
}
