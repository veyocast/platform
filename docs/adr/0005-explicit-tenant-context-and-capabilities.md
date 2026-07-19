# ADR 0005 — Expliciete tenantcontext en capability-autorisatie

## Status

Accepted als doelarchitectuur; productintegratie volgt in S21.

## Context

Een gebruiker kan meerdere platform- en tenantmemberships hebben. De huidige
Control-sessie kiest nog impliciet de eerste tenantmembership en verschillende
serveractions onderhouden eigen rolsets. Dit is niet schaalbaar en maakt
tenantwissel, audit en permission review onnodig foutgevoelig.

## Besluit

- Tenantcontext wordt expliciet in de route opgenomen als tenant slug.
- De slug is uitsluitend navigatiecontext en nooit autorisatiebewijs.
- Iedere protected loader en mutation resolveert server-side tenant-ID,
  membership, tenantstatus en benodigde capability.
- Rollen blijven database-identiteit; capabilities zijn de application-level
  autorisatiecontracten.
- Platform- en tenantcapabilities blijven gescheiden.
- Navigatie mag dezelfde pure capabilitybeslissing gebruiken, maar server en
  RLS blijven autoritatief.
- Gevoelige platformcapabilities krijgen in S21 aanvullend een AAL2-gate.

## Gevolgen

- `packages/domain` beheert canonieke menselijke rollen en tenantstatussen.
- `packages/auth` beheert de exhaustieve rol-naar-capabilitymapping.
- `packages/database` re-exporteert identitytypes tijdelijk voor compatibiliteit.
- Contextwissel moet tenantgebonden clientstate en open mutatieforms resetten.
- Hostile slug/ID, ingetrokken membership en cross-tenant cache krijgen E2E-
  regressietests.

## Niet besloten in deze ADR

- de exacte MFA enrollment-UX;
- impersonation; platformgebruikers openen een tenant alleen via expliciete,
  geauditeerde contextselectie;
- billing-entitlements.
