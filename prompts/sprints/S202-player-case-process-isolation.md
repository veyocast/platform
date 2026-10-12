# S202: eigen browserproces per Player-test

De oorspronkelijke S201 PR-gate38312145852 blijft FAILURE. Alle90 specs en50
batches zijn uitgevoerd:555PASS,579 bestaandeSKIP,1 native Chromiumcrash.
In de derde welkomcase sloot `browser.newContext` vóór de pagefixture en
testbody met SIGSEGV/SEGV_MAPERR0x1b0. Vergelijkbare crashes op dezelfde
native offsets kwamen voor in eerdere runs en andere specs. De oorzakelijke
Chromiumfunctie is niet bewezen. Een proces per spec voorkomt niet dat de
cases binnen die spec hetzelfde browserproces delen.

Werk vanaf main015b8bffb0624ea8b053c94e08348f5f6f770f11 in een eigen worktree.
Lees de repositorycanons volgens AGENTS.md; de canons zijn ongewijzigd ten
opzichte van S201. Writerownership: uitsluitend
`scripts/run-browser-gates.mjs` en `scripts/run-browser-gates.test.mjs`.
Root bezit `.github/workflows/pr-gates.yml`, dit promptbestand,
`docs/deployment/s202-player-case-process-isolation.md` en `TASK_LEDGER.md`.
Geen andere bestanden of dependency/lockfilewijzigingen.

Laat iedere ontdekte Player-case één keer in een nieuw CLI/browserproces
draaien. Gebruik de gepinde Playwright1.61.1-selectiesemantiek en bewijs vóór
uitvoering dat iedere selectie precies één oorspronkelijke case aanduidt en
dat alle originele cases behouden blijven, in dezelfde volgorde. Bij de
oorspronkelijke S201-scope waren dat253 cases in47 specs; de implementatie
moet toekomstige geldige toevoegingen ontdekken in plaats van die aantallen
als een limiet te hardcoden. Ambigue prefixes, delimiters en duplicaten mogen
geen onbedoelde dubbele of ontbrekende uitvoering veroorzaken.

Behoud de bestaande Chromiumbinary, screenshots, assertions, workers,
budgets, hooks en bestaande expliciete skips. Geen crashretry. Een mislukte
fixture, selectie, process of assertion blijft fataal. Andere groepen
behouden hun bestaande gedrag. Registreer de volledige inventory en iedere
daadwerkelijke case-uitvoering zodat de CI-closure afzonderlijk te toetsen is.

Voer zinvolle runnerregressies en de oorspronkelijke vijf welkomcases uit
met de nieuwe isolatie. Root beoordeelt de selectie tegen de daadwerkelijke
gepinde CLI en bewaart de oorspronkelijke rode run. Daarna workspacegates en
de volledige exacte CI. Geen commit/push door subagents. Applicatie-uitrol
wacht op geslaagde vereiste gates; een lokale vijfcaserun vervangt die niet.

De productiestoring staat afzonderlijk: S201-context38314503543 bevestigde
SQL_READY3347ms en REST_TIMEOUT10002ms, zonder huidige heartbeatlocks of
indexprogress. Een latere openbare anon/RLS-lezing antwoorddeHTTP2005050ms;
server-side/authed beschikbaarheid is nog niet bewezen. Deze taak verandert
geen provider-, database-, migratie-, release- of authoringdata en claimt
geen herstel van die storing.
