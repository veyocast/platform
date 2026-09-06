# S151 — Gedeelde dropdown-multiselect bewijs

## Baseline en scope

- Baseline: `138889a05da8cf3ebaabb425b09aa9d525347e3d`.
- Branch: `veyocast/s151-shared-multiselect`.
- Featurecommit: `f3186ad`; actuele-mainmerge: `7570c4b`.
- Pull request: `#171`; deployment volgt na beschermde CI en merge.
- Geen schema-, migratie-, provider-, Player-, release- of lockfilewijziging.

## Implementatie

- `@veyocast/ui` levert één tokengebaseerde `MultiSelectDropdown` met zoeken,
  tags, bulkacties, disabled opties, grenzen, lege staten en herhaalde verborgen
  formulierwaarden.
- De Sportlink-bulkwizard kiest teams voortaan per onderdeel in een compacte
  dropdown. De onderliggende gewone team × type-drafts en geaggregeerde
  welkomstcomponenten blijven ongewijzigd.
- Dezelfde control vervangt pure entiteitslijsten voor schermgroepen,
  schermlidmaatschappen, LED Scores, verjaardagsrollen en supportroutering.
- Statuskritieke preflight-, rechten-, volgorde- en tabelbulkselecties blijven
  bewust zichtbaar en gespecialiseerd.

## Verificatie

- `pnpm lint`: 30/30 workspacetaken groen.
- `pnpm typecheck`: 30/30 workspacetaken groen.
- `pnpm test`: 30/30 workspacetaken groen; na de actuele-mainmerge is Control
  opnieuw groen met 63 bestanden en 354 tests, `@veyocast/ui` met 19 tests.
- `pnpm build`: 18/18 workspacetaken groen, inclusief Control-auth- en
  clientbundelcontroles.
- `pnpm test:a11y`: 36 tests groen, 1 expliciete live-test overgeslagen.
- `pnpm test:e2e -- --project=chromium`: 192 tests groen, 23 expliciete
  live-/visual-evidencetests overgeslagen.
