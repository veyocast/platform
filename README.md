# VeyoCast Platform

VeyoCast is a local-first MVP for a multi-tenant narrowcasting and ClubTV
platform. This repository starts from the VeyoCast Codex Build Pack and follows
the canon in `AGENTS.md`, `PLANS.md`, `TASK_LEDGER.md` and `docs/`.

## Workspace

```text
apps/
  control/        Next.js App Router control plane
  player/         Next.js App Router player plane
  marketing/      Next.js App Router public site
  media-worker/   TypeScript media queue, Storage and FFmpeg worker
packages/
  config/         Shared local runtime constants
  database/       Shared database role/status contracts
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
uitgerold en pas na groene healthchecks en GitHub Environment-approval met exact
dezelfde image-digests naar production gepromoveerd. Caddy blijft op de host;
containers binden alleen op `127.0.0.1`. Zie `docs/deployment/`.

Development blijft op de bestaande dev-VPS. Staging en production hebben op de
andere VPS eigen Compose-projecten, runtimebestanden en Supabase-projecten.

Physical model/firmware validation and the 24-hour mixed-media soak remain
required before an LG support claim.
Approved VeyoCast logo and icon masters are also required before public launch;
the current SVGs are explicitly temporary development placeholders.

De uitgewerkte vervolgroadmap S20-S37 staat in
[`docs/canon-alignment-product-roadmap.md`](docs/canon-alignment-product-roadmap.md).
S20-S30 maken de bestaande kern veilig, samenhangend en pilotwaardig; S31-S37
plannen productiviteit, scheduling, integraties, commercialisatie en begrensde
research zonder deze launchbasis te omzeilen.
