# S111 eindrapport — media, playlists, navigatie en LG

## 1. What was wrong

LG Legacy forceerde Blob-video, las Theme Engine v2 niet, Control liet een absoluut canvas uit de preview ontsnappen, providerlogo's stonden als tenantmedia in de bibliotheek, normale flows toonden releaseversies en de mobiele sidebar had vier zones in drie gridrijen.

Voorheen: dezelfde playlist kon op Android wel en LG niet afspelen; prijslijsten verloren op LG hun v2-stijl; een preview kon de pagina bedekken; Sportlink-logo's vervuilden Media; gebruikers kozen technische releases.  
Nu: LG kiest online HTTPS-video met geverifieerde cachefallback, Legacy resolveert de tien v2-thema's, preview en Meer-paneel zijn begrensd, providerassets hebben een globale private cache en normale flows kiezen playlists.

## 2. Root causes found

De oorzaken en het padbewijs staan in `docs/audits/media-playlist-navigation-audit.md`: Blob-decodercompatibiliteit, ontbrekende Legacy `themePresentation`-resolver, ontbrekend positioned containment, tenantgebonden provideridentiteit, release-ID-gedreven formulieren en een fout gridcontract.

## 3. Architecture changes

Provideridentiteit en immutable bytes zijn losgemaakt van tenantmedia. Snapshots bevriezen een providerversie; de Player resolveert die server-side en neemt hem mee in de gewone offline releasecache. User-facing selectie blijft logisch, terwijl release-ID's intern transactioneel worden vastgelegd.

## 4. Database migrations

`20260821125857_s111_provider_asset_cache_media_origin.sql` voegt mediaherkomst, globale cache/versionering, private bucket, clubreferentie, service-role completion v4, snapshotfallback, indexen, constraints en ACL/RLS toe.

## 5. Sportlink cache implementation

De globale sleutel is provider + entiteitstype + externe entiteit + rol. Iedere checksum is immutable; dezelfde checksum gebruikt hetzelfde globale storagepad. Cachemetadata bevat LKG, bron, ETag, Last-Modified, laatste controle/succes en foutcode. De worker normaliseert veilig naar WebP en schrijft uitsluitend via service role.

## 6. Media Library changes

Alleen `source_kind=user` verschijnt. Legacy provider- en gegenereerde assets zijn gecontroleerd geclassificeerd zonder gepubliceerde historie te verwijderen. De serverpagina is 48 items; zoeken omvat titel, bestandsnaam en tags.

## 7. Media Picker changes

Playlist Studio en mobiele contentqueries gebruiken dezelfde gebruikersmediagrens. Provider-, render- en variantassets zijn niet als upload selecteerbaar.

## 8. Playlist/version changes

Schermbulk, schermgroepen en planning tonen één logische playlist. Bij opslaan resolveert de server de nieuwste geldige immutable publicatie. Release Center, historie, preflight en diagnose blijven bewust versioned.

## 9. Mobile navigation changes

Header, top, scrollnavigatie en footer hebben ieder een expliciete gridrij. Het paneel gebruikt `100dvh`, safe-area-insets, momentumscroll en begrensde overscroll.

## 10. Performance improvements

Media laadt 48 begrensde serverresultaten, ondertekent previews in één batch en gebruikt een partiële tenant/index voor zichtbare Media. Providerbytes worden content-addressed globaal opgeslagen.

## 11. Security/RLS impact

Providertabellen forceren RLS, hebben geen anon/authenticated privileges en zijn alleen voor service role. De bucket is privé. Bestaande SSRF-, publieke-IP-, redirect-, MIME-, magic-byte-, timeout- en groottelimieten blijven gelden. Tenant-RLS is niet versoepeld.

## 12. Tests added

Nieuwe tests bewaken previewcontainment, vier-zone/safe-area-navigatie, exact tien LG-thema's, HTTPS→cache-videofallback, globale providerpaden en provider-ACL/RLS.

## 13. Existing data migrated

Hoog-confidence Sportlink-, RSS- en dynamische renderbestanden krijgen een technische herkomst en verdwijnen uit normale Media. Zij en alle bestaande releases blijven fysiek en referentieel intact; er is geen destructieve backfill of republish.

## 14. Remaining technical debt

Fysieke LG 43UL3J-EP-validatie blijft `UNTESTED`. Conditional provider-GET gebruikt de opgeslagen validators pas bij een volgende workeroptimalisatie; het huidige globale content-addressed opslagmodel voorkomt wel tenantduplicatie en bewaart LKG.

## 15. Files changed

De wijziging raakt Control Media/playlist/planning/schermen/shell, media-worker Sportlink, Player Legacy/release-envelop, één Supabase-migratie, RLS- en unitregressies, audit, sprintprompt, ledger en dit rapport.

## 16. Commands/tests executed

Groen: fresh `pnpm db:reset`; 48 RLS-bestanden/952 assertions; workspace lint/typecheck/test 30/30 en build 18/18; Player 148 unit, 87 browser en 7 offline; Control 144 unit, a11y 35/35 en de gerichte 360×640, 390×844, 412×915 en 768×1024 Meer-menu-E2E; media-worker 79 unit. De volledige generieke Chromiumset is niet opnieuw dubbel uitgevoerd nadat de relevante Player-, a11y- en gerichte Control-matrices al groen waren.

## 17. Deployment considerations

Eerst exact de gemergede main-SHA naar staging, inclusief migratie en worker. Controleer health, private bucket, Player manifest en Control. Promote daarna dezelfde image-digests naar production. Seed production nooit. Hardwareacceptatie blijft apart en verandert de eerlijke status niet.
