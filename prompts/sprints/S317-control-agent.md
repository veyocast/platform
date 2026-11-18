# S317 — Control-agent en platformconfiguratie

Opdracht: de op 18 november aangeleverde prompt uitvoeren, testen en via de
bestaande releaseprocedure naar staging en productie promoveren. Actuele main
is vooraf via ls-remote bevestigd: 67d8470198acec4272c47c4c7979b6071a915c4b.
Deze eigen worktree/branch volgt S315/PR344 en de afzonderlijke S316-themafix.
Hun volledige gates blijven verplicht. Eén rootwriter, geen subagents.

## Ownership vóór implementatie

- Control Studio: gedeelde expliciete mediabibliotheekpicker, Sites-design-
  controls, Sync-create-wizard en Sync-Studio-frame; betrokken browser-/unittests.
- Nieuwe Control-agent onder lib/agent, dashboard/agent en api/agent; bestaande
  media/upload- en domeinservices uitsluitend gericht hergebruiken/extraheren.
- Platform Integraties/OpenAI, tenant featurecatalogus en bestaande navigatie/
  shellkoppeling; één additieve forwardmigration en eigen SQL-tests.
- Eigen analyse-/acceptatiedocument, deze prompt, PLANS.md en TASK_LEDGER.md.
- Bestaande SQL-featurecatalogusproef telt de expliciete nieuwe flag mee;
  oorspronkelijke rollout-, AAL2-, conflict-, audit- en retryasserties blijven.
- De verplichte tijdelijke-bijlagenlifecycle omvat ook één eigen begrensde
  media-workeropruimrunner, zijn bestaande lifecyclekoppeling en regressies.
  Alleen nieuwe onbewaarde AI-bijlagen zijn kandidaten; leases, actuele FK-/JSON-
  referentiecontrole, exact tenantpad, Storage-first en idempotente afronding
  beschermen gewone Media, immutable releases en LKG. Geen nieuwe providerjob.

Geen nieuwe dependencies, lockfile-, deploymentworkflow-, Player-, renderer-,
merkasset- of serviceworkerwijzigingen. Productiegegevens en sleutels worden
niet in Git/logs/chat opgenomen. Gebruiker kiest expliciet een bestaande
OpenAI-projectsleutel via het beveiligde platformformulier; geen lokale key.

## Verplichte grenzen

Thema's zijn expliciete geregistreerde stijlen, nooit uploads. Openen/annuleren
van Media verandert niets; selectie wijzigt alleen de betrokken slideachtergrond.
Historische concepten/releases en bewuste fotoverwijzingen blijven gelijk.
Geen datacorrectie zonder aangetoonde foutieve classificatie.

Agent standaard uit, tenant-/user-/capabilitygebonden, server-side afgedwongen
bij iedere provideroproep, goedkeuring en schrijfstap. Alleen door de gebruiker
goedgekeurde immutable voorstelversie kan muteren. Rechten/revisies/readiness
opnieuw controleren, receipts atomisch/idempotent; geen willekeurige SQL/tool-
of service-roletoegang. Gebruik bestaande playlistpublicatiepreflight.

Sleutel alleen encrypted server-side, gescheiden encryption key; platform-AAL2,
audit, rotatie/test/revoke. Geen plaintextteruggave. Verbruiksregistratie zonder
prompts/geheimen, aparte echte pogingen en onbekend niet als nul. Eén controlepunt
vóór betaalde calls. AI-storing raakt gewone bediening/playback niet.

## Acceptatie en uitrol

Gerichte RED/GREEN-pickertests, daadwerkelijke opslag-/approval-/retry-/tenant-
isolatie-/rollenscenario's, gebruikstoerekening, mobiele/keyboard/axe-controles,
foundation/build en alle normale hostedgates. Geen gedeelde lokale DB-reset.
Staging via mainpush, daarna dezelfde volledige SHA via deploy.yml expliciet
naar productie. Health, revisies en functionele readbacks afzonderlijk bewijzen.
Echte providerproef alleen wanneer de beheerde stagingkey beschikbaar is.
