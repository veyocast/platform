# Fase 11 — billing, Mollie en Player-entitlements

Datum: 24 augustus 2026  
Status: code/testmode gereed; live provider, legal en cohort zijn external gates

## Geleverd

- immutable plan/price, account/subscription, billable screenintervallen,
  usage-snapshot, invoice/lines, credit/reversalledger en audit;
- payment attempts, provider events, permanente semantic outbox,
  reconciliation, tijdgebonden overrides en D0/D1/D3/D6-notificaties;
- AAL2 tenantbillingportal en AAL2 platformhersteltool;
- server-only Mollie-adapter voor Customer, first/recurring Payment, mandate,
  classic webhook/readback, returnreadback en chargebackresource;
- exact 336 uur trial, 168 uur grace, net-new restriction en replacement zonder
  dubbele charge;
- Ed25519 device-scoped monotone entitlement met 168-uurs lease, clock-rollback,
  responsive gracechip, restricted-/verificationstate en intacte LKG-cache;
- afzonderlijke default-off cohortflags en veilige mobile billingdeeplink.

## Bewijs tot checkpoint

- verse pnpm db:reset: groen;
- gerichte billing pgTAP: 64/64 groen;
- volledige RLS: 59 bestanden, 1.262 assertions groen;
- domain: 10 bestanden, 54 tests groen (waarvan 10 billing-core);
- integrations: 7 bestanden, 57 tests groen (4 Mollie);
- Control: lint/typecheck en 42 bestanden, 188 tests groen;
- Player: lint/typecheck en 42 bestanden, 164 tests groen, inclusief echte
  Ed25519-sign/verify en mismatch-fail-closed;
- Control Mobile: typecheck groen;
- workspace lint 30/30, typecheck 30/30, tests 30/30 en build 18/18 groen;
- test/live mode mismatch, browserauthoriteit, webhookreadback, workersecret,
  cross-tenant RLS, replay, chargeback, dunning, override en kill switch zijn
  geautomatiseerd afgedekt.

Volledige workspacebuild, RLS-suite, Playwright/visual en deploymentbewijs
worden in fase 12–14 aan dit checkpoint toegevoegd.

## Externe readback

Mollie test/live credentials, transactional-email relay, accountant/jurist en
productioncohort ontbreken bewust in broncode. Gebruik
docs/runbooks/billing-mollie-entitlements.md; zonder die readback blijven
collection en Player-enforcement uit en worden geen live claims gedaan.
