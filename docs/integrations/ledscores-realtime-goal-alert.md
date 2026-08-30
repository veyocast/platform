# LED Scores realtime Goal Alert

## Status en rollout

S132 levert de volledige technische pilotketen. De feature staat per tenant
standaard uit onder `ledscores_realtime`. Alleen Platform Owner/Admin kan de
flag met AAL2 en een auditreden wijzigen. De eerste toegestane pilot is
Duindorp sv; andere tenants en clubslugs vereisen een afzonderlijk besluit en
een eigen mapping. Uitspraken over commerciële providerondersteuning vallen
buiten deze implementatie.

Op 30 augustus 2026 is de read-only verbinding naar
`wss://wss.ledscores.score.tel/clubs/duindorp-sv/scores/` met de productieparser
getest. Het eerste geldige statusbericht arriveerde in 271 ms. De bron meldde
een 3–2-score, periode 1 en een oudere `updatedAt` van 29 augustus 2026. Dit is
bewust alleen baselinebewijs: een oud eerste bericht activeert nooit een alert.

## Architectuur

```text
LED Scores websocket (read-only)
  -> media-worker lease + reconnect
  -> strikt schema + statusnormalisatie
  -> baseline / exact +1 goal-detectie
  -> canoniek goal-event + tenantmapping
  -> deterministische screen delivery in Postgres
  -> Supabase Realtime naar de server-side Player-SSE
  -> device-geauthenticeerde Player
  -> transient overlay boven last-known-good playback
```

Browsers en Players verbinden nooit rechtstreeks met LED Scores. Alleen de
server-side worker mag het vaste endpoint openen; er is geen codepad dat een
providerbericht terugschrijft. De service-role key blijft in worker en
Player-servercode. De Player gebruikt zijn revocable device credential en
krijgt uitsluitend deliveries voor het gekoppelde scherm.

Deze eventoverlay is een expliciete uitzondering op de normale
release-tijdlijn, niet op de immutable- of offlinegrens. Ontwerp, doelgroep en
media worden als immutable Goal Alert-versie gepubliceerd. Het vluchtige event
wijst naar die versie. De onderliggende playlistrelease wordt niet gewijzigd,
gedownload of opnieuw geactiveerd.

## Connectorcontract

- De enige configureerbare providerwaarde is een lowercase clubslug van
  maximaal 80 tekens.
- Host, protocol en pad worden server-side samengesteld; redirects, willekeurige
  hosts en browserverbindingen bestaan niet.
- Een bericht is maximaal 64 KiB en moet aan het volledige bekende schema
  voldoen. Onbekende of ontbrekende kritieke velden worden afgewezen.
- De eerste geldige status na startup, matchwissel of reconnect wordt baseline.
- Alleen een exacte stijging van één doelpunt, passend bij `scored.side`, een
  verse `scored.date` en verse `updatedAt`, wordt als kandidaat geaccepteerd.
- Correcties, sprongen van meer dan één, dalende scores, oude gebeurtenissen,
  beëindigde wedstrijden en mismatch tussen delta en `scored.side` worden
  veilig onderdrukt.
- Reconnect gebruikt exponentiële back-off met jitter. Een databaselease van
  45 seconden voorkomt dubbele actieve workers; de eigenaar vernieuwt die
  tijdens de socketverbinding.
- Een connectpoging is op 10 seconden begrensd. Na 45 seconden zonder bericht
  sluit de worker de socket gecontroleerd en start back-off/reconnect.
- Klokupdates blijven in workergeheugen. Alleen baseline, goal, relevante
  onderdrukking en maximaal eens per 15 seconden health worden gepersisteerd;
  er ontstaat dus geen databaserij of -write per scorebordtick.

De daemon claimt iedere vijf seconden maximaal 25 verbindingen per instance.
Database en configuratielader begrenzen één claim op maximaal 50. Meerdere
workerinstances mogen draaien: `FOR UPDATE SKIP LOCKED` en lease-eigenaarschap
houden één actieve eigenaar per verbinding aan.

## Identiteit, mapping en deduplicatie

`home` en `away` zijn providerposities; ze zeggen niets over eigen team of
tegenstander. Control bewaart daarom per verbinding expliciete team-ID-mappings
naar `own` of `opponent`. Een mapping kan een bestaand actief Sportlinkteam
gebruiken, zodat de gecanoniseerde naam wordt hergebruikt, of een handmatige
fallbacknaam bewaren. De detector gebruikt de scoredelta om de scorende
providerpositie te bepalen en classificeert daarna via deze mapping. Een
onbekend team wordt standaard onderdrukt; Studio kan bewust kiezen voor een
generieke `GOAL!`-variant zonder extern ID, clubclaim of misleidende teamnaam.

De canonieke eventkey is SHA-256 over verbinding, matchidentiteit, provider
score-ID, scoredatum, scorende positie en eindscore. De database heeft daarnaast
een unieke constraint op tenant + verbinding + key en op tenant + goal-event +
scherm. Daardoor blijven herhaalde berichten, reconnects en overlappende groepen
idempotent.

Per scherm wordt de winnende alert deterministisch gekozen op:

1. hoogste prioriteit;
2. nieuwste publicatietijd;
3. stabiele versie-ID.

Twee snelle verschillende goals zijn geen duplicate. De nieuwere delivery
vervangt een nog zichtbare lagere eventoverlay. Billing-/emergencysplash blijft
buiten deze laag en houdt voorrang.

## Studio en schermgroepen

Studio biedt één sequentiële vijfstappenflow voor desktop en mobiel:

1. verbinding, eigen/tegenstander/onbekend-triggerbeleid, teamfilter, optioneel
   UTC-venster, naam, prioriteit, duur en playlistgedrag;
2. zoekbare selectie van één of meer schermgroepen, met union, overlap,
   doelschermlijst en online/stale/offline-status;
3. eigen-goalvariant;
4. tegenstander- en veilige onbekend-teamvariant;
5. clublogo, variantmedia, afzonderlijke MP4-geluidstracks en volumes en een
   optioneel bestaand goedgekeurd sponsorblok.

Beide varianten ondersteunen tekst, vorige/nieuwe score, doelpuntenmaker,
wedstrijdklok, semantische kleurthema's, typografie, uitlijning, logoschaal en
begrensde motion. Previews dekken eigen, tegenstander, onbekend en ontbrekende
doelpuntenmaker. De synthetische live-test accepteert variant, voorbeeldscore
en optionele doelpuntenmaker en toont vooraf totale en actuele online targets. Publiceren
maakt altijd een nieuwe immutable versie; een gepubliceerde versie kan niet
worden gewijzigd of verwijderd.

Schermgroepen blijven many-to-many via `screen_group_memberships`. Het
schermdetail heeft een echte multiselect. Targeting gebruikt de unie van alle
gekozen groepen. Overlap geeft per goal en scherm precies één delivery.

## Realtime Playercontract

De database voegt alleen `ledscores_player_deliveries` aan de Realtime-
publication toe. De Next.js Player-server:

- valideert de bearer device credential via een service-only RPC;
- filtert de Realtime-subscriptie op één `screen_id`;
- haalt alleen toepasselijke immutable configuraties op;
- maakt signed media-URL's van één uur voor reeds gepinde tenantassets;
- streamt bootstrap, configuration en goal als SSE zonder clientpolling;
- haalt na `SUBSCRIBED` de nieuwste nog geldige pending delivery op, zodat de
  query/subscriptierace en een korte Playerreconnect geen geldig event missen;
- sluit een onderbroken Realtime-kanaal, waarna de Player met begrensde
  exponential back-off opnieuw verbindt;
- accepteert acknowledgements van maximaal 512 bytes.

Een goal wordt standaard gepland op `detectedAt + 750 ms`. De Player berekent
zijn klokoffset uit `serverTime`, prefetcht de configuratie-assets al bij
bootstrap/publicatie en rendert pas op `executeAt`. De expiry is duur plus 2,75
seconde veiligheidsmarge. Verlopen of lokaal bekende event-ID's worden
overgeslagen en bevestigd als `skipped`.

De lokale browsergate stuurt hetzelfde event naar drie geïsoleerde Players. De
waargenomen uitvoer op 30 augustus 2026 was respectievelijk 6, 11 en 11 ms na
`executeAt`, dus 5 ms onderlinge renderskew. De gate bewaakt daarnaast maximaal
250 ms skew en maximaal 1.000 ms renderlatency. De gewone E2E bewijst dat
`pause` de resterende itemtijd bewaart,
de onderlaag zichtbaar houdt en daarna exact hervat. Geen goalpad wist de
last-known-good release of maakt een zwart tussenframe.

## Observability en operatorflow

Control toont per verbinding health, laatste geldige bronstatus, testresultaat,
reconnects, afgewezen berichten en een beperkte goalhistorie. De worker emit
alleen allowlisted, geredigeerde events:

- `ledscores.connector.connected` / `disconnected` / `reconnecting`;
- `ledscores.connector.invalid_message`;
- `ledscores.connector.goal_dispatched` / `goal_suppressed`;
- `ledscores.connector.lease_lost`.

Playerdeliveries registreren `received`, `rendered`, `skipped` of `failed`, met
een begrensde detailtekst. Control aggregeert per goal targets, ontvangen,
getoond, overgeslagen, mislukt en gemiddelde bron→renderlatency zonder N+1-
query. Providerpayloads, signed URL's,
credentials, IP-adressen en user agents worden niet als connector-event
opgeslagen.

Veilige pilotvolgorde:

1. zet de tenantflag met AAL2, reden en change-ticket aan;
2. voeg de verbinding toe en voer de read-only verbindingstest uit;
3. controleer de baseline en map beide team-ID's expliciet;
4. ontwerp en publiceer één alert met een beperkte schermgroep;
5. voer eerst `Test eigen goal` en `Test tegenstander` uit;
6. controleer delivery acknowledgements, latencies en Playerplayback;
7. breid pas daarna de doelgroepen uit.

Een synthetische test is maximaal eenmaal per 15 seconden toegestaan. Een
read-only providerverbindingstest is maximaal eenmaal per 30 seconden
reserveerbaar.

## Rollback en incidenten

De snelste rollback is de tenantflag uitzetten. Nieuwe workerclaims stoppen,
een lease kan niet worden vernieuwd en de Player-SSE antwoordt zonder payload.
De actuele playlist en lokale release blijven ongewijzigd doorspelen. Voor een
kleinere ingreep kan een verbinding of alert worden gepauzeerd.

Bij foutieve alerts:

1. pauzeer de alert of flag;
2. controleer mapping, source timestamps en canonical key;
3. laat reeds verlopen deliveries ongemoeid en verwijder geen auditbewijs;
4. publiceer een gecorrigeerde nieuwe immutable versie;
5. hervat pas na een synthetische test.

De migratie is additief. Een application rollback mag de tabellen laten staan;
zo blijven events, configuraties en auditbewijs behouden. Een destructieve
downmigratie is geen normale rollback. Runtime-retentie verwijdert verlopen
deliveries na zeven dagen, goal-events na dertig dagen en connector-events na
dertig dagen. De worker roept de service-only cleanup-RPC iedere zes uur aan;
een cleanupfout blokkeert nooit live verbindingclaims.

## Testbewijs

- strict parser/detector: 17 integratietests;
- connectorleases, timeouts, write-throttling, reconnect en dispatch:
  94 media-workertests totaal;
- RLS/end-to-end databasecontract: 54 gerichte pgTAP-assertions met drie
  unieke schermen via groepen A, B en A∩B; volledige matrix 64 bestanden en
  1.397 assertions;
- Playerprotocol, signed assets en ack-route: unit-regressies;
- realtime overlay, underlay-pauze en gelijke planning op drie Players:
  Playwright;
- schone `pnpm db:reset` en Supabase database-lint;
- volledige workspace-, a11y-, E2E-, Player- en offlinegates volgens AGENTS.md.

Hosted staging volgt pas na merge naar `main`. Wanneer GitHub Actions niet
beschikbaar is, gebruikt Platform operations de handmatige, immutable VPS-route
uit `docs/deployment/vps-deployment.md`; ook die bouwt één actuele main-SHA,
bewijst eerst staging en promoveert daarna exact dezelfde image-ID's. Productie
blijft een afzonderlijk goedkeuringsmoment en mag niet voor deze pilotflag
worden omzeild.
