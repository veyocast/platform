# VeyoCast Studio — operations

## Runtime en verantwoordelijkheden

Studio gebruikt drie bestaande runtimegrenzen:

1. **Control** valideert bevoegdheden, zet de actuele draft om in een immutable
   revisie en reserveert idempotent een renderjob plus media-ID.
2. **Media-worker** claimt met service-role, resolveert tenantassets, rendert
   frames, encodeert en valideert output. Per proces loopt maximaal één
   Studio-render.
3. **Private Storage en mediadomein** ontvangen uitsluitend gevalideerde output.
   De completion-RPC controleert het Storage-object en registreert media,
   varianten, Studio-export en audit-event atomair.

Er is geen Studio-runtime in Player. Publisher en Player zien een voltooide
export als een normaal `ready` image- of videoasset.

## Queue- en RPC-grens

Alle worker-RPC's zijn uitsluitend uitvoerbaar door `service_role`. Control
gebruikt andere guarded gebruikers-RPC's voor aanvragen, retry en annulering.

| RPC | Waarborg |
|---|---|
| `claim_studio_render_job_v1` | `SKIP LOCKED`, claim/reclaim, attemptbudget, SQL-back-off, immutable document en ready originals |
| `update_studio_render_job_v1` | alleen lock-owner, monotone status/progress, leasevernieuwing, cancellationpoll |
| `complete_studio_render_job_v1` | alleen lock-owner, exacte paden/MIME/bytes/checksums/dimensies, Storagecontrole en transactionele media-aanmaak |
| `fail_studio_render_job_v1` | echte `cancelled`, terminal `failed` of `queued` met begrensde back-off |

De normale statusroute is:

```text
queued → preparing → rendering → encoding (MP4)
       → uploading → creating_media → completed
```

Een PNG slaat `encoding` over. Actieve annulering wordt uiterlijk bij een
veilige fase- of secondegrens gezien; queued annulering is direct terminal.
Leaseverlies laat de oude worker stoppen zonder de nieuwe eigenaar te
overschrijven. Retrybare fouten worden na 5, 10, 20, 40, 80, 160 en maximaal
300 seconden opnieuw claimbaar. De normale deployment gebruikt drie pogingen.

## Storage- en media-integratie

Bronnen zijn uitsluitend ready `original` imagevarianten uit private bucket
`tenant-media`. De worker controleert tenantpad, bestandsgrootte,
MIME-signatuur, checksum en dimensies. Remote URL-fetch, user-SVG, HTML,
JavaScript en externe fonts zijn niet toegestaan.

Canonical, replay-safe outputpaden:

```text
PNG       tenants/{tenant_id}/assets/{media_asset_id}/original/studio-output.png
MP4       tenants/{tenant_id}/assets/{media_asset_id}/variants/player-1080p.mp4
Poster    tenants/{tenant_id}/assets/{media_asset_id}/variants/studio-poster.png
```

De PNG wordt als `original` vastgelegd. Voor MP4 wijzen `original` en
`player_1080p` naar hetzelfde gevalideerde canonical object. De poster wordt de
bestaande `thumbnail`-variant. Reeds gepubliceerde varianten zijn immutable:
vervang of verwijder deze objecten nooit als herstelactie.

## Rendercontract

| Output | Contract |
|---|---|
| PNG | exact 1920×1080 of 1080×1920, 8-bit RGB/RGBA, expliciet sRGB/ICC, geldige PNG CRC |
| MP4 | exact artboard, H.264 Main, 30 fps, yuv420p, één videostream, geen audio, faststart |
| Poster | PNG op exact artboardformaat uit dezelfde bevroren revisie |

De worker gebruikt het gedeelde schema-, text-layout- en motioncontract en
lokaal gebundelde Inter Variable-fontbestanden. Resvg rendert SVG naar pixels;
Sharp maakt sRGB PNG/RGBA; FFmpeg ontvangt frames via een shell-vrije rawvideo
pipe. De volledige framevolgorde wordt niet in geheugen of op schijf opgebouwd.

Zie [render-validation.md](render-validation.md) voor de controlecommando's,
bewezen unitgrenzen en nog vereiste container-smoke.

## Productieprofiel en capaciteit

Het huidige Compose-profiel is geen onbeperkte renderfarm:

| Onderdeel | Huidige grens |
|---|---:|
| CPU | 1,5 vCPU |
| Geheugen | 1536 MiB |
| PID-limiet | 256 |
| Read-only root | ja |
| `/tmp` | named volume, geen harde bytequota |
| Studio-encoder-time-out | 55 seconden |
| Documentduur | maximaal 30 seconden |
| Framerate | 30 fps |
| Lagen | maximaal 200 |
| Inlined bronassets | gezamenlijk maximaal 64 MiB vóór base64-overhead |
| Parallelle Studiorenders | één per workerproces |

De media-normalisatieloop kan tegelijk met de Studio-loop draaien. Eén worker
kan daardoor tijdens een MP4-normalisatie en Studiorender tegen dezelfde 1,5
vCPU/1536 MiB-grens aanlopen. Schaal horizontaal alleen met unieke worker-ID's;
de databaselease en `SKIP LOCKED` bewaken jobownership.

Nog vóór brede productionuitrol benchmarken:

- 5, 10, 15 en 30 seconden;
- 1920×1080 en 1080×1920;
- 1, 25, 100 en 200 lagen;
- tekst/shape-only, enkele grote image, veel images en QR;
- Studio-only en gelijktijdig met een normale videonormalisatie;
- wall time, p50/p95, peak RSS, CPU, `/tmp`-groei, outputbytes en retryratio.

De 55-seconden-time-out is een harde veiligheidsgrens, geen bewezen SLO voor
alle bovenstaande profielen. Leg na de benchmark een expliciete toelatingsmatrix
vast of splits Studio naar een apart workerprofiel.

## Observability

De worker schrijft privacyveilige structured events:

- `studio.render.queue_polled` op idle;
- `studio.render.completed` met correlatie op job-ID;
- `studio.render.failed` met foutcode en uitkomst, ook voor retry/cancel/lease.

Document-JSON, assetinhoud, signed URL's, tokens en cookies horen nooit in logs.
De container roteert JSON-logs op 5 × 10 MiB. `/healthz` is liveness,
`/readyz` vereist een recente queuepoll en `/statusz` telt alleen failures en
retries binnen de laatste twintig media- en Studioresultaten. Deze endpoints
geven nog geen queueleeftijd, per-outputduur of afzonderlijke Studioreadiness.

Gebruik voor een privileged operationele controle queries zonder
documentpayloads:

```sql
select
  status,
  count(*) as jobs,
  max(now() - created_at)
    filter (where status = 'queued') as oudste_queued
from public.studio_render_jobs
group by status
order by status;

select
  output_kind,
  percentile_cont(0.50) within group (
    order by extract(epoch from (finished_at - started_at))
  ) as p50_seconds,
  percentile_cont(0.95) within group (
    order by extract(epoch from (finished_at - started_at))
  ) as p95_seconds
from public.studio_render_jobs
where status = 'completed'
  and started_at is not null
  and finished_at is not null
  and finished_at >= now() - interval '24 hours'
group by output_kind;
```

Startwaarden voor alerts, nog te kalibreren en nog niet als monitor bewezen:

- oudste queued job langer dan 2 minuten;
- één stale lease of `studio_lease_lost`;
- MP4 p95 boven 50 seconden;
- retryratio boven 5% over 15 minuten;
- twee outputvalidatorfouten binnen één release;
- `/readyz` langer dan 75 seconden niet ready;
- `/tmp`-volume boven 70% of container-RSS boven 85%.

Gebruik tenant- en job-ID alleen voor operationele correlatie, nooit als
high-cardinality metriclabel.

## Incident en rollback

1. Stop bij `mp4_invalid`, `mp4_faststart_missing`, `png_invalid`,
   `png_profile_invalid` of herhaalde completionfouten onmiddellijk nieuwe
   Studio-claims.
2. Trek tijdelijk alleen `EXECUTE` op `claim_studio_render_job_v1` voor
   `service_role` in wanneer normale media en planning moeten blijven draaien.
   Het volledig naar nul schalen van de worker stopt ook die twee loops.
3. Laat een reeds geclaimde job veilig afronden of annuleer via
   `cancel_studio_render_v1`; verwijder geen lock of object met handmatige SQL.
4. Promoot bij herstel exact één bewezen worker-image-digest. De deployment
   promoot dezelfde stagingimage naar production.
5. Een vorige workerimage kent Studio mogelijk niet. Dat is een veilige
   functionele rollback: Studio-jobs blijven queued; media, Publisher en Player
   blijven functioneren.
6. Roll databasewijzigingen vooruit. De Studio-tabellen/RPC's zijn additief;
   gebruik geen destructieve downmigratie bij een runtime-rollback.
7. Behoud completed media die al in immutable releases staat. Herstel een
   mislukte job via de guarded retry, nooit door dezelfde variant te muteren.

Na herstel: voer codecsmoke, één PNG- en één MP4-stagingjob, cancel, retry en
Playerafspeeltest uit voordat claims in production weer worden geopend.

## Nog openstaande hardwarematrix

| Doel | PNG | MP4 | Offlinecache | Status |
|---|---|---|---|---|
| Webplayer Chromium | te testen | te testen | te testen | geen fysieke/production smoke vastgelegd |
| Algemene Android-app/WebView | te testen | te testen | te testen | telefoon/tablet en Android TV afzonderlijk testen |
| Chromecast met Google TV | te testen | te testen | te testen | fysieke hardwaretest ontbreekt |
| LG webOS/signage | te testen | te testen | te testen | model-, webOS- en oriëntatiematrix ontbreekt |
| Portret signage | te testen | te testen | te testen | 1080×1920 playback en fit controleren |

Een groene servervalidator bewijst codec- en containerconformiteit, niet
automatisch decoder-, cache- of performancegedrag op ieder apparaat.
