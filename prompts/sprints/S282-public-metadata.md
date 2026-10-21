# S282 — Publieke metadata na live-uitrol

De S244-release 5bdad4a708e74155fafbd1afeba6c88c790aca2f draait met geslaagde staging- en productiesmokes. De live-readback vond ontbrekende OG-afbeelding op de homepage en een productie-robotsregel die alles blokkeert.

## Ownership

- apps/marketing/app/_lib/site-config.ts
- apps/marketing/app/layout.tsx
- apps/marketing/app/page.tsx
- apps/marketing/app/[...slug]/page.tsx
- apps/marketing/app/privacy/page.tsx
- apps/marketing/app/data-verwijderen/page.tsx
- apps/marketing/app/blog/[slug]/page.tsx
- apps/marketing/app/cases/[slug]/page.tsx
- infra/production/Dockerfile
- tests/e2e/marketing-routes.spec.ts
- deze prompt, docs/s282-public-metadata.md en alleen de eigen nieuwe TASK_LEDGER.md-regel

## Grenzen en controles

Gebruik het bestaande goedgekeurde brand-hero-bestand ongewijzigd. Pas alleen headmetadata en de Marketing-buildomgeving aan. Geen zichtbare JSX, CSS, content, routes, contracten, database, Player, Control, dependencies, lockfile, workflows, runnerlabels of credentials veranderen. De Marketingimage bestaat alleen in de productiestack; staging blijft noindex. Bewaar oorspronkelijke live-fail en native baseline. Vereist: lint/typecheck/test, originele image-regressie op oude build, nieuwe productiebuild met robots-/metadata-readback en bestaande browsergates. Normale PR/main/staging/productieroute, zelfde immutable images per release. De vijf UI-reviews behouden hun expliciete grenzen; geen scenariostatus verhogen.
