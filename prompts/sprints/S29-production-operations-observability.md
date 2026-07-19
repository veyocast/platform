# S29 - Production operations, observability en recovery

## Doel

Deploy de media-worker production-grade en maak de volledige keten meetbaar,
alarmeerbaar en herstelbaar.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S29
- deploymentaudit, worker runbook, security- en deploymentcanons

## Scope

- apart least-privilege staging/production workerdeployment;
- immutable image, non-root, resources, tempstorage, readiness en drain;
- `packages/observability`, structured logs en correlation IDs;
- SLO's en alerts voor worker, screen sync, disk/TLS/deploy/backup;
- non-production restore- en rollbackdrill;
- capabilitygebonden allowlisted supportbundle.

## Acceptatie

- nieuwe MP4 wordt door de gedeployde worker ready;
- secrets, signed URLs en persoonsgegevens verschijnen niet in logs/bundles;
- iedere kritieke alert heeft threshold, owner en runbook;
- restore en image rollback zijn met evidence bewezen;
- workflow, shellcheck, Compose, security, soak en foundationgates zijn groen.

## Stop en rapporteer

- wanneer productiecredentials lokaal of in repository nodig lijken;
- wanneer runner/Dockerrechten moeten worden verruimd;
- wanneer herstel een destructieve downmigration vereist.
