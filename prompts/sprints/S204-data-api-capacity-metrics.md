# S204 — begrensde Supabase-capaciteitsmeting

## Probleem en doel

De productie-API blijft traag/onbeschikbaar. Historische logs tonen time-outs en trage opslag/projecties, maar geen CPU-, geheugen- of schijfmetingen. Supabase documenteert een projectgebonden Metrics API met HTTP Basic Auth; de bestaande service-role key kan mogelijk deze read-only route gebruiken. Meet uitsluitend vaste numerieke databasehostwaarden, zonder beheerderscredentials te vragen of capaciteit als oorzaak te veronderstellen.

Primaire bronnen: https://supabase.com/docs/guides/observability/metrics, https://supabase.com/blog/metrics-api-observability en https://github.com/supabase/supabase-grafana/blob/main/docs/metrics.md. Metricnamen/labels zijn beta; ontbrekende, onvergelijkbare of onbekende vormen blijven expliciet onbekend. Gedocumenteerde toegang is geen bewijs dat het productieproject deze sleutel accepteert.

## Ownership

Implementatieagent: uitsluitend scripts/supabase-capacity-metrics.mjs en scripts/supabase-capacity-metrics.test.mjs in deze worktree.
Root: integratie in scripts/probe-data-api-resources.mjs en bijbehorende tests, bestaande expliciete PR-gatelijsten, dit prompt, deploymentdoc en TASK_LEDGER.md.
Geen app, dependency, lockfile, database, migration, timeout, role/grant, herstelactie, nieuwe workflow of deploymentwijziging. Geen pollingdienst of monitoringinstallatie.

## Vereisten

- Gebruik alleen de vaste HTTPS-route op het geverifieerde project: /customer/v1/privileged/metrics. Geen redirects, endpointinput of alternatieve credentials. Sleutel uitsluitend in Authorization-header, nooit in URLs, fouten, console of artifact.
- Root roept de helper pas aan na bestaande main/runtime/project/actieve-tenantguards. Maximaal twee GETs, elk10s en maximaal1MiB body, zonder retries. Een vaste61s tussenruimte volgt de gedocumenteerde refreshcadans; abort beëindigt wachten/lezen. Tests gebruiken geïnjecteerde tijd/fetch/wachtadapters en voeren geen netwerk of werkelijke61s wait uit.
- Houd alleen vaste numerieke gauges/counters over: MemTotal/MemAvailable, SwapTotal/SwapFree, load1, cpu_seconds_total per vaste CPUmodus (max128cores), en filesystem-size/avail voor vaste beoordeelde mountklassen. Geen vrije labelnamen/waarden, device/hostnamen, projectlabels, querytekst, PIDs of ruwe metrics in output. Beperk parsing/rijen/labels; dubbele/ongeldige/private waarden worden geweigerd. Database-service/projectlabels moeten kloppen.
- CPUpercentages vereisen vergelijkbare cores/modes, niet-afnemende counters en een positieve totale delta; nuldelta/reset/ontbrekende modes blijven UNKNOWN. Rapporteer expliciet dat het een fractie van geëxporteerde counterverschillen is, geen historisch storingsvenster. I/O-wait en steal apart; geen laag loadgetal als CPUgezond bewijs. Ontbrekende disk/memorywaarden blijven null/unknown, geen0. Geen capaciteitlimiet/compute-tier/oorzaak afleiden.
- Output heeft een vaste, kleine vorm met meetstatus, grenzen en expliciete beperkingen. HTTP401/403/time-out/parsefouten blijven vaste codes, zonder responsebody/errorwaarden. Capaciteitsmeting is geen website- of integratieacceptatie.
- Betekenisvolle guards voor scope/credential/redirectprivacy, bytes/label/cap/duplicaten, ontbreken/stale/reset/mismatched series, CPUguest-dubbeltelling, geheugen/diskgrenzen, abort/deadline en echte CLI/streamcancellation waar relevant.

## Validatie en vervolg

Gerichte Nodechecks/ESLint, workspace lint/typecheck/test en bestaande workflowvalidatie; volledige bestaande PR/Sites-gates behouden. Geen commit/push/remoteactie door implementatieagent. Root beoordeelt de minimale helper en integreert hem; een protected-main read-only meting gebruikt daarna de werkelijk actieve runtime. S203 kan afzonderlijk voltooid/gemeten worden. Definitieve uitrol en volledige oorspronkelijke liveacceptatie blijven open.
