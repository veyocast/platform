# Testresultaten — VeyoCast Sync V1

Peildatum: 17 oktober 2026. Scope: deze prototypebroncode, lokale demo-interacties en statische marketingoutput.

## Uitgevoerde controles

| Controle | Resultaat | Bewijs / opnieuw uitvoeren |
|---|---|---|
| TypeScript | Geslaagd | `npm run check` |
| Applicatie productiebouw | Geslaagd | `npm run build` |
| Afzonderlijke marketingbouw | Geslaagd | `npm run build:marketing` |
| Componentrenders | 78 geslaagd, 0 fouten | `node scripts/qa-smoke.mjs` |
| Content → playlist → publicatie, planning, preflight, Viewer, tenantisolatie, Engage | 6 DOM-journeys geslaagd | Dezelfde smoke-suite |
| Immutable prijs-/menupublicatie | 1 pure controle geslaagd | Dezelfde smoke-suite |
| Rollen, mobiele uploads, eigen publicatierol, rolhernoeming, aanvraaginbox, playerhistorie en Sync-normalisatie | 7 gerichte checks geslaagd; geen consolewaarschuwingen | `node scripts/qa-handover.mjs` |
| Sportfamilies en plaatsingen | 34 renders (17 families × 2 formaten) plus revisie/thema/paging/selectiechecks geslaagd | `node scripts/qa-content.cjs` |
| Studio-concept herstellen → playlist → portraitpreview → MFA-publicatie → bevroren snapshot → Viewer | Geslaagd | `node scripts/qa-flow.cjs` |
| Technische SEO en publieke bundel | 9 pagina’s geslaagd | `node scripts/qa-seo.mjs dist-marketing` na build + prerender |
| Playergerichte controles tijdens implementatie | 4 profielen + schermoverzicht renderen; 7 DOM-interacties; 8 tijd-/nachtvenstergevallen geslaagd | Gerichte implementatiecontroles; laat fysieke acceptatie apart uitvoeren |
| Documentintegriteit | Alle 148 scenario-ID’s aanwezig | `src/coverage.json` en `docs/ACCEPTATIE.md` |

De SEO-check controleert vooraf gerenderde inhoud, één H1 per pagina, unieke titels/beschrijvingen, canonicals, JSON-LD, lokale assets/links, sitemap, robots, foutpagina en uitsluiting van de privé-datastore en overdracht-ZIP uit de publieke bundel. Dit is geen rankinggarantie.

## Herstelde bevindingen

- Alleen Sync blijft bereikbaar; oudere ontwerpkeuzes worden naar Sync genormaliseerd.
- Previews gebruiken de juiste plaatsing, ontwerprevisie, oriëntatie en thema; dubbele plaatsingen hebben eigen snapshots.
- Verborgen items worden overgeslagen; alle RSS-/lijstpagina’s blijven afspeelbaar.
- Onopgeslagen Studio-concepten zijn herstelbaar; mobiele concepten en supportantwoorden blijven bewaard.
- Laatste succesvolle broninname blijft zichtbaar bij een fout; actieve sponsorplannen blijven bevroren.
- Nachtelijke bedrijfstijden, tijdzones, offlinecommando’s, fullscreen en playerhistorie zijn hersteld.
- De rolmatrix en mutatiegrenzen zijn op elkaar afgestemd, inclusief eigen rollen, mobiele uploads en prijspublicaties.
- Marketingaanvragen worden binnen dezelfde origin één keer geïmporteerd in de inbox. De publieke en privé-site delen geen browseropslag.

## Niet uitgevoerd / geen claim

Geen visuele browser- of screenshotacceptatie: de ondersteunde browser-QA-capability was hier niet beschikbaar. Geen fysieke LG-/Android-test, geen 24-uursduurproef, geen echte providerinname, geen server-RLS-test, geen betaling en geen e-mailverzending. Geen Lighthouse- of veldmeting van Core Web Vitals.

De 148 scenario’s in de V1-verkenner zijn een handmatige acceptatiecatalogus. Een vinkje of een groene frontendtest bewijst geen productiewerking. Volg `ACCEPTATIE.md` voor staging en hardware.
