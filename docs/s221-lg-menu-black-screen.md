# S221 — OnzeTrots-menu verdwijnt op LG

De gepubliceerde prijslijst werd door de online LG opgehaald en als actief
bevestigd, zonder afspeelfout. Dit was geen bewijs van zichtbaar beeld. De
begrensd gelezen productiepublicatie bevatte één portrait-menupagina, één
categorie zonder kop en één product, met schaal 130 en veilige marge 6.
De canonieke serverrenderer maakte daarvoor geldige HTML, CSS en lokale
checksum-assetverwijzingen.

De menurenderer plaatst de originele `.uc-preview` in `.vm-frame`. De oude
LG-adapter gaf uitsluitend de eerste wrapper expliciete native afmetingen.
De binnenste preview ontleende zijn hoogte aan CSS `aspect-ratio`, terwijl zijn
slide absoluut gepositioneerd is. Zonder ratio-ondersteuning is de preview
0 px hoog; `overflow:hidden` knipt dan de hele kaart weg. De slide en producten
hebben nog wel positieve rechthoeken en de oude activeringscode bevestigde na
twee animation frames ten onrechte een weergegeven frame.

De exacte productieconfiguratie reproduceerde dit lokaal: de portrait-preview
was 1080×0 in plaats van 1080×1920 en de capture bleef zwart. De nieuwe
geanonimiseerde browserregressies faalden vóór de fix op dezelfde nulhoogte,
zowel portrait als landscape. Alleen `CSS.supports = false` zetten in bestaande
tests schakelde Chromium's werkelijke ratio-layout niet uit; de nieuwe proef
neutraliseert de ratio vóór de eerste render.

Chrome documenteert `aspect-ratio` als toevoeging in
[Chrome 88](https://developer.chrome.com/blog/new-in-chrome-88?hl=en).
[LG's engineoverzicht](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
illustreert generatieverschillen voor webOS TV. Dat bepaalt niet het exacte
Signage-model of de firmware van deze pilot; de lokale capabilityproef is geen
fysieke hardwarecertificering.

De eerste zichtbare capture onthulde daarnaast dat het witte informatiepaneel
ontbrak. Commentaar vóór de oorspronkelijke `:is(...)`-surface-selectors bevat
komma's. De LG-selectoruitbreiding behandelde deze als scheidingstekens en
maakte ongeldige selectorlijsten. Zij verwijdert nu uitsluitend
commentaartokens uit de selectorprelude vóór uitbreiding; geciteerde
attribuutwaarden, declaraties en de frozen bron-CSS blijven intact. Een aparte
regressie bewijst de fout vóór en na herstel; de browser controleert nu ook de
werkelijke witte paneelkleur.

Een aanvullende proef gebruikt de werkelijke Chromium 79.0.3945.0-engine uit
Google's officiële Linux-snapshot 706915, met de echte door Next gegenereerde
LG-route en uitsluitend lokale fixture-API's. Zonder gestubde features meldt
hij zowel ratio- als inset-ondersteuning afwezig. De kaart verschijnt correct,
maar de originele achtergrond werd aanvankelijk te klein: CSS `inset` werd
geheel genegeerd. De adapter zet de vaste bronshorthands nu om naar equivalente
fysieke randen, inclusief `auto`, prioriteit en latere randoverschrijvingen.
De echte oudere engine meet daarna zowel preview als achtergrond op de volle
native verhouding. Capture en product-/sloganpositie zijn visueel gecontroleerd.
Dit is een begrensde raw-CDP-proef, geen volledige Playwright-suite op die oude
engine: modern Playwright kan zijn `Browser.setDownloadBehavior`-commando daar
niet uitvoeren. Ook dit blijft afzonderlijk van fysiek LG-hardwarebewijs.

De LG-runtime geeft nu ook de binnenste menu-preview de gepubliceerde native
breedte en hoogte. De bestaande viewportschaling, bronvormgeving en
productcontent blijven gelijk. Vóór activering controleert hij bovendien dat
de buitenste en canonieke previewframes positieve afmetingen hebben. Een
onbruikbaar frame wordt niet bevestigd; de bestaande watchdog kan vervolgens
de geverifieerde poster van dezelfde release activeren. De huidige geldige
media wordt tijdens voorbereiding behouden.

Validatie vóór commit:

- Workspace lint, typecheck en unit: elk 30/30 taken groen; de Player voert
  400 assertions in 71 testbestanden uit, inclusief de ES5-runtimecontrole.
- De nieuwe portrait/landscapeproeven falen vóór de fix op 0 px hoogte; de
  commentaarproef faalt vóór de tweede fix op een ongeldige selectorlijst.
- Volledige LG-compositiesuite en offline-suite: 17 + 7 browserproeven; zichtbaar
  menu en witte paneelkleur, pixelstatistiek/hit-testing, viewportwissel,
  offlinebehoud, widgets met meerdere pagina's, video/zoneranden en geverifieerde
  terugval bij een geforceerd nulframe.
- Player-a11y: 3/3 groen. Geen gewijzigde database- of permissiegrens; de
  volledige database/RLS- en overige exacte CI-gates lopen vóór merge.

De laatste brede browserrun en staging/productie worden in de PR gekoppeld.

Geen migratie, dependencies, locked assets, providerfetch, publicatie- of
LKG-contract gewijzigd. Bestaande publicaties krijgen de runtimecorrectie via
de normale softwareversie-update; opnieuw een menu publiceren is niet nodig.

Rollback betreft alleen de applicatieruntime. De oude runtime brengt de
reproduceerbare nulhoogte terug en is daarom geen inhoudelijk herstel.
Fysiek LG-beeld moet na deployment door de gebruiker worden bevestigd;
een heartbeat met 'actief' blijft op zichzelf onvoldoende bewijs.
