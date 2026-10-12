# S193 — Begrensde database-acquisitie en beschermde diagnose

Rond de expliciet geautoriseerde S191 staging/production-uitrol en echte
integratieverificatie af. S192 is gemerged als
`8b3e2e8c2cf6ae34626a95b4ccf3eba73f965a1d`; staging is groen.
Productionrun 38207014666 faalde opnieuw in migration list, vóór mutaties,
na circa tien seconden. De gevalideerde vorige worker is herstart.

De vastgezette CLI 2.109.1 gebruikt standaard native DNS. Zijn acquisitiebudget
omvat authenticatie en de eerste SELECT 1. De afzonderlijke strikte native
TLS-probe faalde; dit bewijst niet de oorzaak van de normale CLI-timeout.

Exclusieve ownership:

- Deploymentagent: scripts/database-cli-config.mjs en .test.mjs,
  scripts/migrate-supabase.sh, scripts/current-publication-maintenance.mjs,
  scripts/test-deployment-lifecycle.test.mjs, scripts/validate-vps-deployment.sh.
- Diagnoseagent: scripts/probe-runtime-database.mjs en .test.mjs.
- Root: .github/workflows/probe-runtime-database.yml, dit sprintpromptbestand,
  docs/deployment/s193-database-acquisition-recovery.md en TASK_LEDGER.md.

Gebruik dezelfde gelockte CLI, TLS en migration-historyguards. Geef ontbrekende
connect_timeout een begrensde standaard van 45 seconden; respecteer expliciete
URI-/environmentwaarden. Behoud alle overige URI-bytes. Configuratiefouten
tonen alleen vaste codes. De beschermde read-only diagnose controleert eerst
de bekende runtime-SHA en daarna één vaste tenantgebonden SQL-query en één
kleine Data API-query. Alleen deze diagnose test expliciet 45 seconden;
geen retries, providercommando's, migraties of database-/runtime-mutaties.
Secrets, DSN's, hosts/IP's, ruwe errors en gegevenspayloads blijven uit logs.

Gates: regressies voor budget/TLS-bytebehoud, afbreken/redactie/scope en
bestaande lifecycletests; lint/typecheck/test; VPS-, rollback- en
workflowvalidators. Source/UI/Player/database/dependencies blijven ongewijzigd.
Voer de beschermde diagnose uit voordat de volgende productiepoging wordt
beoordeeld. Pas daadwerkelijke authenticatie-/queryresultaten bewijzen de
bereikbaarheid; lokale mocks en een langere timeout bewijzen geen oorzaak.

Na geslaagde uitrol: echte LED-opslag/leasecontinuïteit, Sportlinkverversing,
twee gewone vijfminutencycli en behoud van configuratie-/release-ID's.
