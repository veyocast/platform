# Deploymentaudit

## Auditmoment en methode

Deze audit is op 19 juli 2026 eerst read-only uitgevoerd tegen
`veyocast/platform`, lokale commit `d65aa02` en de GitHub API via een ingelogde
`gh`-sessie. GitHub toont secretwaarden niet; alleen aanwezigheid en namen zijn
gecontroleerd. Daarna zijn alleen de hieronder genoemde niet-gevoelige GitHub-
correcties uitgevoerd; secrets zijn niet gewijzigd.

## GitHub Environment variables

| Naam | staging aanwezig | production aanwezig | Verwachte waarde of regel | Gebruikt door | Status | Actie |
|---|---|---|---|---|---|---|
| `CONTROL_HOST` | ja: `staging-control.veyocast.nl` | ja: `control.veyocast.nl` | exact per omgeving | workflow, preflight, deployscript, Compose | correct | behouden |
| `PLAYER_HOST` | ja: `staging-player.veyocast.nl` | ja: `player.veyocast.nl` | exact per omgeving | workflow, preflight, deployscript, Compose | correct | behouden |
| `CONTROL_BIND_PORT` | ja: `13000` | ja: `23000` | exact en uniek | workflow, preflight, deployscript, Compose | correct | behouden |
| `PLAYER_BIND_PORT` | ja: `13001` | ja: `23001` | exact en uniek | workflow, preflight, deployscript, Compose | correct | behouden |
| `MARKETING_HOST` | nee | ja: `veyocast.nl` | verboden in staging, verplicht in production | productionworkflow, preflight, deployscript, Compose | correct | behouden |
| `MARKETING_BIND_PORT` | nee | ja: `23002` | verboden in staging, verplicht in production | productionworkflow, preflight, deployscript, Compose | correct | behouden |
| `SUPABASE_PROJECT_REF` | ja: `zljenodtbylnueubnobf` | ja: `uuyelumptrfwuqwzkwsd` | 20 tekens, verschillend per omgeving | workflow, preflight, migrations | correct | behouden |
| `NEXT_PUBLIC_SUPABASE_URL` | ja: `https://zljenodtbylnueubnobf.supabase.co` | ja: `https://uuyelumptrfwuqwzkwsd.supabase.co` | exact eigen project-ref | workflow, preflight, Control/Player runtime | correct | behouden |
| `REVERSE_PROXY_NETWORK` | nee; was `veyocast-staging-internal` | nee; was `veyocast-production-internal` | hoort afwezig te zijn bij host-Caddy | niet meer gebruikt | correct na audit | beide variables verwijderd |

De values bevatten geen host van de voormalige merknaam, productionwaarde in staging,
stagingwaarde in production of zichtbaar gevoelige waarde. Staging bevat terecht
geen Marketingvariables.

## GitHub Environment secrets

| Naam | staging aanwezig | production aanwezig | Validatieregel | Gebruikt door | Status | Actie |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja; waarde verborgen | ja; waarde verborgen | JWT `anon`, eigen ref | preflight, Control/Player runtime | naam correct | runtimepreflight laten bewijzen |
| `SUPABASE_SERVICE_ROLE_KEY` | ja; waarde verborgen | ja; waarde verborgen | JWT `service_role`, eigen ref | preflight, Control/Player server | naam correct | runtimepreflight laten bewijzen |
| `SUPABASE_DB_URL` | ja; waarde verborgen | ja; waarde verborgen | Postgres-URL, Supabase-host, eigen ref | migrations | naam correct | runtimepreflight laten bewijzen |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | ja; waarde verborgen | ja; waarde verborgen | base64 16/24/32 bytes; exact gelijk tussen environments voor dezelfde image | build-release, Control runtime, digest/fingerprintguard | aanwezigheid correct; gelijkheid onbekend | vóór eerste release gelijkzetten/bevestigen |
| `DEVICE_LAB_ACCESS_TOKEN` | ja; waarde verborgen | ja; waarde verborgen | minimaal 24 tekens | Player | naam correct | runtimepreflight laten bewijzen |
| `DEVICE_LAB_SESSION_SECRET` | ja; waarde verborgen | ja; waarde verborgen | minimaal 32 tekens | Player | naam correct | runtimepreflight laten bewijzen |

Er ontbreken geen secretnamen. Er zijn dus geen `gh secret set`-commando's
nodig. Er bestaan ook geen repository-level variables of secrets.

Niet gebruikt en niet aanwezig: `SUPABASE_ACCESS_TOKEN`, `RESEND_API_KEY`,
`EMAIL_FROM`, `MOLLIE_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `CRON_SECRET` en
`SENTRY_AUTH_TOKEN`. Voor de huidige database-URL-route is geen Supabase
Management API-token nodig.

## Workflow- en platformaudit

| Onderdeel | Gecontroleerde toestand | Status | Actie |
|---|---|---|---|
| Environment branch policy | staging en production hebben custom policy exact `main` | correct | behouden |
| Production approval | required reviewer `TIXOCEO`; admin bypass uit; self-review toegestaan | werkend met één bekende reviewer | voeg tweede reviewer toe vóór verplicht vier-ogenbeleid |
| Repository runners | API ziet twee online runners, één per environment | afwijking | verifieer waarom vaste infrastructuur vier runners noemt |
| Runnerlabels | runners hebben `self-hosted`, `Linux`, `X64`, `veyocast`, `deploy`, environment | bruikbaar voor nieuw model | gebruik geen oud `veyocast-vps`-label |
| Oude deployrun | run `29664542758` stond queued op een verouderd label | gecorrigeerd | run geannuleerd |
| Oude workflow | één dynamische `deploy-vps.yml` via `workflow_run` | vervangen | consolideren naar `.github/workflows/deploy.yml` |
| Definitieve triggers | `push` naar `main` en `workflow_dispatch`, nooit PR | vereist | statisch valideren |
| Jobgraph | `preflight` → `build-release` → `deploy-staging` → `deploy-production` | vereist | production houdt `needs: deploy-staging` |
| Concurrency | `deploy-veyocast-main`, niet annuleren | vereist | behouden |
| Action pinning | oude workflow gebruikte mutable major-tags | incorrect | volledige action-SHA's gebruiken |
| Stale protection | oude productiepad accepteerde iedere main-ancestor | incorrect | actuele main eisen, behalve bevestigde rollback |
| Immutable promotion | oude images waren environmentgetagd en werden opnieuw gebouwd | incorrect | één `:<GITHUB_SHA>` plus lokale image-ID per service |
| Production build | oude route bouwde opnieuw | incorrect | uitsluitend `up --no-build` en digestcontrole |

## Compose-, security- en runtimeaudit

| Onderdeel | Oude toestand | Definitief contract | Actie/status |
|---|---|---|---|
| Staging webservices | Control en Player | exact Control en Player | worker draait bewust in een afzonderlijk Compose-project |
| Production webservices | Marketing, Control en Player | exact Marketing, Control en Player | worker draait bewust in een afzonderlijk Compose-project; Caddy blijft op de host |
| Marketing | ontbrak in VPS-deploy | production-only; vóór approval tijdelijk gezond | toegevoegd aan SHA-release |
| Hostbindings | actieve VPS-webservices gebruikten al localhost | alle bindings expliciet `127.0.0.1` | statisch bewijzen via gerenderde Compose-JSON |
| Reverse proxy | extern Docker-netwerk plus oud container-Caddy | Caddy op host naar localhost | netwerkcode en variable verwijderen |
| Composeproject | via dynamische top-level naam | expliciet `-p veyocast-staging` of `-p veyocast-production` | afdwingen in centraal script |
| Docker | geen rootless/socket-ownerpreflight | rootless daemon en socket van `deploy` | preflight toevoegen |
| Runtime state | alleen tijdelijk runner-envbestand | environmentdirectory, atomische mode-600 state | `.env.runtime`, `REVISION`, `PREVIOUS_REVISION`, `RELEASE_MANIFEST` |
| Release metadata | geen digestmanifest | SHA-tags, lokale image-ID's, tijden en serviceversies | per SHA opslaan zonder secrets |
| App rollback | handmatig herbouwen van oude ref | bestaande immutable image opnieuw activeren | geen production rebuild of DB-downmigration |
| Migrations | `db push --include-all` | history/list, dry-run, forward-only zonder `--include-all` | unknown/out-of-order/destructive guard toevoegen |

## Healthaudit

| Service | Vereiste route | Oude toestand | Definitief contract |
|---|---|---|---|
| Marketing | `/api/health` | ontbrak | 200 `application/json` bij geldige env/revision; anders veilige 503 |
| Control | `/api/health` | bestond met oude veldnamen | exact `status`, `service`, `environment`, `revision` |
| Player | `/healthz` | alleen `/api/health` | nieuwe canonical route en veilig uniform contract |

Deployment valideert eerst localhost en daarna publiek via Caddy, maximaal
twintig pogingen met drie seconden interval en korte timeouts. De verifier
accepteert uitsluitend de vier veilige velden en weigert een verkeerde service,
environment of SHA.

### Server-secretgrens voor healthchecks

Control en Player lezen de Supabase-beheercredential niet meer in hun
healthmodules. De canonieke Next-serverentry `@veyocast/config/server` is de
enige Next-module die de betreffende environmentvariabele leest en valideert.
Deze entry, beide healthmodules en de twee adminclientmodules zijn expliciet
gemarkeerd met `import "server-only"`.

Healthmodules consumeren uitsluitend `{ valid: boolean }` en retourneren alleen
`status`, `service`, `environment` en `revision`. Een ongeldige kritieke
configuratie geeft een generieke 503 zonder logging van waarden, URL's,
keyfragmenten of fingerprints. De source-boundarytest staat alleen de centrale
serverentry en de afzonderlijke Node-runtime van de media-worker toe als
service-role-referentielocaties. Een importgraaftest weigert clientpaden naar de
beschermde Next-modules; een build-time scanner weigert environmentnamen,
ingebedde credentials en herkenbaar credentialmateriaal in `.next/static`.

De browser gebruikt op de media-uploadpagina wel de publieke Supabase-SDK voor
een signed upload. Daardoor kunnen SDK-documentatieteksten zoals
`service_role` of een losse `sb_secret_`-prefix in gegenereerde chunks staan.
Die teksten zijn geen credential. De scanner weigert daarom concrete
credentialvormen en de geconfigureerde waarde, zonder de waarde zelf te loggen.

## Media-workerbesluit

De mediaworker draait vanaf S29-A als `veyocast-<environment>-worker`, los van
de exact gehouden webserviceprofielen. De worker heeft geen gepubliceerde poort,
geen websecrets of anon-key, een read-only rootfilesystem, afgeschermde tijdelijke
opslag, resource-/procesgrenzen, een eigen bridgenetwerk en uitsluitend de reeds
bestaande environmentgebonden Supabase-URL en service-role key. Readiness bewijst
queuebereikbaarheid; deployment en rollback draineren de lopende job maximaal
70 seconden.

## Open externe acties vóór production

1. Voeg desgewenst een tweede productionreviewer toe en schakel dan self-review
   uit voor een vier-ogenbeleid; admin bypass staat al uit.
2. Bevestig dat de twee niet-zichtbare runners bestaan of pas de vastgelegde
   capaciteit bewust aan.
3. Bevestig dat beide Environments dezelfde
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` hebben.
4. Voer na merge de staging-smoke uit met synthetische MP4 en archiveer de
   gemeten upload→ready-tijd; gebruik geen klantmedia.
