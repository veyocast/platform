# S179 — Standrijen koppelen aan echte catalogus-team-IDs

## Analyse vóór wijziging

Productie op S178: 14 van 15 standen gevuld; bekerpoules en jeugdfases correct,
32 poules en 361 wedstrijden succesvol gesynchroniseerd. De overgebleven stand
is zaterdag 35+1. Dezelfde bron heeft ook vrijdag 7×7 35+1: exact dezelfde naam,
maar verschillende teamcodes en poulecodes. De globale naamfallback faalt hier
bewust gesloten. Er is voldoende echte catalogusinformatie om ze via de poule
te onderscheiden.

`fetchStandings` haalt reeds de tenantgebonden `teams` en `poulelijst` op, maar
geeft de genormaliseerde teamcatalogus niet aan `mapSportlinkStandings`. De
mapper maakt daardoor altijd een naamhash als `poulestand.teamcode` ontbreekt.
De bestaande database accepteert een echte team-ID zonder naamambiguïteit.

## Plan / ownership

- `packages/integrations/src/sportlink-mappers.ts`: optionele eigen teamcatalogus
  aan de bestaande mapper. Alleen bij ontbrekende bron-teamcode koppelen via
  exacte naam en expliciet poulelidmaatschap. Eén unieke echte ID is verplicht;
  concurrerende of onbekende poulekoppelingen blijven ongekoppeld. Geen fuzzy
  namen, handmatige productielijst, nieuwe API of databasemodel.
- `apps/media-worker/src/sportlink-sync-runner.ts`: de reeds opgehaalde teams van
  dezelfde verbinding doorgeven bij competitiesynchronisatie. Geen extra APIcall.
- Tests: `packages/integrations/test/sportlink.test.ts`,
  `apps/media-worker/test/sportlink-sync-runner.test.ts`.
- Docs: dit promptbestand, `docs/integrations/dynamic-slide-management.md`,
  `TASK_LEDGER.md`. Geen UI-, Player-, schema-, RLS- of dependencywijziging.

## Verificatie

Gerichte mapper-/workerregressie: gelijke namen in verschillende poules, echte
bron-ID behouden, ambiguïteit binnen dezelfde poule, ontbrekende catalogus,
onbekend poulelidmaatschap, tegenstanders en gescheiden catalogusbatches.
Workspace lint/typecheck/test/build; bestaande RLS herhalen om de verwerking
van echte IDs te bevestigen. Commit/PR/CI, bestaande staging-productieflow en
readback van de echte zaterdag 35+1-stand na de normale volgende sync.

S178 is al succesvol op productie uitgerold via PR #203. Deze wijziging bouwt
verder op de werkende snelle synchronisatie; immutable snapshots/releases en
Player LKG veranderen uitsluitend via de bestaande publicatieketen.
