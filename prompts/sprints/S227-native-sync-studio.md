# S227 · native Sync-beheer afronden

Vervolg binnen de expliciete opdracht om het volledige S226-startpakket uit te
voeren. Werk geïsoleerd vanaf S226; integreer pas na de getoetste S226-webrelease.
Lees dezelfde verplichte canons en het native overdrachtscontract. Geen oude
signingidentiteit voor Control veronderstellen; fysieke/storeacceptatie blijft
afzonderlijk. Bestaande v1/v2-responses en release-/device-identiteiten blijven.

Ownership in deze worktree:

- Root: `packages/studio/src/mobile-control-v3.ts`, bijbehorende tests/export,
  `apps/control/lib/mobile/studio-v3*`, `apps/control/app/api/mobile/v3/studio/**`,
  `apps/control/lib/mobile-api/context.ts` en de bijbehorende regressietest
  (na expliciete scope-report: stateless bearer-AAL wordt verkeerd gelezen),
  de expliciete workspace-dependency in `apps/control-mobile/package.json` en
  `pnpm-lock.yaml`, `execution/tools/native-*-acceptance.mts`, ledger en releasebewijzen.
- Agent `release_audit`: uitsluitend native bronbestanden onder
  `apps/control-mobile/app/**` en `apps/control-mobile/src/**` voor Source-navigatie,
  cockpit/header, Sync Studio, veilige draft/commandrecovery en media-overdracht.
  Geen package/lockfile-, shared package-, database- of workflowwijzigingen.
- Andere agents: uitsluitend review/CI-monitoring; geen wijzigingen.

Gebruik een aparte V3 Studio-route met volledig gevalideerde Sync-documenten,
bestaande tenant/rechten/MFA-grenzen en bestaande atomische RPCs. Geen lossy
omzetting naar Sites, nieuwe databasewriter of fake render-/publicatiesuccessen.
Herstel invoer tenantgebonden en behoud een onzekere opdracht exact. Root blijft
verantwoordelijk voor de S226-CI→staging→productieflow en de gesigneerde Players.

Aanvullende root-scope na concrete visuele scope-report: één semantische mobiele
Studio-labelselector in `scripts/build-sync-css.mjs` en zijn gegenereerde
`apps/control/app/sync-source.css`. Geen Sourcebaseline, tolerantie of nieuwe
layout; de toegankelijke span krijgt dezelfde bestaande labeltypografie.

Aanvullende root-scope na echte sponsorvier-ogenproef: alleen de approve-form
in `apps/control/app/(shell)/dashboard/sponsors/page.tsx` en nieuwe
`apps/control/app/api/sponsors/campaigns/approve/route.ts` met regressietest.
Native POST/303 hergebruikt de bestaande authenticated approval-RPC, bestaande
sessie-/tenant/capability/CSRF-grenzen; geen SQL-/rol-/workflowwijziging. De bestaande
ServerAction-weigering committeert niets maar haar Flightredirect werd niet
zichtbaar. Andere sponsorcommands blijven buiten deze correctie.

Dezelfde echte editor-Axeproef vond daarnaast de witte `Licht`-labeltekst op
de lichte achtergrondkeuze (contrast2,23). De rootgenerator mag uitsluitend
deze keuzetekst de bestaande locked Ink Black-token geven; oppervlak/layout
blijven gelijk, geen Sourcebaseline- of tolerantiewijziging.
