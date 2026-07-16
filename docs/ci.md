# CI Baseline

## Workflow

The baseline GitHub Actions workflow lives in
`.github/workflows/pr-gates.yml`.

It runs on:

- pull requests;
- pushes to `main`;
- pushes to `castivo/**` task branches.

## Foundation Gates

The current required CI gates are:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These match the S00 local gates and keep the empty-repo foundation honest before
domain work starts.

## Later Gates

The workflow is intentionally small until the relevant capabilities exist.
Future sprint branches must extend CI when they introduce:

- Supabase migrations or RLS policies: `pnpm db:reset` and `pnpm test:rls`;
- UI workflows: Playwright and accessibility checks;
- player playback or offline behavior: player and offline reliability checks;
- release/deployment packaging: image build and deployment checks.

Do not mark those gates as optional once their feature surface exists.
