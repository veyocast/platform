# S252 — kleur en schaal van lokale Studio-voorbeelden

Root heeft de twee daadwerkelijk bekeken bevindingen uit gesloten actual-QA-run2 aanvaard: beide thema-kaarten zijn grijs; in de behouden LED-overlay-editor overlappen hoofdtekst en score bij1440px. Basis is exact `bf458beeeab68f066d7ce5eaf6aa7101a93205b8`, branch `veyocast/s252-sync-preview-fidelity`, sparse worktree `/home/codex/repos/castivo-s252`. De identieke reeds gelezen governance/canons blijven leidend; hun hashes zijn bij de sparse-baseline vastgelegd. Het gekozen Sync-prototype gaat boven de historische oranje-Controlregel; locked assets/security/immutable/offlinegrenzen blijven gelden.

Exclusieve ownership:

- `apps/control/app/(shell)/dashboard/studio/sync-studio-frame.tsx`
- `apps/control/app/(shell)/dashboard/studio/led-scores/alert-editor.tsx`
- `apps/control/app/(shell)/dashboard/studio/led-scores/led-scores-studio.module.css`
- `tests/control/sync-background-picker.spec.ts`
- `tests/control/sync-led-secondary-tasks.spec.ts`
- `docs/s252-sync-preview-fidelity.md`
- dit sprintprompt
- uitsluitend de eigen S252-regel in `TASK_LEDGER.md`

De thema-swatch gebruikt de bestaande goedgekeurde accentwaarde volgens immutable Source `Content.tsx`: `backgroundColor:theme.accent`. Geen kleur hardcoden of document-/themastate herschrijven. De LED-correctie blijft uitsluitend binnen de lokale `ExperiencePreview`-container, layout en typografie relatief aan de echte previewbreedte. Volledige normale hoofdtekst, score en scorer blijven zichtbaar, niet overlappend, op390/1440 en liggend/staand. Langere normale hoofdtekst krijgt zichtbare passende typografie; geen clipping/ellipsis of inhoudswijziging.

Geen canonrenderer, Worker, Player, export, commands, handlers, writers, tokens, Source, dependencies, config, database of assets wijzigen. Onderzoek de lokale schaaloorzaak; een screenshot van deze behouden extra editor is geen bewijs van een canonieke rendererfout. Alle bestaande assertions/deadlines/guards blijven behouden.

Testfirst: bewaar de oorspronkelijke productblobs, native beelden en alle eerste rode resultaten. Nieuwe betekenisvolle checks gebruiken de bestaande echte component-/routefixtures: beide swatches volgen aangeleverde accentkleur; volledige previewtekst en score/scorer blijven binnen de preview en raken elkaar niet; serverdata/commands blijven gelijk. De fixtures bewijzen geen echte Auth/RLS/opslag/Worker-/Playeracceptatie. Geen blinde baselinewijziging, skip of tolerantieverruiming.

Initiële uitvoeringsgrens: lichte bron-/testvoorbereiding en reviewbare kandidaatpatch. Browser en fixturecompile zijn daarna uitsluitend na afzonderlijke rootqueue-GO uitgevoerd; iedere fase bewaart origineelrood en exact dezelfde checks. Geen productiebuild binnen deze taak. Geen commit/push vóór rootreview en afzonderlijke releaseprep. Sparse-checkout≤20MiB, geen install, vóór iedere checkout/mutatie≥100MiB schijfreserve; tijdelijke bewijs-/cachebestanden in eigen SHM. Bestaande dependencies/assets mogen alleen via vooraf geverifieerde tijdelijke links worden gebruikt, zonder bron-, byte- of lockfilemutatie.

Root behoudt integratie, nieuwe productiebuild en uiteindelijke capturecohort/reviewronden. Deze gerichte taak en de eerdere losse triage tellen niet als één van de vijf volledige reviewronden.

Rootreview heeft de huidige eigen clubkleur goedgekeurd; geen claim op exacte standaardpixelkleur uit de Source-demodata. De lange normale testcase gebruikt precies80 tekens, conform bestaande input- en serverlimiet. De nieuwe lokale container/gridregels gelden uitsluitend voor een goalpreview; algemene rootregels voor opstelling/wedstrijdmomenten blijven exact. Bewijsgrens: no-scorer en andere momenttypen zijn niet afzonderlijk geometrisch gemeten. Voorgesteld browsercohort na aparte GO: eerst uitsluitend4 nieuwe regressies op de oorspronkelijke3 productfiles, daarna volledige beide bestaande specs (8 achtergrondpicker +6 LED =14 cases),1 worker/0 retry. Oude6 achtergrondpicker- en4 LED-cases blijven behouden.

Uitgevoerd na expliciete rootqueue-GO: oorspronkelijke4 regressies0 PASS/4 FAIL; eerste volledige kandidaat12 PASS/2 FAIL. Lokale goal-titel/score-line-height1.4 gaf14/14 geometrisch PASS, maar rootreview vond een grotendeels lege portraitstage. Dezelfde2 LED-cases kregen een aanvullende native stagehoogtecheck (max1 CSS-pixel subpixelafronding); op die kandidaat0 PASS/2 FAIL. Exact `margin-top:0` en `align-self:stretch` corrigeerden de lokale goalstage. Finale volledige14/14 PASS in87,215s,0skip/retry; echte exit0/browserclosed, alle16 tijdelijke links verwijderd. Root heeft alle4 lange native beelden bekeken en de lokale editorcorrectie geaccepteerd; geen algemene Source-/rendererpariteitsclaim.

Scoped ESLint vier TS/TSX-bestanden exit0; strict productdiagnostics0 en geen nieuwe testdiagnostics vergeleken met immutable basis. Vier bestaande TS2345-meldingen in de onveranderde LED-case blijven expliciet baseline; geen volledige typecheck-PASS. De12 dependencylinks voor statics zijn daarna exact verwijderd.74 assetbytes/modes en Source/tokens/lock/config gelijk. Alle primaire eerste roods/closures/native beelden/logs blijven beschermd. Eén metadatafile `run-infrastructure-final-before.json` werd bij relinken overschreven; oude SHA/timestamp/vóór-schijfmeting onbekend, nieuwe SHA `2f5b10f67cdcf883087323961897b0be3081930c5b43182d046415eb609ef646`. Exacte disclosure en finale fasepaden onder `/dev/shm/veyocast-s252-sync-preview-fidelity`; geen claim dat alle oude metadata bytegelijk is.

Rechtstreekse bestaande gepinde NodeCLI en NODE_PATH, geen pnpm exec/install/nieuwe server. Geen commit/PR vóór rootresultaatreview; geïntegreerde volledige foundation/build/captures blijven rootowned.
