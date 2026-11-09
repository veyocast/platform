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
