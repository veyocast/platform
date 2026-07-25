# VeyoCast voor LG webOS Signage

Deze workspace bouwt twee zelfstandige webOS Signage-IPK's:

```text
nl.veyocast.player.webos_1.0.1_all.ipk
nl.veyocast.player.webos.smoketest_1.0.1_all.ipk
```

De productie-app is een dunne lokale shell rond
`https://player.veyocast.nl/lg`. Pairing, releases, playback, IndexedDB, Cache
Storage en last-known-good blijven in de bestaande hosted Player. De volledig
lokale smoketest gebruikt geen netwerk, iframe of backend en is bedoeld om
packageacceptatie, registratie, launch, JavaScript en remote-input afzonderlijk
te bewijzen.

## Officiële packaging

De build gebruikt uitsluitend de officiële LG/webOS-workflow:

```text
@webos-tools/cli 3.2.5
ares-config --profile signage
ares-package
```

CLI 3.2.5 schrijft upstream nog `webOS-Packager-Version: x.y.x` en neemt
hostmetadata over. De pnpm-patch
`patches/@webos-tools__cli@3.2.5.patch` corrigeert alleen die upstream
placeholder, eigenaar/rechten en reproduceerbare timestamps. Er is geen eigen
`ar`, `tar`, Debian- of IPK-builder.

De inspectiegate eist:

- `webOS-Packager-Version: 3.2.5`;
- eigenaar `0/0`;
- mappen `0755`;
- bestanden `0644`;
- exact toegestane runtimebestanden;
- geen secrets, sourcemaps, developmenthosts of moderne niet-getranspilede
  JavaScript-syntaxis.

## Bouwen en controleren

Vanaf de repositoryroot:

```bash
pnpm install --frozen-lockfile
pnpm --filter @veyocast/lg-webos-signage validate
pnpm --filter @veyocast/lg-webos-signage test
pnpm --filter @veyocast/lg-webos-signage validate:hosted
pnpm --filter @veyocast/lg-webos-signage build:ipk
pnpm --filter @veyocast/lg-webos-signage inspect
(cd dist/lg-webos && sha256sum --check checksums.sha256)
```

De IPK's zijn byte-reproduceerbaar bij dezelfde Git-commit. `SOURCE_DATE_EPOCH`
wordt automatisch uit de commitdatum afgeleid.

Publiceer de bytegelijk gevalideerde set naar Marketing:

```bash
pnpm --filter @veyocast/lg-webos-signage publish:marketing
pnpm --filter @veyocast/lg-webos-signage validate:publication
```

Na deployment:

```bash
pnpm --filter @veyocast/lg-webos-signage validate:downloads
```

## Productiestart en diagnose

De lokale productiepagina is direct zichtbaar en toont drie stappen: lokale
app, netwerk en hosted Player. De iframe wordt pas vrijgegeven na
`VEYOCAST_LG_PLAYER_READY`, protocol 1, pad `/lg`, vanuit exact
`https://player.veyocast.nl`.

De wrapper heeft begrensde back-off en de volgende veilige foutcategorieën:

- geen netwerk;
- DNS/host niet bereikbaar;
- TLS-fout wanneer de engine dit signaal beschikbaar maakt;
- hosted pagina niet geladen;
- iframe geblokkeerd;
- geen READY-bericht;
- onverwachte message-origin;
- JavaScript-fout.

BACK opent lokaal Playerbeheer. Er worden geen pairingcodes, tokens, cookies,
querystrings of media-URL's opgeslagen of getoond.

## Hardware

Gebruik voor LG 43UL3J-EP, webOS 6.0, firmware 03.24.90 het exacte protocol:

[`docs/platforms/lg-webos-43ul3j-ep-recovery.md`](../../docs/platforms/lg-webos-43ul3j-ep-recovery.md)

Autostart wordt op het scherm ingesteld met
**Startmodus applicatie: Lokaal**. Er is geen onbewezen private LG-API of
verzonnen `appinfo.json`-veld toegevoegd. Fysieke installatie, autostart,
pairingbehoud en 24-uurs playback blijven hardwaregates.
