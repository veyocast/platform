# Begrensde native heraanvraag van de vastgelopen deploycontrole

Vervolg op 10 november: de ene native hersteluitvoering werd met HTTP403
afgewezen; de gesaniteerde fout maakt de GET/POST-fase niet zichtbaar.
Supportticket4979898 werd wegens het supportrecht gesloten zonder de run
vrij te maken. De oorspronkelijke run is niet geannuleerd. De afzonderlijke
[S303-overgang](deployment/s303-deploy-concurrency-cutover.md) houdt alle vijf
muterende workflows gezamenlijk exclusief in een nieuwe vaste groep. De
onderstaande oorspronkelijke herstelpoging blijft als historisch bewijs staan.

Op 9 november bleef deployrun `42669988139` voor main-SHA
`bd5f1fb59254a4fd7d56e3a2974d82f39e0ef611` wachten vóór de eerste
Preflight-stap. De stagingomgeving heeft geen vereiste reviewers. De runner is
online; een afzonderlijke normale publicatiediagnose op dezelfde omgeving en
runner slaagde in run `42692652278`. De oorspronkelijke run blijft de gewone
deploy-concurrency bezetten.

GitHub weigert zowel normale als geforceerde annulering met HTTP409
(`Cannot cancel a workflow run that has not been queued yet.`), maar weigert
de native volledige herhaling met HTTP403 (`This workflow is already running`).
De gewone deploymentreview heeft geen bevoegde reviewers of eerder uitgevoerde
reviews; de gebruikersinterface bevat ook geen goedkeuringsknop. De gebruiker
heeft staging en productie al uitdrukkelijk geautoriseerd.

GitHub meldde op dezelfde avond een inmiddels verholpen Actions-/Checks-storing.
Dat is relevante context, geen bewezen interne oorzaak voor deze specifieke run.
Zie de [incidentmelding](https://www.githubstatus.com/incidents/tp8cghg7tlc4).

## Eén normale API-operatie met het passende credentialtype

GitHub documenteert een native
[rerequest van een bestaande checksuite](https://docs.github.com/en/rest/checks/suites#rerequest-a-check-suite).
Deze operatie vereist een GitHub App. De bestaande lokale verbinding is een
gebruikerstoken en is hiervoor afgewezen. GitHubs eigen
[`GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token)
is een tot deze repository beperkt App-installation token.

De afzonderlijke handmatige workflow vraagt met `checks: write` uitsluitend
de bestaande incidentcontrole opnieuw aan. Alle overige API-aanvragen zijn
read-only. Zij heeft geen omgevingssecrets, `actions: write`,
administratie- of deploymentrechten nodig. De workflow start uitsluitend vanaf
main en valideert eerst repository, oorspronkelijke run, SHA, checksuite,
eigenaar-app, leeftijd, nul uitgevoerde stappen en het ontbreken van een runner.
De oorspronkelijke SHA moet voorouder van de actuele vertrouwde main zijn.

Er wordt hoogstens één native POST uitgevoerd, zonder automatische retry.
De bestaande deployworkflow, actuele-main-controle, omgevingsregels,
deployment-concurrency en immutable-releasegates blijven gelijk. Een opnieuw
gestarte oude bd5-push moet na deze forwardwijziging bij zijn bestaande
actuele-main-controle stoppen. De normale nieuwe main-deployment blijft de
uiteindelijke geteste releasekandidaat.

## Bewijsgrens

HTTP201 betekent alleen dat GitHub de native heraanvraag heeft geaccepteerd.
Het bewijst geen hervatte Actions-run, vrijgekomen concurrency of deployment.
De Checks-API documenteert de reset naar queued; hervatting van deze specifieke
vastgelopen run is niet gegarandeerd. GitHubs bescherming tegen recursieve
workflows kan bovendien vervolgworkflowevents onderdrukken.

Na uitvoering worden de werkelijke run, attempt, stappen en normale vervolgrun
opnieuw gelezen. Staging, schermacceptatie en productie worden pas als geslaagd
gerapporteerd wanneer hun bestaande gates en concrete runtimebewijzen sluiten.
Bij blijvende blokkade blijft de door GitHub beschreven
[herstelgrens voor vastgelopen runs](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#canceling-workflows)
van toepassing. De workflow fabriceert geen status of geslaagde conclusie.

De nieuwe guards hebben lokale tests met uitsluitend nagebootste HTTP-antwoorden;
de normale Foundation-gate voert die tests en hun lint expliciet uit. De overige
toepasselijke CI-gates blijven volledig behouden. De nieuwe hoofd-SHA en het
daadwerkelijke resultaat van de heraanvraag worden afzonderlijk vastgelegd.

## Lokale verificatie vóór de PR

Alle 53 gerichte Node-tests zijn geslaagd, zonder skips. De tests omvatten
verkeerde repository/run/suite/App/SHA, gewijzigde main, een inmiddels gestarte
job, ongeldige en te grote antwoorden, redirects, vastgelopen transport en een
verloren POST-antwoord. De tweede volledige preflightcontrole vangt gewijzigde
uitvoering vlak vóór de aanvraag. De native API biedt geen atomische CAS;
deze controles worden daarom niet als een atomische fence gerapporteerd.

Scoped ESLint en de onafhankelijke review zijn geslaagd. Alle 27 workflows
slagen met dezelfde gepinde Actionlint- en ShellCheck-validatie; de bestaande
deploysecurity- en Royal-workflowguards zijn groen. De workspace-lint en
typecheck zijn ieder 30/30 groen vanuit geldige caches; de unittaken zijn 30/30
groen met 29 cachehits. Lokale dependencylinks gebruiken de ongewijzigde
lockfile en bestaande installaties; een eerste pnpm-autoinstallcheck stopte vóór
een modulesverwijdering en is uitsluitend lokaal naar waarschuwen gezet.
De normale CI installeert zelf met de bevroren lockfile.

Apps, pakketten, SQL, het normale deploybestand en dependencybestanden hebben
geen delta tegenover bd5. Geen hostedheraanvraag of deployment is uitgevoerd
voor deze lokale verificatie. Normale CI en het werkelijke App-resultaat volgen.
