# S113 — Menu Studio pilot en enige nieuwe slideflow

## Opdracht

Lever Menu Studio v2 op voor pilottenant **Duindorp SV** en verwijder de oude
wizard als concurrerende manier om nieuwe dynamische slides te maken.

## Verplicht resultaat

- de Slides-pagina toont voor nieuwe inhoud uitsluitend `Menu Studio openen`;
- `/dashboard/slides/new` redirect server-side naar
  `/dashboard/slides/menu-studio/new`;
- bestaande legacy-slides, snapshots, playlistreleases en Player
  last-known-good blijven leesbaar en bewerkbaar;
- alle zes Menu Studio-capabilities kunnen voor exact één actieve pilottenant
  in de vastgelegde dependencyvolgorde worden geactiveerd;
- activatie staat los van de binaire deployment, gebruikt geen Data API-write
  en legt flag, waarde, GitHub-operator, reden en workflowrun vast in audit;
- de operationele functie is niet uitvoerbaar door `anon`, `authenticated` of
  `service_role` en de rolloutworkflow draait uitsluitend op `main` binnen de
  gekozen GitHub Environment;
- rollback volgt `player → publish → media/linked_groups → authoring → read`
  en muteert geen immutable release.

## Ownership

- `apps/control/app/(shell)/dashboard/slides/page.tsx`;
- `apps/control/app/(shell)/dashboard/slides/new/page.tsx`;
- `apps/control/next.config.mjs` voor de vroege HTTP-redirect;
- gerichte Control a11y-/E2E-tests;
- één additieve Supabase-migratie en één gerichte pgTAP-test;
- `.github/workflows/menu-studio-pilot-rollout.yml`;
- Menu Studio-runbook, S113-evidence en `TASK_LEDGER.md`.

## Gates en deployment

Voer minimaal fresh `db:reset`, volledige RLS, workspace lint/typecheck/test,
Control build, a11y, Chromium E2E, Player/offline en GitHub Actions-validatie
uit. Merge via PR, deploy dezelfde actuele `main`-SHA eerst naar staging en
daarna production. Activeer vervolgens Duindorp SV in zes afzonderlijke,
geauditeerde productionworkflowruns en verifieer na iedere stap de readback.
