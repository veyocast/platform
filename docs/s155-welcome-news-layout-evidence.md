# S155 — Welkomstinformatie en nieuwsbeeldkwaliteit

## Resultaat

De gedeelde Editorial Arena-renderer en de statische LG Legacy-renderer tonen
de bezoekersteamslide voortaan als operationele ontvangstkaart: datum en
aanvang compact bovenaan, twee gelijkwaardige teamnamen, beide kleedkamers en
het veld. De header gebruikt de exacte Sportlink-accommodatienaam alleen als
die voor alle zichtbare tenantgebonden thuiswedstrijden gelijk en niet leeg is.
Bij gemengde of ontbrekende locaties blijft de tekst eerlijk generiek.

Alle gewone Editorial Arena-headers tonen de actuele lokale datum en tijd in
plaats van een tweede VeyoCast-vermelding. De locked VeyoCast-lock-up
linksonder blijft ongewijzigd de enige permanente softwarewatermark. Menu
Studio v2 houdt zijn eigen tenantlogoheader, omdat die route geen
VeyoCast-tekst bevat en een afzonderlijk canvassysteem gebruikt.

De fullscreen/split-gradient nieuwsslide ankert de QR-code aan de veilige
rechteronderhoek van de volledige canvas, verbergt de geschreven URL en maakt
de linker tekstzone donkerder. De QR zelf blijft naar de artikel-URL wijzen.
De RSS-ingest verkiest grotere volledige media-, enclosure- en HTML-bronnen
boven thumbnails. `object-fit: cover` blijft de aspectratio bewaken; een bron
met weinig pixels wordt niet voorgesteld als nieuw detail.

## Data- en releasegrens

Een forward-only wrapper verrijkt uitsluitend `sport_visitor_arrivals` met
`date`, `kickoffTime`, `homeTeam`, `awayTeam`, `homeRoom`, `awayRoom`, `field`
en `venueName`. De join vereist dezelfde tenant, Sportlink-databron, actieve
wedstrijd en gevalideerde thuiswedstrijd. Provider-URL's komen niet in het
Playerpayload.

Bestaande `latest`-slides krijgen een nieuwe snapshot van de exact
gepubliceerde versie. De bestaande S146-keten bouwt daarna alleen complete
immutable releasevertakkingen. Historische snapshots/releases, actieve
Player-LKG en pinned versies worden niet herschreven.

## Verificatie

- `pnpm db:reset`: groen.
- Gerichte S155-pgTAP: 26/26 groen.
- Gecombineerde S150/S154-regressie: 67/67 groen.
- Volledige `pnpm test:rls`: 75 bestanden en 1.886 assertions groen.
- Lokale database-lint en Supabase security advisor op foutniveau: groen,
  zonder bevindingen.
- `@veyocast/content-templates`: lint/typecheck en 62/62 tests groen.
- `@veyocast/player`: lint/typecheck en 247/247 tests groen.
- `@veyocast/integrations`: lint/typecheck en 111/111 tests groen.
- `@veyocast/media-worker`: lint/typecheck en 121/121 tests groen.
- Workspace `pnpm lint`, `pnpm typecheck` en `pnpm test`: elk 30/30 taken groen.
- Workspace `pnpm build`: 18/18 taken groen, inclusief de clientsecret- en
  webOS-compatibiliteitsguards.
- Een finale Chrome 79/webOS-review verving moderne flex-gap- en
  CSS-rekenconstructies in de nieuwe welkomstkaart door vooraf berekende
  groottevariabelen en margin/word-break-fallbacks. Daarna waren Player
  lint/typecheck, 247/247 unit-tests, de productiebuild en de gerichte moderne
  plus LG-layouttests opnieuw groen.
- `pnpm test:a11y`: 35 groen en één bewuste live-skip; de laatste Studio-route
  viel tijdens een preventieve Next-geheugenherstart uit en slaagde daarna
  geïsoleerd 1/1 in 8,3 seconden.
- Brede Chromium-E2E: 192 groen en 23 bewuste live-/evidenceskips. Twee tests
  verloren in de 21,6-minutenrun hun devserver/browserproces; exact dezelfde
  mobiele scrollmatrix en videoloop slaagden daarna geïsoleerd 1/1 en 1/1.
- Finale formele `pnpm test:player`: 119/119 groen, inclusief de 64-cellen
  FieldFlow-matrix, moderne en LG Legacy-output en alle welkomstmotions.
- Formele `pnpm test:player:offline`: 7/7 groen; last-known-good, atomaire
  cachewissel, corrupte pending assets en service-worker ranges blijven intact.
- `git diff --check`: groen.

Het aanvullende PR-, CI- en exact-SHA staging-/productiebewijs blijft bewaard
in het GitHub-runrecord en wordt bij de oplevering vermeld.
