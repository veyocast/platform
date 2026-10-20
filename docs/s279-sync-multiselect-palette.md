# S279 — Leesbare meervoudige keuzevelden in Sync

De werkelijke74eb-build liet onder een opgeslagen donkere voorkeur nog donkere
keuzevelden zien op platform/support/settings en Goal Overlay. Een donker
veldlabel werd daar vrijwel onleesbaar. Alleen de MultiSelectDropdown binnen
Sync krijgt nu expliciete bestaande Source-kleurrollen. Ook zoek-, selectie-,
link- en focusrollen blijven binnen dit component. Root/shared tokens, opties,
selectie, handlers, publicatie, Auth/RLS, bronrenderer en dependencies wijzigen niet.

## Bewijs

- Bestaande twee platformlayoutgevallen uitgebreid; originele baseline werkelijk
  2/2 rood9,796s, kandidaat dezelfde2/2 groen7,476s, één worker, nul skips/retries.
  Alle bestaande drie platformroutes, breedte-/formulier-/keyboard-/buiten-scope-
  asserties blijven behouden. Vier gerichte aXe-scans van de keuzevelden hebben
  nul violations; dit is geen algemene AA-acceptatie.
- Acht echte AAL2-CSS-tegenproeven op de gebouwde74eb-basis: beide routes,
  390/1440 en licht/donker. Benoemde veldteksten minimaal5,4316:1; witte Source-
  vlakken, tekst/links/main- en veldgeometrie gelijk en volledige computed styles
  exact hersteld na verwijderen.24 native PNG's; alle24 overzichtsbeelden en twee
  oorspronkelijke kandidaatbeelden op ware grootte door Root bekeken.
- Finale nativeclosure: /dev/shm/veyocast-s279-native-candidate-ef75db40-b752-4a83-b67e-2fc693766ead/closed.json.
  AAL2-tegenproeven: /dev/shm/veyocast-s244-separate-aux-runs/a305bc6d-4457-435c-b061-1756857517d5/closure.json.
  Beide werkelijkexit0, eigen browsers/processen gesloten; alle162 bestaande
  tabel-/Auth-/Storage-/bron-/buildguards gelijk, geen doorgestuurde mutatie.
- Oude AAL2-failures blijven ongewijzigd: eerste lichte herstelmeting zag nog
  kandidaattekstkleur terwijl achtergrond al gelijk was; herstel wacht nu binnen
  dezelfde2s op zowel kleur als achtergrond vóór dezelfde volledige gelijkheid.
  Exacte render-/schedulingoorzaak blijft onbekend. De tweede run had vier goede
  lichte tegenproeven maar stopte later in een afzonderlijke DOM-inspectie op de
  verkeerd opgegeven /platform/users-alias. Finale8-scope bevat uitsluitend de
  keuzeveldtegenproeven; geen eerderefailure is omgelabeld.

Adapter-SHA256: 5d319a520e102714bb5956049c9b64a98e066355dc67aa1edf5af52967be275f.
Alleen die beschermde hash in de bestaande fixture wijzigt; de overige veertien
bronhashes en bestaande assertions blijven behouden. De wijziging is exact naar
de488692fc-baseline omkeerbaar. De bestaande normale fysieke Next-installatie
wordt hergebruikt; geen install of DB-wijziging. Gerichte lint werkelijkexit0; alle tijdelijke SDK-aliases verwijderd. De volledige
fysieke normale Next-manifesten vóór/na lint zijn gelijk en Root74bron is schoon.

## Integratiegrens

Deze feature bouwt geen nieuwe Next-app en voltooit geen volledige visuele ronde.
De overige kleine tekst-/voorbeeldlabelbevindingen, een oranje Goal Overlay-
checkbox en verdere previewbeoordeling blijven afzonderlijk binnen S244 open.
De finale gezamenlijke build, exacte CI, vijf matrixreviews en geautoriseerde
staging-/productie-uitrol volgen normaal via de integratiebranch. Fysieke24uur-
proeven en uitgestelde providers zijn hiermee niet bewezen.
