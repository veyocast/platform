# S293 — Stabiele Menu-identiteit na bronobservatie

De echte S292-stagingcanary op `4d3fa168f75e115687ca2a1de38a393ee07256fc`
maakte een fout zichtbaar die de eerdere rollbacktests niet vonden. De
Menu-builder maakt bij iedere lezing een nieuwe `publication.publishedAt`.
Alleen dat veld veranderde tussen het immutable snapshot en de actuele data.
Een ongewijzigde refresh verhoogde de Menu-datarevisie van 2 naar 3 terwijl de
bronrevisie 1 bleef. Productiepromotie is daarom aangehouden.

De bestaande protocol-2-normalizer sluit nu ook het observatietijdstip onder
`menuDocument.publication` en zijn canonieke `priceList.menuDocument`-alias
uit. Dezelfde private normalizer bepaalt data- en snapshotidentiteit. De verse
observatiemetadata blijft opgeslagen. Prijs, naam, beschikbaarheid,
assetchecksum, documentrevisie en rendereridentiteit blijven semantisch.
Versie-1- en onversioneerde hashes blijven via hun bestaande pad bytecompatibel.
De forwardmigratie vervangt één pure private functie en behoudt haar gesloten
ACL. Er wordt geen release, snapshot, target of productrecord herschreven.

Ownership: één root-writer op `veyocast/s293-menu-observation-stability`, in de
eigen worktree `castivo-s293`; één nieuwe migratie, eigen SQL/RPC-regressies en
eigen documentatie/plan/ledger. Applicatie-, renderer-, asset-, dependency-,
lockfile- en workflowcode blijven gelijk aan S292.

De oorspronkelijke SQL-regressie reproduceerde drie fouten van negentien vóór
de migratie en slaagde daarna. De aanvullende echte Menu-RPC-keten gebruikt
een Twelve-product met `data_source_id = NULL`, zoals de echte import. Zij
commit de fixture in een uitsluitend lokale testdatabase en voert vervolgens
drie bronobservaties in afzonderlijke transacties uit. Daardoor verandert
`now()` werkelijk; één rollbacktransactie verborg de oorspronkelijke fout.
De observaties houden revisie 1, dezelfde inhoudshash, één snapshot, één job,
één release en nul binaries. Ook snapshotidentiteit blijft stabiel. Alleen de
observatiestempel wordt vers gehouden. Bewijs staat in
`implementation/s293-menu-observation-stability/rpc-cross-transaction.json`.

S292-stagingbewijs vóór deze vervolgfix: een echte AD-sync voltooide 30
artikelen, 28 beschikbare foto's, 30 QR's en één logo (59 artifacts). RSS en
Menu werden als descriptors van 7.819 en 1.868 bytes gereedgemaakt zonder
binaire uitvoer. De gepaarde hosted browser bevestigde protocol-2-frames van
beide oorspronkelijke renderers; een echte offline reload behield playback,
fonts en pairing, inclusief de tweede widgetpagina. Dit is browserbewijs,
geen fysieke LG-/Android-acceptatie.

Op reeds opgeslagen stagingbrondata zijn dertig echte preview-RPC-aanroepen
per route gemeten: nearest-rank p50/p95 voor RSS 412,623/420,525 ms en Menu
27,178/32,605 ms; eerste aanroep respectievelijk 766,101/88,945 ms. Dit is
databasetijd, zonder Control-netwerk, browserrendering of provideracquisitie.
Het zijn geen productie-p95's. De bestaande S292-native-exportmetingen zijn
afzonderlijke samples en worden niet als p95 of totale snelheidsfactor gebruikt.

Workspace lint/typecheck/unit zijn elk 30/30 groen (JS-bronnen gelijk aan
S292, overwegend geldige Turbocache). De verse reset en volledige SQL/RLS-run
slagen met 147 bestanden en 4.830 assertions; db-lint op foutniveau is leeg.
De daadwerkelijke RPC-proef en eigen runnerlint zijn groen. Actuele CI, nieuwe main-SHA, stagingcanary en
expliciete productiepromotie worden per PR/run vastgelegd. Tot die verificatie
blijft productie op de eerdere release en wordt geen volledige uitrol geclaimd.

Een reeds bestaande staging-v2-binding kan bij de eerste herberekening één
nieuwe normalisatiehash krijgen. Daarna veroorzaken gelijke observaties geen
revisie of werk. Nieuw voorbereide v2-bindingen beginnen direct met de stabiele
identiteit; historische v1-receipts houden hun oorspronkelijke betekenis.
