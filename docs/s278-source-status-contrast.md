# S278 — Leesbare statuscopy en passende Sync-vlakken

De verjaardagstatistieken gebruikten de Source-tekstvariabele `--muted` als
achtergrond; tekst en vlak kwamen op2,64:1. Kleine beschikbaarheids-/bronlabels
waren3,74/4,25:1 en de geselecteerde lichte instellingencategorie4,324:1.
Behouden dark-status-, border- en schaduwrollen pasten bovendien nog niet bij
het vaste lichte Sync-palet.

Drie bestaande CSS-modules gebruiken nu de beschikbare Source-tekst-/vlakrol.
De plaatselijke adapter koppelt de ontbrekende status/border/schaduwrollen aan
bestaande vaste Source-rollen onder de donkere voorkeur. Drie benoemde kleine
UI-tekstrollen gebruiken hun bestaande leesbare tekst/accent/warning-on-surface.
De groene bijgewerktstatus blijft apart; uitsluitend de wachtstatus krijgt de
waarschuwingsvoorgrond. De bestaande platformfixture verandert alleen van
adapterhash: `33b6b6e7c37fbcf8d1a6ca3e4336f76531fdb8a176903e7f22319fd9beaf5744`.
Exacte inversecontrole bewijst alle vijf product-/fixturebestanden. Source,
roottokens, lockedassets, inhoudsrenderers, TSX, gegevens en writers blijven gelijk.

De echte gebouwde AAL2-CSS-tegenproef na explicieteS277-baseline heeft28 gevallen:
zeven bestaande routecontexten ×390/1440 ×licht/donker. Elke variant meet74
benoemde rollen; minimum4,704:1. Tekst, links, afmetingen, main-scrollgeometrie en
volledig stijlherstel zijn exact gelijk. Deze28 gevallen hebben56 nativePNG en
geen zichtbare inhoudscanvas; daaruit volgt geen canvaspixelclaim.
Bewijs: `eb4de161-ec20-48a9-bf6f-771e2a0b5fc8`,
`c8e22195-2382-4f3c-9c7d-13497ba1dbab`,
`7f154791-af99-414b-9869-c0cb4b41a747`,
`4efcfafe-478c-464a-b9a8-9819f81bd02e`.

Een afzonderlijke native tegenproef doorloopt alle36 echte handmatige wizards
naar Vormgeving en kiest via de bestaande UI zowel FieldFlow als OnzeTrots TV:
72 bestaande beginsituaties,144 native canvasPNG,1440/liggend, lokaal/onopgeslagen
met bewegingGeen. Alle72 inner-canvassen houden exact dezelfde gedecodeerde
pixels en afmetingen na de UI-CSS. Veel beginsituaties zijn eerlijk leeg;
dit bewijst niet iedere ingevulde of gekoppelde dataset. De24 toegevoegde
inherited aliassen hebben bovendien nul directe `var()`-referenties in de echte
SyncStaticView en zijn gegenereerde CSS. Bewijs:
`0eeeaf40-f60e-4bd6-a5f3-75e7b63194d9`.

Alle vijf overzichten met100 kandidaatbeelden zijn werkelijk bekeken.
Alle vijf browsercohorten sluiten nativeexit0 zonder errors, writes, cookies
of transportfouten; alle162 QA-/historie-/Storage-/Auth-/bron-/SDK-guards gelijk.
De bestaande platformfixture slaagt2/2 op390/1440 in5,367s,0skips/retries,
met groene ingebouwde aXechecks; bewijs `d6b52232-2945-4e49-a7c6-d9a7b4a3f35e`.
Dit fixturebewijs gebruikt echte async pagina’s/layout/CSS met gecontroleerde
readmodels/host/commandtransport. ScopedESLint is0 en alle SDK-aliassen verwijderd.

De eerste eigen herstel-/ontbrekende-context-/initialfocus-harnasfouten en de
echte lichte contrastFAIL blijven behouden. Correctieve proeven wachten binnen
hetzelfde budget op exact kleur én achtergrondherstel; assertions blijven intact.
De onderliggende runtimepair-outer eindigde143 zonder eigen closed-bestand.
Oorzaak onbekend; dit wordt geen0 genoemd. Afzonderlijke retirementcontrole
bevestigt lege exacte procesgroepen, idlequeue en ongewijzigd volledig normale
Next-/vorigeSDK-manifest. Alle afzonderlijke browserclosures zijn wel werkelijk0.

Basis is de bestaande gebouwde8e03 met explicieteS277/S278-CSS en echte
ongewijzigde CSS-moduleklassen. Geen nieuwe gecombineerde appbuild,
algemeneAA-/Source-demopixelpariteit-/hardware-/export-/vijf-ronden- of V1-claim.
ExacteCI, gecombineerde build, hele-matrixronden4–5 en normale uitrol blijven open.
