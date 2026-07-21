# VeyoCast Player voor Android TV

Dit project bouwt een minimale native Android TV-shell rond de bestaande
VeyoCast-webplayer. De shell bevat geen playlist-, pairing-, planning-, cache-
of playbackengine. `apps/player` blijft de enige bron van waarheid.

## Architectuur

De app gebruikt één native `Activity` met een fullscreen Android `WebView`.
Dat geeft Chromecast met Google TV en andere Android TV-apparaten een echte
launcher-app, immersive fullscreen, D-padbediening, scherm-wakker-beleid,
netwerkcallbacks en herstel na een beëindigde WebView-renderer zonder een tweede
playercodebase te maken.

De verantwoordelijkheden zijn bewust gescheiden:

| Native Android-shell | Bestaande webplayer |
|---|---|
| TV-launcher, fullscreen en landscape | schermregistratie en pairing |
| veilige top-level navigatie | playlists, releases en planning |
| netwerk- en rendererherstel | afbeeldingen en video |
| scherm wakker houden | IndexedDB, Cache Storage en service worker |
| best-effort bootstart | statusrapportage en platformfouten |
| verborgen lokaal beheerpaneel | last-known-good en immutable releases |

De WebView gebruikt het normale appdataprofiel. Cookies, `localStorage`,
IndexedDB, Cache Storage en service-workerdata worden niet gewist bij een
normale app- of apparaatherstart. Daardoor blijven het VeyoCast-device-token,
de pairingstatus en lokaal geverifieerde releases behouden.

Top-level navigatie is beperkt tot exact de geconfigureerde Player-origin.
`file:`, `content:`, `javascript:`, HTTP-downgrades en externe hosts worden
geblokkeerd. API-, Supabase- en signed mediarequests blijven gewone
subresources van de webplayer en worden niet door een foutgevoelige native
hostlijst onderschept. Mixed content, file/content access, pop-ups, native
JavaScriptinterfaces en certificaatbypasses zijn uitgeschakeld. Een SSL-fout
wordt altijd geannuleerd.

Bij een mislukte eerste paginalaadactie verschijnt native:

> Geen verbinding met VeyoCast
> Er wordt automatisch opnieuw geprobeerd.

Retry gebruikt begrensde exponentiële back-off tot maximaal 30 seconden. Een
korte netwerkonderbreking vernietigt de WebView niet en de webplayer kan zijn
lokale cache blijven gebruiken. Als Android de renderer beëindigt, wordt het
oude WebView-object verwijderd en veilig vervangen. Na drie rendererproblemen
binnen vijf minuten pauzeert automatisch herstel tot een bewuste retry.

## Omgevingen

| Variant | Player-URL | application ID |
|---|---|---|
| `staging` | `https://staging-player.veyocast.nl` | `nl.veyocast.player.staging` |
| `production` | `https://player.veyocast.nl` | `nl.veyocast.player` |

Debugbuilds krijgen daarnaast de suffix `.debug`, zodat debug en release naast
elkaar kunnen staan. Een productionbuild accepteert nooit een vrije Player-URL.

Voor lokale debug mag uitsluitend via een ADB intent-extra naar `localhost`,
`127.0.0.1` of emulatorhost `10.0.2.2` worden gewezen:

```bash
adb shell am start \
  -n nl.veyocast.player.staging.debug/nl.veyocast.player.MainActivity \
  --es veyocast_player_url http://10.0.2.2:3001
```

Andere hosts en iedere override in een releasebuild worden genegeerd.

## Vereisten

- JDK 17;
- Android Studio Quail 2 of een compatibele nieuwere stabiele versie;
- Android SDK Platform 37.1 (compile SDK; target API 37);
- Android SDK Build Tools 36.0.0;
- Android Platform Tools voor ADB;
- de meegeleverde Gradle 9.5-wrapper.

Stel lokaal `JAVA_HOME` en `ANDROID_HOME` in. `local.properties` mag ook naar de
lokale SDK wijzen, maar is bewust door Git genegeerd.

## Builds en controles

Voer commando's uit vanuit `apps/android-tv/`:

```bash
./gradlew clean
./gradlew lint
./gradlew test
./gradlew assembleStagingDebug
./gradlew assembleProductionDebug
```

Debug-APK's verschijnen standaard hier:

```text
app/build/outputs/apk/staging/debug/app-staging-debug.apk
app/build/outputs/apk/production/debug/app-production-debug.apk
```

Releasebuilds en een Android App Bundle:

```bash
./gradlew assembleProductionRelease
./gradlew bundleProductionRelease
```

Zonder lokale signingconfiguratie is de release-APK unsigned. Debugbuilds zijn
altijd lokaal debuggesigneerd en hebben geen CI-secret nodig.

## Installatie via ADB

Schakel op Google TV eerst de ontwikkelaarsopties in. Open doorgaans
`Instellingen > Systeem > Over > Android TV OS-build` en druk zeven keer op de
buildregel. Schakel daarna USB- of netwerkdebugging in onder
`Ontwikkelaarsopties`. Benamingen verschillen per Android TV-versie en fabrikant.

```bash
adb connect <device-ip>:5555
adb install -r app/build/outputs/apk/production/debug/app-production-debug.apk
adb shell monkey -p nl.veyocast.player.debug 1
```

Voor staging debug gebruik je package
`nl.veyocast.player.staging.debug`. Bevestig de ADB-fingerprint altijd op het
fysieke scherm en zet netwerkdebugging na de test weer uit.

## Afstandsbediening en beheerpaneel

De webplayer ontvangt D-pad-, OK- en toetsenbordinvoer rechtstreeks. BACK gaat
alleen terug binnen een vertrouwde Player-route en verlaat de root nooit naar
een leeg scherm. Op de root opent BACK het native Playerbeheer. Het paneel opent
ook met de MENU-toets of door OK circa 1,2 seconde ingedrukt te houden.

Playerbeheer bevat uitsluitend shellfuncties:

- verbinding en omgeving controleren;
- de webplayer vernieuwen;
- best-effort autostart na reboot instellen;
- bevestigen dat het scherm wakker en landscape blijft;
- appversie bekijken;
- de app bewust afsluiten.

Het paneel wist geen pairing, device-token of offlinecache. Ontkoppelen en
opnieuw koppelen blijven gecontroleerde acties in VeyoCast Control, zodat de
serverstatus en het device niet uit elkaar lopen.

## Bootstart

Autostart staat veilig standaard uit. Na inschakelen verwerkt een niet-
exported receiver `BOOT_COMPLETED` en vraagt maximaal één start per vijf minuten
aan. Google TV en fabrikanten mogen background activity starts alsnog blokkeren
of uitstellen. Dit is best effort en geen gegarandeerde kioskmodus. Voor een
gegarandeerde zakelijke kiosk is later managed device/device-ownerbeheer nodig;
de app gebruikt nu bewust geen accessibility-, device-admin- of ongedocumenteerde
workarounds.

## Logging en privacy

Debuglogging bevat appversie, environment, alleen de Player-host, laadstatus,
netwerkstatus, retry en rendererherstel. Productionlogging blijft beperkt tot
waarschuwingen en fouten. Pairingtokens, cookies, headers, persoonsgegevens en
volledige signed media-URL's worden nooit gelogd.

## Signing

Kopieer lokaal `keystore.properties.example` naar `keystore.properties` en vul
alleen lokale of door CI aangeleverde waarden in:

```properties
storeFile=/absolute/path/to/veyocast-release.jks
storePassword=...
keyAlias=veyocast-player
keyPassword=...
```

`keystore.properties`, `*.jks`, `*.keystore` en `local.properties` zijn
genegeerd. Commit nooit signingmateriaal. Voor CI-release signing horen de
waarden uit secrets tijdelijk buiten de repository te worden opgebouwd.

## Branding

Het launchericoon is een byte-identieke kopie van het officieel goedgekeurde
`veyocast-icon-maskable-512.png`. De 320 x 180 TV-banner is een technische
placeholder: de locked inverse lock-up is zonder recolour, crop of reconstructie
op masterzwart geplaatst. Deze banner is geen nieuw officieel brandmaster en
moet voor brede distributie expliciet door de merkeigenaar worden goedgekeurd
of door een later aangeleverd officieel TV-bannerasset worden vervangen.

## CI

`.github/workflows/android-tv.yml` draait alleen bij Android TV-, Player- of
brandwijzigingen. De workflow gebruikt JDK 17, valideert de Gradle-wrapper,
installeert SDK 37.1, voert lint en unit tests uit, bouwt beide debugvarianten en
bewaart de APK's veertien dagen als GitHub Actions-artifact. Release signing is
bewust geen vereiste voor deze buildcheck.

## Beperkingen

- Bootstart en keep-on-top zijn niet gegarandeerd zonder managed kiosk/device owner.
- HOME en het OS-appmenu blijven door Android beheerd.
- De shell heeft geen eigen APK-updater; distributie loopt handmatig, via een
  intern Google Play for Android TV-kanaal of later via managed devices.
- Offline media en pairing blijven afhankelijk van de bestaande webplayer,
  Android System WebView en de beschikbare apparaatopslag.
- Een klassieke Chromecast zonder Google TV kan deze APK niet uitvoeren.
- Fysieke Chromecast-/Android TV-tests en een lange video-/offline-soak blijven
  vereist vóór een brede supportclaim.

## Mogelijke vervolgtaken

1. fysieke acceptatietest op een exact Chromecast met Google TV-profiel;
2. definitieve goedgekeurde TV-banner en Play Store-assets;
3. release signing en intern Google Play-testkanaal;
4. bestaande VeyoCast-healthtelemetrie uitbreiden met native shellversie;
5. managed kiosk/device-ownerprofiel voor zakelijke uitrol;
6. hardwarematrix en 24-uurs mixed-media-soak automatiseren.

## Officiële Android-referenties

- [Android TV-app en launcher configureren](https://developer.android.com/training/tv/get-started/create)
- [Immersive fullscreen](https://developer.android.com/develop/ui/views/layout/immersive)
- [WebView-renderer veilig herstellen](https://developer.android.com/develop/ui/views/layout/webapps/handle-termination)
- [WebView-content veilig laden](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Broadcast- en bootbeperkingen](https://developer.android.com/develop/background-work/background-tasks/broadcasts)
