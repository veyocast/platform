# VeyoCast Bold — Design & Product Canon v2.1.0

Dit pakket is de normatieve bron voor de visuele en interactionele uitwerking van VeyoCast: merk, marketingwebsite, Control-dashboard, responsive PWA en fullscreen Player/ClubTV.

## Start hier

1. Gebruik `VEYOCAST_DESIGN_CANON_v2.0.md` als normatieve en versiebeheerbare bron.
2. Importeer `veyocast-design-tokens.json` als machine-readable tokenbron.
3. Gebruik `veyocast-design-tokens.css` en `veyocast-tailwind-preset.ts` voor implementatie.
4. Gebruik de twee CSV-bestanden als backlog, Storybook-index en QA-matrix.

## Inhoud

- `VEYOCAST_DESIGN_CANON_v2.0.md` — normatieve bron.
- `veyocast-design-tokens.json` — semantische en primitieve tokens.
- `veyocast-design-tokens.css` — light/dark CSS-variabelen.
- `veyocast-tailwind-preset.ts` — Tailwind-mapping.
- `veyocast-component-inventory.csv` — component-, control-, pattern- en template-inventaris.
- `veyocast-page-template-inventory.csv` — canonieke pagina- en stateblauwdrukken.

## Autoriteit en conflictregel

Bij tegenstrijdigheid geldt deze volgorde:

1. een juridisch en visueel goedgekeurd logo- of iconmasterbestand;
2. de normatieve regels in de canon;
3. de machine-readable design tokens;
4. de component- en paginainventarissen.

## Merkassetstatus

De officiële VeyoCast-merkassetset v1.0 is op 20 juli 2026 goedgekeurd door ontwerper en merkeigenaar Danny Goldenbelt. De primaire, inverse en compacte SVG-masters staan byte-ongewijzigd en immutable in `assets/brand/`. Alleen de daar beschreven monochrome, favicon-, PWA-, Apple touch- en social-afgeleiden zijn eveneens officieel; iedere andere variant vereist nieuwe expliciete goedkeuring.

## Implementatievolgorde

- Foundations: kleur, type, spacing, grid, motion en toegankelijkheid.
- Shared primitives en controls.
- Marketingpatterns.
- Control-patterns en productflows.
- Player setup, diagnostics en playbacktemplates.
- Responsive, accessibility en state-tests.
- Storybook/Figma-publicatie en release-QA.

## Versiebeheer

Gebruik semantische versies:

- patch — verduidelijking zonder token- of componentwijziging;
- minor — nieuwe backwards-compatible componenten of patronen;
- major — fundamentele merk-, token-, component- of productwijziging.

De actuele versie is `2.1.0`.
