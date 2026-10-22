# 06 — Complete slidecatalogus

Deze catalogus bevat alle **36 bestaande VeyoCast-families** en hun goedgekeurde OnzeTrots-presentatie. De family-ID’s blijven gelijk. Iedere familie heeft een lichte en donkere variant, in 16:9 en 9:16: samen 144 basiscombinaties.

De bronfamilies zijn opnieuw gecontroleerd in veyocast/platform op main-commit **3bbb51ac006bbaf8381a11d5dcfd7024d13d3876**. De referentiecode staat in broncode/. De huidige backendmapping en de gewenste doelcompositie zijn hieronder bewust apart benoemd: de visuele goedkeuring maakt de fictieve voorbeelddata niet tot productiegegevens.

Machineleesbare versies: inventaris/slide-catalogus.json en inventaris/slide-catalogus.csv. Voor de repository-ingrepen, versies, assetveiligheid, Worker-motion en migraties: 03-REPO-INTEGRATIE.md.

## Gemeenschappelijke regels

- Geen tweede buitenheader boven de containers. Iedere inhoudscontainer heeft zijn eigen relevante header en het eigen clublogo rechts.
- Herkenningsfoto’s van Houtrust, de wijk en de kust als achtergrond, met goedgekeurde brush/grunge en echte lettertypen. Licht/donker is een expliciete productiepresentatiekeuze.
- Kleine witte OnzeTrots-signatuur rechtsonder, circa 126×42 referentiecanvas-eenheden, donkere dropshadow, transparant zonder backing, met ondertitel.
- Logo’s en foto’s komen uit geverifieerde tenant-/systeemassets. Eigen clublogo’s, bezoekerslogo’s, sponsorlogo’s en sfeerfoto’s blijven semantisch gescheiden.
- Alle data-, identiteit-, privacy-, rechten- en publicatieregels van de bestaande repo blijven gelden. Geen providerverkeer in de renderer of Player.
- Voorbeelden, selectors en lokale demo-acties zijn referentiebediening. Alleen bestaande geautoriseerde bronfeiten worden in productie getoond.

## Overzicht van alle families

| Nr. | Family-ID | Naam | Doelcompositie | Huidige gekoppelde bron |
| --- | --- | --- | --- | --- |
| 01 | fixtures | Programma | Clubprogramma met wedstrijdkaarten | sport_program |
| 02 | results | Uitslagen | Clubuitslagen met scorekaarten | sport_results |
| 03 | period-standings | Periodestand | Doorlopende periodestand | sport_period_standing |
| 04 | cancellations | Afgelastingen | Afgelastingen in tabelcontainer | sport_cancellations |
| 05 | dressing-rooms | Kleedkamers | Kleedkamers en veldindeling | sport_dressing_rooms |
| 06 | officials | Officials | Wedstrijdofficials in tabel | sport_officials |
| 07 | team-info | Teaminformatie | Teamfoto met informatiecontainer | sport_team |
| 08 | activities | Clubactiviteiten | Zes vaste activiteitkaarten | sport_activities |
| 09 | training | Trainingen | Trainingstabel | sport_trainings |
| 10 | volunteers | Vrijwilligers | Vrijwilligers en diensten | sport_volunteers |
| 11 | visitors | Bezoekende teams | Bezoekerkaarten voor komende thuiswedstrijden | sport_visitor_arrivals |
| 12 | matchday | Onze wedstrijddag | Drie containers: uitslagen, stand en programma | sport_match_of_the_day |
| 13 | club-program | Clubprogramma | Programma van de eigen club | sport_program |
| 14 | team-program | Teamprogramma | Programma van één team | sport_program |
| 15 | pool-program | Pouleprogramma | Programma van een poule | sport_program |
| 16 | club-results | Clubuitslagen | Uitslagen van de eigen club | sport_results |
| 17 | team-results | Teamuitslagen | Uitslagen van één team | sport_results |
| 18 | pool-results | Pouleuitslagen | Uitslagen van een poule | sport_results |
| 19 | standings | Competitiestand | Volledige bewegende competitiestand | sport_standing |
| 20 | team-arrivals | Teamontvangst | Ontvangsttabel voor teams | sport_visitor_arrivals |
| 21 | welcome | Welkomstscherm | Welkomstkaarten met bezoeker centraal | Handmatige Studio-inhoud |
| 22 | referees | Scheidsrechters | Scheidsrechterontvangst | sport_referee_arrivals |
| 23 | changing-rooms | Kleedkamerindeling | Kleedkamerindeling | sport_dressing_rooms |
| 24 | next-match | Volgende wedstrijd | Grote volgende wedstrijd | sport_next_match |
| 25 | birthdays | Verjaardagen | Zes vaste verjaardagskaarten | sport_birthdays |
| 26 | lineup | Teamopstelling | Voetbalveld met opstelling en informatie | Handmatige Studio-inhoud |
| 27 | scoreboard | Live scorebord | Live scorebord met chip boven score | ledscores_live_match |
| 28 | goal | Doelpunt | Doelpuntmoment met show-effecten | ledscores_live_match |
| 29 | menu | Kantinemenu | Kantinemenu en promotiecontainer | menu, price_list |
| 30 | engage | Publieksactie | Publieksactie met resultaten | Openbare Engage-campagne |
| 31 | rss | Nieuws & RSS | Nieuws met foto en tekstcontainer | news |
| 32 | sponsors | Onze partners | Sponsorlogo’s in partnercontainer | sport_sponsor |
| 33 | agenda | Clubagenda | Zes vaste agendakaarten | sport_activities |
| 34 | club-story | Clubverhaal | Clubverhaal met fotografie | Handmatige Studio-inhoud |
| 35 | youtube | YouTube | Video- of offline mediakaart | Handmatige Studio-inhoud |
| 36 | free | Vrij ontwerp | Vrije clubcompositie | Handmatige Studio-inhoud |

## Gedetailleerde mapping per familie

De helpernamen verwijzen exact naar de goedgekeurde referentiecode in broncode/. In de repository moeten dit pure React-/typed-presentatiecomponenten worden binnen de bestaande Sync-keten. Kopieer geen demo-state, postprocessing, localStorage of willekeurige voorbeeldberekeningen als productiedata.

### 01 — Programma

- **Family-ID / groep:** fixtures / Sport.
- **Referentie:** matchPanel('club').
- **Brongegevens:** Geselecteerde eigen teams, echte tegenstanders, aftrap, datum, thuis/uit, veld en twee logo’s.
- **Gedrag:** Eén container met gepagineerde kaarten; thuiswedstrijden herkenbaar en uitwedstrijden licht gemarkeerd.
- **Integratiegrens:** Voorbeeldwedstrijden komen uit matchRows; in productie de bestaande gecontroleerde selectie gebruiken.

### 02 — Uitslagen

- **Family-ID / groep:** results / Sport.
- **Referentie:** matchPanel('club', true).
- **Brongegevens:** Eigen-teamsselectie, gespeelde wedstrijden, officiële uitslagen, datum, thuis/uit en beide clublogo’s.
- **Gedrag:** Zelfde kaartfamilie als programma, met echte score per team en consistente paginering.
- **Integratiegrens:** Demoresultaten zijn voorbeelddata; geen afgeleide of willekeurige scores publiceren.

### 03 — Periodestand

- **Family-ID / groep:** period-standings / Sport.
- **Referentie:** ranking(true).
- **Brongegevens:** Gekozen periode, eigen team-ID, complete poule, positie, gespeeld, W/GL/V, saldo, punten, vorm en rijlogo.
- **Gedrag:** Eigen rij beweegt mee en blijft begrensd aan boven-/onderrand; overige clubs scrollen door; eigen periodegegevens gebruiken.
- **Integratiegrens:** Prototype simuleert standen en een testpositie; echte statistieken mogen niet uit punten worden teruggerekend.

### 04 — Afgelastingen

- **Family-ID / groep:** cancellations / Sport.
- **Referentie:** cancellationScene().
- **Brongegevens:** Echte status, aftrap, betrokken teams, veld en eigen sportpark; alleen relevante afgelastingen.
- **Gedrag:** Waarschuwingscontext boven duidelijke rijen; eerlijke lege toestand als alles doorgaat.
- **Integratiegrens:** De melding over veldomstandigheden is voorbeeldinhoud.

### 05 — Kleedkamers

- **Family-ID / groep:** dressing-rooms / Sport.
- **Referentie:** roomScene(false, true).
- **Brongegevens:** Wedstrijd-ID, aftrap, teams, eigen veld en afzonderlijke thuis-/uitkleedkamers.
- **Gedrag:** Eén tabelcontainer met eigen header en clublogo rechts; verwijst uitsluitend naar het eigen sportpark.
- **Integratiegrens:** De rijplanning en kamernummers zijn demonstratiegegevens.

### 06 — Officials

- **Family-ID / groep:** officials / Sport.
- **Referentie:** peopleScene().
- **Brongegevens:** Toegestane officialnamen, rol, toewijzing, tijd, wedstrijd en veld.
- **Gedrag:** Operational overzicht van coördinatie en wedstrijdleiding, met bestaande privacykeuzes.
- **Integratiegrens:** Fictieve namen illustreren de vormgeving; geen voorbeeldpersonen als echte officials opslaan.

### 07 — Teaminformatie

- **Family-ID / groep:** team-info / Sport.
- **Referentie:** teamScene() / feature().
- **Brongegevens:** Geselecteerd team, geverifieerde teamfoto, seizoen, competitie en toegestane teaminformatie.
- **Gedrag:** Fotopaneel naast eigen tekstcontainer; één containerheader, geen tweede canvasheader.
- **Integratiegrens:** Teambeeld en beschrijving zijn visuele voorbeelden; echte tenantmedia en gegevens binden.

### 08 — Clubactiviteiten

- **Family-ID / groep:** activities / Club.
- **Referentie:** eventScene(false) / fixedSixSlots().
- **Brongegevens:** Activiteit-ID, datum/tijd, titel, korte omschrijving, locatie en optionele gecontroleerde foto.
- **Gedrag:** Altijd 3 kolommen × 2 rijen, ook portrait; lege slots blijven leeg; >6 records vervolgen op volgende pagina.
- **Integratiegrens:** 0–6-selector en zes events zijn displayfixtures, geen productielimiet op bronselectie.

### 09 — Trainingen

- **Family-ID / groep:** training / Sport.
- **Referentie:** trainingScene().
- **Brongegevens:** Eigen team-ID, trainingsdag/tijd, veld, trainer en eindtijd.
- **Gedrag:** Rustige tabel met dezelfde containerheader; eigen sportpark en actuele planning.
- **Integratiegrens:** De dinsdagplanning is een voorbeeld.

### 10 — Vrijwilligers

- **Family-ID / groep:** volunteers / Club.
- **Referentie:** peopleScene(true).
- **Brongegevens:** Toegestane namen, taak, diensttijd, locatie en eventuele open taakmelding.
- **Gedrag:** Praktische dienstenlijst; eigen clublogo in header; privacy en toegestane publicatie blijven gelden.
- **Integratiegrens:** Voorbeeldnamen en diensten niet als echte vrijwilligers registreren.

### 11 — Bezoekende teams

- **Family-ID / groep:** visitors / Sport.
- **Referentie:** welcomeScene().
- **Brongegevens:** Stabiele match-/club-/team-ID’s, kickoffAt, status, beide namen, bezoekerslogo, veld en twee kleedkamers.
- **Gedrag:** Maximaal vier eerstvolgende eigen thuiswedstrijden; groot alleen bezoekerslogo; volledige wedstrijd apart; 1/2/3/4-composities.
- **Integratiegrens:** De voorbeeldteller toont alleen lay-outvarianten; echte records via bronfilter, niet via een productie-demoaantal.

### 12 — Onze wedstrijddag

- **Family-ID / groep:** matchday / Sport.
- **Referentie:** matchPanel('pool', true, true) + ranking(false, true) + matchPanel('pool', false, true).
- **Brongegevens:** Samengestelde gecontroleerde set met vorige pouleuitslagen, volledige poulestand en volgende pouleprogramma bij hetzelfde eigen team/seizoen.
- **Gedrag:** Landscape drie containers; portrait herschikt volgens referentie; middenstand houdt eigen team zichtbaar.
- **Integratiegrens:** Huidig sport_match_of_the_day levert slechts één wedstrijd; nieuwe composite snapshotprojectie is noodzakelijk.

### 13 — Clubprogramma

- **Family-ID / groep:** club-program / Sport.
- **Referentie:** matchPanel('club').
- **Brongegevens:** Alle geselecteerde eigen teams, echte thuis-/uitwedstrijden, datums, tijden, velden en clublogo’s.
- **Gedrag:** Scope blijft clubbreed; gepagineerde kaarten delen de Programma-compositie.
- **Integratiegrens:** De gedeelde helper maakt deze variant visueel verwant aan fixtures; bronselectie blijft expliciet clubbreed.

### 14 — Teamprogramma

- **Family-ID / groep:** team-program / Sport.
- **Referentie:** matchPanel('team').
- **Brongegevens:** Eén gekozen eigen team en komende wedstrijden uit diens juiste competitie-/seizoencontext.
- **Gedrag:** Chronologische teamkaarten met thuis/uit en beide logo’s; geen andere eigen teams invoegen.
- **Integratiegrens:** Voorbeeldkalender is geen echte wedstrijdagenda.

### 15 — Pouleprogramma

- **Family-ID / groep:** pool-program / Sport.
- **Referentie:** matchPanel('pool').
- **Brongegevens:** Gekozen teamcontext, competitie/poule, seizoen en alle wedstrijden van die poule.
- **Gedrag:** Poulebrede kaarten; eigen wedstrijden herkenbaar, overige poulewedstrijden blijven zichtbaar.
- **Integratiegrens:** Niet beperken tot alleen eigen wedstrijden: juist deze familie is poulebreed.

### 16 — Clubuitslagen

- **Family-ID / groep:** club-results / Sport.
- **Referentie:** matchPanel('club', true).
- **Brongegevens:** Alle geselecteerde eigen teams en hun gepubliceerde uitslagen.
- **Gedrag:** Clubbrede scorekaarten; dezelfde componentfamilie als results, eigen bron-/periodekeuze bewaren.
- **Integratiegrens:** Demo-uitslagen niet als officiële data gebruiken.

### 17 — Teamuitslagen

- **Family-ID / groep:** team-results / Sport.
- **Referentie:** matchPanel('team', true).
- **Brongegevens:** Eén eigen team, gespeelde wedstrijden en officiële score per tegenstander.
- **Gedrag:** Teamgebonden terugblik met datums, beide logo’s en paginering.
- **Integratiegrens:** Geen toekomstige demoafspraken of verzonnen uitslagen bewaren.

### 18 — Pouleuitslagen

- **Family-ID / groep:** pool-results / Sport.
- **Referentie:** matchPanel('pool', true).
- **Brongegevens:** Volledige gekozen poule, eigen teamcontext, seizoen, datum en gepubliceerde scores.
- **Gedrag:** Alle pouleuitslagen tonen; eigen wedstrijd uitlichten.
- **Integratiegrens:** Geen automatische clubbrede selectie in plaats van poule.

### 19 — Competitiestand

- **Family-ID / groep:** standings / Sport.
- **Referentie:** ranking().
- **Brongegevens:** Eigen team-ID en alle getypeerde officiële statistieken, vorm en clublogo’s uit de juiste poule.
- **Gedrag:** Volledige lijst scrollt; eigen teamrij plakt aan boven-/onderrand; gedeeld uitgelijnde kolommen en om-en-om rijen.
- **Integratiegrens:** Bronprojector moet verder gaan dan huidige vierstringstand; nulstatistieken niet verzinnen.

### 20 — Teamontvangst

- **Family-ID / groep:** team-arrivals / Sport.
- **Referentie:** roomScene(true).
- **Brongegevens:** Bestaande geautoriseerde arrival-windowselectie, aankomst/aftrap, team, veld en kleedkamer.
- **Gedrag:** Praktische ontvangsttabel; dit blijft een eigen familie naast de grote visitor-kaarten.
- **Integratiegrens:** Gebruik de juiste aankomstvelden; niet automatisch dezelfde 1–4 visitor-compositie forceren.

### 21 — Welkomstscherm

- **Family-ID / groep:** welcome / Sport.
- **Referentie:** welcomeScene().
- **Brongegevens:** Voor nieuwe OnzeTrots-versie dezelfde gecontroleerde upcoming-home fixturefacts als visitors.
- **Gedrag:** Dezelfde bezoekerkaarten en filter als visitors; geen reusachtig eigen clublogo als hoofdbeeld.
- **Integratiegrens:** Bestaande algemene welcome is handmatig; nieuwe live arrival-binding expliciet versiegebonden toevoegen.

### 22 — Scheidsrechters

- **Family-ID / groep:** referees / Sport.
- **Referentie:** peopleScene(false, true).
- **Brongegevens:** Geautoriseerde arbiters, rol, toewijzing, wedstrijd, aftrap en veld.
- **Gedrag:** Heldere ontvangstrijen en één clubheader; bestaande selectie-/privacyfilters volgen.
- **Integratiegrens:** Geen fictieve arbiter als echte naam vastleggen.

### 23 — Kleedkamerindeling

- **Family-ID / groep:** changing-rooms / Sport.
- **Referentie:** roomScene().
- **Brongegevens:** Wedstrijd, team, thuis/uit, eigen veld en aparte kleedkamers.
- **Gedrag:** Praktische locatiecontainer; variant van dressing-rooms met eigen kop/context.
- **Integratiegrens:** Kamernummers uit de referentie blijven voorbeelden.

### 24 — Volgende wedstrijd

- **Family-ID / groep:** next-match / Sport.
- **Referentie:** matchHero('next-match').
- **Brongegevens:** Geselecteerd eigen team, eerstvolgende echte tegenstander, beide logo’s, datum, tijd en locatie.
- **Gedrag:** Ruime wedstrijdcontainer met beide crests en aparte aftrap; headerlogo rechts.
- **Integratiegrens:** Voorbeeld Quick Steps/14:30 niet hardcoderen in productie.

### 25 — Verjaardagen

- **Family-ID / groep:** birthdays / Sport.
- **Referentie:** birthdays() / fixedSixSlots().
- **Brongegevens:** Alleen privacytoegestane displaynaam, leeftijd indien toegestaan/bekend, team/meta en datumlabel.
- **Gedrag:** Vast 3×2 in beide oriëntaties; één datum-/clublogoheader, grote leeftijd, naam en team; lege slots blijven staan.
- **Integratiegrens:** Zes unieke voorbeeldnamen en 0–6-selector uitsluitend voor demo; geen geboortegegevens toevoegen zonder bestaande toestemming.

### 26 — Teamopstelling

- **Family-ID / groep:** lineup / Sport.
- **Referentie:** lineupScene().
- **Brongegevens:** Opgeslagen teamopstelling, rugnummers, toegestane spelersnamen, wissels, aanvoerder, keeper en matchcontext.
- **Gedrag:** Veldvisual met naast/onder informatiecontainer; echte opstelling niet uit demo invullen.
- **Integratiegrens:** Sync heeft geen directe sport-lineup dynamische mapping; bestaand handmatig Studio-document is leidend.

### 27 — Live scorebord

- **Family-ID / groep:** scoreboard / Sport.
- **Referentie:** matchHero('scoreboard').
- **Brongegevens:** Geautoriseerde LED Scores-matchState, teams, frozen logo’s, score, klok, fase, staleAfter en showClock.
- **Gedrag:** Blauwe LIVE/tijdchip boven score; bestaande aftrap/live/rust/eindstand en pauze volgen.
- **Integratiegrens:** Demoscoreknoppen, 63:24 en vaste teamnamen zijn referentiebediening, geen live integratie.

### 28 — Doelpunt

- **Family-ID / groep:** goal / Sport.
- **Referentie:** goalScene().
- **Brongegevens:** Bestaand geautoriseerd goal-event, scorende zijde, actuele score, team en eventuele toegestane scorerinformatie.
- **Gedrag:** Grote goal-uiting, score en vloeiende effecten; interne motion ook in MP4/fallback deterministisch samplen.
- **Integratiegrens:** Prototype verhoogt alleen voorbeeldscore; productie moet echte eventbinding behouden.

### 29 — Kantinemenu

- **Family-ID / groep:** menu / Kantine.
- **Referentie:** menuScene().
- **Brongegevens:** Gecontroleerde producten/categorieën, echte prijzen, omschrijvingen en optionele eigen promotie.
- **Gedrag:** Twee menukolommen plus losse promotiecontainer in goedgekeurde stijl; prijsbron en valuta bewaren.
- **Integratiegrens:** Voorbeeldprijzen of €3,50-promo nooit overschrijven op bestaande Twelve-/handmatige producten.

### 30 — Publieksactie

- **Family-ID / groep:** engage / Club.
- **Referentie:** pollScene().
- **Brongegevens:** Gecontroleerde openbare campagne, antwoord-ID’s, getoonde stemtotalen en campagnevisibility.
- **Gedrag:** Pollcontainer met duidelijke resultaten en clubaside; productie gebruikt bestaande echte campagneflow.
- **Integratiegrens:** Prototypeknoppen wijzigen voorbeeldpercentages; die logica nooit als echte stemmen of openbaarmaking kopiëren.

### 31 — Nieuws & RSS

- **Family-ID / groep:** rss / Club.
- **Referentie:** newsScene(false) / feature().
- **Brongegevens:** Echte canonical feedartikelen, titel, intro, source, URL en verified hero-image waar aanwezig.
- **Gedrag:** Fotopaneel en nieuwscontainer, artikelwisseling/paginering en bestaande QR/leesroute behouden.
- **Integratiegrens:** Walking Football- en weekendcopy zijn referentieartikelen, geen ingestfallback.

### 32 — Onze partners

- **Family-ID / groep:** sponsors / Club.
- **Referentie:** sponsorScene().
- **Brongegevens:** Actieve tenantgebonden sponsor-/campagneselectie, goedgekeurde logo’s en zichtbare sponsoridentiteit.
- **Gedrag:** Logo’s duidelijk in raster, eigen clublogo rechts in containerheader; bron-/campagnebeleid blijft gelden.
- **Integratiegrens:** De zes referentielogo’s zijn assets voor Duindorpvoorbeeld, geen verzonnen platformklanten.

### 33 — Clubagenda

- **Family-ID / groep:** agenda / Club.
- **Referentie:** eventScene(true) / fixedSixSlots().
- **Brongegevens:** Echte activiteit-ID’s, kalenderdatum/tijd, titel, intro, locatie en optionele verified foto.
- **Gedrag:** Zelfde vaste 3×2 als activities met agenda-context; 0–6 items laten identieke slots, >6 gaat verder op volgende pagina.
- **Integratiegrens:** Agenda en activities delen rendererhelper, maar behouden eigen familiekeuze en eigen demoteller.

### 34 — Clubverhaal

- **Family-ID / groep:** club-story / Club.
- **Referentie:** newsScene(true) / feature().
- **Brongegevens:** Eigen opgeslagen verhaal, tekst, bron-/beeldcaption en goedgekeurde eigen foto of museumbeeld.
- **Gedrag:** Groot beeld naast verhaalcontainer; duidelijke club-/historiecontext zonder buitenheader.
- **Integratiegrens:** De museumverhalen/foto’s zijn Duindorpvoorbeelden; geen automatische RSS-binding bestaat voor deze familie.

### 35 — YouTube

- **Family-ID / groep:** youtube / Media.
- **Referentie:** videoScene().
- **Brongegevens:** Bestaande opgeslagen YouTube-link en gevalideerde videoconfiguratie, eigen fallbackbeeld/tekst.
- **Gedrag:** Werkelijke video volgens bestaande online/offline flow; duidelijke fallback als video niet beschikbaar is.
- **Integratiegrens:** Prototype opent een YouTube-zoekpagina en speelt geen video: vervang bestaande integratie niet door die zoeklink.

### 36 — Vrij ontwerp

- **Family-ID / groep:** free / Vrij.
- **Referentie:** freeScene().
- **Brongegevens:** Eigen bewaarde tekst, goedgekeurde media/logo en toegestane Studio-opmaak.
- **Gedrag:** Vrije compositie in goedgekeurde OnzeTrots-stijl met één containerlogoheader en kleine footer.
- **Integratiegrens:** De vaste sloganplaat is één voorbeeld; behoud bestaande eigen-inhoudauthoring.

## Bestaande bronmappings en expliciete uitbreidingen

De huidige 21 type-naar-familiebindings staan in packages/contracts/src/sync-dynamic-configuration.ts. De huidige vierstringrijen en de projector in packages/content-templates/src/sync-dynamic-projector.ts leveren onvoldoende gegevens voor diverse goedgekeurde composities. Voeg versiegebonden rijke velden toe en behoud de legacydecoders.

- **matchday:** huidige sport_match_of_the_day is één wedstrijd. De drie containers uit het goedgekeurde prototype vereisen een samengestelde gecontroleerde snapshot met pouleuitslagen, stand en programma uit dezelfde eigen-team-/poule-/seizoencontext.
- **welcome:** huidige algemene welcome is handmatig en staat niet in sport_visitor_arrivals. De nieuwe live visitor-compositie voor welcome vraagt een expliciete versiegebonden binding; visitors is al aan sport_visitor_arrivals gekoppeld.
- **standings / period-standings:** de huidige Sync-projector bewaart alleen positie, naam, gespeeld en punten. W/GL/V, saldo, vorm en logo’s moeten getypeerd uit de bestaande bron worden meegenomen.
- **birthdays / activities / agenda:** vaste zes slots per pagina, met echte rijke gegevens; bij >6 vervolgpaginering. De zes fixtures en de 0–6-voorbeeldselectie vullen alleen demo-/testpreview.
- **engage:** wordt apart geprojecteerd door projectSyncEngageCampaign in packages/content-templates/src/sync-engage-projector.ts. Bestaande visibility en autoriteit over stemtotalen blijven leidend.
- **lineup / club-story / youtube / free:** behouden hun bestaande Studio-/mediaauthoring. Er is in de actieve syncDynamicFamilies geen aparte rechtstreekse dynamische binding voor deze families.

## Kritieke uitvoeringsvoorwaarden

De binnenkomsttransitie is niet dezelfde animatie als de scrollende ranglijst. De huidige sync-dom-capture bevriest interne animaties en hergebruikt settledPng. Bouw deterministische interne motion die preview, moderne Player en de Worker op dezelfde elapsedMs kunnen samplen, inclusief pauze/reduced-motion en complete MP4-fallback.

De CSS-output is gegenereerd uit een bevroren oude Source. Nieuwe stijlen moeten reproduceerbaar en versiegebonden worden toegevoegd. De bestaande schemagenerators overschrijven historische migraties; gebruik aangepaste generatie plus een nieuwe forwardmigratie. Bestaande SQL-bytes en historische rendereridentiteiten blijven behouden.

## Bronverantwoording

| Bewijs | Gecontroleerde bron |
| --- | --- |
| Alle 36 family-ID’s, namen, groepen, labels | packages/contracts/src/sync-content-families.ts |
| Huidige dynamische bindings | packages/contracts/src/sync-dynamic-configuration.ts |
| Huidige dataveldreductie | packages/content-templates/src/sync-dynamic-projector.ts |
| Huidige renderer en globale header | packages/content-templates/src/sync-slide-static-view.tsx |
| Publieke campagneprojectie | packages/content-templates/src/sync-engage-projector.ts |
| Huidige capture en motionbeperking | apps/media-worker/src/sync-dom-capture.tsx |
| Voorbeelddata blijft display-only | apps/control/app/(shell)/dashboard/studio/sync-template-preview.ts |
| Goedgekeurde presentatie en actuele helpermapping | broncode/ — oorspronkelijke referentiecode uit dit pakket |

De exacte Gitblob-identiteiten en leesstatus van de overige onderzochte repositorybestanden staan in inventaris/repo-integration-inventory.json. De openbare campagneprojector is aanvullend op dezelfde pinned ref gelezen. Deze catalogus verklaart geen VeyoCast-repotests of productiedeployment geslaagd; daarvoor gelden de afzonderlijke implementatie- en releasegates.

