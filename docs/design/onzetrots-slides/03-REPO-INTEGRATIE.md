# 03 — Integratie in de bestaande VeyoCast-repository

Onderzocht op 22 oktober 2026. Repository: https://github.com/veyocast/platform. De actuele main is opnieuw gelezen en stond op commit **3bbb51ac006bbaf8381a11d5dcfd7024d13d3876**. Alle hieronder als gelezen aangemerkte bestanden zijn op die exacte ref opgehaald. Dit document is de brononderbouwde uitvoeringsinstructie bij de goedgekeurde overdracht. Het referentieprototype staat in broncode/. De exacte broninventaris staat in inventaris/repo-integration-inventory.json. Er is voor het maken van dit pakket niets in de VeyoCast-repository gewijzigd.

## Kernconclusie

De goedgekeurde OnzeTrots-slidecollectie moet in de **actieve Sync-keten** worden geïntegreerd. Een port naar alleen de oudere Sites-v11/v17-renderers of alleen naar de templatekiezer bereikt de huidige productiepreview en Player niet volledig. De nieuwe vormgeving geldt voor OnzeTrots, met behoud van FieldFlow en historische documenten.

Er zijn vier concrete technische verschillen tussen de actieve repo en het goedgekeurde prototype:

1. Het huidige Sync-model kent voornamelijk rijen van vier strings. Het verliest rijke sportgegevens, rijlogo’s, precieze wedstrijdidentiteiten en artikelfoto’s bij projectie. De nieuwe vormgeving vereist versiegebonden, getypeerde velden en volledige assetverzameling.
2. De huidige Sync-renderer maakt één hoofdcanvas met topheader en losse familiesectie. Het goedgekeurde ontwerp heeft eigen containerheaders, Duindorp-logo rechts in die headers en geen tweede buitenheader.
3. De Worker bevriest alle interne animaties en hergebruikt na de binnenkomsttransitie één stilstaand raster. De bewegende stand en show-effecten moeten expliciet en deterministisch in export én DOM worden ondersteund.
4. CSS- en schemagenerators lezen een oude bevroren Source. Twee schemagenerators overschrijven historische migraties. Nieuwe bronbestanden en forwardmigraties zijn nodig; blind generators draaien is fout.

## 1. Governance en bestaande stack

Lees vóór repositorywerk de actuele AGENTS.md en de daarin voorgeschreven README, PLANS, TASK_LEDGER, technische/design-/security-/offlinecanons en relevante sprintopdracht. De gebruikersgoedkeuring vervangt de oude zichtbare OnzeTrots-opmaak, niet de bestaande dataveiligheid of releasecontracten.

AGENTS.md vereist Next.js App Router, TypeScript, pnpm workspaces, bestaande UI-componenten en server-side permissies. De root package.json vermeldt pnpm@11.5.2 en Node >=24. Er is geen frameworkmigratie nodig voor dit ontwerp.

Belangrijke grenzen:
- Tenantgegevens blijven tenantgebonden; geen service-role-sleutel of providercredentials in browsercode.
- De Player is een device, geen normale Auth-user.
- Publicaties blijven immutable. Een release wordt pas na volledige assetverificatie en zichtbare framebevestiging actief.
- Last-known-good en de complete PNG/MP4-fallback blijven beschikbaar.
- Locked VeyoCast-assets en de bestaande systeemoverlay linksonder blijven bij de Player-shell. De witte OnzeTrots-signatuur rechtsonder is clubinhoud, geen vervangende softwarewatermark.
- Geen nieuwe productiecredentials, database-reset, verwijdering van data of productiedeployment als bijvangst van deze opdracht.

## 2. Actieve integratiekaart

| Laag | Bestaand bestand | Gelezen gedrag en bedoelde wijziging |
| --- | --- | --- |
| Catalogus | packages/contracts/src/sync-content-families.ts | Precies 36 families met vaste IDs, labels en groepen. Behouden. |
| Renderermodel | packages/contracts/src/sync-slide-presentation.ts | Strict Zod-model, rendererVersion sync-v1, vaste sourceRevision, beide oriëntaties, thema fieldflow/onzetrots-tv, vierstringrijen, ownRowIndexes, centrale assetcollector en paginatelling. Nieuwe versie/rich fields hier formeel vastleggen. |
| Renderer | packages/content-templates/src/sync-slide-static-view.tsx | Pure React/SSR-markup, gedeeld door preview en Worker. Voegt een topheader en een grote familiesectie toe. Nieuwe OnzeTrots-containercomposities hier of in een versiegebonden subrenderer integreren. |
| CSS | packages/content-templates/src/sync-slide-styles.ts | Gegenereerde CSS-string uit oude Source, globaal gescoped onder sync-slide-root. Een expliciete nieuwe OnzeTrots-stijllaag reproducibel opbouwen. |
| Dataprojectie | packages/content-templates/src/sync-dynamic-projector.ts | Valideert canonical payload en seed, bewaakt familie/type, verzamelt geverifieerde assets en projecteert echte brondata. Verrijken zonder providercalls in de renderer. |
| Dynamische configuratie | packages/contracts/src/sync-dynamic-configuration.ts | Type-naar-familiemapping; seed mag géén gekoppelde feiten bevatten. Nieuwe opties zijn authoringconfiguratie, feiten blijven canonical snapshotdata. |
| Dynamische playback | packages/contracts/src/sync-dynamic-playback.ts | Afzonderlijke configuratie- en inhoudshashes, exacte assetset/checksums, duur- en paginacontroles. Uitbreiden voor alle nieuwe rich-field-assets. |
| Nieuwe ontwerpwizard | apps/control/app/(shell)/dashboard/studio/sync-create-wizard.tsx en sync-create-wizard-state.ts | Vier stappen Bron/Inhoud/Vormgeving/Controleren, handmatig of gekoppeld, aparte previewactie en requestjournal. Hier licht/donker en toepasselijke configuratie exposeëren. |
| Handmatige editor | apps/control/app/(shell)/dashboard/studio/[designId]/sync-studio-editor.tsx | Bestaande serveracties, revisions, recoverable drafts, renderjobs en echte permissions. Nieuwe layoutvelden met dezelfde lifecycle bewaren. |
| Gekoppelde editor | apps/control/app/(shell)/dashboard/slides/sync-dynamic-editor.tsx | Beheert request/configuratie; preview is read-only en queued geen render. Dezelfde lay-out en gevalideerde preview gebruiken. |
| Sportlinkselectie | apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding.ts | Eigen beschikbare teamcontexten, scopepolicy en compilefunctie. Niet vervangen door client-side naamvergelijking. |
| Pickerfixtures | apps/control/app/(shell)/dashboard/studio/sync-template-preview.ts | Expliciet uitsluitend voorbeelddata; strikt gescheiden van authoringstarters. Hier zes voorbeeldjarigen en zes voorbeeldactiviteiten tonen. |
| Gedeelde preview | apps/control/app/(shell)/dashboard/playlists/_components/sites/sync-studio-preview.tsx | SyncSlidePreview schaalt het werkelijke canvas en speelt pagina’s met vaste duur af. Zelfde renderer, niet een tweede mini-layout. |
| Studio-document | packages/studio/src/sync.ts | createSyncStudioDocument en updateSyncStudioDocument valideren duur; lege tenantstarters bevatten geen voorbeeldfeiten. Nieuwe paginatelling moet hiermee kloppen. |
| DOM-capture | apps/media-worker/src/sync-dom-capture.tsx | SSR met strenge CSP, geverifieerde lokale assets, fonts, beelddecode, PNG en frames. Interne motion ontbreekt nu in sample-loop. |
| Dynamische export | apps/media-worker/src/sync-dynamic-render.ts | Compileert volledige canonical snapshot via projectSyncDynamicSnapshot en createSyncStudioDocument naar gecontroleerde PNG/MP4 met poster. Nieuwe visual/rich fields door hele keten voeren. |
| Moderne Player | apps/player/app/_components/sync-studio-media.tsx | Gedeelde Sync-renderer, voorbereiding/decode, zichtbare frames, paginatiming, pause en fallback. Nieuwe motion aan deze tijdslifecycle koppelen. |
| Player-preparatie | apps/player/app/_lib/sync-player-presentation.ts | Alleen lokale checksumcache/blob-URLs; rewriter voor CSS-assets. Alle nieuwe fonts/artwork moeten verklaard en offline beschikbaar zijn. |
| Live score | apps/player/app/_lib/sync-live-match.ts | Alleen geautoriseerde stream/cache; verbinding en ouderdom worden gecontroleerd. Logo’s blijven frozen verified refs; stream-URLs worden nooit vrije renderassets. |
| Compatibiliteit | apps/player/app/_lib/sync-player-capabilities.ts | Oudere WebViews gebruiken complete raster/video-fallback. Niet forceren naar nieuwe DOM- of CSS-functies. |

## 3. Datacontract: wat gaat nu verloren?

De gelezen projectSyncDynamicSnapshot maakt standen van [positie, teamnaam, gespeeld, punten]. De huidige SyncSlideMarkup toont daarvoor alleen #/TEAM/G/PTS en een naamdot. Gewonnen, gelijk, verloren, saldo, vorm en per-rij logo’s staan niet in die Sync-presentatie, ook wanneer de canonical view ze wel kent. Deze gegevens opnieuw uit strings of puntentotalen berekenen is onjuist.

Wedstrijdlijsten reduceren items tot [thuisteam, uitteam, tijd/score, kamer/veld]. Hierdoor ontbreken in de huidige Sync-presentatie onder andere stabiele homeClubId/homeTeamId, kickoffAt, status, aparte homeRoom/awayRoom en beide logo’s. Het welkomstfilter “alleen aankomende eigen thuiswedstrijden” kan hiermee niet betrouwbaar op identiteit en tijd worden uitgevoerd.

Verjaardagen worden [dag, maand, displayName, age-plus-meta-string]. Voor de grote leeftijd met afzonderlijke naam en team moeten leeftijd en metadata getypeerd blijven. Publicatie mag alleen de reeds toegestane geboorte-/displayinformatie verwerken; bestaande privacyfilters blijven leidend.

Agenda/activiteiten worden vier tekstvelden en verliezen per-item beeld. Nieuws bewaart title/intro/source/url maar geen heroAsset in het Sync-newsmodel. Sponsor- en menurijen bevatten evenmin alle beeldvelden die de nieuwe containercomposities gebruiken.

Aanbevolen versiegebonden vorm:
- standings: stabiele rij/teamidentiteit, positie, teamName, logo-ref, played/won/drawn/lost/goalDifference/points als nullable getallen, vorm als getypeerde reeks, own op gecontroleerde team-ID.
- fixtures/arrivals: match-ID, gecontroleerde home/away club- en teamidentiteiten, names en logo-refs, kickoffAt met offset/UTC, status, homeMatch, veld en aparte kleedkamers.
- birthdays: toegestane displayName, nullable leeftijd, toegestane team/meta, datumlabel; geen nieuwe persoonsdata ophalen in de renderer.
- activities en news: item-ID, titel, introductie/body, datum/tijd, locatie en optionele verified image-ref.
- behoud de oude vierstringrijen als legacycontract. Voeg geen willekeurige HTML/CSS/JS of vrij externe afbeeldings-URLs toe.
- syncSlideAssets moet iedere nieuwe geneste assetref verzamelen; dynamic playback, captureloader, Playercache en checksumtests moeten exact dezelfde set gebruiken.

Licht/donker is in het huidige Sync-stylemodel geen afzonderlijk modeveld. Er is alleen theme plus backgroundkeuze en accent. Voeg voor de nieuwe OnzeTrots-versie een expliciete, streng gevalideerde modekeuze toe; misbruik de achtergrondfoto niet als themamodus.

## 4. Familiegebonden gedrag

### Stand en periodestand

De volledige poule is één doorlopende ranglijst met een identiek kolomgrid voor kop en rijen. Eigen teamidentiteit komt uit de gecontroleerde bron, niet uit een tekstzoekactie op Duindorp. De eigen rij beweegt eerst mee en wordt tegen boven- of onderrand begrensd; andere rijen blijven verder bewegen. Gebruik een zuivere motionfunctie van verstreken tijd en bekende layoutmaten, met korte pauzes aan de lijstgrenzen, ook voor export. Bij pauze of reduced motion blijft leesbare informatie staan. Toon ontbrekende vorm/statistieken als ontbrekend; verzin ze niet.

De algemene huidige syncSlidePageCount deelt alle rijen door rowsPerPage. Die paginatie mag de nieuwe pinned stand niet ongemerkt in losse tabellen splitsen. Maak de nieuwe layouttelling versie- en familiegebonden.

### Welcome en visitors

Het prototype gebruikt voor beide families dezelfde bezoekerkaarten. Maximaal vier aankomende eigen thuiswedstrijden, oplopend gesorteerd op kickoffAt; geannuleerd/uitgesteld/afgelopen, ongeldige tijd, uitwedstrijden en niet-eigen thuisteams vallen weg. Bron-ID’s en de tenantgebonden selectie zijn leidend.

Per kaart: alleen de bezoekerscrest is het grote hoofdbeeld; de wedstrijd met beide teamnamen staat apart; datum, aftrap, veld en twee kleedkamers hebben eigen posities. Het clublogo van Duindorp staat klein uiterst rechts in de containerheader. Een ontbrekend bezoekerslogo krijgt initialen of geen watermark; nooit een eigen-clublogo als tegenstander.

Let op: de bestaande syncDynamicFamilies koppelt sport_visitor_arrivals aan visitors en team-arrivals, niet aan welcome. Als de nieuwe OnzeTrots-welcome gekoppeld moet werken, voeg dit expliciet en versiegebonden toe aan model, binding, selectiepolicy en databasevalidatie. Behoud het bestaande algemene welkomstscherm voor oudere documenten/andere thema’s.

De 1/2/3/4-keuzeknoppen in de referentiestudio zijn uitsluitend visuele voorbeeldbediening. Productie toont het werkelijke aantal beschikbare fixtures; voeg geen gebruikerinstelling toe waarmee echte wedstrijden willekeurig verdwijnen. Landscape: 1 groot, 2 naast elkaar, 3 één grote plus twee compacte, 4 raster. Portrait: dezelfde aantallen verdeeld over beschikbare hoogte, zonder landscape row-span over te nemen.

### Verjaardagen, activiteiten en agenda

Alleen deze drie families krijgen de vaste **drie kolommen × twee rijen**, ook in de goedgekeurde portraitreferentie. Een pagina heeft altijd zes slots; ontbrekende items blijven lege, onzichtbare, aria-hidden vakken met dezelfde afmetingen. Geen auto-fit, masonry, enlargement of verplaatsing bij minder inhoud. Bij meer dan zes echte items: vervolgpaginering met opnieuw zes vaste slots, geen stil verlies van records. Neem dit expliciet mee in duur- en paginatests.

Zes voorbeelden horen uitsluitend in de picker, testfixtures en handoffdemo. De 0–6-keuze uit het prototype is een demonstratie van lege posities, geen productionele harde truncatie van brondata. Jarige kaarten hebben één header met datum en eigen clubcrest, grote leeftijd/JAAR, afzonderlijke naam en team. Het existing brandingpass-idee mag geen tweede logo boven een al complete verjaardagheader toevoegen.

### Live scorebord

De blauwe LIVE/tijdchip staat boven de grote score. Gebruik de bestaande geautoriseerde matchState en klokprojectie, inclusief pauze, staleAfter, showClock en momentstatus. De referentietekst LIVE · 63:24 is voorbeelddata. Zet bij rust/eindstand de echte fase in de chip; toon niet ten onrechte LIVE tijdens een beëindigde wedstrijd. Behoud de geverifieerde home/away-logo’s en bestaande event-/scorebindings.

## 5. Visueel model en rendererarchitectuur

Port de goedgekeurde geometrie en assets; kopieer de voorbeeldapp niet als productiepagina. De referentiestudio bevat eigen sidebar, localStorage, zoekfunctie, voorbeeldpoll en demoscores. Die blijven referentiebediening.

Implementeer gedeelde pure React-componenten voor containerheader, verified crest, footer, ranglijst, fixturekaart, visitor card en fixed six slots. De browser-DOM-postprocessing uit brandContainerHeaders is in de referentie een bouwmiddel; gebruik in de repo expliciete React-markup. Zo krijgen SSR-capture, thumbnail, editor en Player dezelfde structuur zonder een tweede client-only decoratiestap.

Er komt geen buitenheader boven de containers. Iedere inhoudscontainer heeft precies één relevante header; eigen clublogo staat rechts in die header. Bij fotografie/goal/video/vrij ontwerp kan het bestaande custom cardheader-element worden gebruikt. Verplaats logo’s niet via losse bestandsnaamheuristieken: bind de tenantlogo-ref semantisch.

OnzeTrots-footer rechtsonder: klein wit artwork, circa 126×42 referentiecanvas-eenheden, transparante achtergrond, geen backing/border/boxshadow, wel donkere drop-shadow en behouden witte ondertitel. Schaal vanuit het bestaande logische canvas; de demo rendert op 1600×900/900×1600 terwijl export 1920×1080/1080×1920 is. Deze maten mogen niet als fysieke schermpixels worden geïnterpreteerd.

De bestaande backgrounds zijn al gecontroleerd aanwezig als houtrust, de-wijk en aan-zee voor beide oriëntaties in sync-background-catalog.ts. Gebruik die manifestrefs en bestaande cropkeuzes; geen remote image-call in de Player. Nieuwe aanvullende artwork/fontrefs moeten in een versiegebonden manifest, voorzien van checksums, kopieën in Control/Player-publicassets waar nodig, captureroute en prepared CSS-dekking.

## 6. Motion- en fallbackpariteit: concrete blocker

sync-dom-capture.tsx heeft script-src none in capture-CSP. Bij documentload worden alle animations gepauzeerd met currentTime=0. De framefunctie berekent alleen een outer transitionTime; na afloop wordt settledPng hergebruikt. Dit is geschikt voor stilstaande pagina’s met binnenkomsttransitie, niet voor scrollende standen of doorlopende confetti.

Vereiste aanpassing:
1. Maak een zuivere getypte scene-/motionprojectie die elke framepositie op elapsedMs kan bepalen.
2. Laat browserpreview en moderne Player diezelfde tijd en parameters gebruiken, met cleanup, pause, reduced motion en natuurlijke itemgrenzen.
3. Laat de Worker voor elk gevraagd exportframe dezelfde scene/motionpositie instellen via gecontroleerde eigen code. Geen opgeslagen broncode uitvoeren, geen eval, geen prototype-HTML/JS injecteren en CSP niet versoepelen.
4. Neem interne tijd/layouttoestand op in de capturecache-identiteit. Hergebruik settledPng alleen wanneer de scène werkelijk stil is.
5. Test sticky/eigenrij-gedrag op begin, midden en eind, alle eigenposities, en vergelijk DOM met geëxporteerde frames.
6. Laat oudere LG/WebViews de volledige correcte MP4/PNG gebruiken. Controleer werkelijk afgespeelde nieuwe frames; download/active alleen is geen visueel bewijs.

## 7. Versies en generators

De huidige rendererVersion is sync-v1, sourceRevision is 8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a. De oude Sites-identiteiten staan los daarvan. Maak een expliciete nieuwe visuele/rendereridentiteit voor de goedgekeurde overdracht of een streng versiegebonden visual contract. Historische documenten moeten via hun oorspronkelijke decoder en renderer correct blijven; maak de oude literal niet stilzwijgend tot een andere layout.

Generatorgevaren:
- scripts/build-sync-slide-css.mjs leest docs/sync-v1-rebuild/handoff/reference/sites-sync/src/styles.css en modules/content.css; een losse handpatch in sync-slide-styles.ts verdwijnt bij een volgende run.
- scripts/build-sync-renderer-assets.mjs verwacht exact elf oude Source-assets en vergelijkt de bytes met Control-publicassets. Stop nieuwe assets niet ongemerkt in die oude manifestidentiteit.
- scripts/build-sync-slide-schema.mts schrijft behalve het huidige JSON-schema ook de historische migratie 20261018002000_sync_studio_authoring.sql.
- scripts/build-sync-dynamic-schema.mts schrijft de historische migratie 20261018007000_sync_dynamic_configuration.sql.

Pas de nieuwe generatieflow doelgericht aan: huidige JSON-schema’s en een **nieuwe forwardmigratie** voor nieuwe validatie, geen herschreven historische SQL. De bestaande contracttest vergelijkt het actuele schema ook met 20261019135521_sync_engage_full_options.sql; die versieassertie moet bewust uitgebreid worden. Behoud legacytestfixtures en oude migratiebytes.

## 8. Praktische uitvoeringsvolgorde

1. Fetch main, lees lokale AGENTS/canons en leg actuele baseline vast; vergelijk met de bovenstaande onderzochte commit. Werk in één geïsoleerde taakbranch/worktree.
2. Leg in het repo-taskplan bestandsownership vast voor contracts/projector/renderer/CSS/assets/editor/Worker/Player/tests. Bepaal versiecompatibiliteit voordat er schemawijzigingen zijn.
3. Implementeer nieuwe typed presentationvelden en formele config/mode, assetcollector en familiepaginering. Voeg forwardvalidatie toe als opgeslagen contracten wijzigen.
4. Verrijk de bestaande canonical projector en eigen-teamselectie; behoud alle privacy-/scopegrenzen. Test met twee tenants en ontbrekende/tegenstrijdige bronvelden.
5. Port pure OnzeTrots-containercomposities en gedeelde stijlen. Houd FieldFlow en oude v11/v17/Sync-v1-presentaties intact.
6. Koppel wizard, handmatige editor, gekoppelde editor, librarypreview, templatekiezer en native/mobiele consumers voor zover die dezelfde contracten opslaan. Alleen voorbeelden in displayfixtures.
7. Werk deterministische motion, Workerexports en Player-preparatie bij. Voeg alle nieuwe beeld/fontrefs aan verified capture/cache toe.
8. Vergelijk de volledige 36×2×2 visuele matrix en de speciale gedragscases met het goedgekeurde pakket.
9. Voer repo-gates uit en werk ledger/documentatie bij. Lever PR met concrete screenshots/filmframes en bron-SHA; productiestaging/deploy volgens de afgesproken bestaande pipeline, niet vanuit het losse Siteprototype.

## 9. Testgates en relevante bestaande tests

Actuele rootcommando’s: pnpm lint; pnpm typecheck; pnpm test. Voor UI: pnpm test:a11y en de Chromium E2E-suite via de bestaande projects/config. Voor Player: pnpm test:player en pnpm test:player:offline. Bij echte databasewijzigingen: geïsoleerde testdatabase reset plus pnpm test:rls; nooit een bestaande staging-/productiedatabase legen voor ontwerpwerk.

Gerichte bestaande startpunten:
- packages/contracts/test/sync-slide-presentation.test.ts: strikte schema’s, 36 families, assetchecksums, legacyseparatie, JSON-schema/databasegelijkheid.
- packages/contracts/test/sync-dynamic-configuration.test.ts en sync-dynamic-playback.test.ts: seed- en assetgrenzen.
- packages/content-templates/test/sync-slide-presentation.test.tsx: alle families, lege selectie zonder verzonnen feiten, tenantinhoud en veilige markup.
- packages/content-templates/test/sync-dynamic-projector.test.ts: volledige canonical selectie, conflicterende ID’s, echte bron- en assetprojectie.
- apps/media-worker/test/sync-dom-capture.test.tsx en sync-dynamic-render.test.ts: frame-/asset-/exportpariteit.
- apps/player/app/_lib/sync-live-match.test.ts en sync-player-assets.test.ts: veilige livebinding, stale data en cache.
- apps/control/app/(shell)/dashboard/studio/sync-template-preview.test.ts: de displayfixtures.
- tests/control/sync-create-wizard.spec.ts, sync-dynamic-workflows.spec.ts, sync-studio-workflows.spec.ts, sync-background-picker.spec.ts en sync-template-picker-layout.spec.ts.
- tests/player/sync-studio-playback.spec.ts en sync-background-gallery.spec.ts.

Nieuwe betekenisvolle acceptatiecases:
- Alle 36 families × light/dark × landscape/portrait, daadwerkelijke fonts geladen, geen buitenheader, geen tekstclipping of ongewenste dubbele logo’s.
- Standen met eigen team boven/midden/onder, niet-eigen naam die “Duindorp” bevat, lange teamnamen, 0/1/14/>14 rijen, echte rijlogo’s en ontbrekende statistieken.
- Welkomstfilter met >4 geldige fixtures plus verleden, uit, onbekende home-ID, andere club, afgelast, uitgesteld, gelijke kickoff en ongeldige tijd; maximaal vier juiste records, beide teamnamen en alleen grote visitorcrest.
- Six-slotgrids bij 0..6 en >6 records: exact zes slots per pagina, vaste geometrie, geen springende kaarten, privacytoegestane echte verjaardagen, zes voorbeelden alleen in demo.
- Livechip boven score tijdens aftrap/live/rust/eindstand; stale-clocklimiet; geen onbevestigde logo-URL uit de stream.
- Zelfde motionframe op dezelfde elapsedMs in preview en export; pauze/resume en reduced motion; offline font/assetcache; verkeerde checksum houdt LKG zichtbaar.
- Geen authoringversie of nieuwe playlistrelease enkel door onveranderde broninhoud; bestaande configuratie/content-identiteiten behouden hun rol.

## 10. Aanvullende compositie: Onze wedstrijddag

Het goedgekeurde matchday-ontwerp combineert drie gelijktijdige containers: vorige pouleuitslagen links, volledige bewegende stand centraal en volgende pouleprogramma rechts. In portrait krijgen de containers de volgorde en proporties uit broncode/. De huidige syncDynamicFamilies koppelt matchday uitsluitend aan sport_match_of_the_day; de gelezen projector bouwt daarvoor alleen home/away/match van één wedstrijd. Die bestaande payload is dus onvoldoende voor de goedgekeurde compositie.

Bouw voor de nieuwe OnzeTrots-versie een gecontroleerde samengestelde readmodel-/snapshotprojectie waarin uitslagen, ranglijst en programma dezelfde tenant, eigen team-ID, competitie/poule en seizoen volgen. Leg de bronrevisies en assetrefs expliciet vast. Haal geen providers op vanuit React-renderers of Player. Bewaar de bestaande één-wedstrijdpresentatie voor historische documenten. Voeg tests toe voor ontbrekende deelsets, verschillende poules/seizoenen en verouderde of conflicterende deelrevisies; een ontbrekend onderdeel toont zijn eerlijke lege toestand en wordt niet met demo-inhoud gevuld.

## Bronverantwoording

inventaris/repo-integration-inventory.json bevat de exacte gelezen paden, Git blob-SHA’s, ref en primaire GitHub-URLs. Niet ieder ontdekt testbestand is inhoudelijk gelezen; dat onderscheid is in de inventaris expliciet gemaakt. Deze notities stellen geen productie-uitrol of geslaagde VeyoCast-repotests voor: alleen de repository is gelezen. De lokale prototypechecks en expliciet als referentie geleverde afbeeldingen horen afzonderlijk bij de overdracht. De complete 36-familiecatalogus staat in 06-SLIDE-CATALOGUS.md; dezelfde mapping is machineleesbaar als inventaris/slide-catalogus.json en inventaris/slide-catalogus.csv.

