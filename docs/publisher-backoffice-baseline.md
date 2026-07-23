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

## Eindstand van de canonuitvoering

De nulmeting hierboven blijft het historische vertrekpunt. De branch heeft de
volgende gaten aantoonbaar gesloten:

- de 224px Publisher-sidebar is vast, donker en onafhankelijk scrollbaar;
- tenant- en platformcontext tonen nooit gelijktijdig concurrerende navigatie;
- dashboard, Media, Playlists, Studio, Schermen, Planning, Templates,
  Activiteit en Instellingen gebruiken dezelfde rustige responsive patronen;
- light/dark/system, informatiedichtheid en persoonlijke kolommen zijn lokaal
  persistent zonder tenantdata in browseropslag te zetten;
- Media heeft serverpaginering, raster/tabel, filters, inspector,
  mappen/tags/favorieten, opgeslagen persoonlijke views, herstelbare
  archivering, gebruiksimpact en een globale uploadtray;
- Playlist Studio heeft drie panelen vanaf 1200px, mobiele sheets, DnD,
  toetsenbordalternatieven, secties, item-/playlistinspectors, bronduurgrenzen,
  preview per scherm, debounced serverbevestigde autosave, revisionconflicten,
  lokaal herstel en echte Player-syncstatus;
- playlist- en mediawijzigingen lopen via tenantgescheiden, idempotente,
  server-geaudite guarded commands;
- publicatie blijft immutable; herstel maakt altijd een nieuw concept;
- Schermen ondersteunt kaarten/tabel, actieprioriteit, groepen, bulkacties,
  assignmentbron, onboarding en lifecycle;
- Planning ondersteunt eenmalig, dagelijks, wekelijks, weekdagen,
  tijdvensters, tenanttijdzone, DST en occurrence-gebaseerde conflicten;
- de worker activeert schedule-snapshots zonder de Player-offlinegaranties te
  verzwakken;
- Control is installeerbaar als privacyveilige PWA met shellcache en
  routegebonden conceptherstel.

## Bewust niet stilzwijgend ingevulde productbesluiten

Deze onderwerpen zijn niet met een opportunistische lokale implementatie
vastgezet, omdat ze een blijvend Player-, autorisatie- of samenwerkingscontract
zouden introduceren:

1. **Gecontroleerde visuele templates.** De huidige tenanttemplates zijn
   veilige playlistsnapshots. Parametergebonden templates met tekst-, kleur-,
   beeld- en portrait/landscape-rendering vereisen één versieerbaar
   template-rendercontract dat Control, manifest en Player delen.
2. **Algemene offline mutatiequeue.** Uploadresume en één coherente
   Studio-intent zijn veilig. Een onbeperkte multi-intentqueue vereist
   deterministische merge-, afhankelijkheids-, encryptie- en
   conflictsemantiek.
3. **Planning als afzonderlijke capability.** Planning gebruikt nu de
   bestaande tenant-playlistschrijfrechten. Een nieuwe capability verandert
   de rolmatrix en moet productbreed worden vastgesteld.
4. **Organisatiebrede voorkeurensync.** Thema, dichtheid, kolommen en views zijn
   bewust persoons- en browsergebonden; server-sync vraagt een expliciete
   privacy- en profielkeuze.

De uitvoerings- en testdetails staan in
[`publisher-backoffice-release-evidence.md`](publisher-backoffice-release-evidence.md).
