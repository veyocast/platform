# S158 — Kolomvaste programma- en uitslagregels

## Doel

Maak clubbrede en poulebrede programma- en uitslagregels horizontaal vullend,
onderling exact uitgelijnd en volledig configureerbaar, met dezelfde
FieldFlow-theme-authority in preview, moderne Player en Static LG.

## Functionele scope

- Voeg pouleprogramma en pouleuitslagen voor vandaag toe naast de bestaande
  zeven-dagenvarianten.
- Programmeerregel, eerste regel:
  datum, tijd, thuislogo, thuisclub + team, thuis-kleedkamer, `vs.`, uitlogo,
  uitclub + team en uit-kleedkamer.
- Programmeerregel, tweede regel rechts uitgelijnd:
  scheidsrechter, veld en sportpark.
- Uitslagregel:
  datum, tijd, thuislogo, thuisclub + team, gereserveerde uitslagkolom,
  uitlogo en uitclub + team.
- Ieder als optioneel benoemd veld krijgt een eigen wizard- en editorinstelling.
- De eerste regel is duidelijk groter dan de tweede; de tweede regel gebruikt
  ongeveer de helft van de primaire corpsgrootte.
- Een afgeronde wedstrijd zonder gepubliceerde score blijft zichtbaar, maar de
  gereserveerde uitslagkolom blijft visueel leeg.
- Bestaande vaste rijhoogtes en deterministische paginering blijven behouden;
  één item rekt nooit uit tot schermhoogte.

## Scope-invarianten

- Clubbreed bevat uitsluitend wedstrijden waarbij minimaal één geselecteerd,
  actief team van exact de tenant en Sportlink-bron betrokken is.
- De tenantkeuze `thuis`, `uit` of `thuis en uit` wordt server-side toegepast
  op de echte thuis-/uitzijde van het geselecteerde eigen team.
- Poulebreed bevat alle wedstrijden uit exact de gekozen of veilig opgeloste
  poule, inclusief wedstrijden tussen twee andere clubs.
- `auto_current` lost server-side deterministisch één actuele poule op. Bij een
  ontbrekende of ambigue context is het resultaat leeg; bronbreed terugvallen
  is verboden.

## Presentatie- en releasegrens

- De volledige genormaliseerde displayconfig en het resolved tenanttheme worden
  in het immutable snapshot bevroren.
- Nieuwe rij-CSS gebruikt uitsluitend semantische `--vc-*`-variabelen en de
  twee beheerde logoplaatkleuren.
- Moderne Player, Static LG en renderfallback gebruiken dezelfde volgorde,
  zichtbaarheid, scoresemantiek en paginering.
- De liggende fullscreen-gradientnieuwsslide lijnt de zichtbare QR en het
  bronlogo rechts uit op exact dezelfde buitenste action/QR-safegrens.
- Historische snapshots en releases blijven immutable. Bestaande relevante
  latest-slides krijgen uitsluitend via opvolgsnapshots en renderjobs een
  correctie; de actieve Player-LKG wordt nooit vooraf gewijzigd.

## Eenvoudige tenantpaletten

- De beheerder kiest één hoofdkleur of een herkenbaar standaardpalet. Een
  deterministische generator maakt daar direct volledige lichte en donkere
  FieldFlow-paletten van en leidt de steunkleur en beide logoplaten af.
- Alle 26 semantische rollen per modus blijven daarna afzonderlijk vindbaar,
  bewerkbaar en direct zichtbaar in de live preview.
- Statuskleuren, QR-rollen en foto-overlays behouden hun vaste semantiek;
  opgeslagen kleuren zijn uitsluitend concrete hex- of rgba-waarden zodat ook
  Static LG dezelfde authority kan toepassen.
- Preview en server gebruiken exact dezelfde tien contrastchecks. Ongeldige
  kleurwaarden of contrastcombinaties blokkeren de opslaanknop én worden
  server-side opnieuw geweigerd met oorzaak, gevolg en herstelactie.

## Acceptatie

- Alle optionele velden zijn afzonderlijk aan/uit te zetten in aanmaakwizard en
  versie-editor en blijven na opslaan/publiceren behouden.
- Kolommen staan binnen een lijst onder elkaar, ook bij lange teamnamen, één
  item, volle pagina, portrait en twee landscape-kolommen.
- Club- en poulescope zijn met PostgreSQL-tests fail-closed bewezen.
- Een afwijkende tenantkleurmap is zichtbaar in moderne én Static-LG-regels.
- Ieder standaardpalet bevat exact 26 + 26 rollen, voldoet aan alle gedeelde
  contrastchecks en kan daarna per rol worden verfijnd.
- Datum/tijd/teams en de secundaire regel blijven op kijkafstand leesbaar zonder
  horizontale overflow.

## Gates

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm db:reset` en `pnpm test:rls`.
- `pnpm test:a11y` en Chromium-E2E.
- `pnpm test:player` en `pnpm test:player:offline`.
- Gerichte moderne/Static-LG render-, theme-, scope- en pagineringstests.
- Diffcheck, ownershipcontrole en changed-file credentialscan.
