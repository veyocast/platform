# Editorial Arena discovery

Status: 2026-08-03  
Branch: `veyocast/s91-editorial-arena`

## Besluit

`editorial-arena` wordt de enige zichtbare dynamische slidethemaregistry.
De Player rendert deze slides als vertrouwde React/HTML/CSS op een vast logical
canvas van 1920×1080 of 1080×1920. De bestaande checksum-geverifieerde PNG blijft
uitsluitend een offline/compatibiliteitsfallback en lijstthumbnail; hij is niet
de primaire slide.

Een template wordt alleen gepubliceerd wanneer de huidige repository een
server-side bron, gevalideerde mapper, genormaliseerde tenantdataset,
stale/errorstatus en fixture-/gedragstests bezit. Een geslaagde sync van de
vereiste datasetgroepen blijft daarnaast de tenantgebonden runtime-gate in de
wizard.

## Huidige registry

De bestaande registry staat in `dynamic_templates` en
`dynamic_template_versions`. De historische migraties publiceren meerdere
losse families:

- `menu-*`, `news-*`;
- `sportlink-*-match-centre-*`;
- oudere `sportlink-*-{landscape,portrait}`-templates;
- `sportlink-standing-club-edition-dark-*`;
- RSS portrait/landscape-varianten.

De UI vraagt alle `published` templates op en gebruikt de slug om light/dark af
te leiden. Daardoor zijn legacyvarianten naast elkaar zichtbaar. Nieuwe
Editorial Arena-versies krijgen de canonieke slug:

`editorial-arena-{templateId}-{dark|light}-{landscape|portrait}`.

Na de migratie zijn alleen deze slugs `published`. Historische templateversies
blijven bestaan voor audit en immutable releases, maar zijn niet meer
selecteerbaar. De vertrouwde Player-runtime kiest uitsluitend op gevalideerd
`slideType`, modus en oriëntatie en bevat geen uitvoerbare templatebron.

## Capability-audit

| Editorial Arena | Intern type | Bron en genormaliseerde data | Gate | Uitkomst |
|---|---|---|---|---|
| Menubord | `menu` | handmatige/Twelve Excel-productbron → `tenant_products` | bron bevat beschikbaar product | actief |
| Nieuws | `news` | veilige server-side RSS/Atom-sync → `dynamic_news_articles` | RSS heeft geslaagde sync en artikel | actief |
| Clubagenda | `sport_activities` | Sportlink `verenigingsactiviteiten` → `sports_activities` | dataset `activities` geslaagd | actief |
| Afgelastingen | `sport_cancellations` | Sportlink programma/uitslagen/afgelastingen → `sports_matches` | `matches` en `teams` geslaagd | actief |
| Competitiestand | `sport_standing` | teams/poules/poulestand → `sports_standings` | `competitions` geslaagd | actief |
| Veld- en kleedkamerindeling | `sport_dressing_rooms` | wedstrijdinformatie → genormaliseerde `sports_matches.dressing_rooms` | `match_details` en `teams` geslaagd | actief |
| Match of the Day | `sport_match_of_the_day` | wedstrijddata bestaat | expliciet uitgesloten door opdracht | verborgen |
| Periodestand | `sport_period_standing` | registry kent endpoint, worker haalt alleen algemene `poulestand` op | geen periodestand-sync/fixture end-to-end | verborgen |
| Programma | `sport_program` | Sportlink programma → `sports_matches` | `matches` en `teams` geslaagd | actief |
| Uitslagen | `sport_results` | Sportlink uitslagen → `sports_matches` | `matches` en `teams` geslaagd | actief |
| Teamsponsor | `sport_sponsor` | registry kent `team-sponsors`; worker synchroniseert deze capability niet | geen genormaliseerde sponsorflow | verborgen |
| Teamvoorstelling | `sport_team` | alleen teamrecords; geen roster/deelnemerssync | geen complete spelersflow | verborgen |
| Trainingsoverzicht | `sport_trainings` | registry kent trainingen; worker synchroniseert alleen verenigingsactiviteiten | geen gevalideerde trainingsflow | verborgen |
| Jarigen | `sport_birthdays` | officieel `verjaardagen`-artikel → tenantgebonden 21-dagen-LKG met exacte teamverrijking | expliciete verjaardagactivatie en eerste succesvolle dagelijkse sync | actief |
| Volgende wedstrijd | `sport_next_match` | toekomstig programma → `sports_matches` | `matches` en `teams` geslaagd | actief |
| Vrijwilligers | `sport_volunteers` | registry kent vrijwilligers; worker voert `volunteers` niet uit | geen werkende vrijwilligerssync | verborgen |
| Scheidsrechtersaanstellingen | `sport_officials` | wedstrijdinformatie → `sports_matches.officials` | `match_details` en `teams` geslaagd | actief |

Het pakket bevat voor alle zeventien types visuele referenties. Alleen de tien
regels met uitkomst `actief` worden als live tegel gepubliceerd. De overige
zeven zijn niet disabled maar volledig afwezig uit de nieuwe-slideflow.

## Provider- en data-audit

### RSS

`safe-rss-fetch`, `rss.ts`, de mediaworker en tests begrenzen redirects, SSRF,
XML, HTML-tekst en media. De server synchroniseert naar genormaliseerde
artikelen; de Player belt de feed nooit. Providerlogo en hero-afbeeldingen
worden als media-assets in de immutable release-envelope opgenomen. Een
mislukte refresh behoudt de laatste goede snapshot.

### Producten en Twelve

Er is geen verzonnen Twelve-API: de ondersteunde Twelve-route is de bestaande
Excel-import naast handmatige producten. Beide normaliseren naar
`tenant_products`. Naam, omschrijving, categorie, prijs, unit/variant en
optionele afbeelding zijn veilig tenant-scoped. De renderer verbergt een
ontbrekende afbeelding en toont de kleinere variantregel alleen wanneer data
bestaat.

### Sportlink

De Player doet geen Sportlink-calls. De server-only client gebruikt uitsluitend
de geregistreerde Club.Dataservice-artikelen. De worker implementeert
`club_profile`, `teams`, `competitions`, `matches`, `match_details`,
`activities` en het geminimaliseerde verjaardagspad binnen `public_people`;
`volunteers` blijft bewust uitgeschakeld. Het verjaardagspad heeft een eigen
privacy-activatie en vereist geen Token Club.Data.

Teamlogo-URL's worden wel gevalideerd in de mapper, maar nog niet als canonical
providerasset opgeslagen. De Editorial Arena-renderer gebruikt daarom het
veilige initialenschild. Dit voorkomt een onjuiste live claim; tenant override
en globale providerasset blijven verborgen tot de volledige assetflow bestaat.

## Wizard-audit

De bestaande wizard is een vijfstapsflow met broncompatibiliteit,
dataset-success-gates, team/competitie/seizoensselectie, server-side
hervalidatie en een immutable eerste snapshot. De huidige preview is een
aparte schematische miniatuur en templates worden direct uit alle published
registryregels opgebouwd.

Aanpassing:

- één typed Editorial Arena-registry bepaalt labels, capabilitygroepen en
  zichtbaarheid;
- dark/light zijn modi van hetzelfde thema; er is geen themekiezer;
- de templatekeuze bevat alleen modus en oriëntatie;
- veldlimieten blijven client- én server-side afgedwongen;
- team/competitie blijft alleen zichtbaar voor match- en standdata;
- seizoen blijft alleen zichtbaar voor de competitiestand;
- maximaal 18 rijen in portrait stand en maximaal 10 in landscape per pagina;
- RSS heeft 1–12 artikelen en 5–120 seconden per artikel;
- MOTM en de zes incomplete capabilities komen niet in de dropdown.

## Renderer-audit

De huidige Player rendert dynamische payloads al als vertrouwde React/HTML/CSS
en gebruikt de PNG alleen wanneer de payload ontbreekt of niet wordt
ondersteund. De actuele markup en CSS hebben echter verschillende legacy
families voor nieuws, stand en generieke sportlijsten.

Aanpassing:

- één `DynamicTemplateMedia`-renderer voor alle actieve types;
- één vaste Editorial Arena-shell met masthead, contentvlak en footer;
- logical canvas is vast en wordt alleen buiten de renderer geschaald;
- dark/light komen uit de Editorial Arena-slug;
- primaire tenantkleur vervangt het referentie-oranje als accent;
- echte RSS-/productmedia gebruikt uitsluitend release-cache/blob-URL's;
- reduced motion en snapshot/passive mode blijven volledig leesbaar;
- geen raw HTML, iframe, providercall of template-evaluatie in de Player.

## Thumbnail- en renderaudit

De database bezit al de kern van de gevraagde snapshotflow:

- `dynamic_slide_snapshots` met unieke
  `(dynamic_slide_id, source_revision_hash, template_version_id)`;
- `dynamic_render_jobs` met claim/lease/retry/status;
- atomische koppeling van `output_media_asset_id`;
- een immutable tenantmedia-PNG;
- de laatst geldige ready snapshot blijft aan slide en draft gekoppeld terwijl
  een nieuwe job rendert;
- bronrevisies queueën alleen nieuwe hashes;
- release-items bevriezen `dynamic_snapshot_id`.

De lijstthumbnail is het gekoppelde outputasset en is dus al een snapshot van
de echte genormaliseerde inhoud. De ontbrekende onderdelen zijn een expliciete
naamgeving van de canonvelden en een WebP-afgeleide; hiervoor wordt geen tweede
renderer geïntroduceerd. De bestaande status-, hash-, timestamp- en foutvelden
blijven de relationele bron van waarheid:

- `dynamic_slide_snapshots.status` = thumbnailstatus;
- `output_media_asset_id` = thumbnailasset;
- `source_revision_hash` = renderhash;
- `rendered_at` = generated-at;
- `error_code` = foutcode.

De Editorial Arena-templateversie en resolved config/data/brand zitten in de
bestaande hash. Dedupe en last-valid gedrag blijven intact. Een backfill wordt
door de migratie alleen voor bestaande actieve slides gequeueëd wanneer de
nieuwe templateversie een nog onbekende hash oplevert.

## Verificatie

- 40 capability-gated templates veilig als HTML/CSS gerenderd;
- database-reset groen met 45 RLS-bestanden en 876 assertions;
- workspace lint, typecheck en unit-gates 28/28 groen;
- productiebuild 17/17 groen, inclusief de statische webOS-guard;
- a11y 34/34 en offline Player 7/7 groen;
- volledige Chromium-E2E: 135 groen, 8 bewust overgeslagen en 2
  belastingflakes afzonderlijk groen;
- Player-suite: 73/74 onder parallelle runnerdruk; de ene watchdogtest
  afzonderlijk 1/1 groen en in de volledige E2E-run eveneens groen;
- LG legacy en probe 11/11 groen, inclusief dynamische HTML/CSS-READY- en
  RENDER-signalen.

De referentie-PNG's gebruiken vaste voorbeeldinhoud en een oranje accent,
terwijl de renderer tenantdata en de tenant-primarykleur gebruikt. Een ruwe
pixelratio zou daarom een onjuiste kwaliteitsclaim zijn. De vaste canvassen,
geometrie en responsive beslissingen zijn met screenshots en gerichte
visuele tests op 1920×1080 en 1080×1920 gecontroleerd.

## Migratie-audit

- `dynamic_template_versions`, snapshots en playlist releases zijn immutable.
- Template- en slideforeign keys gebruiken `restrict`; hard verwijderen is
  terecht onveilig.
- Legacy templates worden daarom `archived`, niet fysiek verwijderd.
- Nieuwe en bestaande dynamische slides worden naar de passende Editorial
  Arena-versie gemigreerd; er wordt een nieuwe snapshot/job gequeueëd.
- Conceptplaylistitems met `latest` volgen pas de ready snapshot via de
  bestaande trigger.
- Gepubliceerde releases wijzigen niet. Hun bounded payload wordt door dezelfde
  nieuwe Player-renderer als Editorial Arena getoond, met de bestaande PNG als
  last-known-good fallback.
- De Player schakelt releases nog steeds alleen op item-/loopgrens en activeert
  nooit een incomplete release.

## Veilig overgeslagen

- MOTM/polling: expliciet buiten scope, geen route, tabel of actieve template.
- Periodestand: endpointregistry zonder geïmplementeerde workerflow is geen
  capability.
- Sponsor, roster/teamvoorstelling, trainingen, jarigen en vrijwilligers:
  registry/schemafragmenten zonder complete sync en geschikte genormaliseerde
  inhoud zijn geen live databron.
- Teamlogo-overrides: geen nieuwe tabellen zolang canonical assetimport en tests
  ontbreken; initialenschild is de expliciete fallback.
- Handmatige clubagenda, sponsor, roster, trainingen, jarigen, vrijwilligers en
  officials: de repository heeft geen volledige typed manual wizard, dus deze
  worden niet als manual optie gepresenteerd.

## Aanvulling S103 — Prijslijst

`price_list` is als elfde capability-backed type actief. De bron is uitsluitend
de bestaande tenantproductcatalogus met een actieve `manual_products`- of
`twelve_excel`-databron. De registry bevat vier varianten (dark/light ×
landscape/portrait), de wizard heeft een typed configuratie en echte
Playerpreview, de thumbnailqueue gebruikt pagina 1 van de centrale pagineerder
en playlist/publicatie hergebruiken de bestaande immutable snapshotprovenance.
Categorieën zonder beschikbare producten en product-ID's buiten tenant of bron
blijven fail-closed en worden niet als live optie geïmproviseerd.
