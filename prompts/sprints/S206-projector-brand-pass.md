# S206 — één canonieke brandberekening per Sportlink-projectie

## Probleem en doel

De huidige typed Sportlink-projector voert de volledige oude contentprojector uit voor alleen `brand`. De onmiddellijk volgende S122-wrapper overschrijft die waarde met een tweede uitvoering van dezelfde oude projector, voor canonieke `brand` en `themePresentation`. Verwijder uitsluitend de eerste overbodige uitvoering. Dit is een aantoonbare vermindering van werk; historische storingscausaliteit en websiteherstel worden niet verondersteld.

## Ownership

Implementatieagent: alleen `supabase/migrations/20261013010000_s206_projector_brand_pass.sql` en `supabase/tests/s206_projector_brand_pass.sql` in deze worktree.
Root: dit sprintprompt, `docs/deployment/s206-projector-brand-pass.md`, `TASK_LEDGER.md`, afzonderlijke geïsoleerde lokale databaseconfiguratie en review/remoteacties.
Geen andere migratie, bestaande test, app, dependency, lockfile, generated types, role/grant, workflow of Playerwijziging. Geen commit, push, merge of productieaanroep door de implementatieagent.

## Implementatie

- Nieuwe forwardmigratie, expliciete transactie en bestaande veilige lock-/statementgrenzen. Reproduceer de concrete laatste S178-definitie van `private.build_dynamic_snapshot_data_before_s122_theme_restore(public.dynamic_slides)`; wijzig uitsluitend de laatste dubbele brandberekening naar hetzelfde brandobject met `{}`. Geen dynamische tekstpatch van productiefunctiondefinitions.
- Behoud STABLE, SECURITY DEFINER, lege search_path, bestaande ACL, null-blueprintfallback, vroege typed returns, context/filter/order/resultaat en alle overige bytes/semantiek. Laat de canonieke tweede volledige preS119-brand/themeberekening in `private.build_dynamic_snapshot_data_before_s128_birthdays` ongewijzigd.
- Bewijs dat de eerste alias binnen het normale applicatiecontract uitsluitend door die wrapper wordt aangeroepen. Buitenliggende beheerder-/manuele calls vallen buiten deze interne optimalisatie; geen publieke bypass toevoegen.
- In rollback-fixtures worden oorspronkelijke exacte functiebody's naar pg_temp gekopieerd en gekoppeld. Vergelijk oude en nieuwe wrapper-output als payload::text binnen dezelfde SQL-statement, zodat statement_timestamp/now identiek zijn. Geen snapshots, authoringversies of immutable releases herschrijven.
- Betekenisvolle fixtures: resolved/onopgeloste standen, programma/uitslagen/aankomst, null blueprint, verjaardagen/lege data, canonieke thema's/modus/tijdzone, club- en teamlogo-prioriteit, tenant/sourceisolatie, maxItems en ongeldige themafouten. Instrumenteer indien betrouwbaar de oorspronkelijke 2 versus nieuwe 1 oude-projectoruitvoering, zonder passdrempel op toevallige milliseconden. Benchmark is aanvullende lokale waarneming, geen productieoorzaak.

## Validatie en uitvoering

Root maakt een afzonderlijk Supabase-project voor db:reset en de volledige RLS-suite; reset of wijzig nooit bestaande lokale projects, waaronder supabase_db_veyocast-s190. Agent mag de gerichte fixture alleen in die door root bevestigde geïsoleerde database uitvoeren. Voorbereiding/review mag zonder databasecalls.

Workspace lint/typecheck/test, db:reset/test:rls en relevante bestaande CI-gates blijven verplicht. Alle eerdere migratiebytes blijven exact dezelfde. Root rolt de reeds geteste workerstopfix afzonderlijk uit wanneer zijn oorspronkelijke gates gesloten zijn; deze nieuwe branch mag een lopende deploy niet via een mainwijziging ongeldig maken. Definitieve oorspronkelijke liveacceptatie volgt op de uiteindelijke geverifieerde release.
