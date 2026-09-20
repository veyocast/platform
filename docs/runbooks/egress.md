# Egress onderzoeken en beheersen

Gebruik eerst [het S186-meetrapport](../egress/s186/report.md). Een API-call,
een opgeslagen byte, een door JavaScript gelezen payloadbyte en een door de
provider gefactureerde byte zijn verschillende grootheden.

## Normen en werkelijke bescherming

- Warme, ongewijzigde, geverifieerde playlist waarvan de werkset past: **0 extra
  externe mediapayloadbytes per ronde**. Koude installatie, ontbrekende/corrupte
  content, eviction, nieuwe content en expliciete streams vallen daarbuiten.
- Eén gedeelde download voor gelijktijdige afnemers van dezelfde geautoriseerde Storage-tenant/object/checksum binnen één runtime;
  origin en overige representatieparameters blijven onderdeel van de sleutel.
  Alleen de signature van dat specifieke private Storage-pad mag roteren.
  Andere URLs matchen alleen exact. Geen globale tokenstripper.
  Een gewijzigde signature op reeds lokaal geldige playlistcontent veroorzaakt
  geen download. Goal- en playlistcache houden aparte retentiebudgetten.
- Achtergrondherstel per checksum: 30 s, 60 s, daarna minimaal 1 uur cooldown;
  429/503 `Retry-After` kan deze wachttijd verlengen. Maximaal 128 foutidentiteiten
  en 128 recente downloadidentiteiten in geheugen. De bestaande geldige release
  blijft staan; een gedeeltelijke of corrupte kandidaat activeert nooit.
- De worker deelt één readiness-RPC, standaard elke 4–5 s. Antwoord `0..7`:
  media=bit 1, studio=bit 2, dynamic=bit 4. Elke queue heeft daarnaast een
  safety claim elke 55–60 s om leases te herstellen. Een hint is geen lease.
  Bekend werk wordt direct gedraind. Bij fouten exponentiële backoff tot 60–61 s;
  een expliciete Retry-After gaat ook vóór een safety claim.
- `MEDIA_WORKER_QUEUE_HINT_INTERVAL_MS` (4000 standaard, begrensd 4000–60000)
  is instelbaar via bestaande worker-compose. Verhogen verlengt nieuwe-joblatentie.
  `MEDIA_WORKER_EMPTY_CLAIMS_PER_MINUTE` (12 standaard, 3–1000) bestuurt de
  waarschuwing voor lege claims boven het aantal uitgevoerde jobs per minuut.
- `media.worker.traffic` bevat één aggregaat per worker per minuut. Bij overschrijding
  of >3 hintfouten: `media.worker.traffic_budget`, plus `idle_traffic_budget` op
  de bestaande interne `/statusz`. Logs roteren met de bestaande 5×10 MB-limiet.
- Players sturen compacte cumulatieve `capabilities.mediaTraffic` mee met de
  bestaande heartbeat: payload/local-read bytes, downloads, hits/misses,
  corrupt/failed/throttled en duplicates. Er is geen catch-up-outbox per range/frame.
  Na authenticatie schrijft de API `player.media_budget` bij ≥2 herdownloads van
  dezelfde hash in vijf minuten of ≥3 mislukte herstelpogingen. Herhaalde identieke
  counters worden onderdrukt; maximaal één waarschuwing per device per minuut,
  met maximaal 1024 suppressierecords per API-proces. Een waarschuwing pauzeert
  geen scherm of project. Een hogere teller kan ook legitieme eviction betekenen.

De cooldown is een gerichte automatische circuit breaker voor één fout bestand;
handmatige contentpublicatie en andere geldige assets blijven beschikbaar.
Een operator kan een aantoonbaar foutieve bron via zijn bestaande bronconfiguratie
corrigeren of uitschakelen. Er is geen nieuwe globale automatische kill switch
voor renders of schermen: noodzakelijke preview/fallbackconsumenten bestaan nog.

## Meten

1. Leg UTC-start/eindtijd, project, build, runtime, actieve release en bereikbare
   apparaten vast. Bewaar tellerstanden, reset `pg_stat_statements` niet.
2. Voer [de read-only SQL](../../../scripts/sql/egress-readonly-diagnose.sql)
   in de juiste Postgres-database uit. Sommige connectors retourneren alleen de
   laatste resultset: voer de SELECTs dan apart uit. Q3 tweemaal over hetzelfde
   venster. Q7 bevat geen deliverytokens; download niet alle opgeslagen media.
3. Lees recente playercounters met [de telemetryquery](../../../scripts/sql/egress-telemetry.sql).
   Vergelijk alleen dezelfde `startedAt` binnen dezelfde runtime; na reboot begint
   de sessieteller opnieuw. Bewaar twee externe momentopnamen om delta/actieve uren
   te berekenen. Gebruik de bestaande workerlogaggregaten per worker-ID/build om
   replica's, requests en hintpayload te tellen.
4. Provider Usage/Logs: exporteer exact hetzelfde factuurvenster, laatste 7 dagen,
   24 uur en canaryvenster; cached/uncached apart. Leg retentie, vertraging en sampling
   vast. API-gatewaylogs bevatten niet vanzelf responsebytes. Ontbrekende meetwaarden
   blijven **onbekend**, nooit 0. SQL voor Logs hoort niet in de Postgres-editor.
5. `networkPayloadBytes` telt voltooide gelezen fetchchunks, inclusief verworpen
   chunks; de Static LG XHR-adapter kan bij abort vóór onload geen partiële bytes
   tellen. Headers/TLS, browser/native decoder-HTTPS-fallback, CDN/facturerings-
   categorieën en externe hops zijn niet volledig gemeten. `localReadBytes` telt
   logische cache-openingen, niet iedere decode/read van een Blob of lokale range.
   `hintJsonPayloadBytes` is de gedecodeerde hint-JSON, geen claim- of wiremeter.
6. Zet pas een billing-burn-alert op met een geautoriseerde actuele providerreeks,
   planlimieten, tijdvenster en cached/uncached classificatie. Deze taak heeft geen
   billing-reader en heeft geen plan, Spend Cap of provideralert gewijzigd.

## Herhaalbare regressie en soak

```bash
pnpm exec playwright test tests/player/media-egress.spec.ts tests/player-offline/range-service-worker.spec.ts --project=chromium
pnpm --filter @veyocast/media-worker test
pnpm exec tsx scripts/verify-media-preset.ts /tmp/veyocast-video-proof
```

De eerste twee browserscenario's gebruiken een lokale HTTPS-origin met `no-store`,
werkelijk voortschrijdende videoframes, honderd versnelde rondes, dezelfde content
in een nieuw release-ID, tokenrotatie en reload. JSON-bewijs staat in test-results.
De byte/range-test is onderdeel van PR Gates. `EGRESS_RECORD_BASELINE=1` is alleen
voor een handmatige vergelijking op ongewijzigde oudere code; CI gebruikt dit niet.

Een langere proef met normale afspeeltijd:

```bash
EGRESS_REALTIME=1 EGRESS_WARM_LOOPS=1000 pnpm exec playwright test tests/player/media-egress.spec.ts --project=chromium
```

Beperk loops tot lokale fixtures. Een desktopbrowser bewijst niet de LG-decoder,
Chromecast-geheugenlimiet of native wake/reboot van een fysiek apparaat.

## Uitrol en herstel

1. Groene branch/PR en beschermde CI. Migreer vóór het nieuwe workerimage. De
   migratie is additief: service-role-only hint en acceptatie van nieuwe
   `player-v2-{sha256}.mp4`/`poster-v2-{sha256}.png` naast bestaande paden.
   Geen tabelcleanup of herschrijven van releases/objecten.
2. Staging via de bestaande main/exact-SHA-flow. Test browser en Static LG met koude
   én warme cache, nieuwe publicatie tijdens download, offline/reload en twee goals.
3. Vóór brede productieactivatie: één echt LG portrait- en één Android landscape-
   target waar beschikbaar. Controleer beeld, video-currentTime, goalintro,
   offline/reboot, cachequota en twintig minuten bytecounters. Deze canary is
   vereist omdat de voormalige HTTPS-voorkeursroute een LG-decodergrens omzeilde.
4. Er is geen bulktranscode of herpublicatie. Nieuwe outputs krijgen versie/hash
   en worden niet ge-upsert. Bestaande productievideo's blijven ongewijzigd;
   vervangen na kwaliteitscontrole veroorzaakt een apart te begroten delta-download.
5. Rollback web/worker naar de laatst bewezen SHA via bestaande rollbackflow;
   laat de additieve migratie staan. Geen DROP/cachedatabase-reset. Een rollback
   naar de oude videoafspeelroute kan herhaalde egress terugbrengen: monitor dat
   expliciet. Oude workers blijven door de oude toegestane variantpaden werken.
6. De bestaande native shells laden hosted playercode; deze wijziging maakt geen
   APK/IPK. Een offline/verouderde shell ontvangt de nieuwe runtime pas na een
   succesvolle update/reload. Een oude heartbeat bewijst geen nulverkeer.
