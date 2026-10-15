# S222 — MP4-verwerking na geslaagde upload

De DartsPoint-MP4 is tweemaal volledig opgeslagen, maar FFmpeg is na 40 seconden
afgebroken. Herstel het verwerkingsbudget en de bijbehorende mediajoblease;
een gebruiker hoeft een geldige bron niet opnieuw te uploaden of te comprimeren
om een te korte servertimeout te omzeilen.

Ownership: video-normalisatie en mediajobrunner in `apps/media-worker/src/`,
bijbehorende workerregressies, de timeoutuitleg in de Control-mediabibliotheek,
gerichte lokale FFmpeg-bewijsrunner, media-pipelinecanon, prompt/docs/PLANS/ledger.
Geen schema-, workflow-, dependency-, lockfile- of Playerwijzigingen.

Behoud de grens van 500 MiB/vijf minuten, H.264/1080p30-output, inhoudscontrole,
checksums, private Storage, tenantpermissions, immutable releases en LKG.
Geef transcodes een eindig duurafhankelijk budget, behoud korte probes/remuxes,
voorkom herclaim tijdens normale verwerking en behoud begrensde foutafhandeling.
Bewijs verwerking voorbij de oude 40 seconden en geldige output met echte
FFmpeg; voer foundation en toepasselijke CI uit vóór commit/merge/uitrol.
Bestaande toestemming omvat commit, push, PR, merge en staging/production.
Een bestaande mislukte upload wordt via de normale geautoriseerde retry hersteld;
geen rechtstreekse ongeaudite statusherschrijving.
