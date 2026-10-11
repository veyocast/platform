# Templates, Studio’s en Player: exacte Sites-overname

Onderzoek op 11 oktober 2026. Bronvergelijking, geen uitgevoerde migratie of fysieke Player-test.

- Sites-referentie: `b1cae899af19fc39908217253094c5240d7359fc` in `source/sites/` van het overdrachtspakket.
- GitHub-doel: `veyocast/platform`, `6fcc26f02c8050b7244e3660a93b85f02491e121`.
- Bewijspaden met prefix **S** zijn relatief aan de Sites-root; **G** aan de GitHub-root. Regels horen bij deze exacte commits.

## Besluit

De visuele eindtoestand is de Sites-broncode, inclusief compositie, assets, fonts, formaten, wizards en bediening. De productiecode heeft uitgebreidere domeinen en een andere rendererarchitectuur. Een CSS-bestand vervangen of alleen `onzetrots-tv` in een dropdown zetten levert daarom geen volledige overname op.

De bestaande veilige VeyoCast-publicatie-, media-, provider- en Playerketen blijft de functionele basis. De nieuwe Sites-presentatie moet daar via expliciete, versieerbare contracten op aansluiten. Browseropslag, voorbeeldverbindingen en gesimuleerde gebeurtenissen uit Sites zijn geen productie-implementatie.

## 1. Inventaris: wat exact mee moet

| Onderdeel | Sites-referentie | Omvang / gedrag |
|---|---|---|
| Algemene Studio | S `app/prototype/studio.tsx:13–60,133–164`, `studio.module.css` | 11 basisstartpunten, beide oriëntaties, vier beeldindelingen, context/locatie, foto-uitsnede, kleuren, motion, duur, projecten/slides, undo, mobiele panelen |
| OnzeTrots TV | S `onzetrots-tv-templates.ts:6–43` | Acht aanvullende startpunten: wedstrijd, programma, uitslagen, stand, kantine, clubnieuws, partners, welkom; eigen 16:9- en 9:16-composities |
| Themarenderer | S `onzetrots-tv.tsx:44–68`, `onzetrots-tv.css` | De acht composities plus score, goal, lineup en generic. Vaste logische canvassen 1920×1080 en 1080×1920, uniforme buitenschaal |
| Thema-inhoud | S `screen-themes.ts:13–27`, `onzetrots-tv-editor.tsx` | Gestructureerde wedstrijd/rij/statistiek/menu/partner/nieuwsgegevens en bewerkbare afbeeldingen/clubidentiteit |
| Dynamische Studio-basis | S `experience.tsx:17–38`, `experience.module.css` | Theme, achtergrond, overlay, accent, layout, oriëntatie, schaal, uitlijning, safe area, duur, paginering en schermkeuze |
| LED Scores | S `led-scores.tsx:13–23,92–114` | Twee afspeelvormen: live-score in playlist en tijdelijke wedstrijdmomenten. Goal/eigen-tegenstander, start, rust, einde, opstelling; bron- en doelkeuze, simulatie |
| LED oude OnzeTrots-stijlen | S `led-slide.tsx`, `led-slide.module.css`, `onzetrots-backgrounds.ts` | OnzeTrots Blauw, OnzeTrots Papier en FieldFlow naast het extra OnzeTrots TV; bestaande vijf herkenbare landmarkcomposities blijven behouden |
| Grootte/fullscreen | S `led-sizing-controls.tsx:10–57`, `led-fullscreen.tsx` | Master en titel/score/logo/team afzonderlijk 70–200%, schermvullendpreset, reset, clubregels en kleine bovenregel, passend maken |
| Sportlink | S `sportlink.tsx:10–19,71–90` | Zes zichtbare categorieën; vijfstapswizard, meerdere typen/teams tegelijk, clubbundeling of één ontwerp per team, veld/kleedkamer/tijd, vormgeving, previewpagina’s |
| Menu/Twelve | S `commerce.tsx:95–114` | Productselectie, categorieën, prijzen, achtergrond, schermthema en paginering; vierstapsflow |
| YouTube | S `commerce.tsx:15,128–140` | Video-/playlistconfiguratie en zelf ontworpen fallback; Sites start geen video en doet geen providercheck |
| Playlistintegratie | S `content.tsx`, `playlist-editor.tsx` | Preview via dezelfde canvascomponenten; thema per item, selectie of hele playlist; geneste design-/Studio-snapshot behouden |

De 11 basisstartpunten heten in Sites: Wedstrijd van de dag, Weekendprogramma, De eindstand, Sponsor in de spotlight, Kantinespecial, Clubavond, Vrijwilligers gezocht, Welkom bij de club, Wedstrijd afgelast, Volg onze club, Belangrijke mededeling. Acht extra TV-startpunten betekent dus 19 startpunten; geen claim dat 19 onafhankelijke renderengines bestaan.

OnzeTrots TV is een **extra content-/schermthema**, niet de petrol/groen/oranje Control-appskin. De LED-keuze `config.ledTheme = blue|paper|fieldflow` is daarnaast een afzonderlijke legacy-presentatiekeuze. Maak dit onderscheid expliciet in het productiecontract; vervang niet stilzwijgend iedere betekenis van `fieldflow`.

## 2. Wat GitHub al heeft, en waarom het toch anders oogt

### 2.1 Vrije Studio

G `packages/studio/src/templates.ts:8–20,134–185` heeft dezelfde elf categorieën maar produceert **22** system-templateobjecten: 11 categorieën × 2 formaten. De current renderer bouwt een Royal Current/Navy Glass-shell. Die heeft andere kleuren, geometrie, fonts en elementstructuur dan Sites. Bestaande namen betekenen dus geen visuele pariteit.

G `packages/studio/src/schema.ts:190–243` beschrijft een versioned `StudioDocument` met artboard, motion en elementlagen. Sites `Slide` is een veel eenvoudiger, ander model met onder andere `title`, `time`, `subtitle`, `photo`, `layout`, `themeId` en optioneel `tv`. Die objecten kunnen niet rechtstreeks als `StudioDocument` worden opgeslagen.

Productieroutes en commando’s bestaan al:

- G `apps/control/app/(shell)/dashboard/studio/actions.ts:46,187,251,326,378,431,490`: project aanmaken, draft bewaren, muteren, revisieherstel, conflictkopie, brandkit en renderaanvraag.
- G `apps/control/app/(shell)/dashboard/studio/[designId]/studio-editor-workspace.tsx` en `studio-konva-canvas.tsx`: huidige editor/canvas.
- G `apps/media-worker/src/studio-render-svg.ts:48–105,214–268`, `studio-render-image.ts:56–70`, `studio-render-resvg.ts:14–73`: SVG → raster; video bestaat via `studio-render-video.ts`.
- G `docs/studio/integration-matrix.md:5–45`: Studio bevriest een bronrevisie, worker levert gewone PNG/MP4-media, Player importeert geen authoringmodule.

**Uit te voeren:** breng de Sites-editor over als presentatie boven deze commands; leg de Sites-templateparameters in een strikt versioned contract vast. Gebruik voor deze specifieke CSS/DOM-composities een trusted, product-owned gedeelde renderer voor preview én worker-capture. Sluit die capture aan op de bestaande immutable Studio-job/media-pipeline. Dit is een gerichte uitbreiding van het Studio-rendercontract. Het is geen vrij HTML-/JS-document. Een alternatieve vertaling naar bestaande elementlagen is alleen acceptabel na aantoonbare pixel- en motionpariteit; bestaande Konva/SVG-uitvoer zonder vergelijking is onvoldoende.

### 2.2 Dynamische templates en thema-authority

G `packages/contracts/src/dynamic-content.ts:5–51` kent 17 Sportlink-families, menu/price_list/news en aanvullend LED live-match. Sites toont zes Sportlink-keuzes. Productiefuncties buiten die zes mogen niet verdwijnen; voeg ze in dezelfde Sites-componenttaal toe en documenteer ze als aanvullende production-only schermen. Presenteer de nieuwe zeskaartwizard voor de bestaande Sites-flow exact.

**Concreet blokkerend:** G `packages/contracts/src/theme-engine.ts:3,54–56` staat nieuwe authoring uitsluitend onder `fieldflow` toe. G `supabase/migrations/20260902113201_s144_fieldflow_theme_authoring.sql:70–83,104–120,122–154` bewaakt dit tevens aan de databasegrens. G `20260906143000_s153_slide_theme_backoffice.sql` bevat verdere profile/snapshot/menu-guards. Alleen clientcode aanpassen kan niet werken.

**Uit te voeren:** voeg forward-only een versioned presentatie/themacontract toe voor `onzetrots-tv` en de Sites LED-stijlen; breid relevante Zod-schema’s, theme manifest/catalogus, selecties, servervalidatie, DB-guards, snapshotbuilder en testcases samen uit. Laat de oude IDs decodeerbaar. Houd bestaande snapshots/releases byte-ongewijzigd. Laat onze nieuwe referentie de authoringpresentatie bepalen, zonder historische Royal Current-weergave te herschrijven.

De eerdere repositoryregel “slide-editors mogen geen eigen kleur/schaal opslaan” conflicteert met de nu expliciet gevraagde Sites-controls. Voor deze overname moeten begrensde, servergevalideerde per-ontwerpinstellingen worden toegevoegd en bij publicatie worden bevroren. Behoud een centraal thema als standaard, maar wis de door de gebruiker gekozen Sites-instellingen niet bij opslaan. Geen vrije CSS, scripts of onbegrensde fontuploads.

G `packages/content-templates/src/dynamic-template-view.ts:424–485,529–555,783–824` projecteert momenteel theme/snapshotdata naar de renderer. Daar hoort de productieadapter voor de nieuwe inhoud bij. S `onzetrots-tv-adapter.ts` is de semantische referentie, maar zijn parsers voor demo-tekst zoals `"6 gespeeld"` of `"5 W · 16 pt"` zijn geen productiegegevensmodel. Gebruik echte, getypeerde velden uit de genormaliseerde providerdata.

### 2.3 Sportlink mapping

| Sites kind | Productie slideType | Behoud / aandachtspunt |
|---|---|---|
| `programme` | `sport_program` | Datum, thuis/uit, teams, veld/kleedkamer/tijd, poule/competitie en paginering rechtstreeks uit canonical rows |
| `results` | `sport_results` | Thuis/uit-score apart; onbekende score blijft onbekend; geen 0–0 verzinnen |
| `standings` | `sport_standing` | Rank, gespeeld, winst/gelijk/verlies, punten, doelsaldo en beschikbare vormdata getypeerd; keuzes mogen gegevens alleen verbergen |
| `arrival` | `sport_visitor_arrivals` | Bestaande tijdvensters, echte bezoekerslogo’s, veld/kleedkamer behouden; Sites generic-vormgeving moet een eigen getypeerde compositie krijgen |
| `referees` | `sport_referee_arrivals` | Scheidsrechter-/wedstrijdselectie behouden; geen fictieve namen of context uit de demo |
| `birthdays` | `sport_birthdays` | Opt-in en scope/privacycontrols blijven echt server-side; lokale datum Europe/Amsterdam en huidige midnightprojectie behouden |

G `apps/control/app/(shell)/dashboard/studio/sportlink/new/actions.ts:30–71` gebruikt al `create_sportlink_slide_batch_v6`; behoud die bulkfunctionaliteit en tenant/capabilityvalidatie. G `apps/control/app/(shell)/dashboard/slides/actions.ts:46–143,164–320` heeft server-side preview en create; preview is niet automatisch een opgeslagen slide. De wizards moeten die echte preview gebruiken in plaats van S `sportlink.tsx:22–38` `demoRows`/`buildRows`.

### 2.4 LED Scores mapping

Sites gebruikt eigen `Connection`, `Moment` en `Variant` objecten met demo-ID’s (S `led-scores.tsx:13–23`). Productie heeft server-only koppelingen, leases, realtime events, deduplicatie, betrouwbare doelaflevering en een uitgebreide canvasbinding.

- G `packages/contracts/src/ledscores-scene.ts:7–40`: `goalOwn`, `goalOpponent`, `goalUnknown`, `lineupHome`, `lineupAway`, `matchStart`, `halfTime`, `matchEnd`; textbindings naar score/klok/speler/team en imagebindings naar foto/logo’s.
- S `goal` + side → `goalOwn`/`goalOpponent`; onbekend → bestaande `goalUnknown`-policy, nooit willekeurig als eigen goal behandelen.
- S `lineup` → thuis/uitvariant op basis van gekozen echte teamidentiteit; S `start/half/end` → `matchStart/halfTime/matchEnd`.
- S `live-score` → bestaande `ledscores_live_match` resource; S `goal-overlay` → bestaande overlayconfiguratie/publicatie, niet als gewone playlistslide opslaan.
- G `apps/control/app/(shell)/dashboard/studio/led-scores/actions.ts:36,302,323,345,385`: save, publish, status, synthetic test en create live match bestaan. Bind Sites-acties hieraan.
- G `packages/contracts/src/ledscores-scene.ts:68–85` accepteert nu alleen Inter/Inter Tight in canvastext. OnzeTrots brush/display passen daar niet in: fonts/versie/renderer uitbreiden of expliciete trusted templatevariant toevoegen. De huidige capture/runtimes moeten dezelfde fontbytes gebruiken.

Handhaaf eigen/tegenstandervarianten, laatst bevestigde score, bevroren klok bij stale data, buiten-wedstrijdpolicy, klok/timeline-toggles, pauze/doorgaan van onderliggende playlist, prioriteit, natuurlijke video-eindgrens en bestaande realtime security. Sites demo-simulatie is alleen testbediening, geen bewijs dat provider-/schermpublicatie is geslaagd.

### 2.5 Menu en YouTube

G `packages/contracts/src/menu-studio.ts:49–65,81–107,244–255` bevat money met integerbedragen, productreferenties, groepen en oriëntatielayouts. G `apps/control/app/(shell)/dashboard/slides/menu-studio/actions.ts:27,80,141,192` bevat create/save/orientation/publish. Sites geeft alleen geselecteerde productregels weer; behoud de uitgebreidere productgroepmogelijkheden in de nieuwe UI en map dezelfde bevroren producten naar OnzeTrots-kantine. Demo-eurostrings worden niet de database-authority. Bestaande Twelve/Excel-import blijft de echte bronflow.

GitHub YouTube ondersteunt getypeerd één video met verplichte `fallbackMediaAssetId`, `onlineOnly:true` en gecontroleerde metadata (G `packages/contracts/src/youtube.ts:3–30`). Sites toont ook playlist-URL-configuratie, maar doet geen playback. Dat is een expliciete functionele kloof: implementeer playlistondersteuning via een nieuw gecontroleerd contract/providerpad, Gedurende de bouw mag die optie herkenbaar niet beschikbaar zijn; volledige oplevering vereist werkende playlistondersteuning. Niet stilzwijgend alleen het eerste video-ID bewaren. OnzeTrots-fallback moet als echte, checksumgebonden PNG met provenance worden gegenereerd en gekoppeld; een lokale preview-/blob-URL kan niet naar Players.

## 3. Assets, fonts en exacte herkenbaarheid

Kopieer alle relevante bytes uit de Sites-export en gebruik de pakketchecksums. Niet opnieuw genereren, niet van Google Fonts ophalen, niet vervangen door een vergelijkbaar font of foto.

- S `public/onzetrots/premium/`: clubhuis, havenlicht, kerk, duindorp-luchtfoto, historische-poort. S `onzetrots-backgrounds.ts:1–28` bevat alleen bekende legacyalias-mapping; eigen uploads behouden hun identiteit.
- S `public/onzetrots/`: brush/mask/distress-assets die het huidige LED-ontwerp bepalen.
- S `public/fonts/onzetrots-brush.ttf`, `onzetrots-display.ttf`; S `led-slide.module.css:1–2,25–31` verklaart het gebruik in koppen, teamnamen en distressed score.
- S `public/onzetrots-tv/assets/`: exacte clubmuur, letteringmask, clublogo, playercutouts, sponsorlogo’s, distress; S `public/onzetrots-tv/fonts/club-font-0..9.ttf` met de oorspronkelijke lokale fontregistraties in `onzetrots-tv.css`.
- OnzeTrots TV gebruikt Barlow Condensed, Manrope en brushfont; het woordmerk is een aangeleverd imagemask en geen te vervangen tekstfont.
- S `public/fieldflow/` en overige public-assets blijven nodig voor basis-Studio en appskin; alleen de TV-map meenemen is onvoldoende.

S `media-assets.tsx:8–18` bewaart customafbeeldingen als browser-IDB `asset:` referenties. Deze uploads zijn niet automatisch in de git-export aanwezig. Voor bestaande gebruikersinhoud is een expliciete export/import nodig die alle blobs materialiseert, uploadt naar tenantmedia en de verwijzingen transactioneel omzet. Publicatie blokkeert op ontbrekende asset; geen lege afbeelding als geslaagde import melden.

Maak system-themeassets immutable en versiegebonden (assetmanifest, hash, MIME, maten, licentie/provenance). Tenantuploads lopen door bestaande media/quota/scanningpipeline. Alle foto’s, logo’s, masks en fonts die tijdens playback nodig zijn moeten via het release-/shellcachecontract beschikbaar en geverifieerd zijn. Geen afhankelijkheid van de Sites-host voor productieplayback.

## 4. Preview is niet de volledige Player

G `apps/player/app/_components/dynamic-template-media.tsx:21–123` projecteert data/klok en gebruikt `EditorialArenaRenderer`, met een apart live-matchpad. G `apps/player/app/_lib/lg-legacy-page.ts` heeft een **zelfstandige** Static LG-renderer en font/themeprojectie. Moderne React/CSS porteren bewijst geen LG-pariteit.

S `led-slide.module.css:3,16–31` gebruikt container query units (`cqw`), masks en moderne layout; S `onzetrots-tv.tsx:49–68` gebruikt `ResizeObserver`, vaste canvasmaten en schaal. Inventariseer ieder gebruik van browserfeatures tegenover Static LG/Chrome-79-safe code. Bied een gelijkwaardige legacycompositie met vooraf berekende canvaspixels en dezelfde assets/fonts, plus bestaande geverifieerde PNG-fallback. De fallback vangt compatibiliteitsfouten op; zij bewijst geen actuele live-scorepariteit.

Android TV gebruikt de hosted Player in een native WebView (G `apps/android-tv/README.md:20–38`). LG-wrapper behoudt playback/cache in de hosted Player (G `apps/lg-webos-signage/README.md:12`). Bouw geen tweede eigen playlistengine in de wrappers.

Gebruik de nieuwe shared presentatierenderer in:

1. Control live preview en fullscreenpreview;
2. playlist-/releasepreview;
3. worker thumbnail/postercapture;
4. moderne Player;
5. Static LG-equivalent met dezelfde frozen contractdata;
6. LED-eventoverlay naast normale content, zonder timers of prioritysemantiek te veranderen.

Voor vrije Studio blijven PNG/MP4-export en het gewone mediapad leidend. Voor getypeerde dynamische templates blijft HTML/CSS plus veilige PNG-fallback leidend. Eén visuele componentbibliotheek kan beide bedienen; de authoringeditor zelf gaat niet naar de Player.

## 5. Immutable releases en actuele brondata: S185 behouden

De actuele authority is G `docs/s185-current-publication.md:79–126`, plus de S185-delta van `player-offline-canon.md`. Sommige oudere passages in `dynamic-slides-canon.md` beschrijven automatische releases per bronupdate; **die oudere flow niet opnieuw invoeren**.

- `playlist_publications` wijst naar immutable configuratie; thema, selecties en ontwerpparameters zitten in die configuratie.
- `published_dynamic_data` levert afzonderlijk device-geautoriseerde live datasetrevisies voor exact de gepubliceerde selectie. Bronupdates veranderen geen draft, playlistrelease, itemtimer of afspeelindex.
- Een bewuste ontwerp-/themawijziging maakt een nieuwe gecontroleerde configuratie/publicatie; oude historie blijft identiek.
- Nieuwe opdracht krijgt monotone `target_revision`; slechts één nieuwste kandidaat wordt voorbereid, oude callbacks/downloads mogen die niet overschrijven.
- Iedere verplichte asset moet lokaal compleet en geverifieerd zijn vóór activatie. Schakel op natuurlijke item-/paginagrens, speel gezonde video uit; behoud last-known-good en vorige release.
- Hergebruik gescheiden LED-eventsemantiek. Geen event opnieuw vieren bij datasetrefresh, reconnect of renderremount.
- Themawijziging mag geen actief schedule of sponsorplan stilzwijgend vervangen.

## 6. Concreet uitvoeringspakket

| Werkpakket | Wijzigingen | Klaar wanneer |
|---|---|---|
| T1 | De 19 Sites-startpunten en alle fonts/assets registeren met eigen versioned identities | catalogus en checksums compleet; geen oude templatebron in-place overschreven |
| T2 | Product-owned DOM-presentatielaag uit Sites losmaken van local state/importcycli | basis/TV/LED preview exact; strikt inputcontract; geen remote scripts |
| T3 | Theme/appearance, LED, Studio en Menu-contracten uitbreiden; forward-only DB-guards/snapshotbuilders | nieuwe ontwerpen bewaren alle controls; oude releases blijven leesbaar en bytegelijk |
| T4 | Algemene Studio/wizards op bestaande servercommands aansluiten | create/edit/undo/autosave/conflict/herstel/render/export werken met echte data |
| T5 | Sportlink zesflow + productie-extrafamilies; canonical datasetadapters | geen demoRows in productie; selectie/preview/publicatie gelijk |
| T6 | LED vierstijlen en beide afspeelvormen koppelen | correcte eigen/tegenstander/events/clock/timeline/scale/targets; secure test/publicatie |
| T7 | Menu/Twelve en YouTube fallback koppelen | geld/bronidentiteit en fallbackprovenance kloppen; playlist-YouTubegap end-to-end gebouwd; blokkeren is alleen een tijdelijke bouwstatus |
| T8 | Moderne Player + Static LG + workerpariteit en assetcache | dezelfde contractinput geeft dezelfde bedoelde compositie; fallback en offline bewezen |
| T9 | Migratie bestaande concepten + canary | exacte mapping, geen dataverlies, geen automatic reskin historie, bestaande doeltoewijzingen intact |

## 7. Acceptatiematrix en concrete scenario’s

Maak deterministic fixtures vanuit exact de meegeleverde source en bewaar ref/new/diff. Dezelfde inhoud, fonts, viewport, taal en motionframe gebruiken. Geen claims van pixelperfect zonder beoordeelde beelden.

- **Basis:** alle 11 startpunten × beide oriëntaties, originele vier layouts; wijzig title/time/subtitle/location/photo/fit/overlay/color/bold/italic/align/size; save/reopen/undo/export geeft hetzelfde.
- **TV:** alle acht × beide oriëntaties met exacte aangeleverde fixtures; edit relevante tekst, hero, logo, rij, menucombo, partnerafbeelding; datum en score komen niet terug op demowaarden na opslaan.
- **Themawissel:** FieldFlow → TV → FieldFlow op bestaand ontwerp; gegevens en niet-actieve stijlconfig blijven bewaard. Per playlistitem, selectie en heleplaylist werken; historisch gepubliceerd item blijft ongewijzigd.
- **LED:** vier stijlen × beide oriëntaties × live score/eigen goal/tegengoal/start/rust/einde/opstelling. Controleer 0–0, 12–10, lange teamnaam, langenaamspeler, geenlogo en onbekendteam. Master en onderdelen 70/100/200%, schermvullend, reset, branding/label-toggles, contain/cover, safearea. Geen overlap of verdwenen cijfers.
- **Sportlink:** zes Sites-typen × beide oriëntaties × beide schermthema’s; team-/clubscope, meerdere teams, thuis/uit, datum, lege/toekomstige/historische data, onbekende score, geenlogo, onderste kolommen en paginering. Productie-extrafamilies niet onbereikbaar maken.
- **Paginering:** meer dan 8 programma/uitslagen/standrijen, meer dan 12 kantineproducten, meer dan 3 nieuwsitems, meer dan 6 partners; laatste pagina zichtbaar en voldoende lang, exacte totaalspeelduur. Sites-richtwaarden komen uit `studio.tsx:36–43`; productie bepaalt veilige capaciteit met dezelfde compositie, niet stilzwijgend tekst kleiner maken.
- **Menu:** prijswijziging, verborgen categorie, meerdere categorieën, lange productnaam, unavailableproduct, groepsproducten en int-prijsvaluta; bronverversing volgt actuele productiepublicatiesemantiek.
- **YouTube:** beschikbaar/privé/niet-insluitbaar/offline; fallback is volledig lokaal. Geen veronderstelling dat Sites-playlistconfig al productieondersteund is.
- **Media:** alle vijf landmarks op juiste uitsnede, custom upload na herstart én op ander device, ontbrekende asset, vertraagd font; capture wacht op fonts en decode van afbeeldingen.
- **Player:** release compleet/incompleet/corrupt asset; offline start/netwerkverlies/reconnect; snelle opeenvolgende doelen; healthyvideo blijft doorspelen; live data geen timerreset; goal slechts eenmaal; huidige planning/sponsorvolgorde behouden.
- **Hardware:** moderne browser, Android WebView/TV en echte ondersteunde LG-model/firmware, landscape/portrait/fullscreen. Chromium en een groene deployment zijn geen fysiekehardwarepass.

Relevante bestaande gates uit G `AGENTS.md:103–129`: lint/typecheck/test; bij schema/RLS dbreset + RLS; UI a11y + Chromium; Player player/offline. Toets aanvullende renderer-/fontmanifest-/LG-compatibiliteitschecks en maak de nieuwe ref/new/diff-set onderdeel van de PR. Dit auditrapport voert die tests niet uit.
