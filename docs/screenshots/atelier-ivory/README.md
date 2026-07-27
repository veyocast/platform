# Atelier Ivory visueel bewijs

De beeldmatrix wordt gegenereerd met echte lokale seeddata en bevat voor
Overzicht, Schermen, Playlists, Media, Planning en Studio:

- 390 × 844;
- 768 × 1024;
- 1440 × 900;
- 1920 × 1080;
- licht en donker thema.

Run vanuit de repositoryroot met de lokale Supabase-omgeving actief:

```bash
ATELIER_IVORY_EVIDENCE=1 \
ATELIER_IVORY_STAGE=baseline \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY="<lokale anon key>" \
PLAYWRIGHT_CONTROL_ONLY=1 \
pnpm exec playwright test tests/visual/atelier-ivory-evidence.spec.ts \
  --project=chromium --workers=1
```

Gebruik `ATELIER_IVORY_STAGE=final` voor de eindbeelden. De test faalt naast
visuele capture ook op horizontale documentoverflow.
