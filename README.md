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

## Current Sprint

S18 moves the complete product, workspace packages, runtime namespaces,
deployment infrastructure, database defaults and design canon to VeyoCast.
Existing player identity and last-known-good storage are migrated in place so a
rebrand does not require re-pairing or discard offline playback. Existing seeded
database records receive the same forward migration. The GitHub organization
name remains unchanged.

The S17 deployment route remains active: development stays on the existing VPS,
while staging and production use separate Compose projects and Supabase projects
on the shared production VPS. See `docs/vps-environments-runbook.md`.

Physical model/firmware validation and the 24-hour mixed-media soak remain
required before an LG support claim.
Approved VeyoCast logo and icon masters are also required before public launch;
the current SVGs are explicitly temporary development placeholders.
