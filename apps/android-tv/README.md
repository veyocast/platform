# VeyoCast Player voor Android

Dit project bouwt een minimale native Android-signageapp rond de bestaande
VeyoCast-webplayer. De app werkt op reguliere Android-apparaten en tablets én
ondersteunt Android TV en Google TV. De shell bevat geen playlist-, pairing-,
planning-, cache- of playbackengine. `apps/player` blijft de enige bron van
waarheid.

Google Play bevat één app: `VeyoCast Player` met package
`nl.veyocast.player`. De algemene en TV-gerichte AAB zijn twee
form-factorartifacts van diezelfde app, gebruiken dezelfde uploadkey en worden
naar afzonderlijke Play-tracks gestuurd. Er bestaat geen tweede TV-app.

De bestaande mapnaam `apps/android-tv/` blijft voorlopig behouden om
artifactpaden, Play-signing en bestaande CI-integraties niet onnodig te breken.
De productscope is nadrukkelijk niet TV-only.

## Architectuur

De app gebruikt één native `Activity` met een fullscreen Android `WebView`.
Daarmee krijgen telefoons, tablets, dedicated Android-signagehardware,
Chromecast met Google TV en andere Android TV-apparaten dezelfde launcher-app,
immersive fullscreen, touch-, toetsenbord- en D-padbediening,
scherm-wakker-beleid, netwerkcallbacks en herstel na een beëindigde
WebView-renderer zonder een tweede playercodebase te maken.

De verantwoordelijkheden zijn bewust gescheiden:

| Native Android-shell | Bestaande webplayer |
|---|---|
| Android- en TV-launcher, fullscreen en apparaatrotatie | schermregistratie en pairing |
| veilige top-level navigatie | playlists, releases en planning |
| netwerk- en rendererherstel | afbeeldingen en video |
| scherm wakker houden | IndexedDB, Cache Storage en service worker |
| geverifieerde boot-/updatestartpoging | statusrapportage en platformfouten |
| verborgen lokaal beheerpaneel | last-known-good en immutable releases |

De WebView gebruikt het normale appdataprofiel. Cookies, `localStorage`,
IndexedDB, Cache Storage en service-workerdata worden niet gewist bij een
normale app- of apparaatherstart. Daardoor blijven het VeyoCast-device-token,
de pairingstatus en lokaal geverifieerde releases behouden.

Een verwijdering van de app wist dit WebView-profiel wel. Vanaf S53 leidt de
officiële Android-app daarom uit Androids per signing key, gebruiker en
apparaat afgeschermde `ANDROID_ID` een eenrichtingsherstelcredential af. De
native shell plaatst die alleen als `Secure`, `HttpOnly` en `SameSite=Strict`
cookie op de vaste Player-origin. De server bewaart uitsluitend de SHA-256-hash.
Na herinstallatie met dezelfde officiële application ID en signing key kan de
server daarmee de bestaande Installation herkennen en beide verloren
Playercredentials roteren, zonder de Screen-, tenant-, playlist- of
planningsbinding te wijzigen. Het ruwe Android-ID, een MAC-adres en de
herstelcredential verschijnen nooit in Control, URL's, logging of PostgreSQL.
Factory reset, een andere signing key, een andere application ID en een
ingetrokken devicebinding herstellen bewust niet automatisch.

De hosted Player declareert expliciet `width=device-width` en schaal 1. De
WebView laat de fysieke viewport de initiële schaal bepalen en de native
foutkaart en beheerlade worden op smalle Android- en TV-viewports tot de beschikbare
breedte begrensd, zodat geen tweede vaste canvasmaat ontstaat.

Top-level navigatie is beperkt tot exact de geconfigureerde Player-origin.
`file:`, `content:`, `javascript:`, HTTP-downgrades en externe hosts worden
geblokkeerd. API-, Supabase- en signed mediarequests blijven gewone
subresources van de webplayer en worden niet door een foutgevoelige native
hostlijst onderschept. Mixed content, file/content access, pop-ups, native
JavaScriptinterfaces en certificaatbypasses zijn uitgeschakeld. Een SSL-fout
wordt altijd geannuleerd.

Nieuwe builds gebruiken de herkenbare `VeyoCastAndroid/<versie>` user-agent.
De Player herkent voor compatibiliteit ook de historische
`VeyoCastAndroidTV/<versie>`-waarde van eerder uitgebrachte builds. Beide
voorkomen dat de hosted Player binnen de reeds geïnstalleerde native app
opnieuw de Android PWA-installatiekaart aanbiedt.

Tijdens een mediawissel blijft de uitgaande Playerlaag zichtbaar totdat de
volgende video werkelijk speelt en twee renderframes heeft gekregen. De
inkomende videolaag is vóór dat moment niet zichtbaar of aanraakbaar. De
native `WebChromeClient` vervangt daarnaast Androids standaard videoposter door
een effen zwarte bitmap; daardoor kan de WebView geen eigen playicoon tussen
twee VeyoCast-items tonen. Deze shellmaatregel introduceert geen tweede
playbackengine en verandert pairing, releasevolgorde of offlinecache niet.

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

Voor productie zijn er twee modules:

| Module | Apparaten | Launcher | Play versionCode |
|---|---|---|---|
| `:app` | telefoon, tablet en algemeen Android | normaal + optionele Leanback | `100000000–199999999` |
| `:tv` | Google TV en Android TV | alleen Leanback, landscape | `200000000–299999999` |

Beide productionmodules gebruiken application ID `nl.veyocast.player`.

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
./gradlew :tv:assembleStagingDebug
./gradlew :tv:assembleProductionDebug
```

Debug-APK's verschijnen standaard hier:

```text
app/build/outputs/apk/staging/debug/app-staging-debug.apk
app/build/outputs/apk/production/debug/app-production-debug.apk
tv/build/outputs/apk/staging/debug/tv-staging-debug.apk
tv/build/outputs/apk/production/debug/tv-production-debug.apk
```

Releasebuilds en een Android App Bundle:

```bash
./gradlew assembleProductionRelease
./gradlew bundleProductionRelease
./gradlew :tv:bundleProductionRelease
```

Zonder lokale signingconfiguratie is de release-APK unsigned. Debugbuilds zijn
altijd lokaal debuggesigneerd en hebben geen CI-secret nodig.

Versiemetadata kan voor een release expliciet worden gezet zonder het
buildbestand te wijzigen:

```bash
./gradlew bundleProductionRelease \
  -PveyocastVersionCode=100000001 \
  -PveyocastVersionName=1.0.1

./gradlew :tv:bundleProductionRelease \
  -PveyocastTvVersionCode=200000001 \
  -PveyocastTvVersionName=1.0.1
```

## Installatie via ADB

Schakel op een Android-apparaat eerst de ontwikkelaarsopties en USB- of
netwerkdebugging in. Op Google TV open je doorgaans
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

## Touch, toetsenbord, afstandsbediening en beheerpaneel

De webplayer ontvangt touch-, D-pad-, OK- en toetsenbordinvoer rechtstreeks. Tijdens
video toggelt kort OK tussen afspelen en pauzeren; links en rechts springen tien
seconden en hardwarematige play/pause-toetsen werken eveneens. Zonder actieve
media blijft dezelfde invoer beschikbaar voor de pairinginterface. BACK gaat
alleen terug binnen een vertrouwde Player-route en verlaat de root nooit naar
een leeg scherm. Op de root opent de eerste BACK of Android-terugactie het
native Playerbeheer; de tweede brengt de gebruiker naar Android Home. Het
paneel opent ook met de MENU-toets of door OK circa 1,2 seconde ingedrukt te
houden.

Wanneer de app naar de achtergrond gaat, pauzeert de shell actieve HTML-media.
Alleen elementen die door deze lifecycleovergang zijn gepauzeerd worden bij
terugkeer hervat; een bewust door de gebruiker gepauzeerd element blijft
gepauzeerd.

Playerbeheer bevat uitsluitend shellfuncties:

- verbinding en omgeving controleren;
- de webplayer vernieuwen;
- in production de Google Play-detailpagina openen om automatische updates
  voor VeyoCast Player in te schakelen;
- in de stagingvariant de afgeschermde Google Play-reviewdemo starten of
  ontkoppelen;
- autostart na reboot en normale app-update instellen en de laatst geverifieerde
  uitkomst bekijken;
- de Android-appinstellingen openen wanneer het apparaatbeleid een
  achtergrondstart blokkeert;
- bevestigen dat het scherm wakker blijft en de apparaatrotatie volgt;
- appversie bekijken;
- de app bewust afsluiten.

Het paneel wist geen pairing, device-token of offlinecache. Ontkoppelen en
opnieuw koppelen blijven gecontroleerde acties in VeyoCast Control, zodat de
serverstatus en het device niet uit elkaar lopen.

Android staat niet toe dat VeyoCast de globale of app-specifieke
Play-automatische-updatevoorkeur stilzwijgend wijzigt. De menuactie opent daarom
de officiële Play-detailpagina; daar schakelt de gebruiker via **Meer →
Automatisch updaten** de voorkeur in. Op beheerde apparaten kan een EMM in
plaats daarvan een maintenance window of high-priority updatebeleid afdwingen.

Nieuwe staging- en productioninstallaties hebben de lokale autostartschakelaar
standaard aan. Een startverzoek geldt pas als geslaagd wanneer `MainActivity`
werkelijk `resumed` is. Na dertig seconden zonder zichtbare Activity wordt
`BACKGROUND_START_NOT_VISIBLE` vastgelegd en in Playerbeheer getoond. Boot en
`MY_PACKAGE_REPLACED` gebruiken op recente Androidversies expliciete
background-launchopt-ins.

Dit neemt het Android-platformbeleid niet weg: sinds Android 10 kan een gewone
app een background activity launch blokkeren zonder exception terug te geven.
Een absoluut gegarandeerde signageboot vereist device-owner/kioskbeheer of dat
VeyoCast als default launcher is ingericht. De unmanaged Play-app rapporteert
de werkelijke uitkomst en doet geen stil succesvoorwendsel.

### Staging-reviewdemo

Alleen de `staging`-flavor toont `Demo starten`. Voer daar de herbruikbare
Google Play-reviewcode `VYO 2VY` in. De code maakt geen normaal scherm of
device-account aan: de Player geeft een ondertekende, tijdelijke virtuele
demosessie uit en opent `/demo`. De demo gebruikt dezelfde cache-, verificatie-
en afspeelcomponenten als de normale Player.

Een Platform Owner kiest in staging onder
`Platform > Systeem en herstel > Android reviewdemo` welke gepubliceerde
playlist wordt gebruikt. Deze wijziging vereist AAL2 en wordt geaudit. Als de
configuratie of gekozen release niet beschikbaar is, gebruikt de Player een
ingebouwde veilige mixed-mediareviewplaylist. `Demo ontkoppelen` wist alleen de
demosessie; bestaande pairing- en playercachegegevens blijven intact.

De production-flavor compileert `DEMO_MENU_ENABLED=false`. Bovendien antwoorden
alle demo-API's buiten `VEYOCAST_ENVIRONMENT=staging` met `404`, ook als iemand
de route rechtstreeks probeert te openen.

## Bootstart

Autostart staat veilig standaard uit. Na inschakelen verwerkt een niet-
exported receiver `BOOT_COMPLETED` en vraagt maximaal één start per vijf minuten
aan. Android-versies en fabrikanten mogen background activity starts alsnog blokkeren
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
alleen lokale waarden in:

```properties
storeFile=/absolute/path/to/veyocast-release.jks
storePassword=...
keyAlias=veyocast-player
keyPassword=...
```

`keystore.properties`, `*.jks`, `*.keystore` en `local.properties` zijn
genegeerd. Commit nooit signingmateriaal. Voor CI-release signing horen de
vier waarden als `ANDROID_SIGNING_*` environmentvariabelen te worden aangeboden.
De algemene en TV-module lezen exact dezelfde waarden. Beide Play-workflows
gebruiken daarom de bestaande `ANDROID_TV_UPLOAD_*` secrets uit Environment
`android-tv-internal`; er is geen TV-specifieke uploadkey. De build weigert
gedeeltelijke signingconfiguratie en de Play-workflow verwijdert het tijdelijke
keystorebestand altijd.

## Branding

Het launchericoon is een byte-identieke kopie van het officieel goedgekeurde
`veyocast-icon-maskable-512.png`. De 320 x 180 TV-banner is een technische
placeholder: de locked inverse lock-up is zonder recolour, crop of reconstructie
op masterzwart geplaatst. Deze banner is geen nieuw officieel brandmaster en
moet voor brede distributie expliciet door de merkeigenaar worden goedgekeurd
of door een later aangeleverd officieel TV-bannerasset worden vervangen.

## CI

`.github/workflows/android-tv.yml` draait alleen bij Android-, Player- of
brandwijzigingen. De workflow gebruikt JDK 17, valideert de Gradle-wrapper,
installeert SDK 37.1, voert lint en unit tests uit, bouwt beide debugvarianten en
bewaart de APK's veertien dagen als GitHub Actions-artifact. Release signing is
bewust geen vereiste voor deze buildcheck.

`.github/workflows/android-tv-play-internal.yml` is een afzonderlijke handmatige
releasegrens. Alleen `main` kan na goedkeuring van Environment
`android-tv-internal` een gesigneerde production-AAB naar exact track `internal`
publiceren. Google-authenticatie gebruikt kortlevende Workload Identity/OIDC-
credentials; er staat geen serviceaccount-key in GitHub. Exacte bootstrap,
secrets, variabelen en acceptatie staan in
[`PLAY_STORE_INTERNAL_TEST.md`](PLAY_STORE_INTERNAL_TEST.md).

`.github/workflows/android-google-tv-play-internal.yml` gebruikt dezelfde
Environment, uploadkey, signingidentiteit en Workload Identity. Deze workflow
bouwt alleen `:tv:bundleProductionRelease` en publiceert uitsluitend naar de
door de Play API geretourneerde Android TV internal track-ID `tv:internal`. De workflow bevat geen
production- of mobiele tracknaam. Console-inrichting en TV-acceptatie staan in
[`PLAY_STORE_GOOGLE_TV.md`](PLAY_STORE_GOOGLE_TV.md).

Voor iedere TV-publicatie inspecteert de workflow de binaire AAB, niet alleen
het bronmanifest. De gate bewijst dat exact één geëxporteerde en ingeschakelde
`MAIN`/`LEANBACK_LAUNCHER` naar
`nl.veyocast.player.MainActivity` resolveert én dat die klasse werkelijk in de
release-DEX staat. Daarna installeert bundletool de gegenereerde APK-set op een
Android TV API 34-emulator en voert de workflow de echte package-manager
resolve- en startcommando's uit. Manifest, DEX-rapport, APK-set, ADB-uitvoer en
logcat worden samen met het ondertekende AAB vóór de Play-upload als artifact
bewaard. Een ontbrekende launcherklasse blokkeert de publicatie daardoor
volledig.

## Beperkingen

- Bootstart en keep-on-top zijn niet gegarandeerd zonder managed kiosk/device owner.
- HOME en het OS-appmenu blijven door Android beheerd.
- De shell heeft geen eigen APK-updater; distributie loopt via Google Play of
  managed devices. Het beheerpaneel opent de Play-updatevoorkeur, maar kan die
  systeeminstelling niet zonder gebruikers- of EMM-toestemming wijzigen.
- Offline media en pairing blijven afhankelijk van de bestaande webplayer,
  Android System WebView en de beschikbare apparaatopslag.
- Een klassieke Chromecast zonder Android-appplatform kan deze APK niet uitvoeren.
- Fysieke tests op telefoon, tablet, dedicated signagehardware,
  Chromecast/Google TV en een lange video-/offline-soak blijven vereist vóór
  een brede supportclaim.

## Mogelijke vervolgtaken

1. fysieke acceptatietests op telefoon, tablet en Chromecast met Google TV;
2. Android TV als form factor binnen de bestaande Play-app activeren en de
   dedicated internal testerlist koppelen;
3. echte onbewerkte Android- en TV-screenshots en definitieve store-assets vastleggen;
4. bestaande VeyoCast-healthtelemetrie uitbreiden met native shellversie;
5. managed kiosk/device-ownerprofiel voor zakelijke uitrol;
6. hardwarematrix en 24-uurs mixed-media-soak automatiseren.

## Officiële Android-referenties

- [Ondersteuning voor verschillende schermformaten](https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-display-sizes)
- [Android TV-app en launcher configureren](https://developer.android.com/training/tv/get-started/create)
- [Immersive fullscreen](https://developer.android.com/develop/ui/views/layout/immersive)
- [WebView-renderer veilig herstellen](https://developer.android.com/develop/ui/views/layout/webapps/handle-termination)
- [WebView-content veilig laden](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Broadcast- en bootbeperkingen](https://developer.android.com/develop/background-work/background-tasks/broadcasts)
