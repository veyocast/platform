# S313 ketenproef met lokale PostgreSQL-testadapter

Deze proef gebruikt de **werkelijke Next Marketing-app en de werkelijke SocialHero BlogClient**, gekoppeld aan een **expliciete lokale testadapter**. SQL-mutaties, unieke constraints, immutable revisies, publicatie, receipts, limiterstatus en RLS draaien in de afgescheiden PostgreSQL-database `s313_blog_acceptance` van container `supabase_db_veyocast-s295`. Auth/JWT en Storage-HTTP zijn synthetische adapters. Dit is geen bewijs van een verbinding met echte Supabase Auth/Storage, productie of een extern gehoste testwebsite.

De adapter kan geen andere database of container kiezen. SQL gaat via `docker exec -i ... psql -d s313_blog_acceptance`; iedere HTTP-operatie krijgt een eigen transactie met de geverifieerde JWT-rol en claims. Alleen expliciet toegestane RPC’s, blog-SELECTs en create-only Storage-objecten worden aangeboden. Afbeeldingsbytes staan uitsluitend als bestanden onder `/tmp/s313-blog-runtime/objects`; de werkelijke `storage.objects`-rijen en policies worden afzonderlijk gecontroleerd.

De tijdelijke HMAC-secret, infrastructure-JWT’s, aparte sitecredential en AAL2-testactor staan uitsluitend in `/tmp/s313-blog-runtime/config.json`, met mode0600 onder een map met mode0700. Waarden worden niet geprint of opgenomen in bewijs. De configuratie bevat uitsluitend lokale testcredentials; er zijn geen productiecredentials nodig.

## Uitvoering

Wacht eerst op de databaseagent: de officiële reset en volledige RLS-suite moeten zijn afgelopen voordat fixtures worden aangemaakt. De helpers resetten of verwijderen geen database.

```bash
./node_modules/.bin/tsx tests/helpers/s313-blog-backend.mts --init
./node_modules/.bin/tsx tests/helpers/s313-blog-backend.mts --supervise
```

De adapter luistert uitsluitend op `http://127.0.0.1:9431`. Root start vervolgens de geïsoleerde Next Marketing-runtime op `http://127.0.0.1:9313` met configuratievelden uit het private bestand, zonder die waarden naar de terminal te schrijven. De veldmapping is:

| Privaat configuratieveld | Runtimevariabele |
|---|---|
| `backendOrigin` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anonKey` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `serviceRoleKey` | `SUPABASE_SERVICE_ROLE_KEY` |
| `marketingOrigin` | `VEYOCAST_BLOG_PUBLIC_ORIGIN` |
| `environment` | `VEYOCAST_ENVIRONMENT` |
| `siteId` | `VEYOCAST_BLOG_SITE_ID` |

Daarna:

```bash
./node_modules/.bin/tsx tests/helpers/s313-blog-integration.mts
```

Het integratiescript leest het credential direct uit het private bestand en importeert de werkelijke client uit de aparte SocialHero-worktree. Het bewaart hervatbare, niet-geheime stappen lokaal. `result.json` bevat uitsluitend bronversies, hashes, veilige voorbeeld-ID’s/URL’s, uitkomsten en tijden. De drie artikelen en zes afbeeldingen komen uit de meegeleverde prototypedataset en blijven uitsluitend in de lokale testdatabase.

De after-commit-injecties vinden pas plaats nadat PostgreSQL de daadwerkelijke mutatie heeft gecommit. De adapter verbreekt dan de HTTP-respons en verlaat zijn proces. Een kleine supervisor start uitsluitend diezelfde lokale adapter opnieuw. De oorspronkelijke idempotentiesleutel en bytes worden daarna opnieuw gebruikt. Next wordt hierbij niet door het integratiescript gestart, gereset of gestopt.

## Uitkomst op 13 november 2026

**22/22 ketenstappen geslaagd** met contractversie1, site `veyocast`, omgeving `development`, locale `nl-NL`, werkelijke Next15.5.20 en de werkelijke SocialHero-client. [result.json](result.json) bevat de tijden en afzonderlijke uitkomsten. De bron is VeyoCast `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770` plus de nog niet gecommitte kandidaatwijzigingen en SocialHero `6ddc4be5cf74b113c186d4068ed18f87d71c37b6` plus kandidaatwijzigingen; de exacte client- en datasethashes staan in het rapport. De helpers wijzen de database en container expliciet vast aan de afgescheiden bestemming.

| Controle | Feitelijke uitkomst |
|---|---|
| Ontbrekende, verkeerde, verlopen en ingetrokken credentials | 401 `INVALID_CREDENTIAL` |
| Read-only media-scope / verkeerde omgeving | 403 `PERMISSION_DENIED`; vervalst infrastructure-JWT door adapter afgewezen |
| Media, concept en publicatie na succesvolle COMMIT maar verloren respons | Drie echte adapterprocesherstarts; replay met dezelfde sleutel hervat hetzelfde object/artikel/dezelfde revisie |
| Conceptprivacy | Werkelijke detail- en mediapagina404; anonieme publicatiequery onder echte RLS geeft geen rijen |
| Andere inhoud onder dezelfde sleutel / bestaande slug | 409 `IDEMPOTENCY_CONFLICT` / `SLUG_CONFLICT`; geen tweede artikel |
| Gelijktijdige If-Match-bewerking | Eén schrijver slaagt, één409; bewerkbare revisie2 laat gepubliceerde revisie1 intact |
| Oude job / ontbrekende revisie | 409 `REVISION_CONFLICT` / 428 `REVISION_REQUIRED` |
| Publieke verificatie | Werkelijke `SocialHeroBlogPublisher/1.0` ontvangt canonical, external-id en revisie in de actieve HTML-head; echte clientverify slaagt |
| OpenGraph | Aparte afbeelding1200×630; fallback naar echte portretafbeelding1600×2000; publieke eigenmedia200 |
| Slughistorie | Twee historische slugs geven elk308 direct naar de actuele slug; sitemap bevat uitsluitend actuele URL’s |
| Media-inhoud en limiter | Gespoofte MIME415, corrupte afbeelding422, duurzame429 met `Retry-After` |
| Exacte dataset vóór workerproef | 3 artikelen,6 assets,6 Storage-objecten,6 immutable revisies en3 publicaties |

De gepubliceerde eerste testpagina is `http://127.0.0.1:9313/blog/clubtv-inrichten-wedstrijddag-definitief`. De twee andere testpagina’s zijn `/blog/sponsoren-zichtbaar-op-clubscherm` en `/blog/schermen-plaatsen-clubhuis` op dezelfde loopbackorigin. De test verwijdert geen revisies of redirectgeschiedenis. De broninhoud en foto’s zijn gelijk aan het prototype; de echte publicatiedatum is het uitvoermoment en de lijst sorteert op die nieuwe publicatiedata. De Sites-interne homeverwijzingen worden in het testpayload naar de werkelijke VeyoCast-home `/` vertaald.

Daarna is de **werkelijke SocialHero BlogWorker** uitgevoerd in drie afzonderlijke Nodeprocessen, met de eigen versleutelde vault en SQLite. Publicatie slaagde, de lokale completion werd expliciet onderbroken na echte HTML-verificatie, en de herstart verifieerde dezelfde publicatie opnieuw. De websiteafhankelijkheid veranderde van `WAITING_FOR_WEBSITE` naar `PROVIDER_NOT_CONFIGURED`; er is geen socialprovider aangeroepen. Het SocialHero-bewijs staat in die repository onder `docs/veyocast-blog-evidence/worker-next-result.json`.

```bash
./node_modules/.bin/tsx tests/helpers/s313-blog-integration.mts --verify-worker
```

Deze aanvullende read-onlycontrole is geslaagd. [post-worker.json](post-worker.json) koppelt het SocialHero-rapport aan zijn hash, de geïnstalleerde blogfuncties aan hashes en de gebruikte kandidaatbestanden aan SHA-256. De eindstand is exact4 artikelen,8 assets,8 Storage-objecten,7 revisies en4 publicaties: uitsluitend het extra workerartikel en zijn twee afbeeldingen zijn toegevoegd. Het rapport bevat geen credentialwaarden.

```bash
./node_modules/.bin/eslint tests/e2e/blog-publication.spec.ts tests/helpers/s313-blog-integration.mts tests/helpers/s313-blog-backend.mts --max-warnings=0
./node_modules/.bin/tsc --noEmit --skipLibCheck --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --lib ES2022,DOM,DOM.Iterable --types node tests/helpers/s313-blog-backend.mts tests/helpers/s313-blog-integration.mts
git diff --check
```

Gerichte lint, TypeScript en diffcontrole zijn geslaagd. Werkelijke gepubliceerde browsercaptures met zes aanvullende aXe-scans zonder overtredingen, reflow op1440/390/320px en toetsenbord staan in `../browser/next-published-runtime.json`.

## Eerdere fout en afbakening

De eerste ketenuitvoering stopte vóór media- of artikelwrites: de read-only-mediaproef ontving500HTML in plaats van403JSON. De werkelijke Next-bundel kon de native `sharp`-dependency niet vanuit `apps/marketing` resolven. De directe dependency en lockimporter zijn door root hersteld en de geïsoleerde Next-server is herstart; dezelfde proef slaagde daarna met403. De eerdere mislukte assertie blijft in `result.json` bewaard. De twee reeds geslaagde read-only stappen zijn hervat, de overige twintig zijn daarna daadwerkelijk uitgevoerd.

De ketenproef en workerproef zijn uitgevoerd met de blogmigratie met SHA-256 `aa3f408503724189f6220d850ffdfd9ab3109ee3b66749a66ddd8e647677bdb7`, waarop de officiële225-migratiereset en volledige159-bestanden/5605-asserties-RLS-suite geslaagd waren. De databaseagent test een later aangescherpte directe-RPC-slugtypecontrole afzonderlijk in `s313_blog_acceptance_final`. De echte API weigerde deze verkeerde slugtypen al. De source- en functiedigests in `post-worker.json` bewaren de toestand vóór die laatste aanpassing.

Na alle keten- en workerwrites heeft root expliciet één functionpatch toegestaan op de actieve integratiedatabase: uitsluitend `CREATE OR REPLACE private.blog_validate_payload`, zonder reset, drop of datawijzigingen. De definitie is nu exact gelijk aan die in de fresh finale database: SHA-256 `26ede8c800d99a567ee06f79f72cf0bb717f0d2beb326c27d37b26459cdf099d`, tegenover `9d9882398d086683d3e981647babc0dd463704772b03d5012ff839ad7e8d5651` ervoor. Alle16 gecontroleerde tabeldigests,225 migratieregels en de4/8/7/8-artikel/asset/revisie/Storage-eindstand bleven identiek. Het afzonderlijke readbackbewijs staat in `../database/final/active-integration-function-patch.json`; dit wordt niet voorgesteld als een nieuwe uitvoering van de22 eerdere ketenstappen.

Open blijven de cloud-Supabase Auth/Storage-gateway, een werkelijke Supabase Auth-sessie voor de volledige Control-redacteurflow, externe staging/production en een gekoppelde socialprovider. Deze lokale adaptersimulatie claimt die controles niet. De SocialHero-workerproef gebruikt vooraf goedgekeurde voorbeeldinhoud en voert geen AI-request uit.
