# Lokale Pilot Checklist

Gebruik deze checklist per lokale demonstratie. Een open blokkade betekent dat
de sessie niet als geslaagd of klantgeschikt wordt aangemerkt.

## Omgeving

- [ ] Node 24 en pnpm 11 zijn actief.
- [ ] Docker Desktop en WSL-integratie zijn beschikbaar.
- [ ] De lokale Supabase-stack start met `pnpm db:start`.
- [ ] Migrations en seed-reset slagen met `pnpm db:reset`.
- [ ] `pnpm test:rls` slaagt.
- [ ] FFmpeg staat op `PATH` wanneer media wordt verwerkt.
- [ ] Alleen lokale testdata en lokale credentials zijn gebruikt.
- [ ] Chrome of Edge PWA is de gekozen Player-target.

## Quality gates

- [ ] `pnpm lint` slaagt.
- [ ] `pnpm typecheck` slaagt.
- [ ] `pnpm test` slaagt.
- [ ] `pnpm build` slaagt.
- [ ] `pnpm test:e2e -- tests/e2e/pilot-readiness.spec.ts --project=chromium` slaagt.
- [ ] `pnpm test:a11y` slaagt voor de gewijzigde UI-routes.
- [ ] `pnpm test:player` en `pnpm test:player:offline` slagen.

## Bedieningscontrole

- [ ] Marketing toont het Pilotpad met de vier productstappen.
- [ ] Control login en callback blijven herkenbaar als placeholderauth.
- [ ] Media toont de private tenantbucket en pipeline-inname.
- [ ] Playlists toont de publicatiereview en diens blokkade.
- [ ] Schermen toont playerdiagnostiek en een tijdelijke pairingcode.
- [ ] De pairingmelding staat expliciet op read-only; er wordt geen live
      koppeling geclaimd.
- [ ] Player zonder token toont `UNPAIRED` zonder Auth-user.
- [ ] Player met `demo-online` toont `PLAYING` en `Zomerroute v3`.
- [ ] Een eerder geladen player herstelt als `OFFLINE_PLAYING` bij tijdelijk
      netwerkverlies.

## Blokkerend voor een echte klantpilot

- [ ] Auth is gekoppeld aan een echte server-side sessie en tenantclaims.
- [ ] Upload, media-verwerking en publish maken een echte immutable release.
- [ ] Control claimt een pairingcode en maakt een revocable device-sessie.
- [ ] De Player haalt die live device-sessie en release op.
- [ ] De volledige player reliability matrix is herhaald, inclusief de
      24-uurs mixed-media soak uit `docs/testing-launch-gates.md`.
- [ ] De eigenaar heeft alle hierboven vastgelegde afwijkingen beoordeeld.

## Aftekenen

| Veld | Waarde |
|---|---|
| Datum en tijd | |
| Git commit | |
| Operator | |
| Player-target en browserversie | |
| Uitkomst | geslaagd / geblokkeerd |
| Afwijkingen en vervolgactie | |
