# S215 — Menuwidgets en betrouwbaar Studio-aanmaken

Herstel de door de gebruiker gemelde Menu Studio-vormgeving en Studio-creatie.
De bestaande Sites-bronassets, tokens en wizardtaal zijn leidend. De gebruiker
vraagt expliciet om categorie-, menu-, deal- en afbeeldingswidgets, productkolommen,
gekoppelde/vrije subregels en meerdere pagina's. Iedere keuze moet zichtbaar
renderen, opslaan en bij heropenen behouden blijven.

Ownership: Control Studio-creatie en Menu Studio (incl. opties en tests),
contracts/menu-studio en sites-presentation, gedeelde Menu/Sites-projectie en
renderers, bijbehorende worker/Player-assetprojectie indien nodig, één forward
migration plus database-regressies, sprint-/bewijsdocs, PLANS en TASK_LEDGER.
Geen dependency-, lockfile-, workflow-, providerfetch- of offlinewijziging.

De brondata blijven databasegebonden. Auth/RLS, revisionguards, idempotency,
immutable publicaties, geverifieerde assets en LKG blijven verplicht. Controleer
echte create/save/replay/heropen/publicatiepaden en zowel portrait als landscape.
Voer foundation-, DB/RLS-, a11y-, browser- en Player/offlinegates uit. Commit,
push, merge en staging/production-uitrol vallen onder de bestaande toestemming.
