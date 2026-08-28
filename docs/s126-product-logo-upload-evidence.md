# S126 productlogo-upload — releasebewijs

## Resultaat

`/dashboard/integrations/twelve-products` laat een bevoegde beheerder per
product een statisch JPEG-, PNG-, WebP- of veilig SVG-logo uploaden, vervangen
en loskoppelen. Het logo wordt als normaal tenantgebonden `media_asset` in de
private `tenant-media`-bucket opgeslagen en via de bestaande
`image_media_asset_id`-referentie aan het product gekoppeld.

Een nieuw logo wijzigt alleen de bewerkbare productcatalogus. Bestaande
dynamische snapshots, releases en last-known-good Playercontent blijven
immutable. Menu Studio en de Editorial Arena-prijslijst nemen het logo bij een
volgende render en expliciete publicatie via hun bestaande offline
release-assetketen mee.

## Security en data-integriteit

- De same-origin uploadroute valideert sessie, actieve tenant,
  `tenant.product.write` en `tenant.media.write` opnieuw op de server.
- De bestaande image-ingest controleert requestgrootte, MIME-signature,
  decoder-/pixellimieten en SVG active/external content, normaliseert rasterdata
  en schrijft alleen naar
  `tenants/{tenant_id}/assets/{asset_id}/...`.
- `public.set_tenant_product_logo_v1` gebruikt een expected revision, valideert
  `tenant.product.write`, actieve tenant en een ready, niet-verwijderd,
  statisch same-tenant media-item.
- De commandfunctie is `SECURITY DEFINER` met lege `search_path`; `PUBLIC`,
  `anon` en impliciete default-execute zijn ingetrokken en alleen
  `authenticated` krijgt execute.
- Upload, vervanging en verwijdering worden geaudit. Vervangen verwijdert het
  oude media-item niet stilzwijgend uit Media of uit historische releases.

## UX en toegankelijkheid

Iedere productregel toont een begrensde `object-fit: contain`-preview, tekstuele
status, gelabelde bestandskiezer, expliciete upload/vervang- en verwijderactie,
herstelgerichte foutmelding en serverbevestiging. Upload vereist product- én
mediarechten; verwijderen vereist productrechten. De flow blijft zonder
horizontale overflow bruikbaar op 390 px.

Visueel bewijs:

- `docs/screenshots/product-logo/twelve-products-logo-1440x900.png`
- `docs/screenshots/product-logo/twelve-products-logo-390x844.png`

## Verificatie

- nulmeting op `origin/main` (`78004c3`): workspace lint, typecheck, test en
  build groen;
- verse `pnpm db:reset`: groen;
- `pnpm test:rls`: 61 bestanden, 1.293 assertions, groen;
- lokale Supabase security-advisor: geen issues;
- Control lint/typecheck en 195 unit tests: groen;
- live Chromiumproductflow: echte upload, preview, preview na reload,
  verwijderen, desktop/mobile overflow en axe: groen;
- volledige a11y-suite: 36 groen, 1 expliciete live-skip;
- brede Chromium-suite: 35 groen, 11 expliciete live-skips en 2 algemene
  mobiele shelltests identiek rood aan de gedocumenteerde `origin/main`-
  baseline; geïsoleerde herhaling bevestigt dezelfde fouten en meetwaarden;
- workspace lint, typecheck, test en production build: alle 30/30, 30/30,
  30/30 en 18/18 taken groen; hosted deployment wordt in de releasehandoff
  vastgelegd.

## Migratie en rollback

De forward-only migratie voegt uitsluitend de nieuwe commandfunctie en ACL toe;
er is geen tabelbackfill of datamigratie. Applicatierollback activeert de vorige
immutable Control-image. De extra functie kan veilig aanwezig blijven omdat
oude applicatiecode haar niet aanroept en bestaande product-/releasegegevens
ongewijzigd blijven. Een database-downmigration is daarom niet nodig en wordt
niet tijdens een productionrollback uitgevoerd.
