# S287 — gekoppelde slide na bronpreview kunnen opslaan

De gebruiker meldt op de productie-wizard voor Clubprogramma een geslaagde
Sportlink-preview maar een mislukte bronopdracht bij het maken van het ontwerp.
Herstel de echte aanvraagketen en verifieer die met dezelfde nieuwe
OnzeTrots-v9-configuratie. Bestaande toestemming voor commit, push en normale
staging-/productiepromotie blijft van toepassing.

Baseline: `87b30fa654d1361a80356e2f961b93f728af3560`.
Root is enige writer op `veyocast/s287-connected-create-recovery` in
`/home/codex/repos/castivo-s287`; één PR, geen gedeelde history rewrite.

## Ownership

- De directe Sync-wizard- en gekoppelde-slideacties, configuratie/bindinghelpers
  en hun gerichte unit-/browsertests, uitsluitend waar de gemelde fout dat
  vereist. Geen nieuwe vormgeving of rendererwijziging.
- Nieuwe forward-only migratie(s) voor de actieve gekoppelde-slideopslagketen
  en eigen SQL/RLS-regressies. Historische migraties en data blijven behouden.
- Eigen bewijsdocument `docs/s287-connected-create-recovery.md`, dit prompt,
  eigen regel in `TASK_LEDGER.md` en eigen aanvulling in `PLANS.md`.

## Gates en grenzen

1. Reproduceer de productieaanvraag met echte migraties en een bevoegde actor
   in een uitsluitend voor deze taak gemaakte lokale database.
2. Bewijs oorzaak en gerichte correctie, geslaagde opslag/receipt/herhaling,
   tenantisolatie, bronvalidatie en behoud van authoring/immutable publicatie.
3. Voer lint/typecheck/unit en toepasselijke database-/UI-gates uit, gevolgd
   door de ongewijzigde normale PR-gates.
4. Merge na groene checks; normale immutable staging en expliciete productie
   van dezelfde exacte main-SHA, met controle van de uitrol.

Geen bestaande database resetten, credentials uitlezen, RLS versoepelen,
dependency-/lockfilewijziging of Player/offlinewijziging. Uitgestelde fysieke
proeven en providerconfiguratie zijn geen onderdeel van dit herstel.
