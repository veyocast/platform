import type {SyncDynamicPlayback,SyncSlidePresentation} from '@veyocast/contracts';
import {chooseLatestLedScoresMatchState,formatLedScoresClock,ledScoresMatchServerNow,resolveLedScoresClockSeconds,type LedScoresMatchState} from './ledscores-match-experience';

/** Consume the existing device-authorized stream/cache. Waiting placeholders,
 * another connection and state older than the immutable fallback never win. */
export function selectSyncLiveMatchState(binding:SyncDynamicPlayback['liveMatch'],previous:LedScoresMatchState|null,next:LedScoresMatchState|undefined){
 if(!binding)return null;
 const accepted=(state:LedScoresMatchState|null|undefined):state is LedScoresMatchState=>Boolean(state&&state.connectionId===binding.connectionId&&!state.matchKey.startsWith('waiting:')&&!(state.status==='unknown'&&state.revision==='0')&&(!binding.sourceUpdatedAt||Date.parse(state.sourceUpdatedAt)>=Date.parse(binding.sourceUpdatedAt)));
 const current=accepted(previous)?previous:null;
 return accepted(next)?chooseLatestLedScoresMatchState(current,next):current;
}

/** Only already verified frozen logo references survive. Stream URLs never
 * become render assets; a changed team waits for a new verified manifest. */
export function projectSyncLiveMatch(presentation:SyncSlidePresentation,state:LedScoresMatchState|null,showClock:boolean,now:number):SyncSlidePresentation{
 if(!state||!['scoreboard','goal'].includes(presentation.family))return presentation;
 const clock=showClock&&state.clock?formatLedScoresClock(resolveLedScoresClockSeconds(state.clock,ledScoresMatchServerNow(state,now),state.staleAfter)):'';
 return {...presentation,state:'ready',
  ...(presentation.rendererVersion==='sync-onzetrots-v1'?{rich:{...presentation.rich,phase:({pre_match:'scheduled',live:'live',paused:'paused',half_time:'halftime',finished:'finished',unknown:'unknown'} as const)[state.status]}}:{}),
  home:{name:state.home.name,team:'',logo:presentation.home?.name===state.home.name?presentation.home.logo:undefined},
  away:{name:state.away.name,team:'',logo:presentation.away?.name===state.away.name?presentation.away.logo:undefined},
  match:{homeScore:String(state.home.score),awayScore:String(state.away.score),clock,date:'',time:''},
 };
}
