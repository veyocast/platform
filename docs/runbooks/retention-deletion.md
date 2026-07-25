# Bewaartermijnen en verwijdering

## Veilige status

De database bevat een expliciet policyregister en een dagelijkse maintenance-run.
Alle voorgestelde termijnen beginnen bewust als `legal_review_required`.
Daardoor rapporteert de job wel aantallen, maar verwijdert zij niets voordat een
platform owner de termijn na juridisch akkoord als `automatic` markeert en
`RETENTION_ENFORCEMENT_ENABLED=true` in het production GitHub Environment zet.

Voorgestelde, nog te bekrachtigen termijnen:

| Gegevens | Voorstel | Uitvoering |
| --- | ---: | --- |
| Player-heartbeats | 30 dagen | Databasejob |
| Player-sync-events | 90 dagen | Databasejob |
| Auditlogs | 365 dagen | Databasejob na juridische toets |
| Serverlogs | maximaal 5 × 10 MB per container | Docker logrotatie |
| Verwijderde media | 30 dagen | Geblokkeerd tot referentie- en storageverwijdering atomair zijn |
| Onvoltooide uploads | 7 dagen na verlopen | Databasejob; objectopruiming apart bewaken |
| Supporttickets | 730 dagen na sluiten | Geblokkeerd tot juridische toets |
| Databaseback-ups | 35 dagen | Externe Supabase-/VPS-back-upconfiguratie |
| Storageback-ups | 35 dagen | Secundaire objectopslag |

De retentionjob draait via `.github/workflows/retention-maintenance.yml`. De
service-role key blijft uitsluitend een production secret. Elke run schrijft een
resultaat naar `retention_runs`.

## Formeel verwijderverzoek

Een tenant owner kan na AAL2 een tenantverzoek registreren; iedere gebruiker kan
een accountverzoek registreren. Verzoeken krijgen een uniek nummer en gaan eerst
naar juridische beoordeling. Alleen een platform owner met AAL2 kan de
beoordeling vastleggen.

Uitvoering van een volledige tenantcascade is bewust nog niet geautomatiseerd.
Voor goedkeuring moeten minimaal contract/factuurrecords, auditbewijs, open
tickets, immutable releases, storageobjecten en back-ups per categorie worden
geclassificeerd. Daarna komt een tweepersoons uitvoerjob met exportbewijs,
storageverwijdering en een controle achteraf. Tot die tijd mag status `executed`
niet handmatig worden gebruikt.

