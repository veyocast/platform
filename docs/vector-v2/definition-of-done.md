# Vector v2 — traceerbare Definition of Done

> Canonieke bron: gevalideerd Vector-v2-afleverpakket, SHA-256 `2e4f88c4b65cf7c754aa6ec9556e129123c25d471e8f9dbbbbece6e3a4cd6553`.
> Statuswaarden: `TODO | IN_PROGRESS | DONE | EXTERNAL_GATE`. Een item wordt pas `DONE` na implementatie én bewijs.


Dit is de bindende stopchecklist. Een item geldt alleen als `DONE` wanneer implementatie én bewijs bestaan. “Ontworpen”, “geschetst”, “achter flag maar niet werkend”, “handmatig lijkt goed” en “alleen happy path” zijn geen bewijs.

Codex maakt in de repository een traceerbare kopie met per item:

- `Status`: `TODO | IN_PROGRESS | DONE | EXTERNAL_GATE`;
- `Implementation`: bestanden/migraties/routes;
- `Evidence`: test, screenshot, log of runbook;
- `Gate owner/date`: alleen bij `EXTERNAL_GATE`.

## A. Baseline, scope en repositoryhygiëne

- [ ] Actuele `main`-SHA en pakketbasis zijn vergeleken.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/execution-plan.md`; Evidence=Baseline `a463ccc`; pakket-SHA exact gevalideerd; Gate owner/date=—
- [ ] Alle toepasselijke `AGENTS.md` en canonfiles zijn gelezen en nageleefd.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/execution-plan.md`; Evidence=Repository- en pakketcanons plus alle assetfamilies gecontroleerd; Gate owner/date=—
- [ ] Volledige app/package/route/capabilitymatrix is actueel.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/execution-plan.md`; Evidence=6 JavaScript-app-workspaces, 13 packages en 106 App Router page/API-routes geïnventariseerd; Gate owner/date=—
- [ ] `CURRENT`, `REDESIGN`, `PROPOSED_UI`, `PROPOSED_PRODUCT` en `GATED` zijn traceerbaar.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/execution-plan.md`; Evidence=Capabilitymatrix en externe-gatematrix vastgelegd; Gate owner/date=—
- [ ] Baseline foundation-, database/RLS-, build- en kern-E2E-resultaten zijn vastgelegd.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/evidence/phase-0-baseline.md`; Evidence=lint/typecheck/unit/build, 82 migraties, 1.083 RLS-assertions, a11y, Chromium, Player en offline-gates vastgelegd; Gate owner/date=—
- [ ] Geen ongerelateerde gebruikerswijziging is overschreven.
  - Trace: Status=DONE; Implementation=aparte worktree vanaf schoon `origin/main`; Evidence=baseline `git status` en branch-SHA; Gate owner/date=—
- [ ] Geen destructieve git- of databasestap is ongeautoriseerd uitgevoerd.
  - Trace: Status=DONE; Implementation=forward-only werkbranch en lokale `db:reset`; Evidence=geen reset/checkout/downmigration op gedeelde of remote staat; Gate owner/date=—
- [ ] Geen secrets, providerpayloads, persoonsgegevens of signed URLs staan in code/logs/evidence.
  - Trace: Status=DONE; Implementation=`docs/vector-v2/evidence/phase-0-baseline.md`; Evidence=lokale Supabasecredentials bewust niet opgenomen; Gate owner/date=—
- [ ] Final diff bevat alleen bedoelde bron-, migratie-, test-, asset- en docwijzigingen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alle nieuwe dependencies hebben noodzaak, licentie, security- en bundle-afweging.
  - Trace: Status=DONE; Implementation=geen dependency- of lockfilewijziging in fase 0–1; Evidence=`git diff -- pnpm-lock.yaml package.json`; Gate owner/date=—

## B. Merk, tokens en design system

- [ ] Alleen locked VeyoCast-logo/icon assets worden gebruikt.
  - Trace: Status=DONE; Implementation=bestaande repositoryassets bewust behouden; Evidence=`docs/vector-v2/evidence/phase-0-baseline.md`; Gate owner/date=—
- [ ] Logo is niet geredrawed, recolored, gemorphed of tenantgekleurd.
  - Trace: Status=DONE; Implementation=geen wijziging onder locked brandassets; Evidence=`git diff -- assets/brand apps/*/public/brand`; Gate owner/date=—
- [ ] Vector-semantic tokens zijn in de canonieke tokenpipeline opgenomen.
  - Trace: Status=DONE; Implementation=`tokens/veyocast-vector-v2-tokens.json`, `packages/tokens/src/builders.ts`, `packages/tokens/scripts/build.ts`; Evidence=token lint/typecheck en 5/5 tests groen; Gate owner/date=—
- [ ] Productcomponenten gebruiken geen ongeautoriseerde losse brand/statushexwaarden.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Light/dark themes hebben alle surface/text/line/focus/statusrollen.
  - Trace: Status=DONE; Implementation=namespaced `--vc-vector-*` light/dark aliases boven bestaand contract; Evidence=`packages/tokens/test/builders.test.ts`; Gate owner/date=—
- [ ] Tenant accent blijft beperkt tot tenantcontent/previews.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Buttons hebben primaire, secundaire, tertiaire, destructive, loading, disabled en icon-only states.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Form fields, selects, comboboxes, tabs, badges, menus, tables en toasts zijn geharmoniseerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Dialog, Sheet en Popover hebben consistente inzet, sizing, focus trap/return en closegedrag.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Vector Rail en Command Bar zijn capability-aware en consistent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Unified Filter Dock wordt door relevante resources gedeeld.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/components/vector.tsx`; Evidence=componenttest en Storybookstory groen, routemigratie loopt; Gate owner/date=—
- [ ] Unified Resource Picker wordt door relevante editors gedeeld.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/components/resource-picker.tsx`, Studio Element Library-integratie; Evidence=UI 17/17 tests en Studio-E2E-checkpoint; Gate owner/date=—
- [ ] Journey Shell wordt door multi-step flows gedeeld.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/components/vector.tsx`; Evidence=componenttest en `vector-workflows.stories.tsx`; Gate owner/date=—
- [ ] Storybook/componentcatalogus toont iedere relevante state en mode.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/stories/vector-workflows.stories.tsx`; Evidence=Storybook build volgt na volledige primitievenset; Gate owner/date=—
- [ ] Oude compatibility wrappers hebben een gedocumenteerd verwijderpad.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Nieuwe componenten hebben unit/interaction/accessibilitytests.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/test/primitives.test.tsx`, `tests/e2e/studio.spec.ts`; Evidence=17/17 componenttests groen; browserinteractiecheckpoint loopt; Gate owner/date=—

## C. Accessibility, responsive en motion

- [ ] WCAG 2.2 AA geautomatiseerde scans zijn groen op kernroutes.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Volledige keyboardflow werkt zonder pointer.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Focus is zichtbaar, logisch geordend en niet achter sticky chrome verborgen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Dialogs/sheets/popovers herstellen focus correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Status wordt nooit alleen via kleur gecommuniceerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Tekst/controls halen vereiste contrastwaarden.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Touch targets zijn minimaal 44×44 px.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] VoiceOver/TalkBack of equivalente screenreaderhandtests zijn gedocumenteerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Venue Twin heeft volledige lijst-/tekstfallback en keyboardbediening.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Drag-and-drop heeft toegankelijke pijl-/menuacties.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Reduced motion vervangt ruimtelijke/continue motion door statische feedback.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] UI werkt op 1920×1080, 1440×900, 1280×800, 1024×768 en 390×844.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Player werkt op 1920×1080 en 1080×1920 met safe areas.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Native app respecteert iOS/Android safe area en on-screen keyboard.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen kritieke copy, action of status wordt afgesneden of horizontaal onbereikbaar.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## D. Marketing en SEO

- [ ] Homepage positioneert VeyoCast als operating platform, niet als simpele playlisttool.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Hero, productworld, operating loop, modules, use-cases, integrations, reliability, app, Engage en CTA vormen één verhaal.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Venue Twin Setup Builder werkt met echte states, mobile stepper en accessible listfallback.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Setupresultaat toont screen count, groups, modules en correcte maandprijs na trial.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Setupintent gaat veilig mee naar demo/trial/onboarding.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Pricing toont 14 dagen gratis en daarna € 5,95 incl. btw per actief scherm per maand.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen verborgen fee, vooraf aangevinkte toestemming of misleidende trialcopy.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Sportvereniging-/ClubTV-/Sportlink-/Twelve-/RSS-/YouTube-/sponsor-/Engage-clusters bestaan volgens status.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] PROPOSED-producten zijn noindex/coming-soon tot production gates groen zijn.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Iedere indexeerbare pagina heeft unieke title, description, H1, intro en canonical.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Sitemap en robots bevatten alleen bedoelde routes.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] JSON-LD is feitelijk, valide en zichtbaar onderbouwd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Interne links verbinden pillar, cluster, pricing, demo en use-cases.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen kerncopy of prijs staat alleen in een afbeelding.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Meegeleverde beelden gebruiken juiste srcset/sizes/focal point/alt/caption.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen pseudoletters, verkeerd merk of gebroken afbeelding is zichtbaar.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Broken-linkcrawl en heading-outline zijn groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Marketing haalt afgesproken LCP, CLS en INP budgets op representatieve mobile.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Contact/demo/trialformulieren hebben validatie, consent, success/error en anti-abuse.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Privacy, voorwaarden, verwerkersinformatie, support/status en accessibilityroutes zijn coherent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## E. Auth, context en onboarding

- [ ] Login, forgot/reset, callback/confirm, MFA, invite en errors delen Vector-shell.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Authroutes lekken geen tenant- of accountinformatie.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Session expiry en recovery zijn begrijpelijk en getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Tenantcontext en role/capabilitygrenzen zijn duidelijk.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Onboarding is hervatbaar en server-authoritative.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Organisatie, venue, doelen, brand/content, integraties, app/player, pairing, eerste release en billing zijn opgenomen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Retry/back voorkomt duplicaat tenant, screen, trial of billingaccount.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Paused/archived/forbidden states zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Onboarding eindigt met een bruikbaar eerste scherm of concrete herstelactie.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## F. Control en platformroutes

- [ ] Alle tenant-Controlroutes gebruiken dezelfde Vector shell en primitives.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alle platformadminroutes gebruiken dezelfde familie met duidelijke autoriteitsgrens.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] System Pulse toont echte online/sync/release/offline/aandachtstatus.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Dashboard prioriteert actie boven vanity metrics.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Integratiestatus onderscheidt fresh, stale, error, disabled en unknown.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Snelle acties respecteren servercapabilities.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Team, settings, audit, support, data sources, groups en templates zijn gemigreerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Loading, empty, stale, error, forbidden en paused states zijn routeconsistent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen legacy header/sidebar/button/dialog/filter resteert op in-scope routes.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Platform support-/AAL2-acties zijn geaudit en begrensd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## G. Schermen, Screen 360 en Venue Twin

- [ ] Screen list en grid tonen juiste kernmetadata en schaalbare filters.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Saved views en gecombineerde filterchips werken server-side.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Bulkacties tonen impact, confirmation en partial-failure-resultaat.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Health view gebruikt echte telemetry en toont unknown/stale correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Venue Twin heeft persistent datamodel, migratie, RLS en audit.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Floorplan/venue asset en zones zijn veilig te uploaden/configureren.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Screen placement gebruikt normalized coordinates en valide orientation.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Venue Twin sync met list/grid/group/screen detail is consistent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Venue Twin werkt zonder 3D/motion via listfallback.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Screen onboarding en pairing zijn guided, bounded en idempotent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Screen 360 dekt overview, content, planning, automation, health, settings en activity.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Heartbeat, version, resolution, network, storage, desired/active release en sync zijn correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Rename, deactivate/archive, revoke, re-pair, retry en recovery respecteren capabilities/AAL2.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Deactivation/archive bewaart immutable release/audit history.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Offline en stale telemetry worden niet als online/healthy gepresenteerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## H. Media en resourcekeuze

- [ ] Media ondersteunt folders/collections, tags, favourites, saved views, search en filters.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Grid/list en inspector zijn consistent, snel en accessible.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Upload is resumable waar bestaand, toont echte progress en herstelt veilig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Processing, quarantine, retry en failurecopy zijn duidelijk.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Metadata, preview/crop en usage impact kloppen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Bulkacties hebben juiste tenant/capabilitychecks.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Unified Resource Picker ondersteunt toepasselijke media/slides/templates/elements/data/integratiebronnen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Picker ondersteunt keyboard, multiselect, search/filter en focusreturn.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Mobile picker gebruikt doelgerichte sheet/fullscreen experience.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Studio/Publisher/Menu/dynamic flows gebruiken geen afwijkende legacy media popup.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## I. Studio en dynamische content

- [ ] Studio overview/new/editor zijn volledig Vector v2.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Landscape/portrait canvas, safe zones en zoom werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Tools, media/elements, layers, inspector, slide strip/timeline en preview zijn coherent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Tekst, image, video, shape, logo, icon en QR werken volgens contracts.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Theme, data en motion controls gebruiken gedeelde patterns.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Undo/redo, autosave, revisions, conflict en recovery zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Keyboard/screenreaderbediening voor essentiële authoringacties is aanwezig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Reduced-motion preview bestaat.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Bestaande Studio documents blijven compatibel of zijn gemigreerd/versioned.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Render bevriest immutable source revision.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] PNG/MP4 queue, progress, error, retry en media-ingest werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Player importeert geen Studio runtimecode.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Sportlink, RSS/nieuws en Menu/Twelve flows delen Journey Shell.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Menu Studio toont correcte category/product/availability/price preview uit XLSX-data.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Dynamische templates renderen op landscape én portrait binnen grenzen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## J. Publisher, planning en releases

- [ ] Playlistlist/editor/timeline zijn volledig Vector v2.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] DnD én pijlacties leveren dezelfde ordering.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Duration, crop/fit, transitions en ondersteunde video/audio-instellingen werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Autosave, offline recovery en revision conflicts zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Draft, scheduled, published, release en live zijn eenduidig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Planning toont timezone/DST correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Guided publish volgt readiness, preview, targets, preflight en confirm.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Preflight controleert capability, assets, compatibility, storage en telemetry freshness.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Confirm toont target-/contentimpact en maakt immutable release.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Release Center toont history, compare, desired/download/verify/switch/active.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Partial failure en retry veroorzaken geen dubbele/onjuiste release.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Huidige content blijft actief tot nieuwe release volledig verified is.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Loop-boundary switch en LKG zijn regressievrij.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Activity/audit toont begrijpelijke publicatiegebeurtenissen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## K. Integraties, sponsors en Engage

- [ ] Sportlink setup/status/sync/teams/competitions/phase/data selectie werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Sportlink programma/uitslagen/standen/next match/visitor info zijn datagedreven.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Providercredentials en fysieke acceptatie blijven expliciete gates waar nodig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Twelve gebruikt gecontroleerde normale XLSX-import, mapping, validation, preview en re-import.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen live Twelve-API wordt zonder echte adapter geclaimd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] RSS/Atom setup, mapping, refresh, stale/error en fallback werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] YouTube gebruikt alleen officiële API/playback en voldoet aan actuele Terms.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] YouTube download/transcode/cache is afwezig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] YouTube is online-only met preflight, fallback en feature flag.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Sponsor Hub sponsors/campaigns/rotation/placements/approvals zijn coherent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Proof of play wordt niet als gegarandeerde menselijke impressie verkocht.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage heeft tenant-isolatie, campaign/poll/MOTM lifecycle en authoring.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage publieke stemroute is mobile-first, toegankelijk en rate-limited.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage QR/deeplink, realtime result, screen slide en final result werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage abuse/privacy/retention/analytics zijn gedocumenteerd en getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage blijft flag/noindex totdat production gates groen zijn.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## L. Native beheerapp

- [ ] Native tokens/primitives matchen Vector-semantiek.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Today/aandacht, screens, make/upload, content en more zijn gemigreerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Mobile Screen 360 en quick recovery zijn bruikbaar.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Camera/QR/code pairing heeft permission/error/retry.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Upload/camera processing en offline retry werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Playlist edit/reorder/publish werkt met impact en confirm.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alerts/notifications en preferences werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Engage operationele acties zijn doelgericht.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Billingstatus deeplinkt veilig naar webcheckout/portal.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Biometrics/session/account deletion blijven correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] iOS/Android VoiceOver/TalkBack en real-device viewports zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen vrije desktop-Studio is als mini-canvas op mobiel gebouwd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## M. Player, pairing en casting shells

- [ ] Splash/boot is branded, snel en reduced-motion compatible.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Install, pair, claim, wait, sync, download, verify, switch, ready en play zijn distinct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Pairing ondersteunt code en QR/deeplink met tekstalternatief.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Pairingcodes zijn bounded, expireerbaar en device secrets blijven verborgen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen-content/wait-release/download/offline/error tonen passende informatie en actie.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] LKG blijft lokaal spelen bij netwerkverlies.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Storagepressure en corrupte download herstellen veilig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Diagnostics lekken niet publiek tijdens normale playback.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Android PWA en native Android/TV/Google TV shell delen hosted Playercontract.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] LG route/shell blijft compatibel; fysieke claim blijft extern tot getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Touch, keyboard, D-pad, focus, immersive fullscreen en restart zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] 16:9 en 9:16 templates/playerstates zijn afstandsleesbaar.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Nieuwe release schakelt pas na verify en veilige grens.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## N. Billing, Mollie en entitlements

- [ ] Price version is immutable: EUR 595 cents gross, VAT versioned.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Trial start is atomair, éénmalig en exact 336 uur.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Billable screen definitie en interval lifecycle zijn geïmplementeerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Hardware replacement veroorzaakt geen dubbele charge.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Mid-cycle add/remove proration is reproduceerbaar en cent-exact.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Month-end, leap year, UTC/DST en credit rounding propertytests zijn groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Billing account, plan, price, subscription, usage, invoice, line en credit ledger bestaan.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Payment attempts, provider events, outbox, reconciliation, overrides en audit bestaan.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Financial history is append-only; correctie via reversal/credit.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Iedere nieuwe billingtabel heeft tenant/RLS/capabilitytests.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Mollie Customer/first payment/mandate flow werkt in testmode.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Browserredirect kan paymentstatus niet autoritatief wijzigen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Recurring Payment gebruikt juiste customer/mandate/sequence en bedrag.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Lokale semantic idempotency overleeft retries langer dan providercache.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Classic webhook verwerkt hetzelfde payment-ID bij statusupdates correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Duplicate/out-of-order webhook veroorzaakt geen dubbel financieel effect.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Reconciliation detecteert en herstelt provider/local mismatch veilig.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Reversal/chargeback brengt invoice/entitlement naar correcte state.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Dunning D0/D1/D3/D6, pending timeouts en retryguards werken.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Billing portal toont profiel, plan, period, screens, invoices, credits, method en recovery.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Platform support overrides zijn tijdgebonden, AAL2 en geaudit.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Entitlement snapshot is signed, monotonic, scoped en expiry-bounded.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Trial/active Player toont geen billingoverlay.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Grace Player toont toegankelijke countdownchip gedurende maximaal 168 uur.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Grace behoudt tenantcontent en LKG.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Restricted Player toont lokale VeyoCast-betalingssplash zonder factuurdetails.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Restricted wist contentcache/releasehistory niet.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Beheer, betaling, support, recovery en atomische replacement blijven mogelijk.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Netto nieuwe billable activatie is restricted of pending.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Serverbevestigde betaling herstelt playback zonder republish.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Offline lease, stale clock en clock rollback zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Test/live Mollie IDs, keys, webhook URLs en ledgers zijn strikt gescheiden.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Provider- en billinglogs zijn geredigeerd en correlation-aware.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Shadow/cohort/chip/restricted flags en kill switches zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Accountant/jurist heeft btw, factuur, creditnota en incassotekst extern gevalideerd of staat als expliciete gate.
  - Trace: Status=EXTERNAL_GATE; Implementation=`docs/vector-v2/execution-plan.md#externe-gates`; Evidence=Protocol/owner vastgelegd; uitvoering vereist externe bevoegdheid of hardware; Gate owner/date=Accountant/jurist

## O. Kwaliteitsgates, performance en release

- [ ] `pnpm lint` of actuele repo-equivalent is groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] `pnpm typecheck` of actuele repo-equivalent is groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alle unit/integrationtests zijn groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Database/RLS gates zijn groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alle relevante apps/packages builden groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Kern-E2E voor marketing→trial→pair→create→publish→play is groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Billing testmode→grace→restricted→payment→recover E2E is groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Multi-tenant isolation E2E is groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Visual regression bevat alle routefamilies en kritieke states.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] No-console-error, no-unhandled-rejection en broken-link checks zijn groen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Marketing CWV budgets zijn gehaald.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Control/Studio bundle- en interactionbudgets zijn gehaald of gemotiveerd verbeterd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Player cold boot, restart, network loss en LKG metrics halen canon/SLO.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] 24-uurs mixed-media soak is uitgevoerd of expliciete hardwaregate met protocol.
  - Trace: Status=EXTERNAL_GATE; Implementation=`docs/vector-v2/execution-plan.md#externe-gates`; Evidence=Protocol/owner vastgelegd; uitvoering vereist externe bevoegdheid of hardware; Gate owner/date=Player/release owner
- [ ] Android/TV/Google TV fysieke acceptatie is uitgevoerd of expliciete external gate.
  - Trace: Status=EXTERNAL_GATE; Implementation=`docs/vector-v2/execution-plan.md#externe-gates`; Evidence=Protocol/owner vastgelegd; uitvoering vereist externe bevoegdheid of hardware; Gate owner/date=Player/release owner
- [ ] LG fysieke acceptatie is uitgevoerd vóór supportclaim of blijft gated.
  - Trace: Status=EXTERNAL_GATE; Implementation=`docs/vector-v2/execution-plan.md#externe-gates`; Evidence=Protocol/owner vastgelegd; uitvoering vereist externe bevoegdheid of hardware; Gate owner/date=Player/release owner
- [ ] Staging healthchecks en immutable image/digest promotion volgen deploymentcanon.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Rollback en feature-flag kill switches zijn daadwerkelijk geoefend.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Runbooks voor billing, webhook/reconcile, Player restricted en entitlement recovery bestaan.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Release evidence, ADR’s, changelog en traceability zijn compleet.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen ongeautoriseerde skipped/quarantined test resteert.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen `TODO`, placeholder, mock-only productiepad of pseudo-integratie resteert binnen scope.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## Finale stopregel

Finaliseer uitsluitend wanneer alle items `DONE` zijn of aantoonbaar `EXTERNAL_GATE`. Een `EXTERNAL_GATE` bevat altijd eigenaar, reden, afhankelijkheid, voorbereide code/testmodus, exact verificatieprotocol en impact op marketingclaim/feature flag. Externe gates worden nooit gebruikt om lokaal uitvoerbaar werk uit te stellen.

