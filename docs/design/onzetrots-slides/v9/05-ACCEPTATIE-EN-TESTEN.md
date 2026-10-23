# Acceptatie: goedgekeurde OnzeTrots-slides voor VeyoCast

Deze specificatie beschrijft het goedgekeurde gedrag van **v9-concept, bijgewerkt op 23 oktober 2026**, inclusief Rubik Distressed/subtitel uit `12-WIJZIGINGEN-V8.md`, de behouden entree uit `11-MOTION-V7.md` en de laatste vereenvoudiging/verjaardagskaart uit `13-WIJZIGINGEN-V9.md`. De aparte bewerkbare slidekop vervangt de eerdere regel zonder buitenheader. Gebruik de meegeleverde actuele broncode en de definitieve screenshots als visuele referentie. Dit document is een acceptatieopdracht voor de implementatie in de VeyoCast-repo; het is geen verklaring dat productie of de repo deze tests al heeft doorlopen.

## 1. Referentiekader en definitie van gereed

De overdracht geldt voor alle 36 slidefamilies in de meegeleverde `repo-inventory.json`. Het definitieve prototype staat op `https://veyocast-onzetrots-slides.dgwebserv.chatgpt.site`. Een oudere v5-screenshot zonder aparte kopcontainer, een achtergrondcontainer achter OnzeTrots, een driekaart-verjaardagenscherm of de klok onder de score is niet de eindreferentie.

Gereed betekent dat de actieve VeyoCast-preview, gerenderde media en Player dezelfde goedgekeurde compositie en functionele regels gebruiken. Alleen een vergelijkbaar voorbeeld in de editor is onvoldoende. Bestaande themakeuzes, tenantgrenzen, bronselecties, publicatieversies, rechten, live-data en fallbackgedrag moeten behouden blijven.

### Coördinaten en schermformaten

Het prototype tekent intern op een logisch canvas van 1600×900 (liggend) of 900×1600 (staand). De studio noemt de uitvoerformaten 1920×1080 en 1080×1920. Behoud bij een native 1080-render dezelfde verhoudingen: één logische pixel correspondeert met 1,2 uitvoerpixel. Het witte OnzeTrots-artwork van 126×42 logische pixels is dus ongeveer 151×50 uitvoerpixels bij een volledige 1080-uitvoer. Neem niet alleen losse CSS-getallen over zonder het coördinatenstelsel mee te nemen.

## 2. Gemeenschappelijke vormgeving

- Gebruik de originele clubachtergronden, het Duindorp-logo en het originele transparante OnzeTrots-artwork uit het pakket. Het herkenbare OnzeTrots-woordmerk is artwork, geen lettertype. Alle koppen gebruiken het daadwerkelijke lokale Rubik Distressed 400 met OFL-licentie; reguliere tekst gebruikt Manrope en compacte cijfers/teams gebruiken Barlow Condensed.
- Ondersteun de goedgekeurde lichte en donkere kleurvarianten en zowel 16:9 als 9:16. Behouw de drie herkenningsachtergronden: clubhuis/Houtrust, wijk/Meeuwenhof en kust/havenhoofd.
- Iedere slide heeft precies één aparte kopcontainer boven de inhoud. De tekst is per slide bewerkbaar; het eigen clublogo staat helemaal rechts in deze kop.
- Extra `.panel-head`-secties vervallen op alle niet-matchday-slides. Onze wedstrijddag behoudt precies drie binnenkoppen. Semantische context-/gegevensstroken, tabelkolomlabels en daadwerkelijke feature-inhoudstitels blijven bestaan. Generieke decoratieve eigen-clublogo’s worden daar niet herhaald. Behoud echte teamlogo’s in wedstrijden, standen en andere sportinhoud.
- De achtergrond blijft herkenbaar langs en gedeeltelijk door de containers. Het prototype gebruikt standaard 94% containerdekking, instelbaar van 80 tot 100%. Neem voor de eindreferentie de standaardwaarde over.
- De footer rechtsonder heeft uitsluitend het kleine witte OnzeTrots-artwork, donkere slagschaduw en de behouden regel `ONZE CLUB. ONZE TROTS.`. Er is geen achtergrondkleur, rand, afgeronde badge of paneelschaduw achter deze footer.

### Bewerkbare subtitel, titel en opslag

- `SLIDEHEADER` bevat `Subtitel boven de kop` (aria `Subtitel van deze slide`) en `Headertekst` (aria `Headertekst van deze slide`), elk maximaal 120 tekens. Standaardtitel is `family.label`, standaardsubtitel `Duindorp SV · ${family.group}`; leeg blijft leeg.
- In de referentiestudio houdt iedere familie een eigen subtitel en titel in de maps `headerSubtitles` / `headerTexts` in `localStorage`-sleutel `onzetrots-studio`. Wijzigen van familie A verandert de kop van familie B niet; terugwisselen en herladen bewaren de ingevoerde teksten.
- `Standaard herstellen` herstelt beide velden van alleen de huidige familie. Controleer dat aangepaste tekst van andere families blijft bestaan.
- In productie wordt de tekst per opgeslagen slide/ontwerp meegedragen door draft, opslaan, heropenen, revision, preview, export en Player. Een bronrefresh overschrijft authoringtekst niet.
- Speciale tekens zoals `&`, `<`, `>`, aanhalingstekens en tekst als `<img src=x onerror=alert(1)>` verschijnen als tekst. Ze maken geen HTML-elementen, netwerkverzoeken of uitvoerbare code.
- Test standaardkop, aangepaste korte tekst, 120 tekens en lege invoer. Leeg blijft ook na opslaan/herladen leeg. De tekst blijft binnen de kop en het logo blijft zichtbaar helemaal rechts, zonder overlap met de inhoud. De Rubik Distressed-titel begint op 42/38 logische pixels en kan tot 14 verkleinen binnen de resterende wrapperruimte van 88/92 na aftrek van subtitel en tussenruimte; gebruik de volledige geometrie uit `02-VISUELE-SPECIFICATIE.md`.
- Controleer alle 36 families in licht/donker en liggend/staand. Ook lege inhoud en een 0-itemgrid houden de aparte slidekop.

### V8-kop en daadwerkelijke fontlading

- Controleer in alle families Rubik Distressed 400 als werkelijk geladen kopfont, ook na offline voorbereiding en Worker-capture. Vergelijk geladen fontbytes/assetref; een zichtbare fallback is geen eindresultaat. Het originele witte woordmerk blijft artwork.
- Subtitel staat boven titel links, met crest helemaal rechts. Headerhoogte is 120/128 en wrapperhoogte 88/92 logische pixels in liggend/staand. Subtitel is Manrope 800, 12/11 px met regelhoogte 1,4.
- Test beide velden afzonderlijk én samen met 120 tekens, speciale tekens en lege waarde; wisselen/herladen bewaren beide onafhankelijk per familie. Reset van familie A verandert familie B niet en herstelt beide standaardteksten van A.
- Test lege subtitel met gevulde titel, gevulde subtitel met lege titel en beide leeg; logo blijft zichtbaar, geen overlap of onbedoelde fallbacktekst.
- Controleer beide thema’s/oriëntaties en de Menu Studio-preview zodra die wordt meegeleverd. Historische v6-layoutbeelden bewijzen de nieuwe header of fontlading niet.

### V7-entree, pauze en replay

- De achtergrond verschijnt eerst: start 0 s, duur 0,85 s, opacity 0 naar 0,95 licht / 0,6 donker en scale 1,025 naar 1.
- De kop volgt vanaf 1,25 s, duur 0,65 s, opacity 0 naar 1, translateY −16 naar 0 en blur 3 naar 0.
- Alleen daadwerkelijke bovenliggende inhoudspanelen verschijnen daarna: paneel i vanaf `2,1 + i × 0,12` s, duur 0,65 s, opacity 0 naar 1, translateY 24 naar 0, scale 0,985 naar 1 en blur 4 naar 0. Index i begint bij nul. Inhoudelijke rijen en geneste panelen krijgen geen eigen extra stagger.
- De footer begint op `2,6 + max(0, n−1) × 0,12` s en duurt 0,4 s. n telt de echte bovenliggende inhoudspanelen; lege slots tellen niet mee. Bij nul panelen begint de footer op 2,6 s.
- Verifieer volgorde, tussentoestanden en eindbeeld in licht/donker en liggend/staand, met een enkel paneel, matchday, welkom 1–4, zesvaksgrids inclusief nul items en de semantische fotografie-/veld-/goal-/videocontainers. Deze vier bijzondere composities mogen geen oude vroege reveal behouden.
- Bij pauze tijdens iedere introfase wordt de complete eindcompositie zichtbaar en de intro voltooid gemarkeerd. Hervatten laat gegevensbeweging doorgaan zonder een nieuwe achtergrond/kop/paneelentree.
- Bij reduced motion staat de complete compositie direct stil. Opnieuw afspelen mag deze voorkeur niet omzeilen.
- Een nieuwe render, familiekeuze of expliciete replay begint de entree opnieuw wanneer beweging is toegestaan. Zowel de studiobediening Opnieuw afspelen als de fullscreenknop `Opnieuw afspelen ↻` doen dit. Replay vanuit pauze zet beweging aan, behalve bij reduced motion. Controleer dat ook de achtergrond-pseudo-elementanimatie werkelijk bij opacity 0/scale 1,025 opnieuw begint door de tijdelijke `scene-reset` en reflow.
- Vergelijk dezelfde gecontroleerde scène op gelijk elapsedMs in preview, geëxporteerde frames en moderne Player. Verzamel aanvullend v7-motionbewijs; stilstaande basisbeelden bewijzen deze tijdlijn niet.

### Exacte footerreferentie

- Artwork: 126×42 logische pixels.
- Witte kleur in beide thema's.
- Schaduw: `drop-shadow(0 2px 2px #000d) drop-shadow(0 0 1px #000e)`.
- Onderregel: wit, Manrope 800, 6 logische pixels, regelhoogte 1,5 en letterafstand 1,2 pixels; tekstschaduw `0 2px 3px #000, 0 0 2px #000`.
- Footerachtergrond transparant; rand 0; box-shadow geen; padding 0. De schaduw betreft het artwork/de tekst, geen onzichtbaar rechthoekig paneel.

## 3. Competitie- en periodestand: eigen team blijft zichtbaar

De stand is een echte ranglijst met dezelfde kolommen, clublogo's en afwisselende rijachtergronden als de referentie. Duindorp heeft één blauwe gemarkeerde rij met witte inhoud. Gebruik in productie een betrouwbare teamidentiteit, niet alleen een zoekactie op de naam `Duindorp`.

### Beweging

1. De volledige lijst begint bovenaan en wacht 2,5 seconden.
2. De lijst beweegt gelijkmatig naar beneden door het scrollbereik. De standaard snelheid bedraagt 30 logische pixels per seconde; rustig is 19 en sneller is 48.
3. Onderaan wacht de lijst 2,5 seconden.
4. De lijst beweegt terug naar boven en herhaalt de cyclus.
5. Duindorp beweegt eerst mee met zijn normale positie. Zodra zijn rij de boven- of onderrand van het zichtbare rijvenster raakt, blijft die rij aan die rand staan. De andere rijen scrollen door. Er verschijnt nooit een tweede kopie van Duindorp.

De referentie gebruikt een eigen rij met `position: sticky; top: 0; bottom: 0; z-index: 4` in een werkelijk scrollend venster. Het visuele criterium is belangrijker dan het verplicht hergebruiken van deze exacte techniek. Een alternatieve implementatie moet dezelfde klemwerking opleveren: `eigen_y = clamp(normale_y - scroll_y, 0, vensterhoogte - rijhoogte)`.

De eigen rij moet bij een eerste plaats meteen bovenaan zichtbaar blijven en bij een laatste plaats vanaf het begin onderaan zichtbaar zijn. Dit geldt ook als de eigen rij normaal buiten de eerste zichtbare rijen zou vallen. Laat de rij niet volledig uit beeld verdwijnen voordat het vastzetten begint.

### Randvoorwaarden

- Geen scrollbereik: lijst stil laten staan; geen NaN, oneindige cyclusduur of kunstmatige beweging.
- Pauze: gegevensbeweging stopt; hervatten mag de rij niet laten springen of dupliceren. De v7-intro wordt bij pauze voltooid en blijft bij hervatten voltooid, zoals hierboven beschreven.
- Verminderde beweging: respecteer `prefers-reduced-motion`; statische inhoud blijft zichtbaar. De scrollregio blijft met toetsenbord of normale scrollinvoer te bedienen.
- Een onzichtbaar tabblad verbruikt geen actieve animatietijd; geen grote inhaalstap bij terugkeer.
- Bij bronupdates klopt de gemarkeerde teamidentiteit nog steeds. Maak een eventuele ontbrekende eigen rij expliciet afhandelbaar; geen null-referentiefout.
- Punten, gespeelde wedstrijden, W/GL/V en vorm komen uit echte brongegevens. De demoformule en voorbeeldpunten zijn geen productiebron.

## 4. Bezoekende teams en welkomstscherm

Beide families gebruiken dezelfde selectie- en kaartregels.

### Selectie van wedstrijden

Selecteer eerst alle geldige kandidaten en pas daarna de limiet toe:

1. De thuisclub is de eigen club.
2. Het thuisteam behoort aantoonbaar tot de eigen club/tenant en de ingestelde selectie van eigen teams.
3. Het aftraptijdstip is geldig en strikt later dan het referentietijdstip.
4. De wedstrijd is niet afgelast, uitgesteld of afgelopen. Normaliseer de bronstatussen vóór deze toets; het prototype illustreert `cancelled`, `postponed`, `finished`, `afgelast` en `uitgesteld`.
5. Sorteer oplopend op het echte aftraptijdstip en toon maximaal vier wedstrijden.

Een uitwedstrijd van een eigen team is geen bezoekende-teamkaart op het eigen sportpark. Een wedstrijd tussen twee andere clubs is ook geen kandidaat. Dateer en formatteer de uitvoer voor `Europe/Amsterdam`; vergelijk absolute tijdstippen en houd rekening met zomer-/wintertijd.

### Kaartinhoud en herkenning

- Het bezoekende team heeft het grote logo, de prominente teamnaam en `Van harte welkom` in de kaartinhoud. De slider `WELKOMSBLOK`, aria-label `Grootte bezoekerslogo en welkomstekst`, vraagt hiervoor 100–200% in stappen van 5, standaard 150% van de v5-basis. De instelling wordt gedeeld door `visitors` en `welcome` en bewaard in `onzetrots-studio`.
- Het thuisteam heeft geen tweede groot logo in de kaartinhoud. Het generieke eigen clublogo staat in de aparte slidekop, niet nogmaals na de aftraptijd in iedere kaart.
- De volledige wedstrijd staat apart onder het bezoekende team: `Duindorp SV [team] — [uitteam]`. Deze caption heeft gewicht 800 en is 3 logische pixels groter dan de bijbehorende v5-basis; de waardentabel staat in `02-VISUELE-SPECIFICATIE.md`.
- Toon datum, aftraptijd, veld, thuis-kleedkamer en bezoekers-kleedkamer als afzonderlijke duidelijke velden.
- Het uitteam mag als subtiel groot watermerk op de kaart terugkomen. Een ontbrekend uitlogo mag nooit worden vervangen door het Duindorp-logo. Gebruik een eerlijk naamembleem of laat het watermerk weg.
- Bij nul kandidaten verschijnt de bedoelde rustige leegmelding; er worden geen fictieve wedstrijden verzonnen.

### Variabele aantallen

| Aantal | Liggend | Staand |
| --- | --- | --- |
| 1 | Eén grote kaart over de inhoudsruimte | Eén grote kaart |
| 2 | Twee ruime kaarten naast elkaar | Twee kaarten boven elkaar |
| 3 | Eén grote kaart links en twee compacte kaarten rechts | Drie kaarten boven elkaar |
| 4 | Een 2×2-raster | Vier kaarten boven elkaar |

De staande variant mag de `grid-row: span 2` van de liggende eerste kaart bij drie wedstrijden niet erven. De prototypeknoppen voor 1–4 wedstrijden zijn een beoordelingshulp; productie bepaalt het aantal op basis van echte kandidaten.

Test bij ieder aantal 1–4 de standaard 150%, de UI-schaalgrenzen 100%/200% en een tussenwaarde in stappen van 5, in beide thema’s en oriëntaties. Gebruik ook lange bezoekersnamen. Crest, naam en begroeting blijven binnen hun kaart; de vettere wedstrijdcaption en datum/tijd, veld en kleedkamers blijven zichtbaar zonder overlap of clipping. Schalen mag geen kaarten buiten het raster duwen of de aparte slidekop/footer bedekken. De werkelijke schaal is `min(gevraagdeSchaal, beschikbareBreedte / natuurlijkeBreedte, beschikbareHoogte / natuurlijkeHoogte)` van de v5-identiteitsgroep. Een gevraagde 200% mag dus visueel worden begrensd om te passen; de UI- en opslagwaarde blijven 200%. Wisselen tussen `visitors` en `welcome`, herladen, heropenen en publicatie behouden de gedeelde gevraagde schaal.

## 5. Live scorebord

Het blauwe containertje met live-tijd staat boven de tussenstand, niet eronder, ernaast of onderaan de kaart. De daadwerkelijke DOM-volgorde is klokchip gevolgd door de score; de verticale presentatie heeft 18 logische pixels tussenruimte.

Verifieer dit in beide schermformaten en voor de momenten live, aftrap, rust en eindstand. De inhoud kan per moment wijzigen, maar de positie van de blauwe tijd-/momentchip boven de score blijft behouden. Gebruik de werkelijke LED Scores-/scorebordgegevens en wedstrijdstatus; de demotijd `63:24` en score `2–1` zijn geen vaste productie-inhoud. Bestaande `showClock`, staleAfter, bronrechten en fase-/pauzeregels blijven leidend: de eis betreft de positie van een getoonde chip, niet het geforceerd tonen van een ongeldige of uitgezette klok.

## 6. Verjaardagen, clubactiviteiten en clubagenda: vast 3×2-raster

Deze drie families gebruiken altijd drie kolommen en twee rijen, ook in het staande formaat. Het is nadrukkelijk geen grid dat bij weinig items automatisch een grotere kaart of een andere indeling kiest.

- Zes voorbeelditems zijn de standaardreferentie voor elke familie.
- Er zijn altijd precies zes logische plekken, in leesvolgorde van links naar rechts en dan naar de volgende rij.
- Bij 0–5 echte items blijven de overige plekken leeg. De bestaande kaarten behouden dezelfde afmetingen en positie.
- Een lege plek toont geen container, clublogo, tekst, placeholder-kop, rand of leegmelding. De achtergrond is daar zichtbaar.
- Technisch mag een lege `aria-hidden="true"` placeholder met `visibility: hidden` de plek vasthouden. Gebruik geen `display: none`, anders schuiven de kaarten op.
- Iedere gevulde verjaardagskaart toont in deze volgorde: grotere datum linksboven, felicitatie `Gefeliciteerd, Sam K.` met voornaam + achternaaminitiaal, leeftijd in Rubik Distressed 400 en teaminformatie. Controleer deze visuele én leesvolgorde in beide formaten. Het generieke eigen clublogo staat alleen in de aparte slidekop. Namen en leeftijden in dit pakket zijn demonstratiegegevens.
- Elke gevulde activiteiten-/agendakaart heeft afbeelding, datum, titel, korte tekst en tijd/locatie; geen herhaald decoratief eigen-logo in de kaartkop.
- De voorbeeldkeuze 0–6 is onafhankelijk per familie. Een wijziging van het verjaardagenvoorbeeld mag de agenda of activiteiten niet op hetzelfde aantal zetten.
- De verborgen lege plekken krijgen geen logo door een algemene brandingfunctie.

Voor broncollecties met meer dan zes items gebruikt de nieuwe OnzeTrots-versie vervolgpaginering: iedere pagina houdt zes vaste slots, de laatste pagina vult de rest met lege slots. Het aantal pagina’s is voor de geselecteerde, toegestane records `ceil(n / 6)`, met een geldige lege weergave bij n=0. Pas duur- en paginacontracten bewust aan deze familiegebonden telling aan. Toon niet alleen de eerste zes en verlies geen records stilzwijgend.

## 7. Handmatige acceptatiematrix

Voer de volgende controles uit tegen echte repo-renderpaden met gecontroleerde fixtures. Gebruik de opgegeven bronfilters; niet uitsluitend een los testscherm dat de productierenderer omzeilt.

| Controle | Varianten | Verwacht bewijs |
| --- | --- | --- |
| Basiscollectie | Alle 36 families, licht/donker, liggend/staand | Precies één aparte kopcontainer, clublogo uiterst rechts, juiste assets, geen afsnijding of herhaalde decoratieve binnenlogo’s |
| Binnenkoppen | Alle 36 families, beide thema’s/formaten | Nul `.panel-head` op niet-matchday; exact drie bij matchday; gegevensstroken, kolomlabels en feature-inhoudstitels blijven |
| Verjaardagsvolgorde | Zes en twee gevulde kaarten, beide thema’s/formaten | Grotere datum linksboven → felicitatie met voornaam/initiaal → Rubik-leeftijd → team; lege slots ongewijzigd |
| Subtitel/titel onafhankelijk | Bewerk familie A/B, wissel terug, herlaad; heropen opgeslagen slide | Eigen teksten blijven per familie/slide bewaard, bronrefresh verandert ze niet |
| Subtitel/titel veilig en passend | Speciale tekens, HTML-achtige invoer, 120 tekens/leeg; reset huidige familie; beide thema’s/formaten | Gewone tekst, leeg blijft leeg; onafhankelijke reset; logo zichtbaar rechts en geen overlap |
| Stand volledig doorlopen | Eigen plek 1, midden, laatste | Eigen rij blijft zichtbaar bij beide grenzen; andere rijen bewegen door; geen dubbele eigen rij |
| Stand korte lijsten | 0, 1 en minder rijen dan venstercapaciteit | Geen fout/NaN, geen onnodige beweging, passende leegmelding |
| V7-entree | Enkel/meerdere panelen, welkom 1–4 en grids inclusief nul; beide thema’s/formaten | Achtergrond → kop → echte bovenliggende panelen → footer op de vastgelegde tijden, geen extra rijstagger |
| Introbediening | Pauze in iedere fase, hervatten, replay in studio/fullscreen, nieuwe render/familie, reduced motion | Pauze/eindbeeld; hervatten zonder introherstart; replay start waar toegestaan; reduced motion blijft gerespecteerd |
| Gegevensbeweging | Pauze/hervat, verborgen tabblad, verminderde beweging | Geen grote sprong, inhoud blijft leesbaar en zichtbaar |
| Welkomstselectie | Meer dan vier gemengde kandidaten, expres ongesorteerd | Exact de eerstvolgende maximaal vier geldige eigen thuiswedstrijden |
| Welkomstuitsluitingen | Uitwedstrijd, externe thuisclub, onbekend eigen team, ongeldige/past/equal-now tijd, afgelast/uitgesteld/afgelopen | Geen van deze wedstrijden verschijnt |
| Welkom lay-outs | 0, 1, 2, 3, 4 kandidaten; beide formaten | Juiste indeling, nul rustige melding, geen portrait row-span-lek |
| Bezoekersschaal | 1–4 kaarten, 100/150/200% en tussenwaarde (stap 5), beide thema’s/formaten | Crest/naam/begroeting passen via begrensde fit; caption met gewicht 800 / +3 pixels en locatievelden leesbaar; gevraagde schaal gedeeld/opgeslagen |
| Uitlogo ontbreekt | Zonder afbeelding en zonder mapverwijzing | Geen eigen clublogo als bezoekerslogo, geen kapotte afbeelding |
| Scorebord | Live/aftrap/rust/eindstand; beide formaten | Blauwe chip staat geometrisch geheel boven de score |
| Vaste grids | Drie families × aantallen 0 t/m 6 × twee thema's × twee formaten | Steeds zes plekken; exact n gevulde kaarten; geen reflow of afsnijding |
| Grid-isolatie | Stel verjaardagen op 2, activiteiten op 5, agenda op 6 | Elke familie behoudt zijn eigen voorbeeldkeuze |
| Footercontrast | Alle drie achtergronden in licht/donker | Klein wit woordmerk met schaduw, zonder badge, onderregel behouden |
| Player/preview/media | Dezelfde gecontroleerde presentatie in alle actieve paden | Visuele overeenkomst zonder oude templatevariant of stylesheettegenstrijdigheid |

### Te verzamelen bewijs

Bewaar nieuwe screenshots van de definitieve repo-uitvoer voor ten minste: aparte slidekop met aangepaste tekst en logo rechts in beide thema’s/formaten; welcome/visitors op standaard 150% en schaalgrenzen; stand met eigen rij boven vast en onder vast; welkom met 1/2/3/4 kaarten; verjaardagen met zes en met twee gevulde plekken; activiteiten met zes en vier; agenda met zes en nul; scorebord met klok boven de score. Vergelijk op dezelfde achtergrond, variant, beeldverhouding en data. Screenshots van het pakket zijn referentie, geen vervanging voor bewijs uit de uiteindelijke repo-uitvoer.

## 8. Gerichte geautomatiseerde tests in de repo

Voeg alleen tests toe die het bedoelde gedrag vastleggen en echte regressies kunnen signaleren:

1. Pure selectiecontracttest: ongesorteerde geldige en ongeldige bezoekende-teamkandidaten leveren de vier dichtstbijzijnde geldige eigen thuiswedstrijden op, zonder inputmutatie.
2. Een klok met vast tijdstip maakt grensgevallen voor aftrap==nu, tijdzone en zomer-/wintertijd reproduceerbaar.
3. Gerenderde DOM/scene-test: zes slots bij ieder aantal 0–6; placeholders zijn leeg en niet bereikbaar voor hulptechnologie; geen branding op placeholders.
4. Score-layouttest in de echte browser/render-runtime: de onderkant van de klokchip ligt boven de bovenkant van de score, in beide formaten.
5. Stand-layouttest met gecontroleerd scrollverloop: de eigen rij blijft tussen beide vensterranden; eerste/laatste/middenposities en kort/niet-scrollend bereik worden gedekt.
6. Een opslag-/rendercontracttest: kopteksten blijven onafhankelijk per familie/slide en behouden speciale tekens; HTML-achtige tekst blijft tekst. Bezoekersschaal wordt gevalideerd en komt identiek in preview, export en Player terecht.
7. Gedeelde renderertest: nul `.panel-head` voor niet-matchday en exact drie bij matchday, met behoud van echte context-/kolomgegevens en feature-inhoudstitels. Controleer verjaardagsnaam/volgorde met toegestane gegevens; ontbrekende achternaam wordt niet verzonnen.
8. Deterministische introtijdlijntest met gecontroleerde tijden vóór/op/na iedere fasegrens, top-level paneeltelling inclusief n=0 en pauze/replay/reduced-toestanden. Controleer dat geneste panelen/rijen geen eigen stagger krijgen en vergelijk representatieve DOM-/exportframes.
9. Een beperkt aantal stabiele visuele regressies op representatieve eindbeelden. Bevries data/tijd/animatiepositie voor screenshots; geen snapshots die door normale realtime-updates ruis geven.

Pas deze checks aan de bestaande testinfrastructuur van VeyoCast aan. Kopieer geen losse browserinstallatie, demonstratie-state, voorbeeldtenant of eigen authenticatiepad mee naar productie.

## 9. Productiegrens: wat niet letterlijk als bedrijfslogica mag worden gekopieerd

De lokale prototype-app bevat bewust fictieve mensen, prijzen, scores, toekomstzaterdagen, voorbeeldwedstrijden, een demo-poll en losse voorbeeldkeuzes. Gebruik dit als vormgevings- en gedragsreferentie, niet als vervanging van repo-data.

Herbruikbare delen zijn de compositie, assets, typografie, kleurtokens, beweging, filterintentie, slotverdeling en acceptatiegevallen. Koppel deze aan bestaande team-/clubidentiteiten, Sportlink-selecties, tenant branding, bronstatussen, birthday-configuratie, agenda/activiteitenfeeds en LED Scores. Behoud de bestaande gegevensbeveiliging en rechten. Zet geen echte persoonsgegevens in gedeelde testfixtures.

De overdracht autoriseert het bouwen en toetsen van de wijziging volgens de repo-afspraken. Hij bevat geen opdracht om datasets te wissen, productiegegevens te migreren, secrets te vervangen of productie zonder afgesproken releaseproces te deployen.


## 10. Repo-specifieke technische acceptatie

De brononderbouwde integratiekaart in dit pakket is leidend naast deze visuele eisen. Integreer de wijziging in de actieve Sync-keten; alleen een oude Sites-v11/v17-renderer of de templatekiezer aanpassen voldoet niet.

### Rich contracts en assetset

De huidige Sync-presentatie reduceert verschillende broncollecties tot vier strings per rij. De aparte koptekst en bezoekersschaal zijn gevalideerde authoringconfiguratie en worden niet als canonical bronfeiten behandeld. De nieuwe versie houdt getypeerde feiten intact: standings met stabiele team-ID en alle statistieken/vorm/logo-ref; wedstrijden met gecontroleerde eigen club/team-ID’s, kickoffAt/status, twee crests, veld en twee kleedkamers; verjaardagen met de reeds toegestane naam/leeftijd/team/meta; nieuws/activiteiten met optionele verified afbeeldingen. Vul ontbrekende feiten niet op door strings te parsen of statistieken uit punten te berekenen.

Alle geneste beeld-/font-/artworkrefs worden onderdeel van dezelfde expliciete assetset in contract, projector, checksumvalidatie, Worker-capture en offline Player-cache. Geen vrij externe afbeeldings-URLs of providercalls vanuit de renderer. Preview, export en Player gebruiken gedeelde pure componenten; het prototype-DOM-achterafdecoreren wordt geen afzonderlijke client-only productiestap.

### Deterministische beweging en export

De huidige Worker pauzeert interne animaties en hergebruikt na de binnenkomsttransitie één settled raster. Dat pad moet voor een bewegende stand daadwerkelijk worden aangepast. Definieer een zuivere motionprojectie uit elapsedMs, layoutmaten, instellingen en expliciete scène-toestand en gebruik dezelfde uitkomst in preview, moderne Player en elk exportframe. Neem naast de doorlopende stand ook de volledige v7-entree, paneelstagger en pauze/replay/reduced-regels op; de generieke binnenkomsttransitie van het huidige capturepad dekt deze tijdlijn niet. Een bestand dat alleen de binnenkomst animeert en daarna een statische ranglijst bevat, slaagt niet.

Neem interne tijd/layout in relevante capturecache-identiteiten op; hergebruik settledPng alleen voor werkelijk stilstaande scènes. Behoud de capture-CSP, verified assets, fontdecode en checksumvereisten. Voer geen opgeslagen HTML/JS of eval uit. Oudere WebViews krijgen een volledige correcte MP4/PNG-fallback; last-known-good blijft staan tot complete nieuwe assets en zichtbare frames bevestigd zijn.

### Versies, migraties en herhaalbare generatie

Houd historische Sync-v1, Sites-v11/v17 en FieldFlow-documenten intact. Leg de nieuwe OnzeTrots-visual vast in een expliciete versie of strikt versiegebonden visual contract en voeg light/dark als formeel gevalideerde keuze toe. De oude rendererVersion/sourceRevision mag niet achteraf een andere presentatie betekenen.

De bestaande CSS-generator leest oude bevroren Source-bestanden en de schemagenerators schrijven historische SQL-migraties. Een handpatch die bij de volgende generatie verdwijnt is niet gereed. Maak een herhaalbare nieuwe bron/generatieflow; wijzig actuele schema’s bewust en gebruik nieuwe forwardmigraties voor nieuwe databasevalidatie. Historische migratiebytes en legacyfixtures worden niet herschreven om een huidige test gelijk te krijgen.

Als `welcome` naast `visitors` een Sportlink-bezoekerbinding krijgt, wordt dat expliciet en versiegebonden opgenomen in de familie/type-mapping, selectiepolicy en databasevalidatie. De oude algemene welkomstfamilie voor andere versies/thema’s blijft correct.
