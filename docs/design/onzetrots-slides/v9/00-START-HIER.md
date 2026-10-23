# OnzeTrots → VeyoCast · overdracht voor Codex

Dit pakket bevat de op **23 oktober 2026** bijgewerkte v9-referentie: iedere slide heeft een aparte kopcontainer met subtitel boven de titel links en het clublogo rechts. Beide teksten zijn bewerkbaar; alle koppen gebruiken het echte Rubik Distressed 400. De extra binnenkoppen vervallen, behalve precies drie op Onze wedstrijddag. Verjaardagen tonen datum linksboven, felicitatie met voornaam + achternaaminitiaal, leeftijd en teaminfo. Welkom/bezoekende teams hebben een grotere, schaalbare bezoekersweergave. V7 laat eerst de achtergrond, daarna de kop en vervolgens de inhoudscontainers verschijnen. Dit pakket bevat het goedgekeurde prototype, alle lokale assets en concrete instructies om de vormgeving en het gedrag over te nemen in de bestaande VeyoCast-repository. De VeyoCast-repo is voor deze overdracht alleen gelezen. De implementatie daar is nog niet uitgevoerd.

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
| `09-VALIDATIE.md` | Bewijs en grenzen van de pakketvalidatie |
| `referenties/menustudio/broncode/` | Beperkte Menu Studio-bronsnapshot met32bestanden |
| `referenties/menustudio/voorbeelden/menu-studio/` | Vier actuele Menu Studio-beelden en browserbewijs |
| `11-MOTION-V7.md` | Gefaseerde entree: achtergrond, kop en inhoudscontainers |
| `10-WIJZIGINGEN-V6.md` | Historische v6-layoutbesluiten |
| `12-WIJZIGINGEN-V8.md` | Behouden fontkeuze, subtitel-/titelkop en status van Menu Studio |
| `13-WIJZIGINGEN-V9.md` | Laatste besluit: binnenkoppen en verjaardagsvolgorde |
| [14-AANVULLENDE-PROMPT-CONTEXTREGEL.md](14-AANVULLENDE-PROMPT-CONTEXTREGEL.md) | Optionele volgende stap: contextregel circa 30% groter; nog niet toegepast in prototype of screenshots |
| `broncode/` | Byte-identieke statische prototypebron: HTML, CSS, JS, catalogus en assets |
| `voorbeelden/` | Complete basiscollectie, detailbeelden, contactbladen en klikbare galerie; exacte aantallen in capture-inventaris |
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

De definitieve v9-bron staat op `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`. Alle160 individuele layoutbeelden zijn nieuw vastgelegd op deze v9-versie:144 basisbeelden en16 bezoekersdetails. De vier Menu Studio-beelden en de beperkte bronsnapshot horen bij `77eec81092ab829302dd835fb430161fe93be220`; de drie v7-motionbeelden blijven uitsluitend historisch bewijs van de entreevolgorde. De repo-inspectie dateert van22oktober2026, op VeyoCast main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`. De bron blijft zonder de online prototype-URL bruikbaar. Screenshots zijn verkleinde browsercaptures; exacte maatvoering komt uit de logische canvassen en bron-CSS. De contextregelopdracht in14 is aanvullend en nog niet geïmplementeerd.
