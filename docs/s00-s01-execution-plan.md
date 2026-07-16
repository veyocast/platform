# S00/S01 Execution Plan

## Current State

- Repository root: `D:\Codex\castivo\platform`
- Remote: `https://github.com/castivo/platform.git`
- Current branch: `castivo/s00-foundation`
- Remote repository is empty, so this branch creates the initial root commit.

## S00-A Foundation

Owner: `repo-agent`

Branch: `castivo/s00-foundation`

Path ownership:

- root package and workspace config;
- `apps/**` only for runtime skeletons;
- `packages/config/**`;
- `packages/testkit/**`;
- `docs/**`;
- `.codex/**`;
- `supabase/config.toml`.

Output:

- pnpm workspace;
- Turbo task graph;
- TypeScript and ESLint baseline;
- minimal Next.js App Router apps for control, player and marketing;
- minimal TypeScript media-worker workspace;
- local runtime docs and environment example.

Gates:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## S00-B CI Baseline

Owner: `ci-agent`

Branch: `castivo/s00-ci`

Start after S00-A is reviewed, because root scripts and lockfile are high-conflict
paths.

Path ownership:

- `.github/workflows/**`;
- root scripts only when the CI task explicitly needs them.

Gates:

- GitHub Actions lint/typecheck/test workflow;
- PR gate documentation.

## S01-A Design Tokens

Owner: `design-system-agent`

Branch: `castivo/s01-tokens`

Start after S00-A. May run before S00-B if it does not touch CI paths.

Path ownership:

- `packages/tokens/**`;
- `tokens/**`;
- Tailwind preset/config files required for tokens.

Gates:

- `pnpm tokens:build`;
- `pnpm lint`;
- `pnpm typecheck`.

## S01-B UI Primitives

Owner: `ui-agent`

Branch: `castivo/s01-ui-primitives`

Start after S01-A exposes usable tokens.

Path ownership:

- `packages/ui/**`;
- Storybook config for `@castivo/ui`;
- app imports only if needed for smoke usage.

Gates:

- Storybook build;
- unit tests;
- accessibility smoke checks.

## Parallel Tracks

Allowed after S00-A:

- S00-B CI and S01-A tokens may proceed in parallel if root package changes are
  serialized.
- S01-B waits for S01-A token outputs.
- S02 database/RLS waits for S00-A and must serialize all `supabase/migrations/**`
  changes through the DB owner.

Stop and report if root package files, lockfiles, migrations, generated types,
service-worker files or `packages/ui/src/index.ts` need concurrent edits.
