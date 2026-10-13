# S206 — overbodige Sportlink-brandprojectie verwijderen

De typed S178-projector voerde de volledige oudere contentprojector uit om alleen `brand` te lezen. Zijn enige canonieke caller, de S122-wrapper die inmiddels `build_dynamic_snapshot_data_before_s128_birthdays` heet, overschrijft die brand onmiddellijk met een tweede uitvoering voor brand en themePresentation. De nieuwe forwardmigratie vervangt uitsluitend de eerste overbodige expressie door hetzelfde brandobject met `{}`. De canonieke wrapper blijft ongewijzigd.

De concrete functiedefinitie is bytegelijk aan S178 behalve die ene expressie. Null-blueprintdelegatie, vroege returns, context, filters, volgorde, ACL, STABLE/SECURITY DEFINER en lege search_path blijven behouden. De migratie behoudt eventueel strengere sessielimieten en begrenst eigen DDL op lock1s/statement30s. Er worden geen brongegevens, snapshots, authoringversies, publicaties of immutable releases herschreven.

De normale applicatie roept de interne eerste alias uitsluitend via de S122-wrapper aan. Directe handmatige beheerdercalls naar deze private implementatiedetail kunnen de tussenliggende lege brand zien; anon, authenticated en service_role hebben geen EXECUTE. Er wordt geen nieuwe publieke route of bypass toegevoegd.

## Validatie

Een afzonderlijk lokaal Supabase-project `veyocast-s206` gebruikt poorten55460–55466. Bestaande lokale databases, waaronder S190, zijn niet gereset. De eerste gerichte PostgreSQL-fixture slaagt met68 echte pgTAP-asserties zonder skips. Zij vergelijkt de exacte oude S178/S122-functiebodies en nieuwe wrapperresultaten als payload::text binnen dezelfde SQL-statement, zodat now/statement_timestamp identiek blijven. Niet-lege programma-, standen-, uitslagen- en aankomstgegevens, tenant/sourcegrenzen, logo-prioriteiten, thema/tijdzone/fouten, null-blueprints en downstream verjaardagen zijn opgenomen. Native instrumentatie bevestigt2→1 legacycalls bij de typed case en1→1 bij null-blueprintdelegatie. Afzonderlijke readback bevestigt volledige fixture-rollback en onveranderde canonieke wrapper.

Root verifieert zelfstandig de exacte ene-expressiediff. Onafhankelijke read-only review geeft ACK op migratiehash14d167088ddc76cd3b0071190ac326d10ea143e24c48d41251d4d59dbca94c78 en testhash53e162796305cf362de09b788d2e49d5ab3addbef582f8e27cda08104a65d27d. Een verse db:reset met alle160 migraties en de volledige RLS-suite slagen:103 exacte SQL-bestanden,2954 assertions, Result:PASS. De suite omvat de oorspronkelijke2886 assertions en68 nieuwe; individuele bestaande assertion-skips worden door deze nonverbose harness niet apart gerapporteerd. Alle source-/mirrorbytes en de volledige fixture-afwezigheid zijn afzonderlijk gecontroleerd. Workspace lint/typecheck/test slagen elk30/30 met30/30/29 cachehergebruik; de gewijzigde testkitcontrole wordt opnieuw uitgevoerd. Exacte CI/uitrol en oorspronkelijke liveacceptatie blijven open.

## Uitrol en terugweg

Alle oudere migratiebytes blijven hetzelfde. Een eventuele terugweg is een volgende forwardmigratie die uitsluitend de oorspronkelijke concrete S178-body en dezelfde ACL terugzet. Geen migration-historyrepair of wijziging van al toegepaste migraties. De bestaande S198-indexgate blijft onafhankelijk gelden.

Dit bewijst minder projectiewerk met dezelfde gegevens. Het bewijst geen gemeten productiesnelheidswinst, historische storingsoorzaak, websiteherstel of oorspronkelijke liveacceptatie. De definitieve release moet nog gecontroleerd naar staging/production, waarna opruimbewijs en twee werkelijk due gewone ververscycli volgen.
