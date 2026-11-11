# S311 — Gerichte Worker-runtime na herhaalde staging-ENOSPC

De gebruiker autoriseert op 11 november 2026 expliciet het gericht verkleinen
van `infra/production/Dockerfile` naar de benodigde Worker-runtime, met behoud
van fonts/assets, Chromium, FFmpeg, publicatiegedrag en volledige controles.
De bestaande deployworkflows, omgevingen, secrets, immutable guards en vorige
werkende release blijven onaangetast.

De gebruiker breidt op 11 november de toestemming expliciet uit naar de volledige
staging-/productieuitrol, snellere deployments en voldoende blijvende capaciteit.
Root bezit aanvullend de PR-workflow en gerichte CI-fixture-/pogingregressies,
deployment-capaciteitscontrole met tests en operationeel onderhoud uitsluitend
voor VeyoCast. Andere projecten/volumes, actieve/rollbackreleases en secrets
blijven beschermd. Verlaag geen dekking, renderdeadlines of releaseguards.
De oorspronkelijke v9-videofixture faalde in één van vier identieke builds;
deel daarom één volledig werkelijk gerenderde, bron/run/poginggebonden set.
Bewaar alle oude foutbewijzen; artifactnamen en downloads scheiden pogingen.

Begin vanaf main `56a41544deac1b8f7c1b9c3cc2ce287e770b5c0e`. PR339 bevat de
volledig geteste menu-/playlist-/RSS-hotfix; PR340 de bewezen Player-CI-versnelling.
Beide nieuwe main-SHA's hebben door schijfgebrek slechts gedeeltelijke images;
die worden nooit overschreven of als complete release geactiveerd.

Ownership: root bezit de Dockerfile, een runtimepackager met regressies,
echte container-smokerunner, één aanvullende Foundation-teststap, eigen prompt,
doc, plan en ledger. Geen app-, database-, dependency-/lockfilewijziging of
deployworkflowwijziging. De afzonderlijk gevraagde SSH-subagent schrijft alleen
publieke lokale bootstrapartifacts, niet in de repository of op de VPS.

Gebruik uitsluitend de reeds met frozen lockfile geïnstalleerde dependencygraph.
Geen nieuwe registryresolutie of ongepinde installatie. Bewaar de bestaande
Worker-entrypointpaden, runtime-TS-loader, eigen en transitieve pakketbronnen,
native/optionele platformmodules, peerbindings en alle geverifieerde Player-
renderassets. Alleen vereiste runtimecode wordt naar de uiteindelijke image
gekopieerd; web-/mobiele apps en testtooling horen daar niet thuis.

Bewijs isolatie zonder toegang tot de broncheckout, bytebehoud van assets,
volledige startupimports, echte esbuild-browserbundle, SVG/PNG/native fonts,
H.264/ffprobe, drie RSS-ontwerpen in beide oriëntaties en een 16-productenmenu.
De daadwerkelijke nieuwe Dockerimage moet in normale CI slagen vóór merge.
Lokaal beschikbare tooling is geen bewijs van een gebouwde hostedimage.
Voer alle normale gates uit, daarna de bestaande staging-/productieflow met
exact dezelfde complete image-digests. Publiceer geen concepten of oude tags
om een releaseguard te omzeilen.
