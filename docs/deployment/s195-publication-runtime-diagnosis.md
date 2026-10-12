# S195: productiequery en completiondiagnose

S194 is op staging en productie uitgerold als 3dfa75ca. De eerste live workerprobe
bevestigt gezonde LED-verbinding en succesvolle Sportlink-data/projecties. De volgende
gewone matches-run faalde met een algemene completioncode; de aparte inventarisatie
faalde ná tenant- en schemaquery. De exacte oorzaak is nog niet vastgesteld.

S195 bewaart procesfase en uitsluitend allowlisted foutcategorieën en introduceert
begrensde, vaste read-only plan/statistiekdiagnose. Het wijzigen van foutclassificatie
bewijst geen herstel van de onderliggende oorzaak. De eerdere failures blijven bij
PR219 geregistreerd. Actuele uitrol- en nacontrolebewijzen volgen aan de nieuwe PR.

De bestaande get_live_integration_diagnostics_v1 sanitiseert nieuwe completioncodes
voorlopig als UNKNOWN_ERROR. Dit is een beperking van de oude formatter, geen
gewijzigde runstatus. De nieuwe scoped operationele probe leest de opgeslagen
laatste completioncode rechtstreeks en sanitiseert die met dezelfde JS-allowlist.
Productiediagnose gebruikt daarom die probe naast de algemene readback.

Lokale gates: workspace lint/typecheck/test elk30/30, respectievelijk29/29/28
cachedtaken. Worker256PASS met250 bestaande opt-inskips; gerichte completiontests61PASS.
Opsregressies:84 bestaande tests plus13 proces- en23 probe-tests; runnerpolicy8PASS.
De gepinde Actionlint/ShellCheck valideert beide gewijzigde workflows; gerichte
scriptlint, syntax en diffcheck zijn groen. De finale securityreview vond aanvullend
dat SIGINT/SIGTERM de detached diagnosegroep nog konden achterlaten; dit is
vóór commit gecorrigeerd. Echte CLI-tests annuleren tijdens metadata en EXPLAIN,
stoppen de wrapper en descendant en behouden exit130/143. Alle23 probe-tests slagen. Geen diagnoseclaim
vervangt de vereiste gewone cycli en productie-opruimingscontrole.

De eerste PR-CI opcf797971 heeft volledige Sourcevergelijking SUCCESS:
548 oorspronkelijke cases/644frames en652 totale pixelcases/760frames zonder
verschil;66responsivecriteria. Playerpoging1 faalt op één clippositieassertie
(0.937735 tegenover<0.85); de ene gerichte herhaling faalt op offline diagnostics
(PLAYING blijft5000ms terwijl cached playback en compacte offlineindicator werken).
Dit zijn verschillende applicationasserties, geen bewezen browsercrash. De
originele logs blijven bewaard, SHA2561b4d1fcf9c869d15d5c2435f445d84b8014be7f3050157d0f3f87a367f821053
en3dc8551347761d70b84b6006d9dde7000aa2924cad64f80087d2d122759dabab.

Root heeft de begrensde ownershipuitbreiding vóór wijzigingen gerapporteerd.
Drie gecontroleerde nieuwe tests falen op de oude echte Player-build: twee
vastgehouden manifestrequests worden niet afgebroken, en echte MP4-playback
overschrijdt endMs zonder periodieke timeupdate. De reparatie annuleert en
invalideert bij offline-event de actieve manifestfetch en behoudt de bestaande
nieuwe origincontrole/LKG. Eén rAF-bewaking controleert een zichtbaar spelend
videofragment per frame, naast bestaande mediaevents; pauze, hidden,
reduced-motion en cleanup stoppen de callback. Bestaande bounds en Sourcebytes
blijven intact. Tests en nieuwe exacte-SHA-CI volgen vóór promotie; dit bewijs
van de oude commit geldt niet automatisch voor de gewijzigde Player-code.

De nieuwe echte Player-build slaagt op vijf gerichte browsercases: beide originele
CI-assertions blijven ongewijzigd, twee vastgehouden native fetches worden werkelijk
afgebroken en gevolgd door nieuwe bereikbare/onbereikbare originchecks, en echte
MP4-playback blijft binnen de bestaande clipbounds met herhaalde wraps. De callback
stopt bij pause/hidden/reduced-motion en hervat zichtbaar. De onafhankelijk
read-only review van alle vier Player-files geeft ACK. Finale workspace lint,
typecheck en test slagen elk30/30, werkelijk exit0; logs staan buiten de repo in
/tmp/veyocast-s195-local-gates/player-final-workspace-*.log. Het bredere relevante browsercohort is eveneens groen:39/39 werkelijke tests,
exit0, met beide gewijzigde specs, latest-publication, periodic-manifest-sync,
publisher-presentation en alle player-offline-tests. SHA256 van de private log:
416895a64b34285d33f9a7da90bd892e40492109754a73a85b5fae00406f1c7a.
Nieuwe exacte-head CI blijft vereist vóór merge; gegenereerde screenshot is
privé bewaard en de ongerelateerde tracked wijziging hersteld vóór commit.

De finale exacte headcd25bec5 slaagt in PR38277557026 en Sites38277557046 op
alle vijf jobs: workspace30/30, build18/18, Player238PASS/15 bestaandeSKIP,
Control298PASS/562 conditioneleSKIP, Marketing16PASS, Cross4PASS/2SKIP; alle
548 oorspronkelijke cases/644frames en652 strikte cases/760frames nulverschil,
66responsive. PR220 is als0f017060 gemerged met exact dezelfde geteste boom.
Staging38281248728 SUCCESS op0f017060, inclusief health/pairing/LG-smoke.
Productie blijft bij deze waarneming gezond op3dfa75ca. De protected probe
38281293442 leest tenant en statistiek binnen het normale budget; zeven enabled
Sportlinkpolicies hebben laatst SUCCESS, maar dit is geen bewijs voor twee
finale gewone cycli. EXPLAIN faalt binnen1.552s op SQL_OUTPUT_TOO_LARGE.
Dezelfde vaste query wordt inS197 compacter gelezen binnen dezelfde grenzen.
