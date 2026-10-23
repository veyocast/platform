# Codex-opdracht — goedgekeurde OnzeTrots-slides exact overnemen in VeyoCast

Voer deze opdracht volledig uit in de bestaande repository `veyocast/platform`. Het doel is de **goedgekeurde OnzeTrots-slidecollectie exact over te nemen in de actieve VeyoCast Sync-renderketen**, inclusief editorpreview, echte export en Player. Gebruik het pakket onder `docs/design/onzetrots-slides/` als vaste ontwerp- en gedragsreferentie. De laatste goedgekeurde wijziging is **v9 van 23 oktober 2026**: extra binnenkoppen vervallen behalve de drie op Onze wedstrijddag; verjaardagen krijgen de volgorde uit `13-WIJZIGINGEN-V9.md`. Rubik Distressed en de bewerkbare subtitel/titelkop uit `12-WIJZIGINGEN-V8.md` blijven gelden. De entree uit `11-MOTION-V7.md` blijft gelden; `10-WIJZIGINGEN-V6.md` vervangt de eerdere regel zonder buitenheader.

## Opdracht en bronvolgorde

1. Lees de actuele `AGENTS.md`, de daarin vereiste canons, het bestaande taak-/releaseproces en de relevante code. Werk in een geïsoleerde taakbranch/worktree op de developmentomgeving. Leg een korte implementatievolgorde en bestandsownership vast.
2. Lees dit hele overdrachtspakket, vooral de repo-integratienotities en `05-ACCEPTATIE-EN-TESTEN.md`. De referentiebron staat in `broncode/`; de definitieve visuele voorbeelden staan in `voorbeelden/`.
3. De repo is voor deze overdracht gelezen op main-commit `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`. De definitieve v9-prototypebron staat op `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`. Alle160 individuele layoutbeelden zijn nieuwe v9-opnamen; de vier Menu Studio-opnamen en bronsnapshot zijn afzonderlijk gepind op `77eec81092ab829302dd835fb430161fe93be220`. Het v7-motionbewijs is expliciet historisch en documenteert alleen de behouden entreevolgorde. Controleer bij aanvang afwijkingen van de actuele repo; behandel deze hashes niet als opdracht om main terug te zetten.
4. Laat de laatste goedgekeurde bron en voorbeelden voorgaan boven verouderde OnzeTrots-screenshots in de repo. Gebruik de aparte bewerkbare kopcontainer met subtitel en titel; herstel geen v5-weergave zonder buitenheader, oude footerbadge, driekaart-verjaardag of klok-onder-score.
5. Bouw binnen de bestaande stack; geen frameworkmigratie, vervangend los dashboard, nieuwe authflow of tweede productrenderer naast de actieve keten.

## Verplicht eindbeeld

Neem alle 36 bestaande slidefamilies over, met dezelfde stabiele familie-ID’s. Ondersteun licht/donker en liggend/staand met de goedgekeurde composities. Behoud andere thema’s en historische presentaties.

- Gebruik de originele herkenningsachtergronden Houtrust/clubhuis, wijk/Meeuwenhof en kust/havenhoofd, de originele clublogo’s en het originele OnzeTrots-brushartwork.
- Het herkenbare OnzeTrots-woordmerk is artwork, geen font. Alle koppen gebruiken het echte lokale Rubik Distressed 400 (`RubikDistressed-Regular.ttf`, met OFL-licentie); Manrope en Barlow Condensed vervullen de normale tekst-/cijferrollen.
- **Elke slide heeft precies één aparte kopcontainer boven de inhoud.** De subtitel staat boven de titel, beide links. De bediening `SLIDEHEADER` bevat `Subtitel boven de kop` (aria `Subtitel van deze slide`) en `Headertekst` (aria `Headertekst van deze slide`), elk maximaal 120 tekens. Beide zijn onafhankelijk per familie opgeslagen, leeg toegestaan; `Standaard herstellen` herstelt beide teksten van alleen de huidige familie. Het eigen clublogo staat helemaal rechts in deze kopcontainer. Verplaats de generieke decoratieve eigen-clublogo’s uit de binnencontainers naar deze ene kop. Verwijder alle extra `.panel-head`-secties binnen `.slide-content` op niet-matchday-slides. Alleen `matchday` behoudt precies drie binnenkoppen voor uitslagen, stand en programma. Behoud semantische gegevens-/contextstroken, tabelkolomlabels, daadwerkelijke inhoudstitels van feature-artikelen en echte teamlogo’s.
- OnzeTrots rechtsonder is klein, wit, transparant en voorzien van donkere schaduw. Geen achtergrondvlak, rand of badge. De witte onderregel `ONZE CLUB. ONZE TROTS.` blijft staan.
- Houd de exacte rastermaten, kaartverhoudingen, zebrastrepen, vormvakjes, contrasten, witruimte en transparantie van de referentie aan. Standaard containerdekking is 94%.
- Het prototype gebruikt logische canvassen 1600×900 en 900×1600, geschaald naar de uitvoer 1920×1080 of 1080×1920. Schaal de compositie consequent; 126×42 logische pixels voor het footerartwork is niet automatisch 126×42 fysieke pixels in een native 1080-render.

## Gedrag dat exact moet werken

### Gefaseerde entree en opnieuw afspelen

Neem de v7-volgorde exact over: achtergrond vanaf 0 s gedurende 0,85 s; kop vanaf 1,25 s gedurende 0,65 s; daadwerkelijke bovenliggende inhoudspanelen vanaf `2,1 + i × 0,12` s, elk 0,65 s; footer vanaf `2,6 + max(0, n−1) × 0,12` s, gedurende 0,4 s. Gebruik nulgebaseerde index i en aantal n van de echte bovenliggende panelen; geen afzonderlijke entree per tabelrij of genest paneel. Exacte opacity/scale/translate/blur en easing staan in `11-MOTION-V7.md`.

Gepauzeerd en reduced motion tonen de complete eindcompositie. Een pauze tijdens de intro maakt de intro af en markeert `intro-finished`; hervatten laat de gegevensbeweging doorgaan zonder de intro te herstarten. Een nieuwe render, familie of expliciete replay start een nieuwe intro, zolang beweging is toegestaan. `replayScene()` schakelt beweging in tenzij reduced motion actief is; zowel de studiobediening als de fullscreenknop `Opnieuw afspelen ↻` gebruiken die functie.

### Stand en periodestand

Toon de volledige poule met de rijke kolommen, echte rijlogo’s en echte statistieken/vorm uit de bron. De blauwe eigen rij beweegt met de lijst mee, blijft bij het bereiken van de boven- of onderrand daar staan en laat de overige rijen doorscrollen. Geen tweede kopie en geen verdwijnen van de eigen rij.

De lijst wacht 2,5 seconden bij begin en einde, loopt heen en terug en gebruikt standaard 30 logische pixels per seconde; rustig 19 en sneller 48. De eigen positie werkt ook bij plek 1 en de laatste plek. Gebruik gecontroleerde team-ID’s. Respecteer pauze, verborgen tabblad, verminderde beweging, geen-scrollbereik en een ontbrekende eigen rij.

Pas de familiepaginering aan: de nieuwe doorlopende stand wordt niet door generieke `rowsPerPage` in losse tabellen geknipt.

### Bezoekende teams en welkom

Selecteer de eerstvolgende maximaal vier geldige **eigen thuiswedstrijden**, op echte kickoffAt gesorteerd. De thuisclub én thuisteamidentiteit moeten binnen de toegestane tenant-/bronselectie vallen. Sluit uitwedstrijden, andere thuisclubs, onbekende eigen teams, ongeldige/verstreken tijdstippen en afgelaste/uitgestelde/afgelopen wedstrijden uit. Format `Europe/Amsterdam`.

Per kaart staat alleen de bezoekerscrest groot bij het bezoekende team. Bezoekerscrest, bezoekersnaam en de begroeting `Van harte welkom` zijn standaard **150% van de v5-basis** en gezamenlijk schaalbaar via `WELKOMSBLOK`: 100–200% in stappen van 5, standaard 150%. Deze instelling wordt gedeeld door `visitors` en `welcome` en onthouden. De werkelijke schaal wordt indien nodig begrensd op de beschikbare kaartbreedte/-hoogte, zodat de inhoud past. De volledige thuis–uitwedstrijd staat apart eronder, vet en enkele pixels groter dan in v5; de caption heeft gewicht 800 en is 3 logische pixels groter dan de bijbehorende v5-basis; zie de exacte waardentabel in `02-VISUELE-SPECIFICATIE.md`. Datum/tijd, veld en beide kleedkamers blijven leesbaar. Het generieke eigen clublogo staat in de aparte slidekop, niet nogmaals na de aftraptijd in iedere bezoekerskaart. Een ontbrekend uitlogo wordt nooit het eigen clublogo.

Liggend: 1 grote kaart; 2 naast elkaar; 3 één grote links plus twee compacte rechts; 4 een 2×2-raster. Staand: 1–4 kaarten over de beschikbare hoogte. Bij nul kandidaten de rustige leegmelding. De prototypekeuze 1–4 is demonstratiebediening; productie bepaalt het echte aantal uit brondata. Test de standaard 150% en de volledige toegestane UI-schaal bij alle vier aantallen, in beide oriëntaties en thema’s: geen overlap, afsnijding of verdwenen wedstrijd-/locatiegegevens.

De bestaande dynamische familie-mapping koppelt sport_visitor_arrivals niet automatisch aan `welcome`. Ondersteun een nieuwe gekoppelde OnzeTrots-welcome alleen expliciet en versiegebonden in contracts, binding, policy en databasevalidatie; behoud de oudere algemene welkomstfunctie.

### Live scorebord

De blauwe live-tijd-/momentchip staat **boven de grote tussenstand**, in DOM én visuele layout. Behoud de bestaande geautoriseerde score-/klokstream, showClock, pauze, fase, staleAfter en logo-assetregels. Gebruik bij rust/eindstand de juiste echte fase; zet niet overal hardcoded LIVE. Het prototype `63:24` en `2–1` zijn voorbeeldfeiten.

### Verjaardagen, clubactiviteiten en clubagenda

Deze drie families hebben een vast **3 kolommen × 2 rijen**-raster, ook in het goedgekeurde staande formaat. Bij minder dan zes items blijven de resterende plekken volledig leeg; kaarten worden niet groter en schuiven niet op. Lege plekken tonen geen paneel, tekst, logo of rand.

Verjaardagskaarten tonen eerst de grotere datum linksboven, daarna de felicitatie `Gefeliciteerd, Sam K.` met voornaam en achternaaminitiaal, daarna de leeftijd in Rubik Distressed 400 en onderaan teaminformatie. Gebruik toegestane bestaande naamvelden; verzin in productie geen achternaam of initiaal.

Gebruik voor meer dan zes toegestane bronrecords vervolgpaginering met zes vaste slots per pagina en behoud alle records. Werk paginatelling en duurcontracten mee bij. De zes jarigen/activiteiten en de 0–6-keuze uit de referentiestudio horen uitsluitend in voorbeelden/testfixtures, nooit als verzonnen tenantinhoud in een nieuw document.

## Integratie in de actieve repo

Gebruik de brononderbouwde integratiekaart uit het pakket. Belangrijkste actieve keten:

- `packages/contracts/src/sync-slide-presentation.ts` en de dynamische configuration/playback-contracten;
- `packages/content-templates/src/sync-dynamic-projector.ts`;
- `packages/content-templates/src/sync-slide-static-view.tsx` en `sync-slide-styles.ts`;
- Control-wizard, handmatige/gekoppelde editor, templatefixtures en gedeelde `SyncSlidePreview`;
- `apps/media-worker/src/sync-dom-capture.tsx` en `sync-dynamic-render.ts`;
- `apps/player/app/_components/sync-studio-media.tsx`, presentatiepreparatie, live match en capabilities/fallbacks.

De huidige vierstringrijen zijn onvoldoende voor deze vormgeving. Introduceer versiegebonden rich contracts voor standen, fixtures, verjaardagen en beeldrijke activiteiten/nieuws. Bewaar stabiele identiteiten, nullable feiten en verified assetrefs. Geen statistieken uit punten reconstrueren, geen providerrequests vanuit rendercode en geen willekeurige externe image-URL’s of opgeslagen HTML/JS.

Leg subtitel, titel en bezoekersschaal vast als gevalideerde authoringconfiguratie, los van canonical bronfeiten. Bewaar `headerSubtitles` en `headerTexts` onafhankelijk per slide/ontwerp en de gedeelde bezoekersschaal volgens de actuele bediening, inclusief reload, draft/revision en publicatie. Het prototype gebruikt hiervoor `localStorage`-sleutel `onzetrots-studio`; productie gebruikt de bestaande opgeslagen authoringflow. Render subtitel en titel als tekst, zonder HTML-interpretatie; ontsnap tekens zoals `<`, `>`, `&` en aanhalingstekens via de bestaande renderlaag. De tekst mag logo en inhoud niet overlappen.

Maak gedeelde pure React-composities voor de aparte slidekop, de drie matchday-binnenkoppen, semantische gegevensstroken, crests, footer, ranglijst, bezoekerkaarten en zes slots. De achteraf uitgevoerde DOM-branding in de referentie-app is een prototypehulpmiddel, geen productiearchitectuur. Dezelfde markup en assetset moeten in preview, capture en Player worden gebruikt. Voeg alle geneste beeld-/font-/artworkrefs toe aan assetcollectie, checksumvalidatie, captureloader en offline cache.

`matchday` is in de goedgekeurde referentie een compositie van uitslagen, volledige stand en programma. De huidige enkele `sport_match_of_the_day`-projectie levert die combinatie niet. Maak een gecontroleerde samengestelde snapshot uit dezelfde toegestane team-/poule-/seizoencontext; haal geen drie providers vanuit de renderer op en vervang de compositie niet door één wedstrijdkaart.

### Werkelijke motion in export

De bestaande Worker bevriest interne animaties en hergebruikt na de binnenkomsttransitie een settled raster. Dat is geen werkende bewegende stand. Implementeer een zuivere motionprojectie op elapsedMs, layoutmaten en expliciete pauze/reduced/intro-finished-toestand die de browserpreview, moderne Player en **ieder gevraagd exportframe** delen. Dit geldt voor de volledige v7-entree én de doorlopende stand; alleen de generieke buitenste transition samplen is onvoldoende. Laat capturecache-identiteiten interne tijd/layout meenemen en settledPng alleen bij werkelijk stilstaande scènes gebruiken.

Behoud strenge CSP, decode-/checksumgates, complete MP4/PNG-fallback, immutable publicaties, zichtbare framebevestiging en last-known-good. Geen eval, geïnjecteerde prototypecode of versoepelde capture-CSP. Oudere WebViews moeten de volledige juiste video/rasterfallback kunnen blijven afspelen.

### Compatibiliteit en generatie

Maak een expliciete nieuwe renderer-/visualidentiteit voor deze goedgekeurde OnzeTrots-versie. Houd oude Sync-v1, Sites-v11/v17 en FieldFlow-documenten correct; verander niet stilzwijgend de betekenis van oude rendererVersion/sourceRevision-literals. Voeg light/dark als echte gevalideerde keuze toe.

Inspecteer de generators voordat je ze uitvoert: de huidige CSS-generator leest oude Source-bestanden; twee schemagenerators schrijven historische SQL. Maak de nieuwe generatieflow herhaalbaar en gebruik **nieuwe forwardmigraties** voor nieuwe validatie. Herschrijf geen historische migraties of oude assetidentiteiten om tests passend te maken. Bewaar legacyfixtures.

## Validatie en oplevering

Voer de toepasselijke bestaande repo-gates uit, minimaal de verplichte type-/contract-/renderchecks volgens AGENTS/canons. Gebruik relevante projector-, Worker-, Player/offline-, wizard- en dynamische workflowtests; bij schemawijzigingen ook de contract/database-/RLS-checks in een geïsoleerde testomgeving. Geen bestaande staging- of productiedatabase legen.

Toon betekenisvol bewijs voor alle 36 families in beide varianten/formaatkeuzes en voor de speciale cases uit `05-ACCEPTATIE-EN-TESTEN.md`: bewerkbare subtitels/titels met onafhankelijke opslag en veilige tekstweergave, daadwerkelijk geladen Rubik Distressed, pinned rij boven/midden/onder, welkom 0–4 op standaard 150% en toegestane schaalgrenzen, vaste grids 0–6 en >6, klok boven score, ontbrekende assets, gelijk elapsedMs voor v7-intro én data in DOM en export, pauze/reduced motion, replay zonder voorkeuren te omzeilen en correcte fallback/LKG.

Lever een concrete PR met wijzigingssamenvatting, bron-/referentieversies, screenshots en geëxporteerde motionframes, uitgevoerde checks, compatibiliteitskeuzes en eventuele resterende beperkingen. Werk bestaande taakledger/documentatie bij. Volg voor staging/publicatie de bestaande afgesproken pipeline. Deze opdracht vraagt geen productiecredentials, dataverwijdering, reset of zelfstandige productiedeployment.
