# Vector v2 — kwaliteit, regressie en release-evidence

Datum: 24 augustus 2026  
Baseline: `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c`  
Branch: `veyocast/s123-vector-v2-living-venue-os`

## Lokale releasegates

| Gate | Resultaat |
|---|---|
| `pnpm install --frozen-lockfile` | Groen; lockfile ongewijzigd |
| `pnpm lint` | Groen, 30/30 Turbo-taken |
| `pnpm typecheck` | Groen, 30/30 Turbo-taken |
| `pnpm test` | Groen, 30/30 Turbo-taken |
| `pnpm build` | Groen, 18/18 productie-buildtaken |
| `pnpm db:reset` | Groen op een lege lokale Supabase-stack |
| `pnpm test:rls` | Groen, 59 bestanden en 1.264 assertions |
| `pnpm test:player` | Groen, 97 tests |
| `pnpm test:player:offline` | Groen, 7 tests |
| `pnpm test:a11y` | 36 groen; 1 gedocumenteerde live-only suite conditioneel overgeslagen |
| `pnpm test:e2e -- --project=chromium` | 168 groen; 18 expliciete live/provider/hardware-opt-ins conditioneel overgeslagen |
| Lighthouse op marketing production build | Performance 94, accessibility 100, best practices 100; FCP 0,9 s, LCP 3,0 s, TBT 80 ms, CLS 0 |

De conditionele tests zijn niet uitgezet of gequarantined. Ze vereisen bewust
een echte lokale Supabase-state, providerfixture of fysiek apparaat en zijn
afzonderlijk geactiveerd waar dat lokaal kan. De live suites voor Menu/Twelve,
RSS, Media, Engage, onboarding, Venue Twin, Publisher en de pilotverticale zijn
alle groen. De pilot bewijst in 2,4 minuten: upload, Studio, playlist,
preflight/publicatie, pairing en geverifieerde playback.

## Traceability

| DoD-familie | Implementatiegrens | Bewijs |
|---|---|---|
| Governance, security en dependencies | `docs/adr`, `packages/auth`, `packages/config`, `packages/database`, `supabase/migrations` | frozen install, secret-boundarytests, security-diffscan en 1.264 RLS-assertions |
| Vector design system | `packages/tokens`, `packages/ui`, `packages/mobile-design-system`, app-shells | componenttests, Storybook-build in workspace, axe en light/dark captures |
| Accessibility, responsive en motion | shared primitives plus `tests/a11y` en `tests/e2e` | 36 axe/keyboardtests, 168 E2E, viewportmatrix en reduced-motionchecks |
| Marketing, SEO en journeys | `apps/marketing`, setup-intent in `packages/auth` | contentcanon-, sitemap-, claims- en browsertests; 5 viewports |
| Auth/onboarding | `apps/control/app/(auth)`, `/onboarding`, tenantclaim-RPC's | live signup/confirm/claim/reload en tenant-isolationtests |
| Control, screens en Venue Twin | Control shell, `screen-health.ts`, Venue-migratie/RPC's | live desktop/mobile flow, healthmatrix, 1.264 RLS-assertions |
| Media en resource picking | Media collections/actions en `packages/ui/src/components/resource-picker.tsx` | live upload/select/bulk/Axe en routecaptures |
| Studio en dynamische content | Studio, Menu/Twelve, Sportlink en RSS journeys | live Menu/Twelve/RSS tests, render/buildtests en portrait/landscape captures |
| Publisher en releases | playlisteditor, Journey publish, preflight en release compare | live immutable publishflow en Player LKG/offlinetests |
| Integraties en Engage | `packages/integrations`, Control APIs/UI, provider migrations | unit, live Engage voting/results, RSS en provider-boundarytests |
| Native beheer | `apps/control-mobile`, mobile API/contracts | native tests, Hermes Android-export, secret scan en safe-area states |
| Player/casting | `apps/player`, Android TV en LG shells | 97 Player-, 7 offlinetests, Google TV screenshots en compatibility-builds |
| Billing/entitlements | billingdomain, Mollie-adapter, ledger/outbox en signed Player entitlement | 64 gerichte billingtests, webhook/replay/reversal/propertytests en RLS |

## Visueel bewijs

- `docs/screenshots/atelier-ivory/final`: 64 actuele light/dark routecaptures.
- `docs/screenshots/vector-v2`: 40 journey- en critical-statecaptures.
- `apps/android-tv/play-tv/graphics/tv-screenshots`: 3 actuele 1920×1080 Playerstates.
- Kernroutes zijn gecontroleerd op 1920×1080, 1440×900, 1280×800,
  1024×768/768×1024 en 390×844; Player bovendien portrait via de bestaande
  1080×1920 contract- en snapshotset.

De suite faalt op browserconsole-errors, unhandled page errors, horizontale
overflow, ontbrekende headings/labels en ernstige axe-overtredingen. De
productiebundles slagen voor auth-, secret- en platformcompatibiliteitsguards.
De lokale Lighthouse-SEO-score (69) is niet als releaseclaim gebruikt: de
production build draait lokaal bewust met een non-production `noindex`-grens.
De indexeerbare route-, canonical-, sitemap- en robotscontracten zijn apart
door de marketingcanon- en E2E-tests bewezen.

## Externe gates

Alle lokaal uitvoerbare adapters, testmodi, fallbacks en protocollen zijn
gereed. Nog extern zijn uitsluitend: Mollie live-account/mandate en financiële
bevoegdheid; accountant/juridische goedkeuring; fysieke Android/Google TV- en
LG-acceptatie; een 24-uurs hardware-soak; en beschermde production-promotie.
Eigenaren en exacte protocollen staan in
`docs/vector-v2/execution-plan.md#externe-gates`.

## Releasepad

`.github/workflows/deploy.yml` is de enige release-ingang. Een merge van de
geteste commit naar `main` bouwt immutable images en deployt staging. Productie
wordt daarna handmatig gestart met exact dezelfde actuele `main`-SHA en
image-digests. SSH/git-pull/ad-hoc-SQL zijn uitgesloten. Health, smoke,
workflowlogs en errorobservatie worden vóór de productiepromotie teruggelezen.
