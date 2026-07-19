# S32 - Schermgroepen, planning en dayparting

## Entry gate

S30 heeft GO en timezone/scheduleproductregels zijn expliciet besloten.

## Doel

Publiceer voorspelbaar naar schermgroepen en tijdvakken zonder immutable
releases of offlinegaranties te verzwakken.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S32
- release-, screen- en offline-playercanons

## Scope

- tenant-scoped groups en many-to-many screen membership;
- immutable resolved target snapshot per publish/schedule;
- timezone/DST-aware assignment schedules en eenvoudige dayparting;
- overlap/precedence/conflict UX;
- calendar/list en volgende wijziging per scherm;
- offline-safe scheduleboundary en last-known-good fallback.

## Acceptatie

- dezelfde inputs geven dezelfde assignmentuitkomst;
- groepswijziging muteert geen bestaand target snapshot;
- DST, clock skew, overlap en offline boundaries zijn getest;
- geen zwart scherm door verlopen/onbereikbare schedule;
- RLS, player, E2E, a11y en foundationgates zijn groen.

## Non-goals

- emergency broadcast;
- multi-zone layout engine.
