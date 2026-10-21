# S237 — Rustige sponsorwerkplek

De sponsorroute stapelde de zichtbare campagnebibliotheek, partnerformulieren,
goedkeuring, materiaal, posities en CRM als grote kaders onder elkaar. De
gekozen Sourcewerkplek heeft vier tabbladen: Campagnes, Partners, Pipeline &
taken en Afspeelregistratie. Eén hoofdtaak en bijbehorende formulieren openen
nu gericht in bestaande toegankelijke dialogen. De werkelijke capabilities,
serveracties, nativePOSTs, campaign-/sponsorIDs en publicatieketen blijven
behouden. CRMonderdelen blijven gemount bij tabwissels; oude hashlinks werken.

De latere gebruikersvraag om minder massale containers is een expliciete
dichtheidsdelta op Source: de campagnebuitenkaart heeft geen tweede padding,
de werkelijke acties en Beheren delen één rij en status staat eenmaal in het
overzicht. Metrics worden ook op desktop compacte feitelijke samenvattingen. De
Sourceillustratie blijft binnen haar eigen kader. Alle controls behouden44px,
primaire copy14px en bestaande bronkleuren; immutable SourceCSS/assets gelijk.

De controle vond ook functionele fouten. Een gewone nieuwe campaigns-array
verwerkte dezelfde hash opnieuw en kon materiaalinvoer sluiten. Dezelfde
reeds verwerkte hash wordt eenmaal toegepast; nieuwe/onbekende latergevonden
hashes blijven werken. Verse campagneprops blijven status/capabilitykeuzes
sturen. De bestaande sponsorId gaat mee in de klant-DTO zodat materiaal voor
campagnevanB ook opB begint, zonder expliciete invoer bij refresh te vervangen.
De activiteiten tonen de echte SQLauditcodes in begrijpelijke taal.

## Validatie en grenzen

De eerdere writerfreeze heeft scopedlint/TSC, elf ongewijzigde CRMunits en
componentbewijs; de eerste huidige vollecohort7PASS/1readinessfixtureFAIL
blijft behouden. Radix verbergt bij directe campagnehash de achtergrondheading
terecht. Alleen die mount vraagt nu dezelfde h1tekst plus de echte zichtbare
dialoog. De partnerregressie faalde eerst met ontvangenA/verwachtB en is na
productcorrectie groen. Na de dichtheidscorrecties8/8PASS zonderretry/skip;
de laatste illustratiecontainmentcheck slaagt in een nieuw volledig huidig
cohort8/8,0SKIP/0retry in18,6seconden.
Alle68gecombineerde foundationtaken slagen (Control1272PASS/34bestaandeSKIP).

Componenttests gebruiken de echte serverpagina, werkruimte, forms en CSS met
expliciete gecontroleerde session/data/actiontransportgrenzen. Zij bewijzen
geen echte databasecommit, publicatie, audiencemeting of algemene pixelpariteit.
Root heeft native390/1440beelden bekeken. Echte AAL2routeacceptatie, exacte
gecommitteerde CI en staging/productie blijven eigen volgende grenzen. De
vijf volledige auditronden en V1 zijn niet afgerond. Fysieke24u/SendGrid/
YouTube/Mollie blijven volgens gebruikersinstructie uitgesteld.

## Laatste visuele vervolgcontrole
De echte1440capture toonde nog160px metrics,575px campagnekaarten en
afgesneden zoektekst. De lokale delta gebruikt nu compacte metriekrijen,
130px campagnebeelden en metadata zonder extra omkadering. Binnenruimte
blijft18px met14px tekst en44px acties. De zoekinput benut zijn werkelijke
breedte. Beide390/1440captures zijn opnieuw gemaakt en beoordeeld; er is
geen immutable SourceCSS gewijzigd.

Het bestaande CRM-Sheet is een bodyportal buiten de pagina. Het krijgt daarom
ook lokaal de Source scope, Manrope,26/24px titel en44px sluitknop. De echte
beideviewportcases controleren het zijpaneel, aXe, Escape en focus, zonder
nieuwe writes. De finale huidige cohort heeft8/8PASS,0retry/0skip,1worker in
19,6s (`/tmp/veyocast-s237-browser-root-current-crm-density-v3.json`).

De eerdere108,39px metricbevinding blijft in het v1rapport bewaard; padding
en gap zijn gericht verminderd, de100px-grens blijft gelijk. Het voorafgaande
volledige actuele foundationcohort heeft68/68PASS,64cached. Geïntegreerde
foundation na normale S234merge, exacte hosted CI en uitrol volgen apart.

Na de normale S234/S232/S236-dependencymerge is de volledige actuele
foundation68/68PASS,64cached; Control1.401PASS/34bestaandeSKIP. Log
`/tmp/veyocast-s237-integrated-foundation.log`. Eigencampagne-/CRMcode bleef
bij de merge ongewijzigd; hosted exacte CI en release blijven aparte gates.

## Bestaande CI-cases na de werkruimtewijziging

De eerste hosted Control-run op19549305 eindigt4FAIL/485PASS/629bestaandeSKIP.
Drie oude Sponsorcases verwachten nog de verwijderde Geen beeld-badge; hun
fixture heeft bovendien een los oud beheerdetailsblok. De shellcase verwacht
ook die verdwenen details/navigation/KPI-region. Het oorspronkelijke hosted
log blijft ongewijzigd op `/tmp/veyocast-s237-first-ci-control-failure.log`.
Dit zijn concrete verouderde presentatielocators, geen bewezen backendfouten.

De aanvullende testcorrectie mount de echte SyncSponsorWorkspace voor hetzelfde
Campagnescenario, met dezelfde geverifieerde preview-HTTPgrens. Het onbekende
beeld blijft feitelijk, inclusief het herstelpad in het echte previewvenster.
De bestaande beheerflow loopt via de echte Beherenbutton en geselecteerde
campagnedialoog; Escape sluit en herstelt focus. De shellcase volgt de vier
native tabs en bestaande Publicatie en posities-dialoog. Alle zeven Engage-
casebodies en save/mount/asset-/containmenthelpers blijven bytegelijk. Er zijn
geen productcode-, skip-, timeout- of commandwijzigingen. De lokale gerichte
correctieve uitkomst en eventuele werkelijke shellruntimegrens worden apart
vastgelegd, zonder de eerste hosted uitkomst te overschrijven.

Het gerichte lokale cohort op actuele code eindigt10PASS/1FAIL,0SKIP/0retry:
alle drie Sponsor- en zeven ongewijzigde Engagecases slagen. Ook het vernieuwde
Sponsorsegment in de echte shellcase slaagt. De latere bestaande Schermen-
navigatie faalt wanneer Nextdev2048 tijdens compilatie expliciet herstart bij
zijn gebruikte-geheugendrempel. De trace toont om03:25:46.599Z een geweigerde
RSC-verbinding; de ongewijzigde30sURLassert faalt om03:26:16.614490Z.

Een apart geautoriseerd cohort met uitsluitend dezelfde complete shellcase
op3072heap, na15/15read-onlyHTTP200-warmroutes, eindigt0PASS/1FAIL. Het
Sponsorsegment slaagt opnieuw; de bestaande Content-heading faalt terwijl de
actuele URL wel Content is en de bestaande loadingfallback zichtbaar blijft.
De RSC-response en page.js hebbenHTTP200; RSC krijgt tevensERR_ABORTED. Er
zijn geen pageErrors/crashevents of consoleerrors en geen runtime-restart.
De5sassertie beslaat in de trace feitelijk108340ms (03:30:09.492256Z tot
03:31:57.832550Z). Gemeten MemAvailable453440KiB bewijst gelijktijdige
resourcepressure, zonder een bewezen oorzaak voor deze render-/readinessfout.
De eerdere uitkomsten worden niet door deze diagnose overschreven.

Beide browsers sluiten aantoonbaar metexit0; de eigen3403-runtime is alleen
via zijn eigen procesgroep gestopt en de poort is dicht. ScopedESLint en
TypeScript voor beide tests slagen. Bounded volledige foundationCPU4,5/
concurrency1 slaagt68/68,67cached,4.639s; Control1401PASS/34bestaandeSKIP.
De laagste gesamplede MemAvailable tijdens foundation is4125MiB. Geen product-,
command-, testtimeout- of skipwijziging. De eerste hosted4FAIL/485PASS/629SKIP
en beide lokale rode shellgrenzen blijven bewaard in
`/dev/shm/veyocast-s237-ci-followup`. Volledige shellacceptatie wacht op de
gecombineerde S244-productiebuild; er volgt geen extra lokale devherhaling.

## Afgesloten productiebuild en volledige shell

De daarop afzonderlijk geautoriseerde bounded productiebuild van dezelfde
producttree19549305 en dezelfde twee testcorrecties slaagt metexit0 in97.10s.
Build gebruikt NODE_ENVproduction; nextstart gebruikt daarna de bestaande
NODE_ENVdevelopment-demomodus zonder Supabase/deploymentconfig. Het is een
gebouwde lokale demoruntime, zonder echte database-/AAL2-/productieacceptatieclaim.
Werkelijke BUILD_ID: `MMH-5Ur-pGvA_B7wtCkvr` (SHA256
`536eb09c0961e75476202aba8e3f0363130af30aaa7e5c7b84c7ef1de09b78ad`).

De exact ongewijzigde volledige shellcase slaagt hier1/1PASS in9.4s
(suite10.1s),1worker0retry0skip en actualrunnerexit0. Alle bestaande navigatie-,
rollen-, demo-, lege-, sponsor-, schermwizard- en platformasserties blijven
behouden. Dit is een afzonderlijk groen builtcohort naast de10geslaagde
componentcases uit de eerder rode11cohort; de oorspronkelijke hosted en beide
lokale rode uitkomsten blijven zichtbaar bewaard. De ruwe browserlog bevat
ancillaryprefetchCORS/RSCfallbacks voor localhost-redirects vanaf127.0.0.1 bij
Products/platformgebruikers. Daarom geen consoleclean- of algemene routerfixclaim.

Build en runtime zijn begrensd opCPU4,5/3072heap, één Nextstaticworker; minimale
gesamplede MemAvailable respectievelijk3657MiB en4626MiB, geen drukstop. De oude
eigen devoutput blijft volledig behouden via zijn oorspronkelijke RAMtarget
en een hernoemde genegeerde symlink. Alle oude filehashes, vier tracked
configbestanden en frozenproduct/testtree zijn na de build exact gelijk.
De browser sluitgraceful metexit0; alleen de eigen3403procesgroep is metSIGTERM
gestopt en de poort is dicht. De eerdere foundation68/68 en scopedlint/TSC
blijven toepasselijk op dezelfde product-/testcode.

Bewijs: `/dev/shm/veyocast-s237-ci-followup/built-current-tree.json`,
`built-build-exit.json` en `built-shell/report.json` plus `closure.json`.
Root neemt de bijgewerkte vierpaths-overdrachtpatch byte-identiek mee naar
S244 voor finale gecombineerde CI; afzonderlijke S237head/PR266 en hun eerste
CI-rood blijven behouden. Er is hier niets gecommit of gepusht en geen tweede
productbrowsercohort of extra CI-ronde gestart.
