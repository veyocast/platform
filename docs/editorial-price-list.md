# Editorial Arena — Prijslijst

## Productcontract

`price_list` is een capability-backed dynamisch slidetype. Het gebruikt de
bestaande tenantproductcatalogus (`manual_products` en `twelve_excel`) en maakt
geen tweede catalogus. De configuratie staat in
`dynamic_slides.configuration_json` en wordt aan beide servergrenzen met
hetzelfde strikte contract gevalideerd:

- titel en slidebrede fotomodus `show | hide`;
- één of meer stabiel geïdentificeerde categoriesegmenten;
- per segment kolom `left | right`, expliciete volgorde en fotomodus
  `inherit | show | hide`;
- per product een stabiele placement-id, centrale product-id, expliciete
  volgorde en optionele niet-destructieve overrides;
- maximaal 200 unieke zichtbare producten per prijslijst.

Een categorie kan bewust als twee segmenten worden opgeslagen wanneer de
beheerder producten over beide kolommen splitst. Een product kan niet tweemaal
worden geplaatst. Gelijke volgordewaarden gebruiken de placement-id als vaste
tie-breaker.

## Wizard en preview

De bestaande Slides-wizard toont alleen actieve, beschikbare producten uit de
gekozen tenantbron. De lijst is doorzoekbaar op categorie, naam en omschrijving.
De beheerder kan categorieën en producten selecteren, categoriesegmenten en
producten met toetsenbordbedienbare knoppen ordenen, een hele categorie links
of rechts zetten of producten afzonderlijk over beide kolommen verdelen.

De capaciteitskaart toont categoriesegmenten, producten, totaal gebruikte
rijen, pagina-1-bezetting en de vaste capaciteit. De live preview is de echte
`EditorialArenaRenderer`; de paginaknoppen besturen dezelfde resolved pages als
de Player.

## Vaste geometrie en paginering

`PRICE_LIST_METRICS` en `paginatePriceList` staan in `@veyocast/contracts` en
worden gebruikt door wizard, browserpreview, gewone Player en thumbnailworker.
De LG Legacy Player bevat een ES5-compatibele port met dezelfde regressietests.

| Formaat | Canvas | Kolommen | Rijhoogte | Capaciteit per kolom |
|---|---:|---:|---:|---:|
| Landscape | 1920×1080 | 864 + 64 + 864 px | 88 px | 9 rijen |
| Portrait | 1080×1920 | 476 + 32 + 476 px | 96 px | 17 rijen |

Een categoriekop, product en herhaalde vervolgkop kosten ieder één rij. Beide
kolommen pagineren afzonderlijk; pagina-indexen worden daarna gekoppeld. Er is
geen automatische balancering, geen tekstverkleining, geen clipping en geen
placeholderrij. Een nieuwe categoriekop blijft altijd bij minimaal het eerste
product.

## Foto- en offlinecontract

De effectieve fotostatus is:

1. categorie `show` toont een beschikbare foto;
2. categorie `hide` verbergt de foto;
3. categorie `inherit` volgt de slidebrede modus.

Het vierkante 64×64-slot blijft altijd bestaan. Bij `hide`, ontbrekende media,
offline ontbreken of een runtime laadfout bevat het slot geen afbeelding,
logo, icoon, initialen, kader of andere fallback. Daardoor blijven naam,
omschrijving en prijs exact op hun anker en ontstaat geen layout shift.

De snapshotbuilder zet `imageMediaAssetId` uitsluitend wanneer de foto
effectief zichtbaar is. De releasebouwer verzamelt vervolgens alleen deze
zichtbare productassets en het clublogo. Alle bytes worden zoals andere
dynamische assets vooraf gedownload, geverifieerd en lokaal afgespeeld; de
provider wordt nooit door de Player benaderd.

## Snapshot, last-valid en thumbnail

Snapshots blijven immutable en content-addressed. `generatedAt` is uitgesloten
van de inhoudshash, zodat een ongewijzigde productbron geen nieuwe snapshot,
render, release of download maakt. Als een geconfigureerd product verdwijnt,
archiveert of tenant-vreemd blijkt, slaat de automatische queue alleen deze
prijslijst over, zet `PRICE_LIST_CONFIGURATION_STALE` en behoudt de laatste
geldige snapshot. Een handmatige refresh faalt eveneens vóór een mutatie.

De mediaworker rendert pagina 1 met dezelfde centrale pagineerder als Player en
wizard. De resulterende tenantgebonden PNG blijft thumbnail en technische
compatibiliteitsfallback; normale playback blijft echte HTML/CSS.

## Database en beveiliging

Migratie `20260812232355_editorial_price_list.sql`:

- breidt uitsluitend bestaande slidetypeconstraints voorwaarts uit;
- registreert vier gepubliceerde Editorial Arena-templatevarianten;
- voegt een niet-publieke tenant-/bron-/product-/assetvalidator toe;
- bouwt de canonieke prijslist-snapshot uit integer centen;
- beschermt handmatige en automatische refresh met last-valid gedrag;
- hergebruikt bestaande RLS-tabellen en audit-/snapshotfuncties.

Er is geen nieuwe tabel of versoepelde policy. Herstel bestaat uit het
depubliceren van de vier templates en terugzetten van de vorige functionele
wrappers; bestaande immutable snapshots hoeven niet verwijderd te worden.

## Visueel bewijs

- [Dark landscape](screenshots/s103-editorial-arena-price-list-dark-landscape.png)
- [Light landscape](screenshots/s103-editorial-arena-price-list-light-landscape.png)
- [Dark portrait](screenshots/s103-editorial-arena-price-list-dark-portrait.png)
- [Light portrait](screenshots/s103-editorial-arena-price-list-light-portrait.png)
- [LG Legacy portrait](screenshots/s103-editorial-arena-price-list-lg-legacy.png)

Alle bestanden zijn op de exacte logische doelresolutie gemaakt. De
Playwrighttests controleren daarnaast één canvas, twee kolommen, afwezigheid
van canvasrendering, vaste canvasmaat en 9/17-rijpaging.
