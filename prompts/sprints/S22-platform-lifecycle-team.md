# S22 - Platform lifecycle en tenantteam

## Doel

Maak provisioning, tenant lifecycle, limieten, platformrollen en tenantteam
volledig bedienbaar zonder handmatige Supabase-acties.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S22
- S20/S21 ADR's en contracts

## Scope

- transactionele/idempotente provisioning met owner invitation;
- tenantdetail, pause/reactivate/archive en schermlimiet;
- invitations list/send/resend/revoke/expire/accept;
- rolwijziging, toegang intrekken, laatste-owner en self-lockoutbescherming;
- gescheiden platformuserbeheer met AAL2;
- volledige privacyveilige audit-events.

## Acceptatie

- tenant kan worden overgedragen zonder platformadmin als automatische owner;
- invitation replay, wrong tenant/email en expiry zijn getest;
- limiet onder huidig gebruik faalt veilig;
- iedere mutatie heeft capability-, RLS- en auditbewijs;
- alle database-, E2E-, a11y- en foundationgates zijn groen.

## Stop en rapporteer

- wanneer mailprovidercredentials nodig zijn buiten authorized staging;
- wanneer provisioning niet atomisch/idempotent kan blijven.
