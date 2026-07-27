# Atelier Ivory visueel bewijs

De beeldmatrix wordt gegenereerd met echte lokale seeddata en bevat voor
Overzicht, Schermen, Playlists, Playlist Builder, Media, Planning, Studio en
de Studio create-flow:

- 390 × 844;
- 768 × 1024;
- 1440 × 900;
- 1920 × 1080;
- licht en donker thema.

Run vanuit de repositoryroot met de lokale Supabase-omgeving actief:

```bash
ATELIER_IVORY_EVIDENCE=1 \
ATELIER_IVORY_STAGE=final \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY="<lokale anon key>" \
PLAYWRIGHT_CONTROL_ONLY=1 \
pnpm exec playwright test tests/visual/atelier-ivory-evidence.spec.ts \
  --project=chromium --workers=1
```

De test faalt naast visuele capture op horizontale documentoverflow,
samenvattingsitems buiten hun container, client exceptions, hydrationfouten en
console-errors.

De Studio-editor gebruikt de expliciete lokale demofixture:

```bash
ATELIER_IVORY_EVIDENCE=1 \
ATELIER_IVORY_DEMO=1 \
ATELIER_IVORY_STAGE=final-demo \
ATELIER_IVORY_ROUTES=studio-editor \
PLAYWRIGHT_CONTROL_ONLY=1 \
pnpm exec playwright test tests/visual/atelier-ivory-evidence.spec.ts \
  --project=chromium --workers=1
```

Voor snelle iteratie kan de matrix worden beperkt, bijvoorbeeld:

```bash
ATELIER_IVORY_ROUTES=overview,screens \
ATELIER_IVORY_VIEWPORTS=390x844,1440x900 \
ATELIER_IVORY_OUTPUT_ROOT=/tmp/atelier-ivory-review \
# ...dezelfde omgeving en Playwright-opdracht
```

Aanvullende routes zijn selecteerbaar met `screen-groups`, `releases`,
`templates`, `integrations`, `settings`, `team`, `support`, `auditlog` en
`platform`.
