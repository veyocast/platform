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
7. Switch at loop/item boundary.
8. Keep previous release as fallback.
9. Garbage collect old releases safely.
```

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
