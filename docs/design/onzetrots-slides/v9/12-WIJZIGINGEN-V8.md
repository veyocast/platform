# Wijzigingen v8 — 23 oktober 2026

De fontkeuze en subtitel/titelkop hieronder blijven behouden. Het actuele v9 verwijdert extra binnenkoppen en wijzigt verjaardagskaarten volgens `13-WIJZIGINGEN-V9.md`; oude v8-opnamen zijn voor die onderdelen niet de eindreferentie.

V8 vervangt de eerdere kopfontkeuze en voegt een subtitel boven de titel toe. De bronidentiteit van v8 blijft bij de oorspronkelijke opnamen geregistreerd; de definitieve v9-bron staat op `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`. De VeyoCast-productierepository is voor deze overdracht niet aangepast; de repo-inspectie blijft van 22 oktober 2026 op main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`.

## Rubik Distressed en woordmerk

Alle koppen gebruiken het **echte Rubik Distressed, gewicht 400**, uit het lokale bestand `RubikDistressed-Regular.ttf`, met de bijbehorende licentie `RubikDistressed-OFL.txt` (SIL Open Font License 1.1). Neem het bestand op in de geverifieerde font-/assetset, checksumcontrole, Worker-capture en offline Player-cache. Gebruik geen Permanent Marker, fontsysteemfallback of synthetisch vet als vervanging. Manrope en Barlow behouden hun overige tekst-/cijferrollen. Het compacte witte OnzeTrots-woordmerk blijft het originele transparante artwork; dat wordt niet opnieuw in Rubik gezet.

## Header en authoring

Iedere slide heeft links een **subtitel boven de titel**, met het eigen clublogo helemaal rechts. De editor toont beide velden onder `SLIDEHEADER`: `Subtitel boven de kop` (aria `Subtitel van deze slide`) en `Headertekst` (aria `Headertekst van deze slide`). Beide hebben maximaal 120 tekens en mogen leeg zijn.

Het prototype bewaart aparte maps `headerSubtitles` en `headerTexts` per familie in `localStorage`-sleutel `onzetrots-studio`. Standaardtitel is `family.label`, standaardsubtitel `Duindorp SV · ${family.group}`. Expliciet leeg blijft leeg. `Standaard herstellen` herstelt beide teksten van alleen de huidige familie. In productie horen beide velden bij het opgeslagen slide-/ontwerpcontract en de bestaande draft/revision/publicatieflow; een bronrefresh overschrijft ze niet. Render beide als tekst met veilige escaping.

| Eigenschap, logische pixels | Liggend | Staand |
| --- | --- | --- |
| Kopcontainerhoogte | 120 | 128 |
| Tekstwrapperhoogte | 88 | 92 |
| Rubik Distressed-titel, beginmaat | 42 | 38 |
| Titel minimum bij fit | 14 | 14 |
| Subtitel Manrope 800, maat / regelhoogte | 12 / 1,4 | 11 / 1,4 |

De titelruimte is de wrapperhoogte minus de zichtbare subtitel en 7 pixels tussenruimte; bij lege subtitel vervalt die aftrek. De subtitel kan zo nodig tot 9 verkleinen om binnen 30 pixels hoogte te passen. Neem de volledige v8-CSS en fitfunctie over; eerdere 104/112-headerhoogtes en Permanent Marker-regels zijn historisch.

## Beweging en behouden gedrag

De v7-tijdlijn uit `11-MOTION-V7.md` blijft gelden: achtergrond, kopcontainer, daadwerkelijke bovenliggende inhoudscontainers en footer. De dubbele tekst in de kop beweegt samen als één kopcontainer. Pauze/reduced motion, replay, vaste zes slots, bezoekersfit en begrensde eigen standrij blijven gelden. De grotere kop moet in beide thema’s en oriëntaties met alle families passen.

## Menu Studio in de aparte VeyoCast UI-Site

De aparte VeyoCast UI-Site is op route `/dashboard/studio/menu` afgestemd op dezelfde vormgeving, met een afgebakende renderer en Menu-bediening. De gepubliceerde Menu Studio-broncommit is `77eec81092ab829302dd835fb430161fe93be220` (Site-versie18). De32 geselecteerde bron-/assetbestanden staan in `referenties/menustudio/broncode/`, met eigen hashes in `inventaris/menustudio-source.json`. Dit is een gerichte ontwerp-/codereferentie met lokale imports; geen zelfstandige volledige applicatie. De vier actuele voorbeelden en het browserbewijs staan in `referenties/menustudio/voorbeelden/menu-studio/`. De preview is geen bewijs dat de productie-repository, contracten, Worker of Player al aangepast zijn. Koppel de uiteindelijke Menu-bediening aan bestaande toegestane menu-/prijsgegevens en authoringregels; sla geen demoproducten of prijzen als tenantinhoud op.

## Definitieve voorbeelden en validatie

V8 is de historische font-/subtitelwijziging, bron `10c1c2572c2bcf16c14a271166d74faf889a4a85`. De uiteindelijke160 layoutopnamen in dit pakket zijn allemaal nieuwe v9-captures van `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`:144basisbeelden en16bezoekersdetails. Ze tonen ook de gewijzigde binnenkoppen en verjaardagskaarten. De vier Menu Studio-beelden hebben hun eigen bronidentiteit `77eec81092ab829302dd835fb430161fe93be220`.

Het originele browserbewijs bevat72voorafgaande familie-/oriëntatiechecks en160daadwerkelijke framecontroles. De uitgevoerde checks en hun grenzen staan in `09-VALIDATIE.md`; de volledige inventaris en hashes staan in het manifest. De drie v7-motionbeelden zijn alleen historisch bewijs van de behouden entreevolgorde en gelden niet als huidige typografiereferentie. VeyoCast-productietests zijn niet uitgevoerd.
