# S220 — Menu Studio: inklappen, kolomvolgorde en productbewerking

De slogan staat binnen het bestaande witte productenpaneel. Hij staat buiten
het schaalbare productenraster, onderaan links met de oorspronkelijke padding
van het paneel. Verwijderde hulpcopy blijft verwijderd. De bevroren v17-assets,
kop, achtergrond en themafooter veranderen niet.

De widgeteditor bewaart één geopende widget en één geopend product. Nieuwe
widgets/producten openen direct; een andere openen sluit de vorige. Knoppen
hebben `aria-expanded`/`aria-controls`, toetsenbordbediening en een minimaal
44 px aanraakvlak. Ingeklapte velden blijven gemount zodat tijdelijke invoer
niet verloren gaat. Het potlood opent de bestaande toegankelijke Dialog voor
naam en bedrag en herstelt focus naar de betreffende knop bij sluiten.

Een schermprijs is een optionele `priceOverrideMinor` in gehele centen, inclusief
nul. Komma en punt worden zonder floating-pointafronding ingelezen. Leeg maken
herstelt de bronprijs. De plaatsing behoudt bronvaluta/btw; de server lost de
productsnapshot nog steeds uit de tenantcatalogus op. De catalogus wordt niet
gewijzigd. De gedeelde menuprojectie en MenuScene gebruiken het effectieve
bedrag. De actuele Menu Studio-flow levert dezelfde v17-markup aan preview,
HTML-Player, Static LG en servercapture.

Automatische producten vullen per schermpagina kolom 1 tot de beschikbare
rijhoogte/rijcapaciteit op is, vervolgens kolom 2 en daarna een nieuwe pagina.
Het toevoegen van een volgend product herverdeelt eerdere producten niet over
de twee kolommen. Expliciete kolommen behouden afzonderlijke paginacursors.
Rijhoogtes houden rekening met koppen, afbeeldingen en gewrapte subregels.

Vrije productsubregels hebben geen afzonderlijke tekenlimiet in de nieuwe en
bestaande invoer, het strikte contract, de SQL-validator of widgetrijen.
Besturingstekens en product-/prijssemantiek in vrije regels blijven ongeldig.
De bestaande document-/commandpayloadgrenzen en de fysieke maxLines-guard van
historische productgroepen blijven behouden. Langere productsubregels worden
niet afgekapt; de bestaande contentfit houdt de weergave binnen het viewport.

Validatie vóór commit:

- Workspace lint/typecheck/unit: elk 30/30 taken groen; respectievelijk
  18/29/28 caches hergebruikt in de laatste foundationrun.
- Verse reset met 166 migraties; volledige pgTAP/RLS-suite: 109 bestanden en
  3.073 assertions groen. Nieuw: 25 controles voor echte authenticated
  save/reopen/publicatiekandidaat, lange subregels, integerbedragen, canonical
  bronprijzen, tenantisolatie en private functiegrants.
- Lokale Supabase security-advisors: geen bevindingen.
- Visuele bronpariteit en viewportmatrix: 10/10 groen, portrait/landscape op
  390×844, 768×900, 1440×900 en 3840×2160. Paneelpadding meetbaar inclusief rand.
  Kop, scenery, themafooter en portraitcategoriebanen blijven pixelgelijk.
- Werkelijke editorcomponenten met gecontroleerd servertransport: naam/bedrag,
  validatie/annuleren/focus, lange vrije tekst en gekoppeld subproduct,
  exclusieve accordions/toetsenbord, afbeelding/pagina en save/reopen bij
  390/768/1440 px; volledige main/Dialog axe zonder overtredingen.
- Static LG widgets: 2/2 groen; Player-a11y 2/2 en volledige offline-suite 7/7.
- Native portrait- en mobiele editorcapture visueel gecontroleerd.

Eerdere lokale harnesstoringen: een te exacte selectlabelselector en het
ontbrekende prijsveldlabel zijn gecorrigeerd; één fixture telde de lengte van
haar eigen lange tekst verkeerd en één verwachte ongetrimde trailing space.
Een root-barrelimport trok onnodige font-CSS de losse browserharness in en is
verwijderd. Geen productielogs of fysieke Playerbevestiging worden daarmee
nagebootst.

Eén forwardmigratie vervangt uitsluitend `private.validate_menu_node_v2`.
Geen tabellen, RLS-policies of grants naar publieke rollen toegevoegd. Bestaande
migraties zijn ongewijzigd. Rollback is applicatierollback met behoud van deze
voorwaarts compatibele validator; de oude tekstlimiet niet herinvoeren op reeds
opgeslagen nieuwe documenten. Geen automatische slide-/playlistversies,
providerfetch vanuit slides, release-mutatie of wijziging van offline-LKG.

CI, merge en staging/productie volgen na de bovenstaande lokale gates. De
fysieke Android-app is in deze taak niet zelfstandig bediend.
