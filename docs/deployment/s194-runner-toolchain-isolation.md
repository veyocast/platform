# S194: gedeelde pnpm-installatie voorkomen

De staging-build in run 38212253170 faalde met een processtartfout vóór
deployment. Tijdens die fout installeerde de productie-databaseprobe pnpm.
De private readbacks bevestigen exact hetzelfde installatiepad voor beide
runners. De vastgezette pnpm-action verwijdert haar installatiepad voordat
zij opnieuw installeert. Dit verklaart de ontbrekende toolchain tijdens de
gelijktijdige staging-tests; er is geen gefaalde applicatieassertion vastgesteld.

Self-hosted jobs krijgen daarom een eigen pnpm-pad onder runner.temp, met
run-ID, poging en job-ID. De gates en immutable releaseprocedure blijven
verplicht. De workflowvalidator bewaakt deze scheiding voor alle bestaande
self-hosted pnpm-actions, inclusief onderhouds- en pilotworkflows.

De databasefout staat hiervan afzonderlijk. De eerdere productieprobe gaf
SQL_CONNECT_FAILED na 11160 ms en REST_TIMEOUT na 10003 ms, zonder
SQLSTATE of HTTP-antwoord. De exacte CLI- en gelockte clientbron geven het
45-secondenbudget door. Een verbinding mag eerder falen; dit bewijst geen
genegeerde timeout. De gerichte vervolgdiagnose onderscheidt gatewaytransport
van de tenantquery en houdt alle gevoelige foutinhoud uit haar output.

De live uitrol en integratieverificatie worden na de werkelijke workflowruns
aan de PR toegevoegd. Hardware- en ontbrekende browser-IDB-beperkingen uit
S191 blijven afzonderlijk geregistreerd.

Lokale gates: 84/84 bestaande budget-/lifecycle-/transport-/probe-regressies
en 8/8 runner-isolatietests, zonder skips. De acht regressies controleren
gedeelde defaults, andere jobs, dynamische/multiline runners, verkeerde
stappen, compacte/quoted syntaxis en behoud van een actieve executable terwijl
de andere job haar eigen installatie verwijdert. Workflow- en VPS-validators,
gerichte scriptlint en diffcontrole zijn groen. Workspace lint en typecheck
halen ieder 30/30 uit de bestaande cache; tests 30/30 met 29 cached taken.
Apps en immutable Source zijn byte-identiek aan de volledig groene S193-gates.

De eerdere private buildlog heeft SHA-256
`42cd621b92b3d795b6b144e766026152d5d24a9037ddc91f460680e68236ba4a`.
De officiële gepinde installer verwijdert haar dest vóór installatie:
[pnpm/action-setup](https://github.com/pnpm/action-setup/blob/0ebf47130e4866e96fce0953f49152a61190b271/src/install-pnpm/run.ts#L25).
Dit is sterk oorzaakbewijs op basis van dezelfde paden en gelijktijdigheid;
er is geen syscall-trace uitgevoerd.
