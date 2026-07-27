# Atelier Ivory — regressiebaseline

Datum: 27 juli 2026  
Basiscommit: `8061cd7e1d1677cd78ea9699a5d4404575127bce`

## Geautomatiseerde gates

| Gate | Resultaat | Opmerking |
| --- | --- | --- |
| `pnpm lint` | groen | 25/25 Turbotaken |
| `pnpm typecheck` | groen | 25/25 Turbotaken |
| `pnpm test` | groen | alle workspace-suites |
| `pnpm build` | groen | Control-routebuild compleet |
| `pnpm test:a11y` | 29/29 groen | runner bleef na voltooiing hangen bij het opruimen van drie devservers |

De build meldt bestaande Autoprefixer-waarschuwingen voor `start` in
`screen-automation.module.css`. Deze waarschuwingen zijn geen baselinefout en
worden bij de schermdetailmigratie opgelost.

Een eerste volledige E2E-aanroep is verworpen als meetresultaat: de opdracht
bevatte een extra argumentseparator en startte daardoor alle 108 suites tegen
achtergebleven devservers. De resulterende lokale server-time-outs zeggen niets
over de productcode. De definitieve E2E-gate wordt geïsoleerd en met de correcte
Playwright-argumenten uitgevoerd.

## Visuele baseline

`tests/visual/atelier-ivory-evidence.spec.ts` legt zes primaire workspaces vast
in de volledige 4 × 2 viewport/themamatrix en controleert horizontale overflow.
De beelden worden onder `docs/screenshots/atelier-ivory/<stage>/` geschreven en
gebruiken uitsluitend echte lokale seeddata.

Resultaat: 48/48 beelden gegenereerd, zonder horizontale documentoverflow. De
baselinebeelden staan in `docs/screenshots/atelier-ivory/baseline/`.

De visuele steekproef bevestigt de migratieprioriteiten:

- desktopfilters zijn op Media en Studio te dicht en concurreren met de inhoud;
- het donkere thema gebruikt te veel bijna-zwarte vlakken met weinig
  surfacehiërarchie;
- 768 px gedraagt zich nog als een uitgerekte compacte desktop;
- mobiele planning heeft een bruikbare basis, maar mist de canonieke dagagenda
  en inspector-sheet;
- de mobiele ondernavigatie gebruikt nog niet de exacte Atelier Ivory-volgorde
  Overzicht, Schermen, Playlists, Studio en Meer;
- lege states en primaire acties verschillen nog per route in maat en ritme.
