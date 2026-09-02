# FieldFlow golden review index

Reviewdatum: 2026-09-02
Bronbranch: `veyocast/s144-fieldflow-platform-redesign`
Nulmeting: `6fe477a332ab6565a6bb3205959ebfe7766e9a2c`

## Moderne Editorial Arena

De reproduceerbare Playwrightmatrix bevat zestien representatieve
data-/compositievarianten × landscape/portrait × light/dark: 64 goldens. De
test bewaakt canvasmaat, overflow, footer-clearance, font- en afbeeldingsstatus,
FieldFlow theme-ID en familie-eigen geometrie.

Test: `tests/player/editorial-arena-visual-matrix.spec.ts`
Goldens: `tests/player/editorial-arena-visual-matrix.spec.ts-snapshots/`

| Familie | Varianten in review | Representatief bewijs |
|---|---|---|
| Menu/prijslijst | met foto, reserve-empty | `price-with-photo-landscape-light-chromium-linux.png` |
| Nieuws | hero, fullscreen gradient, grid, text-only | `news-fullscreen-portrait-dark-chromium-linux.png` |
| Stand | 10 en 20 regels | `standing-20-landscape-dark-chromium-linux.png` |
| Programma | 5 en 20 wedstrijden | `program-20-landscape-light-chromium-linux.png` |
| Uitslagen | 5 en 20 wedstrijden | `results-20-portrait-dark-chromium-linux.png` |
| Team | foto, lange naam, pagination | `team-roster-landscape-light-chromium-linux.png` |
| Sponsor | quiet plate/contain, lange naam | `sponsor-spotlight-portrait-dark-chromium-linux.png` |
| Training | dense schema, twee kolommen | `training-schedule-landscape-dark-chromium-linux.png` |
| Vrijwilligers | callout plus rollen | `volunteer-call-portrait-light-chromium-linux.png` |

Reviewuitkomst: geen horizontale/verticale overflow, geen footerbotsing,
fullscreen-copy blijft linksboven en de foto-overlay blijft binnen de
FieldFlow-bounds. De 48 gewijzigde historische bestanden en zestien nieuwe
bestanden zijn een expliciete S144-designwijziging, niet een blinde refresh.

## Menu Studio v2

De matrix bevat elf intern renderbare theme-ID's × twee oriëntaties × twee
modi: 44 goldens. De veertig legacy-goldens bleven bij de S144-run pixelstabiel;
vier nieuwe FieldFlow-goldens zijn toegevoegd en visueel beoordeeld.

Test: `tests/player/menu-studio-visual-matrix.spec.ts`
Goldens: `tests/player/menu-studio-visual-matrix.spec.ts-snapshots/`

- `menu-studio-fieldflow-light-landscape-chromium-linux.png`
- `menu-studio-fieldflow-light-portrait-chromium-linux.png`
- `menu-studio-fieldflow-dark-landscape-chromium-linux.png`
- `menu-studio-fieldflow-dark-portrait-chromium-linux.png`

## Static LG Legacy

De zelfstandige Chrome-79-renderer heeft zestien nieuwe FieldFlow-goldens voor
team, sponsor, training en vrijwilligers: vier families × twee oriëntaties ×
twee modi. De gate vond en voorkwam tijdens review een sponsorcanvas-overflow;
sponsors pagineren nu als één rustige spotlight per pagina.

Test: `tests/player/lg-legacy-player.spec.ts` (`Static LG bewaakt de zestien…`)
Goldens: `tests/player/lg-legacy-player.spec.ts-snapshots/fieldflow-lg-*`

Representatieve review:

- `fieldflow-lg-sponsor-spotlight-landscape-light-chromium-linux.png`
- `fieldflow-lg-team-roster-portrait-dark-chromium-linux.png`
- `fieldflow-lg-training-schedule-landscape-dark-chromium-linux.png`
- `fieldflow-lg-volunteer-call-portrait-light-chromium-linux.png`

De bestaande LG-suite bewaakt daarnaast nieuws, stand, menu/prijs, arrivals,
match center, LED-momenten, cache/LKG, recovery en posterfallback. Een
browseremulator is geen fysieke LG-acceptatie; de 43UL3J-EP-status blijft
`EXTERNAL_UNTESTED`.

## Beeldassets

De aangeleverde FieldFlow-foto-contactsheet blijft de bronreview voor alle 23
byte-identiek overgenomen webderivatives. Hashes, provenance en gebruik staan in
`ASSET_REGISTER.csv` en `ASSET_PROVENANCE.md`; er is geen klantclaim aan deze
generieke beelden gekoppeld.
