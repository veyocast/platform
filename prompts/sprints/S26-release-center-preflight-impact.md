# S26 - Release Center, preflight en impact

## Doel

Maak immutable releasehistorie, wijzigingsimpact, schermgeschiktheid en guided
publish zichtbaar en bedienbaar.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S26
- playlist/release-, screen- en offline-playercanons

## Scope

- release list/detail en version comparison;
- expliciete reassignment van bestaande releases zonder mutatie;
- asset/playlist/release/screen impactgraph;
- preflight per scherm voor status, compatibility, missing bytes en storage;
- `/publish` journey boven echte drafts/releases;
- per-screen desired/download/verify/active voortgang.

## Acceptatie

- release rows en items blijven immutable;
- warning/blocked/unknown preflight is deterministisch en eerlijk;
- stale heartbeat geldt nooit als opslagbewijs;
- release diff heeft golden tests;
- volledige live multi-screen publishjourney en alle gates zijn groen.

## Stop en rapporteer

- wanneer preflight alleen haalbaar lijkt door playercache als live truth te
  behandelen;
- wanneer rollback releasehistorie zou muteren.
