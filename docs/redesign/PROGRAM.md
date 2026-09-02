# FieldFlow v3-programma

## Missie en status

S144 voert de complete FieldFlow-transformatie uit als één productprogramma:
alle zichtbare marketing-, auth-, Control-, Publisher-, Studio-, mobile-,
platform- en devicebeheeroppervlakken én de volledige slide-/Player-outputketen.
De twee aangeleverde prompts zijn complementair; de slideopdracht vult het in
de platformhandoff gereserveerde outputdomein expliciet in.

Status op 2 september 2026: implementatie en lokale acceptatie
`VERIFIED_LOCAL`; release `BLOCKED_EXTERNAL` op branch
`veyocast/s144-fieldflow-platform-redesign`, vanaf exact
`6fe477a332ab6565a6bb3205959ebfe7766e9a2c`. GitHub Actions kan wegens de
account-billing/spending limit geen job starten; productie is niet omzeild.

## Niet-onderhandelbare grenzen

- Locked VeyoCast-merkassets blijven bytegelijk. De primaire productactie
  blijft Electric Orange met Ink Black tekst.
- RLS default deny en server-side capabilities blijven de autoriteitsgrens.
- Een Player is een device/installation, nooit een menselijke Auth-user.
- Publicaties zijn immutable; historische releases en snapshots worden niet
  teruggevuld of herschreven.
- De Player activeert alleen volledig gedownloade en geverifieerde releases op
  een item- of loopgrens en behoudt last-known-good bij netwerk- of assetfalen.
- Raw foto- en videopixels veranderen niet door de slidevormgeving.
- Nieuwe en muteerbare slides tonen alleen `fieldflow`; tien historische
  theme-id's blijven verborgen rendercompatibiliteit.
- Geen fictieve klanten, resultaten, prijzen, providerclaims of nepacties.

## Nulmeting

| Onderdeel | Bewijs |
|---|---|
| Repository | lokale en remote `main` exact op auditbaseline; worktree schoon vóór S144 |
| Routes | Control 69 pagina's + 28 handlers, Marketing 52 vaste URL's, Control Mobile 18 schermen, Player 5 pagina's + 24 handlers |
| Ontwerplagen | Atelier Ivory, Vector en oudere route-CSS aanwezig; geen FieldFlow-token of -component bij start |
| Controls | Control bevat 177 raw buttons, 665 inputs, 196 selects, 23 textareas en 97 checkboxinputs; migratie wordt per domein bewezen |
| Slides | 64 vereiste coveragerijen; geen rij FieldFlow-compleet bij start; bestaande offline/LG-infrastructuur bruikbaar |
| Gates | lint/typecheck/test/build groen; db-reset en 69 pgTAP-bestanden/1.583 tests groen; a11y 36 groen + 1 fixture-skip; Player 116/116; offline 7/7 |
| Database advisor | geen security error; vijf reeds bestaande performancewaarschuwingen voor overlappende permissive SELECT-policies |
| Hosting | publieke staging/production health groen op baseline-SHA; nieuwe Actions-jobs extern geblokkeerd door GitHub Billing |

## Fasering

1. Governance, inventaris, inputprovenance en nulmeting.
2. Tokens, shared primitives, shells, informatiearchitectuur en redirects.
3. Marketing, auth/account, tenant- en platformroutes, alle forms/wizards.
4. Native mobile en devicebeheerchrome voor browser, Android en LG.
5. Themecompatibiliteit, frozen snapshot, assets en FieldFlow-slideprimitives.
6. Alle media-, menu-, nieuws-, sport-, LED-, Engage-, YouTube-, sponsor- en
   Studiofamilies in modern, statisch LG, preview, poster en fallback.
7. Database/RLS, coverage-, configtrace-, visual-, accessibility-, offline- en
   end-to-end bewijs.
8. Reviewbare commits, PR/merge en immutable staging→productionpromotie.

## Werkproducten

De CSV-ledgers in deze map zijn machineleesbare bronnen van waarheid. Een regel
is pas `COMPLETE` wanneer functionele parity, rol/capability, alle relevante
states, responsive gedrag, toegankelijkheid, visual QA, tests, redirect en
rollback aantoonbaar zijn. `EXTERNAL` is uitsluitend toegestaan voor echte
hardware, juridische goedkeuring, credentials of beschermde platformapproval.

## Release-realiteit

De opdracht autoriseert deployment. De officiële workflow blijft leidend en
mag niet worden omzeild. GitHub weigert op dit moment alle jobs vóór start door
een mislukte betaling of spending limit; de handmatige VPS-route mist op deze
host bewust deploy-user, SSH-sleutel en environmentsecrets. Implementatie,
lokale verificatie, push en PR gaan door. Deployment blijft `BLOCKED_EXTERNAL`
tot billing en de beschermde runtimepreflight slagen.
