# VeyoCast Webplayer en LG webOS Signage capability-audit

## Documentstatus

- Onderzochte baseline: commit `9253908232235aff2ed4a6383da847484f097dfa`.
- Onderzochte huidige staat: dezelfde worktree, inclusief de nog niet gecommitte PWA-, Service Worker-, Range-, media-store-, atomic-release- en Device Capability Lab-wijzigingen.
- Doelplatform: een gewone HTTPS-URL in de browser/URL-player van een LG webOS Signage-scherm.
- Fysiek LG-bewijs: nog niet uitgevoerd.
- Voorlopige aanbeveling: **hosted webplayer met beperkingen**.

### Addendum 25 juli 2026

Sprint S42 voegt een dunne installeerbare LG webOS Signage-shell toe en een
aparte hosted route op `/lg`. De shell verandert de conclusies over codecs,
storagepersistentie, firmware en fysieke betrouwbaarheid niet: al die punten
blijven `NEEDS_PHYSICAL_LG_TEST`. Pairing, immutable releases, verificatie,
offlinecache en playback blijven eigendom van dezelfde hosted Player; de wrapper
voegt uitsluitend lifecycle-, remote-, netwerk- en lokale foutafhandeling toe.
Zie `docs/platforms/lg-webos-signage-ipk.md` voor het actuele
distributiecontract.

Dit rapport maakt steeds onderscheid tussen:

1. de baseline vóór deze audit;
2. ondersteuning door de huidige code;
3. bewijs uit bestaande Desktop Chromium-tests of het Device Lab;
4. bewijs dat alleen op het exacte LG-model en de exacte firmware kan worden verkregen.

De enige statussen in de capabilitymatrix zijn:

- `SUPPORTED_BY_CODE`
- `SUPPORTED_BY_WEB_API`
- `NEEDS_PHYSICAL_LG_TEST`
- `VERIFIED_ON_LG`
- `CONDITIONAL`
- `PACKAGED_APP_REQUIRED`
- `NOT_SUPPORTED`
- `NOT_IMPLEMENTED`

Er staat bewust nergens `VERIFIED_ON_LG`: er is in deze taak geen fysiek LG Signage-scherm getest. Een geslaagde Desktop Chromium-test, `canPlayType("...") === "maybe"` of user-agentdetectie is geen LG-bewijs.

## Managementsamenvatting

De VeyoCast Player heeft na deze taak een serieuze hosted-webbasis: een PWA-manifest, Service Worker, app-shellcache, checksum-keyed mediacache, IndexedDB voor actieve en vorige releases, byte-range-responses, een abstraheerbare media-store, uitgestelde persistente releaseactivatie, verbeterde heartbeat en een afgeschermd Device Capability Lab. Pairing, tenantbinding, immutable releases, signed media-URL's en assetverificatie bestonden al.

De grootste baselinefout — de nieuwe release al in IndexedDB als actief opslaan vóór de veilige loopgrens — is opgelost. Bij een nieuwe release worden de assets nu eerst voorbereid en gehydrateerd; pas op de loopgrens worden `active` en `previous` atomisch bijgewerkt. Een corrupte actieve release kan bij startup terugvallen op de vorige geverifieerde release.

Toch is een hosted URL nog niet zonder beperkingen inzetbaar:

- playlistduur blijft de geplande bovengrens, maar productie reageert nu ook op image/video ready, error, ended, stalled en timeupdate;
- watchdog, retry, item-skip, last-known-goodherstel en reloadcooldown zijn door code en Desktop Chromium bewezen, maar nog niet op LG;
- manifesten worden periodiek met deduplicatie en begrensde backoff opgehaald;
- de MP4/H.264/AAC-worker claimt en streamt jobs end-to-end, maar een echte FFmpeg-outputrun ontbreekt nog;
- Service Worker-, Cache Storage- en IndexedDB-behoud na appafsluiting/reboot is firmware- en launchmodusspecifiek;
- de huidige Range-store leest voor een late range nog steeds eerdere cachechunks en de blobfallback materialiseert het hele bestand;
- media-GC behoudt active/previous en shell-GC verwijdert oude versies;
- fullscreen browserchrome, autostart, screensavercontrole en power recovery zijn niet gegarandeerd door standaard webcode;
- moderne Next.js/React-output en CSS moeten tegen de Chromiumversie van het doelmodel worden getest;
- er is nog geen fysiek LG-bewijs voor codecs, autoplay, meerdere videotags, transitions, storagepersistentie of 24-uursstabiliteit.

De officiële LG Signage-site noemt onder andere gapless playback, meerdere videotags, SCAP en JS Services als platformmogelijkheden, maar de gedetailleerde documentatie is partner-only. Dat is geen bewijs dat deze mogelijkheden in een willekeurige hosted browser-URL beschikbaar zijn. Zie [LG webOS Signage Developer](https://webossignage.developer.lge.com/). LG publiceert voor webOS TV expliciet dat verschillende platformversies sterk verschillende engines gebruiken, van oudere WebKit/Chromium 38/53 tot nieuwere Chromiumversies; dezelfde model-/firmwarediscipline is daarom voor Signage noodzakelijk. Zie [Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine).

## Scope en bewijsregels

### Wat Desktop Chromium wel bewijst

- TypeScript- en unitlogica kan in de huidige toolchain bouwen en draaien.
- De bestaande Playwright-flow kan pairing/demo playback en last-known-goodgedrag in Desktop Chrome uitvoeren.
- De nieuwe Range-unit- en browsertests bewijzen bounded, open-ended en suffix parsing, `206`, `Content-Range`, `Content-Length` en `416`, ook via de werkelijke Service Worker.
- Een Desktop Chromium-browserproef bewijst dat de gecachete player-shell zonder netwerk opnieuw kan laden; rebootretentie op LG blijft een fysieke test.
- Het Device Lab kan op een browser concrete API-, codec-, playback-, storage- en transitionmetingen verzamelen zodra de gegenereerde testmedia zijn gedeployed.

### Wat Desktop Chromium niet bewijst

- LG-codecdecoding of decoderprofielen;
- muted of audible autoplaybeleid op een Signage-model;
- GPU-compositing en zwarte frames;
- persistentie van Service Worker, Cache Storage, IndexedDB of localStorage na appafsluiting en reboot;
- browser-URL-autostart, kiosk/fullscreen, screensaver- en power-recoverygedrag;
- meerdere hardware-videodecoders of twee gelijktijdige videotags;
- 24-uurs geheugen- en resourcegedrag.

### Officiële LG-bronnen en interpretatie

- [LG webOS Signage Developer](https://webossignage.developer.lge.com/) bevestigt dat webOS Signage webgericht is en noemt SCAP, JS Services, gapless playback en multiple video tags. De site is grotendeels partner-only; capability per model/firmware moet via partnerdocumentatie en fysiek bewijs worden vastgesteld.
- [LG Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine) toont voor webOS TV dat de engine per platformjaar sterk verschilt en waarschuwt dat generieke Chromecompatibiliteit niet altijd overeenkomt met platformfuncties. Deze bron is richtinggevend voor het risico, niet een Signage-certificaat.
- [LG AV Format on webOS TV 5.0](https://webostv.developer.lge.com/develop/specifications/video-audio-50) documenteert onder andere H.264-profielen, AAC en resolutie-/bitratelimieten voor die specifieke TV-generatie. Dit mag niet naar elk Signage-model worden gegeneraliseerd.
- [LG Streaming Protocol and DRM](https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm) documenteert HTTP/HTTPS, HLS en seek voor webOS TV, maar ook dit blijft generatie- en productlijnspecifiek.
- [LG App Resources](https://webostv.developer.lge.com/develop/getting-started/app-resources) adviseert kernresources lokaal te houden en video op resolutie/bitrate voor te verwerken. Dat ondersteunt VeyoCast's offline- en normalisatiestrategie.
- [LG Supported App Resolution](https://webostv.developer.lge.com/develop/specifications/app-resolution) maakt onderscheid tussen graphics- en videoplaybackresolutie. Een 4K-ingangsbestand betekent dus niet automatisch een 4K-appcanvas.

## Volledige code-inventaris

### Applicatie en routing

- De Player is een Next.js App Router-app in `apps/player`.
- Productieroute `/`: `apps/player/app/page.tsx:1-5`.
- Diagnoseroute `/device-lab`: `apps/player/app/device-lab/page.tsx:7-21`.
- Pairing-API: `apps/player/app/api/player/pairing/route.ts:12-94`.
- Manifest-API: `apps/player/app/api/player/manifest/route.ts:27-248`.
- Heartbeat-API: `apps/player/app/api/player/heartbeat/route.ts:17-98`.
- Device Lab-sessie: `apps/player/app/api/device-lab/session/route.ts`.
- Device Lab-runopslag: `apps/player/app/api/device-lab/runs/route.ts:14-87`.

### PWA en Service Worker

- Next.js webmanifest met fullscreen-display en landscapevoorkeur: `apps/player/app/manifest.ts:1-15`.
- Service Worker-registratie met feature detection: `apps/player/app/_components/service-worker-registration.tsx:5-15`.
- Registratie staat in de rootlayout: `apps/player/app/layout.tsx:5-20`.
- Service Worker cached `/` tijdens install, claimt clients, gebruikt network-first voor navigaties en cache-first voor overige shellrequests: `apps/player/public/sw.js:3-37,114-132`.
- Device Lab en diens API worden bewust niet door de Service Worker gecached: `apps/player/public/sw.js:20-23`.
- Security-, no-store- en Service-Worker-Allowed-headers: `apps/player/next.config.mjs:7-31`.

### Release, media-store en offline

- Checksum-keyed assetmodel: `apps/player/app/_lib/player-cache.ts:8-22,308-323`.
- Media-storeinterface en Cache Storage-adapter: `apps/player/app/_lib/player-media-store.ts:1-52`.
- Bij een actieve Service Worker gebruikt playback de stabiele cache-URL; zonder controller valt de adapter terug op een blob-URL: `apps/player/app/_lib/player-media-store.ts:28-40`.
- Download, size/hashverificatie en cache-write met Rangeheaders: `apps/player/app/_lib/player-cache.ts:73-149`.
- Actieve en vorige releases worden in één IndexedDB-transactie gewisseld: `apps/player/app/_lib/player-cache.ts:151-183`.
- Startup leest active en valt bij hydratatiefout terug op previous: `apps/player/app/_components/player-runtime.tsx:202-245`.
- Pending media wordt voorbereid zonder actieve metadata te overschrijven: `apps/player/app/_components/player-runtime.tsx:247-336`.
- Persistente activatie gebeurt pas op loopgrens: `apps/player/app/_components/player-runtime.tsx:432-503`.
- IndexedDB feature detection en schema versie 2: `apps/player/app/_lib/player-cache.ts:345-369`.
- Web Crypto feature detection: `apps/player/app/_lib/player-cache.ts:239-263`.

### HTTP Range

- De Service Worker behandelt checksum-cache-URL's, volledige responses, single ranges en `416`: `apps/player/public/sw.js:39-83`.
- De body wordt streamend gesliced en niet eerst volledig naar een nieuwe ArrayBuffer gekopieerd: `apps/player/public/sw.js:85-112`.
- De testbare TypeScript-rangeparser/-responsebuilder: `apps/player/app/_lib/media-range.ts:1-162`.
- Unitdekking voor bounded, open-ended, suffix, multiple, unsatisfiable, `206` en `416`: `apps/player/app/_lib/media-range.test.ts:5-58`.

### Playback

- De productiecomponent remount media expliciet per item/retrypoging en gebruikt `autoPlay`, manifest-`muted`, `playsInline` en `preload="metadata"`: `apps/player/app/_components/player-runtime.tsx`.
- Playlistduur blijft de geplande itemgrens; een echt `ended`-event kan eerder veilig doorzetten.
- `error`, ontbrekende start, ontbrekende `currentTime`-voortgang en aanhoudende `waiting`/`stalled` worden gedetecteerd.
- De begrensde herstelvolgorde is aan productie gekoppeld: retry, skip, looprestart, renderer-reinit, persisted last-known-good, maximaal twee gecontroleerde reloads per 15 minuten en daarna cooldown.
- De foutcode, herstelactie, item-ID en timestamp worden geredigeerd via heartbeat opgeslagen: `apps/player/app/api/player/heartbeat/route.ts`.

### Pairing en device session

- Cryptografisch device-token en pairingcode: `apps/player/app/api/player/pairing/route.ts:10,25-45,56-68`.
- Live manifest accepteert alleen bearer-auth; querytokens blijven uitsluitend voor de niet-live demo: `apps/player/app/api/player/manifest/route.ts:27-36`.
- De runtime verwijdert een ontvangen querytoken direct uit de zichtbare URL via `history.replaceState`: `apps/player/app/_components/player-runtime.tsx:185-198`.
- Het token blijft lokaal in localStorage: `apps/player/app/_components/player-runtime.tsx:765-829`.
- Server-side bootstrap filtert paired device en active screen: `supabase/migrations/20260717100000_screens_devices_pairing.sql:340-381`.

### Heartbeat en operations

- Eén stabiele heartbeatinterval van 30 seconden gebruikt een runtime-ref: `apps/player/app/_components/player-runtime.tsx:52-56,505-549`.
- Heartbeat bevat actieve release, huidig item, netwerkstatus, storage usage/quota en syncfase: `apps/player/app/_components/player-runtime.tsx:511-538`.
- Server voegt appversie en deployment-SHA toe en begrenst invoer: `apps/player/app/api/player/heartbeat/route.ts:25-59,92-98`.

### Device Capability Lab

- Tijdelijke toegangstoken wordt server-side gevalideerd en omgezet naar een HttpOnly, SameSite Strict sessiecookie; ontbrekende of te korte signing secrets falen gesloten: `apps/player/app/_lib/device-lab-auth.ts`, `apps/player/app/_lib/device-lab-session.ts`, `apps/player/app/api/device-lab/session/route.ts`.
- De route retourneert zonder geldige sessie een 404: `apps/player/app/device-lab/page.tsx:7-20`.
- Automatische devicegegevens, storage, Web API- en codecdetectie: `apps/player/app/device-lab/device-lab-core.ts:67-143,179-249`.
- Werkelijke image/video-playbacktest met events en tijdvoortgang: `apps/player/app/device-lab/device-lab-client.tsx:234-288`.
- Corrupt asset/fallbacktest: `apps/player/app/device-lab/device-lab-client.tsx:290-303`.
- Transition Lab voor één en twee videotags: `apps/player/app/device-lab/device-lab-client.tsx:306-366`.
- Handmatige offline-, reboot-, atomic-, storage-, power- en soakregistratie: `apps/player/app/device-lab/device-lab-core.ts:79-89`.
- JSON- en Markdownexport plus lokale IndexedDB-opslag: `apps/player/app/device-lab/device-lab-client.tsx:206-213,383-405`.
- Centrale, geredigeerde opslag is server-only en begrensd tot 250 kB: `apps/player/app/api/device-lab/runs/route.ts:12-29,35-73`.
- Testruntabel forceert RLS en ontzegt anon/authenticated directe toegang: `supabase/migrations/20260718180000_player_device_lab_runs.sql:1-22`.

### Testmedia

- Reproduceerbare FFmpeg-generator: `scripts/generate-lg-test-media.sh:1-78`.
- Synthetische JPEG, PNG, transparante PNG en WebP: `scripts/generate-lg-test-media.sh:15-29`.
- H.264 Baseline 720p25 low, Main 1080p30 medium, High 1080p50 high en High 1080p60 zonder audio: `scripts/generate-lg-test-media.sh:31-52`.
- Optionele VP8, VP9 en HEVC: `scripts/generate-lg-test-media.sh:54-62`.
- Bewust corrupt bestand en SHA256SUMS: `scripts/generate-lg-test-media.sh:64-75`.
- De gegenereerde binaries zijn niet in de onderzochte worktree aanwezig; het script moet vóór deployment worden uitgevoerd.

## Capabilitymatrix

### Applicatie

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| HTTPS hosted web app | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Next.js kan hosted draaien; productie-HTTPS/DNS/proxy en LG URL-launch zijn niet in repo bewezen. |
| PWA-manifest | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | `app/manifest.ts`; iconset ontbreekt en manifestinstallatie op Signage is onbekend. |
| Service-workerregistratie | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Feature-detected registratie van `/sw.js`. |
| Service-workerupdate | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Expliciete updatecheck, activatiebericht en cleanup van oude shellcaches zijn in Chromium bewezen. |
| Reload recovery | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Offline reload van de gecachete Next-shell is in Desktop Chromium bewezen; afsluiten/reboot en firmware-retentie blijven fysiek. |
| Fullscreenpresentatie | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | CSS fullscreen + manifest `display: fullscreen`; gewone browserchrome/kiosk niet gegarandeerd. |
| Schermoriëntatie | `NOT_IMPLEMENTED` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Manifest forceert landscape; geen runtime orientation lock of portraitcompositie. |
| Device identity | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Willekeurig token, server-side hash; fingerprint is niet stabiel hardwaregebonden. |
| Pairing | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Zes tekens, expiry, claim-RPC en revocation aanwezig. |
| Secure session persistence | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Token staat in origin-scoped localStorage; geen hardware keystore, rotatie of storagepersistentiebewijs. |

### Afbeeldingen

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| JPEG | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Ingest en Lab-asset aanwezig; generator nog uitvoeren. |
| PNG | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Ingest ondersteunt PNG; echte LG-decode vereist. |
| Transparante PNG | `SUPPORTED_BY_WEB_API` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Specifieke synthetische alpha-PNG in generator/Lab. |
| WebP | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Oudere engines/modelseries kunnen afwijken. |
| GIF, alleen beoordeling | `NOT_SUPPORTED` | `NOT_SUPPORTED` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Browser kan GIF mogelijk decoderen, maar VeyoCast-ingest accepteert het niet. |
| SVG | `NOT_SUPPORTED` | `NOT_SUPPORTED` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Alleen demo-SVG; terecht niet toegestaan in MVP zonder sanitization. |
| cover | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | `object-fit: cover`. |
| contain | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | `object-fit: contain`. |
| portrait | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Media schaalt, maar aparte portrait Playercompositie ontbreekt. |
| landscape | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Huidige renderer en manifest zijn landscape-first. |
| 4K-input | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Geen image resize/dimensielimiet; decodegeheugen en canvasresolutie zijn modelafhankelijk. |
| Foutieve afbeelding | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Pending hash/size plus productie-`onError` met retry/skip. |
| Verdwenen asset | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Pending fetch faalt veilig; bij actieve hydratatiefout is previous fallback toegevoegd. |

### Video

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| MP4-container | `CONDITIONAL` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Upload/queue/worker zijn aangesloten; echte FFmpeg-output en fysieke playback ontbreken. |
| H.264 Baseline | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | 720p25 generator + echte Lab-playbacktest. |
| H.264 Main | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | 1080p30 generator + Lab. |
| H.264 High | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | 1080p50/60 generator + Lab. |
| AAC-audio | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Generator gebruikt AAC-LC 48 kHz; tests spelen muted. |
| Video zonder audio | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | 1080p60 silent asset. |
| 720p | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Baseline 720p25. |
| 1080p | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Main/High 1080p. |
| 25 fps | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Baseline testasset. |
| 30 fps | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Main testasset. |
| 50 fps | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | High testasset. |
| 60 fps | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | High silent testasset. |
| Verschillende bitrates | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | 0,9 / 3 / 6,5 Mbit/s generatorprofielen. |
| HEVC/H.265 optioneel | `NOT_IMPLEMENTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Optionele generator en detectie; niet in MVP-ingest/playback-suite. |
| WebM VP8 optioneel | `NOT_SUPPORTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Optionele generator/detectie; productiecontract accepteert geen WebM. |
| WebM VP9 optioneel | `NOT_SUPPORTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Optionele generator/detectie; productiecontract accepteert geen WebM. |
| HLS toekomst | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Alleen MIME-detectie; geen manifest/segmentengine. |
| DASH toekomst | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Alleen MIME-detectie; geen DASH-player. |

### Playback

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| Muted autoplay | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Productie heeft attributen; Lab vereist resolved `play()` en tijdvoortgang. |
| Autoplay met audio | `CONDITIONAL` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Niet de MVP-default; user-gesture-/devicebeleid vereist. |
| Loop | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Playlistindex loopt terug naar nul; niet video-`loop`. |
| Seek | `NOT_IMPLEMENTED` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Rangebasis aanwezig, productieengine stuurt seek niet. |
| Preload | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie metadata-only; Lab gebruikt auto/canplay. |
| video ended-event | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie gaat direct door naar het volgende item; Chromiumtest bewijst de overgang. |
| video error-event | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie koppelt decodefouten aan begrensd retry/skip-herstel. |
| stalled-event | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productiewatchdog registreert stalled en grijpt na timeout in. |
| waiting-event | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productiewatchdog registreert waiting en blijft tijdvoortgang bewaken. |
| canplay-event | `NOT_IMPLEMENTED` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie gebruikt playing als readinesssignaal; Lab gebruikt canplay. |
| timeupdate | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie bewaakt echte currentTime-voortgang. |
| Playback quality | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Device Lab detecteert `getVideoPlaybackQuality`. |
| Dropped frames | `NOT_IMPLEMENTED` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Transition Lab leest dropped frames indien API aanwezig. |
| Eén video-element | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Productie en Lab-strategie A. |
| Twee video-elementen | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Alleen Lab-strategie B, nog niet productie. |
| Meerdere gelijktijdige videotags | `NOT_IMPLEMENTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Twee elementen worden geprepareerd; hardwaredecoderlimiet onbekend. |
| image → image | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Productie + Transition Lab. |
| image → video | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Lab meet canplay/eerste frame. |
| video → image | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Lab meet overgang. |
| video → video | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Productie remount expliciet per item; Lab vergelijkt één element met double-buffering. |
| Gapless overgang | `NOT_IMPLEMENTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Labmeting is indicatief; geen productiegarantie. |
| Zwart-frame-detectie | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `NEEDS_PHYSICAL_LG_TEST` | Geen pixel/framewatcher. |
| Recovery na decodefout | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Chromium bewijst decodefout → één retry → skip → geldige fallback + heartbeat. |

### Offline en storage

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| Service Worker API | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Registratie en SW aanwezig. |
| Cache Storage API | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Feature-detected adapter. |
| IndexedDB | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Active/previous en Lab-runs. |
| StorageManager | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Lab detecteert veilig. |
| storage estimate | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Preflight + heartbeat + Lab. |
| storage persisted | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Lab leest status. |
| storage persist request | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Expliciete Lab-knop. |
| App shell offline | `NOT_IMPLEMENTED` | `CONDITIONAL` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Root + runtime resources; volledige Next chunkgraph en updatepad nog testen. |
| Manifest offline | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Release-envelope in IndexedDB, niet HTTP-manifestcache. |
| Afbeelding offline | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Checksum-cache + stabiele cache-URL/blobfallback. |
| Video offline | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Media-store + Range-SW; echte MP4 nog uitvoeren. |
| HTTP Range vanuit cache | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Service Worker single-rangepad. |
| 206 Partial Content | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Headers en byte slice unitgetest in TS-versie. |
| Reboot terwijl offline | `NOT_IMPLEMENTED` | `CONDITIONAL` | `NOT_IMPLEMENTED` | `NEEDS_PHYSICAL_LG_TEST` | Alleen fysiek protocol kan dit bewijzen. |
| Reload terwijl offline | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Baseline test blokkeerde alleen routes; volledige offlinecontext nog testen. |
| Storagebehoud na appafsluiting | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Firmware-/launchmodusafhankelijk. |
| Storagebehoud na schermreboot | `NOT_IMPLEMENTED` | `CONDITIONAL` | `NOT_IMPLEMENTED` | `NEEDS_PHYSICAL_LG_TEST` | Handmatige Lab-test D. |
| Last-known-good release | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Active eerst, previous fallback bij corrupt/missing. |
| Atomic release update | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `CONDITIONAL` | `NEEDS_PHYSICAL_LG_TEST` | Persistente write nu pas op loopgrens. |
| Fallback na corrupte update | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Hash/size + active/previous. |
| Cache cleanup | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Media-GC behoudt active/previous; Chromium bewijst shellcachecleanup. |
| Onvoldoende opslag | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Preflight rekent alleen ontbrekende geverifieerde bytes plus 16–64 MiB reserve. |

### Operations

| Capability | Baseline | Huidige code | Desktop Chromium-bewijs | Fysiek LG | Bewijs en beperking |
|---|---|---|---|---|---|
| Heartbeat | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Stabiele 30 s interval. |
| App version | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Env-versie, niet meer hardcoded pilot-1. |
| Active release | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Heartbeat + DB. |
| Desired release | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Manifest/bootstrap en geredigeerde heartbeat-syncdetail melden de gewenste release. |
| Storage usage | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Heartbeat en Lab. |
| Storage quota | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | Heartbeat en Lab. |
| Current item | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | In geredigeerde sync_detail. |
| Last playback error | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Heartbeat bewaart alleen foutcode, actie, item-ID en ISO-timestamp. |
| Network state | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_WEB_API` | `NEEDS_PHYSICAL_LG_TEST` | `navigator.onLine`; geen connection-qualitymodel. |
| Watchdog | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Start-, currentTime-, stalled-, waiting- en decodebewaking; Chromiumtests dekken decode en stall. |
| Gecontroleerde reload | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Maximaal twee reloads per persistent 15-minutenvenster, daarna foutstatus/cooldown. |
| Revoked device | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Server weigert token; live UX onderscheidt revoked niet van unpaired. |
| Disabled screen | `CONDITIONAL` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` | Bootstrap filtert disabled; expliciete beheerboodschap ontbreekt. |
| 24-uurs soaktest | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NOT_IMPLEMENTED` | `NEEDS_PHYSICAL_LG_TEST` | Lab-protocol/resultaatveld aanwezig; nog niet uitgevoerd. |
| Geheugen- of resourcegroei | `NOT_IMPLEMENTED` | `CONDITIONAL` | `NOT_IMPLEMENTED` | `NEEDS_PHYSICAL_LG_TEST` | Geen automatische heap/resource sampling; soak moet fysiek/remote-debug. |

### Browser-API feature detection

| API | Productiegebruik | Device Lab | Fysiek LG |
|---|---|---|---|
| `serviceWorker` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `caches` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `indexedDB` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `navigator.storage` | `CONDITIONAL` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `storage.estimate` | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `storage.persist` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `storage.persisted` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `MediaSource` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `MediaSource.isTypeSupported` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `navigator.mediaCapabilities` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| Fullscreen API | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| Page Visibility API | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| Screen Orientation API | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| Network Information API | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `getVideoPlaybackQuality` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| `requestVideoFrameCallback` | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| Web Crypto | `SUPPORTED_BY_CODE` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| BroadcastChannel | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| WebSocket | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |
| EventSource | `NOT_IMPLEMENTED` | `SUPPORTED_BY_CODE` | `NEEDS_PHYSICAL_LG_TEST` |

Het Lab degradeert veilig wanneer deze API's ontbreken. De productieplayer degradeert voor Cache Storage, IndexedDB en Web Crypto naar een herstelbare fout, maar heeft nog geen alternatieve opslagadapter naast Cache Storage.

## Gevonden problemen

### P0 — productieblokkerend

1. **Geen fysiek LG-bewijs.** Geen codec, autoplay-, storage-, reboot-, transition-, autostart- of soakresultaat mag als LG-ondersteuning worden gepubliceerd.
2. **MP4-output is nog niet met echte binaries bewezen.** Signed upload, queueclaiming, private Storage-I/O, checksums, database-updates en retry/failuretransities zijn aangesloten en lokaal geïntegreerd. FFmpeg/ffprobe ontbraken echter in de uitvoeringsomgeving, waardoor nog geen echte `player_1080p`-variant is gegenereerd. Daardoor is de productieclaim nog niet hard.

### P1 — oplossen vóór pilot op LG

1. **Range is streamend maar niet random-access.** Voor een late range leest/verwerpt de Cache Storage-stream eerst voorafgaande chunks. Veel seeks kunnen traag zijn op zwakke SoC's.
2. **Blobfallback materialiseert het hele bestand.** Zonder actieve SW-controller gebruikt de adapter `response.blob()`.
3. **App-shellprecache is minimaal.** Install cached alleen `/`; Next chunks komen pas runtime cache-first binnen. Offline direct na eerste load of na deploymentwisseling moet apart worden getest.
4. **Manifesthash wordt niet client-side geverifieerd.** De databasehash dekt het gepubliceerde JSON-document, terwijl de Player-API release-item-ID's en tijdelijke signed URL's reconstrueert. Dit contract moet eerst canoniek gelijkgetrokken worden; blind hashen aan de client zou geldige releases blokkeren.
5. **StorageManager is niet universeel.** Wanneer `navigator.storage.estimate` ontbreekt, gaat de Player door om oudere LG-engines niet categorisch van updates uit te sluiten; fysieke quotatests blijven nodig.

### P2 — kwaliteit en operations

1. PWA-manifest heeft geen officiële iconen/maskable iconset: `apps/player/app/manifest.ts:3-14`.
2. Manifest forceert landscape; portrait Signage is niet als eigen compositie uitgewerkt.
3. Normale playback toont permanent een diagnostics-aside, in strijd met de Playercanon: `apps/player/app/_components/player-runtime.tsx:594-613`.
4. Pairingexpiry roteert niet live; polling kan tot reload blijven doorgaan.
5. Live revoked/disabled worden niet als onderscheiden publieke toestand teruggegeven.
6. CSP staat `unsafe-inline` toe en `connect-src` is breed; functioneel maar nog te harden: `apps/player/next.config.mjs:8-16`.
7. Transition Lab's `blankMs` is een timingbenadering, geen pixelgebaseerde zwart-framewaarneming: `apps/player/app/device-lab/device-lab-client.tsx:306-336`.
8. De gevraagde corrupte asset staat niet in de automatische transitionsequence; hij wordt als afzonderlijke playbacktest uitgevoerd.
9. Handmatige PASS/FAIL-resultaten missen testeridentiteit, stap-timestamps en bewijsbijlagen.
10. Device Lab-runs kunnen lokaal worden opgeslagen maar niet vanuit de UI opnieuw worden geopend of vergeleken.

## Opgelost in deze taak

- PWA-manifest toegevoegd.
- Service Worker met feature-detected registratie toegevoegd.
- Network-first navigatie en cache-first shellresources toegevoegd.
- Securityheaders, CSP, no-referrer en Service-Worker-Allowed toegevoegd.
- Media-storeinterface met Cache Storage-adapter toegevoegd.
- HTTP single-range, open-ended range, suffix range, `206`, `416`, `Accept-Ranges`, `Content-Range` en `Content-Length` toegevoegd.
- Range-unittests toegevoegd.
- Cache-responses bevatten nu expliciete lengte- en Rangeheaders.
- Web Crypto, Cache Storage en IndexedDB krijgen expliciete beschikbaarheidscontrole.
- Active/previous release-stores toegevoegd.
- Persistente releaseactivatie verplaatst naar de veilige loopgrens.
- Previous-releasefallback bij corrupte/missende active release toegevoegd.
- Begrensde herstelvolgorde aan productie-events gekoppeld met een origin-persistent reloadbudget en cooldown.
- Chromiumtests bewijzen decodefout → retry → skip → fallback → heartbeat, stalled zonder tijdvoortgang → retry en `ended` → directe itemwissel.
- Device-token wordt in live mode alleen als bearer aanvaard en uit de zichtbare runtime-URL verwijderd.
- Heartbeatinterval ontkoppeld van itemwissels.
- Heartbeat uitgebreid met appversie, deployment-SHA, storage, netwerk en huidig item.
- Afgeschermde Device Capability Lab-route toegevoegd.
- Device Lab-sessies falen gesloten zonder een signing secret van minimaal 32 tekens; regressietests dekken ontbrekend, te kort, geldig en verlopen.
- Browser-API-, codec-, playback-, corrupt-media-, transition-, storage- en handmatige testregistratie toegevoegd.
- JSON/Markdownexport, lokale IndexedDB-opslag en server-side geredigeerde centrale opslag toegevoegd.
- Force-RLS testruntabel en RLS-tests toegevoegd.
- Centrale testrunopslag is expliciet alleen voor `service_role` schrijfbaar; anon en authenticated worden door grants en RLS geweigerd.
- Reproduceerbare synthetische FFmpeg-testmediagenerator toegevoegd.

## Veranderingenlijst

In de onderzochte worktree zijn voor deze audit de volgende implementatiebestanden nieuw of gewijzigd:

- `apps/player/app/_components/player-runtime.tsx`
- `apps/player/app/_components/service-worker-registration.tsx`
- `apps/player/app/_lib/device-lab-auth.test.ts`
- `apps/player/app/_lib/device-lab-auth.ts`
- `apps/player/app/_lib/device-lab-session.ts`
- `apps/player/app/_lib/media-range.ts`
- `apps/player/app/_lib/media-range.test.ts`
- `apps/player/app/_lib/player-cache.ts`
- `apps/player/app/_lib/player-media-store.ts`
- `apps/player/app/_lib/player-recovery.test.ts`
- `apps/player/app/_lib/player-recovery.ts`
- `apps/player/app/api/device-lab/runs/route.ts`
- `apps/player/app/api/device-lab/session/route.ts`
- `apps/player/app/api/player/heartbeat/route.ts`
- `apps/player/app/api/player/manifest/route.ts`
- `apps/player/app/device-lab/device-lab-client.tsx`
- `apps/player/app/device-lab/device-lab-core.ts`
- `apps/player/app/device-lab/device-lab.module.css`
- `apps/player/app/device-lab/page.tsx`
- `apps/player/app/layout.tsx`
- `apps/player/app/manifest.ts`
- `apps/player/next.config.mjs`
- `apps/player/public/sw.js`
- `scripts/generate-lg-test-media.sh`
- `supabase/migrations/20260718180000_player_device_lab_runs.sql`
- `supabase/tests/rls_player_device_lab_runs.sql`
- `tests/player/device-lab.spec.ts`
- `tests/player/watchdog-recovery.spec.ts`
- `tests/player-offline/range-service-worker.spec.ts`
- `docs/player/lg-webos-capability-audit.md`
- `docs/player/lg-hosted-vs-packaged.md`
- `docs/player/lg-physical-test-protocol.md`

## Testmedia en generatie

Voor een echte Lab-deployment:

1. Installeer FFmpeg 6 of nieuwer.
2. Voer vanaf de repositoryroot uit:

   ```bash
   scripts/generate-lg-test-media.sh
   ```

3. Voor de optionele codecs:

   ```bash
   VEYOCAST_OPTIONAL_CODECS=1 scripts/generate-lg-test-media.sh
   ```

4. Controleer `apps/player/public/device-lab-media/SHA256SUMS.txt`.
5. Deploy dezelfde Playerbuild en open iedere asset-URL rechtstreeks vóór de LG-run.

De generator gebruikt uitsluitend FFmpeg `lavfi`-bronnen (`testsrc2`, `color`, `sine`) en bevat geen third-party beeld of audio.

## Nog uit te voeren fysieke LG-tests

Leg per run exact model, firmware, webOS Signage-versie, launchmodus, resolutie, oriëntatie en netwerk vast.

1. Hosted HTTPS-URL openen en vier uur geldige diagnosesessie starten.
2. User agent/engine vergelijken met officiële modelinformatie.
3. Service Worker registratie, controller en update na deploymentwissel.
4. Eerste sync en volledig asset/hashresultaat.
5. JPEG, PNG, alpha-PNG en WebP op 1080p; aanvullend representatieve 4K-input.
6. Baseline 720p25, Main 1080p30, High 1080p50, High 1080p60 silent.
7. Lage, gemiddelde en hoge bitrate.
8. Muted autoplay; audible autoplay alleen als expliciete optionele scherminstelling.
9. `loadedmetadata`, `canplay`, `playing`, `timeupdate`, `waiting`, `stalled`, `ended`, `error`.
10. Playback quality en dropped frames waar beschikbaar.
11. Image→image, image→video, video→image en video→video.
12. Strategie A met één video-element en strategie B met twee.
13. Meerdere daadwerkelijk gelijktijdige videotags en hardwaredecoderlimiet.
14. Visuele zwart-framewaarneming met externe camera of framecapture; Labtiming alleen is onvoldoende.
15. Seek naar begin/midden/einde en netwerkinspectie van `206`/headers.
16. Meerdere grote-video-ranges om SoC-/geheugenbelasting te meten.
17. Offline tijdens meerdere loops.
18. Volledige offline reload.
19. App afsluiten en opnieuw openen terwijl offline.
20. Volledige schermreboot terwijl offline.
21. Storage usage/quota en `persisted()` vóór/na persist request, afsluiting en reboot.
22. Atomic update tijdens image en video; power cycle vóór en na loopgrens.
23. Corrupte pending asset en previous fallback.
24. Onvoldoende opslag zonder active/previous te verwijderen.
25. Revoked device en disabled screen.
26. Browserchrome, cursor, fullscreen, screensaver en URL-autostart.
27. Herstel na stroomuitval.
28. 24-uurs soak met geheugen-, resource-, heartbeat-, stall- en decodefoutregistratie.
29. Optioneel HEVC, VP8, VP9, HLS en DASH uitsluitend als productroadmap dat rechtvaardigt.

## Hosted versus packaged besliscriteria

Een packaged webOS Signage-app is **nog niet bewezen noodzakelijk** voor basisbeeld/video, pairing en offline webstorage. Hij wordt wel waarschijnlijk nuttig of noodzakelijk wanneer de fysieke test laat zien dat een hosted browser-URL tekortschiet voor:

- betrouwbare autostart en lifecyclecontrole;
- persistent storage na appafsluiting/reboot;
- screensaver- of power-management;
- stabiele device-identiteit en exacte model-/firmwaredata;
- LG SCAP/IDCAP-capabilities;
- browserchromevrije kioskpresentatie;
- native of chunked media-opslag;
- hardwaredecoder-/multiple-video-tagcontrole;
- herstel na process kill of stroomuitval.

SCAP, IDCAP en JS Services zijn LG-specifiek en zijn vanuit een gewone hosted pagina niet als standaard Web API beschikbaar. Toegang daartoe betekent in de praktijk een packaged app en een model-/firmwarecompatibiliteitsmatrix.

## Voorlopige aanbeveling

**Hosted webplayer met beperkingen.**

De huidige architectuur is geschikt om een gecontroleerde fysieke LG-pilot te starten, niet om al algemene LG webOS Signage-ondersteuning te claimen. Die pilot moet het ontbrekende fysieke P0-bewijs leveren; vóór productie moeten daarnaast de resterende code- en operationele P0/P1-punten worden gesloten.

De go/no-go-regel voor hosted productie is:

- **Hosted voldoende** wanneer app-shell en media na reboot offline blijven, MP4-profielen betrouwbaar spelen, Range/seek stabiel is, browserchrome/autostart beheersbaar zijn en de 24-uurs soak groen blijft.
- **Hosted met beperkingen** wanneer slechts een gedocumenteerde model-/firmwarelijst en strikt genormaliseerd mediaprofiel betrouwbaar zijn.
- **Hybride adapter nodig** wanneer Cache Storage/Range of lifecycle per engine sterk verschilt maar standaard webcode nog bruikbaar blijft.
- **Packaged LG-app nodig** wanneer autostart, storagepersistentie, screensaver/power recovery, device APIs of decodercontrole niet via de hosted browser haalbaar blijken.

Totdat de fysieke resultaten zijn opgeslagen, blijven alle LG-cellen in dit rapport `NEEDS_PHYSICAL_LG_TEST` en mag VeyoCast niet communiceren dat LG Signage algemeen ondersteund is.
