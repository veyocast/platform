# S290 — OnzeTrots-menu’s, Marker-headers en actuele Studio-keuze

Gebruiker vraagt de nieuwste OnzeTrots-layout in Twelve/Menu Studio, het
bestaande handgeschreven headerfont uit bijlage 2 op alle OnzeTrots-families,
en een werkende expliciete keuze van de nieuwste Studio-versie na prijswijziging.
Commit, push, normale merge en staging/productie met dezelfde images zijn
geautoriseerd. Baseline: `96ccc5d345d2bd6a3d921806b8c39940d32938b7`.
Root is enige writer, branch `veyocast/s290-studio-templates-refresh`, worktree
`/home/codex/repos/castivo-s290`.

## Ownership

- Bestaande Sites-/Sync-presentatiecontracten, additieve opgeslagen
  stijl-/fontkeuze, schrijversdefaults en hun gegenereerde JSON-schema's.
- Gedeelde OnzeTrots-canvas/header en menu-widgets/projectie/stijlen onder
  `packages/content-templates/`, bijbehorende export- en Player-consumers
  voor dezelfde native DOM en geverifieerde assets.
- Menu Studio wizard/documenthelpers/serveracties, Sync-editor/wizard/
  templatevoorbeelden en native authoringconsumers voor dezelfde nieuwe keuze.
- Publisher-library serverloader/API voor één gekozen eigen bron;
  playlisteditor/vernieuwingshelper/model/commandplan en gerelateerde tests.
  De expliciete voorbereiding van een bestaand opgeslagen menu via dezelfde
  Publisher-API gebruikt de bestaande guarded Menu Studio-commando’s, behoudt
  prijzen en schrijft nooit een playlistpublicatie.
- Eén nieuwe forwardmigratie voor additieve validatie, eigen SQL/RLS-tests;
  gerichte contract-, UI/a11y-, Worker-, Player/offline- en matrixregressies.
- Dit prompt, eigen bewijsdocument `docs/s290-studio-templates-refresh.md`,
  eigen PLANS-aanvulling en TASK_LEDGER-rij.

## Grenzen en bewijs

Gebruik het bestaande byte-ongewijzigde Permanent Marker-font, geen nieuw
getekend merkasset. Historische ongetagde snapshots behouden hun renderer;
nieuwe/bewust bewerkte ontwerpen slaan de nieuwe keuze op. Behoud v9-layout,
contextregel +30%, beide oriëntaties, lichte/donkere modus, alle widgets,
kolommen, subproducten, prijs-centen, achtergrondkeuze en pagina’s.

Vernieuwen leest opnieuw de exacte bron binnen actieve tenant/capabilities,
zonder paginalimiet of oude browserprops. Meld dezelfde versie, verwerking,
onvoorbereid concept en fout expliciet. Nieuwe gegevens verschijnen eerst in
het playlistconcept; bestaande publicaties/brondata blijven immutable.
Geen automatische catalogusprijsacceptatie, lege productiecontent, datareset,
dependency-/lockfile-/workflowwijziging of vereenvoudiging van offline/LKG.

Reproduceer oude layout en verouderde/no-op verversing. Bewijs opgeslagen
prijswijziging → volledige nieuwe output → expliciete selectie → batchplan,
plus permissions/foreign ID, fouten/herstel en behoud van plaatsingsvoorkeuren.
Verifieer alle 36 OnzeTrots-families in licht/donker en liggend/staand,
native export/Playerpariteit en historische compatibiliteit. Foundation,
database/RLS, UI/a11y/Chromium, Player/offline en normale CI moeten groen zijn
vóór merge. Controleer staging en productie op exacte SHA en echte assets.
