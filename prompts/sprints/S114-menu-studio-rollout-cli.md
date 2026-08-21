# S114 — Menu Studio pilotrollout via gelockte CLI

## Aanleiding

De eerste production-rolloutrun van S113 stopte vóór de databaseaanroep omdat
de geharde production-runner geen los `psql`-commando bevat. Geen pilotflag is
door die run gewijzigd.

## Verplicht resultaat

- gebruik uitsluitend databasegereedschap dat via de bestaande workspace-lock
  reproduceerbaar is geïnstalleerd;
- behoud de actuele-main-SHA-, environment-, tenant-, volgorde- en auditchecks;
- maak migratiecheck, mutatie en readback atomisch, zodat een mislukte readback
  de volledige flagmutatie terugdraait;
- interpoleer geen ruwe workflowinput als SQL-syntax;
- voeg geen Data API-writepad en geen nieuwe runtimecredential toe;
- laat de bestaande S113-migratie en immutable releases ongemoeid.

## Gates

Valideer de exacte SQL-opdracht tegen de lokale Supabase-database, voer de
GitHub Actions- en workflow-securityvalidatie uit, merge via PR en deploy de
actuele main-SHA opnieuw naar staging en production voordat de pilot wordt
hervat.
