# S210 — databasebelasting en schone Supabase-cutover

## Besluit

VeyoCast bouwt een nieuw Supabase-productieproject op uit de forward-only
migraties. Er wordt geen fysieke clone en geen volledige database- of
Storage-restore gebruikt. Daarmee nemen we testhistorie, tabelbloat, oude
workerqueues en ongebruikte providerbestanden niet mee.

De oude productieomgeving blijft tijdens acceptatie read-only beschikbaar als
terugvalpunt. Verwijdering daarvan valt buiten S210.

De officiële Supabase-route voor een projectverhuizing staat in
[Migrating within Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase).
De daar genoemde fysieke restore is geschikt voor volledig databehoud, maar
past niet bij deze bewuste schone start.

## Bevestigde oorzaak

De productie-observaties van 13 oktober 2026 bewijzen een samengestelde
schrijf- en I/O-overbelasting:

- Supabase Metrics rapporteerde 93,46% I/O-wachttijd, 541,65 MB swap en
  129,92% gecommitteerd geheugen rond 07:33 Europe/Amsterdam. Database, Auth en
  Realtime rapporteerden respectievelijk ongeveer 65%, 51% en 55% fouten.
- `pg_stat_statements` was op 10 oktober 2026 11:25 UTC gereset. In de daarop
  volgende circa 68 uur waren 21.150 heartbeat-RPC's goed voor 367 MB WAL.
- Een Control-query op `player_sync_events` draaide veertien keer, maar las
  371.894 databaseblokken doordat de index op
  `(tenant_id, screen_id, created_at desc)` ontbrak.
- `claim_ledscores_connections_v1` draaide 16.137 keer. De claimfunctie mocht
  een reeds door dezelfde worker geopende verbinding opnieuw claimen en schreef
  daardoor de lease steeds opnieuw.
- Storage-object-upserts werden in twee queryvarianten samen meer dan 92.000
  keer uitgevoerd. Productielogs bewezen daarnaast negen identieke POSTs naar
  één Sportlink-logopad binnen vijf minuten. S209 stopt deze ongewijzigde
  logo-upload vóór de Storage-write.
- Sinds de database-start rapporteert `pg_stat_database` 21.296.729 deletes,
  701.939 updates en 130.119 inserts. `player_heartbeats` en
  `player_sync_events` vertegenwoordigen samen ruim 21 miljoen deletes. Beide
  tabellen hebben nu ongeveer 21.000 levende rijen, een veel grotere fysieke
  heap en geen geslaagde autovacuumhistorie.
- De oude productionworker bleef tijdens de storing Sportlink, LED Scores, RSS,
  planning, renderwerk en versiepruning tegelijk uitvoeren. Meerdere onafhankelijke
  RPC's liepen daardoor tegen `57014` en locks aan. Auth kon periodiek niet met
  de lokale Postgres op `localhost:5432` verbinden.

De databaseomvang of één defecte RPC is dus niet de hoofdoorzaak. Testhistorie,
ontbrekende toegangspaden en herhaalde no-op writes hielden een kleine
Supabase-compute vrijwel permanent in I/O-wacht.

## S210-beschermingen

- `player_sync_events_tenant_screen_created_idx` maakt het bestaande
  Control-schermdetailpad indexeerbaar.
- De autovacuum- en analyze-drempels van de twee append-/prunetabellen zijn
  absoluut begrensd en reageren na maximaal ongeveer vijfduizend gewijzigde
  rijen.
- `claim_ledscores_connections_v2` accepteert maximaal vijftig actieve
  connection-ID's als uitsluiting. De worker gebruikt uitsluitend deze v2-grens
  en verlengt open sockets via de bestaande renewal-RPC.
- De standaard claimfrequentie gaat van vijf naar vijftien seconden.
- Iedere Player-heartbeat blijft als bereikbaarheidstelemetrie bestaan.
  `player_sync_events` bewaart alleen een nieuwe betekenisvolle combinatie van
  fase, release en stabiele detailvelden. `acknowledgedAt`, het huidige
  playlistitem en Goal Video-telemetrie maken niet langer elke dertig seconden
  een duplicaat-event.
- S206 voorkomt de dubbele volledige Sportlink-projectie. S209 vergelijkt
  logobytes vóór upload en laat een nieuw providerlogo een verouderde
  providerpointer vervangen zonder slide- of playlistversies te maken.

## Databereik

De bron bevat één tenant, drie Auth-gebruikers, tien schermen, acht gekoppelde
devices, één Sportlinkverbinding en één LED Scores-verbinding. Storage bevat
drie buckets en naar schatting 26.718 actieve objectrecords. Dit is pilot- en
testdata; er zijn geen echte klanten.

De op 13 oktober 2026 bevestigde schone cutover neemt uitsluitend mee of bouwt
opnieuw op:

1. de Duindorp-tenant, actieve memberships, tenantinstellingen en het huidige
   thema;
2. nieuwe schermdefinities voor de gewenste fysieke Players, zonder
   devicecredentials; iedere Player wordt na cutover opnieuw gekoppeld;
3. één opnieuw gevalideerde Sportlinkverbinding en één LED Scores-verbinding,
   met providerdata en providerassets die opnieuw vanaf de bron worden gevuld;
4. nieuwe uitnodigingen voor de beheerders.

Niet meenemen: heartbeats, sync-events, connector-events, sync-runhistorie,
workerqueues, renderjobs, audit-/testfixtures, providercache, oude snapshots,
playlists, playlistitems, playlistreleases, publicatie- en planningsrecords,
dynamische slides en hun versies/snapshots, Studio-ontwerpen, mediarecords,
Storage-objecten, superseded releases en verwijderde media. Playlists, slides en
media worden bewust opnieuw opgebouwd in het nieuwe project. Er wordt dus geen
contentrelease uit het oude project aan een nieuw scherm toegewezen.

## Automatische versieretentie

De runtime bewaart één logische actuele publicatie per playlist en ruimt oudere
serverversies asynchroon op. Een nieuwe publicatie of gepubliceerde slideversie
zet tenantgebonden opruimwerk klaar. De mediaworker verwerkt dit in batches van
maximaal 25 records en controleert vóór iedere verwijdering alle actuele
referenties opnieuw. Een release blijft zolang een scherm, Player, planning,
sponsorplan of lopende thema-uitrol haar nog nodig heeft. Een actieve of desired
Playerrelease wordt daarom nooit tijdens playback verwijderd. Wanneer de Player
naar de nieuwe release omschakelt, wordt opnieuw opruimwerk gestart; daarnaast
wordt een rustige tenant iedere tien minuten opnieuw gecontroleerd.

Dezelfde opruimgrens verwijdert niet meer bereikbare oude dynamische
slideversies en snapshots. De huidige gepubliceerde versie, actieve draft,
lopende render, actuele fallback en gepubliceerde live binding blijven bestaan.
Mediaobjecten worden door deze taak niet verwijderd, omdat gedeelde bestanden
een eigen referentie- en verwijderflow hebben.

Sportlink- en RSS-observaties maken geen nieuwe authoringversie of
playlistrelease. Zij verversen `published_dynamic_data` voor de bestaande
gepubliceerde snapshot. Gelijke inhoud verandert de datarevisie niet; veel
snelle bronwijzigingen worden per binding samengevoegd. Alleen een bewuste
ontwerp- of publicatiewijziging maakt een nieuwe immutable configuratie, waarna
de vorige onbereikbare serverversie via bovenstaande referentiecontrole wordt
opgeruimd.

## Uitvoering

1. Merge S210 en laat alle bron-, database- en securitygates slagen.
2. Maak in dezelfde organisatie en regio een nieuw betaald Supabase-project.
   Projectaanmaak vereist vooraf een expliciete kostenbevestiging.
3. Pas alle repositorymigraties toe op de lege database. Een verse reset moet
   inclusief S198, S206, S209 en S210 slagen.
4. Configureer Auth redirect-URL's, SMTP/templates, MFA, Storage-buckets,
   Realtime-publicaties en overige projectinstellingen gelijk aan productie.
5. Maak de pilottenant opnieuw aan via de bestaande provisioninggrens, nodig de
   beheerders opnieuw uit en maak de schermdefinities opnieuw aan. Configureer
   Sportlink en LED Scores opnieuw en synchroniseer providerdata vanaf de bron.
   Maak geen playlists, slides, releases, planningen, mediarecords of
   Storage-objecten over.
6. Bewijs vóór cutover: security-advisor, RLS-suite, login, tenantcontext,
   Sportlink-sync, LED Scores WebSocket→database→slide, Storage-deduplicatie,
   publicatie, manifest, heartbeat en Player last-known-good.
7. Zet in het beschermde GitHub-environment atomisch om:
   `SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en
   `SUPABASE_DB_URL`. Werk de mobiele publieke Supabase-configuratie alleen bij
   wanneer die productie-app dezelfde backend gebruikt.
8. Deploy exact één immutable SHA naar stagingvalidatie en daarna productie.
   Stop de oude worker vóór de omzetting; start de nieuwe worker pas nadat de
   database- en Auth-smokes groen zijn.
9. Koppel de gewenste Players opnieuw en controleer dat nieuwe heartbeats en
   providerdata uitsluitend in het nieuwe project verschijnen.
10. Houd het oude project minimaal zeven dagen read-only. Terugval bestaat uit
    het herstellen van de vijf environmentwaarden en de vorige immutable
    runtime. Verwijder het oude project pas na een apart besluit.

## Stopvoorwaarden

Geen cutover wanneer een verse migratie, RLS-test, Auth-login, providercompletion,
current-publication-readback, Storage-checksumcontrole of Player-LKG-test rood is.
Er wordt geen volledige dump in het nieuwe project teruggezet en geen bestaand
migratiebestand herschreven.

