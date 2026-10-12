# S198 — productieherstel: annuleerbare opruiming en bruikbare smoke-diagnose

Concrete aanleiding: M19618e53d89 is werkelijk actief/healthy op productie;
run38285006528 deployment-stepSUCCESS maar pairing/LG-smokeHTTP503/exit22.
Geen huidige stapmarker/bodydiagnose, dus oorspronkelijke endpoint/causeUNKNOWN.
Aansluitende read-onlyintegratieprobe38285853634 faalt PROBE_DIAGNOSTIC_READ_FAILED,
terwijl één worker running/healthy/restart0. Afzonderlijke SQL/APIprobe38286185233
is gestart; S197compacteplanprobe moet na volledige exacteCI/mainmerge volgen.
Geen retry/deploy/pruneherstelclaim zonder daadwerkelijk bewijs.

Tweede concrete codebug: PublicationVersionPruneRunner.runOnce krijgt signal maar
verbindt het niet met de gepinde SDKRPC. Clientdeadline30s kan voorbij20s drain
lopen. Geef het owned stopsignaal door, bewijs echte hanging nativeSDK-request
annulering, behoud referencechecks/transaction/queue/backoff en vaste veilige
fouten. Geen lokaleDELETE, andereclaims of verruimde timeouts. SDK fouten/body/
abortreason mogen niet uitlekken; onafhankelijk review en betekenisvolle regressies.

Root bezit scripts/smoke-player-pairing-recovery.sh en nieuwe bijbehorende
scripts/smoke-player-pairing-recovery.test.mjs; alleen veilige vaste fase,
HTTP-/processtatus en reviewedcode diagnosticeren, rawbody/credentials nietlog.
Originele failureexit blijft en cleanup blijft verplicht; geen assertions/gates
weglaten of ongerelateerde retries. Bewaar oorspronkelijke503failure expliciet.
Root bezit TASK_LEDGER.md, docs/deployment/s198-publication-recovery.md, dezeprompt,
workflow-/VPS-validatorlists, en toekomstige vaste read-only queue-progress-/form-
metadata indien concreet nodig. Metadata/index/schemapaths pas na rootownership
uitbreiding en echte planonderbouwing; geen speculativeDDL/hash-/timeoutwijziging.
Pruneagent bezit uitsluitend apps/media-worker/src/publication-version-prune-runner.ts
en apps/media-worker/test/publication-version-prune-runner.test.ts. Overige paths
stop/meld. Geen sharedwriters, dependencies, lockfile, Source-/rendererwijziging.

Volg verplichte canonleesvolgorde; canons al gelezen blijven leidend. Werk in
/tmp/veyocast-s198-publication-recovery, branchveyocast/s198-publication-recovery,
parentS197644390e7; root integreert daadwerkelijke main na S197greenmerge normaal.
Gates workspace lint/typecheck/test; exacte SDK regressies; veilige echte shell-
smoke-failure/cleanup/privacy regressies; opsvalidators/pinnedworkflowlint. RLS+DBreset
als daadwerkelijke migratie noodzakelijk wordt. Volledige exactePR/SitesCI,
staging/production en twee normale cycli/feitelijkeopruiming blijven vereist.
Actieve/desired/default/composition/offline-LKG-releases blijven immutable/beschermd;
providerdata gaat DB→durablepublished-dataqueue→slides, geen nieuweontwerpversies.

Aanvullende concrete probe38286185233: SQL_CONNECT_FAILED/UNKNOWN binnen16.147s,
REST_TIMEOUT10.003s, gateway401/127ms en publiekehealthPASS. Dit bewijst twee
mislukte afhankelijke readchecks, niet hun oorzaak. Root breidt ownership uit:
quiesceagent uitsluitend nieuwe scripts/probe-with-quiesced-worker.sh en
scripts/probe-with-quiesced-worker.test.mjs. Root integreert uitsluitend expliciete
optional defaultfalse quiesce_worker input in beide bestaande beschermde
runtime-/publicationprobe-workflows. Alleen exact huidige één runningexpectedimage-
worker tijdelijkstoppen; alwaysrestore dezelfde container op failure/cancel,
boundedstop/start/checks, geen unownedDBsessionskill of geheimen in output.
Alleen twee vaste reeds reviewedread-onlyprobe-entrypoints, nooit arbitraircommand.
Oorspronkelijkeexit en diagnosticfailure blijven; geen budgets/gatesverruiming.
Root owns workflowlists/ledger/docs; geen anderewriters. Geloofwaardigeactual
shellcancel/failure/restore/scope/privacy-tests en onafhankelijke review nodig.

Concrete transitive cancellation gap: runtime-probe CLI heeft geen owned
SIGINT/SIGTERM-controller terwijl zijn SQL-adapter een eigen procesgroep start.
Root breidt pruneagent-ownership uitsluitend uit met
scripts/probe-runtime-database.mjs en scripts/probe-runtime-database.test.mjs.
Geef één operationSignal door aan health, SQL-adapter en REST; kill/drain alleen
eigen SQL-wrapper/descendant bij cancellation, vaste veilige code en exit130/143.
Bewijs echte Linux CLI-cancellation tijdens SQL én stop health/REST verzoeken;
geen timeoutverruiming, onbeheerde processen of raw errors. Volg dezelfde reeds
reviewed S195-publication-cancellation invarianten. Quiesceagent wijzigt die
twee files niet. Root behoudt workflow-/ledger-/docownership.

Concrete onafhankelijke cancellationreview: GitHub gewone cancellation kan na
7.5+2.5s de run-stepboom killen vóór23s hersteldrain klaar is. Root-owned workflow
gebruikt opted-in always-job/criticalstep en execboundary, expliciet annuleerbare
setup, installsuccess als armingpoint en cancelled()-marker/failure. Normale
niet-quiesced probes blijven annuleerbaar. Helperagent behoudt alleen zijn2files
en voegt vóór worker_id-arming/stop een echte jobstarttimestamp/remainingbudgetcheck
toe:300s bestaandejob minuselapsed moet≥probeceiling+60s; andersfailzonderstop/start.
Geen verhoogd budget, persistent guardian of garantie bij forcedkill/hostloss.
Actual gewone stagingcancellationbewijs na mainstage vereist vóór prodquiescence.
Nieuwe productieplanprobe38288935523 SUCCESS/DIAGNOSTIC_COMPLETE is daadwerkelijke
veilige observatie, geen herstelbewijs. Canonicalselectieveprunepredicate wordt
onafhankelijk met echte localprod-scaleplan onderzocht; repoDDL nog nietowned.

Root stop-and-report ownership extension after concrete plan evidence: selective
canonicalheartbeatDELETE predicate loses375k-row SeqScan in actual localPG15.8
custom/genericEXPLAIN when partial(tenant_id,active_release_id)ISNOTNULL index is
present; same stats and read-onlylookup33.796ms→0.740ms. NoDELETEexecuted, no actual
productiontiming/causeclaim. Root now owns only new
supabase/migrations/20261012190000_s198_heartbeat_release_lookup.sql plus the fixed
index-name allowlists in scripts/publication-runtime-metadata.mjs and
scripts/probe-publication-runtime.mjs. Root retains docs/prompt/ledger. Other
DBfunctions/security/RLS/eligibility/deletionrules unchanged; existing full
canonical-prune/RLSsuite plus dbreset are required before secondcommit/push.
No schema concurrencyconflicts, dependencies, generatedtypes or seedchanges.
DDL creates index only; forwardbuildlocking impact assessed, rollbackDROPINDEX
would remove only optimization. Existing ordinary stage-first migrationpath.

Root extends the same ownership to the two corresponding metadata/probe test
fixtures only, preserving shape/privacy/cap assertions for the new fixed index.
Actual old-head CI38290582006 exposed missing rg in workflow enumeration and
stale trusted-main/direct-node validator patterns. Root now owns only
scripts/validate-github-actions.sh and scripts/validate-deploy-workflow-security.mjs
to fix enumeration without extra dependencies and verify both exact reviewed
main/cancellation/exec branches. Original CI failure is retained, no gate removed.
