# Definitief databasebewijs S313

De laatste onafhankelijke controle vond nog een ontbrekende stringtypecontrole voor numerieke en booleaanse slugs. Na de gerichte correctie zijn alle **225 migraties plus seed vanaf nul** toegepast op een tweede lege lokale database, `s313_blog_acceptance_final`. Vervolgens slaagde de officiële volledige RLS-suite: **159 bestanden, 5607 assertions, 131 seconden, PASS**. De eigen S313-suite omvat **131 assertions**.

De bestemming is uitsluitend `127.0.0.1:64422`, rol `postgres`, container `supabase_db_veyocast-s295`. De eerste acceptance-database, `s313_blog_acceptance`, bleef beschikbaar voor de al draaiende echte HTTP-integratie en is door deze gates niet gewijzigd. De runner staat hard vast op de tweede databasenaam; hij accepteert geen vrije database-URL. Geen hosted doel, nieuwe container, imagepull, volume of clusterrol is gebruikt.

```bash
python3 scripts/s313-blog-database-acceptance.py --stage prepare
python3 scripts/s313-blog-database-acceptance.py --stage reset
python3 scripts/s313-blog-database-acceptance.py --stage test
```

De voorbereiding kopieerde alleen Supabase-schemadefinities, zonder appobjecten in `public`/`private`, migratiehistorie, gegevens, gebruikers, credentials of rollen. [base-manifest.json](base-manifest.json) bewijst de lege applicatiebasis. De officiële vastgezette Supabase CLI 2.109.1 voerde vervolgens deze commandoregels uit:

```bash
pnpm --config.verify-deps-before-run=false db:reset --db-url 'postgresql://postgres@127.0.0.1:64422/s313_blog_acceptance_final?sslmode=disable' --workdir /home/codex/.codex/worktrees/s313-blog-socialhero/castivo --yes
pnpm --config.verify-deps-before-run=false test:rls --db-url 'postgresql://postgres@127.0.0.1:64422/s313_blog_acceptance_final?sslmode=disable' --workdir /home/codex/.codex/worktrees/s313-blog-socialhero/castivo
```

Credentials bleven uitsluitend in childprocesvariabelen in het geheugen. `PGSSLMODE=disable` geldt alleen voor deze loopbackproef. De poortcontrole houdt de CLI buiten de container-resetcodeweg. De bestaande pg_prove-image was vooraf lokaal gecontroleerd. Geschoonde logs: [reset](reset-20261113T144325.log) en [volledige RLS-suite](rls-20261113T144354.log).

De voorafgaande gerichte SQL-proef gebruikte `docker exec -i supabase_db_veyocast-s295 psql -U postgres -d postgres -X -qAt -v ON_ERROR_STOP=1`, met uitsluitend `BEGIN`, `lock_timeout=5s`, `statement_timeout=60s`, de volledige nieuwe migratie en S313-testbron, gevolgd door `ROLLBACK`. Uitkomst: **131/131 groen**; de afsluitende `to_regclass`-controle bewijst dat geen blogtabel in de oorspronkelijke database achterbleef. Het [transactielog](transaction-131.log) bevat de assertions.

De oorspronkelijke `postgres`-database bleef ook na beide officiële gates identiek: 213 migraties tot `20261109000829`, geen blogtabellen, dezelfde gebruikers-/tenant-/Storage-aantallen en dezelfde rollenchecksum. [summary.json](summary.json) bevat beide snapshots, exacte commandoregels, UTC-tijden, exitcodes en SHA-256-waarden van de geteste bron. De finale migratiehash is `e7864fd76e5d88afc17fb288522a22c8ff8af9bc4f0180f96e646cc38dfa906a`.

De [onafhankelijke eindcontrole](security-review.md) beschrijft autorisatie, scopes, publieke revisiegrenzen, decoder/readback, idempotentie en validatorafstemming. De eerdere [cataloguscontrole](../catalog-security.json) toont de ongewijzigde ACL-/RLS-structuur; de globale volledige suite bewijst die op deze definitieve bron opnieuw. Beide eigen acceptance-databases blijven tijdelijk beschikbaar; verwijderen gebeurt uitsluitend na coördinatie met de bovenliggende integratieproef.

Na afronding van alle integratie- en workerwrites is met de integratieagent gecoördineerd uitsluitend `CREATE OR REPLACE private.blog_validate_payload` uit dezelfde finale migratie op `s313_blog_acceptance` toegepast. Er is geen reset of datamigratie uitgevoerd. Alle 16 gecontroleerde tabelaantallen en rij-digests bleven gelijk, waaronder 4 artikelen, 8 assets, 7 revisies, 8 Storage-objecten en 225 migratiehistorierijen. De functiehash `26ede8c800d99a567ee06f79f72cf0bb717f0d2beb326c27d37b26459cdf099d` is exact gelijk aan de uitkomst van de verse finale migratie. Het [afzonderlijke patchbewijs](active-integration-function-patch.json) bindt bron, commandoregel, snapshots en functiehashes. Daarmee gebruikt ook de opengehouden HTTP-backend de definitieve validator.
