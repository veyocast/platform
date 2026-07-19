# S36 - Optioneel advertentienetwerk en revenue share

## Entry gate

Juridisch/commercieel model, tenantconsent, measurementtaal, fraudebeleid en
revenueberekening zijn goedgekeurd. Een NO-GO is een geldig sprintresultaat.

## Doel

Maak optionele advertenties deterministisch, offline-safe, tenantgestuurd en
financieel auditeerbaar.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S36
- privacy-, billing-, release- en playercanons

## Scope

- campaigns, creatives, targeting, opt-in/exclusions en immutable allocations;
- release injection, nooit mutable live runtime ads;
- offline proof batches, dedupe en fraud controls;
- append-only revenue ledger en reconciliation;
- platform/advertiser/tenant UX zonder dark patterns;
- eerlijke proof-of-play wording zonder audienceclaim.

## Acceptatie

- deterministic allocation en tenant exclusions;
- replay/fabrication/clock skew/frequency cap tests;
- geen double count en ledger balanceert;
- offline playback blijft werken;
- privacy, legal, financial, RLS, E2E en playergates zijn groen.
