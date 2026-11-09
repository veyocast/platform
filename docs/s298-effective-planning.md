# S298 · Effectieve planning per scherm

De bestaande Planning toont nu via **Nu, Hierna en Waarom** de uitkomst van de
werkelijke scheduler. Het bestaande agendablok heet **Agenda**: een volgend
kalendermoment hoeft immers geen nieuwe winnaar te worden. De normale
playlistpublicatie en het plannen van een moment hebben een expliciete,
alleen-lezen vooruitblik. Geen controleknop slaat een regel op, publiceert een
playlist of stuurt een playeropdracht.

Startbasis: main `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`, na S295/PR #324.
Dit is fase B1 uit de overdracht van 9 november. De gebruiker heeft implementatie
en daarna de normale staging- en productiepromotie expliciet aangevraagd.

## Eén resolver

Forwardmigratie `20261109114134_s298_effective_planning_preview.sql` haalt alleen
de bestaande kandidaatselectie uit de actieve S185-scheduler en S191-herstelroute.
Beide schrijfroutes gebruiken daarna dezelfde private selectie als de nieuwe
`preview_effective_planning_v1`. Schermlocks, assignments, target-snapshots,
publicatieversies, audits en overige schrijfvolgorde blijven behouden.

De rangschikking blijft bron → individueel scherm/groep → prioriteit → later
begin → stabiel ID. Een gepubliceerde doelgroep gebruikt haar bestaande
vastgelegde schermlidmaatschap. Een voorstel voor een nieuwe groep gebruikt de
expliciet geselecteerde huidige leden en verandert geen snapshot.

**Hierna** doorloopt begrensde mogelijke overgangstijden en neemt alleen de
eerste veranderde uitkomst op. Begin/einde, lokale middernacht, terugkerende
vensters, beide voorkomens bij wintertijd en de klokovergang zelf worden met de
bestaande due-predicate beoordeeld. De bestaande weekday-at-evaluation-regel
voor een venster over middernacht wordt behouden.

Een voorstel wordt uitsluitend in geheugen samengesteld. Een gewijzigde
opgeslagen regel vereist haar actuele revisie; een stale revisie geeft `PT409`.
Bij een volledig gelijke nieuwe rang staat expliciet dat de definitieve
ID-volgorde pas na opslaan bekend is. Een conceptstandaard heeft nog geen
gepubliceerde versie en wordt zo gelabeld. De gewone publicatiecontrole blijft
afspeelcapaciteiten en publiceerbaarheid beoordelen.

## Scope en zichtbare betekenis

De authenticated RPC vereist een actieve of gepauzeerde eigen tenant, planning-
én schermleesrechten en één tot vijftig verschillende eigen schermen. Private
helpers zijn niet rechtstreeks uitvoerbaar. Alleen begrensde metadata verlaat
de RPC; geen devicecredential, providerpayload of manifest met signed URLs.

De horizon is standaard acht, maximaal 31 dagen; de ondersteunde kalender loopt
van 2000 inclusief tot 2100 exclusief. Hoogstens 10.000 overgangspunten worden
per scherm onderzocht. Een onvolledige zoekhorizon en het ontbreken van een
gevonden wissel worden zichtbaar benoemd. Schermen zijn op naam te zoeken,
ook wanneer de eerste honderd opties niet de hele vereniging omvatten.

De berekende winnaar staat apart van de gewenste assignment en de door de
player bevestigde publicatie met tijd. Een toewijzing of een recente heartbeat
geldt niet als framebewijs. S296 levert de gedeelde contactdefinitie voor de
uiteindelijke geïntegreerde release; de planning consumeert dezelfde helper.

## Verificatie

| Gate | Werkelijk verzameld bewijs |
| --- | --- |
| Gerichte SQL/RLS | 39 assertions: echte authoring/publicatie, overlaprang, verliezende tussenregel, echte apply/hervatting, geen writes, vastgelegde groepsleden, concept/CAS, DST/middernacht, tenant/anon/private ACL en kalendergrenzen. |
| Verse gecombineerde database | Exacte S296/S298/S299-migraties vanaf een verse geïsoleerde reset: 152 bestanden, 5.064 assertions, PASS in 121 s. Public/private lint en securityadvisors zonder fouten. |
| Readcontract | Negen tests met de daadwerkelijke rollback-only RPC-uitvoer: exacte query, volledige projectie, targets vóór databaseafroep begrensd, autorisatie-/CAS-/RPC-fouten en onvolledig antwoord. |
| Zichtbare browser | Vijf eigen cases plus twintig bestaande scherm-/compositie-/planningsflows: 25 PASS in 44,5 s. 320/1440 px, werkelijke Nu/Hierna, alternatieven, toetsenbord, axe zonder violations, expliciete controles en een laat antwoord voor de vorige schermselectie. |
| Workspace | Lint, typecheck en tests elk 30/30 taken PASS. Control: 2.076 PASS en 34 bestaande skips. |
| Build | Echte Control-productiebuild PASS, inclusief auth-boundary en client-secretguards. Geen nieuwe dependency of lockfilewijziging. |

De browser gebruikt de echte componenten en CSS, met gecontroleerd readtransport
en de exacte door SQL/RPC gegenereerde fixture. Dit is geen geauthenticeerde
hosted Control-proef. `scripts/verify-s298-effective-planning.mjs` kan uitsluitend
een lokale database op 127.0.0.1 benaderen en rolt zijn setup terug. De aparte
S295-canary hieronder gebruikt daadwerkelijk het hosted webplayerpad.

Eerste lokale typecheck vond een verkeerd getypeerde nieuwe `it.each`-fixture;
de cases zijn daarna als echte arrayvelden uitgevoerd. De bestaande standalone
wizardharnas had na de extra readcomponent ook een Next-Link-transportadapter
nodig. De oorspronkelijke faallogs zijn behouden onder `/tmp/s298-*`; de
uiteindelijke 25 cases hebben dezelfde functionele en geometrieassertions.

De onafhankelijke SQL-review bevestigde de actieve voorgangers, rangschikking,
write-/lockvolgorde, begrenzing, tenantcontrole en DST-overgangen. Normale CI,
review en staging-/productiepromotie blijven aan de uiteindelijke SHA gebonden.

De eerste normale CI op `cd820254` vond zes echte responsieve regressies: de
nieuwe link boven de kalender verplaatste de kalender en vervolgdelen met
41,09–47,09 px. De link staat nu in het bestaande laatste hulpblok. Alle zes
oorspronkelijke Planninggevallen (360, 390, 412, 768, 1024 en 1440 px) slagen
in 32,5 s met nul geometrieverschillen en nul axe-violations. Referentie, CSS,
assertions en toleranties zijn niet gewijzigd. De oorspronkelijke rode en de
nieuwe groene metingen staan in `responsive-regression-evidence.json`.

Na deze correctie slagen workspace lint/typecheck/test opnieuw elk 30/30.
De herhaalde browserbatch gaf 24 PASS en één bestaande compositiewizard die
tijdens parallelle workspace-tests de deadline bereikte. Een begrensde herhaling
van uitsluitend die ongewijzigde case slaagt in 3,6 s; beide logs blijven bewaard.
De eerdere productiebuild hoort bij zijn eigen broncertificaat. De definitieve
linkplaatsing wordt opnieuw gebouwd en getest door de normale CI.

## Integratie en herstel

Het extra operationele bewijs van S295 staat onder
`docs/implementation/s295-sportlink-playback-refresh/`: eigen stagingcanary,
echte worker/manifest/zichtbare frames en geautoriseerde read-only Duindorp-
diagnose. Er zijn geen Duindorp-planningen of productiebroninstellingen gewijzigd.

Migrations worden in tijdvolgorde geïntegreerd: S299 → S298 → S296 → S301 →
S300. Een terugrol van de toepassing kan de additieve read-RPC laten bestaan;
immutable publicaties blijven leesbaar. Bij een resolverprobleem volgt een
gerichte forwardmigratie of de bestaande exact geverifieerde vorige runtime,
zonder historische publicaties of assignments terug te schrijven.

## Aanvullende normale CI-bevindingen

De Player-gate van run42623568967 stopte in het bestaande statische LG-geval
voor een achterhaalde200-respons. De trace toont dat de testcase de volgende
5,5s-grens al doorging terwijl de nieuwe respons nog werd afgeleverd. De
runtime behield terecht de oude geverifieerde revisie. De testcase wacht nu
via haar bestaande `staged()`-barrière op de werkelijk voorbereide kandidaat.
Alle bestaande revisie-, zichtbaarheid-, conditionele aanvraag- en
timeoutasserties blijven behouden. Vier gerichte browser-/LG- en
backoffgevallen slagen in35,7s tegen de afzonderlijk gebouwde S300-Player
`n-eMHKsi9jQzSsKbmzHEp`. De betreffende LG-runtime- en
manifestinvalidatiebron zijn bytegelijk aan S298; dit is uitdrukkelijk geen
nieuw S298-buildcertificaat.

Dezelfde brede Control-gate vond één footerknop van43,99993896484375px.
De lokale wizardregel geeft haar bestaande touchhoogtetoken van48px nu
voldoende CSS-specificiteit boven de shellregel. De correctie is bytegelijk
aan de onafhankelijk in S296 met40 browsergevallen geverifieerde regel.
De44pxacceptatie en alle assertions zijn behouden. De precieze S298
Next-journey moet opnieuw door de normale CI lopen. Oude fouten, bron-,
trace- en loghashes staan in `ci-barrier-evidence.json`.

Na beide correcties zijn de normale workspacegates opnieuw groen: lint30/30
(8,66s), typecheck30/30(3,339s), tests30/30(15,389s). Cachegebruik en
exacte loghashes staan in het bewijs.
