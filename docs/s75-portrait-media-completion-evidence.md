# S75 — Portrait-media transactionele afronding

## Incident

Na de S74-normalisatie maakte de worker een geldige staande playervariant van
`1080 × 1920`. `complete_media_processing_job` valideerde echter nog met de
oude landscapegrenzen `width <= 1920` en `height <= 1080`. De transactionele
registratie faalde daardoor met databasecode `23514`. De worker classificeerde
dit veilig als `complete_failed`, probeerde maximaal drie keer en liet het asset
als `validation_failed` buiten playlists staan.

De screenshots uit production passen exact bij die toestand:

- de upload en queue-intake waren geslaagd;
- beide portraitvideo's stopten na drie pogingen;
- Control toonde de algemene fallback omdat `complete_failed` nog geen eigen
  hersteltekst had.

## Herstel

De completion-RPC gebruikt nu hetzelfde oriëntatie-onafhankelijke contract als
de worker:

```text
max(width, height) <= 1920
min(width, height) <= 1080
```

Daardoor zijn onder andere `1920 × 1080`, `1080 × 1920`, `1280 × 720` en
`720 × 1280` toegestaan, terwijl `1920 × 1920` nog steeds wordt geweigerd.
Checksums, tenantpad, bestandsgrootte, duur, workerlease en service-rolegrens
blijven ongewijzigd.

Control toont bij een terminale verwerkingsfout voortaan de begrensde foutcode
en geeft voor `complete_failed` de concrete actie om de bestaande job opnieuw te
starten. Bestaande immutable releases en eerder geldige varianten worden niet
gewijzigd.

## Acceptatie

- `pnpm db:reset`;
- `pnpm test:rls`: 44 bestanden en 820 assertions groen;
- expliciete RLS-regressie voor `1080 × 1920`;
- expliciete afwijzing van `1920 × 1920`;
- migratiesafetyguard groen;
- media-worker: lint, typecheck, 65 tests en build groen;
- Control: lint, typecheck, 125 tests en production build groen;
- workspace: lint, typecheck en test groen;
- toegankelijkheid: 32/32 Chromiumproeven serieel groen;
- volledige parallelle browsermatrix: 125 groen, acht bewuste live/visual skips;
  de viewportmatrix en Marketing-link overschreden alleen onder parallelle
  devserverbelasting hun grens en zijn beide geïsoleerd groen;
- na deployment één bestaande mislukte portraitupload via
  **Verwerking opnieuw proberen** hervatten;
- bevestigen dat het asset `Gereed`, `1080 × 1920` en zonder validatiefout wordt.
