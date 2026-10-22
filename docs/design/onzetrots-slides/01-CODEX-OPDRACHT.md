# Codex-opdracht — goedgekeurde OnzeTrots-slides exact overnemen in VeyoCast

Voer deze opdracht volledig uit in de bestaande repository `veyocast/platform`. Het doel is de **goedgekeurde OnzeTrots-slidecollectie exact over te nemen in de actieve VeyoCast Sync-renderketen**, inclusief editorpreview, echte export en Player. Gebruik het pakket onder `docs/design/onzetrots-slides/` als vaste ontwerp- en gedragsreferentie.

## Opdracht en bronvolgorde

1. Lees de actuele `AGENTS.md`, de daarin vereiste canons, het bestaande taak-/releaseproces en de relevante code. Werk in een geïsoleerde taakbranch/worktree op de developmentomgeving. Leg een korte implementatievolgorde en bestandsownership vast.
2. Lees dit hele overdrachtspakket, vooral de repo-integratienotities en `05-ACCEPTATIE-EN-TESTEN.md`. De referentiebron staat in `broncode/`; de definitieve visuele voorbeelden staan in `voorbeelden/`.
3. De repo is voor deze overdracht gelezen op main-commit `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`. De goedgekeurde prototypebron is vastgelegd op `ae83f2b4312408eacae9f29177d3c743e104185b`. Controleer bij aanvang afwijkingen van de actuele repo; behandel deze hashes niet als opdracht om main terug te zetten.
4. Laat de laatste goedgekeurde bron en voorbeelden voorgaan boven verouderde OnzeTrots-screenshots in de repo. Kopieer geen oude buitenheader, footerbadge, driekaart-verjaardag of klok-onder-score terug.
5. Bouw binnen de bestaande stack; geen frameworkmigratie, vervangend los dashboard, nieuwe authflow of tweede productrenderer naast de actieve keten.

## Verplicht eindbeeld

Neem alle 36 bestaande slidefamilies over, met dezelfde stabiele familie-ID’s. Ondersteun licht/donker en liggend/staand met de goedgekeurde composities. Behoud andere thema’s en historische presentaties.

- Gebruik de originele herkenningsachtergronden Houtrust/clubhuis, wijk/Meeuwenhof en kust/havenhoofd, de originele clublogo’s en het originele OnzeTrots-brushartwork.
- Het herkenbare OnzeTrots-woordmerk is artwork, geen font. Bewerkbare brushteksten gebruiken het meegeleverde Permanent Marker; Manrope en Barlow Condensed vervullen de normale tekst-/cijferrollen.
- Er is **geen losse grote slideheader boven de containers**. Elke container heeft zijn eigen relevante kop; het eigen clublogo staat daarin helemaal rechts. Geen dubbele koppen en geen extra logo in een al complete header.
- OnzeTrots rechtsonder is klein, wit, transparant en voorzien van donkere schaduw. Geen achtergrondvlak, rand of badge. De witte onderregel `ONZE CLUB. ONZE TROTS.` blijft staan.
- Houd de exacte rastermaten, kaartverhoudingen, zebrastrepen, vormvakjes, contrasten, witruimte en transparantie van de referentie aan. Standaard containerdekking is 94%.
- Het prototype gebruikt logische canvassen 1600×900 en 900×1600, geschaald naar de uitvoer 1920×1080 of 1080×1920. Schaal de compositie consequent; 126×42 logische pixels voor het footerartwork is niet automatisch 126×42 fysieke pixels in een native 1080-render.

## Gedrag dat exact moet werken

### Stand en periodestand

Toon de volledige poule met de rijke kolommen, echte rijlogo’s en echte statistieken/vorm uit de bron. De blauwe eigen rij beweegt met de lijst mee, blijft bij het bereiken van de boven- of onderrand daar staan en laat de overige rijen doorscrollen. Geen tweede kopie en geen verdwijnen van de eigen rij.

De lijst wacht 2,5 seconden bij begin en einde, loopt heen en terug en gebruikt standaard 30 logische pixels per seconde; rustig 19 en sneller 48. De eigen positie werkt ook bij plek 1 en de laatste plek. Gebruik gecontroleerde team-ID’s. Respecteer pauze, verborgen tabblad, verminderde beweging, geen-scrollbereik en een ontbrekende eigen rij.

Pas de familiepaginering aan: de nieuwe doorlopende stand wordt niet door generieke `rowsPerPage` in losse tabellen geknipt.

### Bezoekende teams en welkom

Selecteer de eerstvolgende maximaal vier geldige **eigen thuiswedstrijden**, op echte kickoffAt gesorteerd. De thuisclub én thuisteamidentiteit moeten binnen de toegestane tenant-/bronselectie vallen. Sluit uitwedstrijden, andere thuisclubs, onbekende eigen teams, ongeldige/verstreken tijdstippen en afgelaste/uitgestelde/afgelopen wedstrijden uit. Format `Europe/Amsterdam`.

Per kaart staat alleen de bezoekerscrest groot bij het bezoekende team. De volledige thuis–uitwedstrijd staat apart eronder, met datum/tijd, veld en beide kleedkamers. Het kleine eigen clublogo staat uiterst rechts in de kaartheader, na de aftraptijd. Een ontbrekend uitlogo wordt nooit het eigen clublogo.

Liggend: 1 grote kaart; 2 naast elkaar; 3 één grote links plus twee compacte rechts; 4 een 2×2-raster. Staand: 1–4 kaarten over de beschikbare hoogte. Bij nul kandidaten de rustige leegmelding. De prototypekeuze 1–4 is demonstratiebediening; productie bepaalt het echte aantal uit brondata.

De bestaande dynamische familie-mapping koppelt sport_visitor_arrivals niet automatisch aan `welcome`. Ondersteun een nieuwe gekoppelde OnzeTrots-welcome alleen expliciet en versiegebonden in contracts, binding, policy en databasevalidatie; behoud de oudere algemene welkomstfunctie.

### Live scorebord

De blauwe live-tijd-/momentchip staat **boven de grote tussenstand**, in DOM én visuele layout. Behoud de bestaande geautoriseerde score-/klokstream, showClock, pauze, fase, staleAfter en logo-assetregels. Gebruik bij rust/eindstand de juiste echte fase; zet niet overal hardcoded LIVE. Het prototype `63:24` en `2–1` zijn voorbeeldfeiten.

### Verjaardagen, clubactiviteiten en clubagenda

Deze drie families hebben een vast **3 kolommen × 2 rijen**-raster, ook in het goedgekeurde staande formaat. Bij minder dan zes items blijven de resterende plekken volledig leeg; kaarten worden niet groter en schuiven niet op. Lege plekken tonen geen paneel, tekst, logo of rand.

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

Maak gedeelde pure React-composities voor headers, crests, footer, ranglijst, bezoekerkaarten en zes slots. De achteraf uitgevoerde DOM-branding in de referentie-app is een prototypehulpmiddel, geen productiearchitectuur. Dezelfde markup en assetset moeten in preview, capture en Player worden gebruikt. Voeg alle geneste beeld-/font-/artworkrefs toe aan assetcollectie, checksumvalidatie, captureloader en offline cache.

`matchday` is in de goedgekeurde referentie een compositie van uitslagen, volledige stand en programma. De huidige enkele `sport_match_of_the_day`-projectie levert die combinatie niet. Maak een gecontroleerde samengestelde snapshot uit dezelfde toegestane team-/poule-/seizoencontext; haal geen drie providers vanuit de renderer op en vervang de compositie niet door één wedstrijdkaart.

### Werkelijke motion in export

De bestaande Worker bevriest interne animaties en hergebruikt na de binnenkomsttransitie een settled raster. Dat is geen werkende bewegende stand. Implementeer een zuivere motionprojectie op elapsedMs en layoutmaten die de browserpreview, moderne Player en **ieder gevraagd exportframe** delen. Laat capturecache-identiteiten interne tijd/layout meenemen en settledPng alleen bij werkelijk stilstaande scènes gebruiken.

Behoud strenge CSP, decode-/checksumgates, complete MP4/PNG-fallback, immutable publicaties, zichtbare framebevestiging en last-known-good. Geen eval, geïnjecteerde prototypecode of versoepelde capture-CSP. Oudere WebViews moeten de volledige juiste video/rasterfallback kunnen blijven afspelen.

### Compatibiliteit en generatie

Maak een expliciete nieuwe renderer-/visualidentiteit voor deze goedgekeurde OnzeTrots-versie. Houd oude Sync-v1, Sites-v11/v17 en FieldFlow-documenten correct; verander niet stilzwijgend de betekenis van oude rendererVersion/sourceRevision-literals. Voeg light/dark als echte gevalideerde keuze toe.

Inspecteer de generators voordat je ze uitvoert: de huidige CSS-generator leest oude Source-bestanden; twee schemagenerators schrijven historische SQL. Maak de nieuwe generatieflow herhaalbaar en gebruik **nieuwe forwardmigraties** voor nieuwe validatie. Herschrijf geen historische migraties of oude assetidentiteiten om tests passend te maken. Bewaar legacyfixtures.

## Validatie en oplevering

Voer de toepasselijke bestaande repo-gates uit, minimaal de verplichte type-/contract-/renderchecks volgens AGENTS/canons. Gebruik relevante projector-, Worker-, Player/offline-, wizard- en dynamische workflowtests; bij schemawijzigingen ook de contract/database-/RLS-checks in een geïsoleerde testomgeving. Geen bestaande staging- of productiedatabase legen.

Toon betekenisvol bewijs voor alle 36 families in beide varianten/formaatkeuzes en voor de speciale cases uit `05-ACCEPTATIE-EN-TESTEN.md`: pinned rij boven/midden/onder, welkom 0–4, vaste grids 0–6 en >6, klok boven score, ontbrekende assets, gelijk elapsedMs in DOM en export, pauze/reduced motion en correcte fallback/LKG.

Lever een concrete PR met wijzigingssamenvatting, bron-/referentieversies, screenshots en geëxporteerde motionframes, uitgevoerde checks, compatibiliteitskeuzes en eventuele resterende beperkingen. Werk bestaande taakledger/documentatie bij. Volg voor staging/publicatie de bestaande afgesproken pipeline. Deze opdracht vraagt geen productiecredentials, dataverwijdering, reset of zelfstandige productiedeployment.
