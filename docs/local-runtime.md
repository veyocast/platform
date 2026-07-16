# Local Runtime

## Validated Tools

Validated on 2026-07-16:

| Tool | Version |
|---|---|
| Git | 2.49.0.windows.1 |
| Node.js | 24.18.0 |
| pnpm | 11.5.2 |
| Docker | 29.6.1 |
| Supabase CLI | 2.95.4 |
| WSL | 2.7.10.0 |
| FFmpeg | not found on PATH |

Supabase CLI reported that a newer version is available. This is not a current
S00 blocker, but DB/RLS work should re-check CLI compatibility before S02.
FFmpeg is required before media-processing work starts in S04.

## Ports

| Service | Port |
|---|---:|
| Control | 3000 |
| Player | 3001 |
| Marketing | 3002 |
| Media worker | 3100 |
| Supabase API | 54321 |
| Postgres | 54322 |
| Supabase Studio | 54323 |

## Baseline Gates

S00 baseline:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

The workspace allowlists the required native build steps for `esbuild` and
`sharp` in `pnpm-workspace.yaml`, so `pnpm install` does not require interactive
build approval.

Database gates are defined now but become mandatory when migrations or RLS
policies land:

```bash
pnpm db:start
pnpm db:reset
pnpm test:rls
```
