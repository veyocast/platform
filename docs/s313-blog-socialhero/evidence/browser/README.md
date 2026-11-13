# S313 publieke blog — browserbewijs

Vastgelegd op 13 november 2026, branch `veyocast/s313-blog-socialhero`, bronbasis `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`. De kandidaat bevat nog niet gecommitte wijzigingen. [provenance.json](provenance.json) bindt de shell, prototypecomponent, prototypedataset en toegepaste CSS aan SHA-256. Alleen voorbeeldinhoud uit het overdrachtspakket is gebruikt.

## Uitgevoerde proef

Dit is een **native React-componentfixture** in een eigen, kortlevende lokale HTTP-server. Het is geen Next-runtime, databasepublicatie of gekoppelde SocialHero-website. De baseline laadt een SHA-256-bewaakte byte-exacte snapshot van de werkelijke `Marketing.tsx` uit broncommit `4f44…`, geëxtraheerd via `git show`; de blogvergelijking laadt de ongewijzigde aangeleverde prototypecomponenten naast de werkelijke kandidaatcomponenten. Beide gebruiken dezelfde bestaande MarketingChrome, tokens, Manrope/Inter, drie voorbeeldartikelen en originele foto’s. Alleen de serverdata-/mediaresolve en Next Link zijn vervangen door afgeschermd testtransport en gewone anchors. Het niet gebruikte aanvraagformulier wordt niet verbonden.

Er worden geen bestanden in de oorspronkelijke checkout, Next-buildoutput, mediaopslag of productiedata gewijzigd. De bundel blijft in geheugen. De fixture staat alleen GET/HEAD toe. Voor complete paginacaptures wordt native lazy-loading in de browserproef op eager gezet; broncomponenten en foto’s blijven ongewijzigd.

```bash
S313_BLOG_NEXT_URL=http://127.0.0.1:9313 \
S313_BROWSER_EXECUTABLE=/home/codex/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell \
PLAYWRIGHT_EXTERNAL_SERVERS=1 PLAYWRIGHT_APPS=marketing \
./node_modules/.bin/playwright test tests/e2e/blog-publication.spec.ts --project=chromium
```

Finale volledige run: **6/6 geslaagd**, 18,6 seconden, met alle drie breedtes en werkelijke toetsenbordcontrole. De eerdere volledige run was 6/6 in 20,4 seconden; de tussentijdse uitgebreide echte-Nextcase was 1/1 in 5,2 seconden. Playwright-package `1.61.1`; aanwezige browser `Google Chrome for Testing 158.0.8127.18`. De werkelijke tijdelijk gebruikte fixture-origin wordt door de proef opgenomen in `provenance.json`.

| Controle | Resultaat | Bewijs |
|---|---|---|
| Bestaande shell, desktop 1440×900 en mobiel 390×844 / 320×844 | Geslaagd; één header, footer en H1, geen bloglink in oorspronkelijke shell | `baseline-home-1440.png`, `baseline-home-390.png`, `baseline-home-320.png`, `baseline.json` |
| Overzicht en artikel, 1440×900 | Geslaagd; kandidaat en prototype hebben dezelfde geometrie, fonts en exact dezelfde native PNG-pixels voor main | `comparison-1440.json` en vier overeenkomstige PNG’s |
| Overzicht en artikel, 390×844 | Geslaagd; dezelfde zes eigenschappen | `comparison-390.json` en vier overeenkomstige PNG’s |
| Overzicht en artikel, 320×844 | Geslaagd; dezelfde eigenschappen, geen horizontale overflow | `comparison-320.json` en vier overeenkomstige PNG’s |
| Afbeeldingen | Alle main-afbeeldingen geladen, beschrijvende alt aanwezig, originele foto’s 1600×2000, focuspunt behouden | Alle comparison-JSON’s |
| Toegankelijkheid | Zes volledige WCAG 2 A/AA + 2.1 AA aXe-scans: nul overtredingen | Alle comparison-JSON’s |
| Toetsenbord | Tab naar zichtbare skiplink; Enter gaat naar `#main-content`; mobiel menu reageert op toetsenbord en meldt `aria-expanded=true` | `keyboard.json`, `candidate-mobile-menu-focus.png` |
| Werkelijke Next 15.5.20 Marketing-runtime | Geslaagd op `http://127.0.0.1:9313/blog`, 1440/390/320px: HTTP200, server-HTML, canonical op testorigin, noindex, één shell, nul overflow, drie volledige aXe-scans zonder overtredingen en werkelijke Tab/Enter-skiplink | `next-runtime.json`, `next-blog-{1440,390,320}.png` |
| Werkelijke runtime sitemap / onbekende slug | HTTP200 sitemap bevat de canonieke blogindex; onbekende ongepubliceerde slug geeft404 | Dezelfde echte-Nextbrowsercase |
| Oorspronkelijke lege-blogrun | Deze eerste echte Next-run had nog geen databasebackend; gepubliceerde inhoud is daarna aanvullend gecontroleerd | Aanvullende gepubliceerde proef hieronder en `../integration/result.json` |

## Aanvullend: werkelijke gepubliceerde dataset

Na de22 geslaagde echte Next-API/SQL-ketenstappen is dezelfde Marketing-runtime op9313 verbonden met de expliciete lokale PostgreSQL-testadapter op9431. SQL en RLS zijn werkelijk; Auth en Storage-HTTP zijn lokale adapters. Vóór de afzonderlijke SocialHero-workerproef stonden exact de drie prototypeartikelen met zes afbeeldingen gepubliceerd. De oorspronkelijke lege-blogcaptures hierboven blijven bewaard als afzonderlijk moment.

```bash
S313_BLOG_NEXT_URL=http://127.0.0.1:9313 \
S313_BLOG_PUBLISHED_EVIDENCE=1 \
S313_BROWSER_EXECUTABLE=/home/codex/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell \
PLAYWRIGHT_EXTERNAL_SERVERS=1 PLAYWRIGHT_APPS=marketing \
./node_modules/.bin/playwright test tests/e2e/blog-publication.spec.ts --project=chromium --grep 'actual published'
```

**1/1 geslaagd in13,8 seconden**. De proef heeft overzicht én gepubliceerde detailpagina op1440×900,390×844 en320×844 gecontroleerd. Alle zes pagina’s hebben één shell/H1, nul horizontale overflow, geladen afbeeldingen met alt en focal point, nul WCAG2A/AA+2.1AA-aXe-overtredingen en een werkelijke Tab/Enter-skiplink. De detailpagina toont canonical, revisie4 en aparte OG1200×630; beide paginatypen hebben noindex in development. Zes nieuwe screenshots en alle metingen staan in `next-published-{index,detail}-{1440,390,320}.png` en [next-published-runtime.json](next-published-runtime.json).

De mobiele gepubliceerde detailpagina en desktopindex zijn daadwerkelijk visueel geïnspecteerd. Datum en lijstvolgorde volgen de werkelijke publicatietijden uit de API, terwijl inhoud en foto’s uit het prototype komen. De eerste slug eindigt op `-definitief` om twee historische redirects te bewijzen. De gepubliceerde pagina’s zijn echte Next-devresponses en tonen de bestaande ontwikkelindicator. Met deze aanvulling zijn er25 PNG’s van ongeveer15MiB.

De eerste aanvullende browserassertie gebruikte ten onrechte een niet bestaande globale CSS-class in plaats van de echte CSS-modulecomponent en had een verkeerd overgeschreven voorbeeldtitel. Alleen de testselectors/verwachting zijn gecorrigeerd naar semantisch `main article` en de daadwerkelijke prototypetitel; de runtime is daarvoor niet gewijzigd. Daarna is de volledige aanvullende gepubliceerde browsercase opnieuw uitgevoerd en geslaagd.

De oorspronkelijke proef bevatte negentien PNG’s, samen met meetbestanden ongeveer11,3MiB. De desktopindex, mobiele detailpagina en oorspronkelijke mobiele home zijn daadwerkelijk visueel geïnspecteerd, evenals de mobiele lege blog in de echte Next-runtime. De echte Next-captures gebruiken de ontwikkelruntime en bevatten daarom diens zichtbare ontwikkelindicator; dit is geen productiebuild-capture. De artikelhero behoudt zijn portretverhouding, tekst en kaarten lopen op mobiel onder elkaar door en bestaande shellnavigatie/juridische links blijven beschikbaar.

## Voorafgaande fouten en herstel

1. De eerste fixturecompile vond absolute CSS-afbeeldingspaden niet. Alleen de testcompiler is aangepast om bestaande absolute asset-URL’s door de lokale read-only assetserver te laten afhandelen.
2. De eerste browserstart zocht een niet aanwezige cacheversie `1228`. Er is geen browser geïnstalleerd; de expliciet aanwezige executable `1254` is gebruikt.
3. De eerste baselineprobe wachtte op decode van nog niet geladen offscreen lazy-images en bereikte de bestaande 30-secondenlimiet. De browserproef activeert nu eager-loading vóór decode. De deadline is niet verhoogd.

Daarna is de volledige fixturebrowserreeks opnieuw uitgevoerd met bovengenoemde groene uitkomst. De normale CI-/build-, auth-, editor-, database-, API-, herstart- en publicatieketen blijven afzonderlijke acceptatiebewijzen. De gerichte ESLint-opdracht voor beide nieuwe testbestanden en `git diff --check` zijn geslaagd.
