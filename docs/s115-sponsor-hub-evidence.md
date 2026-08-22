# S115 Sponsor Hub — verificatiebewijs

## Nulmeting

- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`: groen (30/30 lint, typecheck en test; 18/18 build).
- Fresh `pnpm db:reset && pnpm test:rls`: groen, 51 bestanden en 1.021 assertions.

## Implementatiebewijs

- Capabilities en custom sponsorcommissie: `packages/auth/src/capabilities.ts` en S115-migratie.
- Forced-RLS-domein, vier-ogen-goedkeuring, immutable plannen en PoP: `supabase/migrations/20260822001918_s115_sponsor_hub.sql`.
- Tenantisolatie, own-approval-denial, immutable ACL en idempotente device-events: `supabase/tests/rls_sponsor_hub.sql`.
- Control-werkplek en actiecentrum: `apps/control/app/(shell)/dashboard/sponsors`.
- Delivery-envelope, checksumcache, loopgrensactivatie en offline expiry: `apps/player/app/_lib/player-release-envelope.ts`, `player-cache.ts` en `player-sponsor.ts`.
- Zes semantische zones en Proof-of-Play-queue: `apps/player/app/_components/player-runtime.tsx`.

## Eindgates

- Fresh `pnpm db:reset && pnpm test:rls`: groen, 52 bestanden en 1.039 assertions.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: groen, 30/30 lint,
  typecheck en test en 18/18 productiebuilds.
- Gerichte pakketten: contracts 44, domain 31, auth 10, Control 167 en Player
  152 tests groen.
- `pnpm test:a11y`: 33 groen en 1 bewust overgeslagen; twee tests die tijdens
  een lokale Next.js-geheugenherstart uitvielen zijn aansluitend met één worker
  herhaald en beide groen.
- `pnpm test:e2e -- --project=chromium`: 141 groen in de parallelle pas; alle
  13 resource-uitvallers daarna groen met `--last-failed --workers=1`. De hele
  niet-player E2E-map is aanvullend serial gedraaid: 30 groen, 2 bewust
  overgeslagen omdat live credentials ontbreken.
- `pnpm test:player`: 90/90 groen.
- `pnpm test:player:offline`: 7/7 groen.
- Visuele inspectie: 1440 px desktop en 390 px mobiel. De mobiele grid is
  expliciet begrensd met `minmax(0, 1fr)`; documentbreedte 390/390 en alleen de
  tabnavigatie scrolt horizontaal.
- `git diff --check`: groen; geen lockfilewijziging.

CI-run en deployment-readbacks worden op de GitHub-release vastgelegd.
