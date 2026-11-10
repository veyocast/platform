# S308 — Next-buildcache uit de overlappende releasebouw verwijderen

De normale stagingbuilds voor N en P liepen vast op ENOSPC. P-run
`42812738663` meldde dit op 10 november 2026 om 12:22:30 UTC; de gesloten
joblogs waren niet opvraagbaar. De exacte laatste Dockerfase bleef daardoor
onbekend. De afzonderlijke geslaagde
inspectie `42815631838` zag 1.391.489.024 vrije bytes, nul actieve builds en
recente BuildKit-cache die nog niet voor het bestaande onderhoud in aanmerking
kwam. De daaropvolgende geautoriseerde read-only SSH-inventaris van Root
(12:38 UTC; `s337-P-artifacts-and-directory-bytes-actual-1238.json`, SHA-256
`d131435efce2e2cbfe87efa10e222bf8b59350fa6a656e46ed8b8611e3b0ae14`)
bevestigde drie P-tags voor Control/Player/Marketing, ontbrekende Workerimage
en ontbrekende definitieve release-metadata/sleutelvingerafdruk. P is dus
onvolledig en blijft door de normale immutable guard geweigerd. Deze images
worden niet verwijderd of overschreven. Dit bewijst schijfdruk; de precieze
bijdrage van Next-cache is niet gemeten.

Een tweede read-only meting om 12:40:57 UTC zag in de mislukte P-checkout
941.817.856 bytes Control-cache, 255.242.240 bytes Player-cache en 229.527.552
bytes Marketing-cache: samen 1.426.587.648 toegewezen bytes volgens `du`
(`s308-actual-failed-P-host-next-cache-bytes-1240.json`, SHA-256
`b1ffcc2eceb2811a1ef40546f572af75d27f3979d0d4b7e6f9945777ad4a5621`).
Dit is een werkelijk bestaande verwijderbare hostvoetafdruk, geen gemeten
vrijgekomen ruimte, Docker-cachebesparing of benodigde bouwpiek. De bijdrage
aan de eerdere ENOSPC en toereikendheid na verwijdering blijven onbevestigd.

Na alle bestaande hostgates verwijdert `build-release` uitsluitend de drie
eigen `apps/{control,player,marketing}/.next/cache`-directories. Eerst worden
de release-SHA opnieuw gecontroleerd en alle vaste paden gevalideerd op
canonieke checkout, directorytype, eigen UID en symlinkvrije voorouders.
Een ontbrekend cachepad is een no-op; een afwijkend bestaand pad stopt vóór
verwijdering van andere caches of Docker. Een symlink binnen de cache wordt
verwijderd zonder het doel te volgen. Het checkoutpad staat onder de bestaande
geserialiseerde deploymentworkflow; dit is geen algemene verdediging tegen een
gelijktijdig kwaadwillend proces dat directories verwisselt.

De begrensde JSON-regel `next_build_cache_cleanup` geeft de vaste relatieve
paden, het aantal verwijderde cachedirectories en met `statfs` gemeten vrije
bytes vóór/na. Het verschil is een filesystemobservatie waar ook andere
processen invloed op kunnen hebben, geen exclusieve cache- of piekwinstclaim.

De Docker web-builder verwijdert iedere appcache binnen dezelfde RUN, direct
na de eigen succesvolle `pnpm --filter … build`. Die packagecommando's houden
hun bestaande auth-, clientsecret- en LG-bundelchecks. `&&` bewaart falen en
voorkomt de volgende appbuild. Dezelfde laag bevat de build en verwijdering,
zodat de uiteindelijke web-builderlaag die caches niet bewaart. Host `.next`
was al door `.dockerignore` uitgesloten; het probleem is overlappende bestanden
op dezelfde schijf, niet een onterecht vergrote Dockercontext.

Standalone, static, manifests, public en de runtime-COPY-regels blijven gelijk.
Dependencies, Worker, app/SQL-bron, releases, image-tags, metadata, huidige en
vorige images, onderhoud, concurrency en workflowgates worden niet gewijzigd.
Een bestaande onvolledige immutable release blijft onoverschrijfbaar.

Dezelfde 19 gerichte lokale tests tegen de echte P-productbron geven 12 rood en
7 groen; de kandidaat geeft 19 groen. De tests voeren de echte buildfunctie en
Docker-`&&`-keten uit met lokale pnpm/git/docker-stubs; zij starten geen appbuild,
container, database of netwerkverzoek. Volledige lifecycle-suite: 63/63 groen.
De gerichte tests bewaken alle gates, checkoutwijziging, padtypen, symlinks,
lege caches, immutable-partialweigering en blijvende runtimebestanden.
Onafhankelijke read-only bronreview vond geen concrete blocker; dezelfde
lifecycle-suite gaf onafhankelijk 63/63 groen zonder skips of cancelled cases.

Bash-syntax, directe ShellCheck en scoped ESLint zijn groen. De bestaande
VPS-validator geeft 253/253 groen, de concurrency-policy 53/53 en alle 27
workflows slagen met de bestaande gepinde Actionlint plus ShellCheck; ook de
deploysecurity- en Royal-workflowguards slagen. De eerste VPS-poging stopte bij
pnpm's automatische dependencycontrole vóór uitvoering. Bij expliciete lokale
dependencyreuse had een volgende poging één ongewijzigde 8s-deadlinetest die
door lokale looptijd uitliep (252 groen, één cancelled); die case slaagde apart
in 484ms en de ongewijzigde volledige validator daarna in 20,49s zonder
cancelled of overgeslagen cases. Geen timeout of testassertie is versoepeld.

Lokale dependencies worden hergebruikt met
`pnpm_config_verify_deps_before_run=warn`; dit is geen schone installatie,
volledige workspace-lint/typecheck/test of appbuild. Normale toepasselijke
CI blijft verplicht. Werkelijke hostedruimtewinst, benodigde piekcapaciteit en
een geslaagde nieuwe staging-/productie-uitrol blijven afzonderlijke open gates.
De wijziging verlaagt overlap na voltooide builds; zij begrenst niet de eigen
piek van één appbuild en garandeert niet dat de huidige vrije ruimte voldoende is.
