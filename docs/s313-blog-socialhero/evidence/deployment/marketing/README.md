# S313 publieke Marketing-/Control-uitrolcontrole

Deze bewijsmap bevat uitsluitend read-only HTTPS-controles. Er worden geen accounts aangemeld, credentials geconfigureerd, artikelen gepubliceerd of productiegegevens gewijzigd. Root voert de bestaande Git-/deploymentflow uit; deze agent controleert alleen de openbare responses. De overdrachtsdocumenten zijn ontwerp-/acceptatiereferentie; de latere expliciete gebruikersopdracht om alles te deployen bepaalt de uitrolscope.

## Baseline vóór uitrol

Vastgelegd op13 november2026 om15:48:18–15:48:33UTC vanaf werkbranch `veyocast/s313-blog-socialhero`, kandidaatbron `f69706cdfc42d5aa37493574a6d1557cc561ef07`. De op dat moment werkelijk actieve Marketing- en Control-revisie was **`4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`**, beide `production`, status `ok`.

De opdracht was `node --input-type=module` met een inline `fetch`-probe: uitsluitend GET, handmatige redirects, een achtseconden-deadline per request, geen credentials en geen bewaarde cookies. De hoofdprobe heeft ook een responsebodylimiet van2MiB. Alleen allowlisted headers, openbare HTML-metadatavelden, bodyhashes, healthvelden en sitemap-URL’s worden bewaard. De browserzoektool kon deze domeinen niet openen; de directe HTTPS-probe gaf onderstaande feitelijke antwoorden.

| URL | Baseline |
|---|---|
| `https://veyocast.nl/api/health` | 200; Marketing production, revisie `4f44bbdd…` |
| `https://veyocast.nl/` | 200; één bestaande H1, canonical `https://veyocast.nl`, robots `index, follow` |
| `https://veyocast.nl/blog` | 200; oude algemene productnotitiespagina, canonical `/blog`, robots `noindex, nofollow` |
| `https://veyocast.nl/sitemap.xml` | 200;49 URL’s, nog geen `/blog`-index of artikel |
| `https://veyocast.nl/api/socialhero/v1/capabilities` | 404HTML; nieuwe API nog niet actief |
| `https://control.veyocast.nl/api/health` | 200; Control production, revisie `4f44bbdd…` |
| `https://control.veyocast.nl/platform/blog` | 404; nieuwe redactieroute nog niet actief |
| `https://control.veyocast.nl/api/platform/blog` | 404; nieuwe staff-API nog niet actief |
| `https://control.veyocast.nl/login` | 200; bestaande loginpagina |
| `https://control.veyocast.nl/platform` en `/dashboard` | 307 naar `/login?reden=sessie`; bestaande afscherming actief |

De afzonderlijke antwoorden staan in [baseline.json](baseline.json) en [control-auth-baseline.json](control-auth-baseline.json). De responsehashes bewijzen uitsluitend deze meetmomenten; dynamische Next-HTML kan per request een andere hash krijgen.

## Nameting na geslaagde productiepromotie

Root bevestigde expliciet dat productiejob **43456528973**, inclusief alle vier jobs, volledig geslaagd was. De nameting begon pas nadat ook de drie publieke healthroutes onafhankelijk HTTP200, `production`, `ok` en exact **`67d8470198acec4272c47c4c7979b6071a915c4b`** teruggaven. [after-production.json](after-production.json) bewaart deze beide gates en alle feitelijke resultaten. Finale volledige run: **12/12 controles geslaagd**,13 november2026,16:07:19–16:07:31UTC.

```bash
S313_PRODUCTION_JOB_COMPLETE=43456528973 \
TMPDIR=/dev/shm/s313-marketing-production-browser \
node docs/s313-blog-socialhero/evidence/deployment/marketing/verify-production.mjs
```

De probe zelf staat in deze bewijsmap, buiten applicatie-/workflowbron. Playwright1.61.1 gebruikte de reeds aanwezige `Google Chrome for Testing158.0.8127.18`; er is niets geïnstalleerd. Alleen browsertemp stond onder `/dev/shm`; de browser is afgesloten en de eigen healthpoll is geëindigd. De screenshots zijn werkelijke productiepagina’s, zonder testtransport of lokale Next-runtime.

| Controle | Definitieve uitkomst |
|---|---|
| Marketing, Control en Player health | Alle drie200/ok/production op de volledige verwachte SHA |
| Home `/` | 200; bestaande inhoud/shell intact, blognavigatie aanwezig, canonical `https://veyocast.nl`, `index, follow` |
| Blog `/blog` | 200; nieuwe titel `Het VeyoCast-blog`, canonical `https://veyocast.nl/blog`, `index, follow`, correcte lege redactie |
| Sitemap | 200;50 URL’s, alle49 bestaande URL’s behouden plus `/blog`; geen lokale testartikelen |
| Onbekend/ongepubliceerd artikel | 404 |
| SocialHero capabilities zonder credential | 401JSON, `INVALID_CREDENTIAL` |
| Control staff-API zonder sessie | 403JSON, `PERMISSION_DENIED`, geen redactiegegevens |
| Control login en redactieroute | Login200; `/platform`, `/dashboard` en nieuwe `/platform/blog` geven307 naar de bestaande sessielogin |
| Zes browserpagina’s | Home en blog op1440×900,390×844 en320×844; één header/footer/H1, nul horizontale overflow, geen kapotte afbeeldingen |
| Runtimefouten | Alle zes: nul pageerrors, consoleerrors, requestfailures of HTTP-errorresponses tijdens laden |
| Toegankelijkheid | Alle zes volledige WCAG2A/AA+2.1AA-aXe-scans: nul overtredingen |

De zes screenshots zijn `production-{home,blog}-{1440,390,320}.png`, samen met de overige bewijsbestanden ongeveer4,2MiB. De desktophome en mobiele blog zijn daadwerkelijk visueel geïnspecteerd. Viewporten en PNG-checksums staan in het JSON-rapport.

## Werkelijke toetsenbordfocus

De skiplink ontvangt daadwerkelijk focus met Tab. Enter gaat op de bestaande home naar `#main` en op de blog naar `#main-content`; beide doelen zijn een bestaand semantisch `MAIN`. Een gerichte extra meting op alle zes pagina’s staat in [focus-after-enter.json](focus-after-enter.json).

Die meting houdt de precieze browsergrens zichtbaar: meteen na Enter is `document.activeElement` de `BODY`, geen expliciet gefocust `MAIN`. De eerstvolgende Tab focust wel daadwerkelijk een link **binnen** de gekozen main en slaat dus de headernavigatie over. Deze afhandeling is op beide routes en alle breedtes gelijk. Er wordt geen expliciete mainfocus of volledige schermlezeracceptatie geclaimd. De aanvankelijke directe-mainfocusassertie faalde; daarna is de daadwerkelijke focusvolgorde vastgelegd zonder de applicatie te wijzigen.

## Probeverwachtingen en operationele grenzen

De eerste volledige nameting had vier onjuiste probeverwachtingen:401 voor de staff-API waar de bestaande servercode403 `PERMISSION_DENIED` voorschrijft, en drie keer `#main-content` voor de bestaande home die `#main` gebruikt. De oorspronkelijke uitkomst staat in [after-production-first-probe.json](after-production-first-probe.json). Alleen de evidenceprobe is gecorrigeerd op de geverifieerde broncontracten; er is geen applicatiecode gewijzigd. De daaropvolgende volledige nameting is groen. Alle zes PNG-hashes zijn tussen beide volledige runs identiek.

De health-onlypoll zag tijdens de uitrol om16:05:47UTC één meetmoment waarop alle drie responses niet als health-JSON konden worden gelezen; om16:06:17UTC waren ze alle drie gezond op de nieuwe SHA. HTTP-status/body zijn op dat tussentijdse punt niet bewaard; er wordt daarom geen exacte oorzaak of uitvalduur afgeleid. [health-transition.json](health-transition.json) bewaart dit beperkte overgangsbewijs. De uiteindelijke productiejob en nameting zijn daarna bevestigd.

De standaardstagingstack bevat geen publieke Marketing-service. Deployment alleen bewijst geen geconfigureerde SocialHero-verbinding. Site/origin, scopecredential, echte redacteurssessie en een daadwerkelijke artikelpublicatie blijven afzonderlijke operationele controles. Deze read-onlyprobe configureerde of publiceerde niets. Productie heeft nog geen blogartikelen: de lege index, sitemap en API-afscherming zijn bewezen; gepubliceerde artikelmetadata, redirects en een gekoppelde credential zijn hier niet opnieuw op productie getest.
