# Publisher/backoffice nulmeting

**Basis-SHA:** `85739a0`  
**Branch:** `veyocast/s31-publisher-backoffice-canon`  
**Datum:** 23 juli 2026

## Bestaande sterke basis

- expliciete tenantcontext en server-side capabilities;
- exclusieve tenant- of platformnavigatie;
- light/dark/system en lokale tabelvoorkeuren;
- private tenantmedia, TUS-upload, worker en gebruiksimpact;
- playlistrevisionguards, drag-and-drop en bronduur voor MP4;
- immutable releases, preflight, diff en desired/active-sync;
- schermlifecycle, pairing, heartbeat en logische verwijdering;
- Player manifest v1, hashverificatie, last-known-good en atomic activation.

## Route- en uitvoeringsmatrix

| Gebied | Bestaand | Canonwerk |
|---|---|---|
| Tenant-shell | vaste 248px sidebar, drawer mobiel | vaste donkere 224px sidebar, oranje actieve rail, bottomnav mobiel |
| Overzicht | actie-inbox, summary, vloot | Publisherstatus, quick actions, nu actief, aandacht, activiteit |
| Media | library, inspector, uploadtray | bulk, tags/mappen, duplicate-impact, editor en herstel |
| Playlists | lijst, create/duplicate | cards, previews, planning en versiecontext |
| Playlist Studio | DnD, revision, publishflow | 3-panelen, selectie, inline duur, inspector, autosave, undo/redo |
| Schermen | vloot, detail, lifecycle | cards, bulk, groep/planning en assignmentbron |
| Activiteit | append-only tabel | filters, objectnamen, veilige diff en Publishercontext |
| Schermgroepen | ontbreekt | tenant-scoped groepen en immutable target snapshots |
| Planning | ontbreekt | timezone/DST-aware schedules, conflict en precedence |
| Templates | lokale naam-presets | echte tenant/platformtemplates met previewcompatibiliteit |
| Beheer-PWA | ontbreekt | manifest, shellcache, veilige tenantcache en conceptherstel |

## Bekende contractgaten

- itemnaam wijzigt nu ten onrechte de globale mediatitel;
- transition, crop/focus, trim, itemtitel, enabled en secties ontbreken;
- huidige `rollback` is operationele reassignment en geen nieuwe versie;
- publish heeft nog geen idempotency command-id;
- auditinsert is niet volledig server-authoritatief;
- `tenant_editor` heeft momenteel ook publicatierecht;
- groepen, schedules, templates, saved views en bulkcommands ontbreken;
- Control heeft geen PWA/service worker.

## Veilige volgorde

Nieuwe schema’s en RPC’s worden additief toegevoegd na migratie
`20260725140000_staging_player_demo_playlist.sql`. Bestaande v1-RPC’s en
manifestvelden blijven tijdens de migratie beschikbaar. Nieuwe schedule- of
sectionsemantiek wordt pas naar Players gestuurd na capability- en
contracttests; last-known-good blijft altijd de fallback.
