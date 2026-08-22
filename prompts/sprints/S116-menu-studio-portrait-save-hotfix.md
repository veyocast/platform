# S116 — Menu Studio portrait save hotfix

## Doel

Zorg dat de in Menu Studio gekozen schermstand niet alleen de preview wijzigt,
maar ook het opgeslagen concept, het gekozen gepubliceerde template en de
volgende immutable snapshot bepaalt.

## Invarianten

- Nieuwe staande concepten worden met een gepubliceerd portraittemplate gemaakt.
- Een bestaand v2-concept kan revision-aware tussen liggend en staand wisselen.
- De oriëntatieopdracht is tenantgebonden, capability-checked en idempotent.
- Directe browserwrites, cross-tenantmutaties en stale revisions blijven geweigerd.
- Bestaande snapshots en releases worden niet herschreven; herpublicatie blijft expliciet.
- Player- en offlinecontracten blijven ongewijzigd.

## Acceptatie

- De editor opent op de werkelijk opgeslagen oriëntatie.
- `Concept opslaan` gebruikt het template van de actieve oriëntatie.
- Omschakelen in een bestaand concept bewaart oriëntatie, template en documentrevision atomisch.
- Control unit-, type-, lint- en buildgates zijn groen.
- Een verse database-reset en de volledige RLS-suite zijn groen.
- Staging en productie rapporteren exact dezelfde release-SHA.
