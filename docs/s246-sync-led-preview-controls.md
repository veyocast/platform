# S246 — Source-kleuren voor LED-previewbediening

De vorige reviewfreeze onder `/dev/shm/veyocast-s246-proof/freeze/` blijft
ongewijzigd. Root gaf vóór commit nog vier exact benoemde UI-selectors vrij:
sectienummers, mediafallback-counters, publicatie-uitlegnummers en uitsluitend
het oranje accent in de decoratieve introductiegradient. Na werkelijke
S247-closure en expliciet root-GO is dezelfde twee-casesreeks afgesloten met
2 rood → 2 groen. De nieuwe bewijsreeks staat afzonderlijk onder
`/dev/shm/veyocast-s246-ui-completion/`; geen foundationherhaling of extra audit.

De behouden LED-wizard gebruikt binnen de expliciet toegewezen UI-families de
bestaande Source-tokens: previewknoppen, module-/momenticonen, huidige wizardstap
met cijfer en mobiele indicator, geselecteerde momentkaarten en geselecteerde
schermstand-/indelingskaarten, drie nummercircuits en de decoratieve introductie.
Selecties krijgen `--accent-soft` en `--accent`;
oppervlak, rand en tekst volgen `--surface`, `--line` en `--text`.

De productwijziging bestaat uit 59 toegevoegde regels met lokale CSS-kleurblokken.
De oorspronkelijke selectors buiten Sync blijven bytegelijk. Lettergroottes,
afmetingen, handlers, `aria-pressed`, verborgen configuratie en alle
preview-/canvas-/rendererdeclaraties blijven behouden. Er is geen globale
`--vc-action`-override. Een gekozen Electric Orange-contentthema blijft oranje.

Basis: `10a49dc957c03c68f40e7ef92c28239d8e5376c3`, branch
`veyocast/s246-sync-led-preview-controls`. De oude S242-branch en alle eerdere
bewijzen zijn behouden.

## Aanleiding en bronmapping

De echte S244-built-DOM op `/dashboard/studio/led-scores` bevatte bij 390 en
1440 px actieve `16:9`- en `Goal`-knoppen met `rgb(255, 92, 32)`.
Bewijs: `/dev/shm/veyocast-s244-integration/s246-actual-orange-led-controls.json`,
SHA-256 `7c5cd453c09d2c4f1aee9dfdd398aa25968f28c455ab175f0014e03e4b1eb106`.
De knoppen liggen op de echte lange pagina onder de eerste
viewport; de finale gecombineerde cohort moet hun bereikbaarheid door werkelijk
scrollen afzonderlijk tonen.

`LedScoresAlertEditor` levert de schermstand via `setOrientation` en de
voorbeeldmomenten via `setPreviewKind`. `LiveMatchSlideEditor` levert de echte
radioselecties en de bijbehorende Playerpreview. De toegewezen selectors krijgen
uitsluitend lokale `:global(.sync-control)`-regels.
De bestaande Source Studio-selectie en de segmented-keuze in de nieuwe wizard
gebruiken dezelfde accent-/oppervlaktetokens.

## Browserbewijs

`tests/control/sync-led-controls.spec.ts` mount de werkelijke editor, het echte
canvas en de presetrenderer. React/esbuild en expliciet gecontroleerd
framework-/serveractiontransport volgen de bestaande LED-fixtures. De finale
fixture bevat alle actuele scopeklassen `sites-control vx-shell app-shell
design-sync sync-control`, `data-fieldflow="v3"`, de binnenstructuur
`vx-main`/`vx-content main-content` en de globale stylesheetvolgorde van de app,
inclusief retained-portal-/authstyles. Alleen de buitenste frame-layout staat op
`display:block` om de twee echte editorcomponenten zonder navigatieshell te
isoleren. Dit is componentacceptatie; geen volledige echte-routecapture.
Er draait
geen Next-server; geen command, upload of providerrequest wordt uitgevoerd.

De twee cases gebruiken 390×844 en 1440×1000, één worker, nul retries en geen
skips. Zij kiezen werkelijk `9:16` en `16:9`, `Tegengoal` en `Goal`, controleren
de echte oriëntatie en hoofdtekst, keyboardfocus, Source-kleuren, bestaande
44px-doelen en afwezigheid van horizontale overflow. De bestaande 14px
schermstandknoppen en 12px momentknoppen veranderen niet van lettergrootte.

Dezelfde twee finale cases controleren ook:

- originele actieve kleuren buiten de Sync-scope;
- geen commands, browserfouten of onverwachte netwerkrequests;
- exacte previewpixels na terugkeer naar dezelfde selectie;
- exacte presetpixels vóór en na de previewbediening;
- bytegelijke verborgen `canvasExperience`-JSON;
- aXe zonder violations uitsluitend op de twee controlgroepen.

De uitbreiding kiest werkelijk een opstellingsmoment, staande live slide en
scorebordindeling. Zij controleert de geselecteerde kaarten, iconen en actieve
wizardindicator bij 390 en 1440 px, evenals de echte terugkeer naar de
wedstrijdcentrum-preview. Alle uitgebreide UI-families worden buiten Sync vóór
en na de journey exact op kleuren, fonts en geometrie vergeleken.

V3 bezoekt daarnaast werkelijk alle vijf wizardstappen via de bestaande
Volgende-/Vorige-bediening en keert terug naar Momenten. De zichtbare
sectienummers, drie echte mediafallback-counters, drie publicatie-uitlegnummers
en decoratieve introgradient worden gecontroleerd. Ook deze families zijn in
de buiten-Sync-vergelijking opgenomen. De drie nummercircuits gebruiken alleen
`--accent` en `--surface`; de introductie behoudt de 135°-gradient, Ink Black-
start en 82%-menging. Uitsluitend het oude oranje eindaccent wordt Sourceaccent.

De eerste harnessrun is behouden onder
`/dev/shm/veyocast-s246-proof/first-red/`: session 58109, werkelijke exit 1.
De mobiele test gebruikte aanvankelijk een verborgen desktop-stapknop. De
fixture gebruikt vervolgens de bestaande mobiele `Volgende`/`Vorige`-footer.
De aanvankelijke brede aXe-scope vond daarnaast twee bestaande 11px toplines met
contrast 3,5 in de bewust oranje contentpreview. De productinhoud is niet
aangepast. De uiteindelijke aXe-claim betreft uitsluitend de twee te repareren
controlgroepen; dit is geen AA-goedkeuring van het contentcanvas.

Daarna faalden dezelfde twee complete cases uitsluitend op de bedoelde
knopkleuren, op oorspronkelijke CSS:
`/dev/shm/veyocast-s246-proof/baseline-controls-red/`, session 28261, exit 1,
2 FAIL, 0 SKIP, 0 retry. Alle interactie-, canvas-, preset-, config- en
control-aXe-asserties bereikten hun einde.

Na de twee CSS-blokken: `/dev/shm/veyocast-s246-proof/candidate/`, session
77487, werkelijke exit 0; 2 PASS in 13,6 s, 0 SKIP, 0 retry. Chromium 3046350
sloot graceful met exit 0. Deze oorspronkelijke twee-rood/twee-groenreeks blijft
afzonderlijk behouden.

Na de extra actuele oranje mengtintbevinding gaf root vóór wijziging expliciet
de genoemde extra UI-selectors vrij. De twee cases met de gecorrigeerde volledige
CSS-context faalden vervolgens op de nog ongewijzigde extra groepen:
`/dev/shm/veyocast-s246-proof/expanded-red/`, session 9236, werkelijke exit 1,
2 FAIL, 0 SKIP, 0 retry, per case 18 uitsluitend kleur-/indicatorfouten.
De oude preview-, preset-, config- en buiten-Sync-asserties bleven behouden.

De finale uitbreiding is groen onder
`/dev/shm/veyocast-s246-proof/expanded-candidate/`: session 73298, werkelijke
exit 0; 2 PASS in 18,8 s, 0 SKIP, 0 retry. Chromium 3288219 sloot graceful met
exit 0; daarna is `Chrome[]` via `/proc` geverifieerd. De kleurmeting wacht
uitsluitend op de eigen werkelijke CSS-transities via `animation.finished`;
geen vaste wachttijd, aangepaste deadline of tolerantie. Beide finale
controlcaptures zijn werkelijk bekeken: Source-selectie groen, leesbare knoppen,
oranje content behouden en geen afgekapt previewcontrol.

De laatste vier selectors zijn opnieuw afzonderlijk bewezen. Op de vorige
productkandidaat faalden dezelfde twee cases uitsluitend op 23 nieuwe
nummer-/intro-paletasserties per case: `v3-red/`, session 5172, werkelijke exit
1, 2 FAIL, 0 SKIP, 0 retry. Alle oude assertions en readbacks bereikten hun
einde. De specbody is daarna exact gelijk gebleven.

Na de vier exacte UI-selectors: `v3-candidate/`, session 91066, werkelijke exit
0; 2 PASS in 22,5 s, 0 SKIP, 0 retry, één worker, ongewijzigde deadlines.
Chromium 3641026 sloot graceful met exit 0; verse `/proc`-meting gaf
`activeChrome=[]`, vastgelegd in `browser-closed.json`. Geen eigen runtime of
build. De zes nieuwe intro-/fallback-/publicatie-uitlegcaptures zijn werkelijk
bekeken bij 390 en 1440 px: groene nummers, leesbare tekst, geen clipping en
een behouden donkere introductie met Sourceaccent.

## Invarianten en statische controles

`/dev/shm/veyocast-s246-proof/final-source-boundary.json` bewijst dat het
weghalen van precies de toegevoegde lokale kleurblokken de oorspronkelijke CSS
exact herstelt. Alle 33 overige beschermde bronbestanden zijn bytegelijk,
waaronder de hele overige LED-map, Source-/gedeelde styles, tokens, lockfile en
bestaande LED-browsercases.

Alle acht PNG-paren van de oorspronkelijke twee-groepenreeks zijn bytegelijk.
Bij de uitgebreide reeks zijn acht van tien rood→groen-PNG-paren exact gelijk.
Uitsluitend beide 390px-presetbeelden verschillen over 97 van 45.440 pixels,
maximale kanaaldelta 5, begrensd tot x=14–25/y=8–20 bij het kleine blauwe clublogo.
Beide beelden zijn 284×160; alle overige presetpixels zijn exact. De oorzaak is
niet bewezen. De ruwe beelden, diff en RGBA-hashes blijven bewaard onder
`expanded-pixel-boundary-first-comparison.json` en
`mobile-preset-first-difference.json/png`. Geen tolerantie, geen algemene exacte
mobiele pixel-PASS.

Binnen iedere finale case zijn de content-, preset- en scoreboardbeelden na
terugkeer naar dezelfde selectie exact gelijk en blijft de verborgen config
bytegelijk. De beschermde CSS-/render-/componentbron is ongewijzigd; deze lokale
states zijn geen algemene Source-pixel-, provider- of deviceclaim. De actuele
bron-/closuregrens staat in `final-source-boundary.json`.

In de laatste v3-reeks zijn alle tien gekozen rood→groen-content-/preset-/
scoreboard-PNG-paren exact gelijk, zonder tolerantie. Ook binnen de cases
blijven de bestaande exacte pixel- en configasserties groen. Het eerdere
97px-verschil blijft als eigen historische niet-exacte grens behouden; deze
nieuwe lokale vergelijking wordt geen algemene Source-/mobiele pixel-PASS.
De actuele vier-selector-/bron-/closuregrens staat onder
`/dev/shm/veyocast-s246-ui-completion/source-boundary.json`.

Gerichte ESLint is groen (session 20514, exit 0). Strict spec-TSC is groen
(session 59241, exit 0). De oorspronkelijke TSC-fout is apart behouden: de
generieke DOM-locatortypes kenden `HTMLImageElement.complete/naturalWidth` niet.
Twee uitsluitend TypeScript-casts lossen dit op. Het getranspileerde
test-JavaScript vóór en na die typeverfijning is exact gelijk, SHA-256
`8a489b375616c518cb2d8b1d6606b69eb478cebe16df7b8405bc6aa9693f4835`.

De drie bestaande LED-scene-/canvasstate-/UX-unitbestanden zijn groen:
19/19 tests, session 43877, exit 0, maximaal twee workers op CPU 4,5.
Diffcheck is groen. Na werkelijke closure van het S245-dark-checkslot zijn
volledige workspace lint/typecheck/test groen: 68/68 taken, 64 cachehits,
Control 1.658 PASS en 34 bestaande conditionele SKIP. Session 35683 sloot met
werkelijke exit 0; 100,06 s op CPU 4,5, concurrency 1 en 2.048 MiB Node-heap.
Elke seconde is `MemAvailable` gemeten; minimum 1.078,0 MiB. Er draaide geen
eigen browser, server of build tijdens deze foundation.

Deze volledige foundation sloot vóór de twee laatste expliciet vrijgegeven
CSS-only uitbreidingen. Conform root-GO is de eerste daarvan met scoped controles
afgesloten: ESLint session 30317 exit 0, strict spec-TSC session 43738 exit 0,
diffcheck 0. Een oorspronkelijke lintfout op een bewust weggegooide computed-
style-read is bewaard; uitsluitend expliciet `void` toegevoegd aan dezelfde
read, met behoud van await en alle assertions. Geen nieuwe bron-/geometrywijziging
of extra browserherhaling na de groene finale cases.

De laatste vier-selector-delta sloot eveneens af met scoped controles:
ESLint session 45333 exit 0, strict spec-TSC session 26285 exit 0 en diffcheck 0.
Dezelfde v3-spec is vóór rood, bij groen en na deze statische gates bytegelijk.

Actuele product-CSS SHA-256:
`4b9eea02c81babe7e8ec062ba52e376b6e1221296a2555c6ef26458c8b1a9d25`.
Actuele testspec SHA-256:
`2992711d75b7fefdbb9fc85572ab685a5472f8d85d33360d32c05b699a29079e`.

## Expliciete grenzen

De eerste fixture miste de `sites-control`-context; de actuele shell bevat daarnaast
`vx-shell app-shell design-sync sync-control`. De stylesheetvolgorde is
read-only gecontroleerd; de echte app laadt ook de afgeschermde retained-portal-
en authstyles, die deze twee groepen niet selecteren.

De bewaarde echte `0044-actual-b1131591326a-computed.json` bevat daarnaast wel
concreet de behouden wizardstap `1MomentenBron en live momenten` op y=6.969 met
`background: color(srgb 1 0.923294 0.895059)` en de geselecteerde Goal-`momentCard`
op y=8.011 met `background: color(srgb 1 0.955255 0.938784)`. De selector gebruikt
een oranje `color-mix`; de olijfgroene bovenste Source-wizard is een afzonderlijke
`SitesLedMomentWizard`. Een scan op alleen exact `rgb(255, 92, 32)` sluit deze
mengtinten niet uit. Dit was de concrete grond voor de expliciete uitbreiding;
deze genoemde UI-families zijn nu lokaal aangepast. De read-only cascadeanalyse staat in
`/dev/shm/veyocast-s246-proof/cascade-readonly.json`. Er is geen productverbreding
buiten de uitgebreide selectors. Het eerder expliciet gemelde oranje
sectiekopnummer is in de laatste vier-selector-delta gesloten, samen met de
mediafallback-/publicatie-uitlegnummers en het introductieaccent. Root heeft de
overige `--vc-action`-hunks afzonderlijk gelezen: de bedoelde kleuren van
`experiencePreview` en `scoreboardPreview` blijven exact behouden. Er is geen
extra brede audit of wijziging aan deze contentkleuren gedaan.

Er zijn geen wijzigingen aan TSX, writers, permissions, database, immutable
publicaties, Player/offline, Source-bestanden, dependencies, serviceworkers of
configuratie. Er is geen nieuwe build/runtime, commit, push, PR, merge of uitrol
uitgevoerd. De gecombineerde werkelijke-routeacceptatie en onafhankelijke
volledige visuele ronde 2 volgen na finale build/cohortfreeze. Geen algemene
pixel-, vijf-ronden- of V1-acceptatieclaim.
