# Exacte visuele overname

## 1. Ontwerpautoriteit

De gepubliceerde Sync-versie 2 en marketingversie 1 van 17 oktober 2026 zijn vastgezet in `reference/sites-publication/sites-provenance.json`. De volledige getrackte bron komt uit de betreffende commits; geen bestand in die snapshots is voor deze overdracht aangepast. `manifests/sites-files.json` en `manifests/assets.json` leggen hashes vast. De hashes zijn controleerbaar met `scripts/verify-package.py`.

De opdracht is exacte overname, niet een vertaling naar een andere designstijl. Gebruik bestaande markup/componenten/CSS zoveel mogelijk letterlijk. Waar Next.js of native integratie een andere componentstructuur vereist, blijft het uiteindelijke uiterlijk en bedieningsgedrag gelijk. Een nieuwe componentbibliotheek rechtvaardigt geen andere standaardknoppen, spacing, fonts of dialogs.

Demo-, omgeving- en statusclaims zijn de gerichte uitzondering op letterlijke tekstovername: vervang uitsluitend aantoonbaar onjuist geworden prototypecopy (zoals “geen live dienst”, “voorbeeldaanvraag” of “alleen lokaal opgeslagen”) door feitelijk correcte productiecopy zodra de echte dienst werkt. Behoud layout, typografie, informatierangorde en interactie; dit staat geen algemene herschrijving of redesign toe.

## 2. Bronnen per laag

| Laag | Exacte referentie onder `reference/sites-sync/` |
|---|---|
| Shell, navigatie, account, feedback | `src/App.tsx`, `src/ui.tsx`, `src/icons.ts`, `src/styles.css` |
| Overzicht | `src/modules/Overview.tsx`, `overview.css` |
| Content, Studio, screen rendering | `src/modules/Content.tsx`, `content.css` |
| Playlists en preflight/publicatie | `src/modules/Playlists.tsx`, `playlists.css` |
| Schermen, planning, playerstaten | `src/modules/Players.tsx`, `players.css` |
| Beheer en mobiele taken | `src/modules/Admin.tsx`, `admin.css` |
| Publieke website | `src/Marketing.tsx`, `src/marketing.css`, `src/marketing-main.tsx` |
| Bestaande gepubliceerde uitvoer | `reference/marketing-publication/dist/` vanaf pakketroot |

Behoud de bestaande labels, informatierangorde, detailpanelen, mobiele ondernavigatie, acties, focus-/hover-/disabledstaten en reduced motion. Echte serverstatus vervangt de demo-inhoud met dezelfde visuele semantiek. Transparant herstelbare fouten en ontbrekende rechten blijven herkenbaar.

## 3. Assets en branding

| Bestand in `public/assets/` | Gebruik |
|---|---|
| `brand-hero.png` | Exacte 1254×1254 bron van het 3D-merkbeeld. |
| `brand-hero-480.webp`, `brand-hero-800.webp`, `brand-hero-1254.webp` | Bestaande geoptimaliseerde afleidingen, ongewijzigd gebruiken in responsive marketing/playerpresentatie. |
| `brand-icon.svg` | Exacte Screen Sync-geometrie; basis voor appicon-export. |
| `full-dark.svg`, `full-light.svg` | Exact woordmerk; geen nagemaakte tekst met een vergelijkbaar font. |
| `logo-pack.zip` | Oorspronkelijke vector-/merkexport. |
| `manrope.woff2`, `inter.woff2` | Lokale UI-fonts; behoud loading/fallback en schaal. |
| `onzetrots-brush.ttf`, `clubmuur-wall.webp` | OnzeTrots-contentthema, plus meegeleverde licentiebestanden. |

Kopieer bestanden byte-identiek naar de doelapp; behoud daarnaast originele bronnen als er verplichte platformexports bijkomen. Geef een eventuele nieuwe bestandsnaam een expliciete hashmapping. Geen hergeneratie, retouche of vervangend stockbeeld. Het pakket bevat geen nieuw ontworpen merkbeeld.

Hero en icon hebben verschillende rollen. Gebruik het volledige hero-beeld met `contain`/de bestaande Sites-beeldpresentatie voor de player-opstart; het woordmerk blijft intact in 16:9 en 9:16. De presentatie toont echte fase/status en een bruikbare fout-/herstelactie. Een koude offlineboot kan dit beeld lokaal tonen en daarna de laatst geldige publicatie starten. Een visueel mooie splash mag last-known-good playback niet oneindig blokkeren.

Android-launchericon gebruikt het vectorbeeldmerk binnen de platformmaskers. De veilige padding is een exportkeuze, geen redesign. De volledige hero hoort niet als onleesbaar klein vierkant launchericon te dienen. Volg het icon-kit README en behoud bestaande resourcenamen, appidentiteit en Androidreleaseflow.

## 4. Baseline en vergelijking

Maak vóór het porten een reproduceerbare referentieset op de developmentserver. Gebruik dezelfde browser, viewport, zoom/DPR, fonts, demo-fixtures, route en toestand voor referentie en rebuild. Wacht op geladen fonts/beelden; bevries tijdafhankelijke fixturevelden. Vergelijk bij stilstaande animatie of reduced motion en controleer motion ook afzonderlijk. Een serverimplementatie mag door echte data afwijken in inhoud, niet door willekeurige geometrie.

| Viewport / vorm | Verplichte representatieve dekking |
|---|---|
| 360×800 en 390×844 | Mobiele shell, lijsten, formulier/keyboard, Studio-actions, playlist, schermdetail, marketingmenu en aanvraag. |
| 768×1024 en 1024×768 | Navigatiebreekpunten, detailpaneel, editor, planning en marketingsecties. |
| 1440×900 en 1920×1080 | Alle hoofdroutes, open detail/modal, publicatiepreflight en marketingroutes. |
| Player 1920×1080 en 1080×1920 | Boot, pairing, downloaden, verifiëren, veilige overgang, actief, offline, fout/herstel; beide themafamilies. |

Leg per vergelijking URL, commit/build, datarevision, rol/tenant, toestand, viewport/DPR en bestandsnamen vast in `execution/visuele-acceptatie.csv`. Gebruik overlay/diff. Accepteer geen onverklaarde layout-, kleur-, font-, crop- of stateverschillen. Anti-aliasingverschillen door rendering mogen alleen gemotiveerd als technisch verschil worden geregistreerd, niet als reden om zichtbare ontwerpfouten te negeren. Er is geen procentuele 'goed genoeg'-tolerantie die een gewijzigd ontwerp toestaat.

Controleer alle routetypen en belangrijkste loading/empty/error/denied/success/stale-varianten. Voeg toetsenbord, focusherstel, deep links, terugnavigatie, 200% zoom en reduced motion toe. Zichtbare correcties voor echte fouten worden minimaal uitgevoerd en met oorzaak en screenshot vastgelegd; verander geen ontwerp onder het mom van opschonen.

## 5. Bewijsgrens

De meegeleverde Sites-publicatiecapture toont de marketingroot. Zij is geen nieuwe browser-QA, geen screenshotset van de werkplek en geen fysiek playerbewijs. De vorige prototype-oplevering heeft component-/DOM-/buildchecks, maar geen volledige visuele browseracceptatie. De uitvoerende Codex moet de referentie en rebuild daarom daadwerkelijk vergelijken; geen bestaande 'groene' screenshotclaim overnemen.
