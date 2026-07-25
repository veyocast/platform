# VeyoCast Player voor LG webOS Signage

Dit project bouwt een klein, installeerbaar webOS Signage-IPK. Het bevat geen
tweede playerimplementatie. De package levert alleen:

- de webOS-appidentiteit `nl.veyocast.player.webos`;
- een lokale fullscreen shell;
- een lokale branded start- en foutweergave;
- begrensde netwerkretry en reloadbescherming;
- een streng begrensde bridge naar `https://player.veyocast.nl/lg`;
- feature detection en een adaptergrens voor later gevalideerde SCAP/IDCAP;
- bediening met standaard remote key-events en een lokaal beheer-/diagnosepaneel.

Device identity, pairing, screen assignment, manifests, media, caching,
release-switching, heartbeat, playback en playerrecovery blijven volledig in de
hosted VeyoCast Player.

## Vereisten

- Node.js 24;
- pnpm 11;
- de workspace-installatie uit de repositoryroot;
- `@webos-tools/cli` 3.2.5, exact gepind in het rootmanifest en de lockfile.

De officiële CLI ondersteunt het `signage`-profiel vanaf CLI 3.2.0. Deze
repository gebruikt 3.2.5 en voert vóór ieder pakket:

```bash
ares-config --profile signage
```

uit.

## Valideren en bouwen

Voer vanaf de repositoryroot uit:

```bash
pnpm install --frozen-lockfile
pnpm --filter @veyocast/lg-webos-signage validate
pnpm --filter @veyocast/lg-webos-signage test
pnpm --filter @veyocast/lg-webos-signage build:ipk
```

De build gebruikt equivalent aan:

```bash
ares-package -o dist/lg-webos apps/lg-webos-signage
```

met expliciete uitsluitingen voor bron-/buildbestanden. Daarna worden
`ares-package --info` en `ares-package --info-detail` uitgevoerd en moet de
metadata exact overeenkomen.

Output:

```text
dist/lg-webos/nl.veyocast.player.webos_1.0.0_all.ipk
dist/lg-webos/checksums.sha256
dist/lg-webos/latest.json
dist/lg-webos/release-notes.json
```

`LG_WEBOS_DISTRIBUTION_BASE_URL` mag tijdens een releasebuild op een expliciete
HTTPS-map worden gezet. Zonder die waarde blijft `downloadUrl` in `latest.json`
bewust `null`.

## Platform- en securitygrens

De lokale app framet alleen `https://player.veyocast.nl/lg`. De `/lg`-route
staat alleen een `file:`-ancestor toe, terwijl de lokale wrapper alleen berichten
van de exacte productieorigin accepteert. Het frame:

- gebruikt geen extern script;
- heeft geen toegang tot willekeurige top-level navigatie;
- laadt geen ontwikkel- of staginghost;
- bevat geen secret, devicewachtwoord of service-accountcredential;
- gebruikt dezelfde remote HTTPS-origin voor Player localStorage, IndexedDB,
  Cache Storage en service worker.

SCAP en IDCAP worden alleen gedetecteerd, niet aangeroepen. De adapter heeft
expliciete grenzen voor lifecycle, remote input, netwerk, opslag, display,
firmware/webOS-versie, apprestart en gecontroleerde reboot. Informatie die niet
via de webstandaard bewezen kan worden blijft `null`; restart- en rebootverzoeken
geven veilig `supported: false` terug. Concrete LG-methods, permissions,
autostart en updates worden pas toegevoegd nadat partnerdocumentatie en echte
hardware dat onderbouwen.

## Remote input

De bridge herkent Enter/OK, BACK, de vier pijltjestoetsen en
play/play-pause-events. BACK sluit playback niet direct, maar opent of sluit het
lokale Playerbeheer. Tijdens playback schakelt Enter of play/pause de actieve
video tussen afspelen en pauzeren. Pairing- en setupfocus blijft door de hosted
Player beheerd.

## Testen op hardware

Een lokaal gebouwd IPK is geen bewijs van algemene LG-ondersteuning. Gebruik:

- `docs/platforms/lg-webos-signage-ipk.md`;
- `docs/platforms/lg-webos-signage-model-discovery-checklist.md`;
- `docs/player/lg-physical-test-protocol.md`.

Device-installatiecommando's en SI Server-velden worden bewust niet gegokt.
Exact model, firmware, Signage-versie, signingpolicy, install-/updategedrag,
autostart en rollback moeten eerst op het doelapparaat en in de officiële
partnerdocumentatie worden vastgesteld.
