import type {
  MatchdayActionInput, MatchdayContext, MatchdayDraftConfiguration,
  MatchdayPhase, MatchdayPublication, MatchdayRole
} from "@veyocast/contracts";

export function matchdayContextIdentity(context: MatchdayContext) {
  return JSON.stringify([context.sourceId, context.connectionId, context.teamId,
    context.competitionId, context.poolId, context.seasonId, context.phaseId]);
}

/** A context change edits a concept; it never relinks a published match. */
export function replaceMatchdayDraftContext(input: {
  editable: boolean; actualRevision: number; expectedRevision: number;
  configuration: MatchdayDraftConfiguration; context: MatchdayContext;
  clearSelectedMatches: boolean;
}) {
  if (!input.editable) return {ok:false, reason:"PUBLISHED_VERSION_LOCKED"} as const;
  if (input.actualRevision !== input.expectedRevision)
    return {ok:false, reason:"REVISION_CONFLICT", actualRevision:input.actualRevision} as const;
  const changed = !input.configuration.context || matchdayContextIdentity(input.configuration.context) !== matchdayContextIdentity(input.context);
  if (changed && input.configuration.matches.length && !input.clearSelectedMatches)
    return {ok:false, reason:"EXPLICIT_MATCH_CLEAR_REQUIRED", matchIds:input.configuration.matches.map(match => match.id)} as const;
  return {ok:true, configuration:{...input.configuration,context:input.context,
    ...(changed ? {matches:[],mainMatchId:null} : {})}, cleared:changed && input.configuration.matches.length > 0} as const;
}

export type MatchdayScreen = {
  id: string; tenantId: string; name: string; status: string;
  orientation: "landscape" | "portrait"; width: number; height: number;
  playerId: string | null; expiryCapability: boolean;
};
export type MatchdayGroup = {id:string;tenantId:string;screenIds:readonly string[]};
export type MatchdayReleaseCheck = {tenantId:string;screenId:string;releaseId:string;ready:boolean;compatible:boolean};
export type MatchdayPreflightIssue = {screenId:string|null;role:MatchdayRole|null;code:string;message:string};

/** Only expansion/deduplication lives here. Release compatibility and planning
 * winners are supplied by the existing authorized server preflight/resolver. */
export function expandMatchdayTargets(input: {
  tenantId:string; configuration:MatchdayDraftConfiguration;
  screens:readonly MatchdayScreen[]; groups:readonly MatchdayGroup[];
  releaseChecks:readonly MatchdayReleaseCheck[];
}) {
  const issues:MatchdayPreflightIssue[]=[];
  const screens=new Map(input.screens.filter(screen=>screen.tenantId===input.tenantId).map(screen=>[screen.id,screen]));
  const groups=new Map(input.groups.filter(group=>group.tenantId===input.tenantId).map(group=>[group.id,group]));
  const candidates=new Map<string,MatchdayRole[]>();
  const roleConfigurations=new Map(input.configuration.roles.map(role=>[role.role,role]));
  const issue=(screenId:string|null,role:MatchdayRole|null,code:string,message:string)=>issues.push({screenId,role,code,message});
  if (!input.configuration.roles.length) issue(null,null,"TARGETS_REQUIRED","Kies ten minste één schermrol met een concreet doel.");
  if (!input.configuration.context || !input.configuration.mainMatchId || !input.configuration.matches.length)
    issue(null,null,"EXACT_MATCH_REQUIRED","Kies een exacte hoofdwedstrijd met gevalideerde broncontext.");
  if (input.configuration.context?.seasonId === "unknown")
    issue(null,null,"SEASON_CONTEXT_UNKNOWN","Het bronseizoen is onbekend. Bevestig een geldige broncontext voordat je publiceert.");
  for (const role of input.configuration.roles) {
    const ids=new Set<string>();
    for (const target of role.targets) {
      const expanded=target.kind === "screen" ? [target.id] : groups.get(target.id)?.screenIds;
      if (!expanded) {issue(null,role.role,"TARGET_UNAVAILABLE","Een geselecteerd doel is niet beschikbaar binnen deze vereniging.");continue;}
      for (const id of expanded) {
        if (!screens.has(id)) {issue(null,role.role,"TARGET_UNAVAILABLE","Een geselecteerd doel is niet beschikbaar binnen deze vereniging.");continue;}
        ids.add(id);
      }
    }
    if (!ids.size) issue(null,role.role,"ROLE_EMPTY","Deze schermrol heeft geen toegestane concrete doelschermen.");
    for (const id of ids) candidates.set(id,[...(candidates.get(id)??[]),role.role]);
  }
  const targets:Array<{screen:MatchdayScreen;role:MatchdayRole;releaseIds:string[];defaultReleaseId:string}>=[];
  for (const [id,roles] of candidates) {
    const screen=screens.get(id)!;
    const decision=input.configuration.overlapDecisions.find(value=>value.screenId===id)?.role;
    const role=roles.length===1 ? roles[0]! : decision && roles.includes(decision) ? decision : null;
    if (!role) {issue(id,null,"OVERLAPPING_ROLES","Dit scherm staat in meerdere rollen. Bevestig één bestemming of pas de doelen aan.");continue;}
    if (screen.status!=="active") {issue(id,role,"SCREEN_INACTIVE","Dit scherm is niet actief en ontvangt geen draaiboekopdracht.");continue;}
    if (!screen.expiryCapability) {issue(id,role,"PLAYER_EXPIRY_UNSUPPORTED","Deze Player ondersteunt lokaal vervallen en veilig hervatten nog niet (matchday-expiry-v1 ontbreekt).");continue;}
    const config=roleConfigurations.get(role)!;
    const releaseIds=[...new Set([config.defaultReleaseId,...Object.values(config.phaseReleaseIds),...config.menuFallbacks.map(item=>item.unavailableReleaseId)])];
    let compatible=true;
    for (const releaseId of releaseIds) {
      const check=input.releaseChecks.find(check=>check.tenantId===input.tenantId&&check.screenId===id&&check.releaseId===releaseId);
      if (!check?.ready || !check.compatible) {
        issue(id,role,!check?.ready?"PUBLICATION_NOT_READY":"PUBLICATION_INCOMPATIBLE",!check?.ready?"Een gekozen publicatie is niet volledig gereed.":"Een gekozen publicatie past niet bij dit schermprofiel.");
        compatible=false;
      }
    }
    if (compatible) targets.push({screen,role,releaseIds,defaultReleaseId:config.defaultReleaseId});
  }
  if (!targets.length) issue(null,null,"NO_COMPATIBLE_TARGET","Er is nog geen compatibel doelscherm. Controleer doelen, herstelpublicatie en Playerondersteuning.");
  return {targets,issues,canPublish:issues.length===0&&targets.length>0};
}

export function matchdayRunState(status:"scheduled"|"active"|"closed"|"cancelled", startsAt:string,endsAt:string,now:number) {
  if (status==="cancelled"||status==="closed") return status;
  if (!Number.isFinite(now)||!Number.isFinite(Date.parse(startsAt))||!Number.isFinite(Date.parse(endsAt))) return "unknown";
  return now>=Date.parse(endsAt)?"closed":now<Date.parse(startsAt)?"scheduled":"active";
}

export const matchdayPhaseTransitions:Readonly<Record<MatchdayPhase,readonly MatchdayPhase[]>> = {
  before:["playing","postponed","cancelled"], playing:["halftime","finished","postponed","cancelled"],
  halftime:["resumed","finished","postponed","cancelled"], resumed:["halftime","finished","postponed","cancelled"],
  finished:[],postponed:["before","cancelled"],cancelled:[]
};

/** Server runs this in addition to its transactional context/CAS/rights guard. */
export function validateMatchdayAction(publication:MatchdayPublication,input:MatchdayActionInput,now:number) {
  if (input.publicationId!==publication.id||input.runbookId!==publication.runbookId) return {allowed:false,code:"WRONG_PUBLICATION"} as const;
  if (matchdayRunState(publication.status,publication.configuration.startsAt,publication.configuration.endsAt,now)!=="active")
    return {allowed:false,code:"RUNBOOK_NOT_ACTIVE"} as const;
  const end=Date.parse(input.endsAt);
  if (!Number.isFinite(end)||end<=now||end>Date.parse(publication.configuration.endsAt))
    return {allowed:false,code:"INVALID_EXPIRY"} as const;
  if (new Set(input.screenIds).size!==input.screenIds.length || input.screenIds.some(id=>!publication.targets.some(target=>target.screenId===id)))
    return {allowed:false,code:"TARGET_NOT_IN_PUBLICATION"} as const;
  if ("matchId" in input && !publication.configuration.matches.some(match=>match.id===input.matchId))
    return {allowed:false,code:"MATCH_NOT_IN_PUBLICATION"} as const;
  const globalMain=input.kind==="phase"||((input.kind==="postponed"||input.kind==="cancelled")&&input.matchId===publication.configuration.mainMatchId);
  if(globalMain&&(input.screenIds.length!==publication.targets.length||publication.targets.some(target=>!input.screenIds.includes(target.screenId))))
    return {allowed:false,code:"MAIN_ACTION_REQUIRES_ALL_TARGETS"} as const;
  if (input.kind==="phase" && (input.matchId!==publication.configuration.mainMatchId || !matchdayPhaseTransitions[publication.phase].includes(input.phase)))
    return {allowed:false,code:"INVALID_PHASE_TRANSITION"} as const;
  if (input.kind==="sold_out"||input.kind==="available") {
    const canteen=publication.configuration.roles.find(role=>role.role==="canteen");
    const placement=canteen?.menuFallbacks.find(item=>item.productId===input.productId&&item.menuSnapshotId===input.menuSnapshotId&&item.placementId===input.placementId);
    if (!placement||input.screenIds.some(id=>publication.targets.find(target=>target.screenId===id)?.role!=="canteen"))
      return {allowed:false,code:"MENU_PLACEMENT_NOT_SUPPORTED"} as const;
  }
  return {allowed:true} as const;
}

export function matchdaySuggestedExpiry(kind:MatchdayActionInput["kind"],endsAt:string,now:number) {
  const duration=kind==="field"?20*60_000:kind==="postponed"?30*60_000:Infinity;
  return new Date(Math.min(Date.parse(endsAt),now+duration)).toISOString();
}

export function matchdayActionObjectKey(input:MatchdayActionInput) {
  if (input.kind === "sold_out" || input.kind === "available")
    return `menu:${input.menuSnapshotId}:${input.placementId}:${input.productId}`;
  return `match:${input.matchId}:${input.kind === "field" ? "field" : "phase"}`;
}
