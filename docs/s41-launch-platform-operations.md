# S41 launch platform operations

Deze sprint levert vijf los toetsbare delen:

1. een afzonderlijke Google TV Play-app (`nl.veyocast.player.tv`) die dezelfde
   native WebView-shell en webplayer gebruikt als de algemene Android-app;
2. een professionele, begrensde XLSX-productimport met bewerkbare catalogus en
   immutable Studio-shortcodes;
3. live serviceprobes met Slack-alarm en herstelmelding;
4. expliciete retention- en verwijdergovernance plus een tweede
   objectstorageback-upstrategie;
5. een tenantveilige supportdesk met afdelingen, werkrollen, gevoelige inhoud,
   privébijlagen, statussen, toewijzing, notificaties en soft-delete.

## Productshortcodes

Studio ondersteunt bij een render onder meer:

- `{{product:<slug>:name}}`
- `{{product:<slug>:price}}`
- `{{product:<slug>:category}}`
- `{{product:<slug>:description}}`
- `{{product:<slug>:custom.<kolom>}}`

Resolutie gebeurt uitsluitend wanneer een renderrevision wordt gemaakt. De
uitkomst wordt daardoor onderdeel van de immutable renderinput; een latere
prijswijziging verandert geen bestaande export of release.

## Gevalideerde Twelve-export

De export `export_all_products_20260725.xlsx` is lokaal en zonder opname van het
bronbestand in Git gevalideerd:

- SHA-256:
  `cd5245d8c64543aff84c82364cecc9b4f3a65eee1fcecddf4bf7a46177d2ce49`;
- werkblad `Products`;
- 23 kolommen en 336 productregels;
- alle 336 regels normaliseren zonder validatiefout;
- `Name short` wordt productnaam en `Name long` beschrijving;
- `Amount` is de verkoopprijs in euro's;
- `VAT Id` blijft een Twelve-referentie en wordt niet onterecht als
  btw-percentage geïnterpreteerd;
- `Open price` blijft een extra ja/nee-veld;
- `ID` is de stabiele bron-ID; lege `External ID` blijft als extra veld
  beschikbaar.

Control groepeert deze bestandsintegratie onder
`Integraties → Twelve Producten`. De oude `/dashboard/products`-URL's blijven
alleen als compatibele redirects bestaan.

## Open activeringen

- Voer na deployment één gecontroleerde import met de gevalideerde Twelve
  export uit op staging; het bronbestand wordt bewust niet gecommit.
- `SLACK_ALERT_WEBHOOK_URL` is door de eigenaar toegevoegd; verifieer bij de
  eerstvolgende stagingdeployment één testalarm en herstelmelding in het
  besloten Slack-kanaal.
- Laat voorgestelde bewaartermijnen juridisch bekrachtigen voordat enforcement
  wordt geactiveerd.
- Besluit over de geadviseerde secundaire provider Scaleway Object Storage en
  oefen daarna een volledige mediarestore vanuit een locked back-upbucket.
- Koppel een e-mailprovider wanneer ticketnotificaties ook buiten Control moeten
  worden bezorgd.
- Draai Android TV Gradle/Play-signing CI en maak vóór publieke listing echte
  screenshots op fysieke Google TV-hardware.
