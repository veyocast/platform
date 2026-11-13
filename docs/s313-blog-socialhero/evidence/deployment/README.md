# S313 — Daadwerkelijke VeyoCast-uitrol

VeyoCast is via de bestaande reguliere merge- en immutable releaseflow uitgerold op **`67d8470198acec4272c47c4c7979b6071a915c4b`**. Beide workflowruns zijn exact op die SHA `completed/success`: automatische staging [43456143838](https://github.com/veyocast/platform/actions/runs/43456143838) en expliciete staging→production [43456528973](https://github.com/veyocast/platform/actions/runs/43456528973). De bovenliggende release-uitvoering heeft de merge/dispatch verricht; deze databaseagent heeft uitsluitend gelezen en bewijs voorbereid.

De [workflowmetadata](workflow-after.json), [stagingreadback](staging-after.json) en [productiereadback](production-after.json) bevestigen de uitkomst. Beide databases hebben **225 migraties** tot en met `20261113124946`, **10 RLS-blogtabellen**, **15 blogfuncties**, **0 anonieme blog-EXECUTE-rechten** en **0 rechtstreekse authenticated-schrijfrechten**. De publieke view is invoker; conceptpointer en interne redacteur-ID blijven afgeschermd. De private mediabucket staat op 8 MiB en uitsluitend JPEG/PNG/WebP.

Alle twee staging- en drie production-healthroutes geven 200 op dezelfde exacte release-SHA. Op production geeft `/blog` 200; zonder credential geeft capabilities 401, de Control-redactie-API 403 en een niet-bestaand publiek media-ID 404. Deze probes gebruikten geen credentials en schreven geen gegevens.

**Site-/credentialactivering staat nog open.** De gemeten site-, token-, artikel-, revisie-, asset- en publicatieaantallen zijn op beide omgevingen nul. Er is geen Auth-sessie nagemaakt, geen provisioning-DML uitgevoerd en geen productiecredential opgehaald of gegenereerd. Staging heeft standaard geen publieke Marketing-service.

De concrete bevoegde gebruikershandeling staat in [ACTIVEREN.md](ACTIVEREN.md). De [standalone operatorclient](activate-veyocast.mjs) gebruikt een nieuwe echte persoonlijke passwordlogin en TOTP-challenge, bestaande guarded RPC's, vijf scopes en 90 dagen expiry. Hij schrijft de eenmalige credential uitsluitend naar een nieuw private `0600`-bestand buiten Git en trekt haar bij een mislukte handoff gecontroleerd in. Bij een onzekere uitkomst bewaart hij private herstelgegevens en claimt hij geen succes. `GEREED` is een menselijke attestatie van de SocialHero-wizard; de client meet alleen VeyoCast-capabilities en bewijst geen artikelpublicatie.

De client is uitsluitend lokaal getest, **niet tegen live Auth of production uitgevoerd**. [Dertien tests](operator-client-tests.json) zijn groen, inclusief een echte lokale PTY voor verborgen invoer; root heeft bron en tests onafhankelijk gecontroleerd. Dit is een losse operatorhandreiking naast de uitgerolde appcode, geen nieuwe app-, RPC- of workflowfeature.

| Controle | Commando / toegang | Resultaat |
|---|---|---|
| Operatorclient | `node --test docs/s313-blog-socialhero/evidence/deployment/activate-veyocast.test.mjs` | 13/13 PASS; volledig gemockte Auth/API, echte lokale PTY |
| JS-syntax | `node --check` op client en test | PASS |
| Readbackquery vóór hosted gebruik | [readback.sql](readback.sql), `BEGIN READ ONLY` op afzonderlijke lokale finale acceptance-DB | PASS; 225 migraties, 10 RLS-tabellen, 15 functies |
| Stagingdatabase | Supabase Primary-connector, exact project `jibbtdicrptsyftobavq`, uitsluitend [readback.sql](readback.sql) | PASS; geen writes |
| Productiedatabase | Supabase Primary-connector, exact project `gjmdqsukjfhmmblnmhqd`, uitsluitend dezelfde read-only query | PASS; geen writes |
| Publieke HTTPS-probes | Python `urllib.request`, vaste URL's, maximaal acht seconden per request | Alle verwachte statuses en exacte SHA's bevestigd |
| Workflowmetadata | `gh api repos/veyocast/platform/actions/runs/<run-id>` met metadata-allowlist | Beide completed/success op exacte release-SHA |
| JSON / whitespace | Python JSON-parser; `git diff --check -- docs/s313-blog-socialhero/evidence/deployment` | PASS |

De [voorafgaande audit](PROVISIONING-AUDIT.md) bevat actuele project-/Environmentbinding, CI, secretvrije metadata en de afwezigheid van een bestaande algemene systeemprovisioningroute. De productieproject-ref is de schone cutoverbestemming, niet de oude ref uit het historische bootstrapdocument. [production-after.json](production-after.json) bindt ook de bronhashes van migratie, readbackquery en client aan dit bewijs. De migratiehash is `e7864fd76e5d88afc17fb288522a22c8ff8af9bc4f0180f96e646cc38dfa906a`.

## Publieke browsercontrole en SocialHero-uitrol

De [werkelijke productiecontrole](marketing/README.md) is 12/12 groen: home en
blog op 1440/390/320 px, zes screenshots, zes aXe-scans zonder overtredingen,
geen browserfouten of overflow, correcte canonicals en alle 49 bestaande
sitemap-URL's behouden naast de nieuwe blogindex. De precieze skiplinkfocus en
twee gecorrigeerde probeverwachtingen zijn afzonderlijk vastgelegd; er is
geen applicatiecode aangepast om de meting te laten slagen.

SocialHero is na VeyoCast via [PR1](https://github.com/socialherodgweb/platform/pull/1)
uitgerold als **`2a800550ef3d5359cf73c6e37cc1f2eeb5b5b0c5`**, configuratie `v2`,
databasecompatibiliteit `socialhero-sqlite-v2-images`. De actuele wijzigingen aan
bestemming/canonical en rollback zijn met een normale merge behouden; 219 tests,
TypeScript en de standaard Turbopack-build zijn groen op de exacte software-SHA.

| Omgeving | Push-CI | Kandidaatbuild | Activatie |
|---|---|---|---|
| staging | [43458345211](https://github.com/socialherodgweb/platform/actions/runs/43458345211) | [43458667644/1](https://github.com/socialherodgweb/platform/actions/runs/43458667644) | [43459523181](https://github.com/socialherodgweb/platform/actions/runs/43459523181) |
| production | [43459817441](https://github.com/socialherodgweb/platform/actions/runs/43459817441) | [43460049432/1](https://github.com/socialherodgweb/platform/actions/runs/43460049432) | [43460311073](https://github.com/socialherodgweb/platform/actions/runs/43460311073) |

Alle genoemde runs zijn `completed/success`. De eigen roothelper controleerde
verzegelde kandidaten, afgescheiden smoke, backup en exacte activatie. Root
heeft daarnaast beide publieke readinessroutes onafhankelijk met GET en een
tienseconden-deadline gecontroleerd: HTTP200, `ok`, de volledige verwachte
software-SHA en `worker.running=true`. Zie [socialhero-public-ready.json](socialhero-public-ready.json).
De productie-URL is `https://socialhero.dgwebservices.nl`, staging
`https://socialhero-staging.dgwebservices.nl`.

Dit bewijs is na de deployments aan de bestaande taakbranch toegevoegd; de
bewijscommit is geen nieuwe applicatierelease. De nieuwe VeyoCast-verbinding is
nog niet als gekoppeld aangemerkt: persoonlijke Auth/MFA, siteconfiguratie,
servercredential en de echte wizardcontrole blijven vereist.
