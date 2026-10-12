# S200: begrensd herstel van de Data API-schemacache

De productieprobe38305524954 op main718 en runtime18e observeerde op
12 oktober2026 om20:39:29UTC een actieve bekende tenant via directe SQL
(SQL_READY,10.688s), maar de vaste Data API-read faalde met HTTP503 (2.733s).
Een afzonderlijke publieke anon/RLS-read van uitsluitend dezelfde tenant
bevestigde HTTP503/PGRST002 om20:41:39UTC en opnieuw om21:01:27UTC.
Dit is bewijs van een falende Data API-schemacache, geen bewijs van de
specifieke onderliggende databaseoorzaak of een ingelogde browserflow.

De publieke Control- en Player-healthroutes antwoordden tegelijk200 op de
oude runtime18e. Hun bestaande revision/environment/statuscontrole bewijst
geen bruikbare database-API. Beschermde sessie- en bronqueries zijn daarvan
afhankelijk. De door de gebruiker gemelde onbeschikbaarheid wordt daarom niet
als hersteld beschouwd op basis van deze healthroutes.

De eerdere productie-uitrol38304265769 faalde afzonderlijk: de nieuwe
heartbeatindex werd aangekondigd om20:30:47UTC en statement2 eindigde om
20:31:21UTC met SQLSTATE57014/statement_timeout. De deployhelper bevestigde
om20:31:31UTC dat de vorige applicatierelease weer gezond geactiveerd was.
De volledige productiepromotion bleef FAILURE; pairing/LG-acceptatie werd
niet uitgevoerd. S200 verandert deze bestaande migratie of haar budget niet.

## Herstelcontract

De nieuwe workflow `Recover Data API schema cache` draait uitsluitend vanaf
de exacte vertrouwde main-SHA, in de beschermde productieomgeving en onder
de bestaande deployconcurrency. Er is geen invoer voor SQL, tenant, project,
schema, rol, grant of timeout. De enige acties zijn `diagnose` en `reload`;
de actuele volledige runtime-SHA is verplicht.

De bestaande runtimeprobe controleert eerst die exacte Control/Player-SHA,
de productieprojectscope, directe SQL en de bekende actieve tenant. Een al
werkende Data API levert succes zonder notificatie. Diagnose levert bij een
storing alleen bewijs. Reload is uitsluitend bereikbaar bij SQL_READY,
tenantActive=true en exact REST503/PGRST002. Andere foutcodes blijven rood.

Daarna voert de bestaande owned SQL-processadapter eenmaal de vaste,
tenantgebonden `pg_notify('pgrst', 'reload schema')` uit. Deze notificatie
is de [gedocumenteerde PostgREST-herlaadactie](https://docs.postgrest.org/en/stable/references/schema_cache.html).
De uitvoering heeft een extra maximum van20s en deelt de bestaande owned
annulering. Alleen precies één gevalideerde integernotificatie wordt als
verstuurd geregistreerd; ontbrekende, dubbele, grote of ongeldige output
blijft UNPROVEN.

Een afzonderlijke nieuwe volledige runtimeprobe moet daarna zowel SQL als
de vaste Data API-read laten slagen. Alleen dat geeft DATABASE_API_READ_READY
en exit0. Een verstuurde notificatie met een falende read blijft
SCHEMA_RELOAD_REQUESTED_API_UNPROVEN/exit1. Dit is uitsluitend bewijs van
de vaste database-API-read, geen volledige UI-, provider- of taakacceptatie.

De bestaande connect-, process-, REST- en healthbudgets blijven behouden;
de CLI begrenst de hele operatie tot180s en de workflow tot vijf minuten.
Voor setup wordt het vaste oude rapport verwijderd. Alleen een nieuwe0600
artifact met gecontroleerde codes, tijden en before/action/after-observaties
wordt bewaard. Raw databasefouten, credentials, providerrecords en SQL komen
niet in het rapport. De probeallowlist behoudt nu de vier vaste PGRST000–003
codes, zonder hun vrije message/detailsvelden.

Er worden geen tabellen, rijen, rollen, RLS-policies, configuratietimeouts,
migratiehistorie, publicaties, slides of versies gewijzigd. De workflow
herstart geen applicatie of database. Immutable releases en offline-data
blijven beschermd.

## Validatie en resterend bewijs

Alle43 gerichte Node-regressies slagen zonder skips: de33 bestaande/uitgebreide
probechecks en10 herstelchecks bewijzen scopes, fail-closed beslissingen,
strikte notificatievalidatie, onafhankelijke post-read, annulering, deadlines,
privacy en vervanging van een oud0644-rapport door een nieuw0600-bestand.
ScopeESLint, gepinde Actionlint/ShellCheck en diffcheck slagen. Workspace lint,
typecheck en test slagen ieder30/30; bestaande Turbocacheresultaten zijn daarbij
hergebruikt en gelden niet als nieuwe executies van elk pakket.

Een echte PostgreSQL-fixture op de eigen lokale S190-stack bevestigt nul
notificaties zonder tenant, precies één reload-notificatie met de synthetische
actieve tenant en ontvangst via een afzonderlijke LISTEN-verbinding. De fixture
wordt voor commit verwijderd; de tenant bestaat daarna niet. Dit bewijst de
SQL-semantiek, geen productieherstel. Een onafhankelijke read-only review van
module, tests, probeallowlist en workflow vond geen concrete blocker.

Exacte nieuwe CI, vertrouwde merge, beschermde uitvoering en werkelijke
before/action/after-readbacks blijven vereist. Ook geslaagde recovery bewijst
niet waarom het laden van de schemacache faalde. Mogelijke schema-, catalogus-,
statement- of poolproblemen vereisen afzonderlijk bewijs; de
[Supabase-beschrijving van PGRST002](https://supabase.com/docs/guides/troubleshooting/postgrest-error-pgrst002-could-not-query-the-database-for-the-schema-cache-c396e9)
is geen diagnose van deze specifieke productieomgeving. De verdere
productiepromotion wacht op een werkende Data API. De volledige oorspronkelijke
opdracht blijft open tot de normale synccycli, gegevensfreshness, veilige
opruiming, behouden hashes en relevante echte schermflows zijn bevestigd.
