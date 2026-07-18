# Fysiek testprotocol voor VeyoCast op LG webOS Signage

## 1. Doel en bewijsgrens

Dit protocol bepaalt of een specifieke combinatie van LG Signage-model,
firmware, browserengine en VeyoCast-deployment geschikt is voor een hosted
HTTPS-player. De uitkomst geldt uitsluitend voor de exact vastgelegde
combinatie. Een andere firmware of een ander model vereist minimaal een
gerichte hertest.

Desktop-Chromiumtests zijn voorbereidend bewijs. Zij kunnen geen definitieve
uitspraak doen over LG-codecs, hardwaredecoding, autoplay, opslagretentie na
reboot, service-workerlifecycle, autostart, stroomherstel, zwartframes of een
24-uurs soak. Alleen resultaten die met dit protocol op het fysieke scherm zijn
waargenomen, mogen als fysiek LG-bewijs worden aangemerkt.

Voer destructieve tests uitsluitend uit op een afgescheiden testtenant,
testscreen en testdeployment. Verander nooit een immutable productie-release
en verwijder nooit assets van een actieve productieplayer.

## 2. Rollen en benodigdheden

Minimaal twee personen zijn aanbevolen:

- een operator bij het LG-scherm voor netwerk-, reboot- en stroomhandelingen;
- een observator met toegang tot Control, serverlogs, heartbeatgegevens en
  eventueel LG remote debugging.

Benodigd:

- exact LG Signage-model en serienummer;
- exacte webOS/firmwareversie en datum van de laatste update;
- afstandsbediening en beheer-PIN;
- toestemming om netwerk en netspanning gecontroleerd te onderbreken;
- een apart netwerksegment of schakelbare routerpoort;
- laptop met Git, Node 24, pnpm 11, FFmpeg 6 of nieuwer en `sha256sum`;
- camera of telefoon die minimaal 60 fps kan opnemen voor overgangsbewijs;
- HTTPS-deployment van de Player met een geldig publiek certificaat;
- tijdelijk Device Lab-access token en afzonderlijk sessionsigning secret;
- testtenant, testscreen en gepaarde testplayer;
- twee geldige immutable testreleases en een gecontroleerde manier om een
  ongeldige pending release aan te bieden;
- centrale opslag van Device Lab-runs, of een vooraf geteste manier om JSON- en
  Markdowndownloads van het LG-apparaat veilig over te nemen.

## 3. Voorbereiding van deployment en testmedia

### 3.1 Testmedia genereren

Voer vanaf de repositoryroot uit:

```bash
bash scripts/generate-lg-test-media.sh
```

Voor de optionele VP8-, VP9- en HEVC-probes:

```bash
VEYOCAST_OPTIONAL_CODECS=1 bash scripts/generate-lg-test-media.sh
```

Het script schrijft synthetische, reproduceerbare assets naar
`apps/player/public/device-lab-media/`. De verplichte set bevat:

| Asset | Profiel |
|---|---|
| `image-1920x1080.jpg` | JPEG, 1920×1080 |
| `image-1920x1080.png` | PNG, 1920×1080 |
| `image-transparent.png` | transparante PNG, 1920×1080 |
| `image-1920x1080.webp` | WebP, 1920×1080 |
| `h264-baseline-720p25-low.mp4` | H.264 Baseline, AAC-LC, 720p25, lage bitrate |
| `h264-main-1080p30-medium.mp4` | H.264 Main, AAC-LC, 1080p30, gemiddelde bitrate |
| `h264-high-1080p50-high.mp4` | H.264 High, AAC-LC, 1080p50, hoge bitrate |
| `h264-high-1080p60-silent.mp4` | H.264 High, 1080p60, zonder audio |
| `corrupt.mp4` | bewust ongeldig bestand |

De optionele set voegt VP8 720p30, VP9 1080p30 en HEVC 1080p30 toe. HLS,
DASH, GIF, SVG, portraitvideo en 4K-video worden door de huidige generator niet
gemaakt. Laat die capabilities `UNTESTED` tenzij afzonderlijke, legaal
bruikbare en gedocumenteerde assets zijn toegevoegd.

Controleer de gegenereerde checksums vóór de build:

```bash
cd apps/player/public/device-lab-media
sha256sum -c SHA256SUMS.txt
cd ../../../..
```

Iedere checksum moet `OK` melden. Stop bij een afwijking.

### 3.2 Vereiste serverconfiguratie

Configureer via de deployment-secretstore, niet in Git of screenshots:

- `DEVICE_LAB_ACCESS_TOKEN`: willekeurig, minimaal 24 tekens;
- `DEVICE_LAB_SESSION_SECRET`: willekeurig, minimaal 32 tekens;
- `NEXT_PUBLIC_APP_VERSION`: herkenbare testversie;
- `DEPLOYMENT_SHA`: exacte Git-SHA wanneer geen provider-SHA beschikbaar is;
- de bestaande Supabaseconfiguratie en server-only service-role key als
  centrale runopslag wordt gebruikt.

Gebruik voor iedere fysieke testcampagne een nieuw access token en roteer het
direct na afloop. De huidige implementatie wisselt dit token in voor een
HttpOnly diagnosesessie van vier uur; het access token zelf is niet eenmalig.
Deel het daarom alleen via een tijdelijk beheerkanaal.

Pas de bijbehorende Device Lab-migratie toe op de testomgeving voordat
centrale runopslag wordt verwacht. Bouw en deploy pas nadat de testmedia zijn
gegenereerd:

```bash
pnpm --filter @veyocast/player build
```

### 3.3 Deployment-smoke vóór het LG-scherm

Controleer op een gewone laptop:

1. de playerorigin gebruikt `https://` en heeft geen certificaatwaarschuwing;
2. `/manifest.webmanifest` en `/sw.js` antwoorden succesvol;
3. `/device-lab` zonder sessie antwoordt met een niet-bestaande of geweigerde
   pagina;
4. een geldige token-URL redirect naar `/device-lab` en verwijdert de token uit
   de zichtbare adresbalk;
5. de pagina toont de verwachte appversie en deployment-SHA;
6. de testmedia-URL's antwoorden met het juiste MIME-type;
7. het Device Lab kan een run lokaal opslaan en, indien geconfigureerd,
   centraal opslaan.

Stop wanneer HTTPS, tokenvalidatie, tokenverwijdering, versie-identiteit of
testmedia niet correct zijn. Een HTTP-test is geen geldig service-worker- of
persistent-storagebewijs.

## 4. Apparaatregistratie en nulmeting

Leg vóór wijziging of reset vast:

| Veld | Waarde |
|---|---|
| Testdatum, starttijd en tijdzone | |
| Operator en observator | |
| LG-model | |
| Serienummer of interne assetcode | |
| Schermgrootte en oriëntatie | |
| webOS/firmwareversie | |
| Browser-/Signage-appversie indien zichtbaar | |
| Netwerkverbinding en VLAN | |
| Autostart-/URL-launchconfiguratie | |
| VeyoCast appversie | |
| Deployment-SHA | |
| Testtenant en screennaam | |
| Release 1-ID/versie | |
| Release 2-ID/versie | |
| Beginstatus browseropslag | schoon / bestaand |

Fotografeer de firmwarepagina en de relevante autostartinstelling. Leg geen
access token, device-token, cookie, signed media-URL of service-role key vast.

## 5. Device Capability Lab openen

1. Stel de tijd en tijdzone van het scherm correct in.
2. Open de LG hosted browser of geconfigureerde URL-launcher.
3. Open exact:

   ```text
   https://<player-host>/device-lab?token=<tijdelijk-urlgecodeerd-access-token>
   ```

4. Wacht op de redirect naar:

   ```text
   https://<player-host>/device-lab
   ```

5. Stop wanneer `token=` zichtbaar blijft, de pagina zonder geldige token
   opent, of een certificaatwaarschuwing verschijnt.
6. Noteer de getoonde run-ID, appversie, deployment-SHA, origin en protocol.
7. Vul het exacte LG-model en de firmware handmatig in.
8. Fotografeer de bovenste apparaatgegevens zonder gevoelige URL.
9. Controleer de Browser-API-tabel. Een `PASS` betekent hier uitsluitend dat
   de API bestaat; het is geen bewijs van blijvend gedrag.
10. Klik `Vraag persistente opslag aan` en noteer `Persistent vóór` en
    `Persistent na`. `false` is geen automatische afkeur, maar vereist extra
    strenge reboot- en retentietests.

Wanneer de sessioncookie na vier uur verloopt, open het Lab opnieuw met een
nieuw campagnetoken. De 24-uurs soak gebruikt daarom altijd afzonderlijke
start- en eindruns.

## 6. Statussen en bewijsregels

Gebruik de Lab-statussen als volgt:

- `PASS`: op dit exacte fysieke apparaat uitgevoerd en alle acceptatiecriteria
  gehaald;
- `FAIL`: uitgevoerd, maar ten minste één verplicht criterium faalde;
- `WARNING`: capability is aanwezig of werkt conditioneel, maar heeft een
  relevante beperking;
- `UNTESTED`: niet uitgevoerd, asset ontbreekt of tooling ontbreekt;
- `REQUIRES MANUAL TEST`: automatische detectie kan dit niet beslissen en de
  fysieke handeling moet nog plaatsvinden.

`canPlayType()`, `MediaSource.isTypeSupported()` en
`mediaCapabilities.decodingInfo()` zijn alleen indicaties. Ook `probably` mag
niet als codecverificatie worden gebruikt. Alleen een geslaagde werkelijke
playbacktest op de LG levert `PLAYBACK_VERIFIED`-bewijs.

Per test is minimaal vereist:

- run-ID en deployment-SHA;
- begin- en eindtijd;
- foto, video of remote-debugcapture waar relevant;
- ruwe meetwaarden en eventlijst;
- zichtbare uitkomst en eventuele recovery;
- expliciete status met reden;
- afwijking, eigenaar en vervolgdatum bij `FAIL` of `WARNING`.

## 7. Beeld- en codec/playbackmatrix

Klik in het Lab op `Start playbacktests`. Raak tijdens de reeks het scherm niet
aan. De verplichte PASS-criteria per video zijn:

- `loadedmetadata` ontvangen;
- muted `play()` resolved;
- `playing` en tijdvoortgang tot minimaal 1 seconde;
- geen `MediaError`;
- gecontroleerde stop;
- beeld werkelijk zichtbaar en niet alleen een posterframe;
- geen onverwachte audio.

Controleer naast het Labresultaat fysiek het zichtbare beeld. Gebruik deze
matrix:

| Test | Automatische meting | Fysieke observatie | Resultaat |
|---|---|---|---|
| JPEG 1920×1080 | load/decode | scherp, juiste kleuren, geen vervorming | |
| PNG 1920×1080 | load/decode | scherp, juiste aspectratio | |
| Transparante PNG | load/decode | alpha correct, geen zwarte rand | |
| WebP 1920×1080 | load/decode | volledig en kleurcorrect | |
| H.264 Baseline/AAC 720p25 low | metadata/play/time | vloeiend, muted, geen artefacten | |
| H.264 Main/AAC 1080p30 medium | metadata/play/time | vloeiend, muted, geen artefacten | |
| H.264 High/AAC 1080p50 high | metadata/play/time | vloeiend, dropped/stall noteren | |
| H.264 High 1080p60 silent | metadata/play/time | vloeiend, werkelijk stil | |
| Corrupt MP4 | fout + fallback | geen zwart blijvend scherm; fallback zichtbaar | |
| VP8 720p30, optioneel | metadata/play/time | indien gegenereerd | |
| VP9 1080p30, optioneel | metadata/play/time | indien gegenereerd | |
| HEVC 1080p30, optioneel | metadata/play/time | indien gegenereerd | |
| HLS/DASH | API-indicatie | geen playbackclaim in deze taak | `UNTESTED` |

Herhaal de kernset na een browserreload en na een koude reboot. Een codec die
alleen de eerste keer werkt, is niet betrouwbaar.

Stop direct bij herhaalde browsercrash, thermische waarschuwing, ongewenste
audio, een zwart scherm langer dan 1 seconde zonder herstel of verlies van de
pairingidentiteit.

## 8. Playback Transition Lab

Plaats de 60-fps-camera zo dat het volledige scherm en een tijdreferentie
zichtbaar zijn. Klik eerst `Test strategie A` en daarna `Test strategie B`.
Het Lab meet de reeks afbeelding → afbeelding → video → afbeelding → video →
video → afbeelding.

Leg per strategie vast:

- geplande en werkelijke overgang;
- vertraging;
- gemeten tijd zonder renderbaar item;
- tijd tot eerste videoframe;
- dropped frames indien de API beschikbaar is;
- `waiting`, `stalled`, decodefouten en autoplayfouten;
- zichtbare flits, zwart frame, oud frame of tearing;
- decoder- of browsercrash.

Voorlopige beslisgrenzen:

| Waarneming | PASS | WARNING | FAIL |
|---|---:|---:|---:|
| Zonder renderbaar item | ≤ 250 ms | 251–1000 ms | > 1000 ms |
| Eerste frame van voorgeladen video | ≤ 500 ms | 501–1500 ms | > 1500 ms |
| Zichtbaar zwart frame | geen | incidenteel < 250 ms | ≥ 250 ms of herhaald |
| Decoder-/browsercrash | 0 | n.v.t. | ≥ 1 |

De Labwaarde `blankMs` is instrumentatie en geen fotometrische
zwart-framedetectie. De 60-fps-opname is daarom het leidende visuele bewijs.
Kies strategie B pas voor productie wanneer zij aantoonbaar beter is én geen
decoder-, geheugen- of stabiliteitsnadeel veroorzaakt. Een goed werkende
strategie A blijft de veiligere keuze op hardware met één betrouwbare decoder.

## 9. HTTP Range vanuit de fysieke LG-cache

Deze test moet de door de LG service worker geleverde cache-URL testen, niet
alleen de originserver of Supabase Storage. Zorg eerst dat een release met een
echte MP4 volledig als actieve release is gecached en dat
`navigator.serviceWorker.controller` aanwezig is.

Gebruik LG remote debugging of een door de fabrikant ondersteunde inspector.
Voer in de console uit:

```javascript
(async () => {
  const cache = await caches.open("veyocast-player-assets-v1");
  const requests = await cache.keys();
  let videoRequest;
  let stored;
  for (const request of requests) {
    const response = await cache.match(request);
    if ((response?.headers.get("Content-Type") || "").startsWith("video/")) {
      videoRequest = request;
      stored = response;
      break;
    }
  }
  if (!videoRequest || !stored) throw new Error("Geen gecachte video gevonden");
  const total = Number(stored.headers.get("Content-Length"));
  const full = await fetch(videoRequest.url);
  const partial = await fetch(videoRequest.url, { headers: { Range: "bytes=0-99" } });
  const openEnded = await fetch(videoRequest.url, { headers: { Range: "bytes=100-" } });
  const suffix = await fetch(videoRequest.url, { headers: { Range: "bytes=-100" } });
  const invalid = await fetch(videoRequest.url, { headers: { Range: `bytes=${total}-` } });
  const result = {
    full: { status: full.status, acceptRanges: full.headers.get("Accept-Ranges") },
    partial: {
      status: partial.status,
      contentRange: partial.headers.get("Content-Range"),
      contentLength: partial.headers.get("Content-Length"),
      bodyBytes: (await partial.arrayBuffer()).byteLength
    },
    openEnded: { status: openEnded.status, contentRange: openEnded.headers.get("Content-Range") },
    suffix: { status: suffix.status, contentRange: suffix.headers.get("Content-Range") },
    invalid: { status: invalid.status, contentRange: invalid.headers.get("Content-Range") },
    total
  };
  console.table(result);
  return result;
})()
```

PASS vereist:

- volledige request: `200` en `Accept-Ranges: bytes`;
- `bytes=0-99`: `206`, body 100 bytes en correct `Content-Range`;
- open-ended en suffix: `206` met geldige begrenzing;
- start op bestandsgrootte: `416` met `Content-Range: bytes */<totaal>`;
- video kan na deze probes normaal starten en seeken;
- geen sterke, blijvende geheugenpiek of browsercrash.

Kan op het fysieke model geen remote inspector of gelijkwaardig bewijs worden
verkregen, markeer Range `UNTESTED`; leid geen PASS af uit een laptop-curl of
desktopbrowser.

## 10. Offline- en storagetests A–G

Gebruik voor iedere destructieve test een verse Device Lab-run of noteer het
run-ID waaronder de observatie wordt vastgelegd. Schakel internet bij voorkeur
op router- of VLAN-niveau uit; alleen `navigator.onLine` simuleren is
onvoldoende.

### Test A — Eerste synchronisatie

1. Wis alleen voor deze testsite alle browserdata op het LG-scherm.
2. Open de hosted Player en pair hem met het testscreen.
3. Wijs Release 1 toe.
4. Observeer `DOWNLOADING`, `VERIFYING` en daarna `PLAYING`.
5. Controleer dat alle assets zichtbaar afspelen en dat heartbeat de actieve
   release, opslag en het actuele item rapporteert.
6. Open het Lab, noteer opslag vóór/na en vraag persistence aan.
7. Laat drie volledige loops of minimaal 15 minuten spelen.

PASS: Release 1 wordt pas na volledige verificatie actief; geen zwart scherm,
ontbrekend item of checksumfout.

### Test B — Offline tijdens playback

1. Laat Release 1 spelen.
2. Onderbreek WAN/DNS via de netwerkvoorziening, zonder het scherm uit te
   schakelen.
3. Bevestig vanaf een tweede apparaat dat de playerorigin onbereikbaar is.
4. Laat minimaal drie volledige loops of 15 minuten spelen.
5. Controleer afbeeldingen, video, video-seek indien van toepassing en het
   uitblijven van een publieke foutoverlay.
6. Herstel netwerk en controleer heartbeatrecovery.

PASS: dezelfde release blijft compleet spelen; geen zwarte of lege stage; na
netwerkherstel herstelt sync zonder handmatige pairing.

### Test C — Offline reload en app-shell

1. Start met geldige Release 1 en schakel netwerk uit.
2. Herlaad de hosted pagina via de LG-browser.
3. Bevestig dat geen server bereikbaar is.
4. Meet tijd tot eerste cached item.
5. Laat ten minste één volledige loop spelen.

PASS: de service-workercache levert de app-shell en uitsluitend de actieve
last-known-good release start. Een browserfoutpagina of afhankelijkheid van de
bereikbare Next-server is FAIL.

### Test D — Offline appafsluiting en koude reboot

Voer afzonderlijk uit:

1. sluit en heropen de browser terwijl netwerk uit blijft;
2. zet het scherm via normale shutdown uit en weer aan;
3. haal, met toestemming en buiten firmware-update, de netspanning 60 seconden
   weg en start opnieuw terwijl netwerk uit blijft.

Noteer per variant pairingretentie, app-shellretentie, actieve release,
opslaggebruik en tijd tot eerste item.

PASS: app-shell, device identity en last-known-good blijven behouden en spelen
zonder netwerk. Als de browser handmatig opnieuw moet worden geopend, kan
offline playback PASS zijn maar autostart blijft afzonderlijk FAIL/WARNING.

### Test E — Atomische update

1. Herstel netwerk en laat Release 1 spelen.
2. Wijs Release 2 toe tijdens een video in Release 1.
3. Film scherm en Controlstatus gelijktijdig.
4. Controleer dat Release 1 blijft spelen tijdens download en verificatie.
5. Onderbreek optioneel eenmaal netwerk tijdens download en herstel dit.
6. Controleer dat Release 2 alleen op een veilige loopgrens actief wordt.
7. Herlaad tijdens `SWITCH_PENDING`: Release 1 moet opnieuw starten, niet
   Release 2.
8. Laat daarna een volledige succesvolle promotie plaatsvinden.

PASS: geen switch midden in een item, geen incomplete Release 2 en een reload
tijdens pending activeert de pending release niet.

### Test F — Corrupte of onbereikbare pending update

Gebruik alleen een gecontroleerde stagingfixture die een fout checksumformaat,
corrupt bestand of onbereikbare asset in Release 2 aanbiedt. Wijzig geen
productierelease en verwijder geen object dat door een andere testplayer wordt
gebruikt.

1. Laat geldige Release 1 spelen.
2. Bied de foutieve Release 2 als desired release aan.
3. Observeer download, verificatiefout en recovery.
4. Reload en reboot eenmaal terwijl de foutieve release desired blijft.
5. Herstel de fixture en publiceer een nieuwe geldige release; muteer de
   bestaande immutable release niet.

PASS: Release 2 wordt nooit actief, Release 1 blijft spelen, de fout verschijnt
in diagnostiek/heartbeat en herstel veroorzaakt geen reloadloop.

Als geen veilige foutinjector of geïsoleerde fixture beschikbaar is: stop deze
test en markeer `UNTESTED`. Een zelfverzonnen of alleen UI-gemockte fout is geen
bewijs.

### Test G — Onvoldoende opslag

Vul nooit de VeyoCast-assetcache zelf. Gebruik, wanneer remote debugging
beschikbaar is, een afzonderlijke tijdelijke cache zoals
`veyocast-lg-quota-fill-v1`, of gebruik een gecontroleerde oversized testrelease.
Leg eerst Release 1 en de opslagmeting vast.

1. Vul de aparte cache stapsgewijs tot beschikbare ruimte kleiner is dan
   Release 2 plus veiligheidsmarge.
2. Wijs Release 2 toe.
3. Controleer dat download wordt geweigerd en Release 1 blijft spelen.
4. Reload en laat één loop spelen.
5. Verwijder uitsluitend de tijdelijke fillercache.
6. Controleer dat Release 1 nog aanwezig is en een latere geldige update werkt.

PASS: de actieve en vorige geldige release worden nooit verwijderd om plaats
te maken voor een onvolledige pending release; de opslagfout is zichtbaar in
diagnostiek en herstelbaar.

Stop en markeer `UNTESTED` wanneer de firmware geen veilige, begrensde
quota-injectie toelaat. Vul nooit de volledige apparaatschijf en voer dit niet
uit terwijl een firmware-update of andere signage-app actief is.

## 11. Autostart en herstel na stroomuitval

Documenteer exact welke LG Signage-instelling de HTTPS-URL bij power-on opent.
Een standaardwebpagina kan autostart niet zelf afdwingen.

Voer minimaal drie cycli uit:

1. normale shutdown en power-on met netwerk;
2. koude stroomonderbreking met netwerk;
3. koude stroomonderbreking zonder netwerk.

Meet:

- tijd van power-on tot browser/player;
- tijd tot eerste zichtbaar item;
- browserchrome of foutdialogen;
- pairingretentie;
- actieve release;
- handmatige handelingen;
- heartbeat na netwerkherstel.

Hosted autostart is PASS alleen wanneer een gedocumenteerde, beheerbare
signageconfiguratie de URL zonder menselijke handeling opent en playback na
alle drie cycli herstelt. Als dit alleen via LG-specifieke lifecycle-API's kan,
is een packaged app waarschijnlijk of noodzakelijk.

## 12. 24-uurs soak en resourcegroei

Gebruik een mixed-media release met minimaal afbeelding → afbeelding → video →
afbeelding → video → video. Start met een koude browserstart en noteer na 30
minuten de warmgelopen nulmeting.

Leg op 0,5, 2, 4, 8, 12, 18 en 24 uur vast:

- huidig item en loopnummer indien beschikbaar;
- opslaggebruik en quota;
- browser-/procesgeheugen indien LG tooling dit exposeert;
- dropped frames;
- `waiting`, `stalled`, decodefouten en watchdogacties;
- heartbeatgaten;
- netwerkstatus;
- zichtbare zwartframes of bevroren beeld;
- spontane reloads, appafsluitingen en temperatuurwaarschuwingen.

Voer tijdens de soak één korte netwerkuitval uit en controleer automatisch
herstel. Wijzig verder geen release om de meting vergelijkbaar te houden.

PASS vereist:

- 24 uur zonder browser- of playercrash;
- geen permanent zwart of bevroren scherm;
- geen oneindige reloadloop;
- last-known-good blijft tijdens netwerkuitval spelen;
- geen monotone, onbegrensde opslaggroei;
- geen overtuigend bewijs van monotone geheugengroei na de warm-up.

Als geheugen meetbaar is, behandel meer dan 20% groei tussen warm-up en 24 uur
als minimaal `WARNING`; aanhoudende groei, OOM, browserkill of playbackverlies
is `FAIL`. Als de firmware geen geheugentelemetrie geeft, noteer dat expliciet:
de soak kan functioneel PASS zijn, maar geheugenretentie blijft `UNTESTED`.

## 13. Resultaten opslaan en exporteren

Na iedere niet-destructieve Labreeks:

1. vul model en firmware opnieuw in;
2. zet handmatige teststatussen op `PASS`, `FAIL` of `Handmatig`;
3. klik `Testrun opslaan`;
4. controleer de melding `lokaal én centraal opgeslagen`, of noteer waarom
   centrale opslag ontbreekt;
5. klik `Exporteer JSON` en `Exporteer Markdown` wanneer LG-downloads worden
   ondersteund;
6. neem beide bestanden over via een goedgekeurd kanaal en controleer dat
   run-ID, SHA en timestamps gelijk zijn;
7. koppel foto- en videobestanden extern aan dezelfde run-ID.

Tijdens offline/reboottests kan centrale opslag niet werken. Bewaar dan eerst
de run lokaal en leg run-ID plus schermfoto vast. De huidige Lab-UI kan een
oude lokale IndexedDB-run niet interactief terugladen; gebruik daarom aparte
runs voor vóór en na een reboot en verbind ze in het testlog. Vertrouw niet
alleen op een lokale download die mogelijk door de LG-browser wordt gewist.

Een geldig eindpakket bevat:

- JSON en Markdown per relevante run;
- foto van model/firmware;
- 60-fps transitionvideo's voor strategie A en B;
- Range-consolecapture;
- netwerk- en powercyclustijden;
- 24-uurs meetlog;
- lijst van alle `FAIL`, `WARNING`, `UNTESTED` en ontbrekende tooling;
- operatorhandtekening en review door een tweede persoon.

## 14. Algemene stopcriteria

Stop de testcampagne direct wanneer:

- het scherm in een firmware-update zit;
- netspanning onderbreken niet expliciet is toegestaan;
- een actie productiecontent, een productieasset of een andere player raakt;
- het actieve last-known-good exemplaar dreigt te worden verwijderd;
- secrets of volledige tokens in screenshots/logs terechtkomen;
- de browser herhaald crasht of het scherm thermisch waarschuwt;
- pairing of opslag onverwacht wordt gewist zonder herstelplan;
- een test alleen kan slagen door de uitkomst te mocken;
- model, firmware, appversie of deployment-SHA niet meer eenduidig is;
- centrale timestamps sterk afwijken van de apparaattijd.

Een gestopte test wordt `UNTESTED` of `FAIL` met reden, nooit stilzwijgend
`PASS`.

## 15. Beslisregels hosted versus packaged

### Hosted webplayer voldoende

Alle kernvoorwaarden zijn op het exacte model PASS:

- HTTPS, app-shell en service worker;
- JPEG, PNG, transparante PNG, WebP;
- minimaal H.264 Baseline/Main met AAC op 720p/1080p en de gekozen
  productieframerate/bitrate;
- muted autoplay en stabiele video-events;
- Range `200/206/416` en seek uit lokale cache;
- Tests A tot en met G;
- offline reload en koude offline reboot;
- atomische update en corrupte-updatefallback;
- gedocumenteerde autostart en stroomherstel zonder menselijke handeling;
- acceptabele transities;
- 24-uurs soak zonder kritieke groei of uitval.

### Hosted webplayer met beperkingen

Alle kernvoorwaarden zijn PASS, maar optionele codecs, 50/60 fps, twee
videolagen, persistence-indicatie of niet-productiekritische diagnostiek zijn
beperkt. Leg de ondersteunde encodeprofile, maximale resolutie/framerate,
opslagmarge en firmware vast als deploymentpolicy.

### Hybride adapter nodig

Hosted playback en lifecycle werken, maar Cache Storage, Range-geheugengedrag,
quota of rebootretentie zijn onvoldoende en kunnen waarschijnlijk met een
andere `PlayerMediaStore` of LG-specifieke opslagadapter worden opgelost. Een
hybride uitkomst vereist eerst een prototype en herhaling van A–G en de soak.

### Packaged LG-app nodig

Een packaged app is noodzakelijk of sterk aangewezen wanneer één van deze
kernvoorwaarden niet betrouwbaar via de hosted browser kan worden geleverd:

- autostart of herstel na stroomuitval;
- kiosk/fullscreen zonder browserchrome;
- blijvende device identity en mediaopslag;
- betrouwbare service-workerlifecycle;
- voldoende lokale mediaopslag en Range/seek;
- vereiste decoder- of lifecyclecontrole die alleen via LG API's beschikbaar
  is.

Een packaged app herstelt niet automatisch een ontbrekende codec of instabiele
hardwaredecoder. Ook dan is een nieuw fysiek codec-, offline-, transition- en
soakprotocol verplicht.

## 16. Eindregistratie

| Beslispunt | Uitkomst |
|---|---|
| Exact LG-model en firmware | |
| Kerncodecprofiel | |
| Tests A–G | |
| Range 200/206/416 | |
| Offline reload/reboot | |
| Autostart/stroomherstel | |
| Gekozen transitionstrategie | |
| 24-uurs soak | |
| Open FAIL/WARNING/UNTESTED | |
| Eindadvies | hosted / hosted met beperkingen / hybride / packaged |
| Reviewer en datum | |

Publiceer pas een ondersteuningsclaim nadat het bewijs door een tweede persoon
is gereviewd en de exacte model-/firmwarecombinatie in de capabilitymatrix is
vastgelegd.
