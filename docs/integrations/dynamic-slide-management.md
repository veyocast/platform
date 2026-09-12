# Datagedreven slides beheren

De bibliotheek staat onder **Studio → Datagedreven slides**. Iedere eigen slide
heeft een rij met een beheernaam, type/periode, teams, publicatiestatus en actuele
beschikbaarheid. De acties staan rechts; **Meer informatie** klapt bron,
competitie, versie en uitleg over ontbrekende inhoud uit. Op mobiel worden de
rijen als kaarten weergegeven. Zoeken, typen filteren, pagineren en verwijderen
gebruiken de bestaande tenantbibliotheek.

## Oorzaken en herstel

De oude lijst verwees voor ieder sporttype rechtstreeks naar een editor die een
actieve draft vereiste. Een gepubliceerde slide heeft normaal geen draft.
**Bewerken** gebruikt nu de bestaande `create_or_resume_dynamic_slide_version_v1`
via een serveractie. Een oude directe URL biedt dezelfde herstelactie. Een GET
maakt geen versies aan; niet-ondersteunde families gaan naar hun eigen detailroute.

De standenselector koos bij automatische selectie de laatst gesynchroniseerde
stand zonder verplicht teamlidmaatschap. Bovendien hebben Sportlink-wedstrijden
een andere berekende competitie-ID dan de team/poulecatalogus. De gekoppelde
`pool.competitionExternalId` is nu leidend voor die koppeling, met behoud van
exacte tenant, bron, team, poule, fase en seizoen.

De worker stopte bovendien stilzwijgend na 24 poules. De Duindorp-catalogus bevat
32 poules, waardoor acht jeugdteams geen opgeslagen poule hadden. De collector
verwerkt nu maximaal 128 unieke eigen poules. Een grotere catalogus veroorzaakt
een expliciete syncfout met behoud van de bestaande gegevens, geen gedeeltelijk
succes. De bestaande leasevernieuwing begrenst en bewaakt de verwerking.
Bij meerdere poules per team kiest wedstrijdverrijking alleen een expliciete
poulecode of een eenduidige exacte fase/seizoen/type. De gezaghebbende
poule-endpoints vullen ontbrekende context aan; catalogusvolgorde beslist niet.
Ontbrekende openbare jeugdstanden blijven als ontbrekende inhoud zichtbaar.
Opslagfouten en fouten bij het verwerken van een synchronisatie krijgen een
afzonderlijke foutcode. Alleen een begrensde SQLSTATE wordt bewaard; ruwe
provider- en databasefoutinhoud komt niet in de gebruikersmelding terecht.

Standen gebruiken dezelfde pouleresolver als programma en uitslagen. Wedstrijden
van vandaag geven de actuele context; anders telt de recentste speeldag binnen
14 dagen, daarna de eerstvolgende dag binnen 42 dagen. Gelijkwaardige contexten
blijven ambigu en leeg. Er staat geen bekerkalender of clubnamenlijst in de code.
Een stand moet het gekozen team bevatten en openbaar zijn. Bij ontbrekende
wedstrijdinformatie blijven de bestaande beperkte metadata-/standenfallbacks
alleen bruikbaar wanneer precies één context resteert.

De tijdsregels uit S176 blijven gelden: gestarte wedstrijden verdwijnen uit het
programma en verschijnen op uitslagen, ook als de score nog niet openbaar is.
Een correct lege periode wordt in de bibliotheek uitgelegd; gepubliceerd betekent
niet automatisch dat er op dat moment inhoud beschikbaar is.

## Werkelijke standrijen en synchronisatieduur (S178)

Productiecontrole op 12 september 2026 toonde na de selectiecorrectie nog lege
standen. `poulestand` levert de teamnaam, maar niet altijd `teamcode`. De bestaande
mapper maakt dan SHA-256 van `standing-team`, één NUL-byte en de exacte UTF-8-naam.
Die rij-ID verschilt van de numerieke team-ID uit de teamcatalogus. Dit is
bevestigd voor Duindorp sv 1, 2 en O16-1; de catalogus bevat de juiste poules.

De private identiteitsresolver accepteert de echte provider-ID, of uitsluitend
die bewezen mapper-ID én dezelfde exacte teamnaam. De naam moet uniek zijn bij
actieve teams in dezelfde tenant en bron. Een expliciet afwijkende provider-ID,
een andere bron, een ambigue naam of een afwijkende poule/fase/seizoen blijft
uitgesloten. Dezelfde predicate bepaalt de geselecteerde rijmarkering. Dit werkt
ook met eerder opgeslagen bronrijen; een nieuwe download is geen voorwaarde.

De nieuwe completiondiagnostiek identificeerde daarnaast SQLSTATE `57014`.
De bronupdate bouwt latest-snapshots binnen dezelfde transactie. In de bestaande
wrapperketen werd actieve team-/bronselectie voor iedere kandidaatwedstrijd
opnieuw tegen de database uitgevoerd. Een lokale proef met 1.000 wedstrijden
mat 18.530 controles voor tien slides. De selectie wordt nu eenmaal per
projectielaag opgehaald; de rijcontrole gebruikt uitsluitend dat tijdelijke
resultaat. De bestaande directe predicate blijft de referentie voor de
pariteitstest: alle 273 combinaties van selectie, thuis/uit en competitie/fase
hebben dezelfde uitkomst.

Dezelfde lokale proef daalt van 2,60 naar 0,40 seconde voor tien volledige
snapshots. Dit is een lokale meting, geen latencygarantie. Database-timeouts,
transactiegrenzen, autorisatie en immutable publicatie zijn niet verruimd.
Migration `20260912180627_s178_standing_team_identity.sql` vervangt alleen private
selectie-/projectiefuncties, plant een nieuwe synchronisatie en queue-t
opvolgende gepubliceerde latest-snapshots. Een rollback herstelt de vorige
functies in een forward-migratie; historische data worden niet teruggeschreven.

## Namen en dubbele slides

`dynamic_slides.library_name` is een optionele beheernaam, met
`library_revision` voor gelijktijdige wijzigingen. `library_sort_name` is de
gegenereerde zoek-/sorteernaam, met de oude naam als fallback. Het wijzigen van
de naam verandert geen ontwerp, snapshot, playlistrelease of schermtitel.
`rename_dynamic_slide_v1` controleert tenantcapability, tenantstatus en revision.
De playlistkiezer gebruikt dezelfde naam. De titel op het scherm staat in de
slide-editor; namen voor nieuwe slides kunnen in de reviewstap worden opgegeven.

De aanmaakwizard groepeert periodes per type. `create_sportlink_slide_batch_v6`
hergebruikt alle validatie en creatie uit V5 en bewaakt dubbele doelen binnen
de bron: type/periode (ook het aankomstvenster), oriëntatie en exacte team-/competitieselectie. Alleen een
andere naam of kleur maakt geen nieuw doel. Bij een bestaand doel wordt de hele
nieuwe batch teruggedraaid, inclusief snapshots en renderjobs; de wizard biedt
links naar de bestaande slides. Een herhaald identiek verzoek blijft idempotent.
Oudere RPC-versies blijven compatibel; de nieuwe Studio gebruikt V6.

De navigatieknop en de aanmaakknop hebben afzonderlijke React-keys. Zonder die
grens veranderde dezelfde DOM-knop tijdens een klik op **Volgende** al in een
submitknop en kon de browser onbedoeld de creatie starten. Namen en selectie
worden nu pas verstuurd bij de expliciete aanmaakactie.

Bestaande dubbele slides worden niet automatisch samengevoegd of verwijderd.
De bestaande archiveeractie bewaakt conceptplaylistverwijzingen en laat de
gepubliceerde historie intact.

## Migratie en releasegrens

Migratie: `20260912153412_s177_dynamic_slide_management.sql`.
Er komt geen tweede slide-, team-, groeps- of mediasysteem bij. De bestaande
RLS-tabellen en server-side capabilities blijven leidend.
Ingeschakelde wedstrijd- en competitiesynchronisaties worden opnieuw ingepland.

De herstelqueue maakt opvolgende snapshots van uitsluitend de exacte
gepubliceerde latest-versie, ook wanneer een afwijkend concept openstaat.
De bestaande render- en releasequeue promoveert alleen complete resultaten.
Historische releases en snapshots, vastgezette versies en Player LKG worden
niet herschreven. Media blijven via dezelfde asset/cache-infrastructuur lopen.

De migratie is additief voor oudere applicatieversies. Een applicatierollback
kan de extra kolommen en V6 laten staan. Voor een selectie-rollback worden de
vorige functiedefinities in een nieuwe forward-migratie hersteld en nieuwe
snapshots gequeued; bestaande historie wordt niet verwijderd of aangepast.

## Aanvullend herstel Goal Overlay

De kleurvelden combineren nu een native kleurkiezer met een bewerkbaar hexveld,
een automatische clubwaarde en herstel per kleur. Onvolledige codes blijven
bewerkbaar en blokkeren opslaan ook na wisselen van sectie. De bestaande
servervalidatie, tenantstijl en gedeelde live renderer blijven leidend.

De moderne `GoalMediaCache` bewaarde native `fetch` als instancemethode. In een
browser veroorzaakt de verkeerde receiver een `Illegal invocation`, voordat
er een download start. De bestaande tests vulden de cache vooraf en misten
daardoor deze fout. De aanroep gebruikt nu een wrapper met de juiste browser-
receiver. Een nieuwe Chromium-test begint met een lege cache, ontvangt een
configuratie, downloadt en verifieert de echte MP4 en wacht op natuurlijk `ended`.
Dezelfde test draait op React en Static LG.

Configuratiebevestigingen volgen nu pas na de prefetch. Mislukte prefetch geeft
`configuration_prefetch_incomplete` en `goal_asset_prefetch_failed` met alleen
de asset-ID. Hashverificatie, lokale blob-playback, queue, foutfallback en
playlist/LKG-retentie blijven dezelfde bestaande infrastructuur gebruiken.
De nieuwe downloadfunctie geldt ook bij opstarten met al gepubliceerde video's;
die video's hoeven niet opnieuw te worden geüpload.

## Verificatie

S177 voegt tests toe voor actuele senioren- en jeugdcontext, afwijkende
competitie-ID's, verkeerde fase/team/tenant, ambiguïteit, niet-openbare standen,
atomaire duplicate-afwijzing, idempotentie, gepubliceerde slides zonder draft,
hernoemen zonder historische mutatie en gelijktijdige naamswijzigingen.
De live Chromium-suite gebruikt een geïsoleerde lokale tenantsessie en controleert
zoeken, uitklappen, naamgeving, conceptbewerking, directe links, mobiel en Axe.
De concrete releasegate-resultaten worden bijgehouden in `TASK_LEDGER.md` en de PR.
