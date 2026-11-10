# S308 — Begrensde Next-buildcache bij immutable releases

Voer de bestaande opdracht tot staging- en productie-uitrol uit zonder
releasegates, immutable image-identiteit of bestaande publicaties te versoepelen.
Begin bij main `66b8aa7a3cfd6ec01085fd27a1e79ad1e01c398a` (P), tree
`3d896ae0b39967444fea8cf7b0a5319b34d8bbeb`.

Herhaalde normale builds voor N en P faalden door ENOSPC. Verwijder uitsluitend
de opnieuw opbouwbare `apps/{control,player,marketing}/.next/cache`: op de host
pas na alle geslaagde install/lint/typecheck/test/build-gates, in de Docker
web-builder direct na iedere geslaagde appbuild binnen dezelfde RUN.

Hostcleanup controleert opnieuw de checkout-SHA en valideert alle vaste paden,
directory-eigendom en symlinkvrije voorouders vóór de eerste verwijdering.
Bewaar `.next/standalone`, static, manifests, public, dependencies, overige
caches, logs, releasebestanden en immutable images. Log uitsluitend vaste
cachepaden, aantallen en gemeten vrije bytes vóór/na; stel geen nieuwe
capaciteitsdrempel in. Een fout stopt vóór Docker.

Ownership: integration_review bezit `scripts/deploy-vps.sh`,
`infra/production/Dockerfile`, gerichte bestaande lifecycle-tests en eigen
S308-prompt/doc/ledgerregel. database_matchday doet onafhankelijke read-only
review. Root beslist over commit/PR, alle normale CI, merge en deployment.

Bewijs echte oude-bron-RED/nieuwe-bron-GREEN via lokale stubs die de werkelijke
buildfunctie en Docker-RUN-keten uitvoeren. Test mislukte gates, gewijzigde
checkout, symlinks, verkeerde padtypen, ontbrekende caches, gedeeltelijke
immutable releases en behoud van runtimebestanden. Doorloop Bash-syntax,
bestaande deploy- en workflowsecuritygates. Geen zware lokale build/install of
hostedmutatie. Werkelijke ruimtewinst en toereikende hostedcapaciteit blijven
onbevestigd tot normale nieuwe buildobservaties.
