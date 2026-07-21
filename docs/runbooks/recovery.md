# Runbook — backup, restore en rollback

## Doelen en verantwoordelijkheden

- Database-RPO: maximaal 24 uur; eigenaar Platform operations.
- Configuratie-RPO: iedere gecommitte image/config-revision; eigenaar Platform operations.
- RTO staging restore: vier uur; production service rollback: dertig minuten.
- Product support valideert na herstel tenantjourneys; Platform operations voert restore en imagepromotie uit.

## Restore

1. Gebruik uitsluitend een disposable, expliciet non-production doel.
2. Verifieer backup-SHA-256 en migration history voor restore.
3. Herstel database en gedeployde configuratierevision; injecteer secrets opnieuw vanuit het environment.
4. Draai database/RLS-, health- en kernjourneychecks.
5. Archiveer revision, backuphash, start/eindtijd en uitkomst; nooit database-URL of credentials.

## Rollback

Promoveer de vorige immutable image digest via de bestaande deploymentflow. Schemawijzigingen blijven expand/contract; destructieve downmigration is geen rollbackstrategie.
