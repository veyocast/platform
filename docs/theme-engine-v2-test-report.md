# Theme-engine v2 — lokaal testrapport

Datum: 2026-08-20. Branch: `veyocast/s109-theme-engine-v2`, basis
`d3fe23498431482cb550a1829512955bd29c1350`.

## Omgeving

- Linux 6.8 x86_64, AMD EPYC-Genoa, 8 vCPU;
- Node 24.18.0 en pnpm 11.5.2;
- Playwright 1.61.1, gepinde Chromium, deviceScaleFactor 1;
- lokale Supabase CLI 2.109.1.

Deze omgeving is CI-/ontwikkelbewijs en geen vervanging voor fysieke LG-webOS-
certificatie.

## Uitgevoerde gates

- `pnpm lint && pnpm typecheck && pnpm test`: 30/30 Turbotasks groen per gate;
- `pnpm db:reset && pnpm test:rls`: fresh reset groen, 47 bestanden en 944
  assertions groen;
- `pnpm --filter @veyocast/control test`: 142/142 groen;
- Control-, Player-, contracts-, content-template- en workerproductieb builds:
  groen; alleen bestaande autoprefixerwaarschuwingen in screen automation;
- `pnpm test:a11y --project=chromium --workers=1`: 35/35 groen;
- na de laatste Twelve-DnD-wijziging is de gerichte dynamische-workspace-
  a11ytest opnieuw groen (1/1);
- `pnpm test:player:offline --project=chromium --workers=1`: 7/7 groen;
- de bestaande Editorial Arena-goldenset is na named design approval opnieuw
  gegenereerd en vervolgens zonder update-modus groen: 48/48 cellen;
- `pnpm test:e2e --project=chromium --workers=2`: 151 groen en 8 bewuste
  live/visual-evidenceskips na de goedgekeurde baseline-update;
- read-only migratiedry-run: 0 v2, 0 legacy en 0 ongeldige lokale slides;
- rollbackscript in een omringende rollbacktransactie: syntactisch en
  functioneel groen; de actuele wrapper bleef daarna aanwezig.

## Designapproval en hardwarestatus

Danny heeft op 2026-08-20 de Theme Engine v2-goldens voor manifest `1.0.0`
expliciet goedgekeurd en regeneratie geautoriseerd. De bedoelde lokale-font- en
theme-renderwijziging is daarop in alle 48 bestaande Editorial Arena-baselines
vastgelegd. De onafhankelijke herhaling zonder update-modus is groen.

De volledige machineleesbare matrix van 760 cellen is vastgelegd in
`themeVisualMatrix`; de gedeelde snapshotreader resolveert alle 720 echte
slide×theme×mode×oriëntatiecellen in unit-tests.
De machineleesbare 10×2×2-dekking en de gedeelde resolverchecks blijven naast
de 48 browsergoldens het volledige combinatorische bewijs leveren.

P50/p95/p99 FPS/geheugenbewijs op de laagste ondersteunde fysieke Player
ontbreekt. Deze hardwaregate blijft eerlijk `UNTESTED`; er is geen gefingeerd
Chromium-naar-LG-performancebewijs opgenomen. Danny heeft op 2026-08-20
expliciet geautoriseerd dat de production-uitrol zonder voorafgaande fysieke
LG-test mag doorgaan.
