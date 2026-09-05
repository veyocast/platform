# S150 — Rustige bezoekerswelkomstkaart

## Doel

Maak het bezoekerswelkomstscherm op afstand rustiger en relevanter, zonder de
immutable snapshot-/releaseketen of Player-LKG te verzwakken.

## Scope

- Maximaal twee bezoekende teams per pagina.
- Landscape gebruikt twee gelijke kolommen; portrait twee gelijke rijen.
- Eén bezoeker vult alleen het eerste halve slot.
- De eerstvolgende wedstrijd staat op pagina één vooraan.
- Exact drie zichtbare kaartregels:
  - `[Clubnaam] [team]`
  - `Aanvang: [tijd] | Veld [veldnummer]`
  - `Kleedkamer: [kleedkamer]`
- Regels twee en drie zijn exact 20% kleiner dan regel één en niet vet.
- Het lokale uitteamlogo vult de kaart op 30% opacity en staat groot op een
  witte rechterplaat.
- Dezelfde output in de gedeelde renderer en de statische LG-runtime.
- Compositorvriendelijke welkomstmotion en reduced-motionfallback.
- Een forward-only snapshotbuilderwrapper normaliseert nieuwe snapshots en
  queue't bestaande actieve `latest`-slides opnieuw.

## Niet in scope

- Per-slide of centrale tenant-themeauthoring wijzigen.
- Sportlink-providerrequests of pouleprogramma/-uitslagselectie wijzigen.
- Scheidsrechteraankomstslides herontwerpen.
- Historische snapshots, fallbackassets of releases muteren.
- Providerlogo's reconstrueren of vanaf een provider-URL in de Player laden.
- Player-auth, pairing, service worker, cacheactivatie of LKG wijzigen.

## Acceptatie

- `Aankomst` komt nergens zichtbaar voor op een bezoekerswelkomstslide.
- Kaarten bevatten geen welkomstkicker, competitie, duty-desk of sponsor.
- Vier bezoekers leveren twee pagina's met elk maximaal twee kaarten.
- Eén landscapebezoeker staat links; één portraitbezoeker staat boven.
- Volgorde begint met de eerstvolgende aanvang.
- Veld- en kleedkamerprefixen worden niet dubbel weergegeven.
- Logoachtergrond is exact 30%; de rechterplaat is wit en gebruikt dezelfde
  checksumgebonden asset.
- Moderne Chromium- en Chrome 79/LG-output bewijzen dezelfde copy en geometrie.
- Alle verplichte releasegates zijn groen vóór commit, push, merge en deploy.
