# Databasebewijs S313

De **definitieve** bron, inclusief de laatste slugtypecorrectie, is opnieuw vanaf nul gemigreerd en volledig getest op de tweede afzonderlijke database `s313_blog_acceptance_final`: **225 migraties plus seed, 159 testbestanden, 5607 assertions, PASS**. S313 zelf heeft 131 assertions. Zie het [definitieve bewijs](final/README.md) en de [onafhankelijke eindcontrole](final/security-review.md). De runner richt zich nu uitsluitend op die tweede database en kan de actieve HTTP-integratiebestemming niet resetten.

De onderstaande eerdere databasegates zijn uitgevoerd tegen de afzonderlijke lokale database `s313_blog_acceptance` op `127.0.0.1:64422`, rol `postgres`, in de bestaande container `supabase_db_veyocast-s295`. De broncheckout is branch `veyocast/s313-blog-socialhero`, basiscommit `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`. De exacte eerdere werkboominput wordt gebonden door de SHA-256-waarden in [summary.json](summary.json); de finale Git-commit wordt door het bovenliggende oplevermanifest vastgelegd.

De voorbereiding kopieerde uitsluitend Supabase-schemadefinities uit de lokale PostgreSQL 15.8-basis. Er zijn geen gegevens, gebruikers, credentials of clusterrollen gekopieerd. Alle applicatieobjecten in `public` en `private`, migratiehistorie, storagepolicies en apptriggers zijn uitgesloten. Bestaande Supabase API-defaultgrants zijn behouden. De controle vóór migratie bewijst nul publieke applicatietabellen, geen privéschema, nul Auth-gebruikers, nul Storage-objecten en geen applicatiemigratiehistorie; zie [base-manifest.json](base-manifest.json).

Vervolgens voerde de officiële, vastgezette Supabase CLI `2.109.1` via de bestaande pnpm-scripts alle **225** actuele migraties vanaf nul plus `supabase/seed.sql` uit. Het laatste versienummer is `20261113124946`. Dit is een verse applicatiemigratieproef op een lege Supabase-basis; er is geen nieuwe container of hosted omgeving aangemaakt.

```bash
python3 scripts/s313-blog-database-acceptance.py --stage prepare
python3 scripts/s313-blog-database-acceptance.py --stage reset
python3 scripts/s313-blog-database-acceptance.py --stage test
```

De eerste stap weigert een al bestaande acceptance-database. De andere stappen richten zich uitsluitend op deze vaste loopbackbestemming. Het script staat geen willekeurige database-URL toe, controleert de werkelijke databasenaam en weigert een poort die overeenkomt met de lokale of shadowpoort in `supabase/config.toml`. Daarmee blijft de CLI op de codeweg die uitsluitend de opgegeven database reset; de container-resetcodeweg wordt niet gebruikt. Broncontroles draaien expliciet in een read-only transactie.

De uitgevoerde gates gebruiken onderstaande commandoregels. `PGPASSWORD` en `SUPABASE_DB_PASSWORD` worden uitsluitend in het geheugen aan het childproces doorgegeven vanuit de bestaande lokale containeromgeving. `PGSSLMODE=disable` geldt alleen voor deze lokale loopbackproef. De pnpm-optie voorkomt automatische dependency-installatie. De pg_prove-image `public.ecr.aws/supabase/pg_prove:3.36` bestond al en is vooraf gecontroleerd; er zijn geen images gepulld of volumes toegevoegd.

```bash
pnpm --config.verify-deps-before-run=false db:reset --db-url 'postgresql://postgres@127.0.0.1:64422/s313_blog_acceptance?sslmode=disable' --workdir /home/codex/.codex/worktrees/s313-blog-socialhero/castivo --yes
pnpm --config.verify-deps-before-run=false test:rls --db-url 'postgresql://postgres@127.0.0.1:64422/s313_blog_acceptance?sslmode=disable' --workdir /home/codex/.codex/worktrees/s313-blog-socialhero/castivo
```

De eerste resetpoging stopte vóór databasewijzigingen doordat CLI 2.109.1 bij het opnieuw serialiseren van de verbinding de URL-optie `sslmode` verliest. De expliciete childprocesvariabele `PGSSLMODE=disable` verhelpt dit. Die mislukte poging blijft zichtbaar in [reset.log](reset.log) en `summary.json`. De voorbereidende restore gebruikte de hostclient psql 16, omdat de bijbehorende pg_restore 16 clientdirectieven genereert die de oudere psql 15 in de container niet herkent. Dit wijzigt geen serverinstelling.

De finale reset en volledige RLS-suite zijn geslaagd op de definitieve bevroren S313-bron: **159 bestanden, 5605 assertions, 131 seconden, PASS**. De finale geschoonde logs zijn [reset-20261113T143453.log](reset-20261113T143453.log) en [rls-20261113T143617.log](rls-20261113T143617.log). Begin-/eindtijden in UTC en exacte invoercontrolesommen staan in `summary.json`. De voorafgaande volledige run was groen met 159 bestanden en 5601 assertions; na concrete aanvullende URL-/ProseMirror-regressies is de eigen database opnieuw gereset voor de finale bron. De S313-regressies omvatten nu **129 assertions**, waaronder afwijzing van lege SEO, lege paragraaf en uitsluitend Unicode-witruimte, met behoud van de bestaande geldige liveversie.

De onafhankelijke read-only cataloguscontrole staat in [catalog-security.json](catalog-security.json): 15 blogfuncties, 10 RLS-tabellen, geen anonieme uitvoering van nieuwe functies, een vaste lege `search_path` voor iedere definer, geen rechtstreekse schrijfrechten voor Data API-rollen, geen publieke conceptpointer of interne redacteur-ID, een invoker-view en een private mediabucket. De bestaande globale anonieme definer-allowlist bevat precies de 23 door de regressies toegestane Player-/publieksfuncties; S313 voegt daaraan niets toe.

De codecontrole bevestigt dat menselijke mutaties owner/admin plus AAL2 vereisen, API-mutaties daarnaast hun site-/omgevingsgebonden credentialscope controleren, en media pas via de serverattestatie ready worden. Die attestatie bindt aan het oorspronkelijke menselijke receipt, de actor en de exacte metadatafingerprint. Publicatieresponses, routehistorie en revisionpointers worden samen gecommit. Publieke lezers zien uitsluitend de huidige gepubliceerde revisie en bijbehorende assets.

De publieke documentvalidator gebruikt eveneens een budget van 250000 UTF-8-bytes. De database telt haar JSONB-serialisatie met normale tussenruimtes en kan daardoor een document aan de bovengrens iets eerder weigeren. Exotic hostnamevormen met numerieke eindlabels en niet-gevalideerde punycode worden conservatief bij opslaan geweigerd. Deze grenzen veroorzaken geen bevestigde publicatie die de publieke validator vervolgens afwijst.

De originele `postgres`-database bleef bij iedere gate ongewijzigd: 213 migraties tot `20261109000829`, geen blogtabellen en dezelfde gebruikers-/tenant-/Storage-aantallen en rollenchecksum. De acceptance-database blijft tijdelijk beschikbaar voor de afzonderlijk benoemde HTTP-testadapter en bevat uitsluitend lokale testdata. Verwijderen gebeurt pas na coördinatie met die integratieproef. Geen staging-/productiedatabase, credential, deployment of bestaande volume-inhoud is gewijzigd.
