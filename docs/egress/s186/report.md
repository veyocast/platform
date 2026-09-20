# S186 — egressonderzoek en preventie, 20 september 2026

## Resultaat en status

De online videoafspeelroute koos in zowel React als Static LG een HTTPS-bron
terwijl dezelfde content al volledig in de lokale geverifieerde cache zat.
Een lokale HTTPS-reproductie op ongewijzigde main bewijst extra mediaoverdracht
per ronde. De gewijzigde route speelt de lokale content af. Eén koude download,
honderd warme rondes en reload verbruiken in beide test-runtimes samen per runtime
**196.399 bytes**, waarvan **0 aanvullende warme mediabytes**.

Dit is geen attributie van de historische 962,06 GB. Billing-/deliverylogs en
fysieke LG-/Android-acceptatie ontbreken. De gebruiker heeft bevestigd geen
fysieke toegang tot Kantine Prijslijst te hebben. Productieacceptatie is daarom
nog open. CI-/deploystatus wordt hieronder aangevuld met werkelijke resultaten.

Main in `/home/codex/repos/castivo` is eerst schoon bijgewerkt naar
`7337592511f78aacc86274fdfb0fb131505658d4`. De eerdere main-worktree is zonder
werkverlies op zijn bestaande commit losgekoppeld. Implementatie staat geïsoleerd
op `veyocast/s186-egress-prevention` in `castivo-s186-egress-prevention`.
Geen werk van de eerdere S174-branch is verwijderd.

## Wat opnieuw is vastgesteld

Read-only productiecontrole: project `csrakhciqvehitplvale`, 20 september,
12:43–13:22 UTC (14:43–15:22 Europe/Amsterdam). Staging `jibbtdicrptsyftobavq`
is afzonderlijk herkend. Alle aangeleverde diagnosesecties zijn uitgevoerd;
bij meerdere SELECTs is de ontbrekende eerste resultset apart herhaald.
[Databasebewijs](database-baseline.json), [publicatiecontrole](publications-baseline.json).

- S185 bestaat: 19 huidige publicaties, 50 live datasets, 1213 historische
  releases. Beide oude refreshfuncties zijn `select 0`. De queue bevat 12 records,
  alle pending=false; er is geen gekoppelde enqueue-trigger. De resterende
  tekstverwijzing is de oude enqueuefunctie zelf. De laatste automatische release
  is 19 september 17:22:04 UTC; de zeven releases van 20 september zijn de bestaande
  migratiepublicaties. Geen nieuwe releasefabriek gebouwd.
- Actief op Kantine Prijslijst: v7, vier video's, samen 102.810.300 bytes/40 s.
  De heartbeat meldt Static LG, Chrome 79.0.3945.79 en main-SHA 7337592; storagequota
  en gebruik zijn null. Null en `webOS=false` zijn geen bewijs van ontbrekende cache
  of afwezig LG-hardware. De zeven andere oude heartbeats bewijzen geen nulverkeer.
- Alle drie buckets blijven private. Op 13:12:57 UTC hebben alle 20.079 objecten
  één jaar cacheControl. De opslagmetadata zegt niets over een browser/CDN-hit.
- De drie claims nemen tussen 12:43:57.403161 en 12:48:50.664729 UTC toe met
  respectievelijk 548 dynamic, 542 media en 541 studio: 1631 calls/293,261568 s,
  circa 5,56/s. Er zijn vier dynamic completions in dat venster. Statistiekreset:
  16 augustus 15:12:07.600348 UTC. Calls/rows blijven request-/databasegegevens.
- Zes-uursvenster bij de diagnose: nieuws 107 jobs/3 slides, programma 49/48,
  aankomsten 6, uitslagen 2, standen 2. De live datasets zijn meestal circa 7–9 kB;
  maximum 20.132 geserialiseerde bytes. Previews en immutable fallbackposters zijn
  nog echte consumenten. Geen producer zonder aangetoonde overbodigheid verwijderd.

## Keten en meetdekking

| Pad | Vastgesteld | Bytes / beperking |
|---|---|---|
| Control → publicatie → S185 current target | Bestaande immutable publicatie, activering op overgang; 100 inhoudsupdates maken geen release | RLS-regressie; geen nieuwe billingmeting |
| Player → manifest API → Supabase | Geautoriseerde kleine target-RPC vóór envelope; ongewijzigd target kan vroeg 304 geven | Bestaande `live-target.test.ts` bewijst dat grote envelope-loader niet wordt aangeroepen |
| Browser / Static LG → private Storage-video | Oorspronkelijke HTTPS-voorkeur omzeilt lokale playback | Werkelijke lokale HTTPS-serverpayload gemeten, tabel hieronder |
| Goalintro → cache / decoderfallback | Gedeelde single-flight voor dezelfde URL/hash, aparte goalretentie, bounded retry | Bestaande decoder-HTTPS-fallback blijft; native byteverbruik daarvan onbekend |
| Worker → PostgREST claims | Eén compose-worker, drie gelijktijdige loops, productieconfig 500 ms idle | DB-calls gemeten; werkelijk aantal draaiende replicas niet met hostinspectie bewezen |
| RSS-worker → Storage | Hash-/tenantgebonden beelden werden telkens ge-upsert | 100 identieke uploads → 1 objectupload, daarna HEAD; unitmeting |
| Sport/RSS-data → render/preview/live | Hashdedup en S185 bestaan al; fallbacks blijven nodig | Geen bewijs dat alle resterende renders nutteloos zijn |
| Realtime / Auth / exports / back-ups / logdrains / derden | Geen serviceverdeling of aanwijzingen voor een specifieke extra oorzaak beschikbaar | Geen bot-/misbruikconclusie; geen volledige 7d/24h-attributie |
| Provider cached/uncached billing | Connector biedt database/projectacties, geen usage-/Logs-reader | Factuurvenster, retentie, sampling, vertraging, headers/compressie en categorieën onbekend |

Historische screenshotwaarden 978,31 GB totaal en 962,06 GB production komen uit
het aangeleverde rapport. Het geselecteerde factuurvenster is onbekend. Geen
secrets opgevraagd of geëxporteerd; geen volledige productievideo gedownload.
Het onderzoek gebruikt lokale kleine fixtures en beperkte read-only SQL.

## Bytebewijs en requestbewijs

Lokale HTTPS-origin met `Cache-Control: no-store`, echte MP4-decoding en
`currentTime > 0`. De honderd rondes worden versneld door werkelijk te seeken
naar het einde. Dit telt afgeleverde responsebody-payload, geen TCP-ACKs,
HTTP/TLS-overhead, CDN- of Supabase-billingbytes.

| Runtime | Unieke video | Main koude bytes | Main extra na 100 rondes + reload | Gewijzigd koud | Gewijzigd extra warm | Requests oud → nieuw |
|---|---:|---:|---:|---:|---:|---:|
| Browser | 196.399 | 589.197 | 20.032.698 | 196.399 | 0 | 105 → 1 |
| Static LG op desktop Chromium | 196.399 | 392.798 | 19.836.299 | 196.399 | 0 | 103 → 1 |

[Browser vóór](baseline-browser.json), [LG vóór](baseline-static-lg.json),
[browser na](fixed-browser.json), [LG na](fixed-static-lg.json).
Aanvullend zijn tien normale, niet-versnelde rondes, een nieuw release-ID met
hetzelfde bestand, tokenrotatie en herstart groen in beide runtimes:
[React](realtime-browser.json), [Static LG](realtime-static-lg.json).
De test wacht ook op een heartbeat met de nieuwe actieve release.
Een herbruikbare langere soak is configureerbaar; een meerdaagse hardwaremeting
is niet uitgevoerd. Er is geen empirisch productiegetal voor bytes/player-uur.

Het bekende model voor de actuele zware playlist is 102.810.300 × 90 =
9.252.927.000 bytes/uur als elk bestand iedere ronde volledig opnieuw wordt
verstuurd. Dit is een **rekenvoorbeeld**, geen waargenomen apparaat-uur.
Voor passende, ongewijzigde lokale content is de geteste warme-mediawaarde 0;
heartbeat, auth en publicatiedoelcontroles blijven legitiem verkeer.

Worker: [simulatie over 24 uur](worker-simulation.json): 1503 safety claims per
queue, 4509 totaal, 19.201 gedeelde hints, 23.710 requests samen. Tegen de
vooronderzoeksextrapolatie 478.521/dag is dat circa **95,0% minder requests**.
De readiness-body is één JSON-cijfer; met lege claims `[]` is de gemodelleerde
JSON-payload 28.219 bytes/dag, versus 957.042 bytes voor die oude lege-claim-
extrapolatie. Dat is circa 97,1% minder **gemodelleerde bodybytes**. Werkelijke
claimantwoorden, wirebytes, replicas en providerafrekening zijn niet gemeten.
Nieuw werk wordt in de defaultsimulatie binnen vijf seconden plus RPC-tijd
opgepakt; tests omvatten uitval, Retry-After en leaseherstel.

## Implementatie en kwaliteit

- React `resolveHydratedMediaSource` en Static LG `sourceForItem` kiezen de
  geverifieerde lokale afspeelbron. Mediastore-/IndexedDBnamen blijven behouden.
  Shellupdate houdt mediacache vast. Lokale ranges ondersteunen 200/206/416,
  open/suffixranges, ontbrekende lengte en afbreken; vreemde numerieke syntax
  wordt afgewezen. Een cachemiss wordt geen ongecontroleerde originproxy.
- Gedeelde downloader voor playlist-/goalvoorbereiding in React en Static LG:
  dezelfde geautoriseerde Storage-tenant/object/checksum en representatie, één
  lopende transfer (andere URLs matchen exact); een geannuleerde
  afnemer onderbreekt andere afnemers niet. Volledige 200, lengte/hash, limieten
  en generatiecontrole blijven vereist. Legacy behoudt XHR en ES5-bootstrap.
- Checksums, actuele toegestane manifesten en bestaande entitlement-/devicegrenzen
  bepalen hergebruik. Geen nieuwe public bucket, globale querystripper of RLS-bypass.
  LKG, newest-publication-wins en immutable releases blijven intact.
- De videopipeline remuxte geschikte H.264 zonder bitratecriterium. Nieuwe
  verwerking transcodeert hoge (>6 Mbit/s) of onbekende containerbitrate met de
  bestaande H.264 Main 4.0/yuv420p/CRF21/maxrate6M/faststart-preset. Geen upscale,
  juiste oriëntatie, bestaande stille-outputcontract. Outputs dragen preset v2
  plus outputhash en worden niet overschreven. Bestaande originelen en releases
  zijn onaangeraakt. De additieve migratie laat oude workers/paden toe.
- [Werkelijke lokale ffprobe/grootteproef](video-preset.json): synthetische
  720×1280/30 fps/6 s, 29.504.191 → 2.671.945 bytes (90,94% kleiner), container
  39,34 → 3,56 Mbit/s, SSIM 0,995699. [Visuele vergelijking](video-comparison.png):
  fijne tekst en randen zijn leesbaar, bewegende/noisy regio's zijn zichtbaar
  gecomprimeerd. Geen beoordeling van de echte Fernandes/PowerAde-creatives of
  fysieke LG-decoderbelasting; daarvoor ontbreken de geautoriseerde bronfetch
  en hardwarecontrole. Geen bestaande variant blind vervangen.
- De hint-RPC retourneert alleen een integer en is alleen uitvoerbaar door
  service_role. SECURITY DEFINER/search_path='' is nodig omdat directe toegang
  tot de jobtabellen ook voor die rol bewust niet openstaat. Claims behouden
  hun eigen lease-/tenant-/retryregels. RLS-tests bewijzen ACL en padgrenzen.
- RSS controleert het bestaande immutable object vóór upload en gebruikt
  upsert=false. Bestaande bron-/S185-hashes onderdrukken identieke inhoudsversies.
  Er is geen provider-wide nieuwe conditional-image-cache gebouwd.

## Gates, uitrol en open acceptatie

Lokaal groen: lint/typecheck/unit (30 workspaces), database-reset op een
geïsoleerde lokale Supabase en 2180 assertions in 84 SQL-bestanden. Nieuwe
unitcontroles omvatten een lege dag, snelle wake-up, fouten/429, shared download,
cancel, te grote/206/403/503-antwoorden, telemetrylimieten en 100 uploads.
Bestaande S185-tests omvatten 100 echte updates, 100 identieke fetches, tenant-
isolatie, autorisatie vóór 304 en de nieuwste-publicatie-races. De brede
Chromium-/a11y-/Player-/offline-run en productiebuild worden hieronder vastgelegd.

Nog geen productiepostmeting, hardwareacceptatie of factuurreconciliatie. De
hosted runtime verandert de daadwerkelijke LG-videotransportroute; de gebruiker
heeft geen fysieke toegang. Een desktoptest mag geen onvoorwaardelijke brede
productieacceptatie vervangen. Nieuwe outputs vragen alleen bij bewuste
vervanging een eenmalige delta-download, nooit een cacheflush/bulkpublicatie.

[Runbook, budgets, warnings, rollback en herhaalqueries](../../runbooks/egress.md).
De bestaande observability bevat nu compacte workeraggregaten en playerwarnings;
provider burn-ratewaarschuwingen zijn niet geconfigureerd zonder meetbron/plan.
Cijfers voor cache-eviction, native fallbackranges en externe hops zijn nog
onvolledig. Er is geen belofte van nulverkeer voor koude, gewijzigde of te grote
werksets en geen verklaring voor de gehele historische egressrekening.

## Officiële bronnen

Geraadpleegd tijdens deze taak: [Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn),
[Chrome cached audio/video en ranges](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video),
[PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/17/pgstatstatements.html).
Providerinformatie ondersteunt de interpretatie; projectclaims komen uit de
read-only queries en lokale meetartefacten, niet uit die documentatie.
