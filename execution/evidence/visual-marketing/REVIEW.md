# Publieke visuele vergelijking · 18 oktober 2026

Negen routes, telkens 1440×1000 en 390×900, DPR 1, Nederlands, tijdzone
Europe/Amsterdam en reduced motion. Beide versies begonnen zonder browseropslag.
Referentie is de ongewijzigde publieke publicatie op commit
`69461726f0d9e17b535dfaa0652cc18ed75c1fdd`; rebuild is de lokale Next-productiebuild
uit deze S226-werkboom. Geen staging-/productiedeploymentclaim.

`comparison.json` bevat geometrie, screenshots en verschilbeelden. De meting telt
een pixel pas als verschil wanneer een RGB-kanaal meer dan 16/255 afwijkt.
Alle 18 kaarten zijn beoordeeld; een kleine verschilfractie is op zichzelf geen
acceptatiebewijs. De oorspronkelijke bron, assets, kleuren en fonts zijn bewaard.

Twee echte portregressies zijn door deze vergelijking gevonden en hersteld:
Tailwind wijzigde inline/baseline-SVG's naar block/middle, en de extra CSS-scope
veranderde de voorrang van mobiele kopregels. De generator herstelt die defaults
en bewaart de oorspronkelijke selectorspecificiteit via `:where(.mk-site)`.

De resterende verschillen zijn gericht vastgelegd:

- De headerlink “Prototype bekijken” heet “Inloggen” en verwijst naar de bestaande
  beveiligde werkplek. De kortere tekst verschuift de aansluitende flexnavigatie;
  padding, gap en typografie zijn gelijk gebleven.
- De footer noemt de publieke dienst in plaats van “Geen live dienst”.
- `docs/sync-v1-rebuild/accessibility-overrides.json` bevat uitsluitend de door
  Axe onderbouwde tekstcontrastcorrecties; headingsemantiek gebruikt waar nodig
  een onzichtbare h2. Andere bronkleuren en assets zijn niet herontworpen.
- De demoaanvraag heeft echte ontvangst-/privacycopy en een echte serveractie.
  Het formulier houdt dezelfde structuur, stijlen en bediening. Op 390 px is de
  natuurlijke paginahoogte daardoor 2795 in plaats van 2866 px. Dit is geen
  pixel-identieke vergelijking; de afwijking wordt expliciet behouden.

Op de mobiele Playerpagina maakt de feitelijk correcte online-/offlinecopy de
pagina 20 px hoger: 3636 in plaats van 3616 px. De overige 16 captures hebben
dezelfde volledige paginahoogte als de referentie.
Alle negen herbouwde routes hebben één h1, HTTP 200 en nul Axe-meldingen; de
aanvraag toont ontvangst pas na daadwerkelijke opslag in de geïsoleerde database.
Zie `../marketing-final-accessibility-receipt.json`.

Deze vergelijking sluit geen Control-, editor-, native- of fysieke Playergate.
