import type { MatchdayAction, MatchdayDelivery, MatchdayPhase, MatchdayRole } from "@veyocast/contracts";

export const roleLabels:Record<MatchdayRole,string>={entrance:"Entree",clubwall:"Clubmuur",canteen:"Kantine",led:"LED"};
export const phaseLabels:Record<MatchdayPhase,string>={before:"Vooraf",playing:"Bezig",halftime:"Rust",resumed:"Hervat",finished:"Afgelopen",postponed:"Uitgesteld",cancelled:"Afgelast"};
export const actionLabels:Record<MatchdayAction["kind"],string>={field:"Veldwijziging",phase:"Wedstrijdfase",postponed:"Uitgesteld",cancelled:"Afgelast",sold_out:"Uitverkocht",available:"Weer beschikbaar"};
export const deliveryLabels:Record<MatchdayDelivery["status"],string>={scheduled:"Gepland",queued:"Klaargezet",received:"Ontvangen",prepared:"Voorbereid",rendered:"Weergave bevestigd",restoring:"Herstel klaargezet",restored:"Planning hervat",expired:"Verlopen",overridden:"Andere planning heeft voorrang",skipped:"Overgeslagen",failed:"Mislukt",unknown:"Weergave onbekend"};
export function displayTime(value:string|null,timezone:string){return value?new Intl.DateTimeFormat("nl-NL",{dateStyle:"short",timeStyle:"short",timeZone:timezone}).format(new Date(value)):"Onbekend";}
type LabelMatch={id:string;matchCode:string;homeTeamName:string;awayTeamName:string;kickoffAt:string};
export function matchLabel(match:LabelMatch,timezone:string,peers:readonly LabelMatch[]=[]){const label=(value:LabelMatch)=>`${value.homeTeamName} – ${value.awayTeamName} · ${displayTime(value.kickoffAt,timezone)}`;return `${label(match)}${peers.some(value=>value.id!==match.id&&label(value)===label(match))?` · ${match.matchCode}`:""}`;}
