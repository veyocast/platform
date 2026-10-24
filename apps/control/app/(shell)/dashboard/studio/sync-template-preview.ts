import approved from './sync-onzetrots-preview-fixtures.json';
import {
  isSyncOnzeTrotsPresentation,
  syncContentFamilies,
  syncSlidePresentationSchema,
  syncSlideRendererVersion,
  syncSlideSourceRevision,
  type SyncContentFamily,
  type SyncSlidePresentation,
} from "@veyocast/contracts";

type Row = SyncSlidePresentation["rows"][number];

// Display-only examples from the chosen Source's Content.tsx, commit 8b1fdf1.
// Keep this separate from createSyncStudioStarter and every authoring command.
const fixtures = [
  ["Duindorp SV JO13-1", "HBS JO13-2", "09:00", "2", "4", "3 – 1", "youth"],
  ["Duindorp SV JO15-1", "Quick JO15-2", "10:30", "1", "6", "2 – 2", "youth"],
  ["Duindorp SV 2", "Scheveningen 3", "12:00", "1", "2", "1 – 0", "second"],
  ["Duindorp SV 1", "SV Loosduinen 1", "14:30", "1", "3", "2 – 1", "first"],
  ["Quick JO13-2", "Duindorp SV JO13-1", "09:30", "3", "7", "0 – 2", "youth"],
  ["HBS 2", "Duindorp SV 2", "12:30", "2", "5", "1 – 1", "second"],
  ["Duindorp SV 1", "Quick 1", "14:30", "1", "2", "3 – 0", "first"],
  ["DUNO 1", "Duindorp SV 1", "14:00", "1", "4", "1 – 2", "first"],
] as const;

const news = [
  ["Een club waar iedereen welkom is", "Van de eerste training tot de derde helft. Samen maken we de club."],
  ["Zaterdag staat het sportpark weer vol energie", "Kom langs, moedig de teams aan en maak er samen een mooie voetbaldag van."],
  ["Vrijwilligers maken het verschil", "Een warm welkom, een strak veld en de lekkerste koffie. Bedankt voor jullie inzet."],
  ["Nieuwe gezichten bij de mini’s", "Samen spelen, samen ontdekken. Onze jongste voetballers beleven hun eerste voetbalavonturen."],
  ["Een avond voor de hele vereniging", "Praat mee over onze club en ontmoet elkaar tijdens de komende clubavond."],
  ["Blauw en wit, op én naast het veld", "Onze wijk, onze club en onze trots. Dit zijn de verhalen die ons verbinden."],
] as const;

function previewRows(family: SyncContentFamily): Row[] {
  if (/stand/.test(family)) {
    const period = family === "period-standings";
    return ["SV Loosduinen", "Duindorp SV", "HBS", "Quick", "SVH", "DUNO", "HVV", "Scheveningen"]
      .map((name, index) => [String(index + 1), name, period ? "3" : "6", String(Math.max(0, (period ? 9 : 16) - index * 2))]);
  }
  if (/official|referee/.test(family)) return [
    ["Marco de Groot", "Duindorp SV 1 – SV Loosduinen · 14:30 · veld 1", "", ""],
    ["Sanne Jansen", "Duindorp SV 2 – Scheveningen · 12:00 · veld 1", "", ""],
    ["Danny van Vliet", "Duindorp SV JO13-1 – HBS · 09:00 · veld 2", "", ""],
  ];
  if (family === "team-info") return [
    ["Sam de Vries", "Aanvoerder · middenveld", "", ""],
    ["Milan Bakker", "Aanvaller · nummer 9", "", ""],
    ["Noah Jansen", "Doelman · nummer 1", "", ""],
    ["Peter de Groot", "Hoofdtrainer", "", ""],
  ];
  if (family === "volunteers") return [
    ["Sanne Jansen", "Gastvrouw · 09:00 – 12:00", "", ""],
    ["Marco de Groot", "Wedstrijdcoördinator · 10:00 – 15:00", "", ""],
    ["Kantineploeg", "Vrijwilligers gezocht · meld je bij de bar", "", ""],
  ];
  if (family === "training") return [
    ["DI", "18:30", "Duindorp SV JO13-1", "Veld 2 · trainer Marco"],
    ["DO", "19:00", "Duindorp SV 2", "Veld 1 · kleedkamer 3"],
    ["DO", "20:00", "Duindorp SV 1", "Veld 1 · kleedkamer 1"],
  ];
  if (family === "birthdays") return [
    ["17", "OKT", "Sanne Jansen", "Van harte gefeliciteerd!"],
    ["17", "OKT", "Marco de Groot", "Een mooie dag gewenst!"],
  ];
  if (/agenda|activit/.test(family)) return [
    ["19", "NOV", "Algemene ledenvergadering", "20:00 · De kantine"],
    ["28", "NOV", "Vrijwilligersavond", "19:30 · Iedereen welkom"],
    ["12", "DEC", "Blauw-wit winterfeest", "18:00 · De kantine"],
  ];
  if (family === "sponsors") return [
    ["DG Webservices", "DIGITALE PARTNER", "", ""],
    ["Veele Services", "CLUBPARTNER", "", ""],
    ["De wijkbakker", "PARTNER VAN DE JEUGD", "", ""],
    ["Sporthuis Den Haag", "SAMEN VOOR DE CLUB", "", ""],
  ];
  if (family === "menu") return [
    ["Broodje kroket", "€ 3,50", "", ""],
    ["Broodje frikandel", "€ 3,50", "", ""],
    ["Patat met", "€ 3,25", "", ""],
    ["Tosti ham / kaas", "€ 3,00", "", ""],
  ];
  if (!/program|result|uitslag|arrival|changing|kleed|fixture|dressing|visitor|cancellation/.test(family)) return [];
  return fixtures
    .filter(row => !["team-program", "team-results"].includes(family) || row[6] === "first")
    .filter(row => family !== "cancellations" || row[6] === "youth")
    .map(row => [row[0], row[1], /result|uitslag/.test(family) ? row[5] : row[2], /arrival|changing|kleed|dressing|visitor/.test(family) ? row[4] : row[3]]);
}

function previewTitle(family: SyncContentFamily, label: string, name: string): string {
  if (["officials", "referees", "team-info", "volunteers"].includes(family)) return label;
  if (family === "welcome") return "WELKOM BIJ\nONZE CLUB.";
  if (family === "engage") return "LAAT DE CLUB MEEPRATEN.";
  if (family === "menu") return "EVEN NAAR\nDE KANTINE.";
  if (/stand/.test(family)) return family === "period-standings" ? "DE PERIODERACE." : "DE STAND\nVAN ZAKEN.";
  if (/program|result|uitslag|arrival|changing|schema|kleed|fixture|dressing|visitor|cancellation/.test(family)) {
    if (family === "cancellations") return "DEZE WEDSTRIJDEN\nZIJN AFGELAST.";
    if (family === "visitors") return "WELKOM BIJ\nONZE CLUB.";
    if (/dressing|changing/.test(family)) return "VIND JE\nKLEEDKAMER.";
    return /result|uitslag/.test(family) ? "ZO SPEELDEN\nWE DIT WEEKEND." : "VANDAAG OP\nHET VELD.";
  }
  if (family === "sponsors") return "SAMEN MAKEN\nWE DE CLUB.";
  if (family === "lineup") return "ONZE ELF.";
  if (family === "birthdays") return "GEFELICITEERD!";
  if (family === "training") return "TIJD OM\nTE TRAINEN.";
  if (family === "activities") return "SAMEN OP\nDE CLUB.";
  if (family === "agenda") return "DIT KOMT\nERAAN.";
  if (["rss", "club-story", "free"].includes(family)) return name;
  if (family === "youtube") return "ONZE CLUB\nIN BEELD.";
  if (family === "goal") return "GOOOAAAL!";
  if (family === "next-match") return "DE VOLGENDE.";
  return family === "scoreboard" ? "LIVE VANAF\nHET VELD." : "ONZE\nWEDSTRIJDDAG.";
}

/** Chosen Source layout example only. Never use this as a document or command seed. */
function createLegacySyncTemplatePreview(family: SyncContentFamily): SyncSlidePresentation {
  const definition = syncContentFamilies.find(entry => entry.id === family);
  if (!definition) throw new Error("Deze slidefamilie is niet beschikbaar.");
  return syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: syncSlideRendererVersion,
    sourceRevision: syncSlideSourceRevision,
    family,
    orientation: "landscape",
    theme: "onzetrots-tv",
    name: definition.name,
    title: previewTitle(family, definition.label, definition.name),
    headline: definition.label,
    club: { name: "Duindorp SV", tagline: "ONZE CLUB. ONZE TROTS." },
    body: "Onze wijk. Onze club. Onze trots.",
    subtitle: "Duindorp SV · Sportpark Houtrust",
    footer: "ONZE WIJK. ONZE CLUB. ONZE TROTS.",
    footerRight: "SINDS 1950",
    home: { name: "Duindorp SV", team: "HEREN 1" },
    away: { name: "SV Loosduinen", team: "HEREN 1" },
    match: { homeScore: "2", awayScore: "1", clock: "67:24", date: "ZONDAG 18 OKTOBER", time: "14:30" },
    rows: previewRows(family),
    ownRowIndexes: /stand/.test(family) ? [1] : [],
    rowsPerPage: 4,
    category: family === "menu" ? "DE FAVORIETEN" : "",
    special: family === "menu" ? { label: "LEKKER LANGS DE LIJN", title: "Koffie & een goed verhaal.", priceCents: 220 } : undefined,
    lineup: family === "lineup" ? [[9], [7, 10, 11], [6, 8], [2, 3, 4, 5], [1]] : [],
    news: family === "rss" ? news.map(([title, intro]) => ({ title, intro, source: "Duindorp SV · Sportpark Houtrust", url: "https://www.duindorpsv.nl/" })) : [],
    imageCaption: "EEN CLUB. EEN VERHAAL.",
    style: { background: "stadium", font: "Inter", motion: "rustig" },
  });
}

/** Display-only approved examples. Never pass this factory to a writer, source
 * seed or new-document constructor; those deliberately begin without facts. */
export function createSyncTemplatePreview(family:SyncContentFamily,rendererVersion:SyncSlidePresentation['rendererVersion']='sync-onzetrots-v9'):SyncSlidePresentation{
 if(rendererVersion==='sync-v1')return createLegacySyncTemplatePreview(family);
 const original=syncSlidePresentationSchema.parse(approved.fixtures[family]);
 if(!isSyncOnzeTrotsPresentation(original))throw Error('Approved display fixture unavailable');
 if(rendererVersion==='sync-onzetrots-v9'&&original.rich?.birthdays){
  const names=['Sam K.','Nora D.','Milan J.','Sanne V.','Finn M.','Peter S.'];
  original.rich.birthdays.forEach((person,index)=>{person.displayName=names[index]??person.displayName;});
 }
 return syncSlidePresentationSchema.parse(rendererVersion==='sync-onzetrots-v1'?original:{...original,style:{...original.style,font:'Brush',fontChanged:true},rendererVersion,sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',authoring:{schemaVersion:1,headerSubtitles:{},headerTexts:family==='team-arrivals'?{'team-arrivals':'WELKOM OP HOUTRUST'}:{},welcomeScalePercent:150}});
}
