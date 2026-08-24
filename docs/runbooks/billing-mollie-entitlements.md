# Runbook — billing, Mollie, dunning en Player-entitlements

## Scope en standaardstand

De migratie is expand-only. Nieuwe flags staan standaard uit. Voer nooit een
handmatige production-update uit; gebruik commands, workers en cohortflags.

Benodigde serversecrets:

- MOLLIE_API_KEY en exact passende BILLING_PROVIDER_MODE=test|live;
- BILLING_WORKER_SECRET voor interne workers;
- BILLING_EMAIL_DELIVERY_URL (HTTPS) en BILLING_EMAIL_DELIVERY_SECRET;
- PLAYER_ENTITLEMENT_PRIVATE_KEY_PEM, publiek gepinde
  NEXT_PUBLIC_PLAYER_ENTITLEMENT_PUBLIC_KEY en PLAYER_ENTITLEMENT_KEY_ID.

## Verificatie vóór rollout

    pnpm db:reset
    pnpm exec supabase test db supabase/tests/rls_s123_billing_entitlements.sql
    pnpm --filter @veyocast/domain test
    pnpm --filter @veyocast/integrations test
    pnpm --filter @veyocast/control test
    pnpm --filter @veyocast/player test

Controleer daarna in Mollie-testmode: Customer, first payment, geldig mandate,
recurring Payment, classic webhook, browserreturn, mislukte betaling,
chargebackresource en reconciliation. Browser- of webhookpayloads mogen geen
status schrijven zonder succesvolle provider-GET.

## Workerfrequentie

Roep met Authorization: Bearer BILLING_WORKER_SECRET aan:

- /api/internal/billing/outbox: continu/iedere minuut tot 204;
- /api/internal/billing/cycle: ieder uur; verwerkt expiry, D0/D1/D3/D6 en
  verschuldigde cycles;
- /api/internal/billing/notifications: iedere minuut tot 204;
- /api/internal/billing/reconcile: minimaal dagelijks en na providerincident.

Een workerfout blijft als retrybare status met foutcode en backoff staan. Geen
providerbody, key, e-mailadres of factuurdetail loggen.

## Gefaseerde flags

1. billing_engine_enabled: usage/ledger shadowcohort;
2. billing_collect_recurring: alleen na gezonde testmode/reconciliation;
3. billing_enforce_entitlements: gesigneerde entitlement is leidend;
4. billing_player_warning_chip: grace-waarschuwing;
5. billing_player_restriction_splash: restricted-splash.

Activeer per interne testtenant, daarna vrijwillige cohort. Vergroot nooit een
cohort bij open reconciliation-items, uitblijvende mail, Player-fouten of
finance/legal-gate.

## Incident en herstel

- Provider onbereikbaar: collection uit; entitlement-enforcement hoeft niet uit
  zolang leases geldig zijn. Laat LKG spelen.
- Foute entitlement/signature: Player toont neutrale verificatiestate. Roteer
  signingkey alleen met dual-compatible deployment en nieuwe key-id.
- Onterechte restrictie: platform owner/admin gebruikt AAL2 override in
  /platform/billing; motiveer, beperk tijd, herstel daarna de bronoorzaak.
- Betaling bevestigd: provider-GET schrijft nieuwe revision; Player herstelt bij
  sync zonder republish en zonder cachedelete.
- Divergentie: stop cohortuitbreiding, inspecteer reconciliation-item en Mollie
  readback, herstel via idempotent verified command/forward-fix.

Rollbackcriterium: login, Control, Player/LKG, tenantisolatie, migratie of actieve
playback faalt. Zet enforcement-/collectionflags uit en rollback de immutable
appartifact volgens deploymentrunbook; verwijder nooit ledger- of auditdata.

## Externe gates

Live key, live mandate, webhookconfiguratie, SMTP/transactional-email relay,
accountant/jurist en productiecohort vereisen de bevoegde eigenaar. Het exacte
bewijs is provider-dashboardreadback plus bovenstaande testflow en een gezonde
reconciliation-run zonder mismatch.
