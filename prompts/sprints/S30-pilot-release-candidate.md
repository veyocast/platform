# S30 - Pilot validation en release candidate

## Doel

Neem een formele GO/NO-GO op basis van volledige live journeys, fysieke LG,
24-uurs reliability, security, accessibility en disaster recovery.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S30
- pilot checklist/runbook/evidence, launch gates en LG protocol

## Scope

- platform MFA -> tenant/invite -> media/video -> playlist -> preflight ->
  release -> screen/pairing -> online/offline playback;
- 24-uurs mixed-media en workerqueue soak;
- netwerkverlies, restart, power cycle, corrupt pending en quota;
- end-to-end security, WCAG en capacitybaseline;
- restore/rollback en exact hardwareprofiel;
- RC-dossier met SHA/digests, evidence, owners en known limitations.

## Acceptatie

- geen critical/high securityfinding open;
- geen zwart scherm zolang geldige current release bestaat;
- minimaal één exact LG-profiel doorstaat power cycle;
- staging/production artifact en rollback zijn aantoonbaar;
- iedere gate is PASS of het resultaat is expliciet NO-GO.

## Non-goals

- nieuwe features toevoegen om een rode gate te omzeilen;
- tests of securitycriteria versoepelen.
