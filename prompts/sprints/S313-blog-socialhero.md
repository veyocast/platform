# S313 — Platformredactie en SocialHero-publicatie

De actuele gebruikersopdracht voegt het platformbrede VeyoCast-blog toe en
verbindt dit met het bestaande SocialHero v1-contract. Het aangeleverde pakket
onder `docs/s313-blog-socialhero/reference/` is ontwerp- en acceptatiereferentie;
de oorspronkelijke generieke briefing is context. Er wordt geen Sites-demo,
SQLite-opslag of browsercredential naar de productieruntime overgenomen.

## Bron en ownership

- Basis VeyoCast: main `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`.
- Branch: `veyocast/s313-blog-socialhero`; eigen managed worktree.
- Root: nieuwe `packages/blog`, Marketing-runtimebron en SocialHero-routes,
  package manifests/lockfile, Next-config, noodzakelijke Compose-omgeving,
  secretgrensregistratie, eigen documentatie/ledger en integratieacceptatie.
- Databasewriter: één nieuwe S313-forwardmigration, eigen pgTAP en de drie
  platformblogcapabilities met tests.
- Marketingwriter: `apps/marketing/app/blog/**`, sitemap, gerichte
  catch-all/blogverwachtingen en bestaande Marketing-navigatie; eigen mediahelper
  en gerichte browserfixtures/bewijs.
- Controlwriter: `platform/blog/**`, eigen blogservice/staff-API/private media,
  gerichte platformnavigatie en tests.

Geen Player-, immutable playlistrelease-, tenantmedia-, brandmaster-,
service-worker- of deployworkflowwijziging. De dependencytaak omvat TipTap
3.33.1 volgens de referentie, de gedeelde blogpackage en de Markdown-parser.
De bestaande dependencies houden hun vastgezette versies.

## Uitvoering en releasegrenzen

Artikelen, revisies, slugs, mediatoegang en idempotentie zijn site- en
omgevingsgebonden. Menselijke mutaties gebruiken de bestaande geverifieerde
sessie, capabilities, AAL2 en RLS. Media completion vereist een serverattestatie
na decode en opslagreadback. Tokencredentials staan uitsluitend gehasht in de
private database; SocialHero houdt de plaintext in zijn bestaande servervault.

De openbare blog leest de huidige gepubliceerde revisie per request zonder
response-/datacache. Daardoor vereist een bevestigde databasepublicatie geen
procesgebonden cache-invalidation om zichtbaar te worden. Oude slugs lossen
rechtstreeks op naar de huidige canonieke slug.

Staging bevat standaard geen Marketing-service. De acceptatiebestemming is
voorlopig lokaal; productie vereist een afzonderlijk gekozen omgeving en alle
normale gates. Geen bestaande database resetten. Zie het uitvoeringsdossier.
