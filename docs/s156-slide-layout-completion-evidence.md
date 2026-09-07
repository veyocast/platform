# S156 — Wedstrijdslides en clubvarianten

## Resultaat

Clubprogramma en clubuitslagen gebruiken in de gedeelde Editorial
Arena-renderer en de statische LG Legacy-renderer dezelfde vaste tweeregelige
wedstrijdkaart. Regel één toont datum, tijd en sportpark of veld. Regel twee
toont optioneel het logo en de volledige thuisclub/team- en uitclub/teamnaam;
alleen bij uitslagen staat de score uiterst rechts. Logo, thuis-/uitlabels en
veld blijven via de bestaande slide-instellingen aan- of uitzetbaar.

De rijhoogte is niet langer afhankelijk van het aantal wedstrijden. Landschap
gebruikt 115 px per rij; portrait gebruikt 221 px voor programma en 314 px voor
uitslagen. Daardoor blijft één uitslag compact. Een beheerder kan in landschap
één of twee kolommen kiezen. Wizard, editor en beide Player-runtimes
normaliseren portrait altijd naar één kolom.

De bezoekersteamslide toont nu ook de volledige naam van het thuisteam. Datum
en aanvang zijn exact verdubbeld en kleedkamers, veld en scheidsrechter staan
onderaan in één uitgelijnde label-/waardestructuur. Ontbrekende
scheidsrechterinformatie wordt eerlijk als `volgt` weergegeven. De portrait
splitnieuwsslide gebruikt 32 px ruimte tussen de twee panelen en 20 px extra
ruimte aan beide zijkanten.

In de Sportlink-wizard zijn thuis, uit en beide een meerkeuze voor clubbrede
programma- en uitslagenslides. Iedere richting levert een afzonderlijk
benoemde slide op. Programma vandaag en uitslagen vandaag kunnen daardoor in
één actie atomair alle zes varianten maken.

## QR-grens

De QR van de liggende fullscreen-gradient-nieuwsslide is niet verder naar de
buitenhoek verplaatst. De bestaande rechterafstand is op 1920 × 1080 exact
144 px, oftewel de uiterste 7,5%-action-/QR-safe-area uit de designcanon. Het
logo rechtsboven staat in een niet-interactieve canvaszone en is daarom geen
geldige uitlijningsgrens voor een scanbare QR. De minimale QR-maat en quiet zone
blijven behouden.

## Data-, security- en releasegrens

De forward-only migratie verrijkt bezoekersitems tenant- en
Sportlink-brongebonden met thuisteam en officials. Clubwedstrijditems krijgen
langs dezelfde exacte bron- en tenantgrens volledige teamnamen,
accommodatienaam en optioneel veld. De publieke v4-commandosignature blijft
compatibel.

Wanneer één aanvraag meerdere richtingen van hetzelfde clubblueprint bevat,
maakt de database deterministische subbatches binnen één transactie. Een exact
dubbele blueprint/richting-combinatie faalt vóór iedere blijvende slide;
herhalen met dezelfde idempotency key geeft hetzelfde hoofdresultaat terug.
Capability-, tenantstatus- en actieve Sportlink-broncontroles blijven
server-side staan. De gearchiveerde implementatie is naar het private schema
verplaatst en alle ongewenste execute-rechten zijn ingetrokken.

Voor bestaande relevante `latest`-slides queue't de migratie uitsluitend een
nieuwe snapshot van de exact gepubliceerde versie. De bestaande gecontroleerde
S146-keten activeert alleen volledige immutable opvolgreleases. Historische
snapshots, pinned versies, releases en Player last-known-good worden niet
gewijzigd.

## Verificatie

- `pnpm db:reset`: groen.
- Gerichte S154/S155/S156-pgTAP-regressie: 92/92 groen.
- Volledige `pnpm test:rls`: 75 bestanden en 1.899 assertions groen.
- `supabase db lint --local --level error`: groen, zonder bevindingen.
- Workspace `pnpm lint`, `pnpm typecheck` en `pnpm test`: elk 30/30 taken
  groen. Daarbinnen zijn onder meer Control 374, Player 248,
  content-templates 67, domain 68 en contracts 80 tests groen.
- Workspace `pnpm build`: 18/18 taken groen, inclusief de clientsecret- en
  webOS-compatibiliteitsguards. Een eerste poging stopte door een volle lokale
  testcache; na het verwijderen van uitsluitend gegenereerde build-/testcache
  slaagde dezelfde schone build volledig.
- De a11y-run verloor onder langdurige runnerdruk de Control-devserver. De
  disjuncte herhaalruns bewezen daarna alle routes: 21/21 Control en 15/15
  overige checks groen, plus één bewuste live-skip.
- De brede Chromium-run gaf 198 groen en 23 bewuste live-/evidenceskips; één
  eerste visualmatrix-test verloor het browserproces. De volledige betrokken
  visualmatrix slaagde daarna vers 3/3, inclusief alle 64 FieldFlow-cellen,
  twee kolommen en portrait splitafstand. Daarmee zijn 199 unieke uitvoerbare
  scenario's groen.
- Formele `pnpm test:player`: 124/124 groen, inclusief moderne en Static LG-
  pariteit, alle visuele matrices en het nieuwe vaste één-resultaatgedrag.
- Formele `pnpm test:player:offline`: 7/7 groen; last-known-good, atomaire
  cachewissel, corrupte pending assets en service-worker ranges blijven intact.
- Een onafhankelijke slotreview vond geen blocker of hoog regressierisico in
  de renderer-, authoring-, database- of immutable-releasegrenzen.
- `git diff --check`, ownershipcontrole en changed-file credentialscan: groen.

Het aanvullende PR-, CI- en exact-SHA staging-/productiebewijs blijft bewaard
in het GitHub-runrecord en wordt bij de oplevering vermeld.
