# FieldFlow rollout en rollback

## Principes

- Rollback is applicatie-/configuratiegestuurd en nooit een database-
  downmigration.
- Een gepubliceerde release, frozen snapshot of bestaande designversie wordt
  nooit aangepast of opnieuw uitgegeven om rollback te simuleren.
- Bij Playerfalen blijft de actieve last-known-good release staan; een pending
  FieldFlow-release wordt verwijderd of genegeerd, niet gedeeltelijk actief.
- RLS en server-side capabilities blijven tijdens iedere rollback actief.

## Per fase

| Fase | Voorwaarts | Rollback | Dataveiligheid |
|---|---|---|---|
| Tokens/shared UI | FieldFlow tokens en componenten activeren | root selector/alias terug naar vorige presentatie | geen datamutatie |
| Shell/IA | nieuwe groepen en canonieke routes | oude bronroutes tijdelijk als canoniek; redirects uitschakelen | routecontracten en audit blijven |
| Forms/wizards | shared controls en sequentiële flows | vorige component achter compatibele props | servervalidatie blijft leidend |
| Theme-schema | `fieldflow` additief toestaan en defaulten | applicatiedefault terug; kolom/constraint blijft forward-compatible | geen backfill/downmigration |
| Slide renderer | frozen `fieldflow` naar nieuwe renderer | alleen nieuwe theme-ref tijdelijk blokkeren; legacy branch behouden | bestaande releases byte-/rowgelijk |
| Mobile/native chrome | nieuwe JS/XML/CSS-presentatie | vorige appbundle/IPK/APK op immutable artifact | installation/device identity behouden |
| Staging | exacte merge-SHA-images deployen | officiële vorige SHA-images en migration-compatible app | digest- en migrationhistory-readback |
| Production | dezelfde stagingdigests promoveren | officiële `rollback`-workflow naar bekende groene SHA | geen schema-terugdraaiing |

## Stopcriteria

Stop vóór commit/push/promotie bij migrationconflict, RLS-failure,
service-role-lek, rode gate, logo-reconstructie, versimpeld offlinegedrag,
mutable release, onverwachte writerdiff, ontbrekende productioncredential of
beschermde approval. Leg oorzaak, gevolg, herstelactie en laatste veilige SHA
vast.

## Externe releaseblokkade op 2 september 2026

GitHub Actions eindigt vóór jobstart in `startup_failure` wegens accountbilling
of spending limit. Geen joblog of runnerpreflight kan daardoor bestaan. Deze
host heeft geen deploy-user, `/srv/apps/veyocast`, SSH-private key of
environmentsecrets. De veilige herstelactie is billing laten herstellen,
daarna de officiële workflow opnieuw dispatchen; handmatige bypass is verboden.
