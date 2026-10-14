# S218 — Eén slidebibliotheek en HTML-afspelen

## Oorzaken en gedrag

De bestaande Studio-bibliotheek vereiste voor elk lid van een reeks een
voltooide export. De tien actieve productieprojecten in drie reeksen hadden
wel geldige opgeslagen documenten, maar geen renderopdracht of export. Daardoor
verborg de bibliotheek deze ontwerpen volledig. De nieuwe, tenantgebonden
`list_publisher_studio_series_v2` leest het opgeslagen document onafhankelijk
van de optionele export. Historische v1-clients blijven ondersteund.

De picker heeft twee ingangen: Media voor uploads en Slides voor Studio,
Sportlink, LED Scores en menu's. Bronfilters worden vóór databasepaginering
toegepast. Een opgeslagen Studio-ontwerp heeft meteen een HTML-voorbeeld. Bij
expliciet toevoegen wordt uitsluitend de ontbrekende geverifieerde fallback
voor publicatie voorbereid. Het commando vergrendelt één reeks en haar projecten,
controleert de actuele documentrevisies en rechten en hergebruikt een bestaande
opdracht voor exact hetzelfde document. Herhaalde statuslezingen schrijven niets.
Bij een onzekere bevestiging blijft dezelfde idempotentiesleutel behouden;
alle gekozen items worden pas samen aan het concept toegevoegd na bevestiging.

Menu Studio heeft een eigen navigatie-ingang en overzicht. Menutemplates worden
vanuit het algemene Studio-aanmaakvenster naar Menu Studio geleid. Expliciet
opslaan bereidt automatisch de menusnapshot voor. Concepten en mislukte of
lopende verwerkingen blijven zichtbaar met hun werkelijke status. De wizards
publiceren niet meer rechtstreeks naar een afzonderlijke playlistflow: opgeslagen
ontwerpen worden vanuit de gezamenlijke bibliotheek aan een playlist toegevoegd.
Historische `advanced`-links openen dezelfde editor. Archiveren, herstellen,
dupliceren en definitief verwijderen blijven in het gezamenlijke overzicht.

## HTML, vormgeving en offline

De Player gebruikt de gedeelde HTML/CSS-presentatie, inclusief de ingestelde
animatie. Widgetmenu's voeren de actieve afspeelstatus nu ook door naar de
OnzeTrots-renderer. Een PNG of video is uitsluitend compatibiliteitsmedia; de
Player krijgt daarnaast de onveranderlijke presentatie en haar gecontroleerde
beelden en fonts. Bronupdates blijven via opgeslagen databasesnapshots lopen.

De drie verschillende productieprijslijsten hadden exact dezelfde fallback:
14.735 bytes met dezelfde SHA256. De oude SVG-renderer projecteerde het nieuwe
MenuDocument niet en kon toch een succesvol resultaat registreren. Sites-slides
gebruiken nu de bestaande Studio-DOM-capture met dezelfde gedeelde renderer,
fonts, afbeeldingdecodering en layoutcontrole. Een fout in deze renderer mag
niet meer ongemerkt overschakelen op de andere SVG-vormgeving. De laatste goede
slide blijft behouden en de opdracht krijgt een herstelbare fout.

De worker haalt hiervoor alleen checksumgebonden afbeeldingen uit de eigen
private Supabase Storage op. Redirects en andere origins worden geweigerd;
streamgrootte, totale bytes, deadlines en SHA256 worden gecontroleerd. De browser
ontvangt lokale, gecontroleerde bronnen. Er worden geen providerverzoeken vanuit
slides gedaan. Een echte lokale capture van het opgeslagen menu bevat het juiste
OnzeTrots-ontwerp, product, prijs en subregel en is circa 2,34 MB.

Immutable publicaties en de volledige download-/checksumgrens blijven behouden.
Een ontbrekend asset wordt niet genegeerd en een onvolledige release wordt niet
geactiveerd. Er wordt geen ontwerp opgeslagen door een librarypoll, bronrefresh
of Player-renderframe. Bestaande publicatie- en opslagretentie blijft ongewijzigd.

## Validatie en uitrol

De verificatie gebruikt een geïsoleerde lokale Supabase, echte servercommando's,
de echte renderworker en productiebuilds van Control en Player. De lokale Storage
wordt via een lokale HTTPS-proxy aangeboden omdat de productie-CSP terecht geen
externe HTTP-media toestaat. Alleen het lokale testcertificaat wordt vertrouwd;
CSP, mediaresponses, publicatiebevestigingen en Playeractivatie worden niet
vervangen door mocks.

Lokale verificatie:

- Workspace lint, typecheck en unit tests: elk 30/30 taken groen.
- Verse DB-reset met 165 migraties; 108 RLS-bestanden / 3.048 assertions groen;
  securityadvisors zonder bevindingen.
- Control- en Playerproductiebuilds inclusief server/client-grenschecks groen.
- Echte end-to-endflow: 1 PASS in 49 seconden, met opgeslagen HTML-productregel,
  first-frameacknowledgement en offline herstart. De database bevestigt één
  publicatie met dezelfde gewenste en actieve release. Zie
  `s218-local-player-evidence.json`.
- Editor-, bibliotheek- en wizardmatrix: 173 cases. De brede run gaf 171 PASS;
  twee mobiele stepper-/titelasserties waren bij een geïsoleerde herhaling
  ongewijzigd groen. Geen assertions of deadlines zijn hiervoor afgezwakt.
- De strikte Studio-bronvergelijking is op zes schermformaten groen. Zij
  controleert alle vijftien resterende families, hun fonts/beelden en contain-
  schaling, plus de zichtbare ingang naar de afzonderlijke Menu Studio. De oude
  verwachting van zestien families in Studio is aangepast aan deze expliciete
  gebruikersopdracht; de originele bronbestanden zijn ongewijzigd.
- Worker: geverifieerde private captureassets en foutafhandeling, inclusief
  weigeren van onjuiste SVG-fallbacks; gecontroleerd via workspace-unitgates en
  de echte Menu Studio-renderopdracht.

Hosted gates en exacte staging-/productionreadback worden gevolgd op
[PR 244](https://github.com/veyocast/platform/pull/244). Fysieke LG-activatie is een
aparte bewijsgrens: de gebruiker bevestigt dat het apparaat uitstaat. De laatste
heartbeat is van 14 oktober 19:59 UTC, op een oudere applicatieversie. De
browserproef bewijst geen zichtbare inhoud op dit uitgeschakelde apparaat.

## Migratie en herstel

De forwardmigratie voegt uitsluitend twee bewaakte RPC's toe. Er worden geen
bestaande records, policies, bestanden of releases verwijderd of herschreven.
De oude bibliotheek-RPC blijft bestaan, zodat de vorige applicatie kan worden
teruggezet zonder een destructieve downmigratie. Gegenereerde media blijft onder
de bestaande referentieveilige opruiming vallen. Een teruggezette oude worker
mist de correcte Sites-capture; publiceer daarom geen nieuwe Sites-ontwerpen
met die oude worker. Bestaande LKG-afspeelinhoud blijft geldig.
