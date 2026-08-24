# ADR 0015 — Billingledger, Mollie en Player-entitlements

Status: accepted  
Datum: 2026-08-24

## Besluit

VeyoCast factureert variabele schermusage vanuit een eigen append-only ledger. De
provider is uitsluitend een betaalrail. Een billingaccount heeft één open
commerciële subscription, een immutable price version en tijdsintervallen per
logisch scherm. Een cycle bevriest usage en regels vóór een providercommand via
de transactionele outbox wordt aangeboden.

Mollie Customer + first payment/mandate + on-demand recurring Payments wordt
gebruikt; Mollie Subscriptions niet. De browserreturn is nooit autoritatief. De
classic webhook is alleen een wake-up hint en iedere statusovergang wordt met
een geauthenticeerde provider-GET gecontroleerd. Lokale semantic keys blijven
permanent, los van de tijdelijke provider-idempotencycache. Chargebacks worden
via het afzonderlijke chargebackresource gecontroleerd.

De Player ontvangt een device- en screen-gebonden Ed25519-envelop met monotone
revision en bounded lease. trialing/active speelt normaal, grace bewaart de
last-known-good content met een toegankelijke waarschuwing en restricted toont
een lokale VeyoCast-herstelstate zonder financiële persoonsgegevens. Cache en
immutable releases worden nooit door billing gewist of gemuteerd.

## Veiligheidsgrenzen

- bedragen zijn integer cents; prijs en btw worden per version bevroren;
- test/live keys, provider-ID's en ledgers worden hard gescheiden;
- tenantmutaties lopen via capability- en AAL2-commands; workers via een apart
  serversecret; service-role en signingkey komen nooit in een clientbundle;
- net-nieuwe billable activatie is bij restricted/suspended geblokkeerd, terwijl
  hardware replacement op hetzelfde logische scherm blijft werken;
- overrides zijn maximaal 31 dagen, AAL2, platform owner/admin, geaudit en
  produceren een nieuwe entitlementrevision;
- rolloutflags sturen engine, collection, warningchip en restriction splash
  afzonderlijk en verlenen geen autorisatie.

## Gevolgen

Financiële correcties zijn nieuwe credit/reversalregels. Terugdraaien gebeurt
met forward-fixes; schema-rollback verwijdert geen ledgerdata. Live collection,
mailbezorging en Player-enforcement blijven buiten een cohort uit totdat
Mollie-testmode, reconciliation, finance/legal en observability zijn afgetekend.
