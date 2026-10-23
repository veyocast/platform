# Data en motion: implementatievoorstel met uitvoerbare voorbeelden

De bestaande repo is gelezen, maar de types hieronder zijn **een voorstel voor de nieuwe versie**, geen reeds bestaande VeyoCast-API. Pas ze binnen de bestaande contracts, canonical snapshots en verified assetrefs in. `03-REPO-INTEGRATIE.md` beschrijft welke bestaande projecties momenteel feiten verliezen.

## Rijke gegevens behouden

| Scène | Benodigde getypeerde feiten | Bronregel |
| --- | --- | --- |
| Stand | rowId, teamId, naam, logoRef, positie, played/won/drawn/lost/goalDifference/points, vorm, gecontroleerde eigen identiteit | Ontbrekende statistieken blijven null; niet uit punten verzinnen |
| Wedstrijd/ontvangst | matchId, home/away clubId en teamId, namen, beide logoRefs, kickoffAt, genormaliseerde status, veld, homeRoom/awayRoom | Eigen thuiswedstrijd op ID en tijd selecteren, vóór limiteren |
| Jarigen | Toegestane voornaam en achternaaminitiaal/displaynaam, datumlabel, nullable leeftijd, toegestane team/rol | Bestaande privacy-/tenantfilters blijven gelden |
| Activiteiten/agenda | itemId, titel, tekst, datum/tijd, locatie, optionele imageRef | Individuele afbeeldingen behouden in projectie en assetset |
| Nieuws/verhaal | itemId, kop, intro, bron/URL en heroImageRef | Bestaande bron- en rechtencontrole behouden |
| Matchday | Resultaten, volledige stand en programma uit één geselecteerde team/poule/seizoencontext | Gevalideerde samengestelde snapshot; renderer haalt geen providers op |

Gebruik de bestaande verified assetrefvorm van de repo, niet een nieuw vrij URL-veld. Een ontbrekend uitlogo krijgt geen Duindorp-crest als vervanging. Collecteer ook assets die diep in nieuwe rij-/kaartvelden zitten en controleer hun checksums in Worker en Player.

De oude rij van vier strings blijft voor legacydocumenten geldig. Voeg de rijke gegevens versiegebonden toe; parse geen namen, leeftijden, statussen of tijdstippen terug uit samengevoegde displaystrings. Voeg licht/donker als expliciete gevalideerde presentatiekeuze toe.

## Scheiding van configuratie en bronfeiten

Een ontwerp bewaart toegestane bronselecties, oriëntatie, modus, achtergrond, snelheid, **bewerkbare subtitel en titel per slide** en **bezoekersschaal** naast overige authoringopties. Het bewaart geen zelf gekopieerde Sportlinkstand of verzonnen bronfeiten in de seed. Een gekoppelde preview en publicatie projecteren de toegestane canonical snapshot. Laat `syncDynamicConfigurationSchema` en de bestaande feitenblokkade intact.

De v6-kopcontainer en bezoekersschaal zijn op 23 oktober 2026 aan de ontwerpbesluiten toegevoegd. V8 voegt de bewerkbare subtitel toe: de maps `headerSubtitles` en `headerTexts` blijven per familie onafhankelijk bewaard. In productie horen ze per opgeslagen slide/ontwerp in de authoring-/revisionflow; bronrefresh mag ze niet vervangen. De standaard bezoekersschaal is 150% van de v5-basis en raakt de crest, bezoekersnaam en `Van harte welkom`, niet alle kaartvelden. De slider `WELKOMSBLOK` (`Grootte bezoekerslogo en welkomstekst`) heeft bereik 100–200%, stap 5 en standaard 150%; dezelfde bewaarde waarde geldt voor `visitors` en `welcome`. De werkelijk getoonde schaal is het minimum van de gevraagde schaal, beschikbare breedte / natuurlijke breedte en beschikbare hoogte / natuurlijke hoogte van de v5-identiteitsgroep. Bewaar de gevraagde waarde als configuratie en bereken de fit per layout. Gebruik deze configuratie identiek in preview, Worker en Player, en neem wijzigingen mee in de passende configuratie-/capture-identiteit.

Render subtitel en titel als tekst via de bestaande React-/SSR-laag. Bewaar de bedoelde tekst bij opslaan en herladen; voer geen HTML, script, inline CSS of entiteitsdecodering als markup uit. Beide velden hebben maximaal 120 tekens. Standaardtitel is `family.label`, standaardsubtitel `Duindorp SV · ${family.group}`; lege invoer blijft leeg. `Standaard herstellen` herstelt beide velden van alleen de huidige familie. De bediening `SLIDEHEADER` gebruikt `Headertekst` (aria `Headertekst van deze slide`) en `Subtitel boven de kop` (aria `Subtitel van deze slide`). De prototypeopslag gebruikt sleutel `onzetrots-studio`. Valideer deze tekst- en schaalregels formeel, zonder bestaande bronfeiten in de seed toe te laten.

De aantallenknoppen voor welkom en de 0–6-dropdowns voor grids zijn prototypebediening. In productie volgen de aantallen de bron. Boven zes jarigen/activiteiten worden pagina’s met zes slots gevormd, inclusief lege restslots op de laatste pagina. Een stand blijft één doorlopende ranglijst.

## V9: inhoudelijke gegevens behouden bij vereenvoudiging

De extra `.panel-head`-secties vervallen in de presentatie voor alle niet-matchday-families; dit verwijdert geen brongegevens. Matchday behoudt precies drie binnenkoppen voor de drie deelpanelen. Semantische contextstroken, tabelkolomlabels en daadwerkelijke feature-inhoudstitels blijven bestaan. Bouw dit expliciet in de gedeelde renderer in; geen generieke verwijdering van alle headings.

Verjaardagsinhoud blijft getypeerd: datum, toegestane voornaam + achternaaminitiaal, nullable leeftijd en teaminformatie. De kaart projecteert datum linksboven groter, daarna felicitatie met naam, daarna leeftijd in Rubik Distressed 400 en teaminfo. Vorm `Sam K.` uit toegestane bronvelden of een al gevalideerde displaynaam; leid geen verborgen persoonsgegevens af en verzin geen ontbrekende achternaam. Bestaande privacyfilters blijven gelden.

## Deterministische beweging

`codevoorbeelden/reference-behavior.mjs` bevat dependencyvrije voorbeelden van:

- `selectUpcomingHomeFixtures`: identiteit, echte tijd, status, sortering, daarna max vier;
- `sixSlotPages`: zes stabiele posities, inclusief nul items en vervolgpaginering;
- `rankScrollAt`: dezelfde heen-en-terug-scrollpositie voor dezelfde elapsedMs;
- `pinnedOwnRowY`: begrensde eigen rij zonder dubbele kopie.

De bestanden zijn bedoeld om te begrijpen en te testen, niet om ongecontroleerd als productiepatch te kopiëren. De fixture in `welcome-fixtures.json` is synthetisch en gebruikt uitsluitend voorbeeld-ID’s. De status in dit voorbeeld is al genormaliseerd tot `scheduled`, `cancelled`, `postponed` of `finished`; de echte provideradapter moet de bronstatussen naar het bestaande canonical model vertalen.

Voor een scrollbereik M, snelheid v en pauze p=2,5 seconden duurt een cyclus `2*M/v + 2*p`. Begin op nul, wacht p, beweeg met v naar M, wacht p, beweeg terug naar nul. Bij M=0 blijft de positie nul. Rustig/standaard/snel zijn respectievelijk 19/30/48 logische pixels per seconde.

De zichtbare positie van de eigen rij is:

```text
clamp(normaleRijY - scrollY, 0, vensterhoogte - rijhoogte)
```

Een alternatieve renderer mag CSS sticky of expliciete lay-out gebruiken, zolang de compositie hetzelfde is. Bij een laatste plaats moet de rij vanaf het begin aan de onderrand zichtbaar zijn, ook wanneer haar normale positie buiten het eerste venster ligt. De beginpositie van de eerste plaats is de bovenrand.

## V7-entree behouden in v8: tijd en expliciete toestand

`stageEntrance(screen)` selecteert binnen `.slide-content` de semantische inhoudscontainers `.panel`, `.photo-panel`, `.pitch`, `.goal-scene` en `.video-layout`. Containers met een andere semantische inhoudscontainer als voorouder krijgen geen eigen extra stagger. De overblijvende bovenliggende containers krijgen `scene-container`, een CSS-delay en tellen mee voor de footerdelay. Verborgen lege gridslots behoren niet tot deze selectie en tellen niet mee. De aparte kop en footer hebben hun eigen fase. Dit is de prototype-techniek; productie gebruikt gedeelde, getypeerde scene-/motionprojectie in alle renderpaden.

Met nulgebaseerde paneelindex i en n daadwerkelijke bovenliggende panelen:

- Achtergrond: start 0 s, duur 0,85 s, opacity 0 → 0,95 licht / 0,6 donker, scale 1,025 → 1.
- Kop: start 1,25 s, duur 0,65 s, opacity 0 → 1, translateY −16 → 0 en blur 3 → 0.
- Paneel i: start `2,1 + i × 0,12` s, duur 0,65 s, opacity 0 → 1, translateY 24 → 0, scale 0,985 → 1 en blur 4 → 0.
- Footer: start `2,6 + max(0, n−1) × 0,12` s, duur 0,4 s; bij nul panelen blijft de start 2,6 s.

De exacte easing en bronankers staan in `11-MOTION-V7.md`. Neem de entree en de bestaande gegevensbeweging op in de gedeelde deterministische projectie. Voor dezelfde elapsedMs, layout, inhoud en scène-toestand moeten preview, Worker en Player hetzelfde frame opleveren. De bestaande generieke exporttransition is hiervoor geen vervanging.

Pauze en reduced motion tonen de complete eindcompositie. Pauzeren markeert de intro als voltooid (`intro-finished`); hervatten hervat gegevensbeweging zonder die entree opnieuw te starten. Een nieuwe render/familie en expliciete replay starten een nieuwe scène. `replayScene()` zet beweging aan tenzij reduced motion actief is en rendert opnieuw. Een tijdelijke `scene-reset` met geforceerde reflow reset ook de behouden achtergrond-pseudo-elementanimatie; replay begint daardoor werkelijk bij het eerste achtergrondframe. De basisstijl van `scene-container` heeft `animation: none`, zodat ook fotografie, veld, goal en video bij pauze/reduced motion compleet en stil worden getoond. Deze bedieningsactie is geen opgeslagen bronfeit of nieuwe publicatierevisie op zichzelf.

## Eén tijdmodel voor alle renderpaden

De prototypebron gebruikt rAF en timers om dit browsergedrag te demonstreren. De productie-implementatie moet de tijdprojectie delen tussen DOM-preview, moderne Player en Worker. Stel elapsedMs expliciet vast; laat geen wall-clocktimer de inhoud van een exportframe bepalen.

De Worker moet voor frame t opnieuw de interne scène op t projecteren. De huidige algemene `document.getAnimations()`-freeze en `settledPng`-hergebruik leveren dit gedrag niet op. Gebruik voor bewegende scènes een framecache-identiteit die interne tijd, inhoud, assets, oriëntatie en relevante layout omvat. Behoud de strenge capture-CSP; geen prototype-JS injecteren of eval gebruiken.

Pauze bevriest de actieve tijd voor gegevensbeweging; hervatten heeft geen inhaalsprong. Voor de v7-entree geldt de aparte voltooiingsregel hierboven: pauze toont het complete eindbeeld en hervatten herstart de intro niet. Voor gegevensbeweging telt tijd in een verborgen tabblad niet mee; dit is geen bewering dat de CSS-intro van het prototype daarbij ook wordt bevroren. Reduced motion geeft een leesbare stilstaande scène en behoudt normale handmatige bediening. Geen-scrollbereik, lege data en ontbrekende eigen rij moeten expliciete veilige uitkomsten hebben.

De bestaande uitvoerbare voorbeelden testen selectie, slots en de zuivere ranglijstregels, niet automatisch de nieuwe v7-entree. De volledige introtijdlijn en pauze/replay/reduced-toestanden vereisen aanvullend framebewijs. Ze bewijzen niet dat de huidige VeyoCast-export of Player al correct werkt. Dat bewijs moet in de implementatie-PR volgen met gelijk getimede preview-/exportframes en een complete fallbackvideo.
