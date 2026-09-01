# S143 — LED Scores mobiele media- en logokiezer

## Doel

Herstel de LED Scores-wizard zodat de volledige Media-stap tussen 320 en 768 px
zonder horizontale overflow bedienbaar blijft en het veld `Clublogo` uitsluitend
doelgerichte tenantlogo's aanbiedt. Gegenereerde slides, providertechniek en
willekeurige bibliotheekmedia mogen niet als nieuw clublogo worden gekozen.

## Ownership

- LED Scores Control-page, wizard, actions, routespecifieke CSS en tests;
- het pure LED Scores-mediabeleid;
- LED Scores canvasdocumentatie en Task Ledger;
- geen schema-, Player-, release- of lockfilewijziging.

## UX-contract

- vanaf maximaal 48 rem toont de wizardnavigatie één actieve stap met de
  bestaande vorige/volgende-acties als sequentiële mobiele flow;
- ieder label en ieder tekst-, datum-, nummer- en selectieveld heeft een
  begrensde inline-afmeting, minimaal 44 px hoogte en veroorzaakt geen
  horizontale paginascroll;
- `Clublogo` bevat alleen het logo uit de tenanthuisstijl en logo's van actieve
  clubkoppelingen;
- visuele fallbacks en MP4-keuzes komen alleen uit gereedstaande uploads met
  `source_kind = user`;
- een reeds opgeslagen technische referentie blijft als expliciete huidige
  keuze hydrateerbaar, maar wordt niet aan nieuwe configuraties aangeboden.

## Security- en datagrens

- iedere query blijft expliciet tenantgescoped en onder bestaande RLS;
- de primaire menselijke mediacatalogus filtert server-side op
  `source_kind = user`, ready en niet verwijderd;
- de serveraction controleert iedere legacy mediaslot opnieuw op tenant,
  status, bron, MIME en doel; het logo moet daarnaast de actuele huisstijl- of
  clubreferentie zijn;
- alleen een exact ongewijzigde waarde uit hetzelfde bestaande alertconcept
  mag als legacycompatibiliteit worden behouden;
- immutable alertversies, canvasassetvalidatie en Player/LKG blijven
  ongewijzigd.

## Gates

Gerichte mediabeleids- en wizardcontracttests; Control lint, typecheck, test en
build; workspace lint/typecheck/test; Control a11y en Chromium; immutable
VPS-build, stagingreadback en promotie van exact dezelfde images naar productie.

## Lokale verificatie

- mediabeleid: 4/4;
- Control: 55 suites en 295 tests;
- workspace lint, typecheck en test: 30/30 taken;
- Control productionbuild inclusief auth- en secretgrenzen: groen;
- a11y: 36 groen en 1 bewuste fixture-skip;
- Chromium: 188 groen en 21 bewuste live/visual-evidence-skips. Twee navigaties
  liepen in de volledige 21,4-minutenrun vast na een Next.js memory-restart;
  dezelfde twee bestanden waren daarna op verse servers 7/7 groen;
- de gerichte mobiele browsercase is groen op 320, 390, 591 en 768 px.
