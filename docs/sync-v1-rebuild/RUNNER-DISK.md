# Runnercapaciteit bij de rebuild

De stagingbuild van `741505070e58ad52adf549f9d782afbd87310d44` stopte op
18 oktober 2026 vóór deployment: de bestaande runner kon zijn diagnosebestand
niet meer schrijven door een volle schijf. De vijf publieke healthroutes bleven
HTTP 200 op `6c837bbc`. Er is geen applicatierollback of databasereset uitgevoerd.

De bestaande SSH-route is `deploy@dg-deploy-vps-01` via Tailscale SSH. Directe
toegang vereist een geldige Tailscale-identiteitscheck. Sleutels, omgevingswaarden
en browserchecklinks horen niet in deze documentatie.

De afzonderlijke, handmatige workflow `runner-disk-maintenance.yml` gebruikt
de bestaande stagingrunner en dezelfde concurrencygroep als deployment. Zij
verandert geen bestaande workflow, runnerlabels, secrets of variabelen en heeft
geen checkout of dependency-installatie nodig. Alleen vertrouwde main mag haar
uitvoeren; host, gebruiker, runnernaam en Rootless Docker worden geverifieerd.
Iedere Dockercall is vastgezet op dezelfde lokale Unixsocket van `deploy`.
De expliciete `default`-builder moet driver `docker` en diezelfde endpoint
gebruiken; een geërfde remote context of geselecteerde builder wordt niet gebruikt.

Begin met `operation=inspect`. Leg de gemeten vrije ruimte, omvang van de
reclaimable buildcache en afwezigheid van actieve builds vast. Pas daarna kan
`operation=prune-unused-build-cache` uitsluitend ongebruikte Docker-buildcache
ouder dan 24 uur verwijderen. De image-, container- en volumesets moeten vóór
en na exact gelijk zijn. Er is geen image-, system- of volumeprune, geen
directoryverwijdering en geen toegang tot configuratiewaarden.

Inspectie `39157743040` vond 98% schijfgebruik, 3.09GB vrije ruimte,
13.5GB reclaimable buildcache en nul actieve buildprocessen. De daaropvolgende
24h-operatie `39158022971` slaagde met gelijk gebleven image/container/volumesets,
maar maakte slechts 24.86kB buildcache vrij en liet de schijf op 98%.
Dit is geen herstelde capaciteit. `until` betreft laatst gebruikt; gedeelde
imageblobs en niet geselecteerde cache kunnen het verschil mede verklaren.

Na deze vastgelegde inspectie bestaat één afzonderlijke handmatige keuze:
`prune-unused-build-cache-older-than-1h`. Zij gebruikt precies dezelfde
socket/builder/host/concurrencychecks en `buildx prune`, uitsluitend met de
vaste grens `until=1h`. Zij voegt geen `--all` of image/system/volumeprune toe.
Bevestig daarna opnieuw de werkelijk vrije ruimte en de beschermde sets;
het slagen van de workflow alleen bewijst geen voldoende capaciteit.

Een mislukte of onvoldoende opruiming geeft geen toestemming om ruimere paden
te verwijderen. Bewaar databases, uploads, signing, actieve images, benodigde
rollback-images en `/srv/apps/veyocast/releases`. Controleer na herstel de echte
ruimte en de toestand van eventuele onvolledige immutable images vóór een
normale nieuwe releasepoging. Bestaande immutable images worden nooit overschreven.
