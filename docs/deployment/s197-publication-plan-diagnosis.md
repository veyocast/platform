# S197: compacte plan- en timeoutdiagnose

De protected productieprobe38281293442 is uitgevoerd vanaf trusted main0f017060
tegen gezonde Control/Player-runtime3dfa75ca. Tenantlookup1545ms en statistiek5280ms
slagen. De vaste inventory-EXPLAIN faalt binnen1552ms op SQL_OUTPUT_TOO_LARGE.
Dat bewijst de uitvoerlimiet van deze diagnose, niet de oorzaak van de eerdere
Sportlink-completion57014, een timeoutmechanisme of succesvolle opruiming.

De querytemplate blijft dezelfde vaste read-only inventory; EXPLAIN gebruikt
FORMAT TEXT met COSTS TRUE, SUMMARY TRUE, VERBOSE/SETTINGS FALSE en zonder ANALYZE.
De Planning Time-afsluiting bewijst dat het plan compleet ontvangen is; een
eventuele JIT-footer moet ook volledig geldig zijn. De parser bewaart uitsluitend
gereviewde technische nodes/relaties/indexen en numerieke kosten/rows. Geen
filter-/SQLtekst of providergegevens belanden in het artifact. Onbekende,
onvolledige of malformed output blijft UNPROVEN. CLIstdout blijft65.536bytes,
de normale connectbudget45s en eigendom/cleanup van de diagnoseprocessen blijven
behouden; de bestaande procesgrens52s wordt niet verhoogd.

Een afzonderlijke vaste catalogusquery leest uitsluitend timeoutkeys voor de
gereviewde rollen/database-overrides en completion/hash/queue-functies, negen
bron-/heartbeat-tabellen, gereviewde indexkolommen en optionele trackingmetadata.
Geen function bodies, willekeurige rolconfigs, source-recordscans, hashherberekening
of pg_stat_statements-queryteksten. Afwezige/ongeldige/onbekende waarden blijven
expliciet. Een succesvol gelezen en gevalideerd observationstage behoudt deze
onzekerheid; metadataComplete=false is geen transport-/parsefailure. Overall
DIAGNOSTIC_COMPLETE betekent dat alle gevraagde queries veilig zijn waargenomen,
niet dat een oorzaak of effectieve timeout bewezen is. Een mislukte/malformed/
truncated catalogusstap houdt de overall diagnose UNPROVEN.
Deze declaraties bewijzen niet de effectieve PostgREST-requesttimeout;
catalogus-/live/deadschattingen zijn databasebreed en geen exacte tenanttellingen.

Bij HTTP-completion57014 bewaart de worker alleen twee exact gereviewde Engelse
PostgreSQL-berichten als vaste suffix: STATEMENT_TIMEOUT of USER_REQUEST. Een
andere of verrijkte message blijft de algemene57014; status0 blijft eerst
TRANSPORT_FAILED. Details/hints en willekeurige messagebytes blijven buiten de
opgeslagen fout. Twee nieuwe echte SDK-regressies falen vóór de codewijziging;
na de fix slagen alle86 tests van de bestaande Sportlinkfile en281 worker-tests
met250 ongewijzigde opt-inSKIP. De tests controleren
ook persistentie, andere SQLSTATEs, private messagevarianten en status0. De oude
get_live_integration_diagnostics_v1 formatter maskeert deze suffixes als UNKNOWN;
de scoped operationele probe moet beide vaste codes expliciet toelaten.

De werkelijke lokale gepinde CLI leest dezelfde inventory-query met108 identieke
plannodes/kosten/rows: JSON62.972bytes, TEXT21.990bytes. De afzonderlijke vaste
catalogusquery leest37.140bytes binnen1.060s; metadata-tests11/11 zonderSKIP en
gerichte lint slagen. De local wireproef bewijst geen productieplan/runtime.

De33 probe- en11 metadataregressies slagen44/44 zonderSKIP, inclusief drie
werkelijke Linux CLI-cancellations tijdens statistiek, EXPLAIN en nieuwe catalogus-
stap: owned wrapper en descendant worden gestopt. Eerste lokale parser-/fixture-/
lintfailures blijven bewaard; de finale correcties verruimen geen bounds/assertions.
De gepinde Actionlint/ShellCheck over alle workflows slaagt werkelijk exit0;
casepreservation9/9 en runnerpolicy8/8 slagen zonderSKIP. De volledige VPS-
validator slaagt werkelijk exit0 met141/141 operationele regressies zonderSKIP.
Root herleest beide echte lokale CLIwires, verifieert hun SHA256 en bevestigt
alle108 gesanitiseerde nodevelden exact gelijk; dit blijft lokale wirevalidatie.

Workspace lint/typecheck/test slagen werkelijk elk30/30. Deze lokale tests
vervangen geen exacte commit-CI, trusted-main-productiediagnose, staging/productie-
promotie of twee gewone synchronisatiecycli. Actieve/desired/default/offline-LKG-
releases blijven immutable beschermd; providerdata blijft database → duurzame
published-dataqueue → slides en maakt geen nieuwe ontwerpversies.

Onafhankelijke read-only review bevestigt worker, metadatamodule, parser, expliciete
CI/VPS-lists en frozen hashes zonder concrete blockers. Unknown catalogusvelden
blijven zichtbaar; completionScope beperkt de succesvolle diagnose tot veilige
observaties. De review voert geen productiequery uit en bewijst geen57014-oorzaak.
