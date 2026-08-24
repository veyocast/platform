# Vector v2 — fase 2 marketing-, prijs- en setupbewijs

Status: `DONE`
Datum: 24 augustus 2026

## Productwaarheid en informatiearchitectuur

De homepage positioneert VeyoCast als Living Venue OS met de bindende hero
`Elk scherm. Elk bericht. Elk moment.` en één operationele keten:
Create → Connect → Publish → Manage → Engage → Measure. De pagina verbindt
System Pulse, Studio/Publisher, beschikbare bronnen, Player-continuïteit,
mobiele bediening, eerlijke Engage-status en het prijsmoment zonder fictieve
klantlogo's of testimonials.

De integratie-index en detailroutes onderscheiden expliciet:

- Sportlink: beschikbaar via de bestaande sync-, sportslide- en
  snapshotarchitectuur;
- Twelve: normale `.xlsx`-export/import met mapping, validatie en preview,
  zonder live-API-claim;
- RSS/nieuws: beschikbaar met bron-, stale- en foutstatus;
- Sponsor Hub: beschikbaar volgens bestaande tenant- en approvalcontracten;
- YouTube en Engage: in voorbereiding en `noindex` tot hun productiegates
  groen zijn.

## Venue Setup Builder

`VenueSetupBuilder` ondersteunt drie organisatiecontexten, vier zones, 1–50
schermen, een doel per gebruikte zone en uitsluitend feitelijk beschikbare
modules. YouTube en Engage zijn zichtbaar maar disabled en gelabeld als
`In voorbereiding`. Desktop gebruikt kaart plus toegankelijke lijstfallback;
op 390 px wordt dezelfde state via een keyboardbedienbare driestappenflow
getoond. Touchcontrols gebruiken het gedeelde minimumtarget van 44 px en
reduced motion schakelt de microtransities uit.

Het resultaat toont zone-, bron- en schermtelling, 14 dagen gratis en een
maandbedrag op basis van integer cents. De demo-overdracht bevat geen
persoonsgegevens. De server valideert de invoer, herberekent telling en prijs,
tekent een 24-uurs HMAC-intent met domeinscheiding en valideert signature,
expiry en afgeleide velden opnieuw op route én formulieractie. Ontbrekend
secret of manipulatie geeft een herstelbare unavailable/invalid-state en geen
vals succes.

## Prijscontract

Het gedeelde domeincontract legt vast:

- `VEYOCAST_SCREEN_PRICE_GROSS_CENTS = 595`;
- `VEYOCAST_TRIAL_DURATION_HOURS = 336`;
- Nederlandse standaard-btw = 2.100 basispunten;
- alleen veilige gehele aantallen van 1–10.000 schermen.

De prijsroute gebruikt één calculator in plaats van fictieve pakketten. Alle
bedragen worden vanuit cents geformatteerd. Grensoverschrijdende fiscale
behandeling blijft een externe accountant-/juristgate en wordt niet als
afgerond gepresenteerd.

## Bewijs

| Gate | Resultaat |
| --- | --- |
| Domain lint/typecheck/build | PASS |
| Domain unit | 41/41 PASS, inclusief 3 billingtests |
| Marketing lint/typecheck | PASS |
| Marketing unit | 18/18 PASS |
| Marketing production build | PASS, 59 statische/dynamische routes |
| Homepage/setup E2E | 3/3 PASS tegen de gebouwde `next start`-artifact, inclusief mobiele stepper |
| Marketing route/SEO E2E | 7/7 PASS, inclusief alle live en voorgestelde detailroutes |
| Axe homepage | PASS, 0 violations na contrastcorrecties |
| Canonieke viewport/overflowmatrix | 19/19 captures PASS, inclusief desktopbuilder en drie mobiele stappen |
| Volledige workspace lint/typecheck/test/build | 30/30, 30/30, 30/30 en 18/18 PASS |

Reproduceerbare screenshots staan onder
`docs/screenshots/vector-v2/marketing/` voor home, prijs en demo op
1920×1080, 1440×900, 1280×800, 1024×768 en 390×844. De capture verbergt alleen
de Next.js developmentportal; product-UI en foutstates worden niet gemaskeerd.

## Externe gates

- Cross-border btw-, factuur- en incassocopy: accountant/jurist.
- YouTube officiële API/Terms/quota en productieadapter: productowner plus
  engineering releasegate.
- Engage privacy-/abuse-/productiegates: productowner, privacy owner en
  security/release owner.
- Live lead-deliveryprovider: productowner; tot configuratie wordt invoer niet
  gelogd/opgeslagen en meldt de UI eerlijk dat e-mail nodig is.
