# S292 — Bronherstel en onafhankelijke DOM-gereedheid

Uitvoering van de opdracht van 25 oktober 2026. Baseline: actuele remote main
`4cb895c363c69bf754184902e804fda2792ac85c`. Eigen branch
`veyocast/s292-dom-ready-recovery`, worktree `/home/codex/repos/castivo-s292`.
Root is de enige writer.

Ownership: bestaande Sync-/Sites-authoring en projectors, RSS-parser/worker,
versiegebonden contracts en Player/publicatie/cache/readiness, noodzakelijke
forwardmigraties, eigen regressies, meetbewijs, canons en taskledger. Locked
assets, dependencies, lockfile en andere worktrees blijven buiten mutaties.

De volledige gebruikersopdracht verlangt bronherstel én een nieuw onafhankelijk
DOM-ready-contract met legacy-ondersteuning, groene gates en normale
staging-/productionpromotie. Die promotie is geautoriseerd; verplichte externe
GitHub-environmentreviews blijven gelden. Een gedeeltelijk bronherstel mag niet
als afgeronde DOM-migratie of volledige opdracht worden gemeld.

Zie `docs/s292-dom-ready-recovery.md` voor live bewijs, routekaart en de actuele
grens tussen geïmplementeerde correcties en nog open acceptatie.
