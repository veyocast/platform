# ADR 0014 — Menu Studio v2 als versioned document en gedeelde scene

- Status: accepted
- Datum: 2026-08-21
- Scope: Control Menu Studio, dynamische prijslijsten, browser/LG Player,
  thumbnails, mediareferences en Supabase/RLS

## Aanleiding en discovery

De v2.0-handoff vraagt om één productiecontract voor menu-authoring en
rendering. De actuele repository bevat daarvoor al de volgende leidende
bouwstenen:

- `THEME-MANIFEST.v1.json` en `theme-catalog.ts` zijn de enige registry voor
  exact `editorial`, `obsidian`, `atelier`, `velocity`, `heritage`, `halo`,
  `swiss`, `pavilion`, `tactical` en `terrace`. Fontbytes, licenties, motion,
  light/dark en logical canvassen zijn reeds lokaal en versioned.
- `EditorialArenaRenderer` is de gedeelde React-DOM-grens voor Control-preview,
  browser-Player en de primaire Chromium-thumbnail. De LG Legacy-runtime heeft
  wegens de oude webOS-browser een afzonderlijke, contractgeteste adapter.
- `dynamic_slides.configuration_json` is mutable draftstate met een revision;
  `dynamic_slide_snapshots` en playlist releases zijn immutable. De bestaande
  `price_list`-configuratie kent alleen categorie- en productplacements en de
  create-RPC maakt direct een snapshot.
- Prijslijsten hebben vier gepubliceerde templatevarianten (light/dark ×
  landscape/portrait). Er is geen automatische migratie of gebruiksconversie
  voor bestaande slides; productieaantallen zijn geen voorwaarde voor een
  additieve dual-reader.
- De bestaande Studio heeft commandhistory, maar de twee prijslijsteditors
  hebben ieder eigen lokale mutatielogica. Menu Studio gebruikt voor de
  elementenbibliotheek native `DataTransfer`-drag/drop plus dezelfde expliciete
  click/tap- en toetsenbordcommando's; alle invoerpaden komen in één reducer uit.
- Tenantmedia gebruikt private Storage, content-addressed varianten, RLS en de
  bestaande worker. De huidige ingestallowlist is JPEG/PNG/WebP en MP4; v2
  breidt deze pipeline gecontroleerd uit voor GIF/SVG en WebM, zonder blobs,
  externe provider-URL's of service-rolecode in de browser.
- De Player verzamelt snapshot-assets in een checksumgebonden release-envelope,
  downloadt eerst volledig en behoudt last-known-good. Dat contract blijft de
  enige activatiegrens.

De prototypebron uit de handoff is uitsluitend gedrags- en art-directionbewijs.
De lokale blobs, demo-auth, willekeurige ID's, vrije pixelcanvasinteractie en de
foutieve portretschaal worden niet overgenomen.

## Besluit

### Eén documentcontract

`MenuDocument.v2` (`schemaVersion: "menu-document.v2"`) wordt het enige nieuwe
authoring- en snapshotcontract. Het model volgt het meegeleverde JSON-schema:
pages met gestructureerde category-, product-group-, image-, video-, logo-,
text- en promo-blocks; stabiele product/providerrefs; mixed linked/free
subregels; orientationlayouts; immutable assetrefs; provider- en
publicationmetadata. De Zod-validator is strict en dwingt daarnaast de
repo-invarianten af: unieke IDs, unieke gekoppelde productrefs, geordende
placements, twee geldige orientations, veilige prijzen in minor units en
free-text zonder provider-, prijs- of voorraadvelden.

Een pure commandlaag is de enige mutatiegrens voor click/tap, toetsenbord en
drag. Ieder persistent commando draagt `baseRevision` en `operationId`; de
server herbouwt en valideert de kandidaat volledig in één tenantgebonden
transactie. Clienthistory is begrensd en wordt na een bevestigde save opnieuw
gebaseerd. Een stale write geeft `40001`, nooit last-write-wins.

### Draft, preview en publicatie

Nieuwe Menu Studio-documenten worden als `dynamic_slides` met status `draft`
gemaakt zonder snapshot. Save/autosave wijzigt alleen de mutable configuratie
en revision. De expliciete publiceer-RPC valideert tenant, bron, producten,
prijzen, assets, feature flags en expected revision, en roept daarna de
bestaande immutable snapshotketen aan. Playlistreleases en Playeractivatie
blijven ongewijzigd.

Een append-only operationstabel bewaart idempotency, basis-/resultaatrevision,
commandpayload en actor. Rechtstreekse Data API-writes zijn ingetrokken; reads
volgen bestaande tenant-RLS, writes lopen uitsluitend via fail-closed RPC's met
lege `search_path`, capabilitychecks en audit-events.

### Gedeelde renderer en portret

`MenuScene` wordt door preview, Player en primaire thumbnail aangeroepen. De
scene gebruikt exact één logical canvas (1920×1080 of 1080×1920), één
`ResizeObserver` en één uniforme contain-scale. Portrait gebruikt de bindende
zones x=72/y=96/w=936/h=228 voor header, x=72/y=348/w=936/h=1388 voor body en
x=72/y=1760/w=936/h=64 voor footer. De conservatieve, deterministische
pagineerder splitst categorieën alleen tussen rijen, markeert `— vervolg` en
voorkomt waar mogelijk 1–2 wezen. Na `document.fonts.ready` meet `MenuScene`
de echte DOM-rijen en -kolommen; meetbare overflow wordt fail-visible aan de
editor gerapporteerd en is in de volledige 10×2×2-browsermatrix uitgesloten.
Tekst- en subregellimieten vormen de server-side grens die stil afkappen
voorkomt. Deze meetsemantiek is bevroren als `dom-measured-2.0.0`.

Thema's leveren uitsluitend manifesttokens en decorations; content blijft
theme-onafhankelijk. Normale Playerplayback behoudt alleen de reeds locked
VeyoCast-lock-up linksonder op 40% opacity. Editoroverlays en selectiechrome
komen niet in snapshots.

De LG Legacy-adapter leest dezelfde resolved pages, theme-ID's, assetmanifesten
en layoutmetrics. Bij ontbrekende capability of een incomplete/corrupte bundle
activeert de Player geen nieuwe release en blijft de laatste geldige release
staan.

### Media en productgroepen

Menu Studio kiest en uploadt via de bestaande private tenantmediapipeline.
JPEG/PNG/WebP/GIF/SVG en MP4/WebM worden op extensie, bytes, MIME, afmetingen,
duur en limieten gecontroleerd. SVG wordt vóór verwerking fail-closed
gesanitized; GIF/SVG krijgen een veilige Playervariant en video wordt naar de
bestaande MP4-playergrens genormaliseerd met poster. Alleen `ready` assets met
tenantgebonden varianten mogen in een document of snapshot voorkomen.
Statische rasterbronnen krijgen naast het immutable origineel een begrensde
WebP-thumbnail; gesanitized SVG krijgt een gerasterde PNG-thumbnail. Het
bestaande media- en Storage-model blijft leidend en kent daarom alleen
`original`, `thumbnail` en `player_1080p`.

Productgroepen ondersteunen gemengde `linked-product`- en `free-text`-regels.
Alleen gekoppelde regels dragen prijs/availability/providerrefs. `shared` is
alleen geldig wanneer alle gekoppelde prijzen exact dezelfde currency,
amountMinor, taxMode, taxRateBps en unitKey hebben; `from` gebruikt de laagste
gekoppelde prijs; `separate` toont prijzen per gekoppelde regel. Vrije tekst kan
die beslissing nooit beïnvloeden of maskeren.

### Compatibiliteit en rollout

De bestaande `price_list`-reader blijft byte-/pixelcompatibel. Een v1-config
wordt alleen in-memory als v2 geopend en pas na een expliciete, revision-checked
save geconverteerd; er is geen backfill, republish of mutatie van actieve
releases. Nieuwe snapshots bevriezen documentrevision, renderer-, contentfit-,
theme-manifest- en assetmanifestversie.

Tenantflags voor read, authoring, linked groups, media, publish en Player-bundle
staan standaard uit. Authoring en publish vereisen de relevante flags; eenmaal
gepubliceerde immutable releases blijven na een flagrollback afspeelbaar om
last-known-good niet te breken. Activatie is per tenant en staat los van de
code-/migratiedeployment.

De repository heeft geen `origin/staging`-branch. S112 is daarom vanaf de
actuele staging-equivalente deploymentbasis `origin/main` gestart. Integratie en
deployment volgen de beschermde main-workflow; een losse featurebranch mag niet
rechtstreeks naar staging of production worden uitgerold.

## Migratie en rollback

De migratie is additief en idempotent: featureflagkolommen, operationlog,
validatiehelpers en versioned RPC's. Geen tabel of kolom wordt verwijderd en
geen bestaande configuratie wordt herschreven. Rollback zet eerst publish en
authoring uit; nieuwe draftdata blijft leesbaar. Reeds gepubliceerde snapshots,
release-items, assetvarianten en last-known-good caches worden nooit verwijderd
of gemuteerd.

## Bestandsownership voor S112

S112 mag wijzigen:

- `packages/contracts/src/menu-studio.ts` en contractexports/tests;
- `packages/domain/src/menu-studio.ts`, domeinexports/tests, de workspace-link
  naar `@veyocast/contracts` en de bijbehorende package-boundaryregel;
- `packages/content-templates/src/menu-*`, de bestaande gedeelde
  dynamic-template/rendererintegratie en gerichte tests/goldens;
- `apps/control/app/(shell)/dashboard/slides/menu-studio/**`, de Slides-ingang,
  gerichte Control-stijlen/actions/data/tests;
- de Player assetcollector, LG Menu Studio-adapter en de bij acceptatie
  gereproduceerde recovery-heartbeat met gerichte tests;
- media-ingest/workerbestanden die voor de vastgelegde MIME-uitbreiding nodig
  zijn;
- één nieuwe Supabase-migratie en gerichte RLS-tests;
- S112-prompt, runbook, test-/evidencerapport en `TASK_LEDGER.md`;
- `apps/control/package.json`, root-`package.json` en `pnpm-lock.yaml` voor de
  kleinste noodzakelijke, vastgepinde runtime-/acceptatiedependencies:
  `@xmldom/xmldom@0.9.11`, `sharp` en test-only
  `@axe-core/playwright@4.13.0`.

De externe dependencies zijn nodig voor respectievelijk structurele
SVG-sanitization, server-side thumbnailnormalisatie en de bindende axe-acceptatie
in een echte browser. Workspacebestanden, tokenpakket, bestaande migraties,
generated Supabase-types, service-workerbestanden en merkassets blijven buiten
ownership. Een noodzakelijke wijziging daar is stop-and-report.

## Acceptatie

Naast de repositorygates moeten schema/commands/pricing, 10×2×2 Menu Scene
goldens, exacte portraitzones, mixed subregels, assetisolatie/MIME/SVG,
revision/idempotency, tenant A→B, browser/LG envelope, incomplete bundle en
offline last-known-good groen zijn. Een productiondeploy promoveert exact
dezelfde geteste SHA als staging; featureactivatie blijft een afzonderlijke,
tenantgebonden handeling.
