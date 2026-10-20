# S264 — Concrete CI-integratiefouten herstellen

Lees README, PLANS, ledger, technische/design/Publisher/security/offlinecanon en S244/S261/S263. De actuele gekozen Sync-interface blijft leidend.

## Ownership

- `apps/control/app/(shell)/dashboard/slides/sync-dynamic-editor.tsx`: uitsluitend de bevestigde save-request vernauwen met de bestaande strikte requestparser en canonicalDraft expliciet typeren.
- `tests/control/sync-led-controls.spec.ts`: bestaande native focuskleurassertie bijwerken naar de goedgekeurde S263-kleur; geometrie, contentpixels en overige asserts behouden.
- `tests/control/sync-platform-mobile-layout.spec.ts`: uitsluitend de eerder rootgereviewde S263-bronhash opnemen; overige beschermde hashes en layoutasserties behouden.
- `tests/control/sync-products-workflows.spec.ts`: de vier nieuwe prijsactie-exports expliciet weigeren in deze bestaande catalogusfixture; oude catalogusreads/availabilitycommands en asserts behouden.
- Eigen `docs/s264-ci-integration-corrections.md`, dit prompt en één eigen ledgerregel.

## Grenzen

Geen product-CSS, database, permissies, afhankelijkheden, lockfile, providers, publicaties of offlinegedrag wijzigen. Geen oude bewijzen herschrijven. Normale aparte branch/worktree/PR, daarna gewone S244-merge. De oorspronkelijke 92cc-CI blijft rood geregistreerd.

## Gates

Scoped lint en echte volledige Control-typecheck. De drie bestaande browserbestanden met één Chromiumworker zonder retries; native geometry/content-/commandasserties blijven geldig. Gecombineerde foundation/CI, a11y, finale builds/captures en vijf volledige visuele rondes horen bij S244 vóór deployment.
