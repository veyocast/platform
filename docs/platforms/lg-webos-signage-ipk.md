# VeyoCast LG webOS Signage IPK

## Status

De repository bevat een echt bouwbaar en inspecteerbaar webOS
Signage-bronpakket voor:

```text
App ID: nl.veyocast.player.webos
Versie: 1.0.0
Hosted route: https://player.veyocast.nl/lg
```

De bron en CI zijn gereed. Algemene productieondersteuning is nadrukkelijk nog
niet bewezen: de package moet eerst op het exacte LG Signage-model en de exacte
firmware worden geïnstalleerd, bijgewerkt, herstart en 24 uur getest.

## Wat het IPK bevat

Het runtimepakket bevat uitsluitend:

- `appinfo.json`;
- `index.html`;
- `bootstrap.js`;
- `platform-adapter.js`;
- `offline.html`;
- de officiële locked inverse VeyoCast-lock-up;
- twee platformvereiste PNG-iconen, mechanisch geschaald uit de goedgekeurde
  maskable master.

README, package.json, scripts, source maps, secrets en developerendpoints worden
vóór package-inspectie uitgesloten. De inspectiescript leest naast
`ares-package --info` en `--info-detail` ook de werkelijke IPK-archiefinhoud en
faalt bij ieder onverwacht runtimebestand.

## Relatie met de hosted Player

De IPK is een thin wrapper. Hij laadt uitsluitend:

```text
https://player.veyocast.nl/lg
```

De hosted Player blijft de enige implementatie voor:

- device identity en pairing;
- schermtoewijzing;
- immutable manifests en release-switching;
- afbeelding- en videoplayback;
- Cache Storage, IndexedDB en last-known-good;
- heartbeat, telemetry, diagnostiek en playerrecovery.

Het frame blijft op de remote HTTPS-origin. Daardoor krijgen pairingdata en
playercache geen tweede namespace in de IPK. De lokale shell voegt alleen
appidentiteit, een branded eerste-load-fallback, begrensde retry,
lifecycle-signalen, remoteinput en niet-gevoelige wrapperdiagnostiek toe.

## Security- en platformgrens

- Alleen `https://player.veyocast.nl` staat in de package-allowlist.
- `/lg` accepteert alleen framing vanuit een lokale `file:`-app; andere
  Playerroutes blijven `frame-ancestors 'none'` en `X-Frame-Options: DENY`
  gebruiken.
- De wrapper accepteert alleen berichten van de exacte Player-origin en het
  exacte frame.
- De Player accepteert wrapperberichten alleen van zijn daadwerkelijke parent
  met lokale opaque origin.
- Het iframe kan niet willekeurig top-level navigeren.
- Er staat geen signing key, devicepassword, pairingtoken, signed media-URL,
  Supabasekey of service-accountcredential in het IPK.
- SCAP en IDCAP worden feature-detected maar niet aangeroepen. De status
  betekent dus nooit automatisch `ondersteund`.
- De platformadapter begrenst lifecycle, remote input, netwerk, storage,
  oriëntatie, firmware/webOS-versie, apprestart en reboot. Onbewezen
  LG-specifieke waarden blijven `null`; restart en reboot blijven expliciet
  `supported: false` totdat partnerdocumentatie en echte hardware dit toelaten.

## Build en inspectie

Vereisten: Node 24, pnpm 11 en een Linux/macOS-omgeving met `ar` en `tar` voor
de onafhankelijke archive-inhoudscontrole.

```bash
pnpm install --frozen-lockfile
pnpm --filter @veyocast/lg-webos-signage validate
pnpm --filter @veyocast/lg-webos-signage test
pnpm exec ares-config --profile signage
pnpm --filter @veyocast/lg-webos-signage build:ipk
pnpm --filter @veyocast/lg-webos-signage inspect
(cd dist/lg-webos && sha256sum --check checksums.sha256)
```

De CLI is exact gepind op `@webos-tools/cli@3.2.5`. De build gebruikt de
officiële `signage`-profile en `ares-package`.

Artifacts:

```text
dist/lg-webos/nl.veyocast.player.webos_1.0.0_all.ipk
dist/lg-webos/checksums.sha256
dist/lg-webos/latest.json
dist/lg-webos/release-notes.json
```

De huidige productie-IPK wordt door Marketing statisch aangeboden op:

```text
https://veyocast.nl/ipk/nl.veyocast.player.webos_1.0.0_all.ipk
```

De bytegelijke checksum, `latest.json` en release notes staan onder dezelfde
`/ipk/`-map. Publiceer nooit handmatig een los IPK zonder de
`publish:marketing`-validatie.

## Versies en release

Verhoog voor iedere wijziging aan de lokale wrapper de semantische versie in:

1. `apps/lg-webos-signage/appinfo.json`;
2. `apps/lg-webos-signage/package.json`;
3. `platform-adapter.js`;
4. alle verwachte metadata in de validator/buildscripts.

De hosted Player kan onafhankelijk worden gedeployed zolang het bridgeprotocol
achterwaarts compatibel blijft. Een breaking bridgewijziging vereist een nieuw
protocol en een IPK-update.

De workflow `.github/workflows/lg-webos-signage-ipk.yml`:

- valideert bron en hosted route op relevante pull requests;
- bouwt alleen op `main` of handmatige dispatch;
- gebruikt het beschermde Environment `lg-webos-signage-release`;
- inspecteert metadata én packageinhoud;
- bewaart IPK en metadata als GitHub Artifact;
- kan alleen na handmatige dispatch en Environment-approval uploaden naar een
  expliciete HTTPS PUT-map.

Environmentconfiguratie voor de optionele upload:

| Type | Naam | Betekenis |
|---|---|---|
| Variable | `LG_WEBOS_DISTRIBUTION_BASE_URL` | Publieke/afgeschermde HTTPS-map, eindigend op de releasefolder |
| Secret | `LG_WEBOS_DISTRIBUTION_BEARER_TOKEN` | Schrijfcredential voor de HTTPS PUT-endpoint |

Zonder deze waarden wordt alleen een GitHub Artifact gemaakt. De workflow
installeert of benadert nooit een LG-device.

## HTTPS-distributie

Host de vier bestanden uit `dist/lg-webos/` als één versie-eenheid. Gebruik
`distribution/lg-webos/README.md` als neutrale directorylayout.
`latest.json` is alleen VeyoCast-metadata. Er is bewust geen SI
Server-manifestformaat verzonnen.

## Pairing en lokale data

Na eerste succesvolle load gebruikt `/lg` dezelfde pairing-API als de gewone
Player. Het device-token blijft in origin-scoped localStorage op
`player.veyocast.nl`. Releases en assets blijven in de bestaande
IndexedDB/Cache Storage-implementatie.

Bij een normale IPK-update met dezelfde app-ID en intacte remote origin hoort
pairing behouden te blijven. Dit moet fysiek worden bewezen; webOS kan opslag
per firmware, installatietype, appreset of factory reset anders behandelen.

Appdata resetten kan daarom pas als modelprocedure worden gedocumenteerd nadat
het echte menu is geïnspecteerd. Functioneel betekent reset:

1. app/browserdata voor VeyoCast wissen;
2. zo nodig de app verwijderen en opnieuw installeren;
3. de oude device-session in Control intrekken;
4. het apparaat opnieuw pairen.

Claim geen remote wipe: een offline device kan last-known-good blijven tonen
tot fysieke reset of volgende serververbinding.

## Retry, restart en power cycle

De lokale shell verlangt een gevalideerde `/lg`-handshake. Bij een mislukte
eerste load toont hij geen browserfout, maar een lokale branded status. Retry
gebruikt 2, 4, 8, 16, 30 en maximaal 60 seconden, maximaal acht automatische
pogingen per voortschrijdend venster van vijftien minuten. Daarna blijft een
expliciete retryactie beschikbaar. Dit voorkomt een onbeperkte reloadlus.

Na succesvolle Player-load verbergt de wrapper de cached Player niet bij
netwerkverlies. De bestaande last-known-good- en offlinechiplogica blijft dan
leidend. Bij terugkeer uit suspension of netwerkherstel stuurt de wrapper alleen
een resumeevent; hij vernietigt niet automatisch de Player.

## Remote en diagnostiek

- Enter/OK: normale focusactie; tijdens playback play/pause.
- BACK: opent of sluit Playerbeheer en beëindigt playback niet direct.
- Pijlen: normale spatial/focusnavigatie.
- Play en play/pause: bedienen de actieve media wanneer de remote deze events
  levert.

Playerbeheer toont alleen wrapperversie, netwerkstatus en capabilityklasse.
Geen tokens, tenantdata, media-URL's of ruwe logs.

## Rollback

1. Behoud iedere eerder goedgekeurde IPK en checksum onder een onveranderlijke
   versie-URL.
2. Selecteer de vorige IPK volgens het model-specifieke SI Server-updatepad.
3. Bewijs dat dezelfde app-ID een downgrade toestaat; sommige firmwares kunnen
   dit blokkeren.
4. Controleer pairing, actieve cached release en heartbeat na rollback.
5. Als downgrade niet wordt toegestaan: publiceer een nieuw hoger versienummer
   met de vorige wrapperinhoud.

Muteer nooit een eerder gepubliceerde IPK onder dezelfde URL.

## SI Server-velden die nog validatie vereisen

Zonder exact model en LG-partnerdocumentatie zijn minimaal open:

- server-/application URL en eventueel afzonderlijk manifestveld;
- ondersteunde URL-schema's en TLS/certificaatketen;
- authenticatie voor download;
- package-signing of LG-certificaat;
- versie- en downgradevergelijking;
- install-/updatepolling;
- fout- en rollbackgedrag;
- autostart/power-on-status;
- storagebehoud bij update/reinstall;
- SCAP-/IDCAP-versie en permissions.

Gebruik
`docs/platforms/lg-webos-signage-model-discovery-checklist.md`.

## Hardwareacceptatie

Productieondersteuning is pas mogelijk nadat op de echte display zijn bewezen:

1. eerste SI Server-installatie;
2. automatische launch;
3. pairing;
4. lokale datagarantie na restart;
5. afbeeldingplayback;
6. H.264/AAC-video;
7. mixed-media loop;
8. remote bediening;
9. netwerkdisconnect;
10. koude start zonder netwerk;
11. netwerkherstel;
12. display power cycle;
13. IPK-update via SI Server Setting;
14. mislukte update en rollback;
15. 24-uurs soak;
16. opslagdruk;
17. geheugengroei;
18. TLS-certificaatvernieuwing;
19. factory reset;
20. herinstallatie.

Voer daarnaast het uitgebreidere protocol in
`docs/player/lg-physical-test-protocol.md` uit. Totdat resultaten zijn
gereviewd, blijven modelversie, minimum Signage-versie en supportedModels in
`latest.json` leeg/null.

## Waarom Android niet werkt

Een APK of AAB bevat Android-bytecode, Android manifests en Android-signing.
LG webOS Signage installeert webOS-IPK's met `appinfo.json` en een webOS
packageformat. De algemene VeyoCast Android-app en deze webOS-wrapper delen
daarom de hosted Player, maar zijn technisch verschillende distributiepakketten.
