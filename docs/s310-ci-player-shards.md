# S310 — Player-CI paralleliseren zonder tests weg te laten

## Oorzaak en nulmeting

De groene S309-run `42975558259` kostte voor Player **1u33m52s**. Alle 536
oorspronkelijke cases uit 67 specs werden serieel uitgevoerd. Iedere case
startte vanwege de bewezen S202-Chromiumcrashes bewust een eigen Playwright-
CLI, Next-server en browser. Die noodzakelijke isolatie vermenigvuldigt de
opstartkosten; ook de echte appbuild en gallery-/videofixtures kosten tijd.
De eerdere groene main-run kostte 1u37m10s. Een eerdere mislukte S309-run was
na ruim 103 minuten pas bij case 464; uitsluitend een grotere jobdeadline
herstelt die architecturale wachttijd niet.

## Wijziging en garanties

Vier zelfstandige hosted runners voeren deterministisch elk een vierde van
de originele inventory uit: globale positie modulo vier. Binnen iedere shard
blijft de oorspronkelijke relatieve volgorde behouden. Bij 536 cases zijn dat
134 cases per shard. Er is geen vast caseaantal ingebouwd; toekomstige cases
worden gewoon ontdekt. Iedere case houdt haar eigen verse CLI/server/browser,
workers=1, retry=0 en ongewijzigde testbudgetten/fixtures/assertions.

De gebruiker heeft de Player-jobgrens 105→135 minuten expliciet toegestaan.
Deze grens is alleen een veiligheidsmaximum, geen gewenste duur. Control
houdt 60 minuten en de andere groepen 45. Deployworkflows, environments,
secrets, app-/databasecode en dependencies zijn ongewijzigd.

Alle shards bewaren de volledige inventory plus hun eigen daadwerkelijke
uitvoeringen. Een kleine afzonderlijke closure-artifact voorkomt dat de
eindcontrole grote browser-/videobestanden moet downloaden. De vereiste check
`Browser gates (player)` wordt pas groen na succesvolle browserjobs én een
controle op dezelfde source-SHA/run/poging/CLI/specset/inventory, alle vier
shards en iedere oorspronkelijke case precies eenmaal met geldig resultaat.
Ontbrekend, dubbel, verouderd, geannuleerd, gedeeltelijk of mislukt bewijs
wordt niet als succes behandeld. Bestaande expliciete runtime-skips en
verwachte failures houden hun oorspronkelijke Playwright-betekenis.

Zonder shardinstellingen blijft de lokale runner de volledige originele
sequentiële suite uitvoeren. Andere applicatiegroepen houden hun gedrag.

## Verificatie

De 32 gerichte runnerregressies zijn lokaal groen, inclusief alle oorspronkelijke
20 regressies en de echte aggregatie-CLI met positieve/ontbrekende artifacts.
Partitionering bewaakt 1/3/5/536/539/2001 cases; foutproeven bewaken bronmix,
run/pogingmix, verkeerd CLI, ontbrekende/dubbele/extra shards, incorrecte
selecties/inventories en onvoltooide/gecrashte/herhaalde uitvoeringen.

Ook vijf oorspronkelijke welkom-browsercases zijn echt uitgevoerd, verdeeld
over vier shards, met vijf verse CLI/server/browserprocessen en een groene
gecombineerde closure; geen skips of retries. Alle 61 bestaande toolchain- en
concurrencypolicyproeven en 13 inventory-/referentieregressies zijn groen:
samen 106 Node-regressies. ESLint, alle 27 gepinde Actionlint/ShellCheck-
workflowchecks, deploymentsecurity en Royal-workflowguard zijn groen.
De eerste lokale inventorypoging kon de door sparse checkout weggelaten
originele CSV niet lezen; na herstel van exact de twee getrackte CSV's slagen
alle 13 tests ongewijzigd. De bestaande dependencies zijn lokaal hergebruikt;
een schone installatie en volledige workspacegates blijven hosted vereist.

Werkelijke hostedtijden worden aan de PR toegevoegd.
Een verwachte Playerlooptijd van circa 30–40 minuten en daardoor ongeveer
60% minder totale wachttijd is vóór hostedverificatie uitsluitend een raming.
Control en de onafhankelijke referentiegates kostten bij S309 al circa 37–39
minuten en blijven dus een ondergrens; dit is geen belofte van viermaal
snellere totale deployments. De immutable appreleasebouw en expliciete
productiepromotie blijven de bestaande volledige controles uitvoeren.
