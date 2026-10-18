# VeyoCast V1 — logica- en functiepariteitsmatrix

Versie 2.0 · 17 oktober 2026. Dit is het **uitvoeringsregister voor de rebuild**, geen bewering dat de rebuild al is gebouwd of alle echte integraties getest zijn. De nieuwe `V1-REBUILD-CANON.md` is leidend. Alle 148 scenario-ID’s uit de exacte Sites-referentie blijven aanwezig.

## Gebruik en bewijs

Codex vult per rij de huidige bronlocatie op de geïnventariseerde commit, de nieuwe locatie, de relevante API/schema-/devicecontracten, migratie, testcommit en bewijs in. Houd twee statussen bij: **implementatie** (`open`, `behouden`, `aangepast`, `gebouwd`, `geblokkeerd`) en **bewijs** (`niet getest`, `geslaagd`, `mislukt`, `geblokkeerd`, `afwijking expliciet geaccepteerd`). Een bestaande functie kan technisch behouden zijn maar nog onbewezen op de nieuwe build. Geen ontbrekende hardwaretest naar geslaagd omzetten omdat de build groen is.

De hieronder genoemde oude repositorypaden zijn vindplaatsen uit de oorspronkelijke repoanalyse op `20729be35d38dc8eb67b836160632ac7c3ea5153`. Ze zijn een startpunt voor de nieuwe inventaris, geen claim dat het pad op een later branch-head ongewijzigd is. Koppel waar beschikbaar de actuele GitHub-baseline uit het pakket. De oorspronkelijke PDF bevat de vastgezette R01–R24-verwijzingen.

## A. Te behouden of te herstellen domeincontracten

| ID | Domein en bestaande vindplaats | Te behouden/herstellen | Concrete acceptatie en bewijsniveau |
|---|---|---|---|
| L01 | Overzicht; `apps/control/lib/control-overview.ts`, `control-operations.ts`; R01/R02/R07 | Exacte actieve release-ID, gelijke web/native statusdefinities, geen stockbeeld als actueel beeld | Actieve release buiten de laatste 20 correct; stale telemetry onbekend; preview juist gelabeld. API + browser. |
| L02 | Bibliotheek; `apps/control/app/(shell)/dashboard/studio/`; R03 | Alle contenttypen, totalen, zoeken/typefilters, gebruik en archief | Media/Studio/menu/Sportlink in één zoekresultaat; telling en resultaat gelijk ook boven oude limieten. API + browser. |
| L03 | Media/werkers; bestaande upload-/processingcontracts | Toegestane formats, hervatbare uploads, ready/error/retry, thumbnails, hash en tenant | Onderbreek upload/worker, retry zonder duplicaat, gebruik verhindert onveilige delete. Server + opslag. |
| L04 | Studio; bestaande editor/projectrevisions; R03/R18 | Alle velden werken, opslaan/heropenen, conflicts, undo/redo waar bestaand, drafts | Tweede sessie opent dezelfde waarden; gelijktijdige edits geven herstelbaar conflict; output reageert op ieder veld. Server + browser. |
| L05 | Sportfamilies; `packages/contracts/src/dynamic-content.ts`; R13/R14 | Alle 17 authoringfamilies, echte scope, 2 thema’s × 2 oriëntaties | Beschikbaar/leeg/denied/stale per family; geen silent clubbrede fallback. Provider + renderer. |
| L06 | Sportlink worker/registry; `apps/media-worker/src/sportlink-sync-runner.ts`, `packages/integrations/src/sportlink-registry.ts`; R14 | Datasetrechten/fetchpad/normalisatie, last-good, bronhash | Trainingen/vrijwilligers/teamsponsors/periodestand eerst bewijzen; `SPORTLINK_DATASET_DISABLED` eerlijk tonen. Echte accounttest. |
| L07 | Thema’s; `packages/contracts/src/theme-engine.ts`, bestaande theme registry; R06/R08 | FieldFlow/OnzeTrots TV compleet; versies, overridevolgorde, compatibiliteit | Themawissel bewaart bron; plaatsing override raakt geen ander item; oude release verandert niet. Contract + browser/player. |
| L08 | Renderers; `packages/content-templates/src/sites-unified-v17-markup.tsx`, `sites-presentation-model.ts`, `sites-dynamic-projector.ts`; R18 | Alle rijen/pagina’s, werkende velden, juiste RSS-QR, neutrale tenantfallback | 13 jarigen/11 sponsors/8 vacatures/7 bezoekers/6 RSS-artikelen volledig; tweede tenant geen vreemde clubbranding. Browser + fysiek. |
| L09 | Playlist; `packages/contracts/src/playlist.ts`, bestaande playlist-command-plan; R05 | Gemengd, reeksen, kopie, volgorde, bulkduur/thema, secties, crop/fit/trim/audio/visibility, expliciete revisionupdate | Bewaren/heropenen/publiceren behoudt elk veld; dubbele plaatsingen hebben eigen ID/snapshot. API + volledige journey. |
| L10 | Publicatie; bestaande release/targetservices; `docs/s185-current-publication.md`; R17 | Immutable manifest/config, readiness, compatible targets, history/rollback | Conceptwijziging/prijs/theme muteren oude release niet; preflight voorkomt ongeldige kandidaat. Server + device. |
| L11 | Live brondata; bestaande snapshot/hashlogica; R17/R24 | Datarevisie onafhankelijk van playlistrelease/afspeeltimer | Gewijzigde bron ververst; gelijke respons geen nieuwe release of assetwrite. Contract + belastingmeting. |
| L12 | Playercache; `apps/player/app/_lib/player-cache.ts`; R17 | Download/verifieer naast actieve set, atomic activate, visible ack, last-good | Corrupte bytes, netwerkuitval of stale assignment verdringen actieve content niet. Device + servertrace. |
| L13 | Planning; bestaande scheduler/assignments; R09/R17 | Tijdzone, herhaling, groepen/individueel, prioriteit/overlap, expiry/default | DST/middernacht/offline overgang; gewone publicatie breekt tijdvak niet; juiste default terug. Contract + device. |
| L14 | Compositie; `packages/contracts/src/screen-composition.ts`, screen-composition-actions; R09 | Full/sidebar/bottom/three, per-zone bindings/fallback; planning hoofdzone; schermbrede overlays | Atomische zoneswitch en offline herstart; andere zones behouden; geluid alleen ondersteunde hoofdzone. Device. |
| L15 | Schermen/locaties; bestaande registry/groepen/venue-zones | Pairing, status/runtime/storage, plattegrond, stabiele fysieke IDs | Code eenmalig en tenantgebonden; groepen/locaties correct; contentzone ≠ fysieke zone. Server + browser. |
| L16 | Bedrijfstijden/commands; bestaande devicecontract | Week/datum/override/tijdzone, capabilitygate, TTL en ontvang/uitvoerstatus | Verlopen command niet uitvoeren; nachtvenster klopt; fysieke power alleen bewezen profiel. Contract + hardware. |
| L17 | Android Player; `apps/android-tv/`, NativeRecoveryIdentity; R16 | Package/signing/origin, normale + TV-launcher, remote/touch, recoverycookie/installation-ID/cache namespace | Gesigneerde update over oude installatie behoudt pairing/cache; reboot/offline/recovery; nieuw icoon zichtbaar. Fysiek Android/TV. |
| L18 | Native beheer; `apps/control-mobile/`, mobile API v1/v2; R07/R19 | Bestaande app-ID/updatepad, cockpit, uploadqueue/camera, Studio/playlists, biometrie/notificaties | Oude cliënt compatibel; update met nieuw icoon; echte OS-app-lock en uploadretry; tenantrechten gelijk aan web. Native + API. |
| L19 | LG; `apps/player/app/_lib/lg-legacy-page.ts`, LG/IPK-entry; R11/R15/R16 | ES5, native geometrie, fonts, Blob/cache/Range, visible-frame check, terminal video recovery | Exact model/firmware, media-code-4 herstel, goede volgende release, offline koude start, 24 uur mixed playback. Fysiek LG. |
| L20 | Twelve/producten; `packages/integrations/src/product-import.ts`, twelve-products actions; R22 | CSV/XLSX import preview/mapping/commit, stable external IDs, errors/decimalen | Slechte rijen/duplicaten/updates en categorieën afhandelen; import geen live-API claim. Echte exportbestanden + server. |
| L21 | Menu/prijs; menu-widget-document en snapshotservice; R22 | Expliciete prijsdiff/publicatie, lange namen/paging, oude prijsversie intact | Cataloguswijziging verandert oude TV-publicatie niet; expliciete update maakt kandidaat. Contract + device. |
| L22 | RSS; `packages/integrations/src/rss.ts`, rss-sync-runner; R24 | Multi-feed, selectie/limieten, sanitizing, foto/QR, freshness/last-good | Feedfout bewaart goede inhoud; alle artikelen spelen met eigen URL. Provider + browser/device. |
| L23 | LED Scores; `apps/media-worker/src/ledscores-connector-runner.ts`; R24 | Tenantflag, juiste team/match, dedup/TTL, pause/resume | Vers/dubbel/verlopen goal; geen dubbele overlay; resterende tijd hervat. Echte eventbron + device. |
| L24 | YouTube; integration actions, `youtube-playback-media.tsx`, `youtube-playlist.ts`; R23 | Video én playlists, officiële online playback, profielen/autoplay/fallback | Afspelen, netwerk/providerfout en herstel; geen zwarte vastloper of offline-downloadbelofte. Echte provider + device. |
| L25 | Sponsors; dashboard/sponsors/actions; R19 | Records/campagnes/creatives/goedkeuring/positie/gewicht/looptijd/publicatie/technical proof-of-play; huidige pipeline/taken | Hele lifecycle, juiste immutable planversie, technische events idempotent; geen bereikclaim. Server + device. |
| L26 | Engage; dashboard/engage/actions; R19 | Tenantflag, token, stemmen, periode/lifecycle/resultaatbeleid | Echt tweede apparaat stemt; duplicate/invalid/closed wordt server-side verwerkt. API + browser. |
| L27 | Rechten; `packages/auth/src/capabilities.ts`, `control-session.ts`; R12 | Tenant- en platformauth, RLS, MFA, custom capabilities, invites, audit | Directe API: Viewer mutatie geweigerd, tenant A/B isolatie, platformrechten expliciet. Negatieve servertests. |
| L28 | Support/platform; dashboard/support/actions, bestaande platformservices; R19 | Tickets/berichten/attachments/afdelingen, tenants/limieten/flags/templates | Bijlagerechten, routing, lifecycle en centrale templateversie werken; geaudit. Server + browser. |
| L29 | Billing; internal billing outbox, verify-mollie-payment, billing runbook; R20 | Customer/payment/mandate/recurring/webhook/readback/reconciliation; onafhankelijke flags | Testbetaling, dubbele/out-of-order events, mismatch, override/expiry, geen clientredirectbewijs. Provider testomgeving. |
| L30 | Marketing; apps/marketing, lead-actions; R21 | Exact publieke Sites UI, 9 routes, configurator/setup-intent, echte aanvraag | SSR/SEO/404/metadata en serveropslag/inbox/mailretry; geen lokale-demoformulier als echte ontvangst. Browser + server/mail. |
| L31 | Databasebelasting/retention; herstelkennis S210/S211; R10 | Bounded queue/telemetry/pruning, idempotentie, reference-safe retention | Dry-run beschermt actief/desired/planned/rollback/offline; bronstoring geen write-explosie. Server + monitoring. |
| L32 | Historische decoders/IDs; v11/v17 en actieve releases; R08/R17 | Oude gebruikte schema’s decodeerbaar; dataidentiteiten, één schrijver per domein | Migratiechecksum/referenties, bestaande player ontvangt oude release; geen nieuwe pairing als standaard. Migratie + device. |
| L33 | Deployment; actuele `.github/workflows/` + environments | Bestaande workflows/triggers/secrets/vars/runners/environmentnamen blijven | Inventaris vóór/na gelijk waar behouden; normale developmentdeploy en rollback op concrete SHA. GitHub + server. |
| L34 | Cleanup; exacte developmentpaden en relevante branches | Alleen overtollige code/builds weg; compacte archiefmap; operationele data/config/signing beschermd | Manifest pad/reden/verplaatste waarde/resultaat; geen dangling imports/routes/services; geen branch/historydelete. Diff + serverinventaris. |
| L35 | Visuele pariteit; vastgezette Sites-bron/assets | Exact UI/UX/fonts/hero/logo/motion/resp gedrag, alleen Sync | Vergelijkingsscreenshots alle hoofdroutes/states/viewports, thema’s en 16:9/9:16; assethashes. Browser + artifact. |
| L36 | Regressebewijs en release | Bestaande SQL/RLS/browser/player/incidenttests blijven bruikbaar | Geen tests weggooien enkel wegens nieuwe UI; complete journeys, testcommit en open gates gerapporteerd. CI + rapport. |

Alle rijen L01–L36 starten voor deze nieuwe rebuild met implementatie `open` en bewijs `niet getest`. Prototypebewijs staat uitsluitend in het meegeleverde gedateerde testverslag; dat kan als beperkte voorafgaande evidentie worden gekoppeld, nooit als vervanging van een echte server-/deviceproef.

## B. Volledige 148-scenarioverankering

Onderstaande ID’s en acceptatie-eisen zijn rechtstreeks uit `reference/sites-sync/src/coverage.json` van de huidige Sites-referentie genomen. De bijbehorende gebruikersjourneys J01–J24, bewijsniveaus en visuele acceptatie staan in `reference/sites-sync/docs/ACCEPTATIE.md`. Voor ieder scenario moeten implementatiepad, servicecontract en testbewijs worden ingevuld in het uitvoeringsregister. `execution/scenario-acceptatie.csv` is daarvoor het startbestand; alle statusvelden staan bewust open. De geciteerde criteria hieronder beschrijven het oorspronkelijke prototype. Behoud ieder ID en toets de echte service-/hardwareacceptatie uit sectie A en de canon. Mock- of demosucces sluit een productierij niet.


### Ervaring en toegang

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `experience.parity` | Eén definitieve Sync-werkplek | Alle V1-routes zijn vanuit één vaste navigatie bereikbaar. De andere vier ontwerprichtingen zijn vervallen. |
| `experience.mock_state` | Werkend prototype met bewaarde demo-invoer | Opslaan, wijzigen en publiceren veranderen gedeelde mockdata en blijven na navigeren/herladen bestaan; reset herstelt de demo. |
| `experience.auth` | Inloggen en sessie | Demo-login opent een rolgebonden sessie; uitloggen en opnieuw inloggen zijn klikbaar zonder echte credentials. |
| `experience.tenant` | Organisatie en platformcontext wisselen | Tenantwissel verandert data en branding; platform is een afzonderlijke context zonder vermenging van clubnavigatie. |
| `experience.permissions` | Rollen en MFA zichtbaar doorlopen | Kies owner/editor/viewer/support; verboden acties zijn geblokkeerd en toegelicht; gevoelige acties tonen een gesimuleerde MFA-stap. |
| `experience.states` | Volledige laad-, leeg-, fout- en successtates | Belangrijke lijsten/forms demonstreren loading/empty/error/permission/success met werkende herstelactie en behouden invoer. |

### Overzicht

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `overview.attention` | Aandacht en herstelacties | Klik op bron-, upload- of schermprobleem voor oorzaak/gevolg; passende actie verandert de status en audit. |
| `overview.screens` | Wat speelt waar | Scherm toont juiste bevestigde playlistpreview, gewenste versie, laatste contact en bronversheid; oude actieve release blijft vindbaar. |
| `overview.status` | Bereikbaar, gesynchroniseerd en zichtbaar apart | Online/offline/onbekend, downloadstatus en actief bevestigd zijn afzonderlijk; een online maar vastgelopen scherm is reproduceerbaar. |
| `overview.today` | Vandaag gepland en snelle acties | Open komende/plande items en start content/upload/pairing/publicatie vanuit het overzicht. |
| `overview.preview` | Eerlijke inhoudspreview | Klikbare preview gebruikt bevestigde publicatie en tijdstip; geen stockfoto of claim van een live screenshot. |

### Content en media

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `content.library` | Eén zoekbare bibliotheek | Media, vrije ontwerpen, menu, alle dynamische families en reeksen delen zoeken/filteren; telling en resultaatverzameling kloppen. |
| `content.upload` | Beeld- en videoupload | Selecteer lokaal bestand of demo-upload; toon queue, thumbnail, formaat, voortgang en klaarstatus. |
| `content.upload_recovery` | Upload pauzeren, hervatten en herstellen | Simuleer onderbreking/fout; hervatten of retry werkt zonder dubbel media-item. |
| `content.processing` | Verwerking en opnieuw verwerken | Toon pending/verwerken/gereed/mislukt met oorzaak; retry verwerkt hetzelfde item tot gereed. |
| `content.inspector` | Metadata en gebruiksimpact | Inspector bewerkt titel en toont type, maten, duur, gebruikte playlists en betrokken schermen. |
| `content.archive` | Archiveren, herstellen en veilig verwijderen | Impactdialoog noemt verwijzingen; actief gebruikte media kan niet onveilig definitief weg, archiveren/herstellen verandert de lijst. |

### Studio

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `studio.create` | Vrij ontwerp of template maken | Templatekeuze of leeg canvas creëert een bewerkbaar ontwerp met titel, inhoudstype en bronbinding. |
| `studio.content` | Tekst, beeld en clubbranding bewerken | Tekst/beelden/logo kiezen verandert canvas direct en is na bewaren/heropenen gelijk. |
| `studio.design` | Zichtbare ontwerpinstellingen werken | Accent, tekstschaal, uitlijning, veilige marge, achtergrond en ondersteunde motion veranderen de preview; onondersteunde opties ontbreken. |
| `studio.orientation` | 16:9 en 9:16 | Wissel landscape/portrait; canvas schaalt proportioneel zonder afgesneden inhoud. |
| `studio.series` | Reeksen samenstellen | Slides toevoegen, herordenen, dupliceren en verwijderen; reeks kan als selectie aan playlist worden toegevoegd. |
| `studio.revisions` | Bewaren, heropenen en revisieconflict | Autosave/opslaan, ongedaan/opnieuw waar ondersteund, heropenen en conflict met tweede editor zijn betekenisvol gesimuleerd. |
| `studio.output` | Preview en uitvoer gereedmaken | Preview speelt alle pagina’s; render/genereren toont voortgang, fout/herstel en gereed resultaat in bibliotheek. |
| `studio.version` | Ontwerpversies en gebruik | Nieuwe versie laat gepubliceerde plaatsingen intact; gebruiker bekijkt wijzigingen en kiest waar die worden bijgewerkt. |

### Playlists

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `playlist.crud` | Playlists maken, bewerken, dupliceren en archiveren | Maak/zoek/open/dupliceer/hernoem een playlist; lege en gebruikte playlist hebben correcte acties en impact. |
| `playlist.add` | Gemengde inhoud toevoegen | Media, Studio/reeks, Sportlink/menu/RSS, YouTube en Engage zijn selecteerbaar en worden echte playlistitems. |
| `playlist.order` | Volgorde en secties | Drag of verplaatsknoppen, secties, kopiëren en verwijderen wijzigen de loop en overleven heropenen. |
| `playlist.duration` | Duur en bulkduur | Wijzig losse of geselecteerde duren; totaaltijd past mee en video-/pagingminima worden uitgelegd. |
| `playlist.presentation` | Crop, fit en veilige presentatie | Iteminstellingen tonen crop/focus, vullen/passend en achtergrond; wijziging raakt alleen deze plaatsing. |
| `playlist.av` | Trim, geluid en zichtbaarheid | Video start/einde, mute/volume en itemzichtbaarheid werken in preview; apparaatbeperkingen zijn duidelijk. |
| `playlist.theme` | Thema per plaatsing, playlist en bulk | Themaselectie verandert geselecteerde plaatsingen; gedeelde bronontwerpen en andere playlists veranderen niet ongemerkt. |
| `playlist.preview` | Volledige afspeelpreview | Play/pause/next/back en paginateller doorlopen exact de volgorde, inhoud, duur en thema’s; terug naar item bewerken. |

### Publiceren

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `publish.preflight` | Gereedheid en apparaatcompatibiliteit | Checklist toont ontbrekende media/brondata/themaprofiel/opslag; blokkade kan worden opgelost en opnieuw gecontroleerd. |
| `publish.target` | Doelen en moment kiezen | Selecteer schermen/groepen en nu/later; samenvatting noemt playlist, versie, targets en planningimpact. |
| `publish.progress` | Publicatie en bevestiging per scherm | Doorloop concept/gecontroleerd/gepubliceerd/ophalen/verifiëren/wachten/actief; schermen kunnen afzonderlijk achterlopen. |
| `publish.history` | Historie en verschillen | Open immutable versiehistorie vanuit playlist/scherm en vergelijk inhoud of instellingen met huidige versie. |
| `publish.restore` | Herstellen en opnieuw toewijzen | Herstel oude versie naar nieuw concept of wijs publicatie opnieuw toe; bestaande historische versie blijft intact. |
| `publish.safe_failure` | Fout of onvolledige kandidaat | Download-, verificatie- of stale-targetfout houdt actieve publicatie zichtbaar; retry herstelt zonder cache/pairingverlies. |

### Planning

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `planning.calendar` | Agenda en planning beheren | Dag/weekkalender met filters; afspraak maken/openen/verplaatsen/bewerken/uitschakelen/verwijderen verandert de planning. |
| `planning.repeat` | Eenmalig, dagelijks, wekelijks of aangepaste herhaling | Begin/einde, dagen en tijdvensters zijn bewerkbaar; preview toont concrete komende uitvoeringen. |
| `planning.targets` | Scherm, groep of alle schermen | Doelkeuze werkt en overzicht noemt alle betrokken schermen en playlist. |
| `planning.conflict` | Prioriteit en overlap oplossen | Overlappende regels tonen winnaar, oorzaak en alternatieven; expliciete oplossing wordt bewaard. |
| `planning.timezone` | Tijdzone, overrides en defaultterugval | Tenanttijdzone en DST-demo zijn zichtbaar; tijdelijke override loopt af; hoofdzone keert terug naar standaard terwijl zij-/onderzone behouden blijven. |

### Schermen en apparaten

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `screens.inventory` | Schermlijst en detail | Zoek/filter op platform, locatie/groep en status; detail toont active/desired, opslag, runtime en gebeurtenissen. |
| `screens.pair` | Scherm koppelen met code/QR | Nieuwe Player toont code; beheer claimt deze en koppelt tenant/scherm; ongeldige of verlopen code is herstelbaar. |
| `screens.lifecycle` | Naam, locatie en device-lifecycle | Hernoemen, deactiveren, logisch verwijderen en opnieuw koppelen hebben impactdialoog en correcte status. |
| `screens.groups` | Schermgroepen beheren | Groep maken/hernoemen en lidmaatschap wijzigen werkt door in publicatiedoelen en planning. |
| `screens.remote` | Begrensde herstelopdrachten | Force-sync, herladen en pairingherstel tonen verstuurd/ontvangen/uitgevoerd of verlopen; normale sync behoudt identiteit/cache. |
| `screens.diagnostics` | Diagnostics en supportinformatie | Toon foutoorzaak, eventtijd, platformprofiel en hersteladvies; supportbundel/downloadactie geeft bruikbaar demoresultaat. |
| `screens.hardware` | Apparaatprofielen en beperkingen | Web/PWA, Android/TV en specifiek LG-profiel tonen ondersteunde media/motion/power/audio en nog te bevestigen hardwarebewijs. |

### Bedrijfstijden en schermindeling

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `automation.week` | Weekvensters en tijdzone | Bewerk open-/speeltijden per dag met juiste tenanttijdzone; actieve toestand en volgende overgang veranderen. |
| `automation.exceptions` | Datumuitzonderingen | Voeg gesloten dag of afwijkend openvenster toe; planningvoorvertoning laat effect zien. |
| `automation.override` | Tijdelijk aan/uit en expiry | Override bevat eindtijd; commandostatus en automatische terugval zijn zichtbaar. |
| `automation.power` | Power, sleep, wake en autostart | Alleen ondersteund apparaatprofiel biedt deze opties; LG/Android/web tonen eerlijke verschillen en gesimuleerde bevestiging. |
| `composition.layout` | Vier vaste indelingen | Full/sidebar/bottom/three met landscape/portrait en begrensde percentages zijn zichtbaar te configureren. |
| `composition.binding` | Playlist per contentzone | Hoofd-/zij-/onderzone kiezen elk playlist en fallback; geluid alleen hoofdzone; LED/sponsor schermbreed. |
| `composition.publish` | Compositie publiceren en offline herstarten | Preview toont alle zones; nieuwe compositie activeert pas compleet; simuleer ontbrekende zone zonder huidige output te verliezen. |
| `venues.map` | Locaties, plattegrond en fysieke zones | Locatie/plattegrond/zone maken of kiezen en scherm plaatsen; onderscheid fysieke zones en contentzones helder. |
| `venues.inspect` | Scherm op locatie openen | Klik schermpin voor detail/status, verplaats pin en bewaar positie. |

### Bronnen algemeen

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `sources.catalog` | Bronnenoverzicht en koppelen | Sportlink, Twelve-import, RSS, LED Scores en YouTube hebben eigen detail/configuratie zonder dubbele contentbibliotheek. |
| `sources.health` | Sync, versheid en herstel | Laatste poging/succes, nieuwe data, lege feed, ontbrekend recht en fout zijn apart; testverbinding/sync/retry wijzigt mockstatus. |
| `sources.binding` | Bronbinding gescheiden van stijl | Datasets/teams/poule/feed/producten veranderen inhoud; themawissel behoudt binding en selectie. |
| `sources.live` | Live data los van publicatie | Nieuwe mockdata verschijnt in bestaande gepubliceerde selectie; identieke sync creëert geen extra release; fout behoudt laatste geldige data. |

### Sportlink

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `sportlink.connection` | Clientkoppeling en rechten | Maak of bewerk gesimuleerde verbinding; toon datasets/toegang/versheid en simuleer ontbrekend recht zonder echte credentials. |
| `sportlink.selection` | Teams, seizoen, competitie, poule en clubscope | Selectie bepaalt voorbeelddata; eigen club en poulebreed zijn onderscheidbaar, ongeldige context verbreedt niet stilzwijgend. |
| `sportlink.batch` | Bulk team × type wizard | Kies meerdere teams/families, zie aantallen en previews; opslaan maakt alle geselecteerde ontwerpen als bewerkbare reeks. |
| `sportlink.availability` | Eerlijke beschikbaarheid per familie | Alle 17 families zijn zichtbaar; mockdata, providerpad-onbevestigd en handmatige fallback zijn gelabeld, vooral training/vrijwilligers/sponsors/periodestand. |

### Sportlink-families

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `sport_program` | Programma | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; club/poule, datum/tijd, teamlogo’s en wedstrijdinformatie; lege/foutstate en volledige paging. |
| `sport_results` | Uitslagen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; uitslagen, eigen team/poule, score en datum; lege/foutstate en volledige paging. |
| `sport_standing` | Stand | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; ranglijst, punten, gespeelde wedstrijden en eigen team; lege/foutstate en volledige paging. |
| `sport_period_standing` | Periodestand | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; gekozen periode/poule en ranglijst; bronbeschikbaarheid expliciet; lege/foutstate en volledige paging. |
| `sport_match_of_the_day` | Wedstrijd van de dag | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; gekozen wedstrijd, teams, tijd, locatie en sponsorcontext; lege/foutstate en volledige paging. |
| `sport_next_match` | Volgende wedstrijd | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; team en eerstvolgende wedstrijd met datum/tijd/tegenstander; lege/foutstate en volledige paging. |
| `sport_cancellations` | Afgelastingen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; afgelaste wedstrijden en betekenisvolle lege toestand; lege/foutstate en volledige paging. |
| `sport_dressing_rooms` | Kleedkamers | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; thuis/uit, kleedkamernummers, veld en wedstrijdtijd; lege/foutstate en volledige paging. |
| `sport_officials` | Officials | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; wedstrijd, officials en beschikbare wedstrijdinformatie; lege/foutstate en volledige paging. |
| `sport_team` | Teaminformatie | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; teamidentiteit, teamleden/metadata voor zover beschikbaar; lege/foutstate en volledige paging. |
| `sport_sponsor` | Sponsors | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; team-/clubpartners met logo en gegevens; bronstatus zichtbaar; lege/foutstate en volledige paging. |
| `sport_activities` | Clubactiviteiten | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; agenda, datum/tijd, titel en locatie; lege/foutstate en volledige paging. |
| `sport_trainings` | Trainingen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; teams, trainingsmomenten en veld; eventuele handmatige bron gelabeld; lege/foutstate en volledige paging. |
| `sport_volunteers` | Vrijwilligers | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; rollen/oproepen, contactinformatie indien bedoeld, bronstatus; lege/foutstate en volledige paging. |
| `sport_birthdays` | Verjaardagen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; datum en namen, leeftijd alleen indien toegestaan/beschikbaar; lege/foutstate en volledige paging. |
| `sport_visitor_arrivals` | Bezoekende teams | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; bezoeker, ontvangstvenster, wedstrijd, veld en kleedkamer; lege/foutstate en volledige paging. |
| `sport_referee_arrivals` | Scheidsrechters ontvangen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; scheidsrechter, wedstrijd en aankomstvenster; lege/foutstate en volledige paging. |

### Twelve en menu

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `products.import` | Excel/CSV-import | Upload of laad voorbeeldbestand; preview toont kolommen en herkende productrijen; geen live Twelve-API claim. |
| `products.mapping` | Kolommapping, productidentiteit en fouten | Map naam/id/categorie/prijs; foutregels kunnen worden gecorrigeerd/overgeslagen; importupdate dupliceert dezelfde product-ID niet. |
| `products.catalog` | Handmatige catalogus en categorieën | Maak/bewerk product en categorie met prijs/beschikbaarheid; zoeken/filteren en heropenen werken. |
| `menu.editor` | Menu/prijslijst samenstellen | Selecteer categorieën/producten/beeld, orden en stel kolommen/titel in; lange namen blijven leesbaar in beide oriëntaties. |
| `menu.price_update` | Prijzen bewust bijwerken | Nieuwe catalogusprijs verandert TV niet direct; actie Prijzen bijwerken toont impact/diff en maakt nieuw te publiceren concept. |
| `menu.paging` | Alle menu-items tonen | Meerdere pagina’s, prijsnotatie, categorieën en lege producten zijn correct; preview doorloopt hele selectie. |

### RSS

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `rss.feeds` | Meerdere nieuwsfeeds | Feed toevoegen/bewerken/testen; selectie en artikellimiet worden bewaard. |
| `rss.rotation` | Nieuws met foto en artikel-QR | Preview doorloopt ten minste zes artikelen met juiste titel/intro/foto/index; QR verwijst naar actief artikel of ontbreekt zonder URL. |
| `rss.recovery` | Leeg, verouderd en fout | Simuleer leegte of storing; laatste succes en bewaarde laatste geldige inhoud blijven duidelijk. |

### LED Scores

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `led.connection` | Live scorekoppeling en tenantvrijgave | Flag toont niet-geactiveerd of geactiveerd; verbinding/eigen team/doelgroepen instellen met verse of stale mockevents. |
| `led.design` | Scorebord en goalintro ontwerpen | Eigen/tegenstander-variant, huisstijl en schermtargets bewerken; preview laat gekozen content zien. |
| `led.event` | Doelpunt, ontdubbelen en hervatten | Trigger demo-goal; overlay onderbreekt tijdelijk en hervat resterende itemtijd; dubbel of verlopen event speelt niet opnieuw. |

### YouTube

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `youtube.sources` | Video en playlist toevoegen | Geldige videolink of playlist selecteren/bewaren; bron kan aan gewone playlist toegevoegd. |
| `youtube.playback` | Officiële online playback | Preview toont online-/autoplaybeperkingen en gebruikt toegestane weergave; prototype claimt geen gedownloade offlinevideo. |
| `youtube.fallback` | Lokale fallback bij offline/fout | Kies beeld/video-fallback; simuleer provider-/netwerkfout en terugkeer zonder zwart scherm. |

### Thema’s

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `themes.catalog` | FieldFlow en OnzeTrots TV | Afzonderlijke themakaarten met varianten, versie, ondersteunde families/formaten en preview. |
| `themes.brand` | Clubinstellingen en veilige defaults | Kleurrollen, fonts, logo, achtergrond/decoratie en toegestane motion zijn bewerkbaar; tweede tenant zonder logo heeft neutrale fallback. |
| `themes.precedence` | Voorrang per toepassing | Plaatsing > playlist > ontwerp > tenant > platform is te inspecteren; reset naar geërfde waarde verandert preview correct. |
| `themes.version` | Versies en compatibiliteit | Thema-update verandert actieve publicatie niet automatisch; inkompatibele familie/formaat/Playercombinatie wordt vóór publiceren uitgelegd. |
| `themes.registry` | Nieuw goedgekeurd themapakket | Platform kan een demo-pakket registreren/publiceren met ID/versie/profielen; het verschijnt in bestaande editors, zonder vrije scripts of marketplace. |

### Sponsors

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `sponsors.records` | Sponsors en toegelaten media | Sponsorrecord maken/bewerken en media toelaten; creatives komen uit ready tenantmedia. |
| `sponsors.campaign` | Campagne met looptijd en gewicht | Maak/bewerk campagne, periode, gewicht en oriëntatie; opslaan werkt door in overzicht. |
| `sponsors.positions` | Creatives en semantische posities | Koppel creative aan fullscreen/hoek/footer/wedstrijdsponsor/balsponsor/presented-by; preview toont plaatsing. |
| `sponsors.approval` | Indienen, goedkeuren en publiceren | Rolgebonden review voert draft→submitted→approved→published uit; publicatie maakt vaste planversie. |
| `sponsors.proof` | Rotatie en technische afspeelregistratie | Preview roteert eligible sponsors; demo-device-event toont campagne/versie/duur zonder publieksbereikclaim. |
| `sponsors.crm` | Pipeline en taken bekijken | Bestaande kans-/takenweergave filteren/openen; label dit als beperkt overzicht, geen volledig CRM dat stil als huidige functie wordt toegevoegd. |

### Engage

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `engage.campaign` | Poll of man/vrouw van de wedstrijd | Maak/bewerk titel, vraag, 2–24 opties, periode en resultaatbeleid; tenantflag en rol bepalen beschikbaarheid. |
| `engage.lifecycle` | Concept, gepland, live, gesloten en archief | Start/plan/sluit/archiveer; sluiting verhindert nieuwe stemmen en bewaart resultaten. |
| `engage.vote` | Publieke QR-stemervaring | Open demo-QR/link, stem geldig en test herhaalde/ongeldige stem; feedback werkt en telling wordt bijgewerkt. |
| `engage.results` | Resultaatbeleid en schermweergave | Live/na stem/na sluiten respecteren gekozen moment; QR-oproep/resultaat kan in content/playlist worden gebruikt. |

### Team en support

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `team.members` | Team en uitnodigingen | Nodig demo-gebruiker uit, herzend/intrek en wijzig rol/verwijder lid met impact. |
| `team.roles` | Standaardrollen en eigen rollen | Capabilitymatrix is bewerkbaar voor custom role; editor/viewer/publiceerrechten leveren zichtbaar verschillende bediening. |
| `team.audit` | Activiteit en audit | Filter acties en open detail met actor, object, tijd en resultaat; demoacties vullen audit. |
| `support.tickets` | Tickets en onderwerp | Maak ticket met onderwerp/prioriteit, tenantcontext en bevoegde bestemming; lijst/detail/status veranderen. |
| `support.messages` | Berichten en bijlagen | Antwoord toevoegen, bijlage selecteren, status sluiten/heropenen; onbevoegde rol ziet geen gevoelige inhoud. |
| `support.routing` | Afdelingen, supportrollen en toewijzing | Platform beheert afdeling/rol/toewijzing; nieuw ticket bereikt juiste mockwerkvoorraad. |

### Billing

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `billing.account` | Abonnement en billingaccount | Juridische naam/factuurmail bewaren; schermgebruik, trial, facturen en betaalstatus bekijken zonder vast tarief als live waarheid te claimen. |
| `billing.flags` | Afzonderlijke rolloutflags | Engine, recurring collection, entitlement enforcement, warning en restriction zijn afzonderlijk te demonstreren; extern bewijs vereist vóór echte activering. |
| `billing.test_payment` | Testbetaling en mandate | Doorloop gesimuleerde klant→first payment→providerreadback→geldig mandate; annuleer/fail/success geven correcte terugkeer. |
| `billing.cycle` | Recurring, webhook en reconciliation | Simuleer cyclus/verified webhook, mismatch of chargeback; factuur-/betaalstatus en reconciliationlijst veranderen gecontroleerd. |
| `billing.entitlement` | Grace, waarschuwing, restrictie en override | Demo toont trial/grace/restricted/verification en tijdelijk platformoverride; niet-actieve flags beperken Player niet. |

### Platform

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `platform.tenants` | Organisaties provisionen en lifecycle | Tenant aanmaken/inviteren, pauzeren/heractiveren/archiveren en schermlimiet instellen met reden. |
| `platform.users` | Platformgebruikers en rollen | Owner/admin/support/viewer beheren met eigen capabilities; tenantbeheer blijft aparte context. |
| `platform.features` | Featurevrijgave per tenant | Engage/LED/billing en demo-registryvrijgave veranderen alleen gekozen tenant; audit en status zichtbaar. |
| `platform.templates` | Centrale templates en versies | Template maken/bewerken, versie aanmaken/publiceren/intrekken; bestaande publicatie blijft leesbaar. |
| `platform.health` | Systeem en beheerherstel | Bron/worker/schermproblemen en open reconciliation tonen; drilldown, retry en supportactie geven afgebakend resultaat. |

### Mobiel beheer

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `mobile.cockpit` | Mobiele dagelijkse cockpit | Zelfde betekenis/data als web; bottomnav en sequential task flow werken op telefoonbreedte. |
| `mobile.authoring` | Camera, upload, Studio en publiceren | Mobiele flow kan afbeelding kiezen, toevoegen, bewerken, bewaren en publiceren; gesloten paneel verliest invoer niet. |
| `mobile.security` | Biometrie en notificatievoorkeuren | Toon expliciete simulatie van app-lock en voorkeuren; organisatie-/sessiewissel, unlock en categorie-instellingen werken in mockstate. |

### Marketing

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `marketing.site` | Publieke productpagina’s en login | Klikbare marketingnavigatie met product, gebruik, demo/contact en doorstap naar beheer. |
| `marketing.configurator` | Opstelling samenstellen | Kies organisatie, schermen/locaties en bronnen; vervolgaanvraag behoudt deze setup-intent. |
| `marketing.lead` | Contact- en demoaanvraag | Valideer formulier; lokale demo-opslag toont aanvraag plus bevestiging of herstelbare fout; maak duidelijk dat geen echte mail wordt verzonden. |

### Player-demo

| ID | Scenario | Oorspronkelijk prototypecriterium |
|---|---|---|
| `player.boot` | Boot en splash | Open web/Android/LG-demo; merk-splash→initialiseren→opslagcontrole toont voortgang zonder fictieve certificering. |
| `player.unpaired` | Niet gekoppeld en pairingcode | Niet gekoppelde Player toont QR/code, vervaldatum, vernieuwen en contact; koppelen vanuit beheer verandert deze Player. |
| `player.waiting` | Gekoppeld, wacht op inhoud | Zonder release toont rustige wachtstate; nieuwe publicatie start automatisch ophalen terwijl heartbeat online blijft. |
| `player.download` | Downloaden en verifiëren | Voortgang per kandidaat met bytes/items; corrupte/ontbrekende media blokkeert activatie en biedt retry. |
| `player.activate` | Veilige overgang en zichtbaar bevestigd | Gevalideerde kandidaat wacht op item-/loopgrens; zichtbare activatie verandert bevestigde versie op dashboard. |
| `player.play` | Afspeelbediening en schermcontent | Volledige preview met 16:9/9:16, zones, paginering, audio-profiel en sponsor/goaloverlay; diagnose staat apart van gewone playback. |
| `player.offline` | Offline met laatste goede inhoud | Netwerk uit laat huidige content doorlopen; offline herstart kiest lokale goede release en toont compacte status. |
| `player.no_cache` | Offline zonder bruikbare cache | Aparte herstelbare splash legt wachten op netwerk uit; probeer opnieuw of herstel verbinding, zonder succesvolle playback te veinzen. |
| `player.recovery` | Video-, cache- en transportherstel | Simuleer terminale video versus download/corruptie; bounded retry/skip/LKG-herstel kan nieuwe gezonde release activeren. |
| `player.identity` | Herstart/update/herinstallatie en recovery | Demoflow bewaart identiteit waar bestaand contract dit ondersteunt; force-sync wist pairing/cache niet, expliciet ontkoppelen vraagt impact. |
| `player.billing_splash` | Grace-, restricted- en verificatiesplash | Beschikbare entitlementflags laten juiste waarschuwing/wacht-/restrictiestate zien; herstelbetaling/override keert terug naar bewaarde content. |

## C. Resultaatregistratie en afsluitregel

Leg per echte proef vast: scenario/domein-ID, testcommit/build, omgeving, datum, gebruiker/rol/tenant of device/model/firmware, bronaccount/dataset waar nodig, precondities, stappen, verwacht/werkelijk resultaat en bewijsreferentie. Sla geen secretwaarden, signingkeys of ongefilterde klantdata op in het openbare rapport.

Een aparte geldige acceptatie van één concrete afwijking verandert niet de rest van de scope. Niet-beschikbare providerrechten of hardware zijn een concrete blokkade met vervolgstap. De volledige V1 is geen groene verzameling prototypevinkjes: code, gebruikershandeling, echte contracten en toepasselijke fysieke/providerproeven moeten samen kloppen.
