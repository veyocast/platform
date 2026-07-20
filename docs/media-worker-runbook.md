# Mediaworker-runbook

## Doel en veiligheidsgrens

De mediaworker verwerkt uitsluitend gequeuede MP4-assets uit private
tenantopslag. De worker is een serverproces, geen browsercomponent. Geef de
service-role key nooit een `NEXT_PUBLIC_`-naam en schrijf credentials, signed
URL's of bronmedia niet naar logs.

## Vereisten

- Node 24 en pnpm 11;
- FFmpeg en ffprobe 6 of nieuwer op `PATH`;
- netwerktoegang tot Supabase API en Storage;
- voldoende tijdelijk schijfruimte voor bron plus genormaliseerde variant;
- procesmanager met restartbeleid en één unieke worker-ID per instance.

Verplichte variabelen:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optionele, begrensde variabelen:

```text
MEDIA_WORKER_ID                       standaard hostnaam + proces-ID
MEDIA_WORKER_POLL_INTERVAL_MS         standaard 2000, bereik 250–60000
MEDIA_WORKER_MAX_ATTEMPTS             standaard 3, bereik 1–10
MEDIA_WORKER_LOCK_TIMEOUT_SECONDS     standaard 900, bereik 60–3600
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
daemon logt per iteratie compacte JSON zonder stacktrace of credentials.

## Verwerkingscontract

1. Claim de oudste queued of stale processing job atomair.
2. Stream het originele object naar een uniek tijdelijk pad.
3. Vergelijk de bytegrootte en bereken SHA-256.
4. Probe en normaliseer shell-vrij naar 1080p30 H.264/yuv420p en optionele AAC.
5. Probe de output opnieuw en stream die naar het vaste variantpad.
6. Registreer checksums, metadata, varianten en `ready` in één transactie.
7. Verwijder het tijdelijke pad altijd.

Een incomplete of corrupte variant wordt nooit `ready`. Tijdelijke command-,
database-, netwerk- en 5xx/429-storagefouten worden tot het pogingbudget opnieuw
gequeued. Ongeldige MIME, inhoud, metadata of bronlengte faalt definitief.

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

Niet-retrybare inhoudsfouten zoals `invalid_probe`, `unsupported_input`,
`unsupported_mime_type` en `source_size_mismatch` zetten het asset in
`quarantined`. Plan die job niet opnieuw in: archiveer het item en laat de bron
als nieuw asset via de volledige uploadintent lopen. Alleen tijdelijke
`validation_failed`-fouten zijn via Control opnieuw in te plannen.

Maak een asset pas opnieuw beschikbaar via een nieuwe upload/job; muteer geen
variantreferentie die al in een immutable release staat.
