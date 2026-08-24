# Vector v2 — fase 1 foundationsbewijs

Status: `IN_PROGRESS`  
Datum: 24 augustus 2026

## Besluit: compatibilitylaag, geen big-bang

De bestaande `--vc-*`-tokens zijn een productiecontract voor Control, Studio,
Publisher, Player en tests. Vector v2 is daarom als namespaced
`--vc-vector-*`-laag toegevoegd. Bestaande rollen worden niet stilzwijgend
overschreven. Nieuwe en gemigreerde componenten kunnen de Vectorrol gebruiken
met een terugval naar het bestaande contract. Dit houdt oude clients en
immutable Playeroutput bruikbaar tijdens de rollout.

## Canonieke tokenpipeline

- Bron: `tokens/veyocast-vector-v2-tokens.json` uit het gevalideerde
  afleverpakket.
- Web: `createVectorCssVariables` genereert theme-, semantic-, spacing-,
  typography-, motion-, touch-, layout- en z-indexaliases in de bestaande CSS.
- TypeScript/native: `createVectorTokenModuleSource` genereert
  `veyocastVectorTokens` als getypeerde module.
- Native: `@veyocast/mobile-design-system` importeert dezelfde gegenereerde
  module voor canvas/surface/ink/line/focus/action/status/spacing/radius/touch.
- Reduced motion zet page/venue-motion terug naar statische feedback.
- De dependency is een lokale workspace dependency; er is geen externe
  runtimepackage of nieuwe licentie geïntroduceerd.

## Gedeelde primitives

Onder `packages/ui/src/components/` zijn toegevoegd:

- `CommandBar`;
- `SegmentedControl`;
- `JourneyShell` met permanente previewkolom en mobiele herordening;
- `StickyActionBar` met safe-area;
- `HealthBadge`;
- `ScreenSnapshot` voor 16:9 en 9:16;
- `UnifiedFilterDock` boven het bestaande FilterBar-contract;
- `ResourcePicker` voor media, slides, templates, elementen, dynamische
  bronnen en integraties.

De Resource Picker gebruikt het bestaande Radix Dialog-contract, ondersteunt
zoeken, filtertabs, tellingen, status met tekst én kleur, lege categorieën en
focus-return. Op smalle viewports wordt het bestaande full-height
dialog/sheetgedrag gebruikt.

## Eerste productintegratie

De Studio Element Library gebruikt niet langer een eigen inline media-/
elementenbrowser. Eén gedeelde pop-up toont nu:

- bewerkbare tekst, vlak, cirkel, lijn, QR en icoon;
- tenant-scoped gereedstaande afbeeldingen;
- zoeken en expliciete categorieën `Elementen` en `Media`, ook wanneer Media
  leeg is;
- uploaddeeplink naar de bestaande tenantveilige Media-flow.

De gekozen bron wordt nog steeds via de bestaande Studio reducer toegevoegd;
documentformaat, revisies, autosave, permissions en rendercontract zijn niet
gewijzigd.

## Bewijs

| Gate | Resultaat |
| --- | --- |
| Tokens lint/typecheck | PASS |
| Tokens unit | 6/6 PASS |
| Tokens build/generation | PASS |
| UI lint/typecheck | PASS |
| UI unit | 17/17 PASS |
| UI Storybook production build | PASS |
| Mobile design system lint/typecheck | PASS |
| Mobile design system unit | 3/3 PASS |
| Control Mobile lint/typecheck | PASS |
| Control Mobile unit | 9/9 PASS |
| Control typecheck | PASS |
| Control unit | 174/174 PASS |
| Studio Chromium E2E | 3/3 PASS |
| Player offline | 7/7 PASS |

De Storybookbuild meldt de bekende Vite-opmerking dat RSC `use client`-
directives in de losstaande browserbundle worden genegeerd; de build slaagt en
dezelfde directives blijven voor Next.js behouden.

## Nog open binnen fase 1

- ontbrekende geharmoniseerde combobox/tabs/menu/popover/tooltip/toaststates;
- Vector primitives toepassen op de overige shells en routefamilies;
- native Journey/Picker-equivalenten en Player-statevisuals;
- volledige light/dark/viewport visual matrix en axe-interactietest.
