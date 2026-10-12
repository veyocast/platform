# S193: database-acquisitie afzonderlijk controleren

[S192 productionrun 38207014666](https://github.com/veyocast/platform/actions/runs/38207014666)
faalde vóór migraties: de normale migration-list-verbinding eindigde na circa
tien seconden. De vorige worker werd daadwerkelijk gestopt en daarna exact
herstart. Control en Player bleven gezond op `c3ef6b5`.

De vastgezette CLI 2.109.1 gebruikt native DNS en omvat een geauthenticeerde
eerste `SELECT 1` in zijn acquisitietimeout. URI `connect_timeout` is een
ondersteunde instelling. S193 gebruikt 45 seconden wanneer de URI en
`PGCONNECT_TIMEOUT` geen expliciet budget bevatten; geldige expliciete
waarden blijven leidend. Alleen dat ontbrekende argument wordt toegevoegd.
TLS-instellingen, credentials, overige URI-bytes, CLI-versie en
migration-historyguards wijzigen niet. Een langer budget is een begrensde
weerbaarheidsmaatregel en bewijst niet de oorzaak van de eerdere timeout.

De afzonderlijke beschermde `Probe runtime database`-workflow draait alleen
op main. De operator bevestigt omgeving, actuele runtime-SHA en tenant-ID.
Voordat credentials worden gebruikt, controleert de diagnose de publieke
Control- en Player-health op exact die runtime. Eén vaste SELECT met het
bevestigde tenant-ID test dezelfde CLI met expliciet 45 seconden budget.
Eén kleine Data API-GET controleert onafhankelijk exact die actieve tenant.
Beide paden hebben harde deadlines en begrensde responsegrootte.
De Linux-diagnose stopt de eigen CLI-procesgroep bij afbreken, inclusief
de onderliggende Supabaseclient. Een echte subprocess-regressie controleert
dit afzonderlijk van synthetische response-/scopetests. Er zijn geen
herhalingen of mutaties. Alleen vaste codes, looptijden en veilige
scope-/statusvelden worden opgeslagen; geen DSN, host, IP, key of gegevenspayload.

De oorspronkelijke native transportprobe heeft afzonderlijk strikte
certificaatverificatie, terwijl de CLI zijn eigen onveranderde SSL-policy
volgt. De waargenomen TLS_CERTIFICATE_FAILED is dus geen bewezen verklaring
voor de CLI-timeout. De officiële
[Supabase SSL-documentatie](https://supabase.com/docs/guides/platform/ssl-enforcement)
beschrijft eveneens de verschillende verificaties per SSL-mode.

Lokale tests gebruiken gecontroleerde adapters; de beschermde SQL/API-resultaten
en de volgende deployment worden afzonderlijk aan de PR toegevoegd. Fysieke
apparaatacceptatie en ontbrekende browser-IDB-input blijven de geregistreerde
S191-grenzen. Een stille change-driven LED-feed mag na een opgeslagen eerste
momentopname verbonden blijven zonder dat lastValidMessageAt bij iedere
leaseverlenging stijgt.

Finale lokale verificatie: 79/79 regressies groen (12 budget, 36 lifecycle,
11 transport, 20 runtimeprobe), plus scriptlint en workflow-/VPS-validators.
De projectbinding en echte wrapper-/descendantafbreking zijn afzonderlijk
getest. Niet-lopende zombies tellen als beëindigd; orphan reaping wordt niet
geclaimd. Onafhankelijke review vond geen resterende afbrekingsblokkade. Workspace
lint, typecheck en tests voltooiden elk 30/30; lint/typecheck gebruikten
volledig de bestaande cache, tests gebruikten 29/30 cachetaken. Dit is geen live databasebewijs. De finale
Foundation CI controleert deze commit afzonderlijk vóór merge.
