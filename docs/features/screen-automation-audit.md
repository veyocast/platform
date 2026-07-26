# Screen Automation — architectuur- en capability-audit

Status: initiële audit vóór implementatie
Datum: 26 juli 2026
Scope: Android, Android TV, Google TV en Chromecast met Google TV

## Bestaande architectuur

- Schermbeheer staat in
  `apps/control/app/(shell)/dashboard/screens/[screenId]/page.tsx`.
  Het schermdetail gebruikt tabs voor Overzicht, Content, Planning, Gezondheid,
  Instellingen en Activiteit. Automatisering hoort als afzonderlijke tab in
  deze bestaande shell.
- `screens` is de tenantresource. Een gekoppelde `player_devices`-rij bevat
  device-identiteit, platform, appversie, capabilities, desired/active release,
  laatste heartbeat en lifecycle. De device-token wordt uitsluitend gehasht
  opgeslagen.
- De Player verstuurt iedere 30 seconden een bearer-authenticated heartbeat via
  `/api/player/heartbeat`. `record_player_heartbeat_v2` valideert de
  token/schermrelatie, schrijft heartbeat- en syncstatus en actualiseert
  capabilityvelden op het device.
- Control gebruikt `tenant.screen.read` voor lezen en
  `tenant.screen.manage` voor mutaties. Custom tenantrollen erven dit bestaande
  capabilitymodel. Server-RPC's controleren de actieve tenant en schermrelatie;
  alleen UI-verbergen is niet voldoende.
- Audit-events zijn append-only en bevatten al scherm-, pairing-, device- en
  synccommando's. Automatiseringsmutaties, disclaimeracceptatie en testopdrachten
  moeten hetzelfde patroon gebruiken.
- Contentplanning is een afzonderlijk domein in `content_schedules`. Deze
  planning bepaalt welke immutable release zichtbaar moet zijn. Screen
  Automation bepaalt wanneer het apparaat actief probeert te worden en
  dupliceert dit release-/publicatiemodel niet.
- De tenanttijdzone staat in `tenant_settings.timezone_name`. Bestaande
  planning valideert tijdzones tegen PostgreSQL `pg_timezone_names`.
- Playercontent, device-token en last-known-good releases blijven in bestaande
  localStorage/IndexedDB/Cache Storage bewaard. Automatiseringsconfiguratie mag
  pairing of mediacache bij reboot, update of tijdelijk offlinegebruik niet
  verwijderen.

## Bestaande Android-implementatie

- De algemene app en de afzonderlijke TV-deliverymodule delen dezelfde Kotlin-
  en resourcebron. Beide gebruiken application-id `nl.veyocast.player`.
- `MainActivity` is `singleTask`, fullscreen, hardware accelerated en gebruikt
  een beveiligde WebView-shell. De app houdt nu het scherm tijdens de volledige
  Activity-lifecycle actief met `FLAG_KEEP_SCREEN_ON`.
- `BootCompletedReceiver` bestaat en doet alleen een begrensde best-effort
  Activity-start wanneer de lokale gebruiker autostart heeft ingeschakeld.
- `RECEIVE_BOOT_COMPLETED`, `INTERNET` en `ACCESS_NETWORK_STATE` zijn de enige
  huidige permissies. Er is geen WorkManager, AlarmManager, foreground service,
  Firebase Cloud Messaging, exact-alarmpermissie of native HDMI-CEC-interface.
- Appvoorkeuren blijven via private `SharedPreferences` tussen starts behouden.
  WebView-cookies, DOM storage, service worker- en HTTP-cache worden niet
  onnodig gewist.

## Platformgrenzen

### Inexact plannen

Android adviseert inexacte alarmen voor door gebruikers ingestelde acties die
na een bepaald tijdstip mogen plaatsvinden. Vanaf Android 12 kan een inexact
alarm tot ongeveer een uur na de vroegste triggertijd worden geleverd en door
batterijbesparing verder worden uitgesteld. VeyoCast mag dus geen exacte
starttijd beloven.

Bron:
[Schedule alarms — Android Developers](https://developer.android.com/develop/background-work/services/alarms)

Besluit voor v1:

- gebruik één inexact `AlarmManager.setAndAllowWhileIdle`-alarm voor de
  eerstvolgende relevante overgang;
- plan na iedere uitvoering, configuratiesync, reboot, app-update, klok- of
  tijdzonewijziging opnieuw;
- vraag geen `SCHEDULE_EXACT_ALARM` of `USE_EXACT_ALARM`;
- gebruik geen continue foreground service.

### Activity-start vanuit de achtergrond

Android beperkt achtergrondstarts sinds Android 10 en heeft die regels in
latere versies aangescherpt. Een ontvangen lokaal alarm bewijst daardoor niet
dat een Activity zichtbaar werd. Een boot- of alarmreceiver mag uitsluitend een
best-effort startpoging registreren; een latere Player-heartbeat is de eerste
serverzijde bevestiging dat de runtime actief is.

Bron:
[Activity security / background activity launches — Android Developers](https://developer.android.com/guide/components/activities/secure-bal)

### Scherm aan en actief houden

`Activity.setTurnScreenOn(true)` mag een zichtbaar hervatte Activity het lokale
display laten inschakelen. `FLAG_KEEP_SCREEN_ON` is de ondersteunde manier om
een zichtbare Activity, inclusief Android TV Ambient Mode, tijdens actief
gebruik wakker te houden. De flag moet buiten een geautomatiseerd actief venster
worden vrijgegeven; bestaande apparaten zonder automatisering behouden hun
huidige keep-awakegedrag.

Bronnen:

- [Activity.setTurnScreenOn — Android Developers](https://developer.android.com/reference/android/app/Activity#setTurnScreenOn(boolean))
- [Keep the screen on — Android Developers](https://developer.android.com/develop/background-work/background-tasks/awake/screen-on)

### HDMI-CEC

Androids `HdmiControlManager` is een `@SystemApi`. De HDMI Control Service is
alleen toegankelijk voor systeemcomponenten en privileged apps in
`/system/priv-app`; een normale Play Store-app kan geen directe CEC-opdracht
versturen of de CEC-configuratie betrouwbaar uitlezen.

Bron:
[HDMI-CEC control service — Android Open Source Project](https://source.android.com/docs/devices/tv/hdmi-cec)

Besluit voor v1:

- geen privileged HDMI-permissie aanvragen;
- alleen een lokale Activity-/display-startpoging doen;
- een eventuele HDMI-CEC One Touch Play of inputswitch behandelen als
  platform-/hardwarebijwerking;
- capability standaard `unknown`/`Nog niet getest`, hooguit
  `probably_supported`/`Waarschijnlijk ondersteund` na expliciete
  apparaattest;
- nooit `hardware_test_passed` afleiden uit een heartbeat;
- nooit melden dat het fysieke televisiepaneel beeld toont zonder afzonderlijke
  verifieerbare hardwarefeedback.

## Platformmatrix voor eerste rollout

| Platform | Schema lokaal | Startpoging | Keep-awake | HDMI-CEC | Fysiek paneel verifieerbaar |
| --- | --- | --- | --- | --- | --- |
| Algemene Android-app | Ja | Best effort | Ondersteund wanneer Activity zichtbaar is | Niet beschikbaar | Nee |
| Android TV / Google TV | Ja | Best effort | Ondersteund wanneer Activity zichtbaar is | Waarschijnlijk als platformbijwerking, niet direct bestuurbaar | Nee |
| Chromecast met Google TV | Ja | Best effort | Ondersteund wanneer Activity zichtbaar is | Waarschijnlijk als platformbijwerking, afhankelijk van voeding/TV/poort | Nee |
| Web/PWA | Alleen server-/browserconfig | Niet beschikbaar | Browserafhankelijk | Niet beschikbaar | Nee |
| LG webOS Signage | Adapter nog niet gebouwd | Niet beschikbaar in deze sprint | Platformadapter nog niet gebouwd | Niet via Androidadapter | Nee |
| Generieke browser | Alleen serverconfig | Niet beschikbaar | Browserafhankelijk | Niet beschikbaar | Nee |

## Hergebruik en ontbrekende bouwstenen

Hergebruiken:

- scherm- en device-identiteit;
- `tenant.screen.manage`;
- heartbeatpolling;
- `player_devices.capabilities`;
- audit-events;
- tenanttijdzone;
- bestaande Control-detailtabs en statuscomponenten;
- bestaande Android WebView-shell, bootreceiver en private appvoorkeuren.

Toevoegen:

- tenantveilige settings, weekperioden, datumuitzonderingen, testcommando's en
  execution events;
- versie-1 Zod-contracten en een gedeelde TypeScript-schema-evaluator;
- server-RPC's voor gevalideerd opslaan en testen;
- heartbeatresponse met alleen niet-geheime automatiseringsconfiguratie en
  openstaande device-opdracht;
- lokaal gecachte, versiegebonden Androidconfiguratie en gedeelde
  parity-fixtures;
- inexact alarm, systeemwijzigingsreceiver, schedule-aware keep-awake en
  gestructureerde statusrapportage;
- Control-tab Automatisering en een compacte indicator in de schermvloot.

## Veiligheids- en rolloutbesluiten

- Bestaande schermen starten met automation en HDMI-CEC uitgeschakeld.
- Bestaand keep-awakegedrag verandert niet zolang automation niet is
  geconfigureerd.
- De server blijft leidend; Android bewaart alleen de laatste gevalideerde
  operationele configuratie en geen tenant- of device-secret.
- Een ingetrokken device kan offline nog tijdelijk lokale content tonen. De
  bestaande heartbeat-/manifestintrekking blijft leidend zodra verbinding
  terugkeert; automatisering introduceert geen tweede revocatiemechanisme.
- Remote testen gebruikt de bestaande heartbeatpolling. Een volledig offline
  device kan met deze architectuur niet op afstand worden gewekt.
- De UI wordt pas uitvoerbaar wanneer backend en ondersteunde appversie zijn
  uitgerold; oudere of niet-Android Players krijgen capability-aware uitleg.
