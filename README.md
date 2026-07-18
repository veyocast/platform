# Castivo Platform

Castivo is a local-first MVP for a multi-tenant narrowcasting and ClubTV
platform. This repository starts from the Castivo Codex Build Pack and follows
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
`docs/design-tokens.md`. UI primitives live in `@castivo/ui`; see
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

S16 completes the normal Control authoring flow. Media now supports private
previews, search/filter, rename, safe archive and video retry. Playlists use live
tenant data for create/edit/reorder, item duration/fit/audio, a timed 16:9
preview, publish review, multi-screen immutable publication and release history.
Tenant admins can persist club, playback and screen defaults through an audited
server-side RPC. The opt-in live test now proves image and MP4 upload, real
FFmpeg H.264/AAC normalization, normal playlist publication, pairing and muted
mixed-media playback. See `docs/s16-control-authoring-evidence.md`.

The deployment kit from S15 remains the production route. Physical
model/firmware validation, production secrets/infrastructure and the 24-hour
soak remain required before an LG support claim.
