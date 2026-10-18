# Android-updatecontract — VeyoCast V1 Rebuild

Dit contract hoort bij de herbouw met de exacte Sync V1-vormgeving uit Sites. De bestaande Android-apps krijgen een **update binnen hun bestaande identiteit**. Er worden geen vervangende Play-apps, nieuwe productiepackages of nieuwe signingidentiteiten gemaakt. Dit document is een opdracht en gemeten bronbaseline; er is nog geen Android-update gebouwd of op apparaten geïnstalleerd.

## Gemeten bronbaseline

Read-only gecontroleerd op 17 oktober 2026 in `veyocast/platform`, commit `20729be35d38dc8eb67b836160632ac7c3ea5153`. De geselecteerde ongewijzigde tekstbronnen staan onder `reference/legacy-baseline/android/baseline/`; bron-URL's en Git-blobhashes staan in `reference/legacy-baseline/android/evidence.json`. Codex controleert bij de start opnieuw of de branchhead afwijkt en vergelijkt relevante wijzigingen voordat de herbouw begint.

| Onderdeel | Bronpad | Identiteit / bronconfiguratie |
|---|---|---|
| Algemene Player | `apps/android-tv/app/build.gradle.kts` | `applicationId` en namespace `nl.veyocast.player`; `PLAYER_FORM_FACTOR=general`; `versionCode` 100000000–199999999, brondefault 100000001; brondefault versionName 1.0.0 |
| Android TV Player | `apps/android-tv/tv/build.gradle.kts` | Dezelfde `applicationId` en namespace `nl.veyocast.player`; `PLAYER_FORM_FACTOR=tv`; `versionCode` 200000000–299999999, brondefault 200000001; brondefault versionName 1.0.0 |
| Native Control | `apps/control-mobile/app.config.ts` | Android package `nl.veyocast.control`; Expo slug `veyocast-control`, owner `veyocast`, scheme `veyocast-control`; `versionCode` 300000000–399999999, brondefault 300000001; brondefault version 1.0.0 |

**De twee Player-modules zijn twee artifacts van één bestaande Play-app**, geen twee losse productiepackages. TV deelt Kotlin-bronnen, tests en resources met `../app/src/...`. De TV-bundle wordt volgens het bestaande repositorycontract op de dedicated `tv:internal` track aangeboden; algemeen Android op `internal`. Maak geen aparte TV-app of tweede pairingprofiel. Controleer de actuele Play Console-tracks en geïnstalleerde versies: brondefaults bewijzen niet welke versie nu daadwerkelijk is uitgerold.

Staging Player voegt `.staging` toe; debug voegt `.debug` toe. Zo ontstaan bijvoorbeeld `nl.veyocast.player.staging.debug` en `nl.veyocast.player.debug`. Production-release gebruikt de oorspronkelijke package zonder suffix. Control heeft in de gelezen Expo-config geen environmentsuffix; introduceer niet stilzwijgend een andere identiteit als vervanger van de bestaande Control-installatie.

Player compileert tegen SDK 37 minor API 1, target 37, min SDK 26, JDK 17. Control heeft compile/target 36, min SDK 26, build tools 36.0.0 in de gemeten bron. Dit zijn feitelijke baselinewaarden, geen opdracht om platformvereisten blind te bevriezen: een noodzakelijke toolchain-update moet regressies aantoonbaar voorkomen en de bestaande installaties blijven ondersteunen.

## Signing, versies en distributie

1. Behoud Play App Signing, de uploadkeystore en de bestaande app-signingcertificaatidentiteit. Bewaar zowel Player als Control signingmateriaal buiten Git en buiten dit pakket. Lees of log geen wachtwoorden, base64keystores of private keys.
2. Inventariseer op de developmentserver en in de bestaande release-inrichting de **namen, aanwezigheid en veilige locatie** van signingbestanden en de **publieke SHA-256-certificaatfingerprints**. Leg geen geheime waarden vast. Vergelijk de certificate fingerprint van een werkelijk geïnstalleerde APK met Play App Signing; vergelijk de uploadidentiteit apart met de uploadcertificaatregistratie. Deze twee certificaten kunnen legitiem verschillen.
3. Behoud `ANDROID_SIGNING_STORE_FILE`, `ANDROID_SIGNING_STORE_PASSWORD`, `ANDROID_SIGNING_KEY_ALIAS` en `ANDROID_SIGNING_KEY_PASSWORD` als bestaande signing-ingangen. Player leest daarnaast `apps/android-tv/keystore.properties` indien aanwezig; dat bestand wordt niet verwijderd voordat de beschermde externe configuratie veilig is ondergebracht. Control gebruikt `plugins/with-control-signing.cjs` tijdens prebuild.
4. Behoud de workflows `.github/workflows/android-tv-play-internal.yml`, `android-google-tv-play-internal.yml`, `android-tv.yml`, `control-mobile-ci.yml`, `control-mobile-play-internal.yml` en `control-mobile-play-production.yml`, hun Environment-referenties, secrets, variabelen, OIDC-trust en releasebeperkingen. De volledige deployinventaris in het handoverpakket is hierbij leidend.
5. De Player-documentatie noemt Environment `android-tv-internal` met bestaande secrets `ANDROID_TV_UPLOAD_KEYSTORE_BASE64`, `ANDROID_TV_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_TV_UPLOAD_KEY_ALIAS`, `ANDROID_TV_UPLOAD_KEY_PASSWORD`, en variabelen `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` en `GOOGLE_PLAY_SERVICE_ACCOUNT`. Behoud de namen en configuratie. Dit pakket bevat de waarden niet en bewijst niet dat ze op dit moment volledig zijn ingesteld.
6. Behoud de gescheiden versionCode-reeksen en bestaande berekening uit de workflows. Gebruik een code die **hoger is dan de reeds verspreide code van de bedoelde artifact/track**. Hergebruik de brondefault nooit als nieuwe releasecode. Bij een mogelijke wissel tussen general en TV eerst de reële versionCode-compatibiliteit controleren: Android accepteert geen stille downgrade omdat de TV-reeks hoger is.
7. Een geslaagde build is geen afgeronde update. Lever geteste APK/AAB, package, versionCode/versionName, commit, signingcertificaatfingerprint, updateproef en bijbehorende release notes. Publiceer via de bestaande interne track en pas daarna via de bestaande productieprocedure. Geen nieuwe production-release uitvoeren uitsluitend op basis van deze overdrachtsopdracht.

Voor een controle op het apparaat zijn `adb shell dumpsys package nl.veyocast.player` en `adb shell dumpsys package nl.veyocast.control` bruikbaar om de daadwerkelijk geïnstalleerde identiteit en versie vast te leggen. Gebruik voor een lokaal verkregen APK `apksigner verify --print-certs pad/naar/bestaande.apk`. Neem alleen package-, versie- en publieke certificaatgegevens over in bewijs, geen persoons- of sessiedata uit volledige apparaatlogs.

## Player: functionele invarianten

| Contract | Te behouden gedrag en bron |
|---|---|
| Hosted origin | Production `https://player.veyocast.nl`; staging `https://staging-player.veyocast.nl`. De shell opent deze vaste origins. Sites-URL's zijn visuele referenties, geen vervanging van deze productieorigins. |
| Launcher | Algemeen manifest heeft `LAUNCHER` én `LEANBACK_LAUNCHER`, leanback optioneel, touchscreen optioneel. TV-manifest heeft alleen `LEANBACK_LAUNCHER` plus `DEFAULT`, leanback verplicht, touchscreen optioneel, landscape. De bestaande activity is `nl.veyocast.player.MainActivity`. |
| Lifecycle | `singleTask`, recovery na renderercrash, pause/resume van media bij Home, native recoverymenu, D-pad/OK/BACK/Home/media keys en native full-screen gedrag blijven bestaan. |
| Boot/update | `BootCompletedReceiver` verwerkt `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET` en `TIMEZONE_CHANGED`. Behoud autostartvoorkeur, cooldown en de bestaande automation scheduler. Autostart op echte hardware verifiëren. |
| Native instellingen | SharedPreferences `veyocast_native_settings` met onder meer `boot_start_enabled` en `staging_demo_mode_enabled` behouden. Automation SharedPreferences `veyocast_screen_automation` en de begrensde reportqueue behouden of expliciet en verliesvrij migreren. |
| Native recovery | `NativeRecoveryIdentity.kt` leidt credential af uit de bestaande domeinscheiding `veyocast-android-reinstall-v1`, environment, package en Android-ID. Cookie heet `veyocast_native_recovery`; het servercontract staat ook in `apps/player/app/_lib/player-native-recovery.ts`. Identiteits- en originveranderingen kunnen herstel breken en zijn geen cosmetische wijziging. |
| WebView-opslag | Pairing, localStorage, IndexedDB, Cache Storage en cookies blijven behouden bij de update. Geen `clearData`, `pm clear`, uninstall/reinstall, generieke cache-reset of nieuwe WebView-datadirectory als updateprocedure. |
| Web runtime-opslag | `apps/player/app/_lib/player-storage.ts` bevat de canonieke keys zoals `veyocast.player.deviceToken`, `veyocast.player.instanceId` en recovery/pairingkeys. Behoud de exacte keynamen of voer aantoonbaar werkende expliciete migratie uit. |
| Offline release | `player-cache.ts` gebruikt Cache Storage `veyocast-player-assets-v1`, IndexedDB `veyocast-player-cache-v1`, stores `activeReleases`/`previousReleases`, byteverificatie, pending→active overgang en bestaande migraties. Behoud last-known-good, vorige release, rollback, cacheverificatie en lokale boot bij netwerkverlies. |
| Automationbridge | Behoud `veyocast.player.automation.v1`, `veyocast.player.automation.report.v1`, `veyocast.player.automation.capabilities.v1` en bijbehorende envelope/acknowledgementsemantiek. Native polling staat in `MainActivity.kt` op 15 seconden; geen UI-refactor die dit protocol weggooit. |
| Veilig laden | Same-origin top-level navigation, geen third-party cookies, SSL-fouten blokkeren, geen mixed content, file/content-access uit, release-WebViewdebugging uit, URL-override alleen lokale debughosts. Behoud deze grenzen bij het nieuwe opstartscherm. |
| Deviceprofiel | User agent blijft `VeyoCastAndroid/<version>` en `VeyoCastFormFactor/<general|tv>` doorgeven. Behoud capabilities en serverselectie; een nieuwe UI mag geen vals platformprofiel introduceren. |

Het nieuwe splashscreen verandert alleen de presentatie van boot/koppelen/laden/herstellen. Het mag last-known-good content niet onnodig afdekken en mag niet met een kunstmatige timer de overgang naar werkende playback vertragen. Toon de echte bestaande status; heartbeat ontvangen is niet hetzelfde als release zichtbaar bevestigd. Gebruik de exacte hero en dezelfde statusopbouw als de Sites-playerreferentie.

## Native Control: functionele invarianten

De beheerdersapp is een afzonderlijke native Expo-app en blijft functioneel naast de Players bestaan. Behoud ten minste:

- Aanmelden en sessievernieuwing, tenantselectie, rechten, biometrische app-lock, schermkoppelen via code/camera, cockpit, schermstatus en opdrachten.
- Camera/mediakeuze, tenantgescheiden uploadqueue met retry, content en playlists, plaatsingthema's, Studio, schermcompositie, Engage, notificatievoorkeuren, account- en verwijderingsverzoeken.
- SecureStore-prefix `veyocast.control.auth.` en geselecteerde tenantkey `veyocast.control.tenant`. Geen accountreset tijdens de UI-upgrade.
- SQLite-database `veyocast-control.db`, `tenant_cache`, `image_upload_queue`, lokaal opgeslagen uploadbestanden onder `control-uploads` en tenantisolatie. Een nog niet verstuurde foto blijft na de update beschikbaar voor dezelfde tenant.
- Productieorigin `https://control.veyocast.nl`, extra `controlOrigin`, scheme `veyocast-control` en geverifieerde `https://control.veyocast.nl/mobile` app links.
- De gebruikte `/api/mobile/v1/*` en `/api/mobile/v2/*` contracten uit `src/api/mobile-api.ts`: Bearer-autorisatie, `X-VeyoCast-Tenant-Id`, schema- en fout-envelopes, requestId's, tijdslimiet en herstelgedrag. Serverimplementatie compatibel houden zolang geïnstalleerde oude apps deze routes nog gebruiken.
- Bestaande notificatieregistratie en routes, permission-minimalisatie, `allowBackup=false`, geen ongevraagde locatietoegang/contacten/microfoon of advertising-ID-permissie.

De Sites-UI is de visuele referentie. Native navigatie, veilige opslag en platforminteractie mogen niet worden vervangen door een webpagina zonder gelijkwaardig gedrag. Map dezelfde spacing, typografie, kleur, iconen, labels, hiërarchie, states en interacties naar native componenten en controleer die op echte apparaten.

## App-icon en hero: concrete levering

Onder `assets/android-icon-kit/` staan de exacte Sites-bronvectors, reproduceerbare exports, Android resources, legacy/round/dpi-iconen, Expo-iconen en een TV-banner. Het bronlogo is niet nagetekend of opnieuw gegenereerd. Alleen canvas, padding, platformmasker en exportschalen zijn aangepast. De geometrie en kleuren van `brand-icon.svg` blijven gelijk; het TV-woordmerk komt ongewijzigd uit `full-light.svg`.

De huidige Player-manifests verwijzen naar `@drawable/veyocast_launcher_icon` en `@drawable/veyocast_tv_banner`; de kit behoudt die namen. Beide modules delen de resources uit `apps/android-tv/app/src/main/res`, dus integreer daar en test beide builds. Zie de precieze mapping in `assets/android-icon-kit/README.md`.

Control gebruikt nu `../../assets/brand/veyocast-social-avatar-1024.png` en `../../assets/brand/veyocast-icon-512.png`. De kit levert doelbestanden voor afzonderlijk launcher- en adaptivegebruik; wijs de Expo-config expliciet naar deze nieuwe exports of vervang de bestaande launcherasset met behoud van paden. Gebruik de 56%-safezone-foreground niet als vervanger van alle inhoudelijke logo's of het hero-beeld. Het splash-pluginbeeld krijgt een bewuste aparte koppeling; een iconupdate mag het player-hero-ontwerp niet reduceren tot een klein OS-launchericon.

De hero staat exact in de Sites-bron onder `public/assets/brand-hero.png` plus de bestaande WebP-varianten. Kopieer de originele bytes naar het runtimeassetpad en bevestig de SHA-256. Gebruik `contain`/`fitCenter`, dezelfde achtergrond en compositie als de Sites-playerreferentie, nooit crop/retouch of nieuwe AI-generatie. Bundel/precache de hero zodat eerste boot zonder internet geen ontbrekend beeld laat zien. Het Android OS-opstarticon en het volledige in-app hero-opstartscherm zijn afzonderlijke lagen: neem het volledige artwork op in de in-app fase waar 16:9 en 9:16 passend kunnen worden weergegeven.

## Verplichte bewijsreeks voor een echte update

| Proef | Startconditie | Geslaagd wanneer |
|---|---|---|
| Oude installatie → nieuwe Player | Werkelijke bestaande release, gekoppeld, actieve en vorige release gecachet | Update via bestaande track of passend gesigneerde APK; zelfde package en app-signingidentiteit; geen tweede app; geen opnieuw koppelen; release en voorkeuren behouden |
| TV in-place | Bestaande Google/Android TV-installatie | Eén Player-launcher, juiste banner/icon, TV-activity resolveert en start, D-pad/OK/BACK/Home werken, updatecode hoger |
| Control in-place | Bestaande Control met sessie, tenant, biometrie en pending fotoupload | Nieuwe UI/icon; sessie/tenant/rechten intact; biometrie werkt; pending upload blijft correct tenantgescheiden en kan hervatten |
| Offline start na update | Eerst geldige release en media aanwezig, daarna netwerk uit en app/apparaat herstart | Hero lokaal beschikbaar, last-known-good speelt; koppeling blijft; reconnect zonder reload-loop of onnodige downloads |
| Herstel | Renderer beëindigen, tijdelijke HTTP-fout en geweigerd SSL-certificaat | Begrensd herstel, begrijpelijke status, geen verlies van pairing/cache, SSL blijft geblokkeerd |
| Publicatie | Oude appversie en nieuwe appversie tegelijk gekoppeld | Beide blijven servercontracten verstaan; nieuwe release voorbereid, geverifieerd en veilig geactiveerd; zichtbaar bevestigd wordt apart bewezen |
| Branding | Telefoon, tablet, TV, landscape/portrait | Exacte Sites-kleuren/geometrie, geen maskercrop, geen vervorming; hero volledig zichtbaar, status/bediening niet afgesneden |
| Duurtest | Ten minste één telefoon/tabletprofiel en één echte TV-player | Minimaal 24 uur mixed-media, netwerkonderbreking, power cycle en tijdzone/openingstijden; geen vastlopers, onbeperkte telemetry of oplopende opslag |

Voer bestaande Gradle/Expo checks en relevante browser/runtimecontracttests uit. Archiveer per proef apparaatmodel, Android/WebView-versie, oude/nieuwe appversie, commit, teststappen, resultaat en alleen noodzakelijke geredigeerde logs. Test vervolgens de bestaande LG/webOS-player apart op de ongewijzigde gedeelde servercontracten; Android-succes bewijst geen LG-compatibiliteit.

**Nog te meten in de developmentomgeving:** geïnstalleerde releasecodes, actieve Play-tracks, app-signing/uploadcertificaatfingerprints, daadwerkelijke keystorelocaties en fysieke apparaatresultaten. Dit overdrachtspakket vervangt deze metingen niet en bevat bewust geen verzonnen releasebewijs.
