# VeyoCast-blog en SocialHero — uitvoeringsdossier

Status: implementatie en lokale acceptatie met expliciete testadapter. De echte
Next-app, SocialHero-client en campagneworker zijn samen getest. Externe Auth,
Storage, staging en productieactivatie blijven afzonderlijke controles.

## Bronversies en omgeving

| Onderdeel | Vastgelegde bron |
|---|---|
| VeyoCast | `veyocast/platform`, main `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770` |
| Werkbranch | `veyocast/s313-blog-socialhero` |
| Overdrachtsprototype | bron `68cadfd0e997a32169dc40c2c9290eb0657f3b77`, Sites-versie 2; bijgeleverd manifest/bewijs onder `reference/` |
| SocialHero eerste audit | main `083b0d80b4231c0dc12e10340cb31e3434786f17` |
| SocialHero definitieve wijziging | `8e2cf198a3f7c537df44366e3cfd05d08588c301`, [concept-PR1](https://github.com/socialherodgweb/platform/pull/1); standaard CI groen |
| SocialHero actuele hercontrole | main `6ddc4be5cf74b113c186d4068ed18f87d71c37b6`; andere lopende werkbomen blijven intact |
| Lokale Marketing-proef | `http://127.0.0.1:9313`, Next.js `15.5.20`, omgeving `development` (lege runtime eerst `test`), site `veyocast` |
| Productiecanoniek | `https://veyocast.nl`; Control `https://control.veyocast.nl` |
| Staging | Control `https://staging-control.veyocast.nl`; standaard geen Marketing-service |

Het ZIP-pakket is een referentie. De demonstratieopslag, `blog-demo`-routes,
voorbeeldartikelen en gesimuleerde SocialHero-flow zijn geen productiebackend.
De oorspronkelijke briefing bevat generieke voorbeelden; deze uitvoering
gebruikt VeyoCast. De marketinghome blijft `/`; `/website` is uitsluitend de
Sites-democonventie.

## Routes en contract

| Oppervlak | Routes |
|---|---|
| Platformredactie | `/platform/blog`, `/platform/blog/preview/[externalId]` |
| Geauthenticeerde staff-API | `/api/platform/blog`, `/api/platform/blog/media` |
| Private editorbeelden | Control `/api/blog/media/[id]` |
| Publiek | Marketing `/blog`, `/blog/[slug]`, `/sitemap.xml`, `/api/blog/media/[id]` |
| Bestaand SocialHero-contract | Marketing `/api/socialhero/v1/capabilities`, `/media`, `/posts/[externalId]`, `/posts/[externalId]/publish` |

Contractversie is de string `1`. De bestaande SocialHero-client past direct.
De werkelijke schedulerkeys bevatten een slash (`sh_blog_<fingerprint>/hero`);
de ontvanger accepteert die syntax. De publieke head bevat één canonical en de
markers `socialhero:external-id` en `socialhero:revision`. SocialHero controleert
die zonder API-token voordat afhankelijke socialposts worden vrijgegeven.

Platform owner/admin krijgen `platform.blog.read`, `platform.blog.write` en
`platform.blog.publish`. Iedere staffrequest controleert de geverifieerde
identiteit; mutaties vereisen AAL2 en dezelfde origin. Demo bevat geen
redactiegegevens. Preview en private media gebruiken no-store/noindex.

## Opslag, revisies en herstel

De forward-only migratie is
`supabase/migrations/20261113124946_s313_blog_publication_kernel.sql`.
De nieuwe tabellen beginnen met `platform_blog_`; helperfuncties, credentialhashes,
ratecounters en idempotencyreceipts staan in `private`.

Een artikel heeft een stabiele ID/externalId, immutable revisies en afzonderlijke
draft-/publishedpointers. De gedeelde slugruimte bevat actuele en historische
reserveringen. Titelwijzigingen houden de bestaande slug; een bewuste nieuwe
slug wordt pas bij publicatie canoniek. Historische routes verwijzen permanent
rechtstreeks naar de actuele route.

Methode, target, inhoud en preconditie maken samen de receiptfingerprint.
De transactie reserveert/lockt de key vóór de mutatie en herhaalt het originele
resultaat vóór een nieuwe revisiecontrole. Een gewijzigde payload geeft conflict.
Staffpublicatie hervat de opgeslagen save- en publishstappen met dezelfde keys.
Publieke index, detail, metadata en sitemap lezen zonder gedeelde runtimecache.
Een herstart na databasecommit verliest daardoor geen invalidationstaak.

Platformmedia passen niet binnen de bestaande tenantopslaggrens. De bestaande
Supabase Storage wordt daarom hergebruikt met een aparte private bucket
`platform_blog_media` en paden
`platform/{site}/{environment}/assets/{assetId}/original.{ext}`. De server
controleert bytes, MIME, volledig decoderen, afmetingen, enkel frame en maximaal
8 MiB/10.000 px/40 megapixels. Sharp verwijdert metadata en bewaart JPEG/PNG/WebP
als hetzelfde MIME-type. Een duurzame intent reserveert het object vóór upload;
de server verifieert opgeslagen bytes en checksum vóór completion. Menselijke
completion is uitsluitend via een serverattestatie met dezelfde actor mogelijk.
Alleen mediareferenties van de actuele gepubliceerde revisie zijn publiek.

Een applicatierollback laat deze additieve databasehistorie intact. Stop nieuwe
blogwrites bij rollback; verwijder geen revisies, receipts, slugs of assets.
De bestaande releaseflow voert migration dry-run/apply uit vóór activatie.
Geen deployworkflow is gewijzigd.

## Configuratie en credentials

Gebruik uitsluitend voorbeeldwaarden in documentatie en configuratievoorbeelden.

```dotenv
VEYOCAST_ENVIRONMENT=development
VEYOCAST_BLOG_SITE_ID=veyocast
VEYOCAST_BLOG_PUBLIC_ORIGIN=http://127.0.0.1:9313
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<local-api-port>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-local-key>
```

Zonder bestaande configuratie gelden `nl-NL`, auteur VeyoCast en blogpad `/blog`.
Productie gebruikt de geverifieerde origin `https://veyocast.nl`; development
gebruikt standaard `http://localhost:3002`. Staging vereist een expliciet
ingerichte marketingtestorigin en blijft noindex. De runtime- en databaseorigin
moeten overeenkomen. De Compose-aanpassing geeft Marketing ook de bestaande
anon-key voor publieke RLS-queries; secrets worden niet naar clientcode gestuurd.

Een platform owner/admin met AAL2 configureert de site via
`blog_configure_site(site, environment, public_origin)` en beheert credentials met
`blog_manage_token`. Scopes zijn `capabilities:read`, `posts:read`, `media:write`,
`posts:write`, `posts:publish`. Een credential is site-/omgevingsgebonden,
verloopt en kan afzonderlijk worden ingetrokken/geroteerd. Alleen de hash wordt
opgeslagen. Geef plaintext uitsluitend aan SocialHero's bestaande servervault.

SocialHero bewaart verbinding, goedgekeurde revisie, duurzame operationkeys en
de bestaande werkvoorraad al server-side. De bestaande AI-configuratie wordt
hergebruikt; deze taak vereist geen nieuwe OpenAI-key.

## Uitgevoerde controles

| Commando / proef | Uitkomst |
|---|---|
| `pnpm lint --concurrency=1` | 32/32 taken groen; inclusief dependencybuilds, deels expliciete Turbo-cache |
| `pnpm typecheck --concurrency=1` | 32/32 taken groen |
| `pnpm test --concurrency=1 --output-logs=errors-only` | 32/32 taken groen na materialiseren van het oorspronkelijke tracked Menu-PNG dat de sparse checkout oversloeg |
| `cd packages/blog && ../../node_modules/.bin/vitest run` | document 16 en media 15 gericht groen; media bevat echte decode-/integriteitsproeven |
| `cd apps/marketing && ../../node_modules/.bin/vitest run app/api/socialhero/v1/contract.test.ts` | 9/9 HTTP-contractproeven groen; geïsoleerde backendmock, geen echte websitekoppeling |
| Gerichte Control Vitest, `tsc --noEmit --incremental false`, ESLint | 57/57 groen; sessie/AAL2/Origin/rate/actor/retry/private-media-grenzen |
| Gerichte Marketing renderer/routing/SEO/sitemaptests | 18/18 renderer/routing groen; daarnaast 9 API- en 2 UUID-regressies groen; typecheck en lint groen |
| S313 migratie + pgTAP in `BEGIN … ROLLBACK` | 131/131 groen; daarnaast verse reset met 225 migraties + seed en volledige RLS 159 bestanden/5607 assertions, zie `evidence/database/final/README.md` |
| Echte twee-sessie-Postgresproeven | 8/8 met waargenomen lock-wait; aparte schema-only racedatabase daarna verwijderd |
| `bash scripts/validate-vps-deployment.sh` | groen, waaronder 254 bestaande deploy-/veiligheidsproeven; geen deployment uitgevoerd |
| `pnpm test:a11y --config /tmp/s313-marketing-a11y.config.ts --project=chromium` | 3/3 bestaande Marketing home/privacy/data-verwijderen groen; testMatch en lokaal beschikbare Chromium1254 expliciet geselecteerd |
| Nieuwe publieke browseracceptatie | 6/6 native/baseline/lege Next plus 1 gepubliceerde Next-proef groen; 15 axe-scans zonder overtredingen, zie `evidence/browser/README.md` |
| Control-editorbrowser | 4/4 groen; 24 captures, typen/plakken/tabellen/upload/undo/redo/save/reopen/readonly/focus en 4 axe-rapporten, zie `evidence/browser-control/README.md` |
| Echte client→Next→PostgreSQL-keten | 22/22 groen ; 3 after-COMMIT-procesherstarts, actuele lijst/detail/sitemap en redirects |
| Echte campagneworker→Next | prepare/publish/resume in 3 processen groen; dezelfde operatiekeys, één publicatie/receipt, social wacht op verificatie; [bewijs SocialHero](https://github.com/socialherodgweb/platform/blob/codex/veyocast-blog-integration/docs/veyocast-blog-evidence/README.md) |
| Definitieve Control-productiebuild | Groen inclusief dynamische authroute- en clientbundle-secretcontrole; laatste editorcontrastfix inbegrepen |
| Bestaande Control-shell-a11y | 26 unieke cases groen na infrastructuurherstel (10+15+1); zie `evidence/build-and-gates.md` |
| Finale `pnpm test:e2e` fixtureselectie | 9/9 groen in 26,7s; echte Next-keten afzonderlijk getoetst |
| Marketing-productiebuild en clientbundel-secretcontrole | Groen; na Next-herstart alle 4 publicaties, echte verifier, sitemap, uppercase media en malformed multipart422 opnieuw gecontroleerd |

De brede eerste testpoging faalde op het ontbrekende, bestaande
`docs/implementation/s292-dom-ready-recovery/menu-landscape-light.png`.
Dit was een sparse-checkoutomissie. Het bestand is bytegelijk uit de basiscommit
gematerialiseerd; geen bestaande test is afgezwakt. De daaropvolgende brede
testgate is groen. Een eerdere dependencylinkfout ontstond door lokale
dependencyhergebruik; die is hersteld en de finale foundationgates zijn opnieuw
uitgevoerd. De gedeelde werkhost liep meermaals vol; broncode en databasevolumes
van andere projecten zijn niet opgeruimd.

De eerste extra a11ystart vond de door de gedeelde Playwright-versie verwachte
browserbinary niet en werd afgebroken vóór browseruitvoering. Een tijdelijke
config behield de bestaande Marketing-tests en gebruikte de aanwezige Chromium
headless shell 1254. Na correctie van het absolute testDir slaagden alle3 tests.
Dit bewijst de Marketing-selectie; de volledige bestaande Control-/Player-UI-suite
is daarmee niet uitgevoerd.

## Open acceptatie en release

- De browsereditor is als native Control-componentfixture getest met echt
  TipTap en expliciet fixturetransport. Een geauthenticeerde redacteur tegen
  een echte Supabase Auth-/Storage-gateway blijft een afzonderlijke controle.
- De echte SocialHero-wizard in een geauthenticeerde browser en een extern
  gehoste testwebsite zijn niet als voltooid geclaimd. De bestaande AI-config
  is hergebruikt; de proef gebruikte goedgekeurde testinhoud zonder AI-verzoek.
- Socialprovideradapters ontbreken op de bronbasis. De hosted queueguard gaf
  na websiteverificatie terecht `PROVIDER_NOT_CONFIGURED`; geen socialpost is
  werkelijk verzonden. De guard is lokaal met een expliciete omgevingsinjectie
  getest, zonder verkeer naar staging of productie.
- Productie is niet geselecteerd. Het standaard stagingprofiel bevat geen
  Marketing-app. Richt vóór activatie een afzonderlijke testorigin in en
  configureer dezelfde origin/site/omgeving in database, runtime en SocialHero.
- PR/CI en finale bron-SHA's worden bij de Git-oplevering vastgelegd. Er is
  geen merge, stagingactivatie of productiedeployment uitgevoerd.

Zie [acceptatieresultaten](ACCEPTATIE-RESULTATEN.md) voor de controle per eis.
De actieve integratiedatabase kreeg na de ketenproef uitsluitend de finale
validatorfunctie; alle 16 tabeldigests bleven gelijk. Het verse volledige
RLS-bewijs draait op de afzonderlijke finaledatabase. De originele database en
broncode in andere werkbomen zijn niet gewijzigd.

## Technische referenties

- [TipTap 3 node-schema](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
- [Google Article-gegevens](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google sitemaprichtlijnen](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Next.js 15 revalidatePath](https://nextjs.org/docs/15/app/api-reference/functions/revalidatePath)
- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
