# S261 — Menuprijzen expliciet vastleggen en kandidaten publiceren

Status: rootreview afgerond; releaseprep voor normale integratie. Werkelijk 21 units PASS, scoped lint en fixturecompile/list exit 0, native V11 2/2 PASS op 390/1440 (21,674 s, 0 skips/retries). Gecombineerde geïsoleerde V18: CLI-reset 201 migraties + seed exit 0, 187 gerichte checks PASS, 136 bestanden / 4454 checks PASS (44,459 s), CLI-errorlint exit 0 (1,295 s), alle cleanup-/Docker-/bron-/dependency-/assetguards gelijk. Gerichte/volledige pgTAP via lokaal equivalente `pg_prove`, geen volledige gewone CLI-testopdracht. QA niet beschreven; volledige rootfoundation/CI, echte publicatieacceptatie en uitrol open; 0/5 visuele rondes.
Branch `veyocast/s261-menu-price-candidates`, sparse worktree `castivo-s261`, basis `f740e96820d82d047e6d1a4c0ab05f565f99b2ed`.

De nieuwere V1-REBUILD-CANON §7 en startprompt §4 zijn leidend: een catalogusprijswijziging verandert geen vastgelegde publicatie. De bestaande Productenflow krijgt volledige prijsdiff en impact, expliciete conceptselectie, een prijsversie-opdracht en daarna een afzonderlijke publicatieopdracht. Een receipt of gereed renderresultaat bewijst geen TV-activatie. De gekozen immutable Sync, locked assets, tokens, toegankelijkheid en alle serverpermissions blijven leidend.

## Exact ownership (18 paden)

Onder `apps/control/app/(shell)/dashboard/integrations/twelve-products/`:

1. `page.tsx`
2. `sites-products-workspace.tsx`
3. `sites-products.module.css`
4. `frozen-product-prices.ts`
5. `frozen-product-prices.test.ts`
6. `menu-price-model.ts`
7. `menu-price-model.test.ts`
8. `menu-price-actions.ts`
9. `menu-price-actions.test.ts`

En:

10. `supabase/migrations/20261019141413_menu_price_candidates.sql` — daadwerkelijk met gepinde CLI gegenereerd; vervangt voorgestelde150000-naam.
11. `supabase/tests/s261_menu_price_candidates.sql`
12. `supabase/tests/s226_sync_published_binary.sql` — uitsluitend vier prijswijzigingsprikkels naar naamwijzigingen en dezelfde actuele vijf artifactrijen uit de bestaande claim. Alle overige bytes/asserties behouden.
13. `tests/control/sync-menu-price-candidates.spec.ts`
14. `docs/s261-menu-price-candidates.md`
15. dit promptbestand
16. `TASK_LEDGER.md` — uitsluitend eigen regel
17. `apps/control/app/(shell)/dashboard/slides/sync-dynamic-editor.tsx`
18. `apps/control/app/(shell)/dashboard/slides/sync-dynamic-actions.ts`

Gallery leverde de twee workspace/CSS-paden als UI-V3. Na gesloten handoff draagt root deze twee paden beperkt over: uitsluitend draft selecteerbaar voor publiceren; failed blijft zichtbaar met herstelverwijzing naar bestaande versiestatus. Overige V3-bytes/journal/paging blijven behouden.

Na de echte V10-native 1 PASS / 1 FAIL droeg root binnen dezelfde twee UI-paden aanvullend over: lokale positioneringsbasis op de catalogustabelwrapper voor het absolute kolomlabel; compacte mobiele prijsregels/dl op ≤600 px met alle product-/vastgelegde-/nieuwe waarden, behouden overrides en onbekende baselines. Desktop3kolomstabel blijft gelijk. Geen brede CSS, overflow verbergen, controller-/journal-/paging-/SQLwijziging. Dezelfde twee nativecases behouden hun andere assertions/deadlines en bewijzen nu alle 21 regels, drie waarden en echte pernode-rects/offsetParent/breedtes. V11 is werkelijk 2/2 groen; root bekeek vijf originele nativebeelden en accepteerde de presentatie. Oorspronkelijk native rood en 1440 PASS blijven afzonderlijk bewaard.

De twee Source-editorpaden zijn uitsluitend uitgebreid voor expliciete bronwissel, verse pure prijsreview/fingerprint en canonical-config readback. Geen andere families/writers wijzigen. Alle historische migrations, S262-migratie/schema/wizard/Playerpaden, Source-export, tokens/shared UI, dependency-/lock-/workflowconfig en echte QA blijven buiten scope. SQL-lease is uitsluitend deze nieuwe migration; S262 heeft zijn eigen migration gefrozen.

## Verplichte grenzen

- SQL bouwt de prijsset; een clienthash of confirmed-vlag geeft geen prijsautoriteit. Volledige setgelijkheid met een tenant/actor/key/command-type gebonden durable capture-receipt is vereist, ook bij gewone save/publish, variant en restore.
- De capture-receipt ontstaat vóór buildervalidatie binnen dezelfde transactie. Latere CAS-/target-/renderenqueuefout rolt capture, prepare en audits samen terug.
- Beide bulkopdrachten hebben een eigen oorspronkelijke nonce, expliciete maximaal25 targets vóór dedupe en bestaande CAS. Replaylookup staat vóór mutable CAS. Geen automatische publicatie of playlist-/devicewriter.
- De volledige goedgekeurde set bevat tijdelijk unavailable producten. Bekende producten verversen naam/beschikbaarheid en komen terug met hun vastgelegde prijs. Nieuwe onbeprijsde IDs vallen weg vóór de Source200-grens. Geen huidigeprijsfallback voor oudere snapshots zonder prijs.
- MenuDoc pint volledige money-leaves vóór bestaande validatie; expliciete placement/shared overrides blijven behouden op basis van echte flags. De actuele gedeelde validator weigert vier gereserveerde Source/runtimekeys vóór zijn bestaande delegate.
- De echte oorspronkelijke menuquery is `build_dynamic_snapshot_data_before_sportlink`, niet de Source-blueprintdispatch. Nieuwe guarded DO-wijzigingen eisen precies één marker; oude migrations blijven bytegelijk.
- Gewone Source-wissel blijft bedienbaar: nieuwe bronpreview → expliciete prijsbevestiging → SQL-only capture na CAS → canonical-config in dezelfde receipt. Geen same-source recapturebypass of geforceerd nieuw ontwerp.
- Prepared/render-ready/desired/confirmed blijven verschillende toestanden. Gebruiker kiest bestaande `Nieuwste Studio-versie`, slaat de playlist op en doorloopt echte publicatie/preflight/targets.

## Validatie en uitvoeringslease

Voorbereide checks: drie unitbestanden; scoped lint; twee echte workspace/editor-componentcases390/1440 met productieCSS/portal en gecontroleerde transportboundary; geïsoleerde pgTAP inclusief RLS/ACL/atomiciteit/retention/bronwissel en bestaande SQL-regressie. Browserfixture is geen echte Auth/RLS-, provider-, FFmpeg- of fysieke deviceacceptatie.

Alle actors gebruikten aparte rootqueue-GO en sloten daadwerkelijk. Geen install of huidige QA57621/57622-writes. Tijdelijke dependency-/assetsaliases waren exact-doel-geverifieerd, buiten Git en na alle eigen processen verwijderd. De gecombineerde geïsoleerde migrations/RLS-gate is gesloten; volledige gecombineerde foundation, exact-head CI en echte publicatieacceptatie blijven rootgates. Root gaf na V18 expliciet normale commit/push/draft-PR naar `veyocast/s244-integrated-sync-acceptance` vrij voor exact deze 18 paden; geen merge/deploy door de featurewriter.

Definitieve pins: migration `88d5b73f61ea1cb2e94eca01c53d37ded4085942e800d3d0b76676a00b5c4596`, nieuwe pgTAP `1060e05cd0a631c40bba5387518d06714eb5a1b771eaf7602d2d028ca57aaa3c`, S226-fixture `82601ab4d4c3a5b9e303d2ade6ef8ea6493658c869f868747d03fbbb18c8a80d`. V11-nativeclosure `dc90bf73c5da23891c479f8a50f10ba672bd4849e3167b7868b3ee61ba2d4fab`; V18-DBclosure `1bb27a0bcbabc8867bd34467642dc29e4ba105ac0540fe54ace465720413434b`. Volledige proofpaden en de onveranderde rode V12–V17-geschiedenis staan in `docs/s261-menu-price-candidates.md`; exact18 releasefreeze onder `/dev/shm/veyocast-s261-release-final-20261019T172707Z-fdc8d08d-87ae-4c90-84bc-7a7f9b1cc5ce/`. Alle product-, test- en controllerbytes blijven na deze review bevroren; alleen deze prompt, eigen doc en eigen ledgerregel worden gefinaliseerd.
