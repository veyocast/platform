# S128 — Dynamische Sportlink-verjaardagen

Status: release-ready; deployment volgt na beschermde PR-promotie  
Branch: `veyocast/s128-sportlink-birthdays`

## Aangetroffen architectuur

VeyoCast had al één server-only Sportlink-client, encrypted Client ID,
datasetpolicies, een atomaire workerlease met renewal/retry, genormaliseerde
Sportlink-tabellen, dynamische bronrevisies, immutable snapshots/releases, een
Last Known Good-keten en één gedeelde React-renderer met PNG-fallback. Studio,
thumbnail en browser-Player konden die renderer al delen; LG Legacy heeft een
statische compatibiliteitsadapter. ExcelJS en veilige CSV-importpatronen
bestonden eveneens. Deze onderdelen zijn uitgebreid; er is geen tweede worker,
releaseketen, playercache, template-engine of ledenadministratie gebouwd.

`Ambient Mode` bestaat niet als contentplanner/providerregistry. De repository
bevat alleen scherminstellingen die Android-ambientgedrag voorkomen. S128 bouwt
daarom bewust geen concurrerende scheduler. Een latere provider kan de
canonieke `sport_birthdays`-snapshot lezen, `isToday` hoger prioriteren,
`fetchedAt`/21-dagen-expiry respecteren en per scherm een 30-minutenlimiet plus
recent-person suppression toepassen zonder providercall of rendererfork.

## Providercontract en normalisatie

De worker gebruikt uitsluitend:

`GET https://data.sportlink.com/verjaardagen?client_id={CLIENT_ID}&aantaldagen=21`

De openbare artikel- en parameterdocumentatie noemt `verjaardag` en
`volledigenaam` en begrenst `aantaldagen` op 21. Een Client ID is voldoende;
een aparte Token Club.Data-status blokkeert deze synchronisatie niet. De parser
accepteert gecontroleerde ISO-, compact-ISO-, dag-maand- en Nederlandse
tekstdata, berekent de eerstvolgende geldige datum in de tenanttijdzone en
negeert lege, ongeldige of onbekende velden. Privacy-afgeschermde personen die
Sportlink niet levert worden niet gereconstrueerd.

Elke succesvolle `public_people`-run haalt verjaardagen, teams en begrensd
maximaal vijftig teamindelingen op. Maximaal veertig eenduidige, door Sportlink
geleverde foto's gaan via de private content-addressed providerassetcache.
Players krijgen nooit Client ID, provider-URL, geboortejaar, lidcode of ruwe
response. Een volledig gevalideerde batch vervangt pas daarna de actieve
snapshot; een mislukte of incomplete run laat de Last Known Good ongemoeid.

## Identiteit, team, rol en foto

Matching gebruikt exact NFKC-genormaliseerde namen, inclusief accenten en
tussenvoegsels; fuzzy matching is verboden. Teamtoewijzingen worden alleen
samengevoegd wanneer dezelfde niet-lege lidcode één identiteit bewijst. Twee
identiteiten met dezelfde naam of meerdere code-loze toewijzingen worden
`ambiguous`. In Control kan een integratiebeheerder een conflict expliciet aan
één actuele teamidentiteit koppelen; deze auditbare keuze wint bij volgende
syncs. Zonder bewijs blijven rol, team en foto leeg.

## Leeftijdsverrijking

Het verjaardagenartikel levert geen betrouwbaar geboortejaar. S128 bevat daarom
alleen de doelgerichte functie **Geboortejaren verrijken**:

- CSV en XLSX, maximaal 8 MB, 10.000 rijen, 75 kolommen en 8 sheets;
- handmatige kolommapping, preview en resultaten geldig/ongeldig/dubbel/conflict;
- naam of losse naamvelden, optionele relatiecode, datum/jaar, team en rol;
- merge zonder bestaande betrouwbare afwijkende waarde te overschrijven;
- idempotente import en veilige rollback van de laatste import;
- geen permanent ruw bestand; formules, jaar 1900 en overbodige data geweigerd.

De private RLS-tabel bewaart geboortejaar en provenance. De snapshotbuilder
berekent alleen `jaar van eerstvolgende verjaardag - betrouwbaar geboortejaar`
en levert uitsluitend die leeftijd wanneer de slide haar nodig heeft. Zonder
bron toont de renderer “is vandaag/binnenkort jarig”; hij gokt nooit.

## Studio, renderer en releasegedrag

`Sportlink — Verjaardagen` staat als één canoniek slidetype in Nieuwe slide,
Dynamische slides en Sportlink. De vier stappen zijn Periode, Selectie en
informatie, Vormgeving en Preview en publiceren. De wizard toont echte
genormaliseerde data zodra die bestaat; daarvoor is previewdata expliciet
gemarkeerd. De mediaresourcepicker zoekt tenantbeelden en toont thumbnails.

De renderer kiest Spotlight (1), Celebration Grid (2–4) of Birthday Roll
(5–8), of respecteert een vaste keuze. Meer items worden deterministisch
gepagineerd; vandaag komt eerst, daarna datum en naam. Playlistduur wordt bij
invoegen minimaal `pagina-aantal × paginaduur`, waarbij de strengste landscape-
of portraitpaginering geldt. Een dataverversing verhoogt de duur van bestaande
`latest`-items atomair wanneer meer pagina's nodig zijn; een databaseguard
voorkomt ook verkorting via een directe mutatie. Release Preflight toont
pagina-aantal, minimum en werkelijk ingestelde duur. Browser-Player, Control-
preview, thumbnail en preflight delen dezelfde viewresolver en renderer. LG
Legacy voert dezelfde lokale-datum/expiryfilter en skipbeslissing uit.

Bij `skip` of `today_only` met nul geldige personen roept de browser-Player
ready/ended direct aan; LG gaat eveneens direct door. Er wordt geen zwart frame,
lege container of providerfout gecommitteerd. Bij `neutral` verschijnt één
rustige tenantstaat. De Player filtert bij iedere weergave opnieuw in de
tenanttijdzone, ook offline; een snapshot ouder dan 21 dagen wordt overgeslagen.
Nieuwe data loopt via bronrevisie en auto-release, zonder handmatig herpubliceren.

## Security en beheer

Zes nieuwe tabellen hebben `tenant_id NOT NULL`, samengestelde tenant-FK's,
indexes, forced RLS en default-deny browserwrites. Alleen integratiebeheerders
zien matchidentiteiten, imports en geboortejaren; normale lezers zien slechts
de minimale verjaardagsweergave. Handmatige sync heeft vijftien minuten
cooldown. Activatie, sync, import, rollback, handmatige koppeling,
slideconfiguratie en verwijderen schrijven audit-events zonder namen of data.

De featureflag `sportlink_birthdays` volgt een actieve Sportlink-integratie.
Tenantbeheerders beheren activatie/import; contentbeheerders maken en vormen de
slide; leesrollen zien passende status. Er is geen nieuwe betaalmodule gemaakt.

## Rollback, bewijs en externe verificatie

Schemaforward is reproduceerbaar via de S128-migratie. Importrollback is
productmatig beschikbaar. Een codeterugrol archiveert de nieuwe templates en
ingangen, maar muteert geen historische immutable release.

Een echte Client ID is niet in deze werkcontext gebruikt. Officiële contract-
en wrapperfixtures, providerfoutpaden en servergrenzen zijn getest; na
deployment resteert alleen tenantgebonden readback van zichtbare data/foto's.

## Lokale releasegates

- `pnpm lint`: 30/30 taken groen;
- `pnpm typecheck`: 30/30 taken groen;
- `pnpm test`: 30/30 taken groen, waaronder Contracts 47, Integrations 70,
  Control 195, Worker 88 en Player 167 assertions;
- `pnpm build`: 18/18 taken groen, inclusief Control-authgrens,
  client-secretcontrole, Player-webOS-guard en Android-export;
- verse `pnpm db:reset` groen; `pnpm test:rls`: 62 bestanden en 1.335 tests;
- S128-RLS: 42/42, inclusief tenantisolatie, private leeftijd, idempotentie,
  rollback, rate limit, Last Known Good en automatische portraitminimumduur;
- `pnpm test:a11y -- --project=chromium`: 36 groen, 1 conditionele live-skip;
- `pnpm test:player -- --project=chromium`: 102/102 groen;
- `pnpm test:player:offline -- --project=chromium`: 7/7 groen;
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm test:e2e -- --project=chromium`:
  175 groen, 20 conditionele live/evidence-skips, 0 fouten;
- visuele verjaardagstest: 1/1 met vier goedgekeurde 16:9-/9:16-goldens;
- live lokale verjaardagjourney: 1/1, inclusief echte lokale snapshot,
  leeftijd, integratiestatus, wizard, mobiel, axe en opgeslagen slide.

Screenshotbewijs:

- landscape: `docs/screenshots/s128-sportlink-birthdays/landscape.png`;
- portrait: `docs/screenshots/s128-sportlink-birthdays/portrait.png`;
- wizard: `docs/screenshots/s128-sportlink-birthdays/wizard.png`;
- mobiele wizard: `docs/screenshots/s128-sportlink-birthdays/wizard-mobile.png`;
- integratiestatus: `docs/screenshots/s128-sportlink-birthdays/integratiestatus.png`.
