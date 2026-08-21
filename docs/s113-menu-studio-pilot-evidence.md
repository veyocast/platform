# S113 Menu Studio pilotevidence

## Scope en invariant

Menu Studio is de enige zichtbare route voor nieuwe dynamische inhoud. De oude
URL redirect server-side, terwijl bestaande legacy-slides hun detailroute,
immutable snapshots, releases en Player last-known-good behouden.

Pilotactivatie blijft een afzonderlijke operationele handeling. Eén protected
GitHub Environment-run wijzigt exact één flag voor exact één unieke, actieve
tenantnaam. De database dwingt rollout- en rollbackafhankelijkheden af en de
operationele functie is niet beschikbaar voor Data API-rollen.

## Reproduceerbare verificatie

- `pnpm db:reset`
- `pnpm test:rls`
- `bash scripts/validate-github-actions.sh`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @veyocast/control build`
- `pnpm test:a11y`
- `pnpm test:e2e -- --project=chromium`
- `pnpm test:player`
- `pnpm test:player:offline`

De gerichte pgTAP-test bewijst daarnaast in 30 assertions de execute-ACL, input-
en tenantvalidatie, zesstaps rollout, auditmetadata, idempotency, dependency-
checks en volledige rollback.

Lokale resultaten op 22 augustus 2026:

- fresh database reset: groen;
- RLS: 51 bestanden, 1.021 assertions, alles groen;
- workspace lint, typecheck en unit: 30/30 packages groen;
- productionbuild: 18/18 packages groen;
- a11y: 35 groen, 1 expliciete live-Supabase-skip;
- Chromium E2E: 30 groen, 2 expliciete live-Supabase-skips;
- Player: 90/90 groen, inclusief Menu Studio-matrix en offlinegevallen;
- canonieke offlinegate: 7/7 groen;
- GitHub Actions/actionlint en workflow-securitycheck: groen.

Een eerste brede Chromium-run eindigde met een headless Chromium `SIGSEGV` in
een ongewijzigde lege-statecheck. Het betrokken bestand was daarvoor 3/3
groen; de volledige E2E-map is daarna serieel opnieuw uitgevoerd en eindigde
zonder retryfailure met 30 groen en 2 live-skips.

## Deployment en pilotreadback

Na merge wordt de actuele main-SHA door de bestaande releaseworkflow op staging
en production gedeployed. Daarna worden voor tenant `Duindorp SV` afzonderlijk
`read`, `authoring`, `linked_groups`, `media`, `publish` en `player` geactiveerd.
Iedere run verifieert de gedeployde SHA, past één mutatie toe, schrijft audit en
leest de flag terug. De workflow-URLs en uiteindelijke SHA worden na uitvoering
in de PR en eindrapportage vastgelegd; klantinhoud komt niet in logs of dit
document.
