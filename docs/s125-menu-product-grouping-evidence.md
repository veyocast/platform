# S125 — Twelve-productselectie zonder verplichte broncategorieën

Auditdatum: 2026-08-26  
Baseline: `9f2e2375734a91a6abfa1375d93dd9d3189de595` (`origin/main`)  
Werkbranch: `veyocast/s125-menu-product-grouping`

## Oorzaak en contract

- Een klik op een Twelve-product riep altijd `categoryBlock(product)` aan. Daardoor
  werd de broncategorie ongevraagd een presentatiestructuur.
- De categoriepicker kende uitsluitend de plaatsingsmodus “categorieblok”.
- De gedeelde MenuScene-renderer gaf `.productGroup` een alternatieve achtergrond,
  96 px rijhoogte en extra padding, terwijl een productrij 78 px gebruikte.
- MenuDocument v2, revision-checked autosave, immutable publicaties en de gedeelde
  Control/Player-renderer blijven leidend. Er is geen schema- of RLS-wijziging
  nodig: de additieve presentatievelden staan in het bestaande versioned JSON-document.

## Implementatie

- Twelve-categorieën zijn standaard alleen nog een selectiefilter; bulkselectie
  plaatst producten in een koploze productstroom.
- De gebruiker kan expliciet kiezen voor afzonderlijke Twelve-categorieblokken.
- Een product kan los of in een bewust gemaakte eigen categorie worden geplaatst.
- Bestaande automatisch opgesplitste categorieën kunnen met één omkeerbare editoractie
  tot losse producten worden samengevoegd. Meer dan 100 producten worden verliesvrij
  over interne koploze blokken verdeeld.
- Koploze stromen verdelen hun regels op kosten over twee kolommen in landscape en,
  tenzij de gebruiker één kolom afdwingt, portrait.
- Productgroepen gebruiken exact dezelfde rijachtergrond, padding en minimumhoogte
  als gewone producten. De statische LG Legacy-renderer gebruikt dezelfde semantiek
  en telt een groep ook als één rij. Beschikbaarheid en inhoud blijven behouden.

## Bewijs

- contracts: koploze stroom toegestaan; zichtbare kop in column-flow afgewezen;
- renderer: acht losse producten renderen 4 + 4 zonder categoriekoppen in beide
  oriëntaties;
- Control broncontract: losse default, expliciete broncategorieoptie, eigen categorie,
  samenvoegactie en uniforme groepsstijl;
- de statische Chrome 79/LG-route toont eveneens twee gelijke kolommen zonder kop;
- meer dan 100 producten worden via interne blokken volledig behouden;
- screenshots:
  - `docs/screenshots/s125-menu-loose-portrait.png`;
  - `docs/screenshots/s125-lg-menu-loose-portrait.png`.

Lokale gates:

- frozen install: groen, lockfile ongewijzigd;
- workspace lint: 30/30;
- workspace typecheck: 30/30;
- workspace unit: 30/30 (onder meer contracts 47, content templates 42,
  Control 192 en Player 164);
- workspace production build: 18/18;
- a11y: 36 groen, 1 expliciet lokale-Supabase-fixture-skip;
- Playerbrowser: 99/99;
- Player offline: 7/7;
- Menu Studio visueel: 40/40 goldens plus 3/3 gerichte browserchecks;
- LG Legacy gericht: bestaande brede portraitflow en nieuwe losse 2-kolomsflow groen;
- algemene E2E: 35 groen, 10 expliciete live-fixtures overgeslagen, 2 mobiele
  shellscrolltests rood. Beide falen identiek op de ongewijzigde baseline-SHA en
  zijn daarmee aantoonbaar pre-existing S124, buiten deze Menu Studio-diff.

## Deployment

- Staging SHA/status: open
- Production SHA/status: open
- Geen migratie of featureflag vereist; dezelfde immutable artifact lineage wordt
  via de officiële `deploy.yml`-workflow gebruikt.
