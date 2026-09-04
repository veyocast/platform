# FieldFlow Acceptance Checklist

## S145 v1.6 release-override

De gedetailleerde S144-vinkjes hieronder zijn historisch technisch
implementatiebewijs en vormen geen automatische releasegoedkeuring voor S145.
De gebruiker heeft de zichtbare S144-uitvoering afgekeurd; de vijf laatst
aangeleverde referenties zijn leidend voor Overzicht, Planning, Schermen,
Studio en Marketing. Security/RLS, locked assets, toegankelijkheid, immutable
releases en Player/offlinegedrag blijven de hogere technische grenzen.

- [x] Handoffs, losse prompts, checksum-gevalideerde pakketten en de vijf later aangeleverde exacte PNG-referenties zijn geconsolideerd in `REFERENCE_SOURCE_MATRIX.md`.
- [x] De drie meegeleverde mislukte screenshots staan bytegelijk als negatieve baseline in `docs/screenshots/fieldflow/negative-baseline/`.
- [x] De vijf exacte targets staan bytegelijk onder `docs/screenshots/fieldflow/reference-targets/`.
- [x] De dubbele rail, dubbele hoofdbestemming en oude zichtbare System Pulse-copy zijn uit de tenant-shell verwijderd.
- [x] Dashboardstatus wordt centraal afgeleid en unitgetest; `0/0` en onbekende waarden claimen geen gezondheid.
- [x] Studio Nieuw gebruikt één vierstapswizard; required state, samenvatting en CTA delen dezelfde validatie.
- [x] Marketinghome gebruikt één 12-kolomsgrid, vier tonale hoofdstukken en goedgekeurde generieke fotografie zonder klantclaim.
- [x] De exact vereiste ledgerbestanden bestaan, inclusief `VISUAL_QA.csv`, `SLIDE_COMPONENT_PATH_MAP.csv`, `OUTPUT_ASSET_MANIFEST.csv` en `ASSET_GAPS.csv`.
- [x] Alle lokaal uitvoerbare S145-testgates zijn groen en met actuele output vastgelegd; fysieke en hosted gates staan afzonderlijk hieronder.
- [x] Alle 73 current-state captures uit `VISUAL_QA.csv` bestaan: 71 primaire state-/routecaptures plus twee opstellingsdetailcaptures. De evidence-test controleert contracten, runtimefouten, DOM/overflow/shell, controlhoogtes en de expliciet gemelde geometrie.
- [x] De generator heeft vier matrixbladen en vijf exacte side-by-sidebladen gemaakt; de negen SHA-256-hashes staan in `GOLDEN_INDEX.md`.
- [x] De gebruiker heeft de negen actuele FieldFlow-reviewbladen op 4 september 2026 expliciet als “Perfect” geaccepteerd; zie `GOLDEN_INDEX.md` en D018.
- [x] De vijf gewijzigde historische PNG's zijn door de gebruiker expliciet
  geaccepteerd voor opname als `ACCEPTED_FOR_INCLUSION_BY_USER_2026-09-04`;
  zij blijven buiten de 90 S145-evidencebeelden en krijgen geen nieuwe
  provenanceclaim. [D020]
- [x] De fysieke LG blijft eerlijk `EXTERNAL_UNTESTED`; uitsluitend de
  S145-releasegate is door de gebruiker geaccepteerd als
  `WAIVED_BY_USER_2026-09-04`. Dit vinkje is geen toestelbewijs. [D020]
- [ ] Branch, PR, merge-SHA, staging en production zijn zonder feature- of productiedatamutatie teruggelezen.

Actuele gate-uitkomst op 4 september 2026: lint/typecheck/unit/build, verse
database-reset met 108 migraties, gerichte S145-pgTAP 38/38, volledige RLS
70/1.624 en error-level Supabase db-lint met nul resultaten zijn groen. Ook
a11y 36+1 skip, brede Chromium 192+22 skips in 21,3 minuten, Player 117,
offline 7, finale evidence 1/1 in 4,2 minuten en LG-bron/tests/IPK-inspectie
zijn groen. De evidence-run maakte 73 current captures; met vijf targets, drie
negatieve baselines en negen sheets zijn er 90 evidence-PNG's. Deze technische
run voert geen automatische pixelvergelijking uit. De vijf aanvullende
historische PNG-diffs zijn door de gebruiker geaccepteerd voor opname en de
fysieke LG-releasegate is expliciet waived, zonder beide als nieuw bewijs te
presenteren. Alleen de beschermde PR/CI/merge- en exact-SHA
staging-/productionreadbacks staan nog open. De menselijke visual review en
assetkeuze zijn op 4 september 2026 expliciet afgerond: huidig officieel
VeyoCast-icon plus FF-PHOTO-01/06/05/04.


Geen sectie mag impliciet worden goedgekeurd. Voeg bij elk afgevinkt item een testnaam, screenshot/golden, commit of reviewbewijs toe. `N/A` vereist een geschreven reden. Fysieke LG-controle blijft `UNTESTED` tot een echt toestel is gebruikt.

## Bewijsregister

- **E1 governance:** S145-branch
  `veyocast/s145-fieldflow-release-completion`, correctiebaseline
  `19e665cdcf6a2613f70332cb616e87514938d655`, sprintprompt en alle ledgers in
  `docs/redesign/`. De S144-branch en nulmeting blijven uitsluitend historisch
  spoor.
- **E2 inventory:** `SLIDE_COVERAGE.csv` (64 rijen), `ROUTE_LEDGER.csv` (173),
  `fieldflow-coverage.test.ts` en de contracttests.
- **E3 theme compatibility:** `theme-catalog.test.ts`, Control authoringtests,
  de drie S144-migraties en volledige pgTAP-suite.
- **E4 trace:** `CONFIG_TO_RENDER_TRACE.csv` plus de geautomatiseerde
  no-orphan-/exact-contracttest in `fieldflow-coverage.test.ts`.
- **E5 tokens/fonts:** FieldFlow v3 JSON/CSS/TypeScript-build, token- en
  typografietests, lokale Manrope/Inter en de designcanon-delta.
- **E6 visual:** `GOLDEN_INDEX.md`, 73 S145-currentcaptures en negen door de
  gebruiker op 4 september 2026 geaccepteerde reviewbladen, plus 64 moderne,
  44 Menu Studio- en 16 nieuwe Static-LG-goldens met overflow- en
  image-readinessasserties. De S145-side-by-sidebladen zijn technisch bewijs;
  de acceptatiestatus komt uit de expliciete menselijke beslissing en niet uit
  een automatische pixeldiff.
- **E7 output:** content-template-, Player-, release-envelope- en Static-LG-
  tests voor alle actieve/dormante contracttypen en expliciete renderfamilies.
- **E8 menu/studio:** Menu Document v2-, Studio-schema/render- en
  media-worker-tests; exact 22 systeemtemplates.
- **E9 offline:** Player- en offline-suites voor LKG, atomaire activatie,
  fallback, reconnect en no-black-screen.
- **E10 database/security:** de expliciet toegewezen forward-only
  `20260904190700_s145_supabase_lint_recovery.sql` behoudt signatures,
  `SECURITY DEFINER`, lege `search_path` en nauw begrensde ACL's. De gerichte
  S145-pgTAP levert 38/38; verse reset, volledige RLS 70/1.624 en error-level
  db-lint met `results: []` zijn groen.
- **E11 eindgates:** lint 30/30, typecheck 30/30, unit/integratie 30/30,
  build 18/18, database-reset 108 migraties, RLS 70 bestanden/1.624 checks,
  a11y 36 groen + 1 live skip, brede Chromium 192 groen + 22 conditionele
  live/evidence-skips in 21,3 minuten, Player 117/117, offline 7/7,
  S145-evidence 1/1 in 4,2 minuten met 73 current captures, LG 14/14 plus IPK.
  De exacte opdrachten, branch en baseline staan in `FINAL_REPORT.md`;
  commit/PR/merge en externe deployreadback worden pas na feitelijke observatie
  ingevuld. Externe CI/deploy is geen lokaal groen vinkje.
- **E12 assets:** `ASSET_REGISTER.csv`, `ASSET_PROVENANCE.md`, bytevergelijking
  van 23 aangeleverde derivatives en assetcollector-regressies.

Sectiebewijs voor ieder hieronder afgevinkt item: D → E5/E10; E–H → E5–E7;
I–J → E2/E4/E6/E7; K → E6–E9; L–M → E2/E4/E6–E9; N → E2/E6–E10;
O → E7/E9/E11; P → E3/E4/E6/E11; Q → E10/E12; R → E6/E10/E11/E12.

## A. Nulmeting en scope

- [x] De geïmplementeerde HEAD en branch zijn vastgelegd. [E1]
- [x] `AGENTS.md`, `README.md`, `PLANS.md`, `TASK_LEDGER.md` en toepasselijke canons/sprintdocs zijn volledig gelezen. [E1]
- [x] Er is een toegewezen ledgeritem en task branch volgens de repositoryworkflow. [E1]
- [x] De contractinventory is opnieuw uit code gegenereerd. [E2]
- [x] Elk nieuw of gewijzigd contenttype heeft vóór implementatie een rij in de coverage matrix. [E2]
- [x] Alle twintig dynamische contenttypes en `ledscores_live_match` zijn gemapt. [E2]
- [x] Alle vier nieuwscomposities zijn gemapt. [E2]
- [x] Beide menupaden en alle zeven Menu Document v2-blocktypes zijn gemapt. [E2]
- [x] Alle acht LED momentkeys zijn gemapt. [E2]
- [x] Alle zes sponsorposities zijn gemapt. [E2]
- [x] Alle elf Studio-categorieën in beide formaten zijn gemapt. [E2]
- [x] Engage, YouTube, ruwe media en Player-systeemstaten zijn gemapt. [E2]
- [x] N/A — de vóór-situatie is als codebaseline, bestaande legacy-goldens en
  nulmetingssuite bevroren; nieuwe targetgoldens en routebewijs staan in E1/E6.

## B. Eén thema en backwards compatibility

- [x] `fieldflow` is de enige zichtbare/selecteerbare theme-ID voor nieuwe content. [E3]
- [x] Er is geen oude themepicker meer in Slides, Menu Studio, Sportlink, verjaardagen of andere publieke editors. [E3]
- [x] Light, dark, auto en schedule blijven als modebeleid beschikbaar waar bestaand contract dit ondersteunt. [E3]
- [x] De tien legacy IDs blijven intern valide voor bestaande immutable snapshots/releases. [E3]
- [x] De DB-migratie is additief; zij maakt `fieldflow` default zonder historische IDs voortijdig te verbieden. [E3]
- [x] Geen bestaande gepubliceerde release of snapshot is in place herschreven. [E3]
- [x] Een oude release rendert identiek vóór en na de migratie, behoudens expliciet goedgekeurde compatibilityfix. [E3, E6]
- [x] Een nieuwe release bevriest alle resolved FieldFlow tokens/overrides in de snapshot. [E3, E7]
- [x] Rollback kan de vorige catalog/resolver herstellen zonder datanulverlies. [E3]

## C. Config-to-render trace

- [x] Er bestaat een machine- of tabelgebaseerde trace voor ieder editorcontrol. [E4]
- [x] Elke trace bevat editor → schema → database/RPC → immutable config/snapshot → assetmanifest → viewmodel → modern DOM/CSS → LG DOM/CSS/JS → preview/poster/PNG → tests. [E4]
- [x] `draft.display`-velden worden daadwerkelijk door snapshot en renderer gebruikt, of bewust verwijderd met migratie en copy-update. [E4]
- [x] `columns` is getraceerd. [E4]
- [x] `showDressingRoom` is getraceerd. [E4]
- [x] `showField` is getraceerd. [E4]
- [x] `showHomeAway` is getraceerd. [E4]
- [x] `showReferee` is getraceerd. [E4]
- [x] `showClubLogo` is getraceerd. [E4]
- [x] `showSponsor` is getraceerd. [E4]
- [x] `sponsorMediaAssetId` is getraceerd en verzameld. [E4]
- [x] News variant, QR/link, page timing en media focal point zijn getraceerd. [E4]
- [x] Birthday presentation- en visibilitycontrols zijn getraceerd. [E4]
- [x] Menu v2 appearance, locked/hidden, focal en source policies zijn getraceerd. [E4]
- [x] LED live en canvasbindings zijn getraceerd. [E4]
- [x] Er zijn geen “orphan controls” volgens de geautomatiseerde tracecheck. [E4]

## D. Tokens, kleur en fonts

- [x] Foundations, semantic, component, familie en snapshot-resolved tokenlagen zijn geïmplementeerd.
- [x] Component-CSS bevat geen verspreide hardcoded merk-/themecolors.
- [x] Het defaultpalet gebruikt petrol, clubgroen, cloud, wit en oranje volgens het contract.
- [x] Decoratief standaardblauw is verwijderd.
- [x] Info/focusblauw is uitsluitend semantisch en harmonisch/contrastveilig.
- [x] Supportkleur `auto` wordt perceptueel afgeleid of neutraal opgelost.
- [x] Handmatige kleuren worden op contrast en toegestane range gevalideerd.
- [x] Statusinformatie gebruikt naast kleur een label, vorm of icon.
- [x] Light en dark hebben expliciet opgeloste tokens; geen blind CSS-invert.
- [x] Display-, body- en datafont zijn selecteerbaar uit de lokale, gelicentieerde catalogus.
- [x] Remote fonts en runtime fontdownloads ontbreken.
- [x] Font fallback is deterministic in modern, LG, preview en capture.
- [x] Poster/screenshot capture wacht op font readiness.
- [x] De FieldFlow canon delta voor surfaces/radii/background is gedocumenteerd en gereviewd.

## E. Schaling, raster en ruimtegebruik

- [x] Landscape gebruikt één gedeeld 12-koloms raster.
- [x] Portrait gebruikt één gedeeld 6-koloms raster.
- [x] Logical canvas 1920×1080 en 1080×1920 werkt onafhankelijk van de beheerbrowserviewport.
- [x] 1080p en 4K behouden dezelfde optische hiërarchie.
- [x] Titel-, QR- en overscan-safe areas zijn componenttests.
- [x] Alle containers delen aantoonbare gridlijnen.
- [x] Top/middle/bottom en left/center/right alignment zijn expliciete props/varianten.
- [x] Nieuws, menu’s, lijsten en tabellen beginnen linksboven in hun contentzone.
- [x] Sparse content gebruikt een ontworpen featured/summaryvariant en geen klein gecentreerd eiland.
- [x] Dense content verkleint geen letters onder de minimumramp.
- [x] Portrait is per familie opnieuw gecomponeerd en geen geschaalde desktoplayout.
- [x] Geen clip, horizontale overflow, onverwachte scrollbar of essentiële ellipsis in tests.

## F. Typografie en data density

- [x] Hero, title, subtitle, body, label en metadata volgen de afgesproken 1080p-ramp.
- [x] Type scale override blijft binnen de veilige grenzen.
- [x] Team-, product- en persoonsnamen gebruiken een gedocumenteerde wrap/max-line/paginationstrategie.
- [x] Getallen en scores gebruiken tabular numerals waar nodig.
- [x] Fixture/result rows tonen grotere tekst met compacte, inhoudsgestuurde hoogte.
- [x] Landscape programma/uitslag gebruikt doorgaans 5–8 leesbare rijen per kolom en pagineert daarna.
- [x] Portrait gebruikt doorgaans 4–7 leesbare rijen en pagineert daarna.
- [x] Standings portrait toont een geprioriteerde kolommenset of tweeregelige row.
- [x] Geen renderer toont twintig sportitems door tekst microscopisch te maken.
- [x] Density `auto`, `compact` en `comfortable` hebben voorspelbare, begrensde uitkomsten.
- [x] Lange Nederlandse club-, competitie-, locatie- en productnamen zijn in goldens opgenomen.

## G. Achtergrond, panelen en motion

- [x] Default background is lokale CSS/SVG `abstract-flow`.
- [x] Contourcontrast blijft subtiel en schaadt leesbaarheid niet.
- [x] Er is geen letterlijke volledige pitch, dicht dot grid, neonmesh of remote texture.
- [x] Solid, controlled gradient en optionele fotoachtergrond hebben expliciete fallbacks.
- [x] Gebroken foto valt terug op abstract-flow, nooit zwart/leeg.
- [x] Fotofocal points zijn orientation-specific.
- [x] Beeldoverlay wordt per beeld/contrast bepaald en ligt niet als universele zware zwarte laag over nieuws.
- [x] Motion gebruikt op het kritieke pad uitsluitend transform/opacity.
- [x] Basisduur en maximumduur voldoen aan het contract.
- [x] Row stagger heeft een cap en vertraagt essentiële informatie niet.
- [x] Geen nieuwe flip, bounce, strobe of layoutshift bestaat.
- [x] Reduced motion maakt alle inhoud direct zichtbaar.
- [x] Paginamotion restart deterministic.
- [x] Initiële poster/fallback voldoet aan de bestaande 900 ms-eis.

## H. Shared primitives

- [x] SlideRoot/shell bestaat met modern en legacy implementatie/uitkomst.
- [x] Background bestaat.
- [x] SafeGrid bestaat.
- [x] Masthead bestaat.
- [x] TitleBlock bestaat.
- [x] Panel bestaat.
- [x] DataTable en DataRow bestaan.
- [x] TeamLockup ondersteunt logo én initials-fallback zonder layoutshift.
- [x] ScoreLockup bestaat.
- [x] StatusPill bestaat en is niet kleur-only.
- [x] MediaStage ondersteunt ratio, focal en missing state.
- [x] QrBlock ondersteunt quiet zone, label en URL-fallback.
- [x] SponsorSlot ondersteunt contain, quiet plate en optical sizing.
- [x] FooterMeta/page indicator bestaat.
- [x] Empty, error, stale en offline states zijn semantisch verschillend.
- [x] LiveMomentOverlay bestaat.
- [x] Iedere primitive heeft mode-, orientation-, long-content- en reduced-motiontests.

## I. Sportfamilies

- [x] `sport_program` volledig.
- [x] `sport_results` volledig.
- [x] `sport_standing` volledig.
- [x] `sport_period_standing` expliciet gemapt en getest, ook indien dormant.
- [x] `sport_match_of_the_day` volledig.
- [x] `sport_next_match` volledig.
- [x] `sport_cancellations` volledig.
- [x] `sport_dressing_rooms` volledig.
- [x] `sport_officials` volledig.
- [x] `sport_team` expliciet gemapt en getest, ook indien dormant.
- [x] `sport_sponsor` expliciet gemapt en getest, ook indien dormant.
- [x] `sport_activities` volledig.
- [x] `sport_trainings` expliciet gemapt en getest, ook indien dormant.
- [x] `sport_volunteers` expliciet gemapt en getest, ook indien dormant.
- [x] `sport_birthdays` volledig.
- [x] `sport_visitor_arrivals` volledig.
- [x] `sport_referee_arrivals` volledig.
- [x] Home- en away-logo-ID/URL zijn compatibel aan contract, snapshot, assets en viewmodel toegevoegd.
- [x] Initialsfallback werkt in modern en LG.
- [x] Empty, stale, provider error en laatst bekende geldige data volgen bestaand gedrag.

## J. Nieuws

- [x] `hero_split` volledig.
- [x] `fullscreen_gradient` volledig.
- [x] `news_grid` volledig.
- [x] `text_only` volledig.
- [x] Alle composities starten de copy linksboven.
- [x] QR is bij een link prominent, vier modules quiet en op geschaalde output decodeerbaar.
- [x] QR heeft actiecopy en leesbare korte URL/fallback.
- [x] Providerlogo, bron, datum, auteur en page/progress zijn consistent.
- [x] Titel/bron worden niet dubbel getoond.
- [x] Hero image houdt intrinsic ratio/contain tenzij fullscreen crop expliciet is.
- [x] Focal point voorkomt dubbel cropgedrag.
- [x] 1 en 12 artikelen zijn getest in beide oriëntaties.
- [x] Ontbrekend beeld, link en QR zijn getest.

## K. Menu en prijs

- [x] Legacy menu volledig.
- [x] Legacy price list volledig.
- [x] Menu Document v2 `category` volledig.
- [x] `product-group` volledig.
- [x] `image` volledig.
- [x] `video` inclusief poster volledig.
- [x] `logo` volledig.
- [x] `text` volledig.
- [x] `promo` volledig.
- [x] Category flow en portraitColumns 1/2 werken.
- [x] Heading visibility, linked/manual/Twelve, availability en pricing policies blijven intact.
- [x] Locked/hidden en orientation appearance blijven intact.
- [x] Photo `show` en `reserve-empty` behouden stabiele geometrie.
- [x] Maximum 200 producten en lange prijsstrings pagineren leesbaar.
- [x] Static LG parity is per blocktype bewezen.

## L. Verjaardagen en arrivals

- [x] Birthday periode en custom window werken.
- [x] Alle birthday empty policies werken.
- [x] Alle show age/date/day/photo/role/team instellingen werken.
- [x] Background, card style, logo position, max-per-page, alignment, mode en timing zijn getraceerd.
- [x] Privacy/consent en ontbrekende foto hebben een fallback.
- [x] Reduced motion birthdayvariant is rustig en volledig leesbaar.
- [x] Visitor arrival 1–4 cards in landscape getest.
- [x] Visitor arrival 1–4 cards in portrait getest.
- [x] Referee arrival 1–4 cards in landscape getest.
- [x] Referee arrival 1–4 cards in portrait getest.
- [x] Arrival/kickoff, room, field, homeAway, referee/duty, clublogo en sponsor toggles werken.
- [x] Empty skip/placeholder en recent-highlight werken.
- [x] Oude motionpreset snapshots blijven compatibel; nieuwe UI toont alleen veilige niveaus.

## M. LED Scores en momenten

- [x] `match_center` volledig.
- [x] `scoreboard` volledig.
- [x] Clock, status, timeline, title en accentMode toggles werken.
- [x] `last_known` en `skip` buiten wedstrijd werken.
- [x] Pre-match, live, paused, half-time, finished en unknown zijn getest.
- [x] Stale freeze is getest.
- [x] Timeline 0 en 10 zijn getest.
- [x] Default scene pair bestaat voor `goalOwn`.
- [x] Default scene pair bestaat voor `goalOpponent`.
- [x] Default scene pair bestaat voor `goalUnknown`.
- [x] Default scene pair bestaat voor `lineupHome`.
- [x] Default scene pair bestaat voor `lineupAway`.
- [x] Default scene pair bestaat voor `matchStart`.
- [x] Default scene pair bestaat voor `halfTime`.
- [x] Default scene pair bestaat voor `matchEnd`.
- [x] Alle text- en imagebindings hebben fixturetests.
- [x] Missing scorer photo/logo en late enrichment hebben stabiele fallbacks.
- [x] Lineup pagineert in beide oriëntaties.
- [x] Underlay continue/pause werkt.
- [x] Durable ack en replay/correctiegedrag regressietests slagen.
- [x] User-created canvases zijn niet gemuteerd.
- [x] “FieldFlow-basis kopiëren” maakt een nieuwe revisie.

## N. Engage, sponsors, YouTube en Studio

- [x] Engage poll, results en MOTM volledig.
- [x] Engage online binding en immutable lokale fallback zijn visueel gelijkwaardig.
- [x] Poll 2 en 24 opties zijn getest.
- [x] Live/after-vote/after-close visibility werkt.
- [x] Engage QR decodeert en heeft veilige plaatsing.
- [x] Sponsor fullscreen volledig.
- [x] Presented-by volledig.
- [x] Footer volledig en binnen de striprichtlijn.
- [x] Corner volledig.
- [x] Match sponsor volledig.
- [x] Match ball sponsor volledig.
- [x] Sponsorcollisionmatrix met QR, watermark, live, offline en system overlay slaagt.
- [x] Sponsorcreative wordt nooit automatisch gerecolord, vervormd of gecropt.
- [x] Cap, cooldown, weight, priority, orientation, house fallback en Proof of Play blijven intact.
- [x] YouTube video krijgt geen gedwongen visuele overlay.
- [x] YouTube loading/error/offline gebruikt FieldFlow en de immutable fallback.
- [x] Alle 22 nieuwe Studio-systeemtemplates bestaan.
- [x] De elf categorieën hebben inhoudelijk verschillende composities.
- [x] PNG, MP4 en poster renderen deterministic.
- [x] User-created Studio-designs zijn niet gemuteerd.
- [x] Opt-in conversie maakt een kopie en rapporteert niet-mapbare elementen.

## O. Player-systeem, logo en offline

- [x] Pairing volledig.
- [x] Setup/syncing volledig.
- [x] Waiting/empty volledig.
- [x] Offline chip/LKG volledig.
- [x] Recovery/problem volledig.
- [x] Billing/verification/suspended volledig.
- [x] PWA-install state waar ondersteund volledig.
- [x] Geldige clubcontent wordt niet onnodig bedekt door system UI.
- [x] Oorzaak, gevolg en herstelactie zijn bij fouten zichtbaar.
- [x] No-black-screen tests slagen.
- [x] Officiële VeyoCast-logoassets zijn byte-identiek gebleven.
- [x] Normale playback toont uitsluitend het locked bottom-left watermerk op 40% opacity volgens canon.
- [x] Online boot, offline boot, LKG, reconnect, asset expiry en recovery slagen.
- [x] Moderne Player en Static LG gebruiken dezelfde resolved snapshotwaarden.
- [x] Geen unsupported moderne CSS-feature bereikt Chromium 79; waarden zijn waar nodig vooraf resolved.

## P. Wizards en beheer

- [x] Herbruikbare FieldFlow Style Step bestaat.
- [x] Inhoud, compositie, merk/media, motion/timing, screens/planning en review hebben consistente volgorde.
- [x] Alleen relevante stappen verschijnen per familie.
- [x] Iedere setting werkt live in preview.
- [x] Contrast-, QR-, media-ready-, rights- en overflowwaarschuwingen zijn actionable.
- [x] Tenantdefaults en per-slide overrides zijn duidelijk onderscheiden.
- [x] Review toont offline fallback en immutable snapshotgevolg.
- [x] Autosave, recovery en back/forward bewaren state.
- [x] Mobiele wizard is opnieuw gecomponeerd.
- [x] Sportlink bulkflow en per-slide overrides blijven functioneel zonder themepicker.
- [x] Geen instelling is alleen cosmetisch in de editor zonder productie-effect.

## Q. Assets, security en privacy

- [x] Alle assetclasses in `ASSET_MANIFEST.csv` hebben producent, consumer, fallback en test.
- [x] Home/away-logo’s en arrival sponsorasset worden door de assetcollector meegenomen.
- [x] QR wordt lokaal/content-addressed gegenereerd.
- [x] Geen hotlink of runtime remote font bestaat.
- [x] Media wordt pas gepubliceerd bij `ready` of expliciete fallbackkeuze.
- [x] Ruwe gebruikersmedia en sponsorcreativepixels blijven intact.
- [x] Provider-/tenantlogo’s worden niet hertekend of automatisch gerecolord.
- [x] Verjaardags-/scorersfoto’s respecteren privacy en rechten.
- [x] Player doet geen providercalls en bevat geen service-role secret.
- [x] RLS- en securitytests slagen.
- [x] Geen nieuwe PII wordt uit copy of fixtures verzonnen.

## R. Kwaliteitsgates en bewijs

- [x] `pnpm lint` slaagt.
- [x] `pnpm typecheck` slaagt.
- [x] Unit- en integratietests slagen.
- [x] Repositorybuild slaagt.
- [x] A11y-suite slaagt.
- [x] Chromium E2E slaagt.
- [x] Player- en offline-suites slagen.
- [x] Database reset/migratie en RLS-tests slagen waar gewijzigd.
- [x] De functionele matrix bevat elke rij uit `SLIDE_COVERAGE.csv`; de
  afzonderlijke visuele matrix dekt de vastgelegde representatieve
  min/nominal/max-composities. [E2, E6]
- [x] Light/dark, landscape/portrait en min/nominal/max data zijn gedekt.
- [x] 1080p/4K en orientation mismatch zijn gedekt.
- [x] Long strings, missing/broken assets, empty/stale/error/offline zijn technisch gedekt; de totale marketing-image-failure blijft structureel schoon, maar image-based header-/footer-lock-ups hebben zonder het officiële locked targetasset nog geen complete merkfallback (P2).
- [x] De actuele S145-visual diffs zijn op 4 september 2026 expliciet door de gebruiker geaccepteerd; S144-bewijs blijft geen v1.6-goedkeuring. [E6, D018]
- [x] Voor iedere actuele S145-surface bestaat na code-freeze een nieuw matrix- of exact vergelijkingsblad.
- [x] De gebruiker heeft de negen actuele S145-reviewbladen op 4 september 2026 expliciet goedgekeurd. [E6, D018]
- [x] De afwijking is op 4 september 2026 expliciet menselijk geaccepteerd: behoud huidig officieel VeyoCast-icon; gebruik FF-PHOTO-01/06/05/04 als beschikbare, approved vervangers; accepteer de schone lege image-based lock-ups bij synthetische totale image-failure als P2. [E6, E12, D018]
- [x] De vijf historische screenshotdiffs zijn voor commit door de gebruiker
  geaccepteerd voor opname, zonder evidence- of provenanceclaim. [D020]
- [x] Studio noemt de echte renderactie `Genereren` en beweert niet dat deze stap al immutable publiceert.
- [x] Bundle/performance/offline regressies zijn gemeten.
- [x] Fysieke LG-status blijft eerlijk `EXTERNAL_UNTESTED`; alleen de
  S145-releasegate is `WAIVED_BY_USER_2026-09-04`, niet de hardware-uitkomst.
  [D020]
- [x] Canon-, migration-, rollout- en rollbackdocumentatie is bijgewerkt.
- [x] Het exacte gewijzigde-bestandenmanifest omvat alle 175 paden; de vijf
  historische PNG's zijn afzonderlijk gelabeld als door de gebruiker
  geaccepteerde non-evidencewijzigingen. [D020]
- [x] De gebruiker heeft push en protected deployment geautoriseerd; de
  officiële PR/CI-, staging- en productiongates blijven onverkort verplicht.
