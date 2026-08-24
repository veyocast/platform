# Vector v2 — uitvoerings- en traceabilityplan

Status: `IN_PROGRESS`  
Auditdatum: 24 augustus 2026 (Europe/Amsterdam)  
Repository: `veyocast/platform`  
Branch: `veyocast/s123-vector-v2-living-venue-os`  
Baseline `main`: `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c`  
Afleverpakket SHA-256: `2e4f88c4b65cf7c754aa6ec9556e129123c25d471e8f9dbbbbece6e3a4cd6553`

## Bronnen en prioriteit

De repositorycanons, het volledige Vector-v2-afleverpakket en alle meegeleverde
beelden zijn vóór implementatie gecontroleerd. Bij conflicten gelden in deze
volgorde: security/privacy/RLS, immutable releases en Player-continuïteit,
actuele repositorywaarheid, billingcanon, Vector-designcanon en ten slotte de
showcases als niet-functionele art-directionreferentie.

## Feitelijke baseline

| Gebied | Huidige waarheid | Classificatie |
|---|---|---|
| Marketing | Next.js App Router met homepage, dynamische contentroutes, blog/cases en juridische routes | REDESIGN |
| Control | 51 page-routes plus server/API-grenzen voor tenant- en platformbeheer | REDESIGN |
| Player | Hosted Next.js Player, Android-host, LG-host/legacy en immutable LKG-releaseketen | REDESIGN |
| Native beheer | Expo/React Native-app met bearer API, SecureStore, SQLite-cache en uploadqueue | REDESIGN |
| Studio | Versioned document, revision guards, worker-rendering en normale media-output | CURRENT |
| Publisher | Drafts, preflight, immutable releases, planning, screen groups en syncstatus | CURRENT |
| Dynamische slides | Locked HTML/CSS-runtime plus checksum-PNG-fallback en versioned ontwerpconfiguratie | CURRENT |
| Sportlink | Server-only sync, teams/competities/poules, bulk-slides en providerassetcache | CURRENT |
| Twelve | Normale `.xlsx`-import, mapping, validatie en productcatalogus | CURRENT |
| RSS/nieuws | Veilige server-only feedverwerking, snapshots, QR en stale/foutgedrag | CURRENT |
| Sponsor Hub | Vier-ogen-campagnes, immutable plannen en Proof of Play | CURRENT |
| Unified Filter/Picker/Journey | Bestaande basiscomponenten, nog niet productfamiliebreed uniform | PROPOSED_UI |
| Venue Twin | Geen volledig tenantdatamodel of operationele Control-view | PROPOSED_PRODUCT |
| Engage | Geen publieke poll/MOTM-lifecycle met abuse- en privacygrens | PROPOSED_PRODUCT |
| YouTube | Geen officiële provideradapter of online-only Player/preflightcontract | PROPOSED_PRODUCT |
| Billing/Mollie | Roadmap/prompt aanwezig; geen immutable financieel ledger of entitlementruntime | PROPOSED_PRODUCT |
| Provider-, commerciële en hardwareclaims | Afhankelijk van contract, legal/accounting, credentials en fysieke apparaten | GATED |

De monorepo bevat 6 JavaScript-app-workspaces, 13 gedeelde packages, 106 gevonden App Router
page/API-routes en 82 bestaande forward-only Supabase-migraties. Nieuwe code
mag deze grenzen niet dupliceren.

## Relevante apps, packages en databronnen

- `apps/marketing`: publieke journey, SEO, pricing en setup-intent.
- `apps/control`: auth/onboarding, Control, Studio, Publisher, integraties,
  instellingen, platformbeheer en mobile API.
- `apps/control-mobile`: native operationele journeys; geen desktopcanvas.
- `apps/player`, `apps/android-tv`, `apps/lg-webos-signage`: één gedeeld
  release-/cache-/pairingcontract met platformspecifieke shells.
- `apps/media-worker`: media-, Studio-, dynamische-slide- en providerjobs.
- `packages/ui`, `packages/tokens`, `packages/mobile-design-system`: de enige
  gedeelde web/native design-systemgrenzen.
- `packages/contracts`, `packages/domain`, `packages/auth`,
  `packages/database`: frameworkvrije contracts, regels en capabilities.
- `packages/studio`, `packages/content-templates`, `packages/integrations`:
  authoring-, render- en providergrenzen.
- Supabase Auth/Postgres/Storage/Realtime: pooled multi-tenancy met default-deny
  RLS, private storage en server-side capabilitychecks.

## Contracten die niet mogen breken

1. Iedere tenanttabel heeft `tenant_id NOT NULL`, index, tenant-aware relaties,
   default-deny RLS en cross-tenanttests.
2. De browser krijgt nooit service-role-, Mollie-, provider- of signingsecrets.
3. Playlistreleases, Studio-revisies, slideversies, snapshots en financiële
   ledgerregels blijven immutable; herstel maakt een nieuw record.
4. De Player activeert pas na volledige download en verificatie en start zo
   mogelijk altijd de last-known-good release.
5. Oude clients, manifests, pairings, Studio-docs en caches blijven tijdens een
   incrementele rollout bruikbaar.
6. Dynamic providerdata vernieuwt snapshots, niet de ontwerpversie.
7. Flags sturen rollout en claims, maar verlenen nooit autorisatie.
8. Geld wordt uitsluitend als integer cents en tijd als expliciete UTC/
   tenant-timezonecontracten verwerkt.

## Migratierisico's

| Risico | Beheersing |
|---|---|
| Groot nieuw Venue Twin-/Engage-/billingdatamodel | Expand-only migraties, flags default-off, backfill vóór constraints, per tabel RLS/pgTAP |
| Oude en nieuwe clients naast elkaar | Versioned additive contracts en manifest-/API-contracttests |
| Financiële of auditdata bij rollback | Geen destructive downmigration; forward-fix en immutable ledger |
| Theme/shell-regressie bij brede restyle | Semantische aliases boven bestaande `--vc-*`, cohorten en visual goldens |
| Player blackout door entitlement- of releasefout | Gesigneerde monotone snapshots, bounded lease, LKG-cache intact en kill switch |
| Nieuwe providerassets/quota | Afzonderlijke private providercache; geen normale Media Library of tenantquota |

## Gefaseerde uitvoering

| Fase | Resultaat | Afhankelijkheid | Status |
|---|---|---|---|
| 0 | Baseline, route-/capabilitytruth, DoD-traceability en testharness | geen | DONE |
| 1 | Vector aliases, shared primitives, web/native/Player shells en compatibilitylaag | fase 0 | DONE |
| 2 | Marketing, SEO, Setup Builder, pricing/trial-intent | fase 1 | DONE |
| 3 | Auth en hervatbare onboarding | fase 1–2 | DONE |
| 4 | Dashboard, screens, Screen 360, health en Venue Twin | fase 1, schema/RLS | DONE |
| 5 | Media en Unified Resource Picker | fase 1 | DONE |
| 6 | Studio en dynamische slideflows | fase 1, 5 | DONE |
| 7 | Publisher, planning, preflight en releases | fase 1, 5–6 | DONE |
| 8 | Sportlink, Twelve, RSS, YouTube, Sponsor Hub en Engage | fase 4–7 | IN_PROGRESS |
| 9 | Native mobile | gedeelde contracts en fases 4–8 | TODO |
| 10 | Player, pairing, casting shells en fysieke signage states | contracts uit 7–9 | TODO |
| 11 | Billing/Mollie, entitlements en Player-enforcement | schema/RLS, 2–4, 10 | TODO |
| 12 | Accessibility, responsive, performance en observability hardening | alle productfasen | TODO |
| 13 | Volledige regressie, screenshots, soak/hardwaregates en docs | alle eerdere fasen | TODO |
| 14 | Immutable stagingrelease, verificatie en production-promotie | alle niet-externe DoD groen | TODO |

## Test- en screenshotmatrix

Per relevante fase draaien minimaal package-lint/typecheck/unit/build en daarna
workspace `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Schemawerk
vereist een verse `pnpm db:reset` en volledige `pnpm test:rls`. UI-werk vereist
component/Storybook, axe, keyboard en Playwright. Playerwerk vereist
`pnpm test:player` en `pnpm test:player:offline`; billing krijgt property-,
webhookvolgorde-, replay-, reconciliation- en entitlementtests.

Golden captures worden deterministisch gemaakt op 1920×1080, 1440×900,
1280×800, 1024×768 en 390×844; Player bovendien op 1920×1080 en 1080×1920.
Elke hoofdroutefamilie krijgt light/dark en loading/empty/error/forbidden waar
relevant. Screenshots bevatten uitsluitend privacyveilige, consistente data.

## Externe gates

| Gate | Eigenaar | Reden | Exact verificatiepad |
|---|---|---|---|
| Mollie live-account, mandate en webhook | Productowner + finance | Beschermde credentials en financiële bevoegdheid | Protected test/live environment, Mollie dashboardreadback en repository E2E/reconciliation-runbook |
| BTW/factuur/incasso en juridische copy | Accountant/jurist | Wettelijke goedkeuring | Documentreview van billingcanon plus ondertekend besluit in release-evidence |
| Sportlink/providerrechten | Productowner/provider | Contract en sandboxdata extern | Provider-sandbox sync + dataveldenmatrix + no-secret logs |
| Marketingklantbewijs/logo's | Productowner/klant | Toestemming en merkrecht | Consentregister met bron, datum en scope |
| Android/Google TV | Mobile/release owner | Play Console, signing en fysieke hardware | Exact internal-track artifact installeren; pairing/publish/recovery-matrix uitvoeren |
| LG webOS | Player/release owner | Fysiek ondersteund model vereist | `docs/player/lg-physical-test-protocol.md` op productie-IPK en 16:9/9:16 |
| 24-uurs mixed-media soak | Player/release owner | Langdurige fysieke betrouwbaarheid | Bestaand soakprotocol met memory/FPS/cache/errorlog en artifact-SHA |
| Production-promotie | Gemachtigde release owner | Protected environment/approval | `Deploy VeyoCast` op `main`, exact staging-geteste image-digests, daarna smoke/observability |

## Evidence en voortgang

De item-voor-itemstatus wordt bijgehouden in
`docs/vector-v2/definition-of-done.md`. Testlogs, screenshots, ADR's en
releasebewijs worden per fase onder `docs/vector-v2/evidence/` gekoppeld.
Een item wordt pas `DONE` na implementatie én readbackbewijs; hardware,
credentials of juridische besluiten krijgen uitsluitend `EXTERNAL_GATE`.

Fase 3 heeft publieke registratie, verplichte e-mailbevestiging, een
idempotente self-service tenantclaim, resumable Journey Shell en echte
scherm-/pairing-/releaseprogressie toegevoegd. De financiële activering blijft
bewust fase 11: onboarding toont daar geen fictieve betaalstatus. Zie
`docs/vector-v2/evidence/phase-3-auth-onboarding.md`.

Fase 4 heeft de default-off rolloutgrens, het tenantveilige Venue Twin-datamodel,
echte Screen Health-semantiek en de integratiepulse opgeleverd. Gerichte en
brede RLS-, workspace-, production-build-, Axe- en live browsergates zijn groen.
Zie `docs/vector-v2/evidence/phase-4-control-screens-venue.md`.

Fase 5 heeft collecties en geaudite bulkorganisatie aan de bestaande Media-
workspace toegevoegd, de gedeelde Resource Picker uitgebreid met bron- en
categoriezoeking plus multi-select, en die picker voor echte Venue Twin-
plattegronden hergebruikt. Een verse reset, 1.154 RLS-assertions, alle workspace-
gates en twee production-build-E2E's inclusief desktop/mobile Axe zijn groen.
Zie `docs/vector-v2/evidence/phase-5-media-resource-picker.md`.

Fase 6 heeft de gedeelde Journey Shell voor Menu, Sportlink en RSS, de weer
bereikbare echte RSS-authoringroute, gedeelde themekeuze, reduced-motion preview
en tenantveilige vrije bronvideo opgeleverd. De additive videoachtergrond wordt
previewed via signed URL, bevriest alleen config/variantprovenance in de
revision en composeert lokaal onder de RGBA-render zonder audio. Workspace,
build, verse reset, 1.160 RLS-assertions, zes demo-browserflows en echte
Supabase-RSS- en Twelve/Menu-flows zijn groen. Zie
`docs/vector-v2/evidence/phase-6-studio-dynamic.md`.

Fase 7 heeft de bestaande guarded/immutable Publisher-architectuur behouden en
de begeleide publicatie als echte vijfstaps Journey Shell opgeleverd. De vaste
impactkolom en per-target preflight maken risico en LKG-gedrag continu
zichtbaar. Release Center vergelijkt nu ook overgang, crop, achtergrond, label,
enabled-state, trim, volume en zichtvenster. Workspace/build, 1.160 RLS-
assertions en een echte Supabase publicatiejourney zijn groen. Zie
`docs/vector-v2/evidence/phase-7-publisher-releases.md`.
