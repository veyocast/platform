# Android schermautomatisering

Status: code- en emulatortests vereist; fysieke hardware nog niet afgetekend
Toepassing: `nl.veyocast.player` voor algemeen Android en Google/Android TV

## Architectuur

De bestaande webplayer blijft bron van waarheid voor pairing, immutable
releases, playback, offline media en heartbeat. De native shell voegt alleen
platformlifecycle toe:

- `AutomationStore` bewaart het laatste schema en een begrensde eventqueue;
- `AutomationScheduleEvaluator` evalueert dezelfde precedentie als het
  TypeScript-contract;
- `AutomationScheduler` plant één volgende inexacte startpoging;
- `AutomationAlarmReceiver` registreert trigger en plant de Activity-start via
  een systeemalarm;
- `BootCompletedReceiver` herstelt na boot, appupdate, klok- en
  tijdzonewijziging;
- `MainActivity` synchroniseert via vertrouwde localStorage van de eigen
  Player-origin en past keep-awake toe.

Er is bewust geen `JavascriptInterface`: native en web wisselen alleen
gevalideerde, niet-geheime JSON uit via `evaluateJavascript` en drie
namespaced localStorage-sleutels.

## Gekozen wekmechanisme

VeyoCast gebruikt:

```text
AlarmManager.setAndAllowWhileIdle(RTC_WAKEUP, ...)
```

Dit is een inexact alarm zonder `SCHEDULE_EXACT_ALARM`. Bij iedere
configuratiewijziging wordt het vorige schedule-PendingIntent vervangen.
Na uitvoering wordt vanaf de geplande activatie de volgende periode berekend,
zodat de lead-time geen korte alarmlus kan veroorzaken.

Reden:

- secondenprecisie is niet nodig voor signagevoorbereiding;
- exact-alarmtoegang veroorzaakt Play-policy- en gebruikersfrictie;
- WorkManager is niet bedoeld als wandklokplanner;
- een permanente foreground service is buiten proportie en niet nodig.

Android kan het alarm door Doze of energiebesparing uitstellen. Een app die een
Activity-`PendingIntent` zelf verstuurt, voldoet niet automatisch aan Androids
Background Activity Launch-uitzonderingen. VeyoCast plant die expliciete
`PendingIntent` daarom via `AlarmManager`; Android levert hem als
systeemcomponent af. De manifests zetten `showWhenLocked` en `turnScreenOn`,
terwijl alleen een werkelijk hervatte Activity `player-visible` mag
rapporteren. VeyoCast registreert `wake-triggered`,
`activity-start-requested`, `player-visible` en `heartbeat-sent` afzonderlijk.

## Keep-awake

Zonder automation behoudt de app het bestaande gedrag:
`FLAG_KEEP_SCREEN_ON` zolang de Activity actief is.

Met automation is de flag alleen gezet wanneer:

- de configuratie geldig en niet verlopen is;
- het huidige moment binnen een actief bedrijfstijdvenster valt;
- `Scherm actief houden tijdens afspelen` aanstaat.

Buiten het venster wordt de flag vrijgegeven. De app vraagt geen CPU wake lock
aan. `setTurnScreenOn(true)` en `setShowWhenLocked(true)` worden voor een
automation-start op API 27+ gebruikt; dezelfde eigenschappen staan in beide
release-manifests zodat Android ze al tijdens een koude Activity-start kent.
Ook dit bewijst geen fysieke TV-status.

## Boot en update

Geregistreerde broadcasts:

- `BOOT_COMPLETED`;
- `MY_PACKAGE_REPLACED`;
- `TIME_SET`;
- `TIMEZONE_CHANGED`.

Na iedere relevante broadcast wordt het gecachte schema opnieuw geëvalueerd en
gepland. Alleen tijdens een actief venster volgt bij boot een best-effort
Activity-start. `singleTask` voorkomt dubbele Playeractivities. Pairing,
cookies, service-workercache, IndexedDB en mediacache worden niet gewist.

Fabrikanten kunnen bootstarts blokkeren. Google TV en gewone Android-apps
kunnen dit zonder managed device owner niet afdwingen.

## HDMI-CEC

Een normale Play-app heeft geen toegang tot Androids privileged
`HdmiControlManager`. VeyoCast verstuurt daarom geen directe CEC-opdracht en
vraagt geen systeempermissie. Op TV-apparaten kan het hervatten van de Activity
een platform-side One Touch Play of inputswitch veroorzaken. Dit blijft
`Waarschijnlijk ondersteund` of `Nog niet getest`.

`hardware_test_passed` mag alleen later door een afzonderlijk, aantoonbaar
hardwareprotocol worden gezet. Een heartbeat is daarvoor onvoldoende.

Gebruikershulp:

- LG: Simplink;
- Samsung: Anynet+;
- Philips: EasyLink;
- Sony: BRAVIA Sync.

De mediaspeler moet permanent van stroom blijven; voeding via de TV-USB-poort
kan een start onmogelijk maken.

## Permissies en Play-policy

Ongewijzigde permissies:

- `android.permission.INTERNET`;
- `android.permission.ACCESS_NETWORK_STATE`;
- `android.permission.RECEIVE_BOOT_COMPLETED`.

Niet toegevoegd:

- exact-alarmpermissies;
- foreground-servicepermissies;
- overlay-, accessibility- of device-adminrechten;
- privileged HDMI-CEC;
- FCM;
- camera, microfoon, locatie of opslag.

Dit wijzigt de Data Safety-categorieën niet. De capability- en
uitvoeringstelemetrie is technische appactiviteit en moet wel consistent met de
privacyverklaring worden gehouden.

## Cache en fouten

De server vernieuwt `cacheValidUntil` bij geldige heartbeats. Zonder nieuwe sync
vervalt een schema na zeven dagen. Ongeldige schema-versie, JSON, IANA-tijdzone
of cache-expiry faalt veilig: er wordt geen nieuw alarm ingepland. Een begrensde
queue bewaart maximaal veertig idempotente eventrapporten.

Als `Offline uitvoeren` uitstaat, slaat de native shell een geplande lokale
start over zodra Android geen gevalideerde internetverbinding rapporteert. De
volgende periode wordt wel opnieuw gepland. Dit verandert de bestaande
last-known-good mediacache niet.

Belangrijke foutcodes:

- `BACKGROUND_START_BLOCKED`;
- `BOOT_START_BLOCKED`;
- `OFFLINE_EXECUTION_DISABLED`;
- `PLAYER_HEARTBEAT_CONFIRMED`;
- databasezijde `COMMAND_EXPIRED`, `SUPERSEDED` en
  `PLAYER_HEARTBEAT_CONFIRMED`.

## Testprocedure

Code/CI:

```bash
./gradlew :app:testProductionDebugUnitTest
./gradlew :tv:testProductionDebugUnitTest
./gradlew :app:lintProductionDebug
./gradlew :tv:lintProductionDebug
./gradlew :app:assembleProductionDebug
./gradlew :tv:assembleProductionDebug
```

Fysiek, per model/firmware:

1. app permanent voeden en koppelen;
2. CEC op Player en televisie inschakelen;
3. TV in stand-by plaatsen;
4. online starttest uitvoeren;
5. trigger, Activity, heartbeat en fysiek beeld afzonderlijk noteren;
6. lokaal schedule online en offline testen;
7. netwerkherstel, reboot, appupdate en tijdzonewijziging testen;
8. CEC uitgeschakeld en voeding via TV-USB als negatieve scenario's testen;
9. HDMI-switch/receiver in het pad testen;
10. 24-uurs soak uitvoeren.

De huidige implementatie is niet fysiek getest in deze repositoryrun. Een
geslaagde Gradle- of emulatortest is geen hardwarebewijs. De gedetailleerde
oorzaakanalyse, remote-wakematrix en hardwareacceptatie staan in
[`docs/s59-android-remote-wake-analysis.md`](../s59-android-remote-wake-analysis.md).

## Ondersteuningsmatrix

| Platform | Lokaal schema | Inexacte start | Keep-awake | HDMI-CEC |
| --- | --- | --- | --- | --- |
| Algemene Android-app | Ja | Best effort | Ja, Activity zichtbaar | Niet direct |
| Android TV / Google TV | Ja | Best effort | Ja | Mogelijke platformbijwerking |
| Chromecast met Google TV | Ja | Best effort | Ja | Mogelijke platformbijwerking |
| Web/PWA/browser | Nee in v1 | Nee | Browserafhankelijk | Nee |
| LG webOS Signage | Adapter later | Nee in v1 | Eigen platformpad nodig | Niet via Android |
