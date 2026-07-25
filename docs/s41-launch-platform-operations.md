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

## Open activeringen

- Voeg de echte Twelve `.xlsx` opnieuw toe voor een fixture- en aliascontrole.
- Configureer `SLACK_ALERT_WEBHOOK_URL` in staging en production.
- Laat voorgestelde bewaartermijnen juridisch bekrachtigen voordat enforcement
  wordt geactiveerd.
- Kies de secundaire EU-objectstorageprovider en oefen een herstel.
- Koppel een e-mailprovider wanneer ticketnotificaties ook buiten Control moeten
  worden bezorgd.
- Draai Android TV Gradle/Play-signing CI en maak vóór publieke listing echte
  screenshots op fysieke Google TV-hardware.
