# OnzeTrots → VeyoCast · overdracht voor Codex

Dit pakket bevat het goedgekeurde prototype, alle lokale assets en concrete instructies om de vormgeving en het gedrag over te nemen in de bestaande VeyoCast-repository. De VeyoCast-repo is voor deze overdracht alleen gelezen. De implementatie daar is nog niet uitgevoerd.

## Zo gebruik je dit pakket

1. Pak de ZIP uit in de root van `veyocast/platform`. De bestanden komen dan onder `docs/design/onzetrots-slides/` te staan.
2. Open `voorbeelden/index.html` voor het beeldarchief en de detailvarianten.
3. Geef Codex de onderstaande startopdracht. De volledige opdracht staat in `01-CODEX-OPDRACHT.md`.

```text
Implementeer de goedgekeurde OnzeTrots-slidecollectie volgens
docs/design/onzetrots-slides/01-CODEX-OPDRACHT.md.
Lees eerst AGENTS.md en het volledige overdrachtspakket. Gebruik de exacte
broncode en voorbeelden als visuele referentie. Integreer alle 36 families
in de actieve Sync-keten, inclusief preview, export en Player.
Volg 05-ACCEPTATIE-EN-TESTEN.md en lever een concrete PR met bewijs.
```

## Wat zit erin?

| Onderdeel | Inhoud |
| --- | --- |
| `01-CODEX-OPDRACHT.md` | Direct uitvoerbare implementatieopdracht |
| `02-VISUELE-SPECIFICATIE.md` | Laatste ontwerpbesluiten, maten, kleuren en bronprioriteit |
| `03-REPO-INTEGRATIE.md` | Gelezen actieve codepaden, datagaten, export en migraties |
| `04-DATA-EN-MOTION-CONTRACT.md` | Voorstel voor rijke data en gedeelde deterministische beweging |
| `05-ACCEPTATIE-EN-TESTEN.md` | Concrete visuele en technische acceptatiematrix |
| `06-SLIDE-CATALOGUS.md` | Alle 36 families, hun prototypecompositie en productiebron |
| `07-ASSETS-EN-HERKOMST.md` | Fonts, brushartwork, logo’s, achtergronden en credits |
| `08-VOORBEELDEN-EN-BESLUITEN.md` | Voorbeeldbediening, capturecontext en laatste besluiten |
| `broncode/` | Byte-identieke statische prototypebron: HTML, CSS, JS, catalogus en assets |
| `voorbeelden/` | 144 basisbeelden, 75 detailbeelden, 4 contactbladen en klikbare galerie |
| `codevoorbeelden/` | Uitvoerbare voorbeelden van selectie, zes slots en scrolltijd |
| `inventaris/` | Machineleesbare catalogus, assetaudit, repo- en capturebewijs |
| `MANIFEST.json`, `SHA256SUMS.txt` | Versies, aantallen en integriteitscontrole |

## Lokaal bekijken en controleren

Vanuit deze map:

```bash
python3 -m http.server 8080 --directory broncode
```

Open `http://localhost:8080`. De serverroot moet `broncode` zijn, omdat de referentie absolute assetpaden zoals `/assets/...` gebruikt. Er is geen installatie of build nodig. Het prototype gebruikt alleen meegeleverde lokale inhoud en geen live Sportlink-koppeling.

Controleer het pakket en voer de losse gedragsvoorbeelden uit:

```bash
python3 tools/verify-package.py
node --test codevoorbeelden/reference-behavior.test.mjs
```

De referentie is vastgelegd op prototypecommit `ae83f2b4312408eacae9f29177d3c743e104185b`; de repo-inspectie op VeyoCast main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`. De bron blijft ook zonder de online prototype-URL bruikbaar. De screenshots zijn verkleinde browsercaptures; de exacte maatvoering komt uit de logische canvassen en de bron-CSS.
