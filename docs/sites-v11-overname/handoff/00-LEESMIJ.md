# VeyoCast — exacte Sites UI/UX naar het echte platform

11 oktober 2026 · Overdracht voor de implementerende Codex

**Doel:** neem deze Sites-interface en alle bijgeleverde templates exact over in `veyocast/platform`, met de bestaande echte backend, integraties en Player. Dit pakket bevat de concrete ontwerpbron, het onderzoek naar de verschillen en een uitvoerbare opdracht. De migratie zelf is nog niet uitgevoerd.

## Zo gebruik je dit pakket

1. Pak de ZIP uit in een map die Codex kan lezen, naast je checkout van [veyocast/platform](https://github.com/veyocast/platform).
2. Open Codex in die echte platformrepository. Geef het absolute pad van de uitgepakte map mee.
3. Plak de volledige inhoud van **`CODEX-STARTPROMPT.txt`**. Vervang alleen `<ABSOLUUT_PAD_NAAR_DIT_PAKKET>` door dat pad.
4. Laat Codex vanaf een aparte branch/worktree implementeren en de referentie naast de nieuwe app vergelijken. De prompt vraagt volledige werkende koppelingen, alle templates en bewijs per onderdeel.
5. Beoordeel het resultaat op staging. De bestaande productie-uitrol blijft de laatste, afzonderlijke releasehandeling; de Sites-website zelf hoeft hiervoor niet te worden vervangen.

De opdracht is bewust exact: geen nieuwe vormgeving op basis van screenshots. JSX, CSS, afbeeldingen en fonts zijn beschikbaar en vormen de bron.

## Wat is vergeleken?

| Bron | Vastgezet |
| --- | --- |
| [Huidige Sites](https://veyocast-ui.dgwebserv.chatgpt.site) | Versie **11**, commit `b1cae899af19fc39908217253094c5240d7359fc`; deploymentstatus succesvol gecontroleerd |
| [GitHub platform](https://github.com/veyocast/platform) | `main`, commit `6fcc26f02c8050b7244e3660a93b85f02491e121`, opgehaald op 11 oktober 2026 |

De huidige productie-SHA van `control.veyocast.nl` is niet onderzocht. GitHub HEAD en de gedeployde app kunnen verschillen. Codex moet vóór uitrol de echte deploymentversie vastleggen.

## Belangrijkste uitkomst

Dit is meer dan een stylesheetwissel. De basistokens en officiële merkbestanden komen al overeen. De mooiere Sites-ervaring ontstaat door andere componenten, verhoudingen, CSS-overrides en vooral andere mobiele workflows.

De productiecode heeft daarentegen echte opslag, rechten, uploads, publicaties en deviceafhandeling. Sites gebruikt daarvoor grotendeels browserdemodata. De nieuwe UI moet boven op die productiefunctionaliteit komen.

| Verschil | Werk dat noodzakelijk is |
| --- | --- |
| Mobiele playlisteditor en inhoudkiezer | Exacte Sites-compositie met echte bibliotheek, meervoudige selectie, batchopslag, conflictbehandeling en uploads |
| OnzeTrots TV, blauwe/witte LED-stijlen en instelbare schaal | Thema- en documentcontracten, databaseguards, snapshots, fonts, renderers en assetcache samen uitbreiden |
| Algemene Studio rendert nu via een andere engine | Gedeelde vertrouwde presentatielaag en workeradapter toevoegen zodat preview én export de Sites-layout tonen |
| Sportlink, LED Scores, Menu/Twelve | Wizards aan echte bronselecties en bestaande serveracties koppelen; extra bestaande productievarianten behouden |
| Scherm met zijvlak/onderbalk/drie vlakken | Nieuwe contentzonefunctie van opslag tot Player; fysieke locatiezones zijn geen equivalent |
| YouTube-playlist en AVIF | Bestaande single-video- en uploadcontracten veilig uitbreiden; alleen een mooie keuze is onvoldoende |
| Moderne Player en Static LG | Beide renderpaden aanpassen en afzonderlijk controleren; ook offline en live gegevens |

De volledige mapping bevat **225 route-/endpointrecords, 46 template-/rendererrecords en 30 workflowrecords**. Dit zijn onderzoeksrecords, geen aantallen al gemigreerde of geteste functies.

## Inhoud

| Bestand/map | Gebruik |
| --- | --- |
| `01-CANON.md` | Bindende ontwerpkeuzes, scope, behoud van platformgaranties en definitie van gereed |
| `CODEX-STARTPROMPT.txt` | Kant-en-klare implementatieopdracht |
| `docs/UITVOERINGSPLAN.md` | Geordende werkpakketten, beslissingen, gaten en verificatie |
| `docs/UI-STYLING-CANON.md` | Exacte typografie, kleuren, componenten, breakpoints en bronpaden |
| `docs/WORKFLOWS-DATA-MIGRATIE.md` | Mobiele media/playlistflows, opslag, mutaties, publicatie, planning en gegevensmigratie |
| `docs/TEMPLATES-PLAYER-INTEGRATIE.md` | Alle Studio’s, templates, thema’s, contracten, worker en Player |
| `docs/PLATFORM-BEHOUD-EN-DEPLOYMENT.md` | Routebereik, rechten, native apps, infrastructuur en uitrol |
| `docs/ACCEPTATIE-EN-QA.md` | Vergelijkingsmethode en functionele acceptatie |
| `inventory/` | Route-, template-, workflow- en visuele testmatrix, tokens, asset- en broninventaris |
| `source/sites/` | **253 ongewijzigde bronbestanden**, inclusief **82 public-assets** en lockfile |
| `reference-preview/` | Gebouwde lokale referentie met dezelfde UI-componenten en assets |
| `tools/` | Pakketcontrole en herbouw van de lokale referentie |
| `SOURCE-PROVENANCE.json` | Exacte herkomst en onderzochte versies |
| `VERIFICATION.json` | Werkelijk uitgevoerde pakketcontroles en niet-uitgevoerde runtimeacceptatie |
| `MANIFEST-SHA256.json` | Bestandschecksums voor transport- en volledigheidscontrole |

Paden in de onderzoeksrapporten met `S:`/`S` zijn relatief aan `source/sites/`; `G:`/`G` aan de echte GitHub-root. Regelaanduidingen horen bij de vastgezette commits. Historische paden onder `/workspace/` geven alleen de onderzoekscheckouts aan. Het pakket heeft die locaties niet nodig.

## De referentie lokaal bekijken

Er staat al een gebouwde versie in de ZIP. Daarvoor zijn geen Sites-account, Node of npm-installatie nodig; Python 3 en een browser volstaan.

Open een terminal in de uitgepakte pakketmap:

```sh
python3 reference-preview/serve.py
```

Op Windows kan `python` in plaats van `python3` nodig zijn. Open vervolgens:

- App: `http://127.0.0.1:4173/#/dashboard`
- Playlists: `http://127.0.0.1:4173/#/dashboard/playlists`
- TV-template liggend: `http://127.0.0.1:4173/?template=wedstrijd&orientation=landscape`
- TV-template staand: `http://127.0.0.1:4173/?template=wedstrijd&orientation=portrait`

De acht directe templatewaarden zijn `wedstrijd`, `programma`, `uitslagen`, `stand`, `kantine`, `clubnieuws`, `partners`, `welkom`. Alle overige flows bereik je in de app. De directe templatepagina is een extra QA-ingang rond de originele component; geen wijziging van het Sites-ontwerp.

Stop met Ctrl+C. Bij een bezette poort: `python3 reference-preview/serve.py --port 4174`. Open dan dezelfde paden op poort 4174. Gebruik de server; dubbelklikken op `index.html` laadt de absolute assetpaden niet correct.

Deze referentie gebruikt demogegevens en lokale browseropslag. Het is geen deploybare vervanging voor productieauthenticatie, API’s of de volledige narrowcastingketen. Ze werkt los van de Sites-host. Fonts, afbeeldingen en scripts zitten lokaal in het pakket; expliciet aangeklikte externe links blijven externe links.

## Volledigheid en grenzen

**De ingecheckte Sites-bron, templates, fonts en afbeeldingen zijn compleet meegeleverd. Eigen ontwerpen, wijzigingen en uploads die alleen in jouw browser staan, zijn niet geïnventariseerd en zitten niet in deze ZIP.** Sites bewaart die in localStorage/IndexedDB. Als je die inhoud ook wilt meenemen, moet Codex eerst een expliciete export/import bouwen met de originele blobs, veilige upload en ID-omzetting. Alleen een JSON-export of een `asset:`-adres is onvoldoende. Dit staat als apart werkpakket beschreven.

Alle 254 git-tracked Sites-bestanden zijn geïnventariseerd; alleen het gegenereerde `tsconfig.tsbuildinfo` is niet meegenomen. Sourcebytes zijn niet hernoemd, opgeschoond of opnieuw gegenereerd. Gitmetadata, dependencies, secrets, runtimecache en browsergegevens zitten niet in de export. De oorspronkelijke Sites-hostingbestanden zijn alleen referentie; ze worden niet over de productie-infrastructuur gekopieerd.

Het pakket is op bronintegriteit en bundelbaarheid gecontroleerd. Visuele browservergelijking, stagingmigratie en fysieke telefoon-/tv-acceptatie moeten tijdens de implementatie plaatsvinden; de testmatrix markeert die als `NOT_RUN`. Dit pakket claimt geen reeds bereikte productiepariteit.

## Integriteit controleren en referentie herbouwen

Controleer meteen na uitpakken:

```sh
python3 tools/verify-package.py
```

Alle manifestpaden zijn relatief. Bewerk de referentie niet om verschillen met de nieuwe productie-UI te laten verdwijnen. Werk in de doelrepository.

Herbouw is optioneel. Met de bij de Sites-lockfile passende Node/pnpm-toolchain:

```sh
cd source/sites
pnpm install --frozen-lockfile
cd ../..
node tools/build-reference.mjs
```

Het lokale referentiewrapper gebruikt de originele appcomponenten. Een herbouw kan bundelnamen veranderen; de aangeleverde manifestchecksums beschrijven uitsluitend de oorspronkelijke ZIP. Gebruik `verify-package.py` vóór installatie of herbouw.
