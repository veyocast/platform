# S30-L — Staging Google Play-reviewdemo

## Doel

Google Play-reviewers kunnen de Android-stagingapp op telefoon, tablet of TV
zonder persoonlijk account of echte schermpairing openen. De reviewcode
`VYO 2VY` start uitsluitend een afgeschermde virtuele demosessie met veilige
mixed-media-inhoud.

## Grens en architectuur

- `DEMO_MENU_ENABLED` is alleen waar voor de Android `staging`-flavor.
- De native shell voert de code op de bestaande Player-origin in en bewaart
  alleen de lokale keuze dat demomodus actief is.
- De Player accepteert demo-API's uitsluitend bij
  `VEYOCAST_ENVIRONMENT=staging`.
- Een sessie is HMAC-ondertekend, `HttpOnly`, `SameSite=Strict`, maximaal
  dertig dagen geldig en bevat geen tenant-, device- of pairingtokens.
- De demo maakt geen `screen`, `player_device` of `pairing_session`.
- `/demo` hergebruikt de bestaande immutable manifest-, cache-, hashverificatie-
  en playbackcomponenten.
- Links/rechts navigeert per playlistitem; OK gebruikt de bestaande
  play/pausebediening.
- Ontkoppelen wist alleen de demosessie en laat normale Playeropslag intact.

## Backofficeconfiguratie

Een Platform Owner met AAL2 kiest op `/platform/system#player-demo` een actieve
tenantplaylist met minimaal één immutable release. De databasefunctie valideert
tenant, playlist, tenantstatus en releaseaanwezigheid, schrijft één
stagingconfiguratie en legt een audit-event vast.

De Player resolveert bij iedere nieuwe manifestaanvraag de nieuwste release van
de gekozen playlist. Als database, configuratie of release niet beschikbaar is,
valt de demo terug op de meegeleverde veilige reviewrelease met twee SVG-slides
en het door de opdrachtgever aangeleverde `demoveyo.mp4`.

## Security- en privacybewijs

- productie faalt gesloten op buildconfiguratie én serveromgeving;
- RLS laat alleen een `platform_owner` de configuratierij lezen;
- mutatie vereist de bestaande platform-owner/AAL2-databaseguard;
- signed media-URL's worden alleen server-side gemaakt;
- sessiecookies en media-URL's worden niet gelogd;
- een reviewer krijgt geen Control-, tenant- of devicebevoegdheden;
- de reviewcode is bewust herbruikbaar en is geen geheim; de sessie ontsluit
  uitsluitend de expliciet gekozen stagingreviewinhoud.

## Uitgevoerde lokale controles

```text
pnpm --filter @veyocast/player lint        PASS
pnpm --filter @veyocast/player typecheck   PASS
pnpm --filter @veyocast/player test        PASS (58 tests)
pnpm --filter @veyocast/player build       PASS
pnpm --filter @veyocast/control lint       PASS
pnpm --filter @veyocast/control typecheck  PASS
pnpm --filter @veyocast/control test       PASS (45 tests)
pnpm --filter @veyocast/control build      PASS
pnpm db:reset                              PASS
pnpm test:rls                              PASS (341 tests)
pnpm test:a11y                             PASS (21 tests)
pnpm test:player                           PASS (38 tests)
pnpm test:player:offline                   PASS (7 tests)
pnpm test:e2e -- --project=chromium        PASS (69 + 1 gerichte rerun, 2 opt-in live skips)
Playwright staging reviewdemo              PASS (2 journeys, onderdeel Playersuite)
Android staging/production lint            PASS
Android staging/production unit tests      PASS
Android staging/production debug APK       PASS
```

De Android-gates zijn uitgevoerd met een tijdelijke Temurin JDK 17 en de
officiële Android SDK 37.1. Fysieke Android-validatie op telefoon, tablet,
signagehardware en Chromecast/TV blijft een releasegate; deze code-audit claimt
geen hardwaretest.
