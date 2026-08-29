# Sportlink data flow

```text
Club.Dataservice
→ allowlisted server client
→ per-article validation and privacy filter
→ canonical sport contracts
→ tenant-scoped normalized tables
→ immutable dynamic_slide_snapshot
├→ bounded normalized release payload
└→ safe-template-v1 SVG → existing PNG media worker
→ normal immutable playlist release
→ existing Player checksum cache
→ locked HTML/CSS sportslide, or verified PNG fallback
```

Players never receive a Client ID, provider URL, raw response or template
source. They also never evaluate provider content as HTML. A provider failure
retains normalized data, current snapshot, PNG, release and last-known-good
Player cache. IDs are unique per tenant, connection and external ID. Teams and
current-window matches are only soft-deactivated after three non-empty
successful snapshots omit them; an empty provider response never triggers bulk
deletion.

The article registry is the only network allowlist. It binds capability,
sensitivity, argument schema, mapper and sync group. Adding an article requires
official `/list` evidence, a bounded argument schema, privacy classification,
canonical mapper, fixture and contract test.

## Unified Studio blueprints

Studio bewaart wizardkeuzes pas bij de laatste bevestiging. De server maakt de
volledige team × blueprint-matrix in één transactie; een ongeldige combinatie
laat dus geen gedeeltelijke slides achter. Iedere slide bewaart een eigen
`seasonId`, `competitionId`, `phaseId` en `poolId`, met `auto_current` of
`pinned` selectie. Context overnemen is uitsluitend een authoringgemak.

De centrale blueprintregistry bevat de clubvensters vandaag/zeven dagen, de
pouleprogramma- en pouleuitslagvensters, de officiële poulestand en de twee
aankomstfamilies. Poolwedstrijden komen uit de allowlisted
`poule-programma`/`pouleuitslagen`-artikelen met `eigenwedstrijden=NEE`; zo
blijven tegenstanders onderdeel van het poulebeeld. Ontbrekende scores blijven
`null` en worden nooit als 0–0 gepubliceerd.

Bezoeker- en scheidsrechteraankomsten gebruiken dezelfde klokgestuurde engine,
maar respectievelijk de uit- en official-kleedkamer. Een bezoekerswelkomstslide
accepteert uitsluitend Programma-regels waarvan het officiële `teamvolgorde`
expliciet een thuiswedstrijd aanduidt. `eigenteam` betekent alleen dat de club
in de regel voorkomt en is geen thuis/uit-signaal. De mapper, snapshotbuilder en
beide Players passen deze grens fail-closed toe; oudere snapshots zonder de
expliciete `homeMatch`-markering worden niet getoond.

Een succesvolle providerobservatie herberekent het tijdvenster; de bestaande
contenthash dedupliceert ongewijzigde snapshots. `emptyBehavior=skip` maakt een
lege aankomstslide niet speelbaar, terwijl een geldige last-known-good release
intact blijft. De snapshotbuilder kan het logo van het uitteam uitsluitend via
een reeds gevalideerde private providerversie toevoegen. Provider-URL's worden
nooit gepubliceerd en er is geen scraping of Voetbal.nl-automatisering.

Bezoekerswelkomstslides hebben vijf deterministische motionpresets (`aurora-rise`,
`spotlight-bloom`, `kinetic-split`, `prism-swipe` en `grand-flip`). De standaard
`auto`-stand verdeelt ze over kaarten en pagina's; een beheerder kan ook één
preset vastzetten. Na de intro blijft het kaartbeeld statisch en
`prefers-reduced-motion` schakelt beweging en lichtswipes uit.

Het bezoekersraster vult het vaste canvas op basis van de actuele pagina:
één kaart gebruikt het hele inhoudsvlak, twee en drie kaarten vormen
respectievelijk twee en drie verticale kolommen en vier kaarten vormen een
2×2-raster. Portrait gebruikt voor één tot drie wedstrijden één verticale
kolom met even hoge rijen en voor vier wedstrijden 2×2. Indien beschikbaar
staat het uitteamlogo in een rustige voorgrondplaat en als 150% vergrote,
30%-transparante uitsnede achter de kaartinhoud. De gedeelde DOM-renderer,
thumbnailworker en LG Legacy-adapter volgen hetzelfde contract.

Club- en teamlogo's blijven buiten Media in de globale, private S111-provider-
cache. De repo-audit wees zowel legacy tenant-mediarecords als actief historisch
importgedrag aan; de actuele importer schrijft uitsluitend immutable,
checksum-gededupliceerde providerversies.
