# Android TV launcherincident

## Incident

Google Play leverde TV-versie `200000201` van `nl.veyocast.player` succesvol
aan een Chromecast met Google TV HD. De TV-launchertegel was zichtbaar, maar
Openen startte geen bruikbare Activity.

## Bewezen oorzaak

Het samengevoegde productionmanifest van het uitgebrachte AAB wees correct naar:

```text
nl.veyocast.player.MainActivity
```

met één `MAIN`/`LEANBACK_LAUNCHER` en `exported=true`. De bijbehorende
releasebuild logde echter:

```text
:tv:compileProductionReleaseKotlin NO-SOURCE
:tv:compileProductionDebugKotlin NO-SOURCE
:tv:testProductionDebugUnitTest NO-SOURCE
```

De TV-module deelde de Kotlinmap via `java.srcDirs`. Android Gradle Plugin 9.3
gebruikt voor ingebouwde Kotlin afzonderlijke Kotlin-bronsets; daardoor
compileerde de TV-module geen enkele VeyoCast Kotlinbron. De AAB bevatte wel de
manifestcomponent, maar niet de klassen
`nl.veyocast.player.MainActivity` en
`nl.veyocast.player.BootCompletedReceiver` in de DEX. De oude statische
workflowcontrole keek alleen naar strings en het bronmanifest en kon dit niet
detecteren.

## Correctie

- de gedeelde hoofd- en testbronnen zijn als `kotlin.srcDirs` geregistreerd;
- de TV-manifest noemt de launcherklasse volledig gekwalificeerd;
- de launcher is expliciet `enabled=true` en `exported=true`;
- de algemene Android-module en haar manifest zijn niet gewijzigd;
- application ID blijft uitsluitend `nl.veyocast.player`.

## Permanente releasegate

`scripts/validate-tv-bundle.sh` inspecteert met bundletool de uiteindelijke AAB
en verifieert:

1. application ID en gereserveerde TV-versionCode;
2. alle MAIN- en launchercategorieën;
3. exact één Leanback-launcher;
4. volledig opgeloste Activityklasse;
5. enabled/exported;
6. aanwezigheid van Activity en bootreceiver in de release-DEX.

De handmatige TV-publicatieworkflow bouwt daarna een APK-set uit exact hetzelfde
ondertekende production-AAB, installeert die op Android TV API 34 en voert uit:

```bash
adb shell cmd package resolve-activity \
  --brief \
  -a android.intent.action.MAIN \
  -c android.intent.category.LEANBACK_LAUNCHER \
  nl.veyocast.player

adb shell am start -W \
  -a android.intent.action.MAIN \
  -c android.intent.category.LEANBACK_LAUNCHER \
  -p nl.veyocast.player
```

`scripts/validate-tv-launcher-on-device.sh` vereist een succesvolle resolve,
`Status: ok`, de juiste gestarte Activity, een actieve Activity in `dumpsys` en
geen klasselader- of fatale procesfout in logcat. Het ondertekende AAB en alle
bewijzen worden vóór publicatie als GitHub-artifact bewaard. Alleen daarna mag
de workflow naar `tv:internal` publiceren.
