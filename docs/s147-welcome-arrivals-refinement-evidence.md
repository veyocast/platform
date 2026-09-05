# S147 — Welkomstschermen verfijnen

Status op 5 september 2026: `READY_FOR_RELEASE`, `NOT_DEPLOYED`.

## Scope

Deze vervolgtaak verwerkt praktijkfeedback op de Sportlink-welkomstschermen:

- maximaal twee wedstrijden per slide;
- landscape links/rechts en portrait boven/onder;
- geen zichtbare aankomsttijd;
- club/team met daar direct onder de grotere regel `Aanvang · Kleedkamer`;
- een volledig witte plaat achter het voorgrondlogo;
- een kaartvullend achtergrondlogo op 30% opacity;
- lichtere animaties voor soepelere TV-weergave.

De taak raakt geen database, RLS, service worker, dependencies of locked
merkassets. Immutable releases en last-known-good playback blijven
ongewijzigd.

## Implementatie

Nieuwe welkomstconfiguraties starten met twee wedstrijden per slide en zonder
aankomsttijd. Het contract accepteert bestaande configuraties met drie of vier
kaarten nog steeds, maar moderne en statische LG-rendering begrenzen iedere
pagina op twee. Vanaf de derde wedstrijd ontstaat automatisch een volgende
slide.

De renderer haalt `Aankomst` ook uit bestaande snapshottekst, combineert
`Aanvang` en `Kleedkamer` in de prominente tweede regel en laat overige metadata
in de ondersteunende regel staan. De kleine logoplaat gebruikt exact wit. Het
achtergrondlogo beslaat de volledige kaart en gebruikt opacity `0.3`.

Alle vijf bestaande motionpresets blijven selecteerbaar. Hun uitvoering is
teruggebracht naar opacity en transform in 680 ms met 80 ms stagger. Blur,
filters, clip-path, gloedlagen en losse tekstanimaties zijn verwijderd.

## Verificatie

| Gate | Resultaat |
|---|---|
| Gerichte contract-, template-, Control- en Player-tests | `PASS` |
| Welkomstbrowsermatrix | `PASS` — 4/4, inclusief 1–4 bronwedstrijden, landscape, portrait en reduced motion |
| Statische LG-regressie | `PASS` — maximaal twee kaarten, teksthiërarchie en logo-oppervlakken |
| `pnpm lint` | `PASS` — 30/30 doelen |
| `pnpm typecheck` | `PASS` — 30/30 doelen |
| `pnpm test` | `PASS` — 30/30 doelen |
| `pnpm build` | `PASS` — 18/18 doelen |
| `pnpm test:a11y` | `PASS` — 36 groen, 1 intentionele skip |
| `pnpm test:e2e -- --project=chromium` | `PASS` — 192 groen, 23 intentionele skips in 19,5 minuten |
| `pnpm test:player` | `PASS` — 117/117 |
| `pnpm test:player:offline` | `PASS` — 7/7 |
| `git diff --check`, ownership en secretscan | `PASS` |

De vijf bijgewerkte visuele goldens bewaken één en twee kaarten in landscape,
legacy bronconfiguraties met drie en vier wedstrijden en twee kaarten in
portrait.

## Release

Baseline is `0abe7e1be2c9510515189153df047acf746c3d02`. PR/CI, merge en exact-SHA
staging-/productiedeployment volgen na deze lokale releasegates.
