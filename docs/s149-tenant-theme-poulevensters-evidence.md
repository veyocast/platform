# S149 — Centrale tenantstijl en volledige poulevensters

Status: `READY_FOR_RELEASE`

Deployment: `NOT_DEPLOYED`

Datum: 5 september 2026

Branch: `veyocast/s149-tenant-theme-poulevensters`

Baseline: `2cea3a3d50048c7fc059c103aea5938037340e46`

## Besluit

FieldFlow-kleuren zijn tenantconfiguratie en geen slideconfiguratie. Instellingen
is de enige authoringplek voor de volledige light/dark-tokenmap van het
momenteel authorable theme `fieldflow`. Het databasecontract is bewust als map
per theme vormgegeven, zodat een later authorable theme alleen met een nieuwe
contract- en migratieversie kan worden toegevoegd.

Pouleprogramma en pouleuitslagen zijn daarnaast een unie van alle relevante
providerperspectieven. De worker haalt per gevalideerde poule programma en
uitslagen op met zowel `eigenwedstrijden=NEE` als `JA`, behoudt de algemene
clubfeed en voegt identieke wedstrijdcodes samen zonder rijkere velden te
verliezen. De database selecteert daaruit nog steeds het exacte lokale venster
van zeven dagen.

## Centrale tenant-themegrens

- `tenant_settings.theme_color_overrides` bewaart een strict gevalideerde
  volledige FieldFlow-map met 26 semantische tokens voor light en dark.
- `update_tenant_theme_settings_v2` handhaaft actieve tenant, capability,
  optimistic revision, theme-ID/version, structuur en audit server-side.
- `update_tenant_control_settings_v5` bewaart algemene en theme-instellingen in
  één transactie.
- Private validators en snapshotbuilders zijn niet uitvoerbaar voor browser- of
  service-roleclients; alleen de publieke command is aan `authenticated`
  toegekend.
- De centrale editor valideert kleurvorm en contrast en stuurt één complete map.
- Nieuwsauthoring accepteert geen theme JSON meer. Preview en create laden de
  authority rechtstreeks uit tenantinstellingen.
- De snapshotbuilder legt de actuele centrale FieldFlow-map alleen in nieuwe
  snapshots vast. Bestaande snapshots, pinned versies, releases en Player-LKG
  worden niet herschreven.
- `primary_color` blijft uitsluitend compatibele merkmetadata voor oudere
  templates en is niet de FieldFlow-kleurenbron.

## Volledige poulevensters

- Contextdetectie gebruikt positieve `teamcode` en `lokaleteamcode`; `0` en
  `-1` zijn nooit identiteit.
- Per poule worden vier allowlisted requests gedaan: programma `NEE`/`JA` en
  uitslagen `NEE`/`JA`.
- `aantaldagen=14` is alleen een providerbuffer rond datumgrenzen; de bestaande
  snapshotselectie blijft exact komende of afgelopen zeven lokale dagen.
- De algemene programma-/uitslagenfeed blijft aanwezig om providerregels zonder
  volledig pouleobject te verrijken.
- Deduplicatie op `externalId` combineert poule/competitie, scores, logo's,
  kleedkamers, officials, locatie en `isHomeMatch` in plaats van last-write-wins.

## Lokale verificatie

Groen op de finale werkboom:

- `pnpm --filter @veyocast/contracts typecheck`
- `pnpm --filter @veyocast/contracts test` — 12 bestanden, 70 tests
- `pnpm --filter @veyocast/control typecheck`
- `pnpm --filter @veyocast/control test` — 62 bestanden, 349 tests
- `pnpm --filter @veyocast/media-worker typecheck`
- `pnpm --filter @veyocast/media-worker test` — 21 bestanden, 120 tests
- `pnpm db:reset`
- gerichte `rls_s149_tenant_theme_colors.sql` — 8 assertions
- `pnpm lint` — 30/30 taken
- `pnpm typecheck` — 30/30 taken
- `pnpm test` — 30/30 taken
- `pnpm build` — 18/18 taken, inclusief Control-secretgrens en webOS 6-guard
- `pnpm test:rls` — 71 bestanden, 1.728 assertions
- `pnpm test:a11y` — 36 geslaagd, 1 bewuste live-skip
- `pnpm test:e2e -- --project=chromium` — 192 geslaagd, 23 bewuste
  live/evidence-skips
- `pnpm test:player` — 117 geslaagd
- `pnpm test:player:offline` — 7 geslaagd
- `pnpm exec supabase db lint --local --level warning` — geen S149-bevinding;
  negen reeds bestaande waarschuwingen in zes oudere functies
- `git diff --check` en changed-diff credentialscan

Nog open in de releasefase: PR/CI, exact-SHA staging en expliciete exact-SHA
productionreadback.

## Bekende grenzen

- FieldFlow is momenteel de enige authorable theme-ID; legacy catalogusthema's
  blijven uitsluitend rendercompatibiliteit en krijgen geen Settings-editor.
- Een tenantkleurwijziging maakt geen release mutable. Zichtbare playback volgt
  pas nadat een nieuwe snapshot is gerenderd en via de normale immutable
  publicatieketen is geactiveerd.
- De provider kan dezelfde wedstrijd incompleet over meerdere artikelen
  verdelen; daarom is de merge bewust veldbehoudend en blijft ontbrekende score
  `null` in plaats van een verzonnen 0–0.
