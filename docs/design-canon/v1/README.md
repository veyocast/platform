# VeyoCast Bold — Design & Product Canon v2.1.3

Dit pakket is de normatieve bron voor de visuele en interactionele uitwerking van VeyoCast: merk, marketingwebsite, Control-dashboard, responsive PWA en fullscreen Player/ClubTV.

## Start hier

1. Gebruik `VEYOCAST_DESIGN_CANON_v2.0.md` als normatieve en versiebeheerbare bron.
2. Gebruik `VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0.md` aanvullend als
   routespecifieke bron voor tenant-Control, Publisher en de beheer-PWA.
3. Importeer `veyocast-design-tokens.json` als machine-readable tokenbron.
4. Gebruik `veyocast-design-tokens.css` en `veyocast-tailwind-preset.ts` voor implementatie.
5. Gebruik de twee CSV-bestanden als backlog, Storybook-index en QA-matrix.

## Inhoud

- `VEYOCAST_DESIGN_CANON_v2.0.md` — normatieve bron.
- `VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0.md` — bindende tenant-Publisher-
  compositie, routes, workflows en uitvoeringslat.
- `veyocast-design-tokens.json` — semantische en primitieve tokens.
- `veyocast-design-tokens.css` — light/dark CSS-variabelen.
- `veyocast-tailwind-preset.ts` — Tailwind-mapping.
- `veyocast-component-inventory.csv` — component-, control-, pattern- en template-inventaris.
- `veyocast-page-template-inventory.csv` — canonieke pagina- en stateblauwdrukken.

## Autoriteit en conflictregel

Bij tegenstrijdigheid geldt deze volgorde:

1. een juridisch en visueel goedgekeurd logo- of iconmasterbestand;
2. de machine-readable design tokens;
3. de routespecifieke Publisherregels binnen tenant-Control;
4. de algemene normatieve regels in het hoofdcanon;
5. de component- en paginainventarissen.

Security/RLS, immutable releases, playercompatibiliteit, offline last-known-good
en WCAG-eisen kunnen niet door een visuele referentie worden afgezwakt.

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

De actuele hoofdcanonversie is `2.1.3`; het aanvullende Publishercanon is
afzonderlijk versie `1.0`.
