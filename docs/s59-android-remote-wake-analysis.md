# S59 Android autostart en remote wake

Status: systeemstartpad geïmplementeerd; fysieke hardware- en remote-channelkeuze open
Datum: 29 juli 2026
Scope: algemene Android Player, Android TV en Google TV

## Aanleiding en vastgestelde oorzaak

Een echte production Player rapporteerde na een normale Play-update:

`BACKGROUND_START_NOT_VISIBLE`

De ontvanger kreeg `MY_PACKAGE_REPLACED` en maakte een Activity-
`PendingIntent` met de vereiste Android 14+-senderopt-in en Android 15+-
creatoropt-in. De app verstuurde die `PendingIntent` daarna echter zelf.
Android accepteert `PendingIntent.send()` zonder exception, maar start de
Activity alleen wanneer creator of sender ook een algemene Background Activity
Launch-uitzondering heeft. Een gewone niet-zichtbare Play-app heeft die niet.
Android meldt deze blokkade uitsluitend intern in `ActivityTaskManager`;
VeyoCast ontdekte hem daarom terecht met de onafhankelijke
zichtbaarheidsverificatie.

Officiële grond:

- [Background activity launch restrictions](https://developer.android.com/guide/components/activities/secure-bal)
- [Android 14 background activity launch changes](https://developer.android.com/about/versions/14/behavior-changes-14)
- [Pending intents](https://developer.android.com/guide/components/intents-filters#PendingIntent)

## Geïmplementeerde reparatie

Boot, normale Play-update, lokaal schema en ontvangen testopdracht gebruiken
dezelfde launcher. Die plant de expliciete Activity-`PendingIntent` nu via
`AlarmManager.setAndAllowWhileIdle()`. Androids `AlarmManager` verstuurt de
`PendingIntent` vervolgens als systeemcomponent. Dat valt onder de gedocumenteerde
BAL-uitzondering voor een door het systeem verzonden `PendingIntent`.

De Activity verklaart bovendien `showWhenLocked` en `turnScreenOn` in beide
release-manifests. De bestaande runtime-aanroep blijft als defensieve
compatibiliteitslaag. Een start telt pas als `PLAYER_VISIBLE` in `onResume`;
alleen `onCreate` is geen zichtbaarheidsbewijs.

Er komen bewust geen exact-alarm-, overlay-, accessibility-, foreground-
service-, device-admin- of verborgen HDMI-CEC-permissies bij.

## Wat dit oplost

- autostart na `BOOT_COMPLETED` krijgt een systeemverzonden startpad;
- heropenen na `MY_PACKAGE_REPLACED` gebruikt hetzelfde pad;
- een lokaal automation-alarm dat al door Android werd afgeleverd kan de
  Player via het systeem laten openen;
- een ontvangen online testopdracht gebruikt hetzelfde herbruikbare pad;
- zichtbaarheid wordt niet meer te vroeg in `onCreate` positief gemeld;
- een toegestane Activity kan het lokale display laten inschakelen.

Een inexact alarm blijft door Doze, batterijbeleid of fabrikantsoftware
vertraagbaar. Op Android 13+ kan een app in de batterijstatus `Restricted`
zelfs `BOOT_COMPLETED` missen totdat hij om een andere reden wordt gestart:
[Background optimization](https://developer.android.com/topic/performance/background-optimization).

## Wat een gewone Play-app niet kan garanderen

### Volledig uitgeschakeld

Software op het apparaat draait niet wanneer televisie of Android Player echt
spanningsloos is. Geen app, FCM-bericht of heartbeat kan dat apparaat dan
bereiken. Alleen standby met actieve netwerk-/wakehardware is automatiseerbaar.

### Directe HDMI-CEC

`HdmiControlManager` is een privileged System API. Een gewone Play-app kan
geen betrouwbare CEC One Touch Play-opdracht versturen. Android TV-
playbackapparaten kunnen bij een platform-wake zelf proberen de HDMI-televisie
via CEC in te schakelen, maar VeyoCast mag dat pas per model/firmware als
hardwareondersteuning claimen:

- [AOSP HDMI-CEC control service](https://source.android.com/docs/devices/tv/hdmi-cec)
- [PowerManager wake behavior](https://developer.android.com/reference/android/os/PowerManager#ACQUIRE_CAUSES_WAKEUP)

### MAC-adres als identiteit of universele wake

Android beperkt sinds Android 6 toegang tot het echte MAC-adres tot
systeemapps. Een derde-partijapp moet een app-scoped installatie-ID gebruiken:
[Best practices for unique identifiers](https://developer.android.com/identity/user-data-ids#mac-11-plus).

Wake-on-LAN werkt bovendien alleen wanneer het concrete apparaat en zijn
standbymodus het ondersteunen en een zender het lokale netwerk kan bereiken.
Een cloudserver kan geen LAN-broadcast door NAT sturen. Vanaf target SDK 37
vereist UDP unicast/multicast/broadcast ook de runtimepermissie
`ACCESS_LOCAL_NETWORK`:
[Local network permission](https://developer.android.com/privacy-and-security/local-network-permission).

## Realistische remote-wakeroutes

| Route | Bereik | Betrouwbaarheid | Randvoorwaarden |
| --- | --- | --- | --- |
| Lokaal schema + systeemalarm | Zelfde Android-apparaat | Best effort | Standby, alarm niet door OEM geblokkeerd |
| FCM wake-command | Via internet naar slapend Android | Best effort | Google Play services, netwerkstandby, expliciete opt-in, beperkte hoge prioriteit |
| Control Mobile Wake-on-LAN | Alleen hetzelfde LAN | Modelafhankelijk | Handmatig MAC-adres, netwerkstandby, Android 17 LAN-permissie |
| Android Enterprise kiosk | Boot/update zeer betrouwbaar | Hoog voor appstart | Volledig beheerd/dedicated device, provisioning |
| VeyoCast Edge-gateway | Cloud naar lokaal WOL/CEC | Hoogst voor vaste locaties | Altijd-aan gateway en hardwareprofiel |

FCM kan een slapend Android-apparaat voor korte verwerking wekken, maar geeft
op zichzelf geen recht om een Activity te tonen. Het bericht moet daarom alleen
een servercommandnonce dragen; de Player haalt het echte commando
geauthenticeerd op en gebruikt daarna het gerepareerde systeemalarmpad. Hoge
prioriteit moet spaarzaam en met zichtbaar effect worden gebruikt, anders kan
Google de berichten degraderen:
[FCM message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority).

## Aanbevolen productrichting

1. **Nu:** publiceer het systeemalarmpad en valideer boot, Play-update,
   standby en CEC fysiek op ieder ondersteund profiel.
2. **Standaard Play:** blijf eerlijk `best effort` tonen en bied een
   capabilitytest per apparaat; beloof geen hard power-on.
3. **Remote via internet:** voeg een apart, nonce-/TTL-gebonden FCM-kanaal toe.
   Bewaar een FCM-token apart van pairing en registreer delivery, activity,
   zichtbaarheid en heartbeat afzonderlijk.
4. **Zakelijke garantie:** bied een managed-signageprofiel via Android
   Enterprise `installType: KIOSK`. De kiosk-app start dan automatisch bij boot:
   [Dedicated-device policies](https://developers.google.com/android/management/policies/dedicated-devices).
5. **Locaties met harde SLA:** gebruik een permanent gevoede Android TV-box
   met CEC of een VeyoCast Edge-gateway. Voed de Player nooit via de USB-poort
   van de televisie.

## Fysiek acceptatieprotocol

Per model, firmware, Android-versie en voedingsopstelling:

1. installeer de Play-signed build en open hem eenmaal;
2. zet Autostart aan en batterijgebruik op `Unrestricted` wanneer het apparaat
   die instelling aanbiedt;
3. herstart het apparaat volledig en controleer `PLAYER_VISIBLE`;
4. voer een normale Play-update uit en controleer opnieuw;
5. plaats de televisie in standby met VeyoCast als laatste zichtbare app;
6. voer een lokaal schema en een ontvangen testopdracht uit;
7. herhaal met CEC aan en uit;
8. test voeding uit stopcontact en, als negatieve proef, via TV-USB;
9. noteer `wake-triggered`, `activity-start-requested`, `player-visible`,
   heartbeat en fysiek paneel als afzonderlijke bewijzen;
10. voer een 24-uurs soak uit.

Alleen fysieke beeldbevestiging mag `hardware_test_passed` zetten.
