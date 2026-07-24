# S38 marketingwebsite — visueel en technisch bewijs

Datum: 24 juli 2026  
Branch: `veyocast/s38-marketing-pixelperfect`

## Screenshotmatrix

De productieachtige preview is gecontroleerd op:

- homepage full-page: 1440, 1024, 768, 430 en 390 px;
- producttemplate: 1440 en 390 px;
- sectortemplate: 1440 px;
- kennistemplate: 1440 px;
- prijstemplate: 1440 px;
- demo/formuliertemplate: 390 en 1440 px.

Definitieve captures staan in `docs/screenshots/marketing-s38-*`.

## Vergelijkingsvolgorde

1. sectiehoogtes en header;
2. containerbreedte en gutters;
3. hero-grid, monitor, telefoon en ClubTV-kaart;
4. H1-schaal en Nederlandse regelafbreking;
5. truststrip en kaartverhoudingen;
6. zwarte locatiesectie en betrouwbaarheid;
7. CTA, footer en mobiele reflow;
8. contrast, focus, reduced motion en overflow.

## Geautomatiseerde dekking

- contentregister: vereiste routes, unieke titels en descriptions;
- claimsregister: prijs en uptime blijven geblokkeerd;
- serveractie: validatie, honeypot en eerlijke deliverystatus;
- templates: één H1, canonical, meta description, Open Graph en robots;
- mobiele Radix-dialog: openen, focus en routekeuze;
- Radix-accordion: toetsenbordbediening;
- 1440/1024/768/430/390/360: geen horizontale pagina-overflow;
- ongepubliceerde cases en blogposts: branded 404;
- juridische pagina’s: Nederlandse landmarks, smalle viewport en print.

## Lighthouse productiepreview

Gemeten op `VEYOCAST_ENVIRONMENT=production` met Lighthouse 13.4.1 en een
lokale Next.js production build:

| Categorie | Score |
|---|---:|
| Performance | 96 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

Aanvullend: LCP 2,83 s, CLS 0 en Total Blocking Time 41 ms in de lokale
gesimuleerde mobiele run.

## Bewuste inhoudelijke afwijkingen van de mock-up

- Fictieve testimonials en klantlogo’s zijn vervangen door aantoonbare
  productarchitectuur.
- Venuefotografie is vervangen door een code-native schermwand.
- Definitieve prijzen en providerintegraties worden niet gesuggereerd.

Deze afwijkingen volgen rechtstreeks uit het claims- en placeholderbeleid van het
canon en zijn geen visuele shortcuts.
