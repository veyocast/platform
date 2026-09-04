# FieldFlow golden review index

> S145 release-override: de S144 platform-/Studio-/marketinggoldens zijn door
> handoff v1.6 als regressie afgewezen. Alleen nieuwe captures die in
> `VISUAL_QA.csv` staan én expliciete menselijke contact-sheetgoedkeuring
> hebben, mogen voor S145 als accepted gelden. De bestaande slidegoldens blijven
> technisch regressiebewijs, maar verlenen geen platformreleasegoedkeuring.

> Op 4 september 2026 heeft de gebruiker de actuele S145-reviewuitvoering
> expliciet als “Perfect” geaccepteerd, met behoud van het huidige officiële
> VeyoCast-icon en met de reeds gebruikte FF-PHOTO-01/06/05/04 als toegestane
> vervangers voor ontbrekende targetfotobronnen. De onderstaande status is die
> menselijke beslissing en geen zelfgoedkeuring door Codex.


Reviewdatum: 2026-09-04
Bronbranch: `veyocast/s145-fieldflow-release-completion`
Correctiebaseline: `19e665cdcf6a2613f70332cb616e87514938d655`

## S145 platformcontactbladen — door gebruiker geaccepteerd

De finale S145-evidence-run maakte in 4,2 minuten na code-freeze 73 current-statecaptures:
66 beelden in de state-matrix, vijf exacte routecaptures en twee gerichte
opstellingsdetailcaptures. De generator maakt vier matrixbladen en vijf
side-by-sidevergelijkingen, samen negen reviewbladen. Het volledige PNG-bewijs
bestaat uit 73 current captures, vijf aangeleverde targets, drie negatieve
baselines en negen sheets: 90 bestanden.

### State-matrixbladen

| Contact sheet | Captures | SHA-256 | Status |
|---|---:|---|---|
| `docs/screenshots/fieldflow/contact-sheets/today-contact-sheet.png` | 30 | `acc1a4a6ce826dbb8ee1c9954154f6227e9eda095ffa0ec213cd7d5bf5cfd629` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/studio-new-contact-sheet.png` | 24 | `39ec642326bf3f9002eb4c1dbb24e18c18bc25738606f242c5c397b76bc3b1b9` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/marketing-home-contact-sheet.png` | 10 | `3fd04d294968b5f6f2d27d3b712bde796b91bec4fa61f3dbea04404cdb266a53` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/control-shell-contact-sheet.png` | 4 | `884847fe1241e02d55e41e3f1d25f435d94149819b8db56c17091ffd1b9e6ef9` | ACCEPTED_BY_USER_2026-09-04 |

### Exacte target-currentvergelijkingen

| Contact sheet | Vergelijking | SHA-256 | Status |
|---|---|---|---|
| `docs/screenshots/fieldflow/contact-sheets/exact-overview-review-sheet.png` | target + current 1920×945 | `278039b260135a6fe6845eebda514c8e0d18e6912b9a24f4e7097ba08d928c3f` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/exact-planning-review-sheet.png` | target + current 1920×945 | `faf3f4157bfc1098438ab6b16fc8ba42872eabfc2df4f13bc311fa7b1e195e6e` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/exact-screens-review-sheet.png` | target + current 1920×945 | `ed1288be229927873708615bd0d199656baf2273f98c8bd919c58b18fb6dfbed` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/exact-studio-review-sheet.png` | target + current 1920×945 | `354d13860b4d2d4dd39f24546ed8b5da3cd1f5662d7b9e6b30407e4e88ed095e` | ACCEPTED_BY_USER_2026-09-04 |
| `docs/screenshots/fieldflow/contact-sheets/exact-marketing-review-sheet.png` | target + current 1905×5961 | `9372f198dbf4c99f0d12be556c534786111d616d38d71f7f2a9ef8b5dd8274f2` | ACCEPTED_BY_USER_2026-09-04 |

### Exact-currentcaptures

| Current capture | Afmetingen | SHA-256 |
|---|---:|---|
| `docs/screenshots/fieldflow/current/reference-overview-1920x945.png` | 1920×945 | `3bd64b074a4fa33a858b00ba48e393bdce1d0a2625411641cc43eed74ac00b33` |
| `docs/screenshots/fieldflow/current/reference-planning-1920x945.png` | 1920×945 | `11bd82a045b8e7c6f99fd5fb80cecc2611433cfc9e8401507fdca7b314f6cd59` |
| `docs/screenshots/fieldflow/current/reference-screens-1920x945.png` | 1920×945 | `8686955b40986284c8e998af2fce7b376b488ae3bfcd04b5d6249f234a2d641d` |
| `docs/screenshots/fieldflow/current/reference-studio-1920x945.png` | 1920×945 | `cebb6323666073d4116ab9edaba32041daa4400ebf246c45322d07babd946546` |
| `docs/screenshots/fieldflow/current/reference-marketing-full-1905x945.png` | 1905×5961 full-page | `605065ee394734691a60442630e81d7df83e0d36aba957488a3046defe43ff8f` |

Codex heeft geen van deze bladen zelf als golden geaccepteerd. De technische
test bewijst bereikbaarheid, contracten, runtimegedrag, overflow, shellrijen,
foutcopy en controlhoogtes. De generator plaatst target en current alleen naast
elkaar en berekent geen pixeldiff; de gebruiker heeft de esthetische/canonieke
beslissing op 4 september 2026 expliciet genomen.

De marketingmatrix bevat ook totale image-failure-captures. Die blijven
structureel schoon en tonen geen native broken-imageglyphs, maar de image-based
header- en footer-lock-ups blijven in die synthetische foutstate leeg. Zonder
het officiële locked targetasset wordt geen tekst-/vectorlock-up nagemaakt;
deze bekende P2 is samen met het behoud van het huidige officiële icon
expliciet menselijk geaccepteerd.

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
`EXTERNAL_UNTESTED`. Uitsluitend de S145-releasegate is door de gebruiker
geaccepteerd als `WAIVED_BY_USER_2026-09-04`; dit voegt geen toestelbewijs toe.

## Beeldassets

De aangeleverde FieldFlow-foto-contactsheet blijft de bronreview voor alle 23
byte-identiek overgenomen webderivatives. Hashes, provenance en gebruik staan in
`ASSET_REGISTER.csv` en `ASSET_PROVENANCE.md`; er is geen klantclaim aan deze
generieke beelden gekoppeld.
