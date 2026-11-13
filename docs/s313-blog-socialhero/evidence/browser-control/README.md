# Control-editor: browserbewijs

Dit is een expliciete browserfixture met de werkelijke Control-shell, componenten, tokens, CSS en TipTap-extensies. De platform-owner-sessie en HTTP-/mediatransporten zijn geïsoleerde testadapters. Dit bewijs doet geen uitspraak over echte login, MFA, RLS, databaseopslag of Storage-decodering. De API-/databaseketen wordt afzonderlijk getoetst.

De prototypevergelijking gebruikt alle drie aangeleverde artikelen met dezelfde tekst, datums, taxonomie, tags, hero- en deelbeelden. Alleen identiteit, media-URL en het contractmodel zijn gemapt. De baseline toont dezelfde ongewijzigde native shell zonder de toegevoegde bloglink; de systeemtekst binnen de shell is expliciete fixture-inhoud. Alle bron- en datasetfingerprints staan in `provenance.json`.

Het ongewijzigde prototype bleef met de geïnstalleerde TipTap-runtime op zijn initiële laadtoestand staan. Alleen de fixturecompiler voegt daarom aan het prototype een `onCreate`-metadata-transactie toe om `useEditorState` na `immediatelyRender: false` te notificeren. Dit verandert geen document, opmaak of referentiebestand. De kandidaat gebruikt zijn werkelijke, ongewijzigde mountpad.

De inhoudscaptures en axe-controle na scrollen vonden twee contrastfouten: een teksttoken werd als toolbarachtergrond gebruikt en oranje inline links haalden 3,08:1 op wit. De kandidaat gebruikt nu het bestaande gedempte oppervlaktetoken voor de toolbar en het bestaande inktoken voor onderstreepte links en actieve editoracties. Deze benoemde toegankelijkheidscorrecties verklaren het kleurverschil met het prototype.

Uitgevoerd vanuit de VeyoCast-worktree:

```bash
PLAYWRIGHT_EXTERNAL_SERVERS=1 \
S313_BROWSER_EXECUTABLE=/home/codex/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell \
node node_modules/@playwright/test/cli.js test tests/e2e/blog-editor.spec.ts --project=chromium --workers=1

node node_modules/eslint/bin/eslint.js tests/helpers/s313-blog-control-fixture.ts tests/e2e/blog-editor.spec.ts --max-warnings=0

node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --strict --target ES2023 --moduleResolution bundler --module ESNext --jsx react-jsx --esModuleInterop --types node tests/helpers/s313-blog-control-fixture.ts tests/e2e/blog-editor.spec.ts

git diff --check
```

Uitkomst: 4/4 browsertests groen, scoped lint en TypeScript groen, diffcheck groen. Er zijn 24 PNG-captures en acht JSON-rapporten. Op 1440, 390 en 320 px is er geen horizontale documentoverflow. De vier axe-rapporten bevatten geen overtredingen voor WCAG 2 A/AA en 2.1 AA.

Getoetst: behoud van bestaande shellnavigatie, dezelfde artikeltekst als het prototype, echte invoer van koppen/lijsten/taken/citaat/tabel, tabelbewerkingen, upload via de fixture, undo/redo, schema-gevalideerd opslaan en heropenen met gelijk JSON en HTML, alleen-lezen renderen, veilige en schadelijke HTML-paste door de echte TipTap-parser, afwijzen van een onveilig linkadres, tabfocus binnen een dialoog, Escape/focusherstel, slashmenu en de leesrechtenweergave.

Vroege runs stopten op fixturebundeling/mediapaden en de prototype-mountcompatibiliteit; latere inhoudscontroles vonden en verholpen de hierboven genoemde contrastfouten. Een renderassertie gebruikt documenttekst in plaats van CSS-getransformeerde hoofdletters in tabelkoppen. De finale resultaten overschrijven eerdere captures. Handmatige schermlezeracceptatie en een echte geauthenticeerde redactiesessie blijven afzonderlijke controles.
