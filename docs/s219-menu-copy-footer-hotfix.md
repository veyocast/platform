# S219 — Menukaart zonder hulpcopy en met vaste hoekfooter

De gebruiker vraagt de standaardteksten “Actuele clubinformatie” en
“Bestellen en afrekenen aan de bar” uit de Menu Studio-slide te verwijderen.
De widgetrenderer maakt beide elementen niet meer aan. Het categorie- en
productraster begint daardoor direct bovenaan de bestaande productencontainer.

“ONZE CLUB. ONZE TROTS.” staat via een optionele canvasslot vast op `left: 0`
en `bottom: 0` van het logische slidecanvas. De slogan beweegt niet mee met de
productenlijst, paginering of inhoudsschaling. Lettertype, voorgrond en
achtergrond komen uit de bestaande OnzeTrots-presentatie. De kleine footer
blijft onder de gereserveerde Player-system mark; het officiële merkasset en
zijn plaatsing wijzigen niet.

Dezelfde markup wordt gebruikt door browserpreview, moderne Player, Static LG
en de servercapture. De oorspronkelijke Studio-templates blijven ongewijzigd;
dit is de expliciete Menu Studio-delta op de eerdere source-pariteit. Er worden
geen documenten, playlists, snapshots of publicaties herschreven.

Validatie vóór commit:

- Workspace lint, typecheck en unit tests: elk 30/30 taken groen.
- Chromium shell-/categoriepariteit en viewportmatrix: 10/10 groen, inclusief
  staand en liggend op 390 × 844, 768 × 900, 1440 × 900 en 3840 × 2160.
- Static-LG-widgetweergave: 2/2 groen, staand en liggend.
- Player-a11y: 2/2 groen; volledige Player-offlinesuite: 7/7 groen.
- De nieuwe staande en liggende captures zijn visueel gecontroleerd.

De bestaande beeldvergelijking verwijdert de twee
bewust vervallen copy-elementen alleen uit haar referentie-DOM voordat zij de
verplaatste categoriebanen exact vergelijkt. Achtergrondvergelijking behoudt
nul pixeltolerantie buiten de onderste 48 logische pixels die de nieuwe
hoekfooter bevatten. De opgeslagen oorspronkelijke referentiecapture blijft
ongewijzigd. De viewportmatrix meet ook de slogan op nul afstand van de linker-
en onderrand van het canvas.

De opdracht vraagt commit en push. Uitrol is een afzonderlijke stap.
