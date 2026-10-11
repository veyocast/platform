# Uitvoeringsplan: van Sites-referentie naar productie

Dit document beschrijft te bouwen werk. Niets hieronder verklaart de migratie al uitgevoerd. Bindend ontwerp: `../01-CANON.md`. Exacte bron: `../source/sites/`. Alle doelpaden zijn relatief aan `veyocast/platform`.

## 1. Technische beslissing

Het platform blijft een Next.js/Supabase-monorepo met bestaande Control, Player, Marketing en media-worker. Breng de Sites-presentatielaag hiernaartoe en koppel haar aan de productieservices. De Sites-hashrouter, demo-opslag, Vinext/Cloudflare-worker en ChatGPT-auth worden geen productiekern.

Streef naar één product-owned presentatielaag met strikt getypeerde input voor de betrokken templates. De logische grens is:

- **Authoring:** echte Control-UI, servercommands, revisions en concepten.
- **Projectie:** gevalideerde ontwerpconfiguratie + actuele toegestane dataset → volledig getypeerde viewdata.
- **Presentatie:** exacte Sites-compositie, CSS, fonts en assets, zonder providercredentials of databasetoegang.
- **Uitvoer:** dezelfde presentatie in preview/moderne dynamische Player; vertrouwde worker-capture voor Studio-media; expliciete legacyprojectie voor Static LG.

Een mogelijke nieuwe package heet `packages/sites-presentation`; de naam is een implementatievoorstel, geen bestaand package. Productiecontracten komen bij de bestaande centrale contracts. Extractie mag de CSS-cascade en het zichtbare resultaat niet veranderen.

## 2. Afhankelijkheden en werkpakketten

| Fase | Werk | Afhankelijk van | Vereist bewijs |
| --- | --- | --- | --- |
| P0 | Nulmeting, broncontrole, actuele delta, scoped canonbesluit | Pakket + echte repo | Manifest klopt; actuele SHA/dirty state bekend; taken gekoppeld aan alle CSV-rijen |
| P1 | Exacte shell, primitives, assets, fonts en CSS-scope | P0 | Referentie/nieuw bij desktop, tablet en mobiel; auth/deep links intact |
| P2 | Mobiele mediabibliotheek, playlisteditor en batchmutaties | P1 | Upload/mixed select/save/reload/tweede sessie/concurrency; geen veldverlies |
| P3 | Versioned thema-/documentcontracten en gedeelde renderlaag | P0, P1 | Backwardcompatibility, DB-guards, alle controls roundtrip; templatevergelijking |
| P4 | Alle Studio’s en integratieadapters, worker en beide Players | P3 | Echte brondata, dezelfde preview/export/output; offline en events |
| P5 | Schermen, contentzones, planning, publicatie en telemetry | P2–P4 | Echte deviceflow, zone-/schema-/prioriteitscases; first-framebewijs |
| P6 | Overige routes, Marketing, PWA en native vertaling | P1 + relevante contracts | Routematrix compleet, functies/rechten behouden |
| P7 | Volledige pariteitscontrole, staging en releaseoverdracht | P2–P6 | Visueel + functioneel bewijs, exacte SHA/digests, rollbackcompatibiliteit |

P2 en P3 kunnen deels parallel zodra de primitives en contractafspraken vaststaan. Eén eigenaar beheert shared contracts/migrations; geen conflicterende theme-ID’s of dubbele batch-RPC’s laten ontstaan.

## P0 — Bewaar de waarheid en maak verschillen meetbaar

1. Lees actuele repositoryinstructies en deze overdracht. Controleer `tools/verify-package.py`. Houd `source/sites` ongewijzigd.
2. Werk in een geïsoleerde branch/worktree vanaf de juiste actuele basis. Vergelijk veranderingen na `6fcc26f...`; reconcilieer eventuele nieuwe schema’s, templates, fixes en devicecontracten.
3. Maak `docs/sites-v11-overname/` in de doelrepo met de canon-delta, beslissingen, bijgewerkte mappings en bewijsindex. Citeer beide bron-SHA’s. Eerdere detailcanons blijven behouden met gerichte verwijzing naar deze nieuwe visuele authority.
4. Leg bestaande productie-/stagingversies, DB-migration history en featurecohort vast via de toegestane operatorroutes. Onbekend blijft onbekend; het onderzoek leverde geen live VPS- of database-export.
5. Maak deterministische fixtures voor alle referentiegevallen. Houd demo-inhoud in testfixtures. Seed geen persoonlijke Duindorp-inhoud in willekeurige tenants.
6. Leg de huidige functionele regressiebaseline vast: secties, geavanceerde mediavelden, rollen, publicatie, live-datarefresh, offline en native clients.

Uitgang: een expliciete vergelijking en toetsbare criteria vóór visuele componenten worden gewijzigd. Laat dit geen eindeloze analysefase worden; de bronmapping in het pakket is al uitgevoerd.

## P1 — Exacte UI-basis

Bronnen: `app/prototype/app.tsx`, `shared.tsx`, `app/globals.css`, `fieldflow.css`, `tokens.css` en module-CSS. Doelen: Control-shell, `packages/ui`, routecomponenten en Marketing.

- Neem JSX-structuur en CSS samen over. Scope themaregels zodat appheaders geen slideheaders overschrijven. Verwijder alleen aantoonbaar vervangen oude route-overrides; geen stapel compensatie-CSS.
- Inter/Manrope lokaal; brush/display en TV-fonts alleen waar de bron ze gebruikt. Versiebeheer en assetbytes blijven controleerbaar. De officiële twintig brandbestanden hoeven niet opnieuw gemaakt te worden.
- Mobiele nav en shell volgen de actuele bron, inclusief 248/78px desktopsidebar, eigen mobiele compositie en originele breakpoints. Detailwaarden staan in UI-STYLING-CANON.
- Gebruik echte routeguards, sessie en tenantcontext. De dialog/pickerflow krijgt Next-compatible history en focusmanagement.
- Productiestatussen zoals loading/error/permission/conflict verschijnen binnen de Sites-componenttaal. Geen extra technisch jargon voor de eindgebruiker.

Acceptatie: dezelfde screenshotfixtures op 390/768/1440px; toetsenbord/focus/terug/safe-area; geen verschil in fonts, spacing, headergeometrie of knoppen. Geen mockstatistieken in de echte overzichtspagina.

## P2 — Snelle mobiele playlistflow met echte opslag

Bronnen: `playlist-library.tsx`, `playlist-editor.tsx`, `playlist-media-picker.tsx`, bijbehorende CSS, `content.tsx`. Productie: `dashboard/playlists/{data,actions}.ts`, `_components/publisher-studio-workspace.tsx`, `dashboard/media/**`, image/video-uploadservices.

### Nieuwe mutatiegrens

Voeg een begrensde, tenantveilige batchopdracht toe voor gemengde selectie, Studio-reeks, bulkduur en bulkthema. Voorstel van envelop:

```ts
type PlaylistBatch = {
  playlistId: string;
  expectedRevision: number;
  idempotencyKey: string;
  operations: PlaylistOperation[];
};
```

De echte UUID-/revisiontypen komen uit bestaande contracts. Stel expliciete limieten voor aantal operations/payloadbytes vast vanuit de bestaande domeinlimieten en test de grens. Valideer alle contenttypes en capabilities, lock het concept, schrijf in één transactie en geef de nieuwe revision plus result-ID-mapping terug. Bij conflict geen gedeeltelijke aanpassing. Bij retry met dezelfde key geen duplicaten. Mediaupload kan vooraf gedeeltelijk slagen; het toevoegen aan de playlist is daarna één atomaire stap.

Bewaar rijke bestaande itemvelden, secties en snapshots. Thema per plaatsing mag geen gedeeld brondesign of andere playlist wijzigen. Explicit rebase/nieuwste bron ophalen is een aparte actie. Undo na serverack is een nieuwe guarded mutatie op de actuele revision.

### Upload en library

Serverpaginatie/filters blijven. Selectie bewaart stabiele asset-ID’s en selectievolgorde over pagina’s heen. Uploadfouten per bestand; successen blijven beschikbaar. Hervatbare videoupload gebruikt de bestaande intent/TUS/finalize/workerketen. Voeg AVIF-sniffing/decoding/normalisatie aan de bestaande veilige pipeline toe; geen clientaccept zonder serverondersteuning. Presenteer processing, failure/retry, quarantine en ready correct.

Acceptatie: gemengde selectie op 390px, drie uploads waarvan één fout, Studio-reeks invoegen, selectie behouden na filterwissel, bulkduur/-thema, herladen/tweede sessie, stale revision, retry-idempotentie, readonlyrol, tenantwissel en grote bibliotheek. Bestaande video/secties/trim/audio blijven bedienbaar.

## P3 — Volledige versieerbare vormgeving

Huidige authoringguards: `packages/contracts/src/theme-engine.ts`, migrations S144 en S153; LED-fontbeperking in `ledscores-scene.ts`. Deze grenzen worden gecontroleerd uitgebreid.

Houd afzonderlijk:

1. `ScreenThemeId`: Sites `fieldflow | onzetrots-tv`.
2. Legacy LED-presentatie: `blue | paper | fieldflow` binnen LED-configuratie.
3. Appearance-/template-/rendererversies en oude historische IDs.

Maak geen vier willekeurige nieuwe publieke theme-ID’s op basis van een visuele lijst. Documenteer de exacte mapping en defaults. Schema’s bevatten de volledige Sites-instellingenset: oriëntatie/layout, tekst-/beelddata, crop, overlay/accent, safe area, uitlijning, schaal, logo-/team-/scorecontrols, klok/tijdlijn, duur/paging, template- en assetversie. Begrens waarden server-side. Oude readers en snapshots blijven werken; schrijf nieuwe documenten expliciet versiegebonden.

Roundtriptest: iedere control aanpassen → server bewaren → herladen → preview/export/player. Geen ontbrekende instelling stil terugzetten naar default. Bewaar ontwerpidentiteit apart van dynamische bronrevisie.

## P4 — Alle templates, studios en Players

Volg iedere rij in `TEMPLATE-MAPPING.csv`. Verplicht: 11 basisstartpunten, 8 OnzeTrots TV-startpunten, aanvullende score/goal/opstelling/generic, oude blauwe/witte LED-uitvoeringen, beide oriëntaties, alle vijf landmarkachtergronden en afzonderlijke schalen 70–200%.

### Renderketen

Een gedeelde vertrouwde DOM-renderer is hier de voorkeursroute voor exacte CSS-composities. Voor statische Studio-output wordt capture een begrensde workerbackend binnen de bestaande job-/lease-/retry-/quota-/media-artifactketen. Input is een gevalideerd document met toegestane asset-ID’s, geen vrije HTML. Fonts/afbeeldingen moeten volledig geladen zijn; blokkeer ongeautoriseerde netwerkbestemmingen. Output krijgt bestaande provenance, MIME, dimensies, checksum en readiness. Motion wordt met dezelfde timing in MP4 verwerkt of aantoonbaar gelijkwaardig via bestaande compiler geleverd.

Moderne dynamische Player gebruikt dezelfde presentatieprojectie; Static LG krijgt een eigen compatibele codegen/projectie met dezelfde vaste canvasmaten en assets. Vermijd afhankelijkheid van containerqueries, moderne syntax of ResizeObserver als die runtime dat niet ondersteunt. Gevalideerde PNG-fallback blijft vangnet; voor live-score/events moet actualiteit en timing óók werken. Geen authoringeditor naar de Player bundelen.

### Adapters

- **Sportlink:** getypeerde program/result/standing/arrival/referee/birthdaymapping. Zes Sites-categorieën exact, alle extra bestaande families behouden. Gebruik bestaande batchcreate/rechten. Onbekende score, vorm of logo krijgt de passende empty/fallbackstaat, nooit demodata.
- **LED:** eigen/tegenstander/onbekend, opstelling thuis/uit, start/rust/einde, live-match en overlay. Behoud lease, event-ID, dedupe, deliveryack, priority en stale klok. Test eigen club die uit speelt. Test 12–10 en lange namen bij 200% zonder clipping; dezelfde fit-to-space-regels als de referentie.
- **Menu/Twelve:** product-ID’s en integergeld, categorieën, paginering, bestaande importreview en snapshots. Getoonde prijzen volgen het bestaande productdata-/publicatiecontract.
- **YouTube:** video blijft bestaande veilige bron. Voeg getypeerde playlistidentiteit, gecontroleerde resolutie, volgorde-/herhaalbeleid, unavailable/private-videoafhandeling, officiële playerintegratie en offline fallback toe. Geen ongecontroleerde URL-fetch of alleen eerste video bewaren. Playback- en metadataquery’s blijven server-/providergebonden; werk bestaande flags en preflight bij.

### Assetcontract

Gebruik `inventory/ASSETS.csv`. Registreer system-assets immutable met versie, hash, MIME en maten; behoud provenance/attributie. Tenantuploads blijven private media. De release-/shellcache verzamelt alle fonts, masks, logo’s, achtergronden en alternatieve pagina-assets vóór activatie. Geen runtime-afhankelijkheid van de Sites-host. Geen signed preview-URL in configuratiehash. Vergelijk checksumgelijkheid en visuele crop afzonderlijk.

## P5 — Contentzones en echte devicebediening

De vier Site-layouts zijn nieuw productiefunctionaliteit: `full`, `sidebar`, `bottom`, `three`. Exacte geometrie uit `screens.tsx:72–77` en `screens.module.css:1053–1056`: hoofdvlak links/zijvlak rechts, onderbalk over de volle breedte. Hoofdvlak 50–80% in stappen van 5 (standaard 70), onderbalk 15–35% in stappen van 5 (standaard 20), beide oriëntaties. Bewaar proportionele contain-weergave binnen iedere zone; verzin geen nieuw grid.

**Nieuwe ontwerpbeslissing voor implementatie:** een versioned schermcompositie met stabiele `main`, `side`, `bottom`-zone-ID’s (alleen de bij de layout horende zones), oriëntatie, gevalideerde verhoudingen en per zone een tenantveilige contentverwijzing naar een gepubliceerde playlist of vastgelegd ontwerp. Deze namen zijn nieuwe interne schema-ID’s en veranderen geen zichtbare Sites-labels.

- Iedere zone heeft een onafhankelijke item-/paginaklok. De assetset is de unie van alle verplichte zones; een half gedownloade compositie wordt niet actief.
- Het mainvlak bepaalt audio; aanvullende zones spelen gedempt. Respecteer bestaande mute/volume-/videopolicies. Dit is een nieuwe expliciete regel, geen huidige backendfunctie.
- Een gewone wijziging van defaultcontent beïnvloedt geen lopende schedule. De bestaande scheduler bepaalt de schermopdracht. In V1 vervangt een geplande playlist alleen de main-binding binnen de gepubliceerde standaardcompositie; side/bottom blijven staan. Geen onafhankelijke per-zone scheduler. Aan het einde keert de scheduler terug naar de actuele default. Een toekomstige expliciet geplande volledige compositie vereist een nieuw getypeerd target; niet impliciet andere zones muteren.
- LED-eventoverlays zijn schermbreed boven alle zones en sponsorlagen; bestaande billing/emergency/systemblokkades blijven erboven. Bij de bestaande pause-policy pauzeren alle zoneklokken/video’s en zichtbare sponsorlooptijd; daarna hervatten zij exact. Behoud expiry, deduplicatie, executeAt, receipts en prioriteit; nooit per zone duplicaat vieren. Bestaande LED-introaudio blijft onder haar eigen contract.
- Sponsoring blijft één schermbrede laag, met bestaande positionkeys, expiry, orientationfilter, deterministische gewichtselectie en prioriteit. Fullscreen sponsor start volgens het bestaande beleid bij een hoofdzone-item; gewone placements zijn globaal. Geen sponsorselectie of Proof of Play vermenigvuldigen per zone en geen fictieve zichtbare tijd tijdens bedekking. Signaleer sponsorfooter/onderbalkconflicten in preview/preflight. Bestaande review en vier-ogenregels blijven.
- Activeer een volledige nieuwe compositie op een gezamenlijke natuurlijke grens: main initieert; gezonde video’s in andere zones mogen hun ended/trim-grens halen. Eerder gereedstaande zones houden het laatste geldige frame. De bestaande watchdog voorkomt eindeloos wachten; geen halfoude/halfnieuwe compositie of zwart tussenframe.
- Actieve planning/sponsorplan behoudt gepubliceerde volgorde; buiten die context geldt de bestaande S185-volgordelogica per zone op stabiele item-ID’s.
- Ondersteuning/capability en benodigde opslag worden in preflight getest. Laat een niet-ondersteund device de last-known-good behouden met expliciete status; noem de feature nog niet compleet totdat de vereiste moderne én LG-paden werken.
- Een ontbrekende/onbereikbare bron gebruikt de gevalideerde zonefallback of last-known-good volgens de publicatiepolicy. Geen zwarte zone als ‘succes’. Een ongeldige nieuwe compositie wordt geweigerd zonder de actieve gezonde compositie te vervangen.

Bestaande aanknopingspunten voor deze nieuwe uitbreiding: `apps/player/app/_components/player-runtime.tsx`, `_lib/player-release-envelope.ts`, `_lib/player-cache.ts`, `_lib/player-sponsor.ts`, `_lib/publication-playback-order.ts`, `_lib/lg-legacy-page.ts`, `_lib/lg-goal-overlay-runtime.ts` en contracts `playlist/sponsor/goal-overlay`. LED-policy: `docs/integrations/ledscores-realtime-goal-alert.md:141–151,265–277`.

S185 blijft ongewijzigd in betekenis: configuratie is immutable, live datasets verversen apart, target_revision is monotoon. Current/desired/download/verify/first-frame volgen echte telemetry. Pairing en memberships gebruiken bestaande servercommands; een lokale dummydevice is geen koppeling.

## P6 — Routevolledigheid en aanvullende apparaten

Werk de 225 routematrixrijen af. De matrix telt ook endpointcontracten en native oppervlakken: dit zijn geen 225 opnieuw te ontwerpen pagina’s. Voor bestaande pure aliases/redirects zijn compatibiliteit en bereikbaarheid voldoende. Voor pagina’s zonder Sites-equivalent is dezelfde componenttaal met alle bestaande velden vereist.

Behoud login, MFA, uitnodigingen, onboarding, contextwissel, billing, importreview, support, audit en platformbeheer. Marketing behoudt SEO-/juridische routes, actuele productclaims/prijzen en setupintents. Neem geen demoprijzen of fictieve statistieken over.

Responsive web-Control/PWA heeft directe Sites-pariteit. De Expo-app behoudt haar onafhankelijke runtime en API’s; vertaal gemapte schermen naar dezelfde zichtbare hiërarchie en taakvolgorde, zonder web-CSS rechtstreeks te plakken. Breid de beperkte mobile-playlistprojectie versieerbaar uit als nodig. Bestaande clients blijven decoderen. Native screenshots/device/builds zijn afzonderlijk bewijs. Android-TV- en LG-hosts behouden hun eigen packaging; geen tweede playbackengine.

## P7 — Reviewbaar uitrollen

Test volgens ACCEPTATIE-EN-QA en de actuele repo-gates. Alleen een lokale wegwerpdatabase mag worden gereset. Route-/template-/workflowrijen verwijzen naar concrete bestanden, tests en capturebewijs. Nog niet uitgevoerde tests krijgen expliciet die status.

Een PR beschrijft het gebruikersprobleem, exacte Sites-overname, nieuwe schema-/rendererfuncties en behouden platformgaranties. Na de bestaande mergeprocedure activeert main de stagingpipeline; leg migrations, vier image-digests, health/revision en de relevante featurecohort vast. Test echte persistence en Playerweergave met een stagingtenant en testdevices.

Productiepromotie volgt de bestaande beschermde releaseprocedure met dezelfde geteste images en actuele autorisatie. Er is geen reden om domeinen, Caddy, secrets of Supabase naar Sites-hosting te verplaatsen. Rollback moet het vooruit gemigreerde schema en nieuwe thema-/documentversies blijven kunnen lezen. Geen downmigration of het wissen van Playercache/historische releases.

## 3. Optionele inhoudsoverdracht uit de Sites-browser

Dit betreft persoonlijke inhoud, afzonderlijk van de volledige broncode-/templateovername. In deze ZIP zijn geen gebruikersblobs of lokale ontwerpen geïnventariseerd.

Als de gebruiker die inhoud wil meenemen: implementeer een expliciete versieerbare export van lokale records plus alle daadwerkelijk gerefereerde IndexedDB-blobs. Maak een inventory met checksum/MIME/maten en ontbrekende refs. Importeer in een gekozen bevoegde tenant via de echte veilige uploadpipeline; maak een oude→nieuwe-ID-tabel, valideer relaties en schrijf concepten pas wanneer alle vereiste assets gereed zijn. Maak import idempotent/hervatbaar en toon fouten per record. Geen automatische publicatie en geen data naar andere tenants. Broncode- of templatepariteit vereist geen toegang tot persoonlijke browserstate.

## 4. Opleveringsbewijs

Per werkpakket: geïmplementeerde bestanden, contract-/migrationnamen, tests met resultaat, ref/nieuw/diff waar bron bestaat, stagingreadbacks en resterende externe beperkingen. Een verborgen control, mocksucces, geblokkeerde vereiste feature of alleen een werkende demo telt niet als afgeronde parity.

Een geslaagd eindresultaat heeft dezelfde prettige Sites-bediening en templates, terwijl gegevens, koppelingen, planning, publicatie en echte schermweergave via het bestaande VeyoCast-platform betrouwbaar blijven functioneren.
