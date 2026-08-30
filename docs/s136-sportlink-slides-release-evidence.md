# S136 — Sportlink-pouleslides en aankomstvenster

## Oorzaak en herstel

Een read-only productiecontrole op 30 augustus 2026 bewees dat
`eigenwedstrijden=JA` de poulefeed vernauwt. Een rechtstreekse omschakeling van
`NEE` naar `JA` zou dus overige poulewedstrijden verliezen. De algemene
Sportlink-uitslagenfeed bevatte de eigen wedstrijden wel, maar vier van vier
gecontroleerde eigen uitslagen hadden geen pouleobject. De officiële teamcode
was bij alle vier aanwezig.

De worker houdt daarom de providerbrede poule-artikelen op `NEE`, koppelt een
eigen wedstrijd zonder pouleobject via `teamcode`/`lokaleteamcode` aan de reeds
gesynchroniseerde poulecontext en dedupliceert daarna op de provider-
wedstrijdcode. Bestaande overige poulewedstrijden, scores, immutable releases
en last-known-good playback blijven behouden.

De generieke foutmelding na `10.000` minuten ontstond vóór de batch-RPC: het
contract accepteerde maximaal 720 minuten en de snapshotfunctie begrensde
dezelfde waarde opnieuw. De UI biedt nu een invulveld met minuten, uren of
dagen. Intern en in bestaande versies blijft de waarde minuten; de maximale
vooruitblik is 42 dagen (`60.480` minuten), gelijk aan de al opgehaalde
providerhorizon. De servermelding benoemt voortaan oorzaak, toegestane grens en
herstelactie.

## Playerweergave

- browser/preview: uitslag 20 → 30 px, score 31 → 46,5 px;
- browser/preview: standrij 28 → 42 px en portrait 25 → 37,5 px;
- LG Legacy gebruikt dezelfde factor voor stand en uitslag;
- standen pagineren per 10 regels; uitslagen per 6 landscape- of 5
  portraitregels;
- goldens en computed-stylechecks bewijzen de maten zonder viewportoverflow.

## Database en security

Migratie `20260830175500_s136_sportlink_arrival_window_units.sql` vervangt
uitsluitend de onderliggende S119-snapshotfunctie. De bestaande S122-theme-,
S128-verjaardag- en S129-thuiswedstrijdwrappers blijven daardoor in dezelfde
volgorde actief. De private begrenzingsfunctie heeft geen execute-recht voor
`public`, `anon` of `authenticated`; de bestaande RLS- en commandgrenzen
wijzigen niet.

Forward: waarden van 0 tot en met 60.480 minuten worden exact gebruikt en
hogere database-input faalt defensief op 60.480. Rollback: de vorige functie
kan worden hersteld met de oude maxima 720/360; reeds opgeslagen hogere
configuraties blijven JSON-compatibel maar zouden dan opnieuw begrensd worden.

## Bewijsstatus

- contracts: 9 bestanden / 49 tests groen;
- domain: 10 bestanden / 55 tests groen;
- Control: 46 bestanden / 203 tests groen;
- media-worker: 20 bestanden / 96 tests groen;
- content-templates: 6 bestanden / 48 tests groen;
- Player-unit: 45 bestanden / 179 tests groen;
- verse lokale database-reset groen;
- RLS: 66 bestanden / 1.408 tests groen;
- Editorial Arena-matrix: 48 visuele cellen groen;
- browserstand landscape/portrait en LG Legacy-stand gericht groen;
- workspace lint/typecheck/test: 30/30 turbodoelen groen;
- production build: 18/18 turbodoelen groen;
- a11y: 36 groen, 1 conditionele live-skip;
- brede Chromium-suite: 179 groen, 21 conditionele live-skips. De enige
  runnerafwijking was een navigatie die exact tijdens de automatische
  Next-dev-geheugenherstart bleef wachten; dezelfde volledige mobiele
  routescan is direct daarna geïsoleerd in 52,6 seconden groen;
- Player: 107/107 groen;
- Player offline: 7/7 groen.

De immutable VPS-build en staging-/production-readbacks volgen na merge via de
bestaande VPS-releaseflow; GitHub Actions is geen deploypad voor S136.
