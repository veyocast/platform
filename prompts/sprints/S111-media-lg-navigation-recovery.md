# S111 — Media, LG en navigatieherstel

## Doel

Herstel LG-video, Theme Engine v2 op LG en de ontsnappende dynamische preview. Voer tegelijk de media-/playlist-/navigatie-audit uit en herstel de productgrenzen tussen gebruikersmedia, providerassets, technische output en immutable releases.

## Scope

- Control Media, assetpickers, schermen, schermgroepen, planning en mobiele shell.
- Sportlink media-worker, globale providercache en snapshot/release-integratie.
- Player release-envelop en statische LG Legacy-runtime.
- Supabase schema, ACL/RLS, storage en regressietests.

## Harde invarianten

- gebruikersmedia ≠ providerassets ≠ technische output;
- normale gebruikers kiezen een playlist; de server bevriest de actuele release;
- bestaande releases blijven immutable en LKG/offline-afspeelbaar;
- de Player doet geen live Sportlink-call;
- providerstorage is privé en service-role-only;
- fysieke LG blijft `UNTESTED` zolang geen hardwaretest is uitgevoerd.

## Gates

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:reset`, `pnpm test:rls`, `pnpm test:a11y`, Control Chromium E2E, `pnpm test:player` en `pnpm test:player:offline`.
