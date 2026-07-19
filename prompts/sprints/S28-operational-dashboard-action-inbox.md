# S28 - Operationeel dashboard en actie-inbox

## Doel

Maak Control een dagelijkse operationele werkplek met echte signalen, search,
onboarding en herstelroutes.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S28
- Design Canon en observabilityeventregels

## Scope

- Actie nodig, maximaal vier gedefinieerde KPI's en deep links;
- server-side signals voor offline/sync/processing/readiness/invitation/quota;
- severity, age, dedupe en herstelroute;
- tenant-/capability-scoped global resource search;
- derived onboardingchecklist;
- contextuele help per error/readiness reason.

## Acceptatie

- live build bevat geen fixtures/fake KPI's/fake notificaties;
- ieder signaal opent de relevante gefilterde resourcecontext;
- search lekt geen andere tenant/platformresource;
- onboarding komt uitsluitend uit echte resources;
- keyboard, mobile, axe, E2E en foundationgates zijn groen.

## Stop en rapporteer

- wanneer signalen gevoelige metadata zouden serialiseren;
- wanneer acknowledge echte onderliggende failures cosmetisch zou verbergen.
