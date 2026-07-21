# S29-B–F evidence — observability, recovery en Control-rustslag

## Geleverd

- `@veyocast/observability` levert stabiele events, correlation IDs, JSON-logs,
  bounded labels en recursieve redactie van secrets, tokens, URLs,
  databaseconnecties, e-mailadressen en user agents.
- Liveness, readiness en businessstatus zijn afzonderlijke contracts; de
  media-worker gebruikt de structured logger zonder jobdetails als labels.
- Zes journey-SLO's en negen alertcontracten hebben drempel, duur, eigenaar,
  runbook en Control-deeplink. Fixtures bewijzen `>`, `<` en `>=`-gedrag.
- `/platform/system` toont uitsluitend het operationele contract en presenteert
  geen statische waarde als live telemetry.
- De supportbundle bevat via een expliciete allowlist alleen service, revision,
  environment, appversie, tijdvenster, redacted eventcodes en release-ID's.
  De server valideert `tenant.support.export` en audit de export vóór download.
- De staging recoveryworkflow weigert production, hetzelfde bron/doel en iedere
  restoredatabase zonder suffix `_restore_drill`. Evidence bevat alleen SHA,
  revision, tijden en aantallen. Application rollback heractiveert een bestaande
  immutable image en voert geen downmigration uit.
- Media, Playlists en Screens gebruiken dezelfde Radix-backed `FilterBar` met
  URLstate, reset, resultaatcontext en een sequentiële mobiele disclosure.

## Lokale verificatie

De volledige gate-uitkomst wordt bij afronding in `TASK_LEDGER.md` vastgelegd.
De statische recoverycontractcheck bewijst de fail-closed guards en
application-only rollback. Een echte restore overschrijft data en wordt daarom
uitsluitend handmatig in het beschermde GitHub Environment `staging` uitgevoerd.

## Open extern bewijs

- Voeg `SUPABASE_RESTORE_DRILL_DB_URL` aan het staging Environment toe.
- Dispatch `VeyoCast staging recovery drill` met `RESTORE_STAGING` en archiveer
  de automatisch geredigeerde job summary.
- Bevestig alertdelivery en paging in de uiteindelijk gekozen telemetrybackend;
  er wordt zonder zo'n backend geen live-alertstatus geclaimd.
