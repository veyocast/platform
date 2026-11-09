# S300 — toegewezen Wedstrijddag zonder Overzichtrecht

Een geldige beperkte draaiboekdelegatie kon door SQL worden uitgelezen, maar de
echte `/dashboard/matchday`-route erfde daarnaast de dashboardlayout die
`tenant.overview.read` vereist. De bestaande Workbench-browserfixtures oefenden
deze bovenliggende Next-route niet. Een gewone Kijker heeft dit algemene recht
wel en bewijst daarom niet dat een uitsluitend toegewezen rol de pagina bereikt.

De afzonderlijke routegroep verplaatst alleen de Matchday-leaf met behoud van
haar publieke URL. De Shell vereist een aangemelde sessie; de bestaande
Matchday-service en SQL bepalen actieve tenant, featuretoegang en de exacte
objecten, doelen en geldigheidsduur van de delegatie. Het algemene dashboard en
de publicatiepreview houden hun bestaande capabilityguard. Een rol zonder
`tenant.media.read` vraagt geen globale uploadmetadata op.

Dit voegt geen capability, database-API, Playerprotocol of publicatie toe.
De normale aanmeld- en contextformulieren blijven bestaan. De beperkte rol
volgt daarna de expliciete link naar haar toegewezen draaiboek; dit bewijs
claimt geen nieuw automatisch deeplinkherstel door de algemene loginflow.

Gerichte tegenproef: vier van zes gevallen rood vóór de correctie, daarna
zes routegevallen en twaalf bestaande servicetests groen. Lint, typecheck en
volledige tests slagen elk30/30 met--force en nul cachehits. De echte
Next-productiebuild en beide auth-/clientbundleguards zijn groen. Het werkelijke
gecompileerde loaderTree bevat voor de leaf alleen App en Shell; de preview
behoudt daarnaast Dashboard. Zie [bronbinding en bewijs](implementation/s300-delegated-route/local-proof.json).

Normale exacte-head-CI en daadwerkelijke staging-Auth/delegatie: **nog open**.
Productie blijft afhankelijk van die gates en de hosted canaryacceptatie. Fysieke apparaat- en weekendpilotbewijzen
blijven apart van deze routecontrole.
