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
domain work starts. A parallel databasejob starts local Supabase, rebuilds het
schema uitsluitend uit migraties en voert alle RLS-isolatietests uit. Een
deployment kan daardoor pas automatisch naar staging nadat zowel foundation als
databasejob groen zijn.

## Later Gates

The workflow is intentionally small until the relevant capabilities exist.
Future sprint branches must extend CI when they introduce:

- Supabase migrations or RLS policies: `pnpm db:reset` and `pnpm test:rls`;
- UI workflows: Playwright and accessibility checks;
- player playback or offline behavior: player and offline reliability checks;
- release/deployment packaging: image build and deployment checks.

Do not mark those gates as optional once their feature surface exists.

## VPS deployments

`.github/workflows/deploy-vps.yml` deployt uitsluitend naar de GitHub
Environments `staging` en `production` op de aparte deployment-VPS. Een groene
`main`-run activeert staging automatisch; production is handmatig en hoort door
required reviewers beschermd te zijn. De job bouwt eerst alle images, voert een
Supabase migration dry-run en forward migration uit, activeert daarna de gekozen
Compose-stack en verifieert de publieke healthroutes op de exacte Git-SHA.

De bestaande dev-VPS is geen target van deze workflow. Configuratie, secrets,
runnerlabels en reverse-proxypoorten staan in
`docs/vps-environments-runbook.md`.
