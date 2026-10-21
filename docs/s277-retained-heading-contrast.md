# S277 — Eén Sync-palet voor behouden beheercomponenten

Bij een donkere systeemvoorkeur erfden behouden beheerpanelen het oude
donkere FieldFlow-palet, terwijl de gekozen Sync-werkruimte licht blijft.
Dit gaf onder meer witte paginakoppen op de werkruimte en donkere tabel-/
veldtekst op donkere panelen. Alleen de koppen wijzigen loste de oorzaak niet op.

De26-regelige adapter koppelt uitsluitend binnen de bestaande
`.sites-control.sync-control` onder de donkere voorkeur de behouden
ff/vc-tekst-, vlak- en borderrrollen aan de bestaande Source-rollen.
De opgeslagen voorkeur, Auth, portals, Sourcebestanden, roottokens, gegevens,
writers en beide contentthemafamilies veranderen niet. De bestaande
platformfixture krijgt uitsluitend de echte adapterhash
`cc47e2e25b8d1131adbd19797478e9ed2bca70db612c577b273c7deb9d65cd2a`.
Exacte inversecontrole herstelt beide oorspronkelijke bestanden bytegelijk.

De daadwerkelijke gebouwde AAL2-tegenproef op8e03 met expliciete kandidaat-CSS:

- 59 vastgelegde defaultrequests op1440/donker en390/donker;118PNG per run,
  benoemde solid-backgroundkoppen/uitleg/crumbs minimaal5,029:1,
  tekst/links/afmetingen en volledig stijlherstel exact gelijk.
- 59 dezelfde requests op1440/licht: alle gemeten targeted stijlen voor/na
  exact gelijk, minimaal5,165:1; geen nieuwe lichte wijziging.
- 21 werkelijk zichtbare canvasuitsneden in de donkere runs behouden exact
  dezelfde gedecodeerde pixels; dit bewijst niet iedere36familiesituatie.
- Alle vijf overzichten met118 donkere kandidaatbeelden werkelijk bekeken;
  daarnaast originele desktopAccount en mobielePilot-PNG bekeken.
- Alle drie runs nativeexit0, geen browser-/transport-/cookie-/writefouten;
  alle162 QA-/historie-/Storage-/Auth-/bron-/SDK-guards gelijk en browsers dicht.

Bewijs-ID’s: `c476d1f3-aab5-4423-8e88-7506e0ac5f76`,
`1c82a174-b4b8-4dcf-9a26-0df85b268bf1`,
`e21b7655-e7d2-437c-838f-06fe17fe7594` onder de beschermde
`s244-separate-aux-runs`. De actuele bestaande platformfixture slaagt2/2
op390/1440 in5,534s,0skips/retries en de ingebouwde aXechecks groen;
bewijs `5b2e2069-62a7-4e11-8b4e-da2b49538586`. Dit laatste gebruikt echte
async pagina’s/layout/CSS met gecontroleerde readmodels/host/commandtransport.

Alle eerdere rode audit-/alias-/hidden-heading-/palette-/setupwaarnemingen
blijven behouden. De afzonderlijke cascademeting toonde werkelijk gewijzigde
customprops en nog niet herstelde computedkleuren bij de onmiddellijke read.
De exacte vertragingsbron is onbekend; native wachten op daadwerkelijk
kopcontrast en exact herstel binnen2s houdt de assertions intact.
De eerdere kop-onlyproeven zijn geen bewijs voor de definitieve palette-edit.

Dit is geen nieuwe volledige appbuild, algemeneAA-, Source-pixel-, hardware-,
provider-, vijf-ronden- of V1-acceptatie. Afzonderlijk gevonden legacy
statusrollen/te donkere Source-statistiekvlakken en minder leesbare kleine
statuscopy worden als vervolg behandeld. Gecombineerde build, exacteCI,
hele-matrixronden4–5 en normale staging/productie blijven open.
