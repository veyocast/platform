# S35 - Billing en schermentitlements

## Entry gate

S30 heeft GO en pricing, BTW, trial, grace, cancellation, screen counting en
Mollie-contract zijn formeel besloten.

## Doel

Implementeer reconcileerbare abonnementen en server-side entitlements zonder
bestaande offline playback abrupt te beëindigen.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S35
- billing ADR/productbesluiten en security/privacycanon

## Scope

- plans, customers, subscriptions, events en entitlements met RLS;
- Mollie adapter, idempotente webhookingest en reconciliation;
- transparent screen usage, planstatus en portal/actions;
- grace policy voor nieuwe pairing/assignment versus existing playback;
- append-only financiële audit.

## Acceptatie

- replay, duplicate en out-of-order webhooks hebben één effect;
- reconciliation divergence is zichtbaar en herstelbaar;
- geen kaartdata/billingsecret opgeslagen of gebundeld;
- entitlementrace en cross-tenant zijn getest;
- grace veroorzaakt geen offline zwart scherm;
- database-, security-, E2E- en foundationgates zijn groen.

## Stop en rapporteer

- wanneer financieel productgedrag niet expliciet besloten is;
- wanneer providerverificatie niet op officiële methoden kan steunen.
