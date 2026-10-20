# S267 — Browsertests wachten op echte bedienbaarheid

Doel: sluit de geobserveerde CI-race waarin de nulhoogtetest al na vijf seconden
stopt terwijl de volledige goedgekeurde assetset nog wordt geladen.

Ownership: `tests/player/lg-sites-composition.spec.ts`,
`tests/a11y/control-shell.spec.ts`,
`prompts/sprints/S267-lg-frame-ready-checkpoint.md`,
`docs/s267-lg-frame-ready-checkpoint.md`, eigen S267-regel in `TASK_LEDGER.md`.
Geen Player-, renderer-, asset-, dependency-, lockfile-, database- of workflowwijziging.
Tijdelijke genegeerde dependencyaliases en begrensde private bewijshelpers worden
apart bewaakt en na afloop gesloten. S244 blijft tijdens de wijziging bevroren.

Eerst wachten op precies één echte `.lg-sites-canvas`, met een eindige 60sgrens
voor de voorafgaande assetverificatie. Daarna blijven de oorspronkelijke
5sdiagnostiekgrens, nul zichtbare canvassen, ontbrekende first-frameack,
15100ms-klokstap en geverifieerde blobfallback exact behouden.
Geen sleeps, retries, producttijdslimieten, vervangende foutuitkomsten of skips.

Bewijs: behoud originele CI-log/trace; reproduceer dezelfde race met verklaarde
trage assetlevering op de originele ES5-route, baseline rood/kandidaat groen.
Controleer ook de normale variant, lint/typecheck en bron-equivalentie.
De oorspronkelijke volledige foundation-gates op 8e03 blijven afzonderlijk zichtbaar;
nieuwe gewone CI moet ook groen zijn. Geen visuele 5/5- of uitrolclaim in deze taak.

Uitgebreide scope na de echte Control-CI-fout: de bestaande contextknop is
tijdens SSR expliciet disabled. De keyboardtest wacht nu eerst op toBeEnabled,
vóór dezelfde focus/Enter/menu/link/URL-asserties. Deze vooraf gemelde testwijziging
verandert geen ControlShell of ander productbestand.
