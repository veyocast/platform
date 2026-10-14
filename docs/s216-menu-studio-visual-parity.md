# S216 — Menuwidgets in de oorspronkelijke Studio-stijl

De S215-widgetrenderer gebruikte eigen witte kaarten, een grote losse titel en
andere fonts/geometrie. Daardoor week een bewerkbaar menu af van het gekozen
OnzeTrots Studio-template. De widgets vullen nu de bestaande v17-renderer via
een inhoudslot: dezelfde clubkop, originele brushachtergrond, papieren
informatievlak, genummerde categoriebanen, prijzen en OnzeTrots-footer.

Categorieën behouden hun natuurlijke hoogte en staan bovenaan. Portrait past
drie categorieën op één pagina; expliciete linker/rechter productkolommen,
gewone subregels onder vetgedrukte namen, beelden en deals blijven behouden.
Afbeeldingsframes en volledige canvassen passen proportioneel in hun viewport.
Te grote inhoud wordt gemeten en pas bij daadwerkelijke overflow verkleind.

Nieuw Menu Studio begint met OnzeTrots; de shortcut vanuit Nieuw ontwerp neemt
het gekozen thema en formaat over. Bestaande opgeslagen keuzes blijven behouden.
De preview krijgt de actuele, geautoriseerde clubnaam. OnzeTrots begint met de
originele blauwe accentkleur en zonder extra donkere contrastlaag; eigen foto,
accent, contrast, tekstgrootte en uitlijning blijven bewerkbaar. De bestaande
achtergrondactie heet bij deze stijl nu Standaardachtergrond.

De worker had op zijn trusted browserpad alleen de oudere CSS geladen wanneer
includeStyles uit stond. Bij een v17-canvas gaf dit geen correcte inhoud. Hij
laadt nu ook de juiste v17-stijl voor de PNG-uitvoer. Menuwidgets gebruiken ook
bij een ouder bewaard renderercontract dezelfde gedeelde widgetstijl.

## Visueel bewijs

De nieuwe browserregressie rendert het oorspronkelijke Studio-kantinetemplate
met dezelfde inhoud als de widgets. Zij vergelijkt gedecodeerde pixels met nul
tolerantie: clubkop, scenery en footer in beide oriëntaties, plus alle drie
categoriebanen in portrait. Productnamen zijn bewust vetgedrukt volgens de
opdracht; de body is daarom geen claim van volledige pixelidentiteit. Landscape
behoudt de nieuwe configureerbare widgetkolommen.

- [Portraitvergelijking](screenshots/s216-menu-studio/portrait-comparison.png)
- [Landscapevergelijking](screenshots/s216-menu-studio/landscape-comparison.png)

Deze beelden zijn echte Chromiumcaptures, proportioneel verkleind voor review.
De automatische vergelijking gebruikt de oorspronkelijke native pixels.
Responsive controles dekken 390, 768, 1440 en 3840 px, beide oriëntaties.
De fysieke TV is niet afzonderlijk gemeten.

## Validatie en uitrol

Native visuele matrix: 10 PASS. Widgetauthoring/opslag/heropening en main-axe:
3 PASS op mobiel/tablet/desktop. Bestaande bronwizardmatrix: 58 PASS. Werkelijke
PNG-capture: 11 PASS met beide thema's, beide oriëntaties en verschillende
pagina's. LG-compositie/menupagina's: 14 PASS. Offline: 7 PASS. Workspace
lint/typecheck/test: elk 30/30 PASS. Exacte CI en staging/production volgen via
het PR- en deploymentbewijs.

Er zijn geen nieuwe migraties, dependencies, providerrequests, automatische
slideversies of release-/offline-state-machinewijzigingen. Frozen v17-CSS en
alle bron-/merkassets blijven bytegelijk. Rollback is een eerdere applicatie-
release via de bestaande workflow; opgeslagen widgetdocumenten blijven leesbaar.
