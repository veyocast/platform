# Afzonderlijke Google TV Play-listing

De reeds goedgekeurde algemene Android-app blijft ongewijzigd onder package
`nl.veyocast.player`. Google TV wordt als afzonderlijke Play-app aangeboden
onder package `nl.veyocast.player.tv`. Beide modules compileren exact dezelfde
Kotlin WebView-shell en openen dezelfde hosted Player; er ontstaat geen tweede
pairing-, cache- of playbackcodebase.

## Eenmalig in Google Play Console

1. Maak een nieuwe app `VeyoCast Player voor TV` met package
   `nl.veyocast.player.tv`.
2. Kies uitsluitend de apparaatcategorie TV en vul de TV-kwaliteitsverklaring
   in. De manifestvariant vereist Leanback, heeft geen mobiele launcher en
   vereist geen touchscreen.
3. Activeer Play App Signing en maak een afzonderlijke upload key. Deel of
   hergebruik de app-signing key van de algemene app niet.
4. Maak GitHub Environment `android-google-tv-internal` met vereiste reviewers.
5. Voeg de vier `ANDROID_GOOGLE_TV_UPLOAD_*` secrets en de twee
   `GOOGLE_TV_*` variabelen uit de tabel hieronder toe.
6. Upload de eerste AAB zo nodig eenmaal handmatig; daarna publiceert de
   handmatige workflow rechtstreeks naar het interne testkanaal.
7. Voeg de listingteksten uit `play-tv/listing/nl-NL` en de afzonderlijke
   16:9 TV-screenshots uit `play-tv/graphics/tv-screenshots` toe.
8. Gebruik `https://veyocast.nl/privacy` en
   `https://veyocast.nl/data-verwijderen` in de afzonderlijke Consolevelden.

## GitHub Environment

| Soort | Naam |
|---|---|
| Secret | `ANDROID_GOOGLE_TV_UPLOAD_KEYSTORE_BASE64` |
| Secret | `ANDROID_GOOGLE_TV_UPLOAD_KEYSTORE_PASSWORD` |
| Secret | `ANDROID_GOOGLE_TV_UPLOAD_KEY_ALIAS` |
| Secret | `ANDROID_GOOGLE_TV_UPLOAD_KEY_PASSWORD` |
| Variable | `GOOGLE_TV_WORKLOAD_IDENTITY_PROVIDER` |
| Variable | `GOOGLE_TV_PLAY_SERVICE_ACCOUNT` |

Het Google-serviceaccount krijgt in Play Console alleen rechten op package
`nl.veyocast.player.tv` en uitsluitend op interne releases.

## JDK en afzonderlijke upload key

De GitHub-workflow installeert zelf Temurin JDK 17. Er hoeft daarom geen JDK op
de VPS of self-hosted deploymentrunner te worden geïnstalleerd. Een lokale JDK
is alleen nodig om zelf Androidbuilds te draaien of een upload key met
`keytool` te maken.

Google TV is in Play een afzonderlijke app. Maak daarom een eigen upload key
voor `nl.veyocast.player.tv`; hergebruik de upload key van
`nl.veyocast.player` niet. Als Play Console al een uploadcertificaat voor de
TV-app toont, gebruik dan exact de bijbehorende bestaande keystore en maak geen
nieuwe.

Een nieuwe TV-upload key kan eenmalig op een vertrouwde lokale pc worden
gemaakt:

```bash
keytool -genkeypair -v \
  -keystore veyocast-google-tv-upload.jks \
  -alias veyocast-google-tv-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

keytool -export -rfc \
  -keystore veyocast-google-tv-upload.jks \
  -alias veyocast-google-tv-upload \
  -file veyocast-google-tv-upload-certificate.pem
```

Upload alleen het certificaat waar Play Console daarom vraagt. Bewaar de
`.jks` plus wachtwoorden in een versleutelde offline back-up en plaats de
base64-inhoud uitsluitend in
`ANDROID_GOOGLE_TV_UPLOAD_KEYSTORE_BASE64`. Commit de keystore, het certificaat
en wachtwoorden nooit. Met Play App Signing bewaart Google de app-signing key;
VeyoCast bewaart zelf alleen deze vervangbare upload key.

## Lokale builds

```bash
cd apps/android-tv
./gradlew :tv:lint :tv:test
./gradlew :tv:assembleStagingDebug :tv:assembleProductionDebug
./gradlew :tv:bundleProductionRelease \
  -PveyocastTvVersionCode=1 \
  -PveyocastTvVersionName=1.0.0
```

Artifacts:

```text
tv/build/outputs/apk/staging/debug/tv-staging-debug.apk
tv/build/outputs/apk/production/debug/tv-production-debug.apk
tv/build/outputs/bundle/productionRelease/tv-production-release.aab
```

De release-AAB wordt alleen ondertekend wanneer de vier
`ANDROID_GOOGLE_TV_SIGNING_*` variabelen of de vier `tv*` waarden uit
`keystore.properties` aanwezig zijn.

## Screenshots

Google TV gebruikt eigen 16:9 winkelbeelden. Zij mogen niet worden hergebruikt
als telefoon- of tabletscreenshot. De repository bewaart gecontroleerde
1920×1080 captures van pairing, mixed-mediaweergave en Playerbeheer onder
`play-tv/graphics/tv-screenshots`. Herhaal de capture op een fysiek Google
TV-apparaat vóór publicatie en vervang een beeld alleen door een onbewerkte
capture met dezelfde functionele toestand.
