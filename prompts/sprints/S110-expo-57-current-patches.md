# S110 — actuele Expo SDK 57-patches

## Doel

Herstel de verplichte Control Mobile-native releasegate nadat Expo binnen SDK 57
nieuwe compatibele patchversies is gaan voorschrijven. Gebruik Expo's eigen
dependencyvalidatie als bron van waarheid en wijzig geen applicatiegedrag.

## Scope

- `apps/control-mobile/package.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml` voor de door pnpm vastgelegde release-age allowlist;
- `TASK_LEDGER.md` en dit sprintbewijs.

## Verplicht

- voer `expo install --fix` uit in de Control Mobile-workspace;
- accepteer alleen stabiele SDK 57-patchversies;
- behoud React Native, appconfiguratie, permissions en Play-identiteit;
- genereer geen handmatig beheerde Android-bronbestanden;
- laat GitHub CI de release-AAB en 16-KB-uitlijning bewijzen.

## Gates

```bash
pnpm install --frozen-lockfile
pnpm --filter @veyocast/control-mobile exec expo install --check
pnpm --filter @veyocast/control-mobile config:validate
pnpm --filter @veyocast/mobile-design-system lint
pnpm --filter @veyocast/mobile-design-system typecheck
pnpm --filter @veyocast/mobile-design-system test
pnpm --filter @veyocast/control-mobile lint
pnpm --filter @veyocast/control-mobile typecheck
pnpm --filter @veyocast/control-mobile test
pnpm --filter @veyocast/control lint
pnpm --filter @veyocast/control typecheck
pnpm --filter @veyocast/control test
pnpm --filter @veyocast/control-mobile build
node scripts/assert-client-bundle-secret-free.mjs apps/control-mobile
pnpm --filter @veyocast/control-mobile prebuild:android
pnpm lint
pnpm typecheck
pnpm test
```

De gegenereerde `apps/control-mobile/android/`-map blijft ongeversioneerd. Zonder
lokale Android SDK is de GitHub-gate voor Android lint, unit, AAB en 16-KB het
doorslaggevende native bewijs.
