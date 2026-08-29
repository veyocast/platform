# CI Baseline

## Workflow

The baseline GitHub Actions workflow lives in
`.github/workflows/pr-gates.yml`.

It runs on:

- pull requests;
- an explicit manual dispatch for diagnosis.

Task-branch pushes and the merge push to `main` do not repeat this paid hosted
workflow. The self-hosted immutable deployment runs the same workspace gates
again before it can build and activate a release.

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

## Scoped gates

`.github/workflows/database-rls-gates.yml` starts only for pull requests that
change `supabase/**`, `packages/database/**` or the database workflow itself. It
starts local Supabase, rebuilds the schema exclusively from migrations and runs
all RLS-isolation tests. Control Mobile, Android Player and LG webOS use the
same path-scoped PR-only rule plus an explicit manual dispatch. Their expensive
native or packaging jobs are not repeated after merge: the protected release
workflows remain the source for actual distribution artifacts.

Superseded PR jobs are cancelled. Generic Control Mobile API, contracts and
database changes remain covered by the workspace lint, typecheck, unit and
build gates; only changes that can alter the native application trigger the
full Android AAB and 16 KB validation. Generic native CI retains small evidence
for three days and does not store its unreleased AAB.

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
stopt daar bij iedere gewone push. Production is uitsluitend bereikbaar via een
handmatige dispatch met `deploy_target=production`; ook dan wordt eerst staging
geverifieerd. Production bouwt niet opnieuw en verifieert de exacte staging
image-IDs vóór activatie.

`scripts/validate-github-actions.sh` voert naast actionlint een statische
deploymentsecuritycontrole uit. Die bewaakt `contents: read`, de afwezigheid van
pull-requestdeployments, `persist-credentials: false`, expliciete jobtokenauth
voor iedere remote Git-opdracht, de expliciete productionkeuze en de
main-/rollback-/stale-releaseguards.

De bestaande dev-VPS is geen target van deze workflow. Configuratie, secrets,
runnerlabels, poorten en runbooks staan in `docs/deployment/`.
