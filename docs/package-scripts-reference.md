# Package Scripts Reference

Recommended root scripts:

```json
{
  "dev": "turbo dev",
  "build": "turbo build",
  "lint": "turbo lint",
  "typecheck": "turbo typecheck",
  "test": "turbo test",
  "test:e2e": "playwright test",
  "test:a11y": "playwright test tests/a11y",
  "test:player": "playwright test tests/player",
  "test:player:offline": "playwright test tests/player-offline",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "test:rls": "supabase test db",
  "tokens:build": "tsx packages/tokens/scripts/build.ts",
  "storybook": "pnpm --filter @castivo/ui storybook"
}
```
