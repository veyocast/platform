# S271 — Begrijpelijke abonnementsuitleg

De uitgebreide vergelijking met de oorspronkelijke Billing-prototypepagina
bevestigt de gekozen visuele opmaak, maar de echte tenantpagina toont nog
implementatiejargon over shadowmodus, cohorts, schema, enforcement,
reconciliation, outbox en billable intervallen. Maak uitsluitend die uitleg
begrijpelijk. De gebruiker heeft Mollie-inrichting uitgesteld; deze taak
activeert geen betalingen en verandert geen voorwaarden.

Root is de enige writer in eigen worktree/branch/PR op S244 (basis0f5a7397).
Exclusieve ownership: `apps/control/app/(shell)/dashboard/settings/billing/page.tsx`
(uitsluitend bestaande zichtbare tekst), dit prompt,
`docs/s271-billing-language.md`, eigen ledgerregel.

Prijs5,95,14dagen proefperiode, enums, predicates, queries, loadBilling,
permissions, actions, formulieren, invoernamen, toestemmingsvereiste, routes,
versies en providerstatuswaarden blijven bytegelijk. Geen CSS-, asset-,
SQL-, dependency-, provider-, facturatie- of Playerwijziging.

Controleer een exacte omkeerbare copydiff en de beschermde datalaad-/helperstaart,
scopedlint en normale CI. Geen nieuwe implementatiespiegeltest voor deze kleine
reversibele tekstcorrectie. Root kan actuele echte JSX/SSR met expliciete
gecontroleerde readmodellen gebruiken voor beeldcontrole; claim daarmee geen
nieuwe AAL2/Next-/provideracceptatie. Geen vijf-ronden- of uitrolclaim.

## Noodzakelijke bestaande selectormapping na CI-rood

De exacteCI opdd0f8677 gaf577PASS/1FAIL/629bestaandeSKIP in Control. Alleen tests/a11y/control-shell.spec.ts:596 zocht de inmiddels vervangen zichtbare status Shadowmodus. Ownership wordt vóór wijziging uitgebreid met precies die ene hasText-waarde naar Nog niet geactiveerd. Alle overige assertions, routeloop, mobiele overflowcheck, prijscheck, platformstatus, retries en timeouts blijven bytegelijk. Oorspronkelijke rode job118801084555/log blijft behouden. Geen product-/providerdelta; scopedlint en nieuwe normale exacte-head CI vereist.
