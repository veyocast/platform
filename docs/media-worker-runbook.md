# Mediaworker-runbook

## Doel en veiligheidsgrens

De private worker verwerkt gequeuede MP4-assets uit tenantopslag, rendert
immutable Studio-revisies en evalueert periodiek welke immutable release volgens
Publisher-planning actief hoort te zijn. De worker is een serverproces, geen
browsercomponent. Geef de service-role key nooit een `NEXT_PUBLIC_`-naam en
schrijf credentials, signed URL's, Studio-documenten of bronmedia niet naar
logs.

## Vereisten

- Node 24 en pnpm 11;
- FFmpeg en ffprobe 6 of nieuwer op `PATH`;
- netwerktoegang tot Supabase API en Storage;
- voldoende tijdelijk schijfruimte voor bron, genormaliseerde variant en één
  Studio-output plus poster;
- procesmanager met restartbeleid en één unieke worker-ID per instance.

Verplichte variabelen:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optionele, begrensde variabelen:

```text
MEDIA_WORKER_ID                       standaard hostnaam + proces-ID
MEDIA_WORKER_POLL_INTERVAL_MS         standaard 2000; deployment 500, bereik 250–60000
MEDIA_WORKER_MAX_ATTEMPTS             standaard 3, bereik 1–10
MEDIA_WORKER_LOCK_TIMEOUT_SECONDS     standaard 900, bereik 60–3600
SPORTLINK_CONFIG_ENCRYPTION_KEY       server-only, stabiel en minimaal 32 tekens
PUBLISHER_SCHEDULE_POLL_INTERVAL_MS   standaard 15000, bereik 5000–300000
LEDSCORES_CLAIM_INTERVAL_MS           standaard 5000, bereik 1000–60000
LEDSCORES_LEASE_SECONDS               standaard 45, bereik 15–120
LEDSCORES_MAX_CONNECTIONS             standaard 25, bereik 1–50
```

De configuratielader weigert publishable keys, anon-JWT's, placeholders,
ongeldige URL's en onbegrensde getallen.

## Starten

Eén job of idle-check:

```bash
pnpm --filter @veyocast/media-worker worker:once
```

Continue daemon met `SIGINT`/`SIGTERM`-afhandeling:

```bash
pnpm --filter @veyocast/media-worker worker:run
```

Zonder argumenten print het entrypoint alleen de stateless healthpayload. De
daemon logt per iteratie één event uit de vaste catalogus met een jobgebonden
correlation ID. Tokens, URLs, databaseconnecties en persoonlijke velden worden
recursief geredigeerd; stacktraces en credentials worden niet geschreven.

Dezelfde daemon verwerkt vier onafhankelijke loops: media-normalisatie,
Studio-rendering, Publisher-planning en de default-off LED Scores-connector.
Per proces loopt maximaal één
Studio-render tegelijk. De media- en Studio-loop kunnen wel gelijktijdig actief
zijn en delen dus CPU en geheugen. De daemon roept met de server-only
service-role iedere vijftien seconden
`apply_due_content_schedules_v1` aan. Die databasefunctie kiest per scherm
deterministisch de hoogste geldige planning en valt na afloop terug op de
standaardrelease. Een evaluatiefout stopt de mediaqueue niet; de volgende
begrensde poll probeert opnieuw. Deze evaluator hoort per omgeving als één
workerinstantie te draaien.

De LED Scores-loop claimt uitsluitend verbindingen van actieve tenants met de
featureflag `ledscores_realtime`. Iedere claim heeft een databaselease en de
worker opent alleen het vaste read-only `wss.ledscores.score.tel`-endpoint.
Websocketfouten gebruiken begrensde back-off; ze stoppen de mediaqueue niet.
Connect is na tien seconden begrensd en 45 seconden bronstilte forceert een
gecontroleerde reconnect. Klokticks blijven vluchtig; health wordt hooguit eens
per vijftien seconden geschreven. Iedere zes uur loopt de niet-blokkerende
service-retentie voor deliveries en eventhistorie.
Zie [`integrations/ledscores-realtime-goal-alert.md`](integrations/ledscores-realtime-goal-alert.md).

Een onverwachte fatale fout in één parallelle loop zet de volledige daemon
direct in drain, annuleert de overige loops en laat de oorspronkelijke fout na
het sluiten van de healthserver doorstromen. Het proces eindigt daardoor met
een foutstatus, zodat het Compose-restartbeleid de worker opnieuw start; een
deels levende daemon met een stale queueheartbeat geldt nooit als herstel.

In staging en production draait de worker als een afzonderlijk Compose-project
zonder publieke poort. `/healthz` is liveness; `/readyz` wordt pas groen nadat
de queue bereikbaar was en gaat tijdens drain of bij een stale poll terug naar
503. `/statusz` is nadrukkelijk businessstatus en rapporteert alleen bounded
aantallen fouten/retries uit de laatste twintig resultaten. De releaseworkflow
wacht op readiness en promoot exact dezelfde worker-image-ID naar production.

De production workercontainer installeert FFmpeg, draait als niet-rootgebruiker
op een read-only rootfilesystem en heeft momenteel deze grenzen:

| Grens | Waarde |
|---|---:|
| CPU | 1,5 vCPU |
| Geheugen | 1536 MiB |
| PID-limiet | 256 |
| Stop grace period | 70 seconden |
| Lease in deployment | 60 seconden |
| Tijdelijke opslag | named volume op `/tmp`, nog zonder expliciete bytequota |
| Logrotatie | 5 × 10 MiB |

`/readyz` bewijst dat recent een workerqueue is gepolld; het onderscheidt de
media-, Studio- en planningloop niet. `/statusz` bevat alleen bounded resultaten
van de laatste twintig media- en Studioruns en vervangt geen queueleeftijd- of
percentielmeting.

## Verwerkingscontract

1. Claim de oudste queued of stale processing job atomair.
2. Stream het originele object naar een uniek tijdelijk pad.
3. Vergelijk de bytegrootte en bereken SHA-256.
4. Probe en normaliseer shell-vrij naar 1080p30 H.264/yuv420p en optionele AAC.
   Een al conforme H.264/AAC-bron wordt veilig naar een nieuwe container
   geremuxed; alleen afwijkende invoer wordt met preset `veryfast` getranscodeerd.
5. Probe de output opnieuw en stream die naar het vaste variantpad.
6. Registreer checksums, metadata, varianten en `ready` in één transactie.
7. Verwijder het tijdelijke pad altijd.

De FFmpeg-stap heeft een harde grens van 40 seconden; bron- en variantoverdracht
hebben elk een grens van acht seconden. Daarmee eindigt een normale pilotjob
binnen de operationele minuutdoelstelling als `ready` of met de expliciete fout
`processing_timeout` of een concrete Storage-time-out; een time-out wordt niet drie keer achter elkaar opnieuw
uitgevoerd. De minuut is een SLO voor ondersteunde pilotclips, geen claim dat
iedere willekeurige vijf-minuten/500-MB-bron op ieder VPS-profiel kan worden
getranscodeerd. Lever voor de snelste route H.264, yuv420p, maximaal 1080p30 en
AAC aan.

Een incomplete of corrupte variant wordt nooit `ready`. Tijdelijke command-,
database-, netwerk- en 5xx/429-storagefouten worden tot het pogingbudget opnieuw
gequeued. Ongeldige MIME, inhoud, metadata of bronlengte faalt definitief.

## Studio-rendercontract

Een Studio-render start uitsluitend vanuit een door Control vastgezette
immutable revisie. De worker claimt met `FOR UPDATE SKIP LOCKED` en gebruikt
alleen server-side service-role-RPC's:

| RPC | Verantwoordelijkheid |
|---|---|
| `claim_studio_render_job_v1` | claim/reclaim, attempt verhogen en bevroren document plus checksummed ready bronassets leveren |
| `update_studio_render_job_v1` | monotone status/progress, lease vernieuwen en `cancelRequested` teruggeven |
| `complete_studio_render_job_v1` | Storagemetadata controleren en mediaasset, varianten, Studio-export en auditevent atomair registreren |
| `fail_studio_render_job_v1` | terminal failure/cancellation of begrensde SQL-back-off registreren |

Deze RPC's zijn niet voor browsergebruik. Bronnen komen alleen uit private
bucket `tenant-media`, moeten onder
`tenants/{tenant_id}/assets/{asset_id}/...` staan en worden vóór rendering op
tenantpad, MIME-signatuur, grootte, SHA-256 en dimensies gecontroleerd. De
worker haalt geen remote URL's, scripts of externe fonts op. De gebundelde
Inter Variable-fonts, gedeelde layout/motionfuncties en rendererversie vormen
samen de reproduceerbare rendergrens.

De statussen lopen voorwaarts:

```text
queued → preparing → rendering → encoding (alleen MP4)
       → uploading → creating_media → completed
```

Veilige annulering eindigt als `cancelled`. Een verloren lease wordt niet door
de oude worker als failure overschreven. Retrybare fouten worden door SQL na
5, 10, 20, 40, 80, 160 en maximaal 300 seconden opnieuw claimbaar; het normale
pogingbudget is drie. Exacte, idempotente objectpaden zijn:

```text
PNG-output   tenants/{tenant_id}/assets/{media_asset_id}/original/studio-output.png
MP4-output   tenants/{tenant_id}/assets/{media_asset_id}/variants/player-1080p.mp4
Poster       tenants/{tenant_id}/assets/{media_asset_id}/variants/studio-poster.png
```

PNG wordt als `original` geregistreerd. MP4 gebruikt hetzelfde canonical object
voor `original` en `player_1080p`; de poster wordt de bestaande
`thumbnail`-variant. De Player ontvangt uitsluitend dit normale ready mediaasset
en rendert nooit Studio-JSON.

Studio heeft maximaal 200 lagen, 30 seconden, 30 fps, één van de twee vaste
HD-artboards en maximaal 64 MiB gezamenlijke ingeladen bronbytes. Frames worden
als RGBA naar FFmpeg gestreamd en niet als volledige reeks in het geheugen
bewaard. De encoder heeft een grens van 55 seconden; tijdelijke directories
worden ook na fout of annulering in `finally` verwijderd.

Zie [Studio render validation](studio/render-validation.md) voor de exacte
codecsmoke en [Studio operations](studio/operations.md) voor monitoring,
capaciteit en rollback.

## Lokale verificatie

```bash
pnpm db:reset
pnpm test:rls
pnpm --filter @veyocast/media-worker test
pnpm --filter @veyocast/media-worker typecheck
pnpm --filter @veyocast/media-worker lint
```

Voer vóór een pilot daarnaast met synthetische media één volledige echte
FFmpeg-run uit en bewijs dat asset, originalvariant en playervariant dezelfde
verwachte checksums/metadata krijgen. Gebruik geen klantmedia voor deze smoke.

## Alerts en herstel

- herhaald `claim_failed`: controleer PostgREST, service-role configuratie en netwerk;
- `source_download_failed`/`player_upload_failed`: controleer Storage en quota;
- veel stale locks: controleer crashes, tijdelijke schijf en commandtime-outs;
- definitief `command_failed`: verifieer FFmpeg-installatie en codecs;
- `worker_state_update_failed`: stop rollout en herstel databasebereikbaarheid;
- groeiende queued jobleeftijd: schaal workers of onderzoek vastlopende jobs.

Studio-specifiek:

- `studio_claim_failed`/`studio_update_failed`: controleer databasebereikbaarheid
  en service-role grants;
- `studio_lease_lost`: controleer dubbele worker-ID, CPU-throttling of een
  gestopte worker; muteer de canonical output niet handmatig;
- `studio_asset_*`: controleer bronintegriteit, tenantpad en mediavariant;
- `encoding_timeout`/`encoding_failed`: controleer containercodec, CPU-budget en
  duurklasse;
- `mp4_invalid`, `mp4_faststart_missing`, `png_invalid` of
  `png_profile_invalid`: stop de rollout; de output wordt niet `ready`;
- `studio_complete_failed`: controleer Storage-objectmetadata en de atomaire
  mediaregistratie;
- groeiende Studio-retryratio: verhoog niet blind het attemptbudget, maar
  categoriseer eerst de fout.

Niet-retrybare inhoudsfouten zoals `invalid_probe`, `unsupported_input`,
`unsupported_mime_type` en `source_size_mismatch` zetten het asset in
`quarantined`. Plan die job niet opnieuw in: archiveer het item en laat de bron
als nieuw asset via de volledige uploadintent lopen. Alleen tijdelijke
`validation_failed`-fouten zijn via Control opnieuw in te plannen.

Maak een asset pas opnieuw beschikbaar via een nieuwe upload/job; muteer geen
variantreferentie die al in een immutable release staat.
