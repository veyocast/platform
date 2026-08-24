# Vector v2 — fase 0 baselinebewijs

Auditdatum: 24 augustus 2026 (Europe/Amsterdam)

## Herkomst en release-identiteit

| Onderdeel | Waarde | Bewijs |
| --- | --- | --- |
| Repository | `veyocast/platform` | Git remote en repositorycanon |
| Werkbranch | `veyocast/s123-vector-v2-living-venue-os` | `git branch --show-current` |
| Start-SHA | `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c` | `git rev-parse HEAD` |
| `origin/main` bij start | `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c` | `git rev-parse origin/main` |
| Staging-SHA bij start | `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c` | publieke `/api/health`, status `ok` |
| Production Control-SHA bij start | `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c` | publieke `/api/health`, status `ok` |
| Production Player-SHA bij start | `a463cccaa94a6e877083d3c71e2a53f84ea4ff4c` | publieke `/api/health`, status `ok` |
| Afleverpakket SHA-256 | `2e4f88c4b65cf7c754aa6ec9556e129123c25d471e8f9dbbbbece6e3a4cd6553` | `sha256sum` vóór extractie |
| Node.js | `v24.18.0` | `node --version` |
| pnpm | `11.5.2` | `pnpm --version` |

De startbaseline was daarmee exact gelijk op `main`, staging en productie. Er is
geen afwijkende niet-gereproduceerde productiebuild als uitgangspunt gevonden.

## Repositorywaarheid

- 106 App Router `page.tsx`-/`route.ts`-bestanden in de huidige apps.
- 13 gedeelde workspacepackages onder `packages/`.
- 82 geordende Supabase-migraties; de laatste is
  `20260823190000_s122_dynamic_slide_versions.sql`.
- Bestaande echte domeinen omvatten Control, marketing, Player, Control Mobile,
  Studio, Publisher, Sportlink, Menu/Twelve XLSX, RSS, Sponsor Hub, immutable
  releases, offline last-known-good en dynamische snapshots.
- Nieuwe productdomeinen uit het afleverpakket zijn onder meer Venue Twin,
  Engage, YouTube en billing/Mollie/entitlements. Deze zijn daarom `PROPOSED_PRODUCT`
  en blijven achter de canonieke flags tot hun eigen releasegates groen zijn.

De volledige routemapping, capabilityclassificatie en migratierisico's staan in
[`../execution-plan.md`](../execution-plan.md).

## Baselinegates

| Gate | Resultaat | Opmerking |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile ongewijzigd |
| `pnpm lint` | PASS | 30/30 Turborepo-taken groen |
| `pnpm typecheck` | PASS | 30/30 Turborepo-taken groen |
| `pnpm test` | PASS | 30/30 Turborepo-taken groen |
| `pnpm build` | PASS | 18/18 buildtaken groen |
| `pnpm db:start` | PASS | Lokale Supabase gestart; credentials niet in bewijs opgenomen |
| `pnpm db:reset` | PASS | Alle 82 migraties plus seed opnieuw toegepast |
| `pnpm test:rls` | PASS | 54 bestanden, 1.083 assertions |
| `pnpm test:a11y` | PASS met 1 expliciete fixturegate | 35 tests groen; de live Menu Studio-test vereist de gedocumenteerde opt-in fixture |
| brede Chromium-regressie | RESOURCE-PRESSURE, vervolgens PASS | 152 tests groen; 7 failures onder maximale paralleliteit, alle 7 geïsoleerd met één worker groen |
| `pnpm test:player --project=chromium --workers=1` | PASS-equivalent, pristine eindrun vereist | Twee seriële runs leverden elk 94/95 groen; LG-LKG-locator en een pairing-devserverreload zijn aansluitend ieder geïsoleerd groen. De definitieve suite draait op een read-only releasecheckout. |
| `pnpm test:player:offline --project=chromium --workers=1` | PASS | 7/7 tests groen; LKG, corrupte pending asset, Range-cache en offline shell bewezen |
| `pnpm --filter @veyocast/tokens ...` | PASS | lint, typecheck en 5 tests groen na Vector-tokenimport |
| `pnpm --filter @veyocast/ui ...` | PASS | lint, typecheck en 17 tests groen na eerste Vector-primitives |

### Classificatie brede browserrun

De gecombineerde run startte 170 tests en belastte gelijktijdig meerdere Next.js
servers en grote visuele matrices. Zeven tests faalden door page crashes of
navigatietime-outs. Exact dezelfde zeven tests zijn aansluitend samen met
`--workers=1` uitgevoerd: **7/7 PASS**. Daarmee zijn deze failures geclassificeerd
als runner-resource-pressure, niet als reproduceerbare productregressie. De
definitieve CI-matrix blijft suites per domein uitvoeren en bewaart seriële
Player-/visual-gates waar browsergeheugen bepalend is.

### Bestaande conditionele a11y-test

`tests/a11y/menu-studio-v2-live.spec.ts` gebruikt een expliciete `test.skip`
wanneer de lokale Supabase-fixture niet is ingeschakeld. Dit is geen acceptabele
eindstatus voor de volledige Vector-DoD. Voor fase 14 wordt de fixture in de
release-evidencejob geactiveerd en moet deze test groen bewijs leveren.

## Locked assets

Het afleverpakket en de repository bevatten beide VeyoCast-logo-assets, maar de
bestanden zijn niet byte-identiek. De repositorycanon markeert de aanwezige
assets expliciet als door de merkeigenaar goedgekeurd en locked. Volgens de
prioriteitsvolgorde zijn de repositoryassets daarom behouden; er is geen logo
gereconstrueerd of stilzwijgend vervangen. Het pakket blijft visuele en
inhoudelijke richting geven voor niet-locked marketingbeelden.

## Baselineconclusie

De uitgangssituatie is reproduceerbaar, tenant-isolatie is lokaal bewezen en de
actuele immutable Player-/releasecontracten zijn aanwezig. Vector v2 wordt als
compatibele, gefaseerde uitbreiding gebouwd; geen big-bang themewissel en geen
mutatie van historische releases.
