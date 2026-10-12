# S194 — Afzonderlijke runner-toolchains en gerichte databasecontrole

Voltooi de al geautoriseerde S191 staging/production-uitrol. Basis is main
`0f20960c2d4eec429e682a4045e91f3d63475616`. Alle finale S193 PR- en
Sites-gates zijn groen. Stagingrun 38212253170 faalde vóór deployment:
Turbo kon een testproces niet starten (ENOENT) terwijl de productieprobe
pnpm installeerde. Beide runners gebruikten aantoonbaar dezelfde pnpm-map;
de vastgezette action verwijdert die map vóór installatie.

Productieprobe 38212340274 gaf SQL_CONNECT_FAILED na 11160 ms en
REST_TIMEOUT na 10003 ms. De CLI-bron en gelockte Effect-client geven het
45-secondenbudget correct door; de oorzaak van de eerdere fout is onbekend.
Een externe unauthenticated HTTP 401 bewijst geen databasebereikbaarheid.

Exclusieve ownership:

- Root: .github/workflows/deploy.yml, probe-runtime-database.yml,
  current-publication-maintenance.yml, fieldflow-royal-theme-reset.yml,
  menu-studio-pilot-rollout.yml, vector-v2-pilot-rollout.yml,
  retention-maintenance.yml; scripts/validate-deploy-workflow-security.mjs;
  dit promptbestand, docs/deployment/s194-runner-toolchain-isolation.md en
  TASK_LEDGER.md; scripts/runner-toolchain-policy.mjs en .test.mjs;
  .github/workflows/pr-gates.yml voor de verplichte nieuwe regressies.
- Diagnoseagent: scripts/probe-runtime-database.mjs en .test.mjs.
- Deploymentreviewer: uitsluitend lezen en reviewen; geen mutaties.

Elke pnpm-installatie op self-hosted runners krijgt een eigen pad onder
runner.temp met run-ID, poging en job-ID. Behoud gepinde versies, gates,
permissions, beschermde environments en immutable deploymentvolgorde.
Valideer dat geen self-hosted pnpm-action op de gedeelde default terugvalt.

De databaseprobe blijft main-only, project-/runtime-/tenantgebonden en
read-only. Voeg één begrensde unauthenticated Data API-gatewaycontrole toe
om transport van de bestaande authenticated tenantquery te onderscheiden.
Classificeer alleen expliciet bekende CLI-foutvormen met vaste veilige codes;
geen vrije messages, DSN's, hosts, credentials of providerpayloads in output.
Geen retries, TLS-versoepeling, clientinstallatie, endpointwissel of migratie.

Gates: gerichte regressies, workspace lint/typecheck/test, bestaande
lifecycle-/transporttests en workflow-/VPS-validators. Apps, Source, schema,
dependencies en lockfile blijven ongewijzigd. Na merge: stagingdeploy,
beschermde databasecontrole, productionpromotie en echte opgeslagen
LED/Sportlink-data met twee gewone vijfminutencycli en stabiele publicaties.
