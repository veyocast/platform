# ADR 0009 — Privacyveilige observability

## Status

Accepted als contract; productie-integratie volgt in S29.

## Context

Control, Player en media-worker hebben operationele events, maar nog geen
uniforme logger, correlationstrategie, SLO's en redactionboundary.

## Besluit

- Logs zijn gestructureerde JSON met timestamp, service, environment,
  revision, eventcode, severity en optionele request/correlation ID.
- Eventnamen zijn stabiel en labels hebben begrensde cardinaliteit.
- Tokens, cookies, authorization headers, signed URLs, database-URLs,
  service-rolewaarden, credentialfingerprints en raw klantmedia zijn verboden.
- Persoonsgegevens worden alleen gelogd na expliciete veldallowlist en
  bewaartermijnbesluit.
- Health, readiness, businessstatus en metrics zijn afzonderlijke contracts.
- User-facing errors bevatten een request-ID, geen interne details.
- Iedere productiealert heeft threshold, owner en runbook.

## Gevolgen

- `packages/observability` wordt in S29 toegevoegd;
- bestaande `console.*`-calls migreren wanneer hun flow wordt gewijzigd;
- secret/log leakage tests zijn verplicht voor worker, deployment en
  supportbundle;
- high-cardinality tenant/resource-ID's worden niet automatisch metriclabels.
