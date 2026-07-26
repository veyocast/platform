# VeyoCast voor LG webOS Signage

Deze workspace beheert twee zelfstandige webOS Signage-IPK's:

```text
Productie, bevroren: nl.veyocast.player.webos_1.0.1_all.ipk
Installatietest:       nl.veyocast.player.webos.smoketest_1.0.2_all.ipk
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

CLI 3.2.5 wordt ongewijzigd gebruikt. Het upstreampakket schrijft
`webOS-Packager-Version: x.y.x` en gebruikt de Signage-envelope waarmee 1.0.0
op het doelapparaat werd geaccepteerd. De eerdere lokale pnpm-patch wijzigde
deze envelope en is na de 1.0.1-installatieregressie verwijderd. Er is geen
eigen `ar`, `tar`, Debian- of IPK-builder.

De huidige herstelbuild bouwt uitsluitend smoketest 1.0.2 en eist:

- packageformat 2 en de ongewijzigde CLI-marker `x.y.x`;
- eigenaar `1001/1001`;
- mappen `0777`;
- bestanden `0604` of `0666`, overeenkomstig de geaccepteerde 1.0.0;
- exact toegestane runtimebestanden;
- geen secrets, sourcemaps, developmenthosts of moderne niet-getranspilede
  JavaScript-syntaxis.

Dit is geen claim dat ruime packagebestandsrechten algemeen wenselijk zijn.
Het is een gecontroleerde terugkeer naar de bewezen geaccepteerde Signage-
packageroutput. Verander de envelope pas na partnerdocumentatie én een fysieke
installatietest.

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

`build:ipk` bouwt tijdens het incidentonderzoek niet opnieuw de bevroren
productie-wrapper. De officiële packager legt host- en bouwtijdmetadata vast;
daarom publiceert CI niet een later herbouwd bestand, maar exact het
geïnspecteerde immutable bestand uit
`apps/marketing/public/ipk/`.

Publiceer de bytegelijk gevalideerde set naar Marketing:

```bash
pnpm --filter @veyocast/lg-webos-signage publish:marketing
pnpm --filter @veyocast/lg-webos-signage validate:publication
```

Na deployment:

```bash
pnpm --filter @veyocast/lg-webos-signage validate:downloads
```

Forensische controles:

```bash
bash apps/lg-webos-signage/scripts/audit-public-ipk.sh \
  https://veyocast.nl/ipk/nl.veyocast.player.webos_1.0.1_all.ipk \
  apps/marketing/public/ipk/nl.veyocast.player.webos_1.0.1_all.ipk \
  dist/lg-webos/evidence/public-1.0.1
```

Zie voor oorzaak, hashes, headers en de volledige 1.0.0/1.0.1-vergelijking
[`docs/incidents/2026-07-26-lg-ipk-1.0.1-installation-audit.md`](../../docs/incidents/2026-07-26-lg-ipk-1.0.1-installation-audit.md).

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
