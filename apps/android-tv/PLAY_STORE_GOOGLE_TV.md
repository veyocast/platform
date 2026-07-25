# Android TV binnen de bestaande VeyoCast Player-app

VeyoCast gebruikt in Google Play één app:

- naam: `VeyoCast Player`;
- package/application ID: `nl.veyocast.player`;
- bestaande Play App Signing-configuratie;
- bestaande upload key.

De algemene Android-bundle blijft op de mobiele Play-tracks. De TV-module bouwt
een tweede artifact met dezelfde app-identiteit, maar een TV-only manifest.
Google Play levert dat artifact via de afzonderlijke Android TV-form-factortrack.
Beide modules compileren dezelfde Kotlin WebView-shell en openen dezelfde hosted
Player. Pairing, cache en playback bestaan dus maar één keer.

## Eenmalig in de bestaande Play Console-app

Open de bestaande app `VeyoCast Player` (`nl.veyocast.player`) en voer uit:

1. Ga naar `Test and release > Advanced settings > Form factors`.
2. Kies `+ Add form factor` en voeg `Android TV` toe.
3. Kies bij Android TV `Manage`.
4. Selecteer `Use a dedicated release track for Android TV` en sla op.
5. Upload voor iedere actieve winkeltaal minimaal één Android TV-screenshot.
   De voorbereide Nederlandstalige beelden staan onder
   `play-tv/graphics/tv-screenshots`.
6. Ga terug naar de Android TV-instellingen, kies `Opt in to Android TV`,
   accepteer de reviewvoorwaarden en sla op.
7. Open de nieuwe Android TV internal-testtrack en koppel de gewenste testers.
8. Start daarna op `main` de workflow `Google TV Player Play internal`.
9. Controleer dat de release onder de Android TV internal track staat en niet
   onder de mobiele internal track.

Deze keuze voor een dedicated Android TV-track is volgens Play Console na
opslaan niet terug te zetten naar gezamenlijk releasebeheer. Maak daarom eerst
de screenshots en testerstoegang gereed.

Voor deze bestaande Play-app retourneert de Google Play Developer API via de
publicatieactie `tv:internal` als Android TV internal track-ID. De workflow
gebruikt daarom exact `tv:internal`. `internal` zonder prefix is uitsluitend de
algemene mobiele testtrack; `production` is in de TV-workflow nergens
toegestaan.

## Bestaande GitHub Environment hergebruiken

De TV-workflow gebruikt dezelfde beschermde Environment
`android-tv-internal` als de algemene Android-release. Voeg geen tweede
keystore, certificaat, serviceaccount of Play-app toe.

De volgende bestaande secrets worden hergebruikt:

| Soort | Naam |
|---|---|
| Secret | `ANDROID_TV_UPLOAD_KEYSTORE_BASE64` |
| Secret | `ANDROID_TV_UPLOAD_KEYSTORE_PASSWORD` |
| Secret | `ANDROID_TV_UPLOAD_KEY_ALIAS` |
| Secret | `ANDROID_TV_UPLOAD_KEY_PASSWORD` |

Ook deze bestaande Environment-variabelen worden hergebruikt:

| Soort | Naam |
|---|---|
| Variable | `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` |
| Variable | `GOOGLE_PLAY_SERVICE_ACCOUNT` |

Omdat beide workflows dezelfde Environment-secret en dezelfde Gradle
`ANDROID_SIGNING_*`-ingangen gebruiken, worden beide AAB's met exact dezelfde
uploadidentiteit aangeboden. Google Play App Signing blijft daarna dezelfde
app-signing key gebruiken.

De GitHub-runner installeert zelf JDK 17 en de Android SDK. Op de VPS is geen
JDK nodig. Lokaal is JDK 17 alleen nodig om zelf Gradlebuilds uit te voeren.
De uploadkeystore die al voor VeyoCast Player is gemaakt blijft de enige key;
maak geen nieuwe TV-key.

## Artifact- en versiegrenzen

| Artifact | Module | application ID | Play-track | versionCode |
|---|---|---|---|---|
| algemeen Android | `:app` | `nl.veyocast.player` | `internal` | `100000000–199999999` |
| Android TV | `:tv` | `nl.veyocast.player` | `tv:internal` | `200000000–299999999` |

De workflows berekenen `range-start + run_number × 100 + run_attempt`.
Daardoor kan geen algemene en TV-upload ooit dezelfde versionCode krijgen.
Gradle weigert waarden buiten de eigen modulerange.

Lokale controles:

```bash
cd apps/android-tv
./gradlew :tv:lint :tv:test
./gradlew :tv:assembleStagingDebug :tv:assembleProductionDebug
./gradlew :tv:bundleProductionRelease \
  -PveyocastTvVersionCode=200000001 \
  -PveyocastTvVersionName=1.0.0
```

Het release-artifact staat na een gesigneerde build op:

```text
tv/build/outputs/bundle/productionRelease/tv-production-release.aab
```

## Manifest- en distributiegrens

De TV-bundle:

- vereist `android.software.leanback`;
- vereist geen touchscreen;
- heeft alleen `LEANBACK_LAUNCHER`;
- staat vast in landscape;
- bevat een 320 × 180 TV-banner;
- gebruikt alleen `INTERNET`, `ACCESS_NETWORK_STATE` en
  `RECEIVE_BOOT_COMPLETED`;
- bevat geen native libraries.

De algemene app behoudt de normale Android-launcher en ondersteuning voor
telefoon en tablet. Omdat beide artifacts dezelfde package-ID hebben, kan op
een TV geen tweede VeyoCast-installatie of tweede pairingprofiel ontstaan.

## Winkel- en reviewmateriaal

De hoofdlisting onder `play/listing/nl-NL` blijft de enige winkeltekst. Er is
geen afzonderlijke TV-listing. Android TV gebruikt wel eigen 16:9-screenshots:

- `01-koppelen-1920x1080.png`;
- `02-fullscreen-content-1920x1080.png`;
- `03-offline-doorgaan-1920x1080.png`.

De appbanner staat in
`app/src/main/res/drawable-nodpi/veyocast_tv_banner.png`. Reviewstappen staan in
`play/review-instructions.md`. Privacybeleid, Data Safety, app access,
gegevensverwijdering en support blijven die van de bestaande app:

- `https://veyocast.nl/privacy`;
- `https://veyocast.nl/data-verwijderen`;
- `support@veyocast.nl`.

De huidige Android- en TV-shell voegen geen analytics-, advertentie- of
crash-SDK toe. Beide bewaren dezelfde WebView-localStorage, IndexedDB,
Cache Storage, pairingstatus en last-known-good release; beide versturen via
de hosted Player dezelfde device-heartbeats. Er is daarom geen tweede Data
Safety-profiel nodig, maar de bestaande verklaring moet deze apparaatstatus en
lokale opslag wel correct beschrijven.

## Fysieke acceptatie vóór uitbreiding

Test minimaal op één telefoon, één tablet en één Chromecast met Google TV of
Android TV-apparaat:

1. telefoon/tablet krijgt de algemene artifact en toont de normale launcher;
2. TV krijgt de TV-artifact en toont icon plus banner;
3. op TV verschijnt maar één VeyoCast Player;
4. pairing blijft na app- en apparaatherstart behouden;
5. D-pad, OK, BACK, HOME en play/pause werken zonder touchscreen;
6. links/rechts navigeert tijdens playback zoals gedocumenteerd;
7. een mixed-mediarelease doorloopt minimaal één volledige loop;
8. offline last-known-good blijft spelen en herstelt na netwerkterugkeer;
9. portrait/landscape op mobiel en 16:9 zonder TV-overscan zijn bruikbaar;
10. appversie, package en uploadcertificaat komen in Play Console overeen.

Fysieke hardwareacceptatie kan niet door repositorychecks worden vervangen.

## Officiële referenties

- [Dedicated form-factortracks in Play Console](https://support.google.com/googleplay/android-developer/answer/13295490)
- [Track-ID's voor de Google Play Publishing API](https://developers.google.com/android-publisher/tracks)
- [Android TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
