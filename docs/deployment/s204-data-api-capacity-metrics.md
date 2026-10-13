# S204 — databasecapaciteit bij de productiestoring

De ontvangen ochtendexport bewijst statement-timeouts en trage geslaagde storage-/slideprojecties, maar bevat geen CPU-, geheugen- of schijfmetingen. S203 meet afzonderlijk een vaste huidige catalogus-/blockercontext. Geen van beide historische logs of openbare health200 bevestigt herstel van de aangemelde website.

Supabase documenteert daarnaast een projectgebonden Metrics API via HTTPS Basic Auth. De primaire observabilityblog noemt service-role credentials; de actuele handleiding gebruikt secret API keys. De bestaande serversleutel wordt eenmaal langs deze gedocumenteerde read-only route geprobeerd. Geen nieuwe credential, monitoringdienst of cloudconfiguratie wordt aangemaakt.401/403 of ontbrekende series blijven expliciet onbekend; toegang wordt niet vooraf verondersteld.

De meting wordt geïntegreerd in de bestaande protected-main probe, achter dezelfde runtime-, project- en actieve-tenantchecks. De enige bestemming is het geverifieerde Supabase-project; redirects zijn verboden. Ruwe metrics en vrije labels worden niet gelogd of opgeslagen. Alleen vaste numerieke databasehostwaarden en gecontroleerde statussen mogen in het artifact terechtkomen. Sleutels blijven uitsluitend in de Authorization-header.

Twee begrensde GETs met61s tussenruimte volgen de gepubliceerde refreshcadans. Iedere GET heeft een10s deadline en1MiB bodycap, zonder retry. De bestaande20s metadataquery loopt onafhankelijk parallel; de180s CLI- en5min workflowgrenzen blijven dezelfde. Een abort stopt beide reads en de tussenruimte. Er wordt geen worker gepauzeerd, query geannuleerd, timeout verhoogd, rol gewijzigd of herstelactie uitgevoerd.

Geheugen- en schijfruimte zijn exporterwaarden op dat moment. CPUwaarden zijn alleen fracties van vergelijkbare positieve counterverschillen; ontbrekende modes, veranderde cores, nuldelta en resets worden geweigerd. I/O-wait en steal blijven afzonderlijk. Dit meet geen historisch storingsvenster, Supabase-computetier, VPSbelasting of bewezen oorzaak. De beta-metricvorm kan wijzigen; onbekende vormen blijven onbekend.

## Validatie

Op de definitieve helper slagen22 gerichte Nodechecks; de integratie heeft32 geslaagde checks, beide zonder skips. De integratie toetst ook dat een afgeronde metadatawaarneming behouden blijft als de exporter daarna wordt geannuleerd; annulering blijft fataal. Scoped ESLint, diffcheck en de bestaande gepinde Actionlint-/ShellCheck-validatie slagen. Workspace lint/typecheck/test slagen elk30/30 met30/30/29 cachehergebruik; testkit voert29 checks opnieuw uit. De frozen dependency-installatie verandert de lockfile niet. Onafhankelijke read-only review geeft ACK op helper en definitieve integratie.

Alle oorspronkelijke PR/Sites-gates blijven behouden en moeten op de exacte commit slagen. De daadwerkelijke protected-main meting en concrete herstelactie volgen daarna. Websiteherstel, definitieve staging-/productionuitrol, gewone synccycli en publicatieopruiming blijven onderdeel van de oorspronkelijke open opdracht.

Primaire bronnen: [Metrics API](https://supabase.com/docs/guides/observability/metrics), [observabilityblog](https://supabase.com/blog/metrics-api-observability), [gepubliceerde exporterwaarden](https://github.com/supabase/supabase-grafana/blob/main/docs/metrics.md).
