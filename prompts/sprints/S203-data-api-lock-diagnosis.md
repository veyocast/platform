# S203 — begrensde Data API-lockdiagnose

## Probleem en doel

De productie-uitrol38322013412 van main73422901 is opnieuw mislukt. De gebruiker meldt nog een onbeschikbare website. De gedeelde serverlogs bewijzen57014-time-outs en tuple/transaction-lockwachten in database5 met relation20982, maar bevatten geen bijbehorende SQL STATEMENT/CONTEXT. De bestaande S201-context ziet alleen heartbeat-relation-locks en identificeert geen blockers. Verzamel één vaste, begrensde alleen-lezen catalogus/blockercontext zonder een historische oorzaak te veronderstellen.

## Ownership

Implementatieagent: uitsluitend `scripts/probe-data-api-resources.mjs` en `scripts/probe-data-api-resources.test.mjs`.
Root: dit prompt, `docs/deployment/s203-data-api-lock-diagnosis.md`, `TASK_LEDGER.md`.
Geen andere bronwijzigingen; geen dependencies/lockfile, nieuwe workflow, migratie, rol/grant, timeoutverruiming, workerpause, NOTIFY of arbitrary SQL-input. Huidige workflow-, credentials-, runtime- en tenantverificaties blijven gelden.

## Vereisten

- Vergelijk current_database OID5 en relation20982 alleen intern met een vaste lijst relevante repo-tabellen. Publiceer een allowlisted klasse, of expliciet onbekend/afwezig/onvergelijkbaar; nooit lokale OIDs als productieverklaring gebruiken.
- De aanvullende ochtendexport bevat concrete trage storage.objects-upserts en complete_published_data_refresh_v1-completions. Alleen deze tabelklasse en dit functietoken worden toegevoegd; geen vrije namen, extra loginrollen of vermoede relationmapping. Bestaande rolselectie is een expliciete scopegrens, geen databasebreed waiter-totaal.
- Meet huidige blockerrelaties met begrensd `pg_blocking_pids`. Publiceer uitsluitend vaste rollen, workload-/lockklassen, aantallen en completeness/unknown-indicatoren. Querytekst, PIDs, transactie-IDs, credentialwaarden en tenantinhoud blijven intern.
- Caps en ontbrekende zichtbaarheid, gemaskeerde activiteit, externe/ongeclassificeerde blockers en prepared-PID0 blijven UNKNOWN; geen ontbrekende observatie als nul of herstel presenteren. Dedupliceer parallel-blocker-PIDs. Tokenclassificatie is een hint, geen bewijzing van actieve functie of historische oorzaak.
- Eén vaste read-only metadataquery met bestaande deadline20s en outputcap64KiB; geen grote tenant/history scans. Bestaande baseline en bestaande catalogus/rolcontext behouden hun eigen beperkte betekenis.
- Sanitization blijft fail-closed op vorm, extra/onbekende vrije strings, vreemde aantallen/caps/visibility en ongeldige scope. Breid betekenisvolle regressies uit. Een geslaagde verzameling betekent geen website- of integratieacceptatie.

## Validatie en vervolg

Scoped Node-tests/ESLint, workspace lint/typecheck/test en bestaande workflowvalidatie. Geen UI/player/browser/dependencywijzigingen. Volledige bestaande PR-gates blijven intact. Commit/push/PR na groene lokale checks, normale merge na daadwerkelijke groene gates. De bestaande protected-main productieprobe wordt daarna eenmaal uitgevoerd met de werkelijk actieve runtime-SHA. De originele productie-uitrolfout en rollbackgrens blijven bewaard. Gebruik de nieuwe meting om een concrete herstelactie te bepalen; voer geen blinde herhaling van dezelfde uitrol uit.
