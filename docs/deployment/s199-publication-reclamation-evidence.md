# S199: controleerbaar opruimbewijs

De bestaande integratiecomparer accepteert gelijke aantallen als NO_NET_INCREASE.
Dat bewijst geen verwijdering en geen bewaarde releasehashes. S199 leest daarom
uitsluitend bestaande gegevens; er komt geen nieuwe verwijderopdracht, schema,
policy, providerimport of ontwerpversie bij.

De bestaande beschermde main-only publication-maintenanceworkflow krijgt de
expliciete read-only mode `reclamation` en optionele canonical UTC `evidence_since`.
Een exact actief tenant-ID is verplicht; playlistoverride/observatiepoll zijn niet
beschikbaar in deze mode. Control en Player moeten vóór de vaste SQL-query de
opgegeven runtime-SHA healthy melden. Het rapport bewaart die runtime-SHA en de
werkelijke vertrouwde workflow-SHA afzonderlijk. Nieuw reviewed maincode kan zo
ook de oude gezonde runtime vóór deployment observeren; de finale operationele
acceptatie blijft op één exact gedeployde SHA.

SQL projecteert exacte aantallen, canonical protected release-identiteiten met
manifesthash en een fingerprint van alle opgeslagen items, en positieve bestaande
transactionele `publication.superseded_versions.pruned` audits. Per behouden audit
wordt de afwezigheid van de geregistreerde release-/slideversie-/snapshot-IDs
opnieuw tenantgebonden gecontroleerd. De canonical referencefunctie omvat ook
composition/fallback en alle overige beschermde verwijzingen; de smallere oude
30-day inventoryunion is geen verwijderallowlist.

Alleen gecontroleerde UUIDs, hashes, tellers, statusbooleans en tijden verlaten SQL.
Geen raw manifest/items, providerrecords, querytext of secrets. Vaste caps en
truncatie blijven expliciet UNPROVEN; ontbrekende audits zijn geen opruimingsbewijs.
Creation-timestampcounts tellen alleen overlevende rows en bewijzen geen exacte
commitvolgorde of afwezigheid van kortstondige create/delete. Auditbewering
activeReferencesPreserved is op zichzelf geen onafhankelijke hashvergelijking.
Media wordt niet verwijderd of als verwijderd gerapporteerd.

`observedAt` is de starttijd van het SQL-statement, geen snapshot- of committijd.
De bestaande canonical referencefunctie is VOLATILE en kan tijdens het statement
nieuw gecommitteerde verwijzingen observeren. Een vergelijking moet daarom ook
de ongewijzigde publicatiecontext controleren; één rapport bewijst dit niet.

De bestaande45s connect-/60–130s clientprocess-/10s healthgrenzen en owned
cancellation blijven behouden. Het extra fixed `reclamation_evidence` label
breidt uitsluitend de reviewed faseallowlist uit. De artifact
`publication-reclamation.json` krijgt mode0600. Vier vaste oude readbackbestanden
worden vóór elke workflowoperation verwijderd om stale cross-run artifacts op de
self-hosted runner te voorkomen. Inventory/refresh/cutover behouden hun bestaande
scope-, mutatie-, health-, cooldown- en failurepaden.

Een succesvolle readback betekent uitsluitend gesanitiseerde observaties.
UNPROVEN kan dus veilig verzameld worden; workflowexit0 is geen complete acceptatie.
Echte positieve audits/ontbrekende verwijderde IDs, hashvergelijking van beschermde
releases, daadwerkelijke datasetfreshness en twee gewone ververscycli blijven
vereist voordat de oorspronkelijke gebruikertaak als afgerond wordt gemeld.

Alle zeven CLI-regressies en veertien modulechecks slagen zonder overgeslagen
tests. Ze controleren de private baseline, afwijzing vóór SQL bij verkeerde
scope, verkeerde health-SHA, tenantisolatie, privacy bij SQL57014, de drie
bestaande modes en vervanging van een oud 0644-rapport door een nieuw 0600-bestand.
De workflow verwijdert oude rapporten als eerste stap; upload vereist dat deze
stap slaagt, ook wanneer setup of uitvoering daarna mislukt.

Workspace lint, typecheck en test slagen ieder 30/30; de volledige VPS-validatie
slaagt met 221/221 checks en alle workflows zijn met de gepinde Actionlint en
ShellCheck gecontroleerd. Een verse reset van de eigen lokale Supabase-stack
en alle 102 pgTAP-bestanden met 2886 assertions slagen. De tien echte
PostgreSQL-fixtures controleren onder meer canonieke offline-/fallbackreferences,
volledige itemfingerprints, tenantisolatie, afwezigheid en alle caps. Deze fixtures
zijn synthetisch en teruggedraaid; ze bewijzen geen productieopruiming.
Onafhankelijke reviews van beide modules en de workflowintegratie geven ACK op
de gecontroleerde bestandsinhoud. Exacte PR-/Sites-CI, deploy en livebewijs
blijven afzonderlijke vervolggates.

De lokale PostgreSQL-proof is vastgelegd onder
`/dev/shm/veyocast-s199-reclamation-evidence/proof.json`, SHA-256
`3ad6f25c29330e3c5183947a069342676166ceb1e60dae43f356a7dee0964330`.
De uiteindelijke modulehash is
`60f54b0eacd31829a738d2204dd9d9708934f78b975ee9acaa8102b38ddbc25a`;
de woordelijke beperking over VOLATILE is na deze SQL-fixtures verduidelijkt,
zonder wijziging aan SQL of de uitvoervelden.
