# CI Baseline

## Workflow

The baseline GitHub Actions workflow lives in
`.github/workflows/pr-gates.yml`.

It runs on:

- pull requests;
- pushes to `main`;
- pushes to `veyocast/**` task branches.

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

`.github/workflows/deploy.yml` deployt uitsluitend na een push naar `main` of een
gecontroleerde handmatige dispatch. De workflow bouwt de actuele SHA-images één
keer, activeert staging na migration guards en lokale/publieke healthchecks en
laat production vervolgens op Environment-approval wachten. Production bouwt
niet opnieuw en verifieert de exacte staging image-IDs vóór activatie.

De bestaande dev-VPS is geen target van deze workflow. Configuratie, secrets,
runnerlabels, poorten en runbooks staan in `docs/deployment/`.
