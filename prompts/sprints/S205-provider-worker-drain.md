# S205 — providerwerk stopt bij workerdrain

## Probleem en afbakening

De daadwerkelijke productie-uitrol38322013412 vroeg de oude18e-worker te stoppen; na20s volgde worker_drain_timeout/process.exit(1). De stop werd dus geforceerd. Dit bewijst niet dat een hosted databasebackend bleef draaien of de historische storing veroorzaakte. De huidige published-refresh-RPCs en Sportlink-provider/storage/completion/renewal dragen de lifecycle-abort niet overal door. Voorkom nieuwe requests en begrens reeds lopende owned waits bij die abort, met behoud van gewone timeout-/retry-/LKGsemantiek.

Lees de verplichte README/PLANS/TASK_LEDGER/canons en dit sprintprompt. Root heeft deze worktree geïsoleerd; bestaande deadlines, lease/generation/reclaim/security/offline/release-invarianten zijn leidend.

## Ownership

Implementatieagents uitsluitend deze acht paths in /tmp/veyocast-s205-provider-worker-drain. final_server_review bezit uitsluitend de eerste vier workerpaths; package_boundary_ci_fix uitsluitend de laatste vier integrationspaths. Geen overlappende edits. Additief APIcontract: SportlinkClient options.operationSignal?:AbortSignal; fetchSafeRssImage(rawUrl,redirectCount=0,options?:{signal?:AbortSignal}).

- apps/media-worker/src/published-data-refresh-runner.ts
- apps/media-worker/test/published-data-refresh-runner.test.ts
- apps/media-worker/src/sportlink-sync-runner.ts
- apps/media-worker/test/sportlink-sync-runner.test.ts
- packages/integrations/src/sportlink-client.ts
- packages/integrations/test/sportlink.test.ts
- packages/integrations/src/safe-image-fetch.ts
- packages/integrations/test/safe-image-fetch.test.ts (nieuw)

Root bezit prompt/docs/TASK_LEDGER. Geen index.ts, nieuwe resultstatus, workflow, dependency, lockfile, SQL/migration, grants of timeoutwijziging. Geen commit/push/remote/productieactie door agent. Rapporteer concrete noodzakelijke scope-uitbreiding vóór buiten-ownership-edit.

## Gedrag

- Published claim/complete/fail gebruikt de echte SDK-abortSignal. Pre/post-abortguards verhinderen nieuwe fail-RPC na bedoelde stop; houd gewone fouten/backoff onveranderd.
- Sportlink bindt de eenmaal geconstrueerde backend immutable/idempotent aan dezelfde worker-lifecyclesignal via een optionele structurele methode vanuit de loop. Een andere signal wordt vóór I/O geweigerd; --once/geen-signal blijft compatibel. Geen per-call mutable "laatste signal".
- De bestaande fetch-deadline composeert de lifecycle-signal met init.signal of Request.signal. Dit moet de echte native SDK-RPCs én storage bereiken; FileOptions heeft geen signal-optie. Behoud Request-body/headers/duplex.
- Pre/post-abortguards verhinderen nieuwe claims, cachefallback, uploads, ingest, fail of renew. Optionele media-catches mogen abort niet omzetten in MEDIA_PARTIAL/schijnsucces. Heartbeat disarmt onmiddellijk bij abort; lopende renewal wordt geannuleerd. Loopcallbacks/gezondheidsaccounting starten niet na drain. Durable leases vervallen vanzelf; verander databaseguards niet.
- SportlinkClient krijgt een additieve optionele operationsignal. Stop wachtende headers/body en retrydelay; operationabort is geen retryable NETWORK_ERROR. Gewone eigen requestdeadline/retrycontract blijft.
- Safeimage krijgt een additieve derde options{signal}. Behoud SSRF/DNSpinning, signatures, redirect/bodycaps en8s deadline; forward signal op redirects en pinned node:http(s) requests, controleer vóór/naDNS en race owned wait. Onderliggende getaddrinfo hoeft niet killbaar te zijn: beloof alleen stop van owned wachten en geen HTTP na afgebroken DNS. Verwijder listeners/timers/request/streams waar owned.
- Masker private abortreason/errorwaarden. Een server kan reeds hebben gecommit vóór de client abort ziet: geen claim van rollback of gegarandeerde hosted DB-transactiebeëindiging.

## Betekenisvolle validatie

Preabort nul I/O; echte native SDK held claim/complete/storage/renew geannuleerd; na stop geen volgende upload/cache/ingest/fail/renew; immutable/idempotent binding; gewone deadline-only optional-media failure behoudt normale ingest/LKGsemantiek. Native provider headers/body/retrydelay abort zonder volgende fetch. Image held body/redirect/pre-/post-DNS abort met geen HTTP na DNS en bestaande SSRFchecks. Published pending claim/complete/fail abort zonder nieuw failure-RPC. Geen productionnetwork of remote mutaties.

Voer relevante package-/workerchecks, lint en typecheck uit en rapporteer hashes/werkelijke pass/skips/limitations. Root controleert onafhankelijk en voert vereiste workspace-/CI-gates uit. De volledige oorspronkelijke provider-/website-/deployment-/opruim-/twee-gewone-cycliacceptatie blijft open.
