# S191 — Exacte Sites v11-overname

Voer de volledige bijgeleverde Sites-overdracht uit op de bestaande echte
platformruntime, inclusief commit, push en beschermde staging/production-uitrol.
Lees `docs/sites-v11-overname/README.md`, de bewaarde overdracht onder `handoff/`
en alle matrixrecords. Behoud alle S189/S190-integratiecorrecties.

De volledige gemapte Control-, Marketing-, Player-, worker-, Studio-, native-
beheer-, contracts-, media-, UI- en databaseoppervlakken vallen binnen de
opdracht. Root beheert centrale indices, dependencies/lockfile, matrices,
canon/ledger, assets, batchcommands en contentzonecontracten/migraties.
Root beheert tevens `infra/vps/compose.yaml` en de bestaande Compose/VPS-
validators voor de noodzakelijke serverconfiguratie van de echte Marketing-
calculatorflow. Deze uitbreiding is vóór wijziging expliciet gerapporteerd;
de al geautoriseerde SHA-image-uitrol blijft het enige deploymentpad.
Root beheert de beperkte `.gitattributes`-uitzondering voor de immutable Source-
en handoffbestanden, zodat Git de oorspronkelijke bytechecksums niet door
regelafbrekingsnormalisatie verandert. Deze uitbreiding is vóór wijziging
expliciet gerapporteerd.
De CI-herstelronde omvat tevens de bestaande Android-workflows en hun centrale
validator, plus `packages/testkit/**` en `turbo.json` voor correcte, niet-gecachete
controles van runtime- en type-importgrenzen. Beide uitbreidingen zijn vóór
wijziging expliciet gerapporteerd.
De verse browsergates omvatten ook de feitelijke mobiele navigatiecontrastregel
en de semantiek van canvas-body landmarks, plus bestaande netwerk-/status-
regressietests. De rendergate onderzoekt Source- en worker-rasterstabilisatie
met behoud van nul pixeltolerantie. Sourcebestanden blijven byte-ongewijzigd.
Subagents krijgen expliciete, onderling exclusieve bestandsverdelingen.
Migrations zijn uitsluitend forward-only in nieuwe S191-bestanden.
Serviceworkers en gegenereerde types hebben één aangewezen eigenaar.
De bevroren externe referentie wijzigt nooit.

Uitvoering: bronintegriteit en basis vastleggen; exacte shell/primitives/CSS;
mobiele playlistflow en atomaire batchcommands; versioned Sites-documenten,
thema's, alle templates, trusted capture en beide Players; bronwizards,
schermen/contentzones/planning/telemetry/native; alle matrixcases en routes;
toetsbare commits op één branch/PR en bestaande SHA-image-uitrolketen.

Gates: workspace lint/typecheck/unit/build; geïsoleerde lokale DB-reset/RLS;
a11y/Chromium/Player/offline; relevante worker/native/workflow/deploychecks;
ref/new/diff met gelijke fixtures en geladen fonts; echte opslag/reload/conflict/
publicatie; live data zonder nieuwe configuratieversies. Hardwarebewijs blijft
afzonderlijk.
