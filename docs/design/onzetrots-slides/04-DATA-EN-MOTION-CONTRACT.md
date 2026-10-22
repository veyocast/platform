# Data en motion: implementatievoorstel met uitvoerbare voorbeelden

De bestaande repo is gelezen, maar de types hieronder zijn **een voorstel voor de nieuwe versie**, geen reeds bestaande VeyoCast-API. Pas ze binnen de bestaande contracts, canonical snapshots en verified assetrefs in. `03-REPO-INTEGRATIE.md` beschrijft welke bestaande projecties momenteel feiten verliezen.

## Rijke gegevens behouden

| Scène | Benodigde getypeerde feiten | Bronregel |
| --- | --- | --- |
| Stand | rowId, teamId, naam, logoRef, positie, played/won/drawn/lost/goalDifference/points, vorm, gecontroleerde eigen identiteit | Ontbrekende statistieken blijven null; niet uit punten verzinnen |
| Wedstrijd/ontvangst | matchId, home/away clubId en teamId, namen, beide logoRefs, kickoffAt, genormaliseerde status, veld, homeRoom/awayRoom | Eigen thuiswedstrijd op ID en tijd selecteren, vóór limiteren |
| Jarigen | Toegestane displayName, datumlabel, nullable leeftijd, toegestane team/rol | Bestaande privacy-/tenantfilters blijven gelden |
| Activiteiten/agenda | itemId, titel, tekst, datum/tijd, locatie, optionele imageRef | Individuele afbeeldingen behouden in projectie en assetset |
| Nieuws/verhaal | itemId, kop, intro, bron/URL en heroImageRef | Bestaande bron- en rechtencontrole behouden |
| Matchday | Resultaten, volledige stand en programma uit één geselecteerde team/poule/seizoencontext | Gevalideerde samengestelde snapshot; renderer haalt geen providers op |

Gebruik de bestaande verified assetrefvorm van de repo, niet een nieuw vrij URL-veld. Een ontbrekend uitlogo krijgt geen Duindorp-crest als vervanging. Collecteer ook assets die diep in nieuwe rij-/kaartvelden zitten en controleer hun checksums in Worker en Player.

De oude rij van vier strings blijft voor legacydocumenten geldig. Voeg de rijke gegevens versiegebonden toe; parse geen namen, leeftijden, statussen of tijdstippen terug uit samengevoegde displaystrings. Voeg licht/donker als expliciete gevalideerde presentatiekeuze toe.

## Scheiding van configuratie en bronfeiten

Een ontwerp bewaart toegestane bronselecties, oriëntatie, modus, achtergrond, snelheid en overige authoringopties. Het bewaart geen zelf gekopieerde Sportlinkstand of verzonnen bronfeiten in de seed. Een gekoppelde preview en publicatie projecteren de toegestane canonical snapshot. Laat `syncDynamicConfigurationSchema` en de bestaande feitenblokkade intact.

De aantallenknoppen voor welkom en de 0–6-dropdowns voor grids zijn prototypebediening. In productie volgen de aantallen de bron. Boven zes jarigen/activiteiten worden pagina’s met zes slots gevormd, inclusief lege restslots op de laatste pagina. Een stand blijft één doorlopende ranglijst.

## Deterministische beweging

`codevoorbeelden/reference-behavior.mjs` bevat dependencyvrije voorbeelden van:

- `selectUpcomingHomeFixtures`: identiteit, echte tijd, status, sortering, daarna max vier;
- `sixSlotPages`: zes stabiele posities, inclusief nul items en vervolgpaginering;
- `rankScrollAt`: dezelfde heen-en-terug-scrollpositie voor dezelfde elapsedMs;
- `pinnedOwnRowY`: begrensde eigen rij zonder dubbele kopie.

De bestanden zijn bedoeld om te begrijpen en te testen, niet om ongecontroleerd als productiepatch te kopiëren. De fixture in `welcome-fixtures.json` is synthetisch en gebruikt uitsluitend voorbeeld-ID’s. De status in dit voorbeeld is al genormaliseerd tot `scheduled`, `cancelled`, `postponed` of `finished`; de echte provideradapter moet de bronstatussen naar het bestaande canonical model vertalen.

Voor een scrollbereik M, snelheid v en pauze p=2,5 seconden duurt een cyclus `2*M/v + 2*p`. Begin op nul, wacht p, beweeg met v naar M, wacht p, beweeg terug naar nul. Bij M=0 blijft de positie nul. Rustig/standaard/snel zijn respectievelijk 19/30/48 logische pixels per seconde.

De zichtbare positie van de eigen rij is:

```text
clamp(normaleRijY - scrollY, 0, vensterhoogte - rijhoogte)
```

Een alternatieve renderer mag CSS sticky of expliciete lay-out gebruiken, zolang de compositie hetzelfde is. Bij een laatste plaats moet de rij vanaf het begin aan de onderrand zichtbaar zijn, ook wanneer haar normale positie buiten het eerste venster ligt. De beginpositie van de eerste plaats is de bovenrand.

## Eén tijdmodel voor alle renderpaden

De prototypebron gebruikt rAF en timers om dit browsergedrag te demonstreren. De productie-implementatie moet de tijdprojectie delen tussen DOM-preview, moderne Player en Worker. Stel elapsedMs expliciet vast; laat geen wall-clocktimer de inhoud van een exportframe bepalen.

De Worker moet voor frame t opnieuw de interne scène op t projecteren. De huidige algemene `document.getAnimations()`-freeze en `settledPng`-hergebruik leveren dit gedrag niet op. Gebruik voor bewegende scènes een framecache-identiteit die interne tijd, inhoud, assets, oriëntatie en relevante layout omvat. Behoud de strenge capture-CSP; geen prototype-JS injecteren of eval gebruiken.

Pauze bevriest de actieve verstreken tijd; hervatten heeft geen inhaalsprong. Tijd in een verborgen tabblad telt niet mee. Reduced motion geeft een leesbare stilstaande scène en behoudt normale handmatige bediening. Geen-scrollbereik, lege data en ontbrekende eigen rij moeten expliciete veilige uitkomsten hebben.

De voorbeelden testen de zuivere regels. Ze bewijzen niet dat de huidige VeyoCast-export of Player al correct werkt. Dat bewijs moet in de implementatie-PR volgen met gelijk getimede preview-/exportframes en een complete fallbackvideo.
