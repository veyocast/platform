# S205 — providerrequests volgen workerdrain

De productie-uitrol38322013412 vroeg op12oktober23:27:45UTC de oude18e-worker te stoppen. Er verschenen daarna nog schedule-/RSS-fouten; om23:28:05 volgde worker_drain_timeout en process.exit(1). Er was geen normale worker.stopped-marker. Dit bewijst een geforceerde processtop na20s; het bewijst niet dat een databasebackend nog actief was of de latere index-timeout veroorzaakte.

De huidige published-refresh-RPCs en Sportlink-client/storage/completion/renewal voeren de lifecycle-abort niet overal door. S205 zorgt dat bedoelde shutdown owned requests/waits afbreekt en dat daarna geen volgende claim, upload, ingest, failure-RPC of renewal begint. De bestaande30s clientdeadline,20s drain,60s lease en databasegeneration-/reclaimguards blijven behouden. Gewone provider-/deadlinefouten behouden hun herstelpad; last-known-good en immutable releases blijven leidend.

De eenmaal aangemaakte Sportlink-backend bindt immutable/idempotent aan dezelfde lifecycle-signal. De echte SDK-fetchlaag draagt die signal ook naar storage; de uploadopties worden niet uitgebreid met een niet-ondersteunde signal-property. Providerheaders/body/retrydelay en pinned image-http(s) volgen de optionele signal. DNSlookup kan onderliggend doorgaan, maar owned wachten stopt en na abort start geen image-HTTPrequest. SSRF/DNSpinning, redirect-/bodycaps en signatures blijven intact.

Een databasecommit kan al zijn voltooid voordat de client annulering waarneemt. Daarom wordt bij bedoelde stop geen nieuwe failure-RPC gestart en wordt geen rollback of gegarandeerde hosted backendbeëindiging geclaimd. Durable leases verlopen via de bestaande databasecontracten.

## Validatie en resterend werk

Op de definitieve patch slagen 116 gerichte workerchecks en 40 integrationschecks zonder skips. Ze gebruiken echte lokale SDK-/HTTPrequests voor vastgehouden claim, upload, completion, failure, cache, renewal, providerheaders/body, retrydelay en images; sockets sluiten bij abort en latere requests blijven afwezig. De imagechecks toetsen ook redirects, afgebroken DNSwachten en de behouden SSRFgrenzen. Gewone provider-/bodytimeouts blijven retryable volgens het bestaande contract.

De volledige worker-suite heeft 296 geslaagde checks en 250 bestaande skips; integrations heeft 170 geslaagde checks zonder skips. Root voert de 156 gerichte checks opnieuw uit en verifieert workspace lint/typecheck/test elk 30/30, met 26/27/26 cachehergebruik. Package-/workerbron en -tests zijn daadwerkelijk uitgevoerd; typecheck, scoped lint en diffcheck slagen. Afzonderlijke agents beoordelen elkaars definitieve vier bestanden en geven ACK; root leest de volledige acht bronwijzigingen. De frozen offline-installatie verandert de lockfile niet.

De volledige oorspronkelijke CI-gates en uiteindelijke uitrol volgen op de exacte commit. Er veranderen geen SQL/migraties, roles, dependencies, workflows of Player-invarianten. Productiestoring, finale staging-/productionuitrol, twee gewone succesvolle due-cycli en publicatieopruiming blijven deel van de oorspronkelijke open opdracht. Annulering van DNSwachten en HTTP bewijst geen beëindiging van de onderliggende OS-DNSlookup of hosted databasebackend.
