# S303 — Eén nieuwe gedeelde deploymentwachtrij

GitHub houdt pushrun42669988139/checksuite115569409941 voor bd5 vast vóór de
eerste Preflight-stap. De workflow-API noemt haar waiting; de officiële
concurrencygroepen-API noemt dezelfde run de in_progress-houder van
`deploy-veyocast-main`. Cancel en force-cancel geven409. De ene native
herstelworkflow eindigde met403; de gelogde fout onderscheidt GET/POST niet.
Supportticket4979898 werd op10november01:25UTC gesloten zonder herstel.

Dit blokkeert uitsluitend de oude Actions-groep. De staging- en productierunner
zijn online en vrij. Er zijn geen vereiste menselijke approvals meer; de
main-only branchpolicies blijven staan. De applicaties en migraties zijn nog
niet door de vastgelopen run gewijzigd.

## Begrensde overgang

Alle vijf bestaande writers krijgen samen de vaste groep
`deploy-veyocast-main-20261110`, met `cancel-in-progress:false`:

| Workflow | Bestaande mutatie |
|---|---|
| deploy.yml | Images, migraties, runtime en releasestatus |
| runner-disk-maintenance.yml | Uitsluitend de bestaande begrensde cacheprune |
| recover-data-api.yml | Bevestigde schema-cachemelding |
| probe-publication-runtime.yml | Workerstop/herstart uitsluitend bij quiesce |
| probe-runtime-database.yml | Workerstop/herstart uitsluitend bij quiesce |

Gewone read-only probes behouden hun eigen groep. Er komt geen vrije input,
groep per omgeving/run, extra credential of ruimere API-permission bij.
Alle bestaande jobbodies en releasegates blijven gelijk. De securityvalidator
bewaakt nu alle vijf groepsleden samen en verwerpt onbekende writers met een
deploymentgroep, afwijkende groepen, cancellation en joboverrides.

Een vaste andere groep is ondersteunde Actions-configuratie; dit is geen
gegarandeerde server-side reparatie of annulering van de oude lease.
[GitHub concurrencygroepen](https://docs.github.com/en/rest/actions/concurrency-groups)
maakt de werkelijke groepsbezetting zichtbaar; de API documenteert geen reset.

## Vereist bewijs vóór de merge

1. Vervangende run42722819525 is werkelijk completed/cancelled.
2. De volledige actuele oude groep heeft precies één lid: push42669988139,
   event push, vaste bd5-SHA, uitsluitend Preflight129343672973, nul stappen,
   geen runner. Geen oude rollback, onderhoud of quiesce is pending/actief.
3. De oorspronkelijke inline-autorisatie op bd5 is bytegelijk aan de huidige.
   Zij fetcht actuele main en wijst de oude normale SHA af vóór Node-setup en
   iedere aanroep van deploy-vps.sh. De bestaande omgevingsecrets en checkout
   worden daardoor niet voor build of runtimewijziging gebruikt.
4. Alleen TIXOCEO heeft actueel repositoryschrijfrecht. De gebruiker en root
   starten geen historische versies van de vijf workflows opnieuw. Herhaal
   deze inventarisatie direct vóór merge; een onbekend lid blokkeert cutover.

Een normale oude push kan spontaan ontwaken, maar komt met haar vaste oude
REQUESTED_RELEASE_SHA niet door de bestaande actuele-maincontrole. Deze
stelling geldt niet voor historische handmatige rollback-, inlineonderhouds-
of gepinde quiesceversies. Die mogen ook na de cutover niet worden herstart.
Een nieuwe hostlock zou die oude code niet achteraf beschermen. Dit is daarom
één gecontroleerde overgang met een vastgestelde legacyset, geen algemene
technische fence voor alle historische workflows.

## Validatie en werkelijke uitrol

De nieuwe pure policytests controleren de vijf groepsleden en negatieve
afwijkingen. Lokale Bash-cases gebruiken de echte inline-autorisatie, een
geïsoleerde tijdelijke output, een nepjobtoken en alleen gestubde git. Er is
geen netwerk- of providerverzoek. Normale CI en de bestaande deployment-
security-, Actionlint-, ShellCheck- en VPS-gates blijven vereist.

Lokale eindcontrole: de nieuwe policy/Bash-tests53/53 en bestaande
runner/nativeguards61/61 slagen zonder skips. De bestaande VPS-validatie
slaagt met234/234 tests. Alle27 workflows slagen met de bestaande gepinde
Actionlint/ShellCheck en deploymentsecurityvalidator. Workspace lint en
typecheck slagen ieder30/30 uit cache; test30/30 met29 cachehits. Gerichte
ESLint op de gewijzigde scripts slaagt. De eerste pnpm-autocheck stopte vóór
een modulesverwijdering; vervolgens zijn uitsluitend de bestaande ongewijzigde
dependencylinks lokaal met verify_deps_before_run=warn hergebruikt. De normale
CI blijft zelf frozen installeren. Lockfile en dependencybron zijn gelijk.

De read-only voorbereidingsaudit van10november bevestigt de enige oude
groepshouder en de werkelijk geannuleerde vervangende run. De originele
workflowblob is1380a6712a749cb85693b356227543f8970ccdc5; het bytegelijke
autorisatiestapblok heeft SHA256
d1f20581ac4447c54aeebe76441d687d317187a6a02311d764db1795ea2de40c.
Dit is voorbereidingsbewijs. Herhaal de actuele groeps-/run-/operatorcontrole
direct vóór de gewone merge en registreer daarna de echte deploymentstatus.

De applicatie-, Player-, Worker- en SQL-bron blijven gelijk aan de geteste
b623-boom. Historische product-/databasebewijzen behouden hun eigen SHA;
bronidentiteit is geen nieuw hosted of hardwarebewijs. De nieuwe gewone
main-deploy moet afzonderlijk alle vier immutable images, normale migraties,
health en smokes bewijzen, gevolgd door de reeds voorbereide stagingcanaries
en expliciete productiepromotie. De oude groepslease kan zichtbaar blijven;
die wordt niet als opgeruimd of geannuleerd voorgesteld.
