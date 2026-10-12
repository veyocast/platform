# OnzeTrots achtergronden

De actieve achtergronden staan in `public/onzetrots/premium/`. Het zijn vijf afzonderlijke, artistiek samengestelde rasterbeelden in de blauw-witte OnzeTrots brush/grunge-stijl. De herkenningspunten zijn verweven met brede verfstreken, droge penseelranden, verweerde inkt en gelaagd papier. Zo vormen architectuur, fotografie en verf samen één achtergrond voor de LED Scores-slides.

De vijf originele foto's zijn de inhoudelijke referenties. Herkenbaarheid zit in de specifieke vorm, verhoudingen, kijkrichting en kenmerkende onderdelen van de gebouwen en omgeving. De bewerking geeft die plaatsen een geschilderde uitstraling en maakt ruimte voor de score en brushletters.

| Achtergrond | Herkenningspunten uit de referentie | Actief bestand |
| --- | --- | --- |
| Clubhuis | De lange gevel van Duindorp SV, het schuine perspectief, het clubopschrift, de ramen en de terrasreling | `clubhuis.png` |
| Havenlicht | De gedrongen lichttoren met brede uitkragende kap, het glazen lichthuis, de cilindervorm en de pier | `havenlicht.png` |
| Kerk | De bakstenen toren met de karakteristieke puntige kap, de klok en de aansluitende kerkzaal | `kerk.png` |
| Duindorp van boven | De zichtbare wijkindeling, duinen, kustlijn en richting van de luchtfoto | `duindorp-luchtfoto.png` |
| Historische poort | De brede gemetselde boog, de doorkijk door de opeenvolgende bogen en het historische straatbeeld | `historische-poort.png` |

## Beeldbewerking

De composities zijn gemaakt met de imagegen-tool, met per achtergrond de oorspronkelijke foto als onderwerpreferentie en de OnzeTrots-website als stijlreferentie. De beeldregie combineert diep clubblauw en gebroken wit met duidelijke penseelvoering, gelaagde uitsneden en subtiele grunge. Het herkenningspunt blijft de visuele drager van elke compositie; de verf verbindt het met de rest van het beeld.

De gebruikte referenties, volledige prompts en uitvoerbestanden worden vastgelegd in `public/onzetrots/premium/sources.json`. De onbewerkte foto's blijven beschikbaar in `public/onzetrots/originals/`, met brongegevens in de bijbehorende `sources.json`.

## Toepassing in Studio

De vijf keuzes houden hun bestaande identiteit in de achtergrondkiezer. De resolver in `app/prototype/onzetrots-backgrounds.ts` verwijst oudere ingebouwde foto-, verf- en SVG-paden door naar de nieuwe compositie van hetzelfde herkenningspunt. Daardoor krijgen ook opgeslagen ontwerpen en playlistvoorbeelden de bijgewerkte stijl. Eigen uploads blijven hun eigen afbeelding gebruiken.

De eerdere SVG-versies blijven in `public/onzetrots/brush/` als onderdeel van de projectgeschiedenis. De actieve presets gebruiken de premium rastercomposities. Scorecijfers, brushkoppen en andere slide-inhoud worden afzonderlijk boven op de achtergrond opgebouwd.

### Leesbaarheid op de lichte slides

In het witte OnzeTrots-thema krijgen letters, cijfers en logo's een smalle lichte contour of gloed die hun eigen vorm volgt. De grote witte onderlagen achter kop, teams, stand, tijdlijn en voettekst zijn verwijderd: zij bedekten te veel van de herkenningspunten en konden naburige tekst overlappen. De blauwe score houdt zijn grungetextuur; de scheidingsstreep en bijschriften houden sterker contrast.

De extra witte kwaststreken zijn beperkt tot een smalle, transparante buitenrand. Het vectorbestand `public/onzetrots/readability-brush.svg` wordt alleen daarvoor gebruikt. De schuifregelaar beïnvloedt de decoratieve randstructuur. Nieuwe slides starten met 20% contrastlaag; opgeslagen contrastkeuzes blijven behouden. De vijf goedgekeurde PNG-composities zijn ongewijzigd.

### Groter in beeld

De LED Studio heeft een hoofdregelaar en afzonderlijke regelaars voor titel/subtekst, score, logo's en teamnamen (70–200%). Het preset Schermvullend kiest een kleinere veilige marge en grotere inhoud; de kleine clubregels kunnen uit om meer ruimte vrij te maken. Nieuwe ontwerpen starten met 3% veilige marge en gecentreerde tekst. Alle keuzes worden met het ontwerp opgeslagen.

De slide reserveert afzonderlijke rasterrijen voor kop, wedstrijdinhoud, tijdlijn en footer. Kop, teams en stand meten hun eigen beschikbare ruimte na het laden van fonts en bij formaatwijzigingen. Alleen wanneer nodig worden ze passend gemaakt. De score staat op één regel, zodat grote en meercijferige standen niet overlappen met de tijdlijn. Dezelfde renderer wordt gebruikt in Studio en playlist-/schermvoorbeelden.

Groot voorbeeld opent een schermbrede, donkere viewer zonder popup-randen. De slide behoudt 16:9 of 9:16 en past volledig binnen de viewport; bij een andere schermverhouding blijven vrije stroken over. Een knop start de browser-fullscreenfunctie wanneer ondersteund. Sluiten en Escape herstellen focus en scrollgedrag.
