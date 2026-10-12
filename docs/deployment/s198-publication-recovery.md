# S198: workerannulering en gecontroleerde productiediagnose

Productionpromotie [38285006528](https://github.com/veyocast/platform/actions/runs/38285006528)
heeft runtime `18e53d89e49fc73b54a3823a69533e45a5b6e51b` werkelijk uitgerold.
De deploy-stap slaagt, maar de daaropvolgende pairing/LG-smoke faalt met HTTP503
(curl22). De oorspronkelijke smoke heeft geen fasemarkers; het mislukte endpoint
is daardoor onbekend. Publieke Control/Player/Marketing-health200 bewijst geen
gezonde database. De totale promotie blijft FAILURE, ook al is de runtime actief.
Staging [38283156871](https://github.com/veyocast/platform/actions/runs/38283156871)
is volledig SUCCESS op dezelfde release.

De scoped integratieprobe
[38285853634](https://github.com/veyocast/platform/actions/runs/38285853634)
faalt `PROBE_DIAGNOSTIC_READ_FAILED`; één worker is running/healthy met restart0.
De afzonderlijke runtimeprobe
[38286185233](https://github.com/veyocast/platform/actions/runs/38286185233)
meet om17:45:54UTC `SQL_CONNECT_FAILED`/UNKNOWN in16.147s en
`REST_TIMEOUT` in10.003s. De ongeauthenticeerde gateway geeft401 binnen127ms.
Dit bewijst mislukte afhankelijke reads; er is nog geen onderbouwde oorzaak of
bewijs dat de worker deze veroorzaakt. De oorspronkelijke failures blijven bewaard.

## Aanpassingen

De opruimrunner koppelt zijn bestaande owned AbortSignal aan de gepinde SDKRPC.
Een werkelijk hangende native request stopt daardoor bij cancellation, ook
binnen de bestaande20s taskgroup-drain. De bestaande30s requestgrens, batch25,
transactionele referenceguards, wachtrij, backoff en immutable releasebescherming
blijven behouden. Dit bewijst clientcancellation; het bewijst geen geslaagde
productie-opruiming of onmiddellijke server-side querycancellation.

De pairing-smoke bewaart iedere response uitsluitend in een private tijdelijke
map en rapporteert alleen reviewed fase/code, HTTP-status en procesexit.
Installation, pairing, recovery, standalone LG-content en authenticated cleanup
blijven verplicht. Connect10s/max30s begrenzen iedere request; geen retry.
Rawbody, transportstderr, JSON-parsefragmenten en credentials worden niet gelogd.
Cleanup draait ook na failure en behoudt de eerste fout. Een cleanupfailure
verandert een eerdere exit0 in failure; de succesmelding volgt pas ná cleanup.

Beide beschermde runtime-/publication-probeworkflows krijgen uitsluitend de
optionele boolean `quiesce_worker` (standaardfalse). True gebruikt een vaste
helper die precies één running Compose-worker verifieert op volledige container-ID,
project/service en de verwachte runtime-image. De helper stopt die container met
20s drain, voert uitsluitend de gekozen bestaande read-only probe uit en herstelt
dezelfde container bij afloop/failure en normale signals. Een eerst mislukte/interrupted stop wordt bounded
voltooid vóór de herstelstart, zodat een lopende daemon-drain geen vroege start
ongedaan maakt. Geen willekeurig command/containerpad of unowned DB-sessionkill.

Quiesced workflows delen de bestaande `deploy-veyocast-main` concurrencygroep;
ze kunnen daardoor geen runtimevervanging overlappen. Een afzonderlijke vaste
host/UID/environment-flock beschermt het helperownership. De bestaande5min job,
interne45s SQL-connect-/52s proces-/10s REST-grenzen blijven behouden. Een totale
operationele ceiling190s(publication)/80s(runtime) reserveert hersteltijd.
Bij een rechtstreeks ontvangen signal herstelt de helper eerst de worker en
annuleert daarna uitsluitend zijn eigen diagnosticprocessen. De GitHub job én
critical step gebruiken altijd-statusvoorwaarden bij opted-in quiescence, zodat
gewone workflowcancellation die begrensde critical section kan laten voltooien.
Dit volgt het [GitHub cancellationcontract](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).
De setupstappen vereisen success en !cancelled; een geslaagde install vormt het
expliciete armingpoint. Cancellation precies daarna kan de opted-in critical
section nog laten beginnen. Een afzonderlijke cancelled()-marker bewaart de
workflowcancellation als failure; een helperexit0 wordt niet als geslaagde run
geaccepteerd. Niet-quiesced probes blijven rechtstreeks annuleerbaar.

Een timestamp van de eerste scriptstap en check vlak vóór stoppen reserveren de
probeceiling plus60s vanaf dat vastgelegde tijdstip binnen de bestaande300s grens.
Runner/actionvoorbereiding vóór die stap is niet in dit timestamp gemeten.
Onvoldoende/ongeldige resterende tijd stopt vóór
worker-mutatie. Geen garantie bij geforceerde hele-jobkill/runner- of hostverlies;
de gewone daadwerkelijke stagingcancellation moet nog worden bewezen.
Failures/cancellation blijven failures; geen verborgen retry of succesomzetting.

De runtimeCLI geeft SIGINT/SIGTERM bovendien door aan health, zijn apart
owned SQL-procesgroep en REST. Daarmee kan het stoppen van de helpercaller geen
losse SQL-wrapper/descendant achterlaten. De oorzaak van de eerdere connect/readfailures blijft onbekend.

De nieuwe [productionplanprobe38288935523](https://github.com/veyocast/platform/actions/runs/38288935523)
is werkelijk DIAGNOSTIC_COMPLETE op workflowmain7de85f3d/runtime18e53d89, observed
18:13:45UTC. Vier queries slagen met120 complete plannodes en metadata binnen52.643s.
Tenantlookup11.704s, catalogustellingen30.835s, EXPLAIN6.812s en timeout/indexmetadata
3.135s bevatten CLI/connectoverhead; dat zijn geen afzonderlijke query-exectijden.
De vaste brede inventory heeft geschatte rootcost52269.24; heartbeatSeqScan
375806rows/cost13234.58, syncEventsIndexOnlyScan392495rows/cost22732.87.
Het heartbeatcatalogus bevat geen tenant_id/active_release_id index. Dit rechtvaardigt
onderzoek van de selectieve canonicalprunepredicate; het brede inventoryplan
bewijst geen werkelijk uitgevoerde prunetiming of databaseconnectoorzaak.
Authenticator-roldeclaraties bevatten8s statement/locktimeout; dat bewijst nog niet
de effectieve PostgREST-requesttimeout. Geen timeoutinstelling is gewijzigd.
De datasetstatus blijft matchesfailed/UNKNOWN_ERROR en competitionfailed/TRANSPORT;
53bindings/1218releases/21909snapshots zijn behouden. Succes van de diagnose is
geen herstel van Sportlink, opruiming of twee gewone cycli.

## Validatie en resterende acceptatie

De twee native request-regressies falen werkelijk vóór de runnerfix en slagen
nadien; gerichte runner-/schedulercontracttests37/37 zonderSKIP, worker-typecheck
en gerichte lint slagen. De15 smokechecks slagen zonderSKIP en bewijzen alle vijf
failurefasen, originele foutbehoud, verplichte cleanup, private-errorredactie en
behoud van pairing/recovery/LG-assertions. De eerste lokale cleanup-successfailure
is gecorrigeerd door de succesmelding ná cleanup te plaatsen; geen assertion
verwijderd. Pinned workflowlint en gerichte Bash/ShellCheck slagen werkelijk.

Workspace lint/typecheck/test slagen ieder30/30, met284workerPASS en250 bestaande
opt-inSKIP. De runtime-suite32/32 plus gedeelde SQL/configsuites77/77 slagen zonder
SKIP, inclusief daadwerkelijke SIGINT/SIGTERM-cancellation van CLI-SQL-wrapper en
zijn echte descendant, health/REST en pre-abort zonder credentials/spawn.
Helper37/37 slagen zonderSKIP: echte procescancellation, same-ID-restorevolgorde,
hostlock, resterende-tijdrejections en composed helper → werkelijke runtimeCLI →
detached wrapper/descendant. De volledige VPS-validator slaagt werkelijk exit0
met200/200 operationele tests zonderSKIP; gepinde workflowlint/ShellCheck slagen.
Onafhankelijke reviews bevestigen frozen runner/runtime/helper, workflowcancel-
guards en root-owned smoke zonder blockers. Geen bestaande gate/assertion is
verwijderd. Exacte commit-CI, stage-first deployment en gewone beschermde staging-
cancellation/feitelijk workerherstel volgen.
De protected quiesced probe moet aantonen wat daadwerkelijk gelezen kan worden;
apphealth of lokale tests vervangen dat bewijs niet. Ook feitelijke opruiming,
opponentvorm, post-deploy verjaardagssync en twee gewone ververscycli zijn nog
geen afgeronde productieacceptatie. Providerdata blijft database → durable
published-dataqueue → slides, zonder nieuwe ontwerpversies. Referenced actieve,
desired/default/composition/offline releases blijven immutable beschermd.
