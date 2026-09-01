# S142 — LED Scores canvaseditor

## Doel

Vervang de vaste LED Scores-opmaak door een tenantveilige canvaseditor waarmee
ieder ondersteund wedstrijdmoment afzonderlijk voor 16:9 en 9:16 wordt
ontworpen. De Player vult alleen vooraf toegestane live velden en media in; een
canvasdocument wordt onderdeel van de bestaande immutable Goal Alert-versie en
maakt geen parallel publicatie- of afspeelmodel.

## Ownership

- `packages/contracts/src/ledscores-scene.ts` en gerichte contracttests;
- LED Scores Studio in tenant-Control, inclusief tenantmedia-upload en
  server-side savevalidatie;
- moderne Player en statische LG/webOS Legacy-runtime;
- één forward-only S142-migratie met gerichte pgTAP-test;
- S142- en LED Scores Studio-documentatie.

## Canvascontract

- schema v1 bevat exact acht momenten: goal eigen team, tegendoelpunt, goal met
  onbekende teamidentiteit, thuis-/uitopstelling, start, rust en einde;
- ieder moment bevat verplicht een liggende compositie van 1920×1080 én een
  staande compositie van 1080×1920;
- een scene heeft een effen, verloop- of lokale media-achtergrond en maximaal
  zestien unieke, geordende tekst-, beeld-, vorm- of opstellingslagen;
- tekst- en beeldlagen gebruiken óf vaste inhoud/media óf één allowlisted
  databinding; hoofd- en subtekst blijven expliciete canvascopy, terwijl score,
  teams, klok en speleridentiteit alleen uit veilige live waarden komen; vrije
  HTML, CSS, scripts, remote URL's en willekeurige fonts zijn geen onderdeel van
  het contract;
- vaste beeldlagen accepteren alleen een gereed JPEG-, PNG- of WebP-tenantbeeld;
  een video is
  uitsluitend als gevalideerde, gemute achtergrond toegestaan;
- één experience verwijst naar maximaal 24 unieke media-assets;
- `none`, `fade`, `rise`, `zoom` en `wipe` zijn de enige canvasanimaties;
- een kopie naar de andere oriëntatie schaalt geometrie en tekst begrensd, maar
  overschrijft de broncompositie niet.

## UX-contract

- desktop gebruikt bibliotheek → canvas → inspector met live moment- en
  oriëntatiekeuze;
- lagen zijn selecteerbaar, sleepbaar, schaalbaar, vergrendelbaar, verbergbaar
  en ordenbaar; 8-pixelsnapping, hulplijnen, veilige zones en zoom maken
  positionering voorspelbaar;
- undo/redo bewaart maximaal vijftig geldige documentstappen;
- pijltjestoetsen verplaatsen één pixel en met Shift tien pixels; numerieke
  invoer en laagselectie blijven volwaardige toetsenbordalternatieven;
- de inspector beheert geometrie, dekking, rotatie, animatie, typografie,
  beeldfocus, vormgeving, opstellingsraster en achtergrond;
- Control toont alleen tenantgescope media via kortlevende signed previews en
  gebruikt de bestaande beveiligde image- en videouploadflows;
- mobiel is een sequentiële flow voor moment, inhoud en vormgeving, met een
  read-only preview, directe laagkiezer en bediening van minimaal 44 px; het is
  geen verkleinde desktopeditor; Control mount per viewport maar één editor en
  laadt een videoachtergrond dus niet dubbel.

## Opslag- en securitygrens

- de browser houdt het document na iedere geaccepteerde bewerking geldig, maar
  clientvalidatie is alleen ergonomie;
- de serveraction parseert schema v1 opnieuw, weigert formulieren boven 240 kB,
  leidt de exacte assetmanifestset af en bewaart via de bestaande guarded RPC;
- de database valideert exacte objectsleutels, moment-/oriëntatiecompleetheid,
  laagtypen, bindings, geometrie, unieke IDs/z-posities en de exacte assetset
  opnieuw bij opslaan én publiceren;
- draftconfig blijft begrensd op 250.000 bytes en het immutable versionsnapshot
  op 262.144 bytes;
- gereedheid, tenantownership, checksum en voor video een `player_1080p`-
  variant worden database-side afgedwongen;
- validatorhelpers staan in `private`, browserrollen krijgen geen directe
  execute-rechten en de bestaande capability-, revision-, RLS-, composite-FK-,
  audit- en idempotencygrenzen blijven leidend;
- publicatie bevriest canvasdocument, assetmanifest en doelgroepen in de
  bestaande immutable LED Scores-versieketen.

## Playercontract en fallbacks

- de server verwijdert een eventueel aangeleverde live scene en voegt alleen de
  scene uit de gepubliceerde immutable alertversie voor het actuele moment toe;
- moderne en Legacy Player parseren het paired schema opnieuw, eisen alle
  gerefereerde immutable assets en kiezen zelf liggend of staand;
- beide runtimes ondersteunen dezelfde gesaneerde tekst-, beeld-, vorm-,
  achtergrond-, opstellings- en animatiesemantiek;
- spelernaam, rugnummer en foto kunnen dezelfde actieve goaloverlay laat
  verrijken; opstellingen worden begrensd gepagineerd;
- videoachtergronden spelen muted, looped en zonder bediening;
- een ontbrekend canvasdocument, ongeldige scene of ontbrekend asset valt terug
  op de bestaande veilige vaste overlay. Ook een achtergrondafbeelding of
  -video die pas tijdens laden faalt schakelt de volledige scene terug; een
  goal behoudt daarbij zijn sponsor en geluid. Legacy gepubliceerde
  configuraties blijven zonder backfill afspeelbaar;
- een al verzonden, nog geldige immutable versie blijft bij reconnect exact
  hydrateerbaar wanneer de mutable alert daarna is gepauzeerd of het scherm
  intussen uit de doelgroep is gehaald;
- overlays blijven transient boven de bestaande last-known-good release en
  muteren playlist of release niet.

## Gates

Gerichte contractschema-, reducer-, moderne Player-, serverattachment-,
goal-/matchoverlay- en Legacy-tests; Control en Player lint/typecheck/test/build;
verse database-reset, S142-pgTAP en volledige RLS; Control a11y en Chromium E2E;
Player- en offlinegates; webOS-compatibiliteitsguard; immutable VPS-build,
staging-readback en promotie van exact dezelfde images naar productie.

## Gate-uitkomst

- contracts 58/58, Control 291/291 en Player 243/243 unit groen;
- werkruimte lint/typecheck/test 30/30, 1.054/1.054 tests en build 18/18 groen;
- verse database-reset, S142 27/27 en volledige RLS 1.583 assertions groen;
- a11y 36 groen met één bewuste live-fixtureskip;
- brede Chromiummatrix 188 groen met 21 bewuste skips; één geïsoleerde
  signed-media-opstarttimeout na de volledige matrix is aansluitend 3/3 groen
  herhaald;
- Player 116/116 en Player-offline 7/7 groen.

De immutable VPS-build en staging→productie-readback worden op de merge-SHA
uitgevoerd, zodat beide omgevingen exact dezelfde images ontvangen.
