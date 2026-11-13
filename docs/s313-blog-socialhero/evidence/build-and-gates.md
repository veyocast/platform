# Finale lokale build- en testgates

Deze checks gebruiken de geïsoleerde S313-worktree. De repositorybasis is
`4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`; de definitieve kandidaat wordt als
PR-commit opgeleverd. Runtimecredentials staan uitsluitend in het private
adapterconfigbestand. Geen buildoutput of dependencylink wordt gecommit.

```bash
export COREPACK_HOME=/dev/shm/s313-corepack
export pnpm_config_verify_deps_before_run=warn
pnpm lint --concurrency=1 --output-logs=errors-only
pnpm typecheck --concurrency=1 --output-logs=errors-only
pnpm test --concurrency=1 --output-logs=errors-only
pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
```

Uitkomsten: alle drie brede gates32/32 succesvol. Laatste lint10,304s
(30 gecachet), typecheck29,364s (30 gecachet), test18,725s (29 gecachet).
Frozen-lockfilevalidatie is groen; alleen de benodigde blogdependencies en
importers zijn toegevoegd. De reeds aanwezige Sharp0.34.5 is ook direct bij
Marketing gedeclareerd zodat Next zijn native external vanuit de app kan
resolven. De eerste echte mediarequest vond deze ontbrekende declaratie; na
correctie slagen echte uploads en de productiebuild.

```bash
NEXT_TELEMETRY_DISABLED=1 VEYOCAST_QA_OUTPUT=1 \
NODE_OPTIONS=--max-old-space-size=3072 \
pnpm --filter @veyocast/control build

pnpm --filter @veyocast/marketing build
bash scripts/validate-vps-deployment.sh
```

Beide definitieve builds zijn groen, inclusief de scripts die browserbundels op
secrets controleren. Control bevestigt bovendien dat beveiligde routes dynamisch
zijn. Marketing is gebouwd met de zes runtimevelden uit de private
adapterconfig, via een Node-childprocess en zonder waarden naar stdout te
schrijven. De exacte mapping staat in `integration/README.md`. Daarna startte
een nieuw Next-proces met `next start --port 9313 --hostname 127.0.0.1` en dezelfde
private mapping. Vier publicaties, echte SocialHero-verifier, sitemap,
hoofdletter-UUID-media en ongeldige multipart422 zijn opnieuw geslaagd; zie
`integration/production-build-smoke.json`.

De buildoutputs stonden in eigen tmpfs-mappen, via de bestaande `.next` en
Control `.next-qa`-paden. Alleen de regenerabele Webpack-cache van deze taak is
na compilatie verwijderd om ruimte voor tracering vrij te houden. De eerste
Marketing-build miste zeven bestaande screenshotimports door sparse checkout.
Die bestanden zijn bytegelijk uit `HEAD` gematerialiseerd en tegen hun originele
Git-objecthash gecontroleerd; geen afbeelding of import is gewijzigd. De
herhaalde build is groen. Bestaande Autoprefixer-waarschuwingen blijven zichtbaar.
De deployvalidatie slaagt met onder meer254 bestaande proeven; zij voert geen
deployment uit.

```bash
PLAYWRIGHT_EXTERNAL_SERVERS=1 \
S313_BROWSER_EXECUTABLE=/home/codex/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell \
pnpm test:e2e tests/e2e/blog-editor.spec.ts tests/e2e/blog-publication.spec.ts \
  --project=chromium --workers=1 \
  --grep-invert 'checks the real isolated Next|captures the actual published'
```

9/9 finale componentfixturecases groen in26,7s. De twee werkelijke Next-cases
zijn in dit herhaalde fixturecommando bewust niet geselecteerd; hun eerdere
afzonderlijke uitvoering en echte publicatiebewijs staan in `browser/README.md`.
De oorspronkelijke editorbrowserflow heeft4/4 cases en de afzonderlijke
gepubliceerde-runtimeproef heeft1/1 case groen.

De bestaande Marketing-a11yselectie heeft3/3 groen. De bestaande Control-shell
heeft26 unieke cases groen na infrastructuurherstel:10 in de brede run,15 in de
eerste herhaling en1 in de laatste herhaling. De tijdelijke configs importeren
de oorspronkelijke Playwright-config, kiezen een absoluut testDir/testMatch en
de aanwezige Chromium1254. De exacte commando's waren:

```bash
PLAYWRIGHT_APPS=marketing PLAYWRIGHT_EXTERNAL_SERVERS=1 MARKETING_PORT=9313 \
pnpm test:a11y --config /tmp/s313-marketing-a11y.config.ts --project=chromium

PLAYWRIGHT_APPS=control PLAYWRIGHT_EXTERNAL_SERVERS=1 CONTROL_PORT=9314 \
pnpm test:a11y --config /tmp/s313-control-a11y.config.ts --project=chromium

PLAYWRIGHT_APPS=control PLAYWRIGHT_EXTERNAL_SERVERS=1 CONTROL_PORT=9314 \
pnpm test:a11y --config /tmp/s313-control-a11y.config.ts --project=chromium \
  --grep-invert 'keyboard and landmark basics|fixed Sync tenant navigation|control shell reflows|mobile navigation never mixes|all Control overview routes'

PLAYWRIGHT_APPS=control PLAYWRIGHT_EXTERNAL_SERVERS=1 CONTROL_PORT=9314 \
pnpm test:a11y --config /tmp/s313-control-a11y.config.ts --project=chromium \
  --grep 'settings and theme routes' --timeout=60000
```

De eerste Control-doelkeuze was een productiebuild zonder testsessie; die gaf
terecht loginredirects. De suite verwacht de bestaande developmentdemo. De
developmentserver bereikte daarna zijn standaard heaplimiet na tien geslaagde
cases; zestien daaropvolgende cases werden door de serveruitval geraakt.
Herstart met `NODE_OPTIONS=--max-old-space-size=6144 next dev --port 9314
--hostname 127.0.0.1` leverde15/16 groen. Alleen de koude themacase overschreed
de lokale30s tijdens axe. De ongewijzigde warme case slaagde in6,3s met de
bestaande CI-timeout van60s. Geen testassertie is aangepast.

De volledige andere Control-/Player-browserinventaris en externe Auth-/Storage-
acceptatie zijn niet als uitgevoerd geclaimd. Database-, HTTP- en workerproeven
hebben hun eigen exacte commandoregels en resultaten in de bijbehorende dossiers.
