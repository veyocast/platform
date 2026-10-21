# S253 — officiële LG CLI-patchguard

Root GO: aparte sparse worktree `/home/codex/repos/castivo-s253`, branch `veyocast/s253-lg-cli-patch-guard`, basis exact `aeebeac292f2ac9d9db4dc531cf334e556b67cda`. Eén workflowwriter. Reeds gelezen identieke canons blijven leidend; actuele ledgerdelta gelezen en governancehashes vastgelegd. Sparse≤20MiB; vóór iedere checkout/mutatie≥100MiB reserve; geen install.

Exacte ownership:

- `.github/workflows/lg-webos-signage-ipk.yml`
- `apps/lg-webos-signage/scripts/assert-official-packager.mjs`
- `apps/lg-webos-signage/scripts/package-workflow.test.mjs`
- `docs/s253-lg-cli-patch-guard.md`
- dit sprintprompt
- uitsluitend eigen S253-paragraaf in `TASK_LEDGER.md`

Bewaar eerste failed run/head/checkout/joblog en beide oude globale guards. Vervang uitsluitend het algemene verbod op elke patch door één gedeelde guard die de officiële pinned webOS CLI beschermt en de bestaande Next-patch behoudt. Geen product-, toolchain-, dependency-, versie- of lockfilewijziging. Alle werkelijke checks, acties/digests en deadlines behouden.

Meaningful Nodechecks: echte Next-only workspace+lock positief; quoted/versioned CLI-patches in beide registries negatief; malformed/duplicate/unsupported fail-closed. Root/peerreview vond escaped YAML-rootheader: behoud eerste kandidaat, bewijs de nieuwe regressie rood, decodeer generieke gequote rootsleutels en selectors en weiger rootmerge/explicit-keyconstructies en een ingesprongen documentroot (afzonderlijk6/7 rood bewezen). Finale7/7 PASS en echte guardCLI exit0; geen algemene YAML-parserclaim.

Geen browser, install, build of workflowrerun. Reviewbare patch/testexits/freeze vóór aparte rootcommit-GO. Root bezit normale integratie, finale fullworkspacegates en hosted CI-acceptatie; feature-CI is geen finale PASS.
