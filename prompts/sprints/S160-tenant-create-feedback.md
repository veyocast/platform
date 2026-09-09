# S160 — Betrouwbare terugkoppeling bij verenigingsaanmaak

## Doel

Maak de platformflow voor het aanmaken van een vereniging zichtbaar en
herstelbaar, ook wanneer provisioning en uitnodigingsverzending enkele seconden
duren of de browser de uiteindelijke navigatierespons niet verwerkt.

## Scope

- Toon tijdens de serveractie een ondubbelzinnige laadstatus en blokkeer een
  dubbele submit.
- Toon na een uitzonderlijk lange wachttijd dat de opdracht mogelijk al is
  afgerond en laat de gebruiker eerst de definitieve lijststatus controleren.
- Plaats serverfouten binnen het fragmentdoel van de formulierroute.
- Vervang bij AAL1 de inerte submit door een directe actie naar de bestaande
  MFA-journey.
- Maak de dubbele headeractie ondergeschikt en benoem haar als navigatie naar
  het formulier.

## Grenzen

- De transactionele, idempotente provisioning-RPC blijft ongewijzigd.
- Capability-, AAL2-, RLS-, invitation- en auditgrenzen worden niet versoepeld.
- Geen database-, migratie-, Auth-template-, Player-, release- of
  last-known-good-wijziging.
- Hosted Supabase Auth URL-configuratie is een afzonderlijke operationele
  instelling en wordt niet door deze UI-correctie verhuld.

## Acceptatie

- De primaire knop meldt `Vereniging wordt aangemaakt…` zolang de serveractie
  loopt en kan dan niet opnieuw worden geactiveerd.
- Een langdurige request toont oorzaak/onzeker gevolg/herstel zonder te beweren
  dat provisioning is mislukt.
- Een bekende serverfout staat na de redirect zichtbaar boven het formulier.
- Een bevoegde AAL1-gebruiker krijgt `Tweestapsverificatie openen` in plaats van
  een knop die zonder uitleg niets doet.
- Desktop en mobiel behouden de bestaande Control-hiërarchie en semantische
  kleur-/spacingtokens.

## Gates

- Control unit, lint, typecheck en build.
- Gerichte tenantbeheer-a11y- en Chromium-regressie.
- Workspace lint, typecheck, unit en build.
- Volledige a11y- en Chromium-Controlgate vóór release.
- Diffcheck, credentialscan, PR/CI en exact-SHA stagingreadback.
