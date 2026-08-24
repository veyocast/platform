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
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/components/resource-picker.tsx`, Studio Element Library en Venue Twin-plattegrondselectie; Evidence=UI 18/18, live Venue-picker/Axe en `resource-picker-1440x900.png`; Gate owner/date=Publisher/Menu/dynamic migreren in fases 6–8
- [ ] Journey Shell wordt door multi-step flows gedeeld.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/components/vector.tsx`; Evidence=componenttest en `vector-workflows.stories.tsx`; Gate owner/date=—
- [ ] Storybook/componentcatalogus toont iedere relevante state en mode.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/src/stories/vector-workflows.stories.tsx`; Evidence=Storybook build volgt na volledige primitievenset; Gate owner/date=—
- [ ] Oude compatibility wrappers hebben een gedocumenteerd verwijderpad.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Nieuwe componenten hebben unit/interaction/accessibilitytests.
  - Trace: Status=IN_PROGRESS; Implementation=`packages/ui/test/primitives.test.tsx`, Resource Picker- en route-E2E; Evidence=18/18 componenttests plus Media/Venue live Axe groen; routebrede dekking loopt; Gate owner/date=—

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
  - Trace: Status=DONE; Implementation=`apps/marketing/app/page.tsx`; Evidence=`phase-2-marketing.md`, homepage E2E en viewportcaptures; Gate owner/date=—
- [ ] Hero, productworld, operating loop, modules, use-cases, integrations, reliability, app, Engage en CTA vormen één verhaal.
  - Trace: Status=DONE; Implementation=`apps/marketing/app/page.tsx`, `globals.css`; Evidence=axe 0 violations, E2E en 5-viewport visual readback; Gate owner/date=—
- [ ] Venue Twin Setup Builder werkt met echte states, mobile stepper en accessible listfallback.
  - Trace: Status=DONE; Implementation=`venue-setup-builder.tsx`; Evidence=desktop signed-intent E2E, mobiele stepper E2E en axe; Gate owner/date=—
- [ ] Setupresultaat toont screen count, groups, modules en correcte maandprijs na trial.
  - Trace: Status=DONE; Implementation=`venue-setup-builder.tsx`, `packages/domain/src/billing.ts`; Evidence=zone/group-, module- en schermtelling plus €11,90 E2E; Gate owner/date=—
- [ ] Setupintent gaat veilig mee naar demo/trial/onboarding.
  - Trace: Status=DONE; Implementation=`@veyocast/auth/setup-intent`, `/demo`, `/register`, `/onboarding`; Evidence=4 intenttests, marketing demo E2E en live signup/onboarding E2E; Gate owner/date=—
- [ ] Pricing toont 14 dagen gratis en daarna € 5,95 incl. btw per actief scherm per maand.
  - Trace: Status=DONE; Implementation=`billing.ts`, `marketing-price-calculator.tsx`, `/prijzen`; Evidence=domain unit, marketing build en pricingcaptures; Gate owner/date=—
- [ ] Geen verborgen fee, vooraf aangevinkte toestemming of misleidende trialcopy.
  - Trace: Status=DONE; Implementation=setup- en pricingcopy; Evidence=claimsunit en visual readback; Gate owner/date=—
- [ ] Sportvereniging-/ClubTV-/Sportlink-/Twelve-/RSS-/YouTube-/sponsor-/Engage-clusters bestaan volgens status.
  - Trace: Status=DONE; Implementation=`pages.ts` detailroutes en bestaande sectorroutes; Evidence=contentcanonunit, route-E2E en build; Gate owner/date=—
- [ ] PROPOSED-producten zijn noindex/coming-soon tot production gates groen zijn.
  - Trace: Status=DONE; Implementation=`/integraties/youtube`, `/engage`, `pages.ts`; Evidence=sitemapunit bewijst beide uitgesloten en UI labelt `In voorbereiding`; Gate owner/date=—
- [ ] Iedere indexeerbare pagina heeft unieke title, description, H1, intro en canonical.
  - Trace: Status=DONE; Implementation=marketing contentregistry en catch-all metadata; Evidence=contentcanon uniqueness en route metadata E2E; Gate owner/date=—
- [ ] Sitemap en robots bevatten alleen bedoelde routes.
  - Trace: Status=DONE; Implementation=`sitemap.ts`, route metadata en `index` flags; Evidence=sitemapunit inclusief live/proposed integraties; Gate owner/date=—
- [ ] JSON-LD is feitelijk, valide en zichtbaar onderbouwd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Interne links verbinden pillar, cluster, pricing, demo en use-cases.
  - Trace: Status=DONE; Implementation=page registry related/CTA-links; Evidence=known-route canonunit; Gate owner/date=—
- [ ] Geen kerncopy of prijs staat alleen in een afbeelding.
  - Trace: Status=DONE; Implementation=HTML hero, builder, pricing en detailcontent; Evidence=Playwright role/text assertions; Gate owner/date=—
- [ ] Meegeleverde beelden gebruiken juiste srcset/sizes/focal point/alt/caption.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen pseudoletters, verkeerd merk of gebroken afbeelding is zichtbaar.
  - Trace: Status=DONE; Implementation=locked repositorybrandassets en feitelijke copy; Evidence=15 privacyveilige visual captures handmatig gecontroleerd; Gate owner/date=—
- [ ] Broken-linkcrawl en heading-outline zijn groen.
  - Trace: Status=DONE; Implementation=route registry; Evidence=known-route linkunit, representative route-E2E en exact één H1 per template; Gate owner/date=—
- [ ] Marketing haalt afgesproken LCP, CLS en INP budgets op representatieve mobile.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Contact/demo/trialformulieren hebben validatie, consent, success/error en anti-abuse.
  - Trace: Status=IN_PROGRESS; Implementation=contact/demo servervalidatie, honeypot, privacycopy en eerlijke unavailable-state; Evidence=4 actiontests en demo E2E; Gate owner/date=trialflow volgt fase 3/11
- [ ] Privacy, voorwaarden, verwerkersinformatie, support/status en accessibilityroutes zijn coherent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## E. Auth, context en onboarding

- [ ] Login, forgot/reset, callback/confirm, MFA, invite en errors delen Vector-shell.
  - Trace: Status=DONE; Implementation=`auth-shell`, `AuthBrand`, bestaande serveracties plus `/register`; Evidence=Control lint/typecheck/build en auth-route readback; Gate owner/date=—
- [ ] Authroutes lekken geen tenant- of accountinformatie.
  - Trace: Status=DONE; Implementation=generieke signup/recovery/login errors, server-only Supabase; Evidence=live signup E2E, authboundary- en secretbundlecheck; Gate owner/date=—
- [ ] Session expiry en recovery zijn begrijpelijk en getest.
  - Trace: Status=DONE; Implementation=login reasons, recovery route/template en session redirects; Evidence=Control authboundary/recovery unit en build; Gate owner/date=—
- [ ] Tenantcontext en role/capabilitygrenzen zijn duidelijk.
  - Trace: Status=DONE; Implementation=`control-session.ts`, contextpicker en onboarding claim-RPC; Evidence=20 onboarding-RLS plus volledige 1103 RLS assertions; Gate owner/date=—
- [ ] Onboarding is hervatbaar en server-authoritative.
  - Trace: Status=DONE; Implementation=`tenant_onboarding_states`, validated RPC's en `/onboarding`; Evidence=verse migration, RLS, live confirm/claim/reload E2E en Axe; Gate owner/date=—
- [ ] Organisatie, venue, doelen, brand/content, integraties, app/player, pairing, eerste release en billing zijn opgenomen.
  - Trace: Status=IN_PROGRESS; Implementation=organisatie/use-case/bronnen/scherm/pairing/release Journey; Evidence=live bronstap en resource-reconciliatie; Gate owner/date=billingdomein volgt fase 11, Venue Twin fase 4
- [ ] Retry/back voorkomt duplicaat tenant, screen, trial of billingaccount.
  - Trace: Status=IN_PROGRESS; Implementation=advisory-lock en unique owner/idempotency tenantclaim; Evidence=20 RLS assertions; Gate owner/date=trial/billing-idempotency volgt fase 11
- [ ] Paused/archived/forbidden states zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Onboarding eindigt met een bruikbaar eerste scherm of concrete herstelactie.
  - Trace: Status=IN_PROGRESS; Implementation=guided links plus echte screen/pairing/release-reconciliatie; Evidence=RLS progressassertion; Gate owner/date=complete-status volgt entitlementactivatie in fase 11

## F. Control en platformroutes

- [ ] Alle tenant-Controlroutes gebruiken dezelfde Vector shell en primitives.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Alle platformadminroutes gebruiken dezelfde familie met duidelijke autoriteitsgrens.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] System Pulse toont echte online/sync/release/offline/aandachtstatus.
  - Trace: Status=DONE; Implementation=`control-overview.ts`, `control-operations.ts`, dashboard; Evidence=`phase-4-control-screens-venue.md`, live screenshot en Axe; Gate owner/date=—
- [ ] Dashboard prioriteert actie boven vanity metrics.
  - Trace: Status=DONE; Implementation=operationele alerts, nu-actief, readiness en pulse; Evidence=`system-pulse-1440x900.png`; Gate owner/date=—
- [ ] Integratiestatus onderscheidt fresh, stale, error, disabled en unknown.
  - Trace: Status=DONE; Implementation=`apps/control/lib/control-operations.ts`; Evidence=unitregressie plus live System Pulse; Gate owner/date=—
- [ ] Snelle acties respecteren servercapabilities.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Team, settings, audit, support, data sources, groups en templates zijn gemigreerd.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Loading, empty, stale, error, forbidden en paused states zijn routeconsistent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Geen legacy header/sidebar/button/dialog/filter resteert op in-scope routes.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Platform support-/AAL2-acties zijn geaudit en begrensd.
  - Trace: Status=DONE; Implementation=`set_tenant_feature_flag_v1`, platform tenantactions; Evidence=25/25 gerichte RLS, live MFA/rolloutflow; Gate owner/date=—

## G. Schermen, Screen 360 en Venue Twin

- [ ] Screen list en grid tonen juiste kernmetadata en schaalbare filters.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Saved views en gecombineerde filterchips werken server-side.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Bulkacties tonen impact, confirmation en partial-failure-resultaat.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Health view gebruikt echte telemetry en toont unknown/stale correct.
  - Trace: Status=DONE; Implementation=`screen-health.ts`, `health-view.tsx`; Evidence=unitmatrix, Axe en `screen-health-1440x900.png`; Gate owner/date=—
- [ ] Venue Twin heeft persistent datamodel, migratie, RLS en audit.
  - Trace: Status=DONE; Implementation=`20260824170000_s123_venue_twin_foundation.sql`; Evidence=verse reset, 25/25 pgTAP en live mutaties; Gate owner/date=—
- [ ] Floorplan/venue asset en zones zijn veilig te uploaden/configureren.
  - Trace: Status=DONE; Implementation=tenant/media-FK, `venue-floorplan-form.tsx`, gedeelde Resource Picker, floorplan- en zone-RPC; Evidence=live upload/picker/save, Axe, screenshot en 1.154 RLS-assertions; Gate owner/date=—
- [ ] Screen placement gebruikt normalized coordinates en valide orientation.
  - Trace: Status=DONE; Implementation=`venue_screen_placements`, `save_venue_screen_placement_v1`; Evidence=constraints, pgTAP en 32% × 64% live readback; Gate owner/date=—
- [ ] Venue Twin sync met list/grid/group/screen detail is consistent.
  - Trace: Status=IN_PROGRESS; Implementation=fleet venue/list en Screen 360 venuecontext; Evidence=desktop/mobile captures; Gate owner/date=screen groups worden in Publisherfase gekoppeld
- [ ] Venue Twin werkt zonder 3D/motion via listfallback.
  - Trace: Status=DONE; Implementation=`venue-view.tsx`; Evidence=Axe en 390×844 zonder horizontale overflow; Gate owner/date=—
- [ ] Screen onboarding en pairing zijn guided, bounded en idempotent.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Screen 360 dekt overview, content, planning, automation, health, settings en activity.
  - Trace: Status=IN_PROGRESS; Implementation=bestaande Screen 360-routes plus venuecontext/healthsemantiek; Evidence=unit en live fleetflow; Gate owner/date=routebrede visual matrix volgt fase 13
- [ ] Heartbeat, version, resolution, network, storage, desired/active release en sync zijn correct.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Rename, deactivate/archive, revoke, re-pair, retry en recovery respecteren capabilities/AAL2.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Deactivation/archive bewaart immutable release/audit history.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Offline en stale telemetry worden niet als online/healthy gepresenteerd.
  - Trace: Status=DONE; Implementation=`deriveScreenHealth`; Evidence=grenswaardetests 5/30 minuten en Health live readback; Gate owner/date=—

## H. Media en resourcekeuze

- [ ] Media ondersteunt folders/collections, tags, favourites, saved views, search en filters.
  - Trace: Status=DONE; Implementation=`media-library-workspace.tsx`, saved-viewcontract, `media_collections` en listing-RPC v2; Evidence=live create/bulk/filter/readback en desktop/mobile captures; Gate owner/date=—
- [ ] Grid/list en inspector zijn consistent, snel en accessible.
  - Trace: Status=DONE; Implementation=selecteerbare DataTable/grid, gedeelde inspector en statusrollen; Evidence=desktop/mobile Axe 0 violations, geen horizontale overflow; Gate owner/date=—
- [ ] Upload is resumable waar bestaand, toont echte progress en herstelt veilig.
  - Trace: Status=DONE; Implementation=bestaande image/video uploadpipeline en herstelde documentnavigatie voor uploadoverlay; Evidence=production-build E2E upload 2/2 plus bestaande TUS/RLS-regressies; Gate owner/date=—
- [ ] Processing, quarantine, retry en failurecopy zijn duidelijk.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Metadata, preview/crop en usage impact kloppen.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Bulkacties hebben juiste tenant/capabilitychecks.
  - Trace: Status=DONE; Implementation=`bulk_organize_media_assets_v1`, server action en sticky bulkbar; Evidence=26/26 gerichte pgTAP, cross-tenant/partial-result en live 2/2 readback; Gate owner/date=—
- [ ] Unified Resource Picker ondersteunt toepasselijke media/slides/templates/elements/data/integratiebronnen.
  - Trace: Status=IN_PROGRESS; Implementation=shared kind/source/categorycontract voor media/slides/templates/elements/data/integratie; Studio en Venue integraties; Evidence=18/18 componenttests en live Venue-selectie; Gate owner/date=Publisher/Menu/dynamic datasets volgen fases 6–8
- [ ] Picker ondersteunt keyboard, multiselect, search/filter en focusreturn.
  - Trace: Status=DONE; Implementation=native buttonsemantiek, single/multiple confirmflow, bron/categoriefacets en Radix focusgrens; Evidence=componentinteractietests plus live Axe/focusdialog; Gate owner/date=—
- [ ] Mobile picker gebruikt doelgerichte sheet/fullscreen experience.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [ ] Studio/Publisher/Menu/dynamic flows gebruiken geen afwijkende legacy media popup.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—

## I. Studio en dynamische content

- [ ] Studio overview/new/editor zijn volledig Vector v2.
  - Trace: Status=IN_PROGRESS; Implementation=Vector shell, Studio workspace en gedeelde Journey Shell; Evidence=`phase-6-studio-dynamic.md`, demo browser 6/6; Gate owner/date=routebrede visualmatrix volgt fase 13
- [ ] Landscape/portrait canvas, safe zones en zoom werken.
  - Trace: Status=DONE; Implementation=`studio-konva-canvas.tsx`, bestaande artboard/safe-area/zoomcontracts; Evidence=Studio unit + desktop/mobile browsermatrix; Gate owner/date=—
- [ ] Tools, media/elements, layers, inspector, slide strip/timeline en preview zijn coherent.
  - Trace: Status=DONE; Implementation=`studio-editor-workspace.tsx`, Resource Picker en mobiele quick edit; Evidence=Studio demo browser 6/6 en Media phase-5 pickerbewijs; Gate owner/date=—
- [ ] Tekst, image, video, shape, logo, icon en QR werken volgens contracts.
  - Trace: Status=DONE; Implementation=strict text/image/video/shape/placeholder-logo/icon/QR-schema, signed preview en lokale workercompositor; Evidence=Studio 16 + worker 87 tests, verse reset en 1.160 RLS-assertions; Gate owner/date=production-image FFmpeg-smoke herhaald in fase 13
- [ ] Theme, data en motion controls gebruiken gedeelde patterns.
  - Trace: Status=DONE; Implementation=shared ThemePicker/Journey Shell, dataflows en motiontab; Evidence=Journey 2/2, RSS live 1/1 en Studio browser; Gate owner/date=—
- [ ] Undo/redo, autosave, revisions, conflict en recovery zijn getest.
  - Trace: Status=DONE; Implementation=editor reducer, guarded autosave/revisions en conflict/recovery UI; Evidence=Control editorstate 8/8 en Studio desktop/mobile E2E; Gate owner/date=—
- [ ] Keyboard/screenreaderbediening voor essentiële authoringacties is aanwezig.
  - Trace: Status=DONE; Implementation=native controls, layer arrows, focusable Journey progress en picker focusreturn; Evidence=Studio Axe/keyboardbrowser groen; Gate owner/date=—
- [ ] Reduced-motion preview bestaat.
  - Trace: Status=DONE; Implementation=`evaluateStudioReducedMotionFrame` plus previewtoggle/OS-default; Evidence=Studio motionunit 3/3 en browserassertie; Gate owner/date=—
- [ ] Bestaande Studio documents blijven compatibel of zijn gemigreerd/versioned.
  - Trace: Status=DONE; Implementation=ongewijzigd schemaVersion/revisioncontract; Evidence=Studio schema/branding/documenttests en production build; Gate owner/date=—
- [ ] Render bevriest immutable source revision.
  - Trace: Status=DONE; Implementation=bestaande renderrequest met revisionId en document snapshot; Evidence=worker studio-render tests en security boundary; Gate owner/date=—
- [ ] PNG/MP4 queue, progress, error, retry en media-ingest werken.
  - Trace: Status=DONE; Implementation=Studio renderqueue, source-video compositor en media-worker ingest; Evidence=worker 87 tests, build en video variantclaim-RLS; Gate owner/date=—
- [ ] Player importeert geen Studio runtimecode.
  - Trace: Status=DONE; Implementation=media-outputboundary; Evidence=package-boundarytest plus Player 153 tests/build; Gate owner/date=—
- [ ] Sportlink, RSS/nieuws en Menu/Twelve flows delen Journey Shell.
  - Trace: Status=DONE; Implementation=shared `JourneyShell` in alle drie authoringroutes; Evidence=Journey browser 2/2 en live RSS 1/1; Gate owner/date=—
- [ ] Menu Studio toont correcte category/product/availability/price preview uit XLSX-data.
  - Trace: Status=DONE; Implementation=MenuDocument/Twelve resolver en shared Menu Journey; Evidence=live category/product/group/price/portrait/theme/mobile/publishflow en `menu-twelve-live-*`; Gate owner/date=—
- [ ] Dynamische templates renderen op landscape én portrait binnen grenzen.
  - Trace: Status=DONE; Implementation=shared Editorial Arena/Menu renderer en orientation-aware viewportfit; Evidence=templates 40, Player 153 en desktop/mobile previewcaptures; Gate owner/date=—

## J. Publisher, planning en releases

- [x] Playlistlist/editor/timeline zijn volledig Vector v2.
  - Trace: Status=DONE; Implementation=Vector playlistoverzicht, desktop driepanelenstudio, mobiele sequentiële editor en gedeelde primitives; Evidence=`phase-7-publisher-releases.md`, Control build en bestaande browser/a11ycontracten; Gate owner/date=routebrede goldens worden in fase 13 herhaald
- [x] DnD én pijlacties leveren dezelfde ordering.
  - Trace: Status=DONE; Implementation=één guarded reordercommand voor DnD, keyboard-sensor en omhoog/omlaagmenu; Evidence=publisher state unit, RLS drag/order en live publisherregressies; Gate owner/date=—
- [x] Duration, crop/fit, transitions en ondersteunde video/audio-instellingen werken.
  - Trace: Status=DONE; Implementation=iteminspector, inline duration, immutable manifestvelden en volledige releasediff; Evidence=Domain releasecompare 7/7, Control 182 en 1.160 RLS-assertions; Gate owner/date=—
- [x] Autosave, offline recovery en revision conflicts zijn getest.
  - Trace: Status=DONE; Implementation=debounced guarded mutations, local recoveryrecord en conflictpanel; Evidence=publisher recovery/state unit en RLS concurrency/guarded commands; Gate owner/date=—
- [x] Draft, scheduled, published, release en live zijn eenduidig.
  - Trace: Status=DONE; Implementation=gescheiden playliststatus, schedule-runtime, immutable release en telemetry-afgeleide livefase; Evidence=planning/release UI, RLS scheduling runtime en Release Center; Gate owner/date=—
- [x] Planning toont timezone/DST correct.
  - Trace: Status=DONE; Implementation=tenanttime-zone conversie plus recurrence/conflictcalculator; Evidence=planning time/calendar 12/12 tests en RLS scheduling; Gate owner/date=—
- [x] Guided publish volgt readiness, preview, targets, preflight en confirm.
  - Trace: Status=DONE; Implementation=`publish-journey.tsx` met gedeelde Journey Shell en vaste impactkolom; Evidence=live guided publish 1/1; Gate owner/date=—
- [x] Preflight controleert capability, assets, compatibility, storage en telemetry freshness.
  - Trace: Status=DONE; Implementation=centrale readiness plus `evaluateReleasePreflight`; Evidence=Domain preflight, Release Center en 1.160 RLS-assertions; Gate owner/date=—
- [x] Confirm toont target-/contentimpact en maakt immutable release.
  - Trace: Status=DONE; Implementation=vaste impactsummary plus server-side hercontrole en `publish_playlist_to_targets_v3`; Evidence=live E2E maakte één release en toonde `Huidig gewenst`; Gate owner/date=—
- [x] Release Center toont history, compare, desired/download/verify/switch/active.
  - Trace: Status=DONE; Implementation=release list/detail, volledige presentationdiff en per-screen syncfase; Evidence=Domain compare 7/7, Control build en live E2E; Gate owner/date=—
- [x] Partial failure en retry veroorzaken geen dubbele/onjuiste release.
  - Trace: Status=DONE; Implementation=duurzame commandreceipts en append-only reassignment; Evidence=RLS guarded publish/reassign/replay assertions; Gate owner/date=—
- [x] Huidige content blijft actief tot nieuwe release volledig verified is.
  - Trace: Status=DONE; Implementation=desired/pending naast active/LKG en expliciete Journey-copy; Evidence=Player 153 unit, RLS Player sync en phase-7 bewijs; Gate owner/date=—
- [x] Loop-boundary switch en LKG zijn regressievrij.
  - Trace: Status=DONE; Implementation=verified pending activation op loopgrens en previous-releasecache; Evidence=Player unit 153/153 en bestaande periodic/offline browsercontracts; Gate owner/date=fysieke LG/soak blijft afzonderlijke fase-13 external gate
- [x] Activity/audit toont begrijpelijke publicatiegebeurtenissen.
  - Trace: Status=DONE; Implementation=transactionele `private.audit_event` bij publish/restore/reassign plus tenant Auditlog; Evidence=RLS release/restore/guarded commandtests en Control Auditlog build; Gate owner/date=—

## K. Integraties, sponsors en Engage

- [x] Sportlink setup/status/sync/teams/competitions/phase/data selectie werken.
  - Trace: Status=DONE; Implementation=bestaande server-only Club.Dataservice + vijfstaps Studio-wizard; Evidence=Sportlink RLS/integrations/worker/Control regressies en phase-8 audit; Gate owner/date=providerproductiedata blijft productowner-gate
- [x] Sportlink programma/uitslagen/standen/next match/visitor info zijn datagedreven.
  - Trace: Status=DONE; Implementation=versioned configs + runtime snapshots voor negen blueprints; Evidence=bestaande dynamic/Sportlink RLS en Playercontracts; Gate owner/date=—
- [x] Providercredentials en fysieke acceptatie blijven expliciete gates waar nodig.
  - Trace: Status=DONE; Implementation=server secret references, default-off providerflags en evidence gates; Evidence=phase-8 evidence/execution-plan external gates; Gate owner/date=Productowner + Player release owner
- [x] Twelve gebruikt gecontroleerde normale XLSX-import, mapping, validation, preview en re-import.
  - Trace: Status=DONE; Implementation=bestaande Twelve Producten importworkspace en immutable broninformatie; Evidence=live Twelve/Menu proof + integration tests; Gate owner/date=—
- [x] Geen live Twelve-API wordt zonder echte adapter geclaimd.
  - Trace: Status=DONE; Implementation=UI/copy noemt uitsluitend Excel-export/import; Evidence=Integratiescatalogus + productwaarheidaudit; Gate owner/date=—
- [x] RSS/Atom setup, mapping, refresh, stale/error en fallback werken.
  - Trace: Status=DONE; Implementation=begrensde feedfetch, snapshots, lokale media/QR en LKG; Evidence=RSS 23 tests, live RSS journey en phase-6/8 audit; Gate owner/date=—
- [x] YouTube gebruikt alleen officiële API/playback en voldoet aan actuele Terms.
  - Trace: Status=DONE; Implementation=Data API-adapter + immutable privacy-enhanced IFramebinding; Evidence=phase-8 officiële bronlinks, phase-10 CSP/Player E2E en cachetest; Gate owner/date=Google API-key/cohort blijft rolloutgate
- [x] YouTube download/transcode/cache is afwezig.
  - Trace: Status=DONE; Implementation=metadata-only source, `online_only` DB-constraint en geen media-ingestpad; Evidence=migration/RLS 21 + source audit; Gate owner/date=—
- [x] YouTube is online-only met preflight, fallback en feature flag.
  - Trace: Status=DONE; Implementation=`youtube_sources`, revision-guarded playlistcommand, immutable releasevelden en lokale fallback; Evidence=38/38 pgTAP, Player cacheunit en E2E; Gate owner/date=—
- [x] Sponsor Hub sponsors/campaigns/rotation/placements/approvals zijn coherent.
  - Trace: Status=DONE; Implementation=bestaande S115 Sponsor Hub + immutable plan/Playerzones; Evidence=Sponsor RLS/domain/Player regressies en phase-8 audit; Gate owner/date=—
- [x] Proof of play wordt niet als gegarandeerde menselijke impressie verkocht.
  - Trace: Status=DONE; Implementation=UI noemt technisch afgemelde plays en expliciet geen bereik; Evidence=Sponsor Hub rapportagecopy; Gate owner/date=—
- [x] Engage heeft tenant-isolatie, campaign/poll/MOTM lifecycle en authoring.
  - Trace: Status=DONE; Implementation=forced-RLS campaign/options/votes/audit + guarded Control authoring; Evidence=pgTAP 21, domain 2 en Control build; Gate owner/date=—
- [x] Engage publieke stemroute is mobile-first, toegankelijk en rate-limited.
  - Trace: Status=DONE; Implementation=publieke responsive route, HMAC-identiteit, cookie-idempotency en netwerkvenster; Evidence=identity unit 3 + pgTAP vote/RPC ACL + live browser/Axe 2/2; Gate owner/date=—
- [x] Engage QR/deeplink, realtime result, screen slide en final result werken.
  - Trace: Status=DONE; Implementation=immutable campaignbinding, bounded Player projection, lokale QR en responsive resultaatscene; Evidence=phase-10, 38/38 pgTAP en Player E2E; Gate owner/date=—
- [ ] Engage abuse/privacy/retention/analytics zijn gedocumenteerd en getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [x] Engage blijft flag/noindex totdat production gates groen zijn.
  - Trace: Status=DONE; Implementation=tenantflag default-off + marketing proposed-product noindex; Evidence=featureflag-RLS en marketing sitemapunit; Gate owner/date=—

## L. Native beheerapp

- [x] Native tokens/primitives matchen Vector-semantiek.
  - Trace: Status=DONE; Implementation=`packages/mobile-design-system` gebruikt gedeelde Vector-tokens en native primitives; Evidence=design-system lint/typecheck/3 tests + mobile canon; Gate owner/date=—
- [x] Today/aandacht, screens, make/upload, content en more zijn gemigreerd.
  - Trace: Status=DONE; Implementation=bestaande vijf-tab/rail native cockpit met tenantcache; Evidence=phase-9 audit + Android Hermes-export; Gate owner/date=—
- [x] Mobile Screen 360 en quick recovery zijn bruikbaar.
  - Trace: Status=DONE; Implementation=schermdetail met status/release en auditable reload/recover/cache/unpair commands; Evidence=mobile API/RLS + 9 mobile unit tests; Gate owner/date=—
- [x] Camera/QR/code pairing heeft permission/error/retry.
  - Trace: Status=DONE; Implementation=just-in-time Expo Camera, codeparser en guarded claim; Evidence=pairing unit + mobile RLS/release-evidence; Gate owner/date=—
- [x] Upload/camera processing en offline retry werken.
  - Trace: Status=DONE; Implementation=private filecopy, SQLite queue en servervalidatie; Evidence=upload retry unit + native architecture audit; Gate owner/date=—
- [x] Playlist edit/reorder/publish werkt met impact en confirm.
  - Trace: Status=DONE; Implementation=position-key mutation, expliciete pijlen/drag, targetpreflight en immutable publish RPC; Evidence=mobile unit + Publisher RLS regressie; Gate owner/date=—
- [x] Alerts/notifications en preferences werken.
  - Trace: Status=DONE; Implementation=opt-in pushdevice/preference endpoints en cockpit signalen; Evidence=notification unit + config/build; Gate owner/date=—
- [x] Engage operationele acties zijn doelgericht.
  - Trace: Status=DONE; Implementation=native start/close/public-link route + idempotente serverreceipt; Evidence=phase-9, Engage pgTAP 26/26; Gate owner/date=—
- [ ] Billingstatus deeplinkt veilig naar webcheckout/portal.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [x] Biometrics/session/account deletion blijven correct.
  - Trace: Status=DONE; Implementation=SecureStore app-lock/session, tenantcachepurge en auditable deletion intake; Evidence=mobile security/release-evidence + build; Gate owner/date=—
- [ ] iOS/Android VoiceOver/TalkBack en real-device viewports zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [x] Geen vrije desktop-Studio is als mini-canvas op mobiel gebouwd.
  - Trace: Status=DONE; Implementation=operationele native journeys zonder DOM/WebView/canvaseditor; Evidence=mobile package-importaudit + phase-9; Gate owner/date=—

## M. Player, pairing en casting shells

- [x] Splash/boot is branded, snel en reduced-motion compatible.
  - Trace: Status=DONE; Implementation=bestaande locked Player setupscene en motionmediaquery; Evidence=pairing/motion Playerregressies; Gate owner/date=—
- [x] Install, pair, claim, wait, sync, download, verify, switch, ready en play zijn distinct.
  - Trace: Status=DONE; Implementation=Player runtime state machine, heartbeat en atomic cache; Evidence=158 unit + Player browser/offline; Gate owner/date=—
- [x] Pairing ondersteunt code en QR/deeplink met tekstalternatief.
  - Trace: Status=DONE; Implementation=lokale pairing-QR, `/mobile/pair` en guided Control-prefill; Evidence=QR unit + pairing E2E; Gate owner/date=—
- [x] Pairingcodes zijn bounded, expireerbaar en device secrets blijven verborgen.
  - Trace: Status=DONE; Implementation=bestaand rate/expiry/idempotencycontract; QR bevat uitsluitend public code; Evidence=pairing unit/browser/RLS; Gate owner/date=—
- [x] Geen-content/wait-release/download/offline/error tonen passende informatie en actie.
  - Trace: Status=DONE; Implementation=distinct runtime panels en recoverymenu; Evidence=Player unit/browser; Gate owner/date=—
- [x] LKG blijft lokaal spelen bij netwerkverlies.
  - Trace: Status=DONE; Implementation=checksumcache + active/previous release; Evidence=offline 7/7 en phase-10 integration fallback; Gate owner/date=—
- [x] Storagepressure en corrupte download herstellen veilig.
  - Trace: Status=DONE; Implementation=reservepreflight, pending verify en active-safe GC; Evidence=cacheunit en offline corrupt-asset E2E; Gate owner/date=—
- [x] Diagnostics lekken niet publiek tijdens normale playback.
  - Trace: Status=DONE; Implementation=hidden diagnostics en secondary recovery; Evidence=Player presentation E2E; Gate owner/date=—
- [x] Android PWA en native Android/TV/Google TV shell delen hosted Playercontract.
  - Trace: Status=DONE; Implementation=`apps/android-tv` host uitsluitend de hosted Player; Evidence=bestaande shell/unit/buildcontracts + phase-10 audit; Gate owner/date=fysieke Play/hardwareacceptatie extern
- [x] LG route/shell blijft compatibel; fysieke claim blijft extern tot getest.
  - Trace: Status=DONE; Implementation=modern LG + legacy fallback negeren online metadata veilig; Evidence=Player build webOS6-guard, legacy tests en fallbackcontract; Gate owner/date=Player owner fysieke gate
- [ ] Touch, keyboard, D-pad, focus, immersive fullscreen en restart zijn getest.
  - Trace: Status=TODO; Implementation=—; Evidence=—; Gate owner/date=—
- [x] 16:9 en 9:16 templates/playerstates zijn afstandsleesbaar.
  - Trace: Status=DONE; Implementation=responsive Player/setup/dynamic renderers inclusief Engage; Evidence=Player visual matrices en phase-10 E2E; Gate owner/date=fysieke schermreadback extern
- [x] Nieuwe release schakelt pas na verify en veilige grens.
  - Trace: Status=DONE; Implementation=pending cache, checksumverify en loop-boundary switch; Evidence=offline/periodic manifest tests; Gate owner/date=—

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
