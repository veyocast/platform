# VeyoCast Platform

VeyoCast is a local-first MVP for a multi-tenant narrowcasting and ClubTV
platform. This repository starts from the VeyoCast Codex Build Pack and follows
the canon in `AGENTS.md`, `PLANS.md`, `TASK_LEDGER.md` and `docs/`.

## Workspace

```text
apps/
  android-tv/     Kotlin Android-signageapp met TV/Google TV-ondersteuning
  control/        Next.js App Router control plane
  control-mobile/ Native React Native/Expo Router beheerapp
  player/         Next.js App Router player plane
  marketing/      Next.js App Router public site
  media-worker/   TypeScript media queue, Storage and FFmpeg worker
packages/
  contracts/      Zod transport contracts and safe command/error shapes
  domain/         Framework-free identity and product rules
  auth/           Pure role-to-capability decisions
  config/         Shared local runtime constants
  database/       Shared database role/status contracts
  observability/  Structured events, redaction, SLO/alert and support contracts
  studio/         Versioned Studio documents, templates, motion and render contracts
  mobile-design-system/ Atelier Ivory Native tokens en componenten
  tokens/         Design token build pipeline and generated presets
  ui/             Shared React primitives and Storybook skeleton
  testkit/        Shared test helpers
supabase/         Local Supabase config and later migrations/tests
docs/             Product, architecture, security and execution canon
```

## Local Runtime

Required tools:

- Node 24
- pnpm 11
- Docker Desktop with WSL2 integration
- Supabase CLI, pinned in the workspace devDependencies
- Git

Useful commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

CI runs the same foundation gates on GitHub Actions. See `docs/ci.md`.
Design tokens are generated from the canonical JSON source. See
`docs/design-tokens.md`. UI primitives live in `@veyocast/ui`; see
`docs/ui-primitives.md`. Auth, tenancy and RLS notes live in
`docs/auth-rls.md`.

Local ports:

```text
control:      3000
player:       3001
marketing:    3002
media-worker: 3100
supabase:     54321
postgres:     54322
studio:       54323
```

## Current baseline en vervolgprogramma

S19 finaliseert de VPS-releaseketen. Elke actuele `main`-SHA wordt eenmaal als
immutable Control-, Player- en Marketingimage gebouwd, eerst naar staging
uitgerold. Alleen een expliciete handmatige productiondispatch promoveert hem
na groene healthchecks met exact dezelfde image-digests naar production. Caddy
blijft op de host; containers binden alleen op `127.0.0.1`. Zie
`docs/deployment/`.

Development blijft op de bestaande dev-VPS. Staging en production hebben op de
andere VPS eigen Compose-projecten, runtimebestanden en Supabase-projecten.

S20 heeft de frameworkvrije application boundaries vastgelegd. S21 bouwt daarop
voort met centrale role-to-capabilitybesluiten, een expliciete en server-side
gevalideerde tenantcontext, Supabase TOTP MFA/AAL2 en databaseguards voor
paused/archived tenants. S22 maakt provisioning, tenantlifecycle, schermlimieten,
tenantteams en gescheiden platformgebruikers volledig bedienbaar. Persoonlijke
uitnodigingen gebruiken een eenmalige, e-mail- en tenantgebonden acceptatieflow.
Zie [`docs/auth-rls.md`](docs/auth-rls.md) en
[`docs/s22-platform-lifecycle-team-evidence.md`](docs/s22-platform-lifecycle-team-evidence.md).

S23 levert de capability-gestuurde Control-shell en gedeelde resourcepatronen.
S24 past die toe op Media: server-side pagination en filters, een toegankelijke
inspector met gebruiksimpact, en hervatbare 6 MiB TUS-video-overdracht met
idempotente intent/finalize, tenantquota, exacte Storage RLS en quarantaine.
Zie [`docs/media-pipeline-canon.md`](docs/media-pipeline-canon.md) en
[`docs/media-upload-threat-model.md`](docs/media-upload-threat-model.md).

S25 bouwt daarop de gescheiden playlistlijst en Playlist Studio met
revision-guards, een gedeeld publicatiegereedheidscontract en een responsieve
editor. De Studio gebruikt de gevalideerde MP4-bronduur als standaard,
ondersteunt toegankelijke drag-and-drop plus pijlacties en bundelt
iteminstellingen in een compacte bewerkdialoog. Zie
[`docs/s23-control-ux-evidence.md`](docs/s23-control-ux-evidence.md) en
[`docs/s25-playlist-studio-readiness-evidence.md`](docs/s25-playlist-studio-readiness-evidence.md).

S26 maakt publicatie een zelfstandig operationeel domein. Release Center toont
immutable historie, versieverschillen, asset→playlist→release→screen-impact en
desired/download/verify/active-voortgang. De begeleide `/publish`-flow voert per
scherm een deterministische readiness-, compatibility- en opslagpreflight uit;
verouderde telemetry blijft expliciet onbekend. Zie
[`docs/s26-release-center-preflight-evidence.md`](docs/s26-release-center-preflight-evidence.md).

S27 maakt schermbeheer één veilige journey. Transactionele lifecyclecommands,
duurzaam begrensde pairing, guided onboarding, vijf detailtabs en gecontroleerde
rename/revoke/re-pair/retry-acties verbinden eerste heartbeat, active/desired
release, storage, runtime en events zonder device secrets in Control. Tenant-
admins kunnen een scherm daarnaast expliciet deactiveren en daarna logisch
verwijderen; de operationele slot komt vrij terwijl immutable releasehistorie
en auditbewijs behouden blijven. Zie
[`docs/s27-screen-fleet-onboarding-evidence.md`](docs/s27-screen-fleet-onboarding-evidence.md)
en [`docs/player-device-threat-model.md`](docs/player-device-threat-model.md).
De S28 pairing-runtimecorrectie bevestigt een device onafhankelijk van de
aanwezigheid van content, rapporteert ook in `READY` een heartbeat en haalt de
eerste release vanuit een veilige wachtstatus automatisch op.
De aanvullende Android-PWA-shell biedt in een mobiele Android-browser de echte
native installatieprompt aan, gebruikt het officiële maskable icoon op een
Ink Black splash en precachet de volledige Player-shell. Tijdens playback is
technische diagnostiek niet publiek zichtbaar; alleen bij aantoonbaar
netwerkverlies verschijnt rechtsonder een compacte offline-chip terwijl de
last-known-good release lokaal blijft spelen.
De afzonderlijke `apps/android-tv/`-app — de mapnaam blijft voor compatibiliteit
met bestaande build- en Play-workflows behouden — verpakt exact dezelfde hosted
Player in een minimale native Android-WebView-shell. De app is beschikbaar voor
reguliere Android-apparaten, tablets, Android TV en Google TV. Staging en
production zijn compile-time gescheiden; de shell voegt normale én TV-launcher,
immersive fullscreen, touch-, toetsenbord- en D-padbediening en begrensd
netwerk-/rendererherstel toe zonder pairing, releases, cache of playbacklogica
te dupliceren. Een handmatige, Environment-beveiligde workflow bouwt en
signeert production als Android App Bundle en publiceert via kortlevende Google
Workload Identity uitsluitend naar het Play internal-testkanaal; Play
Console-bootstrap en fysieke acceptatie op telefoon, tablet en TV blijven
expliciete externe gates.
De stagingvariant bevat daarnaast een afgeschermde Google Play-reviewdemo. De
vaste reviewcode maakt een tijdelijke virtuele sessie en opent een immutable
release die een Platform Owner met AAL2 in staging kiest. Production bevat deze
menuoptie en routes functioneel niet.

S29-A activeert de mediaworker als afzonderlijke immutable, least-privilege
staging/production-service. Veilige H.264/AAC-bronnen worden zonder
kwaliteitsverlies geremuxed; afwijkende MP4's krijgen een begrensde snelle
transcode. Queuepolling gebeurt iedere 500 ms en Control ververst actieve
verwerking automatisch. Zie
[`docs/s29-media-worker-deployment-evidence.md`](docs/s29-media-worker-deployment-evidence.md).
S29-B–F voegt gestructureerde observability, uitvoerbare alert- en
recoverycontracten, capabilitygebonden supportbundels en één rustige gedeelde
filterervaring voor de belangrijkste Control-resources toe. Zie
[`docs/s29-observability-recovery-evidence.md`](docs/s29-observability-recovery-evidence.md).

Physical model/firmware validation and the 24-hour mixed-media soak remain
required before an LG support claim.

S101 brengt de vijf actuele dynamische slidefamilies onder Editorial Arena v2:
vaste landscape-/portraitcanvassen, volledige light/dark-semantiektokens,
vier nieuwsvarianten, maatvaste tweekoloms prijslijsten en sportpaging tot
twintig regels. Opgeloste themawaarden worden in immutable snapshots bevroren;
zie [`docs/dynamic-slides-canon.md`](docs/dynamic-slides-canon.md) en
[`docs/s101-editorial-arena-slide-suite-evidence.md`](docs/s101-editorial-arena-slide-suite-evidence.md).
De officiële VeyoCast-merkassetset v1.0 is vastgelegd in `assets/brand/` met
locked SVG-masters, goedgekeurde technische afgeleiden en SHA-256-controle.

De uitgewerkte vervolgroadmap S20-S37 staat in
[`docs/canon-alignment-product-roadmap.md`](docs/canon-alignment-product-roadmap.md).
S20-S30 maken de bestaande kern veilig, samenhangend en pilotwaardig; S31-S37
plannen productiviteit, scheduling, integraties, commercialisatie en begrensde
research zonder deze launchbasis te omzeilen.

De Publisher-backoffice-uitvoering van S31/S32 volgt het vastgelegde
[`VeyoCast Publisher Backoffice Canon v1.0`](docs/design-canon/v1/VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0.md).
Implementatiestatus, testbewijs en de bewust opengehouden grote
productbesluiten staan in
[`docs/publisher-backoffice-release-evidence.md`](docs/publisher-backoffice-release-evidence.md).

S40 voegt VeyoCast Studio als afzonderlijke authoringmodule aan Control toe.
Ontwerpen blijven tenantgescheiden, autosave gebruikt revision guards en
genereren bevriest een immutable bronrevisie. De bestaande media-worker maakt
deterministische sRGB-PNG of H.264/yuv420p-MP4; Publisher en Player ontvangen
daarna uitsluitend een normaal gevalideerd media-item. De canvas- en
rendercontracten staan in `@veyocast/studio`; Player importeert die code nooit.
Zie [`docs/studio/integration-matrix.md`](docs/studio/integration-matrix.md) en
[`docs/studio/operations.md`](docs/studio/operations.md). De volledige lokale
bewijsstatus, open releasegates en invloedrijke vervolgkeuzes staan in
[`docs/studio/release-evidence.md`](docs/studio/release-evidence.md).

S132 voegt een default-off LED Scores-pilot toe. Een server-only worker volgt
meerdere vaste read-only websockets met leases, detecteert uitsluitend verse
exacte goals en levert een device-geauthenticeerde realtime overlay boven de
ongewijzigde last-known-good Playerrelease. Studio publiceert immutable eigen-
en tegenstandervarianten naar de unie van meerdere schermgroepen. Architectuur,
operatorflow, metingen en rollback staan in
[`docs/integrations/ledscores-realtime-goal-alert.md`](docs/integrations/ledscores-realtime-goal-alert.md).

S133 herstelt forward-only de Sportlink-providerassetcompletion: geldige
content-addressed club- en teamlogo's passeren opnieuw de padvalidatie en de
ondubbelzinnige private service-role-upsert, met een echte database-regressietest
en zonder Player-, release- of last-known-good-data te wijzigen. De hotfix wordt
via de bestaande immutable VPS-releaseflow uitgerold.

S134 herstelt de afzonderlijke dagelijkse verjaardagssync. De worker gebruikt
voor `team-indeling` voortaan zowel de officiële `teamcode` als
`lokaleteamcode`, inclusief de door Sportlink geretourneerde `-1`-sentinel voor
bondsteams. De wijziging blijft server-only en verwerkt of logt geen extra
persoonsgegevens; bestaande last-known-good data en immutable releases blijven
onaangeraakt.

S135 registreert het nieuwe LED Scores-backend expliciet als server-only
media-workerbestand binnen de bestaande fail-closed service-role-test. De
clientbundel- en importgraafcontroles blijven ongewijzigd; de schone VPS-build
moet de volledige securitysuite opnieuw groen bewijzen voordat staging wijzigt.

S136 houdt de providerbrede Sportlink-poulefeed intact en vult ontbrekende
poulecontext van eigen clubuitslagen aan via de gevalideerde teamcode. Standen
en uitslagen krijgen exact 50% grotere primaire Playertekst en pagineren eerder
in browser en LG Legacy. De aankomstwizard accepteert daarnaast een venster in
minuten, uren of dagen tot 42 dagen; `10.000` minuten blijft compatibel als
minutenwaarde opgeslagen. Zie
[`docs/s136-sportlink-slides-release-evidence.md`](docs/s136-sportlink-slides-release-evidence.md).

S137 herstelt de Sportlink-verjaardagsnormalisatie voor de door de provider
gebruikte Nederlandse drielettermaanden. Wanneer Sportlink records levert maar
geen enkel record veilig normaliseert, faalt de worker vóór databasecompletion
en blijft de bestaande last-known-good snapshot behouden. Een aantoonbaar lege
providerrespons blijft een geldige lege dag. De wijziging raakt geen RLS,
immutable releases, Player- of offlinecontracten.
