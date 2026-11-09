# S296 — Consistente schermstatus

Basis: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6` na S295. Uitvoering op
`veyocast/s296-schermstatus`, uitsluitend fase A1 / SCR-01..04 uit de overdracht
van 9 november. Root beheert de centrale taskledger, migraties en uitrol.

De schermkaart, mobiele API en publicatiehelper noemden contact vanaf vijf
minuten al offline, terwijl de gezondheidsfilter vijf tot dertig minuten als
verouderd behandelde. Eén helper maakte toekomstig contact met `Math.max(0,…)`
zelfs online. Nieuwe pure domeinafleiding geeft overal dezelfde betekenis:

| Bewijs / beheer | Uitkomst |
| --- | --- |
| Uitgeschakeld / onderhoud / geen gekoppelde Player | Bekende beheertoestand gaat voor |
| Ontbrekende, ongeldige of toekomstige heartbeat | Status onbekend |
| Geldige heartbeat jonger dan vijf minuten | Online |
| Vanaf exact vijf tot minder dan dertig minuten | Status verouderd |
| Vanaf exact dertig minuten | Offline |

Er geldt geen stilzwijgende kloktolerantie. Een backendweergave gebruikt één
referentietijd. Native consumenten herberekenen ook opgeslagen contactgegevens
tegen de klok van de huidige weergave. Een oude cachewaarde `online` wordt dus
niet opnieuw als bewijs overgenomen. Ondersteuning voor een recente
apparaatopdracht houdt zijn bestaande afzonderlijke tweeminutengrens; dat
noemt een bereikbare Player niet offline en accepteert geen toekomstige klok.

Publicatie blijft apart: een toegewezen/gewenste versie, een ontvangen of
voorbereide versie en geldig eerste-framebewijs zijn verschillende feiten.
Alleen passende publicatie-ID plus geldig `firstFrameAt` bevestigt een gemelde
weergave. Een latere fout of contactverlies wist dat historische bewijs met zijn
tijdstip niet. Actuele bevestiging vereist daarnaast recent contact en geen
Playerfout. De effectieve schermtoewijzing is leidend voor de gewenste publicatie, ook
wanneer die expliciet leeg is. Een oude device-desire is alleen een fallback
wanneer het schermveld ontbreekt, zoals in een oudere helperaanroep. Een oude
gewenste publicatie of download alleen wordt nooit een bevestigd beeld. Het opgeslagen publicatievoorbeeld blijft als zodanig gelabeld;
een ontbrekend voorbeeld zegt niet dat bestaand beeldbewijs ontbreekt.

De Control-overzichten, kaarten, filters, gezondheidsweergave, detail en tellingen
gebruiken dezelfde contactafleiding. Synchroniseren is een afzonderlijke
uitvoerstatus bij recent contact en een andere gewenste publicatie. De
bestaande filterwaarde `syncing` selecteert deze uitvoerstatus; de contactbadge
blijft Online. Bestaande scherm-, device- en publicatiehistorie blijft behouden.

## Native compatibiliteit

De default `/api/mobile/v1/screens`-response behoudt de bestaande exacte shape
en het bestaande statusenum. Oude strict clients krijgen geen onbekende extra
velden; een verouderde contactstatus wordt in dat beperkte enum onbekend.
Nieuwe native Vandaag, Schermen en detail vragen expliciet `statusEvidence=1`
en lezen optionele metadata. Oude opgeslagen antwoorden blijven geldig.
De pure domeinmodule heeft een eigen export
`@veyocast/domain/screen-contact-status`: hierdoor hoeft de strikt getypeerde
native app geen ongerelateerde domeinmodules mee te compileren. Geen dependency,
versie of lockfile is gewijzigd.

Native detail vraagt aanvullend `sourceEvidenceFor=<screenId>`. De server doet
maximaal één metadataread voor een scherm binnen de reeds geautoriseerde
schermlijst. Oude clients en lijsten veroorzaken geen bronread per kaart.
404 voor een andere tenant en 403 zonder schermleesrecht gaan vóór alle reads.
Caching blijft user- en tenantgebonden; offline beheeracties blijven geblokkeerd.

## Afzonderlijke brongegevens

Een actuele Playerheartbeat maakt een oude Sportlinkstand niet actueel. Het
bronpaneel toont de laatste geslaagde broncontrole, de aparte PDD-controle,
beschikbare datarevisie en door de Player gemelde revisie. Een passende
snapshot/hash/revisie is nodig voor de melding dat deze gegevens door de Player
zijn gemeld. Ontbrekend bewijs blijft onbekend; een bronfout houdt het geldige
contact en de laatst bekende inhoud beschikbaar.

De metadata-only read is
`get_screen_source_status_s296_v1(p_tenant_id, p_screen_id)`. De gewone
Controlsessie gebruikt geen service-role om PDD te lezen. De afzonderlijke
databasewriter heeft forwardmigratie en 31 gerichte tenant/RLS-proeven in dezelfde
branch geïntegreerd onder rootcoördinatie. Een ontbrekende of falende metadataread toont
expliciet onbekend; contact en publicatiehistorie blijven bruikbaar. De
consumentenproeven gebruiken gecontroleerde metadata en claimen geen productie-
database-readback. De geïsoleerde SQL-proef slaagde 31/31 in 3 seconden; public/
private lint en securityadvisors vonden nul issues. Zie het afzonderlijke
[RPC-bewijs](implementation/s296-screen-status/metadata-rpc-evidence.json). De
verse geconsolideerde reset met S296/S298/S299 slaagde daarna met 152 SQL-
bestanden en 5064 asserties in 121 seconden. Public/private lint en securityadvisors
bleven zonder issues. De exacte applicatiebuild blijft onderdeel van root/CI.

RPC-uitkomst: maximaal 200 metadataobjecten met `snapshotId`, `sourceName`,
`sourceKind`, `datasetKey`, `lastSuccessAt`, `lastAttemptAt`, `checkedAt`,
`dataRevision`, `contentHash` en `lastErrorCode`. Geen datasetinhoud, device- of
providercredentials. Scope: tenant.screen.read en uitsluitend bronnen gebonden
aan de gewenste/bevestigde publicatie van dat geautoriseerde scherm, inclusief
compositiezones. `matches` en `competitions` blijven afzonderlijke datasets.

## Verificatie en herstel

De directe domeingrenzen, legacy/native cachecompatibiliteit, werkelijke
mobiele routeautorisatie en afzonderlijk bron-/publicatiebewijs hebben gerichte
unitdekking. De browsermatrix rendert de echte routecomponenten, statushelpers
en CSS met gecontroleerde serverreads. Zij bewijst geen live Auth-, Supabase-
of hardwareverbinding. SCR-01 loopt op 299999/300000/300001 en
1799999/1800000/1800001ms over vijf oppervlakken en telling/filter. SCR-02 bewaakt
beheerprioriteit en ontbrekende/toekomstige tijd. SCR-03 volgt opdracht,
download, geldig frame en later offline. SCR-04 toont bereikbaar contact met
achterlopende bronrevisie. De finale browserrun na de mobiele toelichtingscorrectie
slaagde 15/15 in 61,6 seconden,
met acht visueel gecontroleerde screenshots. 320px en 1440px controleren
overflow, toetsenbordbediening en aXe.

Eerdere rode fixture-setupbewijzen en de brede package-boundary-fout zijn in
`/tmp/s296-*` behouden. De eerste canonical-target-browserrun had 14 PASS/1 FAIL:
het oude SCR-03-fixture veranderde alleen device.desired, terwijl de echte
schermtoewijzing gelijk bleef. Het fixture zet nu ook de werkelijke assignment;
alle oorspronkelijke fase- en historieasserties blijven staan. Een extra proef
bewaakt juist een verouderde device-desire en expliciete verwijdering. De eerste
domeintest stond in src en is naar de normale testmap verplaatst. Er is geen assertion, individuele timeout of productie-
compatibiliteitsgrens versoepeld om die fouten weg te nemen.

De eerste PR-CI vond een concrete mobiele geometrieafwijking: RESP-0002
(390×844) en RESP-0003 (412×915) faalden, de overige 64 gevallen slaagden. De
toelichting onder `Publicatie bevestigd` sloeg om naar twee regels en schoof
volgende onderdelen exact 12 pixels omlaag. Lokaal zijn dezelfde fouten
gereproduceerd. De eerste verkorting naar `Recent contact · gewenst beeld`
slaagde op de vier gecontroleerde breedtes 360, 390, 412 en 1440 pixels.

De volledige CI op die eerste reparatie vond vervolgens de twee niet lokaal
herhaalde tabletgevallen RESP-0004/0005 (768×1024 en 1024×768): de kortere tekst
maakte hun KPI-rij juist één regel, 13,9375 pixels, lager. Ook die fout is op
de ongewijzigde commit lokaal gereproduceerd. Een tekstmeting op alle zes
breedtes verklaart de verschillende regelafbreking. De uiteindelijke tekst
`Recent contact · gewenste publicatie` behoudt zowel de juiste betekenis als
de rijhoogte op alle zes oorspronkelijke formaten. De volledige
overzichtsherhaling slaagde 6/6 in 29,4 seconden: nul verschillen in de
bestaande geometrie-/kopvergelijking en zonder toegankelijkheidsfouten.
Hoofdlabel en statusafleiding blijven gelijk. CSS, immutable referentie,
fixtures, individuele timeouts en geometriecriteria zijn niet aangepast.
De volledige SCR-browsermatrix is opnieuw uitgevoerd. Voor-/nabeelden, beide
oorspronkelijke CI-artifactbindingen en individuele criteria staan in het
[regressiebewijs](implementation/s296-screen-status/responsive-regression-evidence.json).
Alle normale CI-checks blijven vereist voor merge.

De bron vóór deze toelichtingscorrectie heeft `pnpm lint`, `pnpm typecheck` en `pnpm test` ieder
30/30 succesvol doorlopen. De Control-suite telt 2075 geslaagde proeven en 34
bestaande opt-in-skips; native 62, domain 89 en contracts 208. De Control-
productiebuild, authgrens en client-secretcontrole slaagden vóór de laatste
kleine canonical-target/timestamp-callsitecorrectie. De exacte geïntegreerde
productiebuild en Android-export volgen via root/CI na de SQL-integratie. De
tekstcorrectie heeft aanvullend gerichte ESLint en de hierboven vermelde zes
geometrie- en vijftien statusgevallen succesvol doorlopen; de brede checks op
de nieuwe commit volgen via de normale CI.
Native fysieke bediening is niet verzameld; er wordt geen hardwarebewijs
geclaimd. Browsergevallen, screenshots en checksums staan in
[de bewijsindex](implementation/s296-screen-status/browser-evidence.json). De
Player, immutable releases, providerdata, service workers en bestaande
Duindorp-planningen wijzigen niet.

Herstel is een applicatierollback via de normale immutable releaseflow. De
metadataread is read-only en kan zonder contentrewrite aanwezig blijven. Root
voert onafhankelijke review, CI, exacte staging-/productiepromotie en readback
uit onder de reeds gegeven gebruikersvrijgave; deze branch deployt niets.
