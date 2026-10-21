# S283 — Zichtbare bronstatus bij cosmetische filters

De Bronnen-pagina kon aantallen verbonden bronnen tonen terwijl de kaarten,
filterknoppen en toelichting onzichtbaar waren. EasyList publiceert generieke
cosmetische regels voor `.ad-source`, `.ad-tabs` en `.ad-notice`; precies die
drie presentatienamen werden voor normale beheeronderdelen gebruikt. De
daadwerkelijke Chrome-instellingen van de gebruiker zijn onbekend.

## Wijziging

Alleen de drie betrokken onderdelen van `SourcesOverview` gebruiken nu lokale
CSS-moduleklassen. De bestaande Sync-declaraties, mediaquery op 600px en
reduced-motionbehandeling zijn lokaal overgenomen. De oorspronkelijke globale
Sync-CSS, assets, dataqueries, statusberekening, bronacties, rechten, releases en
Player zijn ongewijzigd. Bestaande tests vinden dezelfde bediening via de
semantische naam `Bronsoort` en dezelfde lijstlinks; aantallen en assertions
zijn behouden.

## Bewijs

- Oorspronkelijke b10-productbron: twee echte Chromium-regressies falen op de
  verborgen Sportlink-kaart bij 1440 en 390px. Geen retries of skips.
- Kandidaat: alle negen bestaande en nieuwe Source-dialogcases slagen zonder
  retries/skips. De gepubliceerde filterregels blijven actief; afzonderlijke
  controle-elementen bewijzen dat de browser ze daadwerkelijk toepast.
- De Sportlink-status, alle bronfilters en toelichting blijven zichtbaar.
  Keyboardfiltering, kaart openen, detailtabs, aXe en ongewijzigde afmetingen
  worden gecontroleerd. Viewer- en mislukte-bronscenario's draaien eveneens met
  de filters actief; bestaande command-/receiptcontroles blijven behouden.
- Op beide formaten zijn de PNG-bytes van de oude normale pagina, de nieuwe
  normale pagina en de nieuwe pagina met filters exact gelijk. Dit geldt voor
  deze gerichte componentfixture, niet als algemene pixel- of live-providerclaim.

Ruwe baseline, kandidaat, screenshots, geometrie en opruimlogs staan in
`/home/codex/.local/state/veyocast-s283/`. De fixture gebruikt expliciete eigen
read models en gecontroleerde provideracties; dit is geen nieuwe Sportlink-
providersynchronisatie of onderzoek naar het Chrome-profiel van de gebruiker.

## Gates en uitrol

Lokale lint, typecheck en test zijn alle drie groen (70,0s / 84,5s / 188,3s).
De drie aangepaste bestaande browserspecs worden normaal door Playwright geladen.
Bestaande volledige CI, staging en productie worden via de
gewone PR/main-keten vastgelegd. Er worden geen dependencies, lockfile,
workflows, credentials, migraties of providerinstellingen gewijzigd. De eerder
uitgestelde providerconfiguratie en fysieke apparaatacceptatie blijven apart.

Voor de lokale testinstallatie zijn uitsluitend regenerabele pnpm-cache, een
ongebruikte oude hoofdwerkmapinstallatie, oude gegenereerde Next-uitvoer en de
eigen incomplete installaties opgeruimd met de reeds gegeven toestemming.
Bronnen, actuele SDK-installaties, historische bewijsbestanden en databasevolumes
zijn behouden. Twee oorspronkelijke installatiefouten wegens schijfruimte zijn
bewaard; alleen de daarna geslaagde normale frozen installatie is gebruikt voor
de geaccepteerde browserbewijzen.

Filterbron: [EasyList generic hiding rules](https://github.com/easylist/easylist/blob/master/easylist/easylist_general_hide.txt).
