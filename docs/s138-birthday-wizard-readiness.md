# S138 — Verjaardagswizard selectie en readiness

## Oorzaak

De wizard presenteerde alle teams als een lange checkboxwand en bewaarde een
lege teamselectie impliciet als “alles”. Daardoor was “zonder team” niet bewust
te kiezen of te combineren. Bij verborgen teamnamen verwijderde de
snapshotbuilder bovendien ook de team-ID's, waarna de Player hetzelfde item
nogmaals filterde en geldige verjaardagen wegvielen.

De laatste stap koppelde authoring-readiness daarnaast aan het huidige aantal
gerenderde pagina's en gaf één generieke melding over activeren en templates.
Dat was onjuist wanneer de module, synchronisatie en beide ingebouwde
vormgevingen gewoon beschikbaar waren, maar de actuele periode of selectie nul
personen opleverde.

## Herstel

- Een doorzoekbare dialoog biedt `Alle`, `Overige (zonder team)` en losse teams
  als echte meerkeuzeselectie met huidige aantallen en een compacte samenvatting.
- Het contract onderscheidt expliciet `all` van `selected` en bewaart apart of
  personen zonder team meetellen. Ontbrekende velden behouden de oude
  semantiek voor bestaande slides.
- De snapshotbuilder filtert één keer op de volledige veilig verrijkte set,
  bewaart team-ID's als niet-zichtbare filtermetadata en verwijdert alleen de
  teamnaam wanneer `Team tonen` uitstaat.
- De gedeelde Player-resolver begrijpt de nieuwe combinatie en vertrouwt oude,
  reeds servergefilterde snapshots waarin die metadata nog niet aanwezig was.
- Liggend (16:9) en staand (9:16) zijn zichtbare radiokeuzes in Vormgeving en
  Review. De tekst legt uit dat VeyoCast de ingebouwde verjaardagvormgeving
  automatisch gebruikt; de gebruiker hoeft geen los template te beheren.
- De loader controleert zowel template als actuele gepubliceerde versie en
  bewaart afzonderlijk of status-, data-, team-, media- en templatequeries zijn
  gelukt.
- De status- en create-RPC vereisen een geslaagde, verjaardagspecifieke
  synchronisatiemarkering. Een oude algemene `public_people`-timestamp kan de
  wizard daardoor niet ten onrechte activeren of blokkeren.
- Readiness noemt per fout oorzaak, gevolg en herstelactie. Nul actuele pagina's
  blijft geldig en gebruikt het bestaande veilige Player-overslaggedrag.

## Veiligheidsgrenzen

De command-RPC en server-side capabilities blijven leidend. RLS blijft default
deny. Er gaan geen geboortejaren, membercodes of service-rolecredentials naar
Control of Player. De migratie maakt alleen nieuwe latest-snapshots waar nodig;
historische snapshots en immutable releases blijven ongewijzigd.

## Bewijs

- Contract-, Control- en Player-unitregressies zijn groen, inclusief legacy,
  team-plus-overige en verborgen-teamgevallen.
- De forward-only migratie past op een verse lokale database toe.
- De gerichte verjaardag-RLS-suite telt 48 groene assertions en bewijst zowel
  alleen-zonder-team als geselecteerd-team-zonder-zichtbare-teamnaam.
- De volledige RLS-suite telt 66 bestanden en 1.414 groene tests op een verse
  lokale database.
- Workspace lint, typecheck en unit zijn 30/30 groen; de productiebuild is
  18/18 groen.
- De toegankelijkheidsgate is 36 groen met één bewuste live-skip. De brede
  Chromium-run is 179 groen met 21 conditionele skips; één navigatie viel
  samen met een automatische Next-devserver-herstart en slaagde daarna
  geïsoleerd in 53,8 seconden.
- De echte Sportlink-verjaardagjourney is 1/1 groen en dekt `Alle`, `Overige`,
  een los team, gecombineerde selectie, staand, opslaan, mobiel, overflow en
  Axe. De screenshots staan in `docs/screenshots/s138-birthday-wizard/`.
- De Player-gate is 107/107 groen en de offline/LKG-gate 7/7 groen.

Staging- en productiereadback volgen na merge van exact dezelfde `main`-SHA.
