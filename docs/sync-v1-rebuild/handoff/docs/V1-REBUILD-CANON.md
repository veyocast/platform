# VeyoCast V1 Rebuild — bindende canon

Versie 2.0 · 17 oktober 2026 · definitieve richting: **prototype 1 / Sync**.

Deze canon verenigt de volledige V1-scope met de nieuwe afspraken van de opdrachtgever. De opdracht is een grondige herbouw met exact de huidige Sites-interface en merkassets, met behoud van de werkende domeinlogica, data-identiteiten, playerprotocollen, bestaande Android-installaties en deploymentvoorzieningen. V1 is de volledige beschreven productomvang; er wordt geen verkleind MVP voor in de plaats gezet.

## 1. Beslisvolgorde en brongezag

1. De nieuwste expliciete afspraken van de opdrachtgever, vastgelegd in `OPDRACHTCANON.md`, gaan voor op oudere instructies.
2. Deze **V1-REBUILD-CANON.md** is het leidende product- en uitvoeringscontract; de logica-pariteitsmatrix concretiseert het bewijs.
3. De vastgelegde actuele Sites-bron, assets en gedeployde Sync-ervaring bepalen exact het uiterlijk en de interactiepatronen. Gebruik de provenance en SHA256-manifesten in het pakket om de referentie vast te zetten.
4. Werkende VeyoCast-code en aantoonbare bestaande contracten bepalen het te behouden backend-, apparaat-, data-, update- en deploygedrag. Corrigeer bewezen fouten; kopieer geen fout alleen omdat die oud is.
5. De oorspronkelijke repoanalyse, de Sync-canon, de 148 scenario’s, het acceptatiecontract en de SEO-specificatie blijven gelden voor zover ze niet door deze canon zijn aangescherpt.
6. Het prototype is een visuele en interactieve referentie. Demodata, localStorage-rechten, vaste MFA-/pairingcodes en gesimuleerde betalingen of devicebevestigingen zijn geen productie-implementatie.

Behandel visuele en technische bronnen niet als concurrerende totaalontwerpen. Port exact de gekozen UI naar de werkende architectuur en sluit die aan op echte contracten. Bij een concreet conflict registreert Codex de betrokken bron, consequentie en gekozen oplossing. Een noodzakelijke technische correctie mag geen ongemerkte visuele herinterpretatie worden.

## 2. De zes vaste uitvoeringsafspraken

| Onderwerp | Bindende afspraak |
|---|---|
| UI/UX en afbeeldingen | Neem de actuele Sync-UI/UX en alle relevante Sites-afbeeldingen exact over. Geen nieuw ontwerp, afwijkende componentenset, gewijzigde merkbeelden of alternatief dashboard. |
| Bouwomgeving | Bouw en integreer op de bestaande **developmentserver**. Inventariseer de feitelijke host, checkout, processen, paden en toegangsroute; verzin geen hostnaam of serverpad. Stel de bestaande developmentvoorziening vast; gebruik voor staging de bestaande GitHub-deployworkflow. |
| Oude serverbestanden | Alle oude VeyoCast-/Castivo-mappen en bestanden op de developmentserver die voor de herbouw niet meer nodig zijn, mogen worden verwijderd. Stel eerst vast welke daarin aanwezige logica, configuratie of operationele gegevens behouden of verplaatst moeten worden. Deze cleanup is al geautoriseerd; vraag geen herhaalde toestemming voor vastgestelde overtollige bestanden. |
| GitHub opruimen | Verwijder overbodige bestanden uit de relevante bestaande branches. Maak een compacte archiefmap met noodzakelijke historische kennis, contracten, beslissingen en een verwijzing naar de oude commit. Bewaar geen volledige dubbele verouderde applicatie in die map. |
| Deployvoorzieningen | Bestaande deploymentworkflows, GitHub environments, secret- en variabelenamen/waarden, runnercontracten en operationele koppelingen blijven behouden. Maak geen nieuwe parallelle deployketen om de oude heen. |
| Bestaande werking en apps | Behoud de werkende VeyoCast-logica. Lever updates voor de bestaande Android-apps, inclusief het VeyoCast-appicoon. Package-identiteit, signing, updatekanaal en bestaande installaties blijven intact. |

De toestemming voor broncode- en developmentbestandscleanup is geen opdracht om productiegegevens, gebruikers, tenants, media, releases, signingmateriaal, secrets, Git-historie of branches te wissen. Een oude directorynaam maakt de inhoud niet automatisch overbodig. Splits eerst actieve gegevens/configuratie van vervangbare code en gegenereerde bestanden.

## 3. Wat exact overnemen betekent

De referentie omvat de private Sync-werkplek, de publieke marketingwebsite, mobiele beheerweergaven, alle playerstart-/koppel-/wacht-/fout-/offline-/activatiestates en beide schermoriëntaties. Alleen Sync blijft als werkplek bestaan. Signal, Canvas, Control en Flow vervallen. **FieldFlow en OnzeTrots TV blijven beide bestaan als contentthema**, los van de verwijderde werkplekontwerpen.

- Neem componentstructuur, navigatie, spacing, afmetingen, typografie, kleuren, borders, schaduwen, iconen, statuschips, formulieren, panelen, modals, motion en responsive gedrag uit de huidige bron over.
- Gebruik de originele `brand-hero.png` en de geleverde 480/800/1254-WebP-afleidingen voor zowel publieke marketing als playerstart. Behoud het complete merkbeeld, de verhoudingen en veilige marges. Laat het woordmerk zichtbaar.
- Gebruik `brand-icon.svg`, `full-dark.svg`, `full-light.svg` en het meegeleverde merkpakket. Geen nagemaakt tekstlogo. Gebruik lokale fonts inclusief de bijbehorende licenties.
- Werkende echte data vervangt demo-inhoud via adapters en contracts. Demovarianten zijn geen reden om de interface te versimpelen of onderdelen te schrappen.
- Vergelijk de port met dezelfde referentiestaat, inhoud, viewport, browser, fontload en motioninstelling. Verschillen door inhoud worden apart benoemd; de componentgeometrie mag daardoor niet stil worden herontworpen.
- Stel referenties vast voor 360, 390, 768, 1024, 1440 en 1920 pixels breed, plus playeroutput op 1920×1080 en 1080×1920. Bewijs met screenshots en waar bruikbaar overlays; leg ieder bewust verschil vast.
- Geen afgesneden merkbeeld, onbedoelde horizontale paginascroll, overlappende acties, onleesbare portrait-output of onbereikbare mobiele hoofdactie. Toetsenbord, focus, labels en reduced motion blijven bruikbaar.

De code mag voor de bestaande stack worden georganiseerd; de geleverde React/Vite-referentie verplicht niet tot vervanging van de bestaande Next.js-architectuur. Een frameworkmigratie is geen doel van deze opdracht.

Demo-, omgeving- en statusclaims zijn de gerichte uitzondering op letterlijke tekstovername: vervang uitsluitend aantoonbaar onjuist geworden prototypecopy (zoals “geen live dienst”, “voorbeeldaanvraag” of “alleen lokaal opgeslagen”) door feitelijk correcte productiecopy zodra de echte dienst werkt. Behoud layout, typografie, informatierangorde en interactie; dit staat geen algemene herschrijving of redesign toe.

## 4. Scope en productstructuur

Primaire taken blijven **Overzicht, Content, Playlists, Planning en Schermen**. Studio opent vanuit Content. Beheer bevat bronnen, producten, thema’s, sponsors, Engage, team, support, billing en relevante instellingen. Platformbeheer heeft een expliciete aparte context. Marketing is publiek; werkplek, previews, interne overdracht, support en devicebeheer zijn afgeschermd en niet indexeerbaar.

De volledige scope omvat:

1. Overzicht met aandachtspunten, confirmed/desired-publicaties, bereikbaarheid, planning, bronhealth en doorklik naar de oorzaak.
2. Eén contentbibliotheek; mediaupload, processing, retry, archiveren/herstellen, gebruik en impact.
3. Studio voor vrij ontwerp, templates, alle sportfamilies, reeksen, beide thema’s en oriëntaties; bewerkbare bronbinding en zichtbare rendering van iedere instelling.
4. Playlists met volgorde, secties, bulkduur, individuele plaatsingen, crop/fit/focus, trim, audio, zichtbaarheid, thema’s, preview, preflight, publicatie en historie.
5. Planning met tijdzone, herhaling, uitzonderingen, groep-/schermtargets, conflictregels, override, eindtijd en herstel van defaults.
6. Schermen met koppeling, groepen, locaties/plattegrond, bedrijfsuren, vier indelingen, runtime/capabilities, diagnostiek en herstelcommando’s.
7. Volledige playerreis op moderne web-, bestaande Android- en LG-profielen, inclusief offline herstart en veilige activatie.
8. Sportlink, Twelve-exportimport, producten, RSS, LED en YouTube met eerlijke beschikbaarheid en last-good gedrag.
9. Sponsors, campagnes, goedkeuring, gewogen planning en technische afspeelregistratie; bestaande beperkte sponsor-pipeline/taken blijven, zonder een nieuw volledig CRM te introduceren.
10. Engage voor polls/speler van de wedstrijd, QR, lifecycle en resultaatbeleid.
11. Team, eigen rollen/capabilities, uitnodigingen, audit, supporttickets, berichten en bijlagen.
12. Platformbeheer voor tenants, rollen, limieten, flags, templateversies, gezondheid en reconciliation.
13. Bestaande billingketen en gecontroleerde verdere implementatie achter onafhankelijke rolloutflags.
14. Bestaande native mobiele beheerapp(s), responsief webbeheer, camera/upload, notificatievoorkeuren en OS-app-lock waar ondersteund.
15. Volledige publieke Nederlandse marketingwebsite met SEO, aanvragen en echte verbinding met de beheerinbox.

Alle 148 scenario-ID’s uit de referentie blijven in de pariteitsmatrix en acceptatie bestaan. Een featuregate maakt een ongebouwd onderdeel niet automatisch voltooid; registreer implementatie en vrijgave afzonderlijk.

## 5. Identiteiten, rechten en datacontracten

Bewaar stabiele tenant-, gebruiker-, device-, content-, media-, playlist-, plaatsing-, release-, theme-, product- en providerreferenties. Migreer gecontroleerd; geen lege database als startpunt om oude contracten te vermijden. Een schemawijziging heeft mapping, verificatie en herstelpad. Bestaande publicaties blijven leesbaar zolang ze nog actief, gewenst, gepland, voor rollback of offline herstel nodig zijn.

Serverautorisatie gebruikt de geverifieerde sessie/devicecredential en tenantcontext. Een clientveld `tenantId` is geen autorisatie. Tenantrol en platformrol zijn afzonderlijk. Voer ook rechtstreekse API- en cross-tenanttests uit. Providersecrets en signingmateriaal komen niet in frontendbundels, archiefdocumenten of het handoverpakket.

Ontwerp-/playlist-/prijs-/configmutaties ondersteunen revisions of ETags en herstelbare conflicten. Herhaalbare opdrachten zijn idempotent. Asynchrone jobs hebben een ID, voortgang en apart resultaat. Fouten onderscheiden leeg, denied, stale, fout en onbekend; geen gesimuleerde succesfallback in echte productieflows. Audit bevat actor, tenant, object, actie, tijd, request-ID en relevante revision, zonder secrets.

## 6. Content en de 17 sportfamilies

Iedere toepasselijke familie heeft bronselectie, rendering, 16:9/9:16, opslaan/heropenen, lange-lijstpaging, empty/error/denied/stale states en playlistplaatsing. Maak geen universele Sportlink-API-claim: bewijs providerpad, accountrecht, selectie en veldbeschikbaarheid per dataset. Ontbrekende automatische data kan een herkenbaar gelabelde handmatige bron krijgen.

| Nr. | Familie | Te behouden inhoud/controle |
|---|---|---|
| 1 | Programma | Club/team/poule, seizoen, periode, tijd, teams, logo’s, veld; selectie begrenst werkelijk de data. |
| 2 | Uitslagen | Correcte gespeelde wedstrijden, datum en uitslag binnen dezelfde scope. |
| 3 | Stand | Competitie/poule/seizoen, ranking, gespeeld, punten en eigen-teamaccent. |
| 4 | Periodestand | Werkelijke periode en providerbeschikbaarheid; anders gelabelde handmatige invoer. |
| 5 | Wedstrijd van de dag | Expliciete wedstrijd, tegenstander, tijd, locatie en sponsorcontext. |
| 6 | Volgende wedstrijd | Eerstvolgende geldige wedstrijd binnen geselecteerde team-/tijdcontext. |
| 7 | Afgelastingen | Echte status; geen bekende afgelasting is een geldige lege toestand. |
| 8 | Kleedkamers | Wedstrijd, thuis/uit, toewijzing, veld en tijd; ontbrekende waarde herkenbaar. |
| 9 | Officials | Beschikbare rollen/personen bij de juiste wedstrijd. |
| 10 | Teaminformatie | Teamidentiteit en alleen toegestane en beschikbare persoonsgegevens. |
| 11 | Sponsors | Team-/clubsponsors met bronverantwoording, beeld en toepasselijke koppeling. |
| 12 | Clubactiviteiten | Titel, tijd, datum, locatie en juiste bronselectie. |
| 13 | Trainingen | Team, moment en veld; automatische route/accountrecht eerst bewijzen. |
| 14 | Vrijwilligers | Rol/oproep en bedoelde gegevens; geen fictieve providerbeschikbaarheid. |
| 15 | Verjaardagen | Toegestane naam/datum; leeftijd alleen indien beschikbaar en toegestaan. |
| 16 | Bezoekende teams | Ontvangstvenster, tegenstander, wedstrijd, veld en kleedkamer. |
| 17 | Scheidsrechters ontvangen | Naam indien beschikbaar, wedstrijd en aankomstcontext. |

Club/team/pouleprogramma en -uitslagen, opstelling, welkom, scoreboard en goal blijven bruikbare varianten. Verder blijven vrij ontwerp, media, clubverhaal, menu, RSS, agenda, sponsors, YouTube en Engage aanwezig. De bulkwizard combineert teams en families, toont aantallen en ontbrekende rechten en bewaart geldige resultaten bewerkbaar. Een ongeldige teamscope mag nooit stil terugvallen op alle clubdata.

Lange tabellen, menu’s en nieuwsreeksen tonen alle pagina’s tijdens echte playback. RSS gebruikt per huidig artikel de juiste QR-URL. Geen QR zonder bruikbare bestemming. Editorpreview, opgeslagen ontwerp en playerinhoud komen inhoudelijk overeen; een instelling die niets aan de output verandert is niet af.

## 7. Thema’s, plaatsingen en prijzen

FieldFlow en OnzeTrots TV zijn geversioneerde, goedgekeurde themapakketten voor beide oriëntaties en alle toepasselijke families. Themawissel behoudt semantische inhoud en bronbinding. Voorrang: **plaatsing → playlist → ontwerp → tenant → platformfallback**. Maak geërfde waarden en overrides zichtbaar.

Plaatsingen hebben een eigen ID en snapshot van contentrevision, duur, trim, fit/focus, audio, zichtbaarheid en thema. Een plaatsing bewerken verandert het bronontwerp of een andere playlist niet. Nieuwe themapakketten veranderen actieve releases niet automatisch. Behoud thema-/schema-compatibiliteit in de renderprofielen; geen willekeurige tenant-JavaScript.

Cataloguswijzigingen muteren geen gepubliceerde TV-prijzen. `Prijzen bijwerken` toont diff en impact, maakt een bevroren prijsversie en publiceert expliciet nieuwe kandidaten. De bestaande actieve versie blijft tot bevestigde activatie intact. Twelve blijft eerst **CSV/XLSX-exportimport** met preview, mapping, foutregels, decimale conversie, stabiele externe IDs en expliciete commit.

## 8. Publicatie, playback en cache

De vaste keten is **concept → preflight → immutable release → targettoewijzing → downloaden → verifiëren → veilige overgang → zichtbaar actief bevestigd**.

1. Preflight valideert ready media, bronbinding, hashes, oriëntatie, schema, theme-/runtimeprofiel, targetconflicten en opslag; iedere fout krijgt een concrete herstelactie.
2. Release/manifest en bijbehorende content-, prijs- en themesnapshots zijn onveranderlijk. Rollback verwijst naar een bestaande geldige release of maakt bewust een nieuw concept; historie blijft bestaan.
3. `desired`, download-/verificatiestatus en `active/confirmed` blijven afzonderlijk. Een heartbeat bewijst bereikbaarheid en niet zichtbare playback. Alleen servertoewijzing maakt een scherm niet groen actief.
4. Download kandidaatbestanden naast de actieve set. Controleer volledigheid, hashes, schema en runtime. Een incomplete/corrupte kandidaat vervangt nooit de laatst goede release.
5. Activeer atomisch op een veilige item-/loopgrens; bevestig nadat de runtime de nieuwe uitvoer daadwerkelijk heeft gestart. Composities activeren de vereiste zones samen.
6. Offline met cache speelt de laatst goede set, ook bij koude herstart. Offline zonder cache toont een expliciete herstelbare staat. Gewone force-sync/reload wist geen identity, pairing of last-good cache.
7. Transport-, asset-, bron- en decoderfouten hebben eigen begrensde herstelpaden. Een mediafout mag geen zwarte of vastgelopen eindeloze itemtimer veroorzaken.
8. Dynamische brondata krijgt eigen snapshotrevision/hash. Ongewijzigde data veroorzaakt geen onnodige writes, downloads of playlistreleases. Presentatie-/plaatsing-/themawijzigingen volgen de expliciete releaseketen.
9. Retention maakt een dry-run met referenties en aantallen; actieve/gewenste/geplande/rollback/offline gebruikte releases en assets blijven behouden. Behoud benodigde oude decoders, waaronder in de repoanalyse genoemde schema’s v11/v17 zolang daarvan referenties bestaan.
10. Telemetry en jobs blijven begrensd: deduplicatie, batching/backoff en bewaartermijnen waar nodig. Herintroduceer geen onbeperkte polling- of writebelasting.

## 9. Planning, zones en schermbeheer

Planning gebruikt de tenanttijdzone, begin/eindtijden, herhaling, uitzonderingen, prioriteit en concrete targets. Leg overlapwinnaar en reden uit. Test Europe/Amsterdam, zomertijd, middernacht en kalendergrenzen. Bij afloop herstelt de hoofdzone de juiste standaard; zij-/onderzones blijven staan tenzij de regel ze uitdrukkelijk wijzigt.

Vier contentindelingen blijven: fullscreen, zijzone, onderzone en drie zones. Gebruik geldige landscape-/portraitproporties, per-zone playlist/fallback en gesynchroniseerde activatie. Audio is alleen voor de hoofdzone en alleen bij een ondersteund profiel. Het bestaande gedempte LG-videoprofiel mag niet ongemerkt geluid gaan produceren. LED-/sponsoroverlays hebben een expliciet schermbreed contract.

Fysieke locaties/plattegrondzones zijn andere objecten dan contentzones. Bewaar stabiele locatie-, groep-, pin- en schermIDs. Bedrijfstijden ondersteunen weekpatroon, datumuitzonderingen en overrides. Slaap/wake/power/autostart worden alleen aangeboden als de specifieke runtime dat aantoonbaar ondersteunt.

Pairingcodes zijn tijdelijk, eenmalig claimbaar, tenantgebonden en rate-limited. Commands hebben opdracht-ID, TTL en verstuurd/ontvangen/uitgevoerd/mislukt/verlopen. Herstel maakt het verschil tussen refresh/sync/restart en expliciet unlink duidelijk. Een serverstatus zonder devicebevestiging geldt niet als uitgevoerd.

## 10. Bronnen en aanvullende V1-logica

| Module | Vast contract |
|---|---|
| Sportlink | Adapter per werkelijk beschikbare dataset, club/team/seizoen/poule en accountrecht. LastAttempt, lastSuccess, dataTimestamp en last-good zijn afzonderlijk. Clubprofiel, teams, wedstrijden/details, activiteiten, toegestane verjaardagen en standen worden op werkelijke providerpaden gemapt; overige datasets eerst bewijzen. |
| RSS | Veilige serveringest, sanitizing, meerdere feeds/filter, afbeeldingenfallback, dedup, freshness en last-good. Alle artikelen en hun eigen QR blijven bereikbaar. |
| LED | Tenantflag, juiste match/teamtarget, event-ID/tijd/TTL. Dubbele/verlopen events overslaan. Na tijdelijke onderbreking de resterende itemtijd correct hervatten. |
| YouTube | Officiële online weergave binnen runtime-/autoplayvoorwaarden; lokale toegestane fallback. Geen offline YouTube-downloadclaim. |
| Sponsors | Tenantmedia, looptijd, gewicht, orientatie en semantische positie. Draft/submitted/approved/published en immutable planversie. Technical proof of play is geen bewijs van publieksbereik. |
| Engage | Poll/speler-van-de-wedstrijd, 2–24 opties, concept/gepland/live/gesloten/archief, public token/QR. Server handhaaft tenant, lifecycle, rate limiting, dedup en resultaatbeleid. |
| Team en support | Standaard/eigen capabilities, uitnodigen/herzenden/intrekken, audit; tickets met routing, verantwoordelijkheid, prioriteit, berichten, veilige bijlagen en sluiten/heropenen. |
| Platform | Gescheiden context, tenantstatus/limieten, platformrollen, flags, centrale templates, provider/workerhealth en reconciliatie. |
| Billing | Bestaande Mollie-/providerketen, klanten, payments, mandates, recurring, webhookverificatie en reconciliation behouden. Engine, incasso, entitlement enforcement, warning en restriction zijn onafhankelijke flags. First payment vereist providerreadback en geldig mandate. Redirect/clientstatus geeft geen betalingsbewijs. Overrides hebben reden en expiry. |
| Native beheer | Bestaande API v1/v2-compatibiliteit, cockpit, camera/upload, playlists/Studio, notificatievoorkeuren en biometrie/app-lock waar aanwezig behouden. Geen browserknop laten doorgaan voor OS-biometrie. |

Nieuwe incasso-/restrictieflows worden niet door deze opdracht automatisch live gezet. Ze worden volledig gebouwd/getest achter de bestaande onafhankelijke flags; de huidige operationele instelling blijft behouden totdat geldige vrijgave plaatsvindt.

## 11. Android-updates, appicoon en LG

Inventariseer iedere bestaande Android-app/flavour en releasevariant, waaronder de Kotlin/WebView-player met gewone en TV-launcher en de native beheerapp waar aanwezig. Leg package/application ID, launcher activities, versionCode/versionName, signingcertificaatfingerprint, kanaal, API-base/origin, deep links, lokale opslag en recoverycontract vast. Geen geheime sleutelwaarden in de rapportage.

Lever **een update van de bestaande apps**, met oplopende versiecode binnen het bestaande updatekanaal. Geen nieuwe package-ID om een schone installatie af te dwingen. Behoud signing, device-identiteit, pairing, relevante tokens en laatst goede cache volgens het bestaande migratie-/updatecontract. Verifieer het herstelcontract apart voor update, herstart en herinstallatie; claim niet dat een herinstallatie gegarandeerd dezelfde lokale gegevens bewaart zonder bewijs.

Neem het nieuwe VeyoCast-appicoon uit de exact geleverde merkassets mee. Gebruik het beeldmerk als basis voor benodigde density-/adaptive-/round-icon resources; laat launcher- en Android TV-resourceverwijzingen correct wijzen. Behoud de icongeometrie en kleuren; pas uitsluitend platformmarges, masker en technische export aan. Hergebruik de bestaande Screen Sync-hero voor de playerintro. Controleer het resultaat op de bestaande telefoon/tablet/TV-launchers en in het installatie-/updatescherm.

De LG-adapter blijft afzonderlijk. ES5-/oude webOS-compatibiliteit, native dimensies, media-/cache/Range-gedrag en decoderherstel krijgen eigen tests. Vermijd moderne syntax of essentiële CSS zoals onondersteunde `inset`/`aspect-ratio` in een oude runtime zonder compatibele implementatie. De in de repoanalyse genoemde LG 43UL3J-EP, webOS Signage 6.0 en firmware 03.24.90 zijn een historische testreferentie; inventariseer het werkelijk gebruikte model en firmware opnieuw.

## 12. Publieke marketing en SEO

Neem de actuele publieke Sites-vormgeving, tekstenstructuur en assets exact over en implementeer de negen bestaande inhoudelijke routes: `/`, `/narrowcasting/`, `/functies/`, `/koppelingen/`, `/players/`, `/demo/` en de drie oplossingen voor sportverenigingen, horeca en bedrijven. De huidige SEO-specificatie blijft het uitvoeringscontract.

Publieke HTML bevat zonder client-JavaScript betekenisvolle unieke inhoud, titel, description, één H1, canonical en passende structured data. Behoud toegankelijke echte links, altteksten, lokale fonts, responsive hero, robots/sitemap, social metadata, juiste statuscodes en echte 404. Gebruik het definitieve domein consequent; private routes en overdrachtbestanden zijn niet publiek indexeerbaar. Geen verzonnen testimonials, offers, providerrechten, scores of rankings.

Vervang de lokale demoaanvraag door servervalidatie, duurzame aanvraagopslag, idempotentie, echte beheerinbox en mail/notificatieretry. Bewaar setup-intent. Een ontvangen aanvraag is geen geboekte afspraak. Productiecontact-/privacygegevens moeten echt zijn; placeholders of lokale demomeldingen zijn geen voltooide aanvraagketen. Houd publieke bundels vrij van interne tenant-/devicegegevens.

## 13. Cleanup, archief en bestaande deployflow

Codex maakt vóór cleanup een concrete inventaris: branch/commit, gevolgd bestand of serverpad, huidig gebruik, noodzakelijke extractie/migratie, eindactie en verificatie. Controleer processen, serviceunits, containers/volumes, symlinks en workflowverwijzingen waar van toepassing. Voer alleen acties uit op exact opgeloste paden binnen de developmentscope.

Zet benodigde actieve configuratie, signingmateriaal en operationele gegevens veilig buiten verwijderbare codepaden, met dezelfde rechten en via bestaande secretvoorzieningen. De archiefmap bevat bijvoorbeeld oude architectuurbeslissingen, schema-/manifestcontracten, relevante incidentlessen, migratie-/cleanupmanifest en oude commitverwijzing. Verouderde buildoutput, dubbele dependencies, dode bronbestanden en vervallen UI-varianten worden verwijderd, niet allemaal opnieuw gearchiveerd.

Git-historie/een passend baselinereferentiepunt vormt het codeherstelpad. Ruim bestanden in de relevante branches op via normale commits en bestaande PR/mergeflow. Geen branchverwijdering, forcepush of herschrijven van geschiedenis als afgeleide van deze opdracht. Vermijd het terughalen van verwijderde code bij latere merges door de branchstrategie en resterende afwijkingen te registreren.

Behoud deployworkflows en hun triggers, environmentnamen, secret-/variabelereferenties, runnerlabels, concurrency/permissions, artifactcontracten, serverdoelen en rollbackfunctie. Pas paden alleen waar technisch noodzakelijk consequent aan, met bewijs dat dezelfde deploysemantiek blijft werken. Secretwaarden worden niet geëxporteerd of opnieuw aangemaakt. Verifieer namen en aanwezigheid met bestaande toegangsrechten; noteer een ontoegankelijke metadata-inventaris eerlijk.

De developmentserver is de bouwomgeving. Bestaande staging/development-omgevingsnamen blijven wat zij zijn; hernoem geen GitHub environment omdat dit document developmentserver zegt. Behoud een gescheiden productie-uitrol. De gebruiker vraagt in deze conversatie om een overdrachtspakket; het genereren van dit pakket voert zelf geen servercleanup of repositorymutatie uit.

## 14. Verplichte herstelproeven uit de oorspronkelijke repoanalyse

De oorspronkelijke repoanalyse is vastgezet op `20729be35d38dc8eb67b836160632ac7c3ea5153`. De bevindingen hieronder blijven expliciete regressieproeven, ook wanneer nieuwere code ze al heeft opgelost. Het zijn historische codebevindingen; zij zeggen niet dat dezelfde fout nog live optreedt.

| Proef | Vereiste uitkomst |
|---|---|
| Actieve release buiten de laatste 20 | Het dashboard zoekt exacte actieve IDs op en toont ook een oude nog actieve release correct; een recente-historiequery beperkt dit niet. |
| Betekenis van schermpreview | Toon een preview van de bevestigde publicatie met juiste leeftijd; geen stockfoto als actuele inhoud en geen claim van live screenshot zonder echte opname. |
| Bibliotheek versus telling | Media, Studio, menu en dynamische inhoud staan in dezelfde zoekbare verzameling. Typefilters en totalen corresponderen met de resultaten, ook boven oude ophaallimieten. |
| Web versus native cockpit | Beide gebruiken dezelfde definities voor online, onbekend, gereed, desired en confirmed; een conceptplaylist is niet automatisch publicatiegereed. |
| Ontwerpinstellingen | Accent, tekstschaal, uitlijning, marge, achtergrond en overige zichtbare velden werken in preview én echte output. |
| Lange inhoud | Minstens 13 verjaardagen, 11 sponsors, 8 vacatures en 7 bezoekers komen allemaal langs; itemduur en paginaverloop kloppen. |
| RSS en QR | Minstens zes artikelen roteren met eigen titel, beeld, intro, index en artikel-URL. Geen algemene QR in plaats van het actieve artikel. |
| Tenantbranding | Een tweede tenant zonder logo krijgt een neutrale fallback; geen Duindorp-/OnzeTrots-clubidentiteit als generieke fallback. Themaversiering en clubidentiteit blijven gescheiden. |
| Gewone publicatie tijdens planning | Een nieuwe publicatie schakelt een lopend tijdvak niet ongemerkt uit; groep/individueel/conflict/expiry blijven deterministisch. |
| LG terminale mediafout | Een video-code-4/decoderfout blokkeert geen geldige geverifieerde volgende release op een verdwenen itemtimer; gezonde video en goal-overlay houden hun bedoelde overgang. |
| Fysiek zichtbaar frame | Controle van bruikbare afmetingen en werkelijk zichtbare inhoud vóór activatiebevestiging; alleen heartbeat of twee animation frames is onvoldoende. |
| Belasting en bronwijziging | Identieke bronrespons en heartbeats maken geen onnodige nieuwe inhoudsversies/assetwrites. Een echte bronupdate bewaart playlistvolgorde en afspeeltimer. |
| YouTube video én playlist | Beide bestaande paden blijven bereikbaar en werken binnen de officiële online voorwaarden, met een lokale fallback. |
| Native uploadqueue | Camera- en bestanduploads behouden queue, retry en herstel volgens de bestaande app; geen verlies bij tijdelijke netwerkfout. |

Tijdens migratie is er één gezaghebbend schrijfsysteem per gegevensdomein. Port nieuwe UI via adapters naar dezelfde canonieke services; voeg geen langdurige ongedefinieerde dubbele writes toe. Eén logische contentbibliotheek verplicht niet tot één enorme tabel. Gespecialiseerde opslag mag blijven zolang identiteit, zoeken, publiceerbaarheid en gebruik als één duidelijke taak werken.

## 15. Acceptatie en definitie van voltooid

Codex levert een concrete werkende developmentversie via de vastgestelde bestaande devvoorziening en stagingrelease via de bestaande GitHub-workflow, met commit/build-ID, wijzigingen, migratie-/cleanupmanifest, appupdate-artifacts, visuele vergelijking, testresultaten en rollbackinstructie. Rapporteer implementatie, testbewijs en vrijgave apart.

| Niveau | Vereist bewijs |
|---|---|
| Bron en build | Vastgezette referentie, assethashes, lockfiles, typecheck/bouw, geen ontbrekende modules. |
| Exacte UI | Vergelijkingen van de afgesproken routes, viewports, states, beide thema’s en playeroriëntaties; ieder verschil verklaard. |
| Domein en server | Alle 148 scenario’s gemapt, echte services, negatieve autorisatie/cross-tenanttests, revisions/idempotentie, migratie- en immutable-publicatietests. |
| Deployment | Bestaande workflow uitgevoerd; gedeployde SHA/version gecontroleerd; environments/secrets/vars behouden; cleanupmanifest klopt met resterende referenties. |
| Android | Upgrade over de bestaande gesigneerde installatie, juiste iconen/launchers, pairing/identiteit/cache behouden, offline start en recovery bewezen. |
| LG en playback | Fysieke model/firmwaretest, video, zones, netwerkverlies, kandidaatfout, offline koude start, veilige activatie en minstens 24 uur duurproef op representatieve apparaten. |
| Providers en communicatie | Werkelijke datasetrechten, importbestanden, RSS/LED/YouTube, productieaanvraag/inbox/mail en testbetaalketen op passende testomgeving. |
| Oplevering | Release notes, bekende blokkades, expliciet open bewijs, beheer-/configuratieoverzicht zonder secrets en getest rollbackpad. |

De bestaande prototypechecks bewijzen bouwbaarheid, component-/DOM-gedrag en statische marketingoutput. Ze bewijzen geen visuele browserpariteit, fysieke Android/LG-werking, 24-uursstabiliteit, servertenantisolatie, echte providerrechten, betalingen of mailbezorging. Die ontbrekende bewijsniveaus blijven open totdat Codex ze daadwerkelijk uitvoert.

Noem V1 pas volledig afgerond wanneer de scope geïmplementeerd en de relevante acceptatie bewezen is, of wanneer de eigenaar een concrete afwijking uitdrukkelijk heeft geaccepteerd. Werk zelfstandig door aan reeds geautoriseerde ontwikkeling en cleanup; een toegangs- of hardwareblokkade wordt concreet gerapporteerd en vervangt het resterende werk niet door een algemene claim dat alles af is.
