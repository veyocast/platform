# S244 — Geïntegreerde Sync-acceptatie en normale uitrol

Dit is de integratie en eindcontrole binnen de oorspronkelijke expliciete
gebruikersopdracht: voer de startprompt volledig uit, deploy staging/productie,
vergelijk diepgaand met gekozen prototype1/Sync, verwijder oude oranje
bediening, herstel OnzeTrots-achtergronden en verminder massale geneste vakken.
De gevraagde vijf volledige vergelijkingsronden blijven een echte open gate;
vijf viewports of losse tests worden niet als vijf volledige ronden geteld.
Fysieke apparaat-/24u-tests, SendGrid-accountconfiguratie, YouTube en Mollie
zijn door de gebruiker uitgesteld. Nieuwe betaal-/retentieactivatie valt hier
niet onder. Geen nieuwe gebruikerstoestemming nodig voor de al opgedragen uitrol.

## Branch, worktree en writer

Root is de enige integratiewriter. Hergebruik het schone gemergde
`/home/codex/repos/castivo-s235` op nieuwe branch
`veyocast/s244-integrated-sync-acceptance`, basis
`c3a5ca493fb22b11bd5aac3abd96fa20742c0bff`. De oude S235-branch,
commits, runtime-output en bewijs blijven behouden. Een taak/branch/worktree/PR.
Lees README, PLANS, ledger, technische/design/Publisher/security/offlinecanon
en de relevante S234–S243-prompts. De laatste gebruikersdelta voor gekozen
Sync-primary gaat boven de historische algemene Orange-regel.

## Exclusieve ownership

- Gewone Git-integratie van de exacte bevroren S237, S238, S239, S240, S241,
  S242 en S243 featureheads. Geen force, amend, rebase of branchverwijdering.
  Alle oorspronkelijke PRs, rode resultaten en lokale/hosted bewijzen behouden.
- Expliciet afgebakende vervolgcorrecties S245/S246 normaal integreren na hun
  afzonderlijke rootreview. S245 gebruikt vaste officiële on-surface-kleuren
  voor twee werkelijk te lichte statusvoorgronden en herstelt uitsluitend de
  ontbrekende Source-actiefmarkering. S246 vervangt uitsluitend de bewezen
  oranje LED-editorbediening en geselecteerde UI-vlakken binnen Sync; de
  inhoudspaletten, canvaspixels en configuratiecontracten blijven behouden.
  Iedere correctie heeft eigen branch/worktree/PR, rood-groenbewijs en prompt.
- De verdere concrete auditbevindingen S247/S248 volgen dezelfde aparte
  reviewgrens. S247 raakt uitsluitend audit-/thema-editorbediening in de
  lokale Sync-scope. S248 groepeert de bestaande extra LED-taken met native
  disclosures en behoudt alle formulieren, permissions, keys, anchors en
  fout-/editretouren. Geen writer of inhoudscontract wordt vervangen.
- De afzonderlijk gereviewde vervolgheads S249–S252 normaal integreren.
  S249 corrigeert alleen de combinatie van bestaande statusverwachtingen.
  S250 is een expliciete dependency-taak: exact Next15.5.20, één SSR-optin
  en een twintigregelige pnpm-patch in twee vendored Schedulerbestanden;
  alleen hiervoor zijn patchregistratie en de mechanische lockdelta toegestaan.
  De originele packageversies, manifests, integrities en peergraph blijven gelijk.
  S251 herstelt drie werkelijk gereproduceerde mobiele indelingsdefecten.
  S252 herstelt lokale clubkleur-swatches en de behouden doelpunteditorpreview;
  canonical renderer, exports, commands en Player blijven behouden.
- S253 als afzonderlijke noodzakelijke CI-correctie integreren: uitsluitend
  de te brede LG-patchban in de bestaande workflow/test vervangen door één
  gedeelde canonical-mapguard voor de officiële webOSCLI. Dezelfde echte
  versie-, header-, ares-, wrapper-, hosted- en artifactchecks blijven behouden.
  Geen packager-, versie-, dependency-, IPK- of deploymentcontractwijziging.
- `TASK_LEDGER.md`, dit prompt, `docs/s244-integrated-sync-acceptance.md`,
  `execution/CURRENT-STATE.md`, `execution/PLAN.md`,
  `execution/scenario-acceptatie.csv`, `execution/opruimregister.csv`,
  `execution/evidence/s244-*` voor waarheidgetrouwe actuele mapping/bewijsindex.
- De exact bevroren S237-testoverdracht: bestaande
  `tests/control/sites-engage-sponsors-workflows.spec.ts` en
  `tests/e2e/control-shell.spec.ts`, plus S237-eigendoc en sprintprompt.
  Uitsluitend de oude Sponsor-fixture/verdwenen disclosure vervangen door de
  echte workspace/tabs/dialogs; alle Engagebodies/transporthelpers en overige
  shellasserties blijven bytegelijk. Eerst de volledige shell op de actuele
  gebouwde S237-producttree sluiten, daarna patch byte-identiek overnemen en
  op de uiteindelijke S244-CI testen. De oorspronkelijke vier hosted failures
  blijven bij PR266; geen afzonderlijke featurepush nodig voor deze testmapping.
- Mergeconflicten in de reeds toegewezen featurepaden uitsluitend oplossen
  door beide bewezen functies en hun bestaande beveiligings-/transportgrenzen
  te behouden. Concreet conflicterende productpaden eerst met hunk en beide
  invarianten documenteren; geen stilzwijgende functionele herbouw.
- Eigen tijdelijke lokale acceptatiescripts, beschermde bewijsbestanden en
  RAM-buildoutput. Werkelijke QA blijft57621/57622; geen reset/backfill.
  Alle drie noodzakelijke forwards zijn afzonderlijk al bewezen; galerijforward
  heeft historie179→180 en alle rijen van162 tenanttabellen exact behouden.

Buiten de afzonderlijk goedgekeurde S250-patch geen nieuwe dependencies of
lockfilemutatie; geen schema, publieke RPC, tokens, Source-assets,
serviceworker, playeractivatiecontract of releaseworkflowmutatie. De reeds
afzonderlijk S238-goedgekeurde CI-fixtureprep wordt normaal geïntegreerd.
Nieuwe werkelijke defecten buiten deze integratie stoppen/melden met concrete
scope; vervolg krijgt eigen taak/branch wanneer nodig.

## Gates en acceptatie

Inventariseer iedere exacte head, merge zonder geschiedenisherschrijving,
bewaar originele lokale/hosted failures, en leg de uiteindelijke tree vast.
Doe passende gecombineerde lint/typecheck/test, UI/aXe/Chromium, Player/offline
en bestaande CI-gates op de uiteindelijke versie. SQL is al gecombineerd met
199 migraties/134 bestanden/4267 assertions en nul lintfouten getoetst; geen
redundante reset van de echte QA-omgeving. Elke nieuwe test moet gedrag bewijzen,
geen ruimere timeout, skip of tolerantie toevoegen om groen te worden.

Één lokale browserwriter tegelijk; alle execsessies moeten echt exit hebben
en eigen browsers afgesloten zijn vóór overdracht. Zware gates uitsluitend
begrensd met twee CPU's/concurrency1 en voldoende MemAvailable; artifacts naar
unieke RAM-mappen met metadata buiten Next-output. Bewijs en oude captures
nooit overschrijven of verwijderen om een mislukking te verbergen.

Vergelijk de samengestelde actuele routes en toestanden met de immutable
Source bij dezelfde data/toestand, desktop/mobiel, en de Player bij16:9/9:16
en beide thema's. Registreer per ronde dekking, afwijking, reparatie en grenzen.
Werkelijke AAL2-services onderscheiden van gecontroleerde transports en
hardware. Onbekende eerste koudeSSR/PGRST303 behouden als bevinding totdat de
oorzaak of begrensde acceptatie echt bewezen is; latere200 is geen oorzaakanalyse.

Na groene exacte gecombineerde PR-gates: normale integratie naar main, volg
auto-staging en verplichte pairing-/LG-recovery-smokes, promoveer uitsluitend
dezelfde immutable release via bestaande handmatige productieworkflow en
normale environmentreview. Verifieer vijf publieke healthversies en relevante
echte gebruikersflows. Geen V1-/pixelpariteit-/vijf-rondenclaim zonder bewijs.


## Aanvullende bewezen UI-afwerking

Integreer S2553bfc3dd0 en S25602ba14c9 normaal met behoud van beide taakregistraties.
De concrete scopes omvatten opgeslagen Studio-aanraakdoelen, vijf verdere
Sync-UIaccenten, huisstijl-/bewegingslabels, twee korte wizardhints en pagina-
enkelvoud. De bestaande wizardfixture mag exact zes onveranderde OnzeTrots-
catalogusbeelden serveren en beide bestaande breedtegevallen moeten de drie
echte portretminiaturen vóór hun DesignPNG decoderen. Geen asset-/renderer-/
command-/schema-/dependencywijziging. Nieuwe volledige appbuilds en capturen
blijven vereist;6+2 gerichte PASS en de CDP-observabilityproef zijn geen ronde.
Behoud de negen oorspronkelijke A-React418-fouten als open totdat concrete
oorzaak/afsluiting bewezen is. Strikte empirisch gebonden read-actionuitzonderingen
zijn uitsluitend voor bestaande pure-readcommands; iedere mutator blijft
geblokkeerd. Bron/Inhoud, gekoppelde keuzes en publieke website/auth-GET
worden afzonderlijk met hun echte eigen bindings getoetst.


## Finale aanvullende integratie

Integreer S257 en S258 normaal na afzonderlijke rootreview. S257 omvat exact
elf eigen paden voor retained Marketingchrome, bestaande Sync-productpreview,
compacte koppen/contact en tekstafwerking plus twee bestaande testuitbreidingen.
De laatste twee letterlijke featurePage-strings/unusedvar volgen ná2PASS en
moeten door de nieuwe gezamenlijke build/57routes worden gecertificeerd.
S258 omvat exact vier eigen paden: bestaande Playerreconnectcase uitsluitend
twee executeAt-offsets+comment en eigen docs/ledger. Geen assert/deadline- of
Playerproductdelta. Behoud rood CI en de0case-harnasstop. Nieuwe exacteCI en
rootfoundation zijn vereist. Bind de bestaande normale installatie opnieuw;
geen herinstallatie. Bouw Control en Marketing serieel met lokale publieke
compileorigins. Herstel de tijdelijk gestopte oude S215-analyticscontainer vóór
finale captures. Laat alle oorspronkelijke negen React418-fouten open tot
werkelijk nieuwe diagnose/afsluiting; alle57+404 publieke routes krijgen beide
breedtes en aaneengesloten native scrollbeelden. Vijf volledige reviews blijven
0/5 tot de complete actuele cohort daadwerkelijk is beoordeeld.


## S259 en definitieve bronbinding

Integreer de zeven gereviewde S259-paden normaal. Behoud de historische09dCI
13success/1Marketingfailure/1conditioneleIPKskip en21PASS/3FAIL. De laatste
volledige S259Marketingbuild sluit drie legal-/printgevallen en dezelfde twee
retained-routegevallen zonder retries/skips; dit is geen volledige ronde.
Bind daarna alle concrete bronrefs via de gereviewde v3-pipeline, voer verse
bestaande-installcontinuïteit en foundation uit en bouw Control/Marketing
achtereenvolgens. Geen herinstallatie of hergebruik van09d als nieuwe-head-PASS.
Herstel de oude S215analytics vóór captures. Negen native Controlfouten,
alle A/C/B/W/P-captures en vijf volledige vergelijkingen blijven expliciet open.


## S260 en resterende functionele V1-grenzen

Integreer S260 normaal: twee gedeelde UIcomponenten, eigen native2case spec en
docs/ledger, exactzes paden. Behoud origineel rood, fixture-/meetfailures,
pre-glyph2PASS en laatste2PASS7e50fcf5 afzonderlijk. Root bekeek de laatste
390/1440-beelden en het leesbare20px/48px sluiticoon. Geen volledige ronde.
Sluit vóór de finale bronfreeze ook menu.price_update (V1-canon§7) en24opties
bij Sync-Interactie (§10) met echte diff/kandidaten/prijsfreeze respectievelijk
leesbare paginering en legacy-binarycompatibiliteit. S261/S262 krijgen eigen
ownership; supabase/migrations heeft één schrijver tegelijk, S262 eerst.
Geen currentQA57621/57622-reset/forward zonder beoordeelde isolatedRLSproof;
behoud bestaande rijen/historie. Bouw/capture pas op de nieuwe geïntegreerde
bron. Oude pipelineV4 en fcd-actuals blijven bevroren historisch bewijs.


## Geïntegreerde S261/S262/S263 en gesloten databasegate

De drie featureheads zijn normaal opgenomen; behoud hun exacte18/26/6 scopes en
de oorspronkelijke failures. De V18cohort sloot echt0:201reset,187gericht,
136bestanden/4454pgTAPchecks en CLI-errorlint. Dit is een equivalent lokaal
pg_prove-bewijs, geen voltooide finaleCLI/CI. Gebruik de gereviewde V5-pipeline
met nieuwe complete bronrefs en exacte Control-/Player-/Marketingtrees; bind de
S261-diff in normale indexvorm9ad1d50b, niet de inhoudelijk gelijke full-indexvorm.

Voer verse continuïteit en foundation uit, dan seriële Control-/Marketingbuilds.
Alleen beoordeelde tijdelijke capaciteitshulp, met daadwerkelijke vloeren en
exact herstel. QA-forward blijft twee specifieke nieuwe migrations in éénTX na
actuele15functiepreconditions, geenreset/19gaprepair. HerstelS215analytics vóór
Auth/captures. De aparte prijs-/focusaux verandert de oorspronkelijkeA59 niet;
prijsread blijft achter echte nativewire/compiledpureexportbinding, andere
POSTs dicht. Echte24-optie-MP4/QR en drie clientprofielen blijven afzonderlijk
odig. AlleA/C/B/W/P-captures en vijf volledige vergelijkingen zijn nog open:
0/5, negen oorspronkelijkeReact418, exacteCI en staging/productie niet afgerond.

## 20 oktober — lokale capaciteit en S264-integratiefouten

Gebruiker heeft lokale opruiming expliciet toegestaan. Ongebruikte Docker-buildcache ouder dan24uur is verwijderd:7.640.293.376bytes vrije ruimte herwonnen;171containerconfiguraties/mounts,65images en168volumes behouden. Drie reeds duizenden keren herstartende andere Fieldgrid-diensten blijven apart als runtime-drift gemeld. Er is geen container, image of volume verwijderd. Bewaarde Turbo/npm/computed-payloads en vier afgesloten oude buildmappen zijn byte-/metadata-getrouw naar hostopslag gebracht; alleen geverifieerde duplicaten uit RAM verwijderd. Beschikbaar geheugen circa4,7GB; geen extra QA/S215-dienst stilgezet.

92cc-CI vond een Source-save-request-typefout en vier oude browsercases. S264a5bff348 is normaal geïntegreerd via be970f94 (PR289): de bestaande strikte requestparser vernauwt het bevestigde save-request; drie fixtures volgen de reeds goedgekeurde focuskleur/bronhash en weigeren onverwachte nieuwe prijsacties. Gerichte lint, volledige Control-typecheck en11bestaande+2Source/prijs-Chromiumcases zijn groen,0skips/retries. Eerste pnpm-autocontrole verwijderde gedeelde dependencylinks; normale frozen/offline-install met uitsluitend optimistic-repeat uit herstelde deze. Bron/lockfile gelijk, geen dependencyversies gewijzigd. De eerste1024MiB-typecheck bleef heap-rood; de toepasselijke2048MiB-foundationheap slaagde. Alle originele rode logs blijven behouden.

De gewone hosted Database/RLS-gate op92cc is groen; de rode PR/ControlMobile-gates blijven voor die SHA rood. Geen resultaat wordt later-head-PASS genoemd. Volgende acties: nieuwe bron/installcontinuïteit en volledige foundation, Control/Marketingbuilds, MP4-keten, exact twee QA-forwards zonder reset, herstelS215analytics en echte finale browsercohorts. De negen eerdere React418 en0/5 complete visuele reviews blijven open; er is nog geen nieuwe staging-/productie-uitrol. Bewijspins staan in de nieuwe post92ccMaintenanceAndS264-epoch; oudere epochs en148scenario’s/36contracten blijven behouden.

## 20 oktober — aanvullende matrixbevindingen en lokale gecombineerde kandidaat

Root heeft drie volledige matrixreviews met bevindingen/beperkingen afgerond:
alle617 cellen/337 groepen en148 criteria gelezen,3.200 oorspronkelijke native
PNG plus aanvullingen; dit is geen vijf-ronden-/algemene pixel-/V1-acceptatie.
De huidige originalindex/ruwe failures blijven ongewijzigd. S268–S276 zijn
noodzakelijke, afzonderlijk gereviewde vervolgcorrecties met eigen ownership.
Hun exacte featureheads worden normaal geïntegreerd; S268–S274 en S275/S276
hebben ieder tien groene exacte featurechecks. De bestaande normale
8e03-installatie blijft bytegetrouw in gebruik; geen herinstallatie.

Integreer ook de afzonderlijke S277/S278-CSS-scopes normaal. S277 koppelt
behouden beheerrollen aan de gekozen vaste lichte Sync-werkruimte onder de
oude donkere voorkeur. S278 corrigeert concrete kleinere status-/surface-
bevindingen, exact drie lokale CSS-modules en uitsluitend de adapterfixturehash.
Source, roottokens, inhoudsrenderers, writers en gegevens blijven behouden.
177 echte S277defaultrequests,28 S278routegevallen en36×2 bestaande handmatige
beginpreviews hebben afzonderlijke oorspronkelijke nativebewijzen. Lege
beginsituaties zijn geen ingevulde/gekopppelde-data-acceptatie.

Een lokale normale integratiekandidaat mag nu alvast worden gebouwd en gelezen
terwijl de exacte S277/S278-featurechecks lopen. Dit publiceert niets: geen
Rootintegratiepush/mainmerge/deploy zolang die featuregates niet exact groen
zijn. Daarna blijven de gecombineerde exacte PR270-gates, de nieuwe werkelijke
appbuilds, matrixronden4–5, staging-smokes en dezelfde-SHA-productiepromotie
verplicht. Nieuwe SDK-continuïteit noemt de eerdere normale installatie bij
haar echte8e03-basis; zij wordt niet als nieuwe installatie voorgesteld.

Alle oude Source-/SDK-/capturefails en de nieuwe runtime-outer143 blijven met
hun eigen uitslagen behouden. Afzonderlijke lege procesgroepen/idle/fullSDK-
controle is geen herschrijving van die143. Geen extra provideraccount- of
fysieke testvraag; de eerder door gebruiker uitgestelde grenzen blijven expliciet.

## 21 oktober — integratie van de laatste werkelijke beeldbevindingen

S277 en S278 hebben nu ieder tien groene exacte featurechecks. Behoud ook de
oorspronkelijke S277-Control-failure met de gemeten43,999969px en de ene normale
rerun op dezelfde SHA; de oorzaak is niet bewezen. Integreer de gereviewde
S279/S280/S281-heads normaal. Hun afzonderlijke ownership, native tegenproeven,
autentieke AAL2-readbacks en oorspronkelijke failures blijven behouden. Geen
sourcewijziging buiten die scopes. S281 voegt uitsluitend een lokale begrensde
Goal-previewfont-/stijlgrens toe; gedeelde renderers/Player blijven ongewijzigd.

De afhankelijke S279-Control-CI faalt op de oudere wizardtestbasis: die mist
exact de reeds bewezen S275-readinessregels die Root74 wel bevat. Dit is geen
groene featuregate en wordt niet zo genoemd. De gezamenlijke integratie krijgt
de bestaande S275-regels en moet alle normale exacte PR270-gates opnieuw halen.
Geen blinde rerun van de oude bronbasis, aangepaste tolerantie of skip.

Bevries de nieuwe gezamenlijke bron, bind de bestaande normale SDK-installatie
met een nieuwe continuïteitsverklaring en bouw Control/Marketing werkelijk
opnieuw. Bewaar de74eb-builds/captures als historisch bewijs. Controleer de
nieuwe kleine contrastrollen/keuzevelden en de koude Goal-preview in de echte
app; voltooi daarna de volledige matrixronden4–5. De148 scenario’s behouden hun
aantoonbare bewijsniveau en expliciet uitgestelde externe grenzen. Daarna de
exacte gecombineerde CI, normale main-integratie, staging-smokes en productie
met dezelfde immutable SHA/digests. Nog geen nieuwe deployment of V1-compleet.

## 21 oktober — vijf matrixreviews en lokale actuele appbewijzen gesloten

Vijf volledige reviews met bevindingen/grenzen zijn nu werkelijk vastgelegd;
zelfde Rootreviewer,617cellen/337groepen/148criteria. Behoud oorspronkelijke
ruwe statussen en failures. De nieuwe ca097224-productbron heeft foundation
30/30 per gate, twee echte appbuilds,236defaultobservaties/390beoordeeldePNG,
22publiekeviewports en4echteGoal-oriëntatiebeelden. De eerste lokale QA-
rolreadfout blijft onbekende oorzaak; latere200's zijn geen causaliteitsbewijs.
De24 oorspronkelijke ontbrekende defaultalias-/viewportrequests hebben in de
nieuwe59×4cohort wel afzonderlijke genuine200/BID-/terminalbewijzen.

Werk uitsluitend eigen docs/ledger/execution/evidence bij. Een volgende
commit met alleen deze registratie krijgt een expliciete app-tree-equivalentie
naar ca097224; oude nativeexecuties worden niet naar een andere head hernoemd.
Daarna normale Rootpush en exacte gecombineerde14CI-gates plus bestaande
conditioneleIPK-skip, vóór main/staging/productie. Geen force/historyrewrite,
nieuwe provider-/hardwarevraag of ongevraagde financiële flagactivatie.
