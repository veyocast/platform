# S201: vaste databasecontext tijdens de Data API-storing

De historische publieke anon/RLS-lezingen van de bekende productietenant
bevestigden op 12 oktober2026 HTTP503/PGRST002. De latere beschermde probe
38309514100 op vertrouwde main4210 en runtime18e bevestigde om21:21:28UTC
echter SQL_CONNECT_FAILED/UNKNOWN na16.154s en REST_TIMEOUT na10.002s.
Er was bij die laatste REST-poging geen HTTP-respons of actuele PGRST-code.
Deze afzonderlijke waarnemingen mogen niet tot één actuele foutcode worden
samengevoegd.

De eigen productiewerker was voor die probe gestopt en werd daarna hersteld:
QUIESCED om21:21:01.948UTC, RESTORED om21:21:28.867UTC. De pauze leverde geen
onmiddellijk bewezen herstel op. Dit sluit eerdere of resterende belasting
door de werker niet uit en bewijst geen specifieke databaseoorzaak.

De openbare marketing-, login-, Player- en healthroutes antwoordden bij een
nieuwe controle om21:35UTC HTTP200; de healthroutes rapporteerden runtime18e.
Dit zijn uitsluitend niet-ingelogde antwoorden. Sessierollen en beschermde
bronqueries hebben een werkende Data API nodig; publieke health is daarvoor
geen acceptatiebewijs.

## Vast read-only contract

`Probe Data API database context` draait uitsluitend op de exacte vertrouwde
main-SHA in protected production. De volledige verwachte runtime-SHA is de
enige invoer. Het contract controleert eerst de bestaande projectscope,
publieke Control/Player-health en de bekende actieve tenant7526 via directe
SQL. Een falende REST-lezing verhindert een diagnostische contextmeting niet;
zonder SQL_READY en bewezen tenant wordt geen extra query uitgevoerd.

Daarna leest één vaste SELECT actuele metadata, met een extra maximum van20s
en de bestaande owned SQL-procesannulering. Er is geen polling. De CLI heeft
een totale grens van180s; de workflow vijf minuten. Deze onafhankelijke,
read-only contextworkflow hoeft niet achter de deployconcurrency te wachten.

De projectie bevat uitsluitend vijf vaste backend-loginrollen met begrensde
status- en wait-aantallen, relation-locks en tabelprogress voor
`public.player_heartbeats`, negen vaste tabellen met catalogus- en dead/live
tuple-schattingen, de bekende heartbeatindex met afzonderlijke
aanwezigheids-, definitie-, valid- en ready-booleans, en aanwezigheid van exact
migratieversie20261012190000. SQL, PIDs, vrije namen, gebruikersrecords,
credentials en vrije databasefouten komen niet in de output.

Ontbrekende zichtbaarheid, truncatie, ontbrekende tabellen of onvolledige
definitievelden blijven expliciet onvolledig. Een geslaagde meting geeft
context; de verdict blijft UNPROVEN voor oorzaak en beschikbaarheid. De
healthcontrole gaat aan de metadata vooraf en bewijst niet dat de runtime
gedurende die hele periode ongewijzigd bleef.

Activiteit en locks zijn actuele context, geen bewijs van historische
index-buildbelasting. Backend-loginrollen zijn geen per-request RLS-rollen.
Tabelprogress identificeert een reguliere CREATE INDEX niet uniek, omdat
index_relid tijdens zo'n build nul kan zijn. Tuple-aantallen zijn schattingen,
geen gemeten bloat, CPU, geheugen, fysieke I/O of rij-aantallen per tenant.

## Migratie en herstel blijven afzonderlijk

S198 bevat een gewone CREATE INDEX zonder IF NOT EXISTS, binnen haar vaste
transactie en bestaande maximumgrenzen. De migratie is al toegepast op
staging en blijft byte-identiek. Een vooraf gebouwde concurrente index met
dezelfde naam zou de bestaande CREATE laten falen; een andere naam wordt
door die CREATE niet hergebruikt. S201 bouwt geen index, wijzigt geen
migratiehistorie en verruimt geen timeout.

Catalogusdefinitie en aanwezigheid van de migratieversie worden afzonderlijk
gemeten. Zij bewijzen geen gezamenlijke atomiciteit van DDL en de later door
de pinned CLI geschreven migratiehistorie. Er zijn geen data-, configuratie-,
RLS-, rol-, provider-, release- of versieaanpassingen.

De aparte S200-recovery blijft uitsluitend bereikbaar bij een nieuwe
SQL_READY/actieve-tenantwaarneming en exact REST503/PGRST002. Deze
contextworkflow stuurt geen NOTIFY, herstart of beëindigt geen proces en
bewijst geen herstel. Beide rapporten vervangen alleen hun eigen vaste
oude artifact; uitsluitend nieuwe0600-output wordt bewaard nadat cleanup
geslaagd is.

## Validatie en resterend werk

Alle17 nieuwe gerichte Node-regressies slagen zonder skips; samen met de33
bestaande runtimeprobe- en10 recoverychecks zijn dat60/60 geslaagde checks.
Daarbij worden echte eigen Linux-procesgroepen en descendants bij SIGINT
en SIGTERM beëindigd, zonder netwerkverkeer of beëindiging van andere
processen. ScopeESLint, gepinde Actionlint/ShellCheck en diffcheck slagen.
Workspace lint, typecheck en test slagen elk30/30. Lint en typecheck gebruiken
de bestaande Turbocache volledig; test hergebruikt29 resultaten en voert
de29 testkitchecks vers uit. Dit geldt niet als nieuwe uitvoering van elk
pakket.

De exacte query slaagt op de eigen lokale PostgreSQL15.8-stack. Zonder de
bekende tenant blijft scopeReady=false; alleen de tijdelijke actieve fixture
bevestigt de scope, indexdefinitie/valid/ready en migratiehistorie. De paused
fixture wordt afgewezen. Ontbrekende schattingen leveren contextComplete=false
op. De transactie wordt teruggedraaid; een afzonderlijke lezing bevestigt nul
overgebleven fixturetenants. Root verifieerde de tien private bewijsbestanden,
hun bytes/hashes en rechten, inclusief overeenstemming met de geëxporteerde
query. De onafhankelijke read-only code/workflowreview geeft ACK zonder
concrete blocker. Exacte CI en beschermde productie-uitvoering volgen
afzonderlijk. Geen lokale of synthetische controle geldt als diagnose van
productie.

De volledige oorspronkelijke opdracht blijft open: werkende databaselezingen,
staging en production op de finale geteste SHA, gewone synccycli met verse
gegevens, positieve pruneaudits met afwezige verwijderde IDs en behouden
beschermde hashes, stabiele authoringversies en relevante echte schermflows
moeten nog worden bevestigd.
