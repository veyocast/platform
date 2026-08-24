# Vector v2 — fase 3 auth- en onboardingbewijs

Status: `DONE`
Datum: 24 augustus 2026

## Root cause en productbesluit

Een bevestigde gebruiker zonder platformrol of tenantlidmaatschap werd na een
geldige login direct uitgelogd. De enige tenantprovisioning-RPC vereiste
platformadmin plus AAL2, waardoor er geen echte trial-/self-servicejourney
bestond. De bestaande dashboardchecklist was afgeleid van resources, maar was
geen hervatbare onboardingstate.

De oplossing bewaart uitnodigingen en platformprovisioning ongewijzigd en voegt
één begrensd pad toe:

1. publieke signup met 12+ tekens, generieke respons en verplichte
   e-mailbevestiging;
2. server-side OTP-confirmatie via een Nederlandstalige mailtemplate;
3. exact één idempotente self-service tenantclaim per bevestigde, nog
   ongekoppelde gebruiker;
4. transactionele profile/tenant/owner-membership/settings/onboarding/audit;
5. hervatbare bronkeuze en voortgang afgeleid uit echte schermen, gekoppelde
   Players en immutable releases.

De AAL2-platformguard blijft gelden. Alleen een bevestigde gebruiker zonder
enige platform- of tenantscope kan de vaste launch-defaulttenant claimen;
directe tabelinserts blijven door grant plus RLS geweigerd. Signup verleent
zelf geen tenanttoegang.

## Implementatie

- `20260824160000_s123_tenant_onboarding.sql`: default-deny state, composite
  tenant/owner-FK, één-ownerclaim, tenant-safe selectpolicy en drie
  `SECURITY DEFINER`-RPC's met lege `search_path` en expliciete execute-ACL.
- `/register`, `/auth/confirm` en loginlanding: signup, bevestiging en doorsturen
  van een nog ongekoppelde sessie naar `/onboarding` zonder informatieve
  accountenumeratie.
- `/onboarding`: gedeelde Journey Shell voor organisatie, bronnen, scherm,
  pairing, eerste release en de eerlijke billingovergang. Het financiële
  account wordt pas in fase 11 geactiveerd.
- De uit marketing afkomstige 24-uurs setup-intent is naar `@veyocast/auth`
  verplaatst, wordt opnieuw geverifieerd en alleen als toegestane,
  persoonsvrije velden opgeslagen.
- Alle authoppervlakken gebruiken dezelfde tokenized Vector-authshell en locked
  logoasset.
- De Control-serviceworker herlaadt formulieren alleen nog na de expliciete
  gebruikersactie “Nu herladen”; eerste installatie wist geen invoer meer.

## Bewijs

| Gate | Resultaat |
| --- | --- |
| Verse database/migraties | PASS, volledige migration chain inclusief S123 forward-only toegepast |
| Gerichte onboarding-RLS | 20/20 PASS |
| Volledige RLS-suite | 55 bestanden, 1103 assertions PASS |
| Auth lint/typecheck/unit | PASS, 10/10 unit |
| Control lint/typecheck/unit | PASS, 177/177 unit inclusief onboardingcontract |
| Marketing lint/typecheck/unit | PASS, 18/18 unit inclusief gedeelde setup-intent |
| Control production build/authboundary/secretcheck | PASS |
| Marketing production build | PASS, 59 routes |
| Live signup→Mailpit→confirm→tenantclaim→bronnen E2E | PASS |
| Mobiele registratie 390×844 | PASS |
| Axe op ingelogde onboarding | PASS, 0 violations |

De live test gebruikt de geïsoleerde lokale Supabase/Mailpit-stack, een uniek
account en de echte productiebuild. Hij bewijst tevens dat de bevestigingsmail
de server-route gebruikt, dat de tenantclaim niet client-side wordt nagebootst
en dat de bronstap na reload bestaat.

## Visueel bewijs

- `docs/screenshots/vector-v2/auth/register-390x844.png`
- `docs/screenshots/vector-v2/auth/onboarding-sources-1440x900.png`

Beide captures bevatten uitsluitend synthetische data uit de geïsoleerde teststack. De resterende
canonieke authviewports worden in fase 13 als productfamiliebrede matrix
herhaald.

## Bewuste vervolggrens

De proefperiode start volgens canon pas na de eerste succesvolle billable
screen-activatie en acceptatie. Een immutable billingaccount, Mollie-mandate en
entitlementrevision bestaan nog niet; daarom labelt onboarding deze stap als
technisch gereed maar niet betaald. Die domeingrens hoort bij fase 11 en wordt
niet met een UI-vlag gefaket.
