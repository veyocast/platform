# S192: databasecontrole en herstel bij afgebroken deployment

S191 PR 216 is gemerged als `f4c972f1a783da83e144a6056495ce0f2324d212`.
Stagingrun [38199269401](https://github.com/veyocast/platform/actions/runs/38199269401)
slaagde. Productionrun
[38200372232](https://github.com/veyocast/platform/actions/runs/38200372232)
faalde in `supabase migration list`, circa tien seconden na de eerste
databaseverbinding. Er waren nog geen migraties of applicatiecontainers
gewijzigd. Production bleef op `c3ef6b504dcd534b1988e2a96df102be08ce1118`.
De verse inventarisatie
[38201079451](https://github.com/veyocast/platform/actions/runs/38201079451)
faalde met `PUBLICATION_DATABASE_CONNECT_FAILED`.

De vastgezette CLI omvat in zijn verbindingstimeout ook de eerste `SELECT 1`.
Daarom bewijst deze melding geen specifieke TCP-, TLS-, authenticatie- of
poolfout. Oude synchronisatie-/heartbeatlogs bevatten herhaaldelijk PostgreSQL
`57014`; dat bewijst annulering en is geen bewijs van pooluitputting. Er zijn
geen migrationscripts of CLI-versies veranderd sinds de vorige succesvolle
productiondeploy. Databasebelasting blijft een hypothese totdat live bewijs
haar ondersteunt.

Na de bestaande preflight, immutable imagecontrole, stagingbewijs en
Composevalidatie identificeert de deploy uitsluitend de draaiende vorige
mediaworker. Het oude image-ID, release-SHA, omgeving en Compose-labels moeten
overeenkomen. De herstelstatus wordt vóór `docker stop --time 70` geactiveerd.
De normale databasecontrole/migraties draaien daarna met ongewijzigde TLS en
historyguards. Control en Player blijven beschikbaar; lokale offlineplayback
wordt niet gewijzigd.

EXIT herstelt eerst en ruimt daarna tijdelijke bestanden op. ERR bewaart zijn
foutcode; INT en TERM eindigen met 130 en 143. Bij een vroege fout wordt exact
het oude container-ID herstart. Na runtime-mutation blijft de vorige
image/configuratierollback leidend. Elke healthcheck geeft een fout expliciet
door, zodat een latere succesvolle check een mislukte check niet kan verbergen.
Mislukt herstel, dan blijft de beveiligde vorige runtimeconfiguratie behouden
voor incidentherstel en eindigt de deployment met een fout.

Transportdiagnostiek is begrensd, read-only en toont uitsluitend vaste
statuscodes en looptijden. Ze verstuurt geen PostgreSQL-authenticatie. Haar
strikte TLS-controle staat afzonderlijk van de CLI; een diagnostische
certificaatfout wordt niet als bewezen oorzaak van de CLI-fout gepresenteerd.

Shelltraps dekken geen SIGKILL, verloren runner of hostuitval. Een Docker-start
bevestigt een gestart proces; volledige nieuwe release-readiness blijft de
bestaande healthmatrix bewijzen. Staging heeft geen providerdata en levert
daarom geen bewijs van production-LED/Sportlink-verversing. De live readbacks
worden na de nieuwe deployment afzonderlijk vastgelegd, inclusief gewone
automatische vijfminutencycli en stabiele configuratie-/release-ID's.

Lokale gates: 33/33 gedragsmatige lifecycle-, migration-hook- en transporttests;
workspace lint, typecheck en unit-tests elk 30/30; build 18/18. Shellsyntax,
VPS/Compose-configuraties, rollbackcontract en GitHub Actions-validator slagen.
De CI draait de nieuwe tests verplicht via de bestaande VPS-validator. Deze
lokale tests gebruiken gecontroleerde mocks/loopback en bewijzen geen
productiondatabasebereikbaarheid. Protected live deployment/readback volgt.
