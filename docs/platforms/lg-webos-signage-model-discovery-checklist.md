# LG webOS Signage model-discoverychecklist

Gebruik één kopie per exacte model-/firmwarecombinatie. Vul geen waarde in op
basis van een consumenten-webOS-TV of een ander Signage-model.

## Identiteit

- [ ] Exact commercieel modelnummer:
- [ ] Serienummer of interne assetcode:
- [ ] Productieregio:
- [ ] Firmwareversie:
- [ ] webOS Signage-versie:
- [ ] Datum/tijdzone:
- [ ] Oriëntatie en resolutie:
- [ ] Foto van model-/firmwarepagina zonder credentials:

## LG-documentatie

- [ ] LG-partneraccount/documentset beschikbaar:
- [ ] CLI-versie en Signage-compatibiliteit bevestigd:
- [ ] `appinfo.json`-velden voor dit platform bevestigd:
- [ ] SCAP-versie en toegestane methods bevestigd:
- [ ] IDCAP-versie en toegestane methods bevestigd:
- [ ] Vereiste permissions/services bevestigd:
- [ ] Package-signingvereisten bevestigd:
- [ ] Certificaatketen en truststore-eisen bevestigd:

Onbevestigde SCAP/IDCAP-methoden blijven uitgeschakeld.

## SI Server Setting

- [ ] Foto/tekst van de exacte SI Server Setting-pagina:
- [ ] Beschikbare velden en labels:
- [ ] Ondersteunde URL-schema's:
- [ ] HTTPS/TLS-versies:
- [ ] Clientauthenticatie:
- [ ] Verwachte bestandsnaam of manifest:
- [ ] Controle op checksum/signature:
- [ ] Installatietrigger en pollinginterval:
- [ ] Eerste installatie:
- [ ] Update van dezelfde app-ID:
- [ ] Downgrade/rollback:
- [ ] Gedrag bij mislukte download:
- [ ] Gedrag bij ongeldige package:
- [ ] Autostart na installatie:
- [ ] Autostart na normale power cycle:
- [ ] Autostart na stroomonderbreking:

VeyoCast `latest.json` wordt niet als SI Server-manifest gebruikt tenzij deze
exacte documentatie dat bevestigt.

## Netwerk en distributie

- [ ] Definitieve HTTPS IPK-URL:
- [ ] DNS bereikbaar vanaf Signage-VLAN:
- [ ] Certificaat geldig en volledige chain geleverd:
- [ ] `Content-Length`, MIME-type en Rangegedrag:
- [ ] Proxy/firewall allowlist:
- [ ] Download zonder secrets in URL:
- [ ] Certificaatvernieuwing getest:
- [ ] Vorige IPK-versie blijft beschikbaar:

## Acceptatie

- [ ] Alle twintig hardwaretests uit
  `docs/platforms/lg-webos-signage-ipk.md` uitgevoerd:
- [ ] Device Lab-run-ID's:
- [ ] 24-uurs soakbewijs:
- [ ] Open `FAIL`, `WARNING` en `UNTESTED`:
- [ ] Go/no-go door tweede reviewer:
- [ ] Ondersteuningsclaim beperkt tot exact model/firmware:
