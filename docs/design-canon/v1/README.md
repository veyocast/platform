# Castivo Bold — Design & Product Canon v1.0.0

Dit pakket is de normatieve bron voor de visuele en interactionele uitwerking van Castivo: merk, marketingwebsite, Control-dashboard, responsive PWA en fullscreen Player/ClubTV.

## Start hier

1. Lees `Castivo_Design_Canon_v1.0.pdf` voor de gepubliceerde versie.
2. Gebruik `Castivo_Design_Canon_v1.0.docx` voor redactionele wijzigingen.
3. Gebruik `CASTIVO_DESIGN_CANON_v1.0.md` als versiebeheerbare bron.
4. Importeer `castivo-design-tokens.json` als machine-readable tokenbron.
5. Gebruik `castivo-design-tokens.css` en `castivo-tailwind-preset.ts` voor implementatie.
6. Gebruik de twee CSV-bestanden als backlog, Storybook-index en QA-matrix.

## Inhoud

- `Castivo_Design_Canon_v1.0.pdf` — gepubliceerde canon, 94 pagina's.
- `Castivo_Design_Canon_v1.0.docx` — bewerkbare canon.
- `CASTIVO_DESIGN_CANON_v1.0.md` — bronbestand, ruim 13.000 woorden.
- `castivo-design-tokens.json` — semantische en primitieve tokens.
- `castivo-design-tokens.css` — light/dark CSS-variabelen.
- `castivo-tailwind-preset.ts` — Tailwind-mapping.
- `castivo-component-inventory.csv` — 128 primitives, controls, patterns en templates.
- `castivo-page-template-inventory.csv` — 26 canonieke pagina- en stateblauwdrukken.
- `assets/castivo-official-icon.png` — het exact aangeleverde officiële C-icoon.
- `references/` — goedgekeurde visuele richting voor brandboard, marketing en Player.

## Autoriteit en conflictregel

Bij tegenstrijdigheid geldt deze volgorde:

1. een juridisch en visueel goedgekeurd logo- of iconmasterbestand;
2. de normatieve regels in de canon;
3. de machine-readable design tokens;
4. de component- en paginainventarissen;
5. visuele referentiebeelden.

Referentiebeelden zijn art direction en geen bron voor het reconstrueren van logo, woordmerk, exacte copy of interfacecode.

## Belangrijke merkassetnoot

Het officiële compacte C-icoon is in `assets/` opgenomen. Een horizontale logo-lock-up, inverse lock-up en monochrome varianten horen als afzonderlijke goedgekeurde masterbestanden in de centrale brandmap te staan. Totdat die masters formeel zijn aangeleverd, mogen ze niet uit screenshots of mock-ups worden getraceerd of nagemaakt.

## Implementatievolgorde

- Foundations: kleur, type, spacing, grid, motion en toegankelijkheid.
- Shared primitives en controls.
- Marketingpatterns.
- Control-patterns en productflows.
- Player setup, diagnostics en playbacktemplates.
- Responsive, accessibility en state-tests.
- Storybook/Figma-publicatie en release-QA.

## Kwaliteitsstatus

- DOCX visueel gecontroleerd over alle 94 pagina's.
- PDF opnieuw gerenderd en gecontroleerd op 94 A4-pagina's.
- Geen clipping, overlappende tekst, ontbrekende glyphs of gebroken tabellen aangetroffen.
- DOCX accessibility audit: 0 high, 0 medium, 0 low issues.
- PDF bevat ingebedde fonts, documentoutline en metadata.

## Versiebeheer

Gebruik semantische versies:

- patch — verduidelijking zonder token- of componentwijziging;
- minor — nieuwe backwards-compatible componenten of patronen;
- major — fundamentele merk-, token-, component- of productwijziging.

De actuele versie is `1.0.0`.
