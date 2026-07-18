# LG webOS Signage: hosted versus packaged

## Documentstatus

- **Onderzoeksdatum:** 18 juli 2026
- **Doel:** bepalen wanneer Castivo kan volstaan met een gewone HTTPS-player en wanneer een geïnstalleerde hosted of packaged LG webOS Signage-app nuttig of noodzakelijk wordt.
- **Voorlopige aanbeveling:** begin met de bestaande HTTPS-player op een expliciet ondersteund `Play via URL`-model. Voeg pas een LG-wrapper toe wanneer fysieke tests aantonen dat lifecycle, autostart, screensaver, opslag of device-integratie niet betrouwbaar genoeg zijn.

Dit document maakt bewust onderscheid tussen drie deploymentvormen:

1. een gewone HTTPS-URL, geopend via de browser of de Signage-functie `Play via URL`;
2. een geïnstalleerde **hosted webOS-app**: een klein lokaal pakket met appmetadata en een redirect naar de extern gehoste Castivo-player;
3. een **packaged webOS Signage-app** waarvan de applicatieshell en eventueel aanvullende services lokaal als pakket worden geïnstalleerd.

De voorlopige classificatie voor Castivo is **hosted webplayer met beperkingen**. Er is nog geen bewijs dat een volledig packaged app noodzakelijk is, maar evenmin voldoende bewijs om een gewone URL al als productiegeschikt te verklaren.

## Belangrijke bewijsgrens

LG publiceert voor webOS Signage een officiële developerportal met SCAP, IDCAP, JavaScript-services, SDK's en firmware-informatie. De gedetailleerde documentatie is echter partner-only. De openbare portal noemt onder meer webgebaseerde apps, gapless playback en multiple video tags, maar publiceert geen algemene, openbare tabel met Chromiumversies, web-API's, codecprofielen, opslagquota of firmwaregedrag per Signage-model.

- [LG webOS Signage Developer](https://webossignage.developer.lge.com/)
- [LG Signage Developer contact en model-/platformafhankelijke support](https://webossignage.developer.lge.com/contact)

LG publiceert zulke tabellen wel voor **webOS TV**. Die documentatie is nuttig om testgevallen en compatibiliteitsrisico's te bepalen, maar is **geen bewijs voor webOS Signage**. Een webOS TV-platformnummer mag niet stilzwijgend worden gelijkgesteld aan een webOS Signage-platformnummer. Ook gelijke marketingnamen zoals “webOS 6.0” bewijzen niet dat browserengine, firmware, decoderlimieten en beschikbare API's identiek zijn.

Alle uitspraken uit TV-documentatie worden hieronder daarom expliciet als vergelijkingsmateriaal behandeld. Definitieve Signage-status vereist:

- exact LG-model;
- webOS Signage-platformversie;
- firmwareversie;
- relevante SCAP/IDCAP-documentatie voor dat platform;
- een fysieke capability-, playback-, offline-, reboot- en soaktest.

## De drie deploymentvormen

### 1. Gewone HTTPS-URL of `Play via URL`

De Castivo-player wordt rechtstreeks vanaf een HTTPS-origin geladen. Op specifieke LG Signage-modellen is `Play via URL` een officiële productfeature. Voorbeelden:

- de [LG WP600](https://solutions.lg.com/us/digital-signage/lg-wp600) vermeldt webOS Signage 6.0, `Play via URL`, vier videotags, gapless playback, screen rotation, SI Server Setting en Wake on LAN;
- de [LG 55UL3J-M](https://www.lg.com/ca_en/business/digital-signage/standard-digital-signage/55ul3j-m/) vermeldt webOS 6.0, `Play via URL`, vier videotags, gapless playback en Wake on LAN.

Dit bewijst dat de URL-route op die modellen als productfunctie bestaat. Het bewijst niet dat iedere URL na power-on automatisch start, dat browseropslag een reboot overleeft, of dat iedere combinatie van codec, resolutie en meerdere videotags werkt.

**Sterke punten**

- geen eigen LG-pakketdistributie voor iedere Castivo-release;
- centrale deployment en directe rollback van webcode;
- één HTTPS-origin voor API, service worker, Cache Storage en IndexedDB;
- dezelfde device- en releaseprotocollen als andere webplayers;
- laagste operationele complexiteit voor een eerste hardwarepilot.

**Beperkingen en open vragen**

- een gewone browserpagina heeft niet automatisch een LG-appidentiteit;
- webOS-specifieke APIs zijn niet als standaard browser-API beschikbaar;
- kioskweergave, screensaver, autostart en power recovery zijn model- en configuratieafhankelijk;
- service-workerregistratie en opslagbehoud na appafsluiting of reboot zijn niet publiek door LG gegarandeerd;
- een succesvolle desktop-Chromiumtest zegt niets definitiefs over het LG-apparaat.

### 2. Geïnstalleerde hosted webOS-app

LG definieert voor webOS TV een hosted web app als een lokaal geïnstalleerd dummypakket met onder meer `appinfo.json`, iconen en een lokale startpagina die naar de extern gehoste applicatie verwijst. De echte applicatiecode blijft op de remote server en kan centraal worden bijgewerkt.

- [LG Web App Types](https://webostv.developer.lge.com/develop/getting-started/web-app-types)
- [LG App Templates](https://webostv.developer.lge.com/develop/getting-started/app-template)
- [LG appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)

Dit is officiële **webOS TV**-documentatie en dus alleen richtinggevend totdat de overeenkomstige Signage-partnerdocumentatie voor het doelmodel is gecontroleerd.

Een hosted wrapper is meer dan een web app manifest. `appinfo.json` is LG-appmetadata die door webOS wordt gebruikt voor installatie, identificatie en launch. Een standaard PWA-manifest verleent die LG-appstatus niet.

**Sterke punten**

- behoudt centrale deployment van de Castivo-webcode;
- geeft een geïnstalleerde appidentiteit en een LG-launchpoint;
- kan de route openen zonder dat een beheerder handmatig een browser-URL invoert;
- is een logische plaats voor toegestane `appinfo.json`-instellingen;
- kan, afhankelijk van Signage-platform en rechten, toegang geven tot LG-specifieke APIs;
- blijft veel dunner dan een volledig lokale playerfork.

**Beperkingen en open vragen**

- het lokale pakket bevat in hoofdzaak de redirect; een eerste koude load van de remote app blijft netwerkafhankelijk;
- offline werking blijft afhankelijk van eerder succesvol geïnstalleerde service worker, lokale shell en gevalideerde assets;
- een wrapper garandeert niet dat browseropslag persistent is;
- distributie, installatie, signing en firmwarecompatibiliteit worden een extra operationele stroom;
- beschikbare LG-API's en permissions moeten in de Signage-partnerdocumentatie worden bevestigd.

### 3. Packaged LG webOS Signage-app

Bij een packaged app staan de lokale applicatieshell en statische resources in het installeerbare pakket. Eventuele LG JavaScript-services en platformadapters worden samen met de app gedistribueerd. LG beschrijft voor webOS TV dat packagewijzigingen een nieuwe package-release vereisen; ook dit moet voor Signage via de partnerdocumentatie en gekozen distributieroute worden bevestigd.

**Sterke punten**

- lokale applicatieshell is niet afhankelijk van een eerste online navigatie;
- beste uitgangspositie voor gecontroleerde appidentiteit, launch en lifecycle-integratie;
- mogelijke toegang tot SCAP/IDCAP, lokale services en platformopslag;
- kan een platformadapter bieden zonder de platformonafhankelijke playercore te vervuilen;
- kan nuttig zijn wanneer browseropslag of power recovery aantoonbaar tekortschiet.

**Beperkingen**

- extra build-, signing-, distributie-, installatie- en updateproces;
- versies kunnen per Signage-platform of model uiteenlopen;
- lokaal packagebeleid en remote Castivo-releases moeten afzonderlijk worden beheerd;
- een `file:`-shell kan niet zonder meer dezelfde normale HTTPS-service-workerregistratie gebruiken;
- packaging verandert hardwaredecoder-, codec- of multi-video-limieten niet;
- een packaged app is geen reden om de immutable release- of last-known-good-garanties te versoepelen.

## Capabilityvergelijking

Legenda voor de kolom **LG-wrapperadvies**:

- **Noodzakelijk** — Castivo kan de capability niet betrouwbaar leveren zonder geïnstalleerde LG-integratie, zodra de genoemde voorwaarde geldt.
- **Waarschijnlijk nuttig** — een wrapper geeft aantoonbare architecturale voordelen, maar noodzaak moet nog worden bewezen.
- **Niet relevant** — packaging lost deze capability op zichzelf niet op.
- **Nader onderzoeken** — officiële Signage-documentatie of een fysieke test ontbreekt.

| Capability | Gewone HTTPS / Play via URL | Hosted webOS-app | Packaged Signage-app | LG-wrapperadvies |
|---|---|---|---|---|
| Centrale Castivo-deployment | Direct | Direct voor remote code | Package plus eventueel remote configuratie | Niet relevant |
| LG-appidentiteit | Niet gegarandeerd | Via lokaal app-pakket | Via lokaal app-pakket | Waarschijnlijk nuttig |
| `appinfo.json` | Niet van toepassing op gewone pagina | Onderdeel van wrapper | Onderdeel van package | Waarschijnlijk nuttig voor launch/screensaver |
| `Play via URL` | Modelspecifieke Signage-feature | Wrapper navigeert naar remote URL | Niet vereist voor lokale shell | Nader onderzoeken per model |
| SCAP-devicecontrole | Niet als standaard browser-API aannemen | Mogelijk, rechten/platform bevestigen | Waarschijnlijk beste integratiepunt | Nader onderzoeken |
| IDCAP-devicecontrole | Niet als standaard browser-API aannemen | Mogelijk, rechten/platform bevestigen | Waarschijnlijk beste integratiepunt | Nader onderzoeken |
| App lifecycle | Alleen web-events en browsergedrag | webOS-app lifecycle beschikbaar indien Signage dit zoals gedocumenteerd exposeert | Volledige appcontext | Waarschijnlijk nuttig |
| `visibilitychange` en herstel | Beschikbaar als web-API, fysiek testen | Verplicht onderdeel van appherstel | Verplicht onderdeel van appherstel | Niet relevant: altijd implementeren |
| Autostart na power-on | Niet bewezen door alleen `Play via URL` | Betere launch-identiteit, maar fysieke configuratie vereist | Beste uitgangspositie voor launchintegratie | Nader onderzoeken; noodzakelijk als URL-route faalt |
| Herstel na stroomuitval | Browser-/OS-configuratieafhankelijk | App kan opnieuw worden gestart; opslag blijft open vraag | Beste mogelijkheid voor platformadapter | Nader onderzoeken |
| Fullscreen zonder browserchrome | Verwacht bij Signage-weergavemodus, niet algemeen bewezen | Appcontext is waarschijnlijk geschikter | Appcontext is waarschijnlijk geschikter | Waarschijnlijk nuttig |
| Screensaverbeleid | Niet via LG-appmetadata te sturen | `appinfo.json` kan relevante instellingen dragen indien Signage ze ondersteunt | Idem | Waarschijnlijk nuttig; Signagegedrag onderzoeken |
| Schermrotatie/oriëntatie | Web-layout plus modelspecifieke Signage-instelling | Kan appmetadata/platform-API combineren | Kan appmetadata/platform-API combineren | Waarschijnlijk nuttig |
| Device identity | Castivo genereert eigen device-ID | Castivo-ID plus LG-appcontext | Castivo-ID plus LG-appcontext/platformdata | Niet noodzakelijk; LG-metadata nader onderzoeken |
| Service Worker API | Theoretisch op HTTPS, fysiek testen | Remote HTTPS-origin kan theoretisch dezelfde worker gebruiken | Lokale `file:`-shell gebruikt niet automatisch dezelfde worker | Niet relevant voor packaging; fysieke test nodig |
| Cache Storage | Origin-scoped webopslag, rebootbehoud onbekend | Zelfde remote origin; wrapper garandeert niets | Alternatieve lokale adapter mogelijk | Nader onderzoeken |
| IndexedDB | Origin-scoped webopslag, rebootbehoud onbekend | Zelfde remote origin; wrapper garandeert niets | Alternatieve DB/platformopslag mogelijk | Nader onderzoeken |
| Storage estimate/persist | Alleen bij aanwezige API; `persist()` mag weigeren | Zelfde web-APIbeperking | Platformadapter kan alternatief bieden | Nader onderzoeken |
| Last-known-good release | Door Castivo-code en opslagadapter | Zelfde releaseprotocol | Zelfde protocol met mogelijke native store | Niet relevant: architectuur blijft verplicht |
| Atomic release update | Door Castivo-playercore | Door Castivo-playercore | Door Castivo-playercore | Niet relevant |
| Offline app shell | Service worker moet aantoonbaar werken | Remote shell blijft afhankelijk van service-workerinstallatie | Lokale package-shell beschikbaar | Noodzakelijk als service-workerboot faalt |
| Offline media na reboot | Niet bewezen | Niet door wrapper gegarandeerd | Native/chunked store kan uitweg bieden | Noodzakelijk als browseropslag faalt |
| MP4/H.264/AAC | Hardware-, firmware- en encodeafhankelijk | Dezelfde decoder | Dezelfde decoder | Niet relevant |
| HEVC, VP8, VP9, HLS, DASH | Modelspecifieke capability | Dezelfde decoder/protocolstack | Dezelfde decoder/protocolstack | Niet relevant; nader fysiek testen |
| Meerdere videotags | Productclaim op bepaalde Signage-modellen | Nog steeds decoder-/modelafhankelijk | Nog steeds decoder-/modelafhankelijk | Niet relevant |
| Gapless video-overgang | Productclaim bewijst Castivo-DOM-overgang niet | Wrapper verandert timing niet automatisch | Native adapter kan later helpen | Nader onderzoeken |
| Watchdog en gecontroleerde reload | Webcode kan begrensde recovery uitvoeren | Kan mogelijk app-lifecycle benutten | Kan platformservice/adapter benutten | Waarschijnlijk nuttig |
| Achtergrondtaak/JS-service | Niet beschikbaar als gewone pagina | Alleen indien installeerbaar en toegestaan | Natuurlijk integratiepunt | Nader onderzoeken; niet gebruiken als permanente onbeperkte daemon |
| Telemetry met model/firmware | Handmatig plus browserinformatie | Mogelijk meer platforminformatie | Mogelijk SCAP/IDCAP-data | Waarschijnlijk nuttig |
| 24-uursstabiliteit | Fysieke soaktest | Fysieke soaktest | Fysieke soaktest | Niet relevant |

## `appinfo.json`, lifecycle en screensaver

LG gebruikt `appinfo.json` voor app-ID, titel, type, launchpoint, iconen, versie en app-specifieke configuratie. Dit bestand is geen PWA-manifest en wordt niet door een gewone browser-URL verkregen.

De openbare LG webOS TV-lifecycle kent ten minste:

- `Not Launched`;
- `Launched (Foreground)`;
- `Suspended (Background)`.

Een app kan door gebruikers- of systeemevents worden gesuspendeerd of beëindigd. De player moet daarom altijd:

- `visibilitychange` verwerken;
- niet vertrouwen op actieve JavaScript-timers tijdens suspension;
- media gecontroleerd pauzeren en hervatten;
- playerstate uit duurzame opslag reconstrueren;
- opnieuw vanaf de last-known-good release starten;
- reloadpogingen begrenzen en een cooldown toepassen.

Bron: [LG App Lifecycle](https://webostv.developer.lge.com/develop/getting-started/app-lifecycle).

LG documenteert voor webOS TV screensaveropties via `screenSaverProperties` in `appinfo.json` en een uitzondering terwijl video fullscreen speelt. Dat is een goede aanwijzing waarom een app-wrapper nuttig kan zijn, maar het is geen Signage-bewijs. De exacte properties, het gedrag bij stilstaande afbeeldingen en de firmwareverschillen moeten op het doel-Signage-model worden gevalideerd.

Bron: [LG Screensaver](https://webostv.developer.lge.com/develop/guides/screensaver).

## SCAP en IDCAP

De officiële Signage-portal beschrijft:

- **SCAP** als API voor beheer en controle van apps en het webOS Signage-platform;
- **IDCAP** als unified API voor webOS Signage en commercial TV;
- **JavaScript services** als manier om taken uit te voeren wanneer de UI-app niet actief is.

Zonder partnerdocumentatie mogen geen concrete methoden, permissions of platformversies worden aangenomen. Voor Castivo moet eerst per doelmodel worden bepaald of deze APIs nodig zijn voor:

- model- en firmware-identificatie;
- power-, input- of schermstatus;
- rotatie;
- autostart of relaunch;
- opslag- of filesystemtoegang;
- screenshots of diagnostics;
- periodieke health- of recoverytaken.

SCAP/IDCAP horen achter een optionele `LgWebOsSignageAdapter`. De algemene playlistengine, releasevalidatie en playbackstate mogen geen directe afhankelijkheid krijgen van LG-global objects.

Conceptueel:

```text
PlayerCore
  -> WebPlatformAdapter
       -> Service Worker
       -> CacheStorageMediaStore
       -> IndexedDB release state
  -> optional LgWebOsSignageAdapter
       -> SCAP / IDCAP
       -> app lifecycle
       -> platform diagnostics
       -> future native media store
```

Ontbrekende LG-API's moeten veilig degraderen. Alleen een user-agentmatch mag nooit als bewijs gelden dat een capability beschikbaar of betrouwbaar is.

## PWA, service workers en opslag

De webstandaard vereist een secure context voor service workers; in productie betekent dit HTTPS. Registratie en scope moeten in beginsel HTTP(S), betrouwbaar en same-origin zijn.

- [W3C Service Workers](https://www.w3.org/TR/service-workers/)
- [MDN `ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)

Een gewone HTTPS-player en een hosted wrapper die naar dezelfde HTTPS-origin navigeert kunnen daardoor theoretisch dezelfde service-worker- en origin-opslagarchitectuur gebruiken. Een volledig lokale packaged `file:`-shell krijgt die eigenschap niet automatisch.

Webopslag is standaard best-effort. `navigator.storage.persist()` is een verzoek, geen opdracht, en kan `false` opleveren. Quota kan veranderen en writes kunnen mislukken. Deze algemene browsersemantiek zegt bovendien niets over LG-opslagbehoud na appafsluiting, reboot, firmware-update of fabrieksreset.

- [MDN `StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [MDN storagequota en eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Chrome: beschikbare opslag schatten](https://developer.chrome.com/blog/estimating-available-storage-space)

Een LG-wrapper is dus niet automatisch een opslagfix. Hij wordt pas noodzakelijk wanneer de fysieke tests aantonen dat:

- Cache Storage of IndexedDB niet beschikbaar is;
- de service worker niet betrouwbaar controle neemt;
- data bij appafsluiting of reboot verdwijnt;
- quota te klein of onvoorspelbaar is;
- persistente opslag niet wordt verleend;
- offline Range-responses uit browseropslag niet stabiel genoeg zijn.

In dat geval moet een `LgWebOsMediaStore` of andere lokale adapter dezelfde interface implementeren als de webstore. De actieve last-known-good release wordt nooit verwijderd voordat een nieuwe release volledig is gedownload, geverifieerd en veilig geactiveerd.

## Codecs, videotags en overgangen

LG’s webOS TV-specificaties documenteren onder meer MP4 met H.264/AVC en AAC, H.264 Baseline/Main/High, JPEG, PNG, GIF en WebP. Sommige TV-generaties documenteren ook HEVC, VP8, VP9 en HLS. LG waarschuwt daarbij voor modelverschillen en streams die ondanks een genoemde codec niet normaal afspelen.

- [LG AV Format webOS TV 5.0](https://webostv.developer.lge.com/develop/specifications/video-audio-50)
- [LG AV Format webOS TV 22](https://webostv.developer.lge.com/develop/specifications/video-audio-220)
- [LG Streaming Protocol and DRM](https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm)

Deze TV-tabellen bepalen alleen de fysieke testset; ze zijn geen Signage-goedkeuring. Voor Castivo blijft de voorlopige veilige aanlevervariant:

- MP4-container;
- H.264/AVC;
- AAC-LC of geen audiotrack;
- `yuv420p`;
- moov atom vooraan;
- eerst 720p/1080p bij 25 en 30 fps;
- 50/60 fps en 4K als afzonderlijke capabilities;
- conservatieve bitrates;
- video standaard muted.

Packaging verandert de hardwaredecoder niet. Als H.264 High, HEVC, een bepaalde bitrate of twee gelijktijdige 1080p-videotags niet werken via `Play via URL`, is er geen basis om aan te nemen dat hetzelfde bestand door een wrapper ineens wel betrouwbaar decodeert.

Ook `Gapless Playback` en `Video Tag (4)` op een productspecificatie zijn geen bewijs voor Castivo’s twee-videostrategie. Werkelijke playback moet aantonen dat metadata laadt, `play()` slaagt, tijd voortloopt, frames verschijnen, events correct komen en de overgang geen zwart frame of decoderconflict veroorzaakt.

## Autoplay en fullscreen

Chrome documenteert sinds Chrome 66 dat muted autoplay in de standaard Chrome-policy is toegestaan, terwijl autoplay met geluid afhankelijk is van interactie, engagement of policy. Een geweigerde `play()`-aanroep levert een rejected promise op.

- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay/)

Dat is geen garantie voor LG Signage. LG kan een andere Chromiumversie, patchset, mediaservice of policy gebruiken. De player moet `video.muted = true` zetten vóór source-selectie, de `play()`-promise afhandelen en werkelijke tijd-/framevoortgang meten. Autoplay met audio is geen veilige MVP-aanname.

Een installed wrapper is waarschijnlijk nuttig voor kiosk- en appcontext, maar niet als vervanging voor echte autoplaytests. De normale Fullscreen API kan bovendien user activation vereisen; `Play via URL` of een geïnstalleerde app kan een ander presentatiepad gebruiken. Browserchrome, cursor, screensaver en relaunch moeten fysiek worden gecontroleerd.

## Autostart en herstel na power loss

`Play via URL`, Wake on LAN, schedules, Power On Status en SI Server Setting zijn afzonderlijke Signage-features. Hun aanwezigheid bewijst niet dat een specifieke Castivo-URL na iedere koude start zonder beheerhandeling terugkeert.

Test per model en firmware minimaal:

1. Castivo als `Play via URL` configureren.
2. Display softwarematig uitschakelen en weer inschakelen.
3. Netspanning volledig onderbreken.
4. Herstarten terwijl internet beschikbaar is.
5. Herstarten terwijl internet niet beschikbaar is.
6. Vastleggen welke input/app/URL opent en hoeveel tijd dit kost.
7. Controleren of last-known-good manifest, assets, device session en service worker nog aanwezig zijn.
8. Test herhalen na een firmware-update en na een mislukte netwerkstart.

Uitkomst:

- start `Play via URL` betrouwbaar en overleeft opslag de reboot, dan is een gewone hosted player voldoende voor deze capability;
- is alleen een geïnstalleerde app betrouwbaar te selecteren als power-on state, dan is een hosted wrapper waarschijnlijk noodzakelijk;
- is een platformservice of lokale store nodig om state of assets te herstellen, dan wordt een packaged adapter noodzakelijk.

## Beslisboom

```text
Ondersteunt het doelmodel officieel Play via URL?
  |
  +-- nee --> Controleer Signage partnerdocs en distributieroute.
  |           Een geïnstalleerde hosted of packaged app is waarschijnlijk nodig.
  |
  +-- ja --> Open de HTTPS Device Capability Lab op het echte scherm.
              |
              +-- HTTPS/TLS, rendering of autoplay faalt
              |     --> Controleer firmware en encoding.
              |         Packaging is geen automatische codecfix.
              |
              +-- Web-API/playback slaagt
                    |
                    +-- offline reload en offline reboot slagen,
                    |   opslag blijft behouden en power-on opent Castivo
                    |     --> Gewone HTTPS / Play via URL is voldoende.
                    |
                    +-- power-on, kiosk of screensaver is onbetrouwbaar,
                    |   maar webopslag en playback zijn goed
                    |     --> Dunne geïnstalleerde hosted wrapper bouwen.
                    |
                    +-- Cache Storage/IndexedDB/service worker verdwijnt
                        of offline reboot faalt
                          --> Packaged shell of LG media-store-adapter onderzoeken.
                              Last-known-good/atomic update blijven ongewijzigd.
```

## Go/no-go-criteria

### Gewone HTTPS-player is voldoende wanneer

- het exacte model `Play via URL` ondersteunt;
- de URL zonder browserchrome en cursor draait;
- muted autoplay op alle MVP-testvideo's werkelijk slaagt;
- offline app shell, manifest en media na reload en reboot beschikbaar blijven;
- service worker, Cache Storage en IndexedDB betrouwbaar blijven;
- last-known-good en atomic updates aantoonbaar werken;
- power-on en stroomuitval automatisch naar Castivo terugkeren;
- een 24-uurs soaktest geen onbegrensde resourcegroei toont.

### Dunne hosted wrapper is waarschijnlijk nuttig wanneer

- de webplayer technisch goed werkt, maar appidentiteit of launch niet;
- `appinfo.json` nodig is voor gewenste presentation- of screensaverinstellingen;
- beperkte SCAP/IDCAP-diagnostiek nodig is;
- de remote webcode centraal updatebaar moet blijven;
- Signage-beheer een installeerbaar appobject vereist.

### Packaged app of native adapter wordt noodzakelijk wanneer

- de browserorigin zijn actieve release of assets na reboot verliest;
- service workers op het doelplatform ontbreken of onbetrouwbaar zijn;
- de remote app shell offline niet kan starten;
- een ondersteunde LG-API/service nodig is voor gegarandeerd relaunch- of powergedrag;
- browserquota onvoldoende is en SCAP/IDCAP of een lokale service een betrouwbare media-store mogelijk maakt.

### Packaging is niet relevant als oplossing voor

- een niet-ondersteunde codec of profiel;
- onvoldoende hardwaredecoders;
- een te hoge bitrate of framerate;
- een foutieve CORS-, TLS-, MIME- of Range-configuratie;
- slechte transitionlogica in de Castivo-playercore;
- fouten in atomic release- of watchdoglogica; packaging vervangt deze playercoregaranties niet.

## Aanbevolen architectuurpad

1. **Nu:** behoud de webplatform-onafhankelijke Castivo-player en test hem via HTTPS/`Play via URL`.
2. **Na de eerste fysieke matrix:** leg per model en firmware vast welke web-API's en media daadwerkelijk werken.
3. **Bij launch- of screensaverproblemen:** bouw een minimale installed hosted wrapper met uitsluitend gevalideerde `appinfo.json`-instellingen en een dunne LG-adapter.
4. **Bij storageproblemen:** implementeer achter `PlayerMediaStore` een Signage-specifieke store; verander de playlistengine niet.
5. **Bij volledige packagebehoefte:** houd remote releases, manifests, assets, device sessions en telemetry protocolcompatibel met de hosted player.
6. **Altijd:** activeer nooit een incomplete release en verwijder nooit de actieve last-known-good release voordat een geldige vervanger veilig gereed is.

## Definitieve status vóór fysieke LG-test

| Vraag | Status |
|---|---|
| Kan een gewone HTTPS-URL op bepaalde LG Signage-modellen worden afgespeeld? | Officieel modelspecifiek ondersteund via `Play via URL` |
| Is de huidige hosted architectuur principieel mogelijk? | Ja, conditioneel |
| Is PWA/service-workerondersteuning op het doelmodel bewezen? | Nee |
| Is opslagbehoud na reboot bewezen? | Nee |
| Is autostart na stroomuitval bewezen? | Nee |
| Zijn H.264-profielen en meerdere videotags voor Castivo bewezen? | Nee |
| Is een hosted wrapper nu al noodzakelijk? | Nog niet bewezen; waarschijnlijk nuttig bij lifecycleproblemen |
| Is een volledig packaged app nu al noodzakelijk? | Nee; alleen na aangetoonde browser-/opslag-/launchbeperking |

De productbeslissing blijft daarom: **eerst hosted fysiek bewijzen, daarna gericht wrappen**. Een package is een platformadapter en operationeel hulpmiddel, geen vervanging voor capabilitytests of voor Castivo’s offline- en releasegaranties.
