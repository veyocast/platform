# S272 — Uitvoeracties in het Studio-paneel

De diepe audit vond in echt gebouwd bewijs A:0517/A:0519 bij 1440px een 319px breed instellingenveld met 533px scrollWidth. De native sampler schoof dit veld 214px zijwaarts: geen gewenste tabel- of filmstripscroll. De bestaande uitvoersectie gebruikt ten onrechte de horizontale iconenbinding voor titel, uitleg en twee actieknoppen.

Root is enige writer op veyocast/s272-studio-output-layout in /home/codex/repos/castivo-s272. Exclusieve scope: apps/control/app/(shell)/dashboard/studio/sync-studio-frame.module.css, tests/control/sync-retained-studio-surfaces.spec.ts (alle bestaande tests en fixturehelpers behouden; twee echte tab-overflowregressies toevoegen), docs/s272-studio-output-layout.md, dit prompt en eigen TASK_LEDGER.md-regel. Alleen de directe section.vc-source-binding in het properties-paneel verticaal zetten; andere iconenbindingen, filmstrip, canvas, renderer, callbacks, commandtransport, labels, prijzen, tokens en Source blijven bytegelijk.

Bewaar baseline-rood. Controleer dezelfde echte SyncStudioEditor/CSS bij 390 en 1440, vier tabs, geen horizontale paneeloverflow, bereikbare uitvoeracties en behouden teksten/geen writes. Voer scoped lint en bestaande relevante native cases uit; normale exacte-head CI voor integratie. Geen volledige Sourcepixel-, liveAuth/RLS-, provider-, hardware- of vijf-rondenclaim.
