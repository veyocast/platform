# Media-, playlist- en navigatie-audit

Datum: 2026-08-21  
Sprint: S111  
Status: bevestigd op `origin/main` (`c4f4d5fafd2515f3ac6de4738cd39edd0c003a1f`)

## Scope en uitgangspunten

Deze audit behandelt de Media-bibliotheek, Sportlink-providerassets, playlistselectie, mobiele Control-navigatie, dynamische slidepreview en LG Legacy-playback. De immutable releaseketen, tenantgrenzen, last-known-good (LKG) en offline-first playback blijven harde invarianten. Een fysieke LG-test is voor deze release door Danny niet als voorafgaande productievoorwaarde gesteld, maar de hardwarestatus blijft eerlijk `UNTESTED`.

De productgrens is:

- gebruikersmedia zijn tenantbezit en zichtbaar/beheerbaar in Media;
- providerassets zijn platformcache en geen gebruikersmedia;
- gegenereerde render-/variantassets zijn technische output en geen bibliotheekitems;
- een beheerder kiest in normale flows een logische playlist; versie- en release-identiteiten zijn alleen zichtbaar in historie, diagnose en releasebeheer;
- de Player ontvangt een volledige immutable release en doet tijdens playback nooit een live Sportlink-call.

## Huidige implementatie en bewijs

### Media

`apps/control/app/(shell)/dashboard/media/page.tsx` biedt al raster/lijst, zoeken, filters, sortering, mappen, tags, favorieten, opgeslagen weergaven, bulkacties, verwerkingsstatus, soft delete, upload en detailinspectie. `media_folders`, `media_tags`, `media_asset_tags`, `media_asset_favorites` en `publisher_saved_views` staan in `supabase/migrations/20260725150000_publisher_authoring_foundation.sql`.

De lijst wordt server-side gepagineerd door `list_publisher_media_assets_v1` uit `supabase/migrations/20260725170000_publisher_guarded_commands.sql`, maar gebruikt een kleine pagina van twintig resultaten, zoekt alleen in de titel en ondertekent previews per asset. De RPC filtert niet op de productherkomst van een asset. Daardoor zijn de bestaande UX-capabilities grotendeels aanwezig, maar de catalogusgrens en schaalbaarheid zijn onvolledig.

`media_assets` en `media_variants` uit `supabase/migrations/20260716170000_media_upload_processing.sql` scheiden bronassets al van afgeleide varianten. Verwijderen is soft delete en bewaart immutable releasehistorie; dat contract blijft behouden.

### Providerassets

`apps/media-worker/src/sportlink-media.ts` maakt logo-ID's met tenant-ID, rol en checksum en schrijft naar het tenantpad. `20260811213811_sportlink_client_teams_club_logo.sql` en `20260811234046_sportlink_standing_team_logos.sql` voegen club- en teamlogo's vervolgens als gewone tenant-`media_assets` toe. Het resultaat is:

- providerlogo's vervuilen Media;
- hetzelfde externe logo wordt per tenant gedupliceerd;
- een periodieke sync kan hetzelfde logo opnieuw ophalen;
- techniek en gebruikersbezit zijn in het datamodel niet uit elkaar te houden.

De fetchgrens in `packages/integrations/src/safe-image-fetch.ts` is wel veilig: alleen HTTP(S), publieke DNS/IP's, begrensde redirects, timeout en grootte, en JPEG/PNG/WebP met magic-bytecontrole. Deze SSRF-, MIME-, redirect- en groottelimieten blijven leidend.

### Playlistselectie

Het datamodel kent logische playlists en immutable `playlist_releases`. `screens.assigned_playlist_id` bewaart de logische keuze; `assigned_release_id`, `active_release_id` en `desired_release_id` zijn de uitvoeringsstatus. De normale playlistpagina groepeert al per logische playlist.

In `screens/screen-bulk-form.tsx`, `screens/data.ts`, `screen-groups/data.ts` en `planning/data.ts` worden echter release-opties met labels als “Playlist · versie N” aan normale gebruikers getoond. Dit lekt de implementatie van immutable releases naar operationele selectie. Release Center en historie zijn de correcte plaatsen waar versies zichtbaar blijven.

### Mobiele navigatie

`control-shell.tsx` rendert in de sidebar vier directe zones: mobiele header, top, navigatie en footer. `apps/control/app/globals.css` definieert voor `.control-sidebar` slechts drie expliciete gridrijen (`auto minmax(0,1fr) auto`) en verbergt overflow op een `100dvh`-container. Op korte mobiele viewports ontstaat daardoor een impliciete vierde rij; de scrollbare navigatie en account/footer kunnen buiten het bereik raken. Safe-area-insets zijn niet volledig in de mobiele paneelindeling verwerkt.

### Dynamische slidepreview

`dynamic-slide-live-preview.tsx` plaatst de gedeelde Editorial Arena-renderer inline in `.livePreviewStage`. De renderer gebruikt een absoluut gepositioneerde `.arenaViewport`, terwijl `.livePreviewStage` in `dynamic-content.module.css` geen positioned containing block is. De preview ontsnapt daardoor naar een hogere ancestor en lijkt spontaan fullscreen te openen. Omdat het geen modal is, bestaat er terecht geen sluitknop; containment is de ontbrekende grens.

### LG-video

`apps/player/app/lg/page.tsx` stuurt echte webOS-/NetCast-user-agents naar `/lg/legacy`. In `apps/player/app/_lib/lg-legacy-page.ts` zet `sourceForItem` ook online video altijd om naar een Cache Storage-Blob-URL. Oudere LG native mediadecoders accepteren dezelfde MP4 via HTTPS met byte ranges, maar kunnen `blob:`-video weigeren. Android gebruikt de moderne route en heeft deze beperking niet. Dit verschil verklaart dat dezelfde release op Android wel en op LG niet start.

De release wordt vóór activatie al volledig gedownload en op checksum geverifieerd. Daarom kan video online veilig eerst vanaf de immutable, ondertekende HTTPS-bron spelen, met de geverifieerde lokale Blob als directe fallback. Dit verandert LKG, atomaire activatie of offlinebeschikbaarheid niet.

### LG Theme Engine v2

De moderne renderer leest `snapshot.themePresentation` en resolveert de tien thema-ID's uit manifest 1.0.0. De LG Legacy-runtime leest alleen `snapshot.editorial.theme` en oude tokenmaps. Daardoor ontbreken bij onder meer `price_list` de v2-palette, typografie en decoratie. De Legacy-lijst mist daarnaast `sport_match_of_the_day`, terwijl dit een actieve, databacked familie is.

## Bevestigde hoofdoorzaken

1. LG-video: verplichte `blob:`-bron voor video, ook wanneer een bereikbare HTTPS/Range-bron bestaat.
2. LG-slide-CSS: Legacy-runtime kent `themePresentation` en de tien manifestthema's niet.
3. Control-preview: absoluut rendereroppervlak zonder lokale positioned/paint containment.
4. Media-vervuiling: Sportlink-logo's worden als tenantgebruikersmedia gemodelleerd.
5. Providerduplicatie: cache-identiteit bevat tenant-ID in plaats van provider + externe entiteit + rol.
6. Playlistverwarring: normale formulieren selecteren technische release-ID's en tonen versienummers.
7. Mobiele onbereikbaarheid: vier sidebarzones in een grid met drie rijen en een afgesloten viewport.

## Data-impact en migratiestrategie

Er komt een globale, niet via de Data API aan eindgebruikers blootgestelde providercache met:

- een logische identiteit `(provider, entity_type, external_entity_id, asset_role)`;
- immutable checksumversies met bucket, objectpad, MIME, afmetingen en validators;
- één verwijzing naar de actuele LKG-versie en gecontroleerde refreshmetadata;
- unieke constraints en FK-indexen voor deduplicatie en snelle lookup;
- expliciete intrekking voor `anon` en `authenticated`; alleen vertrouwde serverprocessen schrijven/lezen.

Nieuwe Sportlink-syncs schrijven globale providerversies en snapshots bevriezen de gekozen providerversie. De Player-release-envelop lost die versie server-side op, ondertekent/downloadt hem samen met de release en houdt hem offline beschikbaar. Provider-URL's komen niet in de Playerpayload.

Bestaande gepubliceerde releases en tenantlogoassets worden niet verwijderd of herschreven. Ze blijven afspeelbaar. Oude hoog-confidence providerassets worden in normale Media-queries verborgen; fysieke opruiming is een afzonderlijke, herstelbare lifecycle na referentiecontrole. Tenantuploads en Studio-overrides houden voorrang boven de providercache.

Voor playlistselectie is geen redundante mutable “current release”-kolom nodig. De UI kiest een playlist; de server resolveert binnen dezelfde gemuteerde operatie de meest recente geldige publicatie of bewaart de reeds geplande immutable release waar tijdplanning dat vereist. Historie blijft versioned.

## Doelarchitectuur van de UI

- Media toont uitsluitend beheerbare tenantmedia, met 48 items per serverpagina, zoekactie over titel/bestandsnaam/tags, filters, mappen, favorieten, bulkacties en duidelijke processing/lege states.
- Een compacte assetpicker hergebruikt dezelfde serverquery en herkomstgrens; technische varianten en providerassets zijn niet selecteerbaar als gebruikersmedia.
- Scherm- en groepsflows tonen één optie per playlist. Release Center, historie en diagnose tonen versies.
- Het mobiele Meer-paneel heeft vier expliciete zones, een zelfstandig scrollende navigatie en safe-area-bewuste header/footer.
- De dynamische preview blijft inline en kan zijn stage nooit verlaten.
- LG Legacy resolveert hetzelfde thememanifest met legacy-veilige CSS en gebruikt HTTPS-video met lokale fallback.

## Risico's en beheersing

- **Providercache versus immutable historie:** nooit een mutable cacheobject in een bestaande release vervangen; iedere checksum krijgt een immutable versie.
- **Migratie van oude providerassets:** geen bulkdelete; compatibel uitlezen en alleen uit normale catalogusweergave filteren.
- **SSRF of ongecontroleerde media:** bestaande publieke-IP-, redirect-, MIME-, magic-byte-, timeout- en groottelimieten blijven verplicht; credentials en service role blijven server-only.
- **Offline regressie:** HTTPS is alleen de online eerste bron voor video; de geverifieerde cache blijft aanwezig en is de offline/foutfallback.
- **LG CSS-compatibiliteit:** geen moderne CSS-functies waarop oude webOS-browsers niet kunnen vertrouwen; beperkte, expliciet geteste legacy tokens/decoraties.
- **Playlist-race:** playlist naar release wordt server-side en transactioneel opgelost, niet door een oude clientlijst.
- **Mobiele clipping:** viewportmatrix 360×640, 390×844, 412×915 en 768×1024 plus toetsenbord/focuscontrole.

## Exact uitvoeringsplan

1. Leg sprint S111, audit en regressiecontracten vast.
2. Herstel previewcontainment en het vier-zone mobiele sidebargrid; voeg viewportregressies toe.
3. Geef LG-video een online HTTPS/Range-eerste route met één geverifieerde cachefallback en behoud alle LKG/checksumgrenzen.
4. Serialiseer Theme Engine v2 manifest 1.0.0 naar LG Legacy, resolveer `themePresentation`, voeg legacy-veilige CSS voor exact tien thema's toe en activeer de ontbrekende databacked sportfamilie.
5. Voeg globale providercachetabellen, private storagepolicies, RLS/ACL-regressies, LKG/validatorvelden en indexen toe.
6. Laat de Sportlink-worker provideridentiteiten globaal dedupliceren en snapshots immutable providerversies bevriezen; breid de release-envelop uit om deze offline mee te nemen.
7. Scheid provider-/gegenereerde assets van Media, vergroot de serverpagina en verbeter zoeken en gebatchte previews zonder bestaande mappen/favorieten/bulk/delete te breken.
8. Vervang technische releasekeuzes in normale scherm-/groepsflows door logische playlistkeuzes; behoud releasehistorie in daarvoor bedoelde schermen.
9. Draai database/RLS-, workspace-, Player/offline-, Control unit/build/a11y/E2E- en LG Legacy-gates. Registreer fysieke LG als `UNTESTED`.
10. Commit en push één toetsbare S111-branch, merge via PR, deploy exact de gemergede SHA eerst naar staging en daarna bytegelijk naar production; voer hosted health-, migratie- en playbacksmokes uit.
