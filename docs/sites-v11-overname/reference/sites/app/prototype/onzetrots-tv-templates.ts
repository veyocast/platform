import {ONZETROTS_TV_ASSETS as A,type OnzeTrotsTvContent} from './screen-themes';

const common={clubName:'Duindorp SV',logo:`${A}/logo.png`,footer:'SAMEN OP HET VELD. SAMEN OP DE CLUB.',rows:[],overlay:20,scale:100};
const joy=`${A}/clubmuur-portraits-v14/05-juichen-1280.webp`;
/** Editable fixture data from the supplied OnzeTrots TV handoff; never live club data. */
export const ONZETROTS_TV_TEMPLATES:{category:string;name:string;content:OnzeTrotsTvContent}[]=[
 {category:'Wedstrijddag',name:'Onze wedstrijddag',content:{...common,kind:'wedstrijd',title:'DIT IS ONZE ZONDAG.',eyebrow:'SAMEN ACHTER ONS EERSTE',subtitle:'ZONDAG 11 OKTOBER',time:'14:30',location:'SPORTPARK HOUTRUST · VELD 1',heroImage:`${A}/clubmuur-portraits-v17/10-strijd-1280.webp`,match:{home:'Duindorp SV 1',away:'Scheveningen 2',homeLogo:`${A}/logo.png`,label:'VOLGENDE THUISWEDSTRIJD'},values:['ONZE CLUB. ONZE WIJK. ONZE TROTS.','LAAT JE HOREN.','LANGS DE LIJN ZIJN WE ÉÉN.']}},
 {category:'Programma',name:'Vandaag op het veld',content:{...common,kind:'programma',title:'HIER SPELEN WE VOOR.',eyebrow:'EEN WEEKEND VOL VOETBAL',subtitle:'Thuisprogramma · 10–11 oktober',heroImage:joy,values:['VAN DE EERSTE AFTRAP TOT HET LAATSTE FLUITSIGNAAL.','IEDER TEAM. ONZE TROTS.','THUIS OP HOUTRUST.'],rows:[
  {id:'fixture-1',primary:'Duindorp SV JO11-1',home:'Duindorp SV JO11-1',away:'HVV JO11-2',time:'09:00',field:'Veld 2',tag:'JEUGD',secondary:'ZA 10 OKT'},
  {id:'fixture-2',primary:'Duindorp SV JO13-1',home:'Duindorp SV JO13-1',away:'Quick JO13-2',time:'10:15',field:'Veld 1',tag:'JEUGD',secondary:'ZA 10 OKT'},
  {id:'fixture-3',primary:'Duindorp SV JO15-1',home:'Duindorp SV JO15-1',away:'HBS JO15-3',time:'11:30',field:'Veld 2',tag:'JEUGD',secondary:'ZA 10 OKT'},
  {id:'fixture-4',primary:'Duindorp SV 2',home:'Duindorp SV 2',away:'WIK 2',time:'12:00',field:'Veld 1',tag:'SENIOREN',secondary:'ZA 10 OKT'},
  {id:'fixture-5',primary:'Duindorp SV 1',home:'Duindorp SV 1',away:'SVV Scheveningen 2',time:'14:30',field:'Veld 1',tag:'EERSTE ELFTAL',secondary:'ZO 11 OKT',own:true},
 ]}},
 {category:'Uitslagen',name:'Zo speelden we',content:{...common,kind:'uitslagen',title:'HET WEEKEND IN CIJFERS.',eyebrow:'ER IS WEER GESTREDEN',subtitle:'Uitslagen · 3–4 oktober',heroImage:joy,values:['HET EERSTE · THUISZEGE','DRIE PUNTEN. ÉÉN GEVOEL.','SAMEN WINNEN IS MOOIER.'],rows:[
  {id:'result-1',primary:'Duindorp SV 1',home:'Duindorp SV 1',away:'HBS 2',homeScore:'3',awayScore:'1',own:true},
  {id:'result-2',primary:'WIK 2',home:'WIK 2',away:'Duindorp SV 2',homeScore:'2',awayScore:'2'},
  {id:'result-3',primary:'Duindorp SV JO17-1',home:'Duindorp SV JO17-1',away:'HVV JO17-2',homeScore:'4',awayScore:'2'},
  {id:'result-4',primary:'Quick JO15-2',home:'Quick JO15-2',away:'Duindorp SV JO15-1',homeScore:'1',awayScore:'3'},
  {id:'result-5',primary:'Duindorp SV JO13-1',home:'Duindorp SV JO13-1',away:'HBS JO13-3',homeScore:'2',awayScore:'0'},
 ]}},
 {category:'Stand',name:'De stand van zaken',content:{...common,kind:'stand',title:'ONZE PLEK. ONZE AMBITIE.',eyebrow:'ELKE WEEK EEN STAP VOORUIT',subtitle:'Duindorp SV 1 · competitiestand',rows:[
  {id:'stand-1',rank:3,primary:'HBS 2',played:'5',won:'3',drawn:'1',lost:'1',difference:'+7',points:'10',form:['W','W','G','V','W']},
  {id:'stand-2',rank:4,primary:'Quick 2',played:'5',won:'3',drawn:'0',lost:'2',difference:'+4',points:'9',form:['V','W','W','V','W']},
  {id:'stand-3',rank:5,primary:'Duindorp SV 1',played:'5',won:'2',drawn:'2',lost:'1',difference:'+3',points:'8',form:['W','G','V','G','W'],own:true},
  {id:'stand-4',rank:6,primary:'WIK 1',played:'5',won:'2',drawn:'1',lost:'2',difference:'+1',points:'7',form:['G','W','V','W','V']},
  {id:'stand-5',rank:7,primary:'HVV 2',played:'5',won:'2',drawn:'0',lost:'3',difference:'−2',points:'6',form:['V','V','W','W','V']},
 ]}},
 {category:'Kantine',name:'Even naar de kantine',content:{...common,kind:'kantine',title:'Onze kantine.',eyebrow:'HET HART VAN DE CLUB',subtitle:'Voorbeeldprijzen',combo:{name:'Koffie + tosti ham-kaas',price:'€ 5,00',note:'Gezellig aan tafel. Samen voor de club.'},rows:[
  ['Koffie','€ 2,20','Koffie & thee'],['Cappuccino','€ 2,50','Koffie & thee'],['Thee','€ 2,00','Koffie & thee'],['Warme chocolademelk','€ 2,75','Koffie & thee'],
  ['Frisdrank','€ 2,50','Lekker fris'],['Water','€ 2,00','Lekker fris'],['Sportdrank','€ 2,75','Lekker fris'],['Vruchtensap','€ 2,50','Lekker fris'],
  ['Tosti kaas','€ 3,00','De derde helft'],['Tosti ham-kaas','€ 3,50','De derde helft'],['Broodje kroket','€ 3,25','De derde helft'],['Portie patat','€ 3,00','De derde helft'],
 ].map(([primary,value,tag],index)=>({id:`menu-${index}`,primary,value,tag}))}},
 {category:'Clubnieuws',name:'Dit leeft op de club',content:{...common,kind:'clubnieuws',title:'In onze club.',eyebrow:'ER GEBEURT IETS MOOIS',subtitle:'MEEDOEN · ONTMOETEN · BEWEGEN',heroImage:`${A}/clubmuur-portraits-v14/07-walking-1280.webp`,rows:[
  {id:'news-1',primary:'Voetbal blijft. Op jouw tempo.',secondary:'Walking Football. Samen bewegen, een balletje trappen en elkaar ontmoeten.',value:'27 OKTOBER 2026 · Eerste training',tag:'NIEUW BIJ DUINDORP SV'},
  {id:'news-2',primary:'Jouw club. Jouw bijdrage.',secondary:'Een uurtje helpen maakt al een wereld van verschil.',value:'Vraag naar de mogelijkheden bij de club.',tag:'01 / CLUBOPROEP'},
  {id:'news-3',primary:'Moedig aan. Geef energie.',secondary:'Onze jeugd verdient jouw positieve support.',tag:'02 / LANGS DE LIJN'},
 ]}},
 {category:'Partners',name:'Samen maken we de club',content:{...common,kind:'partners',title:'Samen maken we de club.',eyebrow:'ONZE PARTNERS · ONZE WAARDERING',subtitle:'Achter onze kleuren staan mensen die het verschil maken.',rows:[
  ['BNU','bnu.svg'],['Kwaliteit Kozijnen Holland','kwaliteit-kozijnen-holland.svg'],['Proto Tegelzetbedrijf','proto-tegelzetbedrijf.svg'],['Deelman Daktechniek','deelman-daktechniek.svg'],['RW Repair','rw-repair.png'],['DG Webservices','dg-webservices.svg'],
 ].map(([primary,file],index)=>({id:`partner-${index}`,primary,image:`${A}/sponsors/${file}`}))}},
 {category:'Welkom',name:'Dit is onze trots',content:{...common,kind:'welkom',title:'Dit is Duindorp. Dit zijn wij.',eyebrow:'WELKOM OP HOUTRUST',subtitle:'Speler. Supporter. Vrijwilliger. Buur. Wat je ook brengt, je hoort erbij.',heroImage:`${A}/clubmuur-players/trio-1280.webp`,values:['Respect voor elkaar.','Positief langs de lijn.','Samen houden we het mooi.']}},
];
