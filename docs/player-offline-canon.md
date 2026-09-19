# Player Offline Canon

## Principles

- The player starts from last-known-good whenever possible.
- Network checks must not block valid cached playback.
- A pending release is not active until every required asset is downloaded and verified.
- A corrupt pending release is discarded or retried without interrupting active playback.
- The player never shows a black screen for temporary connectivity loss.
- Netwerkverlies schakelt bestaande playback direct naar `OFFLINE_PLAYING`
  zonder de actieve release of het actieve item te vervangen.
- Alleen tijdens aantoonbaar netwerkverlies staat rechtsonder een compacte
  tekstchip `Geen internetverbinding`; normale playback heeft geen permanent
  diagnosepaneel. De enige vaste system mark is de locked VeyoCast-lock-up
  linksonder op 40% opacity.

## State model

```text
UNPAIRED
READY
PLAYING
UPDATE_AVAILABLE
DOWNLOADING
VERIFYING
SWITCH_PENDING
OFFLINE_PLAYING
ERROR_RECOVERABLE
DISABLED
```

## Local storage

- App shell: Cache Storage.
- De service worker precachet vóór activatie de root, manifestmetadata,
  officiële setup-assets en alle door de eerste HTML-render gerefereerde
  Next.js shellbestanden.
- Manifests and sync metadata: IndexedDB.
- Dynamic renderer configuration is immutable published content. Authorized live
  datasets have an independent content revision; the last validated dataset and
  its assets are retained atomically with the local envelope. The runtime is locked application code;
  no stored template source or script is evaluated on the Player.
- Media assets: Cache Storage MVP; adapter abstraction for later OPFS/chunking.
- Asset keys: checksum-based.
- Storage quota checked before pending release download.

## Update flow

```text
1. Active release keeps playing.
2. Fetch desired release manifest.
3. Determine missing assets by hash.
4. Download missing assets.
5. Verify size/hash.
6. Mark desired release ready.
7. Switch the newest complete candidate at the next natural item/page boundary; a healthy video owns its ended/trim boundary.
8. Keep previous release as fallback.
9. Garbage collect old releases safely.
```

For a dynamic slide, the Player renders the bounded normalized snapshot as
HTML/CSS. The checksum-verified PNG belonging to the same snapshot remains a
required release asset and is used whenever the runtime payload is absent,
invalid or unsupported. Consequently a temporary renderer or browser
compatibility problem does not turn valid last-known-good playback into a black
screen.

## Video notes

- Muted by default.
- Use MP4/H.264/AAC MVP.
- Prepare abstraction for Range request handling.
- Test network loss during video.

## Diagnostics

Diagnostics are not public playback. They show:

- active release;
- desired release;
- download progress;
- storage;
- last successful sync;
- last error;
- app version;
- device session.

## FieldFlow rendererpariteit

FieldFlow verandert de update-state-machine niet. Modern Player en Static LG
lezen dezelfde resolved `themePresentation`, contentprojectie en assetmanifest
uit de immutable release. Static LG is een zelfstandige Chrome-79-veilige
renderer; pariteit wordt per renderfamilie getest en niet uit moderne DOM/CSS
afgeleid. Historische theme-ID's blijven renderbaar, maar nieuwe authoring
bevriest altijd FieldFlow.

Een rendererfout, ontbrekende dynamische payload of niet-ondersteunde
browserfeature activeert de checksum-geverifieerde poster/PNG-fallback van
dezelfde snapshot. Online synchronisatie blijft non-blocking zolang een geldige
lokale release bestaat; geen FieldFlow-surface mag pairing-, recovery- of
diagnostiek automatisch over geldige publieke content leggen.

## S185: actuele opdracht en live gegevens

De playlist-ID is de logische publicatie-identiteit. `playlist_publications`
verwijst naar één immutable configuratierevisie; `screens.target_revision`
ordent ook wisselingen tussen playlists. De player bereidt slechts één volgende
kandidaat voor. Nieuwere doelen annuleren oudere voorbereiding. Realtime is een
invalidering; de beveiligde API blijft de bron van waarheid. Bij reconnect wordt
direct de actuele opdracht opgehaald.

Live datasets komen uitsluitend via de device-geautoriseerde servergrens uit
`published_dynamic_data`, gekoppeld aan exacte gepubliceerde selectie/configuratie.
Ze wijzigen geen publicatie, afspeelindex of itemtimer. Normale bronupdates mogen
geen playlistrelease aanmaken. Het volledige lokale offlinecontract blijft
verplicht: ook media verderop moeten geverifieerd zijn voordat een nieuwe
configuratie wordt geactiveerd. Voorbereidingstijd en grenswachttijd worden apart
gerapporteerd. Een PNG blijft een geverifieerde compatibiliteitsfallback; actuele
HTML/CSS-data vereisen een ondersteunde runtime.

Zie [S185](s185-current-publication.md) voor generatiecontrole, cachebescherming,
eerste-framebevestiging en de expliciete uitzondering op wijzigingsvoorrang voor
planningen en sponsorplannen.
