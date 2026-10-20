# S266 — Kaarttypografie raakt geen slide-inhoud

In de echte 177e-galerij was de clubslogan onderin een preview veel groter dan
in dezelfde gedeelde slide-renderer. De afstammelingsselectors voor `strong`
en `small` pasten ook kaartlabelkleur, regelafstand en 20px-rechterpadding toe
op de inhoud van alle 36 previewfamilies.

De zes regels in `sync-source.css` gelden nu uitsluitend voor
`.vc-template-card > span > strong/small`: de directe kaartmetadata. De
bestaande desktop-, tablet- en mobiele waarden blijven behouden. Zowel Nieuw
ontwerp als Template kiezen gebruikt deze kaartstructuur. Renderer, canvas,
OnzeTrots-achtergronden, opgeslagen documenten en publicaties wijzigen niet.

De browserregressie vergelijkt alle `strong`/`small`-elementen van alle 36
previews met een identieke renderer zonder galerijkaart, bij gelijke
canvasbreedte. Ze controleert lettergrootte, regelafstand, tekstkleur en
rechterpadding op 390, 700 en 1440px. Alleen de eigen eindige dialoganimatie
wordt afgewacht; geen willekeurige slaap, stylesheetaanpassing of gewijzigde
productinhoud. De offscreen referentie bestaat alleen binnen de gecontroleerde
test en wordt steeds verwijderd. De fixture importeert de portalprovider via
dezelfde publieke UI-module als het product, zodat dependencylinks geen twee
verschillende React-contexten creëren.

## Uitgevoerde gerichte verificatie

- Ongewijzigde CSS: drie native regressiegevallen rood. De 1440px-metingen
  tonen 280/280 afwijkende tekstelementen, waaronder de clubslogan.
- Kandidaat: alle 11 galerijgevallen groen in 20,5s, één Chromiumworker,
  nul retries, skips of flakygevallen. De 1440px-metingen bevatten 280/280
  gelijke tekstelementen; ook beide andere schermbreedtes slagen.
- Bestaande gevallen behouden 36 complete previews, namen, filters,
  keyboard/touch/aXe, de echte wizardnavigatie, viewergrens en gebonden
  ontvangstbewijscontrole. Er is geen creatie- of publicatiecommando verstuurd.
- De oorspronkelijke en gecorrigeerde native PNG zijn door root bekeken.
  De te grote slogan is hersteld en de volledige kaartpreview blijft zichtbaar.
- Gerichte ESLint en strict TypeScriptcontrole van de spec slagen. De laatste
  gebruikt dezelfde DOM/DOM.Iterable-libs als de applicatie. Tijdelijke
  dependencylinks zijn met exacte inode/mtime/readlinkguards gesloten vóór
  commit; de gedeelde Next-boom blijft byte- en modegelijk.

Bewijsroots:
`/dev/shm/veyocast-s266-picker-baseline-44c09a01-e79d-4dbb-969d-302ecdd9e6e7`
en `/dev/shm/veyocast-s266-picker-candidate-b6a11c89-0e73-473c-898e-7bed56051375`.
Beide wrappers zijn werkelijk gesloten; de kandidaat heeft exit0, geen
cleanupfouten en geen eigen achtergebleven processen. Eerdere mislukte lokale
fixturevoorbereidingen blijven afzonderlijk bewaard.

Dit is gerichte native fixtureverificatie. Normale CI, integratie, de actuele
productiebuild, alle prototypevergelijkingen en staging/productie blijven
afzonderlijke S244-gates. **0/5 volledige visuele vergelijkingsronden.**
