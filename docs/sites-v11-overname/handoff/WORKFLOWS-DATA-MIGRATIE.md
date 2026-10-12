# Workflows en gegevensmigratie — exacte Sites-interface op de echte VeyoCast-kern

## Onderzoeksbasis en betekenis

- Visuele/interactionele bron: Sites `b1cae899af19fc39908217253094c5240d7359fc`, checkout `/workspace/sites/veyocast-ui`.
- Bestaande platformcode: GitHub `veyocast/platform`, SHA `6fcc26f02c8050b7244e3660a93b85f02491e121`, checkout `/workspace/scratch/f424464986e6/veyocast-transfer/platform-github`.
- Dit document vergelijkt broncode. Het bewijst niet welke SHA op de huidige VPS of een fysieke Player draait. Geen productiegegevens, credentials, build of mutaties onderzocht/uitgevoerd.
- Paden met prefix `S:` verwijzen naar de Sites-bron; `G:` naar GitHub. Regels zijn bij deze vaste commits vastgelegd. De bijbehorende CSV is een uitvoerbare werkverdeling, geen bewering dat adapters al bestaan.

De exacte Sites-interface is het beoogde nieuwe zichtbare resultaat. Het bestaande platform levert een aanzienlijk rijkere, beveiligde operationele kern. Neem dus componenten, CSS, assets, templates en interacties uit Sites over en vervang hun demodata-opslag door echte applicatieadapters. Kopieer niet het gehele Sites-runtime als productieapp: dan verdwijnen onder meer concurrency, tenantisolatie, mediaverwerking, live data en betrouwbare publicatie.

## 1. Wat de huidige Sites-workflows daadwerkelijk doen

### Playlist en mobiele mediakiezer

`S:app/prototype/content.tsx:17–20` definieert vereenvoudigde `Media`, `Slide`, `Playlist` en `Publication`. Een playlist bevat rechtstreeks een `slides[]`-array. Slides bevatten optioneel een complete kopie van `DynamicDesign` of `StudioSlide` naast een bron-ID. `S:app/prototype/playlist-media-picker.tsx:35–58` maakt deze kopieën met JSON deep-clones; een Studio-project wordt als hele reeks losse slides ingevoegd.

De te behouden bediening zit in `playlist-library.tsx`, `playlist-editor.tsx`, `playlist-media-picker.tsx` en hun CSS-modules:

- overzicht als kaarten/lijst, zoeken, filters, selectie en bulkacties;
- sequentiële mobiele editor met lijst/voorbeeld en aparte inhoudkeuze;
- zoeken op naam, tags en collecties, map en favorieten;
- drie broncategorieën: Media, Studio en dynamische ontwerpen;
- selecteren over filters/categorieën heen, selectievolgorde, selectieoverzicht en één vaste toevoegknop;
- meerdere afbeeldingen uploaden, foutmelding per bestand, geslaagde uploads blijven bewaard;
- omhoog/omlaag verplaatsen, dupliceren, verwijderen en direct herstellen;
- duur per item, snelle 10/15/20s-keuzes en bulkduur;
- thema per item/selectie/hele playlist;
- wijzigingswaarschuwing en Android-teruggedrag.

Bewijs: `S:playlist-editor.tsx:70–86,103–131,181–235,248–261,333–342`; `S:playlist-media-picker.tsx:62–149,151–214`; alle genoemde paden onder `app/prototype/`. De editor beschermt onopgeslagen gegevens met `beforeunload` en een eigen history-entry, maar dit is aangepast aan de Sites-hashrouter. Port de gebruikerservaring naar Next-route-/dialognavigatie; kopieer `pushState`/`history.back()` niet blind, anders kan de nieuwe App Router terugnavigatie onderscheppen of dupliceren.

### Opslag, media en snapshots

`S:app/prototype/shared.tsx:10–13` bewaart complete objecten in `localStorage` onder `veyocast-demo-*`. `storage`- en `veyocast-state`-events synchroniseren hooguit tabs binnen dezelfde browser/origin. Dit is geen tenantdatabase, realtime samenwerkingslaag of online/offline synchronisatieprotocol.

`S:app/prototype/media-assets.tsx:8–18` bewaart afbeeldingen in IndexedDB `veyocast-assets`, objectstore `images`, met `asset:image-*` als referentie. Uploads worden client-side naar WebP omgezet (langste zijde maximaal 1920px, kwaliteit0,85); JPEG/PNG/WebP/AVIF tot20MB worden geaccepteerd. Deze blobs zijn niet aanwezig in een broncode-ZIP en niet overdraagbaar door alleen JSON of git te kopiëren. Repo-assets in `public/` wel.

Voor productie zijn browserblobs alleen lokale uploadvoorbeelden/cache. De definitieve referentie wordt een tenantgebonden `mediaAssetId`/variant en checksum. Tijdelijke object-URL's of signed URLs mogen geen database-identiteit worden. Bestaande browserontwerpen alleen met een expliciete importactie migreren: JSON plus bijbehorende blobs lezen, bestanden eerst via de echte pipeline uploaden, IDs remappen, valideren en pas daarna concepten opslaan. Nooit automatisch demo- of browserdata naar iedere tenant seeden.

### Publicatie

`S:app/prototype/content.tsx:138–150` maakt bij iedere klik een nieuwe demoversie, kopieert slides en zet lokale schermen op actief. `playlist-storage.ts:1–20` schrijft drie browserkeys met best-effort rollback. `content.tsx:165` herstelt oude content door opnieuw lokale objecten aan te maken. Dit is nuttige demobediening maar geen echte release, servertransactie of bewijs dat content zichtbaar is.

## 2. Bestaande productiekern die behouden en hergebruikt moet worden

### Playlists en concurrency

`G:apps/control/app/(shell)/dashboard/playlists/data.ts:229–248` laadt playlist, items, secties, releases, schermen, devices, ready dynamic slides, verified YouTube-bronnen en Engage-campagnes. Items bevatten al presentatiegegevens die Sites niet kent: sectie, fit, muted, titel, transition, cropfocus, achtergrond, volume, trim, zichtbaarheid, enabled, accessibility name en dynamic-slide/snapshot-ID.

Herbruikbare acties in `G:.../playlists/actions.ts`:

- create40, duplicate62, archive83/501, delete100, details125;
- media toevoegen133; dynamic snapshot139 (`add_dynamic_slide_to_playlist_v2`);
- YouTube195; Engage229;
- item bewerken259; defaults308; secties352–418;
- dupliceren434, vervangen446, verplaatsen459, verwijderen495;
- publicatie509; centrale capabilities640–647 en revision-validatie649–652.

De server en database blijven eigenaar van IDs, actuele revision en rechten. `mutate_playlist_draft_v2` gebruikt expected revision, idempotency key, tenantcontrole, actieve-tenantguard en transactionele row-lock. Bewijs: `G:supabase/migrations/20260725170000_publisher_guarded_commands.sql:867–967`. Niet een volledige vereenvoudigde Sites-`Playlist` over een rijk productierecord heen schrijven. Bouw een volledige typed viewmodel/projectie en verlies geen bestaande velden wanneer de gebruiker alleen een titel of duur aanpast.

De huidige single-item acties ondersteunen de nieuwe gemengde selectie/bulkduur/bulkthema/hele Studio-reeks niet als één bewezen atomische opdracht. Voeg daarvoor begrensde batchcommands toe of maak opeenvolgende opdrachten aantoonbaar veilig en hervatbaar met actuele revisions. Voor de één-klik Sites-UX heeft één atomische opdracht de voorkeur: `{playlistId, expectedRevision, idempotencyKey, operations[]}`, servervalidatie van alle items, óf alles toegepast óf niets. Dit is een voorgesteld nieuw contract, geen reeds bestaande RPC. Atomiciteit mag niet worden gesimuleerd met `Promise.all` op concurrerende revision-mutaties.

Undo/redo werkt op nog niet opgeslagen conceptwijzigingen. Na een bevestigde servermutatie is herstellen een nieuwe beveiligde mutatie op de laatste revision. Een oude release wordt nooit in-place aangepast. Sites heeft specifiek direct herstel van verwijderen, geen bewijs van volledige servergebaseerde undo/redo voor alle playlistoperaties.

### Mediabibliotheek en uploads

De productie heeft al paginering, status, type, gebruik, mappen, tags, collecties, favorieten en opgeslagen views. Bron: `G:.../media/page.tsx:970–1035`, RPC `list_publisher_media_assets_v2` of archived variant. Preview-URL's worden voor600s ondertekend (`.../media/page.tsx:1125`; playlistvariant `.../playlists/data.ts:332`). Neem het zoek/filter/kaartontwerp van Sites over, koppel dit aan de begrensde serverquery; laad niet alle tenantmedia in één clientarray.

Afbeeldingen: `G:apps/control/app/api/media/images/route.ts:19–153` controleert origin, sessie, actieve tenant, `tenant.media.write`, omvang en daadwerkelijke verwerking. De response bevat echte asset-ID en verwerkingsinformatie. `lib/media/validated-image-upload.ts:54–150` controleert bytes/MIME, saneert SVG, normaliseert rasters en controleert dimensies. Bestaande toegestane typen/limieten: GIF50MB; JPEG/PNG/WebP25MB; SVG2MB; batch12 (`image-upload-policy.ts:1–12`). AVIF wordt momenteel niet geaccepteerd. Exact behoud van Sites-AVIF vereist expliciete veilige servernormalisatie en tests, Tijdelijk weigeren vraagt zichtbare uitleg en blijft open werk; alleen het accept-attribuut aanpassen volstaat niet.

Video: hergebruik `prepareMediaVideoUpload`, `finalizeMediaVideoUpload`, `cancelMediaVideoUpload` en `validated-video-upload.ts`, plus de bestaande TUS-client in `media/video-upload-form.tsx:42,150–204`:6MiB chunks, resumable upload en retry. De server maakt de tenantgebonden intent, valideert finalize en plaatst afwijkende bestanden in quarantaine. Worker blijft eigenaar van FFmpeg-normalisatie/checksums/ready-transitie. De Sites-kiezer schakelt video's bewust uit (`playlist-media-picker.tsx:94,179–190`); dat is een demobeperking, geen gewenst productgedrag. Maak video's in dezelfde mooie kiezer bruikbaar met thumbnail/duur/verwerkingstatus zodra gereed.

Mediabewerking/organisatie: `G:.../media/actions.ts:81–364` bevat rename/archive/restore/retry/folders/tags/collections/favorites en guarded mutaties; `media-resource-actions.ts:18–46` bulkarchive. Gebruiksimpact en immutable releaseverwijzingen mogen bij verwijderen/vervangen niet verloren gaan.

### Studio-ontwerpen in playlists

Vrije Studio gebruikt reeds `studio_projects`, `studio_project_drafts`, `studio_revisions`, `studio_render_jobs`, `studio_exports` (`G:.../studio/data.ts:175–221`). Acties `saveStudioDraftAction`187, `restoreStudioRevisionAction`326 en `requestStudioRenderAction`490 staan in `.../studio/actions.ts`. Sites-templates moeten als bewerkbare documenten binnen deze authoring- en renderpipeline terechtkomen. De Sites-reeks is geen willekeurige React/HTML-string in een Playermanifest.

Dynamische ontwerpen gebruiken `dynamic_slides` en immutable `dynamic_slide_snapshots`; toevoegen blijft via de bestaande beveiligde snapshotactie. Nieuwe OnzeTrots-themavelden vereisen contracts/server-/DB-validatie en rendererondersteuning. Niet alleen `themeId` in clientstate schrijven. Alleen de bron-ID opnieuw opslaan zou bovendien Sites' bevroren-look-semantiek verliezen. Maak expliciet onderscheid tussen vastgelegde ontwerpversie, expliciet 'nieuwste ontwerp ophalen' en onafhankelijk actuele brondata.

Kantineproducten staan in Sites onder `content-products`; het menu kopieert de actuele prijzen pas bij opnieuw openen/opslaan (`S:app/prototype/commerce.tsx:40,56,88–111`). Productie heeft echte `tenant_products` en importcommands (`G:.../integrations/twelve-products/actions.ts:15–64`: `replace_product_import_rows_v1`, `apply_product_import_v1`, `update_tenant_product_v1`). Menu Studio heeft `create_menu_studio_draft_v2`, `save_menu_studio_document_v2`, `set_menu_studio_orientation_v2` en `publish_dynamic_slide_version_v1` (`G:.../slides/menu-studio/actions.ts:27–220`). Koppel de Sites-productselectie en volgorde aan deze documenten en pipeline. Houd bevroren menuopmaak en geselecteerde productidentiteiten gescheiden van eventuele actuele productdatasets; laat een browserkopie geen bestaande prijsupdateworkflow uitschakelen.

De Sites-YouTube-wizard bewaart alleen browserbronnen en toont een vormgegeven fallback (`S:app/prototype/commerce.tsx:123–139`). Productie heeft `save_youtube_source_v1` (`G:.../integrations/youtube/actions.ts:12–29`) en de playlistcatalogus filtert reeds op actieve, geverifieerde, embeddable bronnen (`G:.../playlists/data.ts:247`). De mooiere fallback en wizard moeten deze validatie/bronstatus tonen en het echte publicatiepad gebruiken. Een geldige URL is niet hetzelfde als een afspeelbare, geautoriseerde of offline-beschikbare bron.

### Actuele publicatie en schermstatus

Hergebruik `publishPlaylistGuided` (`G:.../playlists/actions.ts:509–577`): actuele draft opnieuw laden, expected revision controleren, readiness, alle doelen binnen tenant, disabled/incompatible/opslagblokkades, expliciete waarschuwingen/unknown telemetry, daarna `publish_playlist_to_targets_v3`. Een nieuwe UI kan dit als dezelfde Sites-stappen tonen; noodzakelijke status- en herstelmeldingen worden binnen die vorm toegevoegd.

De actuele database heeft `playlist_publications` en `published_dynamic_data` (`G:supabase/migrations/20260919215758_s185_current_publication.sql:3,62`) plus eigen `screens.target_revision`. De configuratiehash bepaalt of een nieuwe configuratierevisie nodig is. Dezelfde inhoud opnieuw publiceren maakt geen cosmetische nieuwe versie. Realtime invalideert; de geautoriseerde API blijft bron van waarheid. Live providerdata wijzigen geen publicatie of afspeelindex. Zie ook `G:docs/s185-current-publication.md:91–149` en `docs/player-offline-canon.md:95–123`.

Publicatieschermen: `G:.../releases/data.ts:71–75` `list_current_publications_v1`, detail94 en assignment/devicetelemetry144–148, draftpreflight238 en releasepreflight375. Restore/reassign blijven `.../releases/actions.ts:11–82` (`reassign_playlist_release_v2`, `restore_playlist_release_to_draft_v1`). Toon 'toegewezen', 'downloaden', 'verifiëren', 'wachten op overgang' en 'zichtbaar bevestigd' op basis van echte toestand. Sites' directe 'Demo actief' mag nooit productiesucces suggereren.

### Schermen en fysieke koppeling

Sites `screen-data.ts:1–2` heeft één groepnaam, playlistnaam en handmatig wijzigbare status. Productie heeft meervoudige memberships, separate screen/device lifecycle en actuele/doel/default/planningopdracht. `G:.../screens/data.ts:247–262` laadt dit plus telemetry, floorplans en automation. Koppel Sites-kaarten en detailtabs aan dit rijke model. Status is afgeleid, geen door gebruiker vrij instelbaar actief/offline-selectveld.

Hergebruik `G:.../screens/actions.ts`: create/onboarding14/24; pairing35 (`claim_pairing_session_v4`); update68; memberships96; deactivate125; remove145; rename173; revoke190; retry215; recoverycommands230; bulk288/332/384; `create_screen_from_current_release_v1`455. Centrale beheercheck505, afzonderlijk publishrecht384. Behoud de echte pairingstap in de Sites-wizard. `S:.../screens.tsx:60–62` maakt nu uitsluitend een demoscherm en kent geen fysieke claim.

Schermgroepen: `G:.../screen-groups/actions.ts:16–105` gebruikt `mutate_screen_group_v1` met revision en beheerrechten. Gebruik UUID's en toon namen als labels. Sites refereert op diverse plekken aan namen; een hernoemde playlist/groep mag geen toewijzingen breken.

### Planning

Sites `planning.tsx:8,53–62` gebruikt lokale datum/tijd, namen en eenvoudige dagelijkse/wekelijkse overlap; `save` op38 is een browserwrite. Productie heeft timezone, once/daily/weekly/custom, release-ID, priority, source, revision en echte scheduler. `G:.../planning/data.ts:13–44`, `planning-types.ts:1–21` en `actions.ts:50–137,258,374–390` leveren echte conflictcontrole en `mutate_content_schedule_v1`.

De Sites-wizard, week/maand/agendaweergave en terugkerende-momentenbediening blijven visueel gelijk. Maak local date/time naar tenanttimezone om met bestaande `zonedLocalDateTimeToIso` en valideer DST; browserlocale is niet autoritatief. Vertaal 'Alle schermen' naar een expliciet gedocumenteerde groep- of meerdere-targetopdracht: het huidige schedulecontract accepteert `screen|screen_group`, niet een magische naam. Een planning verwijst naar een geldige publicatie/release, niet een onopgeslagen concept. Behoud prioriteit, bron, geplande toewijzing en veilige terugval naar default; een normale publicatie mag een lopende planning niet stilzwijgend uitschakelen.

## 3. Concrete productgaten die extra implementatie vereisen

1. **Multi-zone output:** `S:.../screens.tsx:57–77` heeft full/sidebar/bottom/three met percentages en per-zone playlist/ontwerp. In de onderzochte actuele screen-/playlist-/Playercontracten is geen equivalent gevonden; `G:docs/technical-canon.md:178` noemt multi-zone nog buiten kern-MVP. Productie-`venue_zones` zijn fysieke plattegrondzones, geen simultane contentzones. Exacte functionele parity vergt versieerbaar layoutcontract, tenant-scoped refs, per-zone paging/timing, totale assetverzameling, capabilitypreflight, moderne en LG-runtime plus offline tests. Definieer ook of LED-goals het hele scherm of alleen een zone tijdelijk overnemen. Dit is geen CSS-aanpassing.
2. **Atomisch gemengde selectie/bulkoperaties:** nieuwe contracten voor veel media, gehele Studio-reeksen, bulkduur en bulkthema. Valideer per contenttype, behoud selectievolgorde en één conflictresultaat. De bestaande mutatielaag is waardevol, maar geen bewijs van deze batchsemantiek.
3. **Thema per playlistplaatsing:** Sites zet `themeId` in een gekopieerd itemontwerp. Productie vereist een expliciet versieerbaar authoring-/snapshotpad. Een bulkstijl mag bestaande shared bronontwerpen of andere playlists niet ongemerkt wijzigen.
4. **AVIF:** aantoonbaar verschil in toegestane types. Voeg veilige ondersteuning toe wanneer het Sites-acceptcontract exact moet blijven; behoud productieondersteuning voor video/GIF/veiligSVG.
5. **API-volledigheid:** `/api/mobile/v1/playlists/[playlistId]/route.ts:45–75,121–158` laadt slechts eenvoudige mediavelden en kan dynamische types/secties/presentatie niet volledig projecteren. Deze API is geen kant-en-klare volledige adapter voor de nieuwe webeditor. Gebruik de bestaande serverservices of breid transportcontracten uit zonder native clients te breken.
6. **Browserimport en demoassets:** eigen browseruploads zijn niet onderdeel van broncode. Alleen importeren na blobinventarisatie en upload/remap; ontbrekende bestanden expliciet melden, geen foto op basis van alleen naam raden.

## 4. Beveiligings- en migratievoorwaarden voor iedere adapter

- Actieve tenant en capability server-side afleiden; client `tenantId`, status en rollen nooit vertrouwen. Geen gewone queries via service-role. Private RLS en tenant-aware foreign keys behouden.
- Mutaties capabilitygescheiden: media write, playlist write/archive/publish, screen manage. Zichtbare UI kan rechten uitleggen, de server weigert ook directe bypass.
- Private media alleen als kortlevende readurl in de preview; nooit tokens/signed URLs in immutable confighash of opgeslagen concept. Asset-ID/checksum/path zijn stabiele referenties.
- Een nieuw thema verandert geen historical releasebytes. Alleen een expliciet gewijzigd concept maakt een nieuwe configuratie. Legacy releases blijven leesbaar en afspeelbaar.
- Echte verwerkingstatus heeft loading/queued/processing/failed/ready-herstel. Geslaagde gedeeltelijke uploads blijven in bibliotheek; een item kan pas gepubliceerd worden wanneer pipeline en preflight het toelaten.
- Browserstate mag selectie, filter en nog niet opgeslagen werk bevatten. Definitieve mutatie pas bevestigen na serverack. Tenantwissel/logout wist of isoleert tijdelijke tenantstate. Offline concepten alleen met expliciete synchronisatie/conflictsemantiek.
- Bestaande functies die niet op Sites staan blijven bereikbaar via hetzelfde nieuwe ontwerp: secties, crop/fit/trim/audio, zichtbaarheid, YouTube, Engage, archive/restore, readiness, telemetry en herstel. Geen functionaliteitsverlies onder het argument 'exact prototype'.

## 5. Acceptatiejourneys voor de overdracht

1. Op390px breed: playlist open → upload3foto's waarvan1ongeldig → zoek/filter andere media → selecteer foto+Studio-reeks+dynamische slide → volgorde behouden → éénkeer toevoegen → duur bulk wijzigen → opslaan. Na reload en op een tweede apparaat staat exact dezelfde bevestigde inhoud.
2. Twee editors openen dezelfde revision; eerste slaat op, tweede ontvangt conflict zonder verborgen overwrite. Mobiele selectie/ongedaan gemaakte wijziging blijft herstelbaar.
3. Upload MP4, verbreek verbinding, hervat, verwerk en publiceer alleen ready variant. Afgewezen bestand houdt concrete fout + herstel; geen valse succesmelding.
4. OnzeTrots-thema per item en hele selectie; broninhoud, duur-per-pagina en oriëntering blijven correct. Andere playlists/shared source onveranderd. Oude publicatie blijft dezelfde bytes weergeven.
5. Publiceer naar2schermen,1verouderde heartbeat: waarschuwing zichtbaar, serverpreflight beslissend. UI toont toegewezen tot echte eerste-framebevestiging. Offline Player blijft last-known-good spelen.
6. Plan rond Europe/Amsterdam zomer-/wintertijd, overlappende schermgroep en individuele schermtoewijzing. Conflictcontrole server-side en normale publicatie behoudt de geldige planning.
7. Nieuwe fysieke Player koppelen met code; verlopen/verkeerde/cross-tenant claim faalt. Handmatig offline/actief zetten via UI onmogelijk.
8. Multi-zone verplicht voor complete parity: beide oriëntaties, lange lijsten, video, doelpuntinterventie, alle media offline, nieuwe layout atomisch actief; modern en StaticLG met dezelfde bevroren configuratie.
9. A/B-tenanttests voor lezen, muteren, assetrefs, bulkcommands en publish; viewerkan niet muteren; editor zonder publishrecht kan wel voorbereiden.
10. Browserterug, swipe/Androidback, onscreen keyboard, safe-area en gesloten modal laten geen onbereikbare bediening of ongevraagd gegevensverlies ontstaan. Screenshotvergelijking met de Sites-baseline op dezelfde viewport en fixtures.

Geen van deze journeys is in deze analyse als daadwerkelijk geslaagd aangemerkt. Het zijn de noodzakelijke bouw- en releasecriteria voor Codex.
